-- Unified Notifications Table for Project FIRA
-- Run this COMPLETE SQL in your Supabase SQL Editor

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'station', 'responder', 'citizen')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fire_alert', 'assignment', 'system', 'user_action', 'emergency', 'info')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  related_report_id TEXT,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies (permissive for development)
CREATE POLICY "Allow all operations on notifications" 
ON notifications 
FOR ALL 
USING (true);

-- Alternative: More restrictive policies (uncomment if you want better security)
-- Users can only see their own notifications
-- CREATE POLICY "Users can view their own notifications" 
-- ON notifications 
-- FOR SELECT 
-- USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
-- CREATE POLICY "Users can update their own notifications" 
-- ON notifications 
-- FOR UPDATE 
-- USING (user_id = auth.uid());

-- Admin can create any notifications
-- CREATE POLICY "Admin can create notifications" 
-- ON notifications 
-- FOR INSERT 
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM admin_users WHERE id = auth.uid()
--   )
-- );

-- 5. Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for auto-updating updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- 7. Create function to clean up old read notifications (optional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications 
  WHERE is_read = true 
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 8. Verify the table was created successfully
SELECT 'Notifications table created successfully!' as status;

-- 9. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 10. Sample notification (optional - for testing)
-- Uncomment to insert a test notification
-- INSERT INTO notifications (user_id, user_type, title, message, type, priority)
-- VALUES (
--   'your-user-id-here',
--   'admin',
--   'System Test',
--   'This is a test notification to verify the system is working.',
--   'system',
--   'normal'
-- );

