# Firebase Functions Setup Guide

This directory contains Firebase Functions for the Project FIRA mobile app's password reset functionality using Nodemailer.

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Configure Email Settings
You need to set up your email credentials in Firebase Functions config:

```bash
# Set your Gmail credentials
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="your-app-password"
```

**Important**: Use an "App Password" from Gmail, not your regular password.

### 3. Enable Gmail App Password
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification if not already enabled
4. Generate an App Password for "Mail"
5. Use this App Password in the config above

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

## 📧 Email Configuration

The functions use Gmail SMTP by default. To use a different email service:

1. Update the `transporter` configuration in `index.js`
2. Set the appropriate environment variables

### Example for other services:
```javascript
// For Outlook/Hotmail
const transporter = nodemailer.createTransporter({
  service: 'outlook',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.pass
  }
});

// For custom SMTP
const transporter = nodemailer.createTransporter({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.pass
  }
});
```

## 🔧 Available Functions

### 1. `sendVerificationCode`
- **Purpose**: Sends a 6-digit verification code to user's email
- **Parameters**: `{ email }`
- **Returns**: Success message

### 2. `verifyCodeAndResetPassword`
- **Purpose**: Verifies code and updates user's password
- **Parameters**: `{ email, code, newPassword }`
- **Returns**: Success message

### 3. `cleanupExpiredCodes`
- **Purpose**: Automatically cleans up expired verification codes
- **Schedule**: Runs every hour
- **No parameters required**

## 📱 Mobile App Integration

The mobile app calls these functions using Firebase Functions SDK:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

// Send verification code
const sendCode = httpsCallable(functions, 'sendVerificationCode');
const result = await sendCode({ email: 'user@example.com' });

// Reset password
const resetPassword = httpsCallable(functions, 'verifyCodeAndResetPassword');
const result = await resetPassword({
  email: 'user@example.com',
  code: '123456',
  newPassword: 'newpassword123'
});
```

## 🔒 Security Features

- ✅ 6-digit verification codes
- ✅ 1-minute expiration time
- ✅ Automatic cleanup of expired codes
- ✅ Email validation
- ✅ Firebase Auth integration
- ✅ Secure password updates

## 🎨 Email Template

The email includes:
- Project FIRA branding
- Professional HTML template
- Clear verification code display
- Security warnings
- Expiration information

## 🐛 Troubleshooting

### Common Issues:

1. **Email not sending**
   - Check Gmail App Password is correct
   - Verify 2-Step Verification is enabled
   - Check Firebase Functions logs

2. **Functions not deploying**
   - Ensure you're in the functions directory
   - Check Node.js version (requires 18+)
   - Verify Firebase CLI is installed

3. **Mobile app can't call functions**
   - Ensure functions are deployed
   - Check Firebase project configuration
   - Verify internet connection

### View Logs:
```bash
firebase functions:log
```

## 📞 Support

For issues with:
- **Firebase Functions**: Check Firebase Console
- **Email delivery**: Check Gmail settings
- **Mobile integration**: Check Firebase project configuration
