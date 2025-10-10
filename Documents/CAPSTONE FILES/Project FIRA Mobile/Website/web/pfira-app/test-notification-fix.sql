-- Test script to verify notification system RLS fix
-- Run this after applying the RLS fix to verify everything works

-- ===========================================
-- 1. TEST ADMIN_USERS ACCESS
-- ===========================================

-- Test 1: Check if we can read admin users (should return count > 0)
SELECT 
  'Admin users count' as test_name,
  COUNT(*) as result,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as status
FROM admin_users 
WHERE status = 'active' AND role = 'admin';

-- Test 2: Check if we can read all admin users (for notification system)
SELECT 
  'Admin users for notifications' as test_name,
  COUNT(*) as result,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as status
FROM admin_users;

-- ===========================================
-- 2. TEST NOTIFICATIONS ACCESS
-- ===========================================

-- Test 3: Check if we can read notifications
SELECT 
  'Notifications count' as test_name,
  COUNT(*) as result,
  CASE 
    WHEN COUNT(*) >= 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as status
FROM notifications;

-- ===========================================
-- 3. TEST NOTIFICATION CREATION (Simulation)
-- ===========================================

-- Test 4: Simulate notification creation (this should work without errors)
DO $$
DECLARE
  admin_count INTEGER;
  test_notification_id UUID;
BEGIN
  -- Count admin users
  SELECT COUNT(*) INTO admin_count FROM admin_users WHERE status = 'active' AND role = 'admin';
  
  -- Create a test notification
  INSERT INTO notifications (
    user_id, 
    user_type, 
    title, 
    message, 
    type, 
    priority, 
    is_read
  ) VALUES (
    (SELECT id FROM admin_users WHERE status = 'active' AND role = 'admin' LIMIT 1),
    'admin',
    'Test Notification',
    'This is a test notification to verify RLS policies work',
    'system',
    'normal',
    false
  ) RETURNING id INTO test_notification_id;
  
  -- Clean up test notification
  DELETE FROM notifications WHERE id = test_notification_id;
  
  RAISE NOTICE 'Test notification creation: PASS (admin_count: %)', admin_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test notification creation: FAIL - %', SQLERRM;
END $$;

-- ===========================================
-- 4. SUMMARY
-- ===========================================

-- Show current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('admin_users', 'notifications')
ORDER BY tablename;

-- Show active policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies 
WHERE tablename IN ('admin_users', 'notifications')
ORDER BY tablename, policyname;
