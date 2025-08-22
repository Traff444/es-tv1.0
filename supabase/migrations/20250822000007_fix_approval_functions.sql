-- Исправление функций приёмки для использования нового ENUM photo_type
-- Заменяем старые значения 'before_context', 'before_detail' на 'before'
-- Заменяем старые значения 'after_context', 'after_detail' на 'after'

-- Обновляем функцию validate_task_for_approval
CREATE OR REPLACE FUNCTION validate_task_for_approval(task_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  photo_count integer;
  photo_min integer;
  requires_before boolean;
  checklist_count integer;
  completed_checklist_count integer;
  task_record tasks%ROWTYPE;
BEGIN
  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Задача не найдена'
    );
  END IF;

  -- Получаем требования к фото
  photo_min := COALESCE(task_record.effective_photo_min, 2);
  requires_before := COALESCE(task_record.effective_requires_before, false);

  -- Подсчитываем общее количество фото
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

  -- Проверяем требования к фото "до"
  IF requires_before THEN
    -- Если требуются фото "до", проверяем наличие хотя бы одного
    IF NOT EXISTS (SELECT 1 FROM task_photos WHERE task_id = task_uuid AND photo_type = 'before') THEN
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

-- Обновляем функцию get_task_approval_summary
CREATE OR REPLACE FUNCTION get_task_approval_summary(task_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  photo_count integer;
  before_photo_count integer;
  after_photo_count integer;
  checklist_count integer;
  completed_checklist_count integer;
  task_record tasks%ROWTYPE;
BEGIN
  -- Получаем данные задачи
  SELECT * INTO task_record FROM tasks WHERE id = task_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Задача не найдена'
    );
  END IF;

  -- Подсчитываем общее количество фото
  SELECT COUNT(*) INTO photo_count 
  FROM task_photos 
  WHERE task_id = task_uuid;

  -- Подсчитываем количество фото "до"
  SELECT COUNT(*) INTO before_photo_count 
  FROM task_photos 
  WHERE task_id = task_uuid AND photo_type = 'before';

  -- Подсчитываем количество фото "после"
  SELECT COUNT(*) INTO after_photo_count 
  FROM task_photos 
  WHERE task_id = task_uuid AND photo_type = 'after';

  -- Подсчитываем количество пунктов чек-листа
  SELECT COUNT(*) INTO checklist_count 
  FROM task_checklist 
  WHERE task_id = task_uuid;

  -- Подсчитываем количество выполненных пунктов чек-листа
  SELECT COUNT(*) INTO completed_checklist_count 
  FROM task_checklist 
  WHERE task_id = task_uuid AND is_completed = true;

  RETURN jsonb_build_object(
    'task_id', task_uuid,
    'task_title', task_record.title,
    'status', task_record.status,
    'photo_count', photo_count,
    'before_photo_count', before_photo_count,
    'after_photo_count', after_photo_count,
    'checklist_count', checklist_count,
    'completed_checklist_count', completed_checklist_count,
    'requires_before_photos', COALESCE(task_record.effective_requires_before, false),
    'photo_min_required', COALESCE(task_record.effective_photo_min, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
