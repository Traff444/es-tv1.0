import { useState, useEffect } from 'react'
import { twa } from '../lib/telegram'
import { supabase, getCurrentLocation, formatLocation, formatTime, validatePhotoRequirements, getTaskPhotos, getTaskType } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { TaskPhotoChecklist } from './TaskPhotoChecklist'
import type { Task, Profile, TaskWithPhotoRequirements, TaskPhoto } from '../types'

interface TaskDetailProps {
  task: Task
  profile: Profile
  onBack: () => void
  onTaskUpdate: (updatedTask: Task) => void
}

type Screen = 'detail' | 'photo-report'

export function TaskDetail({ task, onBack, onTaskUpdate }: TaskDetailProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('detail')
  const [currentTask, setCurrentTask] = useState<Task>(task)
  const [loading, setLoading] = useState(false)
  const [taskSeconds, setTaskSeconds] = useState(0)
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null)
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const [taskWithRequirements, setTaskWithRequirements] = useState<TaskWithPhotoRequirements | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Set up back button only for detail screen
    if (currentScreen === 'detail') {
      twa.showBackButton(onBack)
    }
    
    return () => {
      if (currentScreen === 'detail') {
        twa.hideBackButton()
      }
    }
  }, [onBack, currentScreen])

  useEffect(() => {
    // Load photo data and task requirements
    loadPhotoData()
  }, [currentTask.id])

  const loadPhotoData = async () => {
    try {
      // Load existing photos
      const existingPhotos = await getTaskPhotos(currentTask.id)
      setPhotos(existingPhotos)
      
      // Load task type if available
      let taskType = null
      if (currentTask.task_type_id) {
        taskType = await getTaskType(currentTask.task_type_id)
      }
      
      // Create extended task object
      const extendedTask: TaskWithPhotoRequirements = {
        ...currentTask,
        task_type: taskType || undefined,
        photos: existingPhotos
      }
      
      setTaskWithRequirements(extendedTask)
    } catch (error) {
      console.error('Error loading photo data:', error)
    }
  }

  useEffect(() => {
    // Calculate elapsed time for active tasks
    if (currentTask.started_at && currentTask.status === 'in_progress') {
      const timer = setInterval(() => {
        const startTime = new Date(currentTask.started_at!)
        const now = new Date()
        let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        
        // Subtract total pause duration
        if (currentTask.total_pause_duration) {
          elapsed -= currentTask.total_pause_duration
        }
        
        setTaskSeconds(Math.max(0, elapsed))
      }, 1000)
      
      return () => clearInterval(timer)
    } else if (currentTask.started_at && currentTask.status === 'paused') {
      // For paused tasks, show frozen time
      const startTime = new Date(currentTask.started_at!)
      const pausedAt = new Date(currentTask.paused_at!)
      let elapsed = Math.floor((pausedAt.getTime() - startTime.getTime()) / 1000)
      
      if (currentTask.total_pause_duration) {
        elapsed -= currentTask.total_pause_duration
      }
      
      setTaskSeconds(Math.max(0, elapsed))
    }
  }, [currentTask])

  const updateTaskInDB = async (updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', currentTask.id)
        .select()
        .single()

      if (error) throw error

      const updatedTask = { ...currentTask, ...data }
      setCurrentTask(updatedTask)
      onTaskUpdate(updatedTask)
      return updatedTask
    } catch (error) {
      console.error('Error updating task:', error)
      throw error
    }
  }

  const startTask = async () => {
    if (loading) return
    
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      const position = await getCurrentLocation()
      const location = formatLocation(position.coords)
      
      const updates: Partial<Task> = {
        status: 'in_progress' as const,
        started_at: new Date().toISOString(),
        start_location: location
      }
      
      await updateTaskInDB(updates)
      
      toast.success('Task started!')
      twa.notificationOccurred('success')
      
      // Show main button for pause
      twa.showMainButton('Pause Task', pauseTask)
    } catch (error) {
      console.error('Error starting task:', error)
      toast.error('Failed to start task')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
    }
  }

  const pauseTask = async () => {
    if (loading || currentTask.status !== 'in_progress') return
    
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      const now = new Date().toISOString()
      const updates: Partial<Task> = {
        status: 'paused' as const,
        paused_at: now
      }
      
      await updateTaskInDB(updates)
      setPauseStartTime(new Date())
      
      toast.success('Task paused')
      twa.notificationOccurred('success')
      
      // Show main button for resume
      twa.showMainButton('Resume Task', resumeTask)
    } catch (error) {
      console.error('Error pausing task:', error)
      toast.error('Failed to pause task')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
    }
  }

  const resumeTask = async () => {
    if (loading || currentTask.status !== 'paused') return
    
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      // Calculate pause duration
      let totalPauseDuration = currentTask.total_pause_duration || 0
      if (pauseStartTime) {
        const pauseDuration = Math.floor((new Date().getTime() - pauseStartTime.getTime()) / 1000)
        totalPauseDuration += pauseDuration
      }
      
      const updates: Partial<Task> = {
        status: 'in_progress' as const,
        total_pause_duration: totalPauseDuration,
        paused_at: undefined
      }
      
      await updateTaskInDB(updates)
      setPauseStartTime(null)
      
      toast.success('Task resumed')
      twa.notificationOccurred('success')
      
      // Show main button for pause
      twa.showMainButton('Pause Task', pauseTask)
    } catch (error) {
      console.error('Error resuming task:', error)
      toast.error('Failed to resume task')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
    }
  }

  const completeTask = async () => {
    if (loading) return
    
    // Check photo requirements before completion
    if (taskWithRequirements) {
      const validation = validatePhotoRequirements(
        photos,
        taskWithRequirements.task_type,
        taskWithRequirements.requires_before_override,
        taskWithRequirements.photo_min_override
      )
      
      if (!validation.isValid) {
        toast.error('Требования к фото не выполнены. Добавьте фото-отчет.')
        twa.notificationOccurred('error')
        return
      }
    }
    
    twa.showConfirm('Mark this task as completed?', async (confirmed) => {
      if (!confirmed) return
      
      setLoading(true)
      twa.impactOccurred('heavy')
      
      try {
        const position = await getCurrentLocation()
        const location = formatLocation(position.coords)
        const now = new Date().toISOString()
        
        // If task was paused, add final pause duration
        let totalPauseDuration = currentTask.total_pause_duration || 0
        if (currentTask.status === 'paused' && pauseStartTime) {
          const pauseDuration = Math.floor((new Date().getTime() - pauseStartTime.getTime()) / 1000)
          totalPauseDuration += pauseDuration
        }
        
        const updates: Partial<Task> = {
          status: 'awaiting_approval' as const,
          completed_at: now,
          submitted_at: now,
          end_location: location,
          total_pause_duration: totalPauseDuration,
          paused_at: undefined
        }
        
        await updateTaskInDB(updates)
        
        toast.success('Task completed and submitted for approval!')
        twa.notificationOccurred('success')
        
        // Hide main button
        twa.hideMainButton()
        
        // Go back after a short delay
        setTimeout(() => {
          onBack()
        }, 2000)
      } catch (error) {
        console.error('Error completing task:', error)
        toast.error('Failed to complete task')
        twa.notificationOccurred('error')
      } finally {
        setLoading(false)
      }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-orange-100 text-orange-800'
      case 'awaiting_approval': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const openPhotoReport = () => {
    setCurrentScreen('photo-report')
    twa.impactOccurred('light')
  }

  const handlePhotoReportComplete = () => {
    // Reload photo data after photo report completion
    loadPhotoData()
    setCurrentScreen('detail')
    
    // Update task status to completed
    completeTask()
  }

  const handlePhotoReportBack = () => {
    setCurrentScreen('detail')
  }

  // Set up main button based on current status
  useEffect(() => {
    if (currentScreen !== 'detail') return
    
    switch (currentTask.status) {
      case 'pending':
        twa.showMainButton('Start Task', startTask)
        break
      case 'in_progress':
        twa.showMainButton('Pause Task', pauseTask)
        break
      case 'paused':
        twa.showMainButton('Resume Task', resumeTask)
        break
      case 'awaiting_approval':
      case 'completed':
        twa.hideMainButton()
        break
    }
    
    return () => {
      twa.hideMainButton()
    }
  }, [currentTask.status, currentScreen])

  // Render photo report screen
  if (currentScreen === 'photo-report' && taskWithRequirements) {
    return (
      <TaskPhotoChecklist
        task={taskWithRequirements}
        onComplete={handlePhotoReportComplete}
        onBack={handlePhotoReportBack}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center py-2">
        <h1 className="text-xl font-bold text-tg-text">Task Details</h1>
      </div>

      {/* Task Info Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-semibold text-tg-text pr-2">{currentTask.title}</h2>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(currentTask.status)}`}>
            {currentTask.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        
        <p className="text-tg-hint text-sm mb-4">{currentTask.description}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-tg-hint">Priority:</span>
            <span className={`ml-2 font-medium ${getPriorityColor(currentTask.priority)}`}>
              {currentTask.priority.toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-tg-hint">Created:</span>
            <span className="ml-2 text-tg-text">
              {new Date(currentTask.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Timer Card */}
      {currentTask.started_at && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-tg-text flex items-center">
              <span className="mr-2">⏱️</span>
              Work Timer
            </h3>
            {currentTask.status === 'in_progress' && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-pulse">
                Running
              </span>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-tg-text mb-2">
              {formatTime(taskSeconds)}
            </div>
            <div className="text-sm text-tg-hint">
              Time spent on this task
            </div>
          </div>
          
          {currentTask.total_pause_duration && currentTask.total_pause_duration > 0 && (
            <div className="mt-3 text-center text-sm text-tg-hint">
              Total pause time: {formatTime(currentTask.total_pause_duration)}
            </div>
          )}
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-semibold text-tg-text mb-3 flex items-center">
          <span className="mr-2">📈</span>
          Progress
        </h3>
        
        <div className="space-y-3">
          {currentTask.started_at && (
            <div className="text-sm">
              <span className="text-tg-hint">Started:</span>
              <span className="ml-2 text-tg-text">
                {new Date(currentTask.started_at).toLocaleString()}
              </span>
            </div>
          )}
          
          {currentTask.paused_at && currentTask.status === 'paused' && (
            <div className="text-sm">
              <span className="text-tg-hint">Paused:</span>
              <span className="ml-2 text-tg-text">
                {new Date(currentTask.paused_at).toLocaleString()}
              </span>
            </div>
          )}
          
          {currentTask.completed_at && (
            <div className="text-sm">
              <span className="text-tg-hint">Completed:</span>
              <span className="ml-2 text-tg-text">
                {new Date(currentTask.completed_at).toLocaleString()}
              </span>
            </div>
          )}
          
          {currentTask.start_location && (
            <div className="text-sm">
              <span className="text-tg-hint">Start Location:</span>
              <span className="ml-2 text-tg-text font-mono text-xs">
                {currentTask.start_location}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {currentTask.status !== 'awaiting_approval' && currentTask.status !== 'completed' && (
        <div className="space-y-3">
          {(currentTask.status === 'in_progress' || currentTask.status === 'paused') && (
            <>
              <button
                onClick={openPhotoReport}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium touch-button disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <span className="mr-2">📸</span>
                Photo Report
              </button>
              
              <button
                onClick={completeTask}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium touch-button disabled:opacity-50 transition-colors"
              >
                {loading ? 'Completing...' : 'Complete Task'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Status Message */}
      {currentTask.status === 'awaiting_approval' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="font-semibold text-purple-800">Task Submitted!</div>
          <div className="text-sm text-purple-600 mt-1">
            Your completed task is awaiting manager approval
          </div>
        </div>
      )}
    </div>
  )
}