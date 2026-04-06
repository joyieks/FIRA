# Admin Station Assignment Feature - Complete Analysis

**Date**: December 11, 2025  
**Branch**: joy_supabase  
**Primary File**: `Website/web/pfira-app/src/components/pages/admin/Adashboard/Adashboard.jsx`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Assignment Flow](#assignment-flow)
4. [Key Features](#key-features)
5. [Code Components](#code-components)
6. [Assignment States](#assignment-states)
7. [Notification System](#notification-system)
8. [Realtime Listeners](#realtime-listeners)
9. [UI/UX Elements](#uiux-elements)
10. [Edge Cases & Validations](#edge-cases--validations)
11. [Dependencies](#dependencies)

---

## 📖 Overview

The admin station assignment feature allows administrators to:
- **Manually assign** fire reports to stations
- **Auto-assign** reports based on geographical jurisdiction (2km radius)
- **Forward/Reroute** reports between stations
- **Track assignment status** (pending, accepted, declined)
- **Handle station busy status** (checking active incidents)
- **Support clustered reports** (multiple reports for same incident)

---

## 🗄️ Database Schema

### Tables Involved

#### 1. `report_assignments`
Primary table for tracking all assignments.

```sql
{
  report_id: TEXT (Firebase report ID),
  assignee_type: TEXT ('station' | 'responder'),
  assignee_id: UUID (station_users.id or responder_users.id),
  assigned_at: TIMESTAMP,
  status: TEXT ('pending' | 'accepted' | 'declined'),
  assignment_source: TEXT ('automatic' | 'manual'),
  note: TEXT (optional assignment notes)
}
```

**Primary Key**: Composite - `(report_id, assignee_id)`

#### 2. `station_users`
Station information and credentials.

```sql
{
  id: UUID (primary key),
  station_name: TEXT,
  email: TEXT,
  phone: TEXT,
  address: TEXT,
  lat: DECIMAL,
  lng: DECIMAL,
  status: TEXT ('active' | 'inactive')
}
```

#### 3. `notifications`
Real-time notifications for stations.

```sql
{
  id: UUID,
  user_id: UUID (station_users.id),
  user_type: TEXT ('station'),
  type: TEXT ('assignment' | 'alarm_change' | 'status_update'),
  related_report_id: TEXT,
  title: TEXT,
  message: TEXT,
  priority: TEXT ('urgent' | 'normal'),
  is_read: BOOLEAN,
  created_at: TIMESTAMP
}
```

#### 4. `assigned_report_snapshots`
Coordinates snapshot for reliable rendering.

```sql
{
  report_id: TEXT (primary key),
  lat: DECIMAL,
  lng: DECIMAL,
  address: TEXT,
  snapshot_json: JSONB,
  created_at: TIMESTAMP
}
```

#### 5. `report_routes` (Forwarding History)
Tracks forwarding between stations.

```sql
{
  report_id: TEXT,
  source: TEXT ('station:<id>'),
  target: TEXT ('station:<id>' | 'agency:police'),
  note: TEXT,
  forwarded_at: TIMESTAMP
}
```

---

## 🔄 Assignment Flow

### A. Manual Assignment (Admin → Station)

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (Adashboard.jsx)                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  1. Admin Selects Report             │
         │  2. Admin Selects Station            │
         │  3. Admin Clicks "Assign Station"    │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  handleAssign() - Line 1450          │
         │  • Validates inputs                  │
         │  • Checks if clustered report        │
         └──────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │  Station is BUSY    │   │  Station is FREE     │
    │  (active incidents) │   │  (no active work)    │
    └─────────────────────┘   └──────────────────────┘
                │                       │
                ▼                       ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │  Status: 'pending'  │   │  Status: 'accepted'  │
    │  Requires Approval  │   │  Auto-accepted       │
    └─────────────────────┘   └──────────────────────┘
                │                       │
                ▼                       ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │  Insert into        │   │  Delete old + Insert │
    │  report_assignments │   │  into assignments    │
    └─────────────────────┘   └──────────────────────┘
                │                       │
                ▼                       ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │  Create Notification│   │  Create Notification │
    │  (Requires Action)  │   │  (Informational)     │
    └─────────────────────┘   └──────────────────────┘
                │                       │
                ▼                       ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │  Show Waiting Modal │   │  Show Success Alert  │
    └─────────────────────┘   └──────────────────────┘
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  Station Receives Assignment         │
         │  (Mobile/Web Station Dashboard)      │
         └──────────────────────────────────────┘
```

### B. Auto-Assignment (Jurisdiction-based)

```
┌─────────────────────────────────────────────────────────────┐
│  NEW FIRE REPORT DETECTED                                   │
│  (Firebase API via fetchReports())                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  autoAssignReportToStation()         │
         │  Line 176                            │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  Check if already assigned           │
         │  Query report_assignments            │
         └──────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │ Already Assigned?     │
                ▼                       ▼
            ┌──────┐              ┌──────────┐
            │ Yes  │              │    No    │
            └──────┘              └──────────┘
                │                       │
                │                       ▼
                │        ┌──────────────────────────────┐
                │        │  findNearestStationIn        │
                │        │  Jurisdiction()              │
                │        │  • 2km radius check          │
                │        │  • Haversine distance calc   │
                │        └──────────────────────────────┘
                │                       │
                │           ┌───────────┴───────────┐
                │           │ Station Found?        │
                │           ▼                       ▼
                │       ┌──────┐              ┌──────────┐
                │       │ Yes  │              │    No    │
                │       └──────┘              └──────────┘
                │           │                       │
                │           ▼                       │
                │   ┌─────────────────┐            │
                │   │  Check if Busy  │            │
                │   └─────────────────┘            │
                │           │                       │
                │           ▼                       │
                │   ┌─────────────────┐            │
                │   │  Insert into    │            │
                │   │  assignments    │            │
                │   │  with status    │            │
                │   └─────────────────┘            │
                │           │                       │
                │           ▼                       │
                │   ┌─────────────────┐            │
                │   │  Create         │            │
                │   │  Notification   │            │
                │   └─────────────────┘            │
                │           │                       │
                └───────────┴───────────────────────┘
                            │
                            ▼
                        ┌──────┐
                        │ Done │
                        └──────┘
```

### C. Forwarding/Rerouting Flow

```
┌─────────────────────────────────────────────────────────────┐
│  FORWARDING TRIGGER                                         │
│  • Station Declined Assignment                              │
│  • Admin Manual Forward                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  Open Reroute Modal                  │
         │  • Fetch nearest stations            │
         │  • Show distance + busy status       │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  Admin Selects New Station           │
         │  handleReroute() - Line 1270         │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  1. Delete old assignment            │
         │  2. Create new assignment            │
         │     • status: 'pending'              │
         │     • assignment_source: 'manual'    │
         │  3. Create notification              │
         │  4. Update report_routes (history)   │
         └──────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │  New Station Receives Assignment     │
         └──────────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. **Station Busy Check**
**Function**: `checkStationIsBusy()` in `assignmentHelpers.js`

Checks if a station has active incidents:
- Queries `report_assignments` for station's assignments
- Fetches report statuses from Firebase API
- Considers station "busy" if any report status is:
  - `"On Going"` or `"Ongoing"`
  - `"Under Control"`
- NOT busy if:
  - `"Fire Out"`
  - `"Cancelled"`

```javascript
// Lines 1467-1470 (Adashboard.jsx)
if (assigneeType === 'station') {
  const busyCheck = await checkStationIsBusy(assigneeId);
  
  if (busyCheck.isBusy) {
    // Set status to 'pending' - requires approval
  } else {
    // Set status to 'accepted' - auto-accept
  }
}
```

### 2. **Jurisdiction-based Auto-Assignment**
**Function**: `autoAssignReportToStation()` - Line 176

- Triggered when new reports are loaded
- Calculates distance from report to all stations
- Assigns to nearest station within **2km radius**
- Prevents duplicate assignments
- Tracks assignments in progress to avoid race conditions

```javascript
// Lines 207-217 (Adashboard.jsx)
const assignmentStatus = busyCheck.isBusy ? 'pending' : 'accepted';

const assignmentPayload = {
  report_id: reportId,
  assignee_type: 'station',
  assignee_id: station.id,
  assigned_at: new Date().toISOString(),
  status: assignmentStatus,
  assignment_source: 'automatic',
  note: `Auto-assigned: Report is within ${station.name}'s jurisdiction (${Math.round(station.distance)}m away)`
};
```

### 3. **Clustered Report Support**
**Lines**: 1460-1465

Handles multiple reports for the same incident:
- Admin can assign entire cluster at once
- All reports in cluster get same assignment
- Notifications indicate cluster size

```javascript
const reportsToAssign = selectedReport.reports && selectedReport.reports.length > 0
  ? selectedReport.reports
  : [selectedReport];

// Later: Assign ALL reports in the cluster
const assignments = reportsToAssign.map(report => ({
  report_id: report.id,
  assignee_type: assigneeType,
  assignee_id: assigneeId,
  // ... other fields
}));
```

### 4. **Real-time Assignment Response**
**Lines**: 865-995 (Realtime Listeners)

Listens for station responses:
- **Accepted**: Updates UI, closes waiting modal
- **Declined**: Opens reroute modal with nearest stations

```javascript
// Line 877-895 (INSERT listener)
supabase
  .channel('report_assignments_insert')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'report_assignments',
  }, async (payload) => {
    const assignment = payload.new;
    if (assignment.status === 'accepted') {
      // Handle acceptance
    }
  })
  .subscribe();

// Line 1018-1150 (UPDATE listener for declined)
supabase
  .channel('report_assignments_declined_global')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'report_assignments',
    filter: 'status=eq.declined'
  }, async (payload) => {
    // Handle declination, open reroute modal
  })
  .subscribe();
```

### 5. **Forwarding Between Stations**
**Lines**: 2560-2700 (UI), 1270-1440 (Logic)

Admin can forward assigned reports to different stations:
- Shows currently assigned station
- Provides "Forward to Station" button
- Fetches nearest available stations
- Always sets status to `'pending'` for new station
- Maintains forwarding history in `report_routes`

---

## 🎨 Code Components

### Main Functions

| Function | Line | Purpose |
|----------|------|---------|
| `handleAssign()` | 1450 | Manual assignment of reports to stations |
| `autoAssignReportToStation()` | 176 | Auto-assign based on jurisdiction |
| `handleReroute()` | 1270 | Reroute/forward to different station |
| `checkStationIsBusy()` | util | Check if station has active incidents |
| `findNearestStations()` | util | Find nearby stations for rerouting |
| `loadAssignmentInfo()` | 760 | Load current assignment + forwarding history |
| `handleAssignmentResponse()` | util | Handle station accept/decline response |

### State Variables

```javascript
// Assignment states
const [assigneeType, setAssigneeType] = useState('station');
const [assigneeId, setAssigneeId] = useState('');
const [assignmentNote, setAssignmentNote] = useState('');
const [currentAssignment, setCurrentAssignment] = useState(null);
const [forwardedTo, setForwardedTo] = useState([]);

// Modal states
const [showWaitingApprovalModal, setShowWaitingApprovalModal] = useState(false);
const [showRerouteModal, setShowRerouteModal] = useState(false);

// Reroute/Forward data
const [pendingAssignment, setPendingAssignment] = useState(null);
const [nearestStations, setNearestStations] = useState([]);
const [selectedRerouteStation, setSelectedRerouteStation] = useState('');
const [rerouteNote, setRerouteNote] = useState('');
const [isRerouteForForwarding, setIsRerouteForForwarding] = useState(false);

// Auto-assignment tracking
const [autoAssignmentsInProgress, setAutoAssignmentsInProgress] = useState(new Set());
```

---

## 📊 Assignment States

### State Lifecycle

```
                    ┌──────────────────┐
                    │   UNASSIGNED     │
                    │   (No record)    │
                    └────────┬─────────┘
                             │
                ┌────────────┴──────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │     PENDING       │       │     ACCEPTED      │
    │  (Busy Station)   │       │  (Free Station)   │
    │  Needs Approval   │       │  Auto-accepted    │
    └─────┬─────────────┘       └─────────┬─────────┘
          │                               │
          │     Station                   │
          │     Response                  │
          │                               │
    ┌─────┴─────────────┐                 │
    │                   │                 │
    ▼                   ▼                 │
┌─────────┐      ┌──────────┐            │
│ACCEPTED │      │ DECLINED │            │
│         │      │          │            │
└─────────┘      └────┬─────┘            │
    │                 │                  │
    │                 │                  │
    │                 ▼                  │
    │          ┌────────────┐            │
    │          │  REROUTE   │            │
    │          │  to New    │            │
    │          │  Station   │            │
    │          └──────┬─────┘            │
    │                 │                  │
    │                 └──────────────────┘
    │                          │
    ▼                          ▼
┌────────────────────────────────┐
│   REPORT BEING HANDLED         │
│   (Station Dashboard)          │
└────────────────────────────────┘
```

### Status Field Values

| Status | Description | Trigger |
|--------|-------------|---------|
| `pending` | Assignment waiting for station approval | Station is busy (has active incidents) |
| `accepted` | Station has accepted the assignment | Station is free OR station manually accepts |
| `declined` | Station has declined the assignment | Station manually declines via modal |

### Assignment Source Values

| Source | Description |
|--------|-------------|
| `automatic` | Auto-assigned by system based on jurisdiction |
| `manual` | Manually assigned by admin |

---

## 🔔 Notification System

### Notification Types for Station Assignment

#### 1. **Pending Assignment (Busy Station)**
```javascript
{
  user_id: stationId,
  user_type: 'station',
  type: 'assignment',
  related_report_id: reportId,
  title: '🚨 New Fire Report Assignment - Action Required',
  message: 'Command Center is assigning you a report.\n\nLocation: ...\nReporter: ...\n\nWill you accept this assignment?',
  priority: 'urgent',
  is_read: false
}
```

#### 2. **Accepted Assignment (Free Station)**
```javascript
{
  user_id: stationId,
  user_type: 'station',
  type: 'assignment',
  related_report_id: reportId,
  title: '🚨 New Fire Report Assignment',
  message: 'You have been assigned a new fire report.\n\nLocation: ...\nReporter: ...',
  priority: 'urgent',
  is_read: false
}
```

#### 3. **Rerouted Assignment**
```javascript
{
  user_id: newStationId,
  user_type: 'station',
  type: 'assignment',
  related_report_id: reportId,
  title: '🚨 Fire Report Rerouted to Your Station - Action Required',
  message: 'Command Center is rerouting a fire report to your station.\n\nLocation: ...\nPrevious station: [Station Name]\n\nWill you accept this assignment?',
  priority: 'urgent',
  is_read: false
}
```

#### 4. **Cluster Assignment**
```javascript
{
  title: '🚨 New Fire Report Cluster Assignment - Action Required (3 reports)',
  message: 'Command Center is assigning you a cluster of 3 reports for the same incident.\n\nLocation: ...\nReporter: ...\n\nWill you accept this assignment?'
}
```

---

## 🔌 Realtime Listeners

### 1. **Assignment INSERT Listener**
**Lines**: 865-995  
**Purpose**: Detect when station accepts assignment (status changes to 'accepted')

```javascript
supabase
  .channel('report_assignments_insert')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'report_assignments',
  }, async (payload) => {
    const assignment = payload.new;
    
    // Check if this is for the pending assignment
    if (assignment.status === 'accepted' && 
        String(assignment.report_id) === String(pendingAssignment?.reportId)) {
      // Close waiting modal
      setShowWaitingApprovalModal(false);
      // Show success message
      alert('Station accepted the assignment!');
    }
  })
  .subscribe();
```

### 2. **Assignment DECLINED Listener**
**Lines**: 1018-1150  
**Purpose**: Detect when station declines assignment, trigger reroute modal

```javascript
supabase
  .channel('report_assignments_declined_global')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'report_assignments',
    filter: 'status=eq.declined'
  }, async (payload) => {
    const assignment = payload.new;
    
    if (assignment.status !== 'declined') return;
    
    // Get station name
    const { data: stationData } = await supabase
      .from('station_users')
      .select('station_name')
      .eq('id', assignment.assignee_id)
      .single();
    
    // Get report location
    const reportData = await fetchReportDetails(assignment.report_id);
    
    // Find nearest stations
    const stations = await findNearestStations(lat, lng, assignment.assignee_id);
    
    // Open reroute modal
    setNearestStations(stations);
    setPendingAssignment({...});
    setShowRerouteModal(true);
  })
  .subscribe();
