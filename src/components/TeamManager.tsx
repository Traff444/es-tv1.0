import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { User, WorkSession, Task } from '../types';
import { MapDisplay } from './MapDisplay';
import { 
  Users, 
  Mail, 
  Clock, 
  CheckSquare, 
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Award,
  Calendar,
  Phone,
  MapPin,
  Eye,
  X,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TeamMember extends User {
  stats: {
    totalHours: number;
    completedTasks: number;
    totalEarnings: number;
    averageHoursPerDay: number;
  };
}

interface TeamManagerProps {}

export const TeamManager: React.FC<TeamManagerProps> = () => {
  const { profile } = useAuth();

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="text-center py-12">
        <div className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</div>
        <p className="text-gray-600">Система не настроена для работы с базой данных</p>
      </div>
    );
  }

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'hours' | 'tasks' | 'earnings'>('name');

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchMemberTasks = async (memberId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', memberId)
      .not('start_location', 'is', null)
      .or('end_location.not.is.null')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setMemberTasks(data);
    }
  };

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      // Fetch team members
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('role', ['worker', 'manager'])
        .order('full_name');

      if (usersError) throw usersError;

      // Fetch stats for each user
      const membersWithStats = await Promise.all(
        users.map(async (user) => {
          // Get work sessions stats
          const { data: sessions } = await supabase
            .from('work_sessions')
            .select('total_hours, earnings, start_time')
            .eq('user_id', user.id)
            .not('end_time', 'is', null);

          // Get completed tasks count
          const { count: completedTasks } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.id)
            .eq('status', 'completed');

          const totalHours = sessions?.reduce((sum, session) => sum + (session.total_hours || 0), 0) || 0;
          const totalEarnings = sessions?.reduce((sum, session) => sum + (session.earnings || 0), 0) || 0;
          
          // Calculate average hours per day (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentSessions = sessions?.filter(session => 
            new Date(session.start_time) >= thirtyDaysAgo
          ) || [];
          
          const recentHours = recentSessions.reduce((sum, session) => sum + (session.total_hours || 0), 0);
          const averageHoursPerDay = recentHours / 30;

          return {
            ...user,
            stats: {
              totalHours,
              completedTasks: completedTasks || 0,
              totalEarnings,
              averageHoursPerDay,
            },
          };
        })
      );

      setTeamMembers(membersWithStats);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'worker': return 'Рабочий';
      case 'manager': return 'Менеджер';
      case 'director': return 'Директор';
      case 'admin': return 'Администратор';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'worker': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'manager': return 'bg-green-100 text-green-800 border-green-200';
      case 'director': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPerformanceLevel = (member: TeamMember) => {
    const { totalHours, completedTasks, averageHoursPerDay } = member.stats;
    
    if (averageHoursPerDay >= 7 && completedTasks >= 10) return 'excellent';
    if (averageHoursPerDay >= 5 && completedTasks >= 5) return 'good';
    if (averageHoursPerDay >= 3 && completedTasks >= 2) return 'average';
    return 'needs-improvement';
  };

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'average': return 'text-yellow-600 bg-yellow-100';
      case 'needs-improvement': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceText = (level: string) => {
    switch (level) {
      case 'excellent': return 'Отлично';
      case 'good': return 'Хорошо';
      case 'average': return 'Средне';
      case 'needs-improvement': return 'Требует внимания';
      default: return 'Нет данных';
    }
  };

  const filteredAndSortedMembers = teamMembers
    .filter(member => {
      const matchesSearch = member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'hours':
          return b.stats.totalHours - a.stats.totalHours;
        case 'tasks':
          return b.stats.completedTasks - a.stats.completedTasks;
        case 'earnings':
          return b.stats.totalEarnings - a.stats.totalEarnings;
        case 'name':
        default:
          return a.full_name.localeCompare(b.full_name);
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Назад к дашборду</span>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Управление командой</h1>
                <p className="text-gray-600">Обзор производительности и контактные данные сотрудников</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Все роли</option>
              <option value="worker">Рабочие</option>
              <option value="manager">Менеджеры</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSortBy(e.target.value as 'name' | 'hours' | 'tasks' | 'earnings')
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">По имени</option>
              <option value="hours">По часам</option>
              <option value="tasks">По задачам</option>
              <option value="earnings">По заработку</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{teamMembers.length}</div>
              <div className="text-sm text-gray-500">Сотрудников</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.reduce((sum, member) => sum + member.stats.totalHours, 0).toFixed(0)}ч
              </div>
              <div className="text-sm text-gray-500">Общие часы</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.reduce((sum, member) => sum + member.stats.completedTasks, 0)}
              </div>
              <div className="text-sm text-gray-500">Задач выполнено</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {teamMembers.reduce((sum, member) => sum + member.stats.totalEarnings, 0).toFixed(0)} BYN
              </div>
              <div className="text-sm text-gray-500">Общий заработок</div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      {filteredAndSortedMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Сотрудники не найдены</h3>
          <p className="text-gray-500">Попробуйте изменить параметры поиска</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedMembers.map((member) => {
            const performanceLevel = getPerformanceLevel(member);
            return (
              <div
                key={member.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold">
                      {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{member.full_name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(member.role)}`}>
                          {getRoleDisplayName(member.role)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPerformanceColor(performanceLevel)}`}>
                          {getPerformanceText(performanceLevel)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                  </div>
                  {member.hourly_rate && member.hourly_rate > 0 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>{member.hourly_rate} BYN/час</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>С {format(new Date(member.created_at), 'MMM yyyy', { locale: ru })}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{member.stats.totalHours.toFixed(1)}ч</div>
                    <div className="text-xs text-gray-500">Всего часов</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{member.stats.completedTasks}</div>
                    <div className="text-xs text-gray-500">Задач выполнено</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{member.stats.averageHoursPerDay.toFixed(1)}ч</div>
                    <div className="text-xs text-gray-500">Среднее в день</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{member.stats.totalEarnings.toFixed(0)} BYN</div>
                    <div className="text-xs text-gray-500">Заработано</div>
                  </div>
                </div>

                {/* Location tracking button for managers */}
                {(profile?.role === 'manager' || profile?.role === 'director') && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        fetchMemberTasks(member.id);
                        setShowLocationModal(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Посмотреть локации</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && selectedMember && (
        <LocationModal
          member={selectedMember}
          tasks={memberTasks}
          onClose={() => {
            setShowLocationModal(false);
            setSelectedMember(null);
            setMemberTasks([]);
          }}
        />
      )}
    </div>
  );
};

// Location Modal Component
interface LocationModalProps {
  member: TeamMember;
  tasks: Task[];
  onClose: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ member, tasks, onClose }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewType, setViewType] = useState<'start' | 'end'>('start');

  const tasksWithLocations = tasks.filter(task => 
    task.start_location || task.end_location
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Геолокации: {member.full_name}
              </h2>
              <p className="text-gray-600 mt-1">
                История местоположений при выполнении задач
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex h-96">
          {/* Tasks List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Задачи с геолокацией</h3>
              {tasksWithLocations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Нет данных о геолокации</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasksWithLocations.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTask?.id === task.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="font-medium text-sm text-gray-900 mb-1">
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        {task.start_location && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Начато: {task.started_at && format(new Date(task.started_at), 'dd.MM HH:mm', { locale: ru })}</span>
                          </div>
                        )}
                        {task.end_location && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>Завершено: {task.completed_at && format(new Date(task.completed_at), 'dd.MM HH:mm', { locale: ru })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map Display */}
          <div className="flex-1 flex flex-col">
            {selectedTask ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{selectedTask.title}</h4>
                    <div className="flex space-x-2">
                      {selectedTask.start_location && (
                        <button
                          onClick={() => setViewType('start')}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            viewType === 'start'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Начало
                        </button>
                      )}
                      {selectedTask.end_location && (
                        <button
                          onClick={() => setViewType('end')}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            viewType === 'end'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Завершение
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  {viewType === 'start' && selectedTask.start_location ? (
                    <MapDisplay
                      coordinates={selectedTask.start_location}
                      title={`Начало: ${selectedTask.title}`}
                    />
                  ) : viewType === 'end' && selectedTask.end_location ? (
                    <MapDisplay
                      coordinates={selectedTask.end_location}
                      title={`Завершение: ${selectedTask.title}`}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Нет данных о геолокации для выбранного типа</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>Выберите задачу для просмотра геолокации</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};