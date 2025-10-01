-- Report Routes/Forwarding Table for FIRA
-- This table tracks when reports are forwarded/redirected between stations or agencies
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS report_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,
    target TEXT NOT NULL,  -- Format: 'station:<station_id>' or 'agency:police', etc.
    note TEXT,  -- Optional note explaining why the report was forwarded
    forwarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on report_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_report_routes_report_id ON report_routes(report_id);

-- Create index on target for station-specific queries
CREATE INDEX IF NOT EXISTS idx_report_routes_target ON report_routes(target);

-- Enable RLS (Row Level Security)
ALTER TABLE report_routes ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for development (allow all operations)
-- In production, you may want to restrict this
CREATE POLICY "Allow all operations on report_routes" 
ON report_routes 
FOR ALL 
USING (true);

-- Display confirmation
SELECT 'report_routes table created successfully!' as status;

-- Example of how data looks:
-- report_id: '123' (the Firebase report ID)
-- target: 'station:uuid-of-station' or 'agency:police'
-- note: 'Forwarding to nearest station with available units'
-- forwarded_at: '2025-10-01 10:30:00'

