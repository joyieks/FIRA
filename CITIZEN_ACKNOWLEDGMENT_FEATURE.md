# Citizen Report Acknowledgment Feature 🎉

## Overview
This feature provides citizens with immediate feedback when their fire reports are acknowledged by the command center. When a station changes a report's status from "On Going" to "Under Control", the citizen who submitted the report receives:

1. **A stylish pop-up modal** with celebration animation
2. **A notification card** in their notifications tab

---

## 📱 Features Implemented

### 1. Acknowledgment Modal
**Location:** `mobile/app/Citizens/CitizenMenu/CitizenMap/AcknowledgmentModal.jsx`

**Design:**
- ✅ Beautiful gradient design with green success theme
- ✅ Check-circle icon with glow effect
- ✅ Clear title: "Your Report Has Been Acknowledged!"
- ✅ Celebration emoji (🎉)
- ✅ Report location display
- ✅ Status badge showing "Under Control"
- ✅ "Continue" button with gradient and arrow icon

**When it appears:**
- Automatically pops up when the citizen receives an acknowledgment notification
- Only shows once per report (uses `processedAcknowledgmentIds` to prevent duplicates)

### 2. Real-time Notification Detection
**Location:** `mobile/app/Citizens/CitizenMenu/CitizenMap/CMap.jsx` (lines 257-321)

**How it works:**
- Subscribes to Supabase `notifications` table for the current citizen user
- Listens for new notifications with type containing "Acknowledged"
- Fetches the full report data to get location information
- Displays the modal with the report location

### 3. Notification Card Display
**Location:** `mobile/app/Citizens/CitizenMenu/CitizenNotifications/CNotifications.jsx`

