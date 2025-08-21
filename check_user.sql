-- Проверка пользователя в auth.users
SELECT id, email, encrypted_password, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'admin@electroservice.local';

-- Проверка пользователя в public.users
SELECT id, full_name, email, role, created_at 
FROM public.users 
WHERE email = 'admin@electroservice.local';
