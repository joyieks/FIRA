-- Ensure station_users table exists and has data
-- Run this in your Supabase SQL Editor

-- Create station_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS station_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    station_name TEXT,
    address TEXT,
    phone TEXT,
    position TEXT,
    role TEXT DEFAULT 'stationUser',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE station_users ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for development
CREATE POLICY "Allow all operations on station_users" ON station_users FOR ALL USING (true);

-- Insert test station if it doesn't exist
INSERT INTO station_users (email, station_name, address, phone, position) 
VALUES ('stations@gmail.com', 'Central Fire Station', '123 Main Street, Cebu City', '+63 912 345 6789', 'Station Commander')
ON CONFLICT (email) DO UPDATE SET
    station_name = EXCLUDED.station_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    position = EXCLUDED.position,
    updated_at = NOW();

-- Insert another test station
INSERT INTO station_users (email, station_name, address, phone, position) 
VALUES ('station2@fira.com', 'North Fire Station', '456 North Avenue, Cebu City', '+63 912 345 6788', 'Station Commander')
ON CONFLICT (email) DO UPDATE SET
    station_name = EXCLUDED.station_name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    position = EXCLUDED.position,
    updated_at = NOW();

-- Verify the station users exist
SELECT 'Station users in database:' as info;
SELECT id, email, station_name, address FROM station_users;