```

---

## 🎨 UI/UX Elements

### Assignment Panel (Report Details Sidebar)

#### State: No Assignment

```
┌─────────────────────────────────────┐
│  Assign to Station                  │
├─────────────────────────────────────┤
│  [Select station... ▼]              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Assignment note (optional)  │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Assign Station]                   │
│  Select a station to assign         │
└─────────────────────────────────────┘
```

#### State: Station Assigned

```
┌─────────────────────────────────────┐
│  📍 Currently Assigned               │
├─────────────────────────────────────┤
│  Station Name: Station Alpha         │
│  Assigned: Dec 11, 2025 10:30 AM    │
│  Status: ✅ Accepted                 │
│  Note: Near shopping district       │
├─────────────────────────────────────┤
│  Forward to Station                 │
├─────────────────────────────────────┤
│  [Forward to Another Station]       │
└─────────────────────────────────────┘
```

#### State: Forwarding History

```
┌─────────────────────────────────────┐
│  📨 Forwarded To:                   │
├─────────────────────────────────────┤
│  Station Beta                       │
│  Note: They have fire truck         │
│  Forwarded: Dec 11, 2025 11:00 AM  │
│  ─────────────────────────────────  │
│  Station Gamma                      │
│  Note: Closer to location          │
│  Forwarded: Dec 11, 2025 11:15 AM  │
└─────────────────────────────────────┘
```

### Waiting Approval Modal

```
┌─────────────────────────────────────────────┐
│  ⏳ Waiting for Station Approval            │
├─────────────────────────────────────────────┤
│                                             │
│  Assignment sent to Station Alpha           │
│                                             │
│  The station is currently handling other    │
│  incidents and needs to review this         │
│  assignment before accepting.               │
│                                             │
│  You will be notified when they respond.    │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

