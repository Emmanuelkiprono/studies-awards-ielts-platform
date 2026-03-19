import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Play, 
  Square, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Video,
  DoorOpen,
  DoorClosed,
  UserCheck,
  UserX,
  Timer
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLiveSession, useAttendance } from '../hooks/useLiveSession';
import { useLessonManagement } from '../hooks/useLessonManagement';
import { useBatchManagement } from '../hooks/useBatchManagement';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import { LiveSession, Attendance, AttendanceStatus, Lesson, Batch } from '../types';

export const TeacherLiveSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { batchId, lessonId } = useParams<{ batchId: string; lessonId: string }>();
  const { profile: teacherProfile } = useAuth();
  const { currentSession, startLiveSession, endLiveSession, openAttendance, closeAttendance } = useLiveSession(lessonId);
  const { attendance, summary, markAttendance } = useAttendance(currentSession?.id);
  const { getLesson } = useLessonManagement(batchId);
  const { getBatch, getBatchStudents } = useBatchManagement();
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [sessionLink, setSessionLink] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch lesson and batch info
  useEffect(() => {
    if (lessonId) {
      getLesson(lessonId).then(setLesson).catch(console.error);
    }
    if (batchId) {
      getBatch(batchId).then(setBatch).catch(console.error);
      getBatchStudents(batchId).then(setBatchStudents).catch(console.error);
    }
  }, [lessonId, batchId, getLesson, getBatch, getBatchStudents]);

  const handleStartSession = async () => {
    if (!lessonId || !batchId) return;
    
    setLoading(true);
    try {
      const sessionId = await startLiveSession(
        lessonId,
        batchId,
        teacherProfile!.uid,
        `${lesson?.title} - Live Session`
      );
      
      // Generate mock meeting link (in production, integrate with Daily.co, Zoom, etc.)
      const mockLink = `https://meet.daily.co/${batch?.name.toLowerCase().replace(/\s+/g, '-')}-${sessionId}`;
      setSessionLink(mockLink);
      
      // Open attendance automatically when session starts
      setTimeout(() => {
        if (sessionId) {
          openAttendance(sessionId);
        }
      }, 1000);
    } catch (err) {
      console.error('Error starting session:', err);
      alert('Failed to start live session');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!currentSession) return;
    
    setLoading(true);
    try {
      await endLiveSession(currentSession.id);
      setSessionLink('');
    } catch (err) {
      console.error('Error ending session:', err);
      alert('Failed to end live session');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = async () => {
    if (!currentSession) return;
    
    try {
      if (currentSession.attendanceOpen) {
        await closeAttendance(currentSession.id);
      } else {
        await openAttendance(currentSession.id);
      }
    } catch (err) {
      console.error('Error toggling attendance:', err);
      alert('Failed to toggle attendance');
    }
  };

  const handleMarkAttendance = async (studentUid: string, status: AttendanceStatus) => {
    if (!currentSession || !lesson) return;
    
    try {
      await markAttendance(
        currentSession.id,
        lesson.id,
        studentUid,
        batchId!,
        status,
        teacherProfile!.uid
      );
    } catch (err) {
      console.error('Error marking attendance:', err);
      alert('Failed to mark attendance');
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return <CheckCircle className="text-green-500" size={20} />;
      case 'late': return <AlertCircle className="text-yellow-500" size={20} />;
      case 'absent': return <XCircle className="text-red-500" size={20} />;
      case 'excused': return <AlertCircle className="text-blue-500" size={20} />;
      default: return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusText = (status: AttendanceStatus | 'not_marked') => {
    switch (status) {
      case 'present': return 'Present';
      case 'late': return 'Late';
      case 'absent': return 'Absent';
      case 'excused': return 'Excused';
      default: return 'Not Marked';
    }
  };

  const getStatusColor = (status: AttendanceStatus | 'not_marked') => {
    switch (status) {
      case 'present': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'late': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'absent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'excused': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (!lesson || !batch) {
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
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
            {lesson.title} - Live Session
          </h2>
          <p className="text-slate-400 font-medium">
            {batch.name} • Week {lesson.weekNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentSession?.status === 'live' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-400 font-medium">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Session Controls */}
      <GlassCard className="p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6">Session Controls</h3>
        
        {!currentSession ? (
          <div className="text-center py-8">
            <Video size={48} className="mx-auto text-slate-500 mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">Start Live Session</h4>
            <p className="text-slate-400 mb-6">Begin the live class for this lesson and open attendance tracking.</p>
            <PrimaryButton
              onClick={handleStartSession}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Play size={20} />
              {loading ? 'Starting...' : 'Start Live Session'}
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-white mb-2">Session is Live</h4>
                <p className="text-slate-400">
                  Started at {currentSession.startedAt?.toDate().toLocaleTimeString()}
                </p>
                {sessionLink && (
                  <div className="mt-2">
                    <a
                      href={sessionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6324eb] hover:text-[#6324eb]/80 text-sm"
                    >
                      Join Meeting →
                    </a>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleAttendance}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                    currentSession.attendanceOpen
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {currentSession.attendanceOpen ? <DoorOpen size={20} /> : <DoorClosed size={20} />}
                  {currentSession.attendanceOpen ? 'Attendance Open' : 'Attendance Closed'}
                </button>
                <PrimaryButton
                  onClick={handleEndSession}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600"
                >
                  <Square size={20} />
                  {loading ? 'Ending...' : 'End Session'}
                </PrimaryButton>
              </div>
            </div>

            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">{summary.totalStudents}</div>
                  <div className="text-sm text-slate-400">Total Students</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-green-400">{summary.presentCount}</div>
                  <div className="text-sm text-slate-400">Present</div>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-yellow-400">{summary.lateCount}</div>
                  <div className="text-sm text-slate-400">Late</div>
                </div>
                <div className="text-center p-4 bg-red-500/10 rounded-xl">
                  <div className="text-2xl font-bold text-red-400">{summary.absentCount}</div>
                  <div className="text-sm text-slate-400">Absent</div>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Attendance Management */}
      {currentSession && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6">Attendance Management</h3>
          
          {!currentSession.attendanceOpen ? (
            <div className="text-center py-8">
              <DoorClosed size={48} className="mx-auto text-slate-500 mb-4" />
              <h4 className="text-lg font-bold text-white mb-2">Attendance is Closed</h4>
              <p className="text-slate-400 mb-6">Open attendance to allow students to join and track their presence.</p>
              <button
                onClick={handleToggleAttendance}
                className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
              >
                Open Attendance
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="text-green-400" size={20} />
                  <span className="text-green-400 font-medium">Attendance is Open</span>
                </div>
                <button
                  onClick={handleToggleAttendance}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Close Attendance
                </button>
              </div>

              <div className="space-y-2">
                {batchStudents.map((student) => {
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
                          <span className="text-sm font-medium">{getStatusText(status)}</span>
                        </div>
                        
                        {currentSession.attendanceOpen && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMarkAttendance(student.uid, 'present')}
                              className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              title="Mark Present"
                            >
                              <UserCheck size={16} />
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(student.uid, 'absent')}
                              className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              title="Mark Absent"
                            >
                              <UserX size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </motion.div>
  );
};
