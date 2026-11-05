import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui.jsx';
import { DashboardLayout, ProtectedRoute } from './components/layout.jsx';
import LandingPage from './pages/PublicPages.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { DashboardPage, ProfilePage, RequestsPage, MatchingPage, InventoryPage, DonationsPage, NotificationsPage, AdminTablePage, IntegrationStatusPage } from './pages/WorkspacePages.jsx';

export default function App() {
  return <ToastProvider><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute />}><Route path="/app" element={<DashboardLayout />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="requests" element={<ProtectedRoute roles={['Hospital','Organization','Admin']}><RequestsPage /></ProtectedRoute>} />
      <Route path="matching" element={<ProtectedRoute roles={['Hospital','Organization','Admin']}><MatchingPage /></ProtectedRoute>} />
      <Route path="inventory" element={<ProtectedRoute roles={['Hospital','Admin']}><InventoryPage /></ProtectedRoute>} />
      <Route path="donations" element={<ProtectedRoute roles={['Donor','Hospital','Admin']}><DonationsPage /></ProtectedRoute>} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="users" element={<ProtectedRoute roles={['Admin']}><AdminTablePage kind="users" /></ProtectedRoute>} />
      <Route path="donors" element={<ProtectedRoute roles={['Admin']}><AdminTablePage kind="donors" /></ProtectedRoute>} />
      <Route path="organizations" element={<ProtectedRoute roles={['Admin']}><AdminTablePage kind="organizations" /></ProtectedRoute>} />
      <Route path="integration" element={<ProtectedRoute roles={['Admin']}><IntegrationStatusPage /></ProtectedRoute>} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></ToastProvider>;
}
