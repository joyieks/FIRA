# FIRA Chat System Update - Supabase Integration

## Overview
The FIRA Chat system has been completely updated to use Supabase instead of Firebase, with enhanced features for both Admin and Station users.

## Key Changes

### 1. Data Source Migration
- **Removed**: Firebase completely
- **Added**: Supabase integration
- **Tables Used**: `station_users`, `admin_users`, `responder_users`, `messages`

### 2. Tab Structure Updates
- **Renamed**: "Contacts" → "Unread Messages" in both Admin and Station Fira Chat
- **Admin Fira Chat**: Shows all stations in the system
- **Station Fira Chat**: Shows only users related to that specific station

### 3. Enhanced Chat List Features
Each chat item now displays:
- Profile icon (first letter of station/user name)
- Station/User name
- Last message preview
- Unread message count badge
- User type indicator (Admin/Responder/Station)

### 4. Advanced Filtering System

#### Admin Fira Chat Filters:
- **Search**: Filter by station name
- **Tabs**: Chats (all stations) | Unread Messages (stations with unread messages)

#### Station Fira Chat Filters:
- **Search**: Filter by user name, email, or message content
- **Type Filters**: All | Admin Chat | Responders
- **Tabs**: Chats (all users) | Unread Messages (users with unread messages)

### 5. Real-time Messaging
- Supabase real-time subscriptions for instant message updates
- Automatic message ordering by timestamp
- Read/unread status tracking

## Setup Instructions

### 1. Database Setup
Run the following SQL commands in your Supabase SQL Editor:

#### Create Messages Table:
```sql
-- Run the contents of messages-table.sql
-- This creates the messages table with proper structure and indexes
```

#### Verify Existing Tables:
Ensure these tables exist in your Supabase database:
- `station_users` (already exists)
- `admin_users` (from supabase-tables.sql)
- `responder_users` (from supabase-tables.sql)

### 2. Component Updates
The following components have been updated:

#### Admin Fira Chat (`Afira_chat.jsx`):
- ✅ Supabase integration
- ✅ "Unread Messages" tab
- ✅ Station search functionality
- ✅ Enhanced chat list with last message preview
- ✅ Real-time messaging

#### Station Fira Chat (`Sfira_chat.jsx`):
- ✅ Supabase integration
- ✅ "Unread Messages" tab
- ✅ User search functionality
- ✅ Advanced filtering (All/Admin/Responders)
- ✅ Enhanced chat list with last message preview
- ✅ Real-time messaging

### 3. Configuration
Ensure your Supabase configuration is properly set up in:
```
src/config/supabase.js
```

### 4. Authentication
For Station Fira Chat, the component expects the current station user to be stored in localStorage:
```javascript
// Example structure
{
  "id": "station-uuid",
  "station_name": "Station Name",
  "email": "station@example.com"
}
```

## Features

### Admin Fira Chat Features:
- View all stations in the system
- Search stations by name
- View unread messages from stations
- Send messages to any station
- Real-time message updates
- Emergency mode support

### Station Fira Chat Features:
- View admin users and station responders
- Filter by user type (All/Admin/Responders)
- Search users by name, email, or message content
- View unread messages
- Send messages to admins and responders
- Real-time message updates
- Emergency mode support

### Common Features:
- Profile icons with initials
- Last message preview
- Unread message count badges
- Message timestamps
- Image upload support (placeholder implementation)
- Responsive design
- Modern UI with Tailwind CSS

## Database Schema

### Messages Table:
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'station', 'responder', 'citizen')),
    receiver_type TEXT NOT NULL CHECK (receiver_type IN ('admin', 'station', 'responder', 'citizen')),
    text TEXT,
    image_url TEXT,
    is_emergency BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage Examples

### Admin Sending Message to Station:
```javascript
await supabase
  .from('messages')
  .insert({
    sender_id: 'admin',
    receiver_id: 'station-uuid',
    sender_type: 'admin',
    receiver_type: 'station',
    text: 'Hello station!',
    is_emergency: false,
    is_read: false
  });
```

### Station Sending Message to Admin:
```javascript
await supabase
  .from('messages')
  .insert({
    sender_id: 'station-uuid',
    receiver_id: 'admin-uuid',
    sender_type: 'station',
    receiver_type: 'admin',
    text: 'Hello admin!',
    is_emergency: false,
    is_read: false
  });
```

## Real-time Subscriptions

Both components use Supabase real-time subscriptions to automatically update messages:

```javascript
const subscription = supabase
  .channel(`messages:${userId}:${stationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `or(and(sender_id.eq.${userId},receiver_id.eq.${stationId}),and(sender_id.eq.${stationId},receiver_id.eq.${userId}))`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();
```

## Troubleshooting

### Common Issues:

1. **Messages not loading**: Check Supabase connection and table permissions
2. **Real-time not working**: Verify Supabase real-time is enabled
3. **User not found**: Ensure user tables have proper data
4. **Permission errors**: Check RLS policies in Supabase

### Debug Steps:
1. Check browser console for errors
2. Verify Supabase credentials
3. Test database queries directly in Supabase
4. Check table structure and data

## Future Enhancements

- Full image upload support with Supabase Storage
- Message encryption
- File sharing capabilities
- Voice messages
- Video calls integration
- Advanced message threading
- Message reactions and emojis

## Support

For issues or questions about the updated FIRA Chat system, check:
1. Supabase documentation
2. Component console logs
3. Database query results
4. Network request status

