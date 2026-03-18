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
  Calendar,
  DollarSign,
  UserCheck,
  Mail,
  Phone
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

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('StudentOnboardingDashboard mounted');
    console.log('Student data:', studentData);
    console.log('Current status:', currentStatus);
  }, [studentData, currentStatus]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [rejectionInfo, setRejectionInfo] = useState<RejectionInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (studentData) {
      setCurrentStatus(studentData.onboardingStatus || 'account_created');
      setPaymentInfo(studentData.paymentInfo || null);
      setRejectionInfo(studentData.rejectionInfo || null);
    }

    // Show notification if redirected due to approval requirements
    if (state?.reason === 'approval_required') {
      // You could add a toast notification here
      console.log('Redirected due to approval requirements. Current status:', state.currentStatus);
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
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-red-500 bg-red-500/20 p-4 rounded-xl border-2 border-red-500">🎓 ONBOARDING DASHBOARD - TESTING</h1>
        <p className="text-slate-400">Track your enrollment status and complete required steps</p>
      </div>

      {/* Current Status Card */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-xl border", getStatusColor(currentStatus))}>
              {getStatusIcon(currentStatus)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white capitalize">
                {currentStatus.replace('_', ' ')}
              </h2>
              <p className="text-slate-400 text-sm">
                Last updated: {studentData?.lastStatusUpdate?.toDate()?.toLocaleDateString() || 'Recently'}
              </p>
            </div>
          </div>
          <StatusBadge 
            status={currentStatus.replace('_', ' ').toUpperCase()} 
            variant={currentStatus === 'approved' ? 'success' : currentStatus === 'rejected' ? 'error' : 'primary'}
          />
        </div>

        {/* Rejection Info */}
        {rejectionInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-400 font-semibold mb-1">Rejection Reason</h3>
                <p className="text-red-300 text-sm">{rejectionInfo.reason}</p>
                {rejectionInfo.canResubmit && (
                  <p className="text-red-400 text-xs mt-2">
                    You can resubmit your enrollment before {rejectionInfo.resubmissionDeadline || 'the deadline'}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* User Info Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Mail className="w-4 h-4" />
              <span>{profile?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <User className="w-4 h-4" />
              <span>{profile?.name}</span>
            </div>
          </div>
          <div className="space-y-2">
            {paymentInfo && (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <DollarSign className="w-4 h-4" />
                  <span>Paid: ${paymentInfo.amountPaid} | Balance: ${paymentInfo.balance}</span>
                </div>
                {paymentInfo.paymentDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Payment: {new Date(paymentInfo.paymentDate).toLocaleDateString()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Progress Steps */}
      <GlassCard className="p-6">
        <h3 className="text-xl font-bold text-white mb-6">Onboarding Steps</h3>
        <div className="space-y-4">
          {statusSteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {step.action ? (
                <div 
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                    step.completed 
                      ? "bg-green-500/10 border-green-500 hover:bg-green-500/20" 
                      : step.current 
                        ? "bg-yellow-500/20 border-yellow-500 hover:bg-yellow-500/30" 
                        : "bg-[var(--ui-bg)]/50 border-[var(--ui-border)] hover:bg-[var(--ui-border)]"
                  )}
                  onClick={() => {
                    console.log('Step clicked:', step.title, 'Navigate to:', step.action.href);
                    navigate(step.action.href);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(step.action.href);
                    }
                  }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    step.completed 
                      ? "bg-green-500 text-white" 
                      : step.current 
                        ? "bg-yellow-500 text-white animate-pulse" 
                        : "bg-[var(--ui-border)] text-[var(--ui-muted)]"
                  )}>
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={cn(
                      "font-semibold flex items-center gap-2",
                      step.completed 
                        ? "text-green-400" 
                        : step.current 
                          ? "text-yellow-400" 
                          : "text-[var(--ui-muted)]"
                    )}>
                      {step.title}
                      {step.current && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">CLICK HERE</span>}
                    </h4>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--ui-accent)] font-medium">Click to →</span>
                    <ArrowRight className="w-4 h-4 text-[var(--ui-accent)]" />
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  step.completed 
                    ? "bg-green-500/10 border-green-500/30" 
                    : step.current 
                      ? "bg-[var(--ui-accent)]/10 border-[var(--ui-accent)]/30" 
                      : "bg-[var(--ui-bg)]/50 border-[var(--ui-border)]/50"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    step.completed 
                      ? "bg-green-500 text-white" 
                      : step.current 
                        ? "bg-[var(--ui-accent)] text-white" 
                        : "bg-[var(--ui-border)] text-[var(--ui-muted)]"
                  )}>
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={cn(
                      "font-semibold",
                      step.completed 
                        ? "text-green-400" 
                        : step.current 
                          ? "text-[var(--ui-accent)]" 
                          : "text-[var(--ui-muted)]"
                    )}>
                      {step.title}
                    </h4>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Quick Actions */}
      {currentStatus === 'approved' && (
        <GlassCard className="p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Ready to Start Learning!</h3>
          <p className="text-slate-400 mb-4">
            Your enrollment has been approved. You now have full access to all courses and materials.
          </p>
          <Link to="/dashboard">
            <PrimaryButton className="gap-2">
              Go to Student Dashboard
              <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </Link>
        </GlassCard>
      )}
    </motion.div>
  );
};
