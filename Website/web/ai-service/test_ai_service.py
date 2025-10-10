#!/usr/bin/env python3
"""
Test script for FIRA AI Service
Tests the AI analysis functionality and API endpoints
"""

import requests
import json
import time

# Configuration
AI_SERVICE_URL = "http://localhost:5000"

def test_health():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{AI_SERVICE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_analyze_message():
    """Test message analysis endpoint"""
    print("\n🔍 Testing message analysis...")
    
    test_messages = [
        {
            "text": "Hello, how are you?",
            "expected_level": "NONE",
            "description": "Normal message"
        },
        {
            "text": "There's smoke coming from the building",
            "expected_level": "HIGH",
            "description": "Smoke detection"
        },
        {
            "text": "FIRE! FIRE! We need help immediately!",
            "expected_level": "CRITICAL",
            "description": "Emergency fire alert"
        },
        {
            "text": "The temperature is getting quite hot in here",
            "expected_level": "LOW",
            "description": "Temperature concern"
        },
        {
            "text": "I smell something burning, could be electrical",
            "expected_level": "MEDIUM",
            "description": "Electrical fire concern"
        }
    ]
    
    for i, test in enumerate(test_messages, 1):
        print(f"\n   Test {i}: {test['description']}")
        print(f"   Message: '{test['text']}'")
        
        try:
            response = requests.post(f"{AI_SERVICE_URL}/analyze", json={
                "message_id": f"test-{i}",
                "text": test["text"],
                "sender_id": "test-sender",
                "receiver_id": "test-receiver"
            })
            
            if response.status_code == 200:
                data = response.json()
                analysis = data.get('analysis', {})
                suggested_level = analysis.get('suggested_alarm', 'UNKNOWN')
                confidence = analysis.get('confidence', 0.0)
                
                print(f"   ✅ Analysis: {suggested_level} (confidence: {confidence:.2f})")
                print(f"   📝 Reasoning: {analysis.get('reasoning', 'N/A')}")
                
                if suggested_level == test['expected_level']:
                    print(f"   ✅ Expected level matches!")
                else:
                    print(f"   ⚠️  Expected {test['expected_level']}, got {suggested_level}")
            else:
                print(f"   ❌ Analysis failed: {response.status_code}")
                print(f"   Error: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Analysis error: {e}")

def test_alarm_status():
    """Test alarm status endpoint"""
    print("\n🔍 Testing alarm status...")
    try:
        response = requests.get(f"{AI_SERVICE_URL}/alarm/status")
        if response.status_code == 200:
            data = response.json()
            print("✅ Alarm status retrieved")
            print(f"   Current level: {data.get('current_level', 'N/A')}")
            print(f"   Level numeric: {data.get('level_numeric', 'N/A')}")
            print(f"   Timestamp: {data.get('timestamp', 'N/A')}")
        else:
            print(f"❌ Alarm status failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Alarm status error: {e}")

def test_reset_alarm():
    """Test alarm reset endpoint"""
    print("\n🔍 Testing alarm reset...")
    try:
        response = requests.post(f"{AI_SERVICE_URL}/alarm/reset")
        if response.status_code == 200:
            data = response.json()
            print("✅ Alarm reset successful")
            print(f"   Message: {data.get('message', 'N/A')}")
        else:
            print(f"❌ Alarm reset failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Alarm reset error: {e}")

def main():
    """Run all tests"""
    print("🧪 FIRA AI Service Test Suite")
    print("=" * 50)
    
    # Test health first
    if not test_health():
        print("\n❌ Service is not running. Please start the AI service first.")
        print("   Run: python start.py")
        return
    
    # Run other tests
    test_analyze_message()
    test_alarm_status()
    test_reset_alarm()
    
    print("\n🎉 Test suite completed!")
    print("\nTo view real-time analysis, send messages through the FIRA app")
    print("and check the admin panel for alarm level updates.")

if __name__ == "__main__":
    main()

















