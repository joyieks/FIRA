# 🔧 Password Reset Fix - Complete Solution

## Problem Identified
The password reset was failing with "Failed to update password" because:
1. The system was only checking the `users` table, but your account is in `station_users`
2. The `station_users` table (and other user tables) didn't have a `password` column

## ✅ What Was Fixed

### 1. Multi-Table User Lookup
The system now checks ALL user tables:
- ✅ `admin_users`
- ✅ `station_users` 
- ✅ `citizen_users`
- ✅ `responders`

### 2. Password Storage
Added support for storing passwords in user tables (for users without Supabase Auth accounts)

### 3. Error Handling
Improved error messages and fallback mechanisms

## 🚀 Setup Instructions

### Step 1: Add Password Columns to Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Add password columns to all user tables
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE citizen_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE responders ADD COLUMN IF NOT EXISTS password TEXT;
```

**OR** run the complete script:
```bash
# In Supabase SQL Editor, run:
Website/web/pfira-app/add-password-columns.sql
```

### Step 2: Update password_reset_codes Table

Run this SQL to add the `user_table` column:

```sql
-- Add user_table column if it doesn't exist
ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS user_table TEXT;
```

**OR** run the update script:
```bash
# In Supabase SQL Editor, run:
Website/web/pfira-app/update-password-reset-table.sql
```

### Step 3: Test the Password Reset

1. Go to `/forgot-password`
2. Enter your email: `ditocod705@okcdeals.com`
3. Check your email for the 6-digit code
4. Enter the code
5. Set your new password: `balamban12`
6. Click "Reset Password"
7. ✅ Success! You should see "Password Updated!"

## 📋 Complete SQL Setup (All-in-One)

If you want to run everything at once, copy and paste this into your Supabase SQL Editor:

```sql
-- ===================================
-- COMPLETE PASSWORD RESET SETUP
-- ===================================

-- 1. Create password_reset_codes table
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  user_table TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 2. Add user_table column if table already exists
ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS user_table TEXT;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- 4. Enable RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
DROP POLICY IF EXISTS "Anyone can manage password reset codes" ON password_reset_codes;
CREATE POLICY "Anyone can manage password reset codes" ON password_reset_codes
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Add password columns to all user tables
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE citizen_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE responders ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE responder_users ADD COLUMN IF NOT EXISTS password TEXT;

-- 7. Verify setup
SELECT 'Setup complete!' as status;

-- Show password_reset_codes table structure
SELECT 'password_reset_codes table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'password_reset_codes'
ORDER BY ordinal_position;

-- Show which tables have password columns
SELECT 'Tables with password columns:' as info;
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'password'
AND table_name IN ('station_users', 'admin_users', 'citizen_users', 'responders', 'responder_users')
ORDER BY table_name;
```

## 🔍 How It Works Now

### Step 1: Enter Email
- System checks **all user tables** (admin_users, station_users, citizen_users, responders)
- If found, generates a random 6-digit code
- Stores code in database with user's table name
- Sends email with code via EmailJS

### Step 2: Verify Code
- User enters 6-digit code from email
- System verifies code against database
- Checks if code has expired (10 minutes)

### Step 3: Reset Password
- System retrieves which table the user belongs to
- Updates password in that specific table
- Deletes used verification code
- Shows success message

## 🐛 Troubleshooting

### Error: "No account found with this email address"
**Solution:** Make sure your email exists in one of these tables:
```sql
-- Check all tables
SELECT 'admin_users' as table_name, email FROM admin_users WHERE email = 'your@email.com'
UNION ALL
SELECT 'station_users', email FROM station_users WHERE email = 'your@email.com'
UNION ALL
SELECT 'citizen_users', email FROM citizen_users WHERE email = 'your@email.com'
UNION ALL
SELECT 'responders', email FROM responders WHERE email = 'your@email.com';
```

### Error: "Failed to update password"
**Solution:** Run the SQL scripts to add password columns:
```sql
ALTER TABLE station_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE citizen_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE responders ADD COLUMN IF NOT EXISTS password TEXT;
```

### Email not received
**Solution:**
1. Check spam/junk folder
2. Verify EmailJS service is active
3. Check EmailJS dashboard for delivery logs

### Code expired
**Solution:**
- Codes expire after 10 minutes
- Click "Resend" to get a new code

## 📝 Testing Checklist

- [ ] Run all SQL scripts in Supabase
- [ ] Verify password columns exist in all user tables
- [ ] Test with station user email (ditocod705@okcdeals.com)
- [ ] Receive email with 6-digit code
- [ ] Enter code successfully
- [ ] Reset password successfully
- [ ] Login with new password

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ Email is sent with 6-digit code (not "123456")
2. ✅ Code verification works
3. ✅ Password update succeeds (no "Failed to update password" error)
4. ✅ You can login with the new password

## 📧 Support

If you still have issues:
1. Check browser console for error messages
2. Check Supabase logs in dashboard
3. Verify all SQL scripts ran successfully
4. Make sure EmailJS service is active

---

**Status**: ✅ Fix Complete - Ready to Test
**Date**: November 21, 2025

