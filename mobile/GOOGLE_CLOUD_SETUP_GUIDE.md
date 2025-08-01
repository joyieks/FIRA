# 🔧 Complete Google Cloud Console Setup Guide

## 🎯 **What We're Setting Up:**
We need to configure Google Cloud Console so your app can use real Google Sign-In instead of showing the error.

## ✅ **Your OAuth Client ID:**
`745177862698-t17reuimg7bmj6lurbe1de56nhddbueu.apps.googleusercontent.com`

---

## 📋 **Step 1: Access Google Cloud Console**

### **1.1 Open Browser**
- Open Chrome, Firefox, or any browser
- Go to: **https://console.cloud.google.com/**

### **1.2 Sign In**
- Click "Sign in" if not already signed in
- Use the same Google account that owns your Firebase project

---

## 🏗️ **Step 2: Select Your Project**

### **2.1 Find Project Dropdown**
- Look at the top-left of the page
- You'll see a dropdown that says "Select a project" or shows a project name

### **2.2 Select Your Project**
- Click the dropdown
- Look for: **`project-fira-9b6d9`**
- Click on it to select

**If you don't see `project-fira-9b6d9`:**
- Make sure you're signed in with the correct Google account
- The account that created your Firebase project

---

## 🔑 **Step 3: Configure OAuth Credentials**

### **3.1 Navigate to APIs & Services**
- In the left sidebar menu, find **"APIs & Services"**
- Click on it

### **3.2 Go to Credentials**
- In the APIs & Services menu, click **"Credentials"**
- This will show you all your API keys and OAuth settings

### **3.3 Find Your OAuth Client**
- Look for **"OAuth 2.0 Client IDs"**
- You should see one with ID: `745177862698-t17reuimg7bmj6lurbe1de56nhddbueu.apps.googleusercontent.com`

### **3.4 Edit the OAuth Client**
- Click the **pencil/edit icon** next to your OAuth client
- This opens the editing page

---

## 🔗 **Step 4: Add Redirect URI**

### **4.1 Find Authorized Redirect URIs**
- In the edit page, scroll down to **"Authorized redirect URIs"**
- You'll see a list of URLs

### **4.2 Add New Redirect URI**
- Click **"ADD URI"** button
- In the text field, type exactly: `https://auth.expo.io/@anonymous/fira-mobile`
- Make sure there are no extra spaces

### **4.3 Save Changes**
- Click **"SAVE"** button at the bottom
- Wait for the "Saved" confirmation

---

## 📚 **Step 5: Enable Required APIs**

### **5.1 Go to API Library**
- Go back to **"APIs & Services"** in the left menu
- Click **"Library"**

### **5.2 Search for Google Identity API**
- In the search box, type: **"Google Identity API"**
- Click on it when it appears
- Click **"ENABLE"** button

### **5.3 Search for Google+ API (Optional)**
- Go back to the Library
- Search for: **"Google+ API"**
- Click on it and click **"ENABLE"** (if available)

---

## ⚙️ **Step 6: Configure OAuth Consent Screen**

### **6.1 Go to OAuth Consent Screen**
- In **"APIs & Services"**, click **"OAuth consent screen"**

### **6.2 Fill Required Information**
- **App name**: Type "Project FIRA"
- **User support email**: Your email address
- **Developer contact information**: Your email address
- **App logo**: (Optional) You can skip this

### **6.3 Save and Continue**
- Click **"SAVE AND CONTINUE"**
- You can skip the optional sections for now

---

## ✅ **Step 7: Test Your Setup**

### **7.1 Wait a Few Minutes**
- Google Cloud Console changes can take 5-10 minutes to take effect

### **7.2 Test in Your App**
- Go back to your app
- Try clicking "Register with Google" or "Sign in with Google"
- Should now work without the redirect_uri_mismatch error!

---

## 🚨 **Common Issues & Solutions:**

### **Issue 1: "Project not found"**
- Make sure you're signed in with the correct Google account
- The account that created your Firebase project

### **Issue 2: "OAuth client not found"**
- Go to Firebase Console
- Go to Authentication > Sign-in method
- Enable Google Sign-in if not already enabled

### **Issue 3: "Still getting redirect_uri_mismatch"**
- Double-check the redirect URI is exactly: `https://auth.expo.io/@anonymous/fira-mobile`
- Wait 5-10 minutes for changes to take effect
- Clear your browser cache

### **Issue 4: "APIs not found"**
- Some APIs might be deprecated
- Try searching for "Google Identity" instead of "Google+ API"
- The Google Identity API is the main one you need

---

## 🎉 **Success Indicators:**

✅ **You'll know it's working when:**
- No more "redirect_uri_mismatch" error
- Google Sign-In opens in browser
- You can sign in with your real Google account
- User data appears in Firebase Authentication
- User data appears in Firestore

---

## 📞 **Need Help?**

If you get stuck at any step:
1. Take a screenshot of where you're stuck
2. Tell me exactly what you see on the screen
3. I can guide you through the specific issue

The setup is straightforward once you know where to click! 🚀 