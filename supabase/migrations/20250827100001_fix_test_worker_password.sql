-- Fix test worker password
UPDATE auth.users 
SET encrypted_password = crypt('telegram_481890', gen_salt('bf'))
WHERE id = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08';