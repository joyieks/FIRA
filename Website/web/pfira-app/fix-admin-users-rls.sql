-- Fix RLS policies for admin_users table to allow notification system to work
-- Run this in your Supabase SQL Editor

-- First, let's see what policies currently exist
-- SELECT * FROM pg_policies WHERE tablename = 'admin_users';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin Policies" ON admin_users;
DROP POLICY IF EXISTS "Allow anonymous read access to admin_users" ON admin_users;

-- Create a new policy that allows:
-- 1. Admin users to access their own records
-- 2. System/service role to read all admin users (for notifications)
-- 3. Authenticated users to read admin users (for notification system)

-- Policy 1: Admin users can access their own records
CREATE POLICY "Admin users can access own records" ON admin_users
  FOR ALL USING (
    auth.email() = email AND 
    role = 'admin' AND 
    status = 'active'
  );

-- Policy 2: Allow authenticated users to read admin users (for notification system)
-- This is needed for the notification creation process
CREATE POLICY "Allow authenticated users to read admin users for notifications" ON admin_users
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    status = 'active' AND
    role = 'admin'
  );

-- Policy 3: Allow service role to do everything (for system operations)
CREATE POLICY "Service role full access" ON admin_users
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- Alternative: If the above doesn't work, you can temporarily use this more permissive policy
-- Uncomment the lines below if the notification system still doesn't work:

-- DROP POLICY IF EXISTS "Allow authenticated users to read admin users for notifications" ON admin_users;
-- CREATE POLICY "Allow all authenticated users to read admin users" ON admin_users
--   FOR SELECT USING (auth.role() = 'authenticated');

-- Or even more permissive for development (NOT recommended for production):
-- DROP POLICY IF EXISTS "Allow all authenticated users to read admin users" ON admin_users;
-- CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'admin_users';
