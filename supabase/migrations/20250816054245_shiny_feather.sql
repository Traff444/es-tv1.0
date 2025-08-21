/*
  # Расширение системы управления материалами

  1. Новые таблицы
    - `warehouses` - склады с адресами и контактами
    - `material_categories` - категории материалов
    - `suppliers` - поставщики материалов
    - `material_inventory` - инвентаризация материалов по складам и объектам
    - `material_supplier_prices` - цены материалов у поставщиков

  2. Изменения существующих таблиц
    - `materials` - добавлены категории, минимальные остатки, убран stock_quantity

  3. Безопасность
    - RLS политики для всех новых таблиц
    - Соответствующие права доступа по ролям
*/

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание таблицы категорий материалов
CREATE TABLE IF NOT EXISTS material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создание таблицы складов
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создание таблицы поставщиков
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Обновление таблицы материалов
DO $$
BEGIN
  -- Добавляем новые поля
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE materials ADD COLUMN category_id uuid REFERENCES material_categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'min_stock_quantity'
  ) THEN
    ALTER TABLE materials ADD COLUMN min_stock_quantity numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'default_unit'
  ) THEN
    ALTER TABLE materials ADD COLUMN default_unit text DEFAULT 'шт';
  END IF;

  -- Копируем данные из unit в default_unit если поле unit существует
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'unit'
  ) THEN
    UPDATE materials SET default_unit = unit WHERE default_unit IS NULL;
  END IF;
END $$;

-- Создание таблицы инвентаризации материалов
CREATE TABLE IF NOT EXISTS material_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  location_type text NOT NULL DEFAULT 'warehouse' CHECK (location_type IN ('warehouse', 'on_site')),
  last_updated timestamptz DEFAULT now(),
  notes text,
  CONSTRAINT inventory_location_check CHECK (
    (location_type = 'warehouse' AND warehouse_id IS NOT NULL AND task_id IS NULL) OR
    (location_type = 'on_site' AND task_id IS NOT NULL AND warehouse_id IS NULL)
  )
);

-- Создание таблицы цен поставщиков
CREATE TABLE IF NOT EXISTS material_supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'шт',
  last_updated timestamptz DEFAULT now(),
  notes text,
  UNIQUE(material_id, supplier_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS material_inventory_material_id_idx ON material_inventory(material_id);
CREATE INDEX IF NOT EXISTS material_inventory_warehouse_id_idx ON material_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS material_inventory_task_id_idx ON material_inventory(task_id);
CREATE INDEX IF NOT EXISTS material_inventory_location_type_idx ON material_inventory(location_type);
CREATE INDEX IF NOT EXISTS material_supplier_prices_material_id_idx ON material_supplier_prices(material_id);
CREATE INDEX IF NOT EXISTS material_supplier_prices_supplier_id_idx ON material_supplier_prices(supplier_id);
CREATE INDEX IF NOT EXISTS materials_category_id_idx ON materials(category_id);

-- Триггеры для обновления updated_at
DROP TRIGGER IF EXISTS update_material_categories_updated_at ON material_categories;
CREATE TRIGGER update_material_categories_updated_at
  BEFORE UPDATE ON material_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_warehouses_updated_at ON warehouses;
CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS политики для категорий материалов
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Все могут читать категории материалов" ON material_categories;
CREATE POLICY "Все могут читать категории материалов"
  ON material_categories
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Менеджеры могут управлять категориями материалов" ON material_categories;
CREATE POLICY "Менеджеры могут управлять категориями материалов"
  ON material_categories
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ));

-- RLS политики для складов
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Все могут читать склады" ON warehouses;
CREATE POLICY "Все могут читать склады"
  ON warehouses
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Менеджеры могут управлять складами" ON warehouses;
CREATE POLICY "Менеджеры могут управлять складами"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ));

-- RLS политики для поставщиков
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все могут читать поставщиков"
  ON suppliers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять поставщиками"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ));

-- RLS политики для инвентаризации материалов
ALTER TABLE material_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все могут читать инвентаризацию материалов"
  ON material_inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять инвентаризацией материалов"
  ON material_inventory
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ));

-- RLS политики для цен поставщиков
ALTER TABLE material_supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все могут читать цены поставщиков"
  ON material_supplier_prices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять ценами поставщиков"
  ON material_supplier_prices
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role])
  ));

-- Вставка базовых категорий материалов
INSERT INTO material_categories (name, description, color) VALUES
  ('Кабели и провода', 'Силовые и сигнальные кабели, провода', '#3B82F6'),
  ('Розетки и выключатели', 'Электроустановочные изделия', '#10B981'),
  ('Автоматы и УЗО', 'Защитная аппаратура', '#F59E0B'),
  ('Светильники', 'Осветительное оборудование', '#8B5CF6'),
  ('Крепеж', 'Дюбели, саморезы, хомуты', '#6B7280'),
  ('Инструменты', 'Электроинструменты и ручной инструмент', '#EF4444')
ON CONFLICT DO NOTHING;

-- Создание базового склада если его нет
INSERT INTO warehouses (name, address, contact_person) VALUES
  ('Основной склад', 'Адрес не указан', 'Не указан')
ON CONFLICT DO NOTHING;

-- Миграция существующих данных материалов в инвентаризацию
DO $$
DECLARE
  warehouse_id uuid;
  material_record RECORD;
BEGIN
  -- Получаем ID первого склада
  SELECT id INTO warehouse_id FROM warehouses LIMIT 1;
  
  IF warehouse_id IS NOT NULL THEN
    -- Переносим существующие остатки материалов в инвентаризацию
    FOR material_record IN 
      SELECT id, stock_quantity 
      FROM materials 
      WHERE stock_quantity IS NOT NULL AND stock_quantity > 0
    LOOP
      INSERT INTO material_inventory (material_id, warehouse_id, quantity, location_type)
      VALUES (material_record.id, warehouse_id, material_record.stock_quantity, 'warehouse')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;