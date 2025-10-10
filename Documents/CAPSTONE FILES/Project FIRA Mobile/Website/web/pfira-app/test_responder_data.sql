-- Test Responder Data for Project FIRA
-- Run this SQL command in your Supabase SQL Editor

-- First, let's see what responders already exist
SELECT 'Existing responders:' as info;
SELECT id, first_name, last_name, email, station_id FROM responders;

-- Insert a test responder for testing notifications
-- Note: In a real system, responders would be created through the station user management
INSERT INTO responders (
  id,
  first_name,
  last_name,
  email,
  phone,
  station_id,
  user_position,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Kenji',
  'Parilla',
  'kenji.parilla@fira.com',
  '+63 912 345 6789',
  (SELECT id FROM station_users LIMIT 1), -- Get the first station as default
  'Firefighter',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  user_position = EXCLUDED.user_position,
  updated_at = NOW();

-- Also create a responder with the old email for backward compatibility
INSERT INTO responders (
  id,
  first_name,
  last_name,
  email,
  phone,
  station_id,
  user_position,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Test',
  'Responder',
  'responder@gmail.com',
  '+63 999 888 7777',
  (SELECT id FROM station_users LIMIT 1),
  'Firefighter',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  user_position = EXCLUDED.user_position,
  updated_at = NOW();

-- Verify the responders were created
SELECT 'Created responders:' as info;
SELECT id, first_name, last_name, email, station_id FROM responders 
WHERE email IN ('kenji.parilla@fira.com', 'responder@gmail.com');
