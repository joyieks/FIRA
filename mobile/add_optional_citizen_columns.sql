-- Optional: Add extra columns to citizen_users table
-- Only run this if you want to store these fields in the database
-- Run this in your Supabase SQL Editor

-- Note: The citizen_users table already has 'phone_number' in the schema definition,
-- but if it's missing, you can add it:
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add address column (optional)
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add barangay column (optional)
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS barangay TEXT;

-- Add birthdate column (optional)
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS birthdate TEXT;

-- Add gender column (optional)
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'citizen_users'
AND column_name IN ('phone_number', 'address', 'barangay', 'birthdate', 'gender')
ORDER BY column_name;

