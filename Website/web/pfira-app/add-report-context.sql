-- Adds contextual linking between chat messages and incident reports
-- Run in Supabase SQL editor

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS report_id UUID;

CREATE INDEX IF NOT EXISTS idx_messages_report_id ON messages(report_id);





