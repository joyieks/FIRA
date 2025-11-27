# Real-Time Status Change Setup Guide

## Changes Made

### 1. Station_Overall.jsx (Web Station)
✅ Notification titles simplified for easier detection:
- **Under Control**: `"Report Acknowledged"` (was: "Your Report Has Been Acknowledged! 🎉")
- **Fire Out**: `"Fire Resolved"` (was: "Fire Incident Resolved ✅")
- **Type**: Set to `"status_change"` for easy filtering

### 2. CStatus.jsx (Citizen Mobile)
✅ Enhanced real-time listener with:
- Better notification detection (checks title AND type)
- Extensive console logging for debugging
- Immediate local state updates
- Automatic modal triggering
- Modal tracking by `reportId:status` combination

## How It Works

### Flow:
1. **Station changes status** → Calls Railway API `/update_report_status`
2. **Notification created** → Inserts into Supabase `notifications` table
3. **Real-time trigger** → Citizen's Supabase subscription detects INSERT
4. **Fetch updated data** → Gets latest report from Railway API
5. **Update local state** → Updates `yourReports` immediately
6. **Show modal** → Displays acknowledgment or fire out modal

## Testing Steps

### 1. Open Browser Console (Station Side)
```
Right-click → Inspect → Console tab
```

### 2. Open Metro Console (Citizen Side)
```
Look at terminal where `npm start` is running
```

### 3. Change Report Status
In Station_Overall.jsx, change a report to "Under Control"

### 4. Watch Console Logs

**Station Console should show:**
```
🔔 Creating notifications for status change: {reportId, oldStatus, newStatus}
✅ Created citizen notification
✅ Notifications created successfully
```

**Citizen Metro should show:**
```
📡 Setting up real-time status change listener for user: [uid]
📡 Real-time subscription status: SUBSCRIBED
📱 NEW NOTIFICATION RECEIVED: {title, type, related_report_id}
✅ STATUS CHANGE DETECTED for report: [id]
🔄 Fetching updated report from API...
✅ Found updated report: {id, status, user_id}
💫 Updating local state with new status: Under Control
✅ Local state updated
🎯 Checking modal key: [id]:Under Control Already shown? false
🎉 SHOWING ACKNOWLEDGMENT MODAL NOW!
```

## Troubleshooting

### Issue: No notification received
**Check:**
1. Supabase RLS policies allow INSERT on notifications table
2. User ID matches in both notification and current user
3. Notification has `user_type: 'citizen'`
4. Real-time is enabled in Supabase project

### Issue: Notification received but modal not showing
**Check console for:**
- "Report does not belong to current user" → Wrong user_id in report
- "Not a status change notification" → Title/type doesn't match
- "Already shown? true" → Modal already displayed for this status

### Issue: State updates but modal doesn't appear
**Check:**
- `shownModalKeys` Set might have the key already
- Modal state variables might not be updating
- Component might not be mounted

## Supabase Configuration

### Required RLS Policy for notifications table:
```sql
-- Allow citizens to read their own notifications
CREATE POLICY "Citizens can read own notifications"
ON notifications FOR SELECT
USING (user_type = 'citizen' AND user_id = auth.uid());

-- Allow anonymous inserts for notification creation (from stations)
CREATE POLICY "Allow notification creation"
ON notifications FOR INSERT
WITH CHECK (true);
```

### Enable Real-time:
1. Go to Supabase Dashboard
2. Database → Replication
3. Enable real-time for `notifications` table
4. Enable INSERT events

## Success Indicators

✅ **Working Correctly When:**
- Status changes appear on citizen screen within 1-2 seconds
- Modal pops up automatically without refresh
- Console shows all debug logs in sequence
- Each status change shows modal exactly once

❌ **Not Working If:**
- Need to pull-to-refresh to see changes
- Modal never appears
- Console shows "Not a status change notification"
- Real-time subscription shows "CLOSED" or "CHANNEL_ERROR"

## Key Files Modified
- `Website/web/pfira-app/src/components/pages/stations/Station Overall/Station_Overall.jsx`
- `mobile/app/Citizens/CitizenMenu/CitizenStatus/CStatus.jsx`
