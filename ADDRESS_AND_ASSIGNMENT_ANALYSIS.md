# In-Depth Analysis: Station Assignments & Address System

## 📋 Table of Contents
1. [Station Assignment System](#1-station-assignment-system)
2. [Fire Report Address System](#2-fire-report-address-system)
3. [Fire Station Address System](#3-fire-station-address-system)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Key Insights & Recommendations](#5-key-insights--recommendations)

---

## 1. Station Assignment System

### 1.1 Overview
The FIRA system uses a **dual-table approach** for managing fire report assignments:
- **`report_assignments`** - Primary assignments (who is responsible)
- **`report_routes`** - Forwarding/routing history (provenance trail)

### 1.2 Assignment Process

#### Step 1: Admin Initiates Assignment
**Location**: `Adashboard.jsx` - `handleAssign()` function (lines 432-509)

```javascript
const handleAssign = async () => {
  // 1. Validate inputs
  if (!selectedReport || !assigneeId) return;
  
  // 2. Create assignment payload
  const payload = {
    report_id: selectedReport.id,        // Firebase report ID (TEXT)
    assignee_type: 'station',            // or 'responder'
    assignee_id: assigneeId,             // UUID from station_users table
    assigned_at: new Date().toISOString()
  };
  
  // 3. Upsert to report_assignments table
  await supabase
    .from('report_assignments')
    .upsert({ 
      ...payload, 
      note: assignmentNote || null 
    }, { 
      onConflict: 'report_id,assignee_id' 
    });
}
```

#### Step 2: Database Schema
**Table**: `report_assignments` (from `supabase-tables.sql`)

```sql
CREATE TABLE report_assignments (
    id UUID PRIMARY KEY,
    report_id TEXT NOT NULL,           -- Firebase report ID (not UUID!)
    assignee_type TEXT NOT NULL,        -- 'station' or 'responder'
    assignee_id UUID NOT NULL,         -- References station_users.id or responders.id
    assigned_at TIMESTAMP WITH TIME ZONE,
    note TEXT,                          -- Optional assignment note
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Constraints:
-- 1. Unique composite: (report_id, assignee_type, assignee_id)
-- 2. Only ONE station per report (partial unique index)
-- 3. Multiple responders allowed per report
```

**Key Constraints**:
- ✅ One report can have **ONE station assignment** (enforced by unique index)
- ✅ One report can have **MULTIPLE responder assignments**
- ✅ Assignment can be updated via `upsert` (onConflict handling)

#### Step 3: Notification Creation
When a station is assigned, a notification is automatically created:

```javascript
// Location: Adashboard.jsx lines 454-483
if (assigneeType === 'station') {
  const locationInfo = selectedReport.address || 
                       selectedReport.geotag_location || 
                       'Location unavailable';
  
  await supabase.from('notifications').insert({
    user_id: assigneeId,              // Station UUID
    user_type: 'station',
    type: 'assignment',
    related_report_id: String(selectedReport.id),
    title: '🚨 New Fire Report Assigned to Your Station',
    message: `Location: ${locationInfo}\nReporter: ${reporterName}`,
    priority: 'urgent',
    is_read: false
  });
}
```

#### Step 4: Coordinate Snapshot
**Purpose**: Store report coordinates for reliable station dashboard rendering

```javascript
// Location: Adashboard.jsx lines 485-500
await supabase.from('assigned_report_snapshots').upsert({
  report_id: String(selectedReport.id),
  lat: parseFloat(selectedReport.latitude),
  lng: parseFloat(selectedReport.longitude),
  address: selectedReport.address || selectedReport.geotag_location || null,
  snapshot_json: selectedReport  // Full report backup
}, { onConflict: 'report_id' });
```

**Why Snapshots?**
- Fire reports come from external API (Railway)
- Coordinates might change or become unavailable
- Station dashboards need reliable location data
- Snapshot ensures assigned reports always have coordinates

### 1.3 Forwarding System (Secondary Routing)

#### Process
**Location**: `Adashboard.jsx` - `handleRedirect()` function (lines 511-573)

```javascript
const handleRedirect = async () => {
  const payload = {
    report_id: selectedReport.id,
    target: 'station:<station-uuid>',  // Format: 'station:uuid' or 'agency:police'
    note: redirectNote || null,
    forwarded_at: new Date().toISOString()
  };
  
  // Insert into report_routes (NOT report_assignments!)
  await supabase.from('report_routes').insert(payload);
}
```

**Key Differences**:
- **Assignment** = Primary responsibility (appears on station dashboard)
- **Forward** = Routing history (tracks provenance, doesn't change primary assignment)

### 1.4 Station Dashboard Retrieval

**Location**: `Sdashboard.jsx` - `loadAssignedReports()` (lines 537-636)

```javascript
// 1. Fetch directly assigned reports
const { data: assignments } = await supabase
  .from('report_assignments')
  .select('report_id, note, assigned_at')
  .eq('assignee_type', 'station')
  .eq('assignee_id', stationId);

// 2. Fetch forwarded reports
const { data: forwarded } = await supabase
  .from('report_routes')
  .select('report_id, note, forwarded_at')
  .eq('target', `station:${stationId}`);

// 3. Combine both sets
const assignedIds = new Set(assignments.map(a => String(a.report_id)));
const forwardedIds = new Set(forwarded.map(f => String(f.report_id)));
const allReportIds = new Set([...assignedIds, ...forwardedIds]);

// 4. Fetch full report data from API
const response = await fetch(`${API_URL}/get_reports`);
const allReports = await response.json();
const stationReports = allReports.filter(r => 
  allReportIds.has(String(r.id))
);
```

**Important**: Stations see BOTH assigned AND forwarded reports on their dashboard.

---

## 2. Fire Report Address System

### 2.1 Address Data Structure

Fire reports have **multiple address-related fields**:

```javascript
{
  // Primary address fields
  address: "123 Main Street, Cebu City",           // Human-readable address
  geotag_location: "10.3157, 123.8854",            // Coordinates as string
  latitude: 10.3157,                               // Numeric latitude
  longitude: 123.8854,                              // Numeric longitude
  
  // Fallback/alternative fields
  location: "123 Main Street, Cebu City",          // Sometimes used instead of address
  geotag: "10.3157, 123.8854",                    // Alternative geotag field
}
```

### 2.2 Address Capture Process

#### Mobile App (Citizen Submission)
**Location**: `CStatus.jsx` - Emergency submission (lines 1826-1866)

```javascript
// Step 1: Get location (priority order)
let currentLocation = null;

// Option A: User picked location on map
if (pickedLocation) {
  currentLocation = `${pickedLocation.latitude}, ${pickedLocation.longitude}`;
  pickedAddress = pickedLocation.address;  // Human-readable address
}

// Option B: Device GPS (fallback)
else {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    timeout: 10000
  });
  currentLocation = `${location.coords.latitude}, ${location.coords.longitude}`;
}

// Step 2: Submit to API
const formData = new FormData();
formData.append('geotag_location', currentLocation);  // "lat, lng"
if (pickedAddress) {
  formData.append('address', pickedAddress);          // Human-readable
}
formData.append('latitude', location.coords.latitude);
formData.append('longitude', location.coords.longitude);
```

**Address Priority**:
1. ✅ **User-picked location** (if user selected on map) → Has both coordinates AND address
2. ✅ **Device GPS** (fallback) → Has coordinates, address may be reverse-geocoded by API

### 2.3 Address Usage Patterns

#### Pattern 1: Display Location
**Location**: Throughout codebase

```javascript
// Priority order for displaying location:
const locationInfo = report.address ||           // 1. Human-readable address
                     report.geotag_location ||   // 2. Coordinates string
                     report.location ||          // 3. Alternative address field
                     'Location unavailable';     // 4. Fallback
```

**Examples**:
- `Adashboard.jsx` line 457: Notification message
- `Adashboard.jsx` line 1001: Info window display
- `Adashboard.jsx` line 1277: Mini-modal display

#### Pattern 2: Map Rendering
**Location**: `Adashboard.jsx` - Marker creation (lines 850-874)

```javascript
// Filter reports with valid coordinates
const reportsWithCoords = data.filter(report => {
  const hasCoords = report.latitude && 
                    report.longitude && 
                    !isNaN(report.latitude) && 
                    !isNaN(report.longitude);
  return hasCoords;
});

// Create markers
fireReports.map((report) => (
  <Marker
    position={{
      lat: parseFloat(report.latitude),
      lng: parseFloat(report.longitude)
    }}
    // Uses coordinates for positioning
  />
));
```

#### Pattern 3: Coordinate Snapshot
**Location**: `Adashboard.jsx` - Assignment snapshot (lines 485-500)

```javascript
// When assigning, snapshot the address for reliability
await supabase.from('assigned_report_snapshots').upsert({
  report_id: String(selectedReport.id),
  lat: parseFloat(selectedReport.latitude),
  lng: parseFloat(selectedReport.longitude),
  address: selectedReport.address || 
           selectedReport.geotag_location || 
           null,
  snapshot_json: selectedReport
});
```

### 2.4 Address Data Sources

#### Source 1: External API (Railway)
**Endpoint**: `https://fire-detection-api-production-f55b.up.railway.app/get_reports`

- Reports are stored in external Firebase/API
- Address fields come from citizen submissions
- API may perform reverse geocoding if only coordinates provided

#### Source 2: Supabase Snapshot Table
**Table**: `assigned_report_snapshots`

- Stores address when report is assigned
- Ensures assigned reports always have location data
- Used as fallback if API data unavailable

### 2.5 Address Update/Edit

**Location**: `CStatus.jsx` - Edit report (lines 4013-4046)

```javascript
// When editing report:
const payload = {
  cause_of_fire: editData.cause,
  address: editData.address || undefined,              // Can update address
  geotag_location: `${editData.latitude}, ${editData.longitude}`,
  latitude: editData.latitude || undefined,
  longitude: editData.longitude || undefined,
};

await fetch(`${API_BASE}/update_report/${reportId}`, {
  method: 'PUT',
  body: JSON.stringify(payload)
});
```

**Note**: Address updates go to external API, not Supabase directly.

---

## 3. Fire Station Address System

### 3.1 Station Address Data Structure

**Table**: `station_users` (Supabase)

```sql
CREATE TABLE station_users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    station_name TEXT,              -- e.g., "Central Fire Station"
    address TEXT,                    -- e.g., "123 Main Street, Cebu City"
    lat DOUBLE PRECISION,            -- Numeric latitude (if available)
    lng DOUBLE PRECISION,            -- Numeric longitude (if available)
    phone TEXT,
    position TEXT,
    -- ... other fields
);
```

### 3.2 Station Address Geocoding Process

#### Admin Dashboard
**Location**: `Adashboard.jsx` - `loadStations()` (lines 252-306)

```javascript
// Step 1: Fetch stations from Supabase
const { data: stations } = await supabase
  .from('station_users')
  .select('id, station_name, address, lat, lng');

// Step 2: Geocode addresses (if coordinates missing)
const geocoder = new window.google.maps.Geocoder();

const results = await Promise.all(
  stations.map((s) => new Promise((resolve) => {
    // Priority 1: Use existing lat/lng if available
    const latNum = parseFloat(s.lat);
    const lngNum = parseFloat(s.lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      resolve({ 
        id: s.id, 
        name: s.station_name, 
        lat: latNum, 
        lng: lngNum 
      });
      return;
    }
    
    // Priority 2: Geocode address if no coordinates
    if (!s.address) {
      resolve(null);
      return;
    }
    
    geocoder.geocode({ address: s.address }, (res, status) => {
      if (status === 'OK' && res[0]) {
        const loc = res[0].geometry.location;
        resolve({
          id: s.id,
          name: s.station_name,
          lat: loc.lat(),
          lng: loc.lng()
        });
      } else {
        resolve(null);
      }
    });
  }))
);

// Step 3: Remove duplicates (same coordinates)
const uniqueStations = [];
const coordsSet = new Set();
results.forEach(station => {
  const coordKey = `${station.lat.toFixed(6)},${station.lng.toFixed(6)}`;
  if (!coordsSet.has(coordKey)) {
    coordsSet.add(coordKey);
    uniqueStations.push(station);
  }
});
```

**Geocoding Priority**:
1. ✅ **Use `lat`/`lng` columns** if they exist in database
2. ✅ **Geocode `address` field** using Google Maps Geocoder
3. ❌ **Skip station** if no address or geocoding fails

#### Station Dashboard
**Location**: `Sdashboard.jsx` - Similar process (lines 382-442)

```javascript
// For current station's own location:
if (stationData?.lat && stationData?.lng) {
  // Use existing coordinates
  setStationLocation({ 
    lat: parseFloat(stationData.lat), 
    lng: parseFloat(stationData.lng) 
  });
} else if (stationData?.address) {
  // Geocode address
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ address: stationData.address }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const location = results[0].geometry.location;
      setStationLocation({
        lat: location.lat(),
        lng: location.lng()
      });
    }
  });
}
```

### 3.3 Station Address Storage

#### Database Storage
- **Address**: Stored as TEXT in `station_users.address`
- **Coordinates**: Stored as DOUBLE PRECISION in `station_users.lat` and `station_users.lng`
- **Coordinates are optional** - can be NULL

#### When Coordinates Are Set
1. **Manual entry** - Admin can set lat/lng when creating/editing station
2. **Geocoding** - System geocodes address on-the-fly when needed
3. **Not persisted** - Geocoded coordinates are NOT automatically saved back to database

**Important**: Geocoding happens **client-side** and is **not persisted**. Each time the map loads, stations without coordinates are geocoded again.

### 3.4 Station Address Display

**Location**: Various map components

```javascript
// Station markers on map
<Marker
  position={{ lat: station.lat, lng: station.lng }}
  title={station.name}  // station_name
  // Address not shown on marker, but available in station data
/>
```

**Jurisdiction Circles**:
```javascript
// Each station has a jurisdiction radius (2000m default)
<Circle
  center={{ lat: station.lat, lng: station.lng }}
  radius={2000}  // 2km jurisdiction
  options={{
    fillColor: '#ef4444',
    fillOpacity: 0.05,
    strokeColor: '#ef4444',
    strokeOpacity: 0.6
  }}
/>
```

---

## 4. Data Flow Diagrams

### 4.1 Assignment Flow

```
┌─────────────┐
│   Admin     │
│  Dashboard  │
└──────┬──────┘
       │
       │ 1. Select Report
       │ 2. Choose Station
       │ 3. Click "Assign"
       │
       ▼
┌─────────────────────┐
│  handleAssign()     │
│  - Validate inputs  │
│  - Create payload   │
└──────┬──────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ report_      │  │ notifications│
│ assignments  │  │   table      │
│   table      │  │              │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌─────────────────────┐
│ assigned_report_    │
│ snapshots table     │
│ (coordinates)       │
└─────────────────────┘
       │
       │ Station Dashboard
       │ fetches assignments
       │
       ▼
┌──────────────┐
│   Station    │
│  Dashboard   │
│  (sees report)│
└──────────────┘
```

### 4.2 Address Flow (Fire Reports)

```
┌─────────────┐
│   Citizen   │
│  Mobile App │
└──────┬──────┘
       │
       │ 1. Pick location OR
       │ 2. Use GPS
       │
       ▼
┌─────────────────────┐
│  FormData with:     │
│  - geotag_location  │
│  - address (if picked)│
│  - latitude         │
│  - longitude        │
└──────┬──────────────┘
       │
       │ POST to API
       │
       ▼
┌─────────────────────┐
│  External API       │
│  (Railway/Firebase) │
│  - Stores report    │
│  - May reverse      │
│    geocode if needed│
└──────┬──────────────┘
       │
       │ GET /get_reports
       │
       ▼
┌─────────────────────┐
│  Admin Dashboard    │
│  - Fetches reports  │
│  - Filters by coords│
│  - Displays on map  │
└─────────────────────┘
       │
       │ When assigned
       │
       ▼
┌─────────────────────┐
│ assigned_report_    │
│ snapshots           │
│ (backup coordinates)│
└─────────────────────┘
```

### 4.3 Station Address Flow

```
┌─────────────────────┐
│  station_users      │
│  table (Supabase)   │
│                     │
│  - address: TEXT    │
│  - lat: DOUBLE      │
│  - lng: DOUBLE      │
└──────┬──────────────┘
       │
       │ Admin/Station
       │ Dashboard loads
       │
       ▼
┌─────────────────────┐
│  Check lat/lng      │
│  in database?       │
└──────┬──────────────┘
       │
   ┌───┴───┐
   │       │
   YES     NO
   │       │
   ▼       ▼
┌─────┐ ┌─────────────────┐
│ Use │ │ Google Maps      │
│ DB  │ │ Geocoder         │
│ coords│ │                 │
└─────┘ │ geocode(address) │
        └────────┬──────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Get coordinates │
        │ (not persisted) │
        └─────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Display on map  │
        │ with marker     │
        └─────────────────┘
```

---

## 5. Key Insights & Recommendations

### 5.1 Current System Strengths

✅ **Dual Assignment System**
- Clear separation between primary assignment and forwarding
- Allows tracking provenance while maintaining primary responsibility

✅ **Coordinate Snapshots**
- Ensures assigned reports always have location data
- Prevents issues if external API data becomes unavailable

✅ **Flexible Address Handling**
- Multiple fallback options for displaying location
- Handles both human-readable addresses and coordinates

✅ **Station Geocoding**
- Automatic geocoding if coordinates missing
- Works with just address field

### 5.2 Potential Issues & Recommendations

#### Issue 1: Station Coordinates Not Persisted
**Problem**: Geocoded station coordinates are not saved to database
- Each map load re-geocodes addresses
- Wastes API calls
- Slower map loading

**Recommendation**:
```javascript
// After successful geocoding, save to database
if (geocoded && !station.lat) {
  await supabase
    .from('station_users')
    .update({ 
      lat: geocoded.lat, 
      lng: geocoded.lng 
    })
    .eq('id', station.id);
}
```

#### Issue 2: Address Field Inconsistency
**Problem**: Reports use multiple address fields (`address`, `location`, `geotag_location`)
- Inconsistent field names
- Hard to know which field to use

**Recommendation**: Standardize on:
- `address` - Human-readable address
- `latitude` / `longitude` - Numeric coordinates
- `geotag_location` - Coordinate string (for compatibility)

#### Issue 3: No Reverse Geocoding for Reports
**Problem**: If report only has coordinates, no human-readable address
- Hard to read in notifications
- Poor UX

**Recommendation**: Add reverse geocoding when report is created:
```javascript
// In API or client-side
if (report.latitude && report.longitude && !report.address) {
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ 
    location: { lat: report.lat, lng: report.lng } 
  }, (results) => {
    if (results[0]) {
      report.address = results[0].formatted_address;
    }
  });
}
```

#### Issue 4: Assignment Without Coordinates
**Problem**: Reports can be assigned even if they lack valid coordinates
- Station dashboard might not show report on map
- Snapshot might have null coordinates

**Recommendation**: Validate coordinates before assignment:
```javascript
const handleAssign = async () => {
  const lat = parseFloat(selectedReport.latitude);
  const lng = parseFloat(selectedReport.longitude);
  
  if (isNaN(lat) || isNaN(lng)) {
    alert('Cannot assign: Report missing valid coordinates');
    return;
  }
  // ... proceed with assignment
};
```

### 5.3 Database Schema Recommendations

#### Add Indexes
```sql
-- For faster station lookups
CREATE INDEX IF NOT EXISTS idx_station_users_lat_lng 
ON station_users(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- For faster report coordinate queries
CREATE INDEX IF NOT EXISTS idx_assigned_snapshots_coords 
ON assigned_report_snapshots(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

#### Add Constraints
```sql
-- Ensure station coordinates are valid if present
ALTER TABLE station_users 
ADD CONSTRAINT check_valid_coords 
CHECK (
  (lat IS NULL AND lng IS NULL) OR 
  (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
);
```

### 5.4 Summary

**Assignment System**:
- ✅ Well-structured with dual tables
- ✅ Handles both stations and responders
- ✅ Includes notification system
- ⚠️ Could benefit from coordinate validation

**Address System (Reports)**:
- ✅ Flexible with multiple fallback options
- ✅ Handles both coordinates and addresses
- ⚠️ Field names could be standardized
- ⚠️ Missing reverse geocoding for coordinate-only reports

**Address System (Stations)**:
- ✅ Automatic geocoding works well
- ✅ Handles missing coordinates gracefully
- ⚠️ Geocoded coordinates not persisted (performance issue)
- ⚠️ Could benefit from coordinate validation

---

## 📝 Notes

- **Report IDs**: Fire report IDs are TEXT (from Firebase), not UUIDs
- **Station IDs**: Station IDs are UUIDs (from Supabase)
- **Geocoding**: Happens client-side using Google Maps API
- **Snapshots**: Created when report is assigned, not when report is created
- **Forwarding**: Does NOT change primary assignment, only creates routing history

---

*Analysis Date: 2024*
*Codebase Version: Current*


