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
  Award,
  Target
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
  completedLessons: number;
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
  const [stats, setStats] = useState<QuickStats>({
    totalStudents: 0,
    pendingApprovals: 0,
    activeBatches: 0,
    liveClassesRunning: 0,
    attendanceRate: 85,
    completedLessons: 0
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
      color: 'from-blue-500 to-blue-600',
      change: '+12%',
      changeType: 'positive' as const
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: UserCheck,
      color: 'from-yellow-500 to-yellow-600',
      change: '+3',
      changeType: 'neutral' as const
    },
    {
      title: 'Active Batches',
      value: stats.activeBatches,
      icon: BookOpen,
      color: 'from-green-500 to-green-600',
      change: '+2',
      changeType: 'positive' as const
    },
    {
      title: 'Live Classes Running',
      value: stats.liveClassesRunning,
      icon: Video,
      color: 'from-purple-500 to-purple-600',
      change: 'Now',
      changeType: 'live' as const
    },
    {
      title: 'Attendance Rate',
      value: `${stats.attendanceRate}%`,
      icon: CheckCircle2,
      color: 'from-indigo-500 to-indigo-600',
      change: '+5%',
      changeType: 'positive' as const
    },
    {
      title: 'Completed Lessons',
      value: stats.completedLessons,
      icon: Award,
      color: 'from-pink-500 to-pink-600',
      change: '+8',
      changeType: 'positive' as const
    }
  ];

  const quickActions = [
    {
      title: 'Start Live Class',
      description: 'Begin a new live session',
      icon: PlayCircle,
      color: 'bg-purple-600 hover:bg-purple-700',
      action: () => navigate('/teacher/lessons')
    },
    {
      title: 'Manage Batches',
      description: 'View and edit batch details',
      icon: Users,
      color: 'bg-blue-600 hover:bg-blue-700',
      action: () => navigate('/teacher/batches')
    },
    {
      title: 'Review Approvals',
      description: 'Process student applications',
      icon: UserCheck,
      color: 'bg-green-600 hover:bg-green-700',
      action: () => navigate('/teacher/approvals')
    },
    {
      title: 'View Attendance',
      description: 'Check attendance records',
      icon: Calendar,
      color: 'bg-indigo-600 hover:bg-indigo-700',
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
    <div className="p-6 space-y-8 max-w-7xl mx-auto w-full">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white"
      >
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.name}!
          </h1>
          <p className="text-purple-100 text-lg">
            Here's what's happening with your teaching today.
          </p>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock size={20} />
            <span className="text-sm">Last login: {new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={20} />
            <span className="text-sm">Status: Active</span>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <GlassCard className="p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
                <p className="text-sm text-slate-400 mb-2">{stat.title}</p>
                {stat.change && (
                  <div className={`flex items-center gap-1 text-xs ${
                    stat.changeType === 'positive' ? 'text-green-400' :
                    stat.changeType === 'negative' ? 'text-red-400' :
                    stat.changeType === 'live' ? 'text-purple-400' :
                    'text-yellow-400'
                  }`}>
                    {stat.changeType === 'positive' && <TrendingUp size={12} />}
                    {stat.changeType === 'live' && <Activity size={12} />}
                    {stat.changeType === 'negative' && <TrendingUp size={12} className="rotate-180" />}
                    {stat.changeType === 'neutral' && <AlertCircle size={12} />}
                    <span>{stat.change}</span>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Focus */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <GlassCard className="p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Today's Focus</h2>
              <Target className="text-purple-400" size={20} />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <UserCheck size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Review Pending Approvals</h3>
                  <p className="text-sm text-slate-400">{stats.pendingApprovals} students waiting</p>
                </div>
                <ArrowRight size={20} className="text-purple-400" />
              </div>

              <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Video size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Live Class Session</h3>
                  <p className="text-sm text-slate-400">Grammar Fundamentals at 2:00 PM</p>
                </div>
                <ArrowRight size={20} className="text-blue-400" />
              </div>

              <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Users size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Batch Management</h3>
                  <p className="text-sm text-slate-400">Review student progress</p>
                </div>
                <ArrowRight size={20} className="text-green-400" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.title}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    onClick={action.action}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${action.color}`}
                  >
                    <Icon size={20} className="text-white" />
                    <div className="text-left">
                      <p className="font-medium text-white">{action.title}</p>
                      <p className="text-xs text-white/80">{action.description}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-xl font-semibold text-white mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-lg"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'live' ? 'bg-purple-400' :
                    activity.status === 'pending' ? 'bg-yellow-400' :
                    activity.status === 'urgent' ? 'bg-red-400' :
                    'bg-green-400'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{activity.action}</p>
                    <p className="text-xs text-slate-400">{activity.studentName}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {activity.timestamp.toLocaleTimeString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Upcoming Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-xl font-semibold text-white mb-6">Upcoming Sessions</h2>
            <div className="space-y-4">
              {upcomingSessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-lg"
                >
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <Video size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{session.lessonTitle}</p>
                    <p className="text-xs text-slate-400">{session.batchName} • {session.studentsCount} students</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-400 font-medium">
                      {session.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session.scheduledTime.toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};
