# FIRA Project Context for Gemini AI Assistant

## Project Overview

**FIRA** (Fire Incident Reporting and Response Application) is a comprehensive emergency management and fire response system. It's a full-stack application built for coordinating fire incident reports from citizens, emergency response assignments from admins, and real-time responder coordination.

### Project Purpose
- Enable citizens to report fire emergencies with photos and details
- Allow admins to view all incidents on a map and assign them to stations/responders
- Facilitate station and responder coordination with real-time location tracking
- Provide AI-powered fire detection and alarm level analysis
- Maintain real-time communication and notifications across all user types

---

## Complete Tech Stack

### Frontend Applications

**Mobile App** (React Native + Expo)
- Framework: React Native 0.81.5 with Expo 54
- Navigation: Expo Router (file-based routing)
- Styling: NativeWind (Tailwind for React Native)
- Maps: React Native Maps with Google Maps integration
- State Management: Context API + AsyncStorage
- Authentication: Supabase Auth + custom auth context
- Key Dependencies: @supabase/supabase-js, react-native-maps, @react-navigation

**Web App** (React + Vite)
- Framework: React 19.1 with TypeScript
- Build Tool: Vite 7.0
- Styling: Tailwind CSS 4.1
- Routing: React Router DOM 7.6
- Maps: React Leaflet
- State Management: Context API
- UI Components: React Icons, Recharts
- Key Dependencies: @supabase/supabase-js, react-router-dom, leaflet

### Backend Services

**Database: Supabase/PostgreSQL**
- Hosted at: `https://wedqhsgrxnvbhklzhnet.supabase.co`
- Features: Real-time subscriptions, authentication, file storage
- 12+ core database tables (users, reports, assignments, notifications, etc.)
- Row-Level Security (RLS) policies for access control

**AI Service** (Flask Python Service) - **CURRENTLY DEPLOYED ON RAILWAY**
- Framework: Flask (Python 3.9)
- Current Deployment: Railway free tier (`https://new-fira-backend.onrender.com/predict`)
- Functionality: Fire detection from images, alarm level analysis
- Features: Image analysis, structure detection, smoke analysis, confidence scoring
- Docker-ready with docker-compose.yml for local development
- Location: `Website/web/ai-service/`

**External APIs**
- Google Maps API (directions, geocoding, places)
- EmailJS (email notifications)
- Render-deployed Chat Analysis Service (`https://ai-alarm-analyzer.onrender.com/analyze-message`)

---

## Database Architecture

### Core Tables

**User Management**
- `admin_users` - System administrators
- `station_users` - Fire stations with coordinates, status, contact info
- `citizen_users` - Citizens submitting reports
- `responder_users` - Responders deployed from stations with real-time location

**Reporting & Assignment**
- `reports` - Fire incidents with image_url, location, AI predictions, alarm levels
- `report_assignments` - Track assignments (pending/accepted/rejected/completed)
- `report_routes` - Report forwarding history with forwarding notes
- `assigned_report_snapshots` - Coordinate snapshots for location reliability

**Communication & Notifications**
- `messages` - Chat with AI analysis metadata
- `notifications` - Unified notification system with priority levels
- `responder_notifications` - Responder-specific real-time alerts
- `system_status` - Current global fire alarm level (NONE/LOW/MEDIUM/HIGH/CRITICAL)

**Administrative**
- `password_reset_codes` - 6-digit codes with 10-minute TTL

---

## Current Deployment Architecture

### Railway Deployment (to be migrated)

**AI Service on Railway**
```
Location: Website/web/ai-service/
Endpoint: https://new-fira-backend.onrender.com/predict
Method: POST
Input Format: FormData with image, location, cause, structures
Output: Fire detection results, structure analysis, confidence, alarm level
```

**Issue**: Railway free tier causes service to sleep after 5 minutes of inactivity, resulting in 404 errors on the first request after sleep period. This impacts user experience when citizens submit fire reports.

---

## Refactoring Goal: Migration to Render

### Objective
Migrate the AI service backend from Railway to Render to:
- Eliminate the free tier sleep timeout issue
- Improve reliability for production emergency response
- Reduce costs compared to Railway's paid tier
- Maintain the same functionality and API contract

### What Needs to Change
1. **Render Deployment Configuration**
   - Create Render-compatible deployment configuration
   - Set up environment variables for Render
   - Configure Docker container for Render

2. **API Endpoint Update**
   - Old: `https://new-fira-backend.onrender.com/predict`
   - New: `https://[new-render-service-url]/predict` (to be determined)
   - API contract remains the same

3. **Environment Variables**
   - Ensure Supabase credentials are properly configured
   - Set up any Render-specific environment variables
   - Verify database connection strings

4. **Dependencies & Python Environment**
   - Review and update requirements.txt as needed
   - Ensure Python 3.9+ compatibility
   - Test all ML/AI dependencies on Render runtime

5. **Monitoring & Logging**
   - Set up logging on Render for debugging
   - Configure error tracking
   - Monitor uptime to ensure no sleep timeouts

### What Should NOT Change
- API endpoint contract (input/output format)
- Flask application logic
- Database schema or connections
- External integrations (Supabase, EmailJS, etc.)

---

## Current AI Service Details

### Location
`Website/web/ai-service/`

### File Structure
```
Website/web/ai-service/
├── app.py                    # Main Flask application
├── message_poller.py         # Database poller service
├── config.py                 # Environment configuration
├── Dockerfile                # Container image definition
├── docker-compose.yml        # Local development setup
├── requirements.txt          # Python dependencies
└── database_setup.sql        # Schema for local testing
```

### Key Components

