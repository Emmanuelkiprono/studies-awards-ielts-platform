import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  FileText,
  CreditCard,
  UserCheck,
  Calendar,
  MessageSquare,
  RefreshCw,
  Download,
  Mail,
  Phone
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { StudentData, OnboardingStatus, BreemicEnrollment } from '../types';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { NotificationService } from '../services/notificationService';

interface StudentWithEnrollment extends StudentData {
  breemicEnrollment?: BreemicEnrollment;
  profile?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export const StudentApprovalPanel: React.FC = () => {
  const { user, profile } = useAuth();
  const [students, setStudents] = useState<StudentWithEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | 'all'>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Get all students
      const studentsSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'student'))
      );

      const studentsData: StudentWithEnrollment[] = [];

      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data() as StudentData;
        
        // Get student profile
        const profileDoc = await getDoc(doc(db, 'users', studentDoc.id));
        const profileData = profileDoc.data();

        // Get Breemic enrollment if exists
        let breemicEnrollment: BreemicEnrollment | undefined;
        if (studentData.breemicEnrollmentId) {
          const enrollmentDoc = await getDoc(doc(db, 'breemicEnrollments', studentData.breemicEnrollmentId));
          if (enrollmentDoc.exists()) {
            breemicEnrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as BreemicEnrollment;
          }
        }

        studentsData.push({
          ...studentData,
          uid: studentDoc.id,
          profile: profileData ? {
            name: profileData.name || 'Unknown',
            email: profileData.email || '',
            avatarUrl: profileData.avatarUrl
          } : undefined,
          breemicEnrollment
        });
      }

      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.breemicEnrollment?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || student.onboardingStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
        return <CheckCircle2 className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'suspended':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleApprove = async (student: StudentWithEnrollment) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        onboardingStatus: 'approved',
        approvedBy: user?.uid,
        approvedAt: serverTimestamp(),
        lastStatusUpdate: serverTimestamp(),
        trainingStatus: 'active',
        trainingPaymentStatus: 'paid'
      });

      // Send notification to student
      await NotificationService.create(
        student.uid,
        '🎉 Enrollment Approved!',
        'Your enrollment has been approved. You can now access your courses.',
        'success',
        '/dashboard'
      );

      await loadStudents();
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error approving student:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedStudent || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        onboardingStatus: 'rejected',
        rejectionInfo: {
          reason: rejectionReason,
          rejectedBy: user?.uid || '',
          rejectedAt: serverTimestamp(),
          canResubmit: true,
          resubmissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        lastStatusUpdate: serverTimestamp()
      });

      // Send notification to student
      await NotificationService.create(
        selectedStudent.uid,
        '❌ Enrollment Requires Attention',
        'Your enrollment needs some changes. Please review the feedback.',
        'error',
        '/onboarding'
      );

      await loadStudents();
      setSelectedStudent(null);
      setShowRejectionModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting student:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const statusCounts = {
    all: students.length,
    account_created: students.filter(s => s.onboardingStatus === 'account_created').length,
    enrollment_pending: students.filter(s => s.onboardingStatus === 'enrollment_pending').length,
    payment_pending: students.filter(s => s.onboardingStatus === 'payment_pending').length,
    approval_pending: students.filter(s => s.onboardingStatus === 'approval_pending').length,
    approved: students.filter(s => s.onboardingStatus === 'approved').length,
    rejected: students.filter(s => s.onboardingStatus === 'rejected').length,
    suspended: students.filter(s => s.onboardingStatus === 'suspended').length
  };

  if (loading) {
    return (
      <div className="p-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-6 max-w-6xl mx-auto w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Student Approval Panel</h1>
          <p className="text-slate-400">Review and manage student enrollment applications</p>
        </div>
        <PrimaryButton onClick={loadStudents} className="gap-2" disabled={loading}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </PrimaryButton>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries({
          approval_pending: { label: 'Pending Approval', color: 'purple' },
          approved: { label: 'Approved', color: 'green' },
          rejected: { label: 'Rejected', color: 'red' },
          payment_pending: { label: 'Payment Pending', color: 'orange' }
        }).map(([status, config]) => (
          <GlassCard key={status} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{config.label}</p>
                <p className="text-2xl font-bold text-white">{statusCounts[status as keyof typeof statusCounts]}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                className="input-field w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <select
            className="input-field min-w-[200px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OnboardingStatus | 'all')}
          >
            <option value="all">All Status</option>
            <option value="account_created">Account Created</option>
            <option value="enrollment_pending">Enrollment Pending</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="approval_pending">Approval Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </GlassCard>

      {/* Students List */}
      <GlassCard className="p-6">
        <h3 className="text-xl font-bold text-white mb-4">Students ({filteredStudents.length})</h3>
        <div className="space-y-4">
          {filteredStudents.map((student) => (
            <motion.div
              key={student.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-[var(--ui-border)] rounded-xl p-4 hover:bg-[var(--ui-border)]/10 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <img
                    src={student.profile?.avatarUrl || `https://picsum.photos/seed/${student.uid}/40/40`}
                    alt={student.profile?.name || 'Student'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{student.profile?.name || 'Unknown'}</h4>
                      <StatusBadge
                        status={student.onboardingStatus.replace('_', ' ').toUpperCase()}
                        variant={student.onboardingStatus === 'approved' ? 'success' : student.onboardingStatus === 'rejected' ? 'error' : 'primary'}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {student.profile?.email}
                      </div>
                      {student.breemicEnrollment?.contact && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {student.breemicEnrollment.contact}
                        </div>
                      )}
                    </div>
                    {student.breemicEnrollment && (
                      <div className="text-sm text-slate-400">
                        <p>Course: {student.breemicEnrollment.courseType} | Mode: {student.breemicEnrollment.modeOfTraining}</p>
                        <p>Fee: ${student.breemicEnrollment.feePaid} | Balance: ${student.breemicEnrollment.balance}</p>
                      </div>
                    )}
                    {student.rejectionInfo && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">Rejection: {student.rejectionInfo.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PrimaryButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <Eye className="w-4 h-4" />
                  </PrimaryButton>
                  {student.onboardingStatus === 'approval_pending' && (
                    <>
                      <PrimaryButton
                        size="sm"
                        onClick={() => handleApprove(student)}
                        disabled={actionLoading}
                        className="gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowRejectionModal(true);
                        }}
                        className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </PrimaryButton>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Student Details Modal */}
      <AnimatePresence>
        {selectedStudent && !showRejectionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setSelectedStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Student Details</h3>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 rounded-lg hover:bg-[var(--ui-border)] transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {selectedStudent.breemicEnrollment && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Enrollment Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Full Name:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.fullName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Email:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.email}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Contact:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.contact}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">ID/Passport:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.idPassport}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Course Type:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.courseType}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Training Mode:</span>
                        <p className="text-white capitalize">{selectedStudent.breemicEnrollment.modeOfTraining}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Address:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.physicalAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Payment Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Fee Paid:</span>
                        <p className="text-white">${selectedStudent.breemicEnrollment.feePaid}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Balance:</span>
                        <p className="text-white">${selectedStudent.breemicEnrollment.balance}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Enrollment Date:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.dateOfEnrollment}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Expected Completion:</span>
                        <p className="text-white">{selectedStudent.breemicEnrollment.expectedDateOfCompletion}</p>
                      </div>
                    </div>
                  </div>

                  {selectedStudent.onboardingStatus === 'approval_pending' && (
                    <div className="flex gap-3 pt-4 border-t border-[var(--ui-border)]">
                      <PrimaryButton
                        onClick={() => handleApprove(selectedStudent)}
                        disabled={actionLoading}
                        className="gap-2 flex-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Student
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        onClick={() => setShowRejectionModal(true)}
                        className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 flex-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectionModal && selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setShowRejectionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Reject Enrollment</h3>
                <button
                  onClick={() => setShowRejectionModal(false)}
                  className="p-2 rounded-lg hover:bg-[var(--ui-border)] transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Rejection Reason
                  </label>
                  <textarea
                    className="input-field w-full min-h-[100px]"
                    placeholder="Please explain why this enrollment is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <PrimaryButton
                    variant="secondary"
                    onClick={() => setShowRejectionModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </PrimaryButton>
                  <PrimaryButton
                    onClick={handleReject}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    {actionLoading ? 'Rejecting...' : 'Reject Enrollment'}
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
