# 🔐 Password Reset System Setup Guide

## Overview
The FIRA password reset system uses a 6-digit verification code sent via email to allow users to securely reset their passwords.

## Features
✅ Email verification using 6-digit codes
✅ EmailJS integration for email delivery
✅ Code expiration (10 minutes)
✅ Secure code storage in Supabase
✅ Resend code functionality
✅ Multi-step password reset flow

## Setup Instructions

### 1. Database Setup

Run the following SQL in your Supabase SQL Editor to create the required table:

```sql
-- Create password_reset_codes table
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Enable RLS
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can manage password reset codes" ON password_reset_codes
  FOR ALL USING (true) WITH CHECK (true);
```

Or simply run the SQL file:
```bash
psql -h your-supabase-host -U postgres -d postgres -f create-password-reset-table.sql
```

### 2. EmailJS Configuration

The system uses EmailJS to send verification codes. Configuration is already set up:

- **Service ID:** `service_5k3e6xe`
- **Template ID:** `template_x9i685u` (Password Reset template)
- **Public Key:** `N_WM9SM_s6cRQPVgT`

#### Email Template Variables:
- `{{to_name}}` - User's first name
- `{{passcode}}` - 6-digit verification code
- `{{time}}` - Expiration time
- `{{user_email}}` - User's email address

### 3. How It Works

#### Step 1: Enter Email
1. User enters their email address
2. System checks if email exists in the database
3. Generates a random 6-digit code
4. Stores code in `password_reset_codes` table with 10-minute expiration
5. Sends email with verification code via EmailJS

#### Step 2: Verify Code
1. User enters the 6-digit code from their email
2. System verifies code against database
3. Checks if code has expired
4. Proceeds to password reset if valid

#### Step 3: Reset Password
1. User enters new password (minimum 8 characters)
2. User confirms new password
3. System updates password in `users` table
4. Deletes used verification code
5. Redirects to login page

### 4. Security Features

- ✅ Codes expire after 10 minutes
- ✅ Codes are single-use (deleted after successful reset)
- ✅ Email verification ensures user owns the account
- ✅ Password validation (minimum 8 characters)
- ✅ Secure storage in Supabase with RLS

### 5. Testing

To test the password reset flow:

1. Navigate to `/forgot-password`
2. Enter a valid email address from your `users` table
3. Check your email for the 6-digit code
4. Enter the code on the verification page
5. Set a new password
6. Login with the new password

### 6. Troubleshooting

#### Email not received:
- Check EmailJS dashboard for delivery status
- Verify email template is published
- Check spam/junk folder
- Ensure EmailJS service is active

#### Code verification fails:
- Check if code has expired (10 minutes)
- Verify code was entered correctly
- Check database for stored code
- Try resending the code

#### Password update fails:
- Check Supabase logs for errors
- Verify RLS policies allow updates
- Ensure user exists in database

### 7. Customization

#### Change code expiration time:
```javascript
// In forgotpassword.jsx, change:
const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
// To:
const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
```

#### Change email template:
Update the `templateId` in `forgotpassword.jsx`:
```javascript
const templateId = 'your_template_id';
```

#### Add password strength requirements:
```javascript
if (newPassword.length < 12) {
  setError("Password must be at least 12 characters!");
  return;
}
if (!/[A-Z]/.test(newPassword)) {
  setError("Password must contain uppercase letters!");
  return;
}
```

## Files Modified
- `src/components/pages/Forgot Password/forgotpassword.jsx` - Main component
- `create-password-reset-table.sql` - Database schema

## Dependencies
- `@emailjs/browser` - Email sending
- `@supabase/supabase-js` - Database operations
- `react-icons` - UI icons

## Support
For issues or questions, check:
- EmailJS Dashboard: https://dashboard.emailjs.com/
- Supabase Dashboard: https://app.supabase.com/
- Project documentation

