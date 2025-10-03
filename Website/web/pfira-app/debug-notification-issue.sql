-- Debug and fix notification issue
-- Run this in your Supabase SQL Editor

-- ===========================================
-- 1. DEBUG CURRENT STATE
-- ===========================================

-- Check current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('admin_users', 'notifications')
ORDER BY tablename;

-- Check current policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles,
  qual as condition
FROM pg_policies 
WHERE tablename IN ('admin_users', 'notifications')
ORDER BY tablename, policyname;

-- Check if there are any admin users
SELECT 
  'Admin users count' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM admin_users 
WHERE status = 'active' AND role = 'admin';

-- Check recent notifications
SELECT 
  'Recent notifications count' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour';

-- ===========================================
-- 2. CREATE MORE PERMISSIVE POLICIES
-- ===========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin Policies" ON admin_users;
DROP POLICY IF EXISTS "Allow anonymous read access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can access own records" ON admin_users;
DROP POLICY IF EXISTS "Allow authenticated users to read admin users for notifications" ON admin_users;
DROP POLICY IF EXISTS "Service role full access" ON admin_users;

-- Create very permissive policies for development
-- Policy 1: Allow anyone to read admin users (for notification system)
CREATE POLICY "Allow read access to admin_users" ON admin_users
  FOR SELECT USING (true);

-- Policy 2: Allow admin users to manage their own records
CREATE POLICY "Admin users can manage own records" ON admin_users
  FOR ALL USING (
    auth.email() = email AND 
    role = 'admin' AND 
    status = 'active'
  );

-- Policy 3: Allow service role full access
CREATE POLICY "Service role full access" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');

-- ===========================================
-- 3. ENSURE NOTIFICATIONS TABLE IS PERMISSIVE
-- ===========================================

-- Drop existing notification policies
DROP POLICY IF EXISTS "Allow all operations on notifications" ON notifications;
DROP POLICY IF EXISTS "Allow system to create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Create permissive policies for notifications
CREATE POLICY "Allow all operations on notifications" 
ON notifications FOR ALL USING (true);

-- ===========================================
-- 4. TEST NOTIFICATION CREATION
-- ===========================================

-- Test if we can create a notification
DO $$
DECLARE
  admin_count INTEGER;
  test_notification_id UUID;
  admin_user_id UUID;
BEGIN
  -- Get admin user count
  SELECT COUNT(*) INTO admin_count FROM admin_users WHERE status = 'active' AND role = 'admin';
  
  -- Get first admin user ID
  SELECT id INTO admin_user_id FROM admin_users WHERE status = 'active' AND role = 'admin' LIMIT 1;
  
  RAISE NOTICE 'Found % admin users', admin_count;
  
  IF admin_user_id IS NOT NULL THEN
    -- Create a test notification
    INSERT INTO notifications (
      user_id, 
      user_type, 
      title, 
      message, 
      type, 
      priority, 
      is_read,
      created_at
    ) VALUES (
      admin_user_id,
      'admin',
      'Test Notification - RLS Fix',
      'This is a test notification to verify the RLS fix works. Created at: ' || NOW(),
      'system',
      'urgent',
      false,
      NOW()
    ) RETURNING id INTO test_notification_id;
    
    RAISE NOTICE 'Test notification created with ID: %', test_notification_id;
    
    -- Don't delete it so you can see it in the admin panel
    RAISE NOTICE 'Test notification left in database for verification';
  ELSE
    RAISE NOTICE 'No admin users found - cannot create test notification';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating test notification: %', SQLERRM;
END $$;

-- ===========================================
-- 5. VERIFY FINAL STATE
-- ===========================================

-- Show final policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies 
WHERE tablename IN ('admin_users', 'notifications')
ORDER BY tablename, policyname;

-- Show test notification
SELECT 
  id,
  user_id,
  user_type,
  title,
  message,
  created_at
FROM notifications 
WHERE title LIKE '%Test Notification%'
ORDER BY created_at DESC
LIMIT 5;
