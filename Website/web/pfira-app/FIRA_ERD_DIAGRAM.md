# 🔥 FIRA Database - Entity-Relationship Diagram (ERD)

## Database Schema for Project FIRA (Fire Incident Response & Alert System)

### 📋 How to Read This ERD

**Crow's Foot Notation Legend:**
- `||` = **Exactly One** (One and only one)
- `|o` = **Zero or One** (Optional, at most one)
- `}o` = **Zero or Many** (Optional, any number)
- `}|` = **One or Many** (Required, at least one)

**Relationship Lines:**
- `────` = Connection between tables
- `(FK)` = Foreign Key
- `(PK)` = Primary Key
- `(UQ)` = Unique constraint

---

## **Complete ERD Diagram with Crow's Foot Notation**

### **1️⃣ Core User Tables & Authentication**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           🔐 auth.users (Supabase Auth)                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid)                                                                │
│  📧 email (text, unique)                                                         │
│  🔒 encrypted_password (text)                                                    │
│  ✅ email_confirmed_at (timestamptz)                                             │
└──────────────────────────────────────────────────────────────────────────────────┘
          │
          │ (One to Zero-or-One)
          ├──────────────────────────────────────────┐
          │                                          │
          |o                                         |o
          │                                          │
┌─────────▼────────────────────────┐       ┌────────▼──────────────────────────────┐
│     👨‍💼 admin_users              │       │     🏢 station_users                  │
├──────────────────────────────────┤       ├───────────────────────────────────────┤
│  🔑 id (PK, uuid)                │       │  🔑 id (PK, uuid)                     │
│  📧 email (text, UQ)             │       │  🔗 user_id (FK → auth.users.id, uuid)│
│  👤 first_name (text)            │       │  📧 email (text, UQ)                  │
│  👤 last_name (text)             │       │  🏢 station_name (text)               │
│  📝 role (text)                  │       │  📍 address (text)                    │
│  ✅ status (text)                │       │  📞 phone (text)                      │
│  🔔 active (bool)                │       │  👔 position (text)                   │
│  📞 phone (text)                 │       │  📝 role (text)                       │
│  📍 address (text)               │       │  ✅ active (bool)                     │
│  📅 created_at (timestamptz)     │       │  📊 status (text)                     │
│  🔄 updated_at (timestamptz)     │       │  🟢 is_online (bool)                  │
└──────────────────────────────────┘       │  📅 created_at (timestamptz)          │
                                           │  🔄 updated_at (timestamptz)          │
                                           │  🌐 lat (float8)                      │
                                           │  🌐 lng (float8)                      │
                                           │  🚒 num_firetrucks (int4)             │
                                           │  📏 firetruck_size (text)             │
                                           └───────────────────────────────────────┘
                                                     │
                                                     │ (One to Many)
                                                     ||
                                                     │
                                                     }o
                                           ┌─────────▼─────────────────────────────┐
                                           │     🚒 responders                     │
                                           ├───────────────────────────────────────┤
                                           │  🔑 id (PK, uuid)                     │
                                           │  🔗 station_id (FK → station_users.id)│
                                           │  🔗 auth_user_id (FK → auth.users.id) │
                                           │  🔗 user_id (uuid)                    │
                                           │  👤 first_name (varchar)              │
                                           │  👤 last_name (varchar)               │
                                           │  📧 email (varchar, UQ)               │
                                           │  📞 phone (varchar)                   │
                                           │  👔 user_position (varchar)           │
                                           │  📊 status (varchar)                  │
                                           │  🟢 is_online (bool)                  │
                                           │  📅 created_at (timestamptz)          │
                                           │  🔄 updated_at (timestamptz)          │
                                           │  👤 middle_name (varchar)             │
                                           │  📞 station_contact_number (text)     │
                                           │  📍 address (text)                    │
                                           │  🎂 birthdate (date)                  │
                                           │  🔢 age (int2)                        │
                                           │  ⚧️  gender (text)                    │
                                           └───────────────────────────────────────┘

