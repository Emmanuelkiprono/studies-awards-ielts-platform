import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TopBar, BottomNav } from './components/Navigation';
import { StudentDashboard } from './pages/StudentDashboard';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';

import { LiveClassesPage } from './pages/LiveClassesPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ProgressPage } from './pages/ProgressPage';

import { EnrollmentPage } from './pages/EnrollmentPage';
import { BreemicEnrollmentPage } from './pages/BreemicEnrollmentPage';
import { TestPage } from './pages/TestPage';
import { StudentOnboardingDashboard } from './pages/StudentOnboardingDashboard';
import { StudentApprovalPanel } from './pages/StudentApprovalPanel';
import { PaymentPage } from './pages/PaymentPage';
import { ApprovalGuard } from './components/ApprovalGuard';
import { PaymentPendingPage } from './pages/PaymentPendingPage';
import { ExamBookingPage } from './pages/ExamBookingPage';

import { CreateAssignmentPage } from './pages/CreateAssignmentPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProfilePage } from './pages/ProfilePage';
import { TeacherStudentsPage } from './pages/TeacherStudentsPage_Minimal';
import { TeacherLessonsPage } from './pages/TeacherLessonsPage';
import { TeacherAttendancePage } from './pages/TeacherAttendancePage';
import { TeacherAssignmentsPage } from './pages/TeacherAssignmentsPage';
import { TeacherDashboard } from './pages/TeacherDashboard_New';
import { TeacherCoursesPage } from './pages/TeacherCoursesPage';
import { TeacherModulesPage } from './pages/TeacherModulesPage';
import { TeacherApprovalsPage } from './pages/TeacherApprovalsPage_New';
import { TeacherTasksPage } from './pages/TeacherTasksPage';
import { TeacherExamsPage } from './pages/TeacherExamsPage';
import { StudentProfilePage } from './pages/StudentProfilePage';

import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage';
import { seedInitialData } from './services/seedData';
import { ToastProvider } from './components/Toast';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // Or a loader
  if (!user || !profile) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (!allowedRoles.includes(profile.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, profile, studentData, loading, forcePasswordChange } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  useEffect(() => {
    seedInitialData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ui-bg)]">
        <div className="size-12 border-4 border-[rgba(var(--ui-accent-rgb)/0.30)] border-t-[var(--ui-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (forcePasswordChange) {
    return <ForcePasswordChangePage />;
  }

  const userRole = profile.role;

  // Deduced UI structure
  const isTeacherRoute = location.pathname.startsWith('/teacher');
  const showBottomNav = !isCreatingAssignment && (userRole === 'teacher' || (userRole === 'student' && (studentData?.trainingPaymentStatus === 'paid' || studentData?.onboardingStatus === 'approved')));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ui-bg)]">
      <TopBar
        title={profile.name}
        subtitle={
          userRole === 'student'
            ? (studentData?.trainingStatus === 'active' ? 'Active Student' : 'Student')
            : userRole === 'teacher' ? 'Faculty Member'
            : 'Administrator'
        }
        avatarUrl={profile.avatarUrl || `https://picsum.photos/seed/${profile.uid}/100/100`}
        onProfileClick={() => navigate('/profile')}
      />

      <main className="flex-1 overflow-x-hidden no-scrollbar">
        <Routes>
          {/* Base Redirects */}
          <Route path="/" element={
            userRole === 'admin' ? <Navigate to="/admin" replace /> :
              userRole === 'teacher' ? <Navigate to="/teacher" replace /> :
                <Navigate to="/dashboard" replace />
          } />

          {/* Teacher Routes */}
          <Route path="/teacher/*" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Routes>
                <Route path="/" element={<TeacherDashboard onCreateAssignment={() => setIsCreatingAssignment(true)} />} />
                <Route path="/courses" element={<TeacherCoursesPage />} />
                <Route path="/modules" element={<TeacherModulesPage />} />
                <Route path="/lessons" element={<TeacherLessonsPage />} />
                <Route path="/approvals" element={<TeacherApprovalsPage />} />
                <Route path="/students" element={<TeacherStudentsPage />} />
                <Route path="/tasks" element={<TeacherTasksPage onCreateAssignment={() => setIsCreatingAssignment(true)} />} />
                <Route path="/exams" element={<TeacherExamsPage />} />
                <Route path="/attendance" element={<TeacherAttendancePage />} />
                <Route path="/students/:studentId" element={<StudentProfilePage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </ProtectedRoute>
          } />

          {/* Shared Routes - Live Classes for both teachers and students */}
          <Route path="/live" element={<ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}><LiveClassesPage /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/exams" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TeacherExamsPage />
            </ProtectedRoute>
          } />

          {/* Student Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentOnboardingDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/courses" element={
            <ProtectedRoute allowedRoles={['student']}>
              <ApprovalGuard>
                <StudentDashboard />
              </ApprovalGuard>
            </ProtectedRoute>
          } />

          <Route path="/exam_booking" element={
            <ProtectedRoute allowedRoles={['student']}>
              <ApprovalGuard>
                <ExamBookingPage />
              </ApprovalGuard>
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute allowedRoles={['student']}>
              <ApprovalGuard>
                <AssignmentsPage />
              </ApprovalGuard>
            </ProtectedRoute>
          } />
          <Route path="/resources" element={
            <ProtectedRoute allowedRoles={['student']}>
              <ApprovalGuard>
                <ResourcesPage />
              </ApprovalGuard>
            </ProtectedRoute>
          } />
          <Route path="/progress" element={
            <ProtectedRoute allowedRoles={['student']}>
              <ApprovalGuard>
                <ProgressPage />
              </ApprovalGuard>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}><ProfilePage /></ProtectedRoute>} />

          {/* Public Routes - MUST be before fallback */}
          <Route path="/test" element={<TestPage />} />
          <Route path="/breemic-enrollment" element={<BreemicEnrollmentPage />} />
          <Route path="/payment" element={<ProtectedRoute allowedRoles={['student']}><PaymentPage /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['student']}><StudentOnboardingDashboard /></ProtectedRoute>} />
          <Route path="/onboarding-test" element={<StudentOnboardingDashboard />} />
                    <Route path="/approvals" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><StudentApprovalPanel /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showBottomNav && (
        <BottomNav role={userRole} />
      )}
    </div>
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
