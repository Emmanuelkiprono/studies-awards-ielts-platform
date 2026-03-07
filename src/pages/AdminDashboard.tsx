import React, { useState, useEffect } from 'react';
import { GlassCard, StatusBadge, PrimaryButton } from '../components/UI';
import {
  Search,
  Filter,
  MoreVertical,
  User,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  Edit3,
  Trash2,
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  BarChart3,
  Plus,
  X,
  ArrowLeft,
  TrendingUp,
  Save,
  LogOut,
  ChevronDown,
  PlayCircle,
  FileIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { UserProfile, Course, Module, Lesson } from '../types';
import { useAuth } from '../hooks/useAuth';

import { StudentData, Enrollment, PaymentStatus, TrainingStatus, ExamStatus } from '../types';

interface Student extends UserProfile {
  studentData?: StudentData;
  enrollment?: Enrollment;
  paymentStatus: string;
  trainingStatus: TrainingStatus;
  examStatus: ExamStatus;
  targetScore: number;
  currentScore: number;
  joinDate: string;
  phone?: string;
}

export const AdminDashboard: React.FC = () => {
  const { signOut, user: adminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'courses'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editTrainingStatus, setEditTrainingStatus] = useState<TrainingStatus>('inactive');
  const [editExamStatus, setEditExamStatus] = useState<ExamStatus>('not_started');
  const [editTargetScore, setEditTargetScore] = useState<number>(0);
  const [editCurrentScore, setEditCurrentScore] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Teacher creation state
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);
  const [teacherSuccess, setTeacherSuccess] = useState<{ uid: string, tempPass: string } | null>(null);
  const [isAssigningCourse, setIsAssigningCourse] = useState(false);
  const [teacherToAssign, setTeacherToAssign] = useState<UserProfile | null>(null);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');

  // Course management state
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isAssigningTeacherToCourse, setIsAssigningTeacherToCourse] = useState(false);
  const [courseToAssignTeacher, setCourseToAssignTeacher] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Module & Lesson management state
  const [selectedCourseForModules, setSelectedCourseForModules] = useState<Course | null>(null);
  const [isManagingModules, setIsManagingModules] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleOrder, setModuleOrder] = useState(1);

  const [selectedModuleForLessons, setSelectedModuleForLessons] = useState<Module | null>(null);
  const [isManagingLessons, setIsManagingLessons] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonPdfUrl, setLessonPdfUrl] = useState('');
  const [lessonDuration, setLessonDuration] = useState(10);
  const [lessonOrder, setLessonOrder] = useState(1);


  useEffect(() => {
    // Fetch teachers
    const teachersQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribeTeachers = onSnapshot(teachersQ, (snapshot) => {
      const teachersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setTeachers(teachersData);
    });

    // Fetch courses
    const coursesQ = query(collection(db, 'courses'));
    const unsubscribeCourses = onSnapshot(coursesQ, (snapshot) => {
      const coursesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      setCourses(coursesData);
    });

    // Fetch Students (Composite)
    const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribeStudents = onSnapshot(studentsQ, async (snapshot) => {
      const studentProfiles = snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));

      const allStudentsData: Student[] = [];

      for (const profile of studentProfiles) {
        // Fetch student data
        const studentDoc = await getDoc(doc(db, 'students', profile.uid));
        const sData = studentDoc.exists() ? studentDoc.data() as StudentData : undefined;

        // Fetch enrollment
        const enrollmentsQ = query(collection(db, 'enrollments'), where('userId', '==', profile.uid));
        const enrollmentSnap = await getDocs(enrollmentsQ);
        const firstEnrollment = enrollmentSnap.docs[0]?.data() as Enrollment | undefined;
        const enrollmentId = enrollmentSnap.docs[0]?.id;

        allStudentsData.push({
          ...profile,
          studentData: sData,
          enrollment: firstEnrollment ? { ...firstEnrollment, id: enrollmentId } : undefined,
          paymentStatus: firstEnrollment?.paymentStatus || sData?.trainingPaymentStatus || 'unpaid',
          trainingStatus: (firstEnrollment?.trainingStatus as TrainingStatus) || sData?.trainingStatus || 'inactive',
          examStatus: (firstEnrollment?.examStatus as ExamStatus) || 'not_started',
          targetScore: sData?.targetScore || 0,
          currentScore: sData?.currentScore || 0,
          joinDate: profile.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      }
      setStudents(allStudentsData);
      setLoading(false);
    });

    return () => {
      unsubscribeTeachers();
      unsubscribeCourses();
      unsubscribeStudents();
    };
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName) return;

    try {
      const courseData = {
        name: courseName,
        description: courseDescription,
        teacherId: selectedTeacherId || null,
        durationWeeks: 8,
        trainingPrice: 10000,
        examPrice: 25000,
        active: true,
        createdAt: serverTimestamp()
      };

      const courseRef = await addDoc(collection(db, 'courses'), courseData);

      if (selectedTeacherId) {
        // Update teacher's assignedCourseId
        const teacherDocRef = doc(db, 'users', selectedTeacherId);
        await updateDoc(teacherDocRef, {
          assignedCourseId: courseRef.id
        });
      }

      setIsCreatingCourse(false);
      setCourseName('');
      setCourseDescription('');
      setSelectedTeacherId('');
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Failed to create course');
    }
  };

  const handleToggleCourseActive = async (courseId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        active: !currentStatus
      });
    } catch (error) {
      console.error('Error toggling course status:', error);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (error) {
      console.error('Error deleting course:', error);
    }
  };

  // Module Management
  const fetchModules = (courseId: string) => {
    const q = query(collection(db, 'courses', courseId, 'modules'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setModules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module)));
    });
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForModules || !moduleName) return;

    try {
      await addDoc(collection(db, 'courses', selectedCourseForModules.id, 'modules'), {
        name: moduleName,
        description: moduleDescription,
        order: Number(moduleOrder),
        createdAt: serverTimestamp()
      });
      setIsCreatingModule(false);
      setModuleName('');
      setModuleDescription('');
      setModuleOrder(modules.length + 2);
    } catch (error) {
      console.error('Error creating module:', error);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!selectedCourseForModules || !window.confirm('Delete this module?')) return;
    try {
      await deleteDoc(doc(db, 'courses', selectedCourseForModules.id, 'modules', moduleId));
    } catch (error) {
      console.error('Error deleting module:', error);
    }
  };

  // Lesson Management
  const fetchLessons = (courseId: string, moduleId: string) => {
    const q = query(collection(db, 'courses', courseId, 'modules', moduleId, 'lessons'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setLessons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)));
    });
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForModules || !selectedModuleForLessons || !lessonTitle) return;

    try {
      await addDoc(collection(db, 'courses', selectedCourseForModules.id, 'modules', selectedModuleForLessons.id, 'lessons'), {
        title: lessonTitle,
        description: lessonDescription,
        videoUrl: lessonVideoUrl,
        pdfUrl: lessonPdfUrl,
        durationMinutes: Number(lessonDuration),
        order: Number(lessonOrder),
        createdAt: serverTimestamp()
      });
      setIsCreatingLesson(false);
      setLessonTitle('');
      setLessonDescription('');
      setLessonVideoUrl('');
      setLessonPdfUrl('');
      setLessonOrder(lessons.length + 2);
    } catch (error) {
      console.error('Error creating lesson:', error);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedCourseForModules || !selectedModuleForLessons || !window.confirm('Delete this lesson?')) return;
    try {
      await deleteDoc(doc(db, 'courses', selectedCourseForModules.id, 'modules', selectedModuleForLessons.id, 'lessons', lessonId));
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };
  const [courseTeacherId, setCourseTeacherId] = useState('');

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm));

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && s.trainingStatus === 'active') ||
      (filterStatus === 'eligible' && s.trainingStatus === 'completed' && s.examStatus === 'not_started') ||
      (filterStatus === 'booked' && (s.examStatus === 'scheduled' || s.examStatus === 'done')) ||
      (filterStatus === 'pending_approval' && s.paymentStatus === 'pending');

    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = (student: Student) => {
    setSelectedStudent(student);
    setEditTrainingStatus(student.trainingStatus);
    setEditExamStatus(student.examStatus);
    setEditTargetScore(student.targetScore);
    setEditCurrentScore(student.currentScore);
  };

  const handleSaveChanges = async () => {
    if (!selectedStudent) return;

    try {
      // 1. Update Enrollment if exists
      if (selectedStudent.enrollment?.id) {
        await updateDoc(doc(db, 'enrollments', selectedStudent.enrollment.id), {
          trainingStatus: editTrainingStatus,
          examStatus: editExamStatus,
          updatedAt: serverTimestamp()
        });
      }

      // 2. Update Student Data
      await updateDoc(doc(db, 'students', selectedStudent.uid), {
        trainingStatus: editTrainingStatus,
        examStatus: editExamStatus,
        targetScore: editTargetScore,
        currentScore: editCurrentScore
      });

      setSelectedStudent(null);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes to Firestore');
    }
  };

  const handleApprovePayment = async (student: Student) => {
    try {
      if (student.enrollment?.id) {
        await updateDoc(doc(db, 'enrollments', student.enrollment.id), {
          paymentStatus: 'paid',
          trainingStatus: 'active',
          approvedAt: serverTimestamp(),
          approvedBy: adminUser?.uid
        });
      }

      await updateDoc(doc(db, 'students', student.uid), {
        trainingPaymentStatus: 'paid',
        trainingStatus: 'active'
      });
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Failed to approve payment');
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTeacher(true);
    try {
      const response = await fetch('/api/admin/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teacherName, email: teacherEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setTeacherSuccess({ uid: data.uid, tempPass: data.tempPassword });
        setTeacherName('');
        setTeacherEmail('');
      } else {
        alert(data.error || 'Failed to create teacher');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  const handleAssignTeacher = async (teacherId: string, courseId: string) => {
    try {
      const teacherDocRef = doc(db, 'users', teacherId);
      await updateDoc(teacherDocRef, {
        assignedCourseId: courseId
      });

      // Also update the course's teacherId
      const courseDocRef = doc(db, 'courses', courseId);
      await updateDoc(courseDocRef, {
        teacherId: teacherId
      });

      setIsAssigningCourse(false);
      setTeacherToAssign(null);
      setIsAssigningTeacherToCourse(false);
      setCourseToAssignTeacher(null);
    } catch (error) {
      console.error('Error assigning teacher:', error);
      alert('Failed to assign teacher');
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(teacherSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-body)] flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--ui-border-soft)] bg-[var(--ui-bg-2)] p-6 space-y-8">
        <div className="flex items-center gap-3">
          <div className="bg-[#6324eb] size-10 rounded-xl flex items-center justify-center shadow-lg shadow-[#6324eb]/20">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-[var(--ui-heading)] tracking-tight">Admin</h1>
        </div>

        <nav className="space-y-2">
          <NavItem
            icon={Users}
            label="Students"
            active={activeTab === 'students'}
            onClick={() => setActiveTab('students')}
          />
          <NavItem
            icon={User}
            label="Teachers"
            active={activeTab === 'teachers'}
            onClick={() => setActiveTab('teachers')}
          />
          <NavItem
            icon={BookOpen}
            label="Courses"
            active={activeTab === 'courses'}
            onClick={() => setActiveTab('courses')}
          />
          <NavItem icon={Calendar} label="Exams" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        <div className="mt-auto pt-8 border-t border-[var(--ui-border-soft)]">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--ui-muted)] hover:text-red-500 hover:bg-red-400/10 transition-all group"
          >
            <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto max-h-screen no-scrollbar">
        {activeTab === 'students' ? (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[var(--ui-heading)]">Student Management</h2>
                <p className="text-[var(--ui-muted)]">View and manage all enrolled students across the platform.</p>
              </div>
              <div className="flex items-center gap-3">
                <PrimaryButton variant="secondary" className="px-4 py-2 text-sm">
                  <Download size={16} /> Export CSV
                </PrimaryButton>
                <PrimaryButton className="px-4 py-2 text-sm">
                  <Plus size={16} /> Add Student
                </PrimaryButton>
              </div>
            </header>

            {/* Stats Summary */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Students"
                value={students.length.toString()}
                trend={`+${students.filter(s => {
                  const join = new Date(s.joinDate);
                  const now = new Date();
                  return (now.getTime() - join.getTime()) < 7 * 24 * 60 * 60 * 1000;
                }).length} this week`}
                icon={Users}
                color="text-blue-400"
              />
              <StatCard
                label="Active Training"
                value={students.filter(s => s.trainingStatus === 'active').length.toString()}
                trend={`${students.filter(s => s.paymentStatus === 'pending').length} pending`}
                icon={Clock}
                color="text-[#6324eb]"
              />
              <StatCard
                label="Pending Exams"
                value={students.filter(s => s.examStatus === 'pending_booking' || s.examStatus === 'scheduled').length.toString()}
                trend="Upcoming"
                icon={AlertCircle}
                color="text-orange-400"
              />
              <StatCard
                label="Results Released"
                value={students.filter(s => s.examStatus === 'results_released').length.toString()}
                trend="Completed"
                icon={CheckCircle2}
                color="text-emerald-400"
              />
            </section>

            {/* Filters & Search */}
            <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  className="input-field pl-12 py-3"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                  <Filter size={18} /> Filters
                </button>
                <select
                  className="flex-1 md:w-48 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium outline-none"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Training</option>
                  <option value="eligible">Eligible for Exam</option>
                  <option value="booked">Exam Booked</option>
                  <option value="pending_approval">Pending Approval</option>
                </select>
              </div>
            </GlassCard>

            {/* Student Table */}
            <GlassCard className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-[var(--ui-border-soft)]">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Student</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Training Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Exam Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Target</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Joined</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredStudents.map((student) => (
                      <tr
                        key={student.uid}
                        onClick={() => handleOpenModal(student)}
                        className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={student.avatarUrl || `https://picsum.photos/seed/${student.uid}/100/100`} alt={student.name} className="size-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                            <div>
                              <p className="text-sm font-bold text-[var(--ui-heading)]">{student.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-[var(--ui-muted)]">{student.email}</p>
                                {student.enrollment?.location && (
                                  <span className="text-[10px] text-[var(--ui-muted)] flex items-center gap-1">
                                    • {student.enrollment.location.city}, {student.enrollment.location.country}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge
                            status={student.trainingStatus.replace('_', ' ')}
                            variant={student.trainingStatus === 'active' ? 'primary' : student.trainingStatus === 'completed' ? 'success' : 'accent'}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <StatusBadge
                              status={student.examStatus.replace('_', ' ')}
                              variant={student.examStatus === 'done' || student.examStatus === 'results_released' ? 'success' : student.examStatus === 'scheduled' ? 'warning' : 'accent'}
                            />
                            {student.enrollment?.eligibleAt && new Date() >= new Date(student.enrollment.eligibleAt) && (
                              <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                <CheckCircle2 size={8} /> Eligible
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-[var(--ui-heading)]">{student.targetScore}</span>
                            <span className="text-[10px] text-[var(--ui-muted)]">Band</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--ui-muted)]">
                          {new Date(student.joinDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {student.paymentStatus === 'pending' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApprovePayment(student); }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold uppercase hover:bg-amber-600 transition-all flex items-center gap-1"
                                title="Approve Payment"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenModal(student); }}
                              className="p-2 rounded-lg bg-white/5 hover:bg-[#6324eb]/20 hover:text-[#6324eb] transition-all"
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </>
        ) : activeTab === 'teachers' ? (
          <>
            {/* Teachers Tab */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[var(--ui-heading)]">Teacher Management</h2>
                <p className="text-[var(--ui-muted)]">Manage faculty and create new teacher accounts.</p>
              </div>
              <div className="flex items-center gap-3">
                <PrimaryButton className="px-4 py-2 text-sm" onClick={() => { setIsCreatingTeacher(true); setTeacherSuccess(null); }}>
                  <Plus size={16} /> Create Teacher Account
                </PrimaryButton>
              </div>
            </header>

            {/* Teacher Search */}
            <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search teachers by name or email..."
                  className="input-field pl-12 py-3"
                  value={teacherSearchTerm}
                  onChange={(e) => setTeacherSearchTerm(e.target.value)}
                />
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeachers.map((teacher) => (
                <GlassCard key={teacher.uid} className="p-6 space-y-4 hover:border-[#6324eb]/50 transition-all group">
                  <div className="flex items-center gap-4">
                    <img
                      src={teacher.avatarUrl || `https://picsum.photos/seed/${teacher.uid}/100/100`}
                      alt={teacher.name}
                      className="size-16 rounded-2xl object-cover border border-white/10"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-[var(--ui-heading)]">{teacher.name}</h3>
                      <p className="text-xs text-[var(--ui-muted)]">{teacher.email}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Assigned Course:</span>
                      <span className="text-xs text-[var(--ui-body)] font-medium">
                        {courses.find(c => c.id === teacher.assignedCourseId)?.name || 'None'}
                      </span>
                    </div>
                    <button
                      onClick={() => { setTeacherToAssign(teacher); setIsAssigningCourse(true); }}
                      className="w-full py-2 rounded-lg bg-[#6324eb]/10 text-[#6324eb] text-xs font-bold hover:bg-[#6324eb]/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <BookOpen size={14} />
                      {teacher.assignedCourseId ? 'Change Assignment' : 'Assign to Course'}
                    </button>
                  </div>
                </GlassCard>
              ))}
              {filteredTeachers.length === 0 && (
                <GlassCard className="p-8 text-center col-span-full">
                  <p className="text-[var(--ui-muted)] italic">No teachers found matching your search.</p>
                </GlassCard>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Courses Tab */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[var(--ui-heading)]">Course Management</h2>
                <p className="text-[var(--ui-muted)]">Create and manage IELTS training courses.</p>
              </div>
              <div className="flex items-center gap-3">
                <PrimaryButton className="px-4 py-2 text-sm" onClick={() => setIsCreatingCourse(true)}>
                  <Plus size={16} /> Create New Course
                </PrimaryButton>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((course) => {
                const teacher = teachers.find(t => t.uid === course.teacherId);
                return (
                  <GlassCard key={course.id} className="p-6 space-y-4 hover:border-[#6324eb]/50 transition-all group">
                    <div className="flex justify-between items-start">
                      <div className="size-12 rounded-2xl bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb]">
                        <BookOpen size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCourseActive(course.id, course.active)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            course.active ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20"
                          )}
                          title={course.active ? "Deactivate Course" : "Activate Course"}
                        >
                          {course.active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <StatusBadge status={course.active ? "Active" : "Inactive"} variant={course.active ? "success" : "accent"} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[var(--ui-heading)] group-hover:text-[var(--ui-accent)] transition-colors">{course.name}</h3>
                      <p className="text-[var(--ui-muted)] text-sm line-clamp-2 mt-1">{course.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => { setSelectedCourseForModules(course); setIsManagingModules(true); fetchModules(course.id); }}
                        className="py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                      >
                        <LayoutDashboard size={14} /> Modules
                      </button>
                      <button
                        onClick={() => { setCourseToAssignTeacher(course); setIsAssigningTeacherToCourse(true); }}
                        className="py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                      >
                        <User size={14} /> Teacher
                      </button>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                          <img src={teacher?.avatarUrl || `https://picsum.photos/seed/${course.teacherId}/100/100`} alt={teacher?.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs text-[var(--ui-body)] font-medium">{teacher?.name || 'Unassigned'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button className="p-2 rounded-lg text-[var(--ui-muted)] hover:text-[var(--ui-heading)] hover:bg-white/10 transition-all">
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
              {courses.length === 0 && (
                <GlassCard className="p-8 text-center col-span-full">
                  <p className="text-[var(--ui-muted)] italic">No courses created yet. Use the button above to add your first course.</p>
                </GlassCard>
              )}
            </div>
          </>
        )}
      </main>

      {/* Create Course Modal */}
      <AnimatePresence>
        {isCreatingCourse && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingCourse(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-md w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">Create New Course</h3>
                  <button onClick={() => setIsCreatingCourse(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <form onSubmit={handleCreateCourse} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Course Name</label>
                    <input
                      type="text"
                      required
                      className="input-field py-2 text-sm"
                      placeholder="e.g. IELTS Academic Intensive"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Description</label>
                    <textarea
                      className="input-field min-h-[100px] py-3 text-sm"
                      placeholder="Brief overview of the course..."
                      value={courseDescription}
                      onChange={(e) => setCourseDescription(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 uppercase font-bold px-1">Assign Teacher</label>
                    <select
                      required
                      className="input-field py-2 text-sm"
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                    >
                      <option value="">Select a teacher...</option>
                      {teachers.map(teacher => (
                        <option key={teacher.uid} value={teacher.uid}>{teacher.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <PrimaryButton type="submit" className="flex-1 py-3">
                      <Save size={20} /> Create Course
                    </PrimaryButton>
                    <PrimaryButton variant="secondary" className="px-6 py-3" onClick={() => setIsCreatingCourse(false)}>
                      Cancel
                    </PrimaryButton>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCreatingTeacher && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingTeacher(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-md w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">New Teacher Account</h3>
                  <button onClick={() => setIsCreatingTeacher(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                {teacherSuccess ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <p className="font-bold flex items-center gap-2">
                        <CheckCircle2 size={18} /> Account Created!
                      </p>
                      <p className="text-sm mt-2">Share these credentials with the teacher. They will be forced to change their password on first login.</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                      <p className="text-xs text-slate-500 uppercase font-bold">Temporary Password</p>
                      <p className="text-xl font-mono text-[var(--ui-heading)] select-all">{teacherSuccess.tempPass}</p>
                    </div>
                    <PrimaryButton className="w-full py-3" onClick={() => setIsCreatingTeacher(false)}>
                      Done
                    </PrimaryButton>
                  </div>
                ) : (
                  <form onSubmit={handleCreateTeacher} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                          type="text"
                          required
                          className="input-field pl-12 py-2 text-sm"
                          placeholder="e.g. Dr. Sarah Connor"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 uppercase font-bold px-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                          type="email"
                          required
                          className="input-field pl-12 py-2 text-sm"
                          placeholder="teacher@academy.com"
                          value={teacherEmail}
                          onChange={(e) => setTeacherEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <PrimaryButton
                      type="submit"
                      className="w-full py-3"
                      disabled={isSubmittingTeacher}
                    >
                      {isSubmittingTeacher ? 'Creating...' : 'Create Account'}
                    </PrimaryButton>
                  </form>
                )}
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Assign Teacher Modal */}
      <AnimatePresence>
        {isAssigningCourse && teacherToAssign && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssigningCourse(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-md w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">Assign Teacher to Course</h3>
                  <button onClick={() => setIsAssigningCourse(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--ui-bg-3)] border border-[var(--ui-border-soft)]">
                  <img
                    src={teacherToAssign.avatarUrl || `https://picsum.photos/seed/${teacherToAssign.uid}/100/100`}
                    alt={teacherToAssign.name}
                    className="size-12 rounded-xl object-cover"
                  />
                  <div>
                    <p className="text-sm font-bold text-[var(--ui-body)]">{teacherToAssign.name}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{teacherToAssign.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-[var(--ui-muted)]">Select a course to assign to this teacher:</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {courses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => handleAssignTeacher(teacherToAssign.uid, course.id)}
                        className={cn(
                          "w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between group",
                          teacherToAssign.assignedCourseId === course.id
                            ? "bg-[var(--ui-accent-soft)] border-[var(--ui-accent)] text-[var(--ui-heading)]"
                            : "bg-[var(--ui-bg-3)] border-[var(--ui-border-soft)] text-[var(--ui-body)] hover:border-[var(--ui-border)]"
                        )}
                      >
                        <div>
                          <p className="font-bold">{course.name}</p>
                          <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">ID: {course.id.slice(0, 8)}</p>
                        </div>
                        {teacherToAssign.assignedCourseId === course.id && (
                          <CheckCircle2 size={18} className="text-[var(--ui-accent)]" />
                        )}
                      </button>
                    ))}
                    {courses.length === 0 && (
                      <p className="text-center py-4 text-[var(--ui-muted)] text-sm italic">No courses available. Create a course first.</p>
                    )}
                  </div>
                </div>

                <PrimaryButton variant="secondary" className="w-full py-3" onClick={() => setIsAssigningCourse(false)}>
                  Cancel
                </PrimaryButton>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Assign Teacher to Course Modal (from Courses Tab) */}
      <AnimatePresence>
        {isAssigningTeacherToCourse && courseToAssignTeacher && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssigningTeacherToCourse(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-md w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-[var(--ui-heading)]">Assign Teacher to {courseToAssignTeacher.name}</h3>
                  <button onClick={() => setIsAssigningTeacherToCourse(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-[var(--ui-muted)]">Select a teacher to lead this course:</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                    {teachers.map(teacher => (
                      <button
                        key={teacher.uid}
                        onClick={() => handleAssignTeacher(teacher.uid, courseToAssignTeacher.id)}
                        className={cn(
                          "w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between group",
                          courseToAssignTeacher.teacherId === teacher.uid
                            ? "bg-[rgba(var(--ui-accent-rgb)/0.15)] border-[var(--ui-accent)] text-[var(--ui-heading)]"
                            : "bg-white/5 border-[var(--ui-border-soft)] text-[var(--ui-body)] hover:border-[var(--ui-border)]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <img src={teacher.avatarUrl || `https://picsum.photos/seed/${teacher.uid}/100/100`} alt={teacher.name} className="size-10 rounded-lg object-cover" />
                          <div>
                            <p className="font-bold">{teacher.name}</p>
                            <p className="text-[10px] text-[var(--ui-muted)] uppercase font-bold">{teacher.email}</p>
                          </div>
                        </div>
                        {courseToAssignTeacher.teacherId === teacher.uid && (
                          <CheckCircle2 size={18} className="text-[var(--ui-accent)]" />
                        )}
                      </button>
                    ))}
                    {teachers.length === 0 && (
                      <p className="text-center py-4 text-[var(--ui-muted)] text-sm italic">No teachers available. Create a teacher account first.</p>
                    )}
                  </div>
                </div>

                <PrimaryButton variant="secondary" className="w-full py-3" onClick={() => setIsAssigningTeacherToCourse(false)}>
                  Cancel
                </PrimaryButton>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Module Management Modal */}
      <AnimatePresence>
        {isManagingModules && selectedCourseForModules && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingModules(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-2xl w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--ui-heading)]">Manage Modules</h3>
                    <p className="text-xs text-[var(--ui-muted)]">{selectedCourseForModules.name}</p>
                  </div>
                  <button onClick={() => setIsManagingModules(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Create Module Form */}
                  {isCreatingModule ? (
                    <GlassCard className="p-6 space-y-4 border-[#6324eb]/30">
                      <h4 className="text-sm font-bold text-[var(--ui-heading)] uppercase tracking-widest">New Module</h4>
                      <form onSubmit={handleCreateModule} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Module Name</label>
                            <input
                              type="text"
                              required
                              className="input-field py-2 text-sm"
                              placeholder="e.g. Introduction to Listening"
                              value={moduleName}
                              onChange={(e) => setModuleName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Order</label>
                            <input
                              type="number"
                              required
                              className="input-field py-2 text-sm"
                              value={moduleOrder}
                              onChange={(e) => setModuleOrder(Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Description</label>
                          <textarea
                            className="input-field py-2 text-sm min-h-[80px]"
                            placeholder="What will students learn in this module?"
                            value={moduleDescription}
                            onChange={(e) => setModuleDescription(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <PrimaryButton type="submit" className="flex-1 py-2 text-xs">Save Module</PrimaryButton>
                          <PrimaryButton variant="secondary" className="px-4 py-2 text-xs" onClick={() => setIsCreatingModule(false)}>Cancel</PrimaryButton>
                        </div>
                      </form>
                    </GlassCard>
                  ) : (
                    <button
                      onClick={() => { setIsCreatingModule(true); setModuleOrder(modules.length + 1); }}
                      className="w-full py-3 rounded-xl border border-dashed border-[var(--ui-border)] hover:border-[rgba(var(--ui-accent-rgb)/0.60)] hover:bg-[rgba(var(--ui-accent-rgb)/0.06)] transition-all text-[var(--ui-muted)] hover:text-[var(--ui-accent)] text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={18} /> Add New Module
                    </button>
                  )}

                  {/* Modules List */}
                  <div className="space-y-3">
                    {modules.map((mod) => (
                      <GlassCard key={mod.id} className="p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="size-8 rounded-lg bg-[#6324eb]/10 flex items-center justify-center text-[#6324eb] font-bold text-xs">
                            {mod.order}
                          </div>
                          <div>
                            <h5 className="text-[var(--ui-heading)] font-bold text-sm">{mod.name}</h5>
                            <p className="text-[10px] text-[var(--ui-muted)] line-clamp-1">{mod.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedModuleForLessons(mod); setIsManagingLessons(true); fetchLessons(selectedCourseForModules.id, mod.id); }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-[#3b82f6]/20 hover:text-[#3b82f6] transition-all"
                            title="Manage Lessons"
                          >
                            <PlayCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteModule(mod.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </GlassCard>
                    ))}
                    {modules.length === 0 && !isCreatingModule && (
                      <p className="text-center py-8 text-[var(--ui-muted)] italic text-sm">No modules found. Add your first module above.</p>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lesson Management Modal */}
      <AnimatePresence>
        {isManagingLessons && selectedModuleForLessons && selectedCourseForModules && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingLessons(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
            >
              <GlassCard className="max-w-3xl w-full p-8 space-y-6 pointer-events-auto bg-[var(--ui-bg-2)] border-[var(--ui-border)] shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setIsManagingLessons(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--ui-muted)]">
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <h3 className="text-xl font-bold text-[var(--ui-heading)]">Manage Lessons</h3>
                      <p className="text-xs text-[var(--ui-muted)]">{selectedCourseForModules.name} • {selectedModuleForLessons.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsManagingLessons(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                    <X size={20} className="text-[var(--ui-muted)]" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Create Lesson Form */}
                  {isCreatingLesson ? (
                    <GlassCard className="p-6 space-y-4 border-[#3b82f6]/30">
                      <h4 className="text-sm font-bold text-[var(--ui-heading)] uppercase tracking-widest">New Lesson</h4>
                      <form onSubmit={handleCreateLesson} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Lesson Title</label>
                            <input
                              type="text"
                              required
                              className="input-field py-2 text-sm"
                              placeholder="e.g. Understanding the Listening Format"
                              value={lessonTitle}
                              onChange={(e) => setLessonTitle(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Order</label>
                            <input
                              type="number"
                              required
                              className="input-field py-2 text-sm"
                              value={lessonOrder}
                              onChange={(e) => setLessonOrder(Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Video URL (Optional)</label>
                            <input
                              type="url"
                              className="input-field py-2 text-sm"
                              placeholder="https://youtube.com/..."
                              value={lessonVideoUrl}
                              onChange={(e) => setLessonVideoUrl(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">PDF URL (Optional)</label>
                            <input
                              type="url"
                              className="input-field py-2 text-sm"
                              placeholder="https://drive.google.com/..."
                              value={lessonPdfUrl}
                              onChange={(e) => setLessonPdfUrl(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Duration (Minutes)</label>
                            <input
                              type="number"
                              required
                              className="input-field py-2 text-sm"
                              value={lessonDuration}
                              onChange={(e) => setLessonDuration(Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Description</label>
                          <textarea
                            className="input-field py-2 text-sm min-h-[80px]"
                            placeholder="What is this lesson about?"
                            value={lessonDescription}
                            onChange={(e) => setLessonDescription(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <PrimaryButton type="submit" className="flex-1 py-2 text-xs">Save Lesson</PrimaryButton>
                          <PrimaryButton variant="secondary" className="px-4 py-2 text-xs" onClick={() => setIsCreatingLesson(false)}>Cancel</PrimaryButton>
                        </div>
                      </form>
                    </GlassCard>
                  ) : (
                    <button
                      onClick={() => { setIsCreatingLesson(true); setLessonOrder(lessons.length + 1); }}
                      className="w-full py-3 rounded-xl border border-dashed border-[var(--ui-border)] hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/5 transition-all text-[var(--ui-muted)] hover:text-[#3b82f6] text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={18} /> Add New Lesson
                    </button>
                  )}

                  {/* Lessons List */}
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <GlassCard key={lesson.id} className="p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="size-8 rounded-lg bg-[var(--ui-bg-3)] flex items-center justify-center text-[var(--ui-heading)] font-bold text-xs">
                            {lesson.order}
                          </div>
                          <div>
                            <h5 className="text-[var(--ui-heading)] font-bold text-sm">{lesson.title}</h5>
                            <div className="flex items-center gap-3 text-[10px] text-[var(--ui-muted)]">
                              <span className="flex items-center gap-1"><Clock size={10} /> {lesson.durationMinutes} mins</span>
                              {lesson.videoUrl && <span className="flex items-center gap-1 text-[#3b82f6]"><PlayCircle size={10} /> Video</span>}
                              {lesson.pdfUrl && <span className="flex items-center gap-1 text-emerald-500"><FileIcon size={10} /> PDF</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </GlassCard>
                    ))}
                    {lessons.length === 0 && !isCreatingLesson && (
                      <p className="text-center py-8 text-[var(--ui-muted)] italic text-sm">No lessons found. Add your first lesson above.</p>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
              initial={{ opacity: 0, scale: 0.9, x: '100%' }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[var(--ui-bg-2)] border-l border-[var(--ui-border)] z-[70] p-8 overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <img src={selectedStudent.avatarUrl || `https://picsum.photos/seed/${selectedStudent.uid}/100/100`} alt={selectedStudent.name} className="size-20 rounded-2xl object-cover border-2 border-[#6324eb]/30" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--ui-heading)]">{selectedStudent.name}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[var(--ui-muted)]">UID: {selectedStudent.uid.slice(0, 8)}...</p>
                      {selectedStudent.enrollment?.location && (
                        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                          <CheckCircle2 size={10} /> {selectedStudent.enrollment.location.city}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Eligibility Timeline */}
                {selectedStudent.enrollment?.registeredAt && (
                  <div className="bg-[var(--ui-bg-3)] border border-[var(--ui-border)] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[var(--ui-heading)] uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} className="text-amber-500" />
                        Exam Eligibility Timeline
                      </h4>
                      <StatusBadge
                        status={selectedStudent.trainingStatus.replace('_', ' ')}
                        variant={selectedStudent.trainingStatus === 'active' ? 'primary' : selectedStudent.trainingStatus === 'completed' ? 'success' : 'accent'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Registration Date</p>
                        <p className="text-[var(--ui-body)] text-sm font-medium">
                          {selectedStudent.enrollment.registeredAt?.toDate ? selectedStudent.enrollment.registeredAt.toDate().toLocaleDateString() : new Date(selectedStudent.enrollment.registeredAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Eligibility Date</p>
                        <p className="text-[var(--ui-body)] text-sm font-medium">
                          {selectedStudent.enrollment.eligibleAt ? new Date(selectedStudent.enrollment.eligibleAt).toLocaleDateString() : 'TBD'}
                        </p>
                      </div>
                    </div>

                    {/* Exam Fee Status */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Exam Fee Status</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={selectedStudent.enrollment.examFeeStatus || 'unpaid'} variant={selectedStudent.enrollment.examFeeStatus === 'paid' ? 'success' : selectedStudent.enrollment.examFeeStatus === 'pending' ? 'warning' : 'accent'} />
                        {(selectedStudent.enrollment.examFeeStatus === 'pending' || selectedStudent.enrollment.examFeeStatus === 'unpaid') && (
                          <button
                            onClick={async () => {
                              if (!selectedStudent.enrollment?.id) return;
                              try {
                                await updateDoc(doc(db, 'enrollments', selectedStudent.enrollment.id), { examFeeStatus: 'paid' });
                                // The local state will update via onSnapshot
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

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--ui-bg-3)] p-4 rounded-2xl border border-[var(--ui-border-soft)]">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Email Address</p>
                    <div className="flex items-center gap-2 text-[var(--ui-body)]">
                      <Mail size={14} className="text-[#6324eb]" />
                      <span className="text-sm truncate">{selectedStudent.email}</span>
                    </div>
                  </div>
                  <div className="bg-[var(--ui-bg-3)] p-4 rounded-2xl border border-[var(--ui-border-soft)]">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Phone Number</p>
                    <div className="flex items-center gap-2 text-[var(--ui-body)]">
                      <Phone size={14} className="text-[#6324eb]" />
                      <span className="text-sm">{selectedStudent.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Status Management */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-[var(--ui-heading)] flex items-center gap-2">
                    <AlertCircle size={20} className="text-[#6324eb]" />
                    Status Management
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 px-1">Training Status</label>
                      <select
                        className="input-field"
                        value={editTrainingStatus}
                        onChange={(e) => setEditTrainingStatus(e.target.value as TrainingStatus)}
                      >
                        <option value="locked">Locked</option>
                        <option value="inactive">Inactive</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 px-1">Exam Status</label>
                      <select
                        className="input-field"
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

                {/* Exam Scheduling (Conditional) */}
                {editExamStatus === 'pending_booking' && (
                  <div className="p-6 rounded-2xl bg-[#6324eb]/10 border border-[#6324eb]/20 space-y-4">
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <Calendar size={18} /> Schedule Exam
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Exam Date</label>
                        <input type="date" className="input-field py-2 text-sm [color-scheme:dark]" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Exam Time</label>
                        <input type="time" className="input-field py-2 text-sm [color-scheme:dark]" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">Exam Center</label>
                      <input type="text" className="input-field py-2 text-sm" placeholder="e.g. British Council - London" />
                    </div>
                    <PrimaryButton className="w-full py-3" onClick={() => setEditExamStatus('scheduled')}>
                      Confirm & Notify Student
                    </PrimaryButton>
                  </div>
                )}

                {/* Exam Result Details */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 size={20} className="text-emerald-400" />
                    Target & Current Scores
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-xs text-slate-500 uppercase font-bold">Target Band</p>
                      <input
                        type="number"
                        step="0.5"
                        className="input-field py-2"
                        value={editTargetScore}
                        onChange={(e) => setEditTargetScore(Number(e.target.value))}
                      />
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-xs text-slate-500 uppercase font-bold">Latest Score</p>
                      <input
                        type="number"
                        step="0.5"
                        className="input-field py-2"
                        value={editCurrentScore}
                        onChange={(e) => setEditCurrentScore(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {selectedStudent.studentData?.bandScore && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Overall Band Score</p>
                          <p className="text-4xl font-black text-emerald-400">{selectedStudent.studentData.bandScore.overall}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(selectedStudent.studentData.bandScore).filter(([k]) => k !== 'overall').map(([skill, score]) => (
                          <div key={skill} className="bg-white/5 p-3 rounded-xl text-center border border-white/5">
                            <p className="text-lg font-bold text-white">{score as number}</p>
                            <p className="text-[10px] text-slate-500 uppercase truncate">{skill}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Overview */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-[#6324eb]" />
                    Academic Progress
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl text-center">
                      <p className="text-2xl font-bold text-white">{editTargetScore}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Target</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center">
                      <p className="text-2xl font-bold text-emerald-400">{editCurrentScore || '-'}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Current Score</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <PrimaryButton className="flex-1 py-3" onClick={handleSaveChanges}>Save Changes</PrimaryButton>
                  <PrimaryButton variant="secondary" className="px-6 py-3" onClick={() => setSelectedStudent(null)}>Cancel</PrimaryButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper Components
const NavItem = ({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
      active ? "bg-[#6324eb] text-white shadow-lg shadow-[#6324eb]/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, trend, icon: Icon, color }: { label: string, value: string, trend: string, icon: any, color: string }) => (
  <GlassCard className="p-5 space-y-2">
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-lg bg-white/5", color)}>
        <Icon size={20} />
      </div>
      <span className="text-emerald-400 text-xs font-bold">{trend}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
    </div>
  </GlassCard>
);
