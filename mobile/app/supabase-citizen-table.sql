-- Create Citizen Users Table for Mobile App Registration
-- Run this in your Supabase SQL Editor

-- Create citizen_users table if it doesn't exist
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
    is_verified BOOLEAN DEFAULT false,
    google_sign_in BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE citizen_users ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for development
CREATE POLICY "Allow all operations on citizen_users" ON citizen_users FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_citizen_users_email ON citizen_users(email);
CREATE INDEX IF NOT EXISTS idx_citizen_users_status ON citizen_users(status);
CREATE INDEX IF NOT EXISTS idx_citizen_users_created_at ON citizen_users(created_at);

-- Table is ready for citizen registrations from mobile app
