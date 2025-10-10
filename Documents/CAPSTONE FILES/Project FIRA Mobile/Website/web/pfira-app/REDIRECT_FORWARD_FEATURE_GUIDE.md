# Redirect/Forward Feature Guide

## Overview

The FIRA system has two different ways to handle fire report routing:

### 1. **Assignment** (Primary)
- **Purpose**: Directly assign a fire report to a station or responder
- **Table**: `report_assignments`
- **Behavior**: Sets the primary responsible party for the report
- **Visibility**: Assigned reports appear on station/responder dashboards
- **Action**: "Assign" button in admin dashboard

### 2. **Redirect/Forward** (Secondary/Routing History)
- **Purpose**: Forward a report to another station while keeping the original assignment
- **Table**: `report_routes`
- **Behavior**: Creates a routing/provenance trail without changing the primary assignment
- **Visibility**: Currently for administrative tracking only
- **Action**: "Forward" button in admin dashboard

## How Redirect/Forward Works

### Step 1: Admin Assigns a Report
```sql
-- Example: Assign report #123 to Station A
INSERT INTO report_assignments (report_id, assignee_type, assignee_id)
VALUES ('123', 'station', 'uuid-of-station-a');
```
- Report now appears on Station A's dashboard
- Station A sees it as their assigned report

### Step 2: Admin Forwards the Report
```sql
-- Example: Forward report #123 to Station B
INSERT INTO report_routes (report_id, target, note)
VALUES ('123', 'station:uuid-of-station-b', 'Station A requested backup');
```
- Creates a forwarding record
- **Original assignment to Station A remains unchanged**
- Station B can see they received a forwarded report (if we implement this feature)

## Database Setup

### Required Tables

Run this SQL in your Supabase SQL Editor to create the missing table:

```sql
-- Report Routes/Forwarding Table
CREATE TABLE IF NOT EXISTS report_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,
    target TEXT NOT NULL,  -- Format: 'station:<uuid>' or 'agency:police'
    note TEXT,
    forwarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_routes_report_id ON report_routes(report_id);
CREATE INDEX IF NOT EXISTS idx_report_routes_target ON report_routes(target);

ALTER TABLE report_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on report_routes" ON report_routes FOR ALL USING (true);
```

Or simply run: `Website/web/pfira-app/supabase-tables.sql` (updated version includes this table)

## Current Implementation Status

### ✅ Working Features
1. **Admin can assign reports** to stations/responders
2. **Stations see assigned reports** on their dashboard
3. **UI for redirect/forward** exists in admin dashboard
4. **Redirect function** is implemented in code

### ❌ Not Working (Before Fix)
1. **`report_routes` table was missing** - Forward button failed silently
2. **Stations cannot see forwarded reports** - No UI implementation yet

### ✅ Fixed
1. **Created `report_routes` table** with proper schema
2. **Updated supabase-tables.sql** to include all routing tables

## How to Use the Feature

### For Admin (Web):

1. **Click on a fire report marker** on the map
2. In the popup, you'll see two sections:
   - **Assign** section - Set primary responsible party
   - **Redirect/Forward** section - Forward to another station

3. **To Assign:**
   - Select "Station" or "Responder"
   - Choose the assignee from dropdown
   - Click "Assign"

4. **To Forward:**
   - Select target station from dropdown
   - Add optional note (e.g., "Requesting backup")
   - Click "Forward"

### Target Format
The `target` field uses this format:
- **Station**: `station:<station-uuid>`
- **Agency** (future): `agency:police`, `agency:medical`, etc.

## Potential Enhancements

### 1. Show Forwarded Reports on Station Dashboard
Currently, stations only see reports where `assignee_id = their_id` in `report_assignments`.

To also show forwarded reports, modify station dashboard query:
```javascript
// Current: Only shows assigned reports
const { data: assignments } = await supabase
  .from('report_assignments')
  .select('report_id')
  .eq('assignee_id', stationId);

// Enhanced: Also show forwarded reports
const { data: forwarded } = await supabase
  .from('report_routes')
  .select('report_id')
  .like('target', `station:${stationId}`);

// Combine both lists
const allReportIds = [
  ...assignments.map(a => a.report_id),
  ...forwarded.map(f => f.report_id)
];
```

### 2. Show Forwarding History
Display routing trail for a report:
```javascript
const { data: routingHistory } = await supabase
  .from('report_routes')
  .select('*')
  .eq('report_id', reportId)
  .order('forwarded_at', { ascending: false });
```

### 3. Notifications
Send notifications to stations when they receive a forwarded report.

## Testing the Feature

### 1. Create the table
```bash
# Run in Supabase SQL Editor
cat Website/web/pfira-app/report-routes-table.sql
```

### 2. Test Assignment
- Login as admin
- Click a fire report on the map
- Assign it to a station
- Check the station dashboard - report should appear

### 3. Test Forward
- Click the same report
- Forward it to a different station
- Check Supabase Database - `report_routes` table should have a new row

### 4. Verify Data
```sql
-- View all assignments
SELECT * FROM report_assignments;

-- View all forwarding records
SELECT * FROM report_routes;
```

## Troubleshooting

### Error: "relation 'report_routes' does not exist"
**Solution**: Run `Website/web/pfira-app/report-routes-table.sql` in Supabase SQL Editor

### Forward button does nothing
**Solution**: Check browser console for errors. Ensure `report_routes` table exists.

### Forwarded reports don't appear on station dashboard
**Expected**: Currently, forwarded reports are tracked but not displayed to stations. This is by design - only assigned reports appear. To change this, implement Enhancement #1 above.

## Summary

- **Assignment** = Primary responsibility (shows on dashboard)
- **Forward** = Routing history (tracks provenance)
- **Both are independent** - you can assign to Station A and forward to Station B
- **Table must exist** - Run the SQL file to create `report_routes` table

