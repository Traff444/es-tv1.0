import { useState, useEffect } from 'react'
import { twa } from '../lib/telegram'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import type { Profile, Task } from '../types'

interface TasksListProps {
  profile: Profile
  onTaskSelect: (task: Task) => void
}

export function TasksList({ profile, onTaskSelect }: TasksListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchTasks()
  }, [profile.id])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
      paused: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Paused' },
      awaiting_photos: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Awaiting Photos' },
      awaiting_approval: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Awaiting Approval' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      done: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Done' },
      returned: { bg: 'bg-red-100', text: 'text-red-800', label: 'Returned' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  const handleTaskTap = (task: Task) => {
    twa.impactOccurred('light')
    onTaskSelect(task)
  }


  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-tg-text mb-4">My Tasks</h1>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-tg-text">My Tasks</h1>
        <span className="text-xs bg-tg-button text-tg-button-text px-2 py-1 rounded-full">
          {tasks.length} total
        </span>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-tg-text mb-2">No Tasks Yet</h3>
          <p className="text-tg-hint text-sm">
            Your assigned tasks will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleTaskTap(task)}
              className="bg-white rounded-lg shadow-sm border p-4 touch-button active:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getPriorityIcon(task.priority)}</span>
                  <h3 className="font-medium text-tg-text line-clamp-1">{task.title}</h3>
                </div>
                {getStatusBadge(task.status)}
              </div>
              
              <p className="text-sm text-tg-hint mb-3 line-clamp-2">
                {task.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-tg-hint">
                <span>
                  Created: {new Date(task.created_at).toLocaleDateString()}
                </span>
                <span className="capitalize">
                  {task.priority} priority
                </span>
              </div>
              
              {task.started_at && (
                <div className="mt-2 text-xs text-tg-hint">
                  Started: {new Date(task.started_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Pull to refresh hint */}
      <div className="text-center py-4">
        <p className="text-xs text-tg-hint">
          Pull down to refresh tasks
        </p>
      </div>
    </div>
  )
}
