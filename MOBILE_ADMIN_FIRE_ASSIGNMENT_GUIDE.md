# Mobile Admin Fire Assignment & Rerouting - User Guide

## 🎯 Quick Start Guide

### How to Assign a Fire to a Station

**Step 1: Touch the Fire Icon**
- Open the Admin Map
- Locate a fire marker (🔥) on the map
- Tap the fire icon to open the details modal

**Step 2: View Fire Details**
The modal will show:
- Reporter information
- Cause of fire
- Alarm level (color-coded)
- AI detection results
- Location and coordinates
- Photo (if available)

**Step 3: Check Current Status** (if previously assigned)
- **Blue Box** 📍 = Shows current assignment
  - Station/responder name
  - Assignment timestamp
  - Assignment note
- **Yellow Box** 📨 = Shows forwarding history
  - List of stations/agencies
  - Forwarding notes
  - Forwarding timestamps

**Step 4: Assign to a Station**
1. Scroll the "Assignment" section
2. Select assignee type:
   - Tap **"Station"** button (red when selected)
   - Or tap **"Responder"** button
3. Scroll horizontally to find the station
4. Tap the station name (turns red when selected)
5. (Optional) Add an assignment note:
   - Tap in the text box
   - Type your note (e.g., "Closest station to incident")
6. Tap the blue **"Assign"** button
7. Wait for success confirmation

**Step 5: Forward/Redirect the Fire**
1. Scroll to "Redirect / Forward" section
2. Select target:
   - Scroll stations horizontally, OR
   - Tap **"Police"** / **"Utilities"** / **"Barangay"** quick buttons
3. (Optional) Add a forward note:
   - Tap in the text box
   - Type reason for forwarding (e.g., "Outside jurisdiction")
4. Tap the amber **"Forward"** button
5. Wait for success confirmation

---

## 📋 Feature Details

### Assignment Section
```
┌─────────────────────────────────┐
│ Assignment                      │
├─────────────────────────────────┤
│ [Station] [Responder]           │ ← Type selector
│                                 │
│ Assignee ID                     │
│ [Station A] [Station B] [...]→  │ ← Horizontal scroll
│                                 │
│ Assignment Note (optional)      │
│ ┌─────────────────────────────┐ │
│ │ Add a note for this         │ │ ← Multi-line input
│ │ assignment...               │ │
│ └─────────────────────────────┘ │
│                                 │
│      [Assign]                   │ ← Blue button
│                                 │
│ You can reassign anytime —      │
│ the latest assignment is active.│
└─────────────────────────────────┘
```

### Forward/Redirect Section
```
┌─────────────────────────────────┐
│ Redirect / Forward              │
├─────────────────────────────────┤
│ Select target station or agency │
│                                 │
│ [Station A] [Station B] [...]→  │ ← Stations
│ [Police] [Utilities] [Barangay] │ ← Agencies
│                                 │
│ Forward Note (optional)         │
│ ┌─────────────────────────────┐ │
│ │ Add a note for this         │ │ ← Multi-line input
│ │ forwarding...               │ │
│ └─────────────────────────────┘ │
│                                 │
│      [Forward]                  │ ← Amber button
│                                 │
│ Forwarding keeps the original   │
│ assignment and records          │
│ provenance.                     │
└─────────────────────────────────┘
```

### Current Assignment Display
```
┌─────────────────────────────────┐
│ 📍 Currently Assigned To:       │
│                                 │
│ Station Name Here               │
│                                 │
│ Assigned: Oct 10, 2025 2:30 PM  │
│                                 │
│ Note: Closest station to        │
│ incident location               │
└─────────────────────────────────┘
```

### Forwarding History Display
```
┌─────────────────────────────────┐
│ 📨 Forwarded To:                │
├─────────────────────────────────┤
│ Station Central                 │
│ Note: Primary responder         │
│ Forwarded: Oct 10, 2025 2:35 PM │
├─────────────────────────────────┤
│ Police Department               │
│ Note: Traffic control needed    │
│ Forwarded: Oct 10, 2025 2:40 PM │
└─────────────────────────────────┘
```

---

## 🎨 Visual Indicators

### Color Coding
- **🔴 Red Background** = Selected assignment option
- **🔵 Blue Button** = Assign action
- **🟡 Amber Button** = Forward action
- **🔵 Blue Box** = Current assignment info
- **🟡 Yellow Box** = Forwarding history

