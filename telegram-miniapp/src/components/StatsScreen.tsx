import { useState, useEffect } from 'react'
import { supabase, formatTime } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import type { Profile } from '../types'

interface StatsScreenProps {
  profile: Profile
}

interface DayStats {
  date: string
  totalHours: number
  tasksCompleted: number
  earnings: number
}

export function StatsScreen({ profile }: StatsScreenProps) {
  const [loading, setLoading] = useState(true)
  const [todayStats, setTodayStats] = useState<DayStats | null>(null)
  const [weekStats, setWeekStats] = useState<DayStats[]>([])
  const [totalStats, setTotalStats] = useState({
    totalHours: 0,
    totalTasks: 0,
    totalEarnings: 0
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchStats()
  }, [profile.id])

  const fetchStats = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchTodayStats(),
        fetchWeekStats(),
        fetchTotalStats()
      ])
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const fetchTodayStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    // Fetch today's work sessions
    const { data: sessions } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time', `${today}T23:59:59`)

    // Fetch today's completed tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', profile.id)
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00`)
      .lt('completed_at', `${today}T23:59:59`)

    let totalHours = 0
    if (sessions) {
      sessions.forEach(session => {
        if (session.end_time) {
          const start = new Date(session.start_time)
          const end = new Date(session.end_time)
          totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        }
      })
    }

    const tasksCompleted = tasks ? tasks.length : 0
    const earnings = totalHours * (profile.hourly_rate || 0)

    setTodayStats({
      date: today,
      totalHours,
      tasksCompleted,
      earnings
    })
  }

  const fetchWeekStats = async () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6) // Last 7 days
    
    const weekData: DayStats[] = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      // Fetch sessions for this date
      const { data: sessions } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', profile.id)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lt('start_time', `${dateStr}T23:59:59`)

      // Fetch completed tasks for this date
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', profile.id)
        .eq('status', 'completed')
        .gte('completed_at', `${dateStr}T00:00:00`)
        .lt('completed_at', `${dateStr}T23:59:59`)

      let totalHours = 0
      if (sessions) {
        sessions.forEach(session => {
          if (session.end_time) {
            const start = new Date(session.start_time)
            const end = new Date(session.end_time)
            totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          }
        })
      }

      weekData.push({
        date: dateStr,
        totalHours,
        tasksCompleted: tasks ? tasks.length : 0,
        earnings: totalHours * (profile.hourly_rate || 0)
      })
    }
    
    setWeekStats(weekData)
  }

  const fetchTotalStats = async () => {
    // Fetch all completed sessions
    const { data: sessions } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', profile.id)
      .not('end_time', 'is', null)

    // Fetch all completed tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', profile.id)
      .eq('status', 'completed')

    let totalHours = 0
    if (sessions) {
      sessions.forEach(session => {
        const start = new Date(session.start_time)
        const end = new Date(session.end_time!)
        totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      })
    }

    setTotalStats({
      totalHours,
      totalTasks: tasks ? tasks.length : 0,
      totalEarnings: totalHours * (profile.hourly_rate || 0)
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-tg-text mb-4">Statistics</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-tg-text mb-4">Statistics</h1>
      
      {/* Today's Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-tg-text mb-3 flex items-center">
          <span className="mr-2">📅</span>
          Today
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-tg-text">
              {todayStats ? formatTime(Math.floor(todayStats.totalHours * 3600)) : '0:00'}
            </div>
            <div className="text-xs text-tg-hint">Hours</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-tg-text">
              {todayStats ? todayStats.tasksCompleted : 0}
            </div>
            <div className="text-xs text-tg-hint">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-tg-text">
              {todayStats ? formatCurrency(todayStats.earnings) : '$0.00'}
            </div>
            <div className="text-xs text-tg-hint">Earnings</div>
          </div>
        </div>
      </div>

      {/* Week Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-tg-text mb-3 flex items-center">
          <span className="mr-2">📊</span>
          Last 7 Days
        </h2>
        <div className="space-y-2">
          {weekStats.map((day) => {
            const date = new Date(day.date)
            const isToday = day.date === new Date().toISOString().split('T')[0]
            
            return (
              <div key={day.date} className={`flex items-center justify-between p-2 rounded ${isToday ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-tg-text min-w-[60px]">
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  {isToday && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-tg-hint">
                    {formatTime(Math.floor(day.totalHours * 3600))}
                  </span>
                  <span className="text-tg-hint">
                    {day.tasksCompleted} tasks
                  </span>
                  <span className="font-medium text-tg-text min-w-[60px] text-right">
                    {formatCurrency(day.earnings)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Total Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-tg-text mb-3 flex items-center">
          <span className="mr-2">🏆</span>
          All Time
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-tg-text">
              {formatTime(Math.floor(totalStats.totalHours * 3600))}
            </div>
            <div className="text-xs text-tg-hint">Total Hours</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-tg-text">
              {totalStats.totalTasks}
            </div>
            <div className="text-xs text-tg-hint">Tasks Done</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-tg-text">
              {formatCurrency(totalStats.totalEarnings)}
            </div>
            <div className="text-xs text-tg-hint">Total Earned</div>
          </div>
        </div>
      </div>

      {/* Performance Badge */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-4 text-white text-center">
        <div className="text-2xl mb-2">⭐</div>
        <div className="font-semibold">Performance Rating</div>
        <div className="text-sm opacity-90 mt-1">
          {totalStats.totalTasks > 50 ? 'Expert Worker' : 
           totalStats.totalTasks > 20 ? 'Experienced' : 
           totalStats.totalTasks > 5 ? 'Developing' : 'Newcomer'}
        </div>
      </div>
    </div>
  )
}
