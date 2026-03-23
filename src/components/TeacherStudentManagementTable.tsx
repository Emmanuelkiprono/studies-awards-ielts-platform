import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { AssignLessonModal, AssignLessonPayload } from './AssignLessonModal';
import {
  DEFAULT_LESSON_ID,
  DEFAULT_LESSON_TITLE,
  DEFAULT_MODULE_ID,
  DEFAULT_MODULE_TITLE,
  DEFAULT_NEXT_ACTION,
  LessonModuleOption,
  SAMPLE_LESSON_MODULES,
  TrainerAssignmentStatus,
  TRAINER_STATUS_OPTIONS,
} from '../data/lessonAssignmentData';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import {
  ensureStudentAutoAssignment,
  formatWeekBatchName,
  getProgressForStatus,
  getWeekStartDate,
  normalizeTrainerStatus,
  resolveStudentJoinDate,
  syncBatchStudentCount,
} from '../lib/studentAssignment';
import { getSimplifiedStudentStatus } from '../lib/studentAccess';
import { hasTeacherOperationsAccess } from '../lib/teacherPermissions';
import { cn } from '../lib/utils';
import { db } from '../services/firebase';
import { OnboardingStatus, StudentData, UserProfile } from '../types';

type ManagementViewMode = 'students' | 'approvals';
type ApprovalFilter = 'all' | 'needs_attention' | OnboardingStatus;
type SortKey =
  | 'name'
  | 'email'
  | 'joinDate'
  | 'approvalStatus'
  | 'batchName'
  | 'assignedTeacherName'
  | 'currentModule'
  | 'currentLesson'
  | 'progressPercent'
  | 'currentStatus'
  | 'attendanceRate'
  | 'lastActive';
type SortDirection = 'asc' | 'desc';
type BulkActionType =
  | ''
  | 'approve'
  | 'reject'
  | 'assign_batch'
  | 'set_module'
  | 'set_lesson'
  | 'set_status'
  | 'export';

interface TeacherDirectoryItem {
  id: string;
  name: string;
  email: string;
}

interface BatchDirectoryItem {
  id: string;
  name: string;
  courseId?: string;
  teacherId?: string;
  status?: string;
  currentStudents?: number;
}

interface TeacherManagedStudentRow {
  uid: string;
  name: string;
  email: string;
  role: string;
  courseId?: string;
  joinDate: Date;
  joinDateLabel: string;
  approvalStatus: OnboardingStatus;
  batchId?: string;
  batchName: string;
  assignedTeacherId?: string;
  assignedTeacherName?: string;
  currentModule: string;
  currentModuleId: string;
  currentLesson: string;
  currentLessonId: string;
  progressPercent: number;
  currentStatus: TrainerAssignmentStatus;
  attendanceRate?: number | null;
  lastActive?: Date | null;
  accessUnlocked?: boolean;
  trainingStatus?: string;
  paymentStatus?: string;
  trainerNotes?: string;
  lessonDeadline?: string | null;
  nextAction?: string;
  studentRecord?: Partial<StudentData>;
}

interface SummaryCard {
  title: string;
  value: number;
  tone: string;
}

interface TeacherStudentManagementTableProps {
  mode?: ManagementViewMode;
  modules?: LessonModuleOption[];
}

const ITEMS_PER_PAGE = 12;

const toDateValue = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const resolvedDate = (value as { toDate?: () => Date }).toDate?.() ?? null;
    return resolvedDate && !Number.isNaN(resolvedDate.getTime()) ? resolvedDate : null;
  }

  return null;
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const formatDateLabel = (value?: Date | null) =>
  value
    ? value.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Never';

const formatCompactDateTime = (value?: Date | null) =>
  value
    ? value.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

const resolveApprovalStatus = (
  studentRecord?: Partial<StudentData>,
  userData?: Partial<UserProfile> & { onboardingStatus?: OnboardingStatus }
): OnboardingStatus => {
  return getSimplifiedStudentStatus({
    ...userData,
    ...studentRecord,
  });
};

const getLessonDefinition = (moduleId: string, lessonId: string) =>
  SAMPLE_LESSON_MODULES.find((module) => module.id === moduleId)?.lessons.find(
    (lesson) => lesson.id === lessonId
  );

const getLessonOrder = (moduleId: string, lessonId: string) =>
  getLessonDefinition(moduleId, lessonId)?.order || 1;

const downloadRowsCsv = (rows: TeacherManagedStudentRow[], filename: string) => {
  const headers = [
    'Name',
    'Email',
    'Join Date',
    'Approval Status',
    'Batch',
    'Assigned Teacher',
    'Current Module',
    'Current Lesson',
    'Progress %',
    'Student Status',
    'Attendance',
    'Last Active',
  ];
  const csvRows = rows.map((row) => [
    row.name,
    row.email,
    formatDateLabel(row.joinDate),
    row.approvalStatus,
    row.batchName,
    row.assignedTeacherName || 'Unassigned',
    row.currentModule,
    row.currentLesson,
    `${row.progressPercent}`,
    row.currentStatus,
    row.attendanceRate !== undefined && row.attendanceRate !== null
      ? `${Math.round(row.attendanceRate)}%`
      : '--',
    formatCompactDateTime(row.lastActive),
  ]);

  const csvContent = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const getApprovalBadgeClassName = (approvalStatus: OnboardingStatus) => {
  switch (approvalStatus) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'enrollment_submitted':
      return 'bg-blue-100 text-blue-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'signup_complete':
    default:
      return 'bg-amber-100 text-amber-700';
  }
};

