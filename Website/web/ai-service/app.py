from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime
import requests
from supabase import create_client, Client
import re
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app)

# Supabase configuration
SUPABASE_URL = 'https://wedqhsgrxnvbhklzhnet.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU'
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fire alarm level definitions
FIRE_ALARM_LEVELS = {
    'NONE': 0,
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4
}

# Keywords and patterns for fire alarm detection
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

def analyze_message_for_fire_alarm(message_text: str) -> Dict:
    """
    Analyze a message to determine the appropriate fire alarm level.
    Returns a dictionary with analysis results.
    """
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
    
    # Check each alarm level
    for level, keywords in FIRE_KEYWORDS.items():
        level_keywords = [kw for kw in keywords if kw in message_lower]
        if level_keywords:
            found_keywords.extend(level_keywords)
            max_level = level
            # Calculate confidence based on keyword density and specificity
            confidence = min(len(level_keywords) / len(keywords) * 2, 1.0)
            confidence_scores.append(confidence)
    
    # Additional pattern matching for critical situations
    critical_patterns = [
        r'\b(help|help me|emergency|urgent)\b',
        r'\b(fire|burning|blaze|flames)\b.*\b(now|immediately|right now)\b',
        r'\b(evacuate|evacuation)\b',
        r'\b(explosion|explosive|gas leak)\b'
    ]
    
    for pattern in critical_patterns:
        if re.search(pattern, message_lower):
            max_level = 'CRITICAL'
            confidence_scores.append(0.9)
            break
    
    # Calculate final confidence
    final_confidence = max(confidence_scores) if confidence_scores else 0.0
    
    # Generate reasoning
    reasoning = f"Found {len(found_keywords)} fire-related keywords: {', '.join(found_keywords[:5])}"
    if len(found_keywords) > 5:
        reasoning += f" and {len(found_keywords) - 5} more"
    
    return {
        'suggested_alarm': max_level,
        'confidence': final_confidence,
        'keywords_found': found_keywords,
        'reasoning': reasoning,
        'timestamp': datetime.utcnow().isoformat()
    }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'fira-ai-service',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze_message():
    """
    Analyze a single message for fire alarm level.
    Expected payload: {
        "message_id": "uuid",
        "text": "message text",
        "sender_id": "uuid",
        "receiver_id": "uuid"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400
        
        message_text = data['text']
        message_id = data.get('message_id')
        
        # Analyze the message
        analysis = analyze_message_for_fire_alarm(message_text)
        
        # If we found a fire-related alarm level, update the database
        if analysis['suggested_alarm'] != 'NONE' and analysis['confidence'] > 0.3:
            update_alarm_level(analysis, data)
        
        return jsonify({
            'success': True,
            'analysis': analysis,
            'message_id': message_id
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def update_alarm_level(analysis: Dict, message_data: Dict):
    """
    Update the alarm level in the database based on analysis results.
    """
    try:
        # Update the message with analysis results
        if message_data.get('message_id'):
            supabase.table('messages').update({
                'ai_analysis': analysis,
                'suggested_alarm_level': analysis['suggested_alarm'],
                'ai_confidence': analysis['confidence'],
                'analyzed_at': datetime.utcnow().isoformat()
            }).eq('id', message_data['message_id']).execute()
        
        # Update global alarm level if this is higher than current
        current_alarm = get_current_alarm_level()
        suggested_level = FIRE_ALARM_LEVELS[analysis['suggested_alarm']]
        current_level = FIRE_ALARM_LEVELS.get(current_alarm, 0)
        
        if suggested_level > current_level:
            supabase.table('system_status').upsert({
                'id': 'fire_alarm_level',
                'current_level': analysis['suggested_alarm'],
                'confidence': analysis['confidence'],
                'last_updated': datetime.utcnow().isoformat(),
                'triggered_by_message': message_data.get('message_id'),
                'reasoning': analysis['reasoning']
            }).execute()
            
            print(f"🚨 Fire alarm level updated to {analysis['suggested_alarm']} (confidence: {analysis['confidence']:.2f})")
        
    except Exception as e:
        print(f"Error updating alarm level: {e}")

def get_current_alarm_level() -> str:
    """Get the current fire alarm level from the database."""
    try:
        result = supabase.table('system_status').select('current_level').eq('id', 'fire_alarm_level').execute()
        if result.data and len(result.data) > 0:
            return result.data[0]['current_level']
        return 'NONE'
    except Exception as e:
        print(f"Error getting current alarm level: {e}")
        return 'NONE'

@app.route('/alarm/status', methods=['GET'])
def get_alarm_status():
    """Get current fire alarm status."""
    try:
        current_level = get_current_alarm_level()
        return jsonify({
            'current_level': current_level,
            'level_numeric': FIRE_ALARM_LEVELS[current_level],
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/alarm/reset', methods=['POST'])
def reset_alarm():
    """Reset fire alarm level to NONE."""
    try:
        supabase.table('system_status').upsert({
            'id': 'fire_alarm_level',
            'current_level': 'NONE',
            'confidence': 0.0,
            'last_updated': datetime.utcnow().isoformat(),
            'triggered_by_message': None,
            'reasoning': 'Manually reset by admin'
        }).execute()
        
        return jsonify({
            'success': True,
            'message': 'Fire alarm level reset to NONE'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
