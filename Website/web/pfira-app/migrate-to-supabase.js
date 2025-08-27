import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9zvA1gR1uZSYebwWDD1wIbD8kSRaNo40",
  authDomain: "project-fira-9b6d9.firebaseapp.com",
  projectId: "project-fira-9b6d9",
  storageBucket: "project-fira-9b6d9.firebasestorage.app",
  messagingSenderId: "106148803088",
  appId: "1:106148803088:web:da49617a4c1e5d02831095",
  measurementId: "G-WVXR0JN8JW"
};

// Supabase configuration
const supabaseUrl = 'https://wedqhgsgrxnvbhklzhnnet.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU';

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to convert any date format to ISO string
function convertToISOString(dateValue) {
  if (!dateValue) return new Date().toISOString();
  
  try {
    // If it's a Firebase Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toISOString();
    }
    
    // If it's already a string
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toISOString();
    }
    
    // If it's a Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    
    // Try to convert it
    return new Date(dateValue).toISOString();
  } catch (error) {
    console.log('Date conversion error:', error);
    return new Date().toISOString();
  }
}

async function migrateStationUsers() {
  try {
    console.log('🚀 Starting migration of stationUsers to Supabase...');
    
    // Fetch all stationUsers from Firebase
    const stationUsersRef = collection(db, 'stationUsers');
    const snapshot = await getDocs(stationUsersRef);
    
    console.log(`📊 Found ${snapshot.docs.length} station users to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Migrate each station user
    for (const doc of snapshot.docs) {
      try {
        const stationData = doc.data();
        console.log(`Processing station: ${stationData.stationName || doc.id}`);
        
        // Prepare data for Supabase
        const supabaseData = {
          id: doc.id, // Keep the same ID
          station_name: stationData.stationName || '',
          email: stationData.email || '',
          address: stationData.address || stationData.location || '',
          phone: stationData.phone || stationData.number || '',
          position: stationData.position || '',
          role: stationData.role || 'stationUser',
          active: stationData.active !== false,
          status: stationData.status || 'active',
          is_online: stationData.isOnline || false,
          created_at: convertToISOString(stationData.createdAt),
          updated_at: convertToISOString(stationData.updatedAt)
        };
        
        // Insert into Supabase
        const { data, error } = await supabase
          .from('station_users')
          .insert([supabaseData]);
        
        if (error) {
          console.error(`❌ Error migrating station ${doc.id}:`, error);
          errorCount++;
        } else {
          console.log(`✅ Successfully migrated station: ${stationData.stationName || doc.id}`);
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing station ${doc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} stations`);
    console.log(`❌ Failed to migrate: ${errorCount} stations`);
    console.log(`📊 Total processed: ${snapshot.docs.length} stations`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 You can now delete the stationUsers collection from Firebase');
    } else {
      console.log('\n⚠️ Migration completed with some errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
migrateStationUsers();
