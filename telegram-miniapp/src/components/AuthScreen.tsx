import { useEffect, useState } from 'react'
import { twa } from '../lib/telegram'
import { supabase } from '../lib/supabase'

export function AuthScreen() {
  const [telegramUser, setTelegramUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showManualLogin, setShowManualLogin] = useState(false)
  const [email, setEmail] = useState('test.worker@electroservice.by')
  const [password, setPassword] = useState('telegram_481890')
  const [loginLoading, setLoginLoading] = useState(false)
  
  // Massive debug logging
  console.log('🔑 AuthScreen rendered')
  console.log('🌐 User Agent:', navigator.userAgent)
  console.log('📍 Location:', window.location.href)
  console.log('📱 Telegram available:', !!window.Telegram)
  console.log('📱 Telegram WebApp:', !!window.Telegram?.WebApp)
  if (window.Telegram?.WebApp) {
    console.log('📱 WebApp initData:', window.Telegram.WebApp.initData)
    console.log('📱 WebApp initDataUnsafe:', window.Telegram.WebApp.initDataUnsafe)
    console.log('📱 WebApp platform:', window.Telegram.WebApp.platform)
    console.log('📱 WebApp version:', window.Telegram.WebApp.version)
  }
  
  useEffect(() => {
    // Initialize Telegram WebApp and get user data
    const initTelegram = async () => {
      console.log('📱 Initializing Telegram...')
      
      try {
        // Apply Telegram theme
        twa.applyTheme()
        console.log('✅ Theme applied')
        
        // Get user data from Telegram
        const user = twa.getUserData()
        console.log('👤 Telegram user data:', user)
        setTelegramUser(user)
        
        // Haptic feedback to show the app is loading
        twa.impactOccurred('light')
        console.log('✅ Haptic feedback triggered')
        
        setLoading(false)
        console.log('✅ Telegram initialization complete')
      } catch (error) {
        console.error('❌ Telegram initialization error:', error)
        setLoading(false)
      }
    }
    
    initTelegram()
  }, [])
  
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    
    try {
      console.log('🔑 Manual login attempt with:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('❌ Manual login error:', error)
        alert('Login failed: ' + error.message)
      } else {
        console.log('✅ Manual login successful:', data.user?.id)
        // The useAuth hook will detect this change and update the app state
        window.location.reload() // Simple reload to trigger re-authentication
      }
    } catch (error) {
      console.error('❌ Manual login exception:', error)
      alert('Login failed: ' + (error as Error).message)
    } finally {
      setLoginLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-tg-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint text-sm">Initializing Telegram WebApp...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-tg-bg">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">⚡</div>
        <h1 className="text-2xl font-bold text-tg-text mb-2">
          ElectroService
        </h1>
        <p className="text-tg-hint text-sm mb-6">
          Electrical Work Management
        </p>
        
        {telegramUser ? (
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-tg-text font-semibold mb-2">
              Welcome, <strong>{telegramUser.first_name}</strong>!
            </p>
            <div className="text-xs text-tg-hint space-y-1">
              <p><strong>Telegram ID:</strong> {telegramUser.id}</p>
              <p><strong>Username:</strong> {telegramUser.username || 'Not set'}</p>
              <p><strong>Language:</strong> {telegramUser.language_code || 'Not set'}</p>
              <p><strong>Premium:</strong> {telegramUser.is_premium ? 'Yes' : 'No'}</p>
            </div>
            <p className="text-xs text-green-600 mt-2">
              Connecting to system...
            </p>
            <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-100 rounded">
              <p className="font-semibold">Debug Info:</p>
              <p>User ID: {telegramUser.id}</p>
              <p>Expected in DB: telegram_users.telegram_id = {telegramUser.id}</p>
              <p>Check browser console for detailed logs</p>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-600 font-semibold">
              Telegram data not available
            </p>
            <p className="text-xs text-red-500 mt-1">
              Please open this app through Telegram bot
            </p>
            <div className="text-xs text-red-400 mt-2">
              <p>Debug info:</p>
              <p>• window.Telegram: {window.Telegram ? 'Available' : 'Not available'}</p>
              <p>• WebApp: {window.Telegram?.WebApp ? 'Available' : 'Not available'}</p>
              <p>• InitData: {window.Telegram?.WebApp?.initData || 'Empty'}</p>
            </div>
          </div>
        )}
        
        {/* Manual Login for Testing */}
        <div className="mt-6">
          <button 
            onClick={() => setShowManualLogin(!showManualLogin)}
            className="text-xs text-blue-600 underline"
          >
            {showManualLogin ? 'Hide' : 'Show'} Manual Login (Debug)
          </button>
          
          {showManualLogin && (
            <form onSubmit={handleManualLogin} className="mt-4 space-y-3">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
              >
                {loginLoading ? 'Signing In...' : 'Sign In Manually'}
              </button>
            </form>
          )}
        </div>
        
        <div className="text-xs text-tg-hint">
          If you have issues accessing the app,<br />
          contact your manager for assistance
        </div>
      </div>
    </div>
  )
}
