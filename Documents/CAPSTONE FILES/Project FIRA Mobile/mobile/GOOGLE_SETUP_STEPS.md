# 🔧 Google Cloud Console Setup Guide

## 🚨 **Current Issue:**
The `redirect_uri_mismatch` error means Google Cloud Console isn't configured properly.

## ✅ **Step-by-Step Fix:**

### **Step 1: Go to Google Cloud Console**
1. Open your browser
2. Go to: https://console.cloud.google.com/
3. Sign in with your Google account

### **Step 2: Select Your Project**
1. At the top of the page, click the project dropdown
2. Select: `project-fira-9b6d9`
3. If you don't see it, make sure you're signed in with the correct account

### **Step 3: Configure OAuth Credentials**
1. In the left menu, click **"APIs & Services"**
2. Click **"Credentials"**
3. Find your OAuth 2.0 Client ID (it should be there)
4. Click on the **pencil/edit icon** next to it

### **Step 4: Add Redirect URI**
1. In the **"Authorized redirect URIs"** section
2. Click **"ADD URI"**
3. Add this exact URL: `https://auth.expo.io/@anonymous/fira-mobile`
4. Click **"SAVE"**

### **Step 5: Enable Required APIs**
1. Go back to **"APIs & Services"**
2. Click **"Library"**
3. Search for and enable these APIs:
   - **Google+ API**
   - **Google Identity API**

### **Step 6: Configure OAuth Consent Screen**
1. Go to **"APIs & Services" > "OAuth consent screen"**
2. Fill in the required fields:
   - **App name**: "Project FIRA"
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Click **"SAVE AND CONTINUE"**

## 🎯 **After Setup:**

### **To Enable Real Google Sign-In:**
1. Go back to the code files
2. In both `login.jsx` and `registration.jsx`
3. Remove the temporary alert code
4. Uncomment the real Google Sign-In code (remove the `/*` and `*/`)

### **Test the Setup:**
1. Click "Register with Google" or "Sign in with Google"
2. Should open real Google authentication
3. Should work with your actual Google account

## 📱 **What Works Now:**
- ✅ Email registration works perfectly
- ✅ Email login works perfectly
- ✅ Firestore saves users correctly
- ✅ Navigation to CitizenScreen works

## 🔧 **What Needs Setup:**
- ⚠️ Google Cloud Console configuration
- ⚠️ Redirect URI matching
- ⚠️ API enablement

## 💡 **Quick Test:**
Try registering with email/password first - that should work perfectly while you set up Google Cloud Console!

The email registration and login are fully functional! 🎉 