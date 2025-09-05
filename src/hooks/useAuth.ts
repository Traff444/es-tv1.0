import { useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { User } from '../types';
import logger from '../lib/logger';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasValidCredentials) {
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const startTs = Date.now();

    // One-time storage versioning to avoid stale sb-* tokens after deploys
    try {
      const CURRENT_VERSION = '2025-08-29-auth-v2';
      const storedVersion = localStorage.getItem('APP_VERSION');
      if (storedVersion !== CURRENT_VERSION) {
        // Clear stale Supabase auth tokens
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.includes('-auth-token'))
          .forEach((k) => localStorage.removeItem(k));
        localStorage.setItem('APP_VERSION', CURRENT_VERSION);
      }
    } catch {}
    const fallbackTimer = setTimeout(() => {
      if (mounted && loading) {
        logger.warn('[useAuth] Fallback timeout: forcing loading=false');
        setLoading(false);
      }
    }, 8000);

    const fetchProfile = async (userId: string) => {
      try {
        logger.info('[useAuth] fetchProfile start', { userId });
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (mounted) {
          logger.info('[useAuth] fetchProfile done', { hasData: !!data, ms: Date.now() - startTs });
          setProfile(data);
          // Auto sign-out if profile missing (inactive or inconsistent state)
          if (!data) {
            try {
              await supabase.auth.signOut();
            } catch {}
          }
        }
      } catch (error) {
        logger.error('Error fetching profile:', error);
        if (mounted) {
          setProfile(null);
          // On profile error, also sign out to reset broken session
          try {
            await supabase.auth.signOut();
          } catch {}
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const handleAuthChange = async (session: any) => {
      if (mounted) {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    };

    const initAuth = async () => {
      try {
        logger.info('[useAuth] initAuth.getSession');
        const { data: { session } } = await supabase.auth.getSession();
        logger.info('[useAuth] initAuth.session', { hasUser: !!session?.user });
        
        // Check if we're in Telegram environment and have a Telegram user
        const params = new URLSearchParams(window.location.search);
        const isDev = process.env.NODE_ENV !== 'production';
        const forceWeb = isDev && params.get('force_web') === '1';
        const detectedTelegram = typeof window !== 'undefined' && 
          !!window.Telegram?.WebApp && 
          !!window.Telegram?.WebApp?.initDataUnsafe?.user;
        const inTelegram = forceWeb ? false : detectedTelegram;
        
        if (inTelegram && !session?.user) {
          // In Telegram environment, try to get Telegram user
          const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          if (telegramUser) {
            logger.info('[useAuth] Telegram environment detected, attempting ID-only auth');
            // For Telegram users, we don't need Supabase session, just fetch profile
            const { data: telegramUserRecord, error: telegramError } = await supabase
              .from('telegram_users')
              .select('users(*)')
              .eq('telegram_id', telegramUser.id)
              .single();
              
            if (telegramUserRecord?.users && !telegramError) {
              logger.info('[useAuth] Telegram user found, setting user and profile');
              const profileData = telegramUserRecord.users as any;
              setUser({
                id: profileData.id,
                email: profileData.email,
                user_metadata: {
                  full_name: profileData.full_name,
                },
                app_metadata: {
                  role: profileData.role,
                },
                aud: 'authenticated',
                created_at: profileData.created_at,
                updated_at: profileData.updated_at,
              } as AuthUser);
              setProfile(profileData);
              setLoading(false);
              return;
            }
          }
        }
        
        // Доп. попытка рефреша, если сессии нет, но есть persisted token
        if (!session?.user) {
          try {
            await supabase.auth.refreshSession();
            const { data: { session: session2 } } = await supabase.auth.getSession();
            await handleAuthChange(session2);
          } catch {
            await handleAuthChange(session);
          }
        } else {
          await handleAuthChange(session);
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await handleAuthChange(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  return {
    user,
    profile,
    loading,
    isWorker: profile?.role === 'worker',
    isManager: profile?.role === 'manager',
    isDirector: profile?.role === 'director',
    isAdmin: profile?.role === 'admin',
  };
};