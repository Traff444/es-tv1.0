import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { WorkerSuperScreen } from './components/worker/WorkerSuperScreen';
import { AdminPanel } from './components/AdminPanel';
import { Dashboard } from './components/Dashboard';
import { Toaster } from './components/ui/toaster';

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

  // If not authenticated, show the Auth component.
  // The Auth component itself is not part of the routing structure.
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
        <Route path="/*" element={<MainApp />} />
      </Routes>
      <Toaster />
    </>
  );
};

// This component contains the logic to display the correct UI based on the user's role.
const MainApp: React.FC = () => {
  const { profile } = useAuth();
  // This state is temporarily kept to avoid breaking Layout and Dashboard components.
  // It will be removed in the next step of refactoring.
  const [currentView, setCurrentView] = React.useState('dashboard');

  if (!profile) {
    // This case should theoretically not be hit if App.tsx logic is correct,
    // but it's a good safeguard.
    return <Navigate to="/" />;
  }

  // For workers, the UI is simple and doesn't use the main Layout.
  if (profile.role === 'worker') {
    return <WorkerSuperScreen />;
  }

  // For admin, manager, and director, we use the main Layout.
  // The navigation inside this layout will be refactored next.
  // NOTE: The logic for switching between AdminPanel and Dashboard is kept for now.
  // This will be replaced by distinct routes e.g. /admin, /dashboard
  if (profile.role === 'admin') {
     return (
        <Layout currentView={currentView} onNavigate={setCurrentView}>
          {currentView === 'admin' ? <AdminPanel /> : <Dashboard currentView={currentView} onNavigate={setCurrentView} />}
        </Layout>
     )
  }

  if (profile.role === 'manager' || profile.role === 'director') {
    return (
      <Layout currentView={currentView} onNavigate={setCurrentView}>
        <Dashboard currentView={currentView} onNavigate={setCurrentView} />
      </Layout>
    );
  }

  // Fallback for any other roles or unexpected scenarios.
  return (
    <div>
      <h1>Неизвестная роль пользователя</h1>
    </div>
  );
};

export default App;