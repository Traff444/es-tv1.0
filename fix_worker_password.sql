-- Fix password for test worker
UPDATE auth.users 
SET encrypted_password = crypt('telegram_481890', gen_salt('bf'))
WHERE id = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08';

-- Verify the user exists and is updated
SELECT id, email, encrypted_password IS NOT NULL as has_password 
FROM auth.users 
WHERE id = '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08';