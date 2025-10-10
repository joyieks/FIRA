#!/usr/bin/env python3
"""
Final test with your Supabase credentials
"""

from supabase import create_client, Client

# Your actual Supabase credentials
SUPABASE_URL = "https://wedqhsgrxnvbhklzhnet.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU"

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
    
    # Define the analysis function directly here
    def analyze_message_for_fire_alarm(message_text: str):
        FIRE_KEYWORDS = {
            'CRITICAL': [
                'fire', 'burning', 'blaze', 'flames', 'smoke', 'emergency', 'urgent',
                'evacuate', 'evacuation', 'danger', 'hazard', 'explosion', 'explosive',
                'gas leak', 'electrical fire', 'structure fire', 'wildfire', 'forest fire'
            ],
            'HIGH': [
                'smoke alarm', 'fire alarm', 'sprinkler', 'fire department', 'firefighter',
                'rescue', 'trapped', 'injured', 'casualty', 'damage', 'destruction'
            ],
            'MEDIUM': [
                'hot', 'overheating', 'spark', 'electrical', 'wiring', 'faulty',
                'malfunction', 'warning', 'caution', 'suspicious', 'unusual'
            ],
            'LOW': [
                'warm', 'temperature', 'heating', 'cooking', 'grill', 'candle',
                'cigarette', 'ash', 'embers'
            ]
        }
        
        if not message_text or not isinstance(message_text, str):
            return {
                'suggested_alarm': 'NONE',
                'confidence': 0.0,
                'keywords_found': [],
                'reasoning': 'No valid message text provided'
            }
        
        message_lower = message_text.lower()
        found_keywords = []
        max_level = 'NONE'
        confidence_scores = []
        
        for level, keywords in FIRE_KEYWORDS.items():
            level_keywords = [kw for kw in keywords if kw in message_lower]
            if level_keywords:
                found_keywords.extend(level_keywords)
                max_level = level
                confidence = min(len(level_keywords) / len(keywords) * 2, 1.0)
                confidence_scores.append(confidence)
        
        final_confidence = max(confidence_scores) if confidence_scores else 0.0
        
        reasoning = f"Found {len(found_keywords)} fire-related keywords: {', '.join(found_keywords[:5])}"
        if len(found_keywords) > 5:
            reasoning += f" and {len(found_keywords) - 5} more"
        
        return {
            'suggested_alarm': max_level,
            'confidence': final_confidence,
            'keywords_found': found_keywords,
            'reasoning': reasoning
        }
    
    test_messages = [
        "Hello, how are you?",
        "There's smoke coming from the building",
        "FIRE! FIRE! We need help immediately!"
    ]
    
    for msg in test_messages:
        analysis = analyze_message_for_fire_alarm(msg)
        print(f"Message: '{msg}'")
        print(f"Analysis: {analysis['suggested_alarm']} (confidence: {analysis['confidence']:.2f})")
        print(f"Keywords: {analysis['keywords_found']}")
        print()
    
    print("🎉 AI Service test completed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"Error type: {type(e).__name__}")


















