import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  User,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Upload,
  FileText as FileTextIcon,
  Calendar,
  DollarSign,
  Building,
  Smartphone,
  Users,
  BookOpen,
  UserCheck,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { OnboardingStatus, PaymentInfo, RejectionInfo } from '../types';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

interface StatusStep {
  id: OnboardingStatus;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  current: boolean;
  action?: {
    label: string;
    href: string;
  };
}

export const StudentOnboardingDashboard: React.FC = () => {
  console.log(' /DASHBOARD PAGE MOUNTING - StudentOnboardingDashboard');
  const { profile, user, studentData, loading, loadingStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { 
    enrollmentCompleted?: boolean; 
    newStatus?: string; 
    timestamp?: number;
    reason?: string;
    message?: string;
    paymentCompleted?: boolean;
  };
  const [currentStatus, setCurrentStatus] = useState<OnboardingStatus>('account_created');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [rejectionInfo, setRejectionInfo] = useState<RejectionInfo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Single source of truth for access
  const hasAccess = studentData?.onboardingStatus === 'approved' ||
    studentData?.accessUnlocked === true ||
    studentData?.trainingStatus === 'active';

  useEffect(() => {
    if (studentData) {
      // Handle existing students who don't have onboardingStatus yet
      const status = studentData.onboardingStatus || 'account_created';
      setCurrentStatus(status);
      setPaymentInfo(studentData.paymentInfo || null);
      setRejectionInfo(studentData.rejectionInfo || null);
    }
  }, [studentData, state]);

  const getStatusSteps = (): StatusStep[] => {
    const steps: StatusStep[] = [
      {
        id: 'account_created',
        title: 'Account Created',
        description: 'Your account has been successfully created',
        icon: User,
        completed: true,
        current: currentStatus === 'account_created'
      },
      {
        id: 'enrollment_pending',
        title: 'Complete Enrollment',
        description: 'Fill out the Breemic International enrollment form',
        icon: FileText,
        completed: ['payment_pending', 'approval_pending', 'approved', 'suspended'].includes(currentStatus),
        current: currentStatus === 'enrollment_pending',
        action: currentStatus === 'enrollment_pending' ? {
          label: 'Complete Enrollment Form',
          href: '/breemic-enrollment'
        } : undefined
      },
      {
        id: 'payment_pending',
        title: 'Payment Required',
        description: 'Complete payment for your course enrollment',
        icon: CreditCard,
        completed: ['approval_pending', 'approved', 'suspended'].includes(currentStatus),
        current: currentStatus === 'payment_pending',
        action: hasAccess ? {
          label: 'Go to Dashboard',
          href: '/courses'
        } : currentStatus === 'payment_pending' ? {
          label: 'Complete Payment',
          href: '/payment'
        } : undefined
      },
      {
        id: 'approval_pending',
        title: 'Approval Pending',
        description: 'Your enrollment is being reviewed by our team',
        icon: Clock,
        completed: hasAccess || currentStatus === 'suspended',
        current: currentStatus === 'approval_pending' && !hasAccess
      },
      {
        id: 'approved',
        title: 'Approved',
        description: 'Your enrollment has been approved! You can now access courses.',
        icon: CheckCircle2,
        completed: hasAccess,
        current: hasAccess,
        action: hasAccess ? {
          label: 'Go to Dashboard',
          href: '/courses'
        } : undefined
      }
    ];

    // Add rejected step if applicable
    if (currentStatus === 'rejected') {
      steps.splice(4, 0, {
        id: 'rejected',
        title: 'Enrollment Rejected',
        description: 'Your enrollment was rejected. Please review the feedback.',
        icon: XCircle,
        completed: false,
        current: true,
        action: rejectionInfo?.canResubmit ? {
          label: 'Resubmit Enrollment',
          href: '/breemic-enrollment'
        } : undefined
      });
    }

    // Add suspended step if applicable
    if (currentStatus === 'suspended') {
      steps.splice(5, 0, {
        id: 'suspended',
        title: 'Account Suspended',
        description: 'Your account has been temporarily suspended',
        icon: AlertCircle,
        completed: false,
        current: true
      });
    }

    return steps;
  };

  const getStatusColor = (status: OnboardingStatus) => {
    switch (status) {
      case 'account_created':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'enrollment_pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'payment_pending':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'approval_pending':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'suspended':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: OnboardingStatus) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'rejected':
        return <XCircle className="w-5 h-5" />;
      case 'suspended':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  // SAFETY CHECK: Prevent white screen crashes
  if (loading || loadingStatus || !profile) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  // REAL DASHBOARD CONTENT - SAFE VERSION
  console.log('🔍 RENDERING REAL DASHBOARD CONTENT');
  
  // Safe data defaults
  const safeUserName = profile?.name || user?.user_metadata?.full_name || "Student";

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
                    Hello, {safeUserName}
                  </h2>
                  <p className="text-sm text-gray-500">Welcome back</p>
                </div>
              </div>
              
              {/* Right Side Actions */}
              <div className="flex items-center gap-2">
                {/* Search Button */}
                <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  🔍
                </button>
                
                {/* Menu Button */}
                <button className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  ⋯
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 pb-24">
          {/* Hero Section */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Today's Learning
                </h2>
                <p className="text-gray-500 text-sm">
                  Pick up where you left off and complete today's tasks.
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                <span className="text-purple-600 text-xl">📚</span>
              </div>
            </div>
            
            {/* Primary CTA */}
            <button 
              onClick={() => navigate('/student/todays-learning')}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg mb-3"
            >
              Continue Learning
            </button>
            
            {/* Secondary CTA */}
            <button 
              onClick={() => navigate('/student/modules')}
              className="w-full bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-2xl hover:bg-gray-200 transition-colors"
            >
              Practice
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <button className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md">
              <span className="text-blue-600 text-lg">▶️</span>
              <p className="text-xs font-medium text-gray-700 mt-1">Learn</p>
            </button>
            <button className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md">
              <span className="text-green-600 text-lg">📝</span>
              <p className="text-xs font-medium text-gray-700 mt-1">Practice</p>
            </button>
            <button className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md">
              <span className="text-purple-600 text-lg">📊</span>
              <p className="text-xs font-medium text-gray-700 mt-1">Progress</p>
            </button>
            <button className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md">
              <span className="text-orange-600 text-lg">🎯</span>
              <p className="text-xs font-medium text-gray-700 mt-1">Goals</p>
            </button>
          </div>

          
          {/* Today's Tasks */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Tasks</h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-600">📖</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Speaking Basics</p>
                      <p className="text-xs text-gray-500">45 min</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">In Progress</span>
                </div>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-purple-600">🎥</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Live Practice</p>
                      <p className="text-xs text-gray-500">2:00 PM</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Upcoming</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modules Section */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Modules</h3>
            <div className="space-y-3">
              {/* Sample module data with safe fallbacks */}
              {[
                { title: 'Listening', lessonsCompleted: 3, assignments: 1, progress: 75 },
                { title: 'Reading', lessonsCompleted: 2, assignments: 1, progress: 50 },
                { title: 'Writing', lessonsCompleted: 1, assignments: 2, progress: 25 },
                { title: 'Speaking', lessonsCompleted: 4, assignments: 1, progress: 100 }
              ].map((module, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">{module.title.charAt(0)}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{module.title}</h4>
                        <p className="text-gray-500 text-xs">
                          {module.lessonsCompleted} lesson{module.lessonsCompleted !== 1 ? 's' : ''} completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-gray-600">{module.progress}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                        <div 
                          className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${module.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {module.assignments} assignment{module.assignments !== 1 ? 's' : ''}
                    </span>
                    <button 
                      onClick={() => navigate(`/student/modules?module=${module.title.toLowerCase()}`)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // FINAL SAFETY WRAPPER: Prevent any remaining white screen crashes
  try {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900"
      >
      
      {/* Subtle ambient gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-slate-500/10 dark:from-blue-900/5 dark:via-purple-900/5 dark:to-slate-900/10 pointer-events-none" />
      
      <div className="relative z-10">
        
        {/* Header */}
        <div className="text-center pt-12 pb-8 px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-2xl border border-blue-500/20 dark:border-white/5 backdrop-blur-sm mb-6"
          >
            <UserCheck className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-4xl font-light text-slate-900 dark:text-white mb-3 tracking-tight"
          >
            Welcome to Breemic International
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Complete your enrollment steps to unlock course access and begin your learning journey.
          </motion.p>
        </div>
        
        {/* Access Control Message */}
        {!hasAccess && state?.reason === 'approval_required' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto px-6 mb-6"
          >
            <div className="bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20 backdrop-blur-sm rounded-3xl p-6 border border-orange-300 dark:border-orange-500/30">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    Access Locked
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 mb-4">
                    {state.message || 'Your course access will unlock after approval.'}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Current Status: <strong className="text-slate-900 dark:text-white">{currentStatus}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Success Message for Enrollment Completion */}
        {state?.enrollmentCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mx-auto max-w-md"
          >
            <div className="flex items-center gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Enrollment form submitted successfully!</span>
            </div>
          </motion.div>
        )}

        {/* Success Message for Payment Completion */}
        {state?.paymentCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mx-auto max-w-md"
          >
            <div className="flex items-center gap-3 text-purple-400">
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">Payment submitted successfully!</span>
            </div>
          </motion.div>
        )}

              </div>
        
        {/* Premium Hero Card - Next Step */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-2xl mx-auto px-6 mb-12"
        >
          <div className="bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-white/10 shadow-2xl shadow-slate-200/20 dark:shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">Current Step</span>
            </div>
            
            <div className="mb-6">
              <h2 className="text-2xl font-light text-slate-900 dark:text-white mb-2">
                {currentStatus === 'account_created' && 'Complete Enrollment Form'}
                {currentStatus === 'payment_pending' && 'Complete Enrollment or Await Review'}
                {currentStatus === 'approval_pending' && 'Waiting for Approval'}
                {currentStatus === 'approved' && 'Start Learning'}
                {currentStatus === 'rejected' && 'Resubmit Enrollment'}
                {currentStatus === 'suspended' && 'Contact Support'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {currentStatus === 'account_created' && 'Fill out your enrollment details to begin your IELTS preparation journey.'}
                {currentStatus === 'payment_pending' && 'You can complete enrollment details or wait for admin review. Payment can be completed later.'}
                {currentStatus === 'approval_pending' && 'Your enrollment is under review. We\'ll notify you once approved.'}
                {currentStatus === 'approved' && 'Congratulations! You now have full access to your course materials.'}
                {currentStatus === 'rejected' && 'Please update your information and resubmit your enrollment.'}
                {currentStatus === 'suspended' && 'Your account has been suspended. Please contact our support team.'}
              </p>
            </div>
            
            {/* Premium CTA Button */}
            {currentStatus === 'account_created' && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActionLoading('enrollment');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'enrollment'}
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'enrollment' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Enrollment Form
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            )}
            
            {currentStatus === 'payment_pending' && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActionLoading('enrollment');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'enrollment'}
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'enrollment' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Enrollment Details
                    <FileText className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            )}
            
            {currentStatus === 'approval_pending' && !hasAccess && (
              <div className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-800/50 text-slate-400 font-medium rounded-2xl border border-slate-700">
                <Clock className="w-5 h-5" />
                Waiting for Approval
              </div>
            )}
            
            {hasAccess && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActionLoading('learning');
                  navigate('/courses');
                }}
                disabled={actionLoading === 'learning'}
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'learning' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Start Learning
                    <BookOpen className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            )}
            
            {currentStatus === 'rejected' && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActionLoading('resubmit');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'resubmit'}
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'resubmit' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Resubmit Enrollment
                    <RefreshCw className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            )}
            
            {currentStatus === 'suspended' && (
              <div className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-800/50 text-slate-400 font-medium rounded-2xl border border-slate-700">
                <AlertCircle className="w-5 h-5" />
                Contact Support
              </div>
            )}
          </div>
        </motion.div>
        
      {/* Premium Progress Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="max-w-4xl mx-auto px-6"
        >
          <div className="relative">
            {/* Progress Line Background */}
            <div className="absolute top-8 left-8 right-8 h-px bg-slate-300 dark:bg-slate-800" />
            
            {/* Progress Line Fill */}
            <div 
              className="absolute top-8 left-8 h-px bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700 ease-out"
              style={{ 
                width: `${(['account_created', 'enrollment_pending', 'payment_pending', 'approval_pending', 'approved'].indexOf(currentStatus) / 4) * 100}%` 
              }}
            />
            
            {/* Step Indicators */}
            <div className="flex items-center justify-between relative">
              {[
                { id: 'account_created', label: 'Account', icon: User },
                { id: 'enrollment_pending', label: 'Enrollment', icon: FileText },
                { id: 'payment_pending', label: 'Payment', icon: CreditCard },
                { id: 'approval_pending', label: 'Approval', icon: Clock },
                { id: 'approved', label: 'Access', icon: BookOpen }
              ].map((step, index) => {
                const isCompleted = ['account_created', 'enrollment_pending', 'payment_pending', 'approval_pending', 'approved'].indexOf(currentStatus) >= index;
                const isCurrent = step.id === currentStatus || 
                  (currentStatus === 'enrollment_pending' && step.id === 'enrollment_pending') ||
                  (currentStatus === 'payment_pending' && step.id === 'payment_pending') ||
                  (currentStatus === 'approval_pending' && step.id === 'approval_pending') ||
                  (currentStatus === 'approved' && step.id === 'approved');
                
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="relative">
                      {/* Step Circle */}
                      <motion.div
                        whileHover={{ scale: isCurrent ? 1.1 : 1 }}
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 backdrop-blur-sm border",
                          isCompleted 
                            ? "bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400" 
                            : isCurrent 
                              ? "bg-white/20 dark:bg-white/10 border-blue-400 text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-500/20" 
                              : "bg-slate-200/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-500"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-7 h-7" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}
                      </motion.div>
                      
                      {/* Current Step Indicator */}
                      {isCurrent && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full"
                        />
                      )}
                    </div>
                    
                    <span className={cn(
                      "text-xs font-medium mt-3 transition-colors duration-300",
                      isCompleted ? "text-blue-600 dark:text-blue-400" : isCurrent ? "text-slate-900 dark:text-white font-semibold" : "text-slate-500 dark:text-slate-600"
                    )}>
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Premium Step Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="max-w-4xl mx-auto px-6 pb-12"
        >
          <div className="grid gap-4">
            {statusSteps.map((step, index) => {
              if (step.id === 'rejected' || step.id === 'suspended') return null;
              
              const isClickable = step.action && (step.current || (step.id === 'approved' && hasAccess));
              const isCompleted = step.completed;
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                  whileHover={isClickable ? { y: -2, x: 4 } : {}}
                  className={cn(
                    "bg-white/80 dark:bg-white/3 backdrop-blur-md rounded-2xl p-5 border transition-all duration-300",
                    isCompleted 
                      ? "border-green-500/30 dark:border-green-500/20 bg-green-50 dark:bg-green-500/5" 
                      : isClickable
                        ? "border-blue-500/40 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/8 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20"
                        : "border-slate-300/50 dark:border-slate-700/30 bg-slate-50 dark:bg-slate-800/20"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Compact Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
                      isCompleted 
                        ? "bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-500/20" 
                        : isClickable
                          ? "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/20"
                          : "bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-500 border border-slate-300 dark:border-slate-600/30"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <step.icon className="w-6 h-6" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">{step.title}</h3>
                          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{step.description}</p>
                        </div>
                        
                        {/* Status Badge */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium rounded-full border border-green-300 dark:border-green-500/30">
                              Completed
                            </div>
                          ) : isClickable ? (
                            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full border border-blue-300 dark:border-blue-500/30">
                              Current
                            </div>
                          ) : (
                            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700/30 text-slate-600 dark:text-slate-500 text-xs font-medium rounded-full border border-slate-300 dark:border-slate-600/30">
                              Upcoming
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Area */}
                      <div className="mt-4">
                        {isClickable && step.action && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(step.action!.href)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 dark:shadow-blue-500/30 dark:hover:shadow-blue-500/40"
                          >
                            {actionLoading && (step.id === 'enrollment_pending' && actionLoading === 'enrollment' ||
                                               step.id === 'payment_pending' && actionLoading === 'payment' ||
                                               step.id === 'approved' && actionLoading === 'dashboard') ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                {step.action.label}
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </motion.button>
                        )}
                        
                        {!isClickable && !isCompleted && (
                          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-500 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700/50">
                            <Lock className="w-4 h-4" />
                            {step.id === 'enrollment_pending' && 'Complete Previous Steps'}
                            {step.id === 'payment_pending' && 'Complete Enrollment First'}
                            {step.id === 'approval_pending' && 'Submit Payment First'}
                            {step.id === 'approved' && 'Complete Previous Steps'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

      {/* Success State */}
      {currentStatus === 'approved' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-500/20 dark:to-emerald-500/20 backdrop-blur-sm rounded-3xl p-8 border border-green-300 dark:border-green-500/30">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-light text-slate-900 dark:text-white mb-3">
              🎉 Congratulations!
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-6 max-w-md mx-auto">
              Your enrollment has been approved. You now have full access to all courses and materials.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-[1.05]"
            >
              Go to My Course
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
    );
  } catch (error) {
    console.error('Onboarding Dashboard render error:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
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
