import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://wedqhgsgrxnvbhklzhnnet.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU';

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test 1: Check if we can connect
    const { data, error } = await supabase
      .from('station_users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      
      if (error.code === 'PGRST116') {
        console.log('💡 The table "station_users" does not exist. Please create it first.');
      }
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('📊 Table exists and is accessible');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
}

// Run the test
testSupabaseConnection();
