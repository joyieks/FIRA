-- Messages Table for Project FIRA Chat System
-- Run this SQL command in your Supabase SQL Editor

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'station', 'responder', 'citizen')),
    receiver_type TEXT NOT NULL CHECK (receiver_type IN ('admin', 'station', 'responder', 'citizen')),
    text TEXT,
    image_url TEXT,
    is_emergency BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_type ON messages(receiver_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (you can make these more restrictive later)
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample messages for testing (optional)
-- INSERT INTO messages (sender_id, receiver_id, sender_type, receiver_type, text, is_emergency) 
-- VALUES 
--     ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', 'station', 'Hello, how are you today?', false),
--     ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'station', 'admin', 'We are doing well, thank you!', false);

