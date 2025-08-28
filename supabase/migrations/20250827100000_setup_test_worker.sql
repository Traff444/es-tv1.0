-- Create test worker for Telegram ID 481890
-- This creates the user in both auth.users and public.users tables with telegram_users link

-- Delete existing user if exists
DELETE FROM telegram_users WHERE telegram_id = 481890;
DELETE FROM public.users WHERE email = 'test.worker@electroservice.by';
DELETE FROM auth.users WHERE email = 'test.worker@electroservice.by';

-- Create auth user with known UUID
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token
) VALUES (
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    '00000000-0000-0000-0000-000000000000',
    'test.worker@electroservice.by',
    crypt('telegram_481890', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    ''
);

-- Create public user profile
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

-- Create telegram link
INSERT INTO telegram_users (
    user_id,
    telegram_id,
    chat_id,
    first_name,
    last_name,
    telegram_username
) VALUES (
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    481890,
    481890,
    'Rss',
    '',
    'traf4444'
) ON CONFLICT (telegram_id) DO UPDATE SET
    user_id = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    first_name = 'Rss',
    telegram_username = 'traf4444',
    updated_at = NOW();

-- Create test task
INSERT INTO tasks (
    title,
    description,
    priority,
    status,
    assigned_to,
    target_location,
    estimated_hours
) 
SELECT
    'Тестовая задача - Telegram Mini App',
    'Установка розетки с фото-отчетом. Тест системы фото для Telegram Mini App.',
    'medium',
    'pending',
    '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08',
    'ул. Тестовая, 1, Минск',
    2.0
WHERE NOT EXISTS (
    SELECT 1 FROM tasks 
    WHERE assigned_to = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08'
    AND title = 'Тестовая задача - Telegram Mini App'
);