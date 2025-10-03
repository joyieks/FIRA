-- Setup Admin Users for Notifications
-- Run this in your Supabase SQL Editor

-- 1. Ensure admin_users table exists
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

-- 2. Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;

-- 4. Create permissive policy for development
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);

-- 5. Insert default admin user (if not exists)
INSERT INTO admin_users (email, first_name, last_name, role) 
VALUES ('admin@gmail.com', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    active = true,
    status = 'active',
    updated_at = NOW();

-- 6. Verify admin users exist
SELECT 
    '✅ Admin users in database:' as status,
    COUNT(*) as total_admins
FROM admin_users;

-- 7. Show all admin users
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    role,
    active,
    created_at
FROM admin_users
ORDER BY created_at DESC;

