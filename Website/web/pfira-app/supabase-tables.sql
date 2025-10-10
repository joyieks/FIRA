-- Supabase Tables for Project FIRA Migration
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'admin',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Station Users Table - linked to Supabase Auth
-- CREATE TABLE IF NOT EXISTS station_users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
--     station_name TEXT NOT NULL,
--     email TEXT UNIQUE NOT NULL,
--     address TEXT,
--     phone TEXT,
--     position TEXT,
--     role TEXT DEFAULT 'stationUser',
--     active BOOLEAN DEFAULT true,
--     status TEXT DEFAULT 'active',
--     is_online BOOLEAN DEFAULT false,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- 3. Citizen Users Table
CREATE TABLE IF NOT EXISTS citizen_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    phone_number TEXT,
    display_name TEXT,
    status TEXT DEFAULT 'active',
    reports INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Responder Users Table - linked to Supabase Auth
CREATE TABLE IF NOT EXISTS responder_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    station_id UUID REFERENCES station_users(id),
    station_name TEXT,
    position TEXT,
    role TEXT DEFAULT 'responder',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    is_online BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_users ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (you can make these more restrictive later)
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on station_users" ON station_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on citizen_users" ON citizen_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on responder_users" ON responder_users FOR ALL USING (true);

-- Add user_id columns to existing tables (for migration to Supabase Auth)
-- Note: user_id is nullable to allow for migration of existing records
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE responders ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add foreign key constraints with ON DELETE SET NULL
DO $$ 
BEGIN
    ALTER TABLE station_users DROP CONSTRAINT IF EXISTS station_users_user_id_fkey;
    ALTER TABLE responders DROP CONSTRAINT IF EXISTS responders_user_id_fkey;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE station_users 
ADD CONSTRAINT station_users_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE responders 
ADD CONSTRAINT responders_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_station_users_email ON station_users(email);
CREATE INDEX IF NOT EXISTS idx_station_users_user_id ON station_users(user_id);
CREATE INDEX IF NOT EXISTS idx_citizen_users_email ON citizen_users(email);
CREATE INDEX IF NOT EXISTS idx_responder_users_email ON responder_users(email);
CREATE INDEX IF NOT EXISTS idx_responder_users_station_id ON responder_users(station_id);
CREATE INDEX IF NOT EXISTS idx_responders_user_id ON responders(user_id);

-- Insert default admin user (optional)
-- INSERT INTO admin_users (email, first_name, last_name, role) 
-- VALUES ('admin@gmail.com', 'Admin', 'User', 'admin')
-- ON CONFLICT (email) DO NOTHING;

-- 5. Report Assignments Table
-- Tracks which station or responder is assigned to each fire report
CREATE TABLE IF NOT EXISTS report_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,  -- Firebase report ID
    assignee_type TEXT NOT NULL,  -- 'station' or 'responder'
    assignee_id UUID NOT NULL,  -- ID from station_users or responder_users
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Report Routes/Forwarding Table
-- Tracks when reports are forwarded/redirected between stations or agencies
CREATE TABLE IF NOT EXISTS report_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,  -- Firebase report ID
    target TEXT NOT NULL,  -- Format: 'station:<station_id>' or 'agency:police'
    note TEXT,  -- Optional note explaining why forwarded
    forwarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Assigned Report Snapshots Table
-- Stores a snapshot of report coordinates for reliable station dashboard rendering
CREATE TABLE IF NOT EXISTS assigned_report_snapshots (
    report_id TEXT PRIMARY KEY,  -- Firebase report ID
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    address TEXT,
    snapshot_json JSONB,  -- Full report data as backup
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE report_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_report_snapshots ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development
CREATE POLICY "Allow all operations on report_assignments" 
ON report_assignments FOR ALL USING (true);

CREATE POLICY "Allow all operations on report_routes" 
ON report_routes FOR ALL USING (true);

CREATE POLICY "Allow all operations on assigned_report_snapshots" 
ON assigned_report_snapshots FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_report_assignments_report_id ON report_assignments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_assignments_assignee ON report_assignments(assignee_type, assignee_id);
-- Ensure a report can have multiple responder assignments but at most one station assignment
DO $$
BEGIN
  -- Composite uniqueness to avoid duplicate identical assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_report_assignment_composite'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_report_assignment_composite ON report_assignments (report_id, assignee_type, assignee_id)';
  END IF;
  -- Partial unique index to allow only one station per report
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_report_station_per_report'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_report_station_per_report ON report_assignments (report_id) WHERE assignee_type = ''station''' ;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_report_routes_report_id ON report_routes(report_id);
CREATE INDEX IF NOT EXISTS idx_report_routes_target ON report_routes(target);
CREATE INDEX IF NOT EXISTS idx_assigned_report_snapshots_report_id ON assigned_report_snapshots(report_id);

-- 8. Unified Notifications Table
-- Handles notifications for all user types (admin, station, responder, citizen)
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

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for notifications
CREATE POLICY "Allow all operations on notifications" 
ON notifications FOR ALL USING (true);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Create function to auto-update notifications updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifications updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();