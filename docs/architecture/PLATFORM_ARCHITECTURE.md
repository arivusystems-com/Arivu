# Arivu Platform Architecture

**Version:** 2.0  
**Date:** January 2025  
**Status:** Production-Ready Multi-Application Platform

---

## Executive Summary

Arivu has evolved from a single-tenant CRM application into a **multi-application platform** that supports multiple distinct applications (CRM, Audit, Portal, LMS) running on a unified infrastructure. The platform architecture follows a **Platform Core + Apps** pattern where shared infrastructure is app-agnostic, and each application maintains clear boundaries.

### Key Architectural Principles

- ✅ **Platform Core First:** Shared infrastructure is app-agnostic
- ✅ **App Isolation:** Each app has its own routes, permissions, and business logic
- ✅ **App-Aware Security:** Permissions and entitlements are scoped by application
- ✅ **Backward Compatible:** Existing CRM functionality preserved
- ✅ **Event-Driven:** Domain events enable loose coupling between apps
- ✅ **License-Efficient:** Apps can operate independently with minimal licensing overhead

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Arivu Platform Core                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Authentication & Identity                                    │  │
│  │  - User Registration & Login (JWT)                           │  │
│  │  - Session Management                                        │  │
│  │  - Password Management                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Organization (Tenant) Management                            │  │
│  │  - Multi-tenancy Isolation                                   │  │
│  │  - Subscription Management                                   │  │
│  │  - App Enablement (enabledApps)                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App-Aware Permissions & Entitlements                        │  │
│  │  - User-Level: allowedApps                                  │  │
│  │  - Org-Level: enabledApps                                   │  │
│  │  - Role-Based: appPermissions                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App Context Resolution                                      │  │
│  │  - URL-based appKey resolution                              │  │
│  │  - Middleware chain integration                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Notification Infrastructure                                 │  │
│  │  - Domain Events System                                     │  │
│  │  - Notification Rules Engine                                │  │
│  │  - Multi-Channel Delivery                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │   CRM App     │  │  Audit App  │  │ Portal App  │
    │               │  │             │  │             │
    │ - Deals       │  │ - Assignments│ │ - Profile   │
    │ - Contacts    │  │ - Execution │ │ - Orders    │
    │ - Events      │  │ - Timeline  │ │ - Requests  │
    │ - Forms       │  │             │ │             │
    │ - Tasks       │  │ License-    │ │             │
    │ - Reports     │  │ Cheap       │ │             │
    │               │  │ Workspace   │ │             │
    │               │  │             │ │             │
    │ Execution     │  │ Proxy to    │ │             │
    │ Engine        │◄─┼── CRM       │ │             │
    └───────────────┘  └─────────────┘ └─────────────┘
