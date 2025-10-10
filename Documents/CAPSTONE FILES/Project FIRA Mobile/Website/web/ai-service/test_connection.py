#!/usr/bin/env python3
"""
Test Supabase connection
"""

import os
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

print(f"URL: {SUPABASE_URL}")
print(f"Key length: {len(SUPABASE_KEY) if SUPABASE_KEY else 'None'}")
print(f"Key starts with: {SUPABASE_KEY[:20] if SUPABASE_KEY else 'None'}...")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase connection successful!")
    
    # Test a simple query
    result = supabase.table('messages').select('*').limit(1).execute()
    print(f"✅ Database query successful! Found {len(result.data)} messages")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"Error type: {type(e).__name__}")

















