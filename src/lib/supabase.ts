import { createClient } from '@supabase/supabase-js';

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
    console.log('✅ Пользователь создан в auth.users, создаем профиль...');
    
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
      console.log('❌ Ошибка создания профиля:', profileError.message);
      // Не возвращаем ошибку, так как пользователь уже создан в auth
    } else {
      console.log('✅ Профиль создан успешно в таблице users');
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
export const signInWithTelegram = async (telegramUser: any) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    console.log('🔍 Starting Telegram authentication for user:', telegramUser.id);
    console.log('👤 Telegram user data:', JSON.stringify(telegramUser, null, 2));
    
    // 1. Check if user exists in telegram_users table
    console.log('🔍 Step 1: Looking for existing telegram_users record...');
    const { data: telegramUserRecord, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*, users(*)')
      .eq('telegram_id', telegramUser.id)
      .single();

    console.log('📋 Telegram users query result:');
    console.log('  - Data:', JSON.stringify(telegramUserRecord, null, 2));
    console.log('  - Error:', telegramError);

    if (telegramUserRecord && telegramUserRecord.users) {
      // Existing user - try to sign in
      console.log('✅ Found existing user, attempting sign in...');
      
      const profile = telegramUserRecord.users as any;
      const password = `telegram_${telegramUser.id}`;
      
      console.log('🔑 Using email:', profile.email);
      console.log('🔑 Using password format:', password);
      
      // Try to sign in with existing credentials
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password
      });

      console.log('📋 Sign in attempt result:');
      console.log('  - Success:', !!authData.user);
      console.log('  - User ID:', authData.user?.id);
      console.log('  - Error:', signInError);

      if (signInError && signInError.message?.includes('Invalid login credentials')) {
        // User exists in DB but not in Auth - create auth user
        console.log('📝 Creating auth user for existing profile...');
        
        const { error: signUpError } = await supabase.auth.signUp({
          email: profile.email,
          password: password,
          options: {
            data: {
              telegram_id: telegramUser.id,
              full_name: profile.full_name
            }
          }
        });

        if (signUpError) {
          console.error('❌ Sign up error:', signUpError);
          throw signUpError;
        }

        console.log('✅ Auth user created, now signing in...');
        
        // Now try to sign in again
        return await supabase.auth.signInWithPassword({
          email: profile.email,
          password: password
        });
      }

      if (signInError) {
        console.error('❌ Sign in error:', signInError);
        throw signInError;
      }

      console.log('✅ Sign in successful!');
      
      // Check if user profile exists in users table
      const { data: userProfile, error: profileCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
      
      if (!userProfile && !profileCheckError) {
        console.log('⚠️ User profile missing in users table, creating...');
        
        const { error: createProfileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: profile.email,
            full_name: profile.full_name,
            role: 'worker',
            hourly_rate: 15.00,
            is_active: true
          });
        
        if (createProfileError) {
          console.error('❌ Failed to create missing profile:', createProfileError);
        } else {
          console.log('✅ Missing profile created');
        }
      }
      
      return { data: authData, error: null };
    } else {
      // New user – create auth user first to satisfy RLS, then profile links
      console.log('🆕 Creating new user via Telegram...');

      const email = `telegram_${telegramUser.id}@electroservice.by`;
      const password = `telegram_${telegramUser.id}`;
      const fullName = `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();

      console.log('🔧 New user details:', { email, fullName, telegram_id: telegramUser.id });

      // Step 1: Sign up auth user (id will be used for RLS-safe inserts)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { telegram_id: telegramUser.id, full_name: fullName }
        }
      });
      if (signUpErr && !String(signUpErr.message || '').toLowerCase().includes('already')) {
        console.error('❌ Auth signUp failed:', signUpErr);
        throw signUpErr;
      }

      // Step 2: Sign in to obtain session (required for RLS)
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authErr || !authData.user) {
        console.error('❌ Auth signIn failed:', authErr);
        throw authErr || new Error('Auth signIn failed');
      }

      const authUserId = authData.user.id;
      console.log('🆔 Authenticated as:', authUserId);

      // Step 3: Upsert profile in users with auth.uid() to pass RLS
      const { error: upsertProfileErr } = await supabase
        .from('users')
        .upsert({
          id: authUserId,
          email,
          full_name: fullName,
          role: 'worker',
          hourly_rate: 15.0,
          is_active: true,
        });
      if (upsertProfileErr) {
        console.error('❌ users upsert failed:', upsertProfileErr);
        throw upsertProfileErr;
      }

      // Step 4: Link telegram_users (upsert by telegram_id)
      const { error: upsertLinkErr } = await supabase
        .from('telegram_users')
        .upsert({
          user_id: authUserId,
          telegram_id: telegramUser.id,
          telegram_username: telegramUser.username || null,
          telegram_first_name: telegramUser.first_name,
          telegram_last_name: telegramUser.last_name || null,
        }, { onConflict: 'telegram_id' as any });
      if (upsertLinkErr) {
        console.error('❌ telegram_users upsert failed:', upsertLinkErr);
        throw upsertLinkErr;
      }

      console.log('✅ Telegram user created and linked successfully');
      return { data: authData, error: null };
    }
  } catch (error) {
    console.error('❌ Telegram authentication error:', error);
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
    console.log('Обновление роли пользователя:', userId, 'на роль:', newRole);
    
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
      console.error('Ошибка при обновлении роли:', error);
      
      // Специальная обработка ошибок RLS
      if (error.code === '42501' || error.message.includes('permission denied')) {
        throw new Error('Недостаточно прав для изменения роли пользователя');
      }
      
      throw new Error(`Ошибка обновления роли: ${error.message}`);
    }

    console.log('Роль успешно обновлена');
    
    return { data: null, error: null };
  } catch (error) {
    console.error('Общая ошибка обновления роли:', error);
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