-- Insert test users for Telegram integration testing

INSERT INTO users (id, email, full_name, role) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'admin@test.com', 'Администратор', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440001', 'manager@test.com', 'Менеджер', 'manager'),
  ('550e8400-e29b-41d4-a716-446655440002', 'worker@test.com', 'Рабочий', 'worker')
ON CONFLICT (id) DO NOTHING;

-- Add some sample tariff data for testing
INSERT INTO user_tariffs (user_id, tariff_type_id, rate_per_minute, currency) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440002' as user_id,
  tt.id as tariff_type_id,
  CASE 
    WHEN tt.type = 'weekday' THEN 0.0333
    WHEN tt.type = 'weekend' THEN 0.05
    WHEN tt.type = 'holiday' THEN 0.0667
  END as rate_per_minute,
  'BYN' as currency
FROM tariff_types tt
WHERE EXISTS (SELECT 1 FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440002')
ON CONFLICT (user_id, tariff_type_id) DO NOTHING;