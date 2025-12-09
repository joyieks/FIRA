# FIRA System - Comprehensive Code Analysis & Bug Report
**Date:** January 2025  
**Analysis Type:** Full Codebase Review for Bug Fixing & Improvements

---

## 📋 Executive Summary

**FIRA (Fire Incident Reporting and Response Application)** is a multi-platform emergency management system with:
- **Mobile App**: React Native/Expo (4 user types: Admin, Station, Responder, Citizen)
- **Web App**: React/Vite dashboard (Admin & Station management)
- **AI Service**: Python/Flask microservice for fire detection analysis
- **Database**: Supabase (PostgreSQL) with real-time subscriptions

**Analysis Status:** ✅ Complete - Ready for bug fixing and improvements

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    FIRA System                          │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Mobile  │         │   Web   │         │   AI     │
    │  (Expo) │         │ (React) │         │ (Flask)  │
    └────┬────┘         └────┬────┘         └────┬────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Supabase       │
                    │   (PostgreSQL)    │
                    │  • Real-time      │
                    │  • Auth           │
                    │  • Storage        │
                    └───────────────────┘
```

### Technology Stack

| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| **Mobile** | React Native | 0.81.5 | ✅ Active |
| **Mobile** | Expo | ~54.0.25 | ✅ Active |
| **Mobile** | NativeWind | ^4.1.23 | ✅ Active |
| **Web** | React | ^19.1.0 | ✅ Active |
| **Web** | Vite | ^7.0.0 | ✅ Active |
| **Web** | Tailwind CSS | ^4.1.11 | ✅ Latest |
| **Backend** | Supabase | ^2.56.0 | ✅ Active |
| **AI Service** | Flask | Latest | ✅ Active |
| **AI Service** | Python | 3.x | ✅ Active |

---

## 📁 Project Structure Deep Dive

### Mobile App (`mobile/app/`)

```
mobile/app/
├── _layout.tsx                    # Root layout with AuthProvider
├── index.tsx                      # Splash screen (5s → get-started)
│
├── Authentication/               # Auth flows
│   ├── login.jsx                 # Multi-user login (Admin/Citizen/Station/Responder)
│   ├── registration.jsx          # User registration
│   ├── verificationCode.jsx     # Email verification
│   └── ForgotPassword/
│       └── forgotpassword.jsx    # Password reset
│
├── Screens/                      # Main screen routers
│   ├── AdminScreen/index.jsx     # Admin entry point
│   ├── StationScreen/index.jsx   # Station entry point
│   ├── RespondersScreen/index.jsx # Responder entry point
│   └── CitizenScreen/index.jsx   # Citizen entry point
│
├── [UserType]/                   # User-specific features
│   ├── [UserType]Menu/           # Feature modules (Chat, Map, Notifications, etc.)
│   ├── [UserType]Profile/        # Profile management
│   └── [UserType]Header/         # Header components
│
├── components/                   # Shared components
│   ├── AuthGuard.jsx             # Route protection (with 5s timeout)
│   └── BackButtonHandler.jsx     # Android back button handler
│
├── config/                       # Configuration
│   ├── AuthContext.js            # Global auth state (⚠️ Hardcoded station creds)
│   ├── supabase.js              # Supabase client (⚠️ Hardcoded keys)
│   ├── googleConfig.js          # Google Maps config
│   └── map.js                   # Map utilities
│
└── services/                     # Business logic
    ├── aiService.js             # AI message analysis
    ├── citizenNotificationService.js
    ├── responderNotificationService.js
    ├── universalNotificationService.js
    └── responderAssignmentNotification.js
```

### Web App (`Website/web/pfira-app/src/`)

```
pfira-app/src/
├── App.jsx                       # React Router setup (⚠️ No route protection)
├── main.jsx                      # Entry point
│
├── components/pages/
│   ├── admin/                    # Admin pages
│   │   ├── Adashboard/          # Dashboard
│   │   ├── Overall/             # Overview
│   │   ├── Notification/        # Notifications
│   │   ├── AdminChat/           # Chat
│   │   └── AdminUserManagment/  # User management
│   │
│   ├── stations/                 # Station pages
│   │   ├── Sdashboard/          # Dashboard
│   │   ├── Station Overall/     # Overview (status updates)
│   │   ├── Snotification/       # Notifications
│   │   ├── Station Chat/        # Chat
│   │   └── StationUserManagement/ # User management
│   │
│   └── authentication/           # Login/Register
│
├── config/
│   └── supabase.js              # Supabase client (⚠️ Hardcoded keys)
│
├── contexts/
│   └── NotificationContext.jsx   # Global notification state
│
└── services/
    └── aiService.js              # AI integration