### Reroute Modal

```
┌─────────────────────────────────────────────┐
│  🚨 Station Declined Assignment             │
├─────────────────────────────────────────────┤
│  Station Alpha has declined this            │
│  assignment and is unable to handle this    │
│  report. Please reroute the incident to     │
│  one of the nearest stations:               │
│                                             │
│  📍 Report Location: Main Street            │
│                                             │
│  Available Stations:                        │
│                                             │
│  ○ Station Beta                             │
│    1.2 km away • Currently handling 2       │
│                                             │
│  ○ Station Gamma                            │
│    2.5 km away • Currently handling 0       │
│                                             │
│  ┌────────────────────────────────┐        │
│  │ Optional note for new station  │        │
│  └────────────────────────────────┘        │
│                                             │
│  [Cancel]  [Reroute to Selected Station]   │
└─────────────────────────────────────────────┘
```

---

## ⚠️ Edge Cases & Validations

### 1. **Duplicate Assignment Prevention**
**Line**: 183-199

```javascript
// Check if report is already assigned to a station
const { data: existingAssignments } = await supabase
  .from('report_assignments')
  .select('assignee_id')
  .eq('report_id', reportId)
  .eq('assignee_type', 'station');

if (existingAssignments && existingAssignments.length > 0) {
  console.log(`Report ${reportId} already assigned to station, skipping auto-assignment`);
  return;
}
```

