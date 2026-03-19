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

// Breemic International Approval Workflow Stages
export type OnboardingStatus = 
  | 'account_created'
  | 'enrollment_pending'
  | 'payment_pending'
  | 'approval_pending'
  | 'approved'
  | 'rejected'
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

export interface StudentData {
  uid: string;
  trainingPaymentStatus: PaymentStatus;
  trainingStatus: TrainingStatus;
  examPaymentStatus: PaymentStatus;
  examStatus: ExamStatus;
  preferredLocation: string | null;
  idUploadUrl: string | null;
  courseId?: string;
  targetScore?: number;
  currentScore?: number;
  // Optional exam tracking fields for dashboard convenience
  registrationDate?: any;       // Firestore Timestamp
  eligibleExamDate?: string;    // ISO date
  examDate?: string;            // ISO date
  examCenter?: string;
  bookingReference?: string;
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

export interface Attendance {
  id: string;
  courseId: string;
  sessionId: string; // ID of the live class session
  studentId: string;
  status: 'present' | 'absent';
  date: string;
}

export interface LiveSession {
  id: string;
  courseId: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string;
}

export interface BreemicEnrollment {
  id: string;
  fullName: string;
  email: string;
  contact: string;
  dateOfEnrollment: string;
  courseDuration: string;
  expectedDateOfCompletion: string;
  modeOfTraining: 'in-person' | 'online';
  physicalAddress: string;
  idPassport: string;
  highestLevelOfEducation: string;
  courseType: 'IELTS' | 'TOEFL' | 'PTE' | 'SAT' | 'TOEIC' | 'German' | 'French' | 'Chinese';
  feePaid: number;
  balance: number;
  officerInCharge: string;
  createdAt: any;
  updatedAt: any;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
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
