-- Создание тестовых данных для Telegram Mini App
-- Выполнить через Supabase Studio или psql

-- 1. Создаем тестового рабочего
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test.worker@electroservice.by',
  crypt('telegram_481890', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'worker'
) ON CONFLICT (id) DO NOTHING;

-- Создаем профиль рабочего
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test.worker@electroservice.by',
  'Тестовый Рабочий',
  'worker',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Создаем тестового менеджера
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'test.manager@electroservice.by',
  crypt('manager123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'manager'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'test.manager@electroservice.by',
  'Тестовый Менеджер',
  'manager',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Создаем тестовые задачи
INSERT INTO tasks (
  title,
  description,
  priority,
  status,
  assigned_to,
  created_by,
  estimated_hours,
  target_location,
  created_at,
  updated_at
) VALUES
(
  'Установка розетки в офисе',
  'Установить двойную розетку в кабинете директора',
  'high',
  'pending',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  1.5,
  'Кабинет директора, 3 этаж',
  NOW(),
  NOW()
),
(
  'Замена выключателя в коридоре',
  'Заменить старый выключатель на новый с подсветкой',
  'medium',
  'in_progress',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  1.0,
  'Коридор, 2 этаж',
  NOW() - INTERVAL '30 minutes',
  NOW()
),
(
  'Монтаж распределительной коробки',
  'Установить и подключить распределительную коробку в подвале',
  'low',
  'pending',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  3.0,
  'Подвал, помещение электроснабжения',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 4. Создаем активную смену для рабочего
INSERT INTO work_sessions (
  user_id,
  start_time,
  start_location,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  NOW() - INTERVAL '2 hours',
  '53.902284,27.561831',
  NOW() - INTERVAL '2 hours'
) ON CONFLICT DO NOTHING;

-- 5. Создаем типы задач (если не существуют)
INSERT INTO task_types (
  slug,
  display_name,
  service_domain,
  risk_level,
  requires_before_photos,
  photo_min,
  allow_auto_accept,
  default_checklist,
  default_norm_minutes,
  version,
  is_active,
  created_at,
  updated_at
) VALUES
(
  'outlet_install',
  'Установка розетки',
  'electrical',
  'medium',
  true,
  2,
  false,
  '["Подготовка места установки", "Проверка проводки", "Установка розетки", "Тестирование работоспособности"]',
  90,
  1,
  true,
  NOW(),
  NOW()
),
(
  'switch_replacement',
  'Замена выключателя',
  'electrical',
  'low',
  false,
  1,
  true,
  '["Демонтаж старого выключателя", "Установка нового выключателя", "Тестирование"]',
  60,
  1,
  true,
  NOW(),
  NOW()
),
(
  'distribution_box',
  'Монтаж распределительной коробки',
  'electrical',
  'high',
  true,
  3,
  false,
  '["Подготовка места монтажа", "Установка коробки", "Подключение проводов", "Тестирование системы"]',
  180,
  1,
  true,
  NOW(),
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 6. Обновляем задачу с типом
UPDATE tasks SET task_type_id = (SELECT id FROM task_types WHERE slug = 'outlet_install' LIMIT 1)
WHERE title = 'Установка розетки в офисе';

UPDATE tasks SET task_type_id = (SELECT id FROM task_types WHERE slug = 'switch_replacement' LIMIT 1)
WHERE title = 'Замена выключателя в коридоре';

UPDATE tasks SET task_type_id = (SELECT id FROM task_types WHERE slug = 'distribution_box' LIMIT 1)
WHERE title = 'Монтаж распределительной коробки';

-- 7. Создаем тестовые тарифы
INSERT INTO tariff_types (
  name,
  type,
  description,
  is_active,
  created_at,
  updated_at
) VALUES
('Будние дни', 'weekday', 'Оплата за работу в будние дни', true, NOW(), NOW()),
('Выходные дни', 'weekend', 'Оплата за работу в выходные дни', true, NOW(), NOW()),
('Праздничные дни', 'holiday', 'Оплата за работу в праздничные дни', true, NOW(), NOW())
ON CONFLICT (type) DO NOTHING;

-- 8. Создаем пользовательские тарифы
INSERT INTO user_tariffs (
  user_id,
  tariff_type_id,
  rate_per_minute,
  currency,
  is_active,
  valid_from,
  created_at,
  updated_at
) SELECT
  u.id,
  tt.id,
  CASE
    WHEN tt.type = 'weekday' THEN 0.0333  -- 2 BYN/час
    WHEN tt.type = 'weekend' THEN 0.05    -- 3 BYN/час
    WHEN tt.type = 'holiday' THEN 0.0667  -- 4 BYN/час
    ELSE 0.0333
  END,
  'BYN',
  true,
  NOW(),
  NOW(),
  NOW()
FROM users u
CROSS JOIN tariff_types tt
WHERE u.role = 'worker'
ON CONFLICT DO NOTHING;

-- Вывод результатов
SELECT 'Тестовые данные созданы успешно!' as result;

-- Показать созданных пользователей
SELECT full_name, email, role FROM users ORDER BY role, full_name;

-- Показать созданные задачи
SELECT t.title, t.status, t.priority, u.full_name as assigned_to
FROM tasks t
JOIN users u ON t.assigned_to = u.id
ORDER BY t.created_at DESC;

-- Показать активные смены
SELECT u.full_name, ws.start_time, ws.start_location
FROM work_sessions ws
JOIN users u ON ws.user_id = u.id
WHERE ws.end_time IS NULL;
