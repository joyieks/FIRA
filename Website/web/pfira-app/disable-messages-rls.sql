-- Temporarily disable RLS on messages table for testing
-- Run this in your Supabase SQL Editor

-- Disable RLS on messages table
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'messages';

-- This should show rowsecurity = false
