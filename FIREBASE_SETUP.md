# Firebase Setup Guide

## 🔧 Fixing "Missing or insufficient permissions" Error

The error you're encountering is due to Firestore security rules being set to the default restrictive mode. Follow these steps to fix it:

### Step 1: Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Initialize Firebase in your project (if not already done)
```bash
firebase init
```
- Select Firestore and Storage
- Use existing project: `project-fira-9b6d9`

### Step 4: Deploy Security Rules
```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules
```

**Note**: Firebase Storage requires a billing plan upgrade. For now, file uploads store metadata only.

### Step 5: Verify Deployment
After deployment, your registration should work without permission errors.

## 📋 Security Rules Overview

### Firestore Rules (`firestore.rules`)
- ✅ Users can read/write their own data
- ✅ Users can create their own user document during registration
- ✅ Admins can read all user data
- ✅ Emergency reports can be created by authenticated users
- ✅ Notifications are user-specific with admin access

### Storage Rules (`storage.rules`)
- ⚠️ **Storage requires billing plan upgrade**
- ✅ File metadata is stored in Firestore
- ✅ Files are stored locally until Storage is upgraded

## 🚀 Alternative: Manual Setup in Firebase Console

If you prefer to set up rules manually:

### Firestore Rules
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `project-fira-9b6d9`
3. Go to Firestore Database → Rules
4. Replace the rules with the content from `firestore.rules`
5. Click "Publish"

### Storage Rules
**Note**: Firebase Storage requires a billing plan upgrade. File uploads currently store metadata only.

## 🔍 Testing

After deploying the rules:
1. Try registering a new user with a different email
2. Check that the user data is stored in Firestore
3. Verify file metadata is stored (actual files are stored locally)

## 📞 Support

If you still encounter issues after deploying the rules, check:
- Firebase Console for any deployment errors
- Browser console for detailed error messages
- Ensure you're using the correct Firebase project ID

---

**Note**: These rules provide a good balance between security and functionality. For production, you may want to add additional validation and security measures based on your specific requirements. 