┌────────────────────────────────────────────┐
│     👥 citizen_users                       │
├────────────────────────────────────────────┤
│  🔑 id (PK, uuid)                          │
│  📧 email (text, UQ)                       │
│  👤 first_name (text)                      │
│  👤 last_name (text)                       │
│  📞 phone (text)                           │
│  🏷️  display_name (text)                   │
│  📊 status (text)                          │
│  📋 reports (int4)                         │
│  ✅ is_verified (bool)                     │
│  🔐 google_sign_in (bool)                  │
│  👤 user_type (text)                       │
│  📅 created_at (timestamptz)               │
│  🔄 updated_at (timestamptz)               │
└────────────────────────────────────────────┘
```

### **2️⃣ Fire Reports & Assignment System**

```
                        ┌───────────────────────────────────────────────────┐
                        │     🔥 fire_reports (External Firebase/API)      │
                        ├───────────────────────────────────────────────────┤
                        │  🔑 id (PK, uuid)                                 │
                        │  🖼️  image_url (text)                             │
                        │  🌐 latitude (float8)                             │
                        │  🌐 longitude (float8)                            │
                        │  📍 geotag_location (text)                        │
                        │  📍 address (text)                                │
                        │  🔥 cause_of_fire (varchar)                       │
                        │  🤖 prediction (jsonb)                            │
                        │  📊 confidence (text)                             │
                        │  🏠 structure (text)                              │
                        │  🏘️  number_of_structures_on_fire (int4)          │
                        │  🚨 recommended_alarm_level (text)                │
                        │  💨 smoke_intensity (text)                        │
                        │  📈 smoke_confidence (text)                       │
                        │  👤 reporter (text)                               │
                        │  🔗 reporterId (uuid)                             │
                        │  📊 status (text)                                 │
                        │  🚨 final_fire_alarm_level (text)                 │
                        │  ❌ cancellation_timestamp (text)                 │
                        │  📝 cancellation_reason (text)                    │
                        │  👤 cancelled_by (text)                           │
                        │  📅 created_at (timestamptz)                      │
                        │  📅 formatted_timestamp (text)                    │
                        └───────────────────────────────────────────────────┘
                                 │                         │
                                 │                         │
                     (One to Many) }o                     }o (One to Many)
                                 │                         │
              ┌──────────────────┴──────┐         ┌────────▼─────────────────────────┐
              │                         │         │  📸 assigned_report_snapshots    │
              │                         │         ├──────────────────────────────────┤
┌─────────────▼──────────────┐   ┌──────▼─────────────────┐  🔑 report_id (PK, text)      │
│  📋 report_assignments     │   │  🔀 report_routes      │  🌐 lat (float8)              │
│  (Junction Table)          │   │  (Forwarding History)  │  🌐 lng (float8)              │
├────────────────────────────┤   ├────────────────────────┤  📍 address (text)            │
│  🔑 id (PK, uuid)          │   │  🔑 id (PK, uuid)      │  📦 snapshot_json (jsonb)     │
│  🔗 report_id (text)       │   │  🔗 report_id (text)   │  🔄 updated_at (timestamptz)  │
│  📝 assignee_type (text)   │   │  🎯 target (text)      └──────────────────────────────┘
│      'station'             │   │     Format:            │
│      'responder'           │   │     'station:<id>'     │
│  🔗 assignee_id (uuid)     │   │     'agency:police'    │
│  📅 assigned_at (timestamptz)  │  📝 note (text)        │
│  📝 note (text)            │   │  📅 forwarded_at       │
└────────────────────────────┘   │  📅 created_at         │
         │              │         └────────────────────────┘
         │              │
         ||             ||  (Many to One)
         │              │
    ┌────▼────┐    ┌────▼──────────┐
    │station_ │    │   responders  │
    │users    │    │   (see above) │
    └─────────┘    └───────────────┘
