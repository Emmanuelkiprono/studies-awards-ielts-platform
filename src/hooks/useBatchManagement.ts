import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Batch, StudentData, StudentBatchInfo, Course } from '../types';

export const useBatchManagement = (teacherId?: string, courseId?: string) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch batches for a teacher (primary), optionally filtered by course
  useEffect(() => {
    if (!teacherId) return;

    setLoading(true);
    
    // Primary query: filter by teacherId
    let q = query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherId),
      orderBy('startDate', 'desc')
    );

    // Optional secondary filter by courseId if provided
    if (courseId) {
      q = query(
        collection(db, 'batches'),
        where('teacherId', '==', teacherId),
        where('courseId', '==', courseId),
        orderBy('startDate', 'desc')
      );
    }

    console.log('LOADING BATCHES QUERY:', q);
    console.log('FILTERING BY teacherId:', teacherId);
    if (courseId) {
      console.log('ALSO FILTERING BY courseId:', courseId);
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Batch));
      
      console.log('LOADED BATCHES COUNT:', batchesData.length);
      console.log('LOADED BATCHES DATA:', batchesData);
      
      setBatches(batchesData);
      setLoading(false);
      
      // Fallback: if teacher-filtered query returns 0, load all batches
      if (batchesData.length === 0) {
        console.log('NO BATCHES FOUND WITH TEACHER FILTER, LOADING ALL BATCHES...');
        const allBatchesQuery = query(collection(db, 'batches'));
        getDocs(allBatchesQuery).then((allSnapshot) => {
          const allBatches = allSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Batch));
          console.log('ALL BATCHES IN COLLECTION:', allBatches);
          console.log('ALL BATCHES COUNT:', allBatches.length);
        });
      }
    }, (err) => {
      console.error('Error fetching batches:', err);
      setError('Failed to load batches');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacherId, courseId]);

  // Create a new batch
  const createBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'createdAt' | 'updatedAt' | 'currentStudents'>) => {
    try {
      const newBatch = {
        ...batchData,
        currentStudents: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        startDate: Timestamp.fromDate(new Date(batchData.startDate)),
        endDate: batchData.endDate ? Timestamp.fromDate(new Date(batchData.endDate)) : null
      };

      const docRef = await addDoc(collection(db, 'batches'), newBatch);
      return docRef.id;
    } catch (err) {
      console.error('Error creating batch:', err);
      throw new Error('Failed to create batch');
    }
  }, []);

  // Update batch
  const updateBatch = useCallback(async (batchId: string, updates: Partial<Batch>) => {
    try {
      const batchRef = doc(db, 'batches', batchId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        ...(updates.startDate && { startDate: Timestamp.fromDate(new Date(updates.startDate)) }),
        ...(updates.endDate && { endDate: Timestamp.fromDate(new Date(updates.endDate)) })
      };
      
      await updateDoc(batchRef, updateData);
    } catch (err) {
      console.error('Error updating batch:', err);
      throw new Error('Failed to update batch');
    }
  }, []);

  // Delete batch
  const deleteBatch = useCallback(async (batchId: string) => {
    try {
      await deleteDoc(doc(db, 'batches', batchId));
    } catch (err) {
      console.error('Error deleting batch:', err);
      throw new Error('Failed to delete batch');
    }
  }, []);

  // Get batch by ID
  const getBatch = useCallback(async (batchId: string) => {
    try {
      const batchDoc = await getDoc(doc(db, 'batches', batchId));
      if (!batchDoc.exists()) {
        throw new Error('Batch not found');
      }
      return { id: batchDoc.id, ...batchDoc.data() } as Batch;
    } catch (err) {
      console.error('Error fetching batch:', err);
      throw new Error('Failed to fetch batch');
    }
  }, []);

  // Suggest batch for student based on join date
  const suggestBatch = useCallback(async (courseId: string, joinDate: Date = new Date()) => {
    try {
      // Get active batches for the course
      const q = query(
        collection(db, 'batches'),
        where('courseId', '==', courseId),
        where('status', '==', 'active'),
        orderBy('startDate', 'desc')
      );

      const snapshot = await getDocs(q);
      const activeBatches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Batch));

      // Find the most recent batch that started within the last 2 weeks
      const twoWeeksAgo = new Date(joinDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const recentBatch = activeBatches.find(batch => {
        const batchStartDate = batch.startDate.toDate();
        return batchStartDate <= joinDate && batchStartDate >= twoWeeksAgo;
      });

      if (recentBatch) {
        return recentBatch;
      }

      // If no recent batch, suggest the newest active batch
      return activeBatches[0] || null;
    } catch (err) {
      console.error('Error suggesting batch:', err);
      return null;
    }
  }, []);

  // Assign student to batch
  const assignStudentToBatch = useCallback(async (studentUid: string, batchId: string, courseId: string) => {
    try {
      // Get batch info
      const batch = await getBatch(batchId);
      
      // Update student data
      const studentRef = doc(db, 'students', studentUid);
      const batchInfo: StudentBatchInfo = {
        batchId,
        joinedAt: serverTimestamp(),
        currentWeek: 1,
        progressPercent: 0
      };

      await updateDoc(studentRef, {
        batchId,
        batchInfo,
        courseId,
        lastStatusUpdate: serverTimestamp()
      });

      // Update batch student count
      const batchRef = doc(db, 'batches', batchId);
      await updateDoc(batchRef, {
        currentStudents: batch.currentStudents + 1,
        updatedAt: serverTimestamp()
      });

      return batch;
    } catch (err) {
      console.error('Error assigning student to batch:', err);
      throw new Error('Failed to assign student to batch');
    }
  }, [getBatch]);

  // Get students in a batch
  const getBatchStudents = useCallback(async (batchId: string) => {
    try {
      const q = query(
        collection(db, 'students'),
        where('batchId', '==', batchId),
        orderBy('batchInfo.joinedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as StudentData));
    } catch (err) {
      console.error('Error fetching batch students:', err);
      throw new Error('Failed to fetch batch students');
    }
  }, []);

  return {
    batches,
    loading,
    error,
    createBatch,
    updateBatch,
    deleteBatch,
    getBatch,
    suggestBatch,
    assignStudentToBatch,
    getBatchStudents
  };
};
