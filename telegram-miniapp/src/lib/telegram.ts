import WebApp from '@twa-dev/sdk'

export class TelegramWebApp {
  private static instance: TelegramWebApp
  
  private constructor() {
    console.log('🚀 TelegramWebApp constructor called')
    
    // Check if we're in Telegram environment
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      console.log('📱 Telegram WebApp detected, initializing...')
      
      // Initialize Telegram WebApp
      WebApp.ready()
      WebApp.expand()
      
      console.log('✅ Telegram WebApp initialized')
      console.log('📋 WebApp info:', {
        platform: WebApp.platform,
        version: WebApp.version,
        initData: WebApp.initData,
        user: WebApp.initDataUnsafe.user
      })
    } else {
      console.warn('⚠️ Telegram WebApp not available')
      console.log('🔍 Available:', {
        window: typeof window !== 'undefined',
        Telegram: !!window.Telegram,
        WebApp: !!window.Telegram?.WebApp
      })
    }
  }

  public static getInstance(): TelegramWebApp {
    if (!TelegramWebApp.instance) {
      TelegramWebApp.instance = new TelegramWebApp()
    }
    return TelegramWebApp.instance
  }

  // Theme integration
  public getThemeParams() {
    return WebApp.themeParams
  }

  public applyTheme() {
    const theme = WebApp.themeParams
    document.documentElement.style.setProperty('--tg-color-bg', theme.bg_color || '#ffffff')
    document.documentElement.style.setProperty('--tg-color-text', theme.text_color || '#000000')
    document.documentElement.style.setProperty('--tg-color-hint', theme.hint_color || '#999999')
    document.documentElement.style.setProperty('--tg-color-link', theme.link_color || '#2481cc')
    document.documentElement.style.setProperty('--tg-color-button', theme.button_color || '#2481cc')
    document.documentElement.style.setProperty('--tg-color-button-text', theme.button_text_color || '#ffffff')
  }

  // Main button control
  public showMainButton(text: string, onClick: () => void) {
    WebApp.MainButton.text = text
    WebApp.MainButton.show()
    WebApp.MainButton.onClick(onClick)
  }

  public hideMainButton() {
    WebApp.MainButton.hide()
    WebApp.MainButton.offClick(() => {})
  }

  public setMainButtonLoading(loading: boolean) {
    if (loading) {
      WebApp.MainButton.showProgress()
    } else {
      WebApp.MainButton.hideProgress()
    }
  }

  // Back button control
  public showBackButton(onClick: () => void) {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(onClick)
  }

  public hideBackButton() {
    WebApp.BackButton.hide()
    WebApp.BackButton.offClick(() => {})
  }

  // Haptic feedback
  public impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') {
    WebApp.HapticFeedback.impactOccurred(style)
  }

  public notificationOccurred(type: 'error' | 'success' | 'warning') {
    WebApp.HapticFeedback.notificationOccurred(type)
  }

  public selectionChanged() {
    WebApp.HapticFeedback.selectionChanged()
  }

  // User data
  public getInitData() {
    return WebApp.initData
  }

  public getInitDataUnsafe() {
    return WebApp.initDataUnsafe
  }

  public getUserData() {
    console.log('🔍 === GET USER DATA CALLED ===')
    console.log('🔍 Location:', window.location.href)
    console.log('🔍 Hostname:', window.location.hostname)
    console.log('🔍 User Agent:', navigator.userAgent)
    
    // Detailed Telegram WebApp check
    console.log('📱 Telegram WebApp check:')
    console.log('  - window defined:', typeof window !== 'undefined')
    console.log('  - Telegram object:', !!window.Telegram)
    console.log('  - WebApp object:', !!window.Telegram?.WebApp)
    console.log('  - initData:', window.Telegram?.WebApp?.initData || 'EMPTY')
    console.log('  - initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe || 'EMPTY')
    console.log('  - initDataUnsafe.user:', window.Telegram?.WebApp?.initDataUnsafe?.user || 'NO USER')
    
    // Check if we're actually in Telegram WebApp environment
    const isTelegramWebApp = typeof window !== 'undefined' && 
                             window.Telegram?.WebApp &&
                             (window.Telegram.WebApp.initDataUnsafe?.user || // Real Telegram data
                              window.location.hostname.includes('ngrok'))     // Or ngrok testing
    
    console.log('🔍 Final environment decision:', {
      isTelegramWebApp,
      hasUser: !!window.Telegram?.WebApp?.initDataUnsafe?.user,
      hasNgrok: window.location.hostname.includes('ngrok')
    })
    
    if (isTelegramWebApp) {
      console.log('📱 Running in Telegram WebApp')
      console.log('🔍 WebApp.initData:', WebApp.initData)
      console.log('🔍 WebApp.initDataUnsafe:', WebApp.initDataUnsafe)
      console.log('🔍 WebApp.initDataUnsafe.user:', WebApp.initDataUnsafe.user)
      
      const user = WebApp.initDataUnsafe.user
      console.log('👤 Raw user from WebApp:', user)
      
      if (!user) {
        console.warn('⚠️ No user data in WebApp.initDataUnsafe.user')
        console.log('🔄 Falling back to test user due to missing Telegram user data')
        
        // Check URL parameters for manual testing
        const urlParams = new URLSearchParams(window.location.search)
        const testUserId = urlParams.get('telegram_id')
        
        if (testUserId) {
          console.log('🧪 Using manual test user ID from URL:', testUserId)
          const testUser = {
            id: parseInt(testUserId),
            first_name: 'Тестовый',
            last_name: 'Рабочий',
            username: 'traf4444',
            language_code: 'ru'
          }
          console.log('👤 Manual test user data:', testUser)
          return testUser
        }
        
        // Default test user for your Telegram ID
        const testUser = {
          id: 481890,
          first_name: 'Rss',
          last_name: '',
          username: 'traf4444',
          language_code: 'ru'
        }
        
        console.log('👤 Using fallback test user data:', testUser)
        return testUser
      }
      
      const userData = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        language_code: user.language_code,
        is_premium: user.is_premium
      }
      
      console.log('👤 Processed user data:', userData)
      return userData
    } else {
      console.log('🌐 Running in browser - checking for manual testing')
      
      // Check URL parameters for manual testing
      const urlParams = new URLSearchParams(window.location.search)
      const testUserId = urlParams.get('telegram_id')
      
      if (testUserId) {
        console.log('🧪 Using manual test user ID from URL:', testUserId)
        const testUser = {
          id: parseInt(testUserId),
          first_name: 'Тестовый',
          last_name: 'Рабочий',
          username: 'traf4444',
          language_code: 'ru'
        }
        console.log('👤 Manual test user data:', testUser)
        return testUser
      }
      
      // Default test user for your Telegram ID
      const testUser = {
        id: 481890,
        first_name: 'Rss',
        last_name: '',
        username: 'traf4444',
        language_code: 'ru'
      }
      
      console.log('👤 Using default test user data:', testUser)
      return testUser
    }
  }

  // Utilities
  public close() {
    WebApp.close()
  }

  public isVersionAtLeast(version: string): boolean {
    return WebApp.isVersionAtLeast(version)
  }

  public openLink(url: string, options?: { try_instant_view: boolean }) {
    WebApp.openLink(url, options)
  }

  public showAlert(message: string, callback?: () => void) {
    WebApp.showAlert(message, callback)
  }

  public showConfirm(message: string, callback?: (confirmed: boolean) => void) {
    WebApp.showConfirm(message, callback)
  }

  public showPopup(params: {
    title?: string
    message: string
    buttons?: Array<{
      id?: string
      type: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
      text: string
    }>
  }, callback?: (buttonId?: string) => void) {
    WebApp.showPopup(params, callback)
  }
}

// Export singleton instance
export const twa = TelegramWebApp.getInstance()