### 2. **Race Condition Prevention**
**Line**: 178-181

```javascript
// Prevent duplicate assignments
if (autoAssignmentsInProgress.has(reportId)) {
  return; // Already processing this report
}

setAutoAssignmentsInProgress(prev => new Set(prev).add(reportId));
```

### 3. **Database Migration Check**
**Lines**: 1493-1499, 1594-1600

```javascript
if (error) {
  // Check if error is due to missing columns (migration not run)
  if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
    console.error('❌ Database migration not run. Please run assignment-status-migration.sql');
    alert('Database migration required! Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
    return;
  }
  throw error;
}
```

### 4. **Invalid Report Filter**
**Lines**: 58-108

Filters out "No Fire" + "No Smoke" reports:
- Prevents auto-assignment
- Notifies citizen that report is invalidated
- Doesn't display on map

```javascript
const isNoFireNoSmoke = (report) => {
  const pred = (report?.prediction || '').toLowerCase();
  const smoke = (report?.smoke_detection || '').toLowerCase();
  return pred.includes('no fire') && smoke.includes('no smoke');
};
```

### 5. **Reroute to Same Station Prevention**
**Line**: 1271-1275

```javascript
if (String(selectedRerouteStation) === String(pendingAssignment.stationId)) {
  alert('Cannot reroute to the same station. Please select a different station.');
  return;
}
```

