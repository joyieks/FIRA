// Test script for stationUsers collection
// Run this in the browser console to test database connection

import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Firebase configuration (copy from your firebase.js)
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
const db = getFirestore(app);

// Test function to fetch station users
async function testFetchStationUsers() {
  try {
    console.log('🔍 Testing stationUsers collection fetch...');
    
    // Create query
    const q = query(collection(db, 'stationUsers'), orderBy('createdAt', 'desc'));
    console.log('📋 Query created');
    
    // Get documents
    const querySnapshot = await getDocs(q);
    console.log('📊 Query snapshot received');
    console.log('📈 Number of documents:', querySnapshot.size);
    
    // Process documents
    const users = [];
    querySnapshot.forEach((doc) => {
      const userData = { id: doc.id, ...doc.data() };
      console.log('👤 User:', userData);
      users.push(userData);
    });
    
    console.log('✅ All users fetched successfully:', users);
    return users;
    
  } catch (error) {
    console.error('❌ Error fetching station users:', error);
    console.error('❌ Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Test function to check if collection exists
async function testCollectionExists() {
  try {
    console.log('🔍 Testing if stationUsers collection exists...');
    
    const querySnapshot = await getDocs(collection(db, 'stationUsers'));
    console.log('✅ Collection exists');
    console.log('📊 Collection size:', querySnapshot.size);
    
    return true;
  } catch (error) {
    console.error('❌ Collection does not exist or error:', error);
    return false;
  }
}

// Run tests
console.log('🚀 Starting stationUsers collection tests...');

// Test 1: Check if collection exists
testCollectionExists()
  .then((exists) => {
    if (exists) {
      console.log('✅ Collection exists, proceeding to fetch data...');
      // Test 2: Fetch data
      return testFetchStationUsers();
    } else {
      console.log('❌ Collection does not exist');
    }
  })
  .then((users) => {
    if (users) {
      console.log('🎉 All tests completed successfully!');
      console.log('📊 Final user count:', users.length);
    }
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
  });

// Export functions for manual testing
window.testStationUsers = {
  testFetchStationUsers,
  testCollectionExists
};

console.log('📝 Test functions available at: window.testStationUsers');
