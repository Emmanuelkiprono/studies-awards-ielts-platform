import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Calendar,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  ChevronRight,
  ArrowLeft,
  Video,
  Save,
  Search,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, serverTimestamp, getDocs, setDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Course, Attendance, LiveSession, UserProfile, StudentData, Enrollment } from '../types';

import { NotificationService } from '../services/notificationService';

export const TeacherAttendancePage: React.FC = () => {
  const { profile: teacherProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [isSaving, setIsSaving] = useState(false);

  // New session form state
  const [sessionTitle, setSessionTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');

  // 1. Fetch all courses
  useEffect(() => {
    const coursesQ = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(coursesQ, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);

      if (!selectedCourseId) {
        if (teacherProfile?.assignedCourseId) {
          setSelectedCourseId(teacherProfile.assignedCourseId);
        } else if (coursesData.length > 0) {
          setSelectedCourseId(coursesData[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, [teacherProfile?.assignedCourseId, selectedCourseId]);

  // 2. Fetch sessions and students for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch sessions
    const sessionsQ = query(
      collection(db, 'class_sessions'),
      where('courseId', '==', selectedCourseId),
      orderBy('startTime', 'desc')
    );

    const unsubscribeSessions = onSnapshot(sessionsQ, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveSession[];
      setSessions(sessionsData);
    });

    // Fetch students in course via enrollments
    const enrollmentsQ = query(
      collection(db, 'enrollments'),
      where('courseId', '==', selectedCourseId)
    );

    let unsubscribeProfiles: (() => void) | undefined;

    const unsubscribeStudents = onSnapshot(enrollmentsQ, (snapshot) => {
      const studentIds = snapshot.docs.map(doc => doc.data().userId);

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      if (unsubscribeProfiles) unsubscribeProfiles();

      // Fetch profiles
      const profilesQ = query(
        collection(db, 'users'),
        where('uid', 'in', studentIds.slice(0, 10))
      );

      unsubscribeProfiles = onSnapshot(profilesQ, (profilesSnap) => {
        const profilesData = profilesSnap.docs.map(doc => doc.data() as UserProfile);
        setStudents(profilesData);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeSessions();
      unsubscribeStudents();
      if (unsubscribeProfiles) unsubscribeProfiles();
    };
  }, [selectedCourseId]);

  // Load existing attendance when active session changes
  useEffect(() => {
    if (activeSession) {
      const fetchAttendance = async () => {
        const q = query(
          collection(db, 'attendance'),
          where('sessionId', '==', activeSession.id)
        );
        const snap = await getDocs(q);
        const attendanceData: Record<string, 'present' | 'absent'> = {};
        snap.docs.forEach(doc => {
          const data = doc.data() as Attendance;
          attendanceData[data.studentId] = data.status;
        });
        setAttendance(attendanceData);
      };
      fetchAttendance();
    } else {
      setAttendance({});
    }
  }, [activeSession]);

  const handleMarkAttendance = (studentId: string, status: 'present' | 'absent') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (!activeSession || !teacherProfile?.assignedCourseId) return;
    setIsSaving(true);

    try {
      const batch = Object.entries(attendance).map(async ([studentId, status]) => {
        const attendanceId = `${activeSession.id}_${studentId}`;
        const attendanceRef = doc(db, 'attendance', attendanceId);
        await setDoc(attendanceRef, {
          courseId: selectedCourseId,
          sessionId: activeSession.id,
          studentId,
          status,
          date: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(batch);

      // Notify absent students
      const absentIds = Object.entries(attendance)
        .filter(([, status]) => status === 'absent')
        .map(([id]) => id);
      await Promise.all(absentIds.map(studentId =>
        NotificationService.create(
          studentId,
          'Attendance Marked – Absent',
          `You were marked absent for "${activeSession.title}". Please contact your teacher if this is incorrect.`,
          'warning',
          '/live'
        )
      ));

      setActiveSession(null);
      setAttendance({});
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    try {
      const sessionRef = await addDoc(collection(db, 'class_sessions'), {
        courseId: selectedCourseId,
        title: sessionTitle,
        startTime,
        endTime,
        meetingUrl,
        createdAt: serverTimestamp()
      });

      // Notify students
      for (const student of students) {
        await NotificationService.create(
          student.uid,
          'New Live Session Scheduled',
          `A new class "${sessionTitle}" has been scheduled for ${new Date(startTime).toLocaleString()}.`,
          'info',
          '/live'
        );
      }

      setIsCreatingSession(false);
      setSessionTitle('');
      setStartTime('');
      setEndTime('');
      setMeetingUrl('');
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="size-12 border-4 border-[#6324eb]/30 border-t-[#6324eb] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-4xl mx-auto w-full pb-24"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-[#6324eb]" size={28} />
            Attendance Management
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-slate-400 text-sm mr-2">Managing Sessions for:</p>
            {courses.map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                  selectedCourseId === course.id
                    ? "bg-[#6324eb] text-white border-[#6324eb] shadow-lg shadow-[#6324eb]/20"
                    : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                {course.name}
              </button>
            ))}
          </div>
        </div>
        <PrimaryButton className="px-6 py-3" onClick={() => setIsCreatingSession(true)} disabled={!selectedCourseId}>
          <Plus size={20} /> Create Live Session
        </PrimaryButton>
      </header>

      {courses.length === 0 && !loading && (
        <GlassCard className="p-8 text-center border-orange-500/20 bg-orange-500/5">
          <AlertCircle className="mx-auto text-orange-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Courses Available</h3>
          <p className="text-slate-400">Please contact the administrator to create courses or assign you as a teacher.</p>
        </GlassCard>
      )}

      {/* Session History */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
          <History size={16} /> Recent Sessions
        </h3>
        <div className="space-y-3">
          {sessions.map((session) => (
            <GlassCard
              key={session.id}
              onClick={() => setActiveSession(session)}
              className="p-4 flex items-center justify-between group cursor-pointer hover:border-[#6324eb]/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb]">
                  <Video size={24} />
                </div>
                <div>
                  <p className="text-slate-100 font-semibold">{session.title}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-bold">
                      <Clock size={12} /> {new Date(session.startTime).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
            </GlassCard>
          ))}
          {sessions.length === 0 && selectedCourseId && (
            <p className="text-center text-slate-500 py-12">No sessions created yet.</p>
          )}
        </div>
      </div>

      {/* Attendance Modal */}
      <AnimatePresence>
        {activeSession && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveSession(null)}
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
                    <h3 className="text-xl font-bold text-white">{activeSession.title}</h3>
                    <p className="text-slate-400 text-sm">Mark attendance for this session.</p>
                  </div>
                  <button onClick={() => setActiveSession(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <ArrowLeft size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Student List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                    {students.map((student) => (
                      <div key={student.uid} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <img src={student.avatarUrl || `https://picsum.photos/seed/${student.uid}/100/100`} alt={student.name} className="size-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                          <p className="text-sm font-bold text-white">{student.name}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMarkAttendance(student.uid, 'present')}
                            className={cn(
                              "p-2 rounded-xl border transition-all",
                              attendance[student.uid] === 'present'
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                : "bg-white/5 border-white/10 text-slate-500"
                            )}
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(student.uid, 'absent')}
                            className={cn(
                              "p-2 rounded-xl border transition-all",
                              attendance[student.uid] === 'absent'
                                ? "bg-red-500/20 border-red-500 text-red-400"
                                : "bg-white/5 border-white/10 text-slate-500"
                            )}
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {students.length === 0 && (
                      <p className="text-center text-slate-500 py-8">No students enrolled in this course.</p>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <PrimaryButton className="flex-1 py-3" onClick={handleSaveAttendance} disabled={isSaving}>
                      <Save size={20} /> {isSaving ? 'Saving...' : 'Save Attendance'}
                    </PrimaryButton>
                    <PrimaryButton variant="secondary" className="px-6 py-3" onClick={() => setActiveSession(null)}>
                      Cancel
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Session Modal */}
      <AnimatePresence>
        {isCreatingSession && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingSession(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-xl w-full p-8 space-y-6 pointer-events-auto bg-[#0d1225] border-white/10 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Create Live Session</h3>
                  <button onClick={() => setIsCreatingSession(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <XCircle size={20} className="text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Session Title</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. Speaking Mock Test Feedback"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">Start Time</label>
                      <input
                        type="datetime-local"
                        required
                        className="input-field py-2 text-sm [color-scheme:dark]"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">End Time</label>
                      <input
                        type="datetime-local"
                        required
                        className="input-field py-2 text-sm [color-scheme:dark]"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Meeting URL (Zoom/Meet)</label>
                    <div className="relative">
                      <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                        type="url"
                        className="input-field pl-12 py-2 text-sm"
                        placeholder="https://zoom.us/j/..."
                        value={meetingUrl}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <PrimaryButton type="submit" className="flex-1 py-3">
                      <Save size={20} /> Create Session
                    </PrimaryButton>
                    <PrimaryButton variant="secondary" className="px-6 py-3" onClick={() => setIsCreatingSession(false)}>
                      Cancel
                    </PrimaryButton>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
