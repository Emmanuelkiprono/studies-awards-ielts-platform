import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  ClipboardList,
  Plus,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  Save,
  FileText,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, orderBy } from 'firebase/firestore';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';
import { Course, Assignment, Submission, UserProfile, Enrollment } from '../types';

export const TeacherAssignmentsPage: React.FC<{ onCreateAssignment: () => void }> = ({ onCreateAssignment }) => {
  const { profile: teacherProfile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<(Submission & { student: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<(Submission & { student: UserProfile }) | null>(null);
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

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

  // 2. Fetch assignments and submissions for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      if (!loading) setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch assignments
    const assignmentsQ = query(
      collection(db, 'assignments'),
      where('courseId', '==', selectedCourseId)
    );

    const unsubscribeAssignments = onSnapshot(assignmentsQ, (snapshot) => {
      const assignmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      setAssignments(assignmentsData);
      setLoading(false);
    });

    // Fetch submissions for the course
    const submissionsQ = query(
      collection(db, 'submissions'),
      where('courseId', '==', selectedCourseId)
    );

    const unsubscribeSubmissions = onSnapshot(submissionsQ, async (snapshot) => {
      const submissionsData: (Submission & { student: UserProfile })[] = [];
      const enrollmentsQ = query(collection(db, 'enrollments'), where('courseId', '==', selectedCourseId));
      const enrollmentsSnap = await getDocs(enrollmentsQ);
      const studentIdsInCourse = enrollmentsSnap.docs.map(d => d.data().userId);

      for (const subDoc of snapshot.docs) {
        const data = subDoc.data() as Submission;
        if (!studentIdsInCourse.includes(data.studentId)) continue;

        // Fetch student profile
        const profileSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', data.studentId)));
        if (!profileSnap.empty) {
          submissionsData.push({
            ...data,
            id: subDoc.id,
            student: profileSnap.docs[0].data() as UserProfile
          });
        }
      }
      setSubmissions(submissionsData);
    });

    return () => {
      unsubscribeAssignments();
      unsubscribeSubmissions();
    };
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedSubmission) {
      setGrade(selectedSubmission.bandScore?.toString() || '');
      setFeedback(selectedSubmission.feedback || '');
    }
  }, [selectedSubmission]);

  const handleGradeSubmission = async () => {
    if (!selectedSubmission) return;

    try {
      const subRef = doc(db, 'submissions', selectedSubmission.id);
      await updateDoc(subRef, {
        bandScore: Number(grade),
        feedback,
        status: 'graded',
        gradedAt: new Date().toISOString()
      });

      await NotificationService.create(
        selectedSubmission.studentId,
        'Assignment Graded',
        `Your submission has been graded. Band score: ${grade}. Check your assignments for feedback.`,
        'success',
        '/tasks'
      );

      setSelectedSubmission(null);
      setGrade('');
      setFeedback('');
    } catch (error) {
      console.error('Error grading submission:', error);
      alert('Failed to save grade');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-4xl mx-auto w-full pb-24"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="text-[#6324eb]" size={28} />
            Assignments
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-slate-400 text-sm mr-2">Reviewing Tasks for:</p>
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
        <PrimaryButton className="px-6 py-3" onClick={onCreateAssignment} disabled={!selectedCourseId}>
          <Plus size={20} /> Create Assignment
        </PrimaryButton>
      </header>

      {courses.length === 0 && !loading && (
        <GlassCard className="p-8 text-center border-orange-500/20 bg-orange-500/5">
          <AlertCircle className="mx-auto text-orange-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Courses Available</h3>
          <p className="text-slate-400">Please contact the administrator to create courses or assign you as a teacher.</p>
        </GlassCard>
      )}

      {/* Assignment List */}
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <GlassCard
            key={assignment.id}
            onClick={() => setSelectedAssignment(assignment)}
            className="p-4 flex items-center justify-between group cursor-pointer hover:border-[#6324eb]/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb]">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-slate-100 font-semibold">{assignment.title}</p>
                <div className="flex gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-bold">
                    <Clock size={12} /> Due: {assignment.dueDate}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-bold">
                    <Users size={12} /> {submissions.filter(s => s.assignmentId === assignment.id).length} Submissions
                  </span>
                </div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
          </GlassCard>
        ))}
        {assignments.length === 0 && selectedCourseId && (
          <p className="text-center text-slate-500 py-12">No assignments created yet.</p>
        )}
      </div>

      {/* Submissions Modal */}
      <AnimatePresence>
        {selectedAssignment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAssignment(null)}
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
                    <h3 className="text-xl font-bold text-white">{selectedAssignment.title}</h3>
                    <p className="text-slate-400 text-sm">Review student submissions for this task.</p>
                  </div>
                  <button onClick={() => setSelectedAssignment(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <ArrowLeft size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {submissions.filter(s => s.assignmentId === selectedAssignment.id).map((submission) => (
                    <div
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <img src={submission.student.avatarUrl} alt={submission.student.name} className="size-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-sm font-bold text-white">{submission.student.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{submission.fileName || (submission.notes ? 'Text submission' : 'No file')}</p>
                        </div>
                      </div>
                      <StatusBadge
                        status={submission.status}
                        variant={submission.status === 'graded' ? 'success' : 'warning'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Grading Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubmission(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-xl w-full p-8 space-y-6 pointer-events-auto bg-[#0d1225] border-white/10 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Grade Submission</h3>
                  <button onClick={() => setSelectedSubmission(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <ArrowLeft size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#6324eb]/10 border border-[#6324eb]/20 space-y-3">
                    <div className="flex items-center gap-3">
                      <FileText size={24} className="text-[#6324eb] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{selectedSubmission.fileName || 'Text submission'}</p>
                        <p className="text-slate-400 text-xs">Submitted by {selectedSubmission.student.name}</p>
                      </div>
                      {selectedSubmission.fileUrl && (
                        <a
                          href={selectedSubmission.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <PrimaryButton variant="secondary" className="px-4 py-2 text-xs">
                            VIEW FILE
                          </PrimaryButton>
                        </a>
                      )}
                    </div>
                    {selectedSubmission.notes && (
                      <div className="border-t border-white/10 pt-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Student Notes</p>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedSubmission.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">Band Score</label>
                      <div className="relative">
                        <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="9"
                          className="input-field pl-12 py-2 text-sm"
                          placeholder="e.g. 7.5"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">Status</label>
                      <StatusBadge status={selectedSubmission.status} variant={selectedSubmission.status === 'graded' ? 'success' : 'warning'} className="h-10 w-full flex items-center justify-center" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Feedback</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 text-slate-500" size={16} />
                      <textarea
                        className="input-field pl-12 py-3 min-h-[120px] text-sm"
                        placeholder="Provide detailed feedback to the student..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                      ></textarea>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <PrimaryButton className="flex-1 py-3" onClick={handleGradeSubmission}>
                      <Save size={20} /> Save Grade & Feedback
                    </PrimaryButton>
                    <PrimaryButton variant="secondary" className="px-6 py-3" onClick={() => setSelectedSubmission(null)}>
                      Cancel
                    </PrimaryButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
