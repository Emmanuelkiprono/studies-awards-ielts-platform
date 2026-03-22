import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  DEFAULT_LESSON_ID,
  DEFAULT_LESSON_TITLE,
  DEFAULT_MODULE_ID,
  DEFAULT_MODULE_TITLE,
  DEFAULT_NEXT_ACTION,
  SAMPLE_LESSON_MODULES,
  TrainerAssignmentStatus,
  TRAINER_STATUS_OPTIONS,
} from '../data/lessonAssignmentData';
import { db } from '../services/firebase';
import { StudentData } from '../types';

interface StudentAssignmentSnapshot extends Partial<StudentData> {
  batchName?: string;
  currentModule?: string;
  currentModuleId?: string;
  currentLesson?: string;
  currentLessonId?: string;
  status?: string;
  learningStage?: string;
  nextAction?: string;
  trainerNotes?: string;
  lessonDeadline?: string | null;
  createdAt?: unknown;
}

interface EnsureStudentAutoAssignmentArgs {
  studentUid: string;
  courseId: string;
  teacherId?: string | null;
  joinDate?: Date;
  studentData?: StudentAssignmentSnapshot;
  additionalStudentUpdates?: Record<string, unknown>;
}

export interface AutoAssignmentResult {
  batchId: string;
  batchName: string;
  currentModule: string;
  currentModuleId: string;
  currentLesson: string;
  currentLessonId: string;
  nextAction: string;
  progressPercent: number;
  status: TrainerAssignmentStatus;
  teacherId: string;
  teacherName: string;
}

const FALLBACK_TEACHER_ID = 'unassigned';
const FALLBACK_TEACHER_NAME = 'Unassigned Teacher';

const DEFAULT_LESSON =
  SAMPLE_LESSON_MODULES.find((module) => module.id === DEFAULT_MODULE_ID)?.lessons.find(
    (lesson) => lesson.id === DEFAULT_LESSON_ID
  ) || SAMPLE_LESSON_MODULES[0]?.lessons[0];

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
    const dateValue = (value as { toDate?: () => Date }).toDate?.() ?? null;
    return dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : null;
  }

  return null;
};

const sanitizeIdPart = (value: string) => value.replace(/[^A-Za-z0-9_-]+/g, '_');

export const getWeekStartDate = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
};

const getWeekEndDate = (weekStart: Date) => {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getWeekDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
};

const getCalendarWeekNumber = (value: Date) => {
  const firstDayOfYear = new Date(value.getFullYear(), 0, 1);
  const differenceInDays = Math.floor((value.getTime() - firstDayOfYear.getTime()) / 86400000);
  return Math.floor((differenceInDays + firstDayOfYear.getDay()) / 7) + 1;
};

