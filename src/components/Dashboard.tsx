import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TaskMonitor } from './TaskMonitor';
import { RealTimeStats } from './RealTimeStats';
import { supabase } from '../lib/supabase';
import { 
  Zap,
  Users, 
  Package, 
  BarChart3,
  DollarSign,
  Activity,
  CheckSquare,
  Plus,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { User } from '../types';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeWorkers, setActiveWorkers] = useState<User[]>([]);

  useEffect(() => {
    if (profile?.role === 'manager' || profile?.role === 'director') {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [profile?.role]);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      // Fetch active workers (users with an active work session)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('user:users(id, full_name)')
        .is('end_time', null);

      if (sessionsError) throw sessionsError;
      
      const activeWorkerProfiles = activeSessions
        .map(s => s.user)
        .filter((u): u is User => u !== null && typeof u === 'object' && 'id' in u && 'full_name' in u);

      setActiveWorkers(activeWorkerProfiles);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Добро пожаловать';
    
    if (hour < 12) greeting = 'Доброе утро';
    else if (hour < 18) greeting = 'Добрый день';
    else greeting = 'Добрый вечер';

    return `${greeting}, ${profile?.full_name}!`;
  };

  // Render a simplified loading state or null if not a manager/director
  if (profile?.role !== 'manager' && profile?.role !== 'director') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
              <p className="text-blue-100">
                {profile?.role === 'manager' ? 'Менеджер' : 'Директор'} • Панель управления
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{format(new Date(), 'HH:mm')}</div>
            <div className="text-blue-100">{format(new Date(), 'EEEE, d MMMM', { locale: ru })}</div>
          </div>
        </div>
      </div>

      {/* Статистика в реальном времени */}
      <RealTimeStats refreshInterval={30000} showTrends={true} />

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Мониторинг задач */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <CheckSquare className="w-5 h-5 text-blue-500 mr-2" />
                Мониторинг задач
              </h2>
              <Link
                to="/tasks"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Все задачи →
              </Link>
            </div>

            <TaskMonitor
              showOnlyActive={true}
              maxTasks={5}
            />
          </div>
        </div>

        {/* Активные рабочие */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="w-5 h-5 text-green-500 mr-2" />
                Активные рабочие
              </h2>
              <Link
                to="/team"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Команда →
              </Link>
            </div>

            {loading ? (
              <p className="text-gray-500">Загрузка...</p>
            ) : activeWorkers.length > 0 ? (
              <div className="space-y-3">
                {activeWorkers.map((worker) => (
                  <div key={worker.id} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {(worker.full_name || 'N/A').split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{worker.full_name}</div>
                      <div className="text-xs text-gray-500">В смене</div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Нет активных рабочих</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Link
            to="/tasks/new" // Assuming a route for creating a new task
            className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Создать задачу</span>
          </Link>

          <Link
            to="/team"
            className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Users className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-gray-900">Управление командой</span>
          </Link>

          <Link
            to="/materials"
            className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <Package className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-gray-900">Материалы</span>
          </Link>

          <Link
            to="/tariffs"
            className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Тарифы</span>
          </Link>

          <Link
            to="/telegram" // Assuming a route for Telegram settings
            className="flex items-center space-x-3 p-4 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-cyan-600" />
            <span className="font-medium text-gray-900">Telegram</span>
          </Link>

           {profile?.role === 'director' && (
             <Link
               to="/analytics"
               className="flex items-center space-x-3 p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
             >
               <BarChart3 className="w-5 h-5 text-indigo-600" />
               <span className="font-medium text-gray-900">Аналитика</span>
             </Link>
           )}
        </div>
      </div>
    </div>
  );
};