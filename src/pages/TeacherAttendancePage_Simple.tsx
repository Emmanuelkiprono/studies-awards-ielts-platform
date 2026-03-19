import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar,
  Clock,
  Search,
  Filter,
  UserCheck as AttendanceIcon,
  DoorOpen,
  DoorClosed,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, orderBy, getDoc, getDocs } from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';

interface Attendance {
  id: string;
  sessionId: string;
  lessonId: string;
  studentUid: string;
  batchId: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  markedAt: any;
  markedBy?: string;
  autoMarked: boolean;
}

interface LiveSession {
  id: string;
  lessonId: string;
  batchId: string;
  teacherId: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  attendanceOpen: boolean;
  attendanceClosed: boolean;
  startedAt?: any;
  endedAt?: any;
  createdAt: any;
}

interface Student {
  uid: string;
  name: string;
  email: string;
  batchId?: string;
}

interface Lesson {
  id: string;
  title: string;
  batchId: string;
}

interface Batch {
  id: string;
  name: string;
}

export const TeacherAttendancePage_Simple: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherProfile } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch batches
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'batches'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Batch));
      setBatches(batchesData);
    }, (err) => {
      console.error('Error fetching batches:', err);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  // Fetch students
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as Student));
      setStudents(studentsData);
    }, (err) => {
      console.error('Error fetching students:', err);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  // Fetch lessons
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'lessons'),
      where('teacherId', '==', teacherProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Lesson));
      setLessons(lessonsData);
    }, (err) => {
      console.error('Error fetching lessons:', err);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  // Fetch live sessions
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'liveSessions'),
      where('teacherId', '==', teacherProfile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveSession));
      setSessions(sessionsData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching sessions:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacherProfile]);

  // Fetch attendance for selected session
  useEffect(() => {
    if (!selectedSession) return;

    const q = query(
      collection(db, 'attendance'),
      where('sessionId', '==', selectedSession)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendanceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attendance));
      setAttendance(attendanceData);
    }, (err) => {
      console.error('Error fetching attendance:', err);
    });

    return () => unsubscribe();
  }, [selectedSession]);

  const handleMarkAttendance = async (studentUid: string, status: 'present' | 'late' | 'absent' | 'excused') => {
    if (!selectedSession) return;

    try {
      const session = sessions.find(s => s.id === selectedSession);
      if (!session) return;

      // Check if attendance already exists
      const existingAttendance = attendance.find(a => a.studentUid === studentUid);
      
      if (existingAttendance) {
        // Update existing attendance
        const attendanceRef = doc(db, 'attendance', existingAttendance.id);
        await updateDoc(attendanceRef, {
          status,
          markedAt: serverTimestamp(),
          markedBy: teacherProfile!.uid,
          autoMarked: false
        });
      } else {
        // Create new attendance record
        await addDoc(collection(db, 'attendance'), {
          sessionId: selectedSession,
          lessonId: session.lessonId,
          studentUid,
          batchId: session.batchId,
          status,
          markedAt: serverTimestamp(),
          markedBy: teacherProfile!.uid,
          autoMarked: false
        });
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      alert('Failed to mark attendance');
    }
  };

  const handleToggleAttendance = async (isOpen: boolean) => {
    if (!selectedSession) return;

    try {
      const sessionRef = doc(db, 'liveSessions', selectedSession);
      await updateDoc(sessionRef, {
        attendanceOpen: isOpen,
        attendanceClosed: !isOpen
      });
    } catch (err) {
      console.error('Error toggling attendance:', err);
      alert('Failed to toggle attendance');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="text-green-500" size={20} />;
      case 'late': return <AlertCircle className="text-yellow-500" size={20} />;
      case 'absent': return <XCircle className="text-red-500" size={20} />;
      case 'excused': return <AlertCircle className="text-blue-500" size={20} />;
      default: return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'late': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'absent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'excused': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSessionInfo = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    const lesson = lessons.find(l => l.id === session?.lessonId);
    const batch = batches.find(b => b.id === session?.batchId);
    
    return { session, lesson, batch };
  };

  const getBatchStudents = (batchId: string) => {
    return students.filter(student => student.batchId === batchId);
  };

  const currentSession = sessions.find(s => s.id === selectedSession);
  const sessionInfo = currentSession ? getSessionInfo(currentSession.id) : null;
  const batchStudents = sessionInfo?.batch ? getBatchStudents(sessionInfo.batch.id) : [];

  // Calculate attendance summary
  const attendanceSummary = attendance.reduce((acc, record) => {
    acc.total++;
    if (record.status === 'present') acc.present++;
    else if (record.status === 'late') acc.late++;
    else if (record.status === 'absent') acc.absent++;
    else if (record.status === 'excused') acc.excused++;
    return acc;
  }, { total: 0, present: 0, late: 0, absent: 0, excused: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Attendance Management</h2>
          <p className="text-slate-400 font-medium">Track and manage student attendance for live sessions.</p>
        </div>
      </div>

      {/* Session Selection */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
          >
            <option value="">Select a session to manage attendance</option>
            {sessions.map(session => {
              const lesson = lessons.find(l => l.id === session.lessonId);
              const batch = batches.find(b => b.id === session.batchId);
              return (
                <option key={session.id} value={session.id}>
                  {lesson?.title || 'Unknown Lesson'} - {batch?.name || 'Unknown Batch'} ({session.status})
                </option>
              );
            })}
          </select>
        </div>
        <button
          onClick={() => setSelectedSession('')}
          className="px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {selectedSession && currentSession && (
        <>
          {/* Session Info and Controls */}
          <GlassCard className="p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{currentSession.title}</h3>
                <p className="text-slate-400">
                  {sessionInfo?.lesson?.title} • {sessionInfo?.batch?.name}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                  <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${
                    currentSession.status === 'live' ? 'bg-red-500' : 'bg-gray-500'
                  }`}>
                    {currentSession.status.toUpperCase()}
                  </span>
                  {currentSession.startedAt && (
                    <span>Started: {currentSession.startedAt.toDate().toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleAttendance(!currentSession.attendanceOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                    currentSession.attendanceOpen
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {currentSession.attendanceOpen ? <DoorOpen size={20} /> : <DoorClosed size={20} />}
                  {currentSession.attendanceOpen ? 'Attendance Open' : 'Attendance Closed'}
                </button>
              </div>
            </div>

            {/* Attendance Summary */}
            {attendance.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">{attendanceSummary.total}</div>
                  <div className="text-sm text-slate-400">Total Students</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-green-400">{attendanceSummary.present}</div>
                  <div className="text-sm text-slate-400">Present</div>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-yellow-400">{attendanceSummary.late}</div>
                  <div className="text-sm text-slate-400">Late</div>
                </div>
                <div className="text-center p-4 bg-red-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-red-400">{attendanceSummary.absent}</div>
                  <div className="text-sm text-slate-400">Absent</div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Attendance List */}
          <GlassCard className="p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Student Attendance</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
                />
              </div>
            </div>

            {!currentSession.attendanceOpen && (
              <div className="text-center py-8 mb-6 bg-orange-500/10 rounded-xl border border-orange-500/30">
                <DoorClosed className="mx-auto text-orange-400 mb-2" size={32} />
                <h4 className="text-lg font-bold text-white mb-2">Attendance is Closed</h4>
                <p className="text-slate-400">Open attendance to allow students to join and track their presence.</p>
              </div>
            )}

            <div className="space-y-3">
              {batchStudents
                .filter(student => 
                  student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  student.email.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((student) => {
                  const studentAttendance = attendance.find(a => a.studentUid === student.uid);
                  const status = studentAttendance?.status || 'not_marked';
                  
                  return (
                    <div
                      key={student.uid}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#6324eb]/10 flex items-center justify-center">
                          <Users className="text-[#6324eb]" size={20} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{student.name}</h4>
                          <p className="text-sm text-slate-400">{student.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                          <span className="text-sm font-medium">
                            {status === 'not_marked' ? 'Not Marked' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                        
                        {currentSession.attendanceOpen && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMarkAttendance(student.uid, 'present')}
                              className="p-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              title="Mark Present"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(student.uid, 'late')}
                              className="p-2 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                              title="Mark Late"
                            >
                              <AlertCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(student.uid, 'absent')}
                              className="p-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              title="Mark Absent"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </GlassCard>
        </>
      )}

      {!selectedSession && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <AttendanceIcon size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Select a Session</h3>
          <p className="text-slate-500">Choose a live session to manage attendance.</p>
        </div>
      )}
    </motion.div>
  );
};
