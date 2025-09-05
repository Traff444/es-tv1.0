import { useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, hasValidCredentials, signInWithTelegram } from '../lib/supabase';
import { User } from '../types';

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
        console.warn('[useAuth] Fallback timeout: forcing loading=false');
        setLoading(false);
      }
    }, 8000);

    const fetchProfile = async (userId: string) => {
      try {
        console.log('[useAuth] fetchProfile start', { userId });
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (mounted) {
          console.log('[useAuth] fetchProfile done', { hasData: !!data, ms: Date.now() - startTs });
          setProfile(data);
          // Auto sign-out if profile missing (inactive or inconsistent state)
          if (!data) {
            try {
              await supabase.auth.signOut();
            } catch {}
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
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
        console.log('[useAuth] initAuth.getSession');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[useAuth] initAuth.session', { hasUser: !!session?.user });
        
        // Check if we're in Telegram environment and have a Telegram user
        const params = new URLSearchParams(window.location.search);
        const forceWeb = params.get('force_web') === '1';
        const detectedTelegram = typeof window !== 'undefined' && 
          !!window.Telegram?.WebApp && 
          !!window.Telegram?.WebApp?.initDataUnsafe?.user;
        const inTelegram = forceWeb ? false : detectedTelegram;
        
        if (inTelegram && !session?.user) {
          const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          const initData = window.Telegram?.WebApp?.initData || '';
          if (telegramUser && initData) {
            console.log('[useAuth] Telegram environment detected, creating session');
            const { data: tgSession, error: tgError } = await signInWithTelegram(initData, telegramUser.id);
            if (!tgError && tgSession?.session) {
              await handleAuthChange(tgSession.session);
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
        console.error('Error initializing auth:', error);
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