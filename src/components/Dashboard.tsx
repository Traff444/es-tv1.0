import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TimeTracker } from './TimeTracker';
import { TaskManager } from './TaskManager';
import { MaterialManager } from './MaterialManager';
import { TeamManager } from './TeamManager';
import { TaskMonitor } from './TaskMonitor';
import { RealTimeStats } from './RealTimeStats';
import { TariffManager } from './TariffManager';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { 
  Clock, 
  CheckSquare, 
  Users, 
  Package, 
  BarChart3,
  Zap,
  Shield,
  Settings,
  TrendingUp,
  AlertCircle,
  MapPin,
  Calendar,
  DollarSign,
  Activity,
  Eye,
  Plus,
  Filter,
  Search,
  Play,
  Square
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Task, User, WorkSession } from '../types';

interface DashboardProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
}

interface DashboardStats {
  totalWorkers: number;
  activeWorkers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  totalHours: number;
  totalEarnings: number;
  efficiency: number;
}

interface RecentActivity {
  id: string;
  type: 'task_started' | 'task_completed' | 'shift_started' | 'shift_ended';
  user_name: string;
  task_title?: string;
  timestamp: string;
  description: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentView = 'dashboard', onNavigate }) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkers: 0,
    activeWorkers: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    totalHours: 0,
    totalEarnings: 0,
    efficiency: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkers, setActiveWorkers] = useState<User[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (profile?.role === 'manager' || profile?.role === 'director') {
      fetchDashboardData();
    }
  }, [profile?.role]);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    
    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Получаем статистику по рабочим
      const { data: workers, error: workersError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (workersError) throw workersError;

      // Получаем активные смены
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('user_id, user:users(full_name)')
        .is('end_time', null);

      if (sessionsError) throw sessionsError;

      // Получаем статистику по задачам
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*');

      if (tasksError) throw tasksError;

      // Получаем статистику по часам и заработку за сегодня
      const { data: todaySessions, error: todayError } = await supabase
        .from('work_sessions')
        .select('total_hours, earnings')
        .gte('start_time', startOfToday.toISOString())
        .lte('start_time', endOfToday.toISOString())
        .not('end_time', 'is', null);

      if (todayError) throw todayError;

      // Получаем срочные задачи
      const { data: urgent, error: urgentError } = await supabase
        .from('tasks')
        .select('*, assignee:assigned_to(full_name)')
        .eq('priority', 'high')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (urgentError) throw urgentError;

      // Рассчитываем статистику
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      
      const totalHours = todaySessions.reduce((sum, session) => sum + (session.total_hours || 0), 0);
      const totalEarnings = todaySessions.reduce((sum, session) => sum + (session.earnings || 0), 0);
      const efficiency = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      setStats({
        totalWorkers: workers.length,
        activeWorkers: activeSessions.length,
        totalTasks: tasks.length,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        totalHours,
        totalEarnings,
        efficiency
      });

      setActiveWorkers(activeSessions.map(s => s.user).filter(Boolean) as unknown as User[]);
      setUrgentTasks(urgent || []);

      // Создаем недавнюю активность (симуляция)
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'task_completed',
          user_name: 'Иван Петров',
          task_title: 'Монтаж щита',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          description: 'Завершил задачу "Монтаж щита"'
        },
        {
          id: '2',
          type: 'shift_started',
          user_name: 'Алексей Сидоров',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          description: 'Начал смену'
        },
        {
          id: '3',
          type: 'task_started',
          user_name: 'Михаил Козлов',
          task_title: 'Прокладка кабеля',
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          description: 'Начал работу над задачей "Прокладка кабеля"'
        }
      ];
      setRecentActivity(mockActivity);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="text-center py-12">
        <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
        <p className="text-gray-600">Система не настроена для работы с базой данных</p>
      </div>
    );
  }

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Добро пожаловать';
    
    if (hour < 12) greeting = 'Доброе утро';
    else if (hour < 18) greeting = 'Добрый день';
    else greeting = 'Добрый вечер';

    return `${greeting}, ${profile?.full_name}!`;
  };

  // Менеджерский дашборд
  if ((profile?.role === 'manager' || profile?.role === 'director') && currentView === 'dashboard') {
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
                 <button 
                   onClick={() => onNavigate?.('tasks')}
                   className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                 >
                   Все задачи →
                 </button>
               </div>
               
               <TaskMonitor 
                 onTaskClick={(task) => onNavigate?.('tasks')}
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
                <button 
                  onClick={() => onNavigate?.('team')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Команда →
                </button>
              </div>
              
              {activeWorkers.length > 0 ? (
                <div className="space-y-3">
                  {activeWorkers.map((worker) => (
                    <div key={worker.id} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {worker.full_name.split(' ').map(n => n[0]).join('')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate?.('tasks')}
              className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Создать задачу</span>
            </button>
            
            <button
              onClick={() => onNavigate?.('team')}
              className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Users className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-900">Управление командой</span>
            </button>
            
            <button
              onClick={() => onNavigate?.('materials')}
              className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <Package className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-gray-900">Материалы</span>
            </button>
            
                         <button
               onClick={() => onNavigate?.('tariffs')}
               className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
             >
               <DollarSign className="w-5 h-5 text-green-600" />
               <span className="font-medium text-gray-900">Тарифы</span>
             </button>
             
             <button
               onClick={() => onNavigate?.('analytics')}
               className="flex items-center space-x-3 p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
             >
               <BarChart3 className="w-5 h-5 text-indigo-600" />
               <span className="font-medium text-gray-900">Аналитика</span>
             </button>
          </div>
        </div>

        {/* Недавняя активность */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Недавняя активность</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  {activity.type === 'task_completed' && <CheckSquare className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'task_started' && <Play className="w-4 h-4 text-green-600" />}
                  {activity.type === 'shift_started' && <Clock className="w-4 h-4 text-purple-600" />}
                  {activity.type === 'shift_ended' && <Square className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{activity.user_name}</div>
                  <div className="text-sm text-gray-600">{activity.description}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(activity.timestamp), 'HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Остальные роли и представления
  return (
    <div className="space-y-8">
      {/* Render specific view content based on currentView */}
      {currentView === 'time' && profile?.role === 'worker' && (
        <div>
          <TimeTracker onNavigate={onNavigate} />
        </div>
      )}

      {currentView === 'tasks' && (profile?.role === 'manager' || profile?.role === 'worker') && (
        <div>
          <TaskManager onNavigate={onNavigate} />
        </div>
      )}

      {currentView === 'materials' && (profile?.role === 'manager' || profile?.role === 'director') && (
        <div>
          <MaterialManager onNavigate={onNavigate} />
        </div>
      )}

      {currentView === 'team' && (profile?.role === 'manager' || profile?.role === 'director') && (
        <div>
          <TeamManager onNavigate={onNavigate} />
        </div>
      )}

      {currentView === 'tariffs' && (profile?.role === 'manager' || profile?.role === 'director') && (
        <div>
          <TariffManager onNavigate={onNavigate} />
        </div>
      )}

      {currentView === 'analytics' && profile?.role === 'director' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Аналитика</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Аналитика</h3>
            <p className="text-gray-500">Раздел в разработке</p>
          </div>
        </div>
      )}

      {/* Default dashboard view для других ролей */}
      {currentView === 'dashboard' && profile?.role === 'worker' && (
        <>
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
                <p className="text-blue-100">Рабочий</p>
              </div>
            </div>
            <p className="text-blue-100">
              Система управления электромонтажными работами
            </p>
          </div>

          {/* Quick Actions для рабочих */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Быстрые действия</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                onClick={() => onNavigate?.('time')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Учет времени</h3>
                    <p className="text-sm text-gray-600">Отметить начало/конец смены</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => onNavigate?.('tasks')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Мои задачи</h3>
                    <p className="text-sm text-gray-600">Просмотр назначенных задач</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content для рабочих */}
          <div>
            <TimeTracker onNavigate={onNavigate} />
          </div>

          <div>
            <TaskManager onNavigate={onNavigate} />
          </div>
        </>
      )}

      {currentView === 'dashboard' && profile?.role === 'admin' && (
        <>
          {/* Welcome Section для админа */}
          <div className="bg-gradient-to-r from-red-600 to-pink-700 rounded-2xl p-8 text-white">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{getWelcomeMessage()}</h1>
                <p className="text-red-100">Администратор</p>
              </div>
            </div>
            <p className="text-red-100">
              Система управления электромонтажными работами
            </p>
          </div>

          {/* Admin Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Быстрые действия</h2>
            <AdminQuickActions onNavigate={onNavigate} />
          </div>
        </>
      )}
    </div>
  );
};

// Компонент быстрых действий для админа
interface AdminQuickActionsProps {
  onNavigate?: (view: string) => void;
}

const AdminQuickActions: React.FC<AdminQuickActionsProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    rolesChanged: 0,
    activeTasks: 0,
    systemStatus: 'Работает'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    if (!supabase) return;
    
    try {
      // Получаем количество пользователей
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Получаем количество изменений ролей за последние 30 дней
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: rolesCount } = await supabase
        .from('role_change_logs')
        .select('*', { count: 'exact', head: true })
        .gte('changed_at', thirtyDaysAgo.toISOString());

      // Получаем количество активных задач
      const { count: tasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress']);

      setStats({
        totalUsers: usersCount || 0,
        rolesChanged: rolesCount || 0,
        activeTasks: tasksCount || 0,
        systemStatus: 'Работает'
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      icon: Users,
      label: 'Пользователей',
      value: loading ? '-' : stats.totalUsers.toString(),
      color: 'bg-red-100 text-red-600',
      description: 'Всего в системе',
      onClick: () => onNavigate?.('admin')
    },
    {
      icon: Shield,
      label: 'Ролей изменено',
      value: loading ? '-' : stats.rolesChanged.toString(),
      color: 'bg-blue-100 text-blue-600',
      description: 'За последние 30 дней',
      onClick: () => onNavigate?.('admin')
    },
    {
      icon: CheckSquare,
      label: 'Активных задач',
      value: loading ? '-' : stats.activeTasks.toString(),
      color: 'bg-green-100 text-green-600',
      description: 'В работе и ожидают',
      onClick: () => onNavigate?.('tasks')
    },
    {
      icon: Settings,
      label: 'Система',
      value: stats.systemStatus,
      color: 'bg-purple-100 text-purple-600',
      description: 'Статус системы',
      onClick: () => onNavigate?.('admin')
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {quickActions.map((action, index) => (
        <div
          key={index}
          onClick={action.onClick}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <action.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{action.value}</div>
              <div className="text-sm text-gray-500">{action.label}</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">{action.description}</div>
        </div>
      ))}
    </div>
  );
};