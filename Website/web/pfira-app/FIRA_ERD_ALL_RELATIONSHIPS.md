# 🔥 FIRA Complete ERD - All Table Relationships

## Complete Entity-Relationship Diagram with ALL Relationships Mapped

---

## 📖 Legend

### **Crow's Foot Notation:**
- `||` = Exactly One (mandatory)
- `|o` = Zero or One (optional)
- `}|` = One or Many (mandatory, at least one)
- `}o` = Zero or Many (optional)

### **Line Types:**
- **Solid (`────`)** = Identifying Relationship (FK is NOT NULL, mandatory)
- **Dashed (`┄┄┄┄`)** = Non-Identifying Relationship (FK can be NULL, optional)
- **[TEXT]** = Weak/Logical Reference (no database FK constraint)

---

## 🗺️ MASTER RELATIONSHIP MAP

```
                                    auth.users (Supabase)
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                    [DASHED]         [DASHED]         [DASHED]
                     Optional         Optional         Optional
                         ┆                ┆                ┆
                         |o               |o               |o
                         ┆                ┆                ┆
                         ┆                ┆                ┆
                  ┌──────▼─────┐   ┌─────▼──────┐   ┌─────▼──────┐
                  │station_users│   │ responders │   │admin_users │
                  └──────┬──────┘   └─────┬──────┘   └────────────┘
                         │                │
                         │ [SOLID]        │
                         │ Mandatory      │
                         ││               │
                         ││               │
                         ││◄──────────────┘
                         }|
                         │
                  ┌──────▼──────────────────────┐
                  │       responders            │
                  └──────┬──────────────────────┘
                         │
                         │ [SOLID - Mandatory]
                         ││
                         ││
                         }|
                         │
              ┌──────────▼─────────────────┐
              │  responder_notifications   │
              └────────────────────────────┘
                         ▲
                         ││ [SOLID - Mandatory]
                         ││
                         ││
                         }|
                         │
                  station_users


                  citizen_users
                         │
                         │ [DASHED - Optional]
                         │ (Reports can be anonymous)
                         ┆
                         |o
                         ┆
                         }o
                         ┆
                  ┌──────▼──────────┐
                  │   fire_reports  │
                  │  (Central Hub)  │
                  └──────┬──────────┘
                         │
         ┌───────────────┼───────────────┬────────────────┐
         │               │               │                │
         │ [DASHED]      │ [DASHED]      │ [DASHED]       │ [WEAK REF]
         │ Optional      │ Optional      │ Optional       │ Text-based
         ┆               ┆               ┆                [
         }o              }o              |o               }o
         ┆               ┆               ┆                [
    ┌────▼────┐   ┌──────▼──────┐  ┌────▼────────┐  ┌───▼─────────┐
    │report_  │   │report_routes│  │assigned_    │  │notifications│
    │assign-  │   │(Forwarding) │  │report_      │  │(related_    │
    │ments    │   │             │  │snapshots    │  │report_id)   │
    └─────────┘   └─────────────┘  └─────────────┘  └─────────────┘


                    messages
                       │
                       │ [DASHED - Optional]
                       ┆ (Status can be manual)
                       |o
                       ┆
                       |o
                       ┆
                  ┌────▼──────────┐
                  │ system_status │
                  └───────────────┘


              (Standalone Tables - No FK relationships)
              
              ┌──────────────────────┐
              │ password_reset_codes │  ← Email lookup across tables
              └──────────────────────┘
              
              ┌───────────────────────┐
              │pending_password_resets│  ← Service-level processing
              └───────────────────────┘
```

---

## 📊 COMPLETE RELATIONSHIP TABLE

### **All Relationships in the Database:**

