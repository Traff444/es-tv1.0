import { useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, hasValidCredentials } from '../lib/supabase';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('🚨 === useAuth HOOK VERSION 2.0 START ===');
  console.log('🚨 Timestamp:', new Date().toISOString());
  console.log('🔑 useAuth hook initialized, state:', { user: user?.id, profile: profile?.id, loading });

  useEffect(() => {
    if (!hasValidCredentials) {
      console.warn('Supabase credentials not configured');
      setLoading(false);
      return;
    }

    if (!supabase) {
      console.error('Supabase client not initialized');
      setLoading(false);
      return;
    }
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('🔍 initAuth: User found, calling fetchProfile for:', session.user.id);
            fetchProfile(session.user.id);
          } else {
            console.log('🔍 initAuth: No user found, setting profile to null');
            setProfile(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    const fetchProfile = async (userId: string) => {
      console.log('🔍 fetchProfile called with userId:', userId);
      try {
        console.log('🔍 Querying users table for ID:', userId);
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        console.log('🔍 Profile query result:', { data, error });
        
        if (error && error.code !== 'PGRST116') {
          console.error('Profile fetch error:', error);
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          console.log('✅ Setting profile:', data);
          setProfile(data);
          setLoading(false);
        }
      } catch (error) {
        console.error('Profile loading error:', error);
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
      }
    };

    // Инициализация
    initAuth();

    // Слушатель изменений аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 onAuthStateChange triggered:', event, session?.user?.id);
        if (mounted) {
          setUser(session?.user ?? null);
          if (session?.user) {
            console.log('🔍 onAuthStateChange: User found, calling fetchProfile for:', session.user.id);
            fetchProfile(session.user.id);
          } else {
            console.log('🔍 onAuthStateChange: No user found, setting profile to null');
            setProfile(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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