import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import {
  Calendar,
  ClipboardCheck,
  TrendingUp,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Trophy,
  Clock,
  ChevronRight,
  FileIcon,
  Video,
  ArrowRight,
  Lock,
  X,
  FileText
} from 'lucide-react';
import { doc, collection, query, where, getDocs, getDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  courseId: string;
}

interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  pdfUrl?: string;
  order: number;
}

interface Module {
  id: string;
  name: string;
  description: string;
  order: number;
}

interface Course {
  id: string;
  name: string;
}

interface LiveSession {
  id: string;
  courseId: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string;
}

export const StudentDashboard: React.FC = () => {
  const { user, profile, studentData } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);

  // Single source of truth for learning access
  const hasLearningAccess = useMemo(() => 
    studentData?.onboardingStatus === 'approved' ||
    studentData?.accessUnlocked === true ||
    studentData?.trainingStatus === 'active',
    [studentData]
  );

  const trainingStatus = studentData?.trainingStatus || 'inactive';
  const examStatus = studentData?.examStatus || 'not_started';
  const isEnrolled = !!studentData?.courseId;

  const steps = useMemo(() => [
    { id: 'training', label: 'Training', status: trainingStatus === 'completed' ? 'completed' : (hasLearningAccess ? 'active' : 'pending'), icon: Zap },
    { id: 'eligibility', label: 'Eligibility', status: trainingStatus === 'completed' ? 'completed' : (trainingStatus === 'active' ? 'active' : 'pending'), icon: ShieldCheck },
    { id: 'booking', label: 'Exam Booking', status: examStatus !== 'not_started' ? 'completed' : (trainingStatus === 'completed' ? 'active' : 'pending'), icon: Calendar },
    { id: 'results', label: 'Results', status: examStatus === 'done' ? 'completed' : (examStatus === 'scheduled' ? 'active' : 'pending'), icon: Trophy },
  ], [trainingStatus, examStatus, hasLearningAccess]);

  const fetchCourseData = useCallback(async () => {
    if (!studentData?.courseId || !user) {
      setLoading(false);
      return;
    }

    try {
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

      // Fetch Assignments
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('courseId', '==', studentData.courseId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      setAssignments(assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));

      // Fetch Live Sessions
      const liveSessionsQuery = query(
        collection(db, 'liveSessions'),
        where('courseId', '==', studentData.courseId),
        where('startTime', '>', new Date().toISOString())
      );
      const liveSessionsSnapshot = await getDocs(liveSessionsQuery);
      setLiveSessions(liveSessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveSession)));

    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  }, [studentData?.courseId, user]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#5B3DF5]/30 border-t-[#5B3DF5] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isEnrolled && profile?.role === 'student') {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-[#F59E0B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen size={40} className="text-[#F59E0B]" />
          </div>
          <h2 className="text-2xl font-bold text-[#111827] mb-4">No Active Enrollment</h2>
          <p className="text-[#6B7280] mb-6">You haven't enrolled in any course yet. Please contact administration or choose a course from the enrollment page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* TEMPORARY DEBUG PROOF */}
      <div className="fixed top-4 left-4 bg-red-500 text-white p-4 rounded-lg text-xs z-40">
        DESTINATION PAGE: StudentDashboard (/courses)
      </div>
      
      {/* Premium Apple-style Dashboard */}
      <div className="min-h-screen bg-[#F8F9FB] pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          {/* Welcome Card */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB] mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#111827] mb-2">
                  Welcome back, {profile?.name || 'John'}!
                </h1>
                <div className="flex items-center gap-2 text-[#5B3DF5] font-medium mb-4">
                  <BookOpen size={20} />
                  <span className="text-lg">{course?.name || 'Loading Course...'}</span>
                </div>
                <p className="text-[#6B7280] text-lg leading-relaxed mb-6 max-w-2xl">
                  {hasLearningAccess
                    ? "Your training is currently active. Keep up the great work and complete your daily modules."
                    : "Your enrollment is pending activation. Please wait for admin approval to unlock all modules."}
                </p>
                {hasLearningAccess && (
                  <button className="bg-[#5B3DF5] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#4B2FE5] transition-all duration-200 transform hover:scale-105 shadow-lg">
                    Continue Learning
                    <ArrowRight size={16} className="inline ml-2" />
                  </button>
                )}
              </div>
              <div className="hidden lg:block">
                <div className="w-32 h-32 bg-[#5B3DF5]/10 rounded-2xl flex items-center justify-center">
                  <BookOpen size={48} className="text-[#5B3DF5]" />
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Course Modules */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#111827] mb-2">Course Modules</h2>
                <p className="text-[#6B7280]">Track your progress through each module</p>
              </div>
              
              <div className="space-y-3">
                {modules.map((mod, index) => (
                  <motion.div
                    key={mod.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB] cursor-pointer transition-all duration-200 hover:shadow-md"
                    onClick={() => hasLearningAccess && setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#5B3DF5]/10 rounded-full flex items-center justify-center">
                          <span className="text-[#5B3DF5] font-bold text-lg">{mod.order}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#111827] text-lg">{mod.name}</h3>
                          <p className="text-[#6B7280] text-sm">{mod.description}</p>
                        </div>
                      </div>
                      {hasLearningAccess ? (
                        <ChevronRight size={20} className="text-[#6B7280]" />
                      ) : (
                        <Lock size={20} className="text-[#6B7280]" />
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {expandedModule === mod.id && hasLearningAccess && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-[#E5E7EB]"
                        >
                          <div className="space-y-3">
                            {lessons[mod.id]?.map((lesson) => (
                              <div key={lesson.id} className="flex items-center justify-between p-3 bg-[#F8F9FB] rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-[#5B3DF5]/10 rounded-full flex items-center justify-center">
                                    <span className="text-[#5B3DF5] text-xs font-bold">{lesson.order}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-[#111827] text-sm">{lesson.title}</p>
                                    <p className="text-[#6B7280] text-xs">{lesson.durationMinutes} mins</p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className="text-[#6B7280]" />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column - Progress & Journey */}
            <div className="space-y-8">
              {/* Progress Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Your Progress</h3>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-bold text-[#5B3DF5]">{hasLearningAccess ? '35%' : '0%'}</span>
                    <TrendingUp size={24} className="text-[#5B3DF5]" />
                  </div>
                  <div className="w-full bg-[#E5E7EB] rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: hasLearningAccess ? '35%' : '0%' }}
                      className="bg-[#5B3DF5] h-2 rounded-full"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#111827]">12</p>
                    <p className="text-sm text-[#6B7280]">Lessons</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#111827]">2</p>
                    <p className="text-sm text-[#6B7280]">Modules</p>
                  </div>
                </div>
              </div>

              {/* Journey Map */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
                <h3 className="text-xl font-bold text-[#111827] mb-6">Your Journey</h3>
                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'active';
                    return (
                      <div key={step.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted ? 'bg-[#10B981]' : isCurrent ? 'bg-[#5B3DF5]' : 'bg-[#E5E7EB]'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 size={16} className="text-white" />
                          ) : (
                            <step.icon size={16} className={isCurrent ? 'text-white' : 'text-[#6B7280]'} />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${
                            isCurrent ? 'text-[#111827]' : 'text-[#6B7280]'
                          }`}>{step.label}</p>
                          <p className="text-sm text-[#6B7280]">
                            {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Locked'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
