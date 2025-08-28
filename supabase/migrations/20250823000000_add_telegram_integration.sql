/*
  # Telegram Integration System
  
  1. New Tables
    - `telegram_users` - Связь пользователей системы с Telegram аккаунтами
    - `task_notifications` - Отслеживание отправленных уведомлений и ответов
    
  2. Security
    - RLS policies для контроля доступа к Telegram данным
    - Функции для безопасной отправки уведомлений
*/

-- Таблица для связи пользователей с Telegram
CREATE TABLE telegram_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE NOT NULL,
  telegram_username text,
  chat_id bigint NOT NULL,
  first_name text,
  last_name text,
  is_active boolean DEFAULT true,
  notifications_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Таблица для отслеживания уведомлений о задачах
CREATE TABLE task_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES users(id) ON DELETE CASCADE,
  telegram_message_id bigint,
  notification_type text NOT NULL DEFAULT 'task_completion', -- 'task_completion', 'task_approved', 'task_rejected', 'photos_requested'
  status text DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'responded'
  manager_response text, -- 'approved', 'rejected', 'request_photos'
  response_comment text,
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('task_completion', 'task_approved', 'task_rejected', 'photos_requested')),
  CONSTRAINT valid_status CHECK (status IN ('sent', 'delivered', 'read', 'responded')),
  CONSTRAINT valid_manager_response CHECK (manager_response IN ('approved', 'rejected', 'request_photos'))
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_telegram_users_user_id ON telegram_users(user_id);
CREATE INDEX idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX idx_task_notifications_manager_id ON task_notifications(manager_id);
CREATE INDEX idx_task_notifications_worker_id ON task_notifications(worker_id);
CREATE INDEX idx_task_notifications_created_at ON task_notifications(created_at);

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_telegram_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER telegram_users_updated_at
  BEFORE UPDATE ON telegram_users
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_users_updated_at();

-- RLS Policies

-- Включаем RLS для обеих таблиц
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- Политики для telegram_users
-- Пользователи могут видеть только свои Telegram связи
CREATE POLICY "users_can_read_own_telegram_data"
  ON telegram_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Пользователи могут обновлять только свои Telegram связи  
CREATE POLICY "users_can_update_own_telegram_data"
  ON telegram_users
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Пользователи могут создавать свои Telegram связи
CREATE POLICY "users_can_insert_own_telegram_data"
  ON telegram_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Пользователи могут удалять свои Telegram связи
CREATE POLICY "users_can_delete_own_telegram_data"
  ON telegram_users
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Админы и менеджеры могут видеть все Telegram связи
CREATE POLICY "managers_can_read_all_telegram_data"
  ON telegram_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager', 'director')
      AND is_active = true
    )
  );

-- Политики для task_notifications
-- Менеджеры могут видеть уведомления, адресованные им
CREATE POLICY "managers_can_read_their_notifications"
  ON task_notifications
  FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
      AND is_active = true
    )
  );

-- Рабочие могут видеть уведомления о своих задачах
CREATE POLICY "workers_can_read_their_task_notifications"
  ON task_notifications
  FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid());

-- Система может создавать уведомления (для Edge Functions)
CREATE POLICY "system_can_insert_notifications"
  ON task_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Система может обновлять статус уведомлений
CREATE POLICY "system_can_update_notifications"
  ON task_notifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Функция для получения Telegram данных менеджера для задачи
