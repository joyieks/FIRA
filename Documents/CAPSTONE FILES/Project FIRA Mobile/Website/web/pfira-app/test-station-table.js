import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://wedqhgsgrxnvbhklzhnnet.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU';

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStationTable() {
  try {
    console.log('🔍 Testing station_users table...');
    
    // Test 1: Check if table exists and can be queried
    const { data, error } = await supabase
      .from('station_users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing station_users table:', error);
      
      if (error.code === 'PGRST116') {
        console.log('💡 The table "station_users" does not exist. Please create it first.');
        console.log('📋 Run this SQL in your Supabase dashboard:');
        console.log(`
CREATE TABLE station_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  position TEXT,
  role TEXT DEFAULT 'stationUser',
  active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE station_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON station_users FOR ALL USING (true);
        `);
      }
    } else {
      console.log('✅ station_users table exists and is accessible!');
      console.log(`📊 Current records: ${data.length}`);
    }
    
    // Test 2: Try to insert a test record
    console.log('\n🧪 Testing insert operation...');
    const testData = {
      station_name: 'Test Station',
      email: 'test@example.com',
      address: 'Test Address',
      phone: '1234567890',
      position: 'Test Position',
      role: 'stationUser',
      active: true,
      status: 'active',
      is_online: false
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('station_users')
      .insert([testData])
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting test data:', insertError);
    } else {
      console.log('✅ Successfully inserted test data:', insertData[0]);
      
      // Clean up: Delete the test record
      const { error: deleteError } = await supabase
        .from('station_users')
        .delete()
        .eq('email', 'test@example.com');
      
      if (deleteError) {
        console.error('⚠️ Could not delete test data:', deleteError);
      } else {
        console.log('🧹 Test data cleaned up successfully');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStationTable();
