import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getSimplifiedStudentStatus, getStudentFlowRoute, hasApprovedStudentAccess } from '../lib/studentAccess';

interface ApprovalGuardProps {
  children: React.ReactNode;
}

export const ApprovalGuard: React.FC<ApprovalGuardProps> = ({ children }) => {
  const { studentData, loading } = useAuth();
  const location = useLocation();
  const status = getSimplifiedStudentStatus(studentData);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ui-bg)]">
        <div className="w-8 h-8 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  console.log('APPROVED ROUTE CHECK:', {
    status,
    accessUnlocked: studentData?.accessUnlocked ?? false,
    onboardingStatus: studentData?.onboardingStatus ?? null,
  });

  if (!hasApprovedStudentAccess(studentData)) {
    return (
      <Navigate
        to={getStudentFlowRoute(studentData)}
        state={{
          from: location.pathname,
          reason: 'approval_required',
          currentStatus: status,
        }}
        replace
      />
    );
  }

  return <>{children}</>;
};
