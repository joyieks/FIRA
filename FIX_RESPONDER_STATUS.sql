-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- This adds the missing columns needed for "I Acknowledge" to work
-- =====================================================

-- Add status column (tracks if pending/accepted/declined)
ALTER TABLE responder_notifications 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'accepted', 'declined', 'completed'));

-- Add accepted_at column (tracks when responder clicked "I Acknowledge")
ALTER TABLE responder_notifications 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_responder_notifications_status 
ON responder_notifications(status);

-- Set existing rows to 'pending' status if they're NULL
UPDATE responder_notifications 
SET status = 'pending' 
WHERE status IS NULL;

-- Done! Now "I Acknowledge" will change PENDING to ASSIGNMENT ACCEPTED

