-- ===================================
-- QUICK FIX FOR PASSWORD RESET
-- Copy and paste this entire script into Supabase SQL Editor
-- ===================================

-- 1. Create or update password_reset_codes table
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  user_table TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_table column if it doesn't exist
ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS user_table TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);

-- Enable RLS and create policy
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can manage password reset codes" ON password_reset_codes;
CREATE POLICY "Anyone can manage password reset codes" ON password_reset_codes FOR ALL USING (true) WITH CHECK (true);

-- 2. Add password columns to all user tables
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE citizen_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE responders ADD COLUMN IF NOT EXISTS password TEXT;

-- 3. Verify setup
SELECT '✅ Password reset setup complete!' as status;

