-- Создание триггера для автоматического создания профилей пользователей
-- Этот триггер будет срабатывать при создании нового пользователя в auth.users

-- 1. Создаем функцию для обработки нового пользователя
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Вставляем нового пользователя в таблицу users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    is_active,
    hourly_rate,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Новый пользователь'),
    'worker', -- роль по умолчанию
    true,     -- активен по умолчанию
    2.0,      -- тариф по умолчанию
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Создаем триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Проверяем, что триггер создан
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 4. Показываем текущих пользователей
SELECT 
    'auth.users' as table_name,
    COUNT(*) as user_count
FROM auth.users
UNION ALL
SELECT 
    'public.users' as table_name,
    COUNT(*) as user_count
FROM public.users;