```

---

## Platform Core Components

### 1. Authentication & Identity

**Purpose:** App-agnostic user authentication and identity management

**Components:**
- User registration and login (JWT-based)
- Password hashing (bcrypt)
- Token generation and verification
- Session management
- User profile management

**Files:**
- `server/controllers/authController.js`
- `server/middleware/authMiddleware.js`
- `server/models/User.js`
- `server/routes/authRoutes.js`

**Key Features:**
- JWT tokens with configurable expiration
- Refresh token support
- Security logging for auth events
- Multi-app support (user can access multiple apps)

---

### 2. Organization (Tenant) Management

**Purpose:** Multi-tenancy and organization-level configuration

**Components:**
- Organization creation and management
- Subscription management (trial, active, expired)
- App enablement (which apps are available)
- Usage limits and quotas
- Organization settings (timezone, currency, branding)

**Files:**
- `server/models/Organization.js`
- `server/controllers/organizationController.js`
- `server/middleware/organizationMiddleware.js`

**Key Fields:**
```javascript
{
  enabledApps: ['CRM', 'AUDIT', 'PORTAL'],  // App-level enablement
  enabledModules: [...],                      // Legacy CRM modules
  subscription: {
    status: 'trial' | 'active' | 'expired',
    tier: 'starter' | 'professional' | 'enterprise',
    trialStartDate: Date,
    trialEndDate: Date
  },
  limits: {
    maxUsers: Number,
    maxContacts: Number,
    maxStorageGB: Number
  }
}
```

**App Enablement Logic:**
- Organizations control which apps are available (`enabledApps`)
- Default: `['CRM']` for backward compatibility
- Apps not in `enabledApps` are inaccessible
- Both user entitlements AND org enablement must pass

---

### 3. App-Aware Permissions & Entitlements

**Purpose:** Scoped permissions that respect application boundaries

#### 3.1 User-Level Entitlements

**Field:** `User.allowedApps`

**Purpose:** Controls which applications a user can access

**Values:** `['CRM']`, `['AUDIT']`, `['CRM', 'PORTAL']`, etc.

**Example:**
```javascript
{
  _id: ObjectId,
  email: "auditor@example.com",
  allowedApps: ['AUDIT'],  // Can only access Audit App
  role: "auditor"
}
```

#### 3.2 Organization-Level Enablement

**Field:** `Organization.enabledApps`

**Purpose:** Controls which apps are available to the organization

**Values:** `['CRM']`, `['AUDIT', 'PORTAL']`, etc.

**Logic:**
- User must have app in `allowedApps` (user-level)
- Organization must have app in `enabledApps` (org-level)
- Both checks must pass for access

#### 3.3 Role-Based Permissions

**Field:** `Role.appPermissions` (Map structure)

**Purpose:** Permissions scoped by application

**Structure:**
```javascript
{
  appPermissions: {
    'CRM': {
      'contacts': { 'create': true, 'read': true, ... },
      'deals': { 'create': true, 'read': true, ... }
    },
    'PORTAL': {
      'profile': { 'read': true, 'update': true }
    }
  },
  // Legacy field (backward compatible)
  permissions: {
    // Treated as CRM-scoped
    'contacts': { ... },
    'deals': { ... }
  }
}
```

#### 3.4 Permission Checking Flow

```
User Request → App Context Resolution → Permission Check
    │                    │                      │
    │                    │                      ├─→ Is CRM module?
    │                    │                      │   Yes → Check appKey === 'CRM'
    │                    │                      │   No  → Continue
    │                    │                      │
    │                    │                      ├─→ Check user.allowedApps
    │                    │                      ├─→ Check org.enabledApps
    │                    │                      └─→ Check role permissions
    │                    │
    │                    └─→ Resolve appKey from URL
    │                        /api/deals → CRM
    │                        /audit/* → AUDIT
    │                        /portal/* → PORTAL
    │
    └─→ Authenticated request
```

**Middleware Chain:**
1. `protect` - Authentication
2. `resolveAppContext` - App context resolution
3. `requireAppEntitlement` - User & org app entitlements
4. `checkPermission` - Permission verification (app-aware)
5. `lazyCRMInitialization` - Lazy CRM module loading (if CRM app)

---

### 4. App Context Resolution

**Purpose:** Automatically determine which application a request belongs to

**Implementation:** `server/middleware/resolveAppContextMiddleware.js`

**Resolution Strategy:**
1. URL namespace mapping (highest priority)
2. Fallback to `DEFAULT_APP_KEY` (CRM)

**URL Mappings:**
```javascript
{
  '/api/audit': 'AUDIT',   // Must come before /api
  '/api/portal': 'PORTAL', // Must come before /api
  '/api/lms': 'LMS',       // Must come before /api
  '/app/crm': 'CRM',
  '/portal': 'PORTAL',
  '/audit': 'AUDIT',
  '/lms': 'LMS',
  '/api': 'CRM'            // Legacy default (lowest priority)
}
```

**Usage:**
- `req.appKey` is attached to all authenticated requests
- Used by permission middleware for app-aware checks
- Used by controllers for app-specific logic
- Logged for debugging and audit trails

**Example:**
```javascript
// Request: GET /api/deals
// Resolved: req.appKey = 'CRM'

// Request: GET /audit/assignments
// Resolved: req.appKey = 'AUDIT'

// Request: GET /portal/me
// Resolved: req.appKey = 'PORTAL'
```

---

### 5. Notification Infrastructure

**Purpose:** Event-driven notification system with rules engine

**Components:**
- Domain Events System
- Notification Rules Engine
- Multi-Channel Delivery (in-app, email, push)
- Notification Preferences

**Domain Events:**
- `contact.created`, `contact.updated`
- `deal.created`, `deal.stage_changed`
- `event.created`, `event.audit_state_changed`
- `form_response.submitted`
- Custom events from any module

**Notification Rules:**
- Triggered by domain events
- Rule-based matching (user, role, conditions)
- Multi-channel delivery
- Preference-aware routing

**Files:**
- `server/models/Notification.js`
- `server/models/NotificationRule.js`
- `server/models/NotificationPreference.js`
- `server/services/notificationService.js`
- `server/constants/domainEvents.js`

---

## Application Architecture

### CRM Application

**Purpose:** Full-featured Customer Relationship Management

**Access:** `allowedApps: ['CRM']`, `enabledApps: ['CRM']`

**Modules:**
- Contacts (People)
- Organizations (Companies)
- Deals (Sales Pipeline)
- Events (Calendar & Audits)
- Forms (Data Collection)
- Tasks
- Items (Products/Services)
- Reports
- Imports/Exports

**Routes:**
- `/api/contacts/*`
- `/api/deals/*`
- `/api/events/*`
- `/api/forms/*`
- `/api/tasks/*`
- `/api/items/*`
- `/api/reports/*`

**Key Features:**
- Execution engine for audit workflows
- Form builder and response management
- Comprehensive reporting
- Multi-instance deployment support

**Execution Model:**
- CRM is the **execution engine** for audit workflows
- Audit App proxies execution requests to CRM
- All business logic and state machines in CRM
- Audit App provides workspace only

---

### Audit Application

**Purpose:** License-cheap auditor workspace for executing audits

**Access:** `allowedApps: ['AUDIT']`, `enabledApps: ['AUDIT']`

**Architecture Pattern:** Workspace + Proxy

**Components:**
- Audit Assignment Management
- Execution Context Tracking
- Timeline Visualization
- Execution Proxy (calls CRM internally)

**Routes:**
- `/audit/assignments/*` - Read-only assignment APIs
- `/audit/execute/*` - Execution proxy endpoints
- `/audit/me`, `/audit/org`, `/audit/health` - Info endpoints

**Key Features:**
- ✅ **License-Cheap:** No CRM licenses required
- ✅ **Security:** No CRM data exposure
- ✅ **Simplicity:** Audit-specific UI only
- ✅ **Ownership-Based:** Only event owner can execute

**Sync Pattern: One-Way (CRM → Audit App)**

```
CRM Event Created/Updated
    │
    ├─→ Post-Save Hook
    │   └─→ auditSyncService.syncAuditAssignmentFromEvent()
    │       ├─→ Creates/Updates AuditAssignment
    │       ├─→ Creates AuditTimeline entry
    │       └─→ Updates AuditExecutionContext
    │
    └─→ Audit App Reads (Cache)
        └─→ Auditor sees assignment in workspace
```

**Execution Flow:**
```
Auditor → POST /audit/execute/:eventId/check-in
    │
    ├─→ auditExecutionController.checkInAudit()
    │   ├─→ Validate ownership (eventOwnerId === userId)
    │   ├─→ Call CRM checkIn() (internal function call)
    │   │   ├─→ Update Event.checkIn
    │   │   ├─→ Set auditState = 'checked_in'
    │   │   └─→ Create FormResponse (if linked form)
    │   │
    │   ├─→ Update AuditExecutionContext
    │   └─→ Sync (via hook + explicit call)
    │       ├─→ Update AuditAssignment.auditState
    │       └─→ Create AuditTimeline entry
    │
    └─→ Response: { event, executionContext }
```

**Data Models:**
- `AuditAssignment` - Read-only cache of Event data
- `AuditTimeline` - Read-only history of audit actions
- `AuditExecutionContext` - UX state tracking

**Security:**
- Ownership-based authorization only
- No CRM permissions required
- No role-based checks
- Event owner (`eventOwnerId`) = execution authority

**Guardrails:**
- Kill switch: `AUDIT_SYNC_ENABLED` environment variable
- Reverse sync prevention (hard boundary)
- Non-blocking errors (CRM execution continues even if sync fails)

---

### Portal Application

**Purpose:** Customer/Partner self-service portal

**Access:** `allowedApps: ['PORTAL']`, `enabledApps: ['PORTAL']`

**Components:**
- Profile Management
- Order Management
- Request Submissions
- Document Access

**Routes:**
- `/portal/me` - User profile
- `/portal/org` - Organization info
- `/portal/orders/*` - Order management
- `/portal/requests/*` - Request submissions

**Key Features:**
- Self-service interface
- Limited access to CRM data
- Portal-specific permissions
- Customer-facing workflows

---

### LMS Application (Future)

**Purpose:** Learning Management System

**Access:** `allowedApps: ['LMS']`, `enabledApps: ['LMS']`

**Status:** Defined in constants, implementation pending

---

## Security Architecture

### Multi-Layer Security Model

#### Layer 1: Authentication
- JWT-based authentication
- Token expiration and refresh
- Password hashing (bcrypt)
- Session management

#### Layer 2: App Entitlements
- User-level: `allowedApps` check
- Org-level: `enabledApps` check
- Both must pass for access

#### Layer 3: App Context
- URL-based app context resolution
- Prevents app confusion
- Ensures requests routed correctly

#### Layer 4: Permissions
- App-aware permission checks
- CRM modules blocked from non-CRM apps
- Role-based access control
- Ownership-based access (for Audit App)

#### Layer 5: Business Logic
- Additional validation in controllers
- Data filtering by ownership
- Audit logging

### Permission Enforcement Points

**Frontend:**
- Navigation menu filtering (hides unauthorized modules)
- Route guards (blocks direct URL access)
- Component-level checks (hides UI elements)

**Backend:**
- Middleware chain (multiple checkpoints)
- Controller-level validation
- Database query filtering (organizationId, ownership)

---

## Data Flow Patterns

### Pattern 1: CRM Execution (Standard)

```
CRM User → POST /api/events/:id/check-in
    │
    ├─→ CRM Controller
    │   ├─→ Permission Check (CRM app)
    │   ├─→ Business Logic
    │   ├─→ State Machine Update
    │   └─→ Database Write
    │
    └─→ Response
```

### Pattern 2: Audit App Proxy Execution

```
Audit User → POST /audit/execute/:id/check-in
    │
    ├─→ Audit Execution Controller
    │   ├─→ Ownership Check (eventOwnerId)
    │   ├─→ Call CRM Controller (internal)
    │   │   ├─→ Business Logic
    │   │   ├─→ State Machine Update
    │   │   └─→ Database Write
    │   │
    │   ├─→ Update Audit App Models (sync)
    │   └─→ Create Timeline Entry
    │
    └─→ Response
```

### Pattern 3: Event-Driven Sync

```
CRM Event Updated
    │
    ├─→ Post-Save Hook Triggered
    │   └─→ auditSyncService.syncAuditAssignmentFromEvent()
    │       ├─→ Check AUDIT_SYNC_ENABLED
    │       ├─→ Check reverse sync guard (prevent Audit → CRM)
    │       ├─→ Update AuditAssignment
    │       ├─→ Create AuditTimeline entry (if state changed)
    │       └─→ Log (non-blocking errors)
    │
    └─→ CRM Execution Continues (unaffected)
```

### Pattern 4: Domain Event Notification

```
Business Action (e.g., Deal Stage Changed)
    │
    ├─→ Domain Event Emitted
    │   └─→ 'deal.stage_changed' event
    │
    ├─→ Notification Service
    │   ├─→ Match Notification Rules
    │   │   ├─→ Rule: "Notify deal owner on stage change"
    │   │   └─→ Rule: "Notify admin on closed won"
    │   │
    │   ├─→ Check User Preferences
    │   │   └─→ Filter channels (in-app, email, push)
    │   │
    │   └─→ Deliver Notifications
    │       ├─→ Create Notification records
    │       ├─→ Send Email (if enabled)
    │       └─→ Send Push (if enabled)
    │
    └─→ Users receive notifications
```

---

## Deployment Architecture

### Multi-Instance Deployment Model

**Approach:** Separate Instance Per Organization

**Components:**
- Master Control Plane (platform management)
- Customer Instances (isolated deployments)

**Per Organization:**
- Dedicated Database (MongoDB)
- Dedicated Application Server (Node.js)
- Dedicated Frontend (Vue.js)
- Unique Subdomain (e.g., `acme.arivu.com`)
- Isolated Resources (CPU, Memory, Storage)

**Provisioning Flow:**
1. Demo Request submitted
2. Admin reviews in control plane
3. Admin clicks "Convert to Instance"
4. Automated provisioning:
   - Generate unique subdomain
   - Create isolated database
   - Deploy containerized application
   - Configure SSL certificate
   - Set up DNS routing
   - Initialize with owner credentials
5. Instance active and monitored

**Benefits:**
- Complete data isolation
- Performance isolation
- Custom branding per instance
- Compliance and security
- Independent scaling

---

## Key Architectural Patterns

### 1. Platform Core + Apps Pattern

**Principle:** Shared infrastructure is app-agnostic

**Benefits:**
- Clear separation of concerns
- Apps can evolve independently
- Platform core remains stable
- Easy to add new apps

**Implementation:**
- Platform Core: Authentication, Organization, Permissions, Notifications
- Apps: CRM, Audit, Portal, LMS (each with own routes, controllers, models)

---

### 2. App-Aware Security Pattern

**Principle:** Permissions and entitlements are scoped by application

**Benefits:**
- Prevents cross-app data access
- Clear security boundaries
- Backward compatible
- Future-proof for new apps

**Implementation:**
- User-level: `allowedApps`
- Org-level: `enabledApps`
- Role-level: `appPermissions`
- Middleware: App context resolution + permission checks

---

### 3. Proxy Pattern (Audit App)

**Principle:** Lightweight app proxies execution to core app

**Benefits:**
- License-cheap workspace
- No duplicate business logic
- Single source of truth
- Consistent state management

**Implementation:**
- Audit App provides workspace UI
- Execution requests proxy to CRM
- CRM remains execution engine
- One-way sync keeps Audit App in sync

---

### 4. Event-Driven Sync Pattern

**Principle:** One-way data sync via domain events

**Benefits:**
- Loose coupling
- Non-blocking
- Resilient (errors don't affect source)
- Auditable

**Implementation:**
- Post-save hooks emit events
- Sync service listens to events
- Updates read-only cache models
- Kill switch for emergency rollback

---

### 5. Lazy Initialization Pattern

**Principle:** Initialize app modules only when needed

**Benefits:**
- Faster startup
- Reduced memory footprint
- Only load what's used
- Better scalability

**Implementation:**
- `lazyCRMInitializationMiddleware`
- Checks app enablement before initializing
- Loads CRM modules on first access
- Caches for subsequent requests

---

## Backward Compatibility Strategy

### Legacy Support

**Challenge:** Existing CRM deployments must continue working

**Solution:** Backward compatibility at every layer

**1. App Context:**
- `/api/*` routes default to CRM (legacy)
- New routes use explicit namespaces
- Existing routes unchanged

**2. Permissions:**
- Legacy `permissions` field treated as CRM-scoped
- New `appPermissions` field for multi-app
- Permission checks fall back to legacy

**3. Organization:**
- Legacy `enabledModules` supported
- New `enabledApps` defaults to `['CRM']`
- `hasFeature()` maps CRM modules to CRM app

**4. Registration:**
- New orgs get `enabledApps: ['CRM']`
- Legacy orgs default to `['CRM']`
- No breaking changes

---

## Performance Considerations

### Database Optimization

- Indexes on frequently queried fields:
  - `organizationId` on all collections
  - `email` on Users and Contacts
  - `status`, `assignedTo`, `createdAt` on various models
- Compound indexes for common queries
- Pagination on all list endpoints

### Caching Strategy

- User sessions (JWT tokens)
- Organization settings
- Permission lookups
- Frequently accessed lists

### Lazy Loading

- CRM modules initialized on demand
- Frontend code splitting per app
- Route-based chunking

---

## Monitoring & Observability

### Logging

**App Context Logging:**
- Every authenticated request logs `appKey`
- Format: `[AppContext] appKey=CRM path=/api/deals userId=...`

**Security Logging:**
- Auth events (login, logout, failed attempts)
- Permission denials
- Suspicious activity

**Audit Execution Logging:**
- All audit execution actions logged
- Format: `[AuditExecute] action=CHECK_IN eventId=... auditorId=...`

### Health Checks

- `/api/health` - Platform health
- `/audit/health` - Audit App health
- `/portal/health` - Portal App health

### Metrics

- API response times
- Error rates
- Permission check failures
- App context resolution
- Sync operations

---

## Future Enhancements

### Planned Features

1. **LMS Application**
   - Full Learning Management System
   - Course management
   - Student tracking

2. **Enhanced Portal**
   - Payment integration
   - Document sharing
   - Collaboration features

3. **Platform-Level Features**
   - Single Sign-On (SSO)
   - API Gateway
   - Webhook system
   - GraphQL API

4. **Advanced Sync**
   - Real-time sync (WebSockets)
   - Conflict resolution
   - Bi-directional sync (where needed)

---

## Migration Guide

### For Existing CRM Organizations

**No Action Required:**
- Existing orgs automatically get `enabledApps: ['CRM']` (default)
- All existing functionality preserved
- No breaking changes

**Optional Upgrades:**
- Enable Audit App: Add `'AUDIT'` to `enabledApps`
- Enable Portal App: Add `'PORTAL'` to `enabledApps`
- Assign users to apps: Update `allowedApps` on users

### For New Apps

**Step 1:** Define app in constants
```javascript
// server/constants/appKeys.js
const APP_KEYS = {
    CRM: 'CRM',
    AUDIT: 'AUDIT',
    PORTAL: 'PORTAL',
    NEW_APP: 'NEW_APP'  // Add new app
};
```

**Step 2:** Add URL namespace mapping
```javascript
// server/middleware/resolveAppContextMiddleware.js
const URL_NAMESPACE_MAP = {
    '/new-app': APP_KEYS.NEW_APP,
    // ... existing mappings
};
```

**Step 3:** Create app routes
```javascript
// server/routes/newAppRoutes.js
router.get('/new-app/endpoint', requireAppEntitlement('NEW_APP'), controller);
```

**Step 4:** Create app models/controllers
- Follow app-specific folder structure
- Use app-aware middleware
- Implement app-specific business logic

---

## Summary

The Arivu Platform Architecture successfully:

✅ **Supports Multiple Applications** on unified infrastructure  
✅ **Maintains App Isolation** with clear boundaries  
✅ **Provides App-Aware Security** at every layer  
✅ **Enables License-Efficient Apps** (Audit App pattern)  
✅ **Preserves Backward Compatibility** for existing deployments  
✅ **Scales Independently** per organization and app  
✅ **Event-Driven Architecture** for loose coupling  

**Status:** ✅ Production-Ready  
**Breaking Changes:** None  
**Backward Compatibility:** 100% maintained  
**Enterprise Ready:** Yes

---

**Last Updated:** January 2025  
**Audience:** Engineers, Architects, Product Managers, Enterprise Buyers  
**Document Version:** 2.0

