import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  Users,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { StudentData, UserProfile, Enrollment, TrainingStatus, ExamStatus, OnboardingStatus } from '../types';

interface StudentTableRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  course: string;
  onboardingStatus: OnboardingStatus;
  trainingStatus: TrainingStatus;
  examStatus: ExamStatus;
  paymentStatus: string;
  progress: number;
  enrollmentDate: Date;
  lastActive?: Date;
}

interface StudentTableProps {
  courseId?: string;
  limit?: number;
  showActions?: boolean;
  showApproveReject?: boolean;
  onApprove?: (student: StudentTableRow) => void;
  onReject?: (student: StudentTableRow) => void;
}

export const StudentTable: React.FC<StudentTableProps> = ({ 
  courseId, 
  limit: initialLimit = 50,
  showActions = true,
  showApproveReject = false,
  onApprove,
  onReject
}) => {
  const { profile: teacherData } = useAuth();
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof StudentTableRow>('enrollmentDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const itemsPerPage = initialLimit;

  // Helper functions for display names
const getCourseDisplayName = useCallback((courseId: string): string => {
  const courseMap: Record<string, string> = {
    'ielts_academic': 'IELTS Academic',
    'ielts_general': 'IELTS General',
    'pte_academic': 'PTE Academic',
    'pte_general': 'PTE General',
    'toefl': 'TOEFL',
    'duolingo': 'Duolingo'
  };
  return courseMap[courseId] || courseId;
}, []);

const getStatusDisplayName = useCallback((status: string): string => {
  const statusMap: Record<string, string> = {
    // Onboarding statuses
    'account_created': 'Account Created',
    'approval_pending': 'Approval Pending',
    'payment_pending': 'Payment Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    // Training statuses
    'inactive': 'Inactive',
    'active': 'Active',
    'completed': 'Completed',
    'locked': 'Locked',
    // Payment statuses
    'paid': 'Paid',
    'pending': 'Pending'
  };
  return statusMap[status] || status;
}, []);

// Merge users and students collections with safe guards
const mergeStudentData = useCallback(async (studentDocs: any[]) => {
  console.log("MERGING STUDENT DATA FOR", studentDocs?.length || 0, "STUDENTS");
  
  // Safe guard: if no docs, return empty array
  if (!Array.isArray(studentDocs) || studentDocs.length === 0) {
    console.log("NO STUDENT DOCS TO MERGE");
    return [];
  }
  
  const mergedStudents = [];
  let missingNameCount = 0;
  let missingEmailCount = 0;
  
  for (const studentDoc of studentDocs) {
    // Safe guard: check if doc exists and has data method
    if (!studentDoc || typeof studentDoc.data !== 'function') {
      console.error("INVALID STUDENT DOC:", studentDoc);
      continue;
    }
    
    const studentData = studentDoc.data();
    const uid = studentDoc.id;
    
    // Safe guard: check if uid exists
    if (!uid) {
      console.error("MISSING UID FOR STUDENT DOC:", studentDoc);
      continue;
    }
    
    try {
      // Get user data for identity fields
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      // Safe guard: ensure studentData exists
      const safeStudentData = studentData || {};
      
      // Build merged student record with safe defaults
      const mergedStudent = {
        id: uid,
        // Identity from users collection (source of truth)
        name: userData?.name || userData?.fullName || userData?.displayName || safeStudentData?.name || 'Unknown',
        email: userData?.email || safeStudentData?.email || '',
        phone: userData?.phone || safeStudentData?.phone || '',
        avatarUrl: userData?.avatarUrl || userData?.photoURL || '',
        
        // Student state from students collection with safe defaults
        course: getCourseDisplayName(safeStudentData?.courseId || 'N/A'),
        courseId: safeStudentData?.courseId || 'N/A',
        onboardingStatus: safeStudentData?.onboardingStatus || 'account_created',
        trainingStatus: safeStudentData?.trainingStatus || 'inactive',
        examStatus: safeStudentData?.examStatus || 'not_started',
        paymentStatus: safeStudentData?.trainingPaymentStatus || 'pending',
        progress: calculateProgress(safeStudentData),
        enrollmentDate: safeStudentData?.enrollmentDate?.toDate?.() || safeStudentData?.enrollmentDate?.toDate?.() || new Date(),
        lastActive: safeStudentData?.lastActive?.toDate?.() || safeStudentData?.lastActive?.toDate?.() || undefined
      };
      
      if (mergedStudent.name === 'Unknown') missingNameCount++;
      if (!mergedStudent.email) missingEmailCount++;
      
      mergedStudents.push(mergedStudent);
    } catch (error) {
      console.error("Error merging student data for", uid, ":", error);
      // Fallback to student data only with safe guards
      const safeStudentData = studentData || {};
      mergedStudents.push({
        id: uid,
        name: safeStudentData?.name || 'Unknown',
        email: safeStudentData?.email || '',
        phone: safeStudentData?.phone || '',
        avatarUrl: '',
        course: getCourseDisplayName(safeStudentData?.courseId || 'N/A'),
        courseId: safeStudentData?.courseId || 'N/A',
        onboardingStatus: safeStudentData?.onboardingStatus || 'account_created',
        trainingStatus: safeStudentData?.trainingStatus || 'inactive',
        examStatus: safeStudentData?.examStatus || 'not_started',
        paymentStatus: safeStudentData?.trainingPaymentStatus || 'pending',
        progress: calculateProgress(safeStudentData),
        enrollmentDate: safeStudentData?.enrollmentDate?.toDate?.() || safeStudentData?.enrollmentDate?.toDate?.() || new Date(),
        lastActive: safeStudentData?.lastActive?.toDate?.() || safeStudentData?.lastActive?.toDate?.() || undefined
      });
    }
  }
  
  console.log("MERGED STUDENTS:", mergedStudents.length);
  console.log("SAMPLE MERGED STUDENT:", mergedStudents[0]);
  console.log("MISSING NAME COUNT:", missingNameCount);
  console.log("MISSING EMAIL COUNT:", missingEmailCount);
  
  return mergedStudents;
}, [getCourseDisplayName, calculateProgress]);

  // Fetch students data with single query approach
  const fetchStudents = useCallback(async (isInitial = false) => {
    try {
      let studentsQuery = query(
        collection(db, 'students'),
        orderBy('enrollmentDate', 'desc'),
        limit(itemsPerPage)
      );

      if (courseId) {
        studentsQuery = query(
          collection(db, 'students'),
          where('courseId', '==', courseId),
          orderBy('enrollmentDate', 'desc'),
          limit(itemsPerPage)
        );
      }

      if (!isInitial && lastVisible) {
        studentsQuery = query(
          collection(db, 'students'),
          orderBy('enrollmentDate', 'desc'),
          startAfter(lastVisible),
          limit(itemsPerPage)
        );
      }

      let studentsSnapshot;
      let studentsData;
      let useFallback = false;
      
      try {
        studentsSnapshot = await getDocs(studentsQuery);
        console.log("ORIGINAL QUERY SUCCESS");
      } catch (indexError) {
        console.log("STUDENT TABLE INDEX ERROR:", indexError?.message);
        console.log("FALLING BACK TO PLAIN QUERY...");
        
        // FALLBACK: Plain collection query without orderBy/limit
        studentsSnapshot = await getDocs(collection(db, 'students'));
        console.log("FALLBACK QUERY SUCCESS");
        useFallback = true;
      }
      
      // Use merged data from users + students collections with error handling
      console.log("MERGING STUDENT DATA...");
      try {
        studentsData = await mergeStudentData(studentsSnapshot.docs);
      } catch (mergeError) {
        console.error("MERGE ERROR:", mergeError);
        console.log("FALLING BACK TO DIRECT MAPPING...");
        
        // Fallback: Direct mapping without merge
        studentsData = studentsSnapshot.docs.map(doc => {
          const data = doc.data() as StudentData;
          return {
            id: doc.id,
            name: data.name || 'Unknown',
            email: data.email || '',
            phone: data.phone,
            course: getCourseDisplayName(data.courseId || 'N/A'),
            courseId: data.courseId || 'N/A',
            onboardingStatus: data.onboardingStatus || 'account_created',
            trainingStatus: data.trainingStatus || 'inactive',
            examStatus: data.examStatus || 'not_started',
            paymentStatus: data.trainingPaymentStatus || 'pending',
            progress: calculateProgress(data),
            enrollmentDate: data.enrollmentDate?.toDate() || new Date(),
            lastActive: data.lastActive?.toDate(),
            courseName: getCourseDisplayName(data.courseId || 'N/A')
          } as StudentTableRow;
        });
      }
      
      // If using fallback and courseId filter, apply in memory
      if (useFallback && courseId) {
        console.log("APPLYING COURSE FILTER IN MEMORY...");
        studentsData = studentsData.filter(student => student.course === courseId);
        console.log("FILTERED STUDENTS:", studentsData.length, "students");
      }
      
      // If using fallback, apply sorting in memory
      if (useFallback) {
        console.log("APPLYING SORTING IN MEMORY...");
        studentsData.sort((a, b) => {
          const aValue = a.enrollmentDate;
          const bValue = b.enrollmentDate;
          return bValue.getTime() - aValue.getTime(); // desc order
        });
      }
      
      // Show fallback message only once
      if (useFallback && !localStorage.getItem('studentTableIndexWarningShown')) {
        showToast('Student table needs a Firestore index. Using fallback mode.', 'info');
        localStorage.setItem('studentTableIndexWarningShown', 'true');
      }

      if (isInitial) {
        setStudents(studentsData);
      } else {
        setStudents(prev => [...prev, ...studentsData]);
      }

      setLastVisible(studentsSnapshot.docs[studentsSnapshot.docs.length - 1]);
      setHasMore(studentsSnapshot.docs.length === itemsPerPage);

    } catch (error) {
      console.error("STUDENT TABLE FETCH ERROR:", error);
      console.error("ERROR CODE:", error?.code);
      console.error("ERROR MESSAGE:", error?.message);
      console.error("QUERY DETAILS:", { courseId, itemsPerPage });
      showToast(`STUDENT TABLE ERROR: ${error?.message || error}`, 'error');
      setStudents([]); // Clear students on error
    } finally {
      setLoading(false);
    }
  }, [courseId, itemsPerPage, lastVisible, showToast]);

  // Calculate progress percentage
  const calculateProgress = useCallback((student: StudentData): number => {
    if (student.trainingStatus === 'completed') return 100;
    if (student.trainingStatus === 'active') return 50;
    if (student.onboardingStatus === 'approved') return 25;
    return 0;
  }, []);

  // Initial fetch - no dependency on courses
  useEffect(() => {
    fetchStudents(true);
  }, [fetchStudents]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Search is handled in useMemo below
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Filter and sort students with memoization and safe guards
  const filteredAndSortedStudents = useMemo(() => {
    // Safe guard: ensure students is an array
    const safeStudents = Array.isArray(students) ? students : [];
    
    console.log("STUDENTS PAGE DATA:", safeStudents.length, "students");
    console.log("FILTERING STUDENTS:", safeStudents.length, "total students");

    let filtered = safeStudents;

    // Apply search filter with safe guards
    if (searchTerm) {
      filtered = filtered.filter(student => {
        if (!student) return false;
        try {
          return (
            (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.course || '').toLowerCase().includes(searchTerm.toLowerCase())
          );
        } catch (error) {
          console.error("SEARCH FILTER ERROR:", error, student);
          return false;
        }
      });
    }

    // Apply sorting with safe guards
    try {
      filtered = [...filtered].sort((a, b) => {
        if (!a || !b) return 0;
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } catch (error) {
      console.error("SORTING ERROR:", error);
      // If sorting fails, return unsorted filtered data
    }

    console.log("FINAL FILTERED STUDENTS:", filtered.length, "students");
    return filtered;
  }, [students, searchTerm, sortColumn, sortDirection]);

  // Pagination
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedStudents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedStudents.length / itemsPerPage);

  // Handle sorting
  const handleSort = (column: keyof StudentTableRow) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Export to Excel functionality
  const exportToExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportData = filteredAndSortedStudents.map(student => ({
        'Student Name': student.name,
        'Email': student.email,
        'Phone': student.phone || '',
        'Course': student.course,
        'Status': student.onboardingStatus,
        'Payment Status': student.paymentStatus,
        'Training Status': student.trainingStatus,
        'Progress': `${student.progress}%`,
        'Enrollment Date': student.enrollmentDate.toLocaleDateString(),
        'Last Active': student.lastActive?.toLocaleDateString() || 'Never'
      }));

      // Create CSV content
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `students-list-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Student list exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Error exporting student list', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [filteredAndSortedStudents, showToast]);

  // Status badge component
  const StatusBadge: React.FC<{ status: string; type: 'onboarding' | 'training' | 'payment' }> = ({ status, type }) => {
    const getStatusConfig = () => {
      switch (type) {
        case 'onboarding':
          switch (status) {
            case 'approved': return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
            case 'approval_pending': return { color: 'bg-orange-100 text-orange-800', icon: Clock };
            case 'payment_pending': return { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle };
            default: return { color: 'bg-gray-100 text-gray-800', icon: Clock };
          }
        case 'training':
          switch (status) {
            case 'active': return { color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
            case 'completed': return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
            default: return { color: 'bg-gray-100 text-gray-800', icon: Clock };
          }
        case 'payment':
          switch (status) {
            case 'paid': return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
            case 'pending': return { color: 'bg-orange-100 text-orange-800', icon: Clock };
            default: return { color: 'bg-gray-100 text-gray-800', icon: XCircle };
          }
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: Clock };
      }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.color)}>
        <Icon size={12} />
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96"></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Student Management</h1>
          <p className="text-[#6B7280]">Manage and monitor all student progress</p>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3DF5] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600">
                {filteredAndSortedStudents.length} of {students.length} students
              </div>
              <button
                onClick={exportToExcel}
                disabled={isExporting || filteredAndSortedStudents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#5B3DF5] text-white rounded-lg hover:bg-[#4B2FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Export to Excel
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      Name
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      Email
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('course')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      Course
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Training
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('progress')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      Progress
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('enrollmentDate')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    >
                      Enrollment Date
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  {showActions && (
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </span>
                    </th>
                  )}
                  {showApproveReject && (
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approve/Reject
                      </span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedStudents.map((student, index) => {
                  // Safe guard: ensure student exists
                  if (!student || !student.id) {
                    console.error("INVALID STUDENT IN TABLE:", student);
                    return null;
                  }
                  
                  return (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-[#5B3DF5]/10 rounded-full flex items-center justify-center mr-3">
                          <span className="text-[#5B3DF5] text-sm font-medium">
                            {(student.name || 'Unknown').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.name || 'Unknown'}</div>
                          {student.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone size={10} />
                              {student.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{student.email || 'No email'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{student.course || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={student.onboardingStatus} type="onboarding" />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={student.paymentStatus} type="payment" />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={student.trainingStatus} type="training" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#5B3DF5] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 min-w-[3rem]">{student.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {student.enrollmentDate.toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {student.enrollmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    {showActions && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <Eye size={16} />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <Edit size={16} />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <Mail size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                  {showApproveReject && (
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onApprove?.(student)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => onReject?.(student)}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedStudents.length)} of {filteredAndSortedStudents.length} results
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
        {filteredAndSortedStudents.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search terms' : 'No students have enrolled yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
