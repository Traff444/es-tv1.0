import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, getCurrentLocation, formatLocation, signOut, calculateDistance, parseCoordinates, hasValidCredentials } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { WorkSession, Task } from '../../types';
import { TaskPhotoChecklist } from '../TaskPhotoChecklist';
import { HeaderStatus } from './HeaderStatus';
import { ShiftCard } from './ShiftCard';
import { CurrentTaskCard } from './CurrentTaskCard';
import { EarningsToday } from './EarningsToday';
import { HistoryMini } from './HistoryMini';
import { ObjectsList } from './ObjectsList';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Truck, Pause, Camera, Phone } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

type ShiftStatus = 'idle' | 'running' | 'pause';

interface HistoryEntry {
  date: string;
  hours: number;
  earnings: number;
}

interface TaskUpdate {
  status: Task['status'];
  updated_at: string;
  start_location?: string | null;
  started_at?: string;
  total_pause_duration?: number;
  paused_at?: string | null;
  completed_at?: string;
  submitted_at?: string;
  end_location?: string | null;
}

export function WorkerSuperScreen() {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Функция для логирования
  const log = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[WorkerScreen ${timestamp}] ${message}`, data || '');
  };

  if (!hasValidCredentials || !supabase) {
    return (
      <div className="min-h-screen w-full bg-white text-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ошибка конфигурации</h2>
          <p className="text-gray-600">Система не настроена для работы с базой данных</p>
        </div>
      </div>
    );
  }
  
  // State management
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const tabOptions = [
    { id: 'main', label: 'Работа' },
    { id: 'history', label: 'История' },
  ] as const;
  type TabId = typeof tabOptions[number]['id'];
  const [tab, setTab] = useState<TabId>('main');
  const [geoVerified, setGeoVerified] = useState(true);
  const [outside, setOutside] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [currentTaskSeconds, setCurrentTaskSeconds] = useState(0);
  const [showPhotoChecklist, setShowPhotoChecklist] = useState(false);
  const [selectedTaskForChecklist, setSelectedTaskForChecklist] = useState<Task | null>(null);
  const [pendingTaskStart, setPendingTaskStart] = useState<string | null>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update shift timer
  useEffect(() => {
    if (currentSession && !currentSession.end_time) {
      const timer = setInterval(() => {
        const startTime = new Date(currentSession.start_time);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setCurrentSeconds(seconds);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentSession]);

  // Update task timer
  useEffect(() => {
    log('useEffect task timer изменился', { 
      hasCurrentTask: !!currentTask, 
      taskStatus: currentTask?.status, 
      taskStartedAt: currentTask?.started_at 
    });
    
    if (currentTask && currentTask.started_at) {
      if (currentTask.status === 'in_progress') {
        log('Запускаем таймер задачи', { taskId: currentTask.id, taskTitle: currentTask.title });
        const timer = setInterval(() => {
          const taskSeconds = calculateTaskElapsedTime(currentTask);
          setCurrentTaskSeconds(taskSeconds);
        }, 1000);
        return () => {
          log('Останавливаем таймер задачи');
          clearInterval(timer);
        };
      } else if (currentTask.status === 'paused') {
        // При паузе показываем замороженное время
        log('Задача на паузе, показываем замороженное время', { taskId: currentTask.id });
        const taskSeconds = calculateTaskElapsedTime(currentTask);
        setCurrentTaskSeconds(taskSeconds);
      } else {
        log('Останавливаем таймер задачи (задача не активна)', { status: currentTask.status });
        setCurrentTaskSeconds(0);
      }
    } else {
      log('Останавливаем таймер задачи (нет активной задачи)');
      setCurrentTaskSeconds(0);
    }
  }, [currentTask]);

  // Initialize data on component mount
  useEffect(() => {
    if (profile) {
      initializeData();
    }
  }, [profile]);

  // Автоматически начинаем задачу, если есть смена но нет активной задачи
  useEffect(() => {
    if (currentSession && !currentTask && tasks.length > 0 && !loading) {
      // Ищем задачу, которую можно начать (только pending, не paused)
      const startableTask = tasks.find(task => 
        task.status === 'pending'
      );
      if (startableTask) {
        log('Автоматически начинаем задачу после создания смены', { 
          taskId: startableTask.id, 
          taskStatus: startableTask.status 
        });
        // Используем setTimeout чтобы избежать конфликтов с текущим рендером
        setTimeout(() => startTask(startableTask.id), 100);
      }
    }
  }, [currentSession, currentTask, tasks, loading]);

  // Глобальный обработчик ошибок для расширений браузера
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Игнорируем ошибки расширений браузера
      if (event.reason && typeof event.reason === 'string' && 
          (event.reason.includes('message channel closed') || 
           event.reason.includes('listener indicated an asynchronous response'))) {
        log('Игнорируем ошибку расширения браузера', { reason: event.reason });
        event.preventDefault();
        return;
      }
      
      log('Необработанная ошибка Promise', { 
        reason: event.reason,
        stack: event.reason instanceof Error ? event.reason.stack : undefined
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const initializeData = async () => {
    if (!profile) return;
    
    log('Инициализация данных', { userId: profile.id });
    setLoading(true);
    try {
      await Promise.all([
        fetchCurrentSession(),
        (async () => {
          log('fetchTasks() вызов из initializeData');
          return fetchTasks();
        })(),
        fetchTodayStats(),
        fetchHistory()
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSession = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setCurrentSession(data);
    }
  };

  const fetchTasks = async () => {
    if (!profile) return;

    log('Загружаем задачи пользователя', { 
      userId: profile.id,
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n') // Показываем откуда вызывается
    });

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:assigned_to(id, full_name, email),
        creator:created_by(id, full_name, email),
        task_type:task_type_id(id, slug, display_name, requires_before_photos, photo_min, allow_auto_accept, default_checklist),
        task_materials(
          id,
          quantity_needed,
          quantity_used,
          material:material_id(id, name, default_unit, cost_per_unit)
        )
      `)
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      log('Задачи загружены', { 
        totalTasks: data.length, 
        tasks: data.map(t => ({ 
          id: t.id, 
          title: t.title, 
          status: t.status, 
          started_at: t.started_at,
          paused_at: t.paused_at,
          total_pause_duration: t.total_pause_duration
        }))
      });
      
      // Проверяем конкретную задачу, если она есть
      const currentTaskInData = data.find(t => t.id === currentTask?.id);
      if (currentTaskInData) {
        log('Текущая задача в данных из БД', {
          id: currentTaskInData.id,
          status: currentTaskInData.status,
          started_at: currentTaskInData.started_at,
          paused_at: currentTaskInData.paused_at,
          total_pause_duration: currentTaskInData.total_pause_duration
        });
      }
      
      // Проверяем все задачи на предмет сброшенных данных
      const resetTasks = data.filter(t => t.started_at && t.status === 'pending');
      if (resetTasks.length > 0) {
        log('НАЙДЕНЫ СБРОШЕННЫЕ ЗАДАЧИ!', {
          resetTasks: resetTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            started_at: t.started_at,
            paused_at: t.paused_at,
            total_pause_duration: t.total_pause_duration
          }))
        });
      }
      
      setTasks(data);
      
      // Set current task to the first in-progress or pending task
      const inProgressTasks = data.filter(task => task.status === 'in_progress');
      const pendingTasks = data.filter(task => task.status === 'pending');
      
      log('Анализ задач', {
        inProgressTasks: inProgressTasks.length,
        pendingTasks: pendingTasks.length,
        inProgressDetails: inProgressTasks.map(t => ({ 
          id: t.id, 
          title: t.title, 
          status: t.status, 
          started_at: t.started_at 
        })),
        pendingDetails: pendingTasks.map(t => ({ 
          id: t.id, 
          title: t.title, 
          status: t.status 
        }))
      });
      
      const activeTask = data.find(task => 
        task.status === 'in_progress' || task.status === 'pending' || task.status === 'paused'
      );
      
      log('Устанавливаем активную задачу', { 
        activeTask: activeTask ? { 
          id: activeTask.id, 
          title: activeTask.title, 
          status: activeTask.status,
          started_at: activeTask.started_at,
          paused_at: activeTask.paused_at,
          total_pause_duration: activeTask.total_pause_duration
        } : null,
        currentTaskExists: !!currentTask,
        currentTaskId: currentTask?.id
      });
      
      // Обновляем currentTask, если статус изменился в БД
      if (currentTask && activeTask && currentTask.id === activeTask.id) {
        // Если статус задачи изменился в БД, обновляем currentTask
        if (currentTask.status !== activeTask.status || 
            currentTask.paused_at !== activeTask.paused_at ||
            currentTask.total_pause_duration !== activeTask.total_pause_duration) {
          log('Обновляем currentTask из БД - статус изменился', {
            currentTaskId: currentTask.id,
            oldStatus: currentTask.status,
            newStatus: activeTask.status,
            oldPausedAt: currentTask.paused_at,
            newPausedAt: activeTask.paused_at,
            oldPauseDuration: currentTask.total_pause_duration,
            newPauseDuration: activeTask.total_pause_duration
          });
          setCurrentTask(activeTask);
        } else {
          log('currentTask актуален - не обновляем', {
            currentTaskId: currentTask.id,
            currentTaskStatus: currentTask.status
          });
        }
      } else if (!currentTask || (currentTask && activeTask && currentTask.id !== activeTask.id)) {
        // Устанавливаем новую задачу или если задача сменилась
        log('Устанавливаем новую активную задачу', {
          oldTaskId: currentTask?.id,
          newTaskId: activeTask?.id
        });
        setCurrentTask(activeTask || null);
      }
    } else {
      log('Ошибка загрузки задач', { error });
    }
  };

  const fetchTodayStats = async () => {
    if (!profile) return;

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    const { data, error } = await supabase
      .from('work_sessions')
      .select('total_hours, earnings')
      .eq('user_id', profile.id)
      .not('end_time', 'is', null)
      .gte('start_time', startOfToday.toISOString())
      .lte('start_time', endOfToday.toISOString());

    if (!error && data) {
      const totalHours = data.reduce((sum, session) => sum + (session.total_hours || 0), 0);
      const totalEarnings = data.reduce((sum, session) => sum + (session.earnings || 0), 0);
      setTodayHours(totalHours);
      setTodayEarnings(totalEarnings);
    }
  };

  const fetchHistory = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('work_sessions')
      .select('start_time, total_hours, earnings')
      .eq('user_id', profile.id)
      .not('end_time', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);

    if (!error && data) {
      const historyEntries = data.map(session => ({
        date: format(new Date(session.start_time), 'dd.MM'),
        hours: session.total_hours || 0,
        earnings: session.earnings || 0,
      }));
      setHistory(historyEntries);
    }
  };

  const calculateTaskElapsedTime = (task: Task): number => {
    if (!task.started_at) {
      log('calculateTaskElapsedTime: задача не начата', { 
        taskId: task.id, 
        hasStartedAt: !!task.started_at, 
        status: task.status 
      });
      return 0;
    }
    
    const startTime = new Date(task.started_at);
    let endTime: Date;
    
    // Если задача на паузе, считаем время до момента паузы
    if (task.status === 'paused' && task.paused_at) {
      endTime = new Date(task.paused_at);
    } else {
      endTime = new Date();
    }
    
    const totalElapsed = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // Subtract total pause duration
    const pauseDuration = task.total_pause_duration || 0;
    const result = Math.max(0, totalElapsed - pauseDuration);
    
    // Логируем для отладки пауз
    if (task.status === 'paused' || pauseDuration > 0) {
      log('calculateTaskElapsedTime: пауза', { 
        taskId: task.id, 
        status: task.status,
        totalElapsed, 
        pauseDuration, 
        result,
        taskTotalPauseDuration: task.total_pause_duration,
        paused_at: task.paused_at
      });
    }
    
    // Логируем каждые 10 секунд для отслеживания
    if (result % 10 === 0 && result > 0) {
      log('calculateTaskElapsedTime: обновление времени', { 
        taskId: task.id, 
        totalElapsed, 
        pauseDuration, 
        result,
        status: task.status,
        endTime: endTime.toISOString()
      });
    }
    
    return result;
  };

  const getShiftStatus = (): ShiftStatus => {
    if (!currentSession) return 'idle';
    if (currentSession.end_time) return 'idle';
    // You could add pause logic here if needed
    return 'running';
  };

  const formatTime = (seconds: number): string => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startWork = async () => {
    if (!profile) return;
    
    log('Начинаем смену', { userId: profile.id, userName: profile.full_name });
    setLoading(true);
    try {
      let location = null;
      
      try {
        const position = await getCurrentLocation();
        location = formatLocation(position);
        setGeoVerified(true);
        setOutside(false);
      } catch (locationError) {
        console.warn('Geolocation failed:', locationError);
        setGeoVerified(false);
        const proceed = confirm(
          'Не удалось получить GPS координаты. Продолжить без записи местоположения?'
        );
        if (!proceed) {
          return;
        }
      }

      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: profile.id,
          start_time: new Date().toISOString(),
          start_location: location,
        })
        .select()
        .single();

      if (error) throw error;
      
      log('Смена успешно начата', { sessionId: data.id, startTime: data.start_time });
      setCurrentSession(data);
      setCurrentSeconds(0);
      
      toast({
        title: "Смена началась",
        description: "Удачной работы!",
        variant: "success",
      });

    } catch (error) {
      console.error('Error starting work:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось начать смену",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const endWork = async () => {
    if (!currentSession || !profile) return;

    log('Начинаем завершение смены', { 
      sessionId: currentSession.id, 
      userId: profile.id,
      hasActiveTask: !!(currentTask && currentTask.status === 'in_progress')
    });

    // Check if there's an active task
    if (currentTask && currentTask.status === 'in_progress') {
      log('Обнаружена активная задача при завершении смены', { 
        taskId: currentTask.id, 
        taskTitle: currentTask.title 
      });
      const shouldContinue = confirm(
        'У вас есть активная задача. Завершить смену без завершения задачи?'
      );
      if (!shouldContinue) {
        log('Пользователь отменил завершение смены из-за активной задачи');
        return;
      }
    }

    setLoading(true);
    try {
      let location = null;
      
      try {
        log('Получаем геолокацию для завершения смены');
        const position = await getCurrentLocation();
        location = formatLocation(position);
        log('Геолокация получена', { location });
      } catch (locationError) {
        log('Ошибка получения геолокации при завершении смены', { error: locationError });
        console.warn('Geolocation failed:', locationError);
      }
      
      const endTime = new Date();
      const startTime = new Date(currentSession.start_time);
      const totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      // Используем новую систему тарифов для расчета заработка
      const { data: earningsData, error: earningsError } = await supabase
        .rpc('calculate_earnings', {
          user_uuid: profile.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        });
      
      const earnings = earningsError ? 0 : (earningsData || 0);
      
      log('Рассчитываем итоги смены', { 
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalHours: totalHours.toFixed(2),
        earnings: earnings.toFixed(2),
        hourlyRate: profile.hourly_rate
      });

      log('Обновляем смену в базе данных', { 
        sessionId: currentSession.id,
        endTime: endTime.toISOString(),
        totalHours: totalHours.toFixed(2),
        earnings: earnings.toFixed(2)
      });

      const { error } = await supabase
        .from('work_sessions')
        .update({
          end_time: endTime.toISOString(),
          end_location: location,
          total_hours: totalHours,
          earnings: earnings,
        })
        .eq('id', currentSession.id);

      if (error) throw error;
      
      log('Смена успешно завершена в базе данных');
      
      setCurrentSession(null);
      setCurrentSeconds(0);
      
      log('Обновляем статистику и историю');
      // Refresh today's stats
      await fetchTodayStats();
      await fetchHistory();
      
      // НЕ обновляем задачи здесь - смена завершена, задачи не должны перезагружаться
      log('Смена завершена - НЕ обновляем задачи автоматически');
      
      log('Смена полностью завершена', { 
        totalHours: totalHours.toFixed(2), 
        earnings: earnings.toFixed(2) 
      });
      
      toast({
        title: "Смена завершена",
        description: `Сегодня: ${totalHours.toFixed(1)} ч • ${earnings.toFixed(0)} BYN`,
        variant: "success",
      });
    } catch (error) {
      log('ОШИБКА при завершении смены', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.error('Error ending work:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось завершить смену",
        variant: "destructive",
      });
    } finally {
      log('Завершение функции endWork (finally)');
      setLoading(false);
    }
  };

  const pauseShift = async () => {
    if (!currentTask || !profile) return;
    
    setLoading(true);
    try {
      // Получаем актуальные данные задачи из базы данных
      const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('total_pause_duration, paused_at')
        .eq('id', currentTask.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Рассчитываем общую продолжительность пауз
      let totalPauseDuration = taskData.total_pause_duration || 0;
      
      // Если задача уже была на паузе, добавляем время текущей паузы
      if (taskData.paused_at) {
        const pauseStart = new Date(taskData.paused_at);
        const now = new Date();
        const currentPauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
        totalPauseDuration += currentPauseDuration;
        log('Рассчитываем паузу', { 
          pauseStart: pauseStart.toISOString(),
          now: now.toISOString(),
          currentPauseDuration,
          totalPauseDuration
        });
      } else {
        // Если задача не была на паузе, то это первая пауза
        // Время паузы = 0 (пока что), но мы сохраняем текущее время как paused_at
        log('Первая пауза задачи', { 
          taskDataPausedAt: taskData.paused_at,
          taskDataTotalPauseDuration: taskData.total_pause_duration
        });
      }
      
      log('Ставим задачу на паузу', { 
        taskId: currentTask.id, 
        totalPauseDuration,
        previousPauseDuration: taskData.total_pause_duration,
        fromDatabase: true,
        updateData: {
          status: 'paused',
          paused_at: new Date().toISOString(),
          total_pause_duration: totalPauseDuration,
          updated_at: new Date().toISOString(),
        }
      });

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          total_pause_duration: totalPauseDuration,
          // НЕ сбрасываем started_at при паузе!
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentTask.id);

      if (error) throw error;
      
      // Обновляем текущую задачу напрямую
      if (currentTask) {
        const updatedTask = { 
          ...currentTask, 
          status: 'paused' as const, 
          paused_at: new Date().toISOString(),
          total_pause_duration: totalPauseDuration
        };
        log('Обновляем currentTask при паузе', { 
          taskId: currentTask.id,
          total_pause_duration: totalPauseDuration,
          paused_at: updatedTask.paused_at,
          originalTotalPauseDuration: currentTask.total_pause_duration
        });
        setCurrentTask(updatedTask);
      }
      
      toast({
        title: "Задача приостановлена",
        description: "Задача поставлена на паузу",
        variant: "success",
      });
      
      // Добавляем задержку перед fetchTasks, чтобы БД успела обновиться
      setTimeout(() => {
        log('Обновляем список задач после паузы');
        fetchTasks();
      }, 1000);
    } catch (error) {
      console.error('Error pausing task:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось приостановить задачу",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startTask = async (taskId: string) => {
    if (!profile || loading) return;
    
    log('Начинаем задачу', { taskId, userId: profile.id, hasSession: !!currentSession });
    
        // Автоматически начинаем смену, если она не активна
    if (!currentSession) {
      log('Смена не активна, начинаем смену перед задачей');
      setLoading(true);
      try {
        await startWork();
        // После создания смены продолжаем с той же задачей
        // Обновляем сессию и продолжаем
        await fetchCurrentSession();
        log('Смена создана, продолжаем с задачей', { taskId });
        // Теперь продолжаем выполнение с той же задачей
        // currentSession должен быть обновлен
      } finally {
        setLoading(false);
      }
      // НЕ выходим, продолжаем выполнение
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    log('Найдена задача', { 
      taskId, 
      taskTitle: task.title, 
      currentStatus: task.status,
      started_at: task.started_at,
      total_pause_duration: task.total_pause_duration
    });

    // Определяем, это новая задача или возобновление приостановленной
    // Проверяем также, есть ли started_at (если есть, значит задача уже начиналась)
    const isResuming = task.status === 'paused' || (task.started_at && task.status !== 'completed');
    const newStatus = 'in_progress';
    
    // Если задача уже в работе, просто устанавливаем её как текущую
    if (task.status === 'in_progress') {
      log('Задача уже в работе, устанавливаем как текущую', { taskId, taskStatus: task.status });
      setCurrentTask(task);
      return;
    }
    
    log('Тип операции', { isResuming, newStatus });

    // Check location if target_location is specified
    if (task.target_location) {
      try {
        const currentPosition = await getCurrentLocation();
        const currentCoords = {
          lat: currentPosition.coords.latitude,
          lon: currentPosition.coords.longitude
        };
        
        const targetCoords = parseCoordinates(task.target_location);
        
        if (targetCoords) {
          const distance = calculateDistance(
            currentCoords.lat,
            currentCoords.lon,
            targetCoords.lat,
            targetCoords.lon
          );
          
          // If distance is more than 100 meters, show warning
          if (distance > 100) {
            const shouldContinue = confirm(
              `Вы находитесь на расстоянии ${Math.round(distance)} м от объекта задачи.\n\nПродолжить выполнение задачи?`
            );
            if (!shouldContinue) {
              return;
            }
          } else {
            toast({
              title: "Местоположение подтверждено",
              description: `Вы находитесь в ${Math.round(distance)} м от объекта`,
              variant: "success",
            });
          }
        }
      } catch (locationError) {
        console.warn('Location check failed:', locationError);
        const shouldContinue = confirm(
          'Не удалось проверить ваше местоположение. Продолжить без проверки?'
        );
        if (!shouldContinue) {
          return;
        }
      }
    }

    // Проверяем, требуется ли фото "до" для начала работы
    const requiresBeforePhotos = task.task_type?.requires_before_photos || task.effective_requires_before || false;
    if (requiresBeforePhotos && !isResuming) {
      // Проверяем, есть ли уже фото "до"
      const { data: beforePhotos } = await supabase
        .from('task_photos')
        .select('*')
        .eq('task_id', taskId)
        .eq('photo_type', 'before');

      if (!beforePhotos || beforePhotos.length === 0) {
        const shouldTakePhotos = confirm(
          'Для этой задачи требуется сделать фото "до" начала работы. Сделать фото сейчас?'
        );
        if (shouldTakePhotos) {
          setSelectedTaskForChecklist(task);
          setShowPhotoChecklist(true);
          setPendingTaskStart(taskId); // Сохраняем ID задачи для последующего старта
          return; // Не начинаем задачу, пока не сделают фото
        } else {
          const continueAnyway = confirm(
            'Продолжить без фото "до"? Это может повлиять на приёмку работы.'
          );
          if (!continueAnyway) {
            return;
          }
        }
      }
    }
    setLoading(true);
    try {
      let location: string | null = null;
      let updateData: TaskUpdate = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      
      try {
        const position = await getCurrentLocation();
        location = formatLocation(position);
      } catch (locationError) {
        console.warn('Geolocation failed:', locationError);
      }

      if (isResuming) {
        // Возобновляем приостановленную задачу
        // Получаем актуальные данные из БД для правильного total_pause_duration
        
        const { data: taskData, error: fetchError } = await supabase
          .from('tasks')
          .select('total_pause_duration, started_at, paused_at')
          .eq('id', taskId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Рассчитываем время паузы
        let totalPauseDuration = taskData.total_pause_duration || 0;
        if (taskData.paused_at) {
          const pauseStart = new Date(taskData.paused_at);
          const now = new Date();
          const pauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
          totalPauseDuration += pauseDuration;
          
          log('Рассчитываем время паузы при возобновлении', { 
            taskId,
            pauseStart: pauseStart.toISOString(),
            now: now.toISOString(),
            pauseDuration,
            previousTotalPauseDuration: taskData.total_pause_duration,
            newTotalPauseDuration: totalPauseDuration
          });
        }
        
        log('Возобновляем задачу', { 
          taskId, 
          currentPauseDuration: taskData.total_pause_duration,
          calculatedTotalPauseDuration: totalPauseDuration,
          originalStartedAt: taskData.started_at,
          fromDatabase: true
        });
        
        updateData.paused_at = null;
        updateData.total_pause_duration = totalPauseDuration;
        // НЕ изменяем started_at при возобновлении!
        
        toast({
          title: "Задача возобновлена",
          description: "Продолжаем работу над задачей!",
          variant: "success",
        });
      } else {
        // Начинаем новую задачу
        log('Начинаем новую задачу', { taskId, startTime: new Date().toISOString() });
        updateData.started_at = new Date().toISOString();
        updateData.start_location = location;
        
        toast({
          title: "Задача в работе",
          description: "Задача взята в работу!",
          variant: "success",
        });
      }

      log('Обновляем задачу в базе данных', { taskId, updateData });
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;
      
      log('Задача успешно обновлена в базе данных');
      
      // Устанавливаем текущую задачу как активную
      const updatedTask = { 
        ...task, 
        status: 'in_progress' as const, 
        started_at: isResuming ? task.started_at : (updateData.started_at || task.started_at),
        total_pause_duration: isResuming ? updateData.total_pause_duration : (task.total_pause_duration || 0),
        paused_at: undefined
      };
      log('Устанавливаем текущую задачу', { 
        taskId, 
        taskTitle: updatedTask.title,
        started_at: updatedTask.started_at,
        total_pause_duration: updatedTask.total_pause_duration
      });
      setCurrentTask(updatedTask);
      
      // Добавляем задержку перед fetchTasks, чтобы БД успела обновиться
      setTimeout(() => {
        log('Обновляем список задач после изменения');
        fetchTasks();
      }, 1000);
    } catch (error) {
      console.error('Error starting task:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось начать задачу",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // ✅ ПРАВИЛЬНО: Проверяем общее количество фото и фото результата для завершения
    const photoMin = task.task_type?.photo_min || task.effective_photo_min || 2;
    
    // Проверяем общее количество фото
    const { data: allPhotos } = await supabase
      .from('task_photos')
      .select('*')
      .eq('task_id', taskId);

    if (!allPhotos || allPhotos.length < photoMin) {
      toast({
        title: "Недостаточно фото",
        description: `Для завершения задачи необходимо минимум ${photoMin} фото. Загружено: ${allPhotos?.length || 0}`,
        variant: "destructive",
      });
      return;
    }

    // Проверяем наличие фото результата
    const { data: resultPhotos } = await supabase
      .from('task_photos')
      .select('*')
      .eq('task_id', taskId)
      .eq('photo_type', 'after');

    if (!resultPhotos || resultPhotos.length === 0) {
      toast({
        title: "Требуется фото результата",
        description: "Для завершения задачи необходимо загрузить фото выполненной работы.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let location = null;
      
      try {
        const position = await getCurrentLocation();
        location = formatLocation(position);
      } catch (locationError) {
        console.warn('Geolocation failed:', locationError);
      }

      let updateData: TaskUpdate = {
        status: 'awaiting_approval',
        completed_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        end_location: location,
        updated_at: new Date().toISOString(),
      };

      // Если задача была на паузе, total_pause_duration уже обновлен в pauseShift
      if (task && task.paused_at) {
        updateData.paused_at = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;
      
      // Сбрасываем текущую задачу, если завершили её
      if (currentTask && currentTask.id === taskId) {
        setCurrentTask(null);
      }
      
      toast({
        title: "Задача отправлена на приёмку",
        description: "Задача отправлена менеджеру для проверки. Вы получите уведомление о результатах.",
        variant: "success",
      });
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось завершить задачу",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const moveStart = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Open maps with task location
    if (task.start_location) {
      const coords = task.start_location.split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        const url = `https://maps.google.com/?q=${coords[0]},${coords[1]}`;
        window.open(url, '_blank');
      }
    } else {
      // Use task description or title as address
      const address = encodeURIComponent(task.description || task.title);
      const url = `https://maps.google.com/?q=${address}`;
      window.open(url, '_blank');
    }
    
    toast({
      title: "В путь",
      description: "Откроем маршрут и учтём дорогу.",
      variant: "success",
    });
  };

  const photoReport = async () => {
    if (!currentTask) {
      toast({
        title: "Ошибка",
        description: "Нет активной задачи для фото-отчёта",
        variant: "destructive",
      });
      return;
    }

    setSelectedTaskForChecklist(currentTask);
    setShowPhotoChecklist(true);
  };

  const handlePhotoChecklistSubmit = () => {
    setShowPhotoChecklist(false);
    setSelectedTaskForChecklist(null);
    fetchTasks(); // Обновляем список задач
    toast({
      title: "Фото добавлены",
      description: "Фото успешно добавлены к задаче!",
      variant: "success",
    });
    
    // Если есть ожидающий старт задачи, запускаем его
    if (pendingTaskStart) {
      log('Продолжаем старт задачи после загрузки фото', { taskId: pendingTaskStart });
      setTimeout(() => {
        startTask(pendingTaskStart);
        setPendingTaskStart(null);
      }, 1000); // Небольшая задержка для обновления данных
    }
  };

  const callManager = async () => {
    toast({
      title: "Звонок менеджеру",
      description: "Соединяем с менеджером...",
      variant: "default",
    });
  };

  const handleMainAction = async () => {
    const status = getShiftStatus();
    if (status === 'idle') {
      await startWork();
    } else {
      await endWork();
    }
  };

  const handleLogout = async () => {
    if (currentSession && !currentSession.end_time) {
      const shouldLogout = confirm(
        'У вас активная смена. Выйти из системы без завершения смены?'
      );
      if (!shouldLogout) return;
    }
    
    await signOut();
  };

  const shiftStatus = getShiftStatus();
  const mainCtaLabel = shiftStatus === 'idle' 
    ? (outside ? 'Начать (unverified)' : 'Начать работу')
    : 'Завершить смену';

  return (
    <div className="min-h-screen w-full bg-white text-slate-900">
      <HeaderStatus
        status={shiftStatus}
        geoVerified={geoVerified}
        outside={outside}
        currentTime={currentTime.toLocaleTimeString('ru-RU')}
        onLogout={handleLogout}
      />

      {/* Табы */}
      <div className="mx-auto max-w-sm px-4 py-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabOptions.map((t) => (
            <button
              key={t.id}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент */}
      <main className="mx-auto max-w-sm space-y-5 px-4 pb-24">
        {/* Компактное приветствие + KPI дня */}
        <section className="flex items-center gap-2">
          <div className="text-sm text-slate-500">Добрый день, {profile?.full_name}!</div>
          <div className="ml-auto flex gap-2">
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium">
              Сегодня: <span className="font-bold">{todayEarnings.toLocaleString()} BYN</span>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium">
              <span className="font-bold">{todayHours.toFixed(1)} ч</span>
            </div>
          </div>
        </section>

        {tab === 'main' && (
          <>
            {/* Основной экран - только текущая работа */}
            
            {/* Смена */}
            <ShiftCard
              status={shiftStatus}
              outside={outside}
              currentTime={formatTime(currentSeconds)}
              onMainAction={handleMainAction}
              loading={loading}
            />

            {/* Текущая задача */}
            <CurrentTaskCard
              task={currentTask}
              taskElapsedTime={formatTime(currentTaskSeconds)}
              onStartTask={startTask}
              onCompleteTask={completeTask}
              onPause={pauseShift}
              onPhotoReport={photoReport}
              onCallManager={callManager}
              loading={loading}
            />

            {/* Объекты */}
            <ObjectsList
              tasks={tasks}
              onMoveStart={moveStart}
              loading={loading}
            />

            {/* Статистика дня */}
            <EarningsToday
              todayEarnings={todayEarnings}
              todayHours={todayHours}
            />

            {/* Список активных задач */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Активные задачи</h3>
              {tasks.filter(task => task.status !== 'completed').length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Нет активных задач</p>
                </div>
              ) : (
                tasks
                  .filter(task => task.status !== 'completed')
                  .map((task) => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{task.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{task.description}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Статус: {
                              task.status === 'in_progress' ? 'В работе' :
                              task.status === 'paused' ? 'На паузе' :
                              'Ожидает'
                            }
                          </div>
                        </div>
                        <Badge 
                          variant={
                            task.priority === 'high' ? 'warning' : 
                            task.priority === 'medium' ? 'secondary' : 'success'
                          }
                          className="text-xs"
                        >
                          {task.priority === 'high' ? 'Высокий' : 
                           task.priority === 'medium' ? 'Средний' : 'Низкий'}
                        </Badge>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            {/* Экран истории */}
            
            {/* История смен */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">История смен</h3>
              <HistoryMini
                history={history}
                onShowAll={() => toast({ title: "История", description: "Показать все смены" })}
              />
            </div>

            {/* Выполненные задачи */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Выполненные задачи</h3>
              {tasks.filter(task => task.status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Нет выполненных задач</p>
                </div>
              ) : (
                tasks
                  .filter(task => task.status === 'completed')
                  .map((task) => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{task.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{task.description}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Завершена: {task.completed_at ? new Date(task.completed_at).toLocaleDateString('ru-RU') : 'Неизвестно'}
                          </div>
                        </div>
                        <Badge variant="success" className="text-xs">
                          Завершена
                        </Badge>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Нижняя закреплённая панель */}
      <div className="fixed bottom-0 left-0 right-0 z-10 mx-auto max-w-sm px-4 pb-[calc(env(safe-area-inset-bottom,0)+16px)]">
        <Button
          size="xl"
          className="w-full shadow-lg"
          variant={shiftStatus === 'running' ? 'destructive' : 'default'}
          onClick={handleMainAction}
          disabled={loading}
        >
          {mainCtaLabel}
        </Button>
      </div>

      {/* Photo Checklist Modal */}
      {showPhotoChecklist && selectedTaskForChecklist && (
        <TaskPhotoChecklist
          task={selectedTaskForChecklist}
          isOpen={showPhotoChecklist}
          onClose={() => {
            setShowPhotoChecklist(false);
            setSelectedTaskForChecklist(null);
            setPendingTaskStart(null); // Очищаем ожидающий старт при закрытии
          }}
          onSubmit={handlePhotoChecklistSubmit}
        />
      )}
    </div>
  );
}