-- Check RLS policies for work_sessions and tasks tables
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('work_sessions', 'tasks') 
ORDER BY tablename, policyname;

-- Also check if RLS is enabled on these tables
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('work_sessions', 'tasks')
ORDER BY tablename;