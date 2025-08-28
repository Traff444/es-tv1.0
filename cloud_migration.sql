-- ============================================
-- ElectroService Cloud Migration Script
-- ============================================

-- Drop existing tables if any (for clean setup)
DROP TABLE IF EXISTS public.task_checklist CASCADE;
DROP TABLE IF EXISTS public.task_photos CASCADE;
DROP TABLE IF EXISTS public.task_notifications CASCADE;
DROP TABLE IF EXISTS public.task_materials CASCADE;
DROP TABLE IF EXISTS public.material_usages CASCADE;
DROP TABLE IF EXISTS public.material_inventory CASCADE;
DROP TABLE IF EXISTS public.material_supplier_prices CASCADE;
DROP TABLE IF EXISTS public.user_reliability_scores CASCADE;
DROP TABLE IF EXISTS public.user_tariffs CASCADE;
DROP TABLE IF EXISTS public.work_sessions CASCADE;
DROP TABLE IF EXISTS public.role_change_logs CASCADE;
DROP TABLE IF EXISTS public.telegram_users CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.task_types CASCADE;
DROP TABLE IF EXISTS public.tariff_types CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.material_categories CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.edge_function_calls CASCADE;

-- Drop custom types if exist
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.task_priority CASCADE;
DROP TYPE IF EXISTS public.task_status CASCADE;
DROP TYPE IF EXISTS public.photo_type CASCADE;
DROP TYPE IF EXISTS public.risk_level CASCADE;
DROP TYPE IF EXISTS public.tariff_type CASCADE;

-- ============================================
-- CREATE CUSTOM TYPES
-- ============================================

CREATE TYPE public.user_role AS ENUM ('worker', 'manager', 'director', 'admin', 'inactive');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'paused', 'awaiting_approval', 'awaiting_photos', 'returned');
CREATE TYPE public.photo_type AS ENUM ('before', 'after');
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.tariff_type AS ENUM ('weekday', 'weekend', 'holiday');

-- ============================================
-- MAIN TABLES
-- ============================================

-- Users table
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.user_role DEFAULT 'worker'::public.user_role,
    hourly_rate NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    passport_series TEXT,
    passport_number TEXT,
    passport_issue_date DATE,
    passport_issued_by TEXT
);

-- Telegram users mapping
CREATE TABLE public.telegram_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL UNIQUE,
    telegram_username TEXT,
    chat_id BIGINT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Task types dictionary
CREATE TABLE public.task_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    service_domain TEXT DEFAULT 'electric',
    risk_level public.risk_level DEFAULT 'low'::public.risk_level,
    requires_before_photos BOOLEAN DEFAULT false,
    photo_min INTEGER DEFAULT 2,
    allow_auto_accept BOOLEAN DEFAULT true,
    default_checklist JSONB,
    default_norm_minutes INTEGER DEFAULT 15,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority public.task_priority DEFAULT 'medium'::public.task_priority,
    status public.task_status DEFAULT 'pending'::public.task_status,
    assigned_to UUID REFERENCES public.users(id),
    created_by UUID REFERENCES public.users(id),
    estimated_hours NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    start_location TEXT,
    end_location TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    target_location TEXT,
    paused_at TIMESTAMP WITH TIME ZONE,
    total_pause_duration INTEGER DEFAULT 0,
    task_type_id UUID REFERENCES public.task_types(id),
    requires_before_override BOOLEAN,
    photo_min_override INTEGER,
    checklist_override JSONB,
    risk_override public.risk_level,
    effective_norm_minutes INTEGER,
    effective_checklist_version INTEGER,
    effective_photo_min INTEGER,
    effective_requires_before BOOLEAN,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.users(id),
    approval_comment TEXT,
    returned_for_revision_at TIMESTAMP WITH TIME ZONE,
    revision_comment TEXT
);

-- Task photos
CREATE TABLE public.task_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type public.photo_type NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_synced BOOLEAN DEFAULT false,
    local_path TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Task checklist
CREATE TABLE public.task_checklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    checklist_item TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    is_synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Work sessions
CREATE TABLE public.work_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_location TEXT,
    end_location TEXT,
    total_hours NUMERIC,
    earnings NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tariff types
CREATE TABLE public.tariff_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type public.tariff_type NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User tariffs
CREATE TABLE public.user_tariffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tariff_type_id UUID NOT NULL REFERENCES public.tariff_types(id),
    rate_per_minute NUMERIC(10,4) DEFAULT 0,
    currency TEXT DEFAULT 'BYN',
    is_active BOOLEAN DEFAULT true,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holidays
CREATE TABLE public.holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Material categories
CREATE TABLE public.material_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Materials
CREATE TABLE public.materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT DEFAULT 'шт',
    cost_per_unit NUMERIC(10,2) DEFAULT 0,
    stock_quantity NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    category_id UUID REFERENCES public.material_categories(id),
    min_stock_quantity NUMERIC(10,2) DEFAULT 0,
    default_unit TEXT DEFAULT 'шт'
);

-- Suppliers
CREATE TABLE public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Warehouses
CREATE TABLE public.warehouses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Task materials
CREATE TABLE public.task_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity_needed NUMERIC(10,2) DEFAULT 0,
    quantity_used NUMERIC(10,2) DEFAULT 0
);

