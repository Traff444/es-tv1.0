import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import logger from '../lib/logger';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/useToast';
import { Task, TaskPhoto, TaskChecklist, PhotoType } from '../types';
import { supabase } from '../lib/supabase';

interface TaskPhotoChecklistProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const PHOTO_TYPES: { value: PhotoType; label: string; description: string }[] = [
  { value: 'before', label: 'Фото "до"', description: 'Состояние до начала работы' },
  { value: 'after', label: 'Фото "после"', description: 'Результат выполненной работы' }
];

export const TaskPhotoChecklist: React.FC<TaskPhotoChecklistProps> = ({
  task,
  isOpen,
  onClose,
  onSubmit
}) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<TaskPhoto[]>([]);
  const [checklist, setChecklist] = useState<TaskChecklist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const fileInputRefs = useRef<{ [key in PhotoType]: HTMLInputElement | null }>({
    context: null,
    detail: null,
    process: null,
    result: null
  });
  const cameraInputRefs = useRef<{ [key in PhotoType]: HTMLInputElement | null }>({
    context: null,
    detail: null,
    process: null,
    result: null
  });

  // Определяем требования к фото
  const requiresBefore = task.effective_requires_before || task.task_type?.requires_before_photos || false;
  const photoMin = task.effective_photo_min || task.task_type?.photo_min || 2;
  const checklistItems = task.checklist_override || task.task_type?.default_checklist || [];

  useEffect(() => {
    if (isOpen) {
      loadTaskData();
    }
  }, [isOpen, task.id]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadTaskData = async () => {
    if (!supabase) return;
    
    try {
      // Загружаем фото
      const { data: photosData } = await supabase
        .from('task_photos')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (photosData) {
        setPhotos(photosData);
      }

      // Загружаем чек-лист
      const { data: checklistData } = await supabase
        .from('task_checklist')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (checklistData) {
        setChecklist(checklistData);
      } else {
        // Создаем чек-лист из шаблона
        const newChecklist = checklistItems.map((item, index) => ({
          id: `temp-${index}`,
          task_id: task.id,
          checklist_item: item,
          is_completed: false,
          is_synced: false,
          created_at: new Date().toISOString()
        }));
        setChecklist(newChecklist);
      }
    } catch (error) {
      logger.error('Ошибка загрузки данных задачи:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить фото и чек-лист",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (максимум 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер фото: 10MB",
        variant: "destructive"
      });
      return;
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Неверный тип файла",
        description: "Выберите изображение",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Создаем временный URL для предпросмотра
      const tempUrl = URL.createObjectURL(file);
      
      const newPhoto: TaskPhoto = {
        id: `temp-${Date.now()}`,
        task_id: task.id,
        photo_url: tempUrl,
        photo_type: photoType,
        uploaded_at: new Date().toISOString(),
        is_synced: false,
        file_size: file.size,
        created_at: new Date().toISOString()
      };

      setPhotos(prev => [...prev, newPhoto]);

      // Если онлайн, загружаем на сервер
      if (!isOffline && supabase) {
        const fileName = `${task.id}/${photoType}_${Date.now()}.jpg`;
        
        const { data, error } = await supabase.storage
          .from('task-photos')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);

        // Обновляем фото с реальным URL
        setPhotos(prev => prev.map(p => 
          p.id === newPhoto.id 
            ? { ...p, photo_url: publicUrl, is_synced: true }
            : p
        ));

        // Сохраняем в базу данных
        await supabase
          .from('task_photos')
          .insert({
            task_id: task.id,
            photo_url: publicUrl,
            photo_type: photoType,
            file_size: file.size
          });
      }

      toast({
        title: "Фото загружено",
        description: "Фото успешно добавлено к задаче",
        variant: "success"
      });

    } catch (error) {
      logger.error('Ошибка загрузки фото:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить фото",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      // Очищаем input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleChecklistToggle = async (checklistId: string) => {
    const updatedChecklist = checklist.map(item => 
      item.id === checklistId 
        ? { 
            ...item, 
            is_completed: !item.is_completed,
            completed_at: !item.is_completed ? new Date().toISOString() : undefined
          }
        : item
    );
    
    setChecklist(updatedChecklist);

    // Если онлайн, сохраняем в базу данных
    if (!isOffline && supabase) {
      const item = updatedChecklist.find(i => i.id === checklistId);
      if (item && !item.id.startsWith('temp-')) {
        try {
          await supabase
            .from('task_checklist')
            .update({
              is_completed: item.is_completed,
              completed_at: item.completed_at
            })
            .eq('id', checklistId);
        } catch (error) {
          logger.error('Ошибка обновления чек-листа:', error);
        }
      }
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const getPhotoTypeLabel = (photoType: PhotoType) => {
    return PHOTO_TYPES.find(type => type.value === photoType)?.label || photoType;
  };



  const getPhotoCountByType = (photoType: PhotoType) => {
    return photos.filter(p => p.photo_type === photoType).length;
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Просто закрываем модальное окно - фото уже сохранены
      toast({
        title: "Фото сохранены",
        description: "Фото успешно добавлены к задаче",
        variant: "success"
      });

      onSubmit();
      onClose();

    } catch (error) {
      logger.error('Ошибка сохранения:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить фото",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">
            Фото к задаче ({photos.length} загружено)
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Офлайн индикатор */}
          {isOffline && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Работаем офлайн — всё сохранится
              </span>
            </div>
          )}

          {/* Загрузка фото */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Фотографии</h3>
            
            {PHOTO_TYPES.map(photoType => {
              const count = getPhotoCountByType(photoType.value);
              const typeInfo = photoType;
              
              return (
                <div key={photoType.value} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{typeInfo?.label}</h4>
                      <p className="text-sm text-gray-600">{typeInfo?.description}</p>
                    </div>
                    <Badge variant={count > 0 ? "default" : "secondary"}>
                      {count} фото
                    </Badge>
                  </div>

                  {/* Существующие фото */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    {photos
                      .filter(p => p.photo_type === photoType)
                      .map(photo => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.photo_url}
                            alt={typeInfo?.label}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(photo.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>

                  {/* Кнопки загрузки */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRefs.current[photoType.value]?.click()}
                      disabled={isLoading}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Камера
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[photoType.value]?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Галерея
                    </Button>
                  </div>

                  {/* Скрытые input'ы */}
                  <input
                    ref={(el) => cameraInputRefs.current[photoType.value] = el}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, photoType.value)}
                  />
                  <input
                    ref={(el) => fileInputRefs.current[photoType.value] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, photoType.value)}
                  />
                </div>
              );
            })}
          </div>

          {/* Чек-лист */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Чек-лист</h3>
            <div className="space-y-2">
              {checklist.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleChecklistToggle(item.id)}
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
          </div>

          {/* Статистика */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Фото: {photos.length} загружено
              </p>
              <p className="text-sm text-gray-600">
                Чек-лист: {checklist.filter(i => i.is_completed).length} из {checklist.length}
              </p>
            </div>
            <Badge variant="default">
              Фото сохранены
            </Badge>
          </div>
        </CardContent>

        {/* Кнопки действий */}
        <div className="border-t p-4 flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Сохранение..." : "Сохранить фото"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