```

### **3️⃣ Communication & Notification System**

```
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                         💬 messages (Chat System)                        │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, uuid)                                                        │
    │  🔗 sender_id (uuid) ─────────┐ Polymorphic FK                          │
    │  🔗 receiver_id (uuid) ───────┤ References ANY user table               │
    │  📝 sender_type (text)        │ Values: 'admin', 'station',             │
    │  📝 receiver_type (text)      │         'responder', 'citizen'          │
    │  💬 text (text)               │                                         │
    │  🖼️  image_url (text)          │                                         │
    │  🚨 is_emergency (bool)       │                                         │
    │  ✅ is_read (bool)             │                                         │
    │  🔗 report_id (text)          │                                         │
    │  📊 suggested_alarm_level (text)                                        │
    │  🤖 ai_analysis (jsonb)       │                                         │
    │  📈 ai_confidence (numeric)   │                                         │
    │  🕐 analyzed_at (timestamptz) │                                         │
    │  📅 created_at (timestamptz)  │                                         │
    │  🔄 updated_at (timestamptz)  │                                         │
    └──────────────────────────────┴──────────────────────────────────────────┘
                    │                    │
                    }o                   }o (Many to Zero-or-One)
                    │                    │
    ┌───────────────▼──────┐   ┌─────────▼───────────────┐
    │ admin_users          │   │ station_users           │
    │ citizen_users        │   │ responders              │
    │ (Any user type)      │   │ (Any user type)         │
    └──────────────────────┘   └─────────────────────────┘


    ┌──────────────────────────────────────────────────────────────────────────┐
    │                    🔔 notifications (Unified System)                     │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, uuid)                                                        │
    │  🔗 user_id (uuid) ──────────┐ Polymorphic FK                           │
    │  📝 user_type (text)          │ References ANY user table               │
    │      Values: 'admin', 'station', 'responder', 'citizen'                 │
    │  📌 title (text)                                                         │
    │  💬 message (text)                                                       │
    │  🏷️  type (text)                                                         │
    │      Values: 'fire_alert', 'assignment', 'system', 'user_action'        │
    │  🚨 priority (text)                                                      │
    │      Values: 'low', 'normal', 'high', 'urgent'                          │
    │  ✅ is_read (bool)                                                       │
    │  🔗 related_report_id (text)                                             │
    │  🔗 action_url (text)                                                    │
    │  📅 created_at (timestamptz)                                             │
    │  🔄 updated_at (timestamptz)                                             │
    └──────────────────────────────────────────────────────────────────────────┘
                    │
                    }o (Many to Zero-or-One)
                    │
    ┌───────────────▼──────────────────────────────────────┐
    │  admin_users | station_users | responders | citizens │
    └──────────────────────────────────────────────────────┘


    ┌──────────────────────────────────────────────────────────────────────────┐
    │              🚒 responder_notifications (Responder-Specific)             │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, uuid)                                                        │
    │  🔗 responder_id (FK → responders.id, uuid)                              │
    │  🔗 station_id (FK → station_users.id, uuid)                             │
    │  🔗 fire_report_id (text)                                                │
    │  📌 title (text)                                                         │
    │  💬 message (text)                                                       │
    │  🚨 priority (text)                                                      │
    │  📊 status (text)                                                        │
    │      Values: 'pending', 'accepted', 'declined', 'completed'             │
    │  ✅ is_read (bool)                                                       │
    │  ✔️  accepted_at (timestamptz)                                           │
    │  📅 created_at (timestamptz)                                             │
    │  🔄 updated_at (timestamptz)                                             │
    └──────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ||                             ||  (Many to One)
                    │                              │
    ┌───────────────▼───────────┐   ┌──────────────▼──────────────┐
    │      🚒 responders        │   │    🏢 station_users         │
    │      (see above)          │   │    (see above)              │
    └───────────────────────────┘   └─────────────────────────────┘
