import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export interface TeacherStudent {
  uid: string;
  name: string;
  email: string;
  role: string;
  // Additional fields that may exist in users collection
  onboardingStatus?: string;
  trainingStatus?: string;
  paymentStatus?: string;
  accessUnlocked?: boolean;
  createdAt?: any;
}

export interface StudentStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
}

// Shared hook for fetching teacher students
export const useTeacherStudents = () => {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Single source of truth: users collection with role='student'
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student')
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        
        // Direct mapping with safe fallbacks
        const studentsData: TeacherStudent[] = studentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            uid: doc.id,
            name: data.name ?? data.fullName ?? data.displayName ?? 'Unknown',
            email: data.email ?? 'No email',
            role: data.role ?? 'student',
            // Optional fields that may exist
            onboardingStatus: data.onboardingStatus,
            trainingStatus: data.trainingStatus,
            paymentStatus: data.paymentStatus,
            accessUnlocked: data.accessUnlocked,
            createdAt: data.createdAt
          };
        });
        
        setStudents(studentsData);
        
      } catch (err) {
        console.error('Failed to load students:', err);
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Calculate stats from the same student dataset
  const stats: StudentStats = {
    total: students.length,
    pending: students.filter(student => 
      student.onboardingStatus === 'approval_pending' ||
      student.onboardingStatus === 'payment_pending' ||
      student.paymentStatus === 'pending'
    ).length,
    active: students.filter(student => 
      student.accessUnlocked === true ||
      student.trainingStatus === 'active' ||
      student.onboardingStatus === 'approved'
    ).length,
    completed: students.filter(student => 
      student.trainingStatus === 'completed'
    ).length
  };

  return {
    students,
    stats,
    loading,
    error
  };
};
