-- Fix AI Analysis Schema for Project FIRA
-- Run this SQL in your Supabase SQL Editor to add missing AI analysis columns

-- Add AI analysis columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS ai_suggested_alarm JSONB,
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS suggested_alarm_level TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for AI analysis fields
CREATE INDEX IF NOT EXISTS idx_messages_ai_suggested_alarm ON messages USING GIN (ai_suggested_alarm);
CREATE INDEX IF NOT EXISTS idx_messages_suggested_alarm_level ON messages(suggested_alarm_level);
CREATE INDEX IF NOT EXISTS idx_messages_ai_confidence ON messages(ai_confidence);
CREATE INDEX IF NOT EXISTS idx_messages_analyzed_at ON messages(analyzed_at);

-- Create system_status table for global alarm level tracking
CREATE TABLE IF NOT EXISTS system_status (
    id TEXT PRIMARY KEY,
    current_level TEXT DEFAULT 'NONE',
    confidence FLOAT DEFAULT 0.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    triggered_by_message UUID REFERENCES messages(id),
    reasoning TEXT
);

-- Insert default system status
INSERT INTO system_status (id, current_level, confidence, reasoning) 
VALUES ('fire_alarm_level', 'NONE', 0.0, 'System initialized')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on system_status
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for system_status
CREATE POLICY "Allow all operations on system_status" ON system_status FOR ALL USING (true);

-- Add comment to explain the schema
COMMENT ON COLUMN messages.ai_suggested_alarm IS 'AI analysis result stored as JSON';
COMMENT ON COLUMN messages.ai_analysis IS 'Full AI analysis object';
COMMENT ON COLUMN messages.suggested_alarm_level IS 'Suggested fire alarm level (NONE, LOW, MEDIUM, HIGH, CRITICAL)';
COMMENT ON COLUMN messages.ai_confidence IS 'AI confidence score (0.0 to 1.0)';
COMMENT ON COLUMN messages.analyzed_at IS 'Timestamp when AI analysis was performed';


