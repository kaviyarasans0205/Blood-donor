import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/ui/States';

import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// public
import Home from './pages/public/Home';
import About from './pages/public/About';
import BloodAvailability from './pages/public/BloodAvailability';
import PublicEmergencyRequest from './pages/public/EmergencyRequestPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// donor
import DonorDashboard from './pages/donor/DonorDashboard';
import DonorProfile from './pages/donor/DonorProfile';
import DonorEligibility from './pages/donor/DonorEligibility';
import DonorAppointments from './pages/donor/DonorAppointments';
import DonorRewards from './pages/donor/DonorRewards';

// requester
import RequesterDashboard from './pages/requester/RequesterDashboard';
import NewEmergencyRequest from './pages/requester/NewEmergencyRequest';
import MyRequests from './pages/requester/MyRequests';

// admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDonors from './pages/admin/AdminDonors';
import AdminInventory from './pages/admin/AdminInventory';
import AdminEmergencies from './pages/admin/AdminEmergencies';
import AdminAppointments from './pages/admin/AdminAppointments';
import AdminDonorMap from './pages/admin/AdminDonorMap';
import AdminPredictions from './pages/admin/AdminPredictions';
import AdminReports from './pages/admin/AdminReports';
import AdminReengagement from './pages/admin/AdminReengagement';
import AdminAlerts from './pages/admin/AdminAlerts';
import AdminSettings from './pages/admin/AdminSettings';
import AdminNotifications from './pages/admin/AdminNotifications';

// shared
import Notifications from './pages/shared/Notifications';
import SearchResults from './pages/shared/SearchResults';

// errors
import NotFound from './pages/errors/NotFound';
import Forbidden from './pages/errors/Forbidden';

const donorNav = [
  { to: '/donor/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/donor/eligibility', label: 'Eligibility', icon: '✅' },
  { to: '/donor/appointments', label: 'Appointments', icon: '📅' },
  { to: '/donor/rewards', label: 'Rewards', icon: '🏅' },
  { to: '/donor/profile', label: 'My Profile', icon: '👤' },
  { to: '/availability', label: 'Blood Availability', icon: '🩸' },
];

const requesterNav = [
  { to: '/requester/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/requester/new-request', label: 'New Emergency Request', icon: '🚨' },
  { to: '/requester/requests', label: 'My Requests', icon: '📋' },
  { to: '/availability', label: 'Blood Availability', icon: '🩸' },
];

const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/emergencies', label: 'Emergency Requests', icon: '🚨' },
  { to: '/admin/inventory', label: 'Blood Inventory', icon: '🩸' },
  { to: '/admin/donors', label: 'Donors', icon: '👥' },
  { to: '/admin/donor-map', label: 'Donor Map', icon: '🗺️' },
  { to: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { to: '/admin/predictions', label: 'Demand Prediction', icon: '🔮' },
  { to: '/admin/reports', label: 'Reports', icon: '📑' },
  { to: '/admin/reengagement', label: 'Re-engagement', icon: '📩' },
  { to: '/admin/alerts', label: 'Alerts', icon: '🔔' },
  { to: '/admin/notifications', label: 'Notifications', icon: '✉️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Verifying session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'requester') return <Navigate to="/requester/dashboard" replace />;
    return <Navigate to="/donor/dashboard" replace />;
  }
  return (
    <PublicLayout>
      <Home />
    </PublicLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/availability" element={<PublicLayout><BloodAvailability /></PublicLayout>} />
      <Route path="/emergency" element={<PublicLayout><PublicEmergencyRequest /></PublicLayout>} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Donor */}
      <Route
        path="/donor"
        element={
          <Protected roles={['donor']}>
            <DashboardLayout nav={donorNav} roleLabel="Donor" accent="bg-brand-600" />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/donor/dashboard" replace />} />
        <Route path="dashboard" element={<DonorDashboard />} />
        <Route path="profile" element={<DonorProfile />} />
        <Route path="eligibility" element={<DonorEligibility />} />
        <Route path="appointments" element={<DonorAppointments />} />
        <Route path="rewards" element={<DonorRewards />} />
      </Route>

      {/* Requester */}
      <Route
        path="/requester"
        element={
          <Protected roles={['requester', 'admin']}>
            <DashboardLayout nav={requesterNav} roleLabel="Hospital / Requester" accent="bg-amber-600" />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/requester/dashboard" replace />} />
        <Route path="dashboard" element={<RequesterDashboard />} />
        <Route path="new-request" element={<NewEmergencyRequest />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="requests/:id" element={<MyRequests />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <Protected roles={['admin']}>
            <DashboardLayout nav={adminNav} roleLabel="Administrator" accent="bg-slate-900" />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="donors" element={<AdminDonors />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="emergencies" element={<AdminEmergencies />} />
        <Route path="appointments" element={<AdminAppointments />} />
        <Route path="donor-map" element={<AdminDonorMap />} />
        <Route path="predictions" element={<AdminPredictions />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="reengagement" element={<AdminReengagement />} />
        <Route path="alerts" element={<AdminAlerts />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Shared */}
      <Route
        path="/notifications"
        element={
          <Protected>
            <DashboardLayout nav={[]} roleLabel="Account" />
          </Protected>
        }
      >
        <Route index element={<Notifications />} />
      </Route>
      <Route
        path="/profile"
        element={
          <Protected>
            <DashboardLayout nav={[]} roleLabel="Account" />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/donor/profile" replace />} />
      </Route>
      <Route
        path="/search"
        element={
          <Protected>
            <DashboardLayout nav={[]} roleLabel="Account" />
          </Protected>
        }
      >
        <Route index element={<SearchResults />} />
      </Route>

      <Route path="/forbidden" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
