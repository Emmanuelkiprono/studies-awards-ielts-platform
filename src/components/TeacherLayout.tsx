import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TeacherSidebar } from './TeacherSidebar';
import { ProfileDropdown } from './ProfileDropdown';
import { useAuth } from '../hooks/useAuth';

interface TeacherLayoutProps {
  children?: React.ReactNode;
}

export const TeacherLayout: React.FC<TeacherLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Sidebar */}
      <TeacherSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      {/* Main Content Area - Scrollable */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        {/* Top Header - Fixed */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-[100] pointer-events-auto">
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your courses and students efficiently</p>
            </div>
            <div className="flex items-center gap-4 pointer-events-auto">
              <ProfileDropdown />
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-6">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};