### 6. **Coordinate Validation**
**Line**: 151-154

```javascript
if (!reportLat || !reportLng || isNaN(reportLat) || isNaN(reportLng)) {
  return null;
}
```

---

## 🔗 Dependencies

### External Libraries
- **@react-google-maps/api**: Map display, markers, jurisdiction circles
- **@supabase/supabase-js**: Database queries, realtime subscriptions

### Custom Utilities
**File**: `src/utils/assignmentHelpers.js`

```javascript
import { 
  checkStationIsBusy,           // Check if station has active incidents
  findNearestStations,          // Find nearby stations for rerouting
  findNearestStationsToStation, // Find stations near another station
  handleAssignmentResponse,     // Handle station accept/decline
  calculateDistance             // Haversine distance calculation
} from '../../../../utils/assignmentHelpers';
```

### Context
- **NotificationContext**: Global notification state, audio alerts

### Firebase API
**Endpoint**: `https://new-fira-backend.onrender.com/get_reports`

Returns:
```javascript
[
  {
    id: "report_id",
    latitude: "10.3157",
    longitude: "123.8854",
    address: "Cebu City",
    reporter: "John Doe",
    reporter_name: "John Doe",
    status: "On Going",
    alarm_level: "First Alarm",
    prediction: "Fire Detected",
    smoke_detection: "Smoke Detected",
    timestamp: "2025-12-11T10:30:00Z",
    // ... more fields
  }
]
```

