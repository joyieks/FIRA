# OpenAI Integration Guide for FIRA Chat System

## Overview
This guide explains the OpenAI API integration that analyzes chat messages to suggest appropriate fire alarm levels.

## Features Implemented

### 1. Database Schema Update
- Added `ai_suggested_alarm` field to the `messages` table
- Created index for better performance
- Run the SQL script: `add-ai-alarm-field.sql`

### 2. OpenAI Service
- **Web App**: `src/services/openaiService.js`
- **Mobile App**: `app/services/openaiService.js`
- Analyzes messages using GPT-4o-mini model
- Returns structured JSON with suggested alarm level

### 3. Chat Integration
Updated all chat components to automatically analyze messages:
- **Station Chat**: `src/components/pages/stations/Station Chat/Sfira_chat.jsx`
- **Admin Chat**: `src/components/pages/admin/AdminChat/Afira_chat.jsx`
- **Mobile Responder Chat**: `mobile/app/Responders/RespondersMenu/RespondersChat/RChatPage.jsx`

### 4. Admin Interface Display
- **Overall Dashboard**: `src/components/pages/admin/Overall/Overall.jsx`
- Displays AI suggested alarms alongside regular fire reports
- Color-coded status indicators for AI suggestions

## Setup Instructions

### 1. Install Dependencies
```bash
# Web App
cd FIRA/Website/web/pfira-app
npm install

# Mobile App
cd FIRA/mobile
npm install
```

### 2. Environment Variables

#### Web App
Create `.env` file in `FIRA/Website/web/pfira-app/`:
```
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

#### Mobile App
Create `.env` file in `FIRA/mobile/`:
```
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Database Setup
Run the SQL script in your Supabase SQL Editor:
```sql
-- Run the contents of add-ai-alarm-field.sql
```

### 4. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API section
4. Create a new API key
5. Add it to your environment files

## How It Works

### 1. Message Analysis
When a user sends a message in any chat:
1. Message is saved to database
2. AI service analyzes the message text
3. If fire-related content is detected, suggests alarm level
4. Updates message with `ai_suggested_alarm` field

### 2. AI Analysis Rules
The AI analyzes messages based on:
- Number of houses affected
- High-rise building involvement
- Area scale (significant/major)
- Maps to appropriate fire alarm level

### 3. Alarm Level Mapping
- **First Alarm**: 2–3 houses
- **Second Alarm**: 4–5 houses
- **Third Alarm**: 6–7 houses OR high-rise affected
- **Fourth Alarm**: 8–9 houses OR high-rise affected
- **Fifth Alarm**: 10–11 houses OR high-rise affected
- **Task Force Alpha**: ~12 houses
- **Task Force Bravo**: ~15 houses
- **Task Force Charlie**: significant area affected
- **Task Force Delta Echo Hotel India**: significant area affected
- **General Alarm**: major area affected

### 4. Admin Display
- AI suggestions appear in the Overall dashboard
- Status shows as "AI Suggested"
- Reporter shows as "AI Analysis (sender_type)"
- Location shows as "Chat System"

## Testing

### 1. Test Messages
Try sending these test messages in chat:
- "Fire at 3 houses on Main Street" → Should suggest "First Alarm"
- "High-rise building on fire downtown" → Should suggest "Third Alarm"
- "Massive fire affecting entire neighborhood" → Should suggest "General Alarm"
- "Hello, how are you?" → Should not suggest any alarm

### 2. Check Admin Interface
1. Go to Admin → Overall
2. Look for entries with "AI Suggested" status
3. Verify alarm levels are displayed correctly

## Error Handling

### 1. API Failures
- AI analysis errors are logged but don't affect message sending
- Users can still send messages even if AI analysis fails
- Graceful degradation ensures system reliability

### 2. Invalid Responses
- If OpenAI returns invalid JSON, defaults to no suggestion
- Error logging helps with debugging
- System continues to function normally

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- API keys are client-side (consider server-side implementation for production)

## Troubleshooting

### 1. AI Analysis Not Working
- Check API key is correctly set
- Verify OpenAI account has credits
- Check browser console for errors

### 2. Messages Not Updating
- Check Supabase connection
- Verify database permissions
- Check real-time subscriptions

### 3. Admin Interface Not Showing AI Suggestions
- Check if messages have `ai_suggested_alarm` field
- Verify database query is working
- Check console for errors

## Future Enhancements

1. **Server-side Processing**: Move AI analysis to backend for better security
2. **Batch Processing**: Analyze multiple messages at once
3. **Learning**: Improve suggestions based on user feedback
4. **Notifications**: Alert admins when high-priority alarms are suggested
5. **Analytics**: Track AI suggestion accuracy and usage

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify all setup steps are completed
3. Test with simple messages first
4. Check OpenAI API status and credits

