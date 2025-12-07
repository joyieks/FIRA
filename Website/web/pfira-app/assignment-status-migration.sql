-- Migration: Add assignment status to report_assignments table
-- This allows tracking of pending, accepted, and declined assignments

-- Add status column to report_assignments
ALTER TABLE report_assignments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted' 
CHECK (status IN ('pending', 'accepted', 'declined'));

-- Add assignment_source column to track if assignment was manual (admin) or automatic
ALTER TABLE report_assignments 
ADD COLUMN IF NOT EXISTS assignment_source TEXT DEFAULT 'manual' 
CHECK (assignment_source IN ('manual', 'automatic'));

-- Add note column if it doesn't exist (for assignment notes)
ALTER TABLE report_assignments 
ADD COLUMN IF NOT EXISTS note TEXT;

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_report_assignments_status ON report_assignments(status);
CREATE INDEX IF NOT EXISTS idx_report_assignments_status_assignee ON report_assignments(status, assignee_type, assignee_id);

-- Update existing assignments to have 'accepted' status (backward compatibility)
UPDATE report_assignments 
SET status = 'accepted' 
WHERE status IS NULL;