| # | Parent Table | Child Table | Relationship Type | Cardinality | FK Column | NULL? | Line Type | Notes |
|---|-------------|-------------|-------------------|-------------|-----------|-------|-----------|-------|
| **1** | `auth.users` | `station_users` | One-to-One | `\|o┄┄o\|` | `user_id` | YES | Dashed | Station can exist without auth |
| **2** | `auth.users` | `responders` | One-to-One | `\|o┄┄o\|` | `user_id` | YES | Dashed | Responder can exist without auth |
| **3** | `station_users` | `responders` | One-to-Many | `\|\|──}\|` | `station_id` | NO | **Solid** | Responder MUST belong to station |
| **4** | `station_users` | `responder_notifications` | One-to-Many | `\|\|──}\|` | `station_id` | NO | **Solid** | Notification MUST have station |
| **5** | `responders` | `responder_notifications` | One-to-Many | `\|\|──}\|` | `responder_id` | NO | **Solid** | Notification MUST have responder |
| **6** | `citizen_users` | `fire_reports` | One-to-Many | `\|o┄┄}o` | `reporterId` | YES | Dashed | Reports can be anonymous |
| **7** | `messages` | `system_status` | One-to-One | `\|o┄┄\|o` | `triggered_by_message` | YES | Dashed | Status can be set manually |
| **8** | `fire_reports` | `report_assignments` | One-to-Many | `\|o┄┄}o` | `report_id` (text) | NO | Dashed | Text-based, weak reference |
| **9** | `fire_reports` | `report_routes` | One-to-Many | `\|o┄┄}o` | `report_id` (text) | NO | Dashed | Text-based, weak reference |
| **10** | `fire_reports` | `assigned_report_snapshots` | One-to-One | `\|o┄┄\|o` | `report_id` (text) | NO | Dashed | Text-based, weak reference |
| **11** | `fire_reports` | `notifications` | One-to-Many | `\|o┄┄}o` | `related_report_id` (text) | YES | [Weak] | No FK constraint |
| **12** | `fire_reports` | `messages` | One-to-Many | `\|o┄┄}o` | `report_id` (text) | YES | [Weak] | No FK constraint |
| **13** | `fire_reports` | `responder_notifications` | One-to-Many | `\|o┄┄}o` | `fire_report_id` (text) | NO | [Weak] | No FK constraint |

### **Polymorphic Relationships (No FK Constraints):**

| # | Table | Related Tables | Reference Column | Type Column | Notes |
|---|-------|----------------|------------------|-------------|-------|
| **P1** | `notifications` | `admin_users`, `station_users`, `responders`, `citizen_users` | `user_id` | `user_type` | Polymorphic user reference |
| **P2** | `messages` | ALL user tables | `sender_id`, `receiver_id` | `sender_type`, `receiver_type` | Polymorphic messaging |
| **P3** | `report_assignments` | `station_users`, `responders` | `assignee_id` | `assignee_type` | Polymorphic assignment |

### **Tables with NO Foreign Key Relationships:**

| # | Table | Reason |
|---|-------|--------|
| **1** | `admin_users` | Standalone user table, no dependencies |
| **2** | `password_reset_codes` | Uses email lookup across multiple tables |
| **3** | `pending_password_resets` | Service-level table, no FKs |

---

## 🔍 DETAILED RELATIONSHIP DIAGRAMS

### **1️⃣ Authentication & User Hierarchy**

```
                    ┌─────────────────────────────────┐
                    │      auth.users (Supabase)      │
                    │         (External Auth)         │
                    ├─────────────────────────────────┤
                    │  🔑 id (PK)                     │
                    │  📧 email (UQ)                  │
                    │  🔒 encrypted_password          │
                    └────────┬─────┬─────────┬────────┘
                             │     │         │
                    ┌────────┘     │         └──────────┐
                    │              │                    │
          [R1] DASHED     [R2] DASHED          [R2] DASHED
           Optional        Optional             Optional
                    ┆              ┆                    ┆
                    |o             |o                   |o
                    ┆              ┆                    ┆
         ┌──────────▼──────┐  ┌────▼──────────┐  ┌─────▼────────┐
         │  station_users  │  │  responders   │  │ admin_users  │
         ├─────────────────┤  ├───────────────┤  ├──────────────┤
         │ 🔑 id (PK)      │  │ 🔑 id (PK)    │  │ 🔑 id (PK)   │
         │ 🔗 user_id (FK) │  │ 🔗 user_id    │  │ 📧 email (UQ)│
         │    ┄▶ auth.users│  │    (FK) ┄▶auth│  │ (Independent)│
         │ 📧 email (UQ)   │  │ 📧 email (UQ) │  └──────────────┘
         │ 🏢 station_name │  │ 🔗 station_id │
         │ 📍 address      │  │    (FK) ──▶   │
         │ 🚒 firetrucks   │  │    stations   │
         └─────────────────┘  └───────────────┘
                  │                    ▲
                  │                    │
                  │ [R3] SOLID         │
                  │  Mandatory         │
                  │  One-to-Many       │
                  ││                   │
                  ││                   │
                  └────────────────────┘
                  }|
             (station MUST have
              1+ responders)
```

