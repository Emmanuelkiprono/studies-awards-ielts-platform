import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Users,
  BookOpen,
  Video,
  Calendar,
  Clock,
  UserCheck,
  TrendingUp,
  Activity,
  PlayCircle,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { GlassCard } from '../components/UI';

interface QuickStats {
  totalStudents: number;
  pendingApprovals: number;
  activeBatches: number;
  liveClassesRunning: number;
  attendanceRate: number;
}

interface RecentActivity {
  id: string;
  type: 'enrollment' | 'payment' | 'assignment' | 'approval' | 'live_class';
  studentName: string;
  action: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'urgent' | 'live';
}

interface UpcomingSession {
  id: string;
  lessonTitle: string;
  batchName: string;
  scheduledTime: Date;
  studentsCount: number;
}

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [stats, setStats] = useState<QuickStats>({
    totalStudents: 0,
    pendingApprovals: 0,
    activeBatches: 0,
    liveClassesRunning: 0,
    attendanceRate: 85
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;

    setLoading(true);

    // Fetch total students
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student')
    );
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, totalStudents: snapshot.docs.length }));
    });

    // Fetch pending approvals
    const approvalsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('onboardingStatus', '==', 'pending')
    );
    const unsubscribeApprovals = onSnapshot(approvalsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, pendingApprovals: snapshot.docs.length }));
    });

    // Fetch active batches
    const batchesQuery = query(
      collection(db, 'batches'),
      where('teacherId', '==', profile.uid),
      where('status', '==', 'active')
    );
    const unsubscribeBatches = onSnapshot(batchesQuery, (snapshot) => {
      setStats(prev => ({ ...prev, activeBatches: snapshot.docs.length }));
    });

    // Fetch live classes
    const liveSessionsQuery = query(
      collection(db, 'liveSessions'),
      where('teacherId', '==', profile.uid),
      where('status', '==', 'live')
    );
    const unsubscribeLiveSessions = onSnapshot(liveSessionsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, liveClassesRunning: snapshot.docs.length }));
    });

    // Mock recent activity
    const mockRecentActivity: RecentActivity[] = [
      {
        id: '1',
        type: 'enrollment',
        studentName: 'John Doe',
        action: 'Enrolled in Advanced English',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'completed'
      },
      {
        id: '2',
        type: 'approval',
        studentName: 'Jane Smith',
        action: 'Awaiting approval for Basic IELTS',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'pending'
      },
      {
        id: '3',
        type: 'live_class',
        studentName: 'Live Class',
        action: 'Grammar Fundamentals started',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        status: 'live'
      }
    ];
    setRecentActivity(mockRecentActivity);

    // Mock upcoming sessions
    const mockUpcomingSessions: UpcomingSession[] = [
      {
        id: '1',
        lessonTitle: 'Advanced Grammar',
        batchName: 'IELTS Batch A',
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        studentsCount: 15
      },
      {
        id: '2',
        lessonTitle: 'Speaking Practice',
        batchName: 'IELTS Batch B',
        scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        studentsCount: 12
      }
    ];
    setUpcomingSessions(mockUpcomingSessions);

    setLoading(false);

    return () => {
      unsubscribeStudents();
      unsubscribeApprovals();
      unsubscribeBatches();
      unsubscribeLiveSessions();
    };
  }, [profile?.uid]);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: UserCheck,
      color: 'text-yellow-600'
    },
    {
      title: 'Active Batches',
      value: stats.activeBatches,
      icon: BookOpen,
      color: 'text-green-600'
    },
    {
      title: 'Live Classes',
      value: stats.liveClassesRunning > 0 ? 'Now' : '0',
      icon: Video,
      color: stats.liveClassesRunning > 0 ? 'text-purple-600' : 'text-gray-600'
    },
    {
      title: 'Attendance Rate',
      value: `${stats.attendanceRate}%`,
      icon: CheckCircle2,
      color: 'text-indigo-600'
    }
  ];

  const quickActions = [
    {
      title: 'Manage Batches',
      count: stats.activeBatches,
      icon: Users,
      action: () => navigate('/teacher/batches')
    },
    {
      title: 'Approvals',
      count: stats.pendingApprovals,
      icon: UserCheck,
      action: () => navigate('/teacher/approvals')
    },
    {
      title: 'Lessons',
      count: '0',
      icon: BookOpen,
      action: () => navigate('/teacher/lessons')
    },
    {
      title: 'Attendance',
      count: `${stats.attendanceRate}%`,
      icon: Calendar,
      action: () => navigate('/teacher/attendance')
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Simple Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome back, {profile?.name}
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your teaching today.
        </p>
      </div>

      {/* Top Bar with Search and Create */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students, batches, lessons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={20} />
              <span>Create</span>
              <ChevronDown size={16} />
            </button>
            {showCreateDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => { navigate('/teacher/batches'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  Batch
                </button>
                <button
                  onClick={() => { navigate('/teacher/lessons'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  Lesson
                </button>
                <button
                  onClick={() => { navigate('/teacher/live-classes'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  Live Class
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center mb-4`}>
                <Icon size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-gray-600">{stat.title}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Focus */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Focus</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <UserCheck size={20} className="text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Review pending approvals</h3>
                  <p className="text-sm text-gray-600">{stats.pendingApprovals} students waiting</p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Video size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Upcoming live class</h3>
                  <p className="text-sm text-gray-600">Grammar Fundamentals at 2:00 PM</p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Attendance tasks</h3>
                  <p className="text-sm text-gray-600">3 classes need review</p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={action.action}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} className="text-gray-600" />
                      <span className="font-medium text-gray-900">{action.title}</span>
                    </div>
                    <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                      {action.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Live Now Section */}
      {stats.liveClassesRunning > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Now</h2>
          <div className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <Video size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Grammar Fundamentals</h3>
              <p className="text-sm text-gray-600">IELTS Batch A • 15 students</p>
            </div>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Join Session
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((activity, index) => (
            <div key={activity.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                activity.status === 'live' ? 'bg-purple-400' :
                activity.status === 'pending' ? 'bg-yellow-400' :
                activity.status === 'urgent' ? 'bg-red-400' :
                'bg-green-400'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-600">{activity.studentName}</p>
              </div>
              <span className="text-xs text-gray-500">
                {activity.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
