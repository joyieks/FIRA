# Notification System Setup Guide

## ✅ What's Been Implemented

### 1. **Database Table** (`notifications`)
- **Location**: `Website/web/pfira-app/notifications-table.sql`
- **Features**:
  - UUID primary key
  - User ID and user type (admin, station, responder, citizen)
  - Title, message, type, priority
  - Read status tracking
  - Related report ID for context
  - Timestamps with auto-update triggers
  - Row Level Security (RLS) enabled
  - Optimized indexes for fast queries

### 2. **Notification Creation** (Citizen Fire Report Submission)
- **Location**: `mobile/app/Citizens/CitizenMenu/CitizenStatus/CStatus.jsx`
- **What happens**: When a citizen submits a fire report:
  1. Report is submitted to the API
  2. Upon success, the app fetches all admin users from Supabase
  3. Creates a notification for each admin with:
     - 🔥 Fire alert title
     - Detailed message with reporter name, cause, location, prediction
     - Priority: "urgent" if prediction = "Fire", else "high"
     - Related report ID for tracking
  4. Notifications are inserted into the database
  5. All admin users will receive real-time notifications

### 3. **Web Admin Notifications**
- **Location**: `Website/web/pfira-app/src/components/pages/admin/Notification/Notification.jsx`
- **Features**:
  - ✅ Fetches from Supabase (not localStorage anymore)
  - ✅ Real-time updates via Supabase subscriptions
  - ✅ Mark as read/unread
  - ✅ Delete notifications
  - ✅ Filter by all/unread/read
  - ✅ Priority badges (URGENT for urgent priority)
  - ✅ Color-coded borders based on priority
  - ✅ Formatted timestamps ("5 minutes ago", "2 hours ago", etc.)

### 4. **Mobile Admin Notifications**
- **Location**: `mobile/app/Admin/AdminMenu/AdminNotifications/ANotifications.jsx`
- **Features**:
  - ✅ Fetches from Supabase (not hardcoded data anymore)
  - ✅ Real-time updates via Supabase subscriptions
  - ✅ Pull-to-refresh functionality
  - ✅ Mark as read on tap
  - ✅ Priority badges (URGENT/HIGH)
  - ✅ Color-coded borders based on priority
  - ✅ Empty state when no notifications
  - ✅ Unread count display

## 🔄 How It Works

### Flow Diagram:
```
Citizen Submits Fire Report
         ↓
API Processes Report
         ↓
Success Response
         ↓
Mobile App Fetches All Admin Users
         ↓
Creates Notifications for Each Admin
         ↓
Inserts into Supabase `notifications` table
         ↓
Real-time Subscription Triggers
         ↓
Admin Web & Mobile Apps Receive Notification Instantly
         ↓
Admins See Notification (Unread Badge)
         ↓
Admin Clicks/Taps Notification
         ↓
Marked as Read in Database
```

## 📊 Notification Types & Priorities

### Types:
- `fire_alert` - Fire-related notifications (🔥 red icon)
- `emergency` - Emergency events (🚨 red icon)
- `assignment` - Task assignments (📄 blue icon)
- `system` - System messages (⚙️ gray icon)
- `user_action` - User actions (👤 purple icon)
- `info` - General info (ℹ️ gray icon)

### Priorities:
- `urgent` - Critical, requires immediate action (Red border, "URGENT" badge)
- `high` - Important (Orange border, "HIGH" badge on mobile)
- `normal` - Standard notifications (Blue border)
- `low` - Low priority (Green border)

## 🧪 Testing the System

### Test Steps:
1. **Setup**:
   - Ensure `notifications` table exists in Supabase (run `notifications-table.sql`)
   - Ensure at least one admin user exists in `admin_users` table

2. **Submit a Fire Report**:
   - Login as a citizen on mobile app
   - Go to "Status" tab
   - Click "Report Emergency"
   - Fill in cause, upload image, pick location
   - Submit the report

3. **Check Admin Notifications**:
   - **Web**: Login as admin → Go to Notifications page
   - **Mobile**: Login as admin → Go to Notifications tab
   - You should see a new notification with:
     - 🔥 Title: "New Fire Report Submitted"
     - Details about the report
     - "URGENT" or "HIGH" badge
     - Red/Orange border
     - Unread indicator (red dot on mobile, "New" badge on web)

4. **Mark as Read**:
   - Click/tap the notification
   - The "New" badge should disappear
   - Notification should become slightly transparent

5. **Real-time Test**:
   - Keep admin notification page open
   - Submit another fire report from a different device/browser
   - Notification should appear **instantly** without refreshing

## 🚀 Next Steps (Future Enhancements)

### For Stations:
- Create notifications when reports are assigned to stations
- Create notifications when reports are forwarded to stations
- Display in `Website/web/pfira-app/src/components/pages/stations/` and `mobile/app/Stations/`

### For Responders:
- Create notifications when responders are assigned to incidents
- Create notifications for status updates
- Display in responder notification pages

### For Citizens:
- Create notifications when their reports are updated
- Create notifications when reports are resolved
- Display in citizen notification pages

## 📝 Important Notes

1. **RLS Policy**: Currently using permissive policy (`USING (true)`) for development. Consider implementing user-specific policies in production:
   ```sql
   CREATE POLICY "Users can view their own notifications"
   ON notifications FOR SELECT
   USING (auth.uid() = user_id);
   ```

2. **Performance**: Indexes are optimized for:
   - User-specific queries
   - Unread notifications
   - Recent notifications (by `created_at`)
   - Priority filtering

3. **Real-time Subscriptions**: Each user has their own subscription channel (`notifications:admin:{user_id}`) to receive only their notifications.

4. **Error Handling**: Notification creation failures don't block the main flow (fire report submission still succeeds even if notifications fail).

## 🐛 Troubleshooting

**Problem**: Notifications not appearing
- **Check 1**: Verify `notifications` table exists in Supabase
- **Check 2**: Check browser/app console for errors
- **Check 3**: Verify admin user ID is correct
- **Check 4**: Check if RLS policies allow the query

**Problem**: Real-time not working
- **Check 1**: Verify Supabase subscription is active (check console logs)
- **Check 2**: Ensure Realtime is enabled in Supabase dashboard
- **Check 3**: Check network connection

**Problem**: Notifications created for wrong users
- **Check 1**: Verify `admin_users` table has correct data
- **Check 2**: Check the filter in notification creation code

