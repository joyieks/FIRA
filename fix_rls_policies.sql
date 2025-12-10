-- Check current RLS policies on fire_reports table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'fire_reports';

-- If RLS is too restrictive, you may need to update policies to allow updates
-- Run this to allow authenticated users to update validation fields:

-- Drop existing restrictive policy if needed (check output above first)
-- DROP POLICY IF EXISTS "restrictive_policy_name" ON fire_reports;

-- Create or replace policy to allow updates on validation fields
CREATE POLICY IF NOT EXISTS "Allow validation updates"
ON fire_reports
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Alternatively, temporarily disable RLS for testing (NOT recommended for production)
-- ALTER TABLE fire_reports DISABLE ROW LEVEL SECURITY;