```

### AI Service (`Website/web/ai-service/`)

```
ai-service/
├── app.py                       # Flask application (⚠️ Hardcoded Supabase keys)
├── message_poller.py            # Database polling service
├── config.py                    # Configuration (uses .env with fallbacks)
├── requirements.txt             # Python dependencies
└── docker-compose.yml           # Docker deployment
```

---

## 🔍 Critical Code Analysis

### 1. Authentication System

**Location:** `mobile/app/config/AuthContext.js`

**Current Implementation:**
- ✅ React Context API with AsyncStorage persistence
- ✅ Multiple login methods: `loginAdmin()`, `loginCitizen()`, `loginStation()`, `loginResponder()`
- ⚠️ **Hardcoded station credentials** (line 81): `stations@gmail.com` / `stations`
- ⚠️ **Static password salt** (line 10): `'project_fira_salt_2024'` (should be per-user)
- ⚠️ **SHA-256 hashing** (should use bcrypt for production)
- ⚠️ **No token refresh mechanism**
- ⚠️ **Dummy tokens** stored instead of real JWT tokens

**Issues:**
1. Security vulnerability: Hardcoded credentials
2. Weak password hashing: SHA-256 with static salt
3. No session expiration handling
4. Mixed auth systems (Supabase Auth for Station/Responder, custom for Admin/Citizen)

**Recommendations:**
- Remove hardcoded credentials
- Migrate all users to Supabase Auth
- Use bcrypt for password hashing if custom auth is needed
- Implement proper JWT token refresh

### 2. Supabase Configuration

**Locations:**
- `mobile/app/config/supabase.js`
- `Website/web/pfira-app/src/config/supabase.js`
- `Website/web/ai-service/app.py` (hardcoded)
- `Website/web/ai-service/config.py` (with .env fallback)

**Current Implementation:**
- ⚠️ **Hardcoded API keys** in source files
- ⚠️ **No environment variable usage** (except AI service config.py)
- ⚠️ **Keys committed to repository** (security risk)

**Issues:**
1. API keys exposed in source code
2. No `.env` file usage in mobile/web apps
3. Keys visible in version control

**Recommendations:**
- Move all keys to environment variables
- Add `.env.example` files
- Update `.gitignore` to exclude `.env` files
- Use Expo Constants for mobile app

### 3. Chat System

**Mobile:** `mobile/app/Stations/StationsMenu/StationsChat/SChatPage.jsx`

**Features:**
- ✅ Real-time messaging via Supabase subscriptions
- ✅ Message editing & deletion (local + for everyone)
- ✅ AI analysis integration (gated for responders/incidents)
- ✅ Incident context linking (`report_id`)
- ✅ Read receipts
- ⚠️ **Local state updates** for edit/delete (not persisted to DB)
- ⚠️ **No optimistic update rollback** on failure

**Issues:**
1. Edit/delete operations only update local state
2. No database persistence for edits/deletes
3. Potential race conditions with real-time updates

**Recommendations:**
- Persist edit/delete operations to database
- Add `is_edited` and `is_deleted` flags to messages table
- Implement optimistic updates with rollback

### 4. Notification System

**Architecture:**
- Unified `notifications` table with polymorphic user references
- Multiple services: `universalNotificationService.js`, `responderNotificationService.js`, `citizenNotificationService.js`

**Current Implementation:**
- ✅ Database-backed notifications
- ✅ Real-time subscriptions (mobile)
- ✅ Priority levels (urgent, high, normal, low)
- ⚠️ **Inconsistent implementations** across platforms
- ⚠️ **Web uses localStorage** (not persistent)
- ⚠️ **Mobile Admin uses mock data** (not real)

**Issues:**
1. Notifications don't sync across devices
2. Web implementation incomplete
3. Mobile Admin notifications not functional

**Recommendations:**
- Unify notification system across all platforms
- Remove localStorage usage
- Implement real-time subscriptions for web
- Fix mobile Admin notifications

### 5. Error Handling

**Current State:**
- ⚠️ **Inconsistent error handling** patterns
- ⚠️ **Silent failures** (many `catch (_) {}` blocks)
- ⚠️ **No user feedback** on errors
- ⚠️ **891 console.log statements** in production code

**Issues Found:**
1. Many try-catch blocks swallow errors silently
2. No error boundaries in React components
3. No centralized error logging
4. Console logs should be removed or replaced with proper logging

**Examples:**
```javascript
// SChatPage.jsx line 71
catch (_) {}  // Silent failure

