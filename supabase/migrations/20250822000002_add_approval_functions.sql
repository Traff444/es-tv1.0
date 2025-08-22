/*
  # Supabase функции для системы приёмки задач

  1. Функции для отправки на приёмку
    - submit_task_for_approval - отправка задачи на приёмку
    - validate_task_submission - валидация требований к отправке

  2. Функции для приёмки/возврата
    - process_task_approval - приёмка или возврат задачи
    - update_reliability_score - обновление надёжности работника

  3. Функции для автоприёмки
    - can_auto_approve - проверка возможности автоприёмки
    - auto_approve_tasks - автоматическая приёмка задач
*/

-- Функция для валидации требований к отправке задачи на приёмку
CREATE OR REPLACE FUNCTION validate_task_submission(task_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  task_record tasks%ROWTYPE;
  task_type_record task_types%ROWTYPE;
  photo_count integer;
  checklist_count integer;
  completed_checklist_count integer;
  requires_before boolean;
  photo_min integer;
  validation_result jsonb;
BEGIN
  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Задача не найдена'
    );
  END IF;

  -- Получаем данные типа задачи
  SELECT * INTO task_type_record FROM task_types WHERE id = task_record.task_type_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Тип задачи не найден'
    );
  END IF;

  -- Определяем эффективные правила (оверрайд или из типа)
  requires_before := COALESCE(task_record.requires_before_override, task_type_record.requires_before_photos);
  photo_min := COALESCE(task_record.photo_min_override, task_type_record.photo_min);

  -- Подсчитываем количество фото
  SELECT COUNT(*) INTO photo_count 
  FROM task_photos 
  WHERE task_id = task_uuid;

  -- Подсчитываем количество пунктов чек-листа
  SELECT COUNT(*) INTO checklist_count 
  FROM task_checklist 
  WHERE task_id = task_uuid;

  -- Подсчитываем количество выполненных пунктов чек-листа
  SELECT COUNT(*) INTO completed_checklist_count 
  FROM task_checklist 
  WHERE task_id = task_uuid AND is_completed = true;

  -- Проверяем требования к фото
  IF requires_before THEN
    -- Если требуются фото "до", проверяем наличие хотя бы одного
    IF NOT EXISTS (SELECT 1 FROM task_photos WHERE task_id = task_uuid AND photo_type IN ('before_context', 'before_detail')) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Требуется фото "до" выполнения работ',
        'photo_count', photo_count,
        'photo_min', photo_min,
        'requires_before', requires_before
      );
    END IF;
  END IF;

  -- Проверяем минимальное количество фото
  IF photo_count < photo_min THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Требуется минимум %s фото, загружено %s', photo_min, photo_count),
      'photo_count', photo_count,
      'photo_min', photo_min,
      'requires_before', requires_before
    );
  END IF;

  -- Проверяем чек-лист
  IF checklist_count = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Чек-лист не заполнен',
      'photo_count', photo_count,
      'photo_min', photo_min,
      'checklist_count', checklist_count
    );
  END IF;

  IF completed_checklist_count < checklist_count THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Выполнено %s из %s пунктов чек-листа', completed_checklist_count, checklist_count),
      'photo_count', photo_count,
      'photo_min', photo_min,
      'checklist_count', checklist_count,
      'completed_checklist_count', completed_checklist_count
    );
  END IF;

  -- Все проверки пройдены
  RETURN jsonb_build_object(
    'valid', true,
    'photo_count', photo_count,
    'photo_min', photo_min,
    'checklist_count', checklist_count,
    'completed_checklist_count', completed_checklist_count,
    'requires_before', requires_before
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отправки задачи на приёмку
CREATE OR REPLACE FUNCTION submit_task_for_approval(task_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  validation_result jsonb;
  task_record tasks%ROWTYPE;
  user_record users%ROWTYPE;
BEGIN
  -- Проверяем права доступа
  IF NOT EXISTS (
    SELECT 1 FROM tasks t 
    WHERE t.id = task_uuid 
    AND t.assigned_to = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Нет прав для отправки этой задачи'
    );
  END IF;

  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Задача не найдена'
    );
  END IF;

  -- Проверяем статус задачи
  IF task_record.status != 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Задача должна быть в статусе "В работе"'
    );
  END IF;

  -- Валидируем требования к отправке
  SELECT validate_task_submission(task_uuid) INTO validation_result;
  
  IF NOT (validation_result->>'valid')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', validation_result->>'error',
      'details', validation_result
    );
  END IF;

  -- Получаем данные пользователя для уведомлений
  SELECT * INTO user_record FROM users WHERE id = auth.uid();

  -- Обновляем статус задачи
  UPDATE tasks 
  SET 
    status = 'awaiting_approval',
    submitted_at = now()
  WHERE id = task_uuid;

  -- Отмечаем фото и чек-лист как синхронизированные
  UPDATE task_photos SET is_synced = true WHERE task_id = task_uuid;
  UPDATE task_checklist SET is_synced = true WHERE task_id = task_uuid;

  -- TODO: Отправка уведомления в Telegram (будет реализовано позже)
  -- Здесь будет вызов функции для отправки уведомления менеджеру

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Задача отправлена на приёмку',
    'task_id', task_uuid,
    'submitted_at', now(),
    'validation', validation_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для обновления reliability score пользователя
