/*
  # Автоматические уведомления для продакшена
  
  Эта миграция переключает триггеры БД на прямой вызов Edge Functions
  вместо логирования как 'pending'. Используется только в продакшене,
  где HTTP вызовы работают корректно.
*/

-- Обновляем триггер для продакшена (прямой вызов Edge Function)
CREATE OR REPLACE FUNCTION notify_manager_on_task_completion_production()
RETURNS TRIGGER AS $$
DECLARE
  task_payload jsonb;
  manager_data record;
  photo_urls text[];
  checklist_stats record;
  result jsonb;
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

    -- ПРОДАКШЕН: Прямой вызов Edge Function
    SELECT call_edge_function('telegram-notifications', task_payload) INTO result;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарий с инструкциями по переключению
COMMENT ON FUNCTION notify_manager_on_task_completion_production() IS 
'Продакшен версия триггера с прямым вызовом Edge Functions. 
Для переключения выполните:
1. DROP TRIGGER task_completion_notification ON tasks;
2. CREATE TRIGGER task_completion_notification AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION notify_manager_on_task_completion_production();';

-- Функция для переключения между режимами
CREATE OR REPLACE FUNCTION switch_to_production_mode()
RETURNS void AS $$
BEGIN
  -- Удаляем триггер разработки
  DROP TRIGGER IF EXISTS task_completion_notification ON tasks;
  
  -- Создаем триггер продакшена
  CREATE TRIGGER task_completion_notification
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_manager_on_task_completion_production();
    
  RAISE NOTICE 'Переключено в режим продакшена: уведомления будут отправляться автоматически';
END;
$$ LANGUAGE plpgsql;