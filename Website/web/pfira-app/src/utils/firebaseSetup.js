// Firebase Setup Helper Script
// This script helps you set up Firebase users in Firestore

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Function to set up admin user in Firestore
export const setupAdminUser = async (adminUID) => {
  try {
    const adminUserData = {
      adminID: 1,
      adminName: "Admin User",
      email: "admin@gmail.com",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'adminUser', adminUID), adminUserData);
    console.log('Admin user set up successfully!');
    return true;
  } catch (error) {
    console.error('Error setting up admin user:', error);
    return false;
  }
};

// Function to set up station user in Firestore
export const setupStationUser = async (stationUID) => {
  try {
    const stationUserData = {
      stationID: 1,
      stationName: "Station User",
      email: "stations@gmail.com",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'stationUsers', stationUID), stationUserData);
    console.log('Station user set up successfully!');
    return true;
  } catch (error) {
    console.error('Error setting up station user:', error);
    return false;
  }
};

// Function to check if user exists in Firestore
export const checkUserExists = async (uid, collectionName) => {
  try {
    const userDoc = await getDoc(doc(db, collectionName, uid));
    return userDoc.exists();
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
};

// Function to get user data from Firestore
export const getUserData = async (uid, collectionName) => {
  try {
    const userDoc = await getDoc(doc(db, collectionName, uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Instructions for manual setup:
/*
1. First, make sure you have updated the Firebase config in src/firebase/config.js

2. Create users in Firebase Auth Console:
   - Go to Firebase Console > Authentication > Users
   - Add user: admin@gmail.com / admin123
   - Add user: stations@gmail.com / stations
   - Copy the UIDs for both users

3. Run these functions in the browser console or create a setup component:

   // For admin user
   await setupAdminUser('ADMIN_UID_HERE');
   
   // For station user  
   await setupStationUser('STATION_UID_HERE');

4. Test the authentication:
   - Try logging in with admin@gmail.com / admin123
   - Try logging in with stations@gmail.com / stations
   - Verify that each user is redirected to their appropriate dashboard
*/ 