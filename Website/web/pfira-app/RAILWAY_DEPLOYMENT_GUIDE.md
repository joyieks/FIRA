# Railway Deployment Guide for Project FIRA AI Service

## 🚨 Current Issue
The Railway backend at `https://chatanalysisapi-production.up.railway.app` is not responding. This is preventing AI analysis from working in your chat system.

## 🛠️ Solution Steps

### 1. Fix Database Schema First
Before redeploying, run the SQL script to add missing AI columns:

```sql
-- Run this in your Supabase SQL Editor
-- File: fix-ai-schema.sql
```

### 2. Redeploy Railway Backend

#### Option A: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to AI service directory
cd FIRA/Website/web/ai-service

# Deploy to Railway
railway up

# Set environment variables (if needed)
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_KEY=your_supabase_key
```

#### Option B: Using Railway Dashboard
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Find your `chatanalysisapi-production` project
3. Click "Redeploy" or "Deploy Latest"
4. Check the deployment logs for any errors

#### Option C: Manual Deployment
1. Go to Railway Dashboard
2. Create a new project
3. Connect your GitHub repository
4. Set the root directory to `FIRA/Website/web/ai-service`
5. Deploy

### 3. Verify Deployment
After deployment, test the endpoints:

```bash
# Health check
curl https://your-new-railway-url.railway.app/health

# Test analysis
curl -X POST https://your-new-railway-url.railway.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"message": "fire emergency test"}'
```

### 4. Update Frontend Configuration
Once you have the new Railway URL, update the frontend:

```javascript
// In src/services/aiService.js
const CHAT_ANALYSIS_URL = 'https://your-new-railway-url.railway.app/analyze';
```

## 🔍 Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure Supabase credentials are correct
2. **CORS Issues**: The Flask app has CORS enabled, but check if Railway is blocking requests
3. **Port Issues**: Railway should auto-detect the port, but verify in logs
4. **Dependencies**: Ensure all Python packages are in requirements.txt

### Check Railway Logs:
1. Go to Railway Dashboard
2. Select your project
3. Click on "Deployments"
4. Click on the latest deployment
5. Check the logs for errors

## 📋 Required Environment Variables
Make sure these are set in Railway:
- `SUPABASE_URL` (if not hardcoded)
- `SUPABASE_KEY` (if not hardcoded)
- `PORT` (Railway usually sets this automatically)

## 🧪 Testing the Integration
After deployment, test the full flow:

1. Open your chat application
2. Send a message with fire-related keywords
3. Check browser console for AI analysis logs
4. Verify the message gets updated with AI analysis in the database

## 📞 Support
If you continue having issues:
1. Check Railway deployment logs
2. Verify Supabase connection from the backend
3. Test the endpoints directly with curl/Postman
4. Check browser network tab for failed requests


