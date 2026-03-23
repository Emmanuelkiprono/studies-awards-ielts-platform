export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  academyId: string;
  createdAt: any; // Firestore Timestamp
  fcmToken: string | null;
  avatarUrl?: string;
  assignedCourseId?: string;
  phone?: string;
  title?: string;
  bio?: string;
  updatedAt?: any;
}

export type TrainingStatus = 'inactive' | 'active' | 'completed' | 'locked';
// Legacy values kept for backwards compatibility (not_started, scheduled, done, results_released)
// New booking flow primarily uses: not_eligible → eligible → pending_booking → booked → completed
export type ExamStatus =
  | 'not_started'
  | 'pending_booking'
  | 'scheduled'
  | 'done'
  | 'results_released'
  | 'not_eligible'
  | 'eligible'
  | 'booked'
  | 'completed';
export type PaymentStatus = 'unpaid' | 'paid' | 'pending';
export type ExamBookingStatus = 'pending' | 'processing' | 'booked' | 'rejected';
export type ExamBookingProvider = 'British Council' | 'IDP';
export type ExamBookingMode = 'paper_based' | 'computer_based';
export type ExamBookingType = 'IELTS Academic' | 'IELTS UKVI';

// Student onboarding states.
// The simplified production flow uses:
// signup_complete -> enrollment_submitted -> approved / rejected
// Legacy values remain in the type temporarily for backwards-compatible reads.
export type OnboardingStatus =
  | 'signup_complete'
  | 'enrollment_submitted'
  | 'approved'
  | 'rejected'
  | 'account_created'
  | 'enrollment_pending'
  | 'payment_pending'
  | 'approval_pending'
  | 'suspended';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'credit_card' | 'other';

export interface PaymentInfo {
  amountPaid: number;
  balance: number;
  paymentMethod: PaymentMethod;
  transactionCode?: string;
  paymentDate?: string;
  verifiedBy?: string;
  verifiedAt?: any;
  notes?: string;
}

export interface RejectionInfo {
  reason: string;
  rejectedBy: string;
  rejectedAt: any;
  canResubmit: boolean;
  resubmissionDeadline?: string;
}

// Batch / Cohort System
export type BatchStatus = 'active' | 'completed' | 'suspended' | 'upcoming';

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  startDate: any; // Firestore Timestamp
  endDate?: any; // Firestore Timestamp
  weekNumber: number;
  teacherId: string;
  status: BatchStatus;
  maxStudents?: number;
  currentStudents: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  schedule?: {
    weekdays: string[]; // ['monday', 'tuesday', etc.]
    startTime: string; // '09:00'
    endTime: string; // '11:00'
  };
}

// Extended StudentData with batch information
export interface StudentBatchInfo {
  batchId: string;
  joinedAt: any; // Firestore Timestamp
  currentLessonId?: string;
  currentLessonOrder?: number;
  currentWeek: number;
  progressPercent: number;
  attendanceRate?: number;
  lastAttendanceDate?: any; // Firestore Timestamp
}

export interface StudentLessonHistoryItem {
  id: string;
  module: string;
  lesson: string;
  stage: string;
  assignedAt?: string;
  completedAt?: string;
  notes?: string;
}

// Lesson System
export type LessonStatus = 'draft' | 'published' | 'archived';

export interface Lesson {
  id: string;
  courseId: string;
  batchId: string;
  weekNumber: number;
  title: string;
  description: string;
  materials: LessonMaterial[];
  order: number;
  liveEnabled: boolean;
  status: LessonStatus;
  teacherId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  scheduledDate?: any; // Firestore Timestamp
  duration?: number; // minutes
}

export interface LessonMaterial {
  id: string;
  name: string;
  type: 'document' | 'video' | 'image' | 'link' | 'assignment';
  url: string;
  size?: number;
  uploadedAt: any; // Firestore Timestamp
}

// Live Session System
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface LiveSession {
  id: string;
  lessonId: string;
  batchId: string;
  teacherId: string;
  title: string;
  courseId?: string;
  moduleId?: string;
  startTime?: string;
  endTime?: string;
  meetingLink?: string;
  meetingUrl?: string;
  meetingId?: string; // For Daily.co or other video providers
  roomUrl?: string;
  isLive?: boolean;
  startedAt?: any; // Firestore Timestamp
  endedAt?: any; // Firestore Timestamp
  status: LiveSessionStatus;
  attendanceOpen: boolean;
  attendanceClosed: boolean;
  scheduledAt?: any; // Firestore Timestamp
  duration?: number; // actual duration in minutes
  participantsCount?: number;
  createdAt: any; // Firestore Timestamp
  notes?: string;
}

// Attendance System
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Attendance {
  id: string;
  sessionId: string;
  lessonId?: string;
  studentUid: string;
  studentId?: string;
  studentName?: string;
  teacherId?: string;
  teacherName?: string;
  batchId: string;
  batch?: string;
  sessionTitle?: string;
  date?: string;
  status: AttendanceStatus;
  markedAt?: any; // Firestore Timestamp
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  markedBy?: string; // teacherId
  lateMinutes?: number;
  notes?: string;
  autoMarked?: boolean; // true if marked by system when student joins
}

// Attendance Summary for reporting
export interface AttendanceSummary {
  batchId: string;
  lessonId: string;
  sessionId: string;
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendanceRate: number;
  date: any; // Firestore Timestamp
}

export interface StudentData {
  uid: string;
  // Identity fields (may also exist in users collection)
  name?: string;
  email?: string;
  phone?: string;
  
