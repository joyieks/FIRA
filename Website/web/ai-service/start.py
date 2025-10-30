#!/usr/bin/env python3
"""
Startup script for FIRA AI Service
Runs both the Flask API and the message poller concurrently
"""

import asyncio
import threading
import time
from app import app
from message_poller import start_message_polling

def run_flask_app():
    """Run the Flask application"""
    print("🚀 Starting Flask API server...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

def run_message_poller():
    """Run the message poller in an async loop"""
    print("🔄 Starting message poller...")
    asyncio.run(start_message_polling())

def main():
    """Main startup function"""
    print("🔥 Starting FIRA AI Service...")
    print("=" * 50)
    
    # Start Flask app in a separate thread
    flask_thread = threading.Thread(target=run_flask_app, daemon=True)
    flask_thread.start()
    
    # Give Flask a moment to start
    time.sleep(2)
    
    # Start message poller in main thread
    try:
        run_message_poller()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down FIRA AI Service...")
        print("✅ Shutdown complete")

if __name__ == "__main__":
    main()























