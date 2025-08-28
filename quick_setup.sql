-- Quick setup for testing the Mini App
-- This creates the minimal tables needed

-- Create user role enum
CREATE TYPE user_role AS ENUM ('worker', 'manager', 'director', 'admin');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'worker',
  hourly_rate numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy - allow all reads for authenticated users
CREATE POLICY "authenticated_read_users" ON users FOR SELECT 
TO authenticated 
USING (true);

-- Create telegram_users table
CREATE TABLE IF NOT EXISTS telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE NOT NULL,
  chat_id bigint NOT NULL,
  first_name text NOT NULL,
  last_name text,
  telegram_username text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy for telegram_users
CREATE POLICY "authenticated_read_telegram_users" ON telegram_users FOR SELECT 
TO authenticated 
USING (true);

-- Create tasks table
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'awaiting_approval');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  estimated_hours numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy for tasks
CREATE POLICY "authenticated_read_tasks" ON tasks FOR SELECT 
TO authenticated 
USING (true);

-- Create work_sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  start_location text,
  end_location text,
  total_hours numeric(5,2),
  earnings numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy for work_sessions
CREATE POLICY "authenticated_read_work_sessions" ON work_sessions FOR SELECT 
TO authenticated 
USING (true);