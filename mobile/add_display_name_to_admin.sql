-- Add display_name column to admin_users table
-- Run this in your Supabase SQL Editor

ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
AND column_name = 'display_name';

-- Optional: Set default display_name from email for existing records
UPDATE admin_users 
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL AND email IS NOT NULL;

