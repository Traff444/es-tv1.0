/*
  # Полная система управления сотрудниками и геолокация задач

  1. Обновления таблицы users
    - Добавляем поле is_active для мягкого удаления
    - Добавляем паспортные данные
    - Обновляем enum user_role с новой ролью inactive

  2. Обновления таблицы tasks
    - Добавляем поле target_location для адреса объекта

  3. Обновляем RLS политики
    - Учитываем активность пользователей
    - Защищаем чувствительные данные
*/

-- Обновляем enum user_role, добавляем inactive
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inactive';

-- Добавляем новые столбцы в таблицу users
DO $$
BEGIN
  -- Добавляем is_active если не существует
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Добавляем паспортные данные если не существуют
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_series'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_series TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_number'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_issue_date'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_issue_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passport_issued_by'
  ) THEN
    ALTER TABLE users ADD COLUMN passport_issued_by TEXT;
  END IF;
END $$;

-- Добавляем target_location в таблицу tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'target_location'
  ) THEN
    ALTER TABLE tasks ADD COLUMN target_location TEXT;
  END IF;
END $$;

-- Обновляем RLS политики для users
-- Политика для чтения профилей (учитываем активность)
DROP POLICY IF EXISTS "authenticated_users_can_read_profiles" ON users;
CREATE POLICY "authenticated_users_can_read_profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (role != 'inactive' AND is_active = true) OR 
    check_admin_role() OR check_manager_role()
  );

-- Политика для обновления пользователей администраторами
DROP POLICY IF EXISTS "admins_can_update_user_roles" ON users;
CREATE POLICY "admins_can_update_user_roles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (check_admin_role())
  WITH CHECK (check_admin_role());

-- Политика для директоров управлять пользователями (кроме админов)
DROP POLICY IF EXISTS "directors_can_manage_users" ON users;
CREATE POLICY "directors_can_manage_users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    role != 'admin' AND
    check_admin_role()
  )
  WITH CHECK (
    role != 'admin' AND
    check_admin_role()
  );

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS users_is_active_idx ON users(is_active);
CREATE INDEX IF NOT EXISTS users_passport_number_idx ON users(passport_number);
CREATE INDEX IF NOT EXISTS tasks_target_location_idx ON tasks(target_location);

-- Комментарии для документации
COMMENT ON COLUMN users.is_active IS 'Активность пользователя (для мягкого удаления)';
COMMENT ON COLUMN users.passport_series IS 'Серия паспорта';
COMMENT ON COLUMN users.passport_number IS 'Номер паспорта';
COMMENT ON COLUMN users.passport_issue_date IS 'Дата выдачи паспорта';
COMMENT ON COLUMN users.passport_issued_by IS 'Кем выдан паспорт';
COMMENT ON COLUMN tasks.target_location IS 'Адрес или координаты объекта задачи';