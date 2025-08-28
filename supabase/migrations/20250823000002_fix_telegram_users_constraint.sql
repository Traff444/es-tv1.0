-- Исправление constraint для telegram_users
-- Добавляем уникальный constraint на user_id для корректной работы on_conflict

-- Сначала удаляем дубликаты если они есть (на всякий случай)
DELETE FROM telegram_users a USING telegram_users b 
WHERE a.id > b.id AND a.user_id = b.user_id;

-- Добавляем уникальный constraint на user_id
ALTER TABLE telegram_users 
ADD CONSTRAINT telegram_users_user_id_unique UNIQUE (user_id);

-- Также добавляем уникальный constraint на chat_id для предотвращения дубликатов
ALTER TABLE telegram_users 
ADD CONSTRAINT telegram_users_chat_id_unique UNIQUE (chat_id);