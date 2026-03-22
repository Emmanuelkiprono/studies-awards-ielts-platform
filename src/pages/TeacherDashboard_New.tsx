import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Plus,
  Search,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { buildAttendanceSummary, getAttendanceDateValue, isSameLocalDay } from '../lib/attendance';
import { db } from '../services/firebase';
import { hasTeacherOperationsAccess } from '../lib/teacherPermissions';
import { Attendance } from '../types';

interface TeacherDashboardStats {
  totalStudents: number;
  pendingApprovals: number;
  activeBatches: number;
  liveClassesRunning: number;
  totalTeachers: number;
}

interface TeacherAttendanceStats {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  attendanceRate: number;
}

interface TeacherBatchSummary {
  name: string;
  currentStudents: number;
  status?: string;
}

interface TeacherClassSession {
  id: string;
  title?: string;
  batchId?: string;
  startTime?: string;
  endTime?: string;
  meetingLink?: string;
  status?: 'scheduled' | 'live' | 'ended' | 'cancelled';
}

interface DashboardLiveCard {
  id: string;
  title: string;
  batchName: string;
  studentsCount: number;
  startTime: Date;
  meetingLink?: string;
}

interface DashboardActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: Date;
  tone: 'neutral' | 'pending' | 'success';
}

interface DashboardStudentRecord {
  id: string;
  name?: string;
  email?: string;
  onboardingStatus?: string;
  batchName?: string;
  createdAt?: { toDate?: () => Date };
  enrollmentDate?: { toDate?: () => Date };
  approvedAt?: { toDate?: () => Date };
}

const toDateValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatTimeAgo = (value: Date) => {
  const diff = Date.now() - value.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return value.toLocaleDateString();
};

const isLiveNow = (session: TeacherClassSession) => {
  if (session.status === 'cancelled' || session.status === 'ended') {
    return false;
  }

  const start = toDateValue(session.startTime);
  const end = toDateValue(session.endTime);
  if (!start || !end) {
    return session.status === 'live';
  }

  const now = Date.now();
  return session.status === 'live' || (start.getTime() <= now && now < end.getTime());
};

