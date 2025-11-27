# 🔥 FIRA Complete ERD - Crow's Foot Notation

## Entity-Relationship Diagram for Fire Incident Response & Alert System

---

## 📖 Crow's Foot Notation Guide

### **Cardinality Symbols:**
- `||` = **Exactly One** (mandatory, one and only one)
- `|o` = **Zero or One** (optional, at most one)
- `}|` = **One or Many** (mandatory, at least one)
- `}o` = **Zero or Many** (optional, any number)

### **Line Types:**
- **Solid Line (`────`)** = **Identifying Relationship**
  - Foreign key is mandatory (NOT NULL)
  - Child entity depends on parent for its identity
  - Example: responders MUST belong to a station
  
- **Dashed Line (`┄┄┄┄`)** = **Non-Identifying Relationship**
  - Foreign key is optional (NULL allowed)
  - Child can exist independently
  - Example: fire_reports may or may not have a reporter

### **Constraint Symbols:**
- `(PK)` = Primary Key
- `(FK)` = Foreign Key
- `(UQ)` = Unique Constraint
- `(NN)` = Not Null

---

## 🗺️ Complete ERD with All Relationships

### **1️⃣ AUTHENTICATION & USER MANAGEMENT**

```
┌─────────────────────────────────────────────────────────────┐
│                   🔐 auth.users (Supabase)                  │
│                     (External Table)                         │
├─────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid)                                           │
│  📧 email (text, UQ)                                        │
│  🔒 encrypted_password (text)                               │
│  ✅ email_confirmed_at (timestamptz)                        │
│  📅 created_at (timestamptz)                                │
└─────────────────────────────────────────────────────────────┘
     │                         │                        │
     │ (Dashed - Optional)     │ (Dashed)               │ (Dashed)
     ┆                         ┆                        ┆
     |o                        |o                       |o
     ┆                         ┆                        ┆
┌────▼────────────┐   ┌────────▼──────────┐   ┌───────▼──────────┐
│  admin_users    │   │  station_users    │   │   responders     │
│  (Independent)  │   │                   │   │                  │
├─────────────────┤   ├───────────────────┤   ├──────────────────┤
│ 🔑 id (PK)      │   │ 🔑 id (PK)        │   │ 🔑 id (PK)       │
│ 📧 email (UQ,NN)│   │ 🔗 user_id (FK)   │   │ 🔗 user_id (FK)  │
│ 👤 first_name   │   │    ┄┄▶ auth.users │   │    ┄┄▶ auth.users│
│ 👤 last_name    │   │ 📧 email (UQ,NN)  │   │ 🔑 station_id(FK)│
│ 📝 role         │   │ 🏢 station_name   │   │    ──▶ stations  │
│ 📊 status       │   │    (NN)           │   │ 📧 email (UQ,NN) │
│ 📞 phone        │   │ 📍 address        │   │ 👤 first_name(NN)│
│ 📍 address      │   │ 📞 phone          │   │ 👤 last_name(NN) │
│ 📅 created_at   │   │ 👔 position       │   │ 📞 phone         │
│ 🔄 updated_at   │   │ 📝 role           │   │ 👔 user_position │
└─────────────────┘   │ ✅ active         │   │ 📊 status        │
                      │ 📊 status         │   │ 🟢 is_online     │
                      │ 🟢 is_online      │   │ 📞 station_phone │
                      │ 🌐 lat            │   │ 📍 address       │
                      │ 🌐 lng            │   │ 🎂 birthdate     │
                      │ 🚒 num_firetrucks │   │ 🔢 age           │
                      │ 📏 firetruck_size │   │ ⚧️  gender       │
                      │ 📅 created_at     │   │ 👤 middle_name   │
                      │ 🔄 updated_at     │   │ 📅 created_at    │
                      └───────────────────┘   │ 🔄 updated_at    │
                               │               └──────────────────┘
                               │                       ▲
                               │ (Solid - Mandatory)   │
                               │ One-to-Many           │
                               ||                      │
                               ────────────────────────┘
                               }|
                      (A station MUST have
                       1+ responders)


┌──────────────────────────────────────────────────┐
│               👥 citizen_users                   │
├──────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                            │
│  📧 email (text, UQ, NN)                         │
│     CHECK: valid email format                    │
│  👤 first_name (text, NN)                        │
│  👤 last_name (text, NN)                         │
│  📞 phone (text)                                 │
│     CHECK: 09XXXXXXXXX format                    │
│  🏷️  display_name (text)                         │
│  📊 status (text, default: 'active')             │
│     CHECK: active|inactive|suspended|pending     │
│  📋 reports (int, default: 0)                    │
│  ✅ is_verified (bool, default: false)           │
│  🔐 google_sign_in (bool, default: false)        │
│  👤 user_type (text, default: 'citizen')         │
│  📅 created_at (timestamptz)                     │
│  🔄 updated_at (timestamptz)                     │
└──────────────────────────────────────────────────┘
               │
               │ (Dashed - Optional)
               ┆ One-to-Many
               |o
               ┆
               }o
         ┌─────▼────────────────────────────────┐
         │        🔥 fire_reports               │
         ├──────────────────────────────────────┤
         │  🔑 id (PK, uuid, NN)                │
         │  🔗 reporterId (FK) ┄┄▶ citizen_users│
         │     (Optional - can be anonymous)    │
         │  🖼️  image_url (text, NN)            │
         │  🌐 latitude (float8)                │
         │  🌐 longitude (float8)               │
         │  📍 geotag_location (text)           │
         │  📍 address (text)                   │
         │  🔥 cause_of_fire (varchar)          │
         │  🤖 prediction (jsonb)               │
         │  📊 confidence (text)                │
         │  🏠 structure (text)                 │
         │  🏘️  number_of_structures (int)      │
         │  🚨 recommended_alarm_level (text)   │
         │  💨 smoke_intensity (text)           │
         │  📈 smoke_confidence (text)          │
         │  👤 reporter (text)                  │
         │  📊 status (text)                    │
         │  🚨 final_fire_alarm_level (text)    │
         │  ❌ cancellation_timestamp (text)    │
         │  📝 cancellation_reason (text)       │
         │  👤 cancelled_by (text)              │
         │  📊 structure_confidence (text)      │
         │  📊 structure_probabilities (text)   │
         │  📅 created_at (timestamptz, NN)     │
         │  📅 formatted_timestamp (text)       │
         └──────────────────────────────────────┘
```

