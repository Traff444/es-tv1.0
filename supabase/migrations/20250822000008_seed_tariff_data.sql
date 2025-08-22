-- Добавление тестовых данных для системы тарифов

-- 1. Добавляем типы тарифов, если их нет
INSERT INTO tariff_types (name, type, description, is_active) VALUES
  ('Будние дни', 'weekday', 'Обычные рабочие дни (понедельник-пятница)', true),
  ('Выходные дни', 'weekend', 'Суббота и воскресенье', true),
  ('Праздничные дни', 'holiday', 'Государственные праздники Беларуси', true)
ON CONFLICT DO NOTHING;

-- 2. Добавляем праздничные дни Беларуси на 2025 год
INSERT INTO holidays (date, name, description, is_active) VALUES
  ('2025-01-01', 'Новый год', 'Новый год', true),
  ('2025-01-07', 'Рождество Христово', 'Рождество Христово (православное)', true),
  ('2025-03-08', 'Международный женский день', 'Международный женский день', true),
  ('2025-05-01', 'Праздник труда', 'День труда', true),
  ('2025-05-09', 'День Победы', 'День Победы', true),
  ('2025-07-03', 'День Независимости', 'День Независимости Республики Беларусь', true),
  ('2025-11-07', 'День Октябрьской революции', 'День Октябрьской революции', true),
  ('2025-12-25', 'Рождество Христово', 'Рождество Христово (католическое)', true)
ON CONFLICT (date) DO NOTHING;

-- 3. Добавляем тестовые тарифы для рабочих (если есть рабочие в системе)
-- Получаем ID типов тарифов
DO $$
DECLARE
  weekday_id uuid;
  weekend_id uuid;
  holiday_id uuid;
  worker_record RECORD;
BEGIN
  -- Получаем ID типов тарифов
  SELECT id INTO weekday_id FROM tariff_types WHERE type = 'weekday' LIMIT 1;
  SELECT id INTO weekend_id FROM tariff_types WHERE type = 'weekend' LIMIT 1;
  SELECT id INTO holiday_id FROM tariff_types WHERE type = 'holiday' LIMIT 1;
  
  -- Добавляем тарифы для всех активных рабочих
  FOR worker_record IN 
    SELECT id, full_name FROM users WHERE role = 'worker' AND is_active = true
  LOOP
    -- Будние дни: 2 BYN/час = 0.0333 BYN/минуту
    INSERT INTO user_tariffs (user_id, tariff_type_id, rate_per_minute, currency, valid_from, is_active) VALUES
      (worker_record.id, weekday_id, 0.0333, 'BYN', CURRENT_DATE, true)
    ON CONFLICT (user_id, tariff_type_id, valid_from) DO NOTHING;
    
    -- Выходные дни: 3 BYN/час = 0.05 BYN/минуту
    INSERT INTO user_tariffs (user_id, tariff_type_id, rate_per_minute, currency, valid_from, is_active) VALUES
      (worker_record.id, weekend_id, 0.05, 'BYN', CURRENT_DATE, true)
    ON CONFLICT (user_id, tariff_type_id, valid_from) DO NOTHING;
    
    -- Праздничные дни: 4 BYN/час = 0.0667 BYN/минуту
    INSERT INTO user_tariffs (user_id, tariff_type_id, rate_per_minute, currency, valid_from, is_active) VALUES
      (worker_record.id, holiday_id, 0.0667, 'BYN', CURRENT_DATE, true)
    ON CONFLICT (user_id, tariff_type_id, valid_from) DO NOTHING;
    
    RAISE NOTICE 'Добавлены тарифы для рабочего: %', worker_record.full_name;
  END LOOP;
END $$;
