import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/supabase';
import {
  Zap,
  LogOut,
  Clock,
  CheckSquare,
  Package,
  BarChart3,
  Users,
  Settings,
  Home,
  DollarSign
} from 'lucide-react';

type View = 'dashboard' | 'time' | 'tasks' | 'materials' | 'team' | 'tariffs' | 'analytics' | 'admin';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate?: (view: View) => void;
  currentView?: View;
}

export const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentView }) => {
  const { profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const getNavItems = () => {
    const baseItems = [
      { icon: Home, label: 'Дашборд', view: 'dashboard', roles: ['manager', 'director'] },
      { icon: Clock, label: 'Время', view: 'time', roles: ['worker'] },
      { icon: CheckSquare, label: 'Задачи', view: 'tasks', roles: ['worker', 'manager'] },
    ];

    const managerItems = [
      { icon: Package, label: 'Материалы', view: 'materials', roles: ['manager', 'director'] },
      { icon: Users, label: 'Команда', view: 'team', roles: ['manager', 'director'] },
      { icon: DollarSign, label: 'Тарифы', view: 'tariffs', roles: ['manager', 'director'] },
    ];

    const directorItems = [
      { icon: BarChart3, label: 'Аналитика', view: 'analytics', roles: ['director'] },
    ];

    const adminItems = [
      { icon: Settings, label: 'Админ', view: 'admin', roles: ['admin'] },
    ];

    return [...baseItems, ...managerItems, ...directorItems, ...adminItems]
      .filter(item => item.roles.includes(profile?.role || ''));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ЭлектроСервис</h1>
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 hidden sm:block">
                {profile?.full_name}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Выйти</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {getNavItems().map((item) => (
              <button
                key={item.view}
                onClick={() => onNavigate?.(item.view)}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-w-max ${
                  currentView === item.view
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};