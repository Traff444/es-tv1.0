// Telegram WebApp integration for unified project
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
        };
        platform: string;
        version: string;
        colorScheme: 'light' | 'dark';
      };
    };
  }
}

export class TelegramWebApp {
  private static instance: TelegramWebApp;

  private constructor() {
    console.log('🚀 TelegramWebApp constructor called');
    
    if (this.isTelegramEnvironment()) {
      console.log('📱 Telegram WebApp detected, initializing...');
      try {
        window.Telegram!.WebApp.ready();
        window.Telegram!.WebApp.expand();
        console.log('✅ Telegram WebApp initialized successfully');
        console.log('📋 WebApp info:', {
          platform: window.Telegram!.WebApp.platform,
          version: window.Telegram!.WebApp.version,
          initData: window.Telegram!.WebApp.initData ? 'present' : 'empty',
          user: window.Telegram!.WebApp.initDataUnsafe?.user ? 'present' : 'empty'
        });
      } catch (error) {
        console.error('❌ Telegram WebApp initialization failed:', error);
      }
    } else {
      console.log('🌐 Not in Telegram environment');
    }
  }

  public static getInstance(): TelegramWebApp {
    if (!TelegramWebApp.instance) {
      TelegramWebApp.instance = new TelegramWebApp();
    }
    return TelegramWebApp.instance;
  }

  public isTelegramEnvironment(): boolean {
    const hasWindow = typeof window !== 'undefined';
    const hasTelegram = hasWindow && !!window.Telegram?.WebApp;
    const hasNgrok = hasWindow && window.location.hostname.includes('ngrok');
    const hasUser = hasWindow && !!window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    console.log('🔍 Environment check:', {
      hasWindow,
      hasTelegram,
      hasNgrok,
      hasUser,
      hostname: hasWindow ? window.location.hostname : 'N/A'
    });
    
    return hasTelegram && (hasUser || hasNgrok);
  }

  public getTelegramUser() {
    console.log('🔍 Getting Telegram user...');
    
    if (!this.isTelegramEnvironment()) {
      console.log('🌐 Not in Telegram environment, checking for test mode...');
      
      // Check URL parameters for testing
      const urlParams = new URLSearchParams(window.location.search);
      const testUserId = urlParams.get('telegram_id');
      
      if (testUserId) {
        console.log('🧪 Using test Telegram ID from URL:', testUserId);
        return {
          id: parseInt(testUserId),
          first_name: 'Тестовый',
          last_name: 'Пользователь',
          username: 'test_user',
          language_code: 'ru'
        };
      }
      
      console.log('❌ No Telegram user data available');
      return null;
    }

    const user = window.Telegram!.WebApp.initDataUnsafe.user;
    console.log('👤 Telegram user data:', user);
    
    return user || null;
  }

  public showAlert(message: string) {
    if (this.isTelegramEnvironment()) {
      console.log('📱 Telegram alert:', message);
      // In real Telegram environment, we could use native alerts
    } else {
      console.log('🌐 Browser alert:', message);
      alert(message);
    }
  }

  public hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (this.isTelegramEnvironment()) {
      console.log(`📳 Haptic feedback: ${type}`);
      // In real implementation, would use Telegram's haptic API
    }
  }
}

// Export convenience functions
export const isTelegramEnvironment = (): boolean => {
  return TelegramWebApp.getInstance().isTelegramEnvironment();
};

export const getTelegramUser = () => {
  return TelegramWebApp.getInstance().getTelegramUser();
};

export const initTelegram = () => {
  return TelegramWebApp.getInstance();
};

// Export singleton instance
export const twa = TelegramWebApp.getInstance();