```

### **4️⃣ Authentication & Security System**

```
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                🔐 password_reset_codes (Verification Codes)              │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, uuid)                                                        │
    │  📧 email (text, UQ)                                                     │
    │  🔢 code (text)                                                          │
    │  📝 user_table (text)                                                    │
    │      Values: 'admin_users', 'station_users', 'citizen_users',           │
    │              'responders'                                                │
    │  ⏰ expires_at (timestamptz)                                             │
    │  📅 created_at (timestamptz)                                             │
    └──────────────────────────────────────────────────────────────────────────┘
                    │
                    }o (Many to Zero-or-One)
                    │
    ┌───────────────▼──────────────────────────────────────────────┐
    │  admin_users | station_users | citizen_users | responders   │
    │  (User table specified in user_table field)                  │
    └──────────────────────────────────────────────────────────────┘


    ┌──────────────────────────────────────────────────────────────────────────┐
    │            🔒 pending_password_resets (Temporary Storage)                │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, uuid)                                                        │
    │  📧 email (text, UQ)                                                     │
    │  🔐 new_password_hash (text)                                             │
    │  📝 user_table (text)                                                    │
    │      Values: 'admin_users', 'station_users', 'citizen_users',           │
    │              'responders'                                                │
    │  🔗 user_id (uuid)                                                       │
    │  🔢 verification_code (text)                                             │
    │  ⏰ expires_at (timestamptz)                                             │
    │  📅 created_at (timestamptz)                                             │
    └──────────────────────────────────────────────────────────────────────────┘
                    │
                    }o (Many to Zero-or-One)
                    │
    ┌───────────────▼──────────────────────────────────────────────┐
    │  admin_users | station_users | citizen_users | responders   │
    │  (User table specified in user_table field)                  │
    └──────────────────────────────────────────────────────────────┘
```

### **5️⃣ System Monitoring**

```
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                      📊 system_status (System Monitor)                   │
    ├──────────────────────────────────────────────────────────────────────────┤
    │  🔑 id (PK, text)                                                        │
    │  📈 current_level (text)                                                 │
    │  📊 confidence (numeric)                                                 │
    │  🔄 last_updated (timestamptz)                                           │
    │  🔗 triggered_by_message (FK → messages.id, uuid)                        │
    │  📝 reasoning (text)                                                     │
    │  🔍 keywords_found (text)                                                │
    │  📅 created_at (timestamptz)                                             │
    │  🔄 updated_at (timestamptz)                                             │
    └──────────────────────────────────────────────────────────────────────────┘
                    │
                    |o (Zero or One to One)
                    │
    ┌───────────────▼──────────────────────────────────────────────┐
    │                        💬 messages                           │
    │                      (see above)                             │
    └──────────────────────────────────────────────────────────────┘
