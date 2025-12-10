-- Fix Row Level Security policies for admin_users table
-- Run this in your Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow public insert access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow public update access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow public delete access to admin_users" ON admin_users;

-- Enable RLS on admin_users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policies that allow public access (since you're using custom authentication)
CREATE POLICY "Allow public read access to admin_users"
ON admin_users FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert access to admin_users"
ON admin_users FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update access to admin_users"
ON admin_users FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access to admin_users"
ON admin_users FOR DELETE
TO public
USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'admin_users';

