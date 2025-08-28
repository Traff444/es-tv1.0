-- Исправление enum task_status
-- Добавляем недостающие статусы для Telegram интеграции

-- Добавляем новые значения в enum task_status
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'awaiting_photos';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'returned';