```

---

## **📊 Complete Relationship Summary**

### **🔗 One-to-Zero-or-One Relationships** `||────|o`

| Parent Table | Child Table | Foreign Key | Description |
|-------------|-------------|-------------|-------------|
| **auth.users** | admin_users | *(implicit)* | One auth user = one admin account |
| **auth.users** | station_users | user_id | One auth user = one station account |
| **auth.users** | responders | auth_user_id | One auth user = one responder account |
| **messages** | system_status | triggered_by_message | One message can trigger system status |

### **🔗 One-to-Many Relationships** `||────}o`

| Parent Table | Child Table | Foreign Key | Crow's Foot | Description |
|-------------|-------------|-------------|-------------|-------------|
| **station_users** | responders | station_id | `||────}o` | One station has many responders |
| **station_users** | responder_notifications | station_id | `||────}o` | One station sends many notifications |
| **responders** | responder_notifications | responder_id | `||────}o` | One responder receives many notifications |
| **fire_reports** | report_assignments | report_id | `||────}o` | One report has many assignments |
| **fire_reports** | report_routes | report_id | `||────}o` | One report has many forwarding routes |
| **fire_reports** | assigned_report_snapshots | report_id | `||────|o` | One report has one snapshot (optional) |

### **🔗 Many-to-Many Relationships** `}o────}o` *(via Junction Tables)*

| Table 1 | Junction Table | Table 2 | Description |
|---------|---------------|---------|-------------|
| **fire_reports** | report_assignments | **station_users** | Reports assigned to stations |
| **fire_reports** | report_assignments | **responders** | Reports assigned to responders |
| *Any User Type* | messages | *Any User Type* | Cross-user-type messaging |

### **🔗 Polymorphic Relationships** *(Type + ID Pattern)*

| Table | Type Field | ID Field | References | Description |
|-------|-----------|----------|------------|-------------|
| **report_assignments** | assignee_type | assignee_id | station_users OR responders | Assignment to stations or responders |
| **messages** | sender_type | sender_id | ANY user table | Messages from any user type |
| **messages** | receiver_type | receiver_id | ANY user table | Messages to any user type |
| **notifications** | user_type | user_id | ANY user table | Notifications to any user type |
| **password_reset_codes** | user_table | *(email match)* | ANY user table | Password reset for any user type |
| **pending_password_resets** | user_table | user_id | ANY user table | Temporary password storage |

### **🔗 Self-Referencing Relationships**

| Table | Relationship | Description |
|-------|-------------|-------------|
| **report_routes** | Sequential chain | Reports forwarded multiple times create a chain |

---

## **🎯 Key Database Features**

### **✅ Authentication & Security**
- 🔐 **Supabase Auth Integration** - Centralized authentication via auth.users
- 🔑 **Multi-Table User System** - Separate tables for admin, station, responder, citizen
- 🔒 **Password Reset Flow** - Two-step verification with code generation
- 🛡️ **Row Level Security (RLS)** - Enabled on all tables for data protection

### **✅ Communication System**
- 💬 **Real-time Chat** - Polymorphic messaging between ALL user types
- 🔔 **Unified Notifications** - Single table handles all notification types
- 🚒 **Responder Notifications** - Specialized table for responder assignments
- 🤖 **AI Analysis** - Message analysis with confidence scores and alarm suggestions

### **✅ Fire Report Management**
- 🔥 **External API Integration** - Links to Firebase/Railway fire detection API
- 📋 **Assignment Tracking** - Polymorphic assignments to stations or responders
- 🔀 **Forwarding Chain** - Complete history of report forwarding (report_routes)
- 📸 **Report Snapshots** - Stores location and metadata at assignment time

### **✅ Data Integrity**
- 🔗 **Foreign Key Constraints** - Enforced relationships between tables
- 🎯 **Unique Constraints** - Email uniqueness across user tables
- 📊 **Composite Keys** - (report_id + assignee_id) for assignments
- ✔️ **NOT NULL Constraints** - Required fields enforced at DB level

### **✅ Operational Features**
- 🟢 **Online Status Tracking** - is_online field for stations and responders
- 📍 **Geolocation** - Latitude/longitude for stations and fire reports
- 🚒 **Resource Management** - Track firetrucks per station
- 📊 **System Monitoring** - Real-time system status with AI-triggered alerts

---

## **🏗️ Database Design Patterns**

### **1. Polymorphic Relationships**
**Pattern**: `type` + `id` fields reference multiple tables
```
messages.sender_type + sender_id → ANY user table
notifications.user_type + user_id → ANY user table
report_assignments.assignee_type + assignee_id → stations OR responders
```
**Benefits**: Flexible relationships without multiple foreign keys

### **2. Junction Tables**
**Tables**: `report_assignments`, `report_routes`
```
fire_reports }o────}o{ report_assignments }o────}o{ stations/responders
```
**Benefits**: Many-to-many relationships with additional metadata (note, assigned_at)

### **3. Soft Deletes**
**Fields**: `status`, `active`, `cancelled_by`
```sql
-- Instead of DELETE, use:
UPDATE station_users SET active = false, status = 'inactive';
```
**Benefits**: Data retention, audit trail, possible restoration

### **4. Audit Trail**
**Fields**: `created_at`, `updated_at`, `assigned_at`, `forwarded_at`
```
All tables include timestamps for tracking changes
```
**Benefits**: Historical data, debugging, compliance

### **5. Type Safety**
**Implementation**: Text fields with constrained values (pseudo-ENUMs)
```
user_type: 'admin' | 'station' | 'responder' | 'citizen'
priority: 'low' | 'normal' | 'high' | 'urgent'
status: 'pending' | 'accepted' | 'declined' | 'completed'
```
**Benefits**: Consistent values, easier validation, query optimization

### **6. Denormalization**
**Examples**: `station_name` in responders, `reporter` in fire_reports
```
Stores redundant data for faster queries and API compatibility
```
**Benefits**: Reduced JOIN operations, improved read performance

### **7. JSONB Storage**
**Fields**: `snapshot_json`, `prediction`, `ai_analysis`
```
Flexible schema for complex nested data
```
**Benefits**: Store semi-structured data, faster than text parsing

---

## **📈 Database Statistics**

| Metric | Count | Description |
|--------|-------|-------------|
| **Total Tables** | 13 | Main operational tables |
| **User Tables** | 4 | admin_users, station_users, responders, citizen_users |
| **Auth/Security** | 2 | password_reset_codes, pending_password_resets |
| **Communication** | 3 | messages, notifications, responder_notifications |
| **Reports** | 3 | report_assignments, report_routes, assigned_report_snapshots |
| **Monitoring** | 1 | system_status |
| **Foreign Keys** | 15+ | Explicit and polymorphic relationships |
| **Unique Constraints** | 8+ | Email fields across all user tables |
| **Indexes** | 20+ | On PKs, FKs, and frequently queried columns |

---

## **🔧 Implementation Notes**

### **For Developers:**

1. **Polymorphic Queries**:
   ```sql
   -- To get all notifications for a user:
   SELECT * FROM notifications 
   WHERE user_id = $1 AND user_type = 'station';
   ```

2. **Assignment Queries**:
   ```sql
   -- Get all assignments for a station:
   SELECT * FROM report_assignments 
   WHERE assignee_type = 'station' AND assignee_id = $1;
   ```

3. **Message Queries**:
   ```sql
   -- Get conversation between two users:
   SELECT * FROM messages 
   WHERE (sender_id = $1 AND receiver_id = $2) 
      OR (sender_id = $2 AND receiver_id = $1)
   ORDER BY created_at;
   ```

4. **Forwarding Chain**:
   ```sql
   -- Track complete forwarding history:
   SELECT * FROM report_routes 
   WHERE report_id = $1 
   ORDER BY forwarded_at;
   ```

### **For Database Administrators:**

- **Backup Strategy**: Daily full backups + real-time replication
- **RLS Policies**: Configured per table per user role
- **Indexes**: Monitor slow queries, add indexes as needed
- **Partitioning**: Consider for messages/notifications if volume grows
- **Archive Strategy**: Move old data to archive tables after 1 year

---

## **🎨 Visual Summary**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FIRA DATABASE ECOSYSTEM                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔐 AUTH LAYER          🏢 USER MANAGEMENT       🔥 FIRE REPORTS   │
│  ├─ auth.users          ├─ admin_users          ├─ fire_reports    │
│  ├─ password_reset      ├─ station_users        ├─ assignments     │
│  └─ pending_resets      ├─ responders           ├─ routes          │
│                         └─ citizen_users        └─ snapshots       │
│                                                                     │
│  💬 COMMUNICATION       🔔 NOTIFICATIONS         📊 MONITORING      │
│  └─ messages            ├─ notifications         └─ system_status   │
│                         └─ responder_notifs                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Database Version**: PostgreSQL 15+ (Supabase)  
**Design Pattern**: Hybrid Relational + Polymorphic  
**Total Relationships**: 20+ (including polymorphic)  
**Real-time Enabled**: ✅ All tables via Supabase Realtime  
**Last Updated**: November 22, 2025

