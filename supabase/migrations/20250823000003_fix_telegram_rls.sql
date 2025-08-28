-- Исправление RLS политик для telegram_users
-- Добавляем доступ для anon role для работы с Telegram интеграцией

-- Добавляем политику для anon доступа к чтению telegram_users
CREATE POLICY "anon_can_read_telegram_users_for_integration"
  ON telegram_users
  FOR SELECT
  TO anon
  USING (true);

-- Добавляем политику для anon доступа к созданию telegram_users
CREATE POLICY "anon_can_insert_telegram_users_for_integration"
  ON telegram_users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Добавляем политику для anon доступа к обновлению telegram_users
CREATE POLICY "anon_can_update_telegram_users_for_integration"
  ON telegram_users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);