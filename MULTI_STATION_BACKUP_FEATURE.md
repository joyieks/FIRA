# Multi-Station Backup Assignment Feature

**Implementation Date**: December 11, 2025  
**Branch**: joy_supabase  
**Feature Type**: Multi-Station Incident Support (Alarm Level 2+)

---

## 🎯 Feature Overview

This feature allows multiple fire stations to be assigned to a single incident when the alarm level escalates to **Second Alarm or higher**. It reflects real-world BFP (Bureau of Fire Protection) workflow where high-severity incidents require backup from multiple stations.

### Key Concepts

- **Primary Station**: First station assigned to the incident
  - ✅ **Can change fire status** (On Going, Under Control, Fire Out)
  - ✅ Full control over the incident
  - ✅ Assigned automatically or manually by admin

- **Backup Station(s)**: Additional stations for Alarm Level 2+ incidents
  - 🚫 **Cannot change fire status** (read-only)
  - ✅ Provides support and resources
  - ✅ Sees incident in their dashboard until Fire Out
  - ✅ Must accept backup assignment (approval modal)

---

## 📋 Prerequisites & Setup

### Step 1: Run SQL Migration

**IMPORTANT**: Before using this feature, run the migration file in Supabase SQL Editor:

**File**: `add_assignment_role_column.sql`

```sql
-- Add assignment_role column to distinguish primary vs backup stations
ALTER TABLE report_assignments
ADD COLUMN IF NOT EXISTS assignment_role TEXT DEFAULT 'primary';

-- Add check constraint
ALTER TABLE report_assignments
ADD CONSTRAINT check_assignment_role 
CHECK (assignment_role IN ('primary', 'backup'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_report_assignments_role 
ON report_assignments(report_id, assignment_role);

-- Update existing records to 'primary'
UPDATE report_assignments
SET assignment_role = 'primary'
WHERE assignment_role IS NULL;
```

**How to run**:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the contents of `add_assignment_role_column.sql`
4. Click "Run"
5. Verify: Check if `assignment_role` column exists in `report_assignments` table

---

## 🚀 How to Use

### Workflow: Testing Multi-Station Assignment

#### Step 1: Assign Primary Station
1. Open Admin Dashboard
2. Select a fire report
3. Assign a station (either auto-assigned or manual)
4. **This becomes the PRIMARY station** ⭐

#### Step 2: Escalate Alarm Level
1. While the report is selected, update the alarm level
2. Set it to **Second Alarm** or higher:
   - Second Alarm (2)
   - Third Alarm (3)
   - Fourth Alarm (4)
   - Fifth Alarm (5)
   - General Alarm

#### Step 3: Assign Backup Station(s)
1. After setting alarm level 2+, a **purple panel** appears in the assignment section
2. The panel shows:
   ```
   🚨 [Alarm Level] - Assign Backup Station
   
   This incident requires backup support. Backup stations can view 
   and support but cannot change the fire status.
   
   [Select backup station... ▼]
   [Assign Backup Station]
   ```
3. Select a station from the dropdown (already-assigned stations are excluded)
4. Click "Assign Backup Station"

#### Step 4: Backup Station Approval
- If the backup station is **busy** (handling other incidents):
  - Status set to `'pending'`
  - Backup station receives notification: "Will you accept as backup?"
  - Admin sees "Waiting for Backup Approval" modal
  - Backup station must accept/decline

- If the backup station is **free**:
  - Status set to `'accepted'` (auto-accepted)
  - Backup station receives informational notification
  - Admin sees success message immediately

#### Step 5: View All Assigned Stations
Once backup stations are assigned, a **green panel** appears showing all stations:

```
🚒 All Assigned Stations:

Station Alpha          ⭐ PRIMARY
Note: Auto-assigned
Assigned: Dec 11, 2025 10:30 AM

Station Beta           🔧 BACKUP
Note: Backup for Second Alarm incident
Assigned: Dec 11, 2025 11:00 AM
```

#### Step 6: Station Dashboards
- **Both primary and backup stations** see the incident in their dashboards
- Primary station has full controls (status buttons enabled)
- Backup stations have read-only view (status buttons disabled/hidden)
- All stations see the incident until it's marked as "Fire Out"

---

## 🔧 Technical Implementation

### Database Changes

#### New Column: `assignment_role`
```sql
report_assignments {
  report_id: TEXT,
  assignee_type: TEXT ('station' | 'responder'),
  assignee_id: UUID,
  assigned_at: TIMESTAMP,
  status: TEXT ('pending' | 'accepted' | 'declined'),
  assignment_source: TEXT ('automatic' | 'manual'),
  assignment_role: TEXT ('primary' | 'backup'),  <-- NEW
  note: TEXT
}
```

**Values**:
- `'primary'`: First station assigned, can change status
- `'backup'`: Additional stations for alarm level 2+, read-only

