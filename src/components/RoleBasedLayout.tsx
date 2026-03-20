import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './Navigation';
import { TeacherLayout } from './TeacherLayout';
import { useAuth } from '../hooks/useAuth';

export const RoleBasedLayout: React.FC = () => {
  const { profile } = useAuth();

  // Check if user is teacher/admin
  const isTeacher = profile?.role === 'teacher' || 
                   profile?.role === 'admin';

  // If teacher, use sidebar layout
  if (isTeacher) {
    return <TeacherLayout />;
  }

  // If student or other roles, use bottom navigation
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
};
