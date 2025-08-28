-- Fix infinite recursion in RLS policies
-- Remove conflicting policies and create simpler, non-recursive ones

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "anon_can_select_users_for_auth" ON users;
DROP POLICY IF EXISTS "authenticated_can_select_own" ON users;
DROP POLICY IF EXISTS "authenticated_can_update_own" ON users;
DROP POLICY IF EXISTS "managers_can_select_all" ON users;

-- Create non-recursive policies
-- Allow anon to read users for authentication (no recursion)
CREATE POLICY "anon_read_users" ON users FOR SELECT 
TO anon 
USING (true);

-- Allow authenticated users to read users (no recursion)
CREATE POLICY "authenticated_read_users" ON users FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to update their own profile
CREATE POLICY "authenticated_update_own" ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Also fix work_sessions RLS to prevent recursion
DROP POLICY IF EXISTS "workers_can_manage_own_sessions" ON work_sessions;
CREATE POLICY "authenticated_read_own_sessions" ON work_sessions FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "authenticated_manage_own_sessions" ON work_sessions FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- Fix tasks RLS to prevent recursion
DROP POLICY IF EXISTS "workers_can_read_assigned_tasks" ON tasks;
DROP POLICY IF EXISTS "workers_can_update_own_task_status" ON tasks;
DROP POLICY IF EXISTS "managers_can_update_all_tasks" ON tasks;

CREATE POLICY "authenticated_read_assigned_tasks" ON tasks FOR SELECT 
TO authenticated 
USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "authenticated_update_assigned_tasks" ON tasks FOR UPDATE 
TO authenticated 
USING (assigned_to = auth.uid());

CREATE POLICY "managers_update_all_tasks" ON tasks FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('manager', 'director', 'admin')
  )
);