import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  Plus, 
  Play, 
  Square,
  Upload,
  FileText,
  Video,
  Link,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Video as VideoIcon,
  File,
  ExternalLink,
  UserCheck,
  UserX,
  UserMinus
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  setDoc 
} from 'firebase/firestore';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';

interface Lesson {
  id: string;
  title: string;
  description: string;
  batchId: string;
  courseId: string;
  weekNumber: number;
  order: number;
  liveEnabled: boolean;
  materials: LessonMaterial[];
  createdAt: any;
}

interface LessonMaterial {
  id: string;
  type: 'pdf' | 'video' | 'notes' | 'link';
  title: string;
  url: string;
  uploadedAt: any;
}

interface Batch {
  id: string;
  name: string;
  courseId: string;
}

interface Student {
  uid: string;
  name: string;
  email: string;
  batchId: string;
}

interface LiveSession {
  id: string;
  lessonId: string;
  batchId: string;
  teacherId: string;
  meetingLink?: string;
  status: 'not_started' | 'live' | 'ended';
  startedAt?: any;
  endedAt?: any;
  attendanceOpen: boolean;
  attendanceClosed: boolean;
  createdAt: any;
}

interface Attendance {
  id: string;
  sessionId: string;
  lessonId: string;
  batchId: string;
  studentUid: string;
  status: 'present' | 'late' | 'absent';
  markedAt: any;
  markedBy: string;
}

