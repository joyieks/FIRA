# Firebase Setup Guide

This guide will help you set up Firebase Authentication and Firestore for the FIRA project.

## Prerequisites

1. A Firebase project (already created)
2. Firebase Authentication enabled
3. Firestore Database enabled

## Step 1: Configure Firebase

1. Go to your Firebase Console
2. Navigate to Project Settings
3. Scroll down to "Your apps" section
4. Click on the web app icon (</>) to add a web app
5. Register your app with a nickname (e.g., "FIRA Web App")
6. Copy the Firebase configuration object

## Step 2: Update Firebase Config

1. Open `src/firebase/config.js`
2. Replace the placeholder configuration with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## Step 3: Create Users in Firebase Auth

1. Go to Firebase Console > Authentication > Users
2. Click "Add User"
3. Create the following users:

### Admin User
- Email: `admin@gmail.com`
- Password: `admin123`

### Station User
- Email: `stations@gmail.com`
- Password: `stations`

## Step 4: Get User UIDs

1. After creating the users, click on each user in the Firebase Console
2. Copy the UID for each user
3. Note down these UIDs for the next step

## Step 5: Set Up Firestore Collections

1. Go to Firebase Console > Firestore Database
2. Create the following collections and documents:

### adminUser Collection
- Document ID: [Admin User UID]
- Fields:
  - `adminID`: 1 (number)
  - `adminName`: "Admin User" (string)
  - `email`: "admin@gmail.com" (string)
  - `createdAt`: [timestamp]

### stationUsers Collection
- Document ID: [Station User UID]
- Fields:
  - `stationID`: 1 (number)
  - `stationName`: "Station User" (string)
  - `email`: "stations@gmail.com" (string)
  - `createdAt`: [timestamp]

## Step 6: Update Firestore Rules

Make sure your Firestore rules allow authenticated users to read their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read their own data
    match /adminUser/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
    match /stationUsers/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 7: Test the Application

1. Start the development server: `npm run dev`
2. Navigate to the login page
3. Test with the credentials:
   - Admin: `admin@gmail.com` / `admin123`
   - Station: `stations@gmail.com` / `stations`

## Features Implemented

✅ Firebase Authentication integration
✅ User type-based routing (admin vs station)
✅ Protected routes based on authentication and user type
✅ Automatic redirection to appropriate dashboard
✅ Session management with Firebase Auth
✅ Firestore integration for user data

## Troubleshooting

### Common Issues:

1. **"User not found in authorized collections"**
   - Make sure the user exists in the correct Firestore collection
   - Check that the UID matches between Auth and Firestore

2. **"Access denied"**
   - Verify the user is in the correct collection (adminUser or stationUsers)
   - Check Firestore rules

3. **Firebase config errors**
   - Ensure all Firebase config values are correct
   - Check that the project ID matches your Firebase project

### Debug Steps:

1. Check browser console for Firebase errors
2. Verify Firebase project settings
3. Ensure Firestore collections are properly set up
4. Check that user UIDs match between Auth and Firestore

## Security Notes

- Users can only access their designated dashboard
- Admin users cannot access station dashboard and vice versa
- Authentication state is managed by Firebase
- Session persistence is handled automatically by Firebase Auth 