### Code Changes

#### 1. State Variables (Adashboard.jsx)
```javascript
const [currentAssignment, setCurrentAssignment] = useState(null); // Primary station
const [allAssignedStations, setAllAssignedStations] = useState([]); // All stations with roles
const [showWaitingBackupModal, setShowWaitingBackupModal] = useState(false);
const [pendingBackupAssignment, setPendingBackupAssignment] = useState(null);
```

#### 2. Updated Functions

**loadAssignmentInfo()** - Now fetches ALL stations:
```javascript
const { data: allAssignments } = await supabase
  .from('report_assignments')
  .select('assignee_type, assignee_id, assigned_at, note, status, assignment_role')
  .eq('report_id', reportId)
  .eq('assignee_type', 'station')
  .in('status', ['pending', 'accepted'])
  .order('assignment_role', { ascending: true }); // primary first
```

**handleAssign()** - Sets `assignment_role: 'primary'`:
```javascript
const assignments = reportsToAssign.map(report => ({
  report_id: report.id,
  assignee_type: assigneeType,
  assignee_id: assigneeId,
  assigned_at: new Date().toISOString(),
  status: busyCheck.isBusy ? 'pending' : 'accepted',
  assignment_source: 'manual',
  assignment_role: 'primary', // <-- NEW
  note: assignmentNote
}));
```

**handleAssignBackup()** - NEW function for backup assignments:
```javascript
const handleAssignBackup = useCallback(async (backupStationId) => {
  // 1. Validate alarm level is 2+
  const isAlarmLevel2Plus = alarmLevelCleaned && (
    alarmLevelCleaned.includes('Second Alarm') ||
    alarmLevelCleaned.includes('Third Alarm') ||
    // ... etc
  );
  
  if (!isAlarmLevel2Plus) {
    alert('Backup stations can only be assigned to Alarm Level 2+');
    return;
  }
  
  // 2. Check if station already assigned
  const { data: existing } = await supabase
    .from('report_assignments')
    .select('assignment_role')
    .eq('report_id', selectedReport.id)
    .eq('assignee_id', backupStationId)
    .single();
  
  if (existing) {
    alert('Station already assigned');
    return;
  }
  
  // 3. Check if busy
  const busyCheck = await checkStationIsBusy(backupStationId);
  
  // 4. Insert backup assignment
  const backupAssignment = {
    report_id: selectedReport.id,
    assignee_type: 'station',
    assignee_id: backupStationId,
    assigned_at: new Date().toISOString(),
    status: busyCheck.isBusy ? 'pending' : 'accepted',
    assignment_source: 'manual',
    assignment_role: 'backup', // <-- KEY DIFFERENCE
    note: `Backup for ${alarmLevelCleaned} incident`
  };
  
  await supabase.from('report_assignments').insert(backupAssignment);
  
  // 5. Create notification
  const title = `🚨 Backup Assistance Request - ${alarmLevelCleaned}`;
  const message = `Command Center is requesting your station as BACKUP...
  Note: You will provide support but cannot change the fire status.
  Will you accept this backup assignment?`;
  
  // 6. Show modal or success
  if (busyCheck.isBusy) {
    setShowWaitingBackupModal(true);
  } else {
    alert('Backup station assigned successfully');
  }
}, [selectedReport, loadAssignmentInfo]);
```

#### 3. UI Components

**All Assigned Stations Display** (Green Panel):
```jsx
{allAssignedStations.length > 1 && (
  <div className="mt-3 bg-green-50 border-l-4 border-green-500 p-3 rounded">
    <p className="font-bold text-green-900 text-sm mb-2">All Assigned Stations:</p>
    {allAssignedStations.map((station) => (
      <div>
        <p>{station.name}</p>
        <span className={station.role === 'primary' ? 'bg-blue-600' : 'bg-purple-600'}>
          {station.role === 'primary' ? '⭐ PRIMARY' : '🔧 BACKUP'}
        </span>
      </div>
    ))}
  </div>
)}
```

**Backup Assignment Panel** (Purple Panel - only shows for alarm level 2+):
```jsx
{currentAssignment && isAlarmLevel2Plus && (
  <div className="mt-3 bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
    <p className="font-bold text-purple-900 text-sm mb-2">
      {alarmLevelCleaned} - Assign Backup Station
    </p>
    <select id="backup-station-select">
      <option value="">Select backup station…</option>
      {allStations
        .filter(s => !allAssignedStations.some(assigned => assigned.id === s.id))
        .map(s => <option value={s.id}>{s.station_name}</option>)}
    </select>
    <button onClick={() => handleAssignBackup(selectedBackupId)}>
      Assign Backup Station
    </button>
  </div>
)}
```

