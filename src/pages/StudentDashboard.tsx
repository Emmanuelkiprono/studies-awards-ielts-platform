import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Calendar,
  ClipboardCheck,
  TrendingUp,
  BarChart3,
  ArrowRight,
  FileText,
  Volume2,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Zap,
  Trophy,
  ShieldCheck,
  Lock,
  ChevronRight,
  ChevronDown,
  Clock,
  FileIcon,
  AlertCircle,
  Video,
  Bell,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { collection, doc, getDoc, getDocs, orderBy, query, where, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Course, Module, Lesson, Enrollment, Assignment, Submission, LiveSession, Announcement } from '../types';
import { NotificationService } from '../services/notificationService';
import { FileUpload } from '../components/FileUpload';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, studentData, profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());

  // Submission modal
  const [submitAssignment, setSubmitAssignment] = useState<Assignment | null>(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [submitFileName, setSubmitFileName] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const gradedSubmissions = submissions.filter(s => s.status === 'graded' && s.bandScore != null);
  const avgBandScore = gradedSubmissions.length
    ? (gradedSubmissions.reduce((sum, s) => sum + (s.bandScore ?? 0), 0) / gradedSubmissions.length).toFixed(1)
    : null;

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitAssignment || !user || !studentData?.courseId) return;
    setSubmitLoading(true);
    try {
      await addDoc(collection(db, 'submissions'), {
        assignmentId: submitAssignment.id,
        studentId: user.uid,
        courseId: studentData.courseId,
        notes: submitNotes,
        fileUrl: submitFileUrl || null,
        fileName: submitFileName || null,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      });
      setSubmissions(prev => [...prev, {
        id: `local-${Date.now()}`,
        assignmentId: submitAssignment.id,
        studentId: user.uid,
        courseId: studentData.courseId,
        notes: submitNotes,
        fileUrl: submitFileUrl || undefined,
        fileName: submitFileName || undefined,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      }]);
      if (course?.teacherId) {
        await NotificationService.create(
          course.teacherId,
          'New Assignment Submission',
          `${profile?.name ?? 'A student'} submitted "${submitAssignment.title}". Review it in the Tasks panel.`,
          'info',
          '/teacher/tasks'
        );
      }

      setSubmitAssignment(null);
      setSubmitNotes('');
      setSubmitFileUrl('');
      setSubmitFileName('');
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const trainingStatus = studentData?.trainingStatus || 'inactive';
  const examStatus = studentData?.examStatus || 'not_started';
  const isEnrolled = !!studentData?.courseId;
  const isActive = trainingStatus === 'active';

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!studentData?.courseId || !user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch Enrollment
        const enrollmentsQ = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
        const enrollSnap = await getDocs(enrollmentsQ);
        if (!enrollSnap.empty) {
          const snap = enrollSnap.docs[0];
          const enrollmentData = { id: snap.id, ...snap.data() } as Enrollment;
          setEnrollment(enrollmentData);

          // Backfill registration + eligibility (4 weeks) if missing
          const hasReg = !!(enrollmentData.registeredAt || enrollmentData.registrationDate);
          const hasEligible = !!(enrollmentData.eligibleAt || enrollmentData.eligibleExamDate);
          if (!hasReg || !hasEligible) {
            const regDate = enrollmentData.registrationDate?.toDate
              ? enrollmentData.registrationDate.toDate()
              : enrollmentData.registeredAt?.toDate
                ? enrollmentData.registeredAt.toDate()
                : null;

            const computedEligibleIso = (regDate
              ? new Date(regDate.getTime() + 28 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
            ).toISOString();

            const updates: any = {
              eligibleAt: computedEligibleIso,
              eligibleExamDate: computedEligibleIso,
            };

            if (!hasReg) {
              updates.registeredAt = serverTimestamp();
              updates.registrationDate = serverTimestamp();
            }

            await updateDoc(doc(db, 'enrollments', enrollmentData.id), updates);
          }
        }

        // Fetch Course
        const courseDoc = await getDoc(doc(db, 'courses', studentData.courseId));
        if (courseDoc.exists()) {
          setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
        }

        // Fetch Modules
        const modulesQuery = query(
          collection(db, 'courses', studentData.courseId, 'modules'),
          orderBy('order', 'asc')
        );
        const modulesSnapshot = await getDocs(modulesQuery);
        const fetchedModules = modulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
        setModules(fetchedModules);

        // Fetch Lessons for each module
        const allLessons: Record<string, Lesson[]> = {};
        for (const mod of fetchedModules) {
          const lessonsQuery = query(
            collection(db, 'courses', studentData.courseId, 'modules', mod.id, 'lessons'),
            orderBy('order', 'asc')
          );
          const lessonsSnapshot = await getDocs(lessonsQuery);
          allLessons[mod.id] = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
        }
        setLessons(allLessons);

        // Fetch Assignments for this course
        const assignQ = query(
          collection(db, 'assignments'),
          where('courseId', '==', studentData.courseId),
          orderBy('createdAt', 'desc')
        );
        const assignSnap = await getDocs(assignQ);
        setAssignments(assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));

        // Fetch student's submissions
        const subQ = query(
          collection(db, 'submissions'),
          where('studentId', '==', user.uid)
        );
        const subSnap = await getDocs(subQ);
        setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));

        // Fetch upcoming live sessions for this course
        const sessionsQ = query(
          collection(db, 'liveSessions'),
          where('courseId', '==', studentData.courseId)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        const now = new Date().toISOString();
        const upcoming = sessionsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as LiveSession))
          .filter(s => s.startTime > now)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        setLiveSessions(upcoming);

        // Fetch recent announcements for this course
        const annQ = query(
          collection(db, 'announcements'),
          where('courseId', '==', studentData.courseId)
        );
        const annSnap = await getDocs(annQ);
        const annList = annSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Announcement))
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        setAnnouncements(annList);
      } catch (error) {
        console.error('Error fetching course data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [studentData?.courseId, user?.uid]);

  const handlePayExamFee = async () => {
    if (!enrollment || !user || !studentData?.courseId) return;
    setPayingFee(true);
    try {
      await updateDoc(doc(db, 'enrollments', enrollment.id), {
        examFeeStatus: 'pending'
      });
      setEnrollment(prev => prev ? { ...prev, examFeeStatus: 'pending' } : null);

      // Notify teachers of this course
      const teachersSnap = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('assignedCourseId', '==', studentData.courseId)
      ));
      await Promise.all(teachersSnap.docs.map(t =>
        NotificationService.create(
          t.id,
          'Exam Fee Payment Submitted',
          `${profile?.name ?? 'A student'} has submitted exam fee payment. Please verify and update their status.`,
          'info',
          '/teacher/students'
        )
      ));
    } catch (error) {
      console.error("Error updating exam fee status:", error);
    } finally {
      setPayingFee(false);
    }
  };

  // Normalize dates & booking details
  const registeredDate = enrollment?.registrationDate?.toDate
    ? enrollment.registrationDate.toDate()
    : enrollment?.registeredAt?.toDate
      ? enrollment.registeredAt.toDate()
      : (enrollment?.registeredAt ? new Date(enrollment.registeredAt) : null);

  const computedEligibleFromRegistration = registeredDate
    ? new Date(registeredDate.getTime() + 28 * 24 * 60 * 60 * 1000)
    : null;

  const eligibleDate = enrollment?.eligibleExamDate
    ? new Date(enrollment.eligibleExamDate)
    : enrollment?.eligibleAt
      ? new Date(enrollment.eligibleAt)
      : computedEligibleFromRegistration;

  const isEligible = eligibleDate ? new Date() >= eligibleDate : false;

  const bookedExamDate = enrollment?.examDate ? new Date(enrollment.examDate) : null;
  const examCenter = enrollment?.examCenter || null;
  const bookingRef = enrollment?.bookingReference || null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-10 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnrolled && profile?.role === 'student') {
    return (
      <div className="p-8 text-center space-y-4">
        <GlassCard className="p-12 max-w-lg mx-auto space-y-6">
          <div className="size-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--ui-heading)]">No Active Enrollment</h2>
          <p className="text-[var(--ui-muted)]">You haven't enrolled in any course yet. Please contact administration or choose a course from the enrollment page.</p>
          <PrimaryButton className="w-full py-3">Browse Courses</PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  const steps = [
    { id: 'training', label: 'Training', status: trainingStatus === 'completed' ? 'completed' : (isActive ? 'active' : 'pending'), icon: Zap },
    { id: 'eligibility', label: 'Eligibility', status: trainingStatus === 'completed' ? 'completed' : (trainingStatus === 'active' ? 'active' : 'pending'), icon: ShieldCheck },
    { id: 'booking', label: 'Exam Booking', status: examStatus !== 'not_started' ? 'completed' : (trainingStatus === 'completed' ? 'active' : 'pending'), icon: Calendar },
    { id: 'results', label: 'Results', status: examStatus === 'done' ? 'completed' : (examStatus === 'scheduled' ? 'active' : 'pending'), icon: Trophy },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-5xl mx-auto w-full pb-24"
    >
      {/* Hero Section */}
      <GlassCard gradient className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--ui-heading)] tracking-tight">
              Welcome back, {profile?.name || 'John'}!
            </h2>
            <div className="flex items-center gap-2 text-[#3b82f6] font-bold">
              <BookOpen size={18} />
              <span>{course?.name || 'Loading Course...'}</span>
            </div>
            <p className="text-[var(--ui-body)] max-w-md leading-relaxed">
              {isActive
                ? "Your training is currently active. Keep up the great work and complete your daily modules."
                : "Your enrollment is pending activation. Please complete your payment to unlock all modules."}
            </p>
            <div className="flex flex-wrap gap-3 pt-4">
              {isActive ? (
                <PrimaryButton>
                  Continue Learning <ArrowRight size={16} />
                </PrimaryButton>
              ) : (
                <PrimaryButton>
                  Complete Payment <Zap size={16} />
                </PrimaryButton>
              )}
            </div>
          </div>
          <div className="hidden lg:block w-48 h-48 relative">
            <div className="absolute inset-0 bg-[#6324eb]/20 rounded-full blur-2xl animate-pulse"></div>
            <img
              alt="Course Success"
              className="relative z-10 w-full h-full object-contain"
              src={isActive ? "https://picsum.photos/seed/success/400/400" : "https://picsum.photos/seed/locked/400/400"}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </GlassCard>

      {/* Course Content Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
              <BookOpen className="text-[#6324eb]" size={20} />
              Course Modules
            </h3>
            {!isActive && (
              <div className="flex items-center gap-2 text-amber-500 text-xs font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <Lock size={12} />
                Locked
              </div>
            )}
          </div>

          <div className="space-y-4">
            {modules.map((mod) => (
              <GlassCard
                key={mod.id}
                className={cn(
                  "overflow-hidden transition-all border border-white/5",
                  !isActive && "opacity-60 grayscale cursor-not-allowed"
                )}
              >
                <button
                  disabled={!isActive}
                  onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] font-bold">
                      {mod.order}
                    </div>
                    <div>
                      <h4 className="text-[var(--ui-heading)] font-bold">{mod.name}</h4>
                      <p className="text-xs text-[var(--ui-muted)]">{mod.description}</p>
                    </div>
                  </div>
                  {isActive ? (
                    expandedModule === mod.id ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />
                  ) : (
                    <Lock size={18} className="text-slate-600" />
                  )}
                </button>

                <AnimatePresence>
                  {expandedModule === mod.id && isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5 bg-white/5"
                    >
                      <div className="p-2 space-y-1">
                        {lessons[mod.id]?.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-[#6324eb] transition-colors">
                                <PlayCircle size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--ui-body)] group-hover:text-[var(--ui-heading)] transition-colors">{lesson.title}</p>
                                <div className="flex items-center gap-3 text-[10px] text-[var(--ui-muted)]">
                                  <span className="flex items-center gap-1"><Clock size={10} /> {lesson.durationMinutes} mins</span>
                                  {lesson.pdfUrl && <span className="flex items-center gap-1"><FileIcon size={10} /> PDF Available</span>}
                                </div>
                              </div>
                            </div>
                            <div className="size-6 rounded-full border border-white/10 flex items-center justify-center text-slate-600 group-hover:border-[#6324eb] group-hover:text-[#6324eb] transition-all">
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        ))}
                        {(!lessons[mod.id] || lessons[mod.id].length === 0) && (
                          <p className="text-center py-4 text-xs text-[var(--ui-muted)] italic">No lessons added to this module yet.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Training Progress */}
          <GlassCard className="p-6 space-y-4 border-t-4 border-[#6324eb]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold tracking-widest">Your Progress</p>
                <h4 className="text-lg font-bold text-[var(--ui-heading)]">Training Completion</h4>
              </div>
              <div className="size-10 rounded-xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb]">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[var(--ui-muted)]">Overall</span>
                <span className="text-[#6324eb]">{isActive ? '35%' : '0%'}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: isActive ? '35%' : '0%' }}
                  className="h-full bg-[#6324eb] shadow-[0_0_10px_rgba(99,36,235,0.5)]"
                />
              </div>
            </div>

            <div className="pt-4 grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                <p className="text-xl font-bold text-[var(--ui-heading)]">12/48</p>
                <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Lessons</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                <p className="text-xl font-bold text-[var(--ui-heading)]">2/8</p>
                <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">Modules</p>
              </div>
            </div>
          </GlassCard>

          {/* Learning Journey */}
          <GlassCard className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--ui-heading)] uppercase tracking-widest">Journey Map</h3>
            <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isCompleted = step.status === 'completed';
                const isCurrent = step.status === 'active';

                return (
                  <div key={step.id} className="flex items-start gap-4 relative z-10">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center transition-all shadow-lg",
                      isCompleted ? "bg-emerald-500 text-white" :
                        isCurrent ? "bg-[#6324eb] text-white ring-4 ring-[#6324eb]/20" :
                          "bg-slate-800 text-slate-500"
                    )}>
                      {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        "text-sm font-bold",
                        isCurrent ? "text-[var(--ui-heading)]" : "text-[var(--ui-muted)]"
                      )}>{step.label}</p>
                      <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold tracking-wider">
                        {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Locked'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Exam Eligibility Timeline */}
          {enrollment && (
            <GlassCard className="p-6 space-y-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="text-[var(--ui-heading)] font-bold">Exam Eligibility</h4>
                  <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold tracking-wider">
                    {isEligible ? 'Eligible for Exam' : 'Training in Progress'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ui-muted)]">Registration Date</span>
                  <span className="text-[var(--ui-body)] font-medium">{registeredDate ? registeredDate.toLocaleDateString() : 'Pending'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--ui-muted)]">Eligibility Date (Reg. + 28 days)</span>
                  <span className="text-[var(--ui-body)] font-medium">{eligibleDate ? eligibleDate.toLocaleDateString() : 'Pending'}</span>
                </div>

                {enrollment.location && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--ui-muted)]">Preferred Center</span>
                    <span className="text-[var(--ui-body)] font-medium text-right">
                      {enrollment.location.city}, {enrollment.location.country}
                      {enrollment.location.centerPreference
                        ? ` • ${enrollment.location.centerPreference}`
                        : ''}
                    </span>
                  </div>
                )}

                {bookedExamDate && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--ui-muted)]">Booked Exam Date</span>
                    <span className="text-[var(--ui-body)] font-medium">
                      {bookedExamDate.toLocaleDateString()}
                    </span>
                  </div>
                )}
                {examCenter && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--ui-muted)]">Exam Center</span>
                    <span className="text-[var(--ui-body)] font-medium text-right">{examCenter}</span>
                  </div>
                )}
                {bookingRef && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--ui-muted)]">Booking Ref</span>
                    <span className="text-[var(--ui-body)] font-mono text-[11px]">
                      {bookingRef}
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  {isEligible ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20 text-xs font-bold">
                        <CheckCircle2 size={14} />
                        Eligible for Exam
                      </div>
                      {enrollment.examFeeStatus === 'unpaid' && (
                        <PrimaryButton
                          className="w-full py-2.5 text-xs"
                          onClick={handlePayExamFee}
                          loading={payingFee}
                        >
                          Pay Exam Fee <ChevronRight size={14} />
                        </PrimaryButton>
                      )}
                      {enrollment.examFeeStatus === 'pending' && (
                        <div className="text-center py-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                          Payment Verification Pending
                        </div>
                      )}
                      {enrollment.examFeeStatus === 'paid' && (
                        <div className="space-y-2">
                          <div className="text-center py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                            Exam Fee Paid
                          </div>
                          {(enrollment.examStatus !== 'booked' && enrollment.examStatus !== 'completed') && (
                            <PrimaryButton
                              className="w-full py-2.5 text-xs"
                              onClick={() => navigate('/exam_booking')}
                            >
                              Book Exam Slot <ChevronRight size={14} />
                            </PrimaryButton>
                          )}
                          {enrollment.examStatus === 'booked' && (
                            <div className="text-center py-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                              Booking Submitted — Awaiting Confirmation
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 text-xs font-bold">
                        <Clock size={14} />
                        Training in Progress
                      </div>
                      <p className="text-[10px] text-slate-500 italic text-center">
                        Eligibility requires 4 weeks of consistent training.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </section>

      {/* Announcements */}
      {announcements.filter(a => !dismissedAnnouncements.has(a.id)).length > 0 && (
        <div className="space-y-3">
          {announcements.filter(a => !dismissedAnnouncements.has(a.id)).map(ann => (
            <div
              key={ann.id}
              className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
            >
              <Bell className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-300 text-sm">{ann.title}</p>
                <p className="text-amber-200/80 text-xs mt-0.5 leading-relaxed">{ann.message}</p>
              </div>
              <button
                onClick={() => setDismissedAnnouncements(prev => new Set([...prev, ann.id]))}
                className="text-amber-400/60 hover:text-amber-300 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="border-l-4 border-[#3b82f6] p-5">
          <p className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wider mb-1">Next Class</p>
          {liveSessions[0] ? (
            <>
              <p className="text-[var(--ui-heading)] text-xl font-bold leading-tight truncate">
                {new Date(liveSessions[0].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[#3b82f6] text-xs mt-2 font-semibold flex items-center gap-1">
                <Calendar size={12} /> {new Date(liveSessions[0].startTime).toLocaleDateString()}
              </p>
            </>
          ) : (
            <>
              <p className="text-[var(--ui-heading)] text-2xl font-bold">—</p>
              <p className="text-[#3b82f6] text-xs mt-2 font-semibold">No upcoming</p>
            </>
          )}
        </GlassCard>
        <GlassCard className="border-l-4 border-[#6324eb] p-5">
          <p className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wider mb-1">Pending</p>
          <p className="text-[var(--ui-heading)] text-2xl font-bold">{assignments.filter(a => !submissions.find(s => s.assignmentId === a.id)).length} Tasks</p>
          <p className="text-[#6324eb] text-xs mt-2 font-semibold flex items-center gap-1">
            <ClipboardCheck size={12} /> Pending
          </p>
        </GlassCard>
        <GlassCard className="border-l-4 border-emerald-500 p-5">
          <p className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wider mb-1">Band Score</p>
          <p className="text-[var(--ui-heading)] text-2xl font-bold">{avgBandScore ?? '—'}</p>
          <p className="text-emerald-400 text-xs mt-2 font-semibold flex items-center gap-1">
            <TrendingUp size={12} /> {avgBandScore ? 'Avg graded' : 'No grades yet'}
          </p>
        </GlassCard>
        <GlassCard className="border-l-4 border-amber-500 p-5">
          <p className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wider mb-1">Progress</p>
          <p className="text-[var(--ui-heading)] text-2xl font-bold">+0.5</p>
          <p className="text-amber-500 text-xs mt-2 font-semibold flex items-center gap-1">
            <BarChart3 size={12} /> This week
          </p>
        </GlassCard>
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignments */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
              <ClipboardCheck className="text-[#6324eb]" size={20} />
              Assignments
            </h3>
            <span className="text-[#6324eb] text-xs font-bold">{assignments.length} total</span>
          </div>
          {assignments.length === 0 ? (
            <GlassCard className="p-8 text-center border border-white/5">
              <p className="text-[var(--ui-muted)] text-sm">No assignments yet — check back soon.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => {
                const sub = submissions.find(s => s.assignmentId === a.id);
                const typeColors: Record<string, string> = {
                  writing: 'bg-[#6324eb]/20 text-[#6324eb]',
                  listening: 'bg-[#3b82f6]/20 text-[#3b82f6]',
                  reading: 'bg-emerald-500/20 text-emerald-400',
                  speaking: 'bg-amber-500/20 text-amber-400',
                  vocabulary: 'bg-pink-500/20 text-pink-400',
                };
                const typeIcons: Record<string, React.ReactNode> = {
                  writing: <FileText size={18} />,
                  listening: <Volume2 size={18} />,
                  reading: <BookOpen size={18} />,
                  speaking: <PlayCircle size={18} />,
                  vocabulary: <ClipboardCheck size={18} />,
                };
                return (
                  <GlassCard
                    key={a.id}
                    onClick={() => !sub && setSubmitAssignment(a)}
                    className={cn(
                      'p-4 flex flex-col gap-3 transition-colors',
                      !sub && 'cursor-pointer hover:bg-white/5 group'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn('p-2 rounded-lg', typeColors[a.type] || typeColors.writing)}>
                          {typeIcons[a.type] || typeIcons.writing}
                        </div>
                        <div>
                          <p className="text-[var(--ui-heading)] font-semibold">{a.title}</p>
                          <p className="text-[var(--ui-muted)] text-xs">Due: {a.dueDate} · {a.type}</p>
                        </div>
                      </div>
                      {sub ? (
                        <span className={cn(
                          'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0',
                          sub.status === 'graded'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        )}>
                          {sub.status === 'graded' ? `Graded${sub.bandScore ? ` · ${sub.bandScore}` : ''}` : 'Submitted'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-white/5 text-[var(--ui-muted)] border-white/10 group-hover:bg-[#6324eb]/20 group-hover:text-[#6324eb] group-hover:border-[#6324eb]/30 transition-colors shrink-0">
                          Submit
                        </span>
                      )}
                    </div>
                    {sub?.feedback && (
                      <div className="ml-12 pl-2 border-l-2 border-emerald-500/40">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Teacher Feedback</p>
                        <p className="text-xs text-[var(--ui-muted)] leading-relaxed">{sub.feedback}</p>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}

          {/* Mock Test History */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
                <BarChart3 className="text-emerald-500" size={20} />
                Mock Test History
              </h3>
            </div>
            <GlassCard className="p-6 h-48 flex items-end justify-between gap-2">
              {[6.5, 7.0, 7.5, 8.0].map((score, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full">
                  <div className="w-full bg-[#6324eb]/20 rounded-t-lg h-24 relative group">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(score / 9) * 100}%` }}
                      className={cn(
                        "absolute bottom-0 w-full rounded-t-lg transition-all",
                        i === 3 ? "bg-[#3b82f6]" : "bg-[#6324eb]"
                      )}
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded text-white transition-opacity">
                      {score}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    {i === 3 ? 'Latest' : `Test ${i + 1}`}
                  </span>
                </div>
              ))}
            </GlassCard>
          </div>
        </div>

        {/* Upcoming Live Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
              <Video className="text-emerald-500" size={20} />
              Live Sessions
            </h3>
            <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{liveSessions.length} upcoming</span>
          </div>
          <div className="flex flex-col gap-3">
            {liveSessions.length === 0 ? (
              <GlassCard className="p-6 text-center border border-white/5">
                <p className="text-[var(--ui-muted)] text-sm">No upcoming sessions.</p>
              </GlassCard>
            ) : (
              liveSessions.slice(0, 4).map(session => {
                const start = new Date(session.startTime);
                const end = new Date(session.endTime);
                const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                return (
                  <GlassCard key={session.id} className="p-4 border border-white/5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-xl bg-[#6324eb]/10 flex flex-col items-center justify-center text-[#6324eb] border border-[#6324eb]/20 shrink-0">
                        <span className="text-[8px] font-bold leading-none uppercase">{start.toLocaleDateString([], { month: 'short' })}</span>
                        <span className="text-base font-black leading-none">{start.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[var(--ui-heading)] font-bold text-sm truncate">{session.title}</p>
                        <p className="text-[var(--ui-muted)] text-xs mt-0.5">{timeLabel}</p>
                      </div>
                    </div>
                    {session.meetingUrl && (
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#6324eb]/10 text-[#6324eb] border border-[#6324eb]/20 text-xs font-black uppercase tracking-widest hover:bg-[#6324eb]/20 transition-colors"
                      >
                        <PlayCircle size={14} /> Join Session
                      </a>
                    )}
                  </GlassCard>
                );
              })
            )}
          </div>

          {/* Static resource card kept below sessions */}
          <GlassCard className="p-0 overflow-hidden group cursor-pointer border border-white/5">  
            <div className="h-24 w-full bg-[#6324eb]/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#6324eb]/30 to-transparent"></div>
              <img
                alt="Resource 1"
                className="w-full h-full object-cover opacity-60 transition-transform group-hover:scale-110"
                src="https://picsum.photos/seed/book1/400/200"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white">PDF</div>
            </div>
            <div className="p-4">
              <h4 className="text-[var(--ui-heading)] font-bold text-sm">Essential Idioms for Band 8+</h4>
              <p className="text-[var(--ui-muted)] text-xs mt-1">Uploaded 2h ago</p>
            </div>
          </GlassCard>
            <GlassCard className="p-0 overflow-hidden group cursor-pointer border border-white/5">
              <div className="h-24 w-full bg-[#3b82f6]/10 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3b82f6]/30 to-transparent"></div>
                <img
                  alt="Resource 2"
                  className="w-full h-full object-cover opacity-60 transition-transform group-hover:scale-110"
                  src="https://picsum.photos/seed/video1/400/200"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white">VIDEO</div>
              </div>
              <div className="p-4">
                <h4 className="text-[var(--ui-heading)] font-bold text-sm">Speaking Part 3 Strategy</h4>
                <p className="text-[var(--ui-muted)] text-xs mt-1">Uploaded Yesterday</p>
              </div>
            </GlassCard>
        </div>
      </div>

      {/* Submit Assignment Modal */}
      <AnimatePresence>
        {submitAssignment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSubmitAssignment(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-3xl p-8 shadow-2xl max-w-lg w-full pointer-events-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Submit Assignment</h3>
                    <p className="text-xs text-[var(--ui-muted)] mt-0.5 truncate max-w-[280px]">{submitAssignment.title}</p>
                  </div>
                  <button
                    onClick={() => setSubmitAssignment(null)}
                    className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors"
                  >
                    <CheckCircle2 size={22} className="opacity-40" />
                  </button>
                </div>

                <form onSubmit={handleSubmitAssignment} className="space-y-4">
                  {/* Assignment info */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#6324eb]/10 border border-[#6324eb]/20">
                    <div className="size-10 rounded-xl bg-[#6324eb]/20 flex items-center justify-center text-[#6324eb] shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--ui-heading)] font-bold text-sm truncate">{submitAssignment.title}</p>
                      <p className="text-xs text-[var(--ui-muted)]">Due: {submitAssignment.dueDate} · {submitAssignment.type}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">
                      Your Answer / Notes <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={submitNotes}
                      onChange={e => setSubmitNotes(e.target.value)}
                      className="input-field w-full resize-none"
                      placeholder="Write your response here, or paste your work..."
                    />
                  </div>

                  {/* File Upload */}
                  <FileUpload
                    folder="submissions"
                    label="Attach File (optional)"
                    value={submitFileUrl}
                    fileName={submitFileName}
                    onUploaded={(url, name) => { setSubmitFileUrl(url); setSubmitFileName(name); }}
                    onClear={() => { setSubmitFileUrl(''); setSubmitFileName(''); }}
                    compact
                  />

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSubmitAssignment(null)}
                      className="flex-1 py-3 rounded-2xl bg-white/5 text-[var(--ui-body)] font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <PrimaryButton type="submit" loading={submitLoading} className="flex-1 py-3">
                      <CheckCircle2 size={16} /> Submit
                    </PrimaryButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