---

## 📝 Key Findings Summary

### ✅ Strengths
1. **Comprehensive busy check** - Considers active incident status
2. **Auto-assignment** - Automatic jurisdiction-based assignment
3. **Real-time updates** - Postgres listeners for instant feedback
4. **Cluster support** - Can handle multiple reports for same incident
5. **Forwarding history** - Maintains audit trail in `report_routes`
6. **Flexible status system** - Pending, accepted, declined states
7. **Duplicate prevention** - Multiple safeguards against duplicate assignments

### ⚠️ Considerations for New Features
1. **Coordinate snapshot** - Uses `assigned_report_snapshots` for reliable rendering
2. **Status must be checked** - Always filter by `status IN ('pending', 'accepted')`
3. **Report ID type** - Stored as TEXT (Firebase IDs), always cast with `String()`
4. **Multiple assignments** - Primary key allows multiple assignments per report (station + responders)
5. **Notification cleanup** - Old notifications remain, may need cleanup strategy

### 🔧 Technical Details
- **Jurisdiction radius**: 2000 meters (2km)
- **Distance calculation**: Haversine formula
- **API polling**: Fetches reports from Firebase API
- **Realtime**: Supabase Postgres changes via websocket
- **UI framework**: React with Tailwind CSS

---

## 📌 Ready for New Feature Development

This analysis provides a complete understanding of:
- How stations are assigned to reports
- Database schema and relationships
- Status lifecycle and state management
- Real-time notification system
- UI components and user flows
- Edge cases and validations

You can now confidently add new features that:
- Extend the assignment system
- Add new notification types
- Implement additional assignment logic
- Create new dashboards or views
- Integrate with mobile applications

---

**Analysis Complete** ✅  
*Document generated for feature development planning*
