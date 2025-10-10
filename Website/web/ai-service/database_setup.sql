-- Database setup for FIRA AI Service
-- Run this in your Supabase SQL editor

-- Create system_status table for storing global system state
CREATE TABLE IF NOT EXISTS system_status (
    id TEXT PRIMARY KEY,
    current_level TEXT NOT NULL DEFAULT 'NONE',
    confidence DECIMAL(3,2) DEFAULT 0.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    triggered_by_message UUID REFERENCES messages(id),
    reasoning TEXT,
    keywords_found TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add AI analysis columns to existing messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS suggested_alarm_level TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster querying of unanalyzed messages
CREATE INDEX IF NOT EXISTS idx_messages_unanalyzed 
ON messages(created_at) 
WHERE ai_analysis IS NULL;

-- Create index for alarm level queries
CREATE INDEX IF NOT EXISTS idx_messages_alarm_level 
ON messages(suggested_alarm_level, created_at);

-- Insert initial system status
INSERT INTO system_status (id, current_level, confidence, reasoning)
VALUES ('fire_alarm_level', 'NONE', 0.0, 'System initialized')
ON CONFLICT (id) DO NOTHING;

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for system_status table
DROP TRIGGER IF EXISTS update_system_status_updated_at ON system_status;
CREATE TRIGGER update_system_status_updated_at
    BEFORE UPDATE ON system_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON system_status TO authenticated;

















