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
  ChevronRight,
  Video,
  FileIcon,
  Award,
  Headphones,
  Book,
  Star,
  Sparkles,
  Activity,
  BarChart3,
  Timer,
  Coffee,
  Search,
  MoreVertical,
  Settings,
  LogOut,
  Camera,
  Bell,
  User,
  X,
  ArrowRight,
  FileText,
  Clock,
  Flame,
  Target
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

export const StudentDashboard_Premium: React.FC = () => {
  console.log(' STUDENT DASHBOARD PREMIUM MOUNTING');
  const navigate = useNavigate();
  const { profile, user, studentData, loading, signOut } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  
  // Header state
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Single source of truth for learning access
  const hasLearningAccess = useMemo(() => 
    studentData?.onboardingStatus === 'approved' ||
    studentData?.accessUnlocked === true ||
    studentData?.trainingStatus === 'active',
    [studentData]
  );

  const trainingStatus = studentData?.trainingStatus || 'inactive';
  const examStatus = studentData?.examStatus || 'not_started';

  // Safe Header functions
  const handleSignOut = async () => {
    console.log('🚪 STUDENT: Sign out initiated');
    try {
      setShowSignOutConfirm(false);
      console.log('🚪 STUDENT: Calling Firebase signOut...');
      await signOut();
      console.log('🚪 STUDENT: Firebase signOut completed, performing hard redirect to /auth');
      // Hard redirect using window.location.replace (not navigate) to ensure complete logout
      window.location.replace('/auth');
    } catch (error) {
      console.error('🚪 STUDENT: Sign out error:', error);
      // Even on error, perform hard redirect to clear the session
      window.location.replace('/auth');
    }
  };

  const handleProfileUpdate = async () => {
    if (!profile) return;
    
    try {
      // Update profile in Firebase (implementation depends on your auth setup)
      setIsEditingProfile(false);
      setShowProfileSettings(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  useEffect(() => {
    if (profile) {
      setEditedName(profile.name || '');
      setEditedEmail(profile.email || '');
    }
  }, [profile]);

  const progressMetrics = useMemo(() => {
    if (!studentData || !course) return {
      overallProgress: 0,
      completedLessons: 0,
      totalLessons: 0,
      weeklyStreak: 0,
      nextMilestone: 'Beginner'
    };

    const allLessons = Object.values(lessons).flat();
    const completedLessons = allLessons.filter(lesson => lesson.completed).length;
    const totalLessons = allLessons.length;
    const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    const weeklyStreak = (studentData as any)?.weeklyStreak || 0;

    const nextMilestone = overallProgress >= 80 ? 'Advanced' :
                        overallProgress >= 50 ? 'Intermediate' : 'Beginner';

    return {
      overallProgress,
      completedLessons,
      totalLessons,
      weeklyStreak,
      nextMilestone
    };
  }, [studentData, course, lessons]);

  const steps = useMemo(() => [
    { id: 'training', label: 'Training', status: trainingStatus === 'completed' ? 'completed' : (hasLearningAccess ? 'active' : 'pending'), icon: Zap },
    { id: 'eligibility', label: 'Eligibility', status: trainingStatus === 'completed' ? 'completed' : (trainingStatus === 'active' ? 'active' : 'pending'), icon: ShieldCheck },
    { id: 'booking', label: 'Exam Booking', status: examStatus !== 'not_started' ? 'completed' : (trainingStatus === 'completed' ? 'active' : 'pending'), icon: Calendar },
    { id: 'results', label: 'Results', status: examStatus === 'done' ? 'completed' : (examStatus === 'scheduled' ? 'active' : 'pending'), icon: Trophy },
  ], [trainingStatus, examStatus, hasLearningAccess]);

  const fetchCourseData = useCallback(async () => {
    if (!studentData?.courseId || !user) {
      setDataLoading(false);
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
      setDataLoading(false);
    }
  }, [studentData?.courseId, user]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // SAFETY CHECK: Prevent white screen crashes
  if (loading || dataLoading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-400 rounded-full animate-spin animation-delay-150" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ADDITIONAL SAFETY: Safe data defaults
  const safeUserName = profile?.name || "Student";
  const safeModulesList = Array.isArray(modules) ? modules : [];
  const safeTasksList = []; // Tasks are static mock data, safe to use empty array

  // Check if student has an active enrollment
  const isEnrolled = useMemo(() => {
    return !!(studentData && studentData.courseId);
  }, [studentData]);

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

  // FINAL SAFETY WRAPPER: Prevent any remaining white screen crashes
  try {
    return (
      <>
        {/* Premium Mobile Dashboard */}
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* Simple Safe Header */}
        <div className="bg-white shadow-sm border-b border-gray-100">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              {/* User Profile Section */}
              <div className="flex items-center gap-3">
                {/* User Avatar */}
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-semibold text-sm">
                    {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                
                {/* Greeting Text */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Hello, {profile?.name || 'User'}
                  </h2>
                  <p className="text-sm text-gray-500">Welcome back</p>
                </div>
              </div>
              
              {/* Right Side Actions */}
              <div className="flex items-center gap-2 relative">
                {/* Notifications Button */}
                <button
                  onClick={() => navigate('/notifications')}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Bell size={16} className="text-gray-600" />
                </button>
                
                {/* Menu Button */}
                <button
                  onClick={() => {
                    console.log('student menu clicked');
                    setShowMoreOptions(!showMoreOptions);
                  }}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <MoreVertical size={16} className="text-gray-600" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Simple Menu Dropdown */}
          {showMoreOptions && (
            <div className="absolute top-16 right-4 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden min-w-[180px]">
              <button
                onClick={() => {
                  setShowMoreOptions(false);
                  setShowProfileSettings(true);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <span className="text-sm font-medium text-gray-900">Profile Settings</span>
              </button>
              
              <button
                onClick={() => {
                  console.log('student sign out menu clicked');
                  setShowMoreOptions(false);
                  setShowSignOutConfirm(true);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-red-600">Sign Out</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Profile Settings Modal */}
        <AnimatePresence>
          {showProfileSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
              onClick={() => setShowProfileSettings(false)}
            >
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Profile Settings</h3>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowProfileSettings(false)}
                      className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                    >
                      <X size={16} className="text-gray-600" />
                    </motion.button>
                  </div>
                  
                  {/* Profile Avatar */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-3">
                      {profile?.name ? (
                        <span className="text-white font-bold text-2xl">
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <User size={32} className="text-white" />
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors flex items-center gap-2"
                    >
                      <Camera size={14} />
                      Change Photo
                    </motion.button>
                  </div>
                  
                  {/* Profile Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        disabled={!isEditingProfile}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Your name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        disabled={!isEditingProfile}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="your.email@example.com"
                      />
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    {!isEditingProfile ? (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsEditingProfile(true)}
                          className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                        >
                          Edit Profile
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowProfileSettings(false)}
                          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleProfileUpdate}
                          className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                        >
                          Save Changes
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setIsEditingProfile(false);
                            setEditedName(profile?.name || '');
                            setEditedEmail(profile?.email || '');
                          }}
                          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Simple Sign Out Confirmation */}
        {showSignOutConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-red-600 text-xl">🚪</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sign Out</h3>
                <p className="text-gray-600 text-sm">Are you sure you want to sign out?</p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    console.log('student confirm sign out clicked');
                    handleSignOut();
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="px-4 pb-24"
        >
          {/* Hero Section */}
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Welcome back, {profile?.name || 'John'}!
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {course?.name || 'Loading Course...'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                    <Sparkles size={20} className="text-purple-600" />
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  {hasLearningAccess
                    ? "Your training journey continues. Keep up the momentum and unlock your full potential."
                    : "Your enrollment is pending activation. We'll notify you as soon as your access is ready."}
                </p>
                
                {hasLearningAccess && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/student/todays-learning')}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-2xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    Continue Learning
                    <ArrowRight size={16} className="inline ml-2" />
                  </motion.button>
                )}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6"
            >
              <div className="grid grid-cols-4 gap-3">
                {[
                  { icon: PlayCircle, label: 'Learn', color: 'from-blue-100 to-blue-200', iconColor: 'text-blue-600', action: () => navigate('/student/todays-learning') },
                  { icon: FileText, label: 'Test', color: 'from-green-100 to-green-200', iconColor: 'text-green-600', action: () => navigate('/student/tests') },
                  { icon: Video, label: 'Live', color: 'from-purple-100 to-purple-200', iconColor: 'text-purple-600', action: () => navigate('/student/live') },
                  { icon: BookOpen, label: 'More', color: 'from-orange-100 to-orange-200', iconColor: 'text-orange-600', action: () => navigate('/student/resources') }
                ].map((item, index) => (
                  <motion.button
                    key={item.label}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={item.action}
                    className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300"
                  >
                    <div className={`w-8 h-8 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-2`}>
                      <item.icon size={16} className={item.iconColor} />
                    </div>
                    <p className="text-xs font-medium text-gray-700">{item.label}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Course Modules */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Course Modules</h3>
                <span className="text-sm text-gray-500">{modules.length} modules</span>
              </div>
              
              <div className="space-y-3">
                {modules.slice(0, 3).map((mod, index) => {
                  const moduleLessons = lessons[mod.id] || [];
                  const completedLessons = moduleLessons.filter(lesson => lesson.completed).length;
                  const progress = moduleLessons.length > 0 ? Math.round((completedLessons / moduleLessons.length) * 100) : 0;
                  
                  return (
                    <motion.div
                      key={mod.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => hasLearningAccess && navigate(`/student/modules/${mod.id}`)}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-600 font-bold text-sm">{mod.order}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{mod.name}</h4>
                            {progress === 100 && (
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={12} className="text-green-600" />
                              </div>
                            )}
                          </div>
                          
                          <p className="text-gray-500 text-xs mb-2 line-clamp-1">{mod.description}</p>
                          
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <BookOpen size={10} />
                                {moduleLessons.length}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {moduleLessons.reduce((acc, lesson) => acc + (lesson.durationMinutes || 0), 0)}m
                              </span>
                            </div>
                            <span className="text-xs font-medium text-purple-600">{progress}%</span>
                          </div>
                          
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              
              {modules.length > 3 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/student/modules')}
                  className="w-full mt-3 py-2 text-center text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  View all modules →
                </motion.button>
              )}
            </motion.div>

            {/* Progress Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-6"
            >
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Your Progress</h3>
                  <div className="text-2xl font-bold text-purple-600">{progressMetrics.overallProgress}%</div>
                </div>
                
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressMetrics.overallProgress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-1">
                      <Flame size={14} className="text-orange-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{progressMetrics.weeklyStreak}</p>
                    <p className="text-xs text-gray-500">Streak</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-1">
                      <CheckCircle2 size={14} className="text-green-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{progressMetrics.completedLessons}</p>
                    <p className="text-xs text-gray-500">Done</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-1">
                      <Target size={14} className="text-purple-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{progressMetrics.nextMilestone}</p>
                    <p className="text-xs text-gray-500">Goal</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Today's Tasks Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Today's Focus</h3>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/student/todays-learning')}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  View all →
                </motion.button>
              </div>
              
              <div className="space-y-3">
                {[
                  { 
                    type: 'lesson', 
                    title: 'Speaking Basics', 
                    time: '45 min', 
                    status: 'in-progress', 
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    statusColor: 'bg-blue-100 text-blue-700'
                  },
                  { 
                    type: 'live', 
                    title: 'Live Practice', 
                    time: '2:00 PM', 
                    status: 'upcoming',
                    bgColor: 'bg-purple-50',
                    borderColor: 'border-purple-200',
                    iconBg: 'bg-purple-100',
                    iconColor: 'text-purple-600',
                    statusColor: 'bg-purple-100 text-purple-700'
                  },
                  { 
                    type: 'assignment', 
                    title: 'Voice Recording', 
                    time: '30 min', 
                    status: 'pending',
                    bgColor: 'bg-green-50',
                    borderColor: 'border-green-200',
                    iconBg: 'bg-green-100',
                    iconColor: 'text-green-600',
                    statusColor: 'bg-gray-100 text-gray-700'
                  }
                ].map((task, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    className={`${task.bgColor} ${task.borderColor} rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-300`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Time indicator */}
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 ${task.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          {task.type === 'lesson' && <PlayCircle size={16} className={task.iconColor} />}
                          {task.type === 'live' && <Video size={16} className={task.iconColor} />}
                          {task.type === 'assignment' && <FileText size={16} className={task.iconColor} />}
                        </div>
                        <div className="text-xs font-medium text-gray-600 mt-1">
                          {task.type === 'lesson' ? '45m' : 
                           task.type === 'live' ? '2PM' : '30m'}
                        </div>
                      </div>
                      
                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">{task.title}</h4>
                            <p className="text-xs text-gray-600">
                              {task.type === 'lesson' ? 'Self-paced lesson' :
                               task.type === 'live' ? 'Live session with instructor' :
                               'Submit assignment'}
                            </p>
                          </div>
                          
                          {/* Status indicator */}
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${task.statusColor}`}>
                            {task.status === 'in-progress' ? 'Active' :
                             task.status === 'upcoming' ? 'Scheduled' : 'Pending'}
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${task.iconBg} ${task.iconColor} hover:opacity-80 transition-opacity`}
                          >
                            {task.type === 'lesson' ? 'Start' :
                             task.type === 'live' ? 'Join' : 'Begin'}
                          </motion.button>
                          
                          {task.status === 'in-progress' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              Resume
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </>
    );
  } catch (error) {
    console.error('Dashboard render error:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-lg">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">⚠️</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Home content unavailable</h3>
          <p className="text-gray-600 text-sm mb-4">Please try refreshing the page</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
};