const getStatusBadgeClassName = (status: TrainerAssignmentStatus) => {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'Almost Done':
      return 'bg-purple-100 text-purple-700';
    case 'In Progress':
      return 'bg-blue-100 text-blue-700';
    case 'New':
    default:
      return 'bg-amber-100 text-amber-700';
  }
};

const isApprovalPending = (approvalStatus: OnboardingStatus) =>
  approvalStatus === 'enrollment_submitted';

export const TeacherStudentManagementTable: React.FC<TeacherStudentManagementTableProps> = ({
  mode = 'students',
  modules = SAMPLE_LESSON_MODULES,
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<TeacherManagedStudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherDirectoryItem[]>([]);
  const [batches, setBatches] = useState<BatchDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>(
    mode === 'approvals' ? 'needs_attention' : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | TrainerAssignmentStatus>('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('joinDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkActionType>('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkStatus, setBulkStatus] = useState<TrainerAssignmentStatus>('New');
  const [bulkModuleId, setBulkModuleId] = useState(modules[0]?.id || DEFAULT_MODULE_ID);
  const [bulkLessonId, setBulkLessonId] = useState(
    modules[0]?.lessons[0]?.id || DEFAULT_LESSON_ID
  );
  const [editingStudent, setEditingStudent] = useState<TeacherManagedStudentRow | null>(null);
  const [menuStudentId, setMenuStudentId] = useState<string | null>(null);

  const fetchManagementData = useCallback(async () => {
    if (!hasTeacherOperationsAccess(profile?.role)) {
      setRows([]);
      setTeachers([]);
      setBatches([]);
      setError('Teacher operations access is not available for this account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [studentUsersSnapshot, teacherUsersSnapshot, studentRecordsSnapshot, batchesSnapshot] =
        await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'batches')),
        ]);

      const teacherDirectory = teacherUsersSnapshot.docs.map((teacherDoc) => {
        const teacherData = teacherDoc.data() as Partial<UserProfile>;
        return {
          id: teacherDoc.id,
          name: teacherData.name || 'Unnamed Teacher',
          email: teacherData.email || '',
        };
      });

      const teacherMap = new Map(teacherDirectory.map((teacher) => [teacher.id, teacher]));

      if (profile?.uid && !teacherMap.has(profile.uid) && profile.role === 'teacher') {
        teacherMap.set(profile.uid, {
          id: profile.uid,
          name: profile.name,
          email: profile.email,
        });
      }

      const batchDirectory = batchesSnapshot.docs
        .map((batchDoc) => {
          const batchData = batchDoc.data() as Record<string, unknown>;
          return {
            id: batchDoc.id,
            name: (batchData.name as string) || 'Unnamed Batch',
            courseId: batchData.courseId as string | undefined,
            teacherId: batchData.teacherId as string | undefined,
            status: batchData.status as string | undefined,
            currentStudents: batchData.currentStudents as number | undefined,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name));

      const batchMap = new Map(batchDirectory.map((batch) => [batch.id, batch]));
      const studentRecordMap = new Map<string, Partial<StudentData>>();

      studentRecordsSnapshot.docs.forEach((studentDoc) => {
        studentRecordMap.set(studentDoc.id, studentDoc.data() as Partial<StudentData>);
      });

      const nextRows = studentUsersSnapshot.docs
        .map((studentDoc) => {
          const userData = studentDoc.data() as Partial<UserProfile> & {
            onboardingStatus?: OnboardingStatus;
          };
          const studentRecord = studentRecordMap.get(studentDoc.id);
          const joinDate = resolveStudentJoinDate(
            studentRecord,
            toDateValue(userData.createdAt) || new Date()
          );
          const batchId = studentRecord?.batchId || studentRecord?.batchInfo?.batchId;
          const batch = batchId ? batchMap.get(batchId) : undefined;
          const progressPercent =
            typeof studentRecord?.batchInfo?.progressPercent === 'number'
              ? clampProgress(studentRecord.batchInfo.progressPercent)
              : getProgressForStatus(
                  normalizeTrainerStatus(
                    studentRecord?.status ||
                      studentRecord?.learningStage ||
                      studentRecord?.trainingStatus ||
                      studentRecord?.onboardingStatus,
                    0
                  )
                );
          const currentStatus = normalizeTrainerStatus(
            studentRecord?.status ||
              studentRecord?.learningStage ||
              studentRecord?.trainingStatus ||
              studentRecord?.onboardingStatus,
            progressPercent
          );
          const assignedTeacherId =
            studentRecord?.assignedTeacherId || batch?.teacherId || profile?.uid;
          const assignedTeacherName =
            studentRecord?.assignedTeacherName ||
            (assignedTeacherId ? teacherMap.get(assignedTeacherId)?.name : undefined) ||
            (assignedTeacherId === profile?.uid ? profile?.name : undefined) ||
            'Unassigned Teacher';

          return {
            uid: studentDoc.id,
            name: userData.name || 'Unknown Student',
            email: userData.email || 'No email',
            role: userData.role || 'student',
            courseId: studentRecord?.courseId || batch?.courseId,
            joinDate,
            joinDateLabel: formatDateLabel(joinDate),
            approvalStatus: resolveApprovalStatus(studentRecord, userData),
            batchId,
            batchName:
              studentRecord?.batchName ||
              batch?.name ||
              formatWeekBatchName(getWeekStartDate(joinDate)),
            assignedTeacherId,
            assignedTeacherName,
            currentModule: studentRecord?.currentModule || DEFAULT_MODULE_TITLE,
            currentModuleId: studentRecord?.currentModuleId || DEFAULT_MODULE_ID,
            currentLesson: studentRecord?.currentLesson || DEFAULT_LESSON_TITLE,
            currentLessonId: studentRecord?.currentLessonId || DEFAULT_LESSON_ID,
            progressPercent,
            currentStatus,
            attendanceRate:
              typeof studentRecord?.batchInfo?.attendanceRate === 'number'
                ? studentRecord.batchInfo.attendanceRate
                : null,
            lastActive: toDateValue(studentRecord?.lastActive),
            accessUnlocked: studentRecord?.accessUnlocked,
            trainingStatus: studentRecord?.trainingStatus,
            paymentStatus: studentRecord?.trainingPaymentStatus,
            trainerNotes: studentRecord?.trainerNotes,
            lessonDeadline: studentRecord?.lessonDeadline || null,
            nextAction: studentRecord?.nextAction,
            studentRecord,
          } satisfies TeacherManagedStudentRow;
        })
        .sort((left, right) => right.joinDate.getTime() - left.joinDate.getTime());

      setRows(nextRows);
      setTeachers(
        Array.from(teacherMap.values()).sort((left, right) => left.name.localeCompare(right.name))
      );
      setBatches(batchDirectory);
      setProgressDrafts(
        Object.fromEntries(nextRows.map((student) => [student.uid, `${student.progressPercent}`]))
      );
    } catch (fetchError) {
      console.error('Error loading teacher management data:', fetchError);
      setError('Failed to load student management data.');
    } finally {
      setLoading(false);
    }
  }, [profile?.email, profile?.name, profile?.role, profile?.uid]);

  useEffect(() => {
    fetchManagementData();
  }, [fetchManagementData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, approvalFilter, statusFilter, batchFilter, teacherFilter, mode]);

  useEffect(() => {
    const resolvedModule = modules.find((module) => module.id === bulkModuleId) || modules[0];
    if (!resolvedModule) {
      return;
    }

    const lessonExists = resolvedModule.lessons.some((lesson) => lesson.id === bulkLessonId);
    if (!lessonExists) {
      setBulkLessonId(resolvedModule.lessons[0]?.id || DEFAULT_LESSON_ID);
    }
  }, [bulkLessonId, bulkModuleId, modules]);

  const buildBatchInfoPayload = useCallback(
    (
      student: TeacherManagedStudentRow,
      overrides?: Partial<{
        batchId: string;
        progressPercent: number;
        currentLessonId: string;
        currentLessonOrder: number;
      }>
    ) => {
      const existingBatchInfo = student.studentRecord?.batchInfo;
      const currentLessonId =
        overrides?.currentLessonId ||
        student.currentLessonId ||
        existingBatchInfo?.currentLessonId ||
        DEFAULT_LESSON_ID;
      const currentModuleId = student.currentModuleId || DEFAULT_MODULE_ID;

      return {
        batchId:
          overrides?.batchId ?? student.batchId ?? existingBatchInfo?.batchId ?? '',
        joinedAt: existingBatchInfo?.joinedAt || student.joinDate,
        currentWeek: existingBatchInfo?.currentWeek || 1,
        progressPercent:
          overrides?.progressPercent ??
          student.progressPercent ??
          existingBatchInfo?.progressPercent ??
          0,
        currentLessonId,
        currentLessonOrder:
          overrides?.currentLessonOrder ??
          existingBatchInfo?.currentLessonOrder ??
          getLessonOrder(currentModuleId, currentLessonId),
        ...(existingBatchInfo?.attendanceRate !== undefined && {
          attendanceRate: existingBatchInfo.attendanceRate,
        }),
        ...(existingBatchInfo?.lastAttendanceDate && {
          lastAttendanceDate: existingBatchInfo.lastAttendanceDate,
        }),
      };
    },
    []
  );

  const saveStudentRecord = useCallback(
    async (studentUid: string, updates: Record<string, unknown>) => {
      await setDoc(
        doc(db, 'students', studentUid),
        {
          uid: studentUid,
          ...updates,
          updatedAt: serverTimestamp(),
          lastStatusUpdate: serverTimestamp(),
        },
        { merge: true }
      );
    },
    []
  );

  const saveUserMirror = useCallback(async (studentUid: string, updates: Record<string, unknown>) => {
    await setDoc(doc(db, 'users', studentUid), updates, { merge: true });
  }, []);

  const saveEnrollmentRecord = useCallback(
    async (
      enrollmentId: string | undefined,
      status: 'approved' | 'rejected'
    ) => {
      if (!enrollmentId) {
        return;
      }

      await setDoc(
        doc(db, 'breemicEnrollments', enrollmentId),
        {
          status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    []
  );

  const approveStudentRecord = useCallback(
    async (student: TeacherManagedStudentRow) => {
      const resolvedCourseId =
        student.courseId ||
        batches.find((batch) => batch.id === student.batchId)?.courseId ||
        profile?.assignedCourseId;

      if (!resolvedCourseId) {
        throw new Error(`Unable to approve ${student.name} because no course is assigned.`);
      }

      await ensureStudentAutoAssignment({
        studentUid: student.uid,
        courseId: resolvedCourseId,
        teacherId: student.assignedTeacherId || profile?.uid,
        joinDate: student.joinDate,
        studentData: {
          ...student.studentRecord,
          courseId: resolvedCourseId,
          assignedTeacherId: student.assignedTeacherId || profile?.uid || undefined,
          assignedTeacherName: student.assignedTeacherName || profile?.name || undefined,
          currentModule: DEFAULT_MODULE_TITLE,
          currentModuleId: DEFAULT_MODULE_ID,
          currentLesson: DEFAULT_LESSON_TITLE,
          currentLessonId: DEFAULT_LESSON_ID,
          status: 'New',
          learningStage: 'New',
          nextAction: DEFAULT_NEXT_ACTION,
          batchInfo: {
            ...student.studentRecord?.batchInfo,
            joinedAt: student.studentRecord?.batchInfo?.joinedAt || student.joinDate,
            currentWeek: student.studentRecord?.batchInfo?.currentWeek || 1,
            progressPercent: 0,
            currentLessonId: DEFAULT_LESSON_ID,
            currentLessonOrder: 1,
          },
        },
        additionalStudentUpdates: {
          onboardingStatus: 'approved',
          accessUnlocked: true,
          trainingStatus: 'active',
          currentModule: DEFAULT_MODULE_TITLE,
          currentModuleId: DEFAULT_MODULE_ID,
          currentLesson: DEFAULT_LESSON_TITLE,
          currentLessonId: DEFAULT_LESSON_ID,
          status: 'New',
          learningStage: 'New',
          nextAction: DEFAULT_NEXT_ACTION,
          approvedBy: profile?.uid || null,
          approvedAt: serverTimestamp(),
        },
      });

      await saveUserMirror(student.uid, {
        onboardingStatus: 'approved',
      });

      await saveEnrollmentRecord(student.studentRecord?.breemicEnrollmentId, 'approved');
    },
    [batches, profile?.assignedCourseId, profile?.name, profile?.uid, saveEnrollmentRecord, saveUserMirror]
  );

  const rejectStudentRecord = useCallback(
    async (student: TeacherManagedStudentRow) => {
      await saveStudentRecord(student.uid, {
        onboardingStatus: 'rejected',
        accessUnlocked: false,
        trainingStatus: 'inactive',
        rejectionReason: 'Rejected by teacher',
        rejectedAt: serverTimestamp(),
      });

      await saveUserMirror(student.uid, {
        onboardingStatus: 'rejected',
      });

      await saveEnrollmentRecord(student.studentRecord?.breemicEnrollmentId, 'rejected');
    },
    [saveEnrollmentRecord, saveStudentRecord, saveUserMirror]
  );

  const assignBatchRecord = useCallback(
    async (student: TeacherManagedStudentRow, batchId: string) => {
      const selectedBatch = batches.find((batch) => batch.id === batchId);
      const previousBatchId = student.batchId;

      if (!selectedBatch) {
        throw new Error('Select a valid batch before saving.');
      }

      const assignedTeacher = teachers.find((teacher) => teacher.id === selectedBatch.teacherId);

      await saveStudentRecord(student.uid, {
        courseId: selectedBatch.courseId || student.courseId || null,
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        assignedTeacherId: selectedBatch.teacherId || student.assignedTeacherId || null,
        assignedTeacherName:
          assignedTeacher?.name ||
          student.assignedTeacherName ||
          'Unassigned Teacher',
        batchInfo: buildBatchInfoPayload(student, {
          batchId: selectedBatch.id,
        }),
      });

      await syncBatchStudentCount(selectedBatch.id);

      if (previousBatchId && previousBatchId !== selectedBatch.id) {
        await syncBatchStudentCount(previousBatchId);
      }
    },
    [batches, buildBatchInfoPayload, saveStudentRecord, teachers]
  );

  const assignTeacherRecord = useCallback(
    async (student: TeacherManagedStudentRow, teacherId: string) => {
      const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId);

      await saveStudentRecord(student.uid, {
        assignedTeacherId: teacherId || null,
        assignedTeacherName: selectedTeacher?.name || 'Unassigned Teacher',
      });
    },
    [saveStudentRecord, teachers]
  );

  const updateStatusRecord = useCallback(
    async (student: TeacherManagedStudentRow, status: TrainerAssignmentStatus) => {
      const nextProgress = getProgressForStatus(status, student.progressPercent);

      await saveStudentRecord(student.uid, {
        status,
        learningStage: status,
        trainingStatus: status === 'Completed' ? 'completed' : 'active',
        batchInfo: buildBatchInfoPayload(student, {
          progressPercent: nextProgress,
        }),
      });
    },
    [buildBatchInfoPayload, saveStudentRecord]
  );

  const updateProgressRecord = useCallback(
    async (student: TeacherManagedStudentRow, progressPercent: number) => {
      const normalizedProgress = clampProgress(progressPercent);
      const normalizedStatus = normalizeTrainerStatus(student.currentStatus, normalizedProgress);

      await saveStudentRecord(student.uid, {
        status: normalizedStatus,
        learningStage: normalizedStatus,
        trainingStatus: normalizedStatus === 'Completed' ? 'completed' : 'active',
        batchInfo: buildBatchInfoPayload(student, {
          progressPercent: normalizedProgress,
        }),
      });
    },
    [buildBatchInfoPayload, saveStudentRecord]
  );

  const updateLessonRecord = useCallback(
    async (student: TeacherManagedStudentRow, payload: AssignLessonPayload) => {
      await saveStudentRecord(student.uid, {
        currentModule: payload.moduleTitle,
        currentModuleId: payload.moduleId,
        currentLesson: payload.lessonTitle,
        currentLessonId: payload.lessonId,
        status: payload.status,
        learningStage: payload.status,
        trainingStatus: payload.status === 'Completed' ? 'completed' : 'active',
        nextAction: payload.nextAction,
        trainerNotes: payload.notes,
        lessonDeadline: payload.deadline,
        batchInfo: buildBatchInfoPayload(student, {
          progressPercent: payload.progressPercent,
          currentLessonId: payload.lessonId,
          currentLessonOrder: payload.lessonOrder,
        }),
      });
    },
    [buildBatchInfoPayload, saveStudentRecord]
  );

  const setModuleRecord = useCallback(
    async (student: TeacherManagedStudentRow, moduleId: string, lessonId?: string) => {
      const selectedModule = modules.find((module) => module.id === moduleId);
      const selectedLesson =
        selectedModule?.lessons.find((lesson) => lesson.id === lessonId) ||
        selectedModule?.lessons[0];

      if (!selectedModule || !selectedLesson) {
        throw new Error('Choose a valid module and lesson.');
      }

      await saveStudentRecord(student.uid, {
        currentModule: selectedModule.title,
        currentModuleId: selectedModule.id,
        currentLesson: selectedLesson.title,
        currentLessonId: selectedLesson.id,
        nextAction: selectedLesson.nextAction || `Complete ${selectedLesson.title}`,
        batchInfo: buildBatchInfoPayload(student, {
          currentLessonId: selectedLesson.id,
          currentLessonOrder: selectedLesson.order,
        }),
      });
    },
    [buildBatchInfoPayload, modules, saveStudentRecord]
  );

  const autoAssignStarterRecord = useCallback(
    async (student: TeacherManagedStudentRow) => {
      await saveStudentRecord(student.uid, {
        currentModule: DEFAULT_MODULE_TITLE,
        currentModuleId: DEFAULT_MODULE_ID,
        currentLesson: DEFAULT_LESSON_TITLE,
        currentLessonId: DEFAULT_LESSON_ID,
        status: 'New',
        learningStage: 'New',
        trainingStatus: student.approvalStatus === 'approved' ? 'active' : 'inactive',
        nextAction: DEFAULT_NEXT_ACTION,
        batchInfo: buildBatchInfoPayload(student, {
          progressPercent: 0,
          currentLessonId: DEFAULT_LESSON_ID,
          currentLessonOrder: 1,
        }),
      });
    },
    [buildBatchInfoPayload, saveStudentRecord]
  );

  const runAction = useCallback(
    async (nextActionKey: string, work: () => Promise<void>, successMessage: string) => {
      setActionKey(nextActionKey);

      try {
        await work();
        await fetchManagementData();
        showToast(successMessage, 'success');
      } catch (saveError) {
        console.error('Teacher student operation failed:', saveError);
        showToast(
          saveError instanceof Error ? saveError.message : 'Unable to save changes.',
          'error'
        );
      } finally {
        setActionKey(null);
      }
    },
    [fetchManagementData, showToast]
  );

  const filteredRows = useMemo(() => {
    let nextRows = [...rows];

    if (mode === 'approvals') {
      nextRows = nextRows.filter((student) => isApprovalPending(student.approvalStatus));
    }

    if (approvalFilter !== 'all') {
      nextRows = nextRows.filter((student) => {
        if (approvalFilter === 'needs_attention') {
          return isApprovalPending(student.approvalStatus);
        }

        return student.approvalStatus === approvalFilter;
      });
    }

    if (statusFilter !== 'all') {
      nextRows = nextRows.filter((student) => student.currentStatus === statusFilter);
    }

    if (batchFilter !== 'all') {
      nextRows = nextRows.filter((student) => student.batchId === batchFilter);
    }

    if (teacherFilter !== 'all') {
      nextRows = nextRows.filter((student) => student.assignedTeacherId === teacherFilter);
    }

    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      nextRows = nextRows.filter((student) =>
        [
          student.name,
          student.email,
          student.batchName,
          student.currentModule,
          student.currentLesson,
          student.assignedTeacherName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch))
      );
    }

    const getSortValue = (student: TeacherManagedStudentRow) => {
      switch (sortKey) {
        case 'joinDate':
          return student.joinDate.getTime();
        case 'lastActive':
          return student.lastActive?.getTime() || 0;
        case 'attendanceRate':
          return student.attendanceRate ?? -1;
        case 'progressPercent':
          return student.progressPercent;
        default:
          return (student[sortKey] || '') as string;
      }
    };

    nextRows.sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);

      if (leftValue < rightValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }

      if (leftValue > rightValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }

      return 0;
    });

    return nextRows;
  }, [approvalFilter, batchFilter, mode, rows, searchTerm, sortDirection, sortKey, statusFilter, teacherFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredRows]);

  const selectedRows = useMemo(
    () => filteredRows.filter((student) => selectedIds.has(student.uid)),
    [filteredRows, selectedIds]
  );

  const currentPageIds = paginatedRows.map((student) => student.uid);
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((studentId) => selectedIds.has(studentId));

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (mode === 'approvals') {
      return [
        {
          title: 'Pending Review',
          value: rows.filter((student) => isApprovalPending(student.approvalStatus)).length,
          tone: 'bg-blue-50 text-blue-700',
        },
        {
          title: 'Signup Complete',
          value: rows.filter((student) => student.approvalStatus === 'signup_complete').length,
          tone: 'bg-amber-50 text-amber-700',
        },
        {
          title: 'Approved',
          value: rows.filter((student) => student.approvalStatus === 'approved').length,
          tone: 'bg-emerald-50 text-emerald-700',
        },
        {
          title: 'Rejected',
          value: rows.filter((student) => student.approvalStatus === 'rejected').length,
          tone: 'bg-red-50 text-red-700',
        },
      ];
    }

    return [
      {
        title: 'New Students',
        value: rows.filter((student) => student.currentStatus === 'New').length,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        title: 'In Progress',
        value: rows.filter((student) => student.currentStatus === 'In Progress').length,
        tone: 'bg-blue-50 text-blue-700',
      },
      {
        title: 'Almost Done',
        value: rows.filter((student) => student.currentStatus === 'Almost Done').length,
        tone: 'bg-purple-50 text-purple-700',
      },
      {
        title: 'Completed',
        value: rows.filter((student) => student.currentStatus === 'Completed').length,
        tone: 'bg-emerald-50 text-emerald-700',
      },
    ];
  }, [mode, rows]);

  const bulkModule = modules.find((module) => module.id === bulkModuleId) || modules[0];
  const bulkLessons = bulkModule?.lessons || [];

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === 'joinDate' ? 'desc' : 'asc');
  };

  const handleToggleAllCurrentPage = () => {
    setSelectedIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (allCurrentPageSelected) {
        currentPageIds.forEach((studentId) => nextSelection.delete(studentId));
      } else {
        currentPageIds.forEach((studentId) => nextSelection.add(studentId));
      }

      return nextSelection;
    });
  };

  const handleProgressChange = (studentUid: string, nextValue: string) => {
    setProgressDrafts((currentDrafts) => ({
      ...currentDrafts,
      [studentUid]: nextValue,
    }));
  };

  const handleProgressCommit = (student: TeacherManagedStudentRow) => {
    const draftedValue = progressDrafts[student.uid] ?? `${student.progressPercent}`;
    const parsedValue = Number(draftedValue);

    if (Number.isNaN(parsedValue)) {
      setProgressDrafts((currentDrafts) => ({
        ...currentDrafts,
        [student.uid]: `${student.progressPercent}`,
      }));
      return;
    }

    const normalizedValue = clampProgress(parsedValue);

    if (normalizedValue === student.progressPercent) {
      setProgressDrafts((currentDrafts) => ({
        ...currentDrafts,
        [student.uid]: `${student.progressPercent}`,
      }));
      return;
    }

    void runAction(
      `progress:${student.uid}`,
      async () => {
        await updateProgressRecord(student, normalizedValue);
      },
      'Student progress updated.'
    );
  };

  const handleBulkApply = async () => {
    if (selectedRows.length === 0) {
      showToast('Select at least one student first.', 'warning');
      return;
    }

    if (!bulkAction) {
      showToast('Choose a bulk action to apply.', 'warning');
      return;
    }

    if (bulkAction === 'export') {
      downloadRowsCsv(
        selectedRows,
        `teacher-students-selected-${new Date().toISOString().slice(0, 10)}.csv`
      );
      showToast('Selected students exported.', 'success');
      return;
    }

    const selectedLesson =
      bulkAction === 'set_lesson'
        ? bulkLessons.find((lesson) => lesson.id === bulkLessonId)
        : bulkLessons[0];

    void runAction(
      `bulk:${bulkAction}`,
      async () => {
        await Promise.all(
          selectedRows.map(async (student) => {
            switch (bulkAction) {
              case 'approve':
                await approveStudentRecord(student);
                break;
              case 'reject':
                await rejectStudentRecord(student);
                break;
              case 'assign_batch':
                if (!bulkBatchId) {
                  throw new Error('Choose a batch for the bulk assignment.');
                }
                await assignBatchRecord(student, bulkBatchId);
                break;
              case 'set_status':
                await updateStatusRecord(student, bulkStatus);
                break;
              case 'set_module':
                if (!bulkModuleId) {
                  throw new Error('Choose a module before applying.');
                }
                await setModuleRecord(student, bulkModuleId, bulkLessons[0]?.id);
                break;
              case 'set_lesson':
                if (!bulkModuleId || !selectedLesson) {
                  throw new Error('Choose a module and lesson before applying.');
                }
                await setModuleRecord(student, bulkModuleId, selectedLesson.id);
                break;
              default:
                break;
            }
          })
        );
      },
      'Bulk action applied successfully.'
    );

    setSelectedIds(new Set());
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4 animate-pulse">
          <div className="h-12 rounded-2xl bg-gray-100" />
          <div className="h-64 rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold tracking-tight text-black">Unable to load student management</h3>
        <p className="mt-2 text-sm text-gray-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            void fetchManagementData();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-red-100"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={cn('rounded-2xl px-3 py-1 text-xs font-semibold', card.tone)}>
                {card.title}
              </div>
              <Users size={18} className="text-gray-500" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-gray-200 px-5 py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by student, batch, lesson, or teacher"
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-black outline-none transition-colors focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void fetchManagementData();
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadRowsCsv(
                    filteredRows,
                    `teacher-students-${new Date().toISOString().slice(0, 10)}.csv`
                  )
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Download size={16} />
                Export Current View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={approvalFilter}
              onChange={(event) => setApprovalFilter(event.target.value as ApprovalFilter)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
            >
              <option value="all">All approval states</option>
              <option value="needs_attention">Needs attention</option>
              <option value="signup_complete">Signup complete</option>
              <option value="enrollment_submitted">Enrollment submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | TrainerAssignmentStatus)
              }
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
            >
              <option value="all">All learning stages</option>
              {TRAINER_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>

            <select
              value={batchFilter}
              onChange={(event) => setBatchFilter(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
            >
              <option value="all">All batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>

            <select
              value={teacherFilter}
              onChange={(event) => setTeacherFilter(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
            >
              <option value="all">All teachers</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-tight text-black">Bulk actions</p>
              <p className="text-sm text-gray-700">
                {selectedRows.length} selected of {filteredRows.length} filtered students
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[200px_180px_180px_150px_auto]">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as BulkActionType)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
              >
                <option value="">Choose action</option>
                <option value="approve">Approve selected</option>
                <option value="reject">Reject selected</option>
                <option value="assign_batch">Assign batch</option>
                <option value="set_status">Set status</option>
                <option value="set_module">Set module</option>
                <option value="set_lesson">Set lesson</option>
                <option value="export">Export selected</option>
              </select>

              {bulkAction === 'assign_batch' && (
                <select
                  value={bulkBatchId}
                  onChange={(event) => setBulkBatchId(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                >
                  <option value="">Choose batch</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === 'set_status' && (
                <select
                  value={bulkStatus}
                  onChange={(event) =>
                    setBulkStatus(event.target.value as TrainerAssignmentStatus)
                  }
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                >
                  {TRAINER_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
                </select>
              )}

              {(bulkAction === 'set_module' || bulkAction === 'set_lesson') && (
                <select
                  value={bulkModuleId}
                  onChange={(event) => setBulkModuleId(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === 'set_lesson' && (
                <select
                  value={bulkLessonId}
                  onChange={(event) => setBulkLessonId(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-purple-500"
                >
                  {bulkLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  void handleBulkApply();
                }}
                disabled={!selectedRows.length || Boolean(actionKey)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionKey?.startsWith('bulk:') ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <UserCheck size={16} />
                )}
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="max-h-[72vh] overflow-y-auto">
              <table className="min-w-[1620px] table-fixed border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    <th className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={handleToggleAllCurrentPage}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="w-[220px] px-4 py-4"><button type="button" onClick={() => toggleSort('name')}>Name</button></th>
                    <th className="w-[220px] px-4 py-4"><button type="button" onClick={() => toggleSort('email')}>Email</button></th>
                    <th className="w-[150px] px-4 py-4"><button type="button" onClick={() => toggleSort('joinDate')}>Join Date</button></th>
                    <th className="w-[150px] px-4 py-4"><button type="button" onClick={() => toggleSort('approvalStatus')}>Approval</button></th>
                    <th className="w-[180px] px-4 py-4"><button type="button" onClick={() => toggleSort('batchName')}>Batch</button></th>
                    <th className="w-[190px] px-4 py-4"><button type="button" onClick={() => toggleSort('assignedTeacherName')}>Assigned Teacher</button></th>
                    <th className="w-[150px] px-4 py-4"><button type="button" onClick={() => toggleSort('currentModule')}>Current Module</button></th>
                    <th className="w-[180px] px-4 py-4"><button type="button" onClick={() => toggleSort('currentLesson')}>Current Lesson</button></th>
                    <th className="w-[150px] px-4 py-4"><button type="button" onClick={() => toggleSort('progressPercent')}>Progress</button></th>
                    <th className="w-[150px] px-4 py-4"><button type="button" onClick={() => toggleSort('currentStatus')}>Student Status</button></th>
                    <th className="w-[130px] px-4 py-4"><button type="button" onClick={() => toggleSort('attendanceRate')}>Attendance</button></th>
                    <th className="w-[160px] px-4 py-4"><button type="button" onClick={() => toggleSort('lastActive')}>Last Active</button></th>
                    <th className="w-[170px] px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedRows.map((student) => (
                    <tr key={student.uid} className="align-top hover:bg-gray-50/80">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.uid)}
                          onChange={() =>
                            setSelectedIds((currentSelection) => {
                              const nextSelection = new Set(currentSelection);
                              if (nextSelection.has(student.uid)) {
                                nextSelection.delete(student.uid);
                              } else {
                                nextSelection.add(student.uid);
                              }
                              return nextSelection;
                            })
                          }
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold tracking-tight text-black">{student.name}</p>
                        <p className="mt-1 text-xs text-gray-500">{student.uid}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{student.email}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{student.joinDateLabel}</td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize', getApprovalBadgeClassName(student.approvalStatus))}>
                          {student.approvalStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={student.batchId || ''}
                          onChange={(event) => {
                            const nextBatchId = event.target.value;
                            void runAction(`batch:${student.uid}`, async () => {
                              await assignBatchRecord(student, nextBatchId);
                            }, 'Student batch updated.');
                          }}
                          disabled={Boolean(actionKey)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-purple-500 disabled:bg-gray-50"
                        >
                          <option value="">Select batch</option>
                          {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>{batch.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={student.assignedTeacherId || ''}
                          onChange={(event) => {
                            const nextTeacherId = event.target.value;
                            void runAction(`teacher:${student.uid}`, async () => {
                              await assignTeacherRecord(student, nextTeacherId);
                            }, 'Assigned teacher updated.');
                          }}
                          disabled={Boolean(actionKey)}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-black outline-none transition-colors focus:border-purple-500 disabled:bg-gray-50"
                        >
                          <option value="">Select teacher</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{student.currentModule}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{student.currentLesson}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-20 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-purple-600" style={{ width: `${student.progressPercent}%` }} />
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={progressDrafts[student.uid] ?? `${student.progressPercent}`}
                            onChange={(event) => handleProgressChange(student.uid, event.target.value)}
                            onBlur={() => handleProgressCommit(student)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleProgressCommit(student);
                              }
                            }}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-black outline-none transition-colors focus:border-purple-500"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={student.currentStatus}
                          onChange={(event) => {
                            const nextStatus = event.target.value as TrainerAssignmentStatus;
                            void runAction(`status:${student.uid}`, async () => {
                              await updateStatusRecord(student, nextStatus);
                            }, 'Student status updated.');
                          }}
                          disabled={Boolean(actionKey)}
                          className={cn('w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-purple-500', getStatusBadgeClassName(student.currentStatus))}
                        >
                          {TRAINER_STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>{statusOption}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {student.attendanceRate !== undefined && student.attendanceRate !== null ? `${Math.round(student.attendanceRate)}%` : '--'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCompactDateTime(student.lastActive)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/students/${student.uid}`)}
                            className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-black"
                            title="View student"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-black"
                            title="Edit assignment"
                          >
                            <PencilLine size={16} />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setMenuStudentId((currentId) => currentId === student.uid ? null : student.uid)}
                              className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-black"
                              title="More actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {menuStudentId === student.uid && (
                              <div className="absolute right-0 top-12 z-20 w-52 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuStudentId(null);
                                    void runAction(`approve:${student.uid}`, async () => {
                                      await approveStudentRecord(student);
                                    }, 'Student approved and auto-assigned.');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                  <CheckCircle2 size={16} />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuStudentId(null);
                                    void runAction(`reject:${student.uid}`, async () => {
                                      await rejectStudentRecord(student);
                                    }, 'Student rejected.');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                                >
                                  <XCircle size={16} />
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuStudentId(null);
                                    void runAction(`starter:${student.uid}`, async () => {
                                      await autoAssignStarterRecord(student);
                                    }, 'Starter lesson assigned.');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700"
                                >
                                  <UserCheck size={16} />
                                  Auto-assign first lesson
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 && (
          <div className="border-t border-gray-200 px-6 py-12 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-black">No students found</h3>
            <p className="mt-2 text-sm text-gray-700">
              Try adjusting the search or filters. Teachers can manage approvals, batches, lessons,
              and progress from this table.
            </p>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[110px] text-center font-medium text-black">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AssignLessonModal
        isOpen={Boolean(editingStudent)}
        student={editingStudent}
        modules={modules}
        isSaving={Boolean(actionKey?.startsWith('lesson:'))}
        onClose={() => {
          if (!actionKey?.startsWith('lesson:')) {
            setEditingStudent(null);
          }
        }}
        onAssign={async (payload: AssignLessonPayload) => {
          if (!editingStudent) {
            return;
          }

          await runAction(
            `lesson:${editingStudent.uid}`,
            async () => {
              await updateLessonRecord(editingStudent, payload);
            },
            'Student assignment updated.'
          );
          setEditingStudent(null);
        }}
      />
    </div>
  );
};
