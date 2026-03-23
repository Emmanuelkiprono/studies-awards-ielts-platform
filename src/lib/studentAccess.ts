import { OnboardingStatus, TrainingStatus } from '../types';

export type SimplifiedStudentStatus =
  | 'signup_complete'
  | 'enrollment_submitted'
  | 'approved'
  | 'rejected';

type StudentAccessRecord =
  | {
      onboardingStatus?: OnboardingStatus | string;
      accessUnlocked?: boolean;
      trainingStatus?: TrainingStatus | string;
    }
  | null
  | undefined;

export const getSimplifiedStudentStatus = (
  studentData: StudentAccessRecord
): SimplifiedStudentStatus => {
  if (
    studentData?.onboardingStatus === 'approved' ||
    studentData?.accessUnlocked === true ||
    studentData?.trainingStatus === 'active' ||
    studentData?.trainingStatus === 'completed'
  ) {
    return 'approved';
  }

  if (studentData?.onboardingStatus === 'rejected') {
    return 'rejected';
  }

  if (
    studentData?.onboardingStatus === 'signup_complete' ||
    studentData?.onboardingStatus === 'account_created' ||
    studentData?.onboardingStatus === 'enrollment_pending'
  ) {
    return 'signup_complete';
  }

  if (
    studentData?.onboardingStatus === 'enrollment_submitted' ||
    studentData?.onboardingStatus === 'payment_pending' ||
    studentData?.onboardingStatus === 'approval_pending'
  ) {
    return 'enrollment_submitted';
  }

  return 'signup_complete';
};

export const hasApprovedStudentAccess = (studentData: StudentAccessRecord) =>
  getSimplifiedStudentStatus(studentData) === 'approved';

export const getStudentFlowRoute = (studentData: StudentAccessRecord) => {
  const studentStatus = getSimplifiedStudentStatus(studentData);
  console.log('ENROLLMENT STATUS:', studentStatus);

  if (studentStatus === 'approved') {
    return '/dashboard';
  }

  if (studentStatus === 'enrollment_submitted' || studentStatus === 'rejected') {
    return '/pending-approval';
  }

  return '/enrollment';
};
