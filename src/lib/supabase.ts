import { createClient } from '@supabase/supabase-js';
import logger from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we have valid Supabase credentials
const hasValidCredentials = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseUrl.includes('supabase.co') || supabaseUrl.includes('127.0.0.1'))
);

export const supabase = hasValidCredentials 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export { hasValidCredentials };
// Auth helpers
export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });
  
  // Если регистрация успешна, создаем профиль в таблице users
  if (data.user && !error) {
    logger.info('✅ Пользователь создан в auth.users, создаем профиль...');
    
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: email,
        full_name: fullName.trim(),
        role: 'worker', // роль по умолчанию
        is_active: true,
        hourly_rate: 2.0
      })
      .select()
      .single();
      
    if (profileError) {
      logger.warn('❌ Ошибка создания профиля:', profileError.message);
      // Не возвращаем ошибку, так как пользователь уже создан в auth
    } else {
      logger.info('✅ Профиль создан успешно в таблице users');
    }
  }
  
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  // Check if user is active after successful authentication
  if (data.user && !error) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    
    if (profileError || profile?.role === 'inactive') {
      // Sign out the user if they are inactive
      await supabase.auth.signOut();
      return { 
        data: null, 
        error: { message: 'Аккаунт неактивен. Обратитесь к администратору.' } 
      };
    }
  }
  
  return { data, error };
};

export const signOut = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  // If no session exists, treat as successful logout
  if (!session) {
    return { error: null };
  }
  
  // Check if session is already expired locally
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  if (session.expires_at && session.expires_at < currentTime) {
    // Session is already expired, no need to call logout
    return { error: null };
  }
  
  const { error } = await supabase.auth.signOut();
  
  // If session doesn't exist, treat as successful logout
  if (error && error.message?.includes('session_not_found')) {
    return { error: null };
  }
  
  return { error };
};

// Telegram authentication
export const signInWithTelegram = async (telegramUser: any, initData: string) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    logger.info('🔍 Starting Telegram authentication for user:', telegramUser.id);
    logger.debug('👤 Telegram user data:', JSON.stringify(telegramUser, null, 2));

    // 0. Verify initData hash on the server
    logger.debug('🔍 Step 0: Verifying initData hash...');
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
      'verify-telegram-init-data',
      { body: { initData } }
    );
    if (verifyError || !verifyData?.ok) {
      logger.warn('⚠️ initData verification failed', verifyError, verifyData);
      return { data: null, error: new Error('invalid_init_data') } as any;
    }

    // 1. Check if user exists in telegram_users table
    logger.debug('🔍 Step 1: Looking for existing telegram_users record...');
    const { data: telegramUserRecord, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*, users(*)')
      .eq('telegram_id', telegramUser.id)
      .single();

    logger.debug('📋 Telegram users query result:');
    logger.debug('  - Data:', JSON.stringify(telegramUserRecord, null, 2));
    logger.debug('  - Error:', telegramError);

    if (telegramUserRecord && telegramUserRecord.users) {
      // For Telegram users, we don't need to authenticate with Supabase password
      // We just need to return the user data since we've verified the Telegram ID
      logger.info('✅ Found existing user, returning user data for ID-only auth');
      const profile = telegramUserRecord.users as any;
      
      // Create a mock user object that looks like a Supabase user
      const mockUser = {
        id: profile.id,
        email: profile.email,
        user_metadata: {
          full_name: profile.full_name,
        },
        app_metadata: {
          role: profile.role,
        },
        aud: 'authenticated',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
      
      return { 
        data: { 
          user: mockUser, 
          session: null 
        }, 
        error: null 
      };
    } else {
      logger.warn('⚠️ Telegram user not linked in telegram_users');
      return { data: null, error: new Error('telegram_user_not_linked') } as any;
    }
  } catch (error) {
    logger.error('❌ Telegram authentication error:', error);
    return { data: null, error };
  }
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check if user is still active
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profileError || profile?.role === 'inactive') {
      // Sign out the user if they are inactive
      await supabase.auth.signOut();
      return null;
    }
  }
  
  return user;
};

// Location helpers
export const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
};

export const formatLocation = (position: GeolocationPosition): string => {
  return `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
};

// Admin helpers
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  return { data, error };
};

export const updateUserRole = async (userId: string, newRole: string) => {
  try {
    logger.info('Обновление роли пользователя:', userId, 'на роль:', newRole);
    
    // Get current user to verify admin rights
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('Пользователь не аутентифицирован');
    }

    // Update the role
    const { error } = await supabase
      .from('users')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      logger.error('Ошибка при обновлении роли:', error);
      
      // Специальная обработка ошибок RLS
      if (error.code === '42501' || error.message.includes('permission denied')) {
        throw new Error('Недостаточно прав для изменения роли пользователя');
      }
      
      throw new Error(`Ошибка обновления роли: ${error.message}`);
    }

    logger.info('Роль успешно обновлена');
    
    return { data: null, error: null };
  } catch (error) {
    logger.error('Общая ошибка обновления роли:', error);
    return { data: null, error };
  }
};

export const getRoleChangeLogs = async () => {
  const { data, error } = await supabase
    .from('role_change_logs')
    .select(`
      *,
      user:user_id(id, full_name, email),
      admin:changed_by(id, full_name, email)
    `)
    .order('changed_at', { ascending: false })
    .limit(50);
  
  return { data, error };
};

// Geolocation helper function to calculate distance between two points
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
};

// Parse coordinates from string format "lat, lon"
export const parseCoordinates = (coordString: string): { lat: number; lon: number } | null => {
  if (!coordString) return null;
  
  const coords = coordString.split(',').map(coord => parseFloat(coord.trim()));
  if (coords.length !== 2 || coords.some(coord => isNaN(coord))) {
    return null;
  }
  
  return { lat: coords[0], lon: coords[1] };
};