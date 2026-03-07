import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import { 
  Video, 
  Calendar, 
  Clock, 
  User, 
  Plus,
  Bell,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Users,
  ArrowLeft,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { LiveSession, UserProfile } from '../types';

export const LiveClassesPage: React.FC = () => {
  const { isTeacher, profile, studentData } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const courseId = isTeacher ? profile?.assignedCourseId : studentData?.courseId;

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    const fetchSessions = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'liveSessions'),
          where('courseId', '==', courseId)
        ));
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as LiveSession))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        setSessions(all);

        if (isTeacher) {
          const enrollSnap = await getDocs(query(
            collection(db, 'enrollments'),
            where('courseId', '==', courseId)
          ));
          const uids = enrollSnap.docs.map(d => d.data().userId as string);
          const students: UserProfile[] = [];
          for (const uid of uids) {
            const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
            if (!uSnap.empty) students.push(uSnap.docs[0].data() as UserProfile);
          }
          setEnrolledStudents(students);
        }
      } catch (err) {
        console.error('Error fetching sessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [courseId, isTeacher]);

  const now = new Date().toISOString();
  const upcoming = sessions.filter(s => s.startTime >= now);
  const past = sessions.filter(s => s.startTime < now);
  const nextSession = upcoming[0] ?? null;

  const handleMarkAttendance = (studentId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;
    setIsSaving(true);
    try {
      const promises = Object.entries(attendance).map(([studentId, status]) =>
        addDoc(collection(db, 'attendance'), {
          sessionId: selectedSession.id,
          courseId,
          studentId,
          status,
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(promises);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setSelectedSession(null);
        setAttendance({});
      }, 2000);
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-[var(--ui-heading)]">Live Classes</h2>
        {upcoming.length > 0 && (
          <span className="text-xs font-medium px-2 py-1 bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            {upcoming.length} Upcoming
          </span>
        )}
      </div>

      {/* Next Session Hero */}
      {nextSession ? (
        <GlassCard className="p-1 border border-[#6324eb]/30">
          <div className="relative rounded-xl overflow-hidden">
            <div className="w-full aspect-video rounded-lg overflow-hidden relative">
              <img
                alt="Live session preview"
                className="w-full h-full object-cover opacity-40"
                src="https://picsum.photos/seed/classroom/800/450"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/60 to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[#6324eb] font-semibold text-xs mb-1 uppercase tracking-widest">Next Session</p>
                <h3 className="text-xl font-bold mb-3 text-white">{nextSession.title}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{new Date(nextSession.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>
                      {new Date(nextSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(nextSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {nextSession.meetingUrl ? (
              <div className="p-4">
                <a href={nextSession.meetingUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <PrimaryButton className="w-full py-3">
                    <PlayCircle size={20} /> Join Session
                  </PrimaryButton>
                </a>
              </div>
            ) : (
              <div className="p-4">
                <PrimaryButton className="w-full py-3" disabled>
                  <Clock size={20} /> No Meeting Link Yet
                </PrimaryButton>
              </div>
            )}
          </div>
        </GlassCard>
      ) : !loading && (
        <GlassCard className="p-10 text-center border border-white/5">
          <Video size={36} className="mx-auto text-slate-600 mb-3" />
          <p className="text-[var(--ui-heading)] font-bold">No upcoming sessions</p>
          <p className="text-[var(--ui-muted)] text-sm mt-1">
            {isTeacher ? 'Schedule a live session from the dashboard.' : 'Your teacher hasn\'t scheduled any sessions yet.'}
          </p>
        </GlassCard>
      )}

      {/* Upcoming Schedule */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--ui-heading)]">
            <Calendar className="text-[#6324eb]" size={20} /> Upcoming Schedule
          </h3>
          {upcoming.map((session) => {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            return (
              <GlassCard key={session.id} className="p-4 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="bg-[#6324eb]/10 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-[#6324eb] border border-[#6324eb]/20 shrink-0">
                    <span className="text-[10px] font-bold leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{start.getDate()}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-100">{session.title}</p>
                    <p className="text-xs text-slate-400">
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isTeacher && (
                    <button
                      onClick={() => { setSelectedSession(session); setAttendance({}); }}
                      className="text-emerald-400 hover:text-white bg-emerald-500/10 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500/20 flex items-center gap-1"
                    >
                      <Users size={14} /> Attendance
                    </button>
                  )}
                  {session.meetingUrl && (
                    <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                      <button className="text-[#6324eb] hover:text-white bg-white/5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-white/5">
                        Join
                      </button>
                    </a>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Past Sessions */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--ui-heading)]">
            <CheckCircle2 className="text-slate-500" size={20} /> Past Sessions
          </h3>
          {past.map((session) => {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            return (
              <GlassCard key={session.id} className="p-4 flex items-center justify-between border border-white/5 opacity-60">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-slate-400 border border-white/5 shrink-0">
                    <span className="text-[10px] font-bold leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{start.getDate()}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-300">{session.title}</p>
                    <p className="text-xs text-slate-500">
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {isTeacher && (
                  <button
                    onClick={() => { setSelectedSession(session); setAttendance({}); }}
                    className="text-slate-400 hover:text-white bg-white/5 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-white/5 flex items-center gap-1"
                  >
                    <Users size={14} /> Attendance
                  </button>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Attendance Modal */}
      <AnimatePresence>
        {selectedSession && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSession(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-x-0 bottom-0 z-[70] flex flex-col px-4 pb-4"
            >
              <div className="bg-[#0d1225] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-2xl mx-auto w-full">
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Mark Attendance</h3>
                    <p className="text-slate-400 text-sm">{selectedSession.title}</p>
                  </div>
                  <button onClick={() => setSelectedSession(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <ArrowLeft size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                  {enrolledStudents.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-4">No enrolled students found.</p>
                  )}
                  {enrolledStudents.map((student) => (
                    <div key={student.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-[#6324eb]/20 flex items-center justify-center text-[#6324eb] font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{student.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleMarkAttendance(student.uid, 'present')}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            attendance[student.uid] === 'present' 
                              ? "bg-emerald-500 text-white border-emerald-500" 
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400"
                          )}
                        >
                          <CheckCircle2 size={14} /> Present
                        </button>
                        <button 
                          onClick={() => handleMarkAttendance(student.uid, 'absent')}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            attendance[student.uid] === 'absent' 
                              ? "bg-red-500 text-white border-red-500" 
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-red-500/10 hover:text-red-400"
                          )}
                        >
                          <XCircle size={14} /> Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6">
                  <PrimaryButton 
                    className="w-full py-4 relative overflow-hidden" 
                    onClick={saveAttendance}
                    disabled={isSaving || Object.keys(attendance).length === 0}
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : saveSuccess ? (
                      <span className="flex items-center gap-2">
                        <Check size={20} /> Attendance Saved!
                      </span>
                    ) : (
                      "Save Attendance"
                    )}
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
