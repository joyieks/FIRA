-- Create password_reset_codes table for storing verification codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  user_table TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert/update their own reset codes
CREATE POLICY "Anyone can create password reset codes" ON password_reset_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update their own password reset codes" ON password_reset_codes
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can read their own password reset codes" ON password_reset_codes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can delete their own password reset codes" ON password_reset_codes
  FOR DELETE USING (true);

-- Create function to automatically delete expired codes
CREATE OR REPLACE FUNCTION delete_expired_password_reset_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired codes (run every hour)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- You can also manually run this function periodically or trigger it on each verification attempt

