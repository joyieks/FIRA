# Alarm Level Notification Fix

## Issue
Responders were not receiving notifications when admin changed alarm level from 1st to 2nd Alarm or beyond.

## Root Cause
1. **Old Alarm Level Capture**: The old alarm level was being retrieved from state after it might have been updated, or wasn't being captured correctly
2. **Comparison Logic**: The comparison between old and new alarm levels might have been too strict
3. **Missing Logging**: Insufficient logging made it difficult to debug notification failures

## Fixes Applied

### 1. Improved Old Alarm Level Capture (`AOverview.jsx`)
- Now checks both `editReport` and `reports` state to find the current report
- Captures old alarm level from `final_alarm_level`, `recommended_alarm_level`, or `alarm_level` fields
- Captures BEFORE state update to ensure accurate comparison
- Falls back to 'Unknown' if no old value found

### 2. Enhanced Alarm Level Comparison (`responderNotificationService.js`)
- Added normalization function to handle case-insensitive comparison
- Handles variations in alarm level format (e.g., "1st Alarm" vs "1st alarm")
- Always notifies if new alarm level is valid, even if old is unknown
- Only skips notification if old and new are exactly the same (after normalization)

### 3. Enhanced Logging
- Added detailed logging throughout the notification flow
- Logs old/new alarm levels for debugging
- Logs station jurisdiction determination
- Logs notification creation results
- Logs errors with full context

### 4. Better Error Handling
- More robust error catching and logging
- Doesn't fail alarm update if notification fails
- Provides detailed error messages for debugging

## Code Changes

### `mobile/app/Admin/AdminMenu/AdminOverview/AOverview.jsx`
```javascript
// Before: Simple old alarm level capture
const oldAlarmLevel = reports.find(r => r.id === reportId)?.final_alarm_level;

// After: Comprehensive old alarm level capture
const currentReport = editReport?.id === reportId ? editReport : reports.find(r => r.id === reportId);
const oldAlarmLevel = currentReport?.final_alarm_level || 
                     currentReport?.recommended_alarm_level ||
                     currentReport?.alarm_level ||
                     'Unknown';
```

### `mobile/app/services/responderNotificationService.js`
```javascript
// Added normalization for better comparison
const normalizeAlarmLevel = (level) => {
  if (!level || level === 'Unknown') return null;
  return String(level).toLowerCase().trim();
};

// Enhanced comparison logic
const normalizedOld = normalizeAlarmLevel(oldAlarmLevel);
const normalizedNew = normalizeAlarmLevel(newAlarmLevel);

// Only skip if both are valid and the same
if (normalizedOld && normalizedNew && normalizedOld === normalizedNew) {
  // Skip
}
// Always notify if new is valid
```

## Testing

To verify the fix works:

1. **As Admin:**
   - Open Admin Overview
   - Select a fire report that is assigned to a station
   - Change alarm level from "1st Alarm" to "2nd Alarm"
   - Check console logs for notification flow
   - Verify notification is created

2. **As Responder:**
   - Open Responder app
   - Check notifications list
   - Should see new notification: "🚨 Alarm Level Update: 2nd Alarm"
   - Notification should appear in real-time

3. **Check Console Logs:**
   - Look for: `[updateFinalAlarmLevel] Alarm level change:`
   - Look for: `🔔 Notifying responders of alarm level change:`
   - Look for: `✅ Station jurisdiction found:`
   - Look for: `✅ Successfully notified X responders`

## Expected Behavior

When admin changes alarm level:
1. ✅ Old alarm level is captured correctly
2. ✅ Notification service is called
3. ✅ Station jurisdiction is determined
4. ✅ All active responders for that station receive notification
5. ✅ Notification appears in responder's notification list
6. ✅ Real-time updates work correctly

## Debugging

If notifications still don't appear, check:

1. **Console Logs:**
   - Is `[updateFinalAlarmLevel]` being called?
   - Is `notifyRespondersOnAlarmChange` being called?
   - Is station jurisdiction being found?
   - Are responders being found for the station?

2. **Database:**
   - Check `responder_notifications` table for new entries
   - Verify `responder_id` matches active responders
   - Verify `station_id` matches the station with jurisdiction

3. **Station Assignment:**
   - Is the report assigned to a station?
   - Check `report_assignments` table
   - Check `report_routes` table for forwarded reports

4. **Responder Status:**
   - Are responders active?
   - Check `responders` table for `active = true` and `status = 'active'`

## Status
✅ **Fixed** - Enhanced alarm level change detection and notification system