---

### **2️⃣ NOTIFICATIONS & MESSAGING**

```
┌──────────────────────────────────────────────────────────────┐
│                   🔔 notifications                           │
│              (Generic notification system)                   │
├──────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                                        │
│  🔗 user_id (uuid, NN) - Points to ANY user table           │
│  👤 user_type (text, NN)                                     │
│     CHECK: admin|station|responder|citizen                   │
│  📰 title (text, NN)                                         │
│  📝 message (text, NN)                                       │
│  🏷️  type (text, NN)                                         │
│     CHECK: fire_alert|assignment|system|user_action|         │
│            emergency|info                                    │
│  ⚠️  priority (text, NN, default: 'normal')                  │
│     CHECK: low|normal|high|urgent                            │
│  👁️  is_read (bool, default: false)                          │
│  🔗 related_report_id (text) - Weak ref to fire_reports     │
│  🔗 action_url (text)                                        │
│  📅 created_at (timestamptz)                                 │
│  🔄 updated_at (timestamptz)                                 │
└──────────────────────────────────────────────────────────────┘
     Note: No FK constraint - polymorphic relationship


        station_users
              │
              │ (Solid - Mandatory)
              ││
              ││
              ▼}|
┌─────────────────────────────────────────────────────────────┐
│            🔔 responder_notifications                       │
│        (Specialized notifications for responders)           │
├─────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                                       │
│  🔗 responder_id (FK, uuid, NN) ──▶ responders.id          │
│  🔗 station_id (FK, uuid, NN) ──▶ station_users.id         │
│  🔗 fire_report_id (text, NN) - Weak ref to fire_reports   │
│  📰 title (text, NN)                                        │
│  📝 message (text, NN)                                      │
│  ⚠️  priority (text, NN, default: 'normal')                 │
│     CHECK: low|normal|high|urgent                           │
│  📊 status (text, default: 'pending')                       │
│     CHECK: pending|accepted|declined|completed              │
│  👁️  is_read (bool, NN, default: false)                     │
│  ✅ accepted_at (timestamptz)                               │
│  📅 created_at (timestamptz)                                │
│  🔄 updated_at (timestamptz)                                │
└─────────────────────────────────────────────────────────────┘
              ▲
              ││ (Solid - Mandatory)
              ││ One-to-Many
              ││
              │
         responders


┌─────────────────────────────────────────────────────────────┐
│                      💬 messages                            │
├─────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                                       │
│  🔗 sender_id (uuid, NN) - Points to ANY user table        │
│  🔗 receiver_id (uuid) - Points to ANY user table          │
│  👤 sender_type (text, default: 'NULL')                     │
│  👤 receiver_type (text, NN, default: 'NULL')               │
│  📝 text (text)                                             │
│  🖼️  image_url (text)                                       │
│  🚨 is_emergency (bool, default: false)                     │
│  👁️  is_read (bool, default: false)                         │
│  🤖 ai_suggested_alarm (text)                               │
│  🤖 ai_analysis (jsonb)                                     │
│  🚨 suggested_alarm_level (text, default: 'NONE')          │
│  📊 ai_confidence (numeric, default: 0.0)                   │
│  🕐 analyzed_at (timestamptz)                               │
│  🔗 report_id (text) - Weak ref to fire_reports            │
│  📅 created_at (timestamptz)                                │
│  🔄 updated_at (timestamptz)                                │
└─────────────────────────────────────────────────────────────┘
     │
     │ (Dashed - Optional)
     ┆ One-to-One
     |o
     ┆
     |o
┌────▼─────────────────────────────────────────────────────────┐
│                   📊 system_status                           │
├──────────────────────────────────────────────────────────────┤
│  🔑 id (PK, text, NN)                                        │
│  🔗 triggered_by_message (FK, uuid) ┄┄▶ messages.id         │
│     (Optional - status may be manual)                        │
│  🚨 current_level (text, NN, default: 'NONE')               │
│  📊 confidence (numeric, default: 0.0)                       │
│  🕐 last_updated (timestamptz)                               │
│  📝 reasoning (text)                                         │
│  🔑 keywords_found (text[])                                  │
│  📅 created_at (timestamptz)                                 │
│  🔄 updated_at (timestamptz)                                 │
└──────────────────────────────────────────────────────────────┘
```

