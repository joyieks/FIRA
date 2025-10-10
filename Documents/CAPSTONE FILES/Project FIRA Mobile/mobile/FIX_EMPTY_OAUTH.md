# 🔧 Fix: Empty OAuth 2.0 Client IDs

## 🚨 **Problem:**
You see "No OAuth clients to display" in Google Cloud Console.

## ✅ **Solution: Enable Google Sign-In in Firebase First**

### **Step 1: Go to Firebase Console**
1. Open: https://console.firebase.google.com/
2. Select your project: `project-fira-9b6d9`

### **Step 2: Enable Google Authentication**
1. In left menu, click **"Authentication"**
2. Click **"Sign-in method"** tab
3. Find **"Google"** in the providers list
4. Click on **"Google"**
5. Click **"Enable"** button
6. Fill in:
   - **Project support email**: [your email]
   - **Web SDK configuration**: Leave as default
7. Click **"Save"**

### **Step 3: Check Google Cloud Console**
1. Go to: https://console.cloud.google.com/
2. Select project: `project-fira-9b6d9`
3. Go to **"APIs & Services" > "Credentials"**
4. Now you should see an OAuth 2.0 Client ID!

### **Step 4: Add Redirect URI**
1. Click the **edit icon** (pencil) next to the OAuth client
2. Scroll to **"Authorized redirect URIs"**
3. Click **"ADD URI"**
4. Add: `https://auth.expo.io/@anonymous/fira-mobile`
5. Click **"SAVE"**

## 🎯 **Why This Happens:**
- Firebase creates the OAuth client automatically when you enable Google Sign-In
- If you try to configure Google Cloud Console before enabling in Firebase, the client doesn't exist yet

## ✅ **After This:**
- OAuth client will appear in Google Cloud Console
- You can add the redirect URI
- Google Sign-In will work in your app

**The key is enabling Google Sign-In in Firebase first!** 🔑 