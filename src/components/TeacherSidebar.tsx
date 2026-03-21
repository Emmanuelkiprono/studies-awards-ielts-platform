import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Settings,
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TeacherSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const menuSections = [
    {
      title: 'Overview',
      items: [
        {
          path: '/teacher/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard
        }
      ]
    },
    {
      title: 'Teaching',
      items: [
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
        }
      ]
    },
    {
      title: 'Students',
      items: [
        {
          path: '/teacher/students',
          label: 'Students',
          icon: GraduationCap
        },
        {
          path: '/teacher/approvals',
          label: 'Approvals',
          icon: UserCheck
        }
      ]
    },
    {
      title: 'Work',
      items: [
        {
          path: '/teacher/assignments',
          label: 'Tasks / Assignments',
          icon: FileText
        }
      ]
    },
    {
      title: 'Settings',
      items: [
        {
          path: '/teacher/profile',
          label: 'Profile Settings',
          icon: Settings
        }
      ]
    }
  ];

  const bottomMenuItems = [
    {
      path: '#',
      label: 'Sign Out',
      icon: LogOut,
      action: handleSignOut
    }
  ];

  return (
    <div className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-50 ${
      collapsed ? 'w-16' : 'w-64'
    } flex flex-col`}>
      {/* Branding Header - Fixed at top */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          {!collapsed && (
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">Breemic International</h1>
              <p className="text-xs text-purple-600 font-medium">Teacher Portal</p>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            {collapsed ? <Menu size={20} className="text-gray-600" /> : <X size={20} className="text-gray-600" />}
          </button>
        </div>
        
        {/* Teacher Profile Block */}
        {!collapsed && profile && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p>
              <p className="text-xs text-gray-600 capitalize">{profile.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation - Independently scrollable */}
      <nav className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-8">
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">
            {!collapsed && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-600 border-l-4 border-purple-600 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 border-t border-gray-100">
        <div className="space-y-1">
          {bottomMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path && item.path !== '#';
            
            return (
              <button
                key={item.path}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-purple-50 text-purple-600 border-l-4 border-purple-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
