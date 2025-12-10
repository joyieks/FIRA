-- Add missing columns to responder_notifications table
-- Run this in your Supabase SQL Editor

-- Add status column if it doesn't exist
ALTER TABLE responder_notifications 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'accepted', 'declined', 'completed'));

-- Add accepted_at column if it doesn't exist
ALTER TABLE responder_notifications 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Create index on status column for better performance
CREATE INDEX IF NOT EXISTS idx_responder_notifications_status 
ON responder_notifications(status);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'responder_notifications'
AND column_name IN ('status', 'accepted_at')
ORDER BY column_name;

