-- Быстрая проверка и создание тестового рабочего для Telegram Mini App
-- Выполните эту команду в Supabase Studio (http://127.0.0.1:54323)

-- 1. Проверяем, есть ли рабочий с Telegram ID 481890
SELECT 
    u.id, u.full_name, u.email, u.role, u.is_active,
    tu.telegram_id
FROM users u
LEFT JOIN telegram_users tu ON u.id = tu.user_id
WHERE tu.telegram_id = 481890;

-- 2. Создаем или обновляем пользователя в auth.users
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
) VALUES (
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    'test.worker@electroservice.by',
    crypt('telegram_481890', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('telegram_481890', gen_salt('bf')),
    updated_at = NOW();

-- 3. Создаем профиль в public.users
INSERT INTO public.users (
    id,
    email,
    full_name, 
    role,
    hourly_rate,
    is_active
) VALUES (
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    'test.worker@electroservice.by',
    'Тестовый Рабочий (Telegram ID: 481890)',
    'worker',
    15.00,
    true
) ON CONFLICT (id) DO UPDATE SET
    full_name = 'Тестовый Рабочий (Telegram ID: 481890)',
    is_active = true,
    updated_at = NOW();

-- 4. Создаем связь с Telegram
INSERT INTO telegram_users (
    user_id,
    telegram_id,
    first_name,
    last_name,
    username
) VALUES (
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    481890,
    'Rss',
    '',
    'traf4444'
) ON CONFLICT (telegram_id) DO UPDATE SET
    user_id = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    first_name = 'Rss',
    username = 'traf4444',
    updated_at = NOW();

-- 5. Создаем тестовую задачу
INSERT INTO tasks (
    title,
    description,
    priority,
    status,
    assigned_to,
    target_location,
    estimated_hours
) VALUES (
    'Тестовая задача - Telegram Mini App',
    'Установка розетки с фото-отчетом. Тест системы фото для Telegram Mini App.',
    'medium',
    'pending',
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    'ул. Тестовая, 1, Минск',
    2.0
) ON CONFLICT DO NOTHING;

-- 6. Проверяем результат
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    u.is_active,
    tu.telegram_id,
    COUNT(t.id) as task_count
FROM users u
LEFT JOIN telegram_users tu ON u.id = tu.user_id
LEFT JOIN tasks t ON u.id = t.assigned_to
WHERE tu.telegram_id = 481890
GROUP BY u.id, u.full_name, u.email, u.role, u.is_active, tu.telegram_id;

-- 7. Показываем задачи для этого рабочего
SELECT 
    t.id,
    t.title,
    t.status,
    t.priority,
    u.full_name as worker_name,
    tu.telegram_id
FROM tasks t
JOIN users u ON t.assigned_to = u.id
JOIN telegram_users tu ON u.id = tu.user_id
WHERE tu.telegram_id = 481890
ORDER BY t.created_at DESC
LIMIT 3;