const isUpcoming = (session: TeacherClassSession) => {
  if (session.status === 'cancelled') {
    return false;
  }

  const start = toDateValue(session.startTime);
  return Boolean(start && start.getTime() > Date.now());
};

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [stats, setStats] = useState<TeacherDashboardStats>({
    totalStudents: 0,
    pendingApprovals: 0,
    activeBatches: 0,
    liveClassesRunning: 0,
    totalTeachers: 0,
  });
  const [attendanceStats, setAttendanceStats] = useState<TeacherAttendanceStats>({
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    attendanceRate: 0,
  });
  const [liveNowCard, setLiveNowCard] = useState<DashboardLiveCard | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<DashboardLiveCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      if (!profile || !hasTeacherOperationsAccess(profile.role)) {
        if (active) {
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const [
          studentUsersSnapshot,
          teacherUsersSnapshot,
          studentRecordsSnapshot,
          batchesSnapshot,
          liveSessionsSnapshot,
          attendanceSnapshot,
        ] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'liveSessions')),
          getDocs(collection(db, 'attendance')),
        ]);

        if (!active) {
          return;
        }

        const batchMap = batchesSnapshot.docs.reduce((acc, batchDoc) => {
          const batchData = batchDoc.data();
          acc[batchDoc.id] = {
            name: batchData.name || 'Batch',
            currentStudents: batchData.currentStudents || 0,
            status: batchData.status,
          };
          return acc;
        }, {} as Record<string, TeacherBatchSummary>);

        const studentRecords = studentRecordsSnapshot.docs.map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data(),
        } as DashboardStudentRecord));
        const pendingApprovals = studentRecords.filter((student) =>
          ['account_created', 'enrollment_pending', 'approval_pending', 'payment_pending'].includes(
            student.onboardingStatus
          )
        ).length;

        const teacherClassSessions = liveSessionsSnapshot.docs.map((sessionDoc) => ({
          id: sessionDoc.id,
          ...sessionDoc.data(),
        } as TeacherClassSession));
        const teacherSessionIds = new Set(teacherClassSessions.map((session) => session.id));
        const todayAttendanceSummary = buildAttendanceSummary(
          attendanceSnapshot.docs
            .map((attendanceDoc) => ({
              id: attendanceDoc.id,
              ...attendanceDoc.data(),
            } as Attendance))
            .filter((record) => {
              if (record.teacherId && record.teacherId !== profile.uid) {
                return false;
              }

              if (!record.teacherId && !teacherSessionIds.has(record.sessionId)) {
                return false;
              }

              const attendanceDate = getAttendanceDateValue(record);
              return attendanceDate ? isSameLocalDay(attendanceDate, new Date()) : false;
            })
        );

        const liveSessions = teacherClassSessions
          .filter(isLiveNow)
          .sort((left, right) => {
            const leftTime = toDateValue(left.startTime)?.getTime() || 0;
            const rightTime = toDateValue(right.startTime)?.getTime() || 0;
            return leftTime - rightTime;
          });

        const upcomingClassCards = teacherClassSessions
          .filter((session) => !isLiveNow(session) && isUpcoming(session))
          .sort((left, right) => {
            const leftTime = toDateValue(left.startTime)?.getTime() || 0;
            const rightTime = toDateValue(right.startTime)?.getTime() || 0;
            return leftTime - rightTime;
          })
          .slice(0, 3)
          .map((session) => ({
            id: session.id,
            title: session.title || 'Live Class',
            batchName: batchMap[session.batchId || '']?.name || 'Batch',
            studentsCount: batchMap[session.batchId || '']?.currentStudents || 0,
            startTime: toDateValue(session.startTime) || new Date(),
            meetingLink: session.meetingLink,
          }));

        const activeLiveSession = liveSessions[0];

        const recentStudentActivity = studentRecords
          .map((student) => {
            const approvedAt = student.approvedAt?.toDate?.();
            const createdAt = student.createdAt?.toDate?.() || student.enrollmentDate?.toDate?.();
            const name = student.name || student.email || 'Student';

            if (approvedAt) {
              return {
                id: `${student.id}-approved`,
                title: `${name} was approved`,
                subtitle: student.batchName || 'Added to weekly batch',
                timestamp: approvedAt,
                tone: 'success' as const,
              };
            }

            if (
              ['account_created', 'enrollment_pending', 'approval_pending', 'payment_pending'].includes(
                student.onboardingStatus
              )
            ) {
              return {
                id: `${student.id}-pending`,
                title: `${name} needs review`,
                subtitle: 'Pending approval workflow',
                timestamp: createdAt || new Date(),
                tone: 'pending' as const,
              };
            }

            return {
              id: `${student.id}-joined`,
              title: `${name} joined the platform`,
              subtitle: student.batchName || 'Waiting for lesson updates',
              timestamp: createdAt || new Date(),
              tone: 'neutral' as const,
            };
          })
          .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
          .slice(0, 5);

        setStats({
          totalStudents: studentUsersSnapshot.docs.length,
          pendingApprovals,
          activeBatches: batchesSnapshot.docs.filter((batchDoc) => batchDoc.data().status === 'active').length,
          liveClassesRunning: liveSessions.length,
          totalTeachers: teacherUsersSnapshot.docs.length,
        });
        setAttendanceStats({
          presentToday: todayAttendanceSummary.present,
          absentToday: todayAttendanceSummary.absent,
          lateToday: todayAttendanceSummary.late,
          attendanceRate: todayAttendanceSummary.attendanceRate,
        });
        setLiveNowCard(
          activeLiveSession
            ? {
                id: activeLiveSession.id,
                title: activeLiveSession.title || 'Live Session',
                batchName: batchMap[activeLiveSession.batchId || '']?.name || 'Batch',
                studentsCount: batchMap[activeLiveSession.batchId || '']?.currentStudents || 0,
                startTime: toDateValue(activeLiveSession.startTime) || new Date(),
                meetingLink: activeLiveSession.meetingLink,
              }
            : null
        );
        setUpcomingSessions(upcomingClassCards);
        setRecentActivity(recentStudentActivity);
      } catch (error) {
        console.error('Error loading teacher dashboard:', error);
        if (active) {
          setRecentActivity([]);
          setUpcomingSessions([]);
          setLiveNowCard(null);
          setAttendanceStats({
            presentToday: 0,
            absentToday: 0,
            lateToday: 0,
            attendanceRate: 0,
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [profile]);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: UserCheck,
      color: 'text-amber-600',
    },
    {
      title: 'Active Batches',
      value: stats.activeBatches,
      icon: BookOpen,
      color: 'text-emerald-600',
    },
    {
      title: 'Live Classes',
      value: stats.liveClassesRunning,
      icon: Video,
      color: stats.liveClassesRunning > 0 ? 'text-purple-600' : 'text-gray-700',
    },
    {
      title: 'Teachers',
      value: stats.totalTeachers,
      icon: Users,
      color: 'text-indigo-600',
    },
  ];

  const attendanceCards = [
    {
      title: 'Present Today',
      value: attendanceStats.presentToday,
      icon: CheckCircle2,
      color: 'text-emerald-600',
    },
    {
      title: 'Absent Today',
      value: attendanceStats.absentToday,
      icon: XCircle,
      color: 'text-red-600',
    },
    {
      title: 'Late Today',
      value: attendanceStats.lateToday,
      icon: Clock,
      color: 'text-amber-600',
    },
    {
      title: 'Attendance Rate',
      value: `${attendanceStats.attendanceRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  const quickActions = useMemo(
    () => [
      {
        title: 'Students',
        count: stats.totalStudents,
        icon: Users,
        action: () => navigate('/teacher/students'),
      },
      {
        title: 'Approvals',
        count: stats.pendingApprovals,
        icon: UserCheck,
        action: () => navigate('/teacher/approvals'),
      },
      {
        title: 'Live Classes',
        count: stats.liveClassesRunning,
        icon: Video,
        action: () => navigate('/teacher/live-classes'),
      },
      {
        title: 'Assignments',
        count: stats.activeBatches,
        icon: FileText,
        action: () => navigate('/teacher/tasks'),
      },
    ],
    [navigate, stats.activeBatches, stats.liveClassesRunning, stats.pendingApprovals, stats.totalStudents]
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[#6324eb]"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-black">
          Welcome back, {profile?.name}
        </h1>
        <p className="text-gray-700">
          Run approvals, student assignments, live classes, and daily teaching operations from one dashboard.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students, batches, lessons..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCreateDropdown((currentValue) => !currentValue)}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Plus size={20} />
              <span>Create</span>
              <ChevronDown size={16} />
            </button>
            {showCreateDropdown && (
              <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  onClick={() => {
                    navigate('/teacher/batches');
                    setShowCreateDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  Batch
                </button>
                <button
                  onClick={() => {
                    navigate('/teacher/lessons');
                    setShowCreateDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  Lesson
                </button>
                <button
                  onClick={() => {
                    navigate('/teacher/live-classes');
                    setShowCreateDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  Live Class
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="rounded-xl border border-gray-200 bg-white p-6">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 ${stat.color}`}>
                <Icon size={24} />
              </div>
              <h2 className="mb-1 text-2xl font-semibold tracking-tight text-black">{stat.value}</h2>
              <p className="text-sm text-gray-700">{stat.title}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black">Attendance Today</h2>
            <p className="text-sm text-gray-700">
              Live-class attendance totals pulled from today&apos;s saved attendance records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {attendanceCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white ${card.color}`}>
                  <Icon size={22} />
                </div>
                <p className="text-sm text-gray-700">{card.title}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-black">{card.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-black">Today's Focus</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/teacher/approvals')}
                className="flex w-full items-center gap-4 rounded-lg bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <UserCheck size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-black">Review pending approvals</h3>
                  <p className="text-sm text-gray-700">
                    {stats.pendingApprovals} students are waiting for a decision.
                  </p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/teacher/students')}
                className="flex w-full items-center gap-4 rounded-lg bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-black">Open student management</h3>
                  <p className="text-sm text-gray-700">
                    Update batches, assignments, status, teacher, and progress from one table.
                  </p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/teacher/live-classes')}
                className="flex w-full items-center gap-4 rounded-lg bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Video size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-black">Manage live classes</h3>
                  <p className="text-sm text-gray-700">
                    {upcomingSessions.length} upcoming classes are ready to review.
                  </p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/teacher/attendance')}
                className="flex w-full items-center gap-4 rounded-lg bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Calendar size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-black">Attendance and records</h3>
                  <p className="text-sm text-gray-700">
                    Keep batch attendance and live class follow-up up to date.
                  </p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-black">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={action.action}
                    className="flex w-full items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} className="text-gray-700" />
                      <span className="font-medium text-black">{action.title}</span>
                    </div>
                    <span className="rounded bg-white px-2 py-1 text-sm text-gray-700">
                      {action.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {liveNowCard && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-black">Live Now</h2>
          <div className="flex items-center gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600">
              <Video size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-black">{liveNowCard.title}</h3>
              <p className="text-sm text-gray-700">
                {liveNowCard.batchName} · {liveNowCard.studentsCount} students
              </p>
            </div>
            <button
              onClick={() => liveNowCard.meetingLink && window.open(liveNowCard.meetingLink, '_blank', 'noopener,noreferrer')}
              className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              Join Session
            </button>
          </div>
        </div>
      )}

      {upcomingSessions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-black">Upcoming Classes</h2>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Video size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">{session.title}</p>
                  <p className="text-xs text-gray-700">
                    {session.batchName} · {session.studentsCount} students
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-blue-600">
                    {session.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session.startTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-black">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              No recent activity yet.
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 rounded-lg bg-gray-50 p-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    activity.tone === 'pending'
                      ? 'bg-amber-400'
                      : activity.tone === 'success'
                        ? 'bg-emerald-400'
                        : 'bg-blue-400'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">{activity.title}</p>
                  <p className="text-xs text-gray-700">{activity.subtitle}</p>
                </div>
                <span className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
