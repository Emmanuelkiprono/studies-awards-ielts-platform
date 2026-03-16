import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GlassCard, PrimaryButton } from '../components/UI';
import {
  Video, Calendar, Clock, PlayCircle, CheckCircle2,
  XCircle, Users, ArrowLeft, Check, Radio, VideoOff, Maximize2, Minimize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import {
  collection, addDoc, serverTimestamp, getDocs, query, where,
  doc, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { LiveSession, UserProfile } from '../types';

const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY as string | undefined;

async function createDailyRoom(sessionTitle: string): Promise<string> {
  // Always return a mock room URL for now to avoid server-side fetch issues
  const slug = sessionTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  return `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
  
  // Real Daily.co API call (commented out for server-side compatibility)
  /*
  if (!DAILY_API_KEY) {
    const slug = sessionTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    return `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
  }
  
  // Only use fetch on client-side
  if (typeof window === 'undefined') {
    const slug = sessionTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    return `https://ielts-academy.daily.co/${slug}-${Date.now()}`;
  }
  
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DAILY_API_KEY}` },
    body: JSON.stringify({
      name: `ielts-${Date.now()}`,
      privacy: 'public',
      properties: { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, enable_chat: true, enable_screenshare: true },
    }),
  });
  if (!res.ok) throw new Error('Failed to create Daily room');
  const data = await res.json();
  return data.url as string;
  */
}

export const LiveClassesPage: React.FC = () => {
  const { isTeacher, profile, studentData } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<{ session: LiveSession; roomUrl: string } | null>(null);
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const courseId = isTeacher ? profile?.assignedCourseId : studentData?.courseId;

  // Handle direct video room opening from navigation state
  useEffect(() => {
    if (location.state?.activeRoom) {
      setActiveRoom(location.state.activeRoom);
      // Clear the navigation state to prevent re-opening on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    const q = query(collection(db, 'liveSessions'), where('courseId', '==', courseId));
    const unsub = onSnapshot(q, async (snap) => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as LiveSession))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSessions(all);
      if (isTeacher) {
        const enrollSnap = await getDocs(query(collection(db, 'enrollments'), where('courseId', '==', courseId)));
        const uids = enrollSnap.docs.map(d => d.data().userId as string);
        const students: UserProfile[] = [];
        for (const uid of uids) {
          const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
          if (!uSnap.empty) students.push(uSnap.docs[0].data() as UserProfile);
        }
        setEnrolledStudents(students);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [courseId, isTeacher]);

  const now = new Date().toISOString();
  const upcoming = sessions.filter(s => s.startTime >= now && !s.isLive);
  const live = sessions.filter(s => s.isLive);
  const past = sessions.filter(s => s.startTime < now && !s.isLive);
  const nextSession = upcoming[0] ?? null;

  const handleStartLive = async (session: LiveSession) => {
    setIsStarting(session.id);
    try {
      let roomUrl = session.roomUrl;
      if (!roomUrl) roomUrl = await createDailyRoom(session.title);
      await updateDoc(doc(db, 'liveSessions', session.id), { isLive: true, roomUrl, startedAt: new Date().toISOString() });
      setActiveRoom({ session: { ...session, roomUrl }, roomUrl });
    } catch (err) {
      console.error(err);
      alert('Could not start the live class. Please try again.');
    } finally {
      setIsStarting(null);
    }
  };

  const handleEndLive = async (session: LiveSession) => {
    await updateDoc(doc(db, 'liveSessions', session.id), { isLive: false });
    setActiveRoom(null);
  };

  const handleJoinRoom = (session: LiveSession) => {
    if (!session.roomUrl) return;
    setActiveRoom({ session, roomUrl: session.roomUrl });
  };

  const handleMarkAttendance = (studentId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;
    setIsSaving(true);
    try {
      await Promise.all(Object.entries(attendance).map(([studentId, status]) =>
        addDoc(collection(db, 'attendance'), { sessionId: selectedSession.id, courseId, studentId, status, date: new Date().toISOString(), createdAt: serverTimestamp() })
      ));
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); setSelectedSession(null); setAttendance({}); }, 2000);
    } catch { alert('Failed to save attendance.'); }
    finally { setIsSaving(false); }
  };

  // ── IN-APP VIDEO ROOM ──────────────────────────────────────────────────────
  if (activeRoom) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className={cn('flex flex-col', isFullscreen ? 'fixed inset-0 z-[100] bg-black' : 'p-4 max-w-4xl mx-auto w-full pb-24 space-y-4')}
      >
        <div className={cn('flex items-center justify-between', isFullscreen ? 'absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent' : '')}>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveRoom(null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-white font-bold">{activeRoom.session.title}</p>
              <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                LIVE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullscreen(f => !f)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {isTeacher && (
              <button onClick={() => handleEndLive(activeRoom.session)} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">
                <VideoOff size={16} /> End Class
              </button>
            )}
          </div>
        </div>

        <iframe
          src={activeRoom.roomUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className={cn('w-full rounded-2xl border border-white/10', isFullscreen ? 'h-screen' : 'h-[70vh]')}
          style={{ background: '#0a0a1a' }}
          title="Live Class"
        />

        {isTeacher && !isFullscreen && (
          <button onClick={() => { setSelectedSession(activeRoom.session); setAttendance({}); }}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold hover:bg-emerald-500/20 w-full justify-center">
            <Users size={16} /> Mark Attendance
          </button>
        )}
      </motion.div>
    );
  }

  // ── MAIN PAGE ──────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-[var(--ui-heading)]">Live Classes</h2>
        <div className="flex items-center gap-2">
          {live.length > 0 && (
            <span className="text-xs font-medium px-2 py-1 bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {live.length} Live Now
            </span>
          )}
          {upcoming.length > 0 && (
            <span className="text-xs font-medium px-2 py-1 bg-[#6324eb]/20 text-[#a78bfa] rounded-full">{upcoming.length} Upcoming</span>
          )}
        </div>
      </div>

      {/* 🔴 LIVE NOW */}
      {live.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--ui-heading)]">
            <Radio className="text-red-400" size={20} /> Live Now
          </h3>
          {live.map(session => (
            <GlassCard key={session.id} className="p-4 border border-red-500/30 bg-red-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                    <Radio size={22} className="text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{session.title}</p>
                    <p className="text-xs text-red-400 font-medium">Class in progress</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isTeacher ? (
                    <>
                      <button onClick={() => handleJoinRoom(session)} className="flex items-center gap-1 px-3 py-2 bg-[#6324eb] hover:bg-[#7c3aed] text-white rounded-xl text-xs font-bold">
                        <Video size={14} /> Rejoin
                      </button>
                      <button onClick={() => handleEndLive(session)} className="flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold border border-red-500/20">
                        <VideoOff size={14} /> End
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleJoinRoom(session)} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">
                      <PlayCircle size={16} /> Join Now
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Next session hero */}
      {nextSession && (
        <GlassCard className="p-1 border border-[#6324eb]/30">
          <div className="relative rounded-xl overflow-hidden">
            <div className="w-full aspect-video rounded-lg overflow-hidden relative">
              <img alt="Live session preview" className="w-full h-full object-cover opacity-40" src="https://picsum.photos/seed/classroom/800/450" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[#6324eb] font-semibold text-xs mb-1 uppercase tracking-widest">Next Session</p>
                <h3 className="text-xl font-bold mb-3 text-white">{nextSession.title}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <div className="flex items-center gap-1"><Calendar size={14} /><span>{new Date(nextSession.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                  <div className="flex items-center gap-1"><Clock size={14} /><span>{new Date(nextSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(nextSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4">
              {isTeacher ? (
                <PrimaryButton className="w-full py-3" onClick={() => handleStartLive(nextSession)} disabled={isStarting === nextSession.id}>
                  {isStarting === nextSession.id ? (
                    <span className="flex items-center gap-2"><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Starting...</span>
                  ) : <><Radio size={18} /> Start Live Class</>}
                </PrimaryButton>
              ) : (
                <PrimaryButton className="w-full py-3" disabled><Clock size={20} /> Waiting for teacher to start...</PrimaryButton>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {!loading && sessions.length === 0 && (
        <GlassCard className="p-10 text-center border border-white/5">
          <Video size={36} className="mx-auto text-slate-600 mb-3" />
          <p className="text-[var(--ui-heading)] font-bold">No sessions scheduled</p>
          <p className="text-[var(--ui-muted)] text-sm mt-1">{isTeacher ? 'Schedule a live session from the dashboard.' : "Your teacher hasn't scheduled any sessions yet."}</p>
        </GlassCard>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--ui-heading)]"><Calendar className="text-[#6324eb]" size={20} /> Upcoming Schedule</h3>
          {upcoming.map(session => {
            const start = new Date(session.startTime); const end = new Date(session.endTime);
            return (
              <GlassCard key={session.id} className="p-4 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="bg-[#6324eb]/10 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-[#6324eb] border border-[#6324eb]/20 shrink-0">
                    <span className="text-[10px] font-bold leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{start.getDate()}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-100">{session.title}</p>
                    <p className="text-xs text-slate-400">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {isTeacher && (
                  <div className="flex gap-2">
                    <button onClick={() => handleStartLive(session)} disabled={isStarting === session.id}
                      className="flex items-center gap-1 px-3 py-2 bg-[#6324eb]/10 border border-[#6324eb]/20 text-[#a78bfa] rounded-lg text-xs font-bold hover:bg-[#6324eb]/20 transition-all">
                      {isStarting === session.id ? <span className="size-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Radio size={14} />}
                      Go Live
                    </button>
                    <button onClick={() => { setSelectedSession(session); setAttendance({}); }}
                      className="text-emerald-400 hover:text-white bg-emerald-500/10 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-emerald-500/20 flex items-center gap-1">
                      <Users size={14} /> Attendance
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--ui-heading)]"><CheckCircle2 className="text-slate-500" size={20} /> Past Sessions</h3>
          {past.map(session => {
            const start = new Date(session.startTime); const end = new Date(session.endTime);
            return (
              <GlassCard key={session.id} className="p-4 flex items-center justify-between border border-white/5 opacity-60">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-slate-400 border border-white/5 shrink-0">
                    <span className="text-[10px] font-bold leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{start.getDate()}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-300">{session.title}</p>
                    <p className="text-xs text-slate-500">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {isTeacher && (
                  <button onClick={() => { setSelectedSession(session); setAttendance({}); }}
                    className="text-slate-400 hover:text-white bg-white/5 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-white/5 flex items-center gap-1">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSession(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-0 z-[70] flex flex-col px-4 pb-4">
              <div className="bg-[#0d1225] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-2xl mx-auto w-full">
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6" />
                <div className="flex justify-between items-start mb-6">
                  <div><h3 className="text-xl font-bold text-white">Mark Attendance</h3><p className="text-slate-400 text-sm">{selectedSession.title}</p></div>
                  <button onClick={() => setSelectedSession(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ArrowLeft size={20} className="text-slate-400" /></button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                  {enrolledStudents.length === 0 && <p className="text-center text-slate-500 text-sm py-4">No enrolled students found.</p>}
                  {enrolledStudents.map(student => (
                    <div key={student.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-[#6324eb]/20 flex items-center justify-center text-[#6324eb] font-bold">{student.name.charAt(0)}</div>
                        <span className="text-white font-medium">{student.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleMarkAttendance(student.uid, 'present')} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border', attendance[student.uid] === 'present' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400')}>
                          <CheckCircle2 size={14} /> Present
                        </button>
                        <button onClick={() => handleMarkAttendance(student.uid, 'absent')} className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border', attendance[student.uid] === 'absent' ? 'bg-red-500 text-white border-red-500' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-red-500/10 hover:text-red-400')}>
                          <XCircle size={14} /> Absent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-6">
                  <PrimaryButton className="w-full py-4" onClick={saveAttendance} disabled={isSaving || Object.keys(attendance).length === 0}>
                    {isSaving ? <span className="flex items-center gap-2"><span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span>
                      : saveSuccess ? <span className="flex items-center gap-2"><Check size={20} /> Attendance Saved!</span> : 'Save Attendance'}
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
