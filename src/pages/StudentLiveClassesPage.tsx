import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Video,
  Calendar,
  Clock,
  Play,
  Users,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { GlassCard, PrimaryButton } from '../components/UI';
import { useLiveClassJoin } from '../hooks/useLiveClassJoin';

interface LiveSession {
  id: string;
  title: string;
  description?: string;
  batchId: string;
  teacherId: string;
  moduleId?: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  createdAt: any;
  scheduledAt?: any;
}

interface TeacherProfile {
  name: string;
  email?: string;
}

interface BatchInfo {
  name: string;
  courseId: string;
}

export const StudentLiveClassesPage: React.FC = () => {
  const { user, studentData } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedSessions, setJoinedSessions] = useState<Record<string, boolean>>({});
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const { recordJoin } = useLiveClassJoin();

  // Get student's batch info
  useEffect(() => {
    if (!studentData?.batchId) return;

    const batchRef = doc(db, 'batches', studentData.batchId);
    const unsubscribe = getDoc(batchRef).then(snap => {
      if (snap.exists()) {
        setBatchInfo({ name: snap.data().name, courseId: snap.data().courseId });
      }
    });
  }, [studentData?.batchId]);

  // Load live sessions for student's batch
  useEffect(() => {
    if (!studentData?.batchId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'liveSessions'),
      where('batchId', '==', studentData.batchId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const sessionsData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LiveSession))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      setSessions(sessionsData);

      // Load teacher names
      const teachers: Record<string, string> = {};
      for (const session of sessionsData) {
        if (!teachers[session.teacherId]) {
          try {
            const teacherSnap = await getDoc(doc(db, 'users', session.teacherId));
            if (teacherSnap.exists()) {
              teachers[session.teacherId] = teacherSnap.data().name || 'Unknown Teacher';
            }
          } catch (err) {
            console.error('Error fetching teacher info:', err);
          }
        }
      }
      setTeacherNames(teachers);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching live sessions:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData?.batchId]);

  const handleJoinClass = async (session: LiveSession) => {
    if (!user || !studentData?.batchId) {
      alert('Unable to join - student information missing');
      return;
    }

    try {
      // Record the join in database
      await recordJoin(session.id, studentData.batchId, user.uid);

      // Mark as joined in local state
      setJoinedSessions(prev => ({
        ...prev,
        [session.id]: true,
      }));

      // Open the meeting link in a new tab
      window.open(session.meetingLink, '_blank');

      console.log('✅ Joined class:', session.title);
    } catch (err) {
      console.error('Error joining class:', err);
      alert('Failed to join class. Please try again.');
    }
  };

  const now = new Date().toISOString();
  const upcoming = sessions.filter(s => s.startTime > now && s.status !== 'cancelled');
  const live = sessions.filter(s => s.status === 'live');
  const completed = sessions.filter(s => s.startTime <= now && s.status !== 'cancelled');

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!studentData?.batchId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 max-w-2xl mx-auto w-full"
      >
        <GlassCard className="p-8 text-center border border-purple-500/20">
          <Video size={32} className="mx-auto text-purple-400 mb-3" />
          <p className="text-lg font-semibold text-white mb-2">No Batch Assigned</p>
          <p className="text-sm text-slate-400">
            You need to be assigned to a batch to view available live classes. Please contact your instructor.
          </p>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-3xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white mb-2">Live Classes</h1>
        <p className="text-slate-400">
          {batchInfo && `Batch: ${batchInfo.name}`}
        </p>
      </div>

      {/* Live Now Section */}
      {live.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Video className="text-red-500" size={20} />
            <h2 className="text-xl font-bold text-white">🔴 Live Now</h2>
          </div>
          <div className="space-y-3">
            {live.map(session => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <GlassCard className="p-4 border border-red-500/30 bg-red-500/5 hover:border-red-500/50 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-red-400 text-xs font-bold mb-1 flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        LIVE NOW
                      </p>
                      <h3 className="text-lg font-bold text-white mb-2">{session.title}</h3>
                      {session.description && (
                        <p className="text-sm text-slate-400 mb-3">{session.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        {teacherNames[session.teacherId] && (
                          <span>👨‍🏫 {teacherNames[session.teacherId]}</span>
                        )}
                      </div>
                    </div>
                    <PrimaryButton
                      onClick={() => handleJoinClass(session)}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600"
                    >
                      <Play size={16} />
                      Join Now
                    </PrimaryButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions Section */}
      {upcoming.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-purple-400" size={20} />
            <h2 className="text-xl font-bold text-white">Upcoming Classes</h2>
          </div>
          <div className="space-y-3">
            {upcoming.map(session => {
              const { date, time } = formatDateTime(session.startTime);
              const endTime = new Date(session.endTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <GlassCard className="p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">{session.title}</h3>
                        {session.description && (
                          <p className="text-sm text-slate-400 mb-3">{session.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {time} - {endTime}
                          </span>
                          {teacherNames[session.teacherId] && (
                            <span>👨‍🏫 {teacherNames[session.teacherId]}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {joinedSessions[session.id] && (
                          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                            <CheckCircle2 size={14} />
                            Joined
                          </div>
                        )}
                        <PrimaryButton
                          onClick={() => handleJoinClass(session)}
                          disabled={joinedSessions[session.id]}
                          className="flex items-center gap-2"
                        >
                          <Play size={16} />
                          {joinedSessions[session.id] ? 'Rejoin' : 'Join'}
                        </PrimaryButton>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Sessions Section */}
      {completed.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-slate-500" size={20} />
            <h2 className="text-xl font-bold text-white">Completed</h2>
          </div>
          <div className="space-y-2">
            {completed.slice(-3).map(session => {
              const { date, time } = formatDateTime(session.startTime);

              return (
                <GlassCard key={session.id} className="p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">{session.title}</p>
                      <p className="text-xs text-slate-500">
                        {date} • {time}
                      </p>
                    </div>
                    <CheckCircle2 size={16} className="text-slate-600" />
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* No Sessions */}
      {sessions.length === 0 && (
        <GlassCard className="p-10 text-center border border-slate-700/20">
          <Video size={36} className="mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No Classes Scheduled</p>
          <p className="text-sm text-slate-500 mt-2">
            Your instructor hasn't scheduled any live classes yet.
          </p>
        </GlassCard>
      )}
    </motion.div>
  );
};
