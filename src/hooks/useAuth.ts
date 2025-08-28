import { useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, hasValidCredentials } from '../lib/supabase';
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

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (mounted) {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (mounted) {
          setProfile(null);
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
        const { data: { session } } = await supabase.auth.getSession();
        await handleAuthChange(session);
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