-- Material inventory
CREATE TABLE public.material_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    warehouse_id UUID REFERENCES public.warehouses(id),
    task_id UUID REFERENCES public.tasks(id),
    quantity NUMERIC(10,2) DEFAULT 0,
    location_type TEXT DEFAULT 'warehouse',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT
);

-- Material usages
CREATE TABLE public.material_usages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    quantity_used NUMERIC(10,2) NOT NULL,
    used_by UUID NOT NULL REFERENCES public.users(id),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Material supplier prices
CREATE TABLE public.material_supplier_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID NOT NULL REFERENCES public.materials(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    price NUMERIC(10,2) NOT NULL,
    unit TEXT DEFAULT 'шт',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT
);

-- User reliability scores
CREATE TABLE public.user_reliability_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    score NUMERIC(3,2) DEFAULT 1.0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_returned INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Task notifications
CREATE TABLE public.task_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id),
    manager_id UUID REFERENCES public.users(id),
    worker_id UUID REFERENCES public.users(id),
    telegram_message_id BIGINT,
    notification_type TEXT DEFAULT 'task_completion',
    status TEXT DEFAULT 'sent',
    manager_response TEXT,
    response_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    responded_at TIMESTAMP WITH TIME ZONE
);

-- Role change logs
CREATE TABLE public.role_change_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Edge function calls log
CREATE TABLE public.edge_function_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    function_name TEXT NOT NULL,
    payload JSONB,
    response JSONB,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_supplier_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reliability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_calls ENABLE ROW LEVEL SECURITY;

-- Basic read policies (allow all authenticated users to read)
CREATE POLICY "Allow read access" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.telegram_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.task_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.task_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.task_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.work_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.tariff_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.user_tariffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.task_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.material_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.material_usages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.material_supplier_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.user_reliability_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.task_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.role_change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON public.edge_function_calls FOR SELECT TO authenticated USING (true);

-- Write policies (allow authenticated users to write)
CREATE POLICY "Allow write access" ON public.users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.telegram_users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.task_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.task_photos FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.task_checklist FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.work_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.tariff_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.user_tariffs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.holidays FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.material_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.materials FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.warehouses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.task_materials FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.material_inventory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.material_usages FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.material_supplier_prices FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.user_reliability_scores FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.task_notifications FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.role_change_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow write access" ON public.edge_function_calls FOR ALL TO authenticated USING (true);

-- Allow anonymous access for Telegram authentication
CREATE POLICY "Allow anonymous read for telegram auth" ON public.telegram_users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read for users" ON public.users FOR SELECT TO anon USING (true);

-- ============================================
-- STORAGE SETUP
-- ============================================

-- Create storage bucket for task photos
INSERT INTO storage.buckets (id, name, public) VALUES ('task-photos', 'task-photos', true);

-- Storage policies
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING (bucket_id = 'task-photos');
CREATE POLICY "Allow authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-photos');
CREATE POLICY "Allow authenticated update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task-photos');
CREATE POLICY "Allow authenticated delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-photos');

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert test users
INSERT INTO public.users (id, email, full_name, role) VALUES
  ('74dbb0fc-4b22-4872-b6b6-a997c1df51a2', 'admin@test.com', 'Admin User', 'admin'),
  ('691071a2-69a5-453a-b77b-5bc05e2c715f', 'manager@test.com', 'Manager User', 'manager'),
  ('547e08f9-7e7d-4693-a064-c71300db3496', 'worker@test.com', 'Worker User', 'worker'),
  ('5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08', 'test.worker@electroservice.by', 'Тестовый Рабочий (Telegram ID: 481890)', 'worker'),
  ('c1042fdf-dc8f-4cee-84d5-d0162136a035', 'baltiktreyd@gmail.com', 'Рабочий тест', 'worker');

-- Insert telegram user mapping
INSERT INTO public.telegram_users (id, user_id, telegram_id, telegram_username, chat_id, first_name, last_name) VALUES
  ('f1dc1c24-eaf9-4808-9d6f-5c1073939d7f', '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08', 481890, 'traf4444', 481890, 'Rss', '');

-- Insert some task types
INSERT INTO public.task_types (slug, display_name, service_domain, risk_level, requires_before_photos, photo_min, allow_auto_accept, default_checklist, default_norm_minutes) VALUES
  ('electric-install', 'Электромонтаж', 'electric', 'medium', true, 2, false, '["Проверить инструменты", "Отключить питание", "Проверить напряжение"]', 60),
  ('electric-repair', 'Ремонт электрики', 'electric', 'high', true, 3, false, '["Диагностика", "Отключить питание", "Замена компонентов", "Тестирование"]', 45),
  ('maintenance', 'Техническое обслуживание', 'electric', 'low', false, 2, true, '["Визуальный осмотр", "Проверка соединений"]', 30);

-- Insert tariff types
INSERT INTO public.tariff_types (name, type, description) VALUES
  ('Будни', 'weekday', 'Тариф для рабочих дней'),
  ('Выходные', 'weekend', 'Тариф для выходных дней'),
  ('Праздники', 'holiday', 'Тариф для праздничных дней');

COMMIT;
