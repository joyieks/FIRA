-- Migration: Add assignment_role column to report_assignments table
-- Purpose: Distinguish between primary station (can change status) and backup stations (support only)
-- Date: December 11, 2025

-- Add assignment_role column
ALTER TABLE report_assignments
ADD COLUMN IF NOT EXISTS assignment_role TEXT DEFAULT 'primary';

-- Add check constraint to ensure valid roles
ALTER TABLE report_assignmentspu
ADD CONSTRAINT check_assignment_role 
CHECK (assignment_role IN ('primary', 'backup'));

-- Create index for faster queries filtering by role
CREATE INDEX IF NOT EXISTS idx_report_assignments_role 
ON report_assignments(report_id, assignment_role);

-- Update existing records to be 'primary' (backward compatibility)
UPDATE report_assignments
SET assignment_role = 'primary'
WHERE assignment_role IS NULL;

-- Add comment
COMMENT ON COLUMN report_assignments.assignment_role IS 
'Role of assigned station: primary (can change status) or backup (support only for alarm level 2+)';

-- Verification query
-- SELECT report_id, assignee_id, assignee_type, assignment_role, status 
-- FROM report_assignments 
-- WHERE assignee_type = 'station' 
-- ORDER BY report_id, assignment_role;
