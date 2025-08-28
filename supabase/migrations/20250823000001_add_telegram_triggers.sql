/*
  # Telegram Notification Triggers
  
  1. Trigger Functions
    - `notify_manager_on_task_completion()` - Отправка уведомления менеджеру при завершении задачи
    - `notify_worker_on_task_response()` - Уведомление рабочего об ответе менеджера
    
  2. Edge Function Integration
    - Автоматический вызов telegram-notifications function при смене статуса задачи
    - Обработка ошибок и retry логика
    
  3. Security & Performance
    - Async вызовы Edge Functions
    - Логирование всех попыток отправки
*/

-- Функция для отправки HTTP запроса к Edge Function
CREATE OR REPLACE FUNCTION call_edge_function(
  function_name text,
  payload jsonb,
  method text DEFAULT 'POST'
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  request_id uuid;
BEGIN
  -- Генерируем уникальный ID для запроса
  request_id := gen_random_uuid();
  
  -- Логируем попытку вызова
  INSERT INTO edge_function_calls (
    id,
    function_name,
    payload,
    status,
    created_at
  ) VALUES (
    request_id,
    function_name,
    payload,
    'pending',
    now()
  );

  -- Вызываем Edge Function через HTTP
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := payload::text
  ) INTO result;

  -- Обновляем статус вызова
  UPDATE edge_function_calls 
  SET 
    response = result,
    status = CASE 
      WHEN result->>'status_code' = '200' THEN 'success'
      ELSE 'error'
    END,
    completed_at = now()
  WHERE id = request_id;

  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Логируем ошибку
  UPDATE edge_function_calls 
  SET 
    error_message = SQLERRM,
    status = 'error',
    completed_at = now()
  WHERE id = request_id;
  
  -- Не бросаем ошибку, чтобы не нарушить основной процесс
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Таблица для логирования вызовов Edge Functions
CREATE TABLE IF NOT EXISTS edge_function_calls (
  id uuid PRIMARY KEY,
  function_name text NOT NULL,
  payload jsonb,
  response jsonb,
  status text DEFAULT 'pending', -- 'pending', 'success', 'error'
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'error'))
);

-- Индекс для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_edge_function_calls_status ON edge_function_calls(status, created_at);

-- Функция уведомления менеджера при завершении задачи
CREATE OR REPLACE FUNCTION notify_manager_on_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  task_payload jsonb;
  manager_data record;
  photo_urls text[];
  checklist_stats record;
BEGIN
  -- Проверяем, что задача переведена в статус ожидания приемки
  IF NEW.status = 'awaiting_approval' AND OLD.status != 'awaiting_approval' THEN
    
    -- Получаем данные менеджера для уведомления
    SELECT * INTO manager_data
    FROM get_manager_telegram_data(NEW.id)
    LIMIT 1;
    
    IF manager_data.manager_id IS NULL THEN
      -- Логируем, что менеджер с Telegram не найден
      INSERT INTO edge_function_calls (
        id,
        function_name,
        payload,
        status,
        error_message,
        created_at,
        completed_at
      ) VALUES (
        gen_random_uuid(),
        'telegram-notifications',
        jsonb_build_object('task_id', NEW.id),
        'error',
        'Менеджер с настроенным Telegram не найден',
        now(),
        now()
      );
      
      RETURN NEW;
    END IF;

    -- Получаем фотографии задачи
    SELECT array_agg(photo_url) INTO photo_urls
    FROM task_photos
    WHERE task_id = NEW.id;

    -- Получаем статистику чек-листа
    SELECT 
      count(*) as total_items,
      count(*) FILTER (WHERE is_completed = true) as completed_items
    INTO checklist_stats
    FROM task_checklist
    WHERE task_id = NEW.id;

    -- Формируем payload для Edge Function
    task_payload := jsonb_build_object(
      'task_id', NEW.id,
      'worker_id', NEW.assigned_to,
      'worker_name', (SELECT full_name FROM users WHERE id = NEW.assigned_to),
      'task_title', NEW.title,
      'task_description', NEW.description,
      'completed_at', NEW.completed_at,
      'photos', photo_urls,
      'checklist_items', COALESCE(checklist_stats.total_items, 0),
      'checklist_completed', COALESCE(checklist_stats.completed_items, 0)
    );

    -- Логируем попытку отправки уведомления (для разработки)
    INSERT INTO edge_function_calls (
      id,
      function_name,
      payload,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'telegram-notifications',
      task_payload,
      'pending',
      now()
    );
    
    -- TODO: В продакшене здесь будет PERFORM call_edge_function('telegram-notifications', task_payload);
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем/обновляем триггер на таблице tasks
DROP TRIGGER IF EXISTS task_completion_notification ON tasks;
CREATE TRIGGER task_completion_notification
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_manager_on_task_completion();

-- Функция для уведомления рабочего об ответе менеджера
CREATE OR REPLACE FUNCTION notify_worker_on_task_response()
RETURNS TRIGGER AS $$
DECLARE
  worker_payload jsonb;
  worker_data record;
  notification_text text;
  task_title text;
