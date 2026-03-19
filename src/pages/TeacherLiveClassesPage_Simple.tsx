import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, 
  Plus, 
  Play, 
  Square,
  Users,
  Calendar,
  Clock,
  Search,
  Filter,
  DoorOpen,
  DoorClosed,
  Link as LinkIcon,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, orderBy } from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';

interface LiveSession {
  id: string;
  lessonId: string;
  batchId: string;
  teacherId: string;
  title: string;
  meetingLink?: string;
  startedAt?: any;
  endedAt?: any;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  attendanceOpen: boolean;
  attendanceClosed: boolean;
  createdAt: any;
  participantsCount?: number;
}

interface Lesson {
  id: string;
  title: string;
  batchId: string;
  liveEnabled: boolean;
}

interface Batch {
  id: string;
  name: string;
}

export const TeacherLiveClassesPage_Simple: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherProfile } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [showStartForm, setShowStartForm] = useState(false);

  // Fetch lessons for this teacher
  useEffect(() => {
    if (!teacherProfile?.uid) return;

    const q = query(
      collection(db, 'lessons'),
      where('teacherId', '==', teacherProfile.uid),
      where('liveEnabled', '==', true)
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

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedLesson) {
        alert('Please select a lesson');
        return;
      }

      const lesson = lessons.find(l => l.id === selectedLesson);
      if (!lesson) return;

      const sessionData = {
        lessonId: selectedLesson,
        batchId: lesson.batchId,
        teacherId: teacherProfile!.uid,
        title: `${lesson.title} - Live Session`,
        meetingLink: meetingLink || `https://meet.daily.co/${lesson.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        status: 'live' as const,
        attendanceOpen: false,
        attendanceClosed: false,
        startedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        participantsCount: 0
      };

      const docRef = await addDoc(collection(db, 'liveSessions'), sessionData);
      
      setShowStartForm(false);
      setSelectedLesson('');
      setMeetingLink('');
      
      // Navigate to session detail page
      navigate(`/teacher/live-session/${docRef.id}`);
    } catch (err) {
      console.error('Error starting session:', err);
      alert('Failed to start live session');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const sessionRef = doc(db, 'liveSessions', sessionId);
      await updateDoc(sessionRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        attendanceClosed: true
      });
    } catch (err) {
      console.error('Error ending session:', err);
      alert('Failed to end session');
    }
  };

  const handleToggleAttendance = async (sessionId: string, isOpen: boolean) => {
    try {
      const sessionRef = doc(db, 'liveSessions', sessionId);
      await updateDoc(sessionRef, {
        attendanceOpen: isOpen,
        attendanceClosed: !isOpen
      });
    } catch (err) {
      console.error('Error toggling attendance:', err);
      alert('Failed to toggle attendance');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-500';
      case 'scheduled': return 'bg-blue-500';
      case 'ended': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLessonInfo = (lessonId: string) => {
    return lessons.find(l => l.id === lessonId);
  };

  const getBatchInfo = (batchId: string) => {
    return batches.find(b => b.id === batchId);
  };

  const activeSessions = sessions.filter(s => s.status === 'live');
  const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
  const endedSessions = sessions.filter(s => s.status === 'ended');

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
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Live Classes</h2>
          <p className="text-slate-400 font-medium">Start and manage live sessions for your lessons.</p>
        </div>
        <PrimaryButton
          onClick={() => setShowStartForm(true)}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Start Live Class
        </PrimaryButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Video className="text-red-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{activeSessions.length}</div>
              <div className="text-sm text-slate-400">Live Now</div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{scheduledSessions.length}</div>
              <div className="text-sm text-slate-400">Scheduled</div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
              <Clock className="text-gray-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{endedSessions.length}</div>
              <div className="text-sm text-slate-400">Completed</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Start Live Class Form */}
      {showStartForm && (
        <GlassCard className="p-6 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6">Start New Live Class</h3>
          <form onSubmit={handleStartSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Lesson</label>
              <select
                required
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
              >
                <option value="">Select a lesson</option>
                {lessons.map(lesson => {
                  const batch = getBatchInfo(lesson.batchId);
                  return (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title} - {batch?.name || 'Unknown Batch'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Meeting Link (Optional)</label>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.daily.co/room-name"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6324eb] focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to generate automatically</p>
            </div>
            <div className="flex items-center gap-4">
              <PrimaryButton type="submit">Start Live Class</PrimaryButton>
              <button
                type="button"
                onClick={() => setShowStartForm(false)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Live Now</h3>
          <div className="space-y-4">
            {activeSessions.map((session) => {
              const lesson = getLessonInfo(session.lessonId);
              const batch = getBatchInfo(session.batchId);
              
              return (
                <GlassCard key={session.id} className="p-6 border border-red-500/20 bg-red-500/5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <Video className="text-red-500" size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-white">{session.title}</h4>
                          <span className="px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                            LIVE
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-2">
                          {lesson?.title} • {batch?.name}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{session.participantsCount || 0} participants</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>Started {session.startedAt?.toDate?.()?.toLocaleTimeString() || 'N/A'}</span>
                          </div>
                        </div>
                        {session.meetingLink && (
                          <div className="flex items-center gap-2 mt-2">
                            <LinkIcon size={14} className="text-slate-400" />
                            <a
                              href={session.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#6324eb] hover:text-[#6324eb]/80 text-sm"
                            >
                              Join Meeting →
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAttendance(session.id, !session.attendanceOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                          session.attendanceOpen
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {session.attendanceOpen ? <DoorOpen size={16} /> : <DoorClosed size={16} />}
                        {session.attendanceOpen ? 'Attendance Open' : 'Attendance Closed'}
                      </button>
                      <button
                        onClick={() => handleEndSession(session.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                      >
                        <Square size={16} />
                        End Session
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* All Sessions */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">All Sessions</h3>
        <div className="space-y-4">
          {sessions.map((session) => {
            if (session.status === 'live') return null; // Skip active sessions, they're shown above
            
            const lesson = getLessonInfo(session.lessonId);
            const batch = getBatchInfo(session.batchId);
            
            return (
              <GlassCard key={session.id} className="p-6 border border-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center">
                      <Video className="text-[#6324eb]" size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-bold text-white">{session.title}</h4>
                        <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(session.status)}`}>
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-2">
                        {lesson?.title} • {batch?.name}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>Created {session.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</span>
                        </div>
                        {session.startedAt && (
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>Started {session.startedAt.toDate().toLocaleTimeString()}</span>
                          </div>
                        )}
                        {session.endedAt && (
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>Ended {session.endedAt.toDate().toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
          <Video size={48} className="mx-auto text-slate-500/50 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Live Sessions Yet</h3>
          <p className="text-slate-500 mb-6">Start your first live class to begin teaching.</p>
          <PrimaryButton onClick={() => setShowStartForm(true)}>
            <Plus size={20} className="mr-2" />
            Start First Live Class
          </PrimaryButton>
        </div>
      )}
    </motion.div>
  );
};
