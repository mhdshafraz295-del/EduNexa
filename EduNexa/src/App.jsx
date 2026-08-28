import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import ProtectedRoute from './components/guards/ProtectedRoute';
import SubscriptionGuard from './components/guards/SubscriptionGuard';
import FeatureGuard from './components/guards/FeatureGuard';

// Layouts
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import InstituteLayout from './components/layout/InstituteLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterInstitutePage from './pages/auth/RegisterInstitutePage';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import InstitutesList from './pages/super-admin/InstitutesList';
import InstituteDetail from './pages/super-admin/InstituteDetail';
import PlatformUsers from './pages/super-admin/PlatformUsers';
import PlansManagementPage from './pages/super-admin/plans/PlansManagementPage';
import SubscriptionsListPage from './pages/super-admin/subscriptions/SubscriptionsListPage';
import BankAccountsPage from './pages/super-admin/payment-settings/BankAccountsPage';
import SuperAdminAnnouncementsPage from './pages/super-admin/announcements/SuperAdminAnnouncementsPage';
import ReferralCampaignsPage from './pages/super-admin/referrals/ReferralCampaignsPage';
import PlatformCmsPage from './pages/super-admin/cms/PlatformCmsPage';

import InstituteDashboard from './pages/admin/InstituteDashboard';
import SubscriptionPage from './pages/admin/subscription/SubscriptionPage';
import ReferralProgramPage from './pages/admin/referrals/ReferralProgramPage';
import AcademicHubPage from './pages/admin/academic/AcademicHubPage';
import TimetablePage from './pages/admin/timetable/TimetablePage';
import AttendancePage from './pages/admin/attendance/AttendancePage';
import StudentsPage from './pages/admin/StudentsPage';
import TeachersPage from './pages/admin/TeachersPage';
import InvoicesPage from './pages/admin/InvoicesPage';
import InstituteSettingsPage from './pages/admin/InstituteSettingsPage';
import ExamsPage from './pages/admin/exams/ExamsPage';
import WrittenMarkingPage from './pages/admin/exams/WrittenMarkingPage';
import TermReportCardPage from './pages/admin/exams/TermReportCardPage';
import GalleryManagementPage from './pages/admin/gallery/GalleryManagementPage';
import MessagesPage from './pages/admin/messages/MessagesPage';
import StudyMaterialsPage from './pages/admin/StudyMaterialsPage';
import PollsManagementPage from './pages/admin/polls/PollsManagementPage';
import LiveExamPage from './pages/student/LiveExamPage';
import AboutEduNexaPage from './pages/common/AboutEduNexaPage';