---

### **3️⃣ REPORT MANAGEMENT & ROUTING**

```
                    fire_reports (Central Entity)
                           │
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │ (Many)           │ (Many)           │ (Many)
        }o                 }o                 }o
        │                  │                  │
        │ (Dashed)         │ (Dashed)         │ (Dashed)
        ┆                  ┆                  ┆
┌───────▼────────┐  ┌──────▼───────────┐  ┌──▼──────────────────┐
│ report_        │  │ report_routes    │  │ assigned_report_    │
│ assignments    │  │                  │  │ snapshots           │
├────────────────┤  ├──────────────────┤  ├─────────────────────┤
│ 🔑 id (PK)     │  │ 🔑 id (PK)       │  │ 🔑 report_id (PK)   │
│ 🔗 report_id   │  │ 🔗 report_id(NN) │  │     (text, NN)      │
│    (text, NN)  │  │     (text, NN)   │  │ 🌐 lat (float8)     │
│ 📋 assignee_   │  │     Weak FK      │  │ 🌐 lng (float8)     │
│    type (NN)   │  │ 🎯 target (NN)   │  │ 📍 address (text)   │
│    CHECK:      │  │    (station/     │  │ 📦 snapshot_json    │
│    station|    │  │     responder)   │  │     (jsonb)         │
│    responder   │  │ 📝 note (text)   │  │ 🔄 updated_at       │
│ 🔗 assignee_id │  │ 📅 forwarded_at  │  │     (timestamptz,NN)│
│    (uuid, NN)  │  │ 📅 created_at    │  └─────────────────────┘
│ 📅 assigned_at │  └──────────────────┘
│    (NN)        │
│ 📝 note (text) │  (Tracks routing/
└────────────────┘   forwarding history)

(Junction table for
 assignments)
```

---

### **4️⃣ AUTHENTICATION & SECURITY**

```
┌────────────────────────────────────────────────────────────┐
│              🔐 password_reset_codes                       │
│        (Temporary codes for password reset)                │
├────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                                      │
│  📧 email (text, UQ, NN)                                   │
│  🔢 code (text, NN) - 6-digit verification code           │
│  📋 user_table (text) - Which table user belongs to       │
│  ⏰ expires_at (timestamptz, NN)                           │
│  📅 created_at (timestamptz)                               │
└────────────────────────────────────────────────────────────┘
     Note: No FK - email lookup across multiple user tables


┌────────────────────────────────────────────────────────────┐
│           🔐 pending_password_resets                       │
│     (Temporary storage for Edge Function processing)      │
├────────────────────────────────────────────────────────────┤
│  🔑 id (PK, uuid, NN)                                      │
│  📧 email (text, UQ, NN)                                   │
│  🔒 new_password_hash (text, NN)                           │
│  📋 user_table (text, NN)                                  │
│  🔗 user_id (uuid)                                         │
│  🔢 verification_code (text, NN)                           │
│  ⏰ expires_at (timestamptz, NN)                           │
│  📅 created_at (timestamptz)                               │
└────────────────────────────────────────────────────────────┘
     Note: Service-level access only
```

---

## 📊 Relationship Summary Table

| Parent Table      | Child Table                  | Relationship | Line Type | Cardinality | FK Column           | Mandatory? |
|-------------------|------------------------------|--------------|-----------|-------------|---------------------|------------|
| `auth.users`      | `station_users`              | One-to-One   | Dashed    | \|o──o\|    | `user_id`           | No         |
| `auth.users`      | `responders`                 | One-to-One   | Dashed    | \|o──o\|    | `user_id`           | No         |
| `station_users`   | `responders`                 | One-to-Many  | Solid     | \|\|──}\|   | `station_id`        | Yes        |
| `station_users`   | `responder_notifications`    | One-to-Many  | Solid     | \|\|──}\|   | `station_id`        | Yes        |
| `responders`      | `responder_notifications`    | One-to-Many  | Solid     | \|\|──}\|   | `responder_id`      | Yes        |
| `citizen_users`   | `fire_reports`               | One-to-Many  | Dashed    | \|o──}o     | `reporterId`        | No         |
| `messages`        | `system_status`              | One-to-One   | Dashed    | \|o──\|o    | `triggered_by_msg`  | No         |
| `fire_reports`    | `report_assignments`         | One-to-Many  | Dashed    | \|o──}o     | `report_id` (weak)  | No         |
| `fire_reports`    | `report_routes`              | One-to-Many  | Dashed    | \|o──}o     | `report_id` (weak)  | No         |
| `fire_reports`    | `assigned_report_snapshots`  | One-to-One   | Dashed    | \|o──\|o    | `report_id` (weak)  | No         |

---

## 🔑 Key Observations

### **Identifying vs Non-Identifying Relationships:**

**Solid Lines (Identifying - FK is NOT NULL):**
1. `station_users` → `responders`: A responder MUST belong to a station
2. `responders` → `responder_notifications`: Notification MUST reference a responder
3. `station_users` → `responder_notifications`: Notification MUST reference a station

**Dashed Lines (Non-Identifying - FK is NULL or optional):**
1. `auth.users` → `station_users/responders`: Auth account is optional
2. `citizen_users` → `fire_reports`: Reports can be anonymous
3. `messages` → `system_status`: Status can be set manually
4. `fire_reports` → `report_assignments/routes/snapshots`: Reports may not have assignments

### **Weak References (No FK Constraint):**
- `notifications.user_id` → Multiple user tables (polymorphic)
- `notifications.related_report_id` → `fire_reports.id`
- `messages.report_id` → `fire_reports.id`
- `responder_notifications.fire_report_id` → `fire_reports.id`

These use application-level referential integrity rather than database FK constraints.

---

## 📐 Complete Visual ERD

```
┌─────────────┐
│ auth.users  │
└──────┬──────┘
       ┆ (Dashed = Optional)
       ┆
   ┌───┴───┬───────┐
   ┆       ┆       ┆
   |o      |o      |o
   ┆       ┆       ┆
┌──▼──┐ ┌──▼───┐ ┌─▼─────────┐
│admin│ │station│ │responders │
│users│ │users  │ └─────┬─────┘
└─────┘ └───┬───┘       │
            │           │
            ││ (Solid   ││
            ││  = Must) ││
            ││           ││
            └────────────┘
            }|
     (station → responders)


┌──────────────┐
│citizen_users │
└──────┬───────┘
       ┆ (Dashed = Optional)
       |o
       ┆
       }o
    ┌──▼───────────┐
    │ fire_reports │
    └──┬───┬───┬───┘
       ┆   ┆   ┆ (All Dashed)
       }o  }o  |o
       ┆   ┆   ┆
    ┌──▼┐ ┌▼─┐ ┌▼────────┐
    │asn│ │rt│ │snapshots│
    │gmt│ │es│ └─────────┘
    └───┘ └──┘


┌──────────┐        ┌────────────┐
│responders├────────┤responder_  │
└──────────┘   }|   │notifications│
    (Solid)    ││   └────────────┘
               ││        ▲
        ┌──────┘         ││ (Solid)
        │                ││
   ┌────▼──────┐         ││
   │station_   ├─────────┘
   │users      │    }|
   └───────────┘


┌─────────┐
│messages │
└────┬────┘
     ┆ (Dashed)
     |o
     ┆
     |o
┌────▼─────────┐
│system_status │
└──────────────┘
```

---

## 🎯 Design Patterns Identified

1. **Polymorphic Relationships**: `notifications` table uses `user_type` + `user_id` pattern
2. **Weak References**: `fire_reports` references are text-based, not enforced FKs
3. **Optional Authentication**: Users can exist without `auth.users` linkage
4. **Junction Tables**: `report_assignments` links reports to multiple entity types
5. **Audit Trail**: Most tables have `created_at` and `updated_at`
6. **Soft Constraints**: Status fields use CHECK constraints

---

**Legend Reminder:**
- **Solid Line (`────`)** = Mandatory FK, identifying relationship
- **Dashed Line (`┄┄┄┄`)** = Optional FK, non-identifying relationship
- `||` = Exactly one
- `|o` = Zero or one
- `}|` = One or many
- `}o` = Zero or many