**Special styling for acknowledgment notifications:**
- ✨ Light green background (#ecfdf5) for unread acknowledgments
- ✅ Green border (2px) around the card
- 🏷️ "NEW" badge in the top-right corner
- 🎉 Special subtitle: "Your Report Acknowledged!"
- 💚 Green text color for title and message
- ⭐ Enhanced shadow for prominence

### 4. Backend Notification Creation
**Location:** `mobile/app/services/universalNotificationService.js`

**Notification creation logic:**
When a station changes status to "Under Control":
```javascript
citizenTitle = 'Your Report Has Been Acknowledged! 🎉';
citizenMessage = 'Great news! Your fire report has been acknowledged and is now Under Control.\n\n[Report Details]';
citizenType = 'user_action';
```

The service:
- ✅ Finds the citizen who created the report using `user_id` field
- ✅ Creates a special acknowledgment notification in Supabase
- ✅ Includes the report ID for navigation
- ✅ Sets priority to "high" for visibility

---

## 🔄 User Flow

### For Citizens:

1. **Submit Report**
   - Citizen takes photo and submits fire report
   - Report includes their `user_id` (from auth context)
   - Report status is set to "On Going" by default

2. **Station Acknowledges**
   - Station user views the report
   - Changes status from "On Going" → "Under Control"
   - System triggers notification creation

3. **Citizen Receives Notification**
   - Real-time notification appears in Supabase `notifications` table
   - Citizen's device receives the notification via subscription
   - Notification includes report location and details

4. **Modal Appears**
   - If citizen is on the Map screen, modal pops up immediately
   - Shows celebratory message with report location
   - Citizen clicks "Continue" to dismiss

5. **Notification Card**
   - Notification appears in Notifications tab
   - Special green styling makes it stand out
   - Clicking it navigates to the report on the map

---

## 🔧 Technical Implementation

### Real-time Subscription (CMap.jsx)
```javascript
const channel = supabase
  .channel(`citizen-acknowledgment:${currentUser.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${currentUser.id}&user_type=eq.citizen`
  }, async (payload) => {
    const notification = payload.new;
    if (notification.title && notification.title.includes('Acknowledged')) {
      // Fetch report location
      // Show modal
    }
  })
  .subscribe();
```

### Notification Creation (universalNotificationService.js)
```javascript
// Special handling for "Under Control" status
if (newStatus === 'Under Control') {
  citizenTitle = 'Your Report Has Been Acknowledged! 🎉';
  citizenMessage = `Great news! Your fire report has been acknowledged and is now Under Control.\n\n${message}`;
  citizenType = 'user_action';
}

await createNotification(
  citizen.id,
  'citizen',
  citizenTitle,
  citizenMessage,
  citizenType,
  priority,
  reportId
);
```

### Citizen ID Resolution
The service tries multiple methods to find the citizen:
1. ✅ Check `reportData.user_id` (primary method)
2. ✅ Check `reportData.reporter_id` (fallback)
3. ✅ Look up by email in `citizens` table
4. ✅ Look up by email in `citizen_users` table
5. ✅ Check `auth.users` table (final fallback)

---

## 📊 Database Tables Used

### `notifications`
```sql
- id (UUID)
- user_id (UUID) -- Citizen's auth user ID
- user_type (TEXT) -- 'citizen'
- title (TEXT) -- 'Your Report Has Been Acknowledged! 🎉'
- message (TEXT) -- Detailed message with report info
- type (TEXT) -- 'user_action' for acknowledgment
- priority (TEXT) -- 'high'
- is_read (BOOLEAN)
- related_report_id (TEXT) -- Link to fire report
- created_at (TIMESTAMP)
```

### Fire Report (Railway API)
```json
{
  "id": "report_id",
  "user_id": "citizen_auth_user_id",  // ← Key field
  "reporter": "Citizen Name",
  "address": "Location",
  "status": "Under Control",
  "latitude": 10.3157,
  "longitude": 123.8854,
  // ... other fields
}
```

---

## ✅ Testing Checklist

To test the feature:

1. **Login as Citizen**
   - Use a registered citizen account
   - Submit a fire report (take photo, add details)
   - Note the report ID

2. **Login as Station User**
   - View the submitted report
   - Click status dropdown
   - Change from "On Going" → "Under Control"

3. **Check Citizen's Experience**
   - **If on Map screen:** Modal should pop up immediately
   - **If on any screen:** Go to Notifications tab
   - Notification should appear with green styling
   - Click notification to navigate to report on map

4. **Verify Data**
   - Check Supabase `notifications` table
   - Confirm notification created with:
     - `user_id` = citizen's ID
     - `user_type` = 'citizen'
     - `title` contains "Acknowledged"
     - `related_report_id` = report ID

---

## 🎨 Visual Design

### Modal Design
- **Colors:** Green success theme (#10b981, #d1fae5)
- **Animation:** Fade-in animation
- **Shadow:** Prominent shadow with green glow
- **Icon:** Large check-circle (80px) with glow background
- **Typography:** Bold title, readable message, clear location badge
- **Button:** Gradient green with forward arrow

### Notification Card Design (Unread Acknowledgment)
- **Background:** Light green (#ecfdf5)
- **Border:** 2px green (#10b981)
- **Badge:** "NEW" tag in top-right corner
- **Icon:** Check-circle with enhanced shadow
- **Text:** Green-tinted for emphasis
- **Animation:** Subtle elevation on appearance

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] Sound/vibration notification when modal appears
- [ ] Animation (confetti/celebration effect)
- [ ] Push notifications when app is in background
- [ ] Status history timeline in report details
- [ ] Multiple status change notifications (Fire Out, etc.)
- [ ] Acknowledgment by specific responder/station name

---

## 📝 Notes

- **Duplicate Prevention:** Uses `processedAcknowledgmentIds` Set to track shown modals
- **Performance:** Subscription only active when citizen is logged in
- **Error Handling:** Falls back gracefully if report location not found
- **User Experience:** Modal only appears once per report acknowledgment
- **Real-time:** Uses Supabase real-time subscriptions for instant updates

---

## 🐛 Troubleshooting

### Modal doesn't appear
1. Check console for subscription status logs
2. Verify citizen's `user_id` is saved in report
3. Check Supabase `notifications` table for entry
4. Ensure citizen is authenticated (`currentUser.id` exists)

### Notification not created
1. Check `universalNotificationService.js` logs
2. Verify status change from "On Going" to "Under Control"
3. Ensure report has valid `user_id` or `reporter_id`
4. Check Supabase connection and permissions

### Citizen ID not found
1. Verify citizen is authenticated via Supabase Auth
2. Check that report submission includes `user_id` field
3. Ensure citizen record exists in `citizen_users` or auth.users
4. Review console logs for ID resolution attempts

---

**Status:** ✅ Feature Complete and Ready to Test

**Last Updated:** November 27, 2025
