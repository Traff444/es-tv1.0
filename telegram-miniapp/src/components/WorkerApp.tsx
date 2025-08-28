import { useState, useEffect } from 'react'
import { twa } from '../lib/telegram'
import type { Profile, Task } from '../types'
import { MainScreen } from './MainScreen'
import { TasksList } from './TasksList'
import { TaskDetail } from './TaskDetail'
import { StatsScreen } from './StatsScreen'

interface WorkerAppProps {
  profile: Profile
}

type Screen = 'main' | 'tasks' | 'stats' | 'task-detail'

export function WorkerApp({ profile }: WorkerAppProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0)
  
  useEffect(() => {
    // Apply Telegram theme when component mounts
    twa.applyTheme()
    
    // Show haptic feedback when switching screens
    twa.impactOccurred('light')
  }, [])
  
  const handleScreenChange = (screen: Screen) => {
    twa.selectionChanged() // Haptic feedback for selection
    setCurrentScreen(screen)
  }

  const handleTaskSelect = (task: Task) => {
    twa.impactOccurred('medium')
    setSelectedTask(task)
    setCurrentScreen('task-detail')
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    setSelectedTask(updatedTask)
  }

  const handleBackFromTask = () => {
    setSelectedTask(null)
    setCurrentScreen('tasks')
    // Force tasks list refresh when returning from task detail
    setTasksRefreshKey(prev => prev + 1)
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'main':
        return <MainScreen profile={profile} />
      case 'tasks':
        return <TasksList key={tasksRefreshKey} profile={profile} onTaskSelect={handleTaskSelect} />
      case 'task-detail':
        return selectedTask ? (
          <TaskDetail
            task={selectedTask}
            profile={profile}
            onBack={handleBackFromTask}
            onTaskUpdate={handleTaskUpdate}
          />
        ) : null
      case 'stats':
        return <StatsScreen profile={profile} />
      default:
        return <MainScreen profile={profile} />
    }
  }

  return (
    <div className="min-h-screen bg-tg-bg max-w-twa mx-auto">
      {/* Main Content */}
      <div className="pb-20">
        {renderScreen()}
      </div>

      {/* Bottom Navigation - Hide when viewing task details */}
      {currentScreen !== 'task-detail' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex max-w-twa mx-auto">
          <button
            onClick={() => handleScreenChange('main')}
            className={`flex-1 py-3 px-2 text-center touch-button transition-colors min-h-touch ${
              currentScreen === 'main'
                ? 'text-tg-button border-t-2 border-tg-button bg-blue-50'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <div className="text-lg mb-1">🏠</div>
            <div className="text-xs font-medium">Home</div>
          </button>
          
          <button
            onClick={() => handleScreenChange('tasks')}
            className={`flex-1 py-3 px-2 text-center touch-button transition-colors min-h-touch ${
              currentScreen === 'tasks'
                ? 'text-tg-button border-t-2 border-tg-button bg-blue-50'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <div className="text-lg mb-1">📋</div>
            <div className="text-xs font-medium">Tasks</div>
          </button>
          
          <button
            onClick={() => handleScreenChange('stats')}
            className={`flex-1 py-3 px-2 text-center touch-button transition-colors min-h-touch ${
              currentScreen === 'stats'
                ? 'text-tg-button border-t-2 border-tg-button bg-blue-50'
                : 'text-tg-hint hover:text-tg-text'
            }`}
          >
            <div className="text-lg mb-1">📊</div>
            <div className="text-xs font-medium">Stats</div>
          </button>
        </div>
        </div>
      )}
    </div>
  )
}
