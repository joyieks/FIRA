-- Optional: Add barangay and contact_number columns to responders table
-- Only run this if you want to store these fields in the database
-- Run this in your Supabase SQL Editor

-- Add barangay column (optional)
ALTER TABLE responders 
ADD COLUMN IF NOT EXISTS barangay TEXT;

-- Add contact_number column (optional)
-- Note: The responders table already has a 'phone' column
-- This is only if you want a separate contact_number field
ALTER TABLE responders 
ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'responders'
AND column_name IN ('barangay', 'contact_number', 'phone')
ORDER BY column_name;

