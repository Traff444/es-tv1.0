-- Создание первого пользователя-администратора
-- Этот скрипт создает пользователя в auth.users и соответствующую запись в public.users

-- Создаем пользователя в auth.users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  gen_random_uuid(),
  'admin@electroservice.local',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Администратор системы"}',
  false,
  '',
  '',
  '',
  ''
);

-- Получаем ID созданного пользователя
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@electroservice.local';
  
  -- Создаем запись в public.users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    hourly_rate,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    'admin@electroservice.local',
    'Администратор системы',
    'admin',
    0,
    now(),
    now()
  );
  
  RAISE NOTICE 'Администратор создан с ID: %', admin_user_id;
END $$;
