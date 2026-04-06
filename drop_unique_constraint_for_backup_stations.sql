-- Migration: Remove unique constraint that prevents multiple station assignments
-- Purpose: Allow backup stations to be assigned alongside primary station
-- Date: December 11, 2025
-- IMPORTANT: Run this in Supabase SQL Editor BEFORE assigning backup stations

-- First check what constraints exist
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'report_assignments'::regclass
ORDER BY conname;

-- Drop the unique constraint that prevents multiple stations per report
-- Try both possible names
ALTER TABLE report_assignments DROP CONSTRAINT IF EXISTS uniq_report_station_per_report CASCADE;
ALTER TABLE report_assignments DROP CONSTRAINT IF EXISTS report_assignments_uniq_report_station_per_report CASCADE;
ALTER TABLE report_assignments DROP CONSTRAINT IF EXISTS report_assignments_report_id_assignee_type_assignee_id_key CASCADE;

-- Also drop any unique index with similar name
DROP INDEX IF EXISTS uniq_report_station_per_report CASCADE;
DROP INDEX IF EXISTS report_assignments_uniq_report_station_per_report CASCADE;

-- Verify all constraints after dropping
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'report_assignments'::regclass
ORDER BY conname;

-- Note: We now rely on the application logic to prevent duplicate assignments
-- The assignment_role column distinguishes between 'primary' and 'backup' stations
