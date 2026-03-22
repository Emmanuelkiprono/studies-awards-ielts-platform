import { useCallback, useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface LiveClassJoin {
  id: string;
  sessionId: string;
  batchId: string;
  studentId: string;
  joinedAt: Timestamp;
  status: 'joined' | 'present' | 'absent' | 'late';
}

export const useLiveClassJoin = () => {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Record a student joining a live class
  const recordJoin = useCallback(async (sessionId: string, batchId: string, studentId: string) => {
    setIsJoining(true);
    setError(null);

    try {
      // Check if student already joined this session
      const existingJoin = await getDocs(
        query(
          collection(db, 'live_class_joins'),
          where('sessionId', '==', sessionId),
          where('studentId', '==', studentId)
        )
      );

      if (!existingJoin.empty) {
        console.log('✅ Student already joined this class');
        return existingJoin.docs[0].id;
      }

      // Record the join
      const joinData = {
        sessionId,
        batchId,
        studentId,
        joinedAt: serverTimestamp(),
        status: 'joined' as const,
      };

      const docRef = await addDoc(collection(db, 'live_class_joins'), joinData);

      console.log('✅ Join recorded successfully:', {
        id: docRef.id,
        studentId,
        sessionId,
      });

      return docRef.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record join';
      setError(errorMessage);
      console.error('❌ Error recording join:', err);
      throw err;
    } finally {
      setIsJoining(false);
    }
  }, []);

  // Get all joins for a specific session
  const getSessionJoins = useCallback(async (sessionId: string): Promise<LiveClassJoin[]> => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'live_class_joins'),
          where('sessionId', '==', sessionId)
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveClassJoin));
    } catch (err) {
      console.error('Error fetching session joins:', err);
      return [];
    }
  }, []);

  // Get all joins for a student
  const getStudentJoins = useCallback(async (studentId: string): Promise<LiveClassJoin[]> => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'live_class_joins'),
          where('studentId', '==', studentId)
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveClassJoin));
    } catch (err) {
      console.error('Error fetching student joins:', err);
      return [];
    }
  }, []);

  return {
    recordJoin,
    getSessionJoins,
    getStudentJoins,
    isJoining,
    error,
  };
};
