import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { WorkerSuperScreen } from './components/worker/WorkerSuperScreen';
import { AdminPanel } from './components/AdminPanel';
import { Dashboard } from './components/Dashboard';
import { TeamManager } from './components/TeamManager';
import { MaterialManager } from './components/MaterialManager';
import { TariffManager } from './components/TariffManager';
import { Toaster } from './components/ui/toaster';
import { TaskManager } from './components/TaskManager';
import { TelegramIntegration } from './components/TelegramIntegration';
import KanbanPage from './components/KanbanPage';

const App: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  // The Auth component is shown for unauthenticated users and is not part of the main routing.
  if (!user || !profile) {
     return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Routes>
        {/* The worker role has a completely different UI and does not use the main Layout, so it gets its own route. */}
        {profile.role === 'worker' ? (
          <Route path="/*" element={<WorkerSuperScreen />} />
        ) : (
          /* All other roles (manager, director, admin) share the main Layout. */
          <Route path="/*" element={<MainLayoutRoutes />} />
        )}
      </Routes>
      <Toaster />
    </>
  );
};

// This component defines the routes accessible within the main Layout.
const MainLayoutRoutes: React.FC = () => {
  const { profile } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/team" element={<TeamManager />} />
        <Route path="/materials" element={<MaterialManager />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/tariffs" element={<TariffManager />} />
        <Route path="/tasks/*" element={<TaskManager />} />
        <Route path="/telegram" element={<TelegramIntegration />} />

        {/* Admin-only route */}
        {profile?.role === 'admin' && (
          <Route path="/admin" element={<AdminPanel />} />
        )}

        {/* Fallback redirect to the dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;