// Telegram WebApp integration for unified project
import logger from './logger';

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
    logger.debug('🚀 TelegramWebApp constructor called');

    if (this.isTelegramEnvironment()) {
      logger.debug('📱 Telegram WebApp detected, initializing...');
      try {
        window.Telegram!.WebApp.ready();
        window.Telegram!.WebApp.expand();
        logger.debug('✅ Telegram WebApp initialized successfully');
        logger.debug('📋 WebApp info:', {
          platform: window.Telegram!.WebApp.platform,
          version: window.Telegram!.WebApp.version,
          initData: window.Telegram!.WebApp.initData ? 'present' : 'empty',
          user: window.Telegram!.WebApp.initDataUnsafe?.user ? 'present' : 'empty'
        });
      } catch (error) {
        logger.error('❌ Telegram WebApp initialization failed:', error);
      }
    } else {
      logger.debug('🌐 Not in Telegram environment');
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
    const params = hasWindow ? new URLSearchParams(window.location.search) : null;
    const isDev = import.meta.env.DEV;
    const forceTelegram = isDev && params?.get('force_telegram') === '1';
    const hasTestUserParam = isDev && Boolean(params?.get('telegram_id'));
    const hash = hasWindow ? (window.location.hash || '') : '';
    const hasTgWebAppData = isDev && hasWindow && hash.includes('tgWebAppData=');

    logger.debug('🔍 Environment check:', {
      hasWindow,
      hasTelegram,
      hasNgrok,
      hasUser,
      forceTelegram,
      hasTestUserParam,
      hasTgWebAppData,
      hostname: hasWindow ? window.location.hostname : 'N/A'
    });
    
    // Считаем окружением Telegram, если доступен WebApp и есть пользователь
    // Тестовые флаги разрешены только в режиме разработки
    return hasTelegram && (hasUser || forceTelegram || hasTestUserParam || hasTgWebAppData);
  }

  public getTelegramUser() {
    logger.debug('🔍 Getting Telegram user...');

    const isDev = import.meta.env.DEV;
    // Разрешаем тестовый сценарий с параметром telegram_id только в режиме разработки
    const urlParams = new URLSearchParams(window.location.search);
    const testUserId = isDev ? urlParams.get('telegram_id') : null;
    if (testUserId) {
      logger.debug('🧪 Using test Telegram ID from URL:', testUserId);
      return {
        id: parseInt(testUserId),
        first_name: 'Тестовый',
        last_name: 'Пользователь',
        username: 'test_user',
        language_code: 'ru'
      };
    }

    if (!this.isTelegramEnvironment()) {
      logger.debug('🌐 Not in Telegram environment and no test user; returning null');
      return null;
    }

    // Основной источник — initDataUnsafe.user
    let user = window.Telegram!.WebApp.initDataUnsafe.user;
    if (user) {
      logger.debug('👤 Telegram user (initDataUnsafe):', user);
      return user;
    }

    // Фоллбек с tgWebAppData разрешен только в режиме разработки
    if (isDev) {
      try {
        const hash = window.location.hash || '';
        const m = hash.match(/tgWebAppData=([^&]+)/);
        if (m && m[1]) {
          const decoded = decodeURIComponent(m[1]);
          const kv = new URLSearchParams(decoded);
          const userStr = kv.get('user');
          if (userStr) {
            const parsed = JSON.parse(decodeURIComponent(userStr));
            logger.debug('👤 Telegram user (parsed from tgWebAppData hash):', parsed);
            return parsed;
          }
        }
      } catch (e) {
        logger.warn('⚠️ Failed to parse tgWebAppData from hash:', e);
      }
    }

    logger.info('⚠️ Telegram user not found');
    return null;
  }

  public showAlert(message: string) {
    if (this.isTelegramEnvironment()) {
      logger.info('📱 Telegram alert:', message);
      // In real Telegram environment, we could use native alerts
    } else {
      logger.info('🌐 Browser alert:', message);
      alert(message);
    }
  }

  public hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (this.isTelegramEnvironment()) {
      logger.info(`📳 Haptic feedback: ${type}`);
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
