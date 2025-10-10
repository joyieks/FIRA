# Mobile Admin Map - Fire Assignment & Rerouting Feature

## Overview
Enhanced the mobile admin map interface to include comprehensive fire assignment and rerouting functionality, matching the capabilities of the web admin dashboard.

## What Was Added

### 1. **Current Assignment Display** 📍
- Shows which station or responder is currently assigned to a fire report
- Displays assignment timestamp
- Shows optional assignment notes
- Visual blue highlight box for easy identification

### 2. **Forwarding History Display** 📨
- Shows complete history of where the fire was forwarded/redirected
- Lists all stations and agencies that received the report
- Displays forwarding notes and timestamps
- Visual amber/yellow highlight box to distinguish from assignments

### 3. **Assignment Controls**
- **Station/Responder Toggle**: Choose between assigning to a station or responder
- **Horizontal Station Selector**: Scroll through available stations with visual selection
- **Assignment Notes**: Add optional notes to provide context for the assignment
- **Assign Button**: Single-tap assignment with confirmation
- **Help Text**: Explains that reassignment is possible anytime

### 4. **Redirect/Forward Controls**
- **Station Selector**: Scroll through stations to forward the report
- **Agency Options**: Quick buttons for Police, Utilities, Barangay
- **Forward Notes**: Add context for why the report is being forwarded
- **Forward Button**: Single-tap forwarding with confirmation
- **Help Text**: Explains that forwarding keeps original assignment

### 5. **Data Persistence**
- Creates snapshots in `assigned_report_snapshots` table for reliable rendering
- Stores assignment history in `report_assignments` table
- Tracks forwarding chain in `report_routes` table
- Automatic refresh of assignment info after changes

## How It Works

### When You Touch a Fire Icon 🔥
1. **Modal Opens** with complete fire report details
2. **Current Status Shown** (if assigned):
   - Blue box shows current assignment
   - Yellow box shows forwarding history
3. **Assignment Section**:
   - Select station from horizontal scroll
   - Add optional note
   - Tap "Assign" to assign the fire
4. **Forward Section**:
   - Select target station or agency
   - Add optional note about why forwarding
   - Tap "Forward" to redirect

### Assignment Flow
```
Fire Report → Select Station → Add Note (optional) → Assign
                ↓
         Station Dashboard Updates
                ↓
         Assignment Info Displayed
```

### Forwarding Flow
```
Fire Report → Select Target → Add Note (optional) → Forward
                ↓
         Both Original & New Target Notified
                ↓
         Forwarding History Updated
```

## Key Features

### Visual Indicators
- **Blue boxes** = Current Assignment
- **Yellow boxes** = Forwarding History
- **Red buttons** = Assignment actions
- **Amber buttons** = Forwarding actions
- **Color-coded fire markers** = Alarm level severity

### Smart Selection
- **Horizontal scrolling** for easy station browsing
- **Active state highlighting** shows selected options
- **Multi-line text inputs** for detailed notes
- **Validation alerts** prevent incomplete assignments

### Data Integrity
- **Assignment snapshots** ensure station dashboards work reliably
- **Automatic refresh** updates display after changes
- **Error handling** with user-friendly alerts
- **Provenance tracking** maintains complete forwarding history

## Database Tables Used

1. **`report_assignments`** - Current assignment for each report
   - `report_id`: Fire report ID
   - `assignee_type`: 'station' or 'responder'
   - `assignee_id`: Station/responder ID
   - `assigned_at`: Timestamp
   - `note`: Optional context

2. **`report_routes`** - Forwarding history
   - `report_id`: Fire report ID
   - `target`: 'station:<id>' or 'agency:<name>'
   - `note`: Optional reason for forwarding
   - `forwarded_at`: Timestamp

3. **`assigned_report_snapshots`** - Coordinate snapshots
   - `report_id`: Fire report ID
   - `lat`, `lng`: Location coordinates
   - `address`: Location text
   - `snapshot_json`: Complete report data

## UI Components Added

### New State Variables
- `currentAssignment` - Tracks active assignment
- `forwardedTo` - Array of forwarding history
- `assignmentNote` - Text for assignment context
- `redirectNote` - Text for forwarding context
- `assigneeType` - Station or responder selection
- `assigneeId` - Selected assignee ID
- `redirectTarget` - Selected forward target

### New Functions
- `loadAssignmentInfo()` - Fetches current assignment and history
- Enhanced `handleAssign()` - Saves assignment with snapshot
- Enhanced `handleRedirect()` - Forwards with history tracking

### New Styles
- `modalRow` - Row container for labels/values
- `modalLabel` - Bold label text
- `modalValue` - Value text display
- `badge` - Pill-shaped status indicators
- `badgeText` - Badge text styling

## Mobile-Specific Optimizations

1. **Touch-Friendly Controls**
   - Large touch targets for buttons
   - Horizontal scrolling for space efficiency
   - Multi-line text inputs for mobile keyboards

2. **Responsive Design**
   - Modal adapts to screen size (90% width, 90% max height)
   - Scrollable content for long fire reports
   - Collapsible sections to save space

3. **Native Components**
   - React Native TextInput for notes
   - TouchableOpacity for interactive elements
   - ScrollView for long lists

## Usage Instructions

### To Assign a Fire to a Station:
1. Tap the fire icon (🔥) on the map
2. Scroll to find the desired station in the horizontal list
3. (Optional) Add a note explaining the assignment
4. Tap the "Assign" button
5. Confirmation alert will appear

### To Forward/Redirect a Fire:
1. Tap the fire icon (🔥) on the map
2. Scroll to select target station or tap an agency button
3. (Optional) Add a note explaining why forwarding
4. Tap the "Forward" button
5. Confirmation alert will appear

### To View Assignment History:
- Simply tap any fire icon
- Blue box shows current assignment (if any)
- Yellow box shows forwarding history (if any)

## Benefits

✅ **Complete Parity with Web Admin** - Same functionality as web dashboard
✅ **Mobile-Optimized** - Touch-friendly, responsive design
✅ **Real-Time Updates** - Assignment info refreshes automatically
✅ **Full Audit Trail** - Complete history of assignments and forwards
✅ **Error Prevention** - Validation alerts for incomplete actions
✅ **User Feedback** - Clear success/error messages
✅ **Offline-Ready** - Snapshots ensure data persistence

## Technical Implementation

- **Framework**: React Native with Expo
- **Map Library**: react-native-maps
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Native React Native components
- **State Management**: React hooks (useState, useEffect, useCallback)

## Files Modified

- `mobile/app/Admin/AdminMenu/AdminMap/AMap.jsx` - Main implementation

## Testing Recommendations

1. Test assignment to different stations
2. Test forwarding to multiple targets
3. Verify assignment info displays correctly
4. Check that reassignment works properly
5. Confirm forwarding history accumulates
6. Validate notes are saved and displayed
7. Test with long station names and notes
8. Verify mobile keyboard behavior with text inputs

