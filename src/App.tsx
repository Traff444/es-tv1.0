import React from 'react';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { WorkerSuperScreen } from './components/worker/WorkerSuperScreen';
import { AdminPanel } from './components/AdminPanel';
import { Dashboard } from './components/Dashboard';
import { Toaster } from './components/ui/toaster';
import { hasValidCredentials } from './lib/supabase';

function App() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = React.useState('dashboard');

  // Show loading spinner while checking authentication
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

  // Show auth screen if user is not authenticated or no valid credentials
  if (!hasValidCredentials) {
    return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }

  // Show auth screen if user is not authenticated
  if (!user) {
    return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }

  // Show loading while fetching profile
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if profile is not available
  if (!profile) {
    return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }
  // Show admin panel for admin users
  if (profile?.role === 'admin' && currentView === 'admin') {
    return (
      <>
        <Layout currentView={currentView} onNavigate={setCurrentView}>
          <AdminPanel />
        </Layout>
        <Toaster />
      </>
    );
  }

  // Show worker super screen for workers
  if (profile?.role === 'worker') {
    return (
      <>
        <WorkerSuperScreen />
        <Toaster />
      </>
    );
  }

  // Show main layout for other roles (manager, director)
  return (
    <>
      <Layout currentView={currentView} onNavigate={setCurrentView}>
        <Dashboard currentView={currentView} onNavigate={setCurrentView} />
      </Layout>
      <Toaster />
    </>
  );
}

export default App;