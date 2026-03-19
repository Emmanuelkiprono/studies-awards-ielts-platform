import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UserProfile, StudentData, Enrollment, OnboardingStatus } from '../types';

interface PendingStudent extends UserProfile {
  uid: string;
  email: string;
  phone?: string;
  courseId?: string;
  onboardingStatus: OnboardingStatus;
  enrollmentDate?: any;
  paymentStatus?: string;
  paymentProofUrl?: string;
  notes?: string;
}

interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paymentPending: number;
}

export const TeacherApprovalsPage: React.FC = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<OnboardingStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<ApprovalStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    paymentPending: 0
  });

  const itemsPerPage = 20;

  // Fetch students data
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const studentsQuery = query(
          collection(db, 'students'),
          where('onboardingStatus', 'in', ['approval_pending', 'payment_pending', 'approved', 'rejected'])
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsData = studentsSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as PendingStudent));

        setStudents(studentsData);

        // Calculate stats
        const approvalStats = studentsData.reduce((acc, student) => {
          acc.total++;
          switch (student.onboardingStatus) {
            case 'approval_pending':
              acc.pending++;
              break;
            case 'payment_pending':
              acc.paymentPending++;
              break;
            case 'approved':
              acc.approved++;
              break;
            case 'rejected':
              acc.rejected++;
              break;
          }
          return acc;
        }, { total: 0, pending: 0, approved: 0, rejected: 0, paymentPending: 0 });

        setStats(approvalStats);

      } catch (error) {
        console.error('Error fetching students:', error);
        showToast('Error fetching student data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [showToast]);

  // Filter students
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(student => student.onboardingStatus === filterStatus);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [students, searchTerm, filterStatus]);

  // Pagination
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  // Handle approve
  const handleApprove = async (student: PendingStudent) => {
    setActionLoading(student.uid);
    try {
      const studentRef = doc(db, 'students', student.uid);
      await updateDoc(studentRef, {
        onboardingStatus: 'approved',
        accessUnlocked: true,
        trainingStatus: 'active',
        approvedAt: serverTimestamp()
      });

      showToast('Student approved successfully', 'success');
      
      // Update local state
      setStudents(prev => prev.map(s => 
        s.uid === student.uid 
          ? { ...s, onboardingStatus: 'approved', trainingStatus: 'active' }
          : s
      ));
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
      setStudents(prev => prev.map(s => 
        s.uid === student.uid 
          ? { ...s, onboardingStatus: 'rejected' }
          : s
      ));
    } catch (error) {
      console.error('Error rejecting student:', error);
      showToast('Error rejecting student', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: OnboardingStatus }> = ({ status }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'approved':
          return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' };
        case 'approval_pending':
          return { color: 'bg-orange-100 text-orange-800', icon: Clock, label: 'Approval Pending' };
        case 'payment_pending':
          return { color: 'bg-yellow-100 text-yellow-800', icon: DollarSign, label: 'Payment Pending' };
        case 'rejected':
          return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' };
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: Clock, label: status };
      }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.color)}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#5B3DF5]/30 border-t-[#5B3DF5] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#111827] mb-2">Student Approvals</h1>
          <p className="text-[#6B7280]">Review and manage student enrollment applications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Total</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Pending Approval</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Payment Pending</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.paymentPending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Approved</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Rejected</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3DF5] focus:border-transparent"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as OnboardingStatus | 'all')}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3DF5] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="approval_pending">Approval Pending</option>
                <option value="payment_pending">Payment Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Student</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Course</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedStudents.map((student, index) => (
                  <motion.tr
                    key={student.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-[#5B3DF5]/10 rounded-full flex items-center justify-center mr-3">
                          <span className="text-[#5B3DF5] text-sm font-medium">
                            {student.name?.charAt(0).toUpperCase() || 'S'}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">ID: {student.uid.slice(-8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{student.email}</div>
                      {student.phone && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={10} />
                          {student.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{student.courseId || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={student.onboardingStatus} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {student.enrollmentDate?.toDate()?.toLocaleDateString() || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {student.onboardingStatus === 'approval_pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(student)}
                              disabled={actionLoading === student.uid}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === student.uid ? (
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle size={12} />
                                  Approve
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(student)}
                              disabled={actionLoading === student.uid}
                              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          </>
                        )}
                        {student.paymentProofUrl && (
                          <button
                            onClick={() => window.open(student.paymentProofUrl, '_blank')}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="View Payment Proof"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <Mail size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'No student applications yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
