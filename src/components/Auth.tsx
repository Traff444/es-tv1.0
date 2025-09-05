import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn, signUp, hasValidCredentials, signInWithTelegram, supabase } from '../lib/supabase';
import { isTelegramEnvironment, getTelegramUser, initTelegram } from '../lib/telegram';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';

const authSchema = z.object({
  email: z.string()
    .email('Некорректный email')
    .refine(
      (email) => !email.endsWith('@example.com') && !email.endsWith('@test.com'),
      'Используйте реальный email-адрес (не example.com или test.com)'
    ),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
  fullName: z.string().min(2, 'Имя должно содержать минимум 2 символа').optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

const ConfigWarning: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div className="max-w-md w-full">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Конфигурация не найдена</h1>
        <p className="text-gray-600 mb-4">
          Для работы системы необходимо настроить подключение к Supabase.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-left text-sm">
          <p className="font-medium mb-2">Необходимо:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>Создать проект в Supabase</li>
            <li>Скопировать URL и Anon Key</li>
            <li>Настроить переменные окружения</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
);

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [isTelegramEnv, setIsTelegramEnv] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  // Check Telegram environment on mount
  useEffect(() => {
    // Initialize Telegram if available
    initTelegram();
    
    const checkEnvironment = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const debug = params.get('debug') === '1';
        const forceWeb = params.get('force_web') === '1';
        // Защита: если мы явно НЕ в Telegram окружении, не пытаться ждать его
        if (debug) console.log('[Auth] init debug=true force_web=', forceWeb);
        
        // First check current session (used only for pure web flow)
        const { data: { session } } = await supabase.auth.getSession();
        if (debug) console.log('[Auth] existing session:', !!session?.user, session?.user?.id);
        
        const detectedTelegram = isTelegramEnvironment();
        const inTelegram = forceWeb ? false : detectedTelegram;
        if (debug) console.log('[Auth] detectedTelegram=', detectedTelegram, 'inTelegram(final)=', inTelegram);
        setIsTelegramEnv(inTelegram);
        
        if (inTelegram) {
          // В Telegram ВСЕГДА используем ID-only auth, НИКОГДА не показываем email форму
          console.log('[Auth] Telegram environment detected - ID-only auth');
          
          // Don't clear session if user is already authenticated
          if (session?.user) {
            console.log('[Auth] User already authenticated, skipping Telegram auth');
            setTelegramLoading(false);
            return;
          }
          
          const telegramUser = getTelegramUser();
          if (debug) console.log('[Auth] telegramUser present=', !!telegramUser);
          
          if (telegramUser) {
            console.log('[Auth] Starting Telegram authentication for ID:', telegramUser.id);
            const initData = window.Telegram?.WebApp?.initData || '';
            const result = await signInWithTelegram(telegramUser, initData);
            
            if (debug) console.log('[Auth] signInWithTelegram result:', {
              hasUser: !!result.data?.user,
              hasSession: !!result.data?.session,
              error: result.error?.message
            });
            
            if (result.error) {
              // В Telegram НЕ показываем форму логина при ошибке
              if (result.error.message === 'telegram_user_not_linked') {
                setError('Ваш Telegram аккаунт не связан с системой. Обратитесь к менеджеру для получения доступа.');
              } else {
                setError(`Ошибка входа: ${result.error.message}. Обратитесь к менеджеру.`);
              }
              // НЕ устанавливаем showEmailAuth = true в Telegram!
            } else if (result.data?.user) {
              // Successfully got user data, let useAuth handle the rest
              console.log('[Auth] Successfully got user data, letting useAuth handle session');
            }
          } else {
            setError('Не удалось получить данные Telegram пользователя. Попробуйте перезапустить Mini App.');
          }
          // НИКОГДА не показываем email форму в Telegram
          setShowEmailAuth(false);
        } else {
          // Веб окружение - показываем email форму
          console.log('[Auth] Web environment detected - email/password auth');
          setShowEmailAuth(true);
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        if (!isTelegramEnv) {
          // Только для веб показываем email форму при ошибке
          setShowEmailAuth(true);
        } else {
          setError('Ошибка инициализации. Попробуйте перезапустить Mini App.');
        }
      } finally {
        setTelegramLoading(false);
      }
    };
    
    // Small delay to ensure Telegram WebApp is fully loaded
    const timer = setTimeout(checkEnvironment, 500);
    
    // Hard fallback ТОЛЬКО для веб-версии
    const failover = setTimeout(() => {
      if (telegramLoading) {
        console.log('[Auth] failover timeout reached');
        if (!isTelegramEnv) {
          // Только в веб показываем email форму при таймауте
          console.log('[Auth] failover -> showEmailAuth (web only)');
          setShowEmailAuth(true);
        } else {
          // В Telegram показываем ошибку, но НЕ email форму
          console.log('[Auth] failover -> error in Telegram');
          setError('Превышено время ожидания. Попробуйте перезапустить Mini App.');
        }
        setTelegramLoading(false);
      }
    }, 8000);
    return () => { clearTimeout(timer); clearTimeout(failover); };
  }, []);

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await signUp(data.email, data.password, data.fullName || '');
        if (error) throw error;
      } else {
        const { error } = await signIn(data.email, data.password);
        if (error) throw error;
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      let errorMessage = 'Произошла ошибка';

      if (error.message?.includes('email_address_invalid')) {
        errorMessage = 'Недопустимый email-адрес. Используйте реальный email (например, Gmail, Yandex, Mail.ru)';
      } else if (error.message?.includes('email_not_confirmed')) {
        errorMessage = 'Email не подтвержден. Проверьте почту и перейдите по ссылке подтверждения';
      } else if (error.message?.includes('invalid_credentials')) {
        errorMessage = 'Неверный email или пароль';
      } else if (error.message?.includes('Database error')) {
        errorMessage = 'Ошибка базы данных. Обратитесь к администратору';
      } else {
        errorMessage = error.message || 'Произошла ошибка';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    reset();
  };

  // Telegram Loading Component
  const TelegramLoading: React.FC = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">ЭлектроСервис</h1>
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-600 mb-2">
            {isTelegramEnv ? 'Аутентификация через Telegram...' : 'Инициализация приложения...'}
          </p>
          <div className="text-sm text-gray-500">
            {isTelegramEnv ? (
              <>📱 Автоматический вход по Telegram ID</>
            ) : (
              <>🌐 Загрузка веб-интерфейса</>
            )}
          </div>
          
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
              {/* Кнопку email входа показываем только в веб-версии */}
              {!isTelegramEnv && (
                <button
                  onClick={() => setShowEmailAuth(true)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Войти по email и паролю
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const AuthForm: React.FC = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ЭлектроСервис</h1>
            <p className="text-gray-600 mt-2">
              {isSignUp ? 'Создание аккаунта' : 'Вход в систему'}
            </p>
            {isTelegramEnv && (
              <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1 inline-block">
                📱 Telegram версия
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Полное имя
                </label>
                <input
                  {...register('fullName')}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Введите ваше имя"
                />
                {errors.fullName && (
                  <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="example@company.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Введите пароль"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isSignUp ? 'Создать аккаунт' : 'Войти'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isSignUp
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Зарегистрироваться'}
            </button>

            {/* Reset login button */}
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                  } catch {}
                  try {
                    Object.keys(localStorage)
                      .filter(k => k.startsWith('sb-') && k.includes('-auth-token'))
                      .forEach(k => localStorage.removeItem(k));
                  } catch {}
                  window.location.reload();
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Сбросить вход (очистить сессию)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Return logic based on configuration and environment
  if (!hasValidCredentials) {
    return <ConfigWarning />;
  }

  // Show loading while checking Telegram environment
  if (telegramLoading) {
    return <TelegramLoading />;
  }

  // Show email auth form if explicitly requested or in web environment
  if (showEmailAuth || (!isTelegramEnv && !telegramLoading)) {
    return <AuthForm />;
  }

  // Still loading Telegram authentication
  return <TelegramLoading />;
};
