import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../lib/supabase';
import {
  Zap,
  LogOut,
  Package,
  BarChart3,
  Users,
  Settings,
  Home,
  DollarSign,
  CheckSquare
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { profile } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const getNavItems = () => {
    const navItems = [
      { icon: Home, label: 'Дашборд', path: '/dashboard', roles: ['manager', 'director', 'admin'] },
      { icon: CheckSquare, label: 'Задачи', path: '/tasks', roles: ['manager', 'director'] },
      { icon: CheckSquare, label: 'Канбан', path: '/kanban', roles: ['manager', 'director'] },
      { icon: Package, label: 'Материалы', path: '/materials', roles: ['manager', 'director'] },
      { icon: Users, label: 'Команда', path: '/team', roles: ['manager', 'director'] },
      { icon: DollarSign, label: 'Тарифы', path: '/tariffs', roles: ['manager', 'director'] },
      { icon: BarChart3, label: 'Аналитика', path: '/analytics', roles: ['director'] },
      { icon: Settings, label: 'Админ', path: '/admin', roles: ['admin'] },
    ];

    return navItems.filter(item => item.roles.includes(profile?.role || ''));
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
            {getNavItems().map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-w-max ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
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