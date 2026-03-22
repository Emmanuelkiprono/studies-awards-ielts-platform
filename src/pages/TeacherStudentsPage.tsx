import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Users,
  Search,
  ChevronRight,
  CheckCircle2,
  History,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Calendar,
  Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Course, StudentData, UserProfile, TrainingStatus, ExamStatus, Enrollment } from '../types';
import { NotificationService } from '../services/notificationService';

export const TeacherStudentsPage: React.FC = () => {
  const { profile: teacherProfile, user: teacherUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [students, setStudents] = useState<(UserProfile & Partial<Enrollment> & Partial<StudentData> & { paymentStatus?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'eligible'>('all');
  const [selectedStudent, setSelectedStudent] = useState<(UserProfile & Partial<Enrollment> & Partial<StudentData> & { paymentStatus?: string }) | null>(null);

  const [editTrainingStatus, setEditTrainingStatus] = useState<TrainingStatus>('inactive');
  const [editExamStatus, setEditExamStatus] = useState<ExamStatus>('not_started');
  const [editTargetScore, setEditTargetScore] = useState<number>(0);
  const [editCurrentScore, setEditCurrentScore] = useState<number>(0);

  // 1. Fetch available courses
  useEffect(() => {
    const coursesQ = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(coursesQ, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesData);
      if (!selectedCourseId && coursesData.length > 0) {
        setSelectedCourseId(teacherProfile?.assignedCourseId || coursesData[0].id);
      }
    });
    return () => unsubscribe();
  }, [teacherProfile?.assignedCourseId]);

  // 2. Fetch students for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      if (loading) setLoading(false);
      return;
    }

    setLoading(true);

    const enrollmentsQ = query(
      collection(db, 'enrollments'),
      where('courseId', '==', selectedCourseId)
    );

    let unsubscribeProfiles: (() => void) | undefined;

    const unsubscribe = onSnapshot(enrollmentsQ, (snapshot) => {
      const enrollmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enrollment & { paymentStatus?: string }));
      const studentIds = enrollmentsData.map(e => e.userId);

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      if (unsubscribeProfiles) unsubscribeProfiles();

      const profilesQ = query(
        collection(db, 'users'),
        where('uid', 'in', studentIds)
      );

      unsubscribeProfiles = onSnapshot(profilesQ, async (profilesSnap) => {
        const studentsData: (UserProfile & Partial<Enrollment> & Partial<StudentData> & { paymentStatus?: string })[] = [];

        for (const profileDoc of profilesSnap.docs) {
          const profile = profileDoc.data() as UserProfile;
          const enrollment = enrollmentsData.find(e => e.userId === profile.uid);

          // Fetch additional student data (scores)
          const studentDoc = await getDoc(doc(db, 'students', profile.uid));
          const sData = studentDoc.exists() ? studentDoc.data() as StudentData : undefined;

          studentsData.push({ ...profile, ...enrollment, ...sData });
        }

        setStudents(studentsData);
        setLoading(false);
      });
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfiles) unsubscribeProfiles();
    };
  }, [selectedCourseId]);

  const handleApprovePayment = async (studentId: string, enrollmentId?: string) => {
    if (!teacherUser) return;
    try {
      // Update enrollment
      if (enrollmentId) {
        const enrollmentRef = doc(db, 'enrollments', enrollmentId);

        // Fetch current enrollment to respect existing registrationDate if present
        const existing = await getDoc(enrollmentRef);
        const existingData = existing.exists() ? (existing.data() as Enrollment) : undefined;

        const baseRegistrationDate = existingData?.registeredAt?.toDate
          ? existingData.registeredAt.toDate()
          : new Date();
        const eligibleDate = new Date(baseRegistrationDate.getTime() + 28 * 24 * 60 * 60 * 1000); // registrationDate + 28 days

        const updates: any = {
          paymentStatus: 'paid',
          trainingStatus: 'active',
          approvedAt: serverTimestamp(),
          approvedBy: teacherUser.uid,
          eligibleAt: eligibleDate.toISOString()
        };

        if (!existingData?.registeredAt) {
          updates.registeredAt = serverTimestamp();
        }

        await updateDoc(enrollmentRef, updates);
      }

      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', studentId));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const safeTrainingStatus = existingStatus === 'approved' ? 'active' : 'active';

      // Update student data
      await updateDoc(doc(db, 'students', studentId), {
        trainingPaymentStatus: 'paid',
        trainingStatus: safeTrainingStatus
      });

      await NotificationService.create(
        studentId,
        'Enrollment Approved',
        'Your payment has been approved and your training has started. Welcome!',
        'success',
        '/dashboard'
      );

      setSelectedStudent(null);
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Failed to approve payment');
    }
  };

  const handleRejectPayment = async (studentId: string, enrollmentId?: string) => {
    try {
      if (enrollmentId) {
        await updateDoc(doc(db, 'enrollments', enrollmentId), {
          paymentStatus: 'unpaid',
          trainingStatus: 'locked'
        });
      }

      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', studentId));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const safeTrainingStatus = existingStatus === 'approved' ? 'active' : 'locked';

      await updateDoc(doc(db, 'students', studentId), {
        trainingPaymentStatus: 'unpaid',
        trainingStatus: safeTrainingStatus
      });

      await NotificationService.create(
        studentId,
        'Payment Not Confirmed',
        'Your payment could not be verified. Please re-submit your proof or contact support.',
        'warning',
        '/dashboard'
      );

      setSelectedStudent(null);
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Failed to reject payment');
    }
  };

  const handleUnlockTraining = async (studentId: string, enrollmentId?: string) => {
    if (!teacherUser) return;
    try {
      if (enrollmentId) {
        await updateDoc(doc(db, 'enrollments', enrollmentId), {
          trainingStatus: 'active',
          paymentStatus: 'paid',
        });
      }
      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', studentId));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const safeTrainingStatus = existingStatus === 'approved' ? 'active' : 'active';

      await updateDoc(doc(db, 'students', studentId), {
        trainingPaymentStatus: 'paid',
        trainingStatus: safeTrainingStatus,
      });
      await NotificationService.create(
        studentId,
        'Training Unlocked',
        'Your teacher has unlocked your training. You can now access all course materials!',
        'success',
        '/dashboard'
      );
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error unlocking training:', error);
      alert('Failed to unlock training');
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesTab = true;
    if (activeSubTab === 'pending') matchesTab = s.paymentStatus === 'pending';
    if (activeSubTab === 'eligible') {
      matchesTab = s.eligibleAt ? new Date() >= new Date(s.eligibleAt) : false;
    }

    return matchesSearch && matchesTab;
  });

  const handleOpenModal = (student: UserProfile & Partial<Enrollment> & Partial<StudentData> & { paymentStatus?: string }) => {
    setSelectedStudent(student);
    setEditTrainingStatus(student.trainingStatus as TrainingStatus || 'inactive');
    const currentStatus = student.examStatus as any;
    setEditExamStatus(currentStatus === 'pending_payment' ? 'pending_booking' : currentStatus || 'not_started');
    setEditTargetScore(student.targetScore || 0);
    setEditCurrentScore(student.currentScore || 0);
  };

  const handleSaveChanges = async () => {
    if (!selectedStudent || !selectedStudent.id) return;

    try {
      const enrollmentRef = doc(db, 'enrollments', selectedStudent.id);
      await updateDoc(enrollmentRef, {
        trainingStatus: editTrainingStatus,
        examStatus: editExamStatus,
        targetScore: editTargetScore,
        currentScore: editCurrentScore
      });

      // Preserve approval if already approved
      const existingSnap = await getDoc(doc(db, 'students', selectedStudent.uid));
      const existingStatus = existingSnap.data()?.onboardingStatus;
      
      const safeTrainingStatus = existingStatus === 'approved' ? 'active' : editTrainingStatus;

      // Also update student data
      await updateDoc(doc(db, 'students', selectedStudent.uid), {
        trainingStatus: safeTrainingStatus,
        examStatus: editExamStatus,
        targetScore: editTargetScore,
        currentScore: editCurrentScore
      });

      // Notify student if exam status became eligible
      if (editExamStatus === 'eligible') {
        await NotificationService.create(
          selectedStudent.uid,
          'You Are Now Exam Eligible',
          'Congratulations! You are now eligible to book your IELTS exam.',
          'success',
          '/exam_booking'
        );
      }

      setSelectedStudent(null);
    } catch (error) {
      console.error('Error updating student status:', error);
      alert('Failed to update student status');
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
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-black flex items-center gap-2">
          <Users className="text-[#6324eb]" size={28} />
          My Students
        </h2>
        <p className="text-slate-400 text-sm">Manage students and approve course access.</p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('all')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeSubTab === 'all' ? "bg-[#6324eb] text-white shadow-lg" : "text-slate-400 hover:text-black"
          )}
        >
          All
        </button>
        <button
          onClick={() => setActiveSubTab('pending')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeSubTab === 'pending' ? "bg-amber-500 text-white shadow-lg" : "text-slate-400 hover:text-black"
          )}
        >
          Pending
          {students.filter(s => s.paymentStatus === 'pending').length > 0 && (
            <span className="size-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
              {students.filter(s => s.paymentStatus === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('eligible')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeSubTab === 'eligible' ? "bg-emerald-500 text-white shadow-lg" : "text-slate-400 hover:text-black"
          )}
        >
          Eligible for Exam
          {students.filter(s => s.eligibleAt && new Date() >= new Date(s.eligibleAt)).length > 0 && (
            <span className="size-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
              {students.filter(s => s.eligibleAt && new Date() >= new Date(s.eligibleAt)).length}
            </span>
          )}
        </button>
      </div>

      {/* Course Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mr-2">Course:</p>
        {courses.map(course => (
          <button
            key={course.id}
            onClick={() => setSelectedCourseId(course.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
              selectedCourseId === course.id
                ? "bg-[#6324eb] border-[#6324eb] text-white shadow-lg shadow-[#6324eb]/20"
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            )}
          >
            {course.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <GlassCard className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search name or email..."
            className="input-field pl-12 py-3"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </GlassCard>

      {/* Student List */}
      <div className="space-y-3">
        {filteredStudents.map((student) => (
          <GlassCard
            key={student.uid}
            onClick={() => handleOpenModal(student)}
            className={cn(
              "p-4 flex items-center justify-between group cursor-pointer transition-all border-l-4",
              student.paymentStatus === 'pending' ? "border-l-amber-500 bg-amber-500/5" : "border-l-transparent hover:border-l-[#6324eb]"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full overflow-hidden border border-white/10">
                <img src={student.avatarUrl || `https://picsum.photos/seed/${student.uid}/100/100`} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-slate-100 font-semibold">{student.name}</p>
                  {student.paymentStatus === 'pending' && (
                    <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Pending</span>
                  )}
                  {student.eligibleAt && new Date() >= new Date(student.eligibleAt) && (
                    <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={8} /> Eligible
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <StatusBadge status={student.trainingStatus?.replace('_', ' ') || 'inactive'} variant={student.trainingStatus === 'active' ? 'primary' : student.trainingStatus === 'completed' ? 'success' : 'accent'} className="text-[10px]" />
                  {student.location && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                      <Search size={10} /> {student.location.city}, {student.location.country}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-600 group-hover:text-black transition-colors" />
          </GlassCard>
        ))}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-slate-500">No students found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-x-0 bottom-0 z-[70] flex flex-col px-4 pb-4 overflow-y-auto max-h-[90vh]"
            >
              <div className="bg-[#0d1225] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-2xl mx-auto w-full">
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6"></div>

                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <img src={selectedStudent.avatarUrl || `https://picsum.photos/seed/${selectedStudent.uid}/100/100`} alt={selectedStudent.name} className="size-16 rounded-2xl object-cover border border-white/10" referrerPolicy="no-referrer" />
                    <div>
                      <h3 className="text-xl font-semibold text-black">{selectedStudent.name}</h3>
                      <p className="text-slate-400 text-sm">{selectedStudent.email}</p>
                      {selectedStudent.location && (
                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                          <Search size={12} /> {selectedStudent.location.city}, {selectedStudent.location.country}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <ArrowLeft size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Eligibility Timeline */}
                  {selectedStudent.registeredAt && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-black uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={14} className="text-amber-500" />
                          Exam Timeline
                        </h4>
                        {selectedStudent.eligibleAt && new Date() >= new Date(selectedStudent.eligibleAt) ? (
                          <StatusBadge status="Eligible" variant="success" />
                        ) : (
                          <StatusBadge status="Training" variant="warning" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Registered</p>
                          <p className="text-black text-sm font-medium">
                            {selectedStudent.registeredAt?.toDate ? selectedStudent.registeredAt.toDate().toLocaleDateString() : new Date(selectedStudent.registeredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Eligible From</p>
                          <p className="text-black text-sm font-medium">
                            {selectedStudent.eligibleAt ? new Date(selectedStudent.eligibleAt).toLocaleDateString() : 'TBD'}
                          </p>
                        </div>
                      </div>

                      {/* Exam Fee Status */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Exam Fee Status</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={selectedStudent.examFeeStatus || 'unpaid'} variant={selectedStudent.examFeeStatus === 'paid' ? 'success' : selectedStudent.examFeeStatus === 'pending' ? 'warning' : 'accent'} />
                          {(selectedStudent.examFeeStatus === 'pending' || selectedStudent.examFeeStatus === 'unpaid') && (
                            <button
                              onClick={async () => {
                                if (!selectedStudent.id) return;
                                try {
                                  await updateDoc(doc(db, 'enrollments', selectedStudent.id), { examFeeStatus: 'paid' });
                                  setSelectedStudent(prev => prev ? { ...prev, examFeeStatus: 'paid' } : null);
                                } catch (e) { alert('Update failed'); }
                              }}
                              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Approval Block */}
                  {selectedStudent.paymentStatus === 'pending' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3 text-amber-500">
                        <History size={20} />
                        <h4 className="font-bold">Awaiting Payment Approval</h4>
                      </div>
                      <p className="text-slate-300 text-sm">
                        This student has signed up and is waiting for course access. Please verify their payment before approving.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprovePayment(selectedStudent.uid, selectedStudent.id)}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={18} />
                          Approve Payment
                        </button>
                        <button
                          onClick={() => handleRejectPayment(selectedStudent.uid, selectedStudent.id)}
                          className="px-6 border border-white/10 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-bold py-3 rounded-xl transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Unlock Training button for locked students */}
                  {(selectedStudent.trainingStatus === 'locked' || selectedStudent.trainingStatus === 'inactive') && (
                    <div className="bg-[#6324eb]/10 border border-[#6324eb]/20 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3 text-[#6324eb]">
                        <Unlock size={20} />
                        <h4 className="font-bold">Training Locked</h4>
                      </div>
                      <p className="text-slate-300 text-sm">
                        This student's training is currently locked. Unlock to give them full access to course materials, assignments, and live sessions.
                      </p>
                      <button
                        onClick={() => handleUnlockTraining(selectedStudent.uid, selectedStudent.id)}
                        className="w-full bg-[#6324eb] hover:bg-[#5a1ed4] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Unlock size={18} />
                        Unlock Training
                      </button>
                    </div>
                  )}

                  {/* Status Management - only show if not pending approval and not locked */}
                  {selectedStudent.paymentStatus !== 'pending' && selectedStudent.trainingStatus !== 'locked' && selectedStudent.trainingStatus !== 'inactive' && (
                    <>
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-black uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp size={14} className="text-[#6324eb]" />
                          Update Records
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Training</label>
                            <select
                              className="input-field py-2 text-sm"
                              value={editTrainingStatus}
                              onChange={(e) => setEditTrainingStatus(e.target.value as TrainingStatus)}
                            >
                              <option value="locked">Locked</option>
                              <option value="inactive">Inactive</option>
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Exam</label>
                            <select
                              className="input-field py-2 text-sm"
                              value={editExamStatus}
                              onChange={(e) => setEditExamStatus(e.target.value as ExamStatus)}
                            >
                              <option value="not_started">Not Started</option>
                              <option value="pending_booking">Pending Booking</option>
                              <option value="scheduled">Scheduled</option>
                              <option value="done">Done</option>
                              <option value="results_released">Results Released</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-black uppercase tracking-widest flex items-center gap-2">
                          <BarChart3 size={14} className="text-emerald-400" />
                          Scores (Band)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Target Band</p>
                            <input
                              type="number"
                              step="0.5"
                              className="input-field py-2"
                              value={editTargetScore}
                              onChange={(e) => setEditTargetScore(Number(e.target.value))}
                            />
                          </div>
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Latest Score</p>
                            <input
                              type="number"
                              step="0.5"
                              className="input-field py-2"
                              value={editCurrentScore}
                              onChange={(e) => setEditCurrentScore(Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <PrimaryButton className="w-full py-4 text-sm" onClick={handleSaveChanges}>
                          Save Student Record
                        </PrimaryButton>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