**Relationships:**
- **R1**: `auth.users` |o┄┄o| `station_users` (Optional, Dashed)
- **R2**: `auth.users` |o┄┄o| `responders` (Optional, Dashed)
- **R3**: `station_users` ||──}| `responders` (Mandatory, Solid)

---

### **2️⃣ Responder Notification System**

```
         ┌─────────────────┐
         │ station_users   │
         ├─────────────────┤
         │ 🔑 id (PK)      │
         └────────┬────────┘
                  │
                  │ [R4] SOLID
                  │ Mandatory
                  │ One-to-Many
                  ││
                  ││
                  }|
                  │
    ┌─────────────▼──────────────────────────────┐
    │      responder_notifications               │
    ├────────────────────────────────────────────┤
    │  🔑 id (PK)                                │
    │  🔗 station_id (FK, NN) ──▶ station_users │
    │  🔗 responder_id (FK, NN) ──▶ responders  │
    │  🔗 fire_report_id (text) [weak]          │
    │  📰 title, message                         │
    │  ⚠️  priority, status                      │
    │  👁️  is_read                                │
    └────────────────────────────────────────────┘
                  ▲
                  ││ [R5] SOLID
                  ││ Mandatory
                  ││ One-to-Many
                  ││
                  │
         ┌────────┴────────┐
         │   responders    │
         ├─────────────────┤
         │ 🔑 id (PK)      │
         └─────────────────┘
```

**Relationships:**
- **R4**: `station_users` ||──}| `responder_notifications` (Mandatory, Solid)
- **R5**: `responders` ||──}| `responder_notifications` (Mandatory, Solid)

---

### **3️⃣ Fire Reports & Citizen Connection**

```
         ┌──────────────────────┐
         │   citizen_users      │
         ├──────────────────────┤
         │ 🔑 id (PK, uuid)     │
         │ 📧 email (UQ)        │
         │ 👤 first_name, last  │
         │ 📊 reports count     │
         └──────────┬───────────┘
                    │
                    │ [R6] DASHED
                    │ Optional (Anonymous reports allowed)
                    │ One-to-Many
                    ┆
                    |o
                    ┆
                    }o
                    ┆
         ┌──────────▼────────────────────┐
         │       fire_reports            │
         ├───────────────────────────────┤
         │ 🔑 id (PK, uuid)              │
         │ 🔗 reporterId (FK) ┄▶ citizens│
         │    (Can be NULL)              │
         │ 🖼️  image_url                 │
         │ 🌐 lat, lng, address          │
         │ 🔥 cause_of_fire              │
         │ 🤖 prediction, confidence     │
         │ 🏠 structure info             │
         │ 🚨 alarm_level                │
         │ 📊 status                     │
         └───────────────────────────────┘
```

**Relationships:**
- **R6**: `citizen_users` |o┄┄}o `fire_reports` (Optional, Dashed)

---

### **4️⃣ Fire Reports Central Hub (All Connections)**

```
                         fire_reports (Central Entity)
                    ┌──────────────────────────┐
                    │ 🔑 id (PK, uuid)         │
                    │ 🔗 reporterId (FK)       │
                    │ 📍 Location data         │
                    │ 🚨 Alarm levels          │
                    │ 📊 Status                │
                    └───────┬──────────────────┘
                            │
         ┌──────────────────┼──────────────────┬────────────────┐
         │                  │                  │                │
         │ [R8]             │ [R9]             │ [R10]          │ [R11-R13]
         │ DASHED           │ DASHED           │ DASHED         │ WEAK REF
         │ Many             │ Many             │ One-to-One     │ (No FK)
         ┆                  ┆                  ┆                [
         }o                 }o                 |o               }o
         ┆                  ┆                  ┆                [
         │                  │                  │                │
    ┌────▼─────────┐  ┌─────▼───────┐  ┌──────▼──────┐  ┌─────▼──────────┐
    │ report_      │  │ report_     │  │ assigned_   │  │ notifications  │
    │ assignments  │  │ routes      │  │ report_     │  │ (related_report│
    ├──────────────┤  ├─────────────┤  │ snapshots   │  │ _id)           │
    │ 🔑 id (PK)   │  │ 🔑 id (PK)  │  ├─────────────┤  ├────────────────┤
    │ 🔗 report_id │  │ 🔗 report_id│  │ 🔑 report_id│  │ 🔗 related_    │
    │    (text,NN) │  │    (text,NN)│  │    (PK,text)│  │    report_id   │
    │ 📋 assignee_ │  │ 🎯 target   │  │ 🌐 lat, lng │  │    (text, NULL)│
    │    type      │  │    (text)   │  │ 📦 snapshot │  └────────────────┘
    │ 🔗 assignee_ │  │ 📝 note     │  │    _json    │            │
    │    id (uuid) │  │ 📅 forwarded│  │ 🔄 updated  │            │
    │ 📅 assigned_ │  │    _at      │  │    _at      │            │
    │    at        │  └─────────────┘  └─────────────┘            │
    │ 📝 note      │                                              │
    └──────────────┘                                              │
                                                                  │
                        ┌─────────────────────────────────────────┤
                        │                                         │
                        │ [R12]                          [R13]    │
                        │ WEAK REF                       WEAK REF │
                        [                                [        │
                        }o                               }o       │
                        [                                [        │
                  ┌─────▼──────┐               ┌─────────▼────────┐
                  │  messages  │               │ responder_       │
                  │            │               │ notifications    │
                  ├────────────┤               ├──────────────────┤
                  │ 🔗 report_ │               │ 🔗 fire_report_  │
                  │    id      │               │    id (text, NN) │
                  │    (text)  │               └──────────────────┘
                  └────────────┘
```

