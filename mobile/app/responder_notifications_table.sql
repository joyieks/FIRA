-- Create responder_notifications table
CREATE TABLE IF NOT EXISTS responder_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  responder_id UUID NOT NULL REFERENCES responders(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES station_users(id) ON DELETE CASCADE,
  fire_report_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_responder_notifications_responder_id ON responder_notifications(responder_id);
CREATE INDEX IF NOT EXISTS idx_responder_notifications_station_id ON responder_notifications(station_id);
CREATE INDEX IF NOT EXISTS idx_responder_notifications_is_read ON responder_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_responder_notifications_created_at ON responder_notifications(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE responder_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- For development: Allow all operations (you can make these more restrictive later)
CREATE POLICY "Allow all operations on responder_notifications" ON responder_notifications
  FOR ALL USING (true);

-- Alternative: More restrictive policies (uncomment if you want to use these instead)
-- Responders can only see their own notifications
-- CREATE POLICY "Responders can view their own notifications" ON responder_notifications
--   FOR SELECT USING (responder_id = auth.uid());

-- Stations can insert notifications for their assigned responders
-- CREATE POLICY "Stations can create notifications for their responders" ON responder_notifications
--   FOR INSERT WITH CHECK (
--     station_id = auth.uid() OR
--     station_id IN (
--       SELECT id FROM station_users WHERE id = auth.uid()
--     )
--   );

-- Stations can update notifications they created
-- CREATE POLICY "Stations can update their notifications" ON responder_notifications
--   FOR UPDATE USING (
--     station_id = auth.uid() OR
--     station_id IN (
--       SELECT id FROM station_users WHERE id = auth.uid()
--     )
--   );

-- Responders can update their own notifications (mark as read)
-- CREATE POLICY "Responders can update their own notifications" ON responder_notifications
--   FOR UPDATE USING (responder_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_responder_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_responder_notifications_updated_at
  BEFORE UPDATE ON responder_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_responder_notifications_updated_at();
