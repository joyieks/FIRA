#!/usr/bin/env python3
"""
Direct test with hardcoded credentials
"""

from supabase import create_client, Client

# Your Supabase credentials - replace with your actual values
SUPABASE_URL = "https://wedqhsgrxnvbhklzhnet.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU"  # Replace this with your real key

print(f"URL: {SUPABASE_URL}")
print(f"Key length: {len(SUPABASE_KEY)}")
print(f"Key starts with: {SUPABASE_KEY[:20]}...")

try:
    print("Testing Supabase connection...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase connection successful!")
    
    # Test a simple query
    result = supabase.table('messages').select('*').limit(1).execute()
    print(f"✅ Database query successful! Found {len(result.data)} messages")
    
    # Test the AI analysis function
    print("\n🧪 Testing AI analysis...")
    from app import analyze_message_for_fire_alarm
    
    test_messages = [
        "Hello, how are you?",
        "There's smoke coming from the building",
        "FIRE! FIRE! We need help immediately!"
    ]
    
    for msg in test_messages:
        analysis = analyze_message_for_fire_alarm(msg)
        print(f"Message: '{msg}'")
        print(f"Analysis: {analysis['suggested_alarm']} (confidence: {analysis['confidence']:.2f})")
        print()
    
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"Error type: {type(e).__name__}")


















