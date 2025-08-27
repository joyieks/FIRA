-- Supabase Tables for Project FIRA Migration
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'admin',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Station Users Table (already exists, but here for reference)
-- CREATE TABLE IF NOT EXISTS station_users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     station_name TEXT NOT NULL,
--     email TEXT UNIQUE NOT NULL,
--     address TEXT,
--     phone TEXT,
--     position TEXT,
--     role TEXT DEFAULT 'stationUser',
--     active BOOLEAN DEFAULT true,
--     status TEXT DEFAULT 'active',
--     is_online BOOLEAN DEFAULT false,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- 3. Citizen Users Table
CREATE TABLE IF NOT EXISTS citizen_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    phone_number TEXT,
    display_name TEXT,
    status TEXT DEFAULT 'active',
    reports INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Responder Users Table
CREATE TABLE IF NOT EXISTS responder_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    station_id UUID REFERENCES station_users(id),
    station_name TEXT,
    position TEXT,
    role TEXT DEFAULT 'responder',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_users ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (you can make these more restrictive later)
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on station_users" ON station_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on citizen_users" ON citizen_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on responder_users" ON responder_users FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_station_users_email ON station_users(email);
CREATE INDEX IF NOT EXISTS idx_citizen_users_email ON citizen_users(email);
CREATE INDEX IF NOT EXISTS idx_responder_users_email ON responder_users(email);
CREATE INDEX IF NOT EXISTS idx_responder_users_station_id ON responder_users(station_id);

-- Insert default admin user (optional)
-- INSERT INTO admin_users (email, first_name, last_name, role) 
-- VALUES ('admin@gmail.com', 'Admin', 'User', 'admin')
-- ON CONFLICT (email) DO NOTHING;