**Relationships:**
- **R8**: `fire_reports` |o┄┄}o `report_assignments` (Dashed, text FK)
- **R9**: `fire_reports` |o┄┄}o `report_routes` (Dashed, text FK)
- **R10**: `fire_reports` |o┄┄|o `assigned_report_snapshots` (Dashed, text FK)
- **R11**: `fire_reports` |o[weak]}o `notifications` (No FK constraint)
- **R12**: `fire_reports` |o[weak]}o `messages` (No FK constraint)
- **R13**: `fire_reports` |o[weak]}o `responder_notifications` (No FK constraint)

---

### **5️⃣ Messaging & System Status**

```
         ┌─────────────────────────────────────┐
         │           messages                  │
         ├─────────────────────────────────────┤
         │ 🔑 id (PK, uuid)                    │
         │ 🔗 sender_id (uuid) [polymorphic]   │
         │ 🔗 receiver_id (uuid) [polymorphic] │
         │ 👤 sender_type, receiver_type       │
         │ 📝 text, image_url                  │
         │ 🚨 is_emergency                     │
         │ 🤖 ai_analysis, suggested_alarm     │
         │ 🔗 report_id (text) [weak]          │
         └──────────────┬──────────────────────┘
                        │
                        │ [R7] DASHED
                        │ Optional (Status can be manual)
                        │ One-to-One
                        ┆
                        |o
                        ┆
                        |o
                        ┆
         ┌──────────────▼──────────────────────┐
         │        system_status                │
         ├─────────────────────────────────────┤
         │ 🔑 id (PK, text)                    │
         │ 🔗 triggered_by_message (FK)        │
         │    ┄▶ messages.id (Can be NULL)    │
         │ 🚨 current_level                    │
         │ 📊 confidence                       │
         │ 🕐 last_updated                     │
         │ 📝 reasoning                        │
         │ 🔑 keywords_found (array)           │
         └─────────────────────────────────────┘
```

**Relationships:**
- **R7**: `messages` |o┄┄|o `system_status` (Optional, Dashed)

---

### **6️⃣ Polymorphic Relationships**

