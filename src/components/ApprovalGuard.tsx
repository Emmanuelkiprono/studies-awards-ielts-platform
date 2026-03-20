import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { OnboardingStatus } from '../types';
import { AccessControlMessage } from './AccessControlMessage';

interface ApprovalGuardProps {
  children: React.ReactNode;
  allowedStatuses?: OnboardingStatus[];
  fallbackPath?: string;
}

export const ApprovalGuard: React.FC<ApprovalGuardProps> = ({ 
  children, 
  allowedStatuses = ['approved'], 
  fallbackPath = '/onboarding' 
}) => {
  const { studentData, loading } = useAuth();
  const location = useLocation();
  console.log('🔍 APPROVAL GUARD MOUNTING - pathname:', location.pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ui-bg)]">
        <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  // Check if student has the required approval status or access unlocked
  const isApproved = studentData?.onboardingStatus === 'approved' || studentData?.accessUnlocked === true || studentData?.trainingStatus === 'active';
  const hasRequiredStatus = studentData && (allowedStatuses.includes(studentData.onboardingStatus) || isApproved);
  
  // DEBUG: Log approval guard state
  console.log('🔍 APPROVAL GUARD DEBUG:', {
    studentData: studentData ? {
      uid: studentData.uid,
      onboardingStatus: studentData.onboardingStatus,
      accessUnlocked: studentData.accessUnlocked,
      trainingStatus: studentData.trainingStatus
    } : null,
    allowedStatuses,
    isApproved,
    pathname: location.pathname
  });
  
  if (studentData && !hasRequiredStatus) {
    // If we're coming from a navigation attempt, show the access control message
    if (location.state?.reason === 'approval_required') {
      return <AccessControlMessage />;
    }
    
    // Otherwise, redirect to onboarding with state
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ 
          from: location.pathname,
          reason: 'approval_required',
          currentStatus: studentData.onboardingStatus
        }} 
        replace 
      />
    );
  }

  return <>{children}</>;
};
