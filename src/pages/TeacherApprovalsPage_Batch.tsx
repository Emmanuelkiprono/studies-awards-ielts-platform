import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { useBatchManagement } from '../hooks/useBatchManagement';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, getDocs, getDoc, updateDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Mail, Phone, Calendar, DollarSign, FileText, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { UserProfile, StudentData, Enrollment, OnboardingStatus, Batch } from '../types';
import { GlassCard, PrimaryButton, StatusBadge } from '../components/UI';

interface PendingStudent extends UserProfile {
  uid: string;
  email: string;
  phone?: string;
  courseId?: string;
  onboardingStatus: OnboardingStatus;
  enrollmentDate?: any;
  paymentStatus?: string;
  studentData?: StudentData;
  enrollment?: Enrollment;
}

export const TeacherApprovalsPage_Batch: React.FC = () => {
  const { profile: teacherProfile } = useAuth();
  const { showToast } = useToast();
  const { batches, suggestBatch, assignStudentToBatch } = useBatchManagement(teacherProfile?.assignedCourseId);
  
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<{ [key: string]: string }>({});

  // Fetch pending students
  useEffect(() => {
    const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));

    const unsubscribe = onSnapshot(studentsQ, async (snapshot) => {
      const pending: PendingStudent[] = [];

      for (const studentDoc of snapshot.docs) {
        const profile = { ...studentDoc.data(), uid: studentDoc.id } as UserProfile;

        // Fetch student data
        const sDataDoc = await getDoc(doc(db, 'students', studentDoc.id));
        const sData = sDataDoc.exists() ? sDataDoc.data() as StudentData : undefined;

        // Check if pending (payment pending or status is locked/inactive but student exists)
        const isPending =
          sData?.trainingPaymentStatus === 'pending' ||
          sData?.onboardingStatus === 'payment_pending' ||
          sData?.onboardingStatus === 'approval_pending' ||
          (sData && sData.trainingStatus === 'locked');

        if (isPending) {
          const pendingStudent = {
            ...profile,
            studentData: sData,
            onboardingStatus: sData?.onboardingStatus || 'approval_pending'
          };
          pending.push(pendingStudent);
        }
      }

      setStudents(pending);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-suggest batch for each student
  useEffect(() => {
    students.forEach(student => {
      if (!selectedBatch[student.uid] && student.studentData?.courseId) {
        suggestBatch(student.studentData.courseId).then(batch => {
          if (batch) {
            setSelectedBatch(prev => ({
              ...prev,
              [student.uid]: batch.id
            }));
          }
        });
      }
    });
  }, [students, suggestBatch]);

  // Handle approve with batch assignment
  const handleApprove = async (student: PendingStudent) => {
    setActionLoading(student.uid);
    try {
      const studentRef = doc(db, 'students', student.uid);
      const batchId = selectedBatch[student.uid];
      
      if (!batchId) {
        showToast('Please select a batch for this student', 'error');
        return;
      }

      // Update student status
      await updateDoc(studentRef, {
        onboardingStatus: 'approved',
        accessUnlocked: true,
        trainingStatus: 'active',
        approvedAt: serverTimestamp(),
        lastStatusUpdate: serverTimestamp()
      });

      // Assign to batch
      await assignStudentToBatch(student.uid, batchId, student.studentData?.courseId!);

      showToast('Student approved and assigned to batch', 'success');
      
      // Update local state
      setStudents(prev => prev.filter(s => s.uid !== student.uid));
    } catch (error) {
      console.error('Error approving student:', error);
      showToast('Error approving student', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reject
  const handleReject = async (student: PendingStudent, reason?: string) => {
    setActionLoading(student.uid);
    try {
      const studentRef = doc(db, 'students', student.uid);
      await updateDoc(studentRef, {
        onboardingStatus: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectionReason: reason || 'Application does not meet requirements'
      });

      showToast('Student rejected', 'info');
      
      // Update local state
      setStudents(prev => prev.filter(s => s.uid !== student.uid));
    } catch (error) {
      console.error('Error rejecting student:', error);
      showToast('Error rejecting student', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: OnboardingStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'approval_pending': return 'bg-yellow-500';
      case 'payment_pending': return 'bg-orange-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: OnboardingStatus) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'approval_pending': return 'Approval Pending';
      case 'payment_pending': return 'Payment Pending';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-8 max-w-7xl mx-auto w-full pb-24"
    >
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Student Approvals</h2>
        <p className="text-slate-400 font-medium">Review pending applications and assign students to batches.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <AlertCircle className="text-orange-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{students.length}</div>
              <div className="text-sm text-slate-400">Pending Applications</div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="text-blue-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{batches.length}</div>
              <div className="text-sm text-slate-400">Available Batches</div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="text-green-500" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {batches.reduce((sum, batch) => sum + batch.currentStudents, 0)}
              </div>
              <div className="text-sm text-slate-400">Total Enrolled</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Students List */}
      <div className="space-y-4">
        {students.map((student) => (
          <GlassCard key={student.uid} className="p-6 border border-white/5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Student Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#6324eb]/10 flex items-center justify-center">
                  <Users className="text-[#6324eb]" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{student.name}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail size={12} /> {student.email}
                    </span>
                    {student.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone size={12} /> {student.phone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${getStatusColor(student.studentData?.onboardingStatus || 'approval_pending')}`}>
                      {getStatusText(student.studentData?.onboardingStatus || 'approval_pending')}
                    </span>
                    {student.studentData?.courseId && (
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                        Course Assigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Batch Selection & Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Batch Selection */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Assign to Batch</label>
                  <select
                    value={selectedBatch[student.uid] || ''}
                    onChange={(e) => setSelectedBatch(prev => ({
                      ...prev,
                      [student.uid]: e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6324eb]"
                  >
                    <option value="">Select Batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} ({batch.currentStudents}/{batch.maxStudents || '∞'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(student)}
                    disabled={actionLoading === student.uid || !selectedBatch[student.uid]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === student.uid ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={18} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(student)}
                    disabled={actionLoading === student.uid}
                    className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/10 disabled:opacity-50"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {student.studentData && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Enrollment Date:</span>
                    <span className="ml-2 text-white">
                      {student.studentData.enrollmentDate?.toDate().toLocaleDateString() || 'Not set'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Payment Status:</span>
                    <span className="ml-2 text-white capitalize">
                      {student.studentData.trainingPaymentStatus || 'pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Training Status:</span>
                    <span className="ml-2 text-white capitalize">
                      {student.studentData.trainingStatus || 'inactive'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        ))}

        {students.length === 0 && (
          <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
            <CheckCircle size={48} className="mx-auto text-emerald-500/50 mb-4" />
            <p className="text-slate-500 font-medium">All caught up! No pending applications.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