// aiService.js line 31
catch (_) { return null; }  // Silent failure
```

**Recommendations:**
- Implement error boundaries
- Add user-friendly error messages
- Replace console.log with proper logging library
- Add retry logic for network failures

---

## 🐛 Known Bugs & Issues

### Critical Bugs

1. **Fire Detection API 404 Errors**
   - **Location:** `mobile/app/Citizens/CitizenMenu/CitizenStatus/CStatus.jsx`
   - **Issue:** Railway API may sleep on free tier, causing 404 errors
   - **Impact:** Citizens cannot submit fire reports
   - **Status:** ⚠️ Needs retry logic and error handling

2. **API Bug: Structure Confidence Calculation**
   - **Location:** Fire Detection API (Railway - external)
   - **Issue:** Line 334 uses `smoke_pred` instead of `structure_pred`
   - **Impact:** Incorrect structure confidence scores
   - **Status:** ⚠️ Documented, needs external fix

3. **Hardcoded Credentials**
   - **Location:** `mobile/app/config/AuthContext.js:81`
   - **Issue:** Station login has hardcoded `stations@gmail.com` / `stations`
   - **Impact:** Security vulnerability
   - **Status:** ⚠️ Needs removal

4. **Hardcoded API Keys**
   - **Locations:** Multiple files (supabase.js, app.py, etc.)
   - **Issue:** Supabase keys exposed in source code
   - **Impact:** Security risk if repository is public
   - **Status:** ⚠️ Needs environment variable migration

### Medium Priority Bugs

5. **Notification System Inconsistency**
   - **Issue:** Different implementations across platforms
   - **Impact:** Notifications don't sync across devices
   - **Status:** ⚠️ Needs unification

6. **Authentication Inconsistency**
   - **Issue:** Mixed auth systems (Supabase Auth vs Custom)
   - **Impact:** Different login flows, security concerns
   - **Status:** ⚠️ Needs standardization

7. **Chat Edit/Delete Not Persisted**
   - **Location:** `SChatPage.jsx`, `RChatPage.jsx`, etc.
   - **Issue:** Edit/delete operations only update local state
   - **Impact:** Changes lost on refresh, not synced across devices
   - **Status:** ⚠️ Needs database persistence

8. **Password Reset Mobile Implementation**
   - **Issue:** May not be fully implemented for mobile
   - **Status:** ⚠️ Needs verification

### Low Priority Issues

9. **RLS Policies Too Permissive**
   - **Issue:** All tables use `USING (true)` policy
   - **Impact:** Security risk in production
   - **Status:** ⚠️ Needs proper RLS policies

10. **Missing Error Handling**
    - **Issue:** Some API calls lack proper error handling
    - **Impact:** Poor user experience on failures
    - **Status:** ⚠️ Needs comprehensive error handling

11. **Console Logs in Production**
    - **Issue:** 891 console.log statements in production code
    - **Impact:** Performance, security (may leak sensitive data)
    - **Status:** ⚠️ Needs logging library replacement

12. **No TypeScript**
    - **Issue:** Mostly JavaScript files, limited type safety
    - **Impact:** Runtime errors, harder maintenance
    - **Status:** ⚠️ Consider gradual TypeScript migration

---

## 🔒 Security Concerns

### High Priority

1. **Hardcoded API Keys**
   - Supabase keys in source files
   - Should use environment variables
   - **Risk:** High if repository is public

2. **Hardcoded Credentials**
   - Station login credentials in code
   - Should use database authentication
   - **Risk:** High

3. **Weak Password Hashing**
   - SHA-256 with static salt
   - Should use bcrypt with per-user salts
   - **Risk:** Medium

4. **RLS Policies Too Permissive**
   - All tables use `USING (true)`
   - Should implement proper role-based policies
   - **Risk:** High in production

### Medium Priority

5. **No Token Refresh**
   - Sessions may expire unexpectedly
   - Should implement automatic refresh
   - **Risk:** Medium

6. **No Input Validation**
   - Some forms lack proper validation
   - Should add input sanitization
   - **Risk:** Medium

7. **No Rate Limiting**
   - API calls not rate-limited
   - Should implement rate limiting
   - **Risk:** Medium

---

## 📊 Code Quality Assessment

### Strengths ✅

1. **Modular Organization**
   - Clear separation of concerns
   - Well-organized file structure
   - Service layer pattern

2. **Real-time Capabilities**
   - Supabase subscriptions properly implemented
   - Live updates working

3. **Component Reusability**
   - Shared components in `components/` directory
   - Good component patterns

4. **Documentation**
   - Good markdown documentation
   - Implementation guides available

### Weaknesses ⚠️

1. **Error Handling**
   - Inconsistent patterns
   - Silent failures
   - No error boundaries

2. **Code Duplication**
   - Similar chat components for each user type
   - Could be abstracted

3. **Type Safety**
   - Mostly JavaScript
   - No TypeScript interfaces
   - Magic strings everywhere

4. **Testing**
   - No visible test files
   - No test infrastructure

5. **Performance**
   - No React.memo usage
   - No lazy loading
   - No pagination for large lists

---

## 🚀 Recommended Improvements Priority

### Priority 1: Critical Security & Bugs

1. **Move API Keys to Environment Variables**
   - Create `.env` files for all projects
   - Update `.gitignore`
   - Use Expo Constants for mobile

2. **Remove Hardcoded Credentials**
   - Remove station hardcoded login
   - Implement proper database authentication

3. **Fix Fire Detection API Errors**
   - Add retry logic
   - Better error messages
   - Fallback mechanisms

4. **Implement Proper RLS Policies**
   - Role-based access control
   - Secure database queries

### Priority 2: Core Functionality

5. **Unify Notification System**
   - Database-backed for all platforms
   - Real-time subscriptions everywhere
   - Consistent UI/UX

6. **Standardize Authentication**
   - Migrate all users to Supabase Auth
   - Remove custom password hashing
   - Implement token refresh

7. **Persist Chat Edit/Delete**
   - Add database flags
   - Sync across devices
   - Optimistic updates with rollback

### Priority 3: Code Quality

8. **Improve Error Handling**
   - Error boundaries
   - User-friendly messages
   - Centralized logging

9. **Remove Console Logs**
   - Replace with logging library
   - Remove debug statements

10. **Add Type Safety**
    - Gradual TypeScript migration
    - PropTypes or interfaces
    - Type-safe API calls

### Priority 4: Performance & Testing

11. **Performance Optimization**
    - React.memo for expensive components
    - Lazy load routes
    - Pagination for lists

12. **Add Testing Infrastructure**
    - Unit tests for services
    - Component tests
    - Integration tests

---

## 📝 Code Statistics

- **Total Files Analyzed:** 100+ component files
- **Console Logs:** 891 statements
- **Hardcoded Keys:** 4+ locations
- **Security Issues:** 7 identified
- **Bugs:** 12 documented
- **Code Duplication:** Medium (chat components)

---

## 🎯 Next Steps

1. ✅ **Analysis Complete** - Full codebase reviewed
2. 🔄 **Ready for Bug Fixing** - All issues documented
3. 📋 **Priority List Created** - Focus areas identified
4. 🚀 **Ready to Start** - Can begin fixing issues

---

## 📚 Related Documentation

- `COMPLETE_CODE_ANALYSIS.md` - Previous analysis
- `SYSTEM_ANALYSIS.md` - System architecture
- `API_BUG_FIX.md` - API issues
- `NOTIFICATION_SYSTEM_SETUP.md` - Notification implementation
- Various feature implementation guides

---

**Analysis Completed:** January 2025  
**Status:** ✅ Ready for bug fixing and improvements  
**Next Action:** Begin fixing Priority 1 issues








