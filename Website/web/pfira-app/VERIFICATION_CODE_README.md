# 🔐 FIRA Verification Code System

This system provides a complete verification code solution for the FIRA mobile app, including both the mobile UI component and EmailJS email template.

## 📱 Mobile Component: `verificationCode.jsx`

### **Features:**
- ✅ **6-digit OTP input** with auto-focus
- ✅ **15-minute countdown timer** for code expiration
- ✅ **Resend functionality** with cooldown
- ✅ **EmailJS integration** for sending verification codes
- ✅ **Responsive design** with FIRA branding
- ✅ **Loading states** and error handling

### **Usage:**
```javascript
import VerificationCode from './Authentication/verificationCode';

// The component handles:
// - OTP input and validation
// - Timer countdown
// - EmailJS code sending
// - Navigation after verification
```

### **EmailJS Configuration:**
```javascript
const serviceId = 'service_717ciwa';
const templateId = 'template_iefgxnk';
const publicKey = 'hDU2Ar_g1pr7Cpg-S';
```

## 📧 EmailJS Template: `verification-code-template.html`

### **Template Variables:**
- `{{to_name}}` - Recipient's name
- `{{passcode}}` - 6-digit verification code
- `{{time}}` - Expiration time (15 minutes from sending)

### **Features:**
- ✅ **Professional design** with FIRA branding
- ✅ **Responsive layout** for mobile and desktop
- ✅ **Security warnings** and instructions
- ✅ **Call-to-action button**
- ✅ **Company branding** and footer

## 🚀 Setup Instructions

### **1. EmailJS Template Setup:**
1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Create new template or edit existing `template_iefgxnk`
3. Copy the HTML from `verification-code-template.html`
4. Replace the content in your EmailJS template
5. Save and publish the template

### **2. Mobile Component Integration:**
1. Ensure `@emailjs/browser` is installed:
   ```bash
   npm install @emailjs/browser
   ```

2. Import and use the component in your navigation:
   ```javascript
   import VerificationCode from './Authentication/verificationCode';
   ```

3. The component automatically:
   - Initializes EmailJS
   - Handles OTP input
   - Manages countdown timer
   - Sends verification codes
   - Handles verification flow

## 🔧 Customization

### **Timer Duration:**
```javascript
const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
// Change 900 to adjust duration (in seconds)
```

### **OTP Length:**
```javascript
const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6 digits
// Modify array length for different OTP sizes
```

### **EmailJS Parameters:**
```javascript
const templateParams = {
  passcode: Math.random().toString().slice(2, 8), // 6-digit code
  time: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString(),
  user_email: 'user@example.com' // Get from auth context
};
```

## 📋 EmailJS Template Variables

### **Required Variables:**
- `{{passcode}}` - The 6-digit verification code
- `{{time}}` - Expiration time (15 minutes from sending)

### **Optional Variables:**
- `{{to_name}}` - Recipient's name (can be hardcoded)
- `{{user_email}}` - User's email address

## 🎨 Styling Customization

### **Colors:**
- **Primary:** `#dc2626` (FIRA Red)
- **Secondary:** `#b91c1c` (Dark Red)
- **Background:** `#fef2f2` (Light Red)
- **Text:** `#1f2937` (Dark Gray)

### **Fonts:**
- **System fonts** for cross-platform compatibility
- **Monospace** for OTP code display
- **Responsive sizing** for mobile optimization

## 🔒 Security Features

### **Built-in Security:**
- ✅ **15-minute expiration** for codes
- ✅ **Resend cooldown** to prevent spam
- ✅ **Input validation** and sanitization
- ✅ **Security warnings** in emails
- ✅ **Phishing protection** messaging

### **Best Practices:**
- Never store OTP codes in plain text
- Implement rate limiting on resend
- Log verification attempts
- Use HTTPS for all communications

## 🧪 Testing

### **Test the Mobile Component:**
1. Navigate to the verification screen
2. Enter a 6-digit code
3. Test the verify button
4. Test the resend functionality
5. Verify timer countdown

### **Test the Email Template:**
1. Send a test verification code
2. Check email rendering on different devices
3. Verify all template variables are populated
4. Test responsive design

## 📱 Mobile App Integration

### **Navigation Flow:**
```
Registration → Verification Code → Login → Dashboard
```

### **State Management:**
- OTP input state
- Timer countdown
- Loading states
- Error handling
- Success navigation

## 🎯 Next Steps

### **Backend Integration:**
1. **API endpoint** for OTP verification
2. **Database storage** for OTP codes
3. **Rate limiting** for security
4. **Audit logging** for compliance

### **Enhanced Features:**
1. **SMS fallback** for email delivery issues
2. **Biometric verification** options
3. **Multi-factor authentication** support
4. **Account recovery** procedures

## 📞 Support

For issues or questions:
- Check EmailJS dashboard for delivery status
- Verify template ID and service configuration
- Test with console logging enabled
- Check mobile app console for errors

---

**🎉 Your verification code system is ready to use!** 

The mobile component will automatically send verification codes via EmailJS, and users will receive beautifully formatted emails with their OTP codes.

