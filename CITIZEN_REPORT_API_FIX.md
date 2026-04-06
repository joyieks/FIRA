# Citizen Report Submission Error - API 404 Fix

## Problem
Error: `API Response status: 404` - "Application not found"

The API endpoint `https://new-fira-backend.onrender.com/predict` is returning 404.

## Possible Causes

1. **Railway API is down or sleeping** - Railway free tier apps sleep after inactivity
2. **API endpoint changed** - The `/predict` endpoint might have been renamed or removed
3. **Different API URL needed** - The production URL might be different

## Solutions

### Option 1: Wake Up Railway API
Railway free tier apps sleep after 5 minutes of inactivity. Try:
1. Visit the API URL in browser: `https://new-fira-backend.onrender.com/predict`
2. Wait 30 seconds for it to wake up
3. Try submitting the report again

### Option 2: Check Railway Dashboard
1. Go to Railway dashboard: https://railway.app/
2. Check if the service is running
3. Check the deployment logs
4. Verify the endpoint URLs

### Option 3: Update API Endpoint
If the endpoint changed, update line 10 in:
`mobile/app/Citizens/CitizenMenu/CitizenStatus/CStatus.jsx`

Common endpoint patterns:
- `/api/predict`
- `/v1/predict`
- `/submit_report`
- `/create_report`

### Option 4: Use Alternative API
If the Railway API is permanently down, you may need to:
1. Redeploy the API to Railway
2. Use a different hosting service
3. Update all API URLs in the codebase

## Files That Use This API

1. `mobile/app/Citizens/CitizenMenu/CitizenStatus/CStatus.jsx` - Line 10
2. `mobile/app/Citizens/CitizenMenu/CitizenMap/CMap.jsx` - Lines 43-45

## Quick Test

Test if API is accessible:
```bash
curl https://new-fira-backend.onrender.com/predict
```

Or visit in browser and check if you get a response.
