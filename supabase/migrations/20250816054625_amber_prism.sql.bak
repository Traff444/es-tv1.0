/*
  # Создание системы управления материалами

  1. Новые таблицы
    - `material_categories` - категории материалов с цветовой кодировкой
    - `warehouses` - склады с адресами и контактами  
    - `suppliers` - поставщики с контактной информацией
    - `material_inventory` - инвентаризация материалов по складам и объектам
    - `material_supplier_prices` - цены от разных поставщиков

  2. Изменения существующих таблиц
    - Добавление `category_id` и `min_stock_quantity` в таблицу `materials`
    - Удаление `stock_quantity` из таблицы `materials` (заменено на `material_inventory`)

  3. Безопасность
    - Включение RLS для всех новых таблиц
    - Добавление политик доступа для разных ролей пользователей

  4. Миграция данных
    - Создание базовых категорий материалов
    - Создание основного склада
    - Перенос существующих остатков материалов в новую систему инвентаризации
*/

-- Создание таблицы категорий материалов
CREATE TABLE IF NOT EXISTS material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Добавление новых полей в таблицу materials
DO $$
BEGIN
  -- Добавляем category_id если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE materials ADD COLUMN category_id uuid;
  END IF;

  -- Добавляем min_stock_quantity если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'min_stock_quantity'
  ) THEN
    ALTER TABLE materials ADD COLUMN min_stock_quantity numeric(10,2) DEFAULT 0;
  END IF;

  -- Добавляем default_unit если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'default_unit'
  ) THEN
    ALTER TABLE materials ADD COLUMN default_unit text DEFAULT 'шт';
  END IF;
END $$;

-- Создание внешнего ключа для категорий
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'materials_category_id_fkey'
  ) THEN
    ALTER TABLE materials 
    ADD CONSTRAINT materials_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Создание таблицы инвентаризации материалов
CREATE TABLE IF NOT EXISTS material_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  location_type text NOT NULL CHECK (location_type IN ('warehouse', 'on_site')),
  last_updated timestamptz DEFAULT now(),
  notes text,
  CONSTRAINT check_location_reference CHECK (
    (location_type = 'warehouse' AND warehouse_id IS NOT NULL AND task_id IS NULL) OR
    (location_type = 'on_site' AND task_id IS NOT NULL AND warehouse_id IS NULL)
  )
);

ALTER TABLE material_inventory ENABLE ROW LEVEL SECURITY;

-- Создание таблицы цен поставщиков
CREATE TABLE IF NOT EXISTS material_supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  unit text NOT NULL,
  last_updated timestamptz DEFAULT now(),
  notes text,
  UNIQUE(material_id, supplier_id)
);

ALTER TABLE material_supplier_prices ENABLE ROW LEVEL SECURITY;

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS material_inventory_material_id_idx ON material_inventory(material_id);
CREATE INDEX IF NOT EXISTS material_inventory_warehouse_id_idx ON material_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS material_inventory_task_id_idx ON material_inventory(task_id);
CREATE INDEX IF NOT EXISTS material_inventory_location_type_idx ON material_inventory(location_type);
CREATE INDEX IF NOT EXISTS material_supplier_prices_material_id_idx ON material_supplier_prices(material_id);
CREATE INDEX IF NOT EXISTS material_supplier_prices_supplier_id_idx ON material_supplier_prices(supplier_id);

-- Создание триггеров для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_material_categories_updated_at') THEN
    CREATE TRIGGER update_material_categories_updated_at
      BEFORE UPDATE ON material_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_warehouses_updated_at') THEN
    CREATE TRIGGER update_warehouses_updated_at
      BEFORE UPDATE ON warehouses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_suppliers_updated_at') THEN
    CREATE TRIGGER update_suppliers_updated_at
      BEFORE UPDATE ON suppliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Политики безопасности для material_categories
CREATE POLICY "Все могут читать категории материалов"
  ON material_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять категориями материалов"
  ON material_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики безопасности для warehouses
CREATE POLICY "Все могут читать склады"
  ON warehouses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять складами"
  ON warehouses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики безопасности для suppliers
CREATE POLICY "Все могут читать поставщиков"
  ON suppliers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять поставщиками"
  ON suppliers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики безопасности для material_inventory
CREATE POLICY "Все могут читать инвентаризацию материалов"
  ON material_inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять инвентаризацией материалов"
  ON material_inventory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Политики безопасности для material_supplier_prices
CREATE POLICY "Все могут читать цены поставщиков"
  ON material_supplier_prices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Менеджеры могут управлять ценами поставщиков"
  ON material_supplier_prices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('manager', 'director', 'admin')
    )
  );

-- Создание базовых данных
INSERT INTO material_categories (name, description, color) VALUES
  ('Кабели и провода', 'Силовые и сигнальные кабели', '#3B82F6'),
  ('Розетки и выключатели', 'Электроустановочные изделия', '#10B981'),
  ('Автоматы и УЗО', 'Защитная аппаратура', '#F59E0B'),
  ('Светильники', 'Осветительное оборудование', '#8B5CF6'),
  ('Крепеж', 'Дюбели, саморезы, хомуты', '#6B7280'),
  ('Инструменты', 'Ручной и электроинструмент', '#EF4444')
ON CONFLICT DO NOTHING;

-- Создание основного склада
INSERT INTO warehouses (name, address, contact_person) VALUES
  ('Основной склад', 'г. Москва, ул. Складская, 1', 'Иванов И.И.')
ON CONFLICT DO NOTHING;

-- Миграция существующих материалов в новую систему инвентаризации
DO $$
DECLARE
  warehouse_id uuid;
  material_record RECORD;
BEGIN
  -- Получаем ID основного склада
  SELECT id INTO warehouse_id FROM warehouses WHERE name = 'Основной склад' LIMIT 1;
  
  -- Переносим остатки материалов в новую систему
  IF warehouse_id IS NOT NULL THEN
    FOR material_record IN 
      SELECT id, stock_quantity FROM materials WHERE stock_quantity > 0
    LOOP
      INSERT INTO material_inventory (material_id, warehouse_id, quantity, location_type)
      VALUES (material_record.id, warehouse_id, material_record.stock_quantity, 'warehouse')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Обновление единиц измерения для существующих материалов
UPDATE materials SET default_unit = unit WHERE unit IS NOT NULL AND default_unit IS NULL;

-- Удаление старого поля stock_quantity (после миграции данных)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'stock_quantity'
  ) THEN
    ALTER TABLE materials DROP COLUMN stock_quantity;
  END IF;
END $$;