-- Ensure admin_users table exists and has data
-- Run this in your Supabase SQL Editor

-- Create admin_users table if it doesn't exist
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

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for development
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);

-- Insert admin user if it doesn't exist
INSERT INTO admin_users (email, first_name, last_name, role) 
VALUES ('admin@gmail.com', 'Command', 'Center', 'admin')
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Also insert the fallback admin that the chat expects
INSERT INTO admin_users (id, email, first_name, last_name, role) 
VALUES ('6cac74e9-cfcf-43cd-9bcf-a30c6b67596d', 'admin@fira.com', 'Command', 'Center', 'admin')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Verify the admin users exist
SELECT 'Admin users in database:' as info;
SELECT id, email, first_name, last_name, role FROM admin_users;
