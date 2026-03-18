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
  const { user, profile, studentData, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;
  const [currentStatus, setCurrentStatus] = useState<OnboardingStatus>('account_created');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [rejectionInfo, setRejectionInfo] = useState<RejectionInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (studentData) {
      // Handle existing students who don't have onboardingStatus yet
      const status = studentData.onboardingStatus || 'account_created';
      setCurrentStatus(status);
      setPaymentInfo(studentData.paymentInfo || null);
      setRejectionInfo(studentData.rejectionInfo || null);
      
      console.log('Student data loaded:', {
        uid: studentData.uid,
        onboardingStatus: studentData.onboardingStatus,
        currentStatus: status,
        paymentInfo: studentData.paymentInfo
      });
    }

    // Handle enrollment completion redirect
    if (state?.enrollmentCompleted) {
      console.log('Enrollment just completed, new status:', state.newStatus);
      
      // Force a refresh of student data after a short delay
      const refreshTimer = setTimeout(() => {
        // The useAuth hook will automatically refresh student data
        // This timeout ensures Firebase has time to sync
        console.log('Refreshing student data after enrollment completion');
      }, 1000);
      
      return () => clearTimeout(refreshTimer);
    }

    // Handle payment completion redirect
    if (state?.paymentCompleted) {
      console.log('Payment just completed, new status:', state.newStatus);
      
      // Force a refresh of student data after a short delay
      const refreshTimer = setTimeout(() => {
        console.log('Refreshing student data after payment completion');
      }, 1000);
      
      return () => clearTimeout(refreshTimer);
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
        action: currentStatus === 'payment_pending' ? {
          label: 'Complete Payment',
          href: '/payment'
        } : undefined
      },
      {
        id: 'approval_pending',
        title: 'Approval Pending',
        description: 'Your enrollment is being reviewed by our team',
        icon: Clock,
        completed: ['approved', 'suspended'].includes(currentStatus),
        current: currentStatus === 'approval_pending'
      },
      {
        id: 'approved',
        title: 'Approved',
        description: 'Your enrollment has been approved! You can now access courses.',
        icon: CheckCircle2,
        completed: currentStatus === 'approved',
        current: currentStatus === 'approved',
        action: currentStatus === 'approved' ? {
          label: 'Go to Dashboard',
          href: '/dashboard'
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

  if (loading || loadingStatus) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-4xl mx-auto w-full"
    >
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <UserCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-light text-white">Welcome to Breemic International</h1>
        <p className="text-lg text-slate-300 max-w-2xl mx-auto">
          Follow these simple steps to unlock your course access and start your learning journey.
        </p>
        
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

        {/* Debug Info */}
        <div className="bg-slate-800/50 rounded-xl p-4 mx-auto max-w-md">
          <div className="text-xs text-slate-400 space-y-1">
            <div>Current Status: <span className="text-white">{currentStatus}</span></div>
            <div>Has Student Data: <span className="text-white">{studentData ? 'YES' : 'NO'}</span></div>
            <div>Student UID: <span className="text-white">{studentData?.uid || 'N/A'}</span></div>
            <div>Payment Amount: <span className="text-white">${studentData?.paymentInfo?.amountPaid || 0}</span></div>
            <div>Last Update: <span className="text-white">{studentData?.lastStatusUpdate?.toDate()?.toLocaleString() || 'N/A'}</span></div>
            <button
              onClick={() => {
                console.log('Full student data:', studentData);
                console.log('Current status from state:', currentStatus);
                alert(`Debug: Status=${currentStatus}, HasData=${!!studentData}, Payment=$${studentData?.paymentInfo?.amountPaid || 0}`);
              }}
              className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            >
              DEBUG INFO
            </button>
          </div>
        </div>
      </div>
        
        {/* Next Step Indicator & Primary Action */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="text-center space-y-4">
            <div className="text-sm text-slate-400 font-medium uppercase tracking-wider">
              Next Step
            </div>
            <div className="text-xl font-light text-white">
              {currentStatus === 'account_created' && 'Complete Enrollment Form'}
              {currentStatus === 'enrollment_pending' && 'Complete Enrollment Form'}
              {currentStatus === 'payment_pending' && 'Proceed to Payment'}
              {currentStatus === 'approval_pending' && 'Waiting for Approval'}
              {currentStatus === 'approved' && 'Start Your Course'}
              {currentStatus === 'rejected' && 'Resubmit Enrollment'}
              {currentStatus === 'suspended' && 'Contact Support'}
            </div>
            
            {/* Primary Action Button */}
            {currentStatus === 'account_created' && (
              <button
                onClick={() => {
                  setActionLoading('enrollment');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'enrollment'}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {actionLoading === 'enrollment' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Complete Enrollment Form
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            
            {currentStatus === 'enrollment_pending' && (
              <button
                onClick={() => {
                  setActionLoading('enrollment');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'enrollment'}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {actionLoading === 'enrollment' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Complete Enrollment Form
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            
            {currentStatus === 'payment_pending' && (
              <button
                onClick={() => {
                  setActionLoading('payment');
                  navigate('/payment');
                }}
                disabled={actionLoading === 'payment'}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-2xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {actionLoading === 'payment' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Proceed to Payment
                    <CreditCard className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            
            {currentStatus === 'approval_pending' && (
              <button
                disabled
                className="inline-flex items-center gap-3 px-8 py-4 bg-slate-700 text-slate-400 font-medium rounded-2xl cursor-not-allowed opacity-60"
              >
                <Clock className="w-5 h-5" />
                Waiting for Approval
              </button>
            )}
            
            {currentStatus === 'approved' && (
              <button
                onClick={() => {
                  setActionLoading('dashboard');
                  navigate('/dashboard');
                }}
                disabled={actionLoading === 'dashboard'}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {actionLoading === 'dashboard' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Go to My Course
                    <BookOpen className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            
            {currentStatus === 'rejected' && (
              <button
                onClick={() => {
                  setActionLoading('resubmit');
                  navigate('/breemic-enrollment');
                }}
                disabled={actionLoading === 'resubmit'}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {actionLoading === 'resubmit' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Resubmit Enrollment
                    <RefreshCw className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            
            {currentStatus === 'suspended' && (
              <button
                disabled
                className="inline-flex items-center gap-3 px-8 py-4 bg-slate-700 text-slate-400 font-medium rounded-2xl cursor-not-allowed opacity-60"
              >
                Contact Support
              </button>
            )}
          </div>
        </div>
      </div>

      
      {/* Progress Steps */}
      <div className="space-y-8">
        {/* Visual Progress Tracker */}
        <div className="relative">
          <div className="flex items-center justify-between mb-8">
            {[
              { id: 'account_created', label: 'Account' },
              { id: 'enrollment_pending', label: 'Enrollment' },
              { id: 'payment_pending', label: 'Payment' },
              { id: 'approval_pending', label: 'Approval' },
              { id: 'approved', label: 'Course Access' }
            ].map((step, index) => {
              const isCompleted = ['account_created', 'enrollment_pending', 'payment_pending', 'approval_pending', 'approved'].indexOf(currentStatus) >= index;
              const isCurrent = step.id === currentStatus || 
                (currentStatus === 'enrollment_pending' && step.id === 'enrollment_pending') ||
                (currentStatus === 'payment_pending' && step.id === 'payment_pending') ||
                (currentStatus === 'approval_pending' && step.id === 'approval_pending') ||
                (currentStatus === 'approved' && step.id === 'approved');
              
              return (
                <div key={step.id} className="flex flex-col items-center relative z-10">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    isCompleted 
                      ? "bg-gradient-to-br from-green-400 to-green-600 shadow-lg" 
                      : isCurrent
                        ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg ring-4 ring-blue-400/20"
                        : "bg-slate-700"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <div className="w-3 h-3 bg-slate-400 rounded-full" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 font-medium transition-colors",
                    isCompleted 
                      ? "text-green-400" 
                      : isCurrent
                        ? "text-blue-400"
                        : "text-slate-500"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress Line */}
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-slate-700 -z-10" />
          <div 
            className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-green-400 to-green-600 -z-10 transition-all duration-500"
            style={{
              width: `${(['account_created', 'enrollment_pending', 'payment_pending', 'approval_pending', 'approved'].indexOf(currentStatus) / 4) * 100}%`
            }}
          />
        </div>

        {/* Step Cards */}
        <div className="space-y-4">
          {statusSteps.map((step, index) => {
            if (step.id === 'rejected' || step.id === 'suspended') return null;
            
            const isClickable = step.action && step.current;
            const isCompleted = step.completed;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "bg-white/5 backdrop-blur-sm rounded-2xl p-6 border transition-all duration-300",
                  isCompleted 
                    ? "border-green-500/20 bg-green-500/5" 
                    : isClickable
                      ? "border-blue-500/30 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                      : "border-slate-700/50 bg-slate-800/30"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                    isCompleted 
                      ? "bg-green-500/20 text-green-400" 
                      : isClickable
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-slate-700 text-slate-400"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className={cn(
                          "text-lg font-medium mb-1",
                          isCompleted 
                            ? "text-green-400" 
                            : isClickable
                              ? "text-white"
                              : "text-slate-400"
                        )}>
                          {step.title}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            Completed
                          </span>
                        ) : isClickable ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    {isClickable && step.action && (
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            const actionType = step.id === 'enrollment_pending' ? 'enrollment' : 
                                             step.id === 'payment_pending' ? 'payment' : 
                                             step.id === 'approved' ? 'dashboard' : 'resubmit';
                            setActionLoading(actionType);
                            navigate(step.action.href);
                          }}
                          disabled={actionLoading !== null}
                          className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                              {step.id === 'enrollment_pending' && 'Fill Enrollment Form'}
                              {step.id === 'payment_pending' && 'Make Payment'}
                              {step.id === 'approved' && 'Go to Dashboard'}
                              {step.action.label}
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Disabled state for future steps */}
                    {!isClickable && !isCompleted && step.action && (
                      <div className="mt-4">
                        <button
                          disabled
                          className="inline-flex items-center gap-3 px-6 py-3 bg-slate-700/50 text-slate-500 font-medium rounded-xl cursor-not-allowed opacity-50"
                        >
                          {step.id === 'enrollment_pending' && 'Complete Previous Steps First'}
                          {step.id === 'payment_pending' && 'Complete Enrollment First'}
                          {step.id === 'approval_pending' && 'Submit Payment First'}
                          {step.id === 'approved' && 'Complete Previous Steps First'}
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Success State */}
      {currentStatus === 'approved' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-3xl p-8 border border-green-500/30">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-light text-white mb-3">
              🎉 Congratulations!
            </h2>
            <p className="text-slate-300 mb-6 max-w-md mx-auto">
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
};
