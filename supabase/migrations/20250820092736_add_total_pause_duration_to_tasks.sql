-- Добавляем колонку total_pause_duration для учета общего времени пауз
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_pause_duration INTEGER DEFAULT 0;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN tasks.total_pause_duration IS 'Общее время пауз в секундах';
