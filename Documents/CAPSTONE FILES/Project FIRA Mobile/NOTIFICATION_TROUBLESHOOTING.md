# Notification System Troubleshooting Guide

## 🔍 Issue: No Notifications Created When Fire Report Submitted

### Step-by-Step Debugging

#### **Step 1: Verify Tables Exist in Supabase**

Go to your Supabase dashboard → SQL Editor and run:

```sql
-- Check if admin_users table exists
SELECT COUNT(*) as admin_count FROM admin_users;

-- Check if notifications table exists
SELECT COUNT(*) as notification_count FROM notifications;
```

**Expected Result:**
- If you see an error like "relation does not exist", the table is missing
- If successful, you'll see the count

---

#### **Step 2: Setup Admin Users**

Run this SQL script in Supabase SQL Editor:

📁 File: `Website/web/pfira-app/setup-admin-for-notifications.sql`

Or copy and run:

```sql
-- Ensure admin_users table exists
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'admin',
    active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
CREATE POLICY "Allow all operations on admin_users" ON admin_users FOR ALL USING (true);

-- Insert default admin
INSERT INTO admin_users (email, first_name, last_name, role) 
VALUES ('admin@gmail.com', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Verify
SELECT id, email, first_name, last_name FROM admin_users;
```

**Expected Result:**
- You should see at least 1 admin user in the results

---

#### **Step 3: Test Fire Report Submission with Logging**

1. **Open Mobile App** (Expo)
2. **Open the console/terminal** where Expo is running
3. **Login as a citizen**
4. **Submit a fire report** from the Status tab
5. **Watch the console output**

**Expected Console Logs:**
```
🔔 Starting notification creation...
📊 Admin users query result: { adminUsers: [...], adminError: null, count: 1 }
✅ Found 1 admin user(s), creating notifications...
📝 Notifications to insert: [...]
✅ Successfully created notifications: [...]
✅ Created 1 notification(s) for 1 admin user(s)
```

**Common Issues:**

❌ **"No admin users found in database!"**
- **Solution**: Run Step 2 again to insert admin users

❌ **Error: "relation 'admin_users' does not exist"**
- **Solution**: Run the `setup-admin-for-notifications.sql` script

❌ **Error: "relation 'notifications' does not exist"**
- **Solution**: Run the `notifications-table.sql` script

❌ **Error: "permission denied for table admin_users"**
- **Solution**: Check RLS policies, ensure they allow SELECT operations

---

#### **Step 4: Verify Notifications in Database**

After submitting a fire report, check Supabase:

```sql
-- View all notifications
SELECT 
    id,
    user_type,
    title,
    message,
    priority,
    is_read,
    created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Result:**
- You should see 1 notification per admin user
- `user_type` should be 'admin'
- `title` should be "🔥 New Fire Report Submitted"
- `is_read` should be `false`

---

#### **Step 5: Check Admin Notifications Page**

**Web Admin:**
1. Login as admin at the web portal
2. Go to Notifications page
3. You should see the notification

**Mobile Admin:**
1. Login as admin on mobile app
2. Go to Notifications tab
3. Pull to refresh
4. You should see the notification

---

## 🛠️ Quick Fixes

### Fix 1: Reset Everything

```sql
-- 1. Drop and recreate notifications table
DROP TABLE IF EXISTS notifications CASCADE;

-- Run the notifications-table.sql script

-- 2. Ensure admin users exist
-- Run setup-admin-for-notifications.sql
```

### Fix 2: Check Supabase Connection

In the mobile app, verify Supabase is configured:

📁 File: `mobile/app/config/supabase.js`

Should have:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wedqhsgrxnvbhklzhnet.supabase.co'
const supabaseKey = 'eyJhbGc...' // Your key

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### Fix 3: Enable Realtime (for instant notifications)

In Supabase Dashboard:
1. Go to **Database** → **Replication**
2. Enable **notifications** table for Realtime
3. Click **Enable**

---

## 📋 Complete Test Checklist

- [ ] `admin_users` table exists
- [ ] `notifications` table exists
- [ ] At least 1 admin user in `admin_users` table
- [ ] RLS policies are permissive (allow all for development)
- [ ] Mobile app has correct Supabase URL and key
- [ ] Console shows "🔔 Starting notification creation..."
- [ ] Console shows "✅ Successfully created notifications"
- [ ] Notifications appear in Supabase `notifications` table
- [ ] Notifications appear on Web Admin page
- [ ] Notifications appear on Mobile Admin app
- [ ] Real-time updates work (new notifications appear without refresh)

---

## 🆘 Still Not Working?

**Check the mobile app console for these specific logs:**

1. **"🔔 Starting notification creation..."** - If you don't see this, the code isn't running
2. **"📊 Admin users query result"** - Check what this shows
3. **Any ❌ error messages** - These tell you exactly what failed

**Common Error Messages:**

| Error | Meaning | Fix |
|-------|---------|-----|
| "No admin users found" | `admin_users` table is empty | Run setup SQL |
| "relation does not exist" | Table missing | Run table creation SQL |
| "permission denied" | RLS blocking access | Update RLS policies |
| "null value in column" | Missing required field | Check notification object structure |

---

## ✅ Success Indicators

When everything works correctly, you should see:

1. **Mobile Console:**
   ```
   ✅ Successfully created notifications: [...]
   ```

2. **Supabase notifications table:**
   - New rows with `is_read = false`

3. **Web Admin Notifications page:**
   - Red "New" badge
   - Notification appears instantly (real-time)

4. **Mobile Admin Notifications tab:**
   - Red dot indicator
   - Notification in the list

