-- ===================================
-- SECURE PASSWORD RESET SETUP
-- No passwords stored in user tables!
-- ===================================

-- 1. Create password_reset_codes table (for verification codes)
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  user_table TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_table column if it doesn't exist
ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS user_table TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Anyone can manage password reset codes" ON password_reset_codes;
CREATE POLICY "Anyone can manage password reset codes" ON password_reset_codes
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Create pending_password_resets table (temporary storage for Edge Function)
CREATE TABLE IF NOT EXISTS pending_password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  new_password_hash TEXT NOT NULL,
  user_table TEXT NOT NULL,
  user_id UUID,
  verification_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_password_resets_email ON pending_password_resets(email);
CREATE INDEX IF NOT EXISTS idx_pending_password_resets_expires_at ON pending_password_resets(expires_at);

-- Enable RLS
ALTER TABLE pending_password_resets ENABLE ROW LEVEL SECURITY;

-- Create policies (only Edge Functions can access)
DROP POLICY IF EXISTS "Service role can manage pending resets" ON pending_password_resets;
CREATE POLICY "Service role can manage pending resets" ON pending_password_resets
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Create function to clean up expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_password_resets()
RETURNS void AS $$
BEGIN
  -- Delete expired verification codes
  DELETE FROM password_reset_codes WHERE expires_at < NOW();
  
  -- Delete expired pending resets
  DELETE FROM pending_password_resets WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Verify setup
SELECT '✅ Secure password reset setup complete!' as status;

-- Show table structures
SELECT 'password_reset_codes table:' as info;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'password_reset_codes'
ORDER BY ordinal_position;

SELECT 'pending_password_resets table:' as info;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pending_password_resets'
ORDER BY ordinal_position;

-- Important: Make sure NO password columns exist in user tables
SELECT '⚠️ Checking for insecure password columns in user tables...' as warning;
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'password'
AND table_name IN ('station_users', 'admin_users', 'citizen_users', 'responders', 'responder_users');

-- If any results show up above, DROP those columns:
-- ALTER TABLE station_users DROP COLUMN IF EXISTS password;
-- ALTER TABLE admin_users DROP COLUMN IF EXISTS password;
-- ALTER TABLE citizen_users DROP COLUMN IF EXISTS password;
-- ALTER TABLE responders DROP COLUMN IF EXISTS password;

