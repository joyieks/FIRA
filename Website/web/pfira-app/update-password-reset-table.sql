-- Update password_reset_codes table to add user_table column
-- This script is safe to run even if the table already exists

-- Add user_table column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'password_reset_codes' 
        AND column_name = 'user_table'
    ) THEN
        ALTER TABLE password_reset_codes ADD COLUMN user_table TEXT;
        RAISE NOTICE 'Added user_table column to password_reset_codes table';
    ELSE
        RAISE NOTICE 'user_table column already exists in password_reset_codes table';
    END IF;
END $$;

-- Update existing records to have a default user_table value (optional)
-- This is only needed if you have existing records
UPDATE password_reset_codes 
SET user_table = 'users' 
WHERE user_table IS NULL;

-- Display current table structure
SELECT 'Current password_reset_codes table structure:' as info;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'password_reset_codes'
ORDER BY ordinal_position;

