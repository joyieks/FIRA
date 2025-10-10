# 🚀 Quick Setup Card

## 📍 **Essential Steps (Copy-Paste Ready):**

### **1. Go to Google Cloud Console**
```
https://console.cloud.google.com/
```

### **2. Select Project**
- Click dropdown at top-left
- Select: `project-fira-9b6d9`

### **3. Add Redirect URI**
- Go to: **APIs & Services > Credentials**
- Click edit icon next to OAuth 2.0 Client ID
- In "Authorized redirect URIs" click "ADD URI"
- Add exactly: `https://auth.expo.io/@anonymous/fira-mobile`
- Click "SAVE"

### **4. Enable APIs**
- Go to: **APIs & Services > Library**
- Search and enable:
  - "Google Identity API"
  - "Google+ API" (if available)

### **5. Configure OAuth Consent**
- Go to: **APIs & Services > OAuth consent screen**
- Fill in:
  - App name: "Project FIRA"
  - User support email: [your email]
  - Developer contact: [your email]
- Click "SAVE AND CONTINUE"

---

## ⏰ **Timeline:**
1. **Setup**: 5-10 minutes
2. **Wait for changes**: 5-10 minutes
3. **Test**: Try Google Sign-In in your app

---

## ✅ **Success Check:**
- No more "redirect_uri_mismatch" error
- Google Sign-In opens browser
- Can sign in with real Google account

---

## 🆘 **If Stuck:**
- Take screenshot of where you're stuck
- Tell me exactly what you see
- I'll guide you through it!

**The key is adding that redirect URI correctly!** 🔑 