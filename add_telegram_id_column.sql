-- 📱 Добавление колонки telegram_id в таблицу users
-- Простое решение для быстрого тестирования Telegram Mini App

-- 1️⃣ Добавляем колонку telegram_id в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT;

-- 2️⃣ Создаем индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- 3️⃣ Делаем telegram_id уникальным (необязательно, но рекомендуется)
ALTER TABLE users 
ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);

-- 4️⃣ Проверяем, что колонка добавлена
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'telegram_id';

-- 5️⃣ Показываем все колонки таблицы users
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- 6️⃣ Готовый запрос для добавления вашего Telegram ID вручную:
-- UPDATE users 
-- SET telegram_id = 481890 
-- WHERE email = 'ваш_email@example.com';

-- 7️⃣ Проверка после ручного добавления:
-- SELECT id, email, full_name, role, telegram_id 
-- FROM users 
-- WHERE telegram_id IS NOT NULL;