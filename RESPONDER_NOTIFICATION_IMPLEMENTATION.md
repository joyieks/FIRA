# Responder Notification System - Implementation Complete

## Overview
Implemented automatic notifications for responders when fire incident reports under their station's jurisdiction have status changes or alarm level updates.

## Features Implemented

### 1. Status Change Notifications
Responders are automatically notified when a fire report status changes:
- **On Going** → **Under Control**
- **Under Control** → **Fire Out**
- **On Going** → **Fire Out**

### 2. Alarm Level Change Notifications
Responders are automatically notified when alarm levels change:
- 1st Alarm → 2nd Alarm
- 2nd Alarm → 3rd Alarm
- Any alarm level increase
- Task Force activations
- General Alarm activations

## Implementation Details

### Files Created

#### 1. `mobile/app/services/responderNotificationService.js`
A comprehensive service module that handles:
- **Station Jurisdiction Detection**: Determines which station has jurisdiction over a report using:
  1. Direct assignment (from `report_assignments` table)
  2. Forwarded reports (from `report_routes` table)
  3. Location-based proximity (if coordinates available)
- **Responder Retrieval**: Fetches all active responders for a station
- **Notification Creation**: Creates notifications in `responder_notifications` table

**Key Functions:**
- `notifyRespondersOnStatusChange()` - Handles status change notifications
- `notifyRespondersOnAlarmChange()` - Handles alarm level change notifications
- `getStationWithJurisdiction()` - Determines station jurisdiction
- `getStationResponders()` - Gets all active responders for a station
- `createResponderNotifications()` - Creates notifications in database
- `fetchReportData()` - Fetches report data from API

### Files Modified

#### 1. `mobile/app/Stations/StationsMenu/StationsStatus/SStatus.jsx`
- Added import for notification service
- Updated status change handler to trigger notifications after successful status update
- Notifications are sent asynchronously and don't block the status update

#### 2. `mobile/app/Admin/AdminMenu/AdminOverview/AOverview.jsx`
- Added import for notification service
- Updated `updateReportStatus()` to trigger notifications
- Updated `updateFinalAlarmLevel()` to trigger notifications
- Both functions now notify responders after successful updates

## How It Works

### Status Change Flow

```
1. Station/Admin updates report status
   ↓
2. Status update sent to API
   ↓
3. API confirms successful update
   ↓
4. Notification service determines station jurisdiction
   ↓
5. Service fetches all active responders for that station
   ↓
6. Notifications created in responder_notifications table
   ↓
7. Responders receive notifications via real-time subscription
```

### Alarm Level Change Flow

```
1. Admin updates final alarm level
   ↓
2. Alarm level update sent to API
   ↓
3. API confirms successful update
   ↓
4. Notification service determines station jurisdiction
   ↓
5. Service fetches all active responders for that station
   ↓
6. Notifications created with appropriate priority:
   - High priority for 1st-2nd Alarm
   - Urgent priority for 3rd+ Alarm, Task Force, General Alarm
   ↓
7. Responders receive notifications via real-time subscription
```

## Station Jurisdiction Logic

The system uses a priority-based approach to determine which station has jurisdiction:

1. **Direct Assignment** (Highest Priority)
   - Checks `report_assignments` table
   - Looks for `assignee_type = 'station'`
   - Uses most recent assignment

2. **Forwarded Reports** (Medium Priority)
   - Checks `report_routes` table
   - Looks for `target` starting with `'station:'`
   - Uses most recent forward

3. **Location Proximity** (Fallback)
   - If report has coordinates, finds closest station
   - Only used if within 50km
   - Calculates distance using Haversine formula

## Notification Details

### Status Change Notifications

**Title Format:** `🔥 Status Update: {New Status}`

**Message Includes:**
- Status change description
- Location information
- Report ID

**Priority:**
- `high` for "Under Control"
- `normal` for "Fire Out"

### Alarm Level Change Notifications

**Title Format:** `🚨 Alarm Level Update: {New Alarm Level}`

**Message Includes:**
- Old and new alarm levels (if available)
- Location information
- Report ID
- Response instructions

**Priority:**
- `high` for 1st-2nd Alarm
- `urgent` for 3rd+ Alarm, Task Force, General Alarm

## Database Schema

Notifications are stored in the `responder_notifications` table:

```sql
CREATE TABLE responder_notifications (
  id UUID PRIMARY KEY,
  responder_id UUID NOT NULL,
  station_id UUID NOT NULL,
  fire_report_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Real-Time Updates

Responders receive notifications in real-time through:
- **Supabase Real-time Subscriptions**: Already implemented in `RNotifications.jsx`
- **Polling**: 2-second polling interval as fallback
- **App State Changes**: Notifications reload when app comes to foreground

## Error Handling

- Notification failures don't block status/alarm updates
- Errors are logged but don't affect user experience
- Graceful fallbacks if station jurisdiction cannot be determined
- Handles missing report data gracefully

## Testing Checklist

- [x] Status change from "On Going" to "Under Control" creates notifications
- [x] Status change from "Under Control" to "Fire Out" creates notifications
- [x] Alarm level change creates notifications
- [x] Notifications sent to all active responders of station
- [x] Station jurisdiction correctly determined from assignments
- [x] Station jurisdiction correctly determined from forwarded reports
- [x] Notifications appear in responder notification list
- [x] Real-time updates work correctly
- [x] Priority levels set correctly based on alarm level
- [x] Error handling doesn't break status/alarm updates

## Usage

### For Stations
1. Navigate to Station Status screen
2. Select a fire report
3. Change status using status buttons
4. Responders automatically receive notifications

### For Admins
1. Navigate to Admin Overview
2. Select a fire report
3. Change status or alarm level
4. Responders automatically receive notifications

### For Responders
1. Notifications appear automatically in notification list
2. Real-time updates show new notifications immediately
3. Tap notification to mark as read
4. View notification details including location and report ID

## Future Enhancements

Potential improvements:
1. **Notification Preferences**: Allow responders to configure which notifications they receive
2. **Push Notifications**: Add push notification support for when app is closed
3. **Notification History**: Keep history of all notifications
4. **Batch Notifications**: Group multiple updates into single notification
5. **Custom Messages**: Allow stations to add custom messages to notifications

## Notes

- Notifications are created asynchronously and don't block the main update operation
- If notification creation fails, the status/alarm update still succeeds
- Station jurisdiction is determined dynamically for each notification
- Only active responders receive notifications
- Notifications include full context (location, report ID, etc.)

---

**Status:** ✅ Implementation Complete  
**Date:** January 2025  
**Version:** 1.0

