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
  Timestamp,
  limit 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Lesson, LessonMaterial, Batch } from '../types';

export const useLessonManagement = (batchId?: string) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch lessons for a batch
  useEffect(() => {
    if (!batchId) return;

    setLoading(true);
    const q = query(
      collection(db, 'lessons'),
      where('batchId', '==', batchId),
      orderBy('weekNumber', 'asc'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Lesson));
      setLessons(lessonsData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching lessons:', err);
      setError('Failed to load lessons');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [batchId]);

  // Create a new lesson
  const createLesson = useCallback(async (lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newLesson = {
        ...lessonData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        scheduledDate: lessonData.scheduledDate ? Timestamp.fromDate(new Date(lessonData.scheduledDate)) : null
      };

      const docRef = await addDoc(collection(db, 'lessons'), newLesson);
      return docRef.id;
    } catch (err) {
      console.error('Error creating lesson:', err);
      throw new Error('Failed to create lesson');
    }
  }, []);

  // Update lesson
  const updateLesson = useCallback(async (lessonId: string, updates: Partial<Lesson>) => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        ...(updates.scheduledDate && { scheduledDate: Timestamp.fromDate(new Date(updates.scheduledDate)) })
      };
      
      await updateDoc(lessonRef, updateData);
    } catch (err) {
      console.error('Error updating lesson:', err);
      throw new Error('Failed to update lesson');
    }
  }, []);

  // Delete lesson
  const deleteLesson = useCallback(async (lessonId: string) => {
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
    } catch (err) {
      console.error('Error deleting lesson:', err);
      throw new Error('Failed to delete lesson');
    }
  }, []);

  // Get lesson by ID
  const getLesson = useCallback(async (lessonId: string) => {
    try {
      const lessonDoc = await getDoc(doc(db, 'lessons', lessonId));
      if (!lessonDoc.exists()) {
        throw new Error('Lesson not found');
      }
      return { id: lessonDoc.id, ...lessonDoc.data() } as Lesson;
    } catch (err) {
      console.error('Error fetching lesson:', err);
      throw new Error('Failed to fetch lesson');
    }
  }, []);

  // Add material to lesson
  const addMaterial = useCallback(async (lessonId: string, material: Omit<LessonMaterial, 'id' | 'uploadedAt'>) => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        throw new Error('Lesson not found');
      }

      const lesson = lessonDoc.data() as Lesson;
      const newMaterial: LessonMaterial = {
        ...material,
        id: Date.now().toString(), // Simple ID generation
        uploadedAt: serverTimestamp()
      };

      const updatedMaterials = [...lesson.materials, newMaterial];
      await updateDoc(lessonRef, {
        materials: updatedMaterials,
        updatedAt: serverTimestamp()
      });

      return newMaterial;
    } catch (err) {
      console.error('Error adding material:', err);
      throw new Error('Failed to add material');
    }
  }, []);

  // Remove material from lesson
  const removeMaterial = useCallback(async (lessonId: string, materialId: string) => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        throw new Error('Lesson not found');
      }

      const lesson = lessonDoc.data() as Lesson;
      const updatedMaterials = lesson.materials.filter(m => m.id !== materialId);
      
      await updateDoc(lessonRef, {
        materials: updatedMaterials,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error removing material:', err);
      throw new Error('Failed to remove material');
    }
  }, []);

  // Reorder lessons
  const reorderLessons = useCallback(async (lessonIds: string[]) => {
    try {
      const batch = lessonIds.map(async (lessonId, index) => {
        const lessonRef = doc(db, 'lessons', lessonId);
        await updateDoc(lessonRef, {
          order: index + 1,
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(batch);
    } catch (err) {
      console.error('Error reordering lessons:', err);
      throw new Error('Failed to reorder lessons');
    }
  }, []);

  // Get lessons by week
  const getLessonsByWeek = useCallback((weekNumber: number) => {
    return lessons.filter(lesson => lesson.weekNumber === weekNumber);
  }, [lessons]);

  // Get current lesson for a student
  const getCurrentLesson = useCallback(async (studentUid: string) => {
    try {
      // Get student data to find current lesson
      const studentDoc = await getDoc(doc(db, 'students', studentUid));
      if (!studentDoc.exists()) {
        throw new Error('Student not found');
      }

      const studentData = studentDoc.data();
      const currentLessonId = studentData.batchInfo?.currentLessonId;

      if (!currentLessonId) {
        // If no current lesson, get the first lesson for their batch
        const batchId = studentData.batchId;
        if (!batchId) {
          return null;
        }

        const q = query(
          collection(db, 'lessons'),
          where('batchId', '==', batchId),
          orderBy('order', 'asc'),
          limit(1)
        );

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Lesson;
        }
        return null;
      }

      return await getLesson(currentLessonId);
    } catch (err) {
      console.error('Error getting current lesson:', err);
      throw new Error('Failed to get current lesson');
    }
  }, [getLesson]);

  // Update student progress to next lesson
  const moveToNextLesson = useCallback(async (studentUid: string) => {
    try {
      // Get current student data
      const studentDoc = await getDoc(doc(db, 'students', studentUid));
      if (!studentDoc.exists()) {
        throw new Error('Student not found');
      }

      const studentData = studentDoc.data();
      const batchId = studentData.batchId;
      const currentOrder = studentData.batchInfo?.currentLessonOrder || 0;

      if (!batchId) {
        throw new Error('Student not assigned to a batch');
      }

      // Get next lesson
      const q = query(
        collection(db, 'lessons'),
        where('batchId', '==', batchId),
        where('order', '>', currentOrder),
        orderBy('order', 'asc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error('No next lesson found');
      }

      const nextLesson = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Lesson;

      // Update student's current lesson
      await updateDoc(doc(db, 'students', studentUid), {
        'batchInfo.currentLessonId': nextLesson.id,
        'batchInfo.currentLessonOrder': nextLesson.order,
        'batchInfo.currentWeek': nextLesson.weekNumber,
        lastStatusUpdate: serverTimestamp()
      });

      return nextLesson;
    } catch (err) {
      console.error('Error moving to next lesson:', err);
      throw new Error('Failed to move to next lesson');
    }
  }, []);

  return {
    lessons,
    loading,
    error,
    createLesson,
    updateLesson,
    deleteLesson,
    getLesson,
    addMaterial,
    removeMaterial,
    reorderLessons,
    getLessonsByWeek,
    getCurrentLesson,
    moveToNextLesson
  };
};
