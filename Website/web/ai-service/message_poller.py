import asyncio
import time
from datetime import datetime, timedelta
from typing import List, Dict
from supabase import create_client, Client
from config import Config
from app import analyze_message_for_fire_alarm, update_alarm_level

class MessagePoller:
    def __init__(self):
        self.supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        self.last_check = datetime.utcnow()
        self.running = False
        
    async def start_polling(self, interval_seconds: int = 30):
        """Start polling for new messages at specified interval."""
        self.running = True
        print(f"🔄 Starting message polling every {interval_seconds} seconds...")
        
        while self.running:
            try:
                await self.check_for_new_messages()
                await asyncio.sleep(interval_seconds)
            except Exception as e:
                print(f"❌ Error in message polling: {e}")
                await asyncio.sleep(interval_seconds)  # Continue polling even on error
    
    async def stop_polling(self):
        """Stop the polling process."""
        self.running = False
        print("🛑 Message polling stopped")
    
    async def check_for_new_messages(self):
        """Check for unanalyzed messages and process them."""
        try:
            # Get messages that haven't been analyzed yet
            result = await self.supabase.table('messages').select('*').is_('ai_analysis', 'null').gte('created_at', self.last_check.isoformat()).order('created_at', desc=False).limit(Config.ANALYSIS_BATCH_SIZE).execute()
            
            if not result.data:
                return
            
            print(f"📨 Found {len(result.data)} new messages to analyze")
            
            for message in result.data:
                await self.process_message(message)
            
            # Update last check time
            self.last_check = datetime.utcnow()
            
        except Exception as e:
            print(f"❌ Error checking for new messages: {e}")
    
    async def process_message(self, message: Dict):
        """Process a single message for fire alarm analysis."""
        try:
            message_text = message.get('text', '')
            if not message_text:
                print(f"⚠️ Skipping message {message['id']} - no text content")
                return
            
            print(f"🔍 Analyzing message: {message_text[:50]}...")
            
            # Analyze the message
            analysis = analyze_message_for_fire_alarm(message_text)
            
            # Update the message with analysis results
            await self.supabase.table('messages').update({
                'ai_analysis': analysis,
                'suggested_alarm_level': analysis['suggested_alarm'],
                'ai_confidence': analysis['confidence'],
                'analyzed_at': datetime.utcnow().isoformat()
            }).eq('id', message['id']).execute()
            
            print(f"✅ Analysis complete for message {message['id']}: {analysis['suggested_alarm']} (confidence: {analysis['confidence']:.2f})")
            
            # If we found a fire-related alarm level, update the global alarm level
            if analysis['suggested_alarm'] != 'NONE' and analysis['confidence'] > Config.MIN_CONFIDENCE_THRESHOLD:
                await self.update_global_alarm_level(analysis, message)
            
        except Exception as e:
            print(f"❌ Error processing message {message.get('id', 'unknown')}: {e}")
    
    async def update_global_alarm_level(self, analysis: Dict, message: Dict):
        """Update the global fire alarm level if the new analysis suggests a higher level."""
        try:
            # Get current alarm level
            current_result = await self.supabase.table('system_status').select('current_level').eq('id', 'fire_alarm_level').execute()
            current_level = 'NONE'
            if current_result.data and len(current_result.data) > 0:
                current_level = current_result.data[0]['current_level']
            
            # Check if new level is higher
            suggested_level = Config.FIRE_ALARM_LEVELS[analysis['suggested_alarm']]
            current_level_numeric = Config.FIRE_ALARM_LEVELS.get(current_level, 0)
            
            if suggested_level > current_level_numeric:
                # Update global alarm level
                await self.supabase.table('system_status').upsert({
                    'id': 'fire_alarm_level',
                    'current_level': analysis['suggested_alarm'],
                    'confidence': analysis['confidence'],
                    'last_updated': datetime.utcnow().isoformat(),
                    'triggered_by_message': message['id'],
                    'reasoning': analysis['reasoning'],
                    'keywords_found': analysis['keywords_found']
                }).execute()
                
                print(f"🚨 Fire alarm level updated from {current_level} to {analysis['suggested_alarm']} (confidence: {analysis['confidence']:.2f})")
                print(f"📝 Reasoning: {analysis['reasoning']}")
            else:
                print(f"ℹ️ Analysis suggests {analysis['suggested_alarm']} but current level {current_level} is higher or equal")
                
        except Exception as e:
            print(f"❌ Error updating global alarm level: {e}")

# Global poller instance
poller = MessagePoller()

async def start_message_polling():
    """Start the message polling service."""
    await poller.start_polling()

if __name__ == "__main__":
    # Run the poller as a standalone service
    asyncio.run(start_message_polling())


















