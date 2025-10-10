-- Temporarily disable RLS for testing
ALTER TABLE station_users DISABLE ROW LEVEL SECURITY;

-- Check if RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'station_users';
