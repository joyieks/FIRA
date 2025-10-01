-- Fix for station_users foreign key constraint issue
-- Run this in your Supabase SQL Editor

-- First, drop the existing foreign key constraint if it exists
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    ALTER TABLE station_users DROP CONSTRAINT IF EXISTS station_users_user_id_fkey;
EXCEPTION
    WHEN undefined_object THEN 
        NULL;
END $$;

-- Make sure the user_id column exists and is nullable
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add the foreign key constraint with ON DELETE SET NULL
-- This allows the station record to remain even if the auth user is deleted
ALTER TABLE station_users 
ADD CONSTRAINT station_users_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Do the same for responders table
DO $$ 
BEGIN
    ALTER TABLE responders DROP CONSTRAINT IF EXISTS responders_user_id_fkey;
EXCEPTION
    WHEN undefined_object THEN 
        NULL;
END $$;

ALTER TABLE responders ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE responders 
ADD CONSTRAINT responders_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_station_users_user_id ON station_users(user_id);
CREATE INDEX IF NOT EXISTS idx_responders_user_id ON responders(user_id);