CREATE OR REPLACE FUNCTION update_reliability_score(user_uuid uuid)
RETURNS void AS $$
DECLARE
  total_tasks integer;
  returned_tasks integer;
  completed_tasks integer;
  new_score numeric;
BEGIN
  -- Подсчитываем общее количество задач пользователя за последние 30 дней
  SELECT COUNT(*) INTO total_tasks
  FROM tasks 
  WHERE assigned_to = user_uuid 
  AND created_at >= now() - interval '30 days'
  AND status IN ('done', 'awaiting_approval', 'returned_for_revision');

  -- Подсчитываем количество возвращенных задач
  SELECT COUNT(*) INTO returned_tasks
  FROM tasks 
  WHERE assigned_to = user_uuid 
  AND status = 'returned_for_revision'
  AND returned_for_revision_at >= now() - interval '30 days';

  -- Подсчитываем количество завершенных задач
  SELECT COUNT(*) INTO completed_tasks
  FROM tasks 
  WHERE assigned_to = user_uuid 
  AND status = 'done'
  AND approved_at >= now() - interval '30 days';

  -- Рассчитываем новый score
  IF total_tasks = 0 THEN
    new_score := 1.0; -- По умолчанию максимальный score
  ELSE
    -- Формула: (завершенные - возвращенные) / общее количество
    new_score := GREATEST(0.0, LEAST(1.0, (completed_tasks - returned_tasks)::numeric / total_tasks));
  END IF;

  -- Обновляем или создаем запись reliability score
  INSERT INTO user_reliability_scores (user_id, score, tasks_completed, tasks_returned, last_calculated_at)
  VALUES (user_uuid, new_score, completed_tasks, returned_tasks, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    score = new_score,
    tasks_completed = completed_tasks,
    tasks_returned = returned_tasks,
    last_calculated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для приёмки или возврата задачи
CREATE OR REPLACE FUNCTION process_task_approval(
  task_uuid uuid,
  action text, -- 'approve' или 'return'
  comment text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  task_record tasks%ROWTYPE;
  user_record users%ROWTYPE;
  reliability_score numeric;
BEGIN
  -- Проверяем права доступа (только менеджеры)
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('manager', 'director', 'admin')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Недостаточно прав для приёмки задач'
    );
  END IF;

  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Задача не найдена'
    );
  END IF;

  -- Проверяем статус задачи
  IF task_record.status != 'awaiting_approval' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Задача должна быть в статусе "На приёмке"'
    );
  END IF;

  -- Получаем данные пользователя для уведомлений
  SELECT * INTO user_record FROM users WHERE id = auth.uid();

  IF action = 'approve' THEN
    -- Приёмка задачи
    UPDATE tasks 
    SET 
      status = 'done',
      approved_at = now(),
      approved_by = auth.uid(),
      approval_comment = comment
    WHERE id = task_uuid;

    -- Обновляем reliability score исполнителя
    PERFORM update_reliability_score(task_record.assigned_to);

    -- TODO: Отправка уведомления исполнителю об успешной приёмке

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Задача принята',
      'task_id', task_uuid,
      'approved_at', now(),
      'approved_by', auth.uid()
    );

  ELSIF action = 'return' THEN
    -- Проверяем наличие комментария при возврате
    IF comment IS NULL OR trim(comment) = '' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Комментарий обязателен при возврате задачи'
      );
    END IF;

    -- Возврат задачи на доработку
    UPDATE tasks 
    SET 
      status = 'awaiting_photos',
      returned_for_revision_at = now(),
      revision_comment = comment
    WHERE id = task_uuid;

    -- Обновляем reliability score исполнителя
    PERFORM update_reliability_score(task_record.assigned_to);

    -- TODO: Отправка уведомления исполнителю о возврате с комментарием

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Задача возвращена на доработку',
      'task_id', task_uuid,
      'returned_at', now(),
      'returned_by', auth.uid(),
      'comment', comment
    );

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Неверное действие. Допустимые значения: approve, return'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для проверки возможности автоприёмки
CREATE OR REPLACE FUNCTION can_auto_approve(task_uuid uuid)
RETURNS boolean AS $$
DECLARE
  task_record tasks%ROWTYPE;
  task_type_record task_types%ROWTYPE;
  user_reliability_record user_reliability_scores%ROWTYPE;
  time_elapsed interval;
  norm_minutes integer;
  actual_minutes integer;
  is_work_hours boolean;
