import { useEffect } from 'react'
import { twa } from './lib/telegram'
import { useAuth } from './hooks/useAuth'
import { WorkerApp } from './components/WorkerApp'
import { AuthScreen } from './components/AuthScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { DebugOverlay } from './components/DebugOverlay'

function App() {
  console.log('🎯 === NEW VERSION 2.0 APP LOADED ===') // Контрольный лог  
  console.log('🎯 Timestamp:', new Date().toISOString())
  
  const { user, profile, loading, error } = useAuth()

  // Debug logging
  console.log('📋 App state:', { 
    user: user?.id, 
    profile: profile?.full_name, 
    loading, 
    error 
  })

  useEffect(() => {
    console.log('🚀 App useEffect running...')
    
    try {
      // Initialize Telegram WebApp
      console.log('📱 Applying Telegram theme...')
      twa.applyTheme()
      console.log('✅ Telegram theme applied')
      
      // Set viewport for mobile optimization
      const viewport = document.querySelector('meta[name=viewport]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
        console.log('✅ Viewport configured')
      }
    } catch (err) {
      console.error('❌ Error in App useEffect:', err)
    }
  }, [])

  if (loading) {
    console.log('⏳ Showing loading screen')
    return (
      <>
        <LoadingScreen />
        <DebugOverlay />
      </>
    )
  }

  if (error) {
    console.log('❌ Showing error screen:', error)
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-tg-bg">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-tg-text mb-2">Authentication Error</h1>
            <p className="text-tg-hint text-sm mb-4">{error}</p>
            <p className="text-tg-hint text-xs">
              Contact your manager for access
            </p>
          </div>
        </div>
        <DebugOverlay />
      </>
    )
  }

  if (!user || !profile) {
    console.log('🔑 Showing auth screen - user:', !!user, 'profile:', !!profile)
    return (
      <>
        <AuthScreen />
        <DebugOverlay />
      </>
    )
  }

  // Only allow workers to use this app
  if (profile.role !== 'worker') {
    console.log('🚫 Access denied - user role:', profile.role)
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-4 bg-tg-bg">
          <div className="text-center">
            <div className="text-4xl mb-4">🚫</div>
            <h1 className="text-xl font-semibold text-tg-text mb-2">Access Denied</h1>
            <p className="text-tg-hint text-sm">
              This app is for workers only
            </p>
          </div>
        </div>
        <DebugOverlay />
      </>
    )
  }

  console.log('✅ Showing WorkerApp for:', profile.full_name)
  return (
    <>
      <WorkerApp profile={profile} />
      <DebugOverlay />
    </>
  )
}

export default App
