-- Seed данные для разработки
-- Этот файл выполняется при каждом supabase db reset

-- Добавляем тестового админа
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role
) VALUES (
  gen_random_uuid(),
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'admin'
);

-- Добавляем тестового менеджера
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role
) VALUES (
  gen_random_uuid(),
  'manager@test.com',
  crypt('manager123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'manager'
);

-- Добавляем тестового рабочего
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role
) VALUES (
  gen_random_uuid(),
  'worker@test.com',
  crypt('worker123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'worker'
);
