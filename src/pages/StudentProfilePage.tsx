import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  Clock,
  BookOpen,
  AlertCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { GlassCard, StatusBadge } from '../components/UI';
import {
  UserProfile,
  StudentData,
  Enrollment,
  Course,
  Assignment,
  Submission,
} from '../types';

export const StudentProfilePage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        // User profile
        const profileSnap = await getDoc(doc(db, 'users', studentId));
        const profileData = profileSnap.exists()
          ? (profileSnap.data() as UserProfile)
          : null;
        setProfile(profileData);

        // Student data
        const studentSnap = await getDoc(doc(db, 'students', studentId));
        const sData = studentSnap.exists()
          ? (studentSnap.data() as StudentData)
          : null;
        setStudentData(sData);

        // Enrollment
        const enrollQ = query(
          collection(db, 'enrollments'),
          where('userId', '==', studentId)
        );
        const enrollSnap = await getDocs(enrollQ);
        const enrollData = enrollSnap.empty
          ? null
          : ({ id: enrollSnap.docs[0].id, ...enrollSnap.docs[0].data() } as Enrollment);
        setEnrollment(enrollData);

        // Course
        const courseId = sData?.courseId || enrollData?.courseId;
        if (courseId) {
          const courseSnap = await getDoc(doc(db, 'courses', courseId));
          if (courseSnap.exists()) {
            setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);
          }

          // Assignments for this course
          const assignQ = query(
            collection(db, 'assignments'),
            where('courseId', '==', courseId)
          );
          const assignSnap = await getDocs(assignQ);
          setAssignments(
            assignSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment))
          );

          // Submissions by this student
          const subQ = query(
            collection(db, 'submissions'),
            where('studentId', '==', studentId)
          );
          const subSnap = await getDocs(subQ);
          setSubmissions(
            subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission))
          );
        }
      } catch (err) {
        console.error('Error loading student profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [studentId]);

  // ─── Derived eligibility data ───────────────────────────────────────────────
  const registeredDate = enrollment?.registrationDate?.toDate
    ? enrollment.registrationDate.toDate()
    : enrollment?.registeredAt?.toDate
      ? enrollment.registeredAt.toDate()
      : null;

  const eligibleDate = enrollment?.eligibleAt
    ? new Date(enrollment.eligibleAt)
    : enrollment?.eligibleExamDate
      ? new Date(enrollment.eligibleExamDate)
      : registeredDate
        ? new Date(registeredDate.getTime() + 28 * 24 * 60 * 60 * 1000)
        : null;

  const isEligible = eligibleDate ? new Date() >= eligibleDate : false;

  const trainingStatus = enrollment?.trainingStatus || studentData?.trainingStatus || 'inactive';
  const examStatus = enrollment?.examStatus || studentData?.examStatus || 'not_started';

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-10 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <GlassCard className="p-12 max-w-lg mx-auto space-y-4">
          <AlertCircle size={40} className="mx-auto text-amber-500" />
          <h2 className="text-xl font-bold text-[var(--ui-heading)]">Student not found</h2>
          <button
            onClick={() => navigate(-1)}
            className="text-[var(--ui-accent)] text-sm font-bold"
          >
            ← Go back
          </button>
        </GlassCard>
      </div>
    );
  }

  const submittedIds = new Set(submissions.map(s => s.assignmentId));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-3xl mx-auto w-full pb-24"
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors text-sm font-bold"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* ── Hero card ── */}
      <GlassCard gradient className="p-6">
        <div className="flex items-center gap-5">
          <img
            src={
              profile.avatarUrl ||
              `https://picsum.photos/seed/${profile.uid}/100/100`
            }
            alt={profile.name}
            className="size-16 rounded-2xl object-cover border-2 border-[var(--ui-accent)]/40"
          />
          <div className="flex-1 min-w-0 space-y-1">
            <h2 className="text-2xl font-black text-[var(--ui-heading)] truncate">
              {profile.name}
            </h2>
            <p className="text-[var(--ui-muted)] text-sm truncate">{profile.email}</p>
            {course && (
              <div className="flex items-center gap-2 text-[var(--ui-accent)] font-bold text-sm">
                <BookOpen size={14} />
                {course.name}
              </div>
            )}
          </div>
          <StatusBadge
            status={trainingStatus.replace('_', ' ')}
            variant={
              trainingStatus === 'active'
                ? 'primary'
                : trainingStatus === 'completed'
                  ? 'success'
                  : 'accent'
            }
          />
        </div>
      </GlassCard>

      {/* ── Status grid ── */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-5 border-l-4 border-[var(--ui-accent)]">
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest mb-1">
            Training Status
          </p>
          <p className="text-[var(--ui-heading)] font-black capitalize">
            {trainingStatus.replace('_', ' ')}
          </p>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-amber-500">
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest mb-1">
            Exam Status
          </p>
          <p className="text-[var(--ui-heading)] font-black capitalize">
            {examStatus.replace('_', ' ')}
          </p>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-emerald-500">
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest mb-1">
            Registered
          </p>
          <p className="text-[var(--ui-heading)] font-black">
            {registeredDate ? registeredDate.toLocaleDateString() : '—'}
          </p>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-blue-500">
          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest mb-1">
            Eligible From
          </p>
          <p className="text-[var(--ui-heading)] font-black">
            {eligibleDate ? eligibleDate.toLocaleDateString() : '—'}
          </p>
        </GlassCard>
      </div>

      {/* ── Exam Eligibility ── */}
      <GlassCard className="p-6 space-y-4 border-l-4 border-amber-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-[var(--ui-heading)] font-bold">Exam Eligibility</h4>
              <p className="text-[10px] text-[var(--ui-muted)] uppercase font-black tracking-widest">
                {isEligible ? 'Eligible for Exam' : 'Training in Progress'}
              </p>
            </div>
          </div>
          {isEligible ? (
            <StatusBadge status="Eligible" variant="success" className="text-[10px]" />
          ) : (
            <StatusBadge status="Not Yet" variant="warning" className="text-[10px]" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--ui-bg-3)] p-4 rounded-2xl border border-[var(--ui-border-soft)]">
            <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">
              <Calendar size={10} className="inline mr-1" />
              Registration Date
            </p>
            <p className="text-[var(--ui-body)] font-semibold mt-1">
              {registeredDate ? registeredDate.toLocaleDateString() : 'Not set'}
            </p>
          </div>
          <div className="bg-[var(--ui-bg-3)] p-4 rounded-2xl border border-[var(--ui-border-soft)]">
            <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">
              <Calendar size={10} className="inline mr-1" />
              Eligible From
            </p>
            <p className="text-[var(--ui-body)] font-semibold mt-1">
              {eligibleDate ? eligibleDate.toLocaleDateString() : 'TBD'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ── Assignments ── */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2 px-1">
          <ClipboardList className="text-[var(--ui-accent)]" size={20} />
          Assignments
          <span className="ml-auto text-[10px] text-[var(--ui-muted)] font-black uppercase tracking-widest">
            {submissions.length}/{assignments.length} submitted
          </span>
        </h3>

        {assignments.length === 0 ? (
          <GlassCard className="p-6 text-center text-[var(--ui-muted)] text-sm">
            No assignments for this course yet.
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden border border-white/5 divide-y divide-white/5">
            {assignments.map((assignment) => {
              const sub = submissions.find(s => s.assignmentId === assignment.id);
              const submitted = !!sub;
              const graded = sub?.status === 'graded';

              return (
                <div
                  key={assignment.id}
                  className="p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center ${
                        graded
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : submitted
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-[var(--ui-bg-3)] text-[var(--ui-muted)]'
                      }`}
                    >
                      {graded ? (
                        <CheckCircle2 size={16} />
                      ) : submitted ? (
                        <Clock size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                    <div>
                      <p className="text-[var(--ui-heading)] font-semibold text-sm">
                        {assignment.title}
                      </p>
                      <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">
                        Due: {assignment.dueDate}
                        {graded && sub?.bandScore && ` · Score: ${sub.bandScore}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={graded ? 'Graded' : submitted ? 'Submitted' : 'Pending'}
                    variant={graded ? 'success' : submitted ? 'primary' : 'warning'}
                    className="text-[10px]"
                  />
                </div>
              );
            })}
          </GlassCard>
        )}
      </section>
    </motion.div>
  );
};
