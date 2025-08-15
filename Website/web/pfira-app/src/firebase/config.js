import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9zvA1gR1uZSYebwWDD1wIbD8kSRaNo40",
  authDomain: "project-fira-9b6d9.firebaseapp.com",
  projectId: "project-fira-9b6d9",
  storageBucket: "project-fira-9b6d9.firebasestorage.app",
  messagingSenderId: "106148803088",
  appId: "1:106148803088:web:da49617a4c1e5d02831095",
  measurementId: "G-WVXR0JN8JW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