```
    ┌───────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────────┐
    │admin_users│   │station_users │   │responders│   │citizen_users │
    └─────┬─────┘   └──────┬───────┘   └────┬─────┘   └──────┬───────┘
          │                │                 │                │
          │                │                 │                │
          │  [P1] POLYMORPHIC RELATIONSHIP (No FK Constraint) │
          │                │                 │                │
          [················[·················[················[
          [                [                 [                [
          └────────────────┴─────────────────┴────────────────┘
                                     │
                           ┌─────────▼──────────────────────────┐
                           │      notifications                 │
                           ├────────────────────────────────────┤
                           │ 🔑 id (PK)                         │
                           │ 🔗 user_id (uuid, NN)              │
                           │    [Points to ANY user table]      │
                           │ 📋 user_type (text, NN)            │
                           │    CHECK: admin|station|           │
                           │           responder|citizen        │
                           │ 📰 title, message                  │
                           │ 🏷️  type, priority                 │
                           │ 👁️  is_read                         │
                           │ 🔗 related_report_id [weak]        │
                           └────────────────────────────────────┘


    ┌───────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────────┐
    │admin_users│   │station_users │   │responders│   │citizen_users │
    └─────┬─────┘   └──────┬───────┘   └────┬─────┘   └──────┬───────┘
          │                │                 │                │
          │  [P2] POLYMORPHIC RELATIONSHIP (No FK Constraint) │
          [················[·················[················[
          [                [                 [                [
          └────────┬───────┴─────────────────┴────────────────┘
                   │                                    │
              ┌────▼────────┐                   ┌──────▼──────┐
              │ sender_id,  │                   │ receiver_id,│
              │ sender_type │                   │receiver_type│
              └─────────────┴───────────────────┴─────────────┘
                                     │
                           ┌─────────▼──────────────────────────┐
                           │          messages                  │
                           ├────────────────────────────────────┤
                           │ 🔑 id (PK)                         │
                           │ 🔗 sender_id (uuid, NN)            │
                           │ 🔗 receiver_id (uuid)              │
                           │ 📋 sender_type (text)              │
                           │ 📋 receiver_type (text)            │
                           │ 📝 text, image_url                 │
                           │ 🚨 is_emergency                    │
                           └────────────────────────────────────┘


              ┌──────────────┐           ┌──────────┐
              │station_users │           │responders│
              └──────┬───────┘           └────┬─────┘
                     │                        │
                     │ [P3] POLYMORPHIC       │
                     [························[
                     [                        [
                     └────────────┬───────────┘
                                  │
                        ┌─────────▼──────────────────────────┐
                        │     report_assignments             │
                        ├────────────────────────────────────┤
                        │ 🔑 id (PK)                         │
                        │ 🔗 report_id (text, NN)            │
                        │ 🔗 assignee_id (uuid, NN)          │
                        │    [Points to station OR responder]│
                        │ 📋 assignee_type (text, NN)        │
                        │    CHECK: station|responder        │
                        │ 📅 assigned_at                     │
                        └────────────────────────────────────┘
```

**Polymorphic Relationships:**
- **P1**: `notifications` → Multiple user tables via `user_id` + `user_type`
- **P2**: `messages` → Multiple user tables via sender/receiver pairs
- **P3**: `report_assignments` → `station_users` OR `responders` via `assignee_id` + `assignee_type`

---

### **7️⃣ Standalone Tables (No Relationships)**

```
┌────────────────────────────────────┐
│    password_reset_codes            │
│    (Standalone - Email Lookup)     │
├────────────────────────────────────┤
│ 🔑 id (PK)                         │
│ 📧 email (UQ, NN)                  │
│    [Searches across ALL user tables│
│     by email - no FK]              │
│ 🔢 code (6-digit)                  │
│ 📋 user_table (text)               │
│    [Identifies which table]        │
│ ⏰ expires_at                       │
└────────────────────────────────────┘


┌────────────────────────────────────┐
│   pending_password_resets          │
│   (Service-Level Processing)       │
├────────────────────────────────────┤
│ 🔑 id (PK)                         │
│ 📧 email (UQ, NN)                  │
│ 🔒 new_password_hash               │
│ 📋 user_table (text)               │
│ 🔗 user_id (uuid)                  │
│    [No FK - used by Edge Function] │
│ 🔢 verification_code               │
│ ⏰ expires_at                       │
└────────────────────────────────────┘


┌────────────────────────────────────┐
│         admin_users                │
│         (Independent)              │
├────────────────────────────────────┤
│ 🔑 id (PK)                         │
│ 📧 email (UQ, NN)                  │
│ 👤 first_name, last_name           │
│ 📝 role, status                    │
│ 📞 phone, address                  │
│                                    │
│ No foreign keys                    │
│ No child relationships             │
└────────────────────────────────────┘
```

---

## 📋 RELATIONSHIP SUMMARY BY TABLE

### **Tables as Parents (Referenced by others):**

| Table | # of Child Relationships | Child Tables |
|-------|--------------------------|--------------|
| `auth.users` | 3 | `station_users`, `responders`, (admin_users - optional) |
| `station_users` | 2 | `responders`, `responder_notifications` |
| `responders` | 1 | `responder_notifications` |
| `citizen_users` | 1 | `fire_reports` |
| `fire_reports` | 6 | `report_assignments`, `report_routes`, `assigned_report_snapshots`, `notifications` (weak), `messages` (weak), `responder_notifications` (weak) |
| `messages` | 1 | `system_status` |

### **Tables as Children (Reference others):**

