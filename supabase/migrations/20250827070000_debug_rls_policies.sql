-- Temporary fix for debugging 406 errors in Mini App
-- Make RLS policies more permissive to identify the root cause

-- Temporarily allow authenticated users to read work_sessions for any user
-- This helps debug if the issue is with auth.uid() matching or session persistence
DROP POLICY IF EXISTS "authenticated_read_own_sessions" ON work_sessions;
CREATE POLICY "authenticated_read_work_sessions_debug" ON work_sessions FOR SELECT 
TO authenticated 
USING (true); -- Allow reading all work_sessions for debugging

-- Also make tasks more permissive for debugging
DROP POLICY IF EXISTS "authenticated_read_assigned_tasks" ON tasks;
CREATE POLICY "authenticated_read_tasks_debug" ON tasks FOR SELECT 
TO authenticated 
USING (true); -- Allow reading all tasks for debugging

-- Add some debugging info
COMMENT ON POLICY "authenticated_read_work_sessions_debug" ON work_sessions IS 'Temporary debug policy - remove after fixing 406 errors';
COMMENT ON POLICY "authenticated_read_tasks_debug" ON tasks IS 'Temporary debug policy - remove after fixing 406 errors';