import { useState, useEffect } from 'react'
import { twa } from '../lib/telegram'
import { supabase, getCurrentLocation, formatLocation, formatTime, directApiCall } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import type { Profile, WorkSession, Task } from '../types'
import { HeaderStatus } from './HeaderStatus'
import { EarningsToday } from './EarningsToday'
import { ShiftCard } from './ShiftCard'
import { CurrentTaskCard } from './CurrentTaskCard'

interface MainScreenProps {
  profile: Profile
}

// Tab navigation types
const tabOptions = [
  { id: 'main', label: 'Работа' },
  { id: 'history', label: 'История' },
] as const
type TabId = typeof tabOptions[number]['id']

// State type for shift status (now using portedcomponents)
type ShiftStatus = 'running' | 'pause' | 'idle';





export function MainScreen({ profile }: MainScreenProps) {
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null)
  const [currentTask, setCurrentTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tab, setTab] = useState<TabId>('main')
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [taskSeconds, setTaskSeconds] = useState(0)
  const { toast } = useToast()

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Update session timer
  useEffect(() => {
    if (currentSession && !currentSession.end_time) {
      const timer = setInterval(() => {
        const startTime = new Date(currentSession.start_time)
        const now = new Date()
        const seconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        setSessionSeconds(seconds)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentSession])

  // Update task timer
  useEffect(() => {
    if (currentTask && currentTask.started_at && currentTask.status === 'in_progress') {
      const timer = setInterval(() => {
        const startTime = new Date(currentTask.started_at!)
        const now = new Date()
        let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)
        
        // Subtract pause duration if any
        if (currentTask.total_pause_duration) {
          elapsed -= currentTask.total_pause_duration
        }
        
        setTaskSeconds(Math.max(0, elapsed))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [currentTask])

  useEffect(() => {
    fetchCurrentSession()
    fetchCurrentTask()
  }, [profile.id])

  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching session:', error)
        return
      }

      setCurrentSession(data || null)
    } catch (error) {
      console.error('Error fetching session:', error)
    }
  }

  const fetchCurrentTask = async () => {
    try {
      // Use direct API call for better reliability
      const data = await directApiCall(
        `tasks?assigned_to=eq.${profile.id}&status=in.("in_progress","paused","pending")&order=created_at.desc&limit=1`
      )
      
      if (data && data.length > 0) {
        setCurrentTask(data[0])
      } else {
        setCurrentTask(null)
      }
    } catch (error) {
      console.error('Error fetching task:', error)
    }
  }

  // Task management functions
  const handleStartTask = async (taskId: string) => {
    if (loading) return
    
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      const position = await getCurrentLocation()
      const location = formatLocation(position.coords)
      
      // Update task to in_progress status
      await directApiCall(`tasks?id=eq.${taskId}`, {
        method: 'PATCH',
        body: {
          status: 'in_progress',
          started_at: new Date().toISOString(),
          start_location: location,
          paused_at: null,
          total_pause_duration: currentTask?.total_pause_duration || 0
        }
      })
      
      await fetchCurrentTask()
      toast.success('Задача начата!')
      twa.notificationOccurred('success')
    } catch (error) {
      console.error('Error starting task:', error)
      toast.error('Ошибка при начале задачи')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
    }
  }

  const handlePauseTask = async () => {
    if (!currentTask || loading) return
    
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      // Calculate current pause duration
      const now = new Date()
      const currentDuration = currentTask.total_pause_duration || 0
      
      await directApiCall(`tasks?id=eq.${currentTask.id}`, {
        method: 'PATCH',
        body: {
          status: 'paused',
          paused_at: now.toISOString()
        }
      })
      
      await fetchCurrentTask()
      toast.success('Задача приостановлена')
      twa.notificationOccurred('success')
    } catch (error) {
      console.error('Error pausing task:', error)
      toast.error('Ошибка при приостановке задачи')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    if (loading) return
    
    twa.showConfirm('Завершить задачу?', async (confirmed) => {
      if (!confirmed) return
      
      setLoading(true)
      twa.impactOccurred('medium')
      
      try {
        const position = await getCurrentLocation()
        const location = formatLocation(position.coords)
        
        await directApiCall(`tasks?id=eq.${taskId}`, {
          method: 'PATCH',
          body: {
            status: 'completed',
            completed_at: new Date().toISOString(),
            end_location: location
          }
        })
        
        await fetchCurrentTask()
        toast.success('Задача завершена!')
        twa.notificationOccurred('success')
      } catch (error) {
        console.error('Error completing task:', error)
        toast.error('Ошибка при завершении задачи')
        twa.notificationOccurred('error')
      } finally {
        setLoading(false)
      }
    })
  }

  const handlePhotoReport = () => {
    if (!currentTask) return
    
    twa.showAlert('Функция фото-отчета будет добавлена в следующих версиях')
    // TODO: Implement photo report functionality
  }

  const startShift = async () => {
    if (loading) return
    
    twa.showMainButton('Starting shift...', () => {})
    setLoading(true)
    twa.impactOccurred('medium')
    
    try {
      const position = await getCurrentLocation()
      const location = formatLocation(position.coords)
      
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: profile.id,
          start_time: new Date().toISOString(),
          start_location: location
        })
        .select()
        .single()

      if (error) throw error

      setCurrentSession(data)
      toast.success('Shift started successfully!')
      twa.notificationOccurred('success')
    } catch (error) {
      console.error('Error starting shift:', error)
      toast.error('Failed to start shift')
      twa.notificationOccurred('error')
    } finally {
      setLoading(false)
      twa.hideMainButton()
    }
  }

  const endShift = async () => {
    if (!currentSession || loading) return
    
    twa.showConfirm('End your work shift?', async (confirmed) => {
      if (!confirmed) return
      
      twa.showMainButton('Ending shift...', () => {})
      setLoading(true)
      twa.impactOccurred('medium')
      
      try {
        const position = await getCurrentLocation()
        const location = formatLocation(position.coords)
        
        const { error } = await supabase
          .from('work_sessions')
          .update({
            end_time: new Date().toISOString(),
            end_location: location
          })
          .eq('id', currentSession.id)

        if (error) throw error

        setCurrentSession(null)
        setSessionSeconds(0)
        toast.success('Shift ended successfully!')
        twa.notificationOccurred('success')
      } catch (error) {
        console.error('Error ending shift:', error)
        toast.error('Failed to end shift')
        twa.notificationOccurred('error')
      } finally {
        setLoading(false)
        twa.hideMainButton()
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header from Web Version */}
      <HeaderStatus 
        status={currentSession ? 'running' : 'idle'}
        geoVerified={true}
        outside={false}
        currentTime={currentTime.toLocaleTimeString('ru-RU', { hour12: false })}
        userName={profile.full_name}
      />

      {/* Navigation Tabs (from Web Version) */}
      <div className="mx-auto max-w-sm px-4 py-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabOptions.map((t) => (
            <button
              key={t.id}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <>
        {/* Main Content - Tab: Работа */}
        {tab === 'main' && (
          <div className="p-4 space-y-4">
        {/* Professional Shift Card from Web Version */}
        <ShiftCard 
          status={currentSession ? 'running' : 'idle'}
          outside={false}
          currentTime={currentTime.toLocaleTimeString('ru-RU', { hour12: false })}
          onMainAction={currentSession ? endShift : startShift}
          loading={loading}
          workSessionDuration={currentSession ? formatTime(sessionSeconds) : undefined}
        />

        {/* Professional Current Task Card from Web Version */}
        <CurrentTaskCard
          task={currentTask}
          taskElapsedTime={formatTime(taskSeconds)}
          onStartTask={handleStartTask}
          onCompleteTask={handleCompleteTask}
          onPause={handlePauseTask}
          onPhotoReport={handlePhotoReport}
          loading={loading}
        />

        {/* Professional Earnings Card from Web Version */}
        <EarningsToday
          todayEarnings={sessionSeconds * (profile.hourly_rate / 3600)}
          todayHours={sessionSeconds / 3600}
          hourlyRate={profile.hourly_rate}
        />

        {/* Additional Info Card */}
        {currentSession && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📊</span>
              Информация о смене
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Локация начала</div>
                <div className="text-gray-900">{currentSession.start_location || 'Не указано'}</div>
              </div>
              <div>
                <div className="text-gray-500">Статус</div>
                <div className="text-green-600 font-medium">В работе</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {currentSession && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">⚡</span>
              Быстрые действия
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => twa.showAlert('Функция будет добавлена в следующих версиях')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              >
                📞 Связь с офисом
              </button>
              <button
                onClick={() => twa.showAlert('Функция будет добавлена в следующих версиях')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
              >
                📋 История задач
              </button>
            </div>
          </div>
        )}

          {/* Bottom Padding for safe area */}
          <div className="h-20"></div>
        </div>
      )}

      {/* History Tab Content */}
      {tab === 'history' && (
        <div className="p-4 space-y-4">
          {/* History Header */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📊</span>
              История работы
            </h2>
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-semibold text-gray-900 mb-2">История пока пуста</h3>
              <p className="text-sm text-gray-500">После начала работы здесь появится история смен и задач</p>
            </div>
          </div>

          {/* Statistics Card */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <span className="mr-2">📈</span>
              Статистика
            </h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">0</div>
                <div className="text-sm text-gray-600">Смен</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">0</div>
                <div className="text-sm text-gray-600">Задач</div>
              </div>
            </div>
          </div>

          {/* Bottom Padding for safe area */}
          <div className="h-20"></div>
        </div>
      )}
      </>
    </div>
  )
}