export const TeacherLessonDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();
  const { profile: teacherProfile } = useAuth();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  console.log('LESSON DETAILS OPENED:', lessonId);

  // Load lesson details
  useEffect(() => {
    if (!lessonId) return;

    const lessonRef = doc(db, 'lessons', lessonId);
    const unsubscribeLesson = onSnapshot(lessonRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const lessonData = {
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Lesson;
        
        console.log('LESSON DATA:', lessonData);
        setLesson(lessonData);
        setError(null);
      } else {
        setError('Lesson not found');
        setLoading(false);
      }
    }, (err) => {
      console.error('Error loading lesson:', err);
      setError('Failed to load lesson');
      setLoading(false);
    });

    return () => unsubscribeLesson();
  }, [lessonId]);

  // Load batch details when lesson is loaded
  useEffect(() => {
    if (!lesson?.batchId) return;

    const batchRef = doc(db, 'batches', lesson.batchId);
    const unsubscribeBatch = onSnapshot(batchRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const batchData = {
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Batch;
        setBatch(batchData);
      }
    });

    return () => unsubscribeBatch();
  }, [lesson?.batchId]);

  // Load students for this batch
  useEffect(() => {
    if (!lesson?.batchId) return;

    const studentsQuery = query(
      collection(db, 'students'),
      where('batchId', '==', lesson.batchId)
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as Student));
      setStudents(studentsData);
    });

    return () => unsubscribeStudents();
  }, [lesson?.batchId]);

  // Load live session for this lesson
  useEffect(() => {
    if (!lessonId) return;

    const liveSessionQuery = query(
      collection(db, 'liveSessions'),
      where('lessonId', '==', lessonId)
    );

    const unsubscribeLiveSession = onSnapshot(liveSessionQuery, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as LiveSession;
        console.log('LIVE SESSION:', sessionData);
        setLiveSession(sessionData);
      } else {
        setLiveSession(null);
      }
      setLoading(false);
    });

    return () => unsubscribeLiveSession();
  }, [lessonId]);

  // Load attendance for this lesson
  useEffect(() => {
    if (!liveSession?.id) return;

    const attendanceQuery = query(
      collection(db, 'attendance'),
      where('sessionId', '==', liveSession.id)
    );

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const attendanceData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Attendance));
      console.log('ATTENDANCE DATA:', attendanceData);
      setAttendance(attendanceData);
    });

    return () => unsubscribeAttendance;
  }, [liveSession?.id]);

  const startLiveClass = async () => {
    if (!lesson || !teacherProfile) return;
    
    setActionLoading('start');
    try {
      const sessionData = {
        lessonId: lesson.id,
        batchId: lesson.batchId,
        teacherId: teacherProfile.uid,
        meetingLink: `https://meet.jit.si/${lesson.id}-${Date.now()}`,
        status: 'live',
        startedAt: serverTimestamp(),
        attendanceOpen: false,
        attendanceClosed: false,
        createdAt: serverTimestamp()
      };

      if (liveSession) {
        await updateDoc(doc(db, 'liveSessions', liveSession.id), sessionData);
      } else {
        await addDoc(collection(db, 'liveSessions'), sessionData);
      }
    } catch (error) {
      console.error('Error starting live class:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const endLiveClass = async () => {
    if (!liveSession) return;
    
    setActionLoading('end');
    try {
      await updateDoc(doc(db, 'liveSessions', liveSession.id), {
        status: 'ended',
        endedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error ending live class:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const openAttendance = async () => {
    if (!liveSession) return;
    
    setActionLoading('attendance');
    try {
      await updateDoc(doc(db, 'liveSessions', liveSession.id), {
        attendanceOpen: true,
        attendanceClosed: false
      });
    } catch (error) {
      console.error('Error opening attendance:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const closeAttendance = async () => {
    if (!liveSession) return;
    
    setActionLoading('attendance');
    try {
      await updateDoc(doc(db, 'liveSessions', liveSession.id), {
        attendanceOpen: false,
        attendanceClosed: true
      });
    } catch (error) {
      console.error('Error closing attendance:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const markAttendance = async (studentUid: string, status: 'present' | 'late' | 'absent') => {
    if (!liveSession) return;
    
    try {
      const attendanceRef = doc(db, 'attendance', `${liveSession.id}-${studentUid}`);
      await setDoc(attendanceRef, {
        sessionId: liveSession.id,
        lessonId: lesson!.id,
        batchId: lesson!.batchId,
        studentUid,
        status,
        markedAt: serverTimestamp(),
        markedBy: teacherProfile!.uid
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const getAttendanceStatus = (studentUid: string) => {
    return attendance.find(a => a.studentUid === studentUid);
  };

  const getAttendanceCount = () => {
    const present = attendance.filter(a => a.status === 'present').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    return { present, late, absent };
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'pdf': return FileText;
      case 'video': return Video;
      case 'notes': return File;
      case 'link': return Link;
      default: return File;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500';
      case 'ended': return 'bg-gray-500';
      case 'not_started': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getAttendanceColor = (status: string) => {
    switch (status) {
      case 'present': return 'text-green-400';
      case 'late': return 'text-yellow-400';
      case 'absent': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="text-center py-24 bg-red-500/10 rounded-3xl border border-red-500/30">
        <h3 className="text-xl font-bold text-white mb-2">Error</h3>
        <p className="text-slate-400 mb-6">{error || 'Lesson not found'}</p>
        <button
          onClick={() => navigate('/teacher/batches')}
          className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
        >
          Back to Batches
        </button>
      </div>
    );
  }

  const attendanceCounts = getAttendanceCount();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/teacher/batches/${lesson.batchId}`)}
          className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">{lesson.title}</h2>
          <p className="text-slate-400 font-medium">Lesson Details and Management</p>
        </div>
      </div>

      {/* Lesson Summary */}
      <GlassCard className="p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6">Lesson Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <BookOpen size={16} />
              <span className="text-sm">Batch</span>
            </div>
            <span className="text-lg font-bold text-white">{batch?.name || 'Loading...'}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Calendar size={16} />
              <span className="text-sm">Week</span>
            </div>
            <span className="text-lg font-bold text-white">Week {lesson.weekNumber}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={16} />
              <span className="text-sm">Order</span>
            </div>
            <span className="text-lg font-bold text-white">#{lesson.order}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <VideoIcon size={16} />
              <span className="text-sm">Live Class</span>
            </div>
            <span className={`px-3 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(liveSession?.status || 'not_started')}`}>
              {liveSession?.status === 'live' ? 'Live Now' : 
               liveSession?.status === 'ended' ? 'Ended' : 'Not Started'}
            </span>
          </div>
        </div>
        
        {lesson.description && (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <FileText size={16} />
              <span className="text-sm">Description</span>
            </div>
            <p className="text-white">{lesson.description}</p>
          </div>
        )}
      </GlassCard>

      {/* Lesson Materials */}
      <GlassCard className="p-6 border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Lesson Materials</h3>
          <PrimaryButton>
            <Plus size={16} className="mr-2" />
            Add Material
          </PrimaryButton>
        </div>

        {(!lesson.materials || lesson.materials.length === 0) ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
            <Upload size={48} className="mx-auto text-slate-500/50 mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">No materials uploaded</h4>
            <p className="text-slate-500">Upload PDFs, videos, notes, or links for this lesson.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lesson.materials.map((material) => {
              const Icon = getMaterialIcon(material.type);
              return (
                <div key={material.id} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6324eb]/10 flex items-center justify-center">
                      <Icon size={20} className="text-[#6324eb]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{material.title}</h4>
                      <p className="text-sm text-slate-400 capitalize">{material.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(material.url, '_blank')}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Live Class Section */}
      <GlassCard className="p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6">Live Class</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <VideoIcon size={16} />
              <span className="text-sm">Status</span>
            </div>
            <span className={`px-3 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(liveSession?.status || 'not_started')}`}>
              {liveSession?.status === 'live' ? 'Live Now' : 
               liveSession?.status === 'ended' ? 'Ended' : 'Not Started'}
            </span>
          </div>
          
          {liveSession?.meetingLink && (
            <div>
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Link size={16} />
                <span className="text-sm">Meeting Link</span>
              </div>
              <button
                onClick={() => window.open(liveSession.meetingLink, '_blank')}
                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
              >
                Join Meeting <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-6">
          {liveSession?.status === 'live' ? (
            <>
              <button
                onClick={endLiveClass}
                disabled={actionLoading === 'end'}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'end' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Square size={16} />
                )}
                End Live Class
              </button>
              
              <button
                onClick={liveSession.attendanceOpen ? closeAttendance : openAttendance}
                disabled={actionLoading === 'attendance'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  liveSession.attendanceOpen 
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {actionLoading === 'attendance' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Users size={16} />
                )}
                {liveSession.attendanceOpen ? 'Close Attendance' : 'Open Attendance'}
              </button>
            </>
          ) : (
            <button
              onClick={startLiveClass}
              disabled={actionLoading === 'start'}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'start' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Start Live Class
            </button>
          )}
        </div>
      </GlassCard>

      {/* Attendance Panel */}
      {liveSession && (
        <GlassCard className="p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Attendance</h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle size={16} /> Present: {attendanceCounts.present}
              </span>
              <span className="flex items-center gap-1 text-yellow-400">
                <AlertCircle size={16} /> Late: {attendanceCounts.late}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle size={16} /> Absent: {attendanceCounts.absent}
              </span>
            </div>
          </div>

          {!liveSession.attendanceOpen && !liveSession.attendanceClosed ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
              <Users size={48} className="mx-auto text-slate-500/50 mb-4" />
              <h4 className="text-lg font-bold text-white mb-2">Attendance Not Open</h4>
              <p className="text-slate-500">Start the live class and open attendance to begin tracking.</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
              <Users size={48} className="mx-auto text-slate-500/50 mb-4" />
              <h4 className="text-lg font-bold text-white mb-2">No students assigned to this batch yet</h4>
              <p className="text-slate-500">Students will appear here once they are approved and assigned to this batch.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                    <th className="pb-3 font-medium">Student</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Mark Attendance</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {students.map((student) => {
                    const attendanceStatus = getAttendanceStatus(student.uid);
                    return (
                      <tr key={student.uid} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#6324eb]/10 flex items-center justify-center">
                              <Users size={16} className="text-[#6324eb]" />
                            </div>
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-slate-400">{student.email}</td>
                        <td className="py-4">
                          {attendanceStatus ? (
                            <span className={`flex items-center gap-1 ${getAttendanceColor(attendanceStatus.status)}`}>
                              {attendanceStatus.status === 'present' && <CheckCircle size={16} />}
                              {attendanceStatus.status === 'late' && <AlertCircle size={16} />}
                              {attendanceStatus.status === 'absent' && <XCircle size={16} />}
                              {attendanceStatus.status.charAt(0).toUpperCase() + attendanceStatus.status.slice(1)}
                            </span>
                          ) : (
                            <span className="text-slate-500">Not marked</span>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => markAttendance(student.uid, 'present')}
                              className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                              title="Mark Present"
                            >
                              <UserCheck size={16} />
                            </button>
                            <button
                              onClick={() => markAttendance(student.uid, 'late')}
                              className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                              title="Mark Late"
                            >
                              <AlertCircle size={16} />
                            </button>
                            <button
                              onClick={() => markAttendance(student.uid, 'absent')}
                              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              title="Mark Absent"
                            >
                              <UserMinus size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}
    </motion.div>
  );
};
