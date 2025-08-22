import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { Task, User } from '../types';
import { 
  Clock, 
  CheckSquare, 
  Users, 
  MapPin, 
  AlertCircle,
  Play,
  Pause,
  Check,
  Eye,
  Phone,
  MessageSquare,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TaskWithAssignee extends Task {
  assignee?: User;
  elapsed_time?: number;
}

interface TaskMonitorProps {
  onTaskClick?: (task: Task) => void;
  showOnlyActive?: boolean;
  maxTasks?: number;
}

export const TaskMonitor: React.FC<TaskMonitorProps> = ({ 
  onTaskClick, 
  showOnlyActive = true, 
  maxTasks = 10 
}) => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    if (!supabase) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('tasks')
        .select('*, assignee:assigned_to(full_name, email)')
        .order('created_at', { ascending: false });

      if (showOnlyActive) {
        query = query.in('status', ['pending', 'in_progress', 'paused']);
      }

      const { data, error } = await query.limit(maxTasks);

      if (error) throw error;

      // Рассчитываем прошедшее время для активных задач
      const tasksWithTime = (data || []).map(task => {
        let elapsed_time = 0;
        
        if (task.status === 'in_progress' && task.started_at) {
          const startTime = new Date(task.started_at);
          const pauseDuration = task.total_pause_duration || 0;
          elapsed_time = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000) - pauseDuration;
        } else if (task.status === 'paused' && task.paused_at) {
          const startTime = new Date(task.started_at || task.created_at);
          const pauseTime = new Date(task.paused_at);
          const pauseDuration = task.total_pause_duration || 0;
          elapsed_time = Math.floor((pauseTime.getTime() - startTime.getTime()) / 1000) - pauseDuration;
        }

        return {
          ...task,
          elapsed_time: Math.max(0, elapsed_time)
        };
      });

      setTasks(tasksWithTime);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />;
      case 'completed':
        return <Check className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: Task['status']): string => {
    switch (status) {
      case 'pending':
        return 'Ожидает';
      case 'in_progress':
        return 'В работе';
      case 'paused':
        return 'На паузе';
      case 'completed':
        return 'Завершена';
      default:
        return 'Неизвестно';
    }
  };

  const getPriorityColor = (priority: Task['priority']): string => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityText = (priority: Task['priority']): string => {
    switch (priority) {
      case 'high':
        return 'Высокий';
      case 'medium':
        return 'Средний';
      case 'low':
        return 'Низкий';
      default:
        return 'Неизвестно';
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">
          {showOnlyActive ? 'Нет активных задач' : 'Нет задач'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskClick?.(task)}
          className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer ${
            task.priority === 'high' ? 'border-l-4 border-l-red-500' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {getStatusIcon(task.status)}
                <h3 className="font-medium text-gray-900">{task.title}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                  {getPriorityText(task.priority)}
                </span>
                <span className="text-sm text-gray-500">
                  {getStatusText(task.status)}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
              
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {task.assignee?.full_name || 'Не назначен'}
                </span>
                
                {task.target_location && (
                  <span className="flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    {task.target_location}
                  </span>
                )}
                
                {task.elapsed_time && task.elapsed_time > 0 && (
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatElapsedTime(task.elapsed_time)}
                  </span>
                )}
                
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(task.created_at), 'dd.MM.yyyy')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {task.status === 'in_progress' && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              )}
              
              {task.priority === 'high' && task.status !== 'completed' && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
          
          {/* Дополнительные действия */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              {task.assignee && (
                <button className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700">
                  <Phone className="w-3 h-3" />
                  <span>Позвонить</span>
                </button>
              )}
              
              <button className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-700">
                <MessageSquare className="w-3 h-3" />
                <span>Сообщение</span>
              </button>
            </div>
            
            <button className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-700">
              <Eye className="w-3 h-3" />
              <span>Подробнее</span>
            </button>
          </div>
        </div>
      ))}
      
      {tasks.length >= maxTasks && (
        <div className="text-center py-4">
          <button 
            onClick={() => onTaskClick?.(tasks[0])}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Показать все задачи →
          </button>
        </div>
      )}
    </div>
  );
};