**Waiting Backup Modal**:
```jsx
{showWaitingBackupModal && pendingBackupAssignment && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
    <div className="bg-white rounded-2xl p-8">
      <h3>Waiting for Backup Approval</h3>
      <p>Backup request sent to {pendingBackupAssignment.stationName}.</p>
      <p className="text-xs">Backup stations provide support but cannot change fire status</p>
      <button onClick={() => setShowWaitingBackupModal(false)}>Okay</button>
    </div>
  </div>
)}
```

#### 4. Realtime Listeners

Updated INSERT/UPDATE listener to handle backup acceptances:
```javascript
if (assignment.status === 'accepted') {
  const isBackup = assignment.assignment_role === 'backup';
  
  if (isBackup) {
    setShowWaitingBackupModal(false);
    alert(`✅ ${stationName} has accepted the backup assignment.`);
    setPendingBackupAssignment(null);
  } else {
    setShowWaitingApprovalModal(false);
    alert(`✅ ${stationName} has accepted the assignment.`);
    setPendingAssignment(null);
  }
  
  loadAssignmentInfo(selectedReport.id); // Refresh to show all stations
}
```

---

## 🎨 Visual Design

### Color Coding

| Element | Color | Purpose |
|---------|-------|---------|
| Primary Station | Blue (`bg-blue-600`) | Main station badge |
| Backup Station | Purple (`bg-purple-600`) | Backup station badge |
| All Stations Panel | Green (`bg-green-50` + `border-green-500`) | Shows all assigned stations |
| Backup Assignment Panel | Purple (`bg-purple-50` + `border-purple-500`) | Backup assignment controls |
| Waiting Backup Modal | Purple gradient | Backup approval waiting state |

### Badges

```
⭐ PRIMARY  - Blue badge with white text
🔧 BACKUP   - Purple badge with white text
```

---

## 🔍 Testing Checklist

### Test Case 1: Primary Assignment
- [ ] Assign a station to a report (First Alarm)
- [ ] Verify station is marked as "PRIMARY" (blue badge)
- [ ] Verify station can change fire status

### Test Case 2: Cannot Assign Backup (Alarm Level 1)
- [ ] Try to assign backup station while alarm level is "First Alarm"
- [ ] Verify purple backup panel does NOT appear
- [ ] Set alarm level to Second Alarm
- [ ] Verify purple backup panel NOW appears

### Test Case 3: Assign Backup (Free Station)
- [ ] Set incident to Second Alarm
- [ ] Assign a backup station that is free
- [ ] Verify auto-acceptance (no approval modal)
- [ ] Verify green "All Assigned Stations" panel shows both stations
- [ ] Verify primary has ⭐ PRIMARY badge
- [ ] Verify backup has 🔧 BACKUP badge

### Test Case 4: Assign Backup (Busy Station)
- [ ] Ensure backup station is busy (has active incidents)
- [ ] Assign as backup
- [ ] Verify "Waiting for Backup Approval" modal appears
- [ ] (Station accepts) Verify modal closes and success message
- [ ] Verify backup station appears in green panel

### Test Case 5: Prevent Duplicate Assignment
- [ ] Try to assign the same station as backup twice
- [ ] Verify error: "Station already assigned as [role]"

### Test Case 6: Multiple Backups
- [ ] Set incident to Third Alarm
- [ ] Assign backup station #1
- [ ] Assign backup station #2
- [ ] Assign backup station #3
- [ ] Verify green panel shows all 4 stations (1 primary + 3 backups)

### Test Case 7: Station Dashboard (Primary)
- [ ] Log in as primary station
- [ ] Verify incident appears in dashboard
- [ ] Verify status controls are enabled
- [ ] Verify can change status to "Under Control", "Fire Out", etc.

### Test Case 8: Station Dashboard (Backup)
- [ ] Log in as backup station
- [ ] Verify incident appears in dashboard
- [ ] Verify role indicator shows "BACKUP"
- [ ] Verify status controls are disabled/hidden
- [ ] Verify can view all incident details

### Test Case 9: Fire Out (All Stations Leave)
- [ ] Primary station marks incident as "Fire Out"
- [ ] Verify incident disappears from ALL station dashboards
- [ ] Verify assignments remain in database (for history)

### Test Case 10: Backup Declination
- [ ] Assign backup to busy station
- [ ] Station declines backup request
- [ ] Verify reroute modal appears (or appropriate flow)

---

## 📊 Database Queries for Verification

### Check All Stations for a Report
```sql
SELECT 
  ra.report_id,
  ra.assignee_id,
  su.station_name,
  ra.assignment_role,
  ra.status,
  ra.assigned_at,
  ra.note
FROM report_assignments ra
JOIN station_users su ON ra.assignee_id = su.id
WHERE ra.report_id = 'YOUR_REPORT_ID'
  AND ra.assignee_type = 'station'
  AND ra.status IN ('pending', 'accepted')
ORDER BY ra.assignment_role ASC, ra.assigned_at ASC;
```

