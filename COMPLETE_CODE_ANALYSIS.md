# FIRA System - Complete Code Structure & Analysis

**Date:** January 2025  
**Analysis Type:** Comprehensive Code Structure & Architecture Review

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Architecture Patterns](#architecture-patterns)
5. [Database Schema](#database-schema)
6. [Code Organization](#code-organization)
7. [Key Components Analysis](#key-components-analysis)
8. [State Management](#state-management)
9. [Routing & Navigation](#routing--navigation)
10. [Services & Integrations](#services--integrations)
11. [Styling Approach](#styling-approach)
12. [Security Considerations](#security-considerations)
13. [Code Quality & Patterns](#code-quality--patterns)
14. [Areas for Improvement](#areas-for-improvement)

---

## 🎯 Executive Summary

**FIRA (Fire Incident Reporting and Response Application)** is a multi-platform emergency management system with:

- **Mobile App**: React Native/Expo application for all user types
- **Web App**: React/Vite dashboard for Admin and Station management
- **AI Service**: Python/Flask microservice for fire detection analysis
- **Database**: Supabase (PostgreSQL) with real-time subscriptions

**Key Strengths:**
- ✅ Well-organized modular structure
- ✅ Real-time capabilities via Supabase
- ✅ Multi-user type support (Admin, Station, Responder, Citizen)
- ✅ Comprehensive notification system
- ✅ AI-powered message analysis

**Key Areas for Improvement:**
- ⚠️ Inconsistent error handling patterns
- ⚠️ Some hardcoded credentials (security concern)
- ⚠️ Mixed state management approaches
- ⚠️ Limited TypeScript usage
- ⚠️ Some code duplication across platforms

---

## 📁 Project Structure

```
PROJECT_FIRA/
├── FIRA/
│   ├── mobile/                    # React Native Mobile App
│   │   ├── app/                   # Expo Router app directory
│   │   │   ├── _layout.tsx        # Root layout with AuthProvider
│   │   │   ├── index.tsx          # Splash screen → get-started
│   │   │   ├── Admin/             # Admin user screens
│   │   │   ├── Citizens/          # Citizen user screens
│   │   │   ├── Responders/        # Responder user screens
│   │   │   ├── Stations/          # Station user screens
│   │   │   ├── Authentication/    # Login, Registration, Forgot Password
│   │   │   ├── Screens/           # Main screen routers per user type
│   │   │   ├── components/        # Shared components (AuthGuard, BackButtonHandler)
│   │   │   ├── config/            # Supabase, AuthContext, Google config
│   │   │   ├── services/          # Business logic services
│   │   │   └── utils/             # Utility functions
│   │   ├── assets/                # Images, fonts, sounds
│   │   ├── package.json           # Dependencies
│   │   └── tailwind.config.js     # NativeWind configuration
│   │
│   ├── Website/                   # Web Application
│   │   └── web/
│   │       ├── pfira-app/         # React Web App
│   │       │   ├── src/
│   │       │   │   ├── App.jsx    # React Router setup
│   │       │   │   ├── main.jsx   # Entry point
│   │       │   │   ├── components/pages/  # Page components
│   │       │   │   ├── config/    # Supabase config
│   │       │   │   ├── contexts/  # React Context providers
│   │       │   │   └── services/  # Business logic
│   │       │   └── supabase/      # Edge functions
│   │       │
│   │       └── ai-service/        # Python Flask AI Service
│   │           ├── app.py         # Flask application
│   │           ├── message_poller.py  # Database polling
│   │           └── requirements.txt
│   │
│   └── [Documentation Files]      # Various .md files for features
```

---

## 🛠️ Technology Stack

### Mobile Application (`mobile/`)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Mobile framework |
| **Expo** | 54.0.19 | Development platform |
| **Expo Router** | ~6.0.13 | File-based routing |
| **React** | 19.1.0 | UI library |
| **NativeWind** | ^4.1.23 | Tailwind CSS for RN |
| **Supabase JS** | ^2.56.0 | Backend & database |
| **AsyncStorage** | 2.2.0 | Local storage |
| **React Native Maps** | 1.20.1 | Map integration |
| **Expo Location** | ~19.0.7 | GPS services |
| **Expo Image Picker** | ~17.0.8 | Photo capture |

### Web Application (`Website/web/pfira-app/`)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | ^19.1.0 | UI library |
| **React Router DOM** | ^7.6.3 | Client-side routing |
| **Vite** | ^7.0.0 | Build tool |
| **Tailwind CSS** | ^4.1.11 | Styling (latest version) |
| **Supabase JS** | ^2.56.0 | Backend & database |
| **React Leaflet** | ^5.0.0 | Map component |
| **EmailJS** | ^4.4.1 | Email service |

### AI Service (`Website/web/ai-service/`)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Flask** | Latest | Web framework |
| **Python** | 3.x | Runtime |
| **PostgreSQL** | - | Database (via Supabase) |
| **Docker** | - | Containerization |

### Backend & Database

| Service | Purpose |
|---------|---------|
| **Supabase** | PostgreSQL database, Auth, Real-time subscriptions |
| **Google Maps API** | Geocoding, mapping |
| **Railway** | Fire Detection API deployment |
| **Render** | AI Analysis API deployment |

---

## 🏗️ Architecture Patterns

### 1. **Multi-Platform Architecture**

```
┌─────────────────────────────────────────────────┐
│              FIRA System Architecture            │
└─────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Mobile     │    │     Web     │    │   AI Service │
│   (Expo)     │    │   (React)   │    │   (Flask)   │
└──────┬───────┘    └──────┬──────┘    └──────┬───────┘
       │                   │                  │
       └───────────────────┼──────────────────┘
                           │
                  ┌────────▼────────┐
                  │    Supabase     │
                  │   (PostgreSQL)  │
                  │                 │
                  │  • Real-time    │
                  │  • Auth         │
                  │  • Storage      │
                  └─────────────────┘
```

### 2. **User Type-Based Routing**

Each user type has dedicated screens:
- **Admin**: `Screens/AdminScreen/index.jsx`
- **Station**: `Screens/StationScreen/index.jsx`
- **Responder**: `Screens/RespondersScreen/index.jsx`
- **Citizen**: `Screens/CitizenScreen/index.jsx`

### 3. **Component Organization Pattern**

```
UserType/
├── UserTypeMenu/          # Main feature screens
│   ├── Feature1/
│   ├── Feature2/
│   └── Feature3/
├── UserTypeProfile/       # Profile management
├── UserTypeHeader/        # Header component
└── UserTypeNavBarMenu/    # Navigation
```

### 4. **Service Layer Pattern**

Business logic separated into services:
- `aiService.js` - AI message analysis
- `citizenNotificationService.js` - Citizen notifications
- `responderNotificationService.js` - Responder notifications
- `universalNotificationService.js` - Cross-user notifications

---

## 🗄️ Database Schema

### Core User Tables

1. **`admin_users`**
   - `id` (UUID, PK)
   - `email`, `first_name`, `last_name`
   - `role` (default: 'admin')
   - `active`, `status`

2. **`station_users`**
   - `id` (UUID, PK)
   - `station_name`, `email`
   - `jurisdiction_coordinates` (JSONB)
   - `active`, `status`

3. **`responders`**
   - `id` (UUID, PK)
   - `first_name`, `last_name`, `email`
   - `station_id` (FK to station_users)
   - `status`, `is_online`

4. **`citizen_users`**
   - `id` (UUID, PK)
   - `first_name`, `last_name`, `email`
   - `phone`, `address`

### Fire Reports & Assignments

5. **`fire_reports`** (External API - Railway)
   - `id` (TEXT)
   - `address`, `latitude`, `longitude`
   - `prediction`, `confidence`, `alarm_level`
   - `image_url`, `reporterId`
   - `status` ('On Going', 'Resolved', etc.)

6. **`report_assignments`**
   - `id` (UUID, PK)
   - `report_id` (TEXT - weak reference)
   - `assignee_type` ('station' | 'responder')
   - `assignee_id` (UUID - polymorphic)
   - `status` ('pending' | 'accepted' | 'rejected' | 'completed')
   - `assigned_at`, `assignment_note`

7. **`report_routes`**
   - `id` (UUID, PK)
   - `report_id` (TEXT)
   - `target` (TEXT - 'station:<uuid>' or agency name)
   - `note` (forwarding note)
   - `forwarded_at`

### Communication

8. **`messages`**
   - `id` (UUID, PK)
   - `sender_id`, `receiver_id` (UUID - polymorphic)
   - `sender_type`, `receiver_type` ('admin' | 'station' | 'responder' | 'citizen')
   - `text`, `image_url`
   - `is_emergency`, `is_read`
   - `report_id` (TEXT - optional link to fire report)
   - `ai_suggested_alarm` (JSONB) - AI analysis results
   - `suggested_alarm_level`, `ai_confidence`
   - `created_at`, `updated_at`

### Notifications

9. **`notifications`** (Unified)
   - `id` (UUID, PK)
   - `user_id`, `user_type` (polymorphic)
   - `title`, `message`
   - `type` ('fire_alert' | 'assignment' | 'system' | 'user_action' | 'emergency' | 'info')
   - `priority` ('low' | 'normal' | 'high' | 'urgent')
   - `is_read`, `related_report_id`
   - `created_at`, `updated_at`

10. **`responder_notifications`** (Legacy - responder-specific)
    - Similar structure but responder-focused

### Security

11. **`password_reset_codes`**
    - `id` (UUID, PK)
    - `email`, `code`, `user_table`
    - `expires_at`, `used`

12. **`pending_password_resets`**
    - Temporary password storage during reset flow

### Key Database Features

- **Polymorphic Relationships**: `messages`, `notifications`, `report_assignments` use type + ID pattern
- **Real-time Subscriptions**: Supabase channels for live updates
- **Row Level Security (RLS)**: Enabled on sensitive tables
- **Soft Deletes**: `status`, `active` fields instead of hard deletes
- **JSONB Storage**: For flexible data (coordinates, AI analysis, snapshots)

---

## 📦 Code Organization

### Mobile App Structure

```
mobile/app/
├── _layout.tsx              # Root layout, AuthProvider wrapper
├── index.tsx                # Splash → get-started redirect
│
├── Authentication/          # Auth flows
│   ├── login.jsx
│   ├── registration.jsx
│   ├── verificationCode.jsx
│   └── ForgotPassword/
│
├── Screens/                 # Main screen routers
│   ├── AdminScreen/
│   ├── StationScreen/
│   ├── RespondersScreen/
│   └── CitizenScreen/
│
├── [UserType]/              # User-specific features
│   ├── [UserType]Menu/      # Feature modules
│   ├── [UserType]Profile/   # Profile screens
│   └── [UserType]Header/    # Headers
│
├── components/              # Shared components
│   ├── AuthGuard.jsx        # Route protection
│   └── BackButtonHandler.jsx
│
├── config/                 # Configuration
│   ├── AuthContext.js       # Global auth state
│   ├── supabase.js         # Supabase client
│   ├── googleConfig.js
│   └── map.js
│
└── services/               # Business logic
    ├── aiService.js
    ├── citizenNotificationService.js
    ├── responderNotificationService.js
    └── universalNotificationService.js
```

### Web App Structure

```
Website/web/pfira-app/src/
├── App.jsx                  # React Router setup
├── main.jsx                 # Entry point
│
├── components/pages/
│   ├── admin/              # Admin pages
│   ├── stations/           # Station pages
│   ├── authentication/     # Login/Register
│   └── landingpage/        # Landing page
│
├── config/
│   └── supabase.js        # Supabase client
│
├── contexts/
│   └── NotificationContext.jsx  # Notification state
│
└── services/
    └── aiService.js        # AI integration
```

---

## 🔍 Key Components Analysis

### 1. **Authentication System**

**Location**: `mobile/app/config/AuthContext.js`

**Pattern**: React Context API with AsyncStorage persistence

**Key Features**:
- Multiple login methods: `loginAdmin()`, `loginCitizen()`, `loginStation()`, `loginResponder()`
- Password hashing with CryptoJS (SHA-256)
- Session persistence via AsyncStorage
- Loading state management with timeout safety

**Issues**:
- ⚠️ Hardcoded station credentials (`stations@gmail.com` / `stations`)
- ⚠️ Password hashing uses static salt (should be per-user)
- ⚠️ No token refresh mechanism

### 2. **Chat System**

**Mobile**: `mobile/app/Stations/StationsMenu/StationsChat/`

**Components**:
- `SFiraChat.jsx` - Contact list with search
- `SChatPage.jsx` - Individual chat interface

**Features**:
- Real-time messaging via Supabase subscriptions
- Message editing & deletion (local + for everyone)
- AI analysis integration (gated for responders/incidents)
- Incident context linking (`report_id`)
- Read receipts
- Unread count tracking

**Pattern**: 
- Supabase real-time channels: `messages:{senderId}:{receiverId}`
- Optimistic UI updates
- Auto-scroll to bottom

### 3. **Notification System**

**Architecture**: Unified `notifications` table with polymorphic user references

**Services**:
- `universalNotificationService.js` - Cross-user notifications
- `responderNotificationService.js` - Responder-specific
- `citizenNotificationService.js` - Citizen notifications

**Features**:
- Real-time subscriptions per user type
- Priority levels (urgent, high, normal, low)
- Type categorization (fire_alert, assignment, system, etc.)
- Mark as read/unread
- Filtering and sorting

**Implementation**:
- Web: `NotificationContext.jsx` for global state
- Mobile: Component-level subscriptions
- Auto-creation on events (report submission, assignments)

### 4. **Map Integration**

**Mobile**: `react-native-maps` with Google Maps
**Web**: `react-leaflet` with Leaflet

**Features**:
- Fire report markers
- User location tracking
- Assignment controls (Admin/Station)
- Real-time updates via Supabase

### 5. **AI Service Integration**

**Service URL**: `https://ai-alarm-analyzer.onrender.com/analyze-message`

**Flow**:
1. User sends message (responder or with incident context)
2. `aiService.js` calls external API
3. Response transformed to unified format
4. Stored in `messages.ai_suggested_alarm` (JSONB)
5. Updates `fire_reports.recommended_alarm_level` if linked

**Gating Logic**:
- Only analyzes messages from responders OR messages with `report_id`
- Prevents unnecessary API calls

---

## 🔄 State Management

### Mobile App

**Primary**: React Context API
- `AuthContext` - Authentication state
- Component-level state for UI
- AsyncStorage for persistence

**Pattern**:
```javascript
// Context Provider
<AuthProvider>
  <App />
</AuthProvider>

// Usage
const { isAuthenticated, userType, loginAdmin } = useAuth();
```

**Local State**:
- `useState` for component-specific data
- `useEffect` for side effects (subscriptions, data fetching)

### Web App

**Primary**: React Context + Component State
- `NotificationContext` - Global notification state
- Component-level state for UI

**Pattern**:
```javascript
<NotificationProvider>
  <App />
</NotificationProvider>
```

### Real-time State

**Supabase Subscriptions**:
```javascript
const channel = supabase
  .channel('messages:1:2')
  .on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
    // Update local state
  })
  .subscribe();
```

---

## 🧭 Routing & Navigation

### Mobile (Expo Router)

**File-based routing**:
- `app/_layout.tsx` - Root layout with Stack navigator
- `app/index.tsx` - Entry point
- `app/Screens/[UserType]Screen/index.jsx` - Main screens
- Nested routes via directory structure

**Navigation Flow**:
```
index.tsx (Splash)
  ↓
get-started/getstarted.jsx
  ↓
Authentication/login.jsx
  ↓
AuthGuard → Screens/[UserType]Screen
```

**Protection**: `AuthGuard.jsx` component checks authentication

### Web (React Router)

**Route Structure**:
```javascript
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/admin-dashboard" element={<AdminLayout />}>
    <Route index element={<Adashboard />} />
    <Route path="overall" element={<Overview />} />
    ...
  </Route>
  <Route path="/station-dashboard" element={<StationLayout />}>
    ...
  </Route>
</Routes>
```

**Layout Pattern**: Nested routes with layout components

---

## 🔌 Services & Integrations

### 1. **Supabase Integration**

**Configuration**: 
- URL: `https://wedqhsgrxnvbhklzhnet.supabase.co`
- Key: Stored in config files (⚠️ should be env variables)

**Usage**:
- Database queries
- Real-time subscriptions
- File storage (images)
- Authentication (partially)

### 2. **External APIs**

**Fire Detection API** (Railway):
- URL: `https://fire-detection-api-production-f55b.up.railway.app`
- Purpose: Fire report processing
- Endpoint: `/update_report_alarm_level`

**AI Analysis API** (Render):
- URL: `https://ai-alarm-analyzer.onrender.com/analyze-message`
- Purpose: Message analysis for alarm levels
- Method: POST with message text

**Google Maps API**:
- Geocoding
- Map rendering
- Location services

**EmailJS**:
- Email notifications
- Password reset emails

### 3. **AI Service** (Python/Flask)

**Location**: `Website/web/ai-service/`

**Components**:
- `app.py` - Flask application
- `message_poller.py` - Database polling for messages
- `config.py` - Configuration

**Functionality**:
- Polls `messages` table for unanalyzed messages
- Calls OpenAI/analysis service
- Updates message with analysis results

---

## 🎨 Styling Approach

### Mobile (NativeWind)

**Configuration**: `tailwind.config.js`
- Custom color: `fire: '#ff512f'`
- NativeWind preset for React Native

**Usage**:
```jsx
<View className="flex-1 bg-white px-4 py-2">
  <Text className="text-lg font-semibold text-gray-800">
    Title
  </Text>
</View>
```

**Pattern**: Utility-first CSS with Tailwind classes

### Web (Tailwind CSS v4)

**Version**: Latest (4.1.11) - as per user preference

**Configuration**: Via Vite plugin `@tailwindcss/vite`

**Usage**: Standard Tailwind utility classes

---

## 🔒 Security Considerations

### Current Security Measures

✅ **Row Level Security (RLS)**: Enabled on Supabase tables
✅ **Password Hashing**: SHA-256 with salt (CryptoJS)
✅ **Route Protection**: `AuthGuard` component
✅ **Session Storage**: AsyncStorage (mobile), sessionStorage (web)

### Security Issues

⚠️ **Hardcoded Credentials**:
- Station login: `stations@gmail.com` / `stations`
- Should use database authentication

⚠️ **API Keys in Code**:
- Supabase keys in source files
- Should use environment variables

⚠️ **Static Password Salt**:
- Same salt for all users
- Should be per-user unique salts

⚠️ **No Token Refresh**:
- No automatic token refresh mechanism
- Sessions may expire unexpectedly

⚠️ **Weak Password Validation**:
- Minimum 4 characters
- Should enforce stronger requirements

### Recommendations

1. Move all secrets to environment variables
2. Implement proper JWT token refresh
3. Use bcrypt for password hashing (instead of SHA-256)
4. Implement rate limiting
5. Add input sanitization
6. Implement CSRF protection (web)

---

## 📝 Code Quality & Patterns

### Strengths

✅ **Modular Organization**: Clear separation of concerns
✅ **Component Reusability**: Shared components in `components/`
✅ **Service Layer**: Business logic separated from UI
✅ **Real-time Updates**: Supabase subscriptions properly implemented
✅ **Error Handling**: Try-catch blocks in async functions
✅ **Loading States**: Loading indicators for async operations

### Patterns Used

1. **Container/Presenter Pattern**: Screens contain logic, components are presentational
2. **Context API**: Global state management
3. **Custom Hooks**: `useAuth()` for authentication
4. **Optimistic Updates**: UI updates before server confirmation
5. **Polymorphic Relationships**: Type + ID pattern in database

### Code Issues

⚠️ **Inconsistent Error Handling**:
- Some functions use try-catch, others use `.catch()`
- Error messages not always user-friendly

⚠️ **Code Duplication**:
- Similar chat components for each user type
- Could be abstracted into shared components

⚠️ **Limited TypeScript**:
- Mostly JavaScript files
- Type safety would improve maintainability

⚠️ **Magic Strings**:
- User types, statuses as strings
- Should use constants/enums

⚠️ **Console Logs**:
- Many `console.log` statements in production code
- Should use proper logging library

---

## 🚀 Areas for Improvement

### 1. **Code Organization**

**Current**: Good modular structure
**Improvements**:
- Extract shared chat components
- Create constants file for magic strings
- Standardize error handling patterns

### 2. **Type Safety**

**Current**: Mostly JavaScript
**Improvements**:
- Migrate to TypeScript gradually
- Add PropTypes or TypeScript interfaces
- Type-safe API calls

### 3. **Testing**

**Current**: No visible test files
**Improvements**:
- Unit tests for services
- Component tests
- Integration tests for critical flows
- E2E tests for user journeys

### 4. **Performance**

**Current**: Functional but could be optimized
**Improvements**:
- Implement React.memo for expensive components
- Lazy load routes
- Optimize image loading
- Implement pagination for large lists

### 5. **Documentation**

**Current**: Good markdown documentation
**Improvements**:
- JSDoc comments for functions
- API documentation
- Component documentation
- Architecture decision records (ADRs)

### 6. **Security**

**Current**: Basic security measures
**Improvements**:
- Environment variables for secrets
- Proper password hashing (bcrypt)
- Token refresh mechanism
- Input validation & sanitization
- Rate limiting

### 7. **Error Handling**

**Current**: Basic try-catch
**Improvements**:
- Error boundary components
- Centralized error logging
- User-friendly error messages
- Retry mechanisms for network failures

### 8. **State Management**

**Current**: Context API + local state
**Improvements**:
- Consider Zustand or Redux for complex state
- Normalize state structure
- Implement state persistence strategy

### 9. **Code Reusability**

**Current**: Some duplication
**Improvements**:
- Abstract chat components
- Create shared form components
- Extract common hooks
- Build component library

### 10. **CI/CD**

**Current**: Manual deployment
**Improvements**:
- Automated testing pipeline
- Automated deployment
- Code quality checks (ESLint, Prettier)
- Dependency updates

---

## 📊 Code Statistics

### File Count (Approximate)

- **Mobile App**: ~80+ component files
- **Web App**: ~30+ component files
- **Services**: 7 service files
- **SQL Scripts**: 25+ migration/setup files
- **Documentation**: 20+ markdown files

### Technology Distribution

- **React/React Native**: Primary framework
- **JavaScript**: ~95% of codebase
- **TypeScript**: ~5% (config files, some components)
- **Python**: AI service only
- **SQL**: Database setup/migrations

### Dependencies

- **Mobile**: 30+ npm packages
- **Web**: 15+ npm packages
- **AI Service**: 10+ Python packages

---

## 🎯 Conclusion

The FIRA system demonstrates a **well-structured, feature-rich emergency management application** with:

**Strengths**:
- Clear separation of concerns
- Real-time capabilities
- Multi-platform support
- Comprehensive feature set

**Priority Improvements**:
1. Security hardening (env variables, proper auth)
2. Code reusability (shared components)
3. Type safety (TypeScript migration)
4. Testing infrastructure
5. Performance optimization

The codebase is **maintainable and scalable** with room for improvement in security, testing, and code reusability.

---

**Analysis Completed**: January 2025  
**Next Steps**: Address security concerns, implement shared components, add testing infrastructure






