-- Fix RLS policies for users table to allow authentication flows
-- This is needed for Telegram Mini App authentication with anon key

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own_profile" ON users;
DROP POLICY IF EXISTS "managers_select_all" ON users;
DROP POLICY IF EXISTS "directors_update_roles" ON users;
DROP POLICY IF EXISTS "authenticated_users_can_select_own" ON users;
DROP POLICY IF EXISTS "anon_can_select_for_auth" ON users;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;
DROP POLICY IF EXISTS "managers_can_select_all_users" ON users;

-- Create permissive policies for authentication flows
-- Allow anon users to read user profiles for authentication
CREATE POLICY "anon_can_select_users_for_auth" ON users FOR SELECT 
TO anon 
USING (true);

-- Allow authenticated users to read their own profile
CREATE POLICY "authenticated_can_select_own" ON users FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "authenticated_can_update_own" ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Managers can select all users
CREATE POLICY "managers_can_select_all" ON users FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('manager', 'director', 'admin')
  )
);

-- Fix telegram_users RLS policies
DROP POLICY IF EXISTS "telegram_users_select" ON telegram_users;
DROP POLICY IF EXISTS "telegram_users_select_for_auth" ON telegram_users;

-- Allow anon and authenticated to read telegram_users for auth flows
CREATE POLICY "telegram_users_select_for_auth" ON telegram_users FOR SELECT 
TO anon, authenticated 
USING (true);

-- Allow authenticated users to update their own telegram settings
CREATE POLICY "telegram_users_update_own" ON telegram_users FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());