  // Training and payment fields
  trainingPaymentStatus: PaymentStatus;
  trainingStatus: TrainingStatus;
  examPaymentStatus: PaymentStatus;
  examStatus: ExamStatus;
  
  // Course and enrollment
  preferredLocation: string | null;
  idUploadUrl: string | null;
  courseId?: string;
  targetScore?: number;
  currentScore?: number;
  enrollmentDate?: any;         // Firestore Timestamp
  lastActive?: any;             // Firestore Timestamp
  
  // Optional exam tracking fields for dashboard convenience
  registrationDate?: any;       // Firestore Timestamp
  eligibleExamDate?: string;    // ISO date
  examDate?: string;            // ISO date
  examCenter?: string;
  bookingReference?: string;
  examBookingId?: string;
  examBookingStatus?: ExamBookingStatus;
  bandScore?: {
    overall: number;
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
  };
  
  // Breemic International Approval Workflow Fields
  onboardingStatus: OnboardingStatus;
  breemicEnrollmentId?: string;  // Reference to BreemicEnrollment document
  enrollmentCompleted?: boolean; // Whether enrollment form has been completed
  paymentInfo?: PaymentInfo;
  rejectionInfo?: RejectionInfo;
  approvedBy?: string;
  approvedAt?: any;
  lastStatusUpdate?: any;
  onboardingCompletedAt?: any;    // When student completes full onboarding
  accessUnlocked?: boolean;        // Whether course access has been unlocked
  
  // Batch System Fields
  batchId?: string;               // Current batch assignment
  batchName?: string;             // Human-readable weekly batch label
  batchInfo?: StudentBatchInfo;   // Detailed batch information
  assignedTeacherId?: string;
  assignedTeacherName?: string;

  // Simple trainer assignment fields
  currentModule?: string;
  currentModuleId?: string;
  currentLesson?: string;
  currentLessonId?: string;
  status?: string;
  learningStage?: string;
  nextAction?: string;
  trainerNotes?: string;
  lessonDeadline?: string | null;
  lessonHistory?: StudentLessonHistoryItem[];
}

export interface Course {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  trainingPrice: number;
  examPrice: number;
  active: boolean;
  createdAt: any;
  teacherId?: string;
}

export interface Module {
  id: string;
  courseId: string;
  name: string;
  description: string;
  order: number;
  createdAt: any;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  description: string;
  videoUrl?: string;
  pdfUrl?: string;
  pdfFileName?: string;
  imageUrl?: string;
  imageFileName?: string;
  durationMinutes: number;
  order: number;
  createdAt: any;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  trainingStatus: "inactive" | "active" | "completed" | "locked";
  examStatus: ExamStatus;
  paymentStatus: string;
  // Registration & eligibility
  registeredAt?: any;          // Firestore Timestamp
  registrationDate?: any;      // Firestore Timestamp (alias of registeredAt for clarity)
  eligibleAt?: string;         // ISO date
  eligibleExamDate?: string;   // ISO date (alias of eligibleAt for clarity)
  examFeeStatus?: PaymentStatus;
  programWeeks?: number;
  location?: {
    country: string;
    city: string;
    centerPreference: string;
  };
  preferredExamCenter?: string;

  // Exam booking details
  examDate?: string;           // ISO date
  examCenter?: string;
  bookingReference?: string;
  bookingNotes?: string;
  createdAt: any;
}

export interface ExamBooking {
  id: string;
  studentUid: string;
  courseId?: string;
  batchId?: string;
  batchName?: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  physicalChallenge?: string;
  mobileNumber: string;
  address: string;
  town: string;
  postalCode: string;
  passportOrIdNumber: string;
  idExpiryDate: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  levelOfEducation: string;
  provider: ExamBookingProvider;
  examDate: string;
  examMode: ExamBookingMode;
  examType: ExamBookingType;
  idPhotoUrl: string;
  idPhotoName?: string;
  status: ExamBookingStatus;
  notes?: string;
  rejectionReason?: string;
  bookingReference?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
  link?: string;
}

export interface BreemicEnrollment {
  id: string;
  studentUid?: string;
  userId?: string;
  courseId?: string;
  fullName: string;
  email: string;
  contact: string;
  dateOfEnrollment?: string;
  courseName?: string;
  courseDuration?: string;
  expectedDateOfCompletion?: string;
  modeOfTraining?: 'in-person' | 'online';
  physicalAddress?: string;
  idPassport?: string;
  highestLevelOfEducation?: string;
  supportingDocumentUrl?: string;
  supportingDocumentName?: string;
  courseType?: 'IELTS' | 'TOEFL' | 'PTE' | 'SAT' | 'TOEIC' | 'German' | 'French' | 'Chinese';
  feePaid?: number;
  balance?: number;
  officerInCharge?: string;
  createdAt: any;
  updatedAt: any;
  status: 'pending' | 'enrollment_submitted' | 'approved' | 'rejected' | 'completed';
  notes?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  courseId: string;
  type: 'writing' | 'listening' | 'reading' | 'speaking' | 'vocabulary';
  moduleId?: string;
  createdBy?: string;
  createdAt?: any;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  courseId: string;
  fileUrl?: string;
  fileName?: string;
  notes?: string;
  submittedAt: string;
  feedback?: string;
  bandScore?: number;
  status: 'pending' | 'graded';
  gradedAt?: string;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  message: string;
  createdAt: any;
  createdBy: string;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  type: 'video' | 'pdf' | 'tip';
  url: string;
  thumbnailUrl?: string;
  description?: string;
  createdAt: any;
  createdBy: string;
}
