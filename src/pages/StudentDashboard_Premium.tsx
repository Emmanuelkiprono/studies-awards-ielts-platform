import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import '../styles/premium.css';
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
  FileText,
  Flame,
  Target,
  Award,
  Users,
  Headphones,
  Book,
  Star,
  Sparkles,
  Activity,
  BarChart3,
  Timer,
  Coffee
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
  completed?: boolean;
}

interface Module {
  id: string;
  name: string;
  description: string;
  order: number;
  lessons?: Lesson[];
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

  // Calculate progress metrics
  const progressMetrics = useMemo(() => {
    const totalLessons = Object.values(lessons).flat().length;
    const completedLessons = Object.values(lessons).flat().filter(lesson => lesson.completed).length;
    const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const weeklyStreak = studentData?.weeklyStreak || 0;
    const nextMilestone = overallProgress < 25 ? '25%' : overallProgress < 50 ? '50%' : overallProgress < 75 ? '75%' : '100%';
    
    return {
      overallProgress,
      weeklyStreak,
      completedLessons,
      totalLessons,
      nextMilestone
    };
  }, [lessons, studentData]);

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-150" />
        </div>
      </div>
    );
  }

  if (!isEnrolled && profile?.role === 'student') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full text-center border border-white/20 shadow-2xl"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <BookOpen size={48} className="text-amber-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">No Active Enrollment</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-8">You haven't enrolled in any course yet. Please contact administration or choose a course from the enrollment page.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Premium iOS 26-inspired Dashboard */}
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          {/* Premium Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative mb-12"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-10 blur-3xl" />
            
            <div className="relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 lg:p-12 border border-white/20 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Active Learning
                    </div>
                  </div>
                  
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Welcome back, {profile?.name || 'John'}!
                  </h1>
                  
                  <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-6">
                    <BookOpen size={20} />
                    <span className="text-xl">{course?.name || 'Loading Course...'}</span>
                  </div>
                  
                  <p className="text-gray-600 text-lg leading-relaxed mb-8 max-w-2xl">
                    {hasLearningAccess
                      ? "Your training journey continues. Keep up the momentum and unlock your full potential."
                      : "Your enrollment is pending activation. We'll notify you as soon as your access is ready."}
                  </p>
                  
                  {hasLearningAccess && (
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/student/lessons')}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-xl hover:shadow-2xl"
                    >
                      Continue Learning
                      <ArrowRight size={20} className="inline ml-2" />
                    </motion.button>
                  )}
                </div>
                
                <div className="hidden lg:block">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-40 h-40 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center shadow-xl"
                  >
                    <BookOpen size={64} className="text-indigo-600" />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12"
          >
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: PlayCircle, label: 'Continue Learning', color: 'from-blue-500 to-indigo-600', action: () => navigate('/student/lessons') },
                  { icon: FileText, label: 'Practice Test', color: 'from-green-500 to-emerald-600', action: () => navigate('/student/tests') },
                  { icon: Video, label: 'Live Class', color: 'from-purple-500 to-pink-600', action: () => navigate('/student/live') },
                  { icon: BookOpen, label: 'Resources', color: 'from-orange-500 to-red-600', action: () => navigate('/student/resources') }
                ].map((item, index) => (
                  <motion.button
                    key={item.label}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={item.action}
                    className="relative group"
                  >
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-300">
                      <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                        <item.icon size={24} className="text-white" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Course Modules */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-8"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Course Modules</h2>
                <p className="text-gray-600 text-lg">Track your progress through each module</p>
              </motion.div>
              
              <div className="space-y-4">
                {modules.map((mod, index) => {
                  const moduleLessons = lessons[mod.id] || [];
                  const completedLessons = moduleLessons.filter(lesson => lesson.completed).length;
                  const progress = moduleLessons.length > 0 ? Math.round((completedLessons / moduleLessons.length) * 100) : 0;
                  const isExpanded = expandedModule === mod.id;
                  
                  return (
                    <motion.div
                      key={mod.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      className="relative group"
                    >
                      {/* Glass morphism card */}
                      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                        <div
                          className="p-6 cursor-pointer"
                          onClick={() => hasLearningAccess && setExpandedModule(isExpanded ? null : mod.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* Module number with gradient */}
                              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">{mod.order}</span>
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-bold text-gray-900 text-xl">{mod.name}</h3>
                                  {progress === 100 && (
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                      <CheckCircle2 size={16} className="text-green-600" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-gray-600 mb-3">{mod.description}</p>
                                
                                {/* Progress bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full"
                                  />
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <BookOpen size={14} />
                                    {moduleLessons.length} lessons
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {moduleLessons.reduce((acc, lesson) => acc + (lesson.durationMinutes || 0), 0)} min
                                  </span>
                                  <span className="font-medium text-indigo-600">{progress}% complete</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {hasLearningAccess ? (
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <ChevronRight size={24} className="text-gray-400" />
                                </motion.div>
                              ) : (
                                <Lock size={20} className="text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded lessons */}
                        <AnimatePresence>
                          {isExpanded && hasLearningAccess && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-gray-200"
                            >
                              <div className="p-6 space-y-3">
                                {moduleLessons.map((lesson, lessonIndex) => (
                                  <motion.div
                                    key={lesson.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: lessonIndex * 0.05 }}
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                                  >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                      lesson.completed 
                                        ? 'bg-green-100' 
                                        : 'bg-gray-200'
                                    }`}>
                                      {lesson.completed ? (
                                        <CheckCircle2 size={16} className="text-green-600" />
                                      ) : (
                                        <PlayCircle size={16} className="text-gray-500" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900">{lesson.title}</p>
                                      <p className="text-sm text-gray-500">{lesson.durationMinutes} minutes</p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Progress & Journey */}
            <div className="space-y-8">
              {/* Progress Overview */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Your Progress</h3>
                  
                  {/* Circular progress */}
                  <div className="flex justify-center mb-6">
                    <div className="relative w-32 h-32">
                      <svg className="transform -rotate-90 w-32 h-32">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          className="text-gray-200"
                        />
                        <motion.circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="url(#gradient)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressMetrics.overallProgress / 100)}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - progressMetrics.overallProgress / 100) }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-gray-900">{progressMetrics.overallProgress}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="text-orange-500" size={20} />
                        <span className="text-gray-600">Weekly Streak</span>
                      </div>
                      <span className="font-bold text-gray-900">{progressMetrics.weeklyStreak} days</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-green-500" size={20} />
                        <span className="text-gray-600">Lessons Completed</span>
                      </div>
                      <span className="font-bold text-gray-900">{progressMetrics.completedLessons}/{progressMetrics.totalLessons}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="text-indigo-500" size={20} />
                        <span className="text-gray-600">Next Milestone</span>
                      </div>
                      <span className="font-bold text-indigo-600">{progressMetrics.nextMilestone}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Learning Journey Timeline */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Learning Journey</h3>
                  
                  <div className="space-y-6">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isCompleted = step.status === 'completed';
                      const isActive = step.status === 'active';
                      const isPending = step.status === 'pending';
                      
                      return (
                        <div key={step.id} className="flex items-start gap-4 relative">
                          {/* Timeline line */}
                          {index < steps.length - 1 && (
                            <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-200" />
                          )}
                          
                          {/* Status icon */}
                          <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-green-100 shadow-lg' 
                              : isActive 
                              ? 'bg-indigo-100 shadow-lg ring-4 ring-indigo-100' 
                              : 'bg-gray-100'
                          }`}>
                            <Icon 
                              size={20} 
                              className={
                                isCompleted 
                                  ? 'text-green-600' 
                                  : isActive 
                                  ? 'text-indigo-600' 
                                  : 'text-gray-400'
                              } 
                            />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 pt-2">
                            <h4 className={`font-semibold transition-colors duration-300 ${
                              isCompleted 
                                ? 'text-green-600' 
                                : isActive 
                                ? 'text-indigo-600' 
                                : 'text-gray-500'
                            }`}>
                              {step.label}
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {isCompleted 
                                ? 'Completed' 
                                : isActive 
                                ? 'In Progress' 
                                : 'Pending'
                              }
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};