### Fire Marker Colors (Alarm Levels)
- **Light Yellow** (#fef3c7) = First Alarm
- **Light Orange** (#fed7aa) = Second Alarm
- **Light Red** (#fecaca) = Third Alarm
- **Red** (#f87171) = Fourth Alarm
- **Dark Red** (#ef4444) = Fifth Alarm
- **Very Dark Red** (#dc2626-#450a0a) = Task Force / General Alarm
- **Light Blue** (#93c5fd) = Fire Out / No Fire

---

## 💡 Tips & Best Practices

### Assignment Tips
1. **Always check current assignment first** before reassigning
2. **Add notes** to provide context for the next shift
3. **Use station names** not just IDs when discussing
4. **Reassign immediately** if mistake is made (latest wins)

### Forwarding Tips
1. **Forward to Police** when traffic control needed
2. **Forward to Utilities** when power/water issues involved
3. **Forward to Barangay** for community coordination
4. **Add forwarding notes** explaining why - creates audit trail
5. **Forward doesn't replace assignment** - it adds recipients

### Notes Best Practices
- **Be specific**: "Station 5 closer by 2km" vs "Closer station"
- **Include details**: "Forwarded due to hazmat expertise needed"
- **Think ahead**: Notes help next shift understand decisions
- **Keep concise**: Mobile screens are small

---

## ⚠️ Important Notes

### Assignment vs. Forwarding
- **Assignment** = Primary responsible station/responder
  - Only ONE active assignment at a time
  - Reassignment replaces previous
  - Creates snapshot for reliable rendering

- **Forwarding** = Additional recipients/coordination
  - MULTIPLE forwards possible
  - Creates chain of provenance
  - Doesn't replace assignment

### When to Use Each

**Use Assignment when:**
- First responder needs to be designated
- Primary responsibility needs clarification
- Changing which station handles the fire
- Correcting a mistake

**Use Forwarding when:**
- Additional agencies need notification
- Report needs to go to multiple stations
- Coordinating multi-agency response
- Escalating beyond fire department

### Data Persistence
- All assignments saved to database
- All forwards create history records
- Snapshots ensure map reliability
- Changes sync across all admin devices

---

## 🔧 Troubleshooting

### Problem: Assignment button does nothing
**Solution:** Make sure you've selected a station first (red highlight)

### Problem: Can't see all stations
**Solution:** Scroll horizontally - swipe left/right on the station list

### Problem: Notes not saving
**Solution:** Make sure to tap Assign/Forward AFTER typing note

### Problem: No current assignment shown
**Solution:** This fire hasn't been assigned yet - you can be first!

### Problem: Forward seems to fail
**Solution:** Check that you selected a target (station or agency button)

### Problem: Don't see assignment/forward sections
**Solution:** Scroll down in the modal - they're after the fire details

---

## 📱 Mobile-Specific Features

### Touch Interactions
- **Single tap** = Select/Open
- **Swipe left/right** = Scroll station lists
- **Tap outside modal** = Close
- **Tap X button** = Close modal

### Keyboard Behavior
- Keyboard auto-opens when tapping note fields
- Keyboard auto-closes when tapping Assign/Forward
- Scroll modal to see hidden content behind keyboard

### Screen Adaptation
- Modal auto-sizes to 90% of screen
- Vertical scroll for long content
- Horizontal scroll for station lists
- All buttons sized for easy tapping

---

## 📊 What Happens After Assignment/Forward

### After Assignment
1. ✅ Database updated with new assignment
2. ✅ Snapshot created with fire coordinates
3. ✅ Success alert displayed
4. ✅ Assignment info refreshed in modal
5. ✅ Station dashboard receives update
6. ✅ Previous assignment replaced

### After Forwarding
1. ✅ Database updated with forward record
2. ✅ Success alert displayed
3. ✅ Forwarding history refreshed in modal
4. ✅ Target station/agency notified
5. ✅ Forward added to history chain
6. ✅ Original assignment unchanged

---

## 🔐 Permissions & Security

- Only **Admin users** can assign/forward fires
- All actions are **logged with timestamps**
- **Audit trail** maintained in database
- **Cannot delete** assignment history
- **Cannot edit** past forwards (only add new)

---

## 🚀 Advanced Usage

### Rapid Assignment Workflow
1. Keep modal open
2. Quickly tap station → Assign
3. Modal stays open for verification
4. Close when satisfied

### Multi-Forward Workflow
1. Assign to primary station first
2. Forward to police (add note)
3. Forward to utilities (add note)
4. Forward to additional stations as needed
5. Each creates separate history entry

### Assignment Correction
1. Notice wrong station assigned
2. Select correct station
3. (Optional) Add note: "Correcting assignment"
4. Tap Assign
5. Latest assignment becomes active

---

## 📞 Getting Help

If you encounter issues:
1. Check this guide first
2. Verify database connection
3. Check console logs for errors
4. Contact technical support
5. Report bugs to development team

---

## ✨ Summary

**Key Features:**
- ✅ Tap fire icon to open details
- ✅ See current assignment in blue box
- ✅ See forwarding history in yellow box
- ✅ Assign to stations/responders
- ✅ Add optional assignment notes
- ✅ Forward to stations/agencies
- ✅ Add optional forward notes
- ✅ Automatic status updates
- ✅ Complete audit trail

**Remember:**
- Assignment = Primary responder (only one)
- Forwarding = Additional recipients (multiple)
- Notes help coordinate response
- All actions are tracked and saved

Happy firefighting! 🚒🔥

