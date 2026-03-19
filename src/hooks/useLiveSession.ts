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
  increment 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { LiveSession, Attendance, AttendanceStatus, AttendanceSummary } from '../types';

export const useLiveSession = (lessonId?: string) => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [currentSession, setCurrentSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions for a lesson
  useEffect(() => {
    if (!lessonId) return;

    setLoading(true);
    const q = query(
      collection(db, 'liveSessions'),
      where('lessonId', '==', lessonId),
      orderBy('scheduledAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveSession));
      setSessions(sessionsData);
      
      // Find current live session
      const liveSession = sessionsData.find(s => s.status === 'live');
      setCurrentSession(liveSession || null);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching live sessions:', err);
      setError('Failed to load live sessions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [lessonId]);

  // Start a live session
  const startLiveSession = useCallback(async (lessonId: string, batchId: string, teacherId: string, title?: string) => {
    try {
      const sessionData = {
        lessonId,
        batchId,
        teacherId,
        title: title || `Live Session - ${new Date().toLocaleTimeString()}`,
        status: 'live',
        attendanceOpen: false,
        attendanceClosed: false,
        startedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        participantsCount: 0
      };

      const docRef = await addDoc(collection(db, 'liveSessions'), sessionData);
      return docRef.id;
    } catch (err) {
      console.error('Error starting live session:', err);
      throw new Error('Failed to start live session');
    }
  }, []);

  // End a live session
  const endLiveSession = useCallback(async (sessionId: string) => {
    try {
      const sessionRef = doc(db, 'liveSessions', sessionId);
      await updateDoc(sessionRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        attendanceClosed: true
      });
    } catch (err) {
      console.error('Error ending live session:', err);
      throw new Error('Failed to end live session');
    }
  }, []);

  // Open attendance
  const openAttendance = useCallback(async (sessionId: string) => {
    try {
      const sessionRef = doc(db, 'liveSessions', sessionId);
      await updateDoc(sessionRef, {
        attendanceOpen: true,
        attendanceClosed: false
      });
    } catch (err) {
      console.error('Error opening attendance:', err);
      throw new Error('Failed to open attendance');
    }
  }, []);

  // Close attendance
  const closeAttendance = useCallback(async (sessionId: string) => {
    try {
      const sessionRef = doc(db, 'liveSessions', sessionId);
      await updateDoc(sessionRef, {
        attendanceOpen: false,
        attendanceClosed: true
      });
    } catch (err) {
      console.error('Error closing attendance:', err);
      throw new Error('Failed to close attendance');
    }
  }, []);

  // Get session by ID
  const getSession = useCallback(async (sessionId: string) => {
    try {
      const sessionDoc = await getDoc(doc(db, 'liveSessions', sessionId));
      if (!sessionDoc.exists()) {
        throw new Error('Session not found');
      }
      return { id: sessionDoc.id, ...sessionDoc.data() } as LiveSession;
    } catch (err) {
      console.error('Error fetching session:', err);
      throw new Error('Failed to fetch session');
    }
  }, []);

  return {
    sessions,
    currentSession,
    loading,
    error,
    startLiveSession,
    endLiveSession,
    openAttendance,
    closeAttendance,
    getSession
  };
};

export const useAttendance = (sessionId?: string) => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch attendance for a session
  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    const q = query(
      collection(db, 'attendance'),
      where('sessionId', '==', sessionId),
      orderBy('markedAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendanceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attendance));
      setAttendance(attendanceData);
      
      // Calculate summary
      const summaryData: AttendanceSummary = {
        sessionId,
        lessonId: attendanceData[0]?.lessonId || '',
        batchId: attendanceData[0]?.batchId || '',
        totalStudents: attendanceData.length,
        presentCount: attendanceData.filter(a => a.status === 'present').length,
        lateCount: attendanceData.filter(a => a.status === 'late').length,
        absentCount: attendanceData.filter(a => a.status === 'absent').length,
        excusedCount: attendanceData.filter(a => a.status === 'excused').length,
        attendanceRate: attendanceData.length > 0 ? 
          (attendanceData.filter(a => a.status === 'present' || a.status === 'late').length / attendanceData.length) * 100 : 0,
        date: attendanceData[0]?.markedAt || serverTimestamp()
      };
      setSummary(summaryData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching attendance:', err);
      setError('Failed to load attendance');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Mark attendance for a student
  const markAttendance = useCallback(async (sessionId: string, lessonId: string, studentUid: string, batchId: string, status: AttendanceStatus, markedBy: string, lateMinutes?: number, notes?: string) => {
    try {
      console.log(' STUDENT MARKING ATTENDANCE:', { sessionId, lessonId, studentUid, batchId, status, markedBy });
      
      // Check if attendance already exists
      const existingQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(existingQuery);

      const attendanceData = {
        sessionId,
        lessonId,
        batchId,
        studentUid,
        status,
        markedAt: serverTimestamp(),
        markedBy,
        lateMinutes: lateMinutes || 0,
        notes: notes || ''
      };

      console.log(' ATTENDANCE DATA TO SAVE:', attendanceData);

      if (existingSnapshot.empty) {
        // Create new attendance record
        console.log(' CREATING NEW ATTENDANCE RECORD');
        await addDoc(collection(db, 'attendance'), attendanceData);
      } else {
        // Update existing attendance record
        console.log(' UPDATING EXISTING ATTENDANCE RECORD:', existingSnapshot.docs[0].id);
        await updateDoc(doc(db, 'attendance', existingSnapshot.docs[0].id), attendanceData);
      }
      
      console.log('✅ STUDENT ATTENDANCE MARKED SUCCESSFULLY');
    } catch (err) {
      console.error('❌ ERROR MARKING STUDENT ATTENDANCE:', err);
      throw new Error('Failed to mark attendance');
    }
  }, []);

  // Auto-mark attendance when student joins live session
  const autoMarkAttendance = useCallback(async (sessionId: string, lessonId: string, studentUid: string, batchId: string) => {
    try {
      // Check if attendance already exists
      const existingQuery = query(
        collection(db, 'attendance'),
        where('sessionId', '==', sessionId),
        where('studentUid', '==', studentUid)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        return; // Already marked
      }

      // Auto-mark as present
      await markAttendance(sessionId, lessonId, studentUid, batchId, 'present', '', 0, 'Auto-marked on join');
    } catch (err) {
      console.error('Error auto-marking attendance:', err);
      throw new Error('Failed to auto-mark attendance');
    }
  }, []);

  // Get attendance for a student
  const getStudentAttendance = useCallback(async (studentUid: string, batchId?: string) => {
    try {
      let q = query(
        collection(db, 'attendance'),
        where('studentUid', '==', studentUid),
        orderBy('markedAt', 'desc')
      );

      if (batchId) {
        q = query(
          collection(db, 'attendance'),
          where('studentUid', '==', studentUid),
          where('batchId', '==', batchId),
          orderBy('markedAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attendance));
    } catch (err) {
      console.error('Error fetching student attendance:', err);
      throw new Error('Failed to fetch student attendance');
    }
  }, []);

  // Get attendance summary for a batch
  const getBatchAttendanceSummary = useCallback(async (batchId: string, startDate?: Date, endDate?: Date) => {
    try {
      let q = query(
        collection(db, 'attendance'),
        where('batchId', '==', batchId),
        orderBy('markedAt', 'desc')
      );

      if (startDate && endDate) {
        q = query(
          collection(db, 'attendance'),
          where('batchId', '==', batchId),
          where('markedAt', '>=', Timestamp.fromDate(startDate)),
          where('markedAt', '<=', Timestamp.fromDate(endDate)),
          orderBy('markedAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const attendanceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attendance));

      // Group by lesson
      const lessonSummaries = attendanceData.reduce((acc, record) => {
        const lessonId = record.lessonId;
        if (!acc[lessonId]) {
          acc[lessonId] = {
            lessonId,
            totalStudents: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            attendanceRate: 0
          };
        }
        
        acc[lessonId].totalStudents++;
        if (record.status === 'present') acc[lessonId].presentCount++;
        if (record.status === 'late') acc[lessonId].lateCount++;
        if (record.status === 'absent') acc[lessonId].absentCount++;
        if (record.status === 'excused') acc[lessonId].excusedCount++;
        
        return acc;
      }, {} as Record<string, any>);

      // Calculate rates
      Object.values(lessonSummaries).forEach((summary: any) => {
        summary.attendanceRate = summary.totalStudents > 0 ? 
          ((summary.presentCount + summary.lateCount) / summary.totalStudents) * 100 : 0;
      });

      return Object.values(lessonSummaries);
    } catch (err) {
      console.error('Error fetching batch attendance summary:', err);
      throw new Error('Failed to fetch batch attendance summary');
    }
  }, []);

  return {
    attendance,
    summary,
    loading,
    error,
    markAttendance,
    autoMarkAttendance,
    getStudentAttendance,
    getBatchAttendanceSummary
  };
};
