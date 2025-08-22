-- Добавление типов задач для тестирования системы фото-отчётов
-- Выполните этот скрипт в SQL Editor в Supabase

-- Сначала создаем таблицу task_types, если её нет
CREATE TABLE IF NOT EXISTS task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  service_domain text NOT NULL DEFAULT 'electric',
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  requires_before_photos boolean NOT NULL DEFAULT false,
  photo_min integer NOT NULL DEFAULT 2,
  allow_auto_accept boolean NOT NULL DEFAULT true,
  default_checklist jsonb NOT NULL DEFAULT '[]',
  default_norm_minutes integer NOT NULL DEFAULT 15,
  version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Вставляем типы задач для электрики
INSERT INTO task_types (slug, display_name, service_domain, risk_level, requires_before_photos, photo_min, allow_auto_accept, default_checklist, default_norm_minutes) VALUES
-- Простые работы (низкий риск, автоприёмка разрешена)
('outlet_install', 'Установка розетки', 'electric', 'low', false, 2, true, 
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]', 12),

('switch_install', 'Установка выключателя', 'electric', 'low', false, 2, true,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]', 12),

('light_point_install', 'Установка точки света', 'electric', 'low', false, 2, true,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]', 15),

-- Средний риск (требуют фото "до", автоприёмка отключена)
('cable_chase', 'Штроба', 'electric', 'medium', true, 3, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Глубина штробы"]', 180),

('cable_pull', 'Протяжка кабеля', 'electric', 'medium', true, 3, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Маркировка кабеля"]', 90),

('junction_box_splice', 'Распайка в коробке', 'electric', 'medium', true, 4, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Качество соединений"]', 30),

-- Высокий риск (никогда автоприёмка)
('panel_board_assembly', 'Сборка щита', 'electric', 'high', false, 5, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Качество соединений", "Маркировка автоматов"]', 600),

('outlet_rework', 'Переделка розетки', 'electric', 'medium', true, 3, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Состояние до ремонта"]', 20),

('switch_rework', 'Переделка выключателя', 'electric', 'medium', true, 3, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Состояние до ремонта"]', 20),

-- Универсальный тип для существующих задач
('generic_low_risk', 'Общая задача (низкий риск)', 'electric', 'low', false, 2, true,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]', 15),

('generic_medium_risk', 'Общая задача (средний риск)', 'electric', 'medium', true, 3, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]', 30),

('generic_high_risk', 'Общая задача (высокий риск)', 'electric', 'high', true, 4, false,
 '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места", "Качество соединений"]', 60)
ON CONFLICT (slug) DO NOTHING;

-- Проверяем, что типы задач добавлены
SELECT id, slug, display_name, risk_level, photo_min, allow_auto_accept FROM task_types WHERE is_active = true ORDER BY display_name;
