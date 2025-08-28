import { useState, useEffect } from 'react'
import { twa } from '../lib/telegram'
import { 
  getTaskPhotos, 
  getTaskType, 
  getTaskChecklist, 
  createTaskChecklist, 
  updateChecklistItem,
  validatePhotoRequirements
} from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { PhotoCapture } from './PhotoCapture'
import type { TaskWithPhotoRequirements, TaskPhoto, TaskChecklistItem, PhotoType } from '../types'

interface TaskPhotoChecklistProps {
  task: TaskWithPhotoRequirements
  onComplete: () => void
  onBack: () => void
}

type Screen = 'main' | 'photo-capture'

export function TaskPhotoChecklist({ task, onComplete, onBack }: TaskPhotoChecklistProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main')
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([])
  const [taskType, setTaskType] = useState<TaskWithPhotoRequirements['task_type'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [capturePhotoType, setCapturePhotoType] = useState<PhotoType>('before')
  const { toast } = useToast()

  useEffect(() => {
    loadTaskData()
  }, [task.id])

  useEffect(() => {
    if (currentScreen === 'main') {
      // Set up back button for main screen
      twa.showBackButton(onBack)
      
      // Update main button based on validation
      updateMainButton()
    }
    
    return () => {
      if (currentScreen === 'main') {
        twa.hideBackButton()
        twa.hideMainButton()
      }
    }
  }, [currentScreen, photos, checklist, onBack])

  const loadTaskData = async () => {
    try {
      setLoading(true)
      
      // Load task type
      if (task.task_type_id) {
        const type = await getTaskType(task.task_type_id)
        setTaskType(type)
      }
      
      // Load existing photos
      const existingPhotos = await getTaskPhotos(task.id)
      setPhotos(existingPhotos)
      
      // Load existing checklist or create from template
      let existingChecklist = await getTaskChecklist(task.id)
      
      if (existingChecklist.length === 0 && taskType?.default_checklist) {
        // Create checklist from template
        existingChecklist = await createTaskChecklist(task.id, taskType.default_checklist)
      }
      
      setChecklist(existingChecklist)
    } catch (error) {
      console.error('Error loading task data:', error)
      toast.error('Ошибка загрузки данных задачи')
    } finally {
      setLoading(false)
    }
  }

  const updateMainButton = () => {
    const validation = validatePhotoRequirements(
      photos,
      taskType || undefined,
      task.requires_before_override,
      task.photo_min_override
    )
    
    const completedChecklistItems = checklist.filter(item => item.is_completed).length
    const allChecklistCompleted = checklist.length === 0 || completedChecklistItems === checklist.length
    
    const canSubmit = validation.isValid && allChecklistCompleted
    
    if (canSubmit) {
      twa.showMainButton('Отправить на приемку', submitTask)
    } else {
      twa.hideMainButton()
    }
  }

  const openPhotoCapture = (photoType: PhotoType) => {
    setCapturePhotoType(photoType)
    setCurrentScreen('photo-capture')
    twa.impactOccurred('light')
  }

  const handlePhotoTaken = (photo: TaskPhoto) => {
    setPhotos(prev => [...prev, photo])
    setCurrentScreen('main')
    toast.success('Фото добавлено')
    twa.notificationOccurred('success')
  }

  const handleChecklistToggle = async (item: TaskChecklistItem) => {
    try {
      const newCompleted = !item.is_completed
      await updateChecklistItem(item.id, newCompleted)
      
      setChecklist(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : undefined }
          : i
      ))
      
      twa.impactOccurred('light')
    } catch (error) {
      console.error('Error updating checklist:', error)
      toast.error('Ошибка обновления пункта')
    }
  }

  const submitTask = async () => {
    setSubmitting(true)
    twa.impactOccurred('heavy')
    
    try {
      // Submit task for approval (this would be handled by the parent component)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      
      toast.success('Задача отправлена на приемку!')
      twa.notificationOccurred('success')
      onComplete()
    } catch (error) {
      console.error('Error submitting task:', error)
      toast.error('Ошибка отправки задачи')
      twa.notificationOccurred('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (currentScreen === 'photo-capture') {
    return (
      <PhotoCapture
        taskId={task.id}
        photoType={capturePhotoType}
        onPhotoTaken={handlePhotoTaken}
        onCancel={() => setCurrentScreen('main')}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--tg-theme-bg-color)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--tg-theme-button-color)] border-t-transparent rounded-full mx-auto mb-2" />
          <div className="text-[var(--tg-theme-hint-color)]">Загрузка...</div>
        </div>
      </div>
    )
  }

  const validation = validatePhotoRequirements(
    photos,
    taskType || undefined,
    task.requires_before_override,
    task.photo_min_override
  )

  const beforePhotos = photos.filter(p => p.photo_type === 'before')
  const afterPhotos = photos.filter(p => p.photo_type === 'after')
  const completedChecklistItems = checklist.filter(item => item.is_completed).length

  return (
    <div className="h-full bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--tg-theme-section-separator-color)]">
        <h1 className="text-lg font-semibold text-center">Фото-отчет</h1>
        <p className="text-sm text-[var(--tg-theme-hint-color)] text-center mt-1">
          {task.title}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Photo Requirements */}
        <div className="p-4 border-b border-[var(--tg-theme-section-separator-color)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Фотографии</h2>
            <div className={`text-sm ${validation.isValid ? 'text-green-500' : 'text-[var(--tg-theme-hint-color)]'}`}>
              {photos.length} / {validation.requiredPhotos}
            </div>
          </div>

          {/* Photo Requirements Status */}
          <div className="space-y-2 mb-4">
            {validation.errors.map((error, index) => (
              <div key={index} className="text-sm text-red-500 flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </div>
            ))}
            {validation.isValid && (
              <div className="text-sm text-green-500 flex items-center">
                <span className="mr-2">✅</span>
                Требования к фото выполнены
              </div>
            )}
          </div>

          {/* Photo Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openPhotoCapture('before')}
              className="p-3 bg-[var(--tg-theme-secondary-bg-color)] rounded-lg border border-[var(--tg-theme-section-separator-color)] active:bg-[var(--tg-theme-section-separator-color)]"
            >
              <div className="text-sm font-medium mb-1">Фото "до"</div>
              <div className="text-xs text-[var(--tg-theme-hint-color)]">
                {beforePhotos.length} {beforePhotos.length === 1 ? 'фото' : 'фото'}
              </div>
            </button>
            
            <button
              onClick={() => openPhotoCapture('after')}
              className="p-3 bg-[var(--tg-theme-secondary-bg-color)] rounded-lg border border-[var(--tg-theme-section-separator-color)] active:bg-[var(--tg-theme-section-separator-color)]"
            >
              <div className="text-sm font-medium mb-1">Фото "после"</div>
              <div className="text-xs text-[var(--tg-theme-hint-color)]">
                {afterPhotos.length} {afterPhotos.length === 1 ? 'фото' : 'фото'}
              </div>
            </button>
          </div>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.photo_url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded">
                    {photo.photo_type === 'before' ? 'До' : 'После'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Чек-лист</h2>
              <div className={`text-sm ${completedChecklistItems === checklist.length ? 'text-green-500' : 'text-[var(--tg-theme-hint-color)]'}`}>
                {completedChecklistItems} / {checklist.length}
              </div>
            </div>

            <div className="space-y-3">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleChecklistToggle(item)}
                  className="w-full text-left p-3 bg-[var(--tg-theme-secondary-bg-color)] rounded-lg border border-[var(--tg-theme-section-separator-color)] active:bg-[var(--tg-theme-section-separator-color)]"
                >
                  <div className="flex items-start">
                    <div className={`w-5 h-5 rounded border-2 mr-3 mt-0.5 flex items-center justify-center ${
                      item.is_completed 
                        ? 'bg-green-500 border-green-500' 
                        : 'border-[var(--tg-theme-hint-color)]'
                    }`}>
                      {item.is_completed && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm ${item.is_completed ? 'line-through text-[var(--tg-theme-hint-color)]' : ''}`}>
                        {item.item_text}
                      </div>
                      {item.is_completed && item.completed_at && (
                        <div className="text-xs text-[var(--tg-theme-hint-color)] mt-1">
                          Выполнено {new Date(item.completed_at).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submission Status */}
        {submitting && (
          <div className="p-4 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--tg-theme-button-color)] border-t-transparent rounded-full mx-auto mb-2" />
            <div className="text-[var(--tg-theme-hint-color)]">Отправка на приемку...</div>
          </div>
        )}
      </div>
    </div>
  )
}