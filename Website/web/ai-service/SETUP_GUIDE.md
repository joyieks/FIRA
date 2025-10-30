# FIRA AI Service Setup Guide

This guide will help you set up and deploy the FIRA AI Service for automatic fire alarm detection.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FIRA App      │    │   AI Service     │    │   Admin Panel   │
│   (React)       │───▶│   (Python/Flask) │───▶│   (React)       │
│                 │    │                  │    │                 │
│ • Send messages │    │ • Analyze text   │    │ • Display alarm │
│ • Real-time UI  │    │ • Determine level│    │ • Update status │
│ • User mgmt     │    │ • Update DB      │    │ • Notifications │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        ▲
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                            ┌─────────────┐
                            │  Supabase   │
                            │  Database   │
                            └─────────────┘
```

## 📋 Prerequisites

- Python 3.9+ (for local development)
- Docker & Docker Compose (for deployment)
- Supabase account and project
- Node.js & npm (for the main FIRA app)

## 🚀 Quick Start

### 1. Database Setup

First, run the database migration in your Supabase SQL editor:

```sql
-- Copy and paste the contents of database_setup.sql
-- This creates the system_status table and adds AI analysis columns to messages
```

### 2. Environment Configuration

Create a `.env` file in the `ai-service` directory:

```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url-here
SUPABASE_KEY=your-supabase-anon-key-here

# Server Configuration
PORT=5000
DEBUG=True

# AI Service Configuration
MIN_CONFIDENCE_THRESHOLD=0.3
ANALYSIS_BATCH_SIZE=10
```

### 3. Local Development

```bash
# Navigate to the AI service directory
cd FIRA/Website/web/ai-service

# Install dependencies
pip install -r requirements.txt

# Start the service
python start.py
```

### 4. Docker Deployment

```bash
# Navigate to the AI service directory
cd FIRA/Website/web/ai-service

# Make deployment script executable (Linux/Mac)
chmod +x deploy.sh

# Deploy with Docker
./deploy.sh
```

## 🧪 Testing

### Test the AI Service

```bash
# Run the test suite
python test_ai_service.py
```

### Test with FIRA App

1. Start the AI service
2. Start the FIRA React app
3. Send messages with fire-related keywords
4. Check the admin panel for alarm level updates

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

### Alarm Status
```bash
curl http://localhost:5000/alarm/status
```

### View Logs
```bash
# Docker logs
docker-compose logs -f ai-service
docker-compose logs -f message-poller

# Local logs
# Check console output when running python start.py
```

## 🔧 Configuration

### Fire Alarm Levels

The AI service detects 5 alarm levels:

| Level | Description | Keywords |
|-------|-------------|----------|
| NONE | No fire-related content | None |
| LOW | Low-level fire indicators | warm, temperature, heating, cooking |
| MEDIUM | Moderate fire concerns | hot, overheating, spark, electrical |
| HIGH | High fire risk | smoke alarm, fire department, rescue |
| CRITICAL | Emergency fire situation | fire, burning, blaze, evacuate, emergency |

### Confidence Threshold

Adjust `MIN_CONFIDENCE_THRESHOLD` in your `.env` file:

- `0.1` = Very sensitive (more false positives)
- `0.3` = Balanced (recommended)
- `0.7` = Conservative (fewer false positives)

### Batch Processing

Set `ANALYSIS_BATCH_SIZE` to control message processing:

- Smaller values = More frequent updates, higher resource usage
- Larger values = Less frequent updates, lower resource usage

## 🔄 Message Processing Flow

1. **Message Sent**: FIRA app saves message to Supabase
2. **Polling**: AI service polls for unanalyzed messages every 30 seconds
3. **Analysis**: Message text is analyzed for fire-related keywords
4. **Confidence**: Confidence score is calculated based on keyword density
5. **Update**: If confidence > threshold, alarm level is updated
6. **Real-time**: Admin panel receives updates via Supabase real-time

## 🛠️ Troubleshooting

### Common Issues

#### 1. Database Connection
```
Error: Failed to connect to Supabase
```
**Solution**: Check your `SUPABASE_URL` and `SUPABASE_KEY` in `.env`

#### 2. Message Processing
```
Error: Messages not being analyzed
```
**Solution**: 
- Check if `ai_analysis` column exists in messages table
- Verify message poller is running
- Check logs for errors

#### 3. Alarm Updates
```
Error: Alarm level not updating
```
**Solution**:
- Verify `system_status` table exists
- Check if AI service has write permissions
- Verify confidence threshold settings

#### 4. Docker Issues
```
Error: Container won't start
```
**Solution**:
- Check Docker is running
- Verify `.env` file exists
- Check port 5000 is available

### Debug Mode

Enable debug mode for detailed logging:

```env
DEBUG=True
```

### Log Analysis

Look for these log patterns:

- `✅ Analysis complete` - Message successfully analyzed
- `🚨 Fire alarm level updated` - Alarm level changed
- `❌ Error` - Something went wrong
- `🔄 Found X new messages` - Polling is working

## 📈 Performance Tuning

### For High Message Volume

1. Increase `ANALYSIS_BATCH_SIZE`
2. Use a more powerful server
3. Consider using Redis for message queuing
4. Implement horizontal scaling

### For Low Latency

1. Decrease polling interval in `message_poller.py`
2. Use Supabase real-time triggers instead of polling
3. Implement WebSocket connections

## 🔐 Security Considerations

1. **API Keys**: Keep Supabase keys secure
2. **Network**: Use HTTPS in production
3. **Access Control**: Implement proper authentication
4. **Rate Limiting**: Add rate limiting to prevent abuse

## 🚀 Production Deployment

### Using Docker Compose

1. Set up a production server
2. Configure environment variables
3. Use Docker Compose with production settings
4. Set up monitoring and logging
5. Configure reverse proxy (nginx)

### Using Cloud Services

1. **AWS**: Use ECS or Lambda
2. **Google Cloud**: Use Cloud Run
3. **Azure**: Use Container Instances
4. **Heroku**: Use container deployment

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Verify all prerequisites are met
3. Test with the provided test script
4. Check Supabase dashboard for data consistency

## 🔄 Updates

To update the AI service:

1. Pull latest changes
2. Rebuild Docker images: `docker-compose build`
3. Restart services: `docker-compose restart`
4. Test functionality

## 📝 API Reference

### Endpoints

- `GET /health` - Service health check
- `POST /analyze` - Analyze a message
- `GET /alarm/status` - Get current alarm status
- `POST /alarm/reset` - Reset alarm to NONE

### Request/Response Examples

#### Analyze Message
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "123",
    "text": "There is smoke in the building",
    "sender_id": "station-1",
    "receiver_id": "admin-1"
  }'
```

#### Get Alarm Status
```bash
curl http://localhost:5000/alarm/status
```

## 🎯 Next Steps

1. **Custom Keywords**: Add domain-specific fire detection keywords
2. **Machine Learning**: Integrate with more sophisticated ML models
3. **Notifications**: Add email/SMS alerts for critical alarms
4. **Analytics**: Track alarm patterns and false positive rates
5. **Integration**: Connect with external fire safety systems