export const formatWeekBatchName = (value: Date) =>
  `Week of ${value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

export const resolveStudentJoinDate = (
  studentData?: StudentAssignmentSnapshot,
  fallbackDate = new Date()
) =>
  toDateValue(
    studentData?.batchInfo?.joinedAt ||
      studentData?.enrollmentDate ||
      studentData?.registrationDate ||
      studentData?.approvedAt ||
      studentData?.createdAt
  ) || fallbackDate;

export const normalizeTrainerStatus = (
  value?: string | null,
  progressPercent = 0
): TrainerAssignmentStatus => {
  if (value && TRAINER_STATUS_OPTIONS.includes(value as TrainerAssignmentStatus)) {
    return value as TrainerAssignmentStatus;
  }

  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue.includes('complete')) {
    return 'Completed';
  }

  if (normalizedValue.includes('almost') || normalizedValue.includes('advanced') || normalizedValue.includes('mock')) {
    return 'Almost Done';
  }

  if (
    normalizedValue.includes('progress') ||
    normalizedValue.includes('foundation') ||
    normalizedValue.includes('intermediate') ||
    normalizedValue.includes('active')
  ) {
    return progressPercent >= 80 ? 'Almost Done' : 'In Progress';
  }

  if (progressPercent >= 100) {
    return 'Completed';
  }

  if (progressPercent >= 80) {
    return 'Almost Done';
  }

  if (progressPercent > 0) {
    return 'In Progress';
  }

  return 'New';
};

export const getProgressForStatus = (
  status: TrainerAssignmentStatus,
  currentProgress = 0
) => {
  switch (status) {
    case 'Completed':
      return 100;
    case 'Almost Done':
      return currentProgress >= 80 && currentProgress < 100 ? currentProgress : 85;
    case 'In Progress':
      return currentProgress > 0 && currentProgress < 80 ? currentProgress : 40;
    case 'New':
    default:
      return 0;
  }
};

const resolveTeacherName = async (teacherId: string) => {
  if (!teacherId || teacherId === FALLBACK_TEACHER_ID) {
    return FALLBACK_TEACHER_NAME;
  }

  const teacherSnapshot = await getDoc(doc(db, 'users', teacherId));

  if (!teacherSnapshot.exists()) {
    return FALLBACK_TEACHER_NAME;
  }

  return teacherSnapshot.data().name || FALLBACK_TEACHER_NAME;
};

const resolveTeacherProfileForCourse = async (courseId: string, preferredTeacherId?: string | null) => {
  if (preferredTeacherId) {
    return {
      id: preferredTeacherId,
      name: await resolveTeacherName(preferredTeacherId),
    };
  }

  const teachersSnapshot = await getDocs(
    query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('assignedCourseId', '==', courseId)
    )
  );

  const teacherId = teachersSnapshot.docs[0]?.id || FALLBACK_TEACHER_ID;

  return {
    id: teacherId,
    name: await resolveTeacherName(teacherId),
  };
};

export const syncBatchStudentCount = async (batchId: string) => {
  const batchStudentsSnapshot = await getDocs(
    query(collection(db, 'students'), where('batchId', '==', batchId))
  );

  await setDoc(
    doc(db, 'batches', batchId),
    {
      currentStudents: batchStudentsSnapshot.size,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const ensureWeeklyBatch = async (courseId: string, joinDate: Date, teacherId?: string | null) => {
  const resolvedTeacherProfile = await resolveTeacherProfileForCourse(courseId, teacherId);
  const weekStart = getWeekStartDate(joinDate);
  const batchId = [
    'weekly',
    sanitizeIdPart(courseId),
    sanitizeIdPart(resolvedTeacherProfile.id),
    getWeekDateKey(weekStart),
  ].join('_');
  const batchName = formatWeekBatchName(weekStart);
  const batchRef = doc(db, 'batches', batchId);
  const batchSnapshot = await getDoc(batchRef);

  await setDoc(
    batchRef,
    {
      courseId,
      name: batchName,
      description: 'Auto-created weekly intake batch',
      startDate: Timestamp.fromDate(weekStart),
      endDate: Timestamp.fromDate(getWeekEndDate(weekStart)),
      weekNumber: getCalendarWeekNumber(weekStart),
      teacherId: resolvedTeacherProfile.id,
      status: 'active',
      currentStudents: batchSnapshot.exists()
        ? batchSnapshot.data().currentStudents || 0
        : 0,
      updatedAt: serverTimestamp(),
      ...(batchSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  return {
    batchId,
    batchName,
    teacherId: resolvedTeacherProfile.id,
    teacherName: resolvedTeacherProfile.name,
  };
};

export const ensureStudentAutoAssignment = async ({
  studentUid,
  courseId,
  teacherId,
  joinDate,
  studentData,
  additionalStudentUpdates = {},
}: EnsureStudentAutoAssignmentArgs): Promise<AutoAssignmentResult> => {
  const studentRef = doc(db, 'students', studentUid);
  const existingStudentSnapshot = studentData
    ? null
    : await getDoc(studentRef);
  const existingStudent =
    studentData ||
    (existingStudentSnapshot?.exists()
      ? (existingStudentSnapshot.data() as StudentAssignmentSnapshot)
      : undefined);
  const resolvedJoinDate = joinDate || resolveStudentJoinDate(existingStudent);
  const previousBatchId = existingStudent?.batchId || existingStudent?.batchInfo?.batchId;
  const {
    batchId,
    batchName,
    teacherId: resolvedTeacherId,
    teacherName: resolvedTeacherName,
  } = await ensureWeeklyBatch(
    courseId,
    resolvedJoinDate,
    teacherId
  );
  const currentStatus = normalizeTrainerStatus(
    existingStudent?.status || existingStudent?.learningStage,
    existingStudent?.batchInfo?.progressPercent || 0
  );
  const progressPercent = getProgressForStatus(
    currentStatus,
    existingStudent?.batchInfo?.progressPercent || 0
  );
  const currentModuleId = existingStudent?.currentModuleId || DEFAULT_MODULE_ID;
  const currentModule = existingStudent?.currentModule || DEFAULT_MODULE_TITLE;
  const currentLessonId = existingStudent?.currentLessonId || DEFAULT_LESSON_ID;
  const currentLesson = existingStudent?.currentLesson || DEFAULT_LESSON_TITLE;
  const nextAction = existingStudent?.nextAction || DEFAULT_LESSON?.nextAction || DEFAULT_NEXT_ACTION;
  const batchInfo = {
    batchId,
    joinedAt:
      existingStudent?.batchInfo?.joinedAt ||
      Timestamp.fromDate(resolvedJoinDate),
    currentWeek: existingStudent?.batchInfo?.currentWeek || 1,
    progressPercent,
    currentLessonId:
      existingStudent?.batchInfo?.currentLessonId || currentLessonId,
    currentLessonOrder:
      (existingStudent?.batchInfo as { currentLessonOrder?: number } | undefined)?.currentLessonOrder ||
      DEFAULT_LESSON?.order ||
      1,
    ...(existingStudent?.batchInfo?.attendanceRate !== undefined && {
      attendanceRate: existingStudent.batchInfo.attendanceRate,
    }),
    ...(existingStudent?.batchInfo?.lastAttendanceDate && {
      lastAttendanceDate: existingStudent.batchInfo.lastAttendanceDate,
    }),
  };

  await setDoc(
    studentRef,
    {
      uid: studentUid,
      courseId,
      batchId,
      batchName,
      assignedTeacherId: resolvedTeacherId,
      assignedTeacherName: resolvedTeacherName,
      currentModule,
      currentModuleId,
      currentLesson,
      currentLessonId,
      status: currentStatus,
      learningStage: currentStatus,
      nextAction,
      batchInfo,
      lastStatusUpdate: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...additionalStudentUpdates,
    },
    { merge: true }
  );

  await syncBatchStudentCount(batchId);

  if (previousBatchId && previousBatchId !== batchId) {
    await syncBatchStudentCount(previousBatchId);
  }

  return {
    batchId,
    batchName,
    currentModule,
    currentModuleId,
    currentLesson,
    currentLessonId,
    nextAction,
    progressPercent,
    status: currentStatus,
    teacherId: resolvedTeacherId,
    teacherName: resolvedTeacherName,
  };
};
