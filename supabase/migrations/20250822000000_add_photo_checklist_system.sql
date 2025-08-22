/*
  # Система фото-чек-листов и приёмки

  1. Новые таблицы
    - `task_types` (словарь типов задач с правилами фото/чек-листов)
    - `task_photos` (фото к задачам)
    - `task_checklist` (чек-лист задач)
    - `user_reliability_scores` (надёжность работников)

  2. Обновления
    - Добавить новые статусы в таблицу `tasks`
    - Добавить поля для приёмки в таблицу `tasks`

  3. Функции
    - Отправка задачи на приёмку
    - Приёмка/возврат задач
    - Расчет reliability score
*/

-- Создание enum для уровней риска (если не существует)
DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Создание enum для типов фото (упрощенная система)
CREATE TYPE photo_type AS ENUM ('before', 'after');

-- Создание таблицы типов задач (словарь)
CREATE TABLE IF NOT EXISTS task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, -- например: 'outlet_install', 'switch_install'
  display_name text NOT NULL, -- например: 'Установка розетки', 'Установка выключателя'
  service_domain text NOT NULL DEFAULT 'electric', -- electric, plumbing, etc.
  risk_level risk_level NOT NULL DEFAULT 'low',
  requires_before_photos boolean NOT NULL DEFAULT false,
  photo_min integer NOT NULL DEFAULT 2,
  allow_auto_accept boolean NOT NULL DEFAULT true,
  default_checklist jsonb NOT NULL DEFAULT '[]',
  default_norm_minutes integer NOT NULL DEFAULT 15,
  version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создание таблицы фото к задачам
CREATE TABLE IF NOT EXISTS task_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type photo_type NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  is_synced boolean DEFAULT false,
  local_path text, -- для офлайн режима
  file_size integer, -- размер файла в байтах
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы чек-листа задач
CREATE TABLE IF NOT EXISTS task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  checklist_item text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  is_synced boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Создание таблицы надёжности работников
CREATE TABLE IF NOT EXISTS user_reliability_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score numeric(3,2) DEFAULT 1.00 CHECK (score >= 0 AND score <= 1),
  tasks_completed integer DEFAULT 0,
  tasks_returned integer DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Обновление таблицы tasks для поддержки новых статусов и приёмки
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready' CHECK (status IN ('ready', 'in_progress', 'awaiting_photos', 'awaiting_approval', 'done'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type_id uuid REFERENCES task_types(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_before_override boolean;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS photo_min_override integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist_override jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_override risk_level;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effective_norm_minutes integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effective_checklist_version integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effective_photo_min integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effective_requires_before boolean;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_comment text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS returned_for_revision_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS revision_comment text;

-- Включение RLS для всех новых таблиц
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reliability_scores ENABLE ROW LEVEL SECURITY;

-- Политики для task_types
CREATE POLICY "Все могут читать типы задач"
  ON task_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Менеджеры могут управлять типами задач"
  ON task_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики для task_photos
CREATE POLICY "Пользователи могут читать фото своих задач"
  ON task_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_photos.task_id 
      AND t.assigned_to = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

CREATE POLICY "Пользователи могут загружать фото для своих задач"
  ON task_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_photos.task_id 
      AND t.assigned_to = auth.uid()
    )
  );

-- Политики для task_checklist
CREATE POLICY "Пользователи могут читать чек-лист своих задач"
  ON task_checklist
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_checklist.task_id 
      AND t.assigned_to = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

CREATE POLICY "Пользователи могут обновлять чек-лист своих задач"
  ON task_checklist
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_checklist.task_id 
      AND t.assigned_to = auth.uid()
    )
  );

-- Политики для user_reliability_scores
CREATE POLICY "Пользователи могут читать свой reliability score"
  ON user_reliability_scores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

CREATE POLICY "Система может обновлять reliability scores"
  ON user_reliability_scores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX IF NOT EXISTS idx_task_photos_photo_type ON task_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_task_checklist_task_id ON task_checklist(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type_id ON tasks(task_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_submitted_at ON tasks(submitted_at);

-- Добавляем комментарии к таблицам
COMMENT ON TABLE task_types IS 'Словарь типов задач с правилами фото/чек-листов';
COMMENT ON TABLE task_photos IS 'Фото к задачам';
COMMENT ON TABLE task_checklist IS 'Чек-лист задач';
COMMENT ON TABLE user_reliability_scores IS 'Надёжность работников для автоприёмки';

-- Триггеры для обновления updated_at
CREATE TRIGGER update_task_types_updated_at
  BEFORE UPDATE ON task_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_reliability_scores_updated_at
  BEFORE UPDATE ON user_reliability_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