CREATE OR REPLACE FUNCTION get_manager_telegram_data(task_uuid uuid)
RETURNS TABLE (
  manager_id uuid,
  telegram_id bigint,
  chat_id bigint,
  first_name text,
  notifications_enabled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as manager_id,
    tu.telegram_id,
    tu.chat_id,
    tu.first_name,
    tu.notifications_enabled
  FROM tasks t
  JOIN users u ON (
    -- Возвращаем создателя задачи, если он менеджер/директор с Telegram
    u.id = t.created_by
    AND u.role IN ('manager', 'director') 
    AND u.is_active = true
  )
  JOIN telegram_users tu ON (u.id = tu.user_id AND tu.is_active = true)
  WHERE t.id = task_uuid
  
  UNION
  
  -- Если создатель не менеджер или без Telegram, возвращаем любого менеджера с Telegram
  SELECT 
    u.id as manager_id,
    tu.telegram_id,
    tu.chat_id,
    tu.first_name,
    tu.notifications_enabled
  FROM users u
  JOIN telegram_users tu ON (u.id = tu.user_id AND tu.is_active = true)
  WHERE u.role IN ('manager', 'director') 
  AND u.is_active = true
  AND NOT EXISTS (
    -- Проверяем, что создатель задачи не менеджер с Telegram
    SELECT 1 FROM tasks t2
    JOIN users u2 ON (u2.id = t2.created_by AND u2.role IN ('manager', 'director') AND u2.is_active = true)
    JOIN telegram_users tu2 ON (u2.id = tu2.user_id AND tu2.is_active = true)
    WHERE t2.id = task_uuid
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для получения данных рабочего с Telegram
CREATE OR REPLACE FUNCTION get_worker_telegram_data(worker_uuid uuid)
RETURNS TABLE (
  worker_id uuid,
  telegram_id bigint,
  chat_id bigint,
  first_name text,
  full_name text,
  notifications_enabled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    tu.telegram_id,
    tu.chat_id,
    tu.first_name,
    u.full_name,
    tu.notifications_enabled
  FROM users u
  JOIN telegram_users tu ON (u.id = tu.user_id AND tu.is_active = true)
  WHERE u.id = worker_uuid
  AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для записи отправленного уведомления
CREATE OR REPLACE FUNCTION log_task_notification(
  p_task_id uuid,
  p_manager_id uuid,
  p_worker_id uuid,
  p_telegram_message_id bigint,
  p_notification_type text DEFAULT 'task_completion'
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO task_notifications (
    task_id,
    manager_id,
    worker_id,
    telegram_message_id,
    notification_type,
    status
  ) VALUES (
    p_task_id,
    p_manager_id,
    p_worker_id,
    p_telegram_message_id,
    p_notification_type,
    'sent'
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для обновления ответа менеджера
CREATE OR REPLACE FUNCTION update_notification_response(
  p_notification_id uuid,
  p_manager_response text,
  p_response_comment text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE task_notifications 
  SET 
    manager_response = p_manager_response,
    response_comment = p_response_comment,
    status = 'responded',
    responded_at = now()
  WHERE id = p_notification_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем тестовые данные для разработки (только если таблица пустая)
DO $$
BEGIN
  -- Проверяем, есть ли уже данные в telegram_users
  IF NOT EXISTS (SELECT 1 FROM telegram_users LIMIT 1) THEN
    -- Добавляем тестовые Telegram связи для существующих пользователей
    -- Эти данные нужно будет заменить на реальные при настройке
    
    -- Для менеджера (если существует пользователь с ролью manager)
    INSERT INTO telegram_users (user_id, telegram_id, chat_id, first_name, telegram_username)
    SELECT 
      id,
      123456789, -- Замените на реальный Telegram ID менеджера
      123456789, -- Замените на реальный Chat ID менеджера  
      'TestManager',
      'test_manager'
    FROM users 
    WHERE role = 'manager' 
    AND email = 'manager@test.com'
    LIMIT 1;
    
    -- Для рабочего (если существует пользователь с ролью worker)  
    INSERT INTO telegram_users (user_id, telegram_id, chat_id, first_name, telegram_username)
    SELECT 
      id,
      987654321, -- Замените на реальный Telegram ID рабочего
      987654321, -- Замените на реальный Chat ID рабочего
      'TestWorker', 
      'test_worker'
    FROM users 
    WHERE role = 'worker'
    AND email = 'worker@test.com' 
    LIMIT 1;
  END IF;
END $$;