**app.py** - Main Flask service
- `/predict` endpoint - Receives fire images, returns AI analysis
- `/health` endpoint - Service health check
- Integrates with Supabase for context and logging
- Handles image upload and processing

**message_poller.py** - Background worker
- Polls database for messages containing fire keywords
- Analyzes messages with AI
- Updates system fire alarm level based on analysis

**config.py** - Configuration management
- Loads environment variables for Supabase, API keys
- Stores configuration for database connections
- Manages service endpoints

### Dependencies (requirements.txt)
```
Flask
Supabase Python SDK (@supabase/supabase-py)
Python image processing libraries (PIL/Pillow)
ML model dependencies (specific libraries for fire detection)
Other utilities as needed
```

### Current Render Deployment
- Chat Analysis Service already running on Render at: `https://ai-alarm-analyzer.onrender.com/analyze-message`
- This serves as a reference for how Render is being used in the project

---

## Frontend Integration Points

### How Applications Use AI Service

**Mobile App** (`mobile/app/services/`)
- Calls `/predict` when citizen submits fire photo
- Receives AI analysis (fire confidence, alarm level, etc.)
- Displays results to citizen before report submission

**Web App** (`Website/web/pfira-app/src/services/`)
- Similar integration for fire photo analysis
- Used in admin dashboard to review reports

---

## Deployment Workflow (Current vs Future)

### Current (Railway)
1. Developer pushes code to Railway repository
2. Railway builds Docker container
3. Service deploys to Railway free tier
4. Service sleeps after 5 minutes inactivity → causes 404 errors

### Future (Render)
1. Developer pushes code to Render repository
2. Render builds Docker container from Dockerfile
3. Service deploys to Render with continuous uptime
4. No sleep timeouts → consistent availability

---

## Integration Points Requiring Update

After migration, these components need the new Render endpoint:

1. **Mobile App Configuration** (`mobile/app/config/`)
   - Update API_URL constant for Fire Detection API
   - Test on physical devices and emulators

2. **Web App Configuration** (`Website/web/pfira-app/src/config/`)
   - Update API_URL for Fire Detection API
   - Update environment variables

3. **Frontend Services** (both mobile and web)
   - Update API call URLs to point to new Render endpoint
   - Should be a simple find-and-replace operation

---

## Key Technologies & Dependencies

| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| AI Service Framework | Flask | Latest | To migrate |
| Python Runtime | Python | 3.9+ | To verify |
| Container Platform | Docker | Latest | Existing |
| Database | Supabase/PostgreSQL | Cloud | Unchanged |
| Frontend: Mobile | React Native/Expo | 0.81.5/54 | Unchanged |
| Frontend: Web | React/Vite | 19.1/7.0 | Unchanged |

---

## Important Considerations

### Security
- Review environment variables before deploying to Render
- Ensure API keys are not hardcoded
- Use Render's secrets management system
- Verify Supabase connection string doesn't expose credentials

### Testing Strategy
- Test locally with `docker-compose up` first
- Deploy to Render staging environment
- Test all API endpoints with sample fire images
- Verify database connections work
- Test error handling and timeouts

### Deployment Checklist
- [ ] Create Dockerfile (if not already Render-compatible)
- [ ] Configure Render environment variables
- [ ] Set up build command: `pip install -r requirements.txt`
- [ ] Set up start command: `python app.py` or equivalent
- [ ] Configure health check endpoint
- [ ] Enable auto-deploy from Git
- [ ] Update frontend configurations with new endpoint
- [ ] Test end-to-end fire report submission flow
- [ ] Verify notifications still work
- [ ] Monitor initial deployment for errors

---

## Success Criteria

After migration to Render is complete:
- ✅ Fire Detection API is always available (no sleep timeouts)
- ✅ AI service responds with < 2 second latency
- ✅ Citizens can submit fire reports without 404 errors
- ✅ Admins can assign reports from the AI-analyzed incidents
- ✅ All frontend applications work with new endpoint
- ✅ Error handling is robust for any Render downtime
- ✅ Monitoring and logging capture service health

---

## Additional Context

### Related Files in Project
- **AI Service**: `Website/web/ai-service/`
- **Mobile Frontend**: `mobile/app/` (uses `/predict` endpoint)
- **Web Frontend**: `Website/web/pfira-app/` (uses `/predict` endpoint)
- **Documentation**: Multiple .md files in root documenting implementations
- **Setup Instructions**: `SETUP_INSTRUCTIONS.md` for local development

### Known Issues Resolved by This Migration
- Railway free tier sleep causing 404 errors
- Inconsistent availability for emergency reporting system
- Cost concerns with Railway paid tier

### Related Deployments in Project
- Chat Analysis Service (already on Render): `https://ai-alarm-analyzer.onrender.com/analyze-message`
- Main Database: Supabase cloud
- Frontend: Expo (mobile), deployed via EAS; Web deployed separately

---

## How to Use This Document with Gemini

When requesting Gemini's help with the Render migration, share this document and ask specific questions like:

1. "Help me refactor the Flask app for Render deployment"
2. "Review my Dockerfile for Render compatibility"
3. "How should I configure environment variables for Render?"
4. "Help me set up monitoring and error tracking on Render"
5. "Update the frontend configurations to use the new Render endpoint"
6. "Help me write a deployment guide for the team"

---

## Final Summary

FIRA is a production-grade emergency response system with multiple frontends (mobile + web) and a Python backend service for AI fire analysis. The backend is currently on Railway (causing reliability issues) and needs to be migrated to Render with minimal code changes, primarily affecting deployment configuration and frontend API endpoint URLs.
