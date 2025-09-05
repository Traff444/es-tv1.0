import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { isTelegramEnvironment } from './lib/telegram';

const App: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  
  // Определяем интерфейс по route
  const isWorkerInterface = location.pathname.startsWith('/mini');
  const isManagerInterface = location.pathname.startsWith('/manager');
  const isTelegramEnv = isTelegramEnvironment();
  
  // В Telegram окружении форсируем соответствующий интерфейс
  const shouldShowWorkerInterface = isWorkerInterface || (isTelegramEnv && !isManagerInterface);
  const shouldShowManagerInterface = isManagerInterface;

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
  
  // Route-based interface selection
  if (shouldShowWorkerInterface) {
    // Проверяем роль пользователя для worker interface
    if (profile.role !== 'worker') {
      return (
        <>
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
              <p className="text-gray-600 mb-6">
                Этот интерфейс предназначен только для рабочих.
                Ваша роль: <span className="font-semibold">{profile.role}</span>
              </p>
              <p className="text-sm text-gray-500">
                Обратитесь к администратору для получения правильных прав доступа.
              </p>
            </div>
          </div>
          <Toaster />
        </>
      );
    }
    return (
      <>
        <WorkerSuperScreen />
        <Toaster />
      </>
    );
  }
  
  if (shouldShowManagerInterface) {
    // Проверяем роль пользователя для manager interface  
    if (!['manager', 'director', 'admin'].includes(profile.role)) {
      return (
        <>
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
              <p className="text-gray-600 mb-6">
                Этот интерфейс предназначен только для менеджеров.
                Ваша роль: <span className="font-semibold">{profile.role}</span>
              </p>
              <p className="text-sm text-gray-500">
                Обратитесь к администратору для получения правильных прав доступа.
              </p>
            </div>
          </div>
          <Toaster />
        </>
      );
    }
    return (
      <>
        <ManagerInterfaceRoutes />
        <Toaster />
      </>
    );
  }

  // Default web interface (old logic for backward compatibility)
  return (
    <>
      <Routes>
        {/* Route-based interfaces */}
        <Route path="/mini/*" element={<WorkerInterfaceRoute />} />
        <Route path="/manager/*" element={<ManagerInterfaceRoute />} />
        
        {/* Default routes based on user role */}
        {profile.role === 'worker' ? (
          <Route path="/*" element={<WorkerSuperScreen />} />
        ) : (
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

// Worker interface route component
const WorkerInterfaceRoute: React.FC = () => {
  const { profile } = useAuth();
  
  if (profile?.role !== 'worker') {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600 mb-6">
            Этот интерфейс предназначен только для рабочих.
            Ваша роль: <span className="font-semibold">{profile?.role}</span>
          </p>
          <p className="text-sm text-gray-500">
            Обратитесь к администратору для получения правильных прав доступа.
          </p>
        </div>
      </div>
    );
  }
  
  return <WorkerSuperScreen />;
};

// Manager interface route component  
const ManagerInterfaceRoute: React.FC = () => {
  const { profile } = useAuth();
  
  if (!['manager', 'director', 'admin'].includes(profile?.role || '')) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600 mb-6">
            Этот интерфейс предназначен только для менеджеров.
            Ваша роль: <span className="font-semibold">{profile?.role}</span>
          </p>
          <p className="text-sm text-gray-500">
            Обратитесь к администратору для получения правильных прав доступа.
          </p>
        </div>
      </div>
    );
  }
  
  return <ManagerInterfaceRoutes />;
};

// Manager interface routes
const ManagerInterfaceRoutes: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/team" element={<TeamManager />} />
        <Route path="/materials" element={<MaterialManager />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/tariffs" element={<TariffManager />} />
        <Route path="/tasks/*" element={<TaskManager />} />
        <Route path="/telegram" element={<TelegramIntegration />} />
        <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;