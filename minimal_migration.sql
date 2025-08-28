-- Minimal tables for Telegram Mini App testing

-- Custom types
CREATE TYPE user_role AS ENUM ('worker', 'manager', 'director', 'admin', 'inactive');

-- Users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role DEFAULT 'worker'::user_role,
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
CREATE TABLE telegram_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for authentication
CREATE POLICY "Allow anonymous read for users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read for telegram_users" ON telegram_users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated access for users" ON users FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access for telegram_users" ON telegram_users FOR ALL TO authenticated USING (true);

-- Insert test data
INSERT INTO users (id, email, full_name, role) VALUES
  ('5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08', 'test.worker@electroservice.by', 'Тестовый Рабочий (Telegram ID: 481890)', 'worker');

INSERT INTO telegram_users (id, user_id, telegram_id, telegram_username, chat_id, first_name, last_name) VALUES
  ('f1dc1c24-eaf9-4808-9d6f-5c1073939d7f', '5e1f3e82-c4b6-4a0f-adcc-3a4d32e37a08', 481890, 'traf4444', 481890, 'Rss', '');
