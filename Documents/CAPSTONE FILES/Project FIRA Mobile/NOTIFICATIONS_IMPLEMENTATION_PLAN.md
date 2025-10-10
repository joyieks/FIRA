# Functional Notifications System - Implementation Plan

## Current State Analysis

### What's Currently Implemented:
1. **Admin (Web)**: Uses localStorage - not persistent across devices
2. **Admin (Mobile)**: Hard-coded mock data - not real
3. **Station (Web)**: Uses localStorage - not persistent
4. **Station (Mobile)**: Hard-coded mock data  
5. **Responder (Web)**: Not implemented
6. **Responder (Mobile)**: Hard-coded mock data
7. **Citizen (Web)**: Not implemented
8. **Citizen (Mobile)**: Hard-coded mock data

### Database Tables:
- `responder_notifications` - EXISTS but not being used
- Other user type notifications - DON'T EXIST

## Implementation Plan

### Phase 1: Database Setup ✅

**Create unified notifications table** that works for all user types:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'station', 'responder', 'citizen')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fire_alert', 'assignment', 'system', 'user_action', 'emergency', 'info')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  related_report_id TEXT,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Phase 2: Backend Triggers

**Auto-generate notifications for events:**
1. New fire report → Notify admin
2. Report assigned to station → Notify station
3. Station notifies responders → Create responder notifications
4. Report status changes → Notify relevant parties

### Phase 3: Frontend Updates

**Update all notification components to:**
1. Fetch from Supabase instead of localStorage/mock data
2. Real-time updates using Supabase subscriptions
3. Mark as read functionality
4. Delete/clear notifications
5. Filter by type/priority

### Phase 4: Notification Creation Points

**Where notifications should be created:**

1. **Fire Report Created** → Admin notification
2. **Report Assigned** → Station/Responder notification  
3. **Report Forwarded** → Target station notification
4. **Status Changed** → All assigned parties notification
5. **Responder Response** → Station notification
6. **System Events** → Admin notification
7. **New User Registration** → Admin notification

## Files to Update

### Database:
- `Website/web/pfira-app/notifications-table.sql` (NEW)
- `Website/web/pfira-app/supabase-tables.sql` (UPDATE)

### Web Admin:
- `Website/web/pfira-app/src/components/pages/admin/Notification/Notification.jsx`
- `Website/web/pfira-app/src/components/pages/admin/Alayout/AdminLayout.jsx`

### Web Station:
- `Website/web/pfira-app/src/components/pages/stations/Snotification/Station_Notification.jsx`
- `Website/web/pfira-app/src/components/pages/stations/Slayout/StationLayout.jsx`

### Mobile Admin:
- `mobile/app/Admin/AdminMenu/AdminNotifications/ANotifications.jsx`

### Mobile Station:
- `mobile/app/Stations/StationsMenu/StationsNotifications/SNotifications.jsx`

### Mobile Responder:
- `mobile/app/Responders/RespondersMenu/RespondersNotifications/RNotifications.jsx`

### Mobile Citizen:
- `mobile/app/Citizens/CitizenMenu/CitizenNotifications/CNotifications.jsx`

## Implementation Priority

1. **HIGH**: Create database table
2. **HIGH**: Update web admin notifications
3. **HIGH**: Update web station notifications
4. **MEDIUM**: Update mobile notifications
5. **MEDIUM**: Add notification triggers
6. **LOW**: Real-time subscriptions

## Expected Features After Implementation

✅ **Real Database Storage** - All notifications persist in Supabase  
✅ **Cross-Device Sync** - Same notifications on web and mobile  
✅ **Mark as Read** - Track read status  
✅ **Delete/Clear** - Manage notification list  
✅ **Priority Levels** - urgent, high, normal, low  
✅ **Type Filtering** - Filter by notification type  
✅ **Real-time Updates** - New notifications appear instantly  
✅ **Action Links** - Click to go to related report/page  

## Testing Checklist

- [ ] Admin receives notification when new fire report created
- [ ] Station receives notification when report assigned
- [ ] Responder receives notification when station notifies them
- [ ] Notifications appear on both web and mobile
- [ ] Mark as read works
- [ ] Delete notification works
- [ ] Unread count badge updates correctly
- [ ] Notifications persist after logout/login
- [ ] Real-time: New notification appears without refresh

Would you like me to proceed with full implementation?

