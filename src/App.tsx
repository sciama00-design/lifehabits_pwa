import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SubscriptionGuard } from '@/components/shared/SubscriptionGuard';
import { CoachGuard } from '@/components/shared/CoachGuard';
import CoachLayout from '@/components/layout/CoachLayout';
import CoachDashboard from '@/pages/coach/CoachDashboard';
import CoachClients from '@/pages/coach/CoachClients';
import CoachClientDetail from '@/pages/coach/CoachClientDetail';
import CoachLibrary from '@/pages/coach/CoachLibrary';
import CoachBoard from '@/pages/coach/CoachBoard';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import Expired from '@/pages/Expired';
import ClientLayout from '@/components/layout/ClientLayout';
import ClientDashboard from '@/pages/client/ClientDashboard';
import ClientHabits from '@/pages/client/ClientHabits';
import ClientVideos from '@/pages/client/ClientVideos';
import { CoachSelectionProvider } from '@/context/CoachSelectionContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InstallPWA } from '@/components/shared/InstallPWA';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <InstallPWA />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/scaduto" element={<Expired />} />

          {/* Client Routes */}
          <Route element={
            <SubscriptionGuard>
              <CoachSelectionProvider>
                <ClientLayout />
              </CoachSelectionProvider>
            </SubscriptionGuard>
          }>
            <Route path="/" element={<ClientDashboard />} />
            <Route path="/habits" element={<ClientHabits />} />
            <Route path="/videos" element={<ClientVideos />} />
            <Route path="profile" element={<Settings />} />
          </Route>

          {/* Coach Routes */}
          <Route
            path="/coach"
            element={
              <CoachGuard>
                <CoachLayout />
              </CoachGuard>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CoachDashboard />} />
            <Route path="clients" element={<CoachClients />} />
            <Route path="clients/:clientId" element={<CoachClientDetail />} />
            <Route path="library" element={<CoachLibrary />} />
            <Route path="board" element={<CoachBoard />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
