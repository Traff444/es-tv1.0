import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  CheckSquare, 
  DollarSign,
  Activity,
  AlertCircle,
  Target,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface StatCard {
  id: string;
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  format?: 'number' | 'time' | 'currency' | 'percentage';
  description?: string;
}

interface RealTimeStatsProps {
  refreshInterval?: number;
  showTrends?: boolean;
}

export const RealTimeStats: React.FC<RealTimeStatsProps> = ({ 
  refreshInterval = 30000, 
  showTrends = true 
}) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchStats = async () => {
    if (!supabase) return;

    try {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Получаем данные о пользователях
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (usersError) throw usersError;

      // Получаем активные смены
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('*')
        .is('end_time', null);

      if (sessionsError) throw sessionsError;

      // Получаем задачи
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*');

      if (tasksError) throw tasksError;

      // Получаем завершенные смены за сегодня
      const { data: todaySessions, error: todayError } = await supabase
        .from('work_sessions')
        .select('total_hours, earnings')
        .gte('start_time', startOfDay.toISOString())
        .not('end_time', 'is', null);

      if (todayError) throw todayError;

      // Получаем завершенные смены за вчера для сравнения
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date(yesterday);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);

      const { data: yesterdaySessions, error: yesterdayError } = await supabase
        .from('work_sessions')
        .select('total_hours, earnings')
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', startOfDay.toISOString())
        .not('end_time', 'is', null);

      if (yesterdayError) throw yesterdayError;

      // Рассчитываем статистику
      const totalWorkers = users.length;
      const activeWorkers = activeSessions.length;
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const pausedTasks = tasks.filter(t => t.status === 'paused').length;

      const todayHours = todaySessions.reduce((sum, session) => sum + (session.total_hours || 0), 0);
      const todayEarnings = todaySessions.reduce((sum, session) => sum + (session.earnings || 0), 0);
      const yesterdayHours = yesterdaySessions.reduce((sum, session) => sum + (session.total_hours || 0), 0);
      const yesterdayEarnings = yesterdaySessions.reduce((sum, session) => sum + (session.earnings || 0), 0);

      const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const avgHoursPerWorker = totalWorkers > 0 ? todayHours / totalWorkers : 0;

      // Рассчитываем изменения
      const hoursChange = yesterdayHours > 0 ? ((todayHours - yesterdayHours) / yesterdayHours) * 100 : 0;
      const earningsChange = yesterdayEarnings > 0 ? ((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100 : 0;

      const newStats: StatCard[] = [
        {
          id: 'active-workers',
          title: 'Активные рабочие',
          value: activeWorkers,
          change: totalWorkers > 0 ? Math.round((activeWorkers / totalWorkers) * 100) : 0,
          changeType: activeWorkers > 0 ? 'increase' : 'neutral',
          icon: Users,
          color: 'bg-green-100 text-green-600',
          format: 'number',
          description: `из ${totalWorkers} всего`
        },
        {
          id: 'tasks-in-progress',
          title: 'Задачи в работе',
          value: inProgressTasks,
          change: totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0,
          changeType: inProgressTasks > 0 ? 'increase' : 'neutral',
          icon: CheckSquare,
          color: 'bg-blue-100 text-blue-600',
          format: 'number',
          description: `${pendingTasks} ожидают`
        },
        {
          id: 'today-hours',
          title: 'Часов сегодня',
          value: todayHours,
          change: hoursChange,
          changeType: hoursChange > 0 ? 'increase' : hoursChange < 0 ? 'decrease' : 'neutral',
          icon: Clock,
          color: 'bg-purple-100 text-purple-600',
          format: 'time',
          description: 'общее время'
        },
        {
          id: 'efficiency',
          title: 'Эффективность',
          value: efficiency,
          change: efficiency > 80 ? 5 : efficiency > 60 ? 2 : -2,
          changeType: efficiency > 80 ? 'increase' : efficiency > 60 ? 'neutral' : 'decrease',
          icon: Target,
          color: 'bg-orange-100 text-orange-600',
          format: 'percentage',
          description: 'завершено задач'
        },
        {
          id: 'today-earnings',
          title: 'Заработок сегодня',
          value: todayEarnings,
          change: earningsChange,
          changeType: earningsChange > 0 ? 'increase' : earningsChange < 0 ? 'decrease' : 'neutral',
          icon: DollarSign,
          color: 'bg-emerald-100 text-emerald-600',
          format: 'currency',
          description: 'общий доход'
        },
        {
          id: 'avg-hours',
          title: 'Средние часы',
          value: avgHoursPerWorker,
          change: avgHoursPerWorker > 8 ? 10 : avgHoursPerWorker > 6 ? 5 : -5,
          changeType: avgHoursPerWorker > 8 ? 'increase' : avgHoursPerWorker > 6 ? 'neutral' : 'decrease',
          icon: Activity,
          color: 'bg-indigo-100 text-indigo-600',
          format: 'time',
          description: 'на рабочего'
        }
      ];

      setStats(newStats);
      setLastUpdate(now);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number | string, format: string = 'number'): string => {
    if (typeof value === 'string') return value;

    switch (format) {
      case 'time':
        return `${value.toFixed(1)}ч`;
      case 'currency':
        return `${value.toLocaleString('ru-RU')} BYN`;
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString('ru-RU');
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="text-center py-8">
        <div className="text-lg font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
        <p className="text-gray-600">Система не настроена для работы с базой данных</p>
      </div>
    );
  }

  if (loading && stats.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок с временем обновления */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Zap className="w-5 h-5 text-blue-500 mr-2" />
          Статистика в реальном времени
        </h2>
        <div className="text-sm text-gray-500">
          Обновлено: {format(lastUpdate, 'HH:mm:ss')}
        </div>
      </div>

      {/* Статистические карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                <div className="flex items-baseline space-x-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatValue(stat.value, stat.format)}
                  </p>
                  {showTrends && stat.change !== undefined && (
                    <div className={`flex items-center space-x-1 text-sm ${getChangeColor(stat.changeType || 'neutral')}`}>
                      {getChangeIcon(stat.changeType || 'neutral')}
                      <span>{stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                {stat.description && (
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                )}
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Индикатор обновления */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Данные обновляются автоматически</span>
      </div>
    </div>
  );
};
