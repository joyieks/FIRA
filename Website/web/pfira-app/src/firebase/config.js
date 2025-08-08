import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
// You'll need to replace these with your actual Firebase project config
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

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app; 