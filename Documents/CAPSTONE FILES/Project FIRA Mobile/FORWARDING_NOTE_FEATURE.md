# Forwarding Note Display Feature

## Overview
When a fire report is forwarded/redirected to a station, the forwarding note and metadata are now displayed prominently in the fire report details across all station views.

## What Was Added

### Visual Indicator
Forwarded reports now display a **highlighted box** at the top of the fire report details with:
- 📨 **"Forwarded Report"** label
- **Admin's note** explaining why it was forwarded
- **Forwarded timestamp** showing when it was sent

### Example Display:

```
┌─────────────────────────────────────────┐
│ 📨 Forwarded Report                     │
│ Note: Need backup - Station A requested│
│       additional support                │
│ Forwarded: 10/1/2025 2:30:15 PM        │
└─────────────────────────────────────────┘
```

## Updated Files

### 1. **Web Station Dashboard** 
`Website/web/pfira-app/src/components/pages/stations/Sdashboard/Sdashboard.jsx`

**Changes:**
- Fetch `note` and `forwarded_at` along with `report_id` from `report_routes`
- Create metadata map linking report IDs to forwarding information
- Attach `is_forwarded`, `forwarding_note`, and `forwarded_at` to each report
- Display forwarding box in InfoWindow popup (amber/yellow highlighted)

### 2. **Mobile Station Map** 
`mobile/app/Stations/StationsMenu/StationsMap/SMap.jsx`

**Changes:**
- Same query updates to fetch forwarding metadata
- Attach metadata to report objects
- Display forwarding box in Modal (yellow highlighted with border)

### 3. **Station Overall Page** 
`Website/web/pfira-app/src/components/pages/stations/Station Overall/Station_Overall.jsx`

**Changes:**
- Fetch forwarding metadata with report IDs
- Attach to mapped report objects
- Display prominent forwarding section in detailed modal

## Database Schema Used

### `report_routes` Table
```sql
CREATE TABLE report_routes (
    id UUID PRIMARY KEY,
    report_id TEXT NOT NULL,        -- Firebase report ID
    target TEXT NOT NULL,            -- Format: 'station:<uuid>'
    note TEXT,                       -- Admin's forwarding note
    forwarded_at TIMESTAMP,          -- When it was forwarded
    created_at TIMESTAMP
);
```

## User Experience Flow

### Admin Side:
1. Click a fire report marker
2. Select target station from dropdown
3. **Add note explaining why** (e.g., "Need backup", "Closer to location")
4. Click "Forward" button
5. Note is saved to database

### Station Side:
1. Login to station account
2. View map or reports list
3. Click on a forwarded fire report
4. **See highlighted forwarding box** at the top with:
   - Clear "Forwarded Report" label
   - Admin's note explaining why
   - Timestamp of when it was forwarded

## Visual Design

### Colors Used:
- **Background**: Amber/yellow (`#fef3c7`, `bg-amber-50`)
- **Border**: Amber (`#fbbf24`, `border-amber-200/300`)
- **Text**: Dark amber (`#92400e`, `text-amber-800/900`)
- **Icon**: 📨 (forwarding/mail icon)

This color scheme ensures the forwarding information stands out from regular report data while maintaining a professional appearance.

## Example Scenario

### Scenario: Building Fire Needs Multiple Stations

1. **Report Created**: Citizen reports large building fire
2. **Admin Assigns**: Assigns to **Tipolo Station** (closest)
3. **Admin Forwards**: Forwards to **Mabolo Station** with note:
   ```
   "Large fire, multiple structures. Need backup units. 
   Tipolo Station already dispatched but requesting support."
   ```

4. **Tipolo Station** sees:
   - ✅ Fire report (assigned)
   - No forwarding box (they're the primary assignee)

5. **Mabolo Station** sees:
   - ✅ Fire report (forwarded)
   - 📨 **Forwarding box** with the admin's note
   - Understands their role is backup/support

## Benefits

1. **Clear Communication**: Stations know WHY they received a forwarded report
2. **Better Coordination**: Notes can explain relationships between stations
3. **Audit Trail**: Timestamp shows when forwarding occurred
4. **Context Awareness**: Stations can see if they're primary responder or backup

## Testing

### Test the Feature:

1. **Login as Admin** (web)
2. **Assign a report** to Station A
3. **Forward the same report** to Station B with note: "Testing forwarding feature"
4. **Login as Station B**
5. **View the forwarded report**
6. ✅ **Verify** the forwarding box appears with your note

### What to Check:
- [ ] Forwarding box appears at top of fire report details
- [ ] Admin's note is displayed correctly
- [ ] Forwarded timestamp shows correct date/time
- [ ] Box is visually distinct (amber/yellow color)
- [ ] Works on both web and mobile
- [ ] Shows in both map view and table view

## Future Enhancements

### Potential Additions:
1. **Show forwarder name**: Display which admin forwarded it
2. **Multiple forwards**: Track if report was forwarded multiple times
3. **Forward response**: Allow stations to acknowledge receipt
4. **Forward chain**: Show routing history if forwarded through multiple stations

## Code Structure

### Data Flow:
```
1. Admin forwards report
   ↓
2. Saved to report_routes table with note
   ↓
3. Station queries report_routes for their ID
   ↓
4. Metadata (note, timestamp) attached to report
   ↓
5. UI checks if report.is_forwarded === true
   ↓
6. Display forwarding box with note
```

### Key Fields Added to Reports:
```javascript
{
  id: "123",
  // ... other report fields ...
  is_forwarded: true,           // Boolean flag
  forwarding_note: "Need backup",  // Admin's note
  forwarded_at: "2025-10-01T14:30:00Z"  // ISO timestamp
}
```

## Summary

Stations now have **full context** about forwarded reports, enabling better coordination and response. The forwarding note feature bridges the communication gap between admin and stations, ensuring everyone understands their role in multi-station responses.

