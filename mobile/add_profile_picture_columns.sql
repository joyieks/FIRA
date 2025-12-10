-- Add profile_picture_url column to all user tables
-- Run this in your Supabase SQL Editor

-- Add profile_picture_url column to responders table
ALTER TABLE responders 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to citizen_users table
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to station_users table
ALTER TABLE station_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create indexes for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_responders_profile_picture_url 
ON responders(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_citizen_users_profile_picture_url 
ON citizen_users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_station_users_profile_picture_url 
ON station_users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_profile_picture_url 
ON admin_users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

