/*
  # Система тарифов для Беларуси

  1. Новые таблицы
    - `tariff_types` (типы тарифов: будни, выходные, праздники)
    - `user_tariffs` (тарифы пользователей)
    - `holidays` (праздничные дни Беларуси)

  2. Функции
    - Расчет стоимости времени с учетом типа дня
    - Определение праздничных дней
    - Автоматический расчет заработка
*/

-- Создание enum для типов тарифов
CREATE TYPE tariff_type AS ENUM ('weekday', 'weekend', 'holiday');

-- Создание таблицы типов тарифов
CREATE TABLE IF NOT EXISTS tariff_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type tariff_type NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создание таблицы тарифов пользователей
CREATE TABLE IF NOT EXISTS user_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tariff_type_id uuid NOT NULL REFERENCES tariff_types(id) ON DELETE CASCADE,
  rate_per_minute numeric(10,4) NOT NULL DEFAULT 0, -- Ставка за минуту в белорусских рублях (BYN)
  currency text DEFAULT 'BYN',
  is_active boolean DEFAULT true,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tariff_type_id, valid_from)
);

-- Создание таблицы праздничных дней Беларуси
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Включение RLS для всех таблиц
ALTER TABLE tariff_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Политики для tariff_types
CREATE POLICY "Все могут читать типы тарифов"
  ON tariff_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Менеджеры могут управлять типами тарифов"
  ON tariff_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики для user_tariffs
CREATE POLICY "Пользователи могут читать свои тарифы"
  ON user_tariffs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

CREATE POLICY "Менеджеры могут управлять тарифами"
  ON user_tariffs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики для holidays
CREATE POLICY "Все могут читать праздники"
  ON holidays
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Менеджеры могут управлять праздниками"
  ON holidays
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Вставка базовых типов тарифов
INSERT INTO tariff_types (name, type, description) VALUES
  ('Будние дни', 'weekday', 'Понедельник - Пятница'),
  ('Выходные дни', 'weekend', 'Суббота - Воскресенье'),
  ('Праздничные дни', 'holiday', 'Государственные праздники Беларуси')
ON CONFLICT DO NOTHING;

-- Вставка праздничных дней Беларуси на 2025 год
INSERT INTO holidays (date, name, description) VALUES
  ('2025-01-01', 'Новый год', 'Новый год'),
  ('2025-01-07', 'Рождество Христово', 'Рождество Христово (православное)'),
  ('2025-03-08', 'Международный женский день', 'Международный женский день'),
  ('2025-05-01', 'Праздник труда', 'День труда'),
  ('2025-05-09', 'День Победы', 'День Победы'),
  ('2025-07-03', 'День Независимости', 'День Независимости Республики Беларусь'),
  ('2025-11-07', 'День Октябрьской революции', 'День Октябрьской революции'),
  ('2025-12-25', 'Рождество Христово', 'Рождество Христово (католическое)')
ON CONFLICT (date) DO NOTHING;

-- Функция для определения типа дня
CREATE OR REPLACE FUNCTION get_day_type(check_date date)
RETURNS tariff_type AS $$
DECLARE
  day_of_week integer;
  is_holiday boolean;
BEGIN
  -- Проверяем, является ли день праздником
  SELECT EXISTS(
    SELECT 1 FROM holidays 
    WHERE date = check_date AND is_active = true
  ) INTO is_holiday;
  
  IF is_holiday THEN
    RETURN 'holiday';
  END IF;
  
  -- Определяем день недели (1 = понедельник, 7 = воскресенье)
  day_of_week := EXTRACT(DOW FROM check_date);
  
  -- 6 = суббота, 0 = воскресенье
  IF day_of_week IN (0, 6) THEN
    RETURN 'weekend';
  ELSE
    RETURN 'weekday';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Функция для получения тарифа пользователя на определенную дату
CREATE OR REPLACE FUNCTION get_user_tariff(user_uuid uuid, check_date date)
RETURNS numeric AS $$
DECLARE
  day_type tariff_type;
  user_rate numeric;
BEGIN
  -- Определяем тип дня
  SELECT get_day_type(check_date) INTO day_type;
  
  -- Получаем тариф пользователя для данного типа дня
  SELECT ut.rate_per_minute
  FROM user_tariffs ut
  JOIN tariff_types tt ON ut.tariff_type_id = tt.id
  WHERE ut.user_id = user_uuid
    AND tt.type = day_type
    AND ut.is_active = true
    AND ut.valid_from <= check_date
    AND (ut.valid_to IS NULL OR ut.valid_to >= check_date)
  ORDER BY ut.valid_from DESC
  LIMIT 1
  INTO user_rate;
  
  -- Если тариф не найден, возвращаем 0
  RETURN COALESCE(user_rate, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Функция для расчета заработка за период
CREATE OR REPLACE FUNCTION calculate_earnings(
  user_uuid uuid,
  start_time timestamptz,
  end_time timestamptz
)
RETURNS numeric AS $$
DECLARE
  total_earnings numeric := 0;
  check_date date;
  day_start timestamptz;
  day_end timestamptz;
  day_rate numeric;
  minutes_worked integer;
BEGIN
  -- Перебираем каждый день в периоде
  check_date := start_time::date;
  
  WHILE check_date <= end_time::date LOOP
    -- Определяем границы дня
    day_start := GREATEST(start_time, check_date::timestamptz);
    day_end := LEAST(end_time, (check_date + interval '1 day')::timestamptz);
    
    -- Получаем тариф для данного дня
    SELECT get_user_tariff(user_uuid, check_date) INTO day_rate;
    
    -- Вычисляем количество минут работы в этот день
    minutes_worked := EXTRACT(EPOCH FROM (day_end - day_start)) / 60;
    
    -- Добавляем к общему заработку
    total_earnings := total_earnings + (day_rate * minutes_worked);
    
    check_date := check_date + interval '1 day';
  END LOOP;
  
  RETURN ROUND(total_earnings, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at
CREATE TRIGGER update_tariff_types_updated_at
  BEFORE UPDATE ON tariff_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_tariffs_updated_at
  BEFORE UPDATE ON user_tariffs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_holidays_updated_at
  BEFORE UPDATE ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Добавляем комментарии к таблицам
COMMENT ON TABLE tariff_types IS 'Типы тарифов (будни, выходные, праздники)';
COMMENT ON TABLE user_tariffs IS 'Тарифы пользователей по типам дней';
COMMENT ON TABLE holidays IS 'Праздничные дни Беларуси';
COMMENT ON FUNCTION get_day_type(date) IS 'Определяет тип дня (будни/выходные/праздники)';
COMMENT ON FUNCTION get_user_tariff(uuid, date) IS 'Получает тариф пользователя на определенную дату';
COMMENT ON FUNCTION calculate_earnings(uuid, timestamptz, timestamptz) IS 'Рассчитывает заработок за период с учетом разных тарифов';