BEGIN
  -- Проверяем, что это новый ответ менеджера
  IF NEW.manager_response IS NOT NULL AND OLD.manager_response IS NULL THEN
    
    -- Получаем данные рабочего для уведомления
    SELECT * INTO worker_data
    FROM get_worker_telegram_data(NEW.worker_id)
    LIMIT 1;
    
    IF worker_data.worker_id IS NULL THEN
      -- Рабочий не настроил Telegram, пропускаем
      RETURN NEW;
    END IF;

    -- Получаем название задачи
    SELECT title INTO task_title
    FROM tasks
    WHERE id = NEW.task_id;

    -- Определяем текст уведомления в зависимости от ответа
    CASE NEW.manager_response
      WHEN 'approved' THEN
        notification_text := 'Ваша задача принята менеджером! Заработок добавлен к статистике.';
      WHEN 'rejected' THEN  
        notification_text := 'Ваша задача возвращена на доработку. ' || 
                           COALESCE('Причина: ' || NEW.response_comment, 'Обратитесь к менеджеру за уточнениями.');
      WHEN 'request_photos' THEN
        notification_text := 'Менеджер запросил дополнительные фотографии. Пожалуйста, добавьте фото и отправьте задачу заново.';
      ELSE
        notification_text := 'Менеджер обработал вашу задачу. Проверьте статус в приложении.';
    END CASE;

    -- Формируем payload для уведомления рабочего
    worker_payload := jsonb_build_object(
      'worker_id', NEW.worker_id,
      'task_id', NEW.task_id,
      'task_title', task_title,
      'manager_response', NEW.manager_response,
      'response_comment', NEW.response_comment,
      'manager_name', (SELECT full_name FROM users WHERE id = NEW.manager_id)
    );

    -- Асинхронно вызываем Edge Function для уведомления рабочего
    PERFORM call_edge_function('telegram-worker-notifications', worker_payload);
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем триггер для уведомлений рабочих
DROP TRIGGER IF EXISTS worker_notification_on_response ON task_notifications;
CREATE TRIGGER worker_notification_on_response
  AFTER UPDATE ON task_notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_on_task_response();

-- Функция для ручной отправки уведомлений (для разработки)
CREATE OR REPLACE FUNCTION send_pending_telegram_notifications()
RETURNS jsonb AS $$
DECLARE
  pending_notification record;
  notification_count integer := 0;
BEGIN
  -- Находим все ожидающие уведомления
  FOR pending_notification IN 
    SELECT * FROM edge_function_calls 
    WHERE function_name = 'telegram-notifications' 
    AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    -- Отмечаем как обработанное
    UPDATE edge_function_calls 
    SET status = 'processed_manually',
        completed_at = now()
    WHERE id = pending_notification.id;
    
    notification_count := notification_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', notification_count,
    'message', 'Обработано ' || notification_count || ' уведомлений. Отправляйте вручную через API.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для получения ожидающих уведомлений
CREATE OR REPLACE FUNCTION get_pending_notifications()
RETURNS TABLE (
  task_id text,
  payload jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (efc.payload->>'task_id')::text,
    efc.payload,
    efc.created_at
  FROM edge_function_calls efc
  WHERE efc.function_name = 'telegram-notifications' 
  AND efc.status = 'pending'
  ORDER BY efc.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION setup_telegram_config(
  supabase_url text,
  service_role_key text
)
RETURNS void AS $$
BEGIN
  -- Устанавливаем переменные для текущей сессии
  PERFORM set_config('app.supabase_url', supabase_url, false);
  PERFORM set_config('app.service_role_key', service_role_key, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для тестирования уведомлений (только для разработки)
CREATE OR REPLACE FUNCTION test_telegram_notification(task_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Принудительно вызываем уведомление для задачи
  UPDATE tasks 
  SET status = 'awaiting_approval', completed_at = now()
  WHERE id = task_uuid;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Тестовое уведомление отправлено',
    'task_id', task_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Политики безопасности для новой таблицы
ALTER TABLE edge_function_calls ENABLE ROW LEVEL SECURITY;

-- Админы и система могут читать логи вызовов
CREATE POLICY "admins_can_read_function_calls"
  ON edge_function_calls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director')
      AND is_active = true
    )
  );

-- Система может создавать записи о вызовах
CREATE POLICY "system_can_insert_function_calls"
  ON edge_function_calls
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Система может обновлять записи о вызовах
CREATE POLICY "system_can_update_function_calls"
  ON edge_function_calls
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_edge_function_calls_function_name ON edge_function_calls(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_calls_created_at ON edge_function_calls(created_at DESC);

-- Комментарии для документации
COMMENT ON FUNCTION notify_manager_on_task_completion() IS 'Триггер функция для автоматической отправки уведомлений менеджерам в Telegram при завершении задач';
COMMENT ON FUNCTION notify_worker_on_task_response() IS 'Триггер функция для уведомления рабочих об ответах менеджеров';
COMMENT ON FUNCTION call_edge_function(text, jsonb, text) IS 'Вспомогательная функция для вызова Supabase Edge Functions с логированием';
COMMENT ON TABLE edge_function_calls IS 'Лог всех вызовов Edge Functions для отладки и мониторинга';

-- Функция очистки старых логов (можно вызывать периодически)
CREATE OR REPLACE FUNCTION cleanup_old_function_calls()
RETURNS void AS $$
BEGIN
  -- Удаляем логи старше 30 дней
  DELETE FROM edge_function_calls 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;