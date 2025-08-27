-- Add Admin User to Supabase
-- Run this in your Supabase SQL Editor

-- First, make sure the admin_users table exists
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

-- Create policy
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);

-- Insert admin user
INSERT INTO admin_users (email, first_name, last_name, role) 
VALUES ('admin@gmail.com', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Verify the admin user was added
SELECT * FROM admin_users WHERE email = 'admin@gmail.com';
