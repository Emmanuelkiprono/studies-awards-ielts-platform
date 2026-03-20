import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Video,
  Calendar,
  GraduationCap,
  UserCheck,
  FileText,
  Menu,
  X,
  Home
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TeacherSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { profile } = useAuth();

  const menuItems = [
    {
      path: '/teacher/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      path: '/teacher/batches',
      label: 'Manage Batches',
      icon: Users
    },
    {
      path: '/teacher/lessons',
      label: 'Manage Lessons',
      icon: BookOpen
    },
    {
      path: '/teacher/live-classes',
      label: 'Live Classes',
      icon: Video
    },
    {
      path: '/teacher/attendance',
      label: 'Attendance',
      icon: Calendar
    },
    {
      path: '/teacher/students',
      label: 'Students',
      icon: GraduationCap
    },
    {
      path: '/teacher/approvals',
      label: 'Approvals',
      icon: UserCheck
    },
    {
      path: '/teacher/assignments',
      label: 'Tasks / Assignments',
      icon: FileText
    }
  ];

  return (
    <div className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-50 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Teacher Portal</h2>
            <p className="text-xs text-gray-500">{profile?.name}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <Menu size={20} className="text-gray-600" /> : <X size={20} className="text-gray-600" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-purple-50 text-purple-600 border-l-3 border-purple-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
        <NavLink
          to="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
            location.pathname === '/'
              ? 'bg-purple-50 text-purple-600 border-l-3 border-purple-600'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Home size={20} className="flex-shrink-0" />
          {!collapsed && <span className="font-medium">Back to Home</span>}
        </NavLink>
      </div>
    </div>
  );
};