import TeacherPortal from './pages/portals/TeacherPortal';
import StudentPortal from './pages/portals/StudentPortal';
import ParentPortal from './pages/portals/ParentPortal';

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'SUPER_ADMIN':
      return <Navigate to="/super-admin" replace />;
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'TEACHER':
      return <Navigate to="/teacher" replace />;
    case 'STUDENT':
      return <Navigate to="/student" replace />;
    case 'PARENT':
      return <Navigate to="/parent" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterInstitutePage />} />
            <Route path="/register-institute" element={<RegisterInstitutePage />} />
            <Route path="/about" element={<AboutEduNexaPage />} />

            {/* Super Admin Portal (Bypasses Institute Subscriptions) */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SuperAdminDashboard />} />
              <Route path="institutes" element={<InstitutesList />} />
              <Route path="institutes/:id" element={<InstituteDetail />} />
              <Route path="platform-cms" element={<PlatformCmsPage />} />
              <Route path="announcements" element={<SuperAdminAnnouncementsPage />} />
              <Route path="referral-campaigns" element={<ReferralCampaignsPage />} />
              <Route path="plans" element={<PlansManagementPage />} />
              <Route path="subscriptions" element={<SubscriptionsListPage />} />
              <Route path="payment-settings" element={<BankAccountsPage />} />
              <Route path="users" element={<PlatformUsers />} />
            </Route>

            {/* Institute Admin Portal (Protected by SubscriptionGuard & FeatureGuards) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <SubscriptionGuard>
                    <InstituteLayout />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            >
              <Route index element={<InstituteDashboard />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="referrals" element={<ReferralProgramPage />} />
              <Route path="academic" element={<AcademicHubPage />} />
              <Route path="classes" element={<AcademicHubPage />} />
              <Route path="subjects" element={<AcademicHubPage />} />
              <Route
                path="timetable"
                element={
                  <FeatureGuard featureCode="TIMETABLE" featureName="Timetable Management">
                    <TimetablePage />
                  </FeatureGuard>
                }
              />
              <Route
                path="attendance"
                element={
                  <FeatureGuard featureCode="ATTENDANCE" featureName="Attendance Management">
                    <AttendancePage />
                  </FeatureGuard>
                }
              />
              <Route
                path="exams"
                element={
                  <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                    <ExamsPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="exams/:id/marking"
                element={
                  <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                    <WrittenMarkingPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="exams/term-reports"
                element={
                  <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                    <TermReportCardPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="exams/term-reports/:id"
                element={
                  <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                    <TermReportCardPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="study-materials"
                element={
                  <FeatureGuard featureCode="STUDY_MATERIALS" featureName="Study Notes & Materials">
                    <StudyMaterialsPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="polls"
                element={
                  <FeatureGuard featureCode="POLLS" featureName="Polls & Voting">
                    <PollsManagementPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="gallery"
                element={
                  <FeatureGuard featureCode="GALLERY" featureName="Gallery & Media Management">
                    <GalleryManagementPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="students"
                element={
                  <FeatureGuard featureCode="STUDENT_MANAGEMENT" featureName="Students Management">
                    <StudentsPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="teachers"
                element={
                  <FeatureGuard featureCode="TEACHER_MANAGEMENT" featureName="Faculty & Teachers">
                    <TeachersPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="parents"
                element={
                  <FeatureGuard featureCode="PARENT_PORTAL" featureName="Parent Management">
                    <ParentPortal />
                  </FeatureGuard>
                }
              />
              <Route
                path="invoices"
                element={
                  <FeatureGuard featureCode="INVOICES" featureName="Invoices & Billing">
                    <InvoicesPage />
                  </FeatureGuard>
                }
              />
              <Route
                path="messages"
                element={
                  <FeatureGuard featureCode="INTERNAL_MESSAGES" featureName="Internal Direct Messaging">
                    <MessagesPage />
                  </FeatureGuard>
                }
              />
              <Route path="settings" element={<InstituteSettingsPage />} />
              <Route path="about" element={<AboutEduNexaPage />} />
            </Route>

            {/* Role Portals */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute allowedRoles={['TEACHER']}>
                  <SubscriptionGuard>
                    <TeacherPortal />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <SubscriptionGuard>
                    <StudentPortal />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/:tab"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <SubscriptionGuard>
                    <StudentPortal />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />

            {/* Timed Live Student Examination Room */}
            <Route
              path="/student/exam/:id"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <SubscriptionGuard>
                    <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                      <LiveExamPage />
                    </FeatureGuard>
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/exams/:id"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <SubscriptionGuard>
                    <FeatureGuard featureCode="ONLINE_EXAMS" featureName="Online Examinations">
                      <LiveExamPage />
                    </FeatureGuard>
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/parent"
              element={
                <ProtectedRoute allowedRoles={['PARENT']}>
                  <SubscriptionGuard>
                    <ParentPortal />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent/:tab"
              element={
                <ProtectedRoute allowedRoles={['PARENT']}>
                  <SubscriptionGuard>
                    <ParentPortal />
                  </SubscriptionGuard>
                </ProtectedRoute>
              }
            />

            {/* Root Redirect */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
