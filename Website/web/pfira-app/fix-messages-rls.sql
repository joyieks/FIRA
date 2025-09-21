-- Fix RLS Policy for Messages Table
-- Run this in your Supabase SQL Editor

-- First, let's check if RLS is enabled and what policies exist
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'messages';

-- Check existing policies on messages table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';

-- Drop any existing policies on messages table (to start fresh)
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;

-- Disable RLS temporarily to ensure we can insert data
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create a new permissive policy that allows all operations
CREATE POLICY "Allow all operations on messages" ON messages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';

-- Test insert to make sure it works
-- (This will be commented out, but you can uncomment to test)
/*
INSERT INTO messages (sender_id, receiver_id, sender_type, receiver_type, text, is_emergency, is_read) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'station', 'station', 'Test message', false, false);
*/