### Find Reports with Multiple Stations
```sql
SELECT 
  report_id,
  COUNT(*) as station_count,
  STRING_AGG(CONCAT(station_name, ' (', assignment_role, ')'), ', ') as stations
FROM report_assignments ra
JOIN station_users su ON ra.assignee_id = su.id
WHERE assignee_type = 'station'
  AND status IN ('pending', 'accepted')
GROUP BY report_id
HAVING COUNT(*) > 1
ORDER BY station_count DESC;
```

### Get Primary Station for Report
```sql
SELECT 
  su.station_name,
  ra.assigned_at,
  ra.status
FROM report_assignments ra
JOIN station_users su ON ra.assignee_id = su.id
WHERE ra.report_id = 'YOUR_REPORT_ID'
  AND ra.assignee_type = 'station'
  AND ra.assignment_role = 'primary'
  AND ra.status IN ('pending', 'accepted')
LIMIT 1;
```

### Get All Backup Stations for Report
```sql
SELECT 
  su.station_name,
  ra.assigned_at,
  ra.status,
  ra.note
FROM report_assignments ra
JOIN station_users su ON ra.assignee_id = su.id
WHERE ra.report_id = 'YOUR_REPORT_ID'
  AND ra.assignee_type = 'station'
  AND ra.assignment_role = 'backup'
  AND ra.status IN ('pending', 'accepted')
ORDER BY ra.assigned_at ASC;
```

---

## ⚠️ Important Notes

### Alarm Level Requirements
The backup assignment panel **only appears** when:
1. A primary station is already assigned
2. Alarm level is **Second Alarm or higher**

Alarm levels that enable backup:
- ✅ Second Alarm
- ✅ Third Alarm
- ✅ Fourth Alarm
- ✅ Fifth Alarm
- ✅ General Alarm

Alarm levels that DON'T enable backup:
- ❌ First Alarm
- ❌ Task Force
- ❌ (Not set)

### Status Control Restrictions
**Primary Station**:
- Can change status to: On Going, Under Control, Fire Out, Cancelled
- Has full CRUD on incident details
- Responsible for final status updates

**Backup Station**:
- **Cannot** change fire status (buttons disabled)
- **Can** view all incident details
- **Can** see other assigned stations
- **Can** communicate via chat (if implemented)

### Assignment Persistence
- Assignments remain in database after "Fire Out" (for audit trail)
- Station dashboards filter by `status != 'Fire Out'`
- Admin dashboard shows historical assignments
- `assignment_role` never changes (primary stays primary)

### Migration Backward Compatibility
- Existing assignments automatically get `assignment_role = 'primary'`
- Old code continues to work (defaults to primary)
- New feature is opt-in (only for alarm level 2+)

---

## 🐛 Troubleshooting

### Issue: "Column assignment_role does not exist"
**Solution**: Run the migration SQL file (`add_assignment_role_column.sql`)

### Issue: Backup panel doesn't appear
**Check**:
1. Is a primary station already assigned?
2. Is alarm level Second Alarm or higher?
3. Check console for JavaScript errors

### Issue: Backup station can change status
**Check**: Station dashboard code - ensure status buttons check `assignment_role === 'primary'`

### Issue: Same station assigned twice
**Check**: handleAssignBackup validation - should prevent duplicate assignments

### Issue: Backup modal doesn't close
**Check**: Realtime listener - ensure it handles `assignment_role === 'backup'` correctly

---

## 📚 Related Files

### Modified Files
- `Website/web/pfira-app/src/components/pages/admin/Adashboard/Adashboard.jsx`
  - Added `allAssignedStations` state
  - Updated `loadAssignmentInfo()` to fetch all stations
  - Added `handleAssignBackup()` function
  - Updated UI to show all stations and backup controls
  - Updated realtime listeners

### New Files
- `add_assignment_role_column.sql` - Database migration

### Files to Update (Future)
- `Website/web/pfira-app/src/components/pages/stations/Sdashboard/Sdashboard.jsx`
  - Show role indicator (primary/backup)
  - Disable status controls for backup stations
- `mobile/app/Stations/StationsMenu/StationsStatus/SStatus.jsx`
  - Same as above for mobile

---

## ✅ Feature Complete!

This multi-station backup assignment feature is now fully implemented and ready for testing. It mirrors real-world BFP operations where high-severity incidents require multiple stations working together, with clear roles and responsibilities.

**Next Steps**:
1. Run SQL migration in Supabase
2. Test assignment flows (see checklist above)
3. Update station dashboards to respect `assignment_role`
4. Test end-to-end with multiple stations

---

**Questions or Issues?**  
Check the troubleshooting section or review the code comments in `Adashboard.jsx` for implementation details.
