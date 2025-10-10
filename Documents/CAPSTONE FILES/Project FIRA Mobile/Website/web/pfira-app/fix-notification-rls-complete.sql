-- Complete RLS Fix for Notification System
-- Run this in your Supabase SQL Editor to fix the notification system

-- ===========================================
-- 1. FIX ADMIN_USERS TABLE RLS POLICIES
-- ===========================================

-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin Policies" ON admin_users;
DROP POLICY IF EXISTS "Allow anonymous read access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can access own records" ON admin_users;
DROP POLICY IF EXISTS "Allow authenticated users to read admin users for notifications" ON admin_users;
DROP POLICY IF EXISTS "Service role full access" ON admin_users;

-- Create new policies for admin_users
-- Policy 1: Allow authenticated users to read admin users (for notification system)
CREATE POLICY "Allow authenticated read access for notifications" ON admin_users
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    status = 'active' AND
    role = 'admin'
  );

-- Policy 2: Allow admin users to manage their own records
CREATE POLICY "Admin users can manage own records" ON admin_users
  FOR ALL USING (
    auth.email() = email AND 
    role = 'admin' AND 
    status = 'active'
  );

-- Policy 3: Allow service role full access (for system operations)
CREATE POLICY "Service role full access" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- 2. VERIFY NOTIFICATIONS TABLE POLICIES
-- ===========================================

-- Ensure notifications table has proper policies
-- (This should already exist, but let's make sure)
DROP POLICY IF EXISTS "Allow all operations on notifications" ON notifications;

-- Create permissive policy for notifications (needed for the system to work)
CREATE POLICY "Allow all operations on notifications" 
ON notifications FOR ALL USING (true);

-- ===========================================
-- 3. ADDITIONAL POLICIES FOR SYSTEM OPERATIONS
-- ===========================================

-- Allow the system to insert notifications for any user
CREATE POLICY "Allow system to create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Allow users to read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (
    user_id = auth.uid() OR 
    auth.role() = 'service_role'
  );

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    auth.role() = 'service_role'
  );

-- ===========================================
-- 4. VERIFY POLICIES ARE WORKING
-- ===========================================

-- Check admin_users policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;

-- Check notifications policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

-- ===========================================
-- 5. TEST QUERIES (Optional - for debugging)
-- ===========================================

-- Test if we can read admin users (this should work now)
-- SELECT COUNT(*) as admin_count FROM admin_users WHERE status = 'active' AND role = 'admin';

-- Test if we can read notifications (this should work)
-- SELECT COUNT(*) as notification_count FROM notifications;

-- ===========================================
-- 6. ALTERNATIVE: TEMPORARY DISABLE RLS (Development Only)
-- ===========================================

-- If the above policies still don't work, you can temporarily disable RLS
-- for development purposes (NOT recommended for production):

-- ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS later:
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
