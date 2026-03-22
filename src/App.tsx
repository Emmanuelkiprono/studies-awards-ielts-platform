import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ApprovalGuard } from './components/ApprovalGuard';
import { RoleBasedLayout } from './components/RoleBasedLayout';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

const lazyNamed = <T extends Record<string, unknown>>(
  factory: () => Promise<T>,
  key: keyof T
) =>
  lazy(() =>
    factory().then((module) => ({
      default: module[key] as React.ComponentType<any>,
    }))
  );

const AuthPage = lazyNamed(() => import('./pages/AuthPage'), 'AuthPage');
const StudentDashboard = lazyNamed(
  () => import('./pages/StudentDashboard_Premium'),
  'StudentDashboard_Premium'
);
const TodaysLearning = lazyNamed(() => import('./pages/TodaysLearning'), 'TodaysLearning');
const LiveClassesPage = lazyNamed(() => import('./pages/LiveClassesPage'), 'LiveClassesPage');
const AssignmentsPage = lazyNamed(() => import('./pages/AssignmentsPage'), 'AssignmentsPage');
const ResourcesPage = lazyNamed(() => import('./pages/ResourcesPage'), 'ResourcesPage');
const ProgressPage = lazyNamed(() => import('./pages/ProgressPage'), 'ProgressPage');
const NotificationsPage = lazyNamed(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const BreemicEnrollmentPage = lazyNamed(
  () => import('./pages/BreemicEnrollmentPage'),
  'BreemicEnrollmentPage'
);
const StudentOnboardingDashboard = lazyNamed(
  () => import('./pages/StudentOnboardingDashboard'),
  'StudentOnboardingDashboard'
);
const PaymentPage = lazyNamed(() => import('./pages/PaymentPage'), 'PaymentPage');
const ExamBookingPage = lazyNamed(() => import('./pages/ExamBookingPage'), 'ExamBookingPage');
const AdminDashboard = lazyNamed(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const TeacherStudentsPage = lazyNamed(
  () => import('./pages/TeacherStudentsPage_Minimal'),
  'TeacherStudentsPage'
);
const TeacherProfilePage = lazyNamed(
  () => import('./pages/TeacherProfilePage'),
  'TeacherProfilePage'
);
const TeacherDashboard = lazyNamed(
  () => import('./pages/TeacherDashboard_New'),
  'TeacherDashboard'
);
const TeacherCoursesPage = lazyNamed(
  () => import('./pages/TeacherCoursesPage'),
  'TeacherCoursesPage'
);
const TeacherModulesPage = lazyNamed(
  () => import('./pages/TeacherModulesPage'),
  'TeacherModulesPage'
);
const TeacherApprovalsPageBatch = lazyNamed(
  () => import('./pages/TeacherApprovalsPage_Batch'),
  'TeacherApprovalsPage_Batch'
);
const TeacherTasksPage = lazyNamed(() => import('./pages/TeacherTasksPage'), 'TeacherTasksPage');
const TeacherExamsPage = lazyNamed(() => import('./pages/TeacherExamsPage'), 'TeacherExamsPage');
const StudentProfilePage = lazyNamed(
  () => import('./pages/StudentProfilePage'),
  'StudentProfilePage'
);
const TeacherBatchLessonsPage = lazyNamed(
  () => import('./pages/TeacherBatchLessonsPage'),
  'TeacherBatchLessonsPage'
);
const TeacherLiveSessionPage = lazyNamed(
  () => import('./pages/TeacherLiveSessionPage'),
  'TeacherLiveSessionPage'
);
const StudentBatchView = lazyNamed(() => import('./pages/StudentBatchView'), 'StudentBatchView');
const TeacherBatchesPageQuick = lazyNamed(
  () => import('./pages/TeacherBatchesPage_Quick'),
  'TeacherBatchesPage_Quick'
);
const TeacherBatchDetailsPage = lazyNamed(
  () => import('./pages/TeacherBatchDetailsPage'),
  'TeacherBatchDetailsPage'
);
const TeacherLessonDetailsPage = lazyNamed(
  () => import('./pages/TeacherLessonDetailsPage'),
  'TeacherLessonDetailsPage'
);
const TeacherLessonsPageSimple = lazyNamed(
  () => import('./pages/TeacherLessonsPage_Simple'),
  'TeacherLessonsPage_Simple'
);
const TeacherLiveClassesPageSimple = lazyNamed(
  () => import('./pages/TeacherLiveClassesPage_Simple'),
  'TeacherLiveClassesPage_Simple'
);
const TeacherAttendancePageSimple = lazyNamed(
  () => import('./pages/TeacherAttendancePage_Simple'),
  'TeacherAttendancePage_Simple'
);
const StudentLiveClassesPage = lazyNamed(
  () => import('./pages/StudentLiveClassesPage'),
  'StudentLiveClassesPage'
);
const TeacherLiveClassAttendancePage = lazyNamed(
  () => import('./pages/TeacherLiveClassAttendancePage'),
  'TeacherLiveClassAttendancePage'
);
const ForcePasswordChangePage = lazyNamed(
  () => import('./pages/ForcePasswordChangePage'),
  'ForcePasswordChangePage'
);

const FullScreenLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const getHomePathForRole = (role?: string) => {
  if (role === 'admin') {
    return '/admin';
  }

  if (role === 'teacher') {
    return '/teacher';
  }

  return '/dashboard';
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={getHomePathForRole(profile.role)} replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, profile, loading, forcePasswordChange } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (forcePasswordChange) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <ForcePasswordChangePage />
      </Suspense>
    );
  }

  if (!user || !profile) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <RoleBasedLayout>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to={getHomePathForRole(profile.role)} replace />} />

          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/teacher/dashboard" element={<Navigate to="/teacher" replace />} />
          <Route
            path="/teacher/courses"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/modules"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherModulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/batches"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherBatchesPageQuick />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/batches/:batchId"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherBatchDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/batches/:batchId/lessons"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherBatchLessonsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/lessons/:lessonId"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLessonDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/batches/:batchId/lessons/:lessonId/live"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLiveSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/lessons"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLessonsPageSimple />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-classes"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLiveClassesPageSimple />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-session/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLiveSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherAttendancePageSimple />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-attendance"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherLiveClassAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/approvals"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherApprovalsPageBatch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/students"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherStudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/tasks"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherTasksPage onCreateAssignment={() => undefined} />
              </ProtectedRoute>
            }
          />
          <Route path="/teacher/assignments" element={<Navigate to="/teacher/tasks" replace />} />
          <Route
            path="/teacher/exams"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherExamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/students/:studentId"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <StudentProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                <TeacherProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/live"
            element={
              <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
                <LiveClassesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/exams"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TeacherExamsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentOnboardingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <StudentDashboard />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/todays-learning"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <TodaysLearning />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/live-classes"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <StudentLiveClassesPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/batch"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <StudentBatchView />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/batch/:batchId/lessons/:lessonId/live"
            element={
              <ProtectedRoute allowedRoles={['student', 'teacher']}>
                <TeacherLiveSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exam_booking"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <ExamBookingPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <AssignmentsPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <ResourcesPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <ProgressPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ApprovalGuard>
                  <NotificationsPage />
                </ApprovalGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <PaymentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentOnboardingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/breemic-enrollment"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <BreemicEnrollmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route path="/approvals" element={<Navigate to="/teacher/approvals" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RoleBasedLayout>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
