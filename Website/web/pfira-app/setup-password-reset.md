# Quick Setup for Password Reset Feature

## ⚡ Quick Start

### Step 1: Run SQL Migration
Copy and paste this SQL into your Supabase SQL Editor (https://app.supabase.com/project/YOUR_PROJECT/sql):

```sql
-- Create password_reset_codes table for storing verification codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to manage password reset codes
CREATE POLICY "Anyone can manage password reset codes" ON password_reset_codes
  FOR ALL USING (true) WITH CHECK (true);
```

### Step 2: Verify EmailJS is Working
The system is already configured to use:
- Service ID: `service_5k3e6xe`
- Template ID: `template_x9i685u`
- Public Key: `N_WM9SM_s6cRQPVgT`

Make sure this template exists in your EmailJS dashboard and is published.

### Step 3: Test the Feature
1. Go to http://localhost:5173/forgot-password
2. Enter a valid email from your database
3. Check your email for the 6-digit code
4. Enter the code and reset your password

## ✅ What Changed

### Before:
- ❌ Hardcoded test code: `123456`
- ❌ Alert message: "For testing purposes, the code is: 123456"
- ❌ No actual email sent

### After:
- ✅ Random 6-digit code generated for each request
- ✅ Code sent via email using EmailJS
- ✅ Code stored in database with 10-minute expiration
- ✅ Proper verification against database
- ✅ Secure password update
- ✅ Resend code functionality

## 🔍 How to Verify It's Working

1. **Check Database**: After requesting a code, verify it's stored:
   ```sql
   SELECT * FROM password_reset_codes WHERE email = 'your@email.com';
   ```

2. **Check Email**: You should receive an email with a 6-digit code

3. **Check Expiration**: Codes expire after 10 minutes

4. **Check Deletion**: After successful password reset, the code is deleted:
   ```sql
   -- This should return no rows after reset
   SELECT * FROM password_reset_codes WHERE email = 'your@email.com';
   ```

## 🐛 Troubleshooting

### "No account found with this email address"
- Make sure the email exists in your `users` table
- Check spelling and case sensitivity

### "Email not received"
- Check spam/junk folder
- Verify EmailJS service is active in dashboard
- Check EmailJS logs for delivery status

### "Invalid verification code"
- Code may have expired (10 minutes)
- Check if you typed it correctly
- Try clicking "Resend" for a new code

### "Failed to update password"
- Check Supabase logs for errors
- Verify RLS policies are set correctly
- Make sure password meets requirements (8+ characters)

## 📝 Notes

- Codes expire after 10 minutes for security
- Each code can only be used once
- Old codes are automatically replaced when requesting a new one
- The system checks if the user exists before sending emails

