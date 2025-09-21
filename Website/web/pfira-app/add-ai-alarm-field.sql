-- Add AI Suggested Alarm Level field to messages table
-- Run this SQL command in your Supabase SQL Editor

-- Add the AI suggested alarm level field to the messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS ai_suggested_alarm TEXT;

-- Add an index for better performance when querying by AI suggested alarm
CREATE INDEX IF NOT EXISTS idx_messages_ai_suggested_alarm ON messages(ai_suggested_alarm);

-- Update the comment to document the new field
COMMENT ON COLUMN messages.ai_suggested_alarm IS 'AI-suggested fire alarm level based on message content analysis';

