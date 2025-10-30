# FIRA AI Service

This microservice analyzes messages from the FIRA emergency communication system to detect fire-related emergencies and automatically update alarm levels.

## Features

- 🔍 **Message Analysis**: Analyzes text messages for fire-related keywords and patterns
- 🚨 **Alarm Level Detection**: Automatically determines appropriate fire alarm levels (NONE, LOW, MEDIUM, HIGH, CRITICAL)
- 📊 **Confidence Scoring**: Provides confidence scores for analysis results
- 🔄 **Real-time Processing**: Continuously polls for new messages and processes them
- 🗄️ **Database Integration**: Updates Supabase with analysis results and alarm levels
- 🐳 **Docker Support**: Easy deployment with Docker and Docker Compose

## Architecture

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

## Setup

### Prerequisites

- Python 3.9+
- Docker (optional)
- Supabase account and project

### Environment Variables

Create a `.env` file with the following variables:

```env
SUPABASE_URL=your-supabase-url-here
SUPABASE_KEY=your-supabase-anon-key-here
PORT=5000
DEBUG=True
MIN_CONFIDENCE_THRESHOLD=0.3
ANALYSIS_BATCH_SIZE=10
```

### Database Setup

1. Run the SQL script in your Supabase SQL editor:
   ```sql
   -- Copy and paste the contents of database_setup.sql
   ```

### Local Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the AI service:
   ```bash
   python app.py
   ```

3. Run the message poller (in another terminal):
   ```bash
   python message_poller.py
   ```

### Docker Deployment

1. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

2. Or build and run individually:
   ```bash
   docker build -t fira-ai-service .
   docker run -p 5000:5000 --env-file .env fira-ai-service
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Analyze Message
```
POST /analyze
Content-Type: application/json

{
  "message_id": "uuid",
  "text": "message text",
  "sender_id": "uuid",
  "receiver_id": "uuid"
}
```

### Get Alarm Status
```
GET /alarm/status
```
Returns current fire alarm level and status.

### Reset Alarm
```
POST /alarm/reset
```
Resets fire alarm level to NONE.

## Fire Alarm Levels

| Level | Description | Keywords |
|-------|-------------|----------|
| NONE | No fire-related content | None |
| LOW | Low-level fire indicators | warm, temperature, heating, cooking |
| MEDIUM | Moderate fire concerns | hot, overheating, spark, electrical |
| HIGH | High fire risk | smoke alarm, fire department, rescue |
| CRITICAL | Emergency fire situation | fire, burning, blaze, evacuate, emergency |

## Message Processing Flow

1. **Message Sent**: FIRA app saves message to Supabase
2. **Polling**: AI service polls for unanalyzed messages
3. **Analysis**: Message text is analyzed for fire-related keywords
4. **Confidence**: Confidence score is calculated based on keyword density
5. **Update**: If confidence > threshold, alarm level is updated
6. **Real-time**: Admin panel receives updates via Supabase real-time

## Configuration

### Confidence Threshold
Set `MIN_CONFIDENCE_THRESHOLD` to control sensitivity:
- `0.1` = Very sensitive (more false positives)
- `0.3` = Balanced (recommended)
- `0.7` = Conservative (fewer false positives)

### Batch Size
Set `ANALYSIS_BATCH_SIZE` to control how many messages are processed at once:
- Smaller values = More frequent updates, higher resource usage
- Larger values = Less frequent updates, lower resource usage

## Monitoring

The service provides several monitoring endpoints:

- Health check: `GET /health`
- Alarm status: `GET /alarm/status`
- Logs: Check Docker logs or console output

## Troubleshooting

### Common Issues

1. **Database Connection**: Verify Supabase URL and key
2. **Message Processing**: Check if messages table has required columns
3. **Alarm Updates**: Verify system_status table exists
4. **Docker Issues**: Check environment variables and port conflicts

### Logs

Check logs for detailed error information:
```bash
docker-compose logs ai-service
docker-compose logs message-poller
```

## Development

### Adding New Keywords

Edit the `FIRE_KEYWORDS` dictionary in `app.py`:

```python
FIRE_KEYWORDS = {
    'CRITICAL': [
        'fire', 'burning', 'blaze', 'flames', 'smoke', 'emergency',
        # Add new keywords here
    ],
    # ... other levels
}
```

### Custom Analysis Logic

Modify the `analyze_message_for_fire_alarm()` function in `app.py` to implement custom analysis logic.

## License

This project is part of the FIRA emergency communication system.























