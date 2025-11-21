-- Add password columns to user tables for password reset functionality
-- Run this in your Supabase SQL Editor

-- Add password column to station_users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'station_users' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE station_users ADD COLUMN password TEXT;
        RAISE NOTICE 'Added password column to station_users table';
    ELSE
        RAISE NOTICE 'password column already exists in station_users table';
    END IF;
END $$;

-- Add password column to admin_users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_users' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN password TEXT;
        RAISE NOTICE 'Added password column to admin_users table';
    ELSE
        RAISE NOTICE 'password column already exists in admin_users table';
    END IF;
END $$;

-- Add password column to citizen_users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'citizen_users' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE citizen_users ADD COLUMN password TEXT;
        RAISE NOTICE 'Added password column to citizen_users table';
    ELSE
        RAISE NOTICE 'password column already exists in citizen_users table';
    END IF;
END $$;

-- Add password column to responders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'responders' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE responders ADD COLUMN password TEXT;
        RAISE NOTICE 'Added password column to responders table';
    ELSE
        RAISE NOTICE 'password column already exists in responders table';
    END IF;
END $$;

-- Add password column to responder_users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'responder_users' 
        AND column_name = 'password'
    ) THEN
        ALTER TABLE responder_users ADD COLUMN password TEXT;
        RAISE NOTICE 'Added password column to responder_users table';
    ELSE
        RAISE NOTICE 'password column already exists in responder_users table';
    END IF;
END $$;

-- Display confirmation
SELECT 'Password columns added successfully!' as status;

-- Show which tables now have password columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE column_name = 'password'
AND table_name IN ('station_users', 'admin_users', 'citizen_users', 'responders', 'responder_users')
ORDER BY table_name;

