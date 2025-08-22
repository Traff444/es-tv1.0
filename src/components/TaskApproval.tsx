import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Clock, User, MapPin, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/useToast';
import { Task, TaskPhoto, TaskChecklist, User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TaskApprovalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

interface TaskWithDetails extends Task {
  photos: TaskPhoto[];
  checklist: TaskChecklist[];
  assignee: UserType;
  creator: UserType;
}

export const TaskApproval: React.FC<TaskApprovalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPendingTasks();
    }
  }, [isOpen]);

  const loadPendingTasks = async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    try {
      // Загружаем задачи на приёмке с деталями
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(`
          *,
          photos:task_photos(*),
          checklist:task_checklist(*),
          assignee:users!assigned_to(*),
          creator:users!created_by(*),
          task_type:task_types(*)
        `)
        .eq('status', 'awaiting_approval')
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      setTasks(tasksData || []);
    } catch (error) {
      console.error('Ошибка загрузки задач:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить задачи на приёмке",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (task: TaskWithDetails) => {
    setIsProcessing(true);
    try {
      if (!supabase) throw new Error('Supabase не инициализирован');

      const { error } = await supabase.rpc('process_task_approval', {
        task_uuid: task.id,
        action: 'approve',
        comment: comment.trim() || null
      });

      if (error) throw error;

      toast({
        title: "Задача принята",
        description: `Задача "${task.title}" успешно принята`,
        variant: "success"
      });

      setComment('');
      setSelectedTask(null);
      loadPendingTasks();
      onRefresh();

    } catch (error) {
      console.error('Ошибка приёмки задачи:', error);
      toast({
        title: "Ошибка приёмки",
        description: "Не удалось принять задачу",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async (task: TaskWithDetails) => {
    if (!comment.trim()) {
      toast({
        title: "Комментарий обязателен",
        description: "Укажите причину возврата задачи",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (!supabase) throw new Error('Supabase не инициализирован');

      const { error } = await supabase.rpc('process_task_approval', {
        task_uuid: task.id,
        action: 'return',
        comment: comment.trim()
      });

      if (error) throw error;

      toast({
        title: "Задача возвращена",
        description: `Задача "${task.title}" возвращена на доработку`,
        variant: "default"
      });

      setComment('');
      setSelectedTask(null);
      loadPendingTasks();
      onRefresh();

    } catch (error) {
      console.error('Ошибка возврата задачи:', error);
      toast({
        title: "Ошибка возврата",
        description: "Не удалось вернуть задачу",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (task: TaskWithDetails) => {
    const timeSinceSubmission = task.submitted_at 
      ? formatDistanceToNow(new Date(task.submitted_at), { locale: ru, addSuffix: true })
      : '';

    const isUrgent = task.submitted_at && 
      new Date().getTime() - new Date(task.submitted_at).getTime() > 30 * 60 * 1000; // 30 минут

    return (
      <div className="flex items-center gap-2">
        <Badge variant={isUrgent ? "destructive" : "secondary"}>
          На приёмке
        </Badge>
        <span className="text-xs text-gray-500">
          {timeSinceSubmission}
        </span>
      </div>
    );
  };

  const getPhotoTypeLabel = (photoType: string) => {
    const labels: Record<string, string> = {
      'before_context': 'До (общий вид)',
      'before_detail': 'До (детали)',
      'after_context': 'После (общий вид)',
      'after_detail': 'После (детали)'
    };
    return labels[photoType] || photoType;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">
            Приёмка задач ({tasks.length})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex gap-6 h-[calc(90vh-120px)]">
          {/* Список задач */}
          <div className="w-1/3 border-r pr-4 overflow-y-auto">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Загрузка задач...
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Нет задач на приёмке
                </div>
              ) : (
                tasks.map(task => (
                  <div
                    key={task.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTask?.id === task.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm line-clamp-2">
                        {task.title}
                      </h3>
                      {getStatusBadge(task)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <User className="h-3 w-3" />
                      <span>{task.assignee?.full_name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {task.submitted_at 
                            ? new Date(task.submitted_at).toLocaleDateString('ru-RU')
                            : '-'
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{task.photos?.length || 0} фото</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Детали задачи */}
          <div className="flex-1 overflow-y-auto">
            {selectedTask ? (
              <div className="space-y-6">
                {/* Заголовок задачи */}
                <div>
                  <h2 className="text-xl font-semibold mb-2">{selectedTask.title}</h2>
                  <p className="text-gray-600 mb-4">{selectedTask.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Исполнитель:</span>
                      <span className="ml-2">{selectedTask.assignee?.full_name}</span>
                    </div>
                    <div>
                      <span className="font-medium">Тип задачи:</span>
                      <span className="ml-2">{selectedTask.task_type?.display_name}</span>
                    </div>
                    <div>
                      <span className="font-medium">Приоритет:</span>
                      <Badge variant={
                        selectedTask.priority === 'high' ? 'destructive' :
                        selectedTask.priority === 'medium' ? 'default' : 'secondary'
                      } className="ml-2">
                        {selectedTask.priority}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Время выполнения:</span>
                      <span className="ml-2">
                        {selectedTask.started_at && selectedTask.submitted_at
                          ? Math.round((new Date(selectedTask.submitted_at).getTime() - 
                                       new Date(selectedTask.started_at).getTime()) / (1000 * 60))
                          : '-'
                        } мин
                      </span>
                    </div>
                  </div>
                </div>

                {/* Фотографии */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Фотографии</h3>
                  {selectedTask.photos && selectedTask.photos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedTask.photos.map(photo => (
                        <div key={photo.id} className="space-y-2">
                          <img
                            src={photo.photo_url}
                            alt={getPhotoTypeLabel(photo.photo_type)}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <p className="text-xs text-gray-600 text-center">
                            {getPhotoTypeLabel(photo.photo_type)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Фотографии не загружены</p>
                  )}
                </div>

                {/* Чек-лист */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Чек-лист</h3>
                  {selectedTask.checklist && selectedTask.checklist.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTask.checklist.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg ${
                            item.is_completed ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            item.is_completed 
                              ? 'bg-green-500 border-green-500' 
                              : 'border-gray-300'
                          }`}>
                            {item.is_completed && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className={`flex-1 ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {item.checklist_item}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Чек-лист не заполнен</p>
                  )}
                </div>

                {/* Действия */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-3">Действия</h3>
                  
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Комментарий (обязателен при возврате)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprove(selectedTask)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Принять
                      </Button>
                      <Button
                        onClick={() => handleReturn(selectedTask)}
                        disabled={isProcessing || !comment.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Вернуть
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Выберите задачу для просмотра
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