BEGIN
  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Получаем данные типа задачи
  SELECT * INTO task_type_record FROM task_types WHERE id = task_record.task_type_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Проверяем, разрешена ли автоприёмка для данного типа
  IF NOT task_type_record.allow_auto_accept THEN
    RETURN false;
  END IF;

  -- Получаем reliability score пользователя
  SELECT * INTO user_reliability_record FROM user_reliability_scores WHERE user_id = task_record.assigned_to;
  IF NOT FOUND OR user_reliability_record.score < 0.9 THEN
    RETURN false;
  END IF;

  -- Проверяем время ожидания
  time_elapsed := now() - task_record.submitted_at;
  
  -- Определяем, рабочие ли это часы (8:00-18:00, пн-пт)
  is_work_hours := EXTRACT(DOW FROM now()) BETWEEN 1 AND 5 
                   AND EXTRACT(HOUR FROM now()) BETWEEN 8 AND 17;

  -- Проверяем время ожидания в зависимости от рабочих часов
  IF is_work_hours THEN
    IF time_elapsed < interval '30 minutes' THEN
      RETURN false;
    END IF;
  ELSE
    IF time_elapsed < interval '90 minutes' THEN
      RETURN false;
    END IF;
  END IF;

  -- Проверяем скорость выполнения (антигонка)
  norm_minutes := COALESCE(task_record.effective_norm_minutes, task_type_record.default_norm_minutes);
  actual_minutes := EXTRACT(EPOCH FROM (task_record.submitted_at - task_record.started_at)) / 60;

  -- Если выполнено слишком быстро (< 35% от нормы), отключаем автоприёмку
  IF actual_minutes < (norm_minutes * 0.35) THEN
    RETURN false;
  END IF;

  -- Все проверки пройдены
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для автоматической приёмки задач
CREATE OR REPLACE FUNCTION auto_approve_tasks()
RETURNS integer AS $$
DECLARE
  task_record RECORD;
  approved_count integer := 0;
BEGIN
  -- Находим задачи, которые можно принять автоматически
  FOR task_record IN 
    SELECT t.id, t.assigned_to
    FROM tasks t
    WHERE t.status = 'awaiting_approval'
    AND can_auto_approve(t.id)
  LOOP
    -- Принимаем задачу автоматически
    PERFORM process_task_approval(task_record.id, 'approve', 'Автоматическая приёмка');
    approved_count := approved_count + 1;
  END LOOP;

  RETURN approved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Добавляем комментарии к функциям
COMMENT ON FUNCTION validate_task_submission(uuid) IS 'Валидация требований к отправке задачи на приёмку';
COMMENT ON FUNCTION submit_task_for_approval(uuid) IS 'Отправка задачи на приёмку';
COMMENT ON FUNCTION update_reliability_score(uuid) IS 'Обновление надёжности работника';
COMMENT ON FUNCTION process_task_approval(uuid, text, text) IS 'Приёмка или возврат задачи';
COMMENT ON FUNCTION can_auto_approve(uuid) IS 'Проверка возможности автоприёмки';
COMMENT ON FUNCTION auto_approve_tasks() IS 'Автоматическая приёмка задач';
