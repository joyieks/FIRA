#!/usr/bin/env python3
"""
Test database connection and updates
"""

from supabase import create_client, Client

# Your Supabase credentials
SUPABASE_URL = "https://wedqhsgrxnvbhklzhnet.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU"

print("🔍 Testing database connection and updates...")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase connection successful!")
    
    # Test 1: Check if system_status table exists and is accessible
    print("\n1. Testing system_status table...")
    try:
        result = supabase.table('system_status').select('*').execute()
        print(f"✅ system_status table accessible! Found {len(result.data)} records")
        for record in result.data:
            print(f"   - {record}")
    except Exception as e:
        print(f"❌ Error accessing system_status: {e}")
    
    # Test 2: Check if messages table has the new columns
    print("\n2. Testing messages table columns...")
    try:
        result = supabase.table('messages').select('id, text, ai_analysis, suggested_alarm_level, ai_confidence').limit(1).execute()
        print(f"✅ messages table with AI columns accessible! Found {len(result.data)} records")
        if result.data:
            print(f"   Sample record: {result.data[0]}")
    except Exception as e:
        print(f"❌ Error accessing messages with AI columns: {e}")
    
    # Test 3: Try to update system_status
    print("\n3. Testing system_status update...")
    try:
        result = supabase.table('system_status').upsert({
            'id': 'fire_alarm_level',
            'current_level': 'CRITICAL',
            'confidence': 0.9,
            'reasoning': 'Test update from Python script',
            'keywords_found': ['fire', 'emergency']
        }).execute()
        print("✅ system_status update successful!")
        print(f"   Updated record: {result.data}")
    except Exception as e:
        print(f"❌ Error updating system_status: {e}")
    
    # Test 4: Verify the update
    print("\n4. Verifying the update...")
    try:
        result = supabase.table('system_status').select('*').eq('id', 'fire_alarm_level').execute()
        if result.data:
            record = result.data[0]
            print(f"✅ Current alarm level: {record['current_level']}")
            print(f"   Confidence: {record['confidence']}")
            print(f"   Reasoning: {record['reasoning']}")
        else:
            print("❌ No fire_alarm_level record found")
    except Exception as e:
        print(f"❌ Error verifying update: {e}")
    
    print("\n🎉 Database test completed!")
    
except Exception as e:
    print(f"❌ Database connection failed: {e}")



























