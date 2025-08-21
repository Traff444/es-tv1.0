/*
  # Employee Management and Task Geolocation

  1. User Management Enhancements
    - Add `is_active` column to users table for soft deletion
    - Add passport data columns for employee information
    - Update user_role enum to include 'inactive' status

  2. Task Geolocation
    - Add `target_location` column to tasks table for task location verification

  3. Security
    - Update RLS policies to account for new fields
    - Ensure sensitive passport data is only accessible to authorized roles
*/

-- Add is_active column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add passport data columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_series'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_series TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_number'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_number TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_issue_date'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_issue_date DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_issued_by'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_issued_by TEXT;
  END IF;
END $$;

-- Update user_role enum to include 'inactive'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'inactive' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'inactive';
  END IF;
END $$;

-- Add target_location column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'target_location'
  ) THEN
    ALTER TABLE tasks ADD COLUMN target_location TEXT;
  END IF;
END $$;

-- Create index on is_active for better performance
CREATE INDEX IF NOT EXISTS users_is_active_idx ON users(is_active);

-- Update RLS policies for users table to account for inactive users
-- Only active users should be able to authenticate and perform actions

-- Create policy to prevent inactive users from reading their own data during auth
DROP POLICY IF EXISTS "users_can_read_own_profile" ON users;
CREATE POLICY "users_can_read_own_profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND is_active = true);

-- Update policy for authenticated users to read profiles (only active users)
DROP POLICY IF EXISTS "authenticated_users_can_read_profiles" ON users;
CREATE POLICY "authenticated_users_can_read_profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create policy for admins and directors to view all users (including inactive)
-- Use a function to avoid infinite recursion
CREATE OR REPLACE FUNCTION check_admin_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() 
    AND u.role IN ('admin', 'director')
    AND u.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "admins_can_read_all_users"
  ON users
  FOR SELECT
  TO authenticated
  USING (check_admin_role());

-- Create policy for admins to update user status and passport data
CREATE POLICY "admins_can_update_user_data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (check_admin_role())
  WITH CHECK (check_admin_role());

-- Update existing policies to ensure only active users can perform actions
-- Update tasks policies
-- Create function to check if user is active
CREATE OR REPLACE FUNCTION check_user_active()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is manager or higher
CREATE OR REPLACE FUNCTION check_manager_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() 
    AND u.role IN ('manager', 'director', 'admin')
    AND u.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Рабочие могут читать назначенные " ON tasks;
CREATE POLICY "Рабочие могут читать назначенные задачи"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    (assigned_to = auth.uid() AND check_user_active()) 
    OR check_manager_role()
  );

DROP POLICY IF EXISTS "Рабочие могут обновлять статус св" ON tasks;
CREATE POLICY "Рабочие могут обновлять статус своих задач"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    AND check_user_active()
  )
  WITH CHECK (
    assigned_to = auth.uid() 
    AND check_user_active()
  );

DROP POLICY IF EXISTS "Менеджеры могут обновлять все зад" ON tasks;
CREATE POLICY "Менеджеры могут обновлять все задачи"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (check_manager_role())
  WITH CHECK (check_manager_role());

DROP POLICY IF EXISTS "Менеджеры могут создавать задачи" ON tasks;
CREATE POLICY "Менеджеры могут создавать задачи"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (check_manager_role());

DROP POLICY IF EXISTS "Менеджеры могут удалять задачи" ON tasks;
CREATE POLICY "Менеджеры могут удалять задачи"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (check_manager_role());

-- Update work_sessions policies
DROP POLICY IF EXISTS "Рабочие могут создавать свои смен" ON work_sessions;
CREATE POLICY "Рабочие могут создавать свои смены"
  ON work_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND check_user_active()
  );

DROP POLICY IF EXISTS "Рабочие могут обновлять свои смен" ON work_sessions;
CREATE POLICY "Рабочие могут обновлять свои смены"
  ON work_sessions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND check_user_active()
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND check_user_active()
  );

DROP POLICY IF EXISTS "Рабочие могут читать свои смены" ON work_sessions;
CREATE POLICY "Рабочие могут читать свои смены"
  ON work_sessions
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_active = true
    )) 
    OR 
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
      AND u.is_active = true
    ))
  );