| Table | # of Parent Relationships | Parent Tables |
|-------|---------------------------|---------------|
| `station_users` | 1 | `auth.users` |
| `responders` | 2 | `auth.users`, `station_users` |
| `responder_notifications` | 2 | `station_users`, `responders` |
| `fire_reports` | 1 | `citizen_users` |
| `report_assignments` | 1 (+1 polymorphic) | `fire_reports`, (station_users OR responders) |
| `report_routes` | 1 | `fire_reports` |
| `assigned_report_snapshots` | 1 | `fire_reports` |
| `system_status` | 1 | `messages` |
| `notifications` | 0 (polymorphic) | Multiple tables via user_type |
| `messages` | 0 (polymorphic) | Multiple tables via sender/receiver |

### **Standalone Tables (No Relationships):**

| Table | Reason |
|-------|--------|
| `admin_users` | Independent user management |
| `password_reset_codes` | Cross-table email lookup |
| `pending_password_resets` | Service-level processing |

---

## 🎯 RELATIONSHIP COUNT SUMMARY

### **Total Relationships: 17**

#### **By Type:**
- **Strong FK Relationships (Solid Lines)**: 5
  - `station_users` → `responders`
  - `station_users` → `responder_notifications`
  - `responders` → `responder_notifications`
  
- **Weak FK Relationships (Dashed Lines)**: 6
  - `auth.users` → `station_users`
  - `auth.users` → `responders`
  - `citizen_users` → `fire_reports`
  - `messages` → `system_status`
  - `fire_reports` → `report_assignments`
  - `fire_reports` → `report_routes`
  - `fire_reports` → `assigned_report_snapshots`

- **Weak References (No FK Constraint)**: 3
  - `fire_reports` ⇢ `notifications`
  - `fire_reports` ⇢ `messages`
  - `fire_reports` ⇢ `responder_notifications`

- **Polymorphic Relationships**: 3
  - `notifications` ⇢ Multiple user tables
  - `messages` ⇢ Multiple user tables
  - `report_assignments` ⇢ `station_users` OR `responders`

#### **By Cardinality:**
- **One-to-One**: 4 relationships
- **One-to-Many**: 11 relationships
- **Many-to-Many**: 0 (uses junction table pattern)

---

## 🔗 VISUAL CROSS-REFERENCE MATRIX

```
                    ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
                    │aut│adm│sta│res│cit│fir│msg│not│r_n│rep│rpt│snp│sys│pwd│pnd│
                    │hus│usr│usr│pdr│usr│rep│   │   │   │asn│rte│sht│sta│rst│rst│
────────────────────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
auth.users          │   │   │ ┆ │ ┆ │   │   │   │   │   │   │   │   │   │   │   │
admin_users         │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
station_users       │   │   │   │ ─ │   │   │   │   │ ─ │   │   │   │   │   │   │
responders          │ ┆ │   │   │   │   │   │   │   │ ─ │   │   │   │   │   │   │
citizen_users       │   │   │   │   │   │ ┆ │   │   │   │   │   │   │   │   │   │
fire_reports        │   │   │   │   │   │   │[W]│[W]│[W]│ ┆ │ ┆ │ ┆ │   │   │   │
messages            │   │   │   │   │   │   │   │   │   │   │   │   │ ┆ │   │   │
notifications       │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
responder_notif     │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
report_assignments  │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
report_routes       │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
assigned_snapshots  │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
system_status       │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
password_reset_codes│   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
pending_pwd_resets  │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
└───────────────────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

Legend: 
  ─ = Solid relationship (mandatory FK)
  ┆ = Dashed relationship (optional FK)
  [W] = Weak reference (no FK constraint)
  [P] = Polymorphic relationship
```

---

## ✅ VERIFICATION CHECKLIST

Every table accounted for:
- [x] `auth.users` - 3 outgoing relationships
- [x] `admin_users` - 0 relationships (standalone)
- [x] `station_users` - 1 parent, 2 children
- [x] `responders` - 2 parents, 1 child
- [x] `citizen_users` - 1 child
- [x] `fire_reports` - 1 parent, 6 children (3 weak)
- [x] `messages` - 1 child, polymorphic references
- [x] `notifications` - Polymorphic relationships
- [x] `responder_notifications` - 2 parents
- [x] `report_assignments` - 1 parent (+polymorphic)
- [x] `report_routes` - 1 parent
- [x] `assigned_report_snapshots` - 1 parent
- [x] `system_status` - 1 parent
- [x] `password_reset_codes` - 0 relationships
- [x] `pending_password_resets` - 0 relationships

**Total: 15 tables, 17 relationships (13 FK + 3 weak + 3 polymorphic)**

---

This document provides a complete map of every relationship in your FIRA database! 🎉

