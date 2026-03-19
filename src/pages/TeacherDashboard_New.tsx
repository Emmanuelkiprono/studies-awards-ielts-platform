import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useTeacherStudents } from '../hooks/useTeacherStudents';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  Users,
  BookOpen,
  Video,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Clock,
  UserCheck,
  DollarSign,
  Award,
  ArrowRight,
  Search,
  Filter,
  Download,
  Plus,
  Activity,
  Layers,
  UserCheck as AttendanceIcon,
  PlayCircle
} from 'lucide-react';
import { Course, UserProfile, StudentData, Enrollment, Assignment } from '../types';

interface QuickStats {
  totalStudents: number;
  pendingApprovals: number;
  activeStudents: number;
  completedStudents: number;
}

interface RecentActivity {
  id: string;
  type: 'enrollment' | 'payment' | 'assignment' | 'approval';
  studentName: string;
  action: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'urgent';
}

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile: teacherData } = useAuth();
  const { students, stats, loading } = useTeacherStudents();
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Quick actions data
  const quickActions = [
    {
      title: 'Manage Batches',
      description: 'Create and manage student cohorts',
      icon: Layers,
      color: 'bg-purple-500',
      route: '/teacher/batches'
    },
    {
      title: 'Manage Lessons',
      description: 'Create and organize lesson content',
      icon: BookOpen,
      color: 'bg-blue-500',
      route: '/teacher/lessons'
    },
    {
      title: 'Live Classes',
      description: 'Start and manage live sessions',
      icon: PlayCircle,
      color: 'bg-red-500',
      route: '/teacher/live'
    },
    {
      title: 'Attendance',
      description: 'Track and manage student attendance',
      icon: AttendanceIcon,
      color: 'bg-green-500',
      route: '/teacher/attendance'
    },
    {
      title: 'Students',
      description: 'View and manage students',
      icon: Users,
      color: 'bg-indigo-500',
      route: '/teacher/students',
      count: stats.total
    },
    {
      title: 'Approvals',
      description: 'Review pending applications',
      icon: UserCheck,
      color: 'bg-orange-500',
      route: '/teacher/approvals',
      count: stats.pending
    }
  ];

  // Create recent activity from shared students data
  useEffect(() => {
    if (students.length > 0) {
      const activity: RecentActivity[] = students.slice(0, 10).map(student => ({
        id: student.uid,
        type: student.onboardingStatus === 'approval_pending' ? 'enrollment' : 'payment',
        studentName: student.name,
        action: `Student enrolled`,
        timestamp: student.createdAt?.toDate?.() || new Date(),
        status: student.onboardingStatus === 'approval_pending' ? 'pending' : 'completed'
      }));

      setRecentActivity(activity);
    }
  }, [students]);

  // Filter recent activity based on search
  const filteredActivity = useMemo(() => {
    if (!searchTerm) return recentActivity;
    return recentActivity.filter(activity =>
      activity.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.action.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recentActivity, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#5B3DF5]/30 border-t-[#5B3DF5] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#111827] mb-2">
            Welcome back, {teacherData?.name || 'Teacher'}
          </h1>
          <p className="text-[#6B7280]">
            Here's what's happening with your students today.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Total Students</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Pending Approvals</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Active Students</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Completed</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#111827] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.title}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(action.route)}
                className="bg-white rounded-xl p-6 shadow-sm border border-[#E5E7EB] text-left hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", action.color)}>
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-[#111827]">{action.title}</h3>
                    </div>
                    <p className="text-sm text-[#6B7280] mb-3">{action.description}</p>
                    {action.count !== undefined && (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
                        <span className="text-xs font-medium text-gray-600">{action.count}</span>
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 mt-1" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#111827]">Recent Activity</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B3DF5] focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB]">
            {filteredActivity.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredActivity.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          activity.status === 'pending' ? 'bg-orange-400' : 'bg-green-400'
                        )} />
                        <div>
                          <p className="font-medium text-[#111827]">{activity.studentName}</p>
                          <p className="text-sm text-[#6B7280]">{activity.action}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6B7280]">
                          {activity.timestamp.toLocaleDateString()}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
