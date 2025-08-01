// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC9zvA1gR1uZSYebwWDD1wIbD8kSRaNo40",
  authDomain: "project-fira-9b6d9.firebaseapp.com",
  projectId: "project-fira-9b6d9",
  storageBucket: "project-fira-9b6d9.firebasestorage.app",
  messagingSenderId: "106148803088",
  appId: "1:106148803088:web:da49617a4c1e5d02831095",
  measurementId: "G-WVXR0JN8JW"
};

// Initialize Firebase with error handling
let app, auth, db, storage, analytics;

try {
  console.log('Initializing Firebase...');
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized:', app);

  // Initialize Firebase Authentication and get a reference to the service
  auth = getAuth(app);
  console.log('Firebase auth initialized:', auth);

  // Initialize Firestore
  db = getFirestore(app);
  console.log('Firebase db initialized:', db);

  // Initialize Firebase Storage
  storage = getStorage(app);
  console.log('Firebase storage initialized:', storage);

  // Initialize Analytics (only in browser environment)
  analytics = null;
  if (typeof window !== 'undefined') {
    try {
      analytics = getAnalytics(app);
      console.log('Firebase analytics initialized:', analytics);
    } catch (error) {
      console.warn('Analytics initialization failed:', error);
    }
  }
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

export { app, analytics, auth, db, storage };

