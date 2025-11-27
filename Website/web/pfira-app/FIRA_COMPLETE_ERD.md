# FIRA PROJECT - Complete Entity Relationship Diagram (ERD)

## Complete Database Schema with All Tables and Relationships

---

## **ERD Diagram Visualization**

```
═══════════════════════════════════════════════════════════════════════════════
                            FIRA DATABASE ERD
                    All Tables and Relationships
═══════════════════════════════════════════════════════════════════════════════


┌─────────────────────────────────────────────────────────────────────────────┐
│                         auth.users                                          │
│                      (Supabase Authentication)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  id (PK) - UUID                                                             │
│  email                                                                      │
│  encrypted_password                                                         │
│  email_confirmed                                                            │
│  created_at                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                │             │             │
    ┌───────────▼──────┐      │      ┌──────▼──────────────────────────┐
    │  admin_users     │      │      │  station_users                 │
    ├──────────────────┤      │      ├─────────────────────────────────┤
    │  id (PK)         │      │      │  id (PK)                        │
    │  email (UNIQUE)  │      │      │  station_name (NOT NULL)        │
    │  first_name      │      │      │  email (UNIQUE)                 │
    │  last_name       │      │      │  address                        │
    │  role            │      │      │  phone                          │
    │  status          │      │      │  position                       │
    │  phone           │      │      │  role                           │
    │  address         │      │      │  active                         │
    │  created_at      │      │      │  status                         │
    │  updated_at      │      │      │  is_online                      │
    └──────────────────┘      │      │  lat                            │
                             │      │  lng                            │
                             │      │  num_firetrucks                 │
                             │      │  firetruck_size                 │
                             │      │  user_id (FK) ──────────────────┼──┐
                             │      │  created_at                     │  │
                             │      │  updated_at                     │  │
                             │      └─────────────────────────────────┘  │
                             │              │                            │
                             │              │ (One-to-Many)             │
                             │              │                            │
                    ┌────────▼──────────────▼──────────────┐            │
                    │   responders                          │            │
                    ├──────────────────────────────────────┤            │
                    │  id (PK)                             │            │
                    │  station_id (NOT NULL) ──────────────┼────────────┘
                    │  first_name (NOT NULL)               │
                    │  last_name (NOT NULL)                │
                    │  middle_name                         │
                    │  email (UNIQUE)                      │
                    │  phone                               │
                    │  user_position                       │
                    │  status                              │
                    │  is_online                           │
                    │  station_contact_number              │
                    │  address                             │
                    │  birthdate                           │
                    │  age                                 │
                    │  gender                              │
                    │  auth_user_id                        │
                    │  user_id (FK) ───────────────────────┼──┐
                    │  created_at                          │  │
                    │  updated_at                          │  │
                    └──────────────────────────────────────┘  │
                                                             │
                    ┌────────────────────────────────────────┘
                    │
    ┌───────────────▼──────────────────┐
    │  citizen_users                   │
    ├──────────────────────────────────┤
    │  id (PK)                         │
    │  email (UNIQUE)                  │
    │  first_name (NOT NULL)           │
    │  last_name (NOT NULL)            │
    │  phone                           │
    │  display_name                    │
    │  status                          │
    │  reports                         │
    │  is_verified                     │
    │  google_sign_in                  │
    │  user_type                       │
    │  created_at                      │
    │  updated_at                      │
    └──────────────────────────────────┘
              │
              │ (One-to-Many)
              │
    ┌─────────▼──────────────────────────────────────────────┐
    │           fire_reports                                 │
    ├────────────────────────────────────────────────────────┤
    │  id (PK)                                               │
    │  created_at (NOT NULL)                                 │
    │  formatted_timestamp                                   │
    │  image_url (NOT NULL)                                  │
    │  latitude                                              │
    │  longitude                                             │
    │  geotag_location                                       │
    │  address                                               │
    │  cause_of_fire                                         │
    │  prediction (JSONB)                                    │
    │  confidence                                            │
    │  structure                                             │
    │  number_of_structures_on_fire                          │
    │  recommended_alarm_level                               │
    │  smoke_intensity                                       │
    │  smoke_confidence                                      │
    │  reporter                                              │
    │  reporterId (FK) ──────────────────────────────────────┼──┐
    │  status                                                │  │
    │  final_fire_alarm_level                                │  │
    │  cancellation_timestamp                                │  │
    │  cancellation_reason                                   │  │
    │  cancelled_by                                          │  │
    │  structure_confidence                                  │  │
    │  structure_probabilities                               │  │
    └────────────────────────────────────────────────────────┘  │
                                                                │
                                                                │
┌──────────────────────────────────────────────────────────────────────────────┐
│                        report_assignments                                    │
│              (Junction Table - Many-to-Many Assignments)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  report_id (TEXT, NOT NULL) ────────────────────────────────────────┐       │
│    - References fire_reports.id or Firebase report ID               │       │
│  assignee_type (ENUM: 'station' | 'responder', NOT NULL)            │       │
│  assignee_id (UUID, NOT NULL)                                       │       │
│    - Polymorphic: References station_users.id OR responders.id       │       │
│  assigned_at (NOT NULL)                                             │       │
│  note                                                               │       │
└──────────────────────────────────────────────────────────────────────────────┘
     │                                      │
     │                                      │
     │ (Many-to-One)                       │ (Many-to-One)
     │                                      │
     │         ┌────────────────────────────┴────────────────────────────┐
     │         │                                                         │
     │         │                                                         │
     │  ┌──────▼──────────┐                                  ┌──────────▼──────────┐
     │  │ station_users   │                                  │  responders         │
     │  │                 │                                  │                     │
     │  │ (via assignee_id│                                  │ (via assignee_id    │
     │  │  when type =    │                                  │  when type =        │
     │  │  'station')     │                                  │  'responder')       │
     │  └─────────────────┘                                  └─────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                 assigned_report_snapshots                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  report_id (PK, TEXT)                                                        │
│    - References fire_reports.id or Firebase report ID                       │
│  lat (DOUBLE PRECISION)                                                     │
│  lng (DOUBLE PRECISION)                                                     │
│  address (TEXT)                                                             │
│  snapshot_json (JSONB)                                                      │
│  updated_at (NOT NULL)                                                      │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                      report_routes                                           │
│            (Forwarding/Redirection History)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  report_id (TEXT, NOT NULL)                                                  │
│    - References fire_reports.id or Firebase report ID                       │
│  target (TEXT, NOT NULL)                                                     │
│    - Format: 'station:<id>' or 'agency:police'                             │
│  note (TEXT)                                                                 │
│  forwarded_at                                                                │
│  created_at                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                          messages                                            │
│                    (Chat System - Many-to-Many)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  sender_id (UUID, NOT NULL)                                                  │
│    - Polymorphic: References any user table                                  │
│  receiver_id (UUID)                                                          │
│    - Polymorphic: References any user table                                  │
│  sender_type (TEXT)                                                          │
│    - 'admin', 'station', 'responder', 'citizen'                             │
│  receiver_type (TEXT, NOT NULL)                                              │
│    - 'admin', 'station', 'responder', 'citizen'                             │
│  text (TEXT)                                                                 │
│  image_url (TEXT)                                                            │
│  is_emergency (BOOLEAN)                                                      │
│  is_read (BOOLEAN)                                                           │
│  ai_suggested_alarm (TEXT)                                                   │
│  ai_analysis (JSONB)                                                         │
│  suggested_alarm_level (TEXT)                                                │
│  ai_confidence (NUMERIC)                                                     │
│  analyzed_at (TIMESTAMP)                                                     │
│  report_id (TEXT)                                                            │
│  created_at                                                                  │
│  updated_at                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
     │                              │
     │  (Polymorphic References)    │
     │                              │
     │  Can reference:              │
     │  • admin_users.id            │
     │  • station_users.id          │
     │  • responders.id             │
     │  • citizen_users.id          │
     │                              │
     │                              │
     │  (One-to-Many)               │
     │                              │
     │  ┌───────────────────────────▼──────────────────────────────┐
     │  │              system_status                               │
     │  ├──────────────────────────────────────────────────────────┤
     │  │  id (PK, TEXT)                                           │
     │  │  current_level (NOT NULL)                                │
     │  │  confidence (NUMERIC)                                    │
     │  │  last_updated                                            │
     │  │  triggered_by_message (FK) ──────────────────────────────┼──┐
     │  │  reasoning (TEXT)                                        │  │
     │  │  keywords_found (ARRAY)                                  │  │
     │  │  created_at                                              │  │
     │  │  updated_at                                              │  │
     │  └──────────────────────────────────────────────────────────┘  │
     │                                                                │
     │                                                                │
     │                                                                │


┌──────────────────────────────────────────────────────────────────────────────┐
│                      notifications                                           │
│            (Unified Notification System - One-to-Many)                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  user_id (UUID, NOT NULL)                                                    │
│    - Polymorphic: References any user table                                  │
│  user_type (ENUM, NOT NULL)                                                  │
│    - 'admin', 'station', 'responder', 'citizen'                             │
│  title (TEXT, NOT NULL)                                                      │
│  message (TEXT, NOT NULL)                                                    │
│  type (ENUM, NOT NULL)                                                       │
│    - 'fire_alert', 'assignment', 'system', 'user_action',                   │
│      'emergency', 'info'                                                     │
│  priority (ENUM, NOT NULL)                                                   │
│    - 'low', 'normal', 'high', 'urgent'                                      │
│  is_read (BOOLEAN)                                                           │
│  related_report_id (TEXT)                                                    │
│  action_url (TEXT)                                                           │
│  created_at                                                                  │
│  updated_at                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ (Many-to-One)
     │
     │  Can reference:
     │  • admin_users.id
     │  • station_users.id
     │  • responders.id
     │  • citizen_users.id


┌──────────────────────────────────────────────────────────────────────────────┐
│                 responder_notifications                                      │
│         (Responder-Specific Notifications - Many-to-One)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  responder_id (FK, NOT NULL) ───────────────────────────┐                   │
│  station_id (FK, NOT NULL) ─────────────────────────────┼──┐                 │
│  fire_report_id (TEXT, NOT NULL)                        │  │                 │
│  title (TEXT, NOT NULL)                                 │  │                 │
│  message (TEXT, NOT NULL)                               │  │                 │
│  priority (ENUM, NOT NULL)                              │  │                 │
│    - 'low', 'normal', 'high', 'urgent'                  │  │                 │
│  status (ENUM)                                           │  │                 │
│    - 'pending', 'accepted', 'declined', 'completed'      │  │                 │
│  is_read (BOOLEAN, NOT NULL)                            │  │                 │
│  accepted_at (TIMESTAMP)                                 │  │                 │
│  created_at                                              │  │                 │
│  updated_at                                              │  │                 │
└──────────────────────────────────────────────────────────┼──┼─────────────────┘
                                                          │  │
                    ┌─────────────────────────────────────┘  │
                    │                                        │
                    │                                        │
            ┌───────▼────────┐                    ┌──────────▼──────────┐
            │  responders    │                    │  station_users      │
            │                │                    │                     │
            │ (see above)    │                    │ (see above)         │
            └────────────────┘                    └─────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                  password_reset_codes                                        │
│            (Password Reset Verification)                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  email (UNIQUE, NOT NULL)                                                    │
│  code (TEXT, NOT NULL)                                                       │
│    - 6-digit verification code                                               │
│  user_table (TEXT)                                                           │
│    - 'admin_users', 'station_users', 'citizen_users', 'responders'          │
│  expires_at (TIMESTAMP, NOT NULL)                                            │
│  created_at                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                pending_password_resets                                       │
│            (Temporary Password Storage)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  id (PK)                                                                     │
│  email (UNIQUE, NOT NULL)                                                    │
│  new_password_hash (TEXT, NOT NULL)                                          │
│  user_table (TEXT, NOT NULL)                                                 │
│    - 'admin_users', 'station_users', 'citizen_users', 'responders'          │
│  user_id (UUID)                                                              │
│    - Optional reference to auth.users.id                                     │
│  verification_code (TEXT, NOT NULL)                                          │
│  expires_at (TIMESTAMP, NOT NULL)                                            │
│  created_at                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              RELATIONSHIP SUMMARY
═══════════════════════════════════════════════════════════════════════════════

EXPLICIT FOREIGN KEY RELATIONSHIPS:

1. auth.users → station_users (One-to-One)
   └─ station_users.user_id → auth.users.id

2. auth.users → responders (One-to-One)
   └─ responders.user_id → auth.users.id

3. station_users → responders (One-to-Many)
   └─ responders.station_id → station_users.id

4. citizen_users → fire_reports (One-to-Many)
   └─ fire_reports.reporterId → citizen_users.id

5. station_users → responder_notifications (One-to-Many)
   └─ responder_notifications.station_id → station_users.id

6. responders → responder_notifications (One-to-Many)
   └─ responder_notifications.responder_id → responders.id

7. messages → system_status (One-to-One)
   └─ system_status.triggered_by_message → messages.id

POLYMORPHIC RELATIONSHIPS (No explicit FKs, uses type + id pattern):

8. report_assignments → station_users (Many-to-One, via assignee_id)
   └─ When assignee_type = 'station', assignee_id references station_users.id

9. report_assignments → responders (Many-to-One, via assignee_id)
   └─ When assignee_type = 'responder', assignee_id references responders.id

10. messages → All user tables (Many-to-Many, polymorphic)
    └─ sender_id + sender_type / receiver_id + receiver_type

11. notifications → All user tables (One-to-Many, polymorphic)
    └─ user_id + user_type references any user table

TEXT-BASED REFERENCES (Firebase/External):

12. fire_reports.id → report_assignments.report_id
    └─ TEXT reference (no explicit FK constraint)

13. fire_reports.id → report_routes.report_id
    └─ TEXT reference (no explicit FK constraint)

14. fire_reports.id → assigned_report_snapshots.report_id
    └─ TEXT reference (no explicit FK constraint)

15. fire_reports.id → responder_notifications.fire_report_id
    └─ TEXT reference (no explicit FK constraint)

═══════════════════════════════════════════════════════════════════════════════
                              ENTITY SUMMARY
═══════════════════════════════════════════════════════════════════════════════

CORE USER TABLES (4):
  • admin_users
  • station_users
  • responders
  • citizen_users

AUTHENTICATION (1):
  • auth.users (Supabase Auth)

FIRE REPORT SYSTEM (4):
  • fire_reports
  • report_assignments (Junction Table)
  • report_routes
  • assigned_report_snapshots

COMMUNICATION (2):
  • messages (Chat System)
  • system_status (AI Alarm Level System)

NOTIFICATIONS (2):
  • notifications (Unified)
  • responder_notifications (Responder-Specific)

SECURITY (2):
  • password_reset_codes
  • pending_password_resets

═══════════════════════════════════════════════════════════════════════════════
                              KEY DESIGN PATTERNS
═══════════════════════════════════════════════════════════════════════════════

1. POLYMORPHIC RELATIONSHIPS
   - messages: sender_type + sender_id / receiver_type + receiver_id
   - notifications: user_type + user_id
   - report_assignments: assignee_type + assignee_id

2. JUNCTION TABLES
   - report_assignments: Many-to-many between reports and stations/responders

3. SOFT DELETES
   - status fields instead of hard deletes (active/inactive)

4. AUDIT TRAILS
   - created_at and updated_at on all tables

5. TYPE SAFETY
   - ENUMs for constrained values (status, priority, type)

6. TEXT REFERENCES
   - Firebase report IDs stored as TEXT (no FK constraints)

7. JSONB COLUMNS
   - prediction, snapshot_json, ai_analysis for flexible data

═══════════════════════════════════════════════════════════════════════════════

TOTAL TABLES: 15
TOTAL RELATIONSHIPS: 15+ (7 explicit FKs + 8+ polymorphic/text-based)
DATABASE TYPE: PostgreSQL (Supabase)

═══════════════════════════════════════════════════════════════════════════════

