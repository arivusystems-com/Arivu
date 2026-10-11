# Arivu Platform Architecture

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Living Document  
**Type:** Comprehensive Architecture Documentation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Architectural Patterns](#core-architectural-patterns)
4. [Technology Stack](#technology-stack)
5. [Platform Core Architecture](#platform-core-architecture)
6. [Application Architecture](#application-architecture)
7. [Module Architecture](#module-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Backend Architecture](#backend-architecture)
10. [Data Models](#data-models)
11. [API Architecture](#api-architecture)
12. [Security Architecture](#security-architecture)
13. [Deployment Architecture](#deployment-architecture)
14. [Settings/Surfaces/Work Separation](#settingssurfaceswork-separation)
15. [Change Log](#change-log)

---

## Executive Summary

Arivu is a **multi-application platform** that supports multiple distinct applications (Sales, Audit, Portal, LMS) running on unified infrastructure. The platform follows a **Platform Core + Apps** pattern where shared infrastructure is app-agnostic, and each application maintains clear boundaries.

### Key Architectural Principles

- ✅ **Platform Core First:** Shared infrastructure is app-agnostic
- ✅ **App Isolation:** Each app has its own routes, permissions, and business logic
- ✅ **App-Aware Security:** Permissions and entitlements are scoped by application
- ✅ **Settings/Surfaces/Work Separation:** Clear boundaries between configuration, navigation, and execution
- ✅ **Backward Compatible:** Existing Sales functionality preserved (formerly CRM)
- ✅ **Event-Driven:** Domain events enable loose coupling between apps
- ✅ **License-Efficient:** Apps can operate independently with minimal licensing overhead

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Arivu Platform Core                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Authentication & Identity                                    │  │
│  │  Organization (Tenant) Management                            │  │
│  │  App-Aware Permissions & Entitlements                        │  │
│  │  App Context Resolution                                      │  │
│  │  Notification Infrastructure                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │  Sales App    │  │  Audit App  │  │ Portal App  │
    │               │  │             │  │             │
    │ - Deals       │  │ - Assignments│ │ - Profile   │
    │ - Contacts    │  │ - Execution │ │ - Orders    │
    │ - Events      │  │ - Timeline  │ │ - Requests  │
    │ - Forms       │  │             │ │             │
    │ - Tasks       │  │ License-    │ │             │
    │ - Reports     │  │ Cheap       │ │             │
    │               │  │ Workspace   │ │             │
    │ Execution     │  │ Proxy to    │ │             │
    │ Engine        │◄─┼── Sales     │ │             │
    └───────────────┘  └─────────────┘ └─────────────┘
```

### Deployment Model

**Multi-Instance Architecture:** Each organization gets a dedicated instance with:
- Dedicated Database (MongoDB)
- Dedicated Application Server (Node.js + Express)
- Dedicated Frontend (Vue.js)
- Unique Subdomain (e.g., `acme.arivu.com`)
- Isolated Resources (CPU, Memory, Storage)

---

## Core Architectural Patterns

### 1. Platform Core + Apps Pattern

**Principle:** Shared infrastructure is app-agnostic.

**Components:**
- **Platform Core:** Authentication, Organization Management, Permissions, Notifications
- **Applications:** Sales, Audit, Portal, LMS (each with own routes, controllers, models)

**Benefits:**
- Clear separation of concerns
- Apps can evolve independently
- Platform core remains stable
- Easy to add new apps

### 2. Settings/Surfaces/Work Separation

**Principle:** Three distinct interaction modes with clear boundaries.

#### Settings
- **Purpose:** Configure module behavior, structure, and presentation rules
- **What:** Configuration interfaces for module metadata, field definitions, layouts, relationships
- **What NOT:** Data browsing, record lists, execution actions
- **Location:** `/settings` with left navigation and right panel layout

#### Surfaces
- **Purpose:** User-facing interfaces for discovering, viewing, and navigating data
- **What:** List views, detail views, search interfaces, inbox aggregation
- **What NOT:** Configuration interfaces, settings panels
- **Location:** App-specific routes (e.g., `/people`, `/organizations`, `/inbox`)

#### Work
- **Purpose:** Business objects and records that represent actual work being done
- **What:** Deals, Tickets, Audits, Projects, Events with lifecycle states
- **What NOT:** Configuration metadata, settings definitions
- **Location:** Module-specific routes within app contexts

**Mental Model:**
```
Settings → Define structure and behavior
Surfaces → Navigate and view data
Work → Execute business processes
```

**Reference:** See `module-settings-doctrine.md` for detailed specifications.

### 3. App-Aware Security Pattern

**Principle:** Permissions and entitlements are scoped by application.

**Layers:**
1. **User-Level:** `User.allowedApps` - Controls which apps a user can access
2. **Org-Level:** `Organization.enabledApps` - Controls which apps are available
3. **Role-Level:** `Role.appPermissions` - Permissions scoped by application
4. **Middleware:** App context resolution + permission checks

**Enforcement:**
- URL-based app context resolution
- Multi-layer entitlement checks
- App-aware permission middleware
- Ownership-based access (for Audit App)

### 4. Proxy Pattern (Audit App)

**Principle:** Lightweight app proxies execution to core app.

**Implementation:**
- Audit App provides workspace UI
- Execution requests proxy to Sales App
- Sales App remains execution engine
- One-way sync keeps Audit App in sync

**Benefits:**
- License-cheap workspace
- No duplicate business logic
- Single source of truth
- Consistent state management

### 5. Event-Driven Sync Pattern

**Principle:** One-way data sync via domain events.

**Flow:**
```
Sales App Event Updated
    │
    ├─→ Post-Save Hook Triggered
    │   └─→ auditSyncService.syncAuditAssignmentFromEvent()
    │       ├─→ Update AuditAssignment
    │       ├─→ Create AuditTimeline entry
    │       └─→ Log (non-blocking errors)
    │
    └─→ Sales App Execution Continues (unaffected)
```

**Benefits:**
- Loose coupling
- Non-blocking
- Resilient (errors don't affect source)
- Auditable

---

## Technology Stack

### Frontend
- **Framework:** Vue 3 (Composition API)
- **Router:** Vue Router 4
- **State Management:** Pinia
- **Build Tool:** Vite
- **Styling:** Tailwind CSS 4
- **UI Components:** Headless UI, Heroicons
- **Calendar:** FullCalendar
- **Charts:** Chart.js
- **TypeScript:** Yes (gradual migration)

### Backend
- **Runtime:** Node.js (v20.19.0+ or v22.12.0+)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **Validation:** Mongoose schema validation

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Kubernetes (Helm charts)
- **Deployment:** Multi-instance per organization
- **Monitoring:** Health checks, logging, metrics

---

## Platform Core Architecture

### 1. Authentication & Identity

**Purpose:** App-agnostic user authentication and identity management.

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

### 2. Organization (Tenant) Management

**Purpose:** Multi-tenancy and organization-level configuration.

**Components:**
- Organization creation and management
- Subscription management (trial, active, expired)
- App enablement (which apps are available)
- Usage limits and quotas
- Organization settings (timezone, currency, branding)

**Key Fields:**
```javascript
{
  enabledApps: ['SALES', 'AUDIT', 'PORTAL'],  // App-level enablement
  enabledModules: [...],                      // Legacy Sales modules (deprecated)
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
  },
  isTenant: Boolean  // true for tenant orgs, false for business orgs
}
```

### 3. App Context Resolution

**Purpose:** Automatically determine which application a request belongs to.

**Implementation:** `server/middleware/resolveAppContextMiddleware.js`

**Resolution Strategy:**
1. URL namespace mapping (highest priority)
2. Fallback to `DEFAULT_APP_KEY` (SALES)

**URL Mappings:**
```javascript
{
  '/api/audit': 'AUDIT',
  '/api/portal': 'PORTAL',
  '/api/lms': 'LMS',
  '/app/sales': 'SALES',
  '/portal': 'PORTAL',
  '/audit': 'AUDIT',
  '/lms': 'LMS',
  '/api': 'SALES'  // Default (Sales App)
}
```

**Usage:**
- `req.appKey` is attached to all authenticated requests
- Used by permission middleware for app-aware checks
- Used by controllers for app-specific logic

### 4. Notification Infrastructure

**Purpose:** Event-driven notification system with rules engine.

**Components:**
- Domain Events System
- Notification Rules Engine
- Multi-Channel Delivery (in-app, email, push, SMS, WhatsApp)
- Notification Preferences

**Domain Events:**
- `contact.created`, `contact.updated`
- `deal.created`, `deal.stage_changed`
- `event.created`, `event.audit_state_changed`
- `form_response.submitted`
- Custom events from any module

**Files:**
- `server/models/Notification.js`
- `server/models/NotificationRule.js`
- `server/models/NotificationPreference.js`
- `server/services/notificationEngine.js`
- `server/constants/domainEvents.js`

**Reference:** See `notifications-architecture.md` for detailed specifications.

---

## Application Architecture

### Sales Application

**Purpose:** Full-featured Sales CRM application (formerly known as CRM).

**Access:** `allowedApps: ['SALES']`, `enabledApps: ['SALES']`

**Note:** This application was formerly called "CRM" but has been renamed to "Sales" to better reflect its purpose. Legacy references to "CRM" in code comments and documentation may still exist for backward compatibility.

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
- Sales App is the **execution engine** for audit workflows
- Audit App proxies execution requests to Sales App
- All business logic and state machines in Sales App
- Audit App provides workspace only

### Audit Application

**Purpose:** License-cheap auditor workspace for executing audits.

**Access:** `allowedApps: ['AUDIT']`, `enabledApps: ['AUDIT']`

**Architecture Pattern:** Workspace + Proxy

**Components:**
- Audit Assignment Management
- Execution Context Tracking
- Timeline Visualization
- Execution Proxy (calls Sales App internally)

**Routes:**
- `/audit/assignments/*` - Read-only assignment APIs
- `/audit/execute/*` - Execution proxy endpoints
- `/audit/me`, `/audit/org`, `/audit/health` - Info endpoints

**Key Features:**
- ✅ **License-Cheap:** No Sales App licenses required
- ✅ **Security:** No Sales App data exposure
- ✅ **Simplicity:** Audit-specific UI only
- ✅ **Ownership-Based:** Only event owner can execute

**Sync Pattern:** One-Way (Sales App → Audit App)

**Data Models:**
- `AuditAssignment` - Read-only cache of Event data
- `AuditTimeline` - Read-only history of audit actions
- `AuditExecutionContext` - UX state tracking

**Security:**
- Ownership-based authorization only
- No Sales App permissions required
- No role-based checks
- Event owner (`eventOwnerId`) = execution authority

### Portal Application

**Purpose:** Customer/Partner self-service portal.

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
- Limited access to Sales App data
- Portal-specific permissions
- Customer-facing workflows

### LMS Application (Future)

**Purpose:** Learning Management System.

**Status:** Defined in constants, implementation pending.

---

## Module Architecture

### Core Modules

Core modules are platform-owned capabilities shared across applications:

#### People (Contacts)
- **Settings Location:** `/settings?tab=core-modules&moduleKey=people`
- **Canonical Implementation:** Yes (reference implementation)
- **Fields:** Identity fields (name, email, phone) + Participation fields (app-specific)
- **Relationships:** People ↔ Organizations, People ↔ Work
- **Reference:** `people-surface-invariants.md`, `module-settings-doctrine.md`

#### Organizations
- **Settings Location:** `/settings?tab=core-modules&moduleKey=organizations`
- **Dual Purpose:** Tenant organizations (`isTenant: true`) + Business organizations (`isTenant: false`)
- **Fields:** Core business fields + App participation fields
- **Types:** Customer, Partner, Vendor, Distributor, Dealer
- **Reference:** `organization-settings.md`, `organization-surface-invariants.md`

#### Events
- **Settings Location:** `/settings?tab=core-modules&moduleKey=events`
- **Types:** Meeting/Appointment, Internal Audit, External Audit (Single Org), External Audit Beat, Field Sales Beat
- **Lifecycle:** Status (Planned, Completed, Cancelled) + Audit State (for audit events)
- **Roles:** Event Owner, Auditor, Reviewer, Corrective Owner
- **Reference:** `event-settings.md`, [`EVENT_MODEL_COMPLETE.md`](./EVENT_MODEL_COMPLETE.md)

#### Tasks
- **Settings Location:** `/settings?tab=core-modules&moduleKey=tasks`
- **Status Picklist:** todo, in_progress, waiting, completed (system-locked), cancelled
- **Priority Picklist:** low, medium (default), high, urgent
- **Relationships:** Task ↔ People, Task ↔ Organization, Task ↔ Event
- **Reference:** `task-settings.md`

#### Forms
- **Settings Location:** `/settings?tab=core-modules&moduleKey=forms`
- **Purpose:** Data collection and response management
- **Features:** Form builder, response immutability, scoring
- **Note:** Forms do not have Quick Create (forms are the quick create mechanism)

### Application Modules

Application modules are app-specific work objects:

#### Deals (Sales)
- **Settings Location:** `/settings?tab=applications&appKey=SALES&moduleKey=deals`
- **Features:** Pipeline Settings (stages, automation), Playbook Configuration
- **Lifecycle:** Stage-based pipeline with automation rules

#### Cases (Helpdesk)
- **Settings Location:** `/settings?tab=applications&appKey=HELPDESK&moduleKey=cases`
- **Features:** SLA management, status workflows
- **Lifecycle:** Status-based workflow with SLA tracking

---

## Frontend Architecture

### Structure

```
client/src/
├── components/        # Vue components
│   ├── common/        # Shared components
│   ├── dashboard/     # Dashboard components
│   ├── events/        # Event-specific components
│   ├── organizations/ # Organization components
│   └── settings/      # Settings components
├── views/             # Page-level components
├── router/            # Vue Router configuration
│   ├── index.js       # Main router
│   ├── audit.routes.js # Audit app routes
│   └── portal.routes.js # Portal app routes
├── stores/            # Pinia stores
├── services/          # API clients and services
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
└── composables/       # Vue composables
```

### Routing

**App-Based Routing:**
- `/dashboard/:appKey` - App-specific dashboards
- `/audit/*` - Audit app routes
- `/portal/*` - Portal app routes
- `/settings` - Settings (app-agnostic)
- `/inbox` - Inbox surface (app-agnostic)

**Dynamic Route Loading:**
- Routes loaded based on app enablement
- Permission-aware route registration
- Lazy loading for app-specific routes

### State Management

**Pinia Stores:**
- `auth` - Authentication state
- `user` - User profile and preferences
- `organization` - Organization context
- `notifications` - Notification state

### Component Patterns

**Settings Components:**
- `CoreModuleDetail.vue` - Wrapper for module settings
- `ModulesAndFields.vue` - Field configuration interface
- Consistent layout: Left nav + Right panel with tabs

**Surface Components:**
- List views with filtering and pagination
- Detail views with relationship navigation
- Search interfaces with global search

**Work Components:**
- Form modals for creation/editing
- Execution interfaces for workflow actions
- Status transition controls

---

## Backend Architecture

### Structure

```
server/
├── controllers/      # Request handlers
├── models/           # Mongoose schemas
├── routes/           # Express routes
├── middleware/       # Express middleware
│   ├── authMiddleware.js
│   ├── resolveAppContextMiddleware.js
│   ├── requireAppEntitlement.js
│   └── checkPermission.js
├── services/         # Business logic services
│   ├── notificationEngine.js
│   ├── auditSyncService.js
│   └── relationshipResolver.js
├── constants/        # Constants and enums
└── utils/            # Utility functions
```

### Middleware Chain

**Request Flow:**
```
Request
  ↓
protect (Authentication)
  ↓
resolveAppContext (App context resolution)
  ↓
requireAppEntitlement (User & org app entitlements)
  ↓
checkPermission (Permission verification)
  ↓
lazySalesInitialization (Lazy Sales module loading, if Sales app)
  ↓
Controller Handler
```

### Controller Pattern

**Standard Controller Structure:**
```javascript
exports.create = async (req, res) => {
  // 1. Validate input
  // 2. Check permissions (already done by middleware)
  // 3. Business logic
  // 4. Database operations
  // 5. Emit domain events
  // 6. Return response
};
```

### Service Layer

**Purpose:** Business logic separation from controllers.

**Services:**
- `notificationEngine.js` - Notification delivery
- `auditSyncService.js` - Audit app sync
- `relationshipResolver.js` - Relationship resolution
- `searchService.js` - Global search
- `reportGenerationService.js` - Report generation

---

## Data Models

### Core Models

#### User
```javascript
{
  email: String (unique, required),
  password: String (hashed),
  organizationId: ObjectId (required),
  allowedApps: [String],  // ['SALES', 'AUDIT', 'PORTAL']
  role: ObjectId (ref: 'Role'),
  // ... other fields
}
```

#### Organization
```javascript
{
  name: String (required),
  slug: String (unique),
  isTenant: Boolean (default: false),
  
  // Tenant fields (isTenant: true)
  enabledApps: [String],
  subscription: { status, tier, ... },
  limits: { maxUsers, ... },
  
  // Business fields (isTenant: false)
  types: [String],  // ['Customer', 'Partner', ...]
  customerStatus: String,
  // ... other business fields
}
```

#### People
```javascript
{
  organizationId: ObjectId (required),
  first_name: String (required),
  last_name: String,
  email: String,
  phone: String,
  organization: ObjectId (ref: 'Organization'),  // Business org, not tenant
  type: String,  // 'Lead' | 'Contact'
  lead_status: String,  // Sales app participation
  contact_status: String,  // Sales app participation
  // ... other fields
}
```

#### Event
```javascript
{
  organizationId: ObjectId (required),
  eventName: String (required),
  eventType: String,  // 'Meeting', 'Internal Audit', ...
  eventOwnerId: ObjectId (required),
  startDateTime: Date (required),
  endDateTime: Date (required),
  status: String,  // 'Planned', 'Completed', 'Cancelled'
  auditState: String,  // For audit events
  auditorId: ObjectId,  // For audit events
  reviewerId: ObjectId,  // For external audits
  correctiveOwnerId: ObjectId,  // For audit events
  linkedFormId: ObjectId,  // Form linking
  // ... other fields
}
```

#### Task
```javascript
{
  organizationId: ObjectId (required),
  title: String (required),
  assignedTo: ObjectId (required),
  status: String,  // 'todo', 'in_progress', 'completed', ...
  priority: String,  // 'low', 'medium', 'high', 'urgent'
  dueDate: Date,
  // ... other fields
}
```

### Relationship Models

#### RelationshipDefinition
**Purpose:** Metadata defining relationships between modules.

```javascript
{
  sourceModule: String,  // 'people', 'organizations', 'events'
  targetModule: String,
  relationshipType: String,  // 'many-to-many', 'one-to-many'
  label: String,
  // ... other metadata
}
```

#### RelationshipInstance
**Purpose:** Runtime data representing actual relationships between records.

```javascript
{
  organizationId: ObjectId (required),
  sourceModule: String,
  sourceRecordId: ObjectId,
  targetModule: String,
  targetRecordId: ObjectId,
  metadata: Object,  // Additional relationship data
  // ... other fields
}
```

### Field Ownership Model

**Three-Tier Ownership:**

1. **Core Fields** (`owner: 'core'`, `fieldScope: 'CORE'`)
   - Platform-owned, shared across apps
   - Examples: `first_name`, `email`, `name`

2. **App Participation Fields** (`owner: 'participation'`, `fieldScope: 'SALES' | 'HELPDESK' | ...`)
   - App-specific fields
   - Examples: `lead_status`, `customerStatus`

3. **System Fields** (`owner: 'system'`, `fieldScope: 'CORE'`)
   - System-managed fields
   - Examples: `createdAt`, `organizationId`, `_id`

**Reference:** See `field-model.md` for detailed specifications.

---

## API Architecture

### RESTful API Design

**Base URL:** `/api` (Sales App) or `/audit`, `/portal` (app-specific)

**Standard Endpoints:**
- `GET /api/{module}` - List records (with pagination, filtering)
- `GET /api/{module}/:id` - Get single record
- `POST /api/{module}` - Create record
- `PUT /api/{module}/:id` - Update record
- `DELETE /api/{module}/:id` - Delete record

### App-Aware Routing

**URL Namespace Mapping:**
- `/api/audit/*` → AUDIT app
- `/api/portal/*` → PORTAL app
- `/api/lms/*` → LMS app
- `/api/*` → SALES app (default)

### Authentication

**JWT-Based:**
- Token in `Authorization: Bearer <token>` header
- Token expiration configurable
- Refresh token support

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Pagination, etc.
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

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
- Sales App modules blocked from non-Sales apps
- Role-based access control
- Ownership-based access (for Audit App)

#### Layer 5: Business Logic
- Additional validation in controllers
- Data filtering by ownership
- Audit logging

### Permission Enforcement Points

**Frontend:**
- Navigation menu filtering
- Route guards
- Component-level checks

**Backend:**
- Middleware chain (multiple checkpoints)
- Controller-level validation
- Database query filtering (organizationId, ownership)

### Backward Compatibility Note

**CRM → Sales Migration:**
- The application formerly known as "CRM" has been renamed to "Sales"
- Legacy references to "CRM" may still exist in:
  - Code comments
  - Database field names (e.g., `enabledModules` for CRM-specific modules)
  - Documentation references
- The default app key is `SALES` (not `CRM`)
- All new code should use `SALES` instead of `CRM`

---

## Deployment Architecture

### Multi-Instance Deployment Model

**Approach:** Separate Instance Per Organization

**Per Organization:**
- Dedicated Database (MongoDB)
- Dedicated Application Server (Node.js + Express)
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

### Containerization

**Docker:**
- Frontend container (Vue.js build)
- Backend container (Node.js + Express)
- MongoDB container (or external managed DB)

**Kubernetes:**
- Helm charts for deployment
- Service definitions
- Ingress configuration
- Secrets management

---

## Settings/Surfaces/Work Separation

### Settings

**Purpose:** Configure module behavior, structure, and presentation rules.

**What Settings Are:**
- Configuration interfaces for module metadata
- Field definitions, types, validation rules
- Layout configurations (list views, detail views, quick create)
- Relationship definitions between modules
- Display preferences and visibility rules
- Module enablement and app participation

**What Settings Are NOT:**
- Data browsing interfaces
- Record lists or tables
- Execution surfaces for actions
- Work management interfaces

**Location:** `/settings` with left navigation and right panel layout

**Reference:** See `module-settings-doctrine.md` for detailed specifications.

### Surfaces

**Purpose:** User-facing interfaces for discovering, viewing, and navigating data.

**What Surfaces Are:**
- List views (People list, Organizations list)
- Detail views (Person detail, Organization detail)
- Search interfaces
- Inbox aggregation views
- Contextual navigation hubs

**What Surfaces Are NOT:**
- Configuration interfaces
- Settings panels
- Administrative controls

**Location:** App-specific routes (e.g., `/people`, `/organizations`, `/inbox`)

### Work

**Purpose:** Business objects and records that represent actual work being done.

**What Work Is:**
- Deals, Tickets, Audits, Projects, Events
- Records that have lifecycle states
- Objects that can be created, updated, executed, and completed
- Entities that participate in workflows

**What Work Is NOT:**
- Configuration metadata
- Settings definitions
- Structural definitions

**Location:** Module-specific routes within app contexts

**Mental Model:**
```
Settings → Define structure and behavior
Surfaces → Navigate and view data
Work → Execute business processes
```

---

## Change Log

### Version 1.0 - January 2026
- Initial comprehensive architecture document created
- Documented Platform Core + Apps pattern
- Documented Settings/Surfaces/Work separation
- Documented all core modules (People, Organizations, Events, Tasks, Forms)
- Documented all applications (Sales, Audit, Portal, LMS)
- Documented security architecture
- Documented deployment architecture
- Documented data models and relationships
- **Correction:** Updated references from CRM to Sales App (CRM was renamed to Sales)

---

## Related Documentation

### Architecture Specifications
- `module-settings-doctrine.md` - Module Settings Doctrine
- `event-settings.md` - Event Settings Architecture
- `organization-settings.md` - Organization Settings Architecture
- `task-settings.md` - Task Settings Architecture
- `field-model.md` - Field Ownership Model
- `notifications-architecture.md` - Notification System Architecture

### Surface Invariants
- `people-surface-invariants.md` - People Surface Invariants
- `organization-surface-invariants.md` - Organization Surface Invariants
- `inbox-surface-invariants.md` - Inbox Surface Invariants
- `sidebar-invariants.md` - Sidebar Invariants

### Platform Documentation
- [`PLATFORM_ARCHITECTURE.md`](./PLATFORM_ARCHITECTURE.md) - Platform Architecture (detailed)
- [`EVENT_MODEL_COMPLETE.md`](./EVENT_MODEL_COMPLETE.md) - Event Model Complete Documentation

---

**Note:** This is a living document. It should be updated whenever architectural changes are made to the platform. See the [Change Log](#change-log) section for tracking updates.
