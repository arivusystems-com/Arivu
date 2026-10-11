# Event Settings Architecture

**Version:** 1.0  
**Date:** January 2026  
**Status:** Architectural Specification (Locked)  
**Type:** Platform Architecture Specification

---

## Executive Summary

This document defines the Event Settings module for the Arivu platform. Event Settings configure the structure, constraints, and eligibility of event records across the platform. This specification aligns with the Module Settings Doctrine and uses People Settings as the canonical reference implementation.

**Canonical Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Settings Location:** `/settings?tab=core-modules&moduleKey=events`  
**Doctrine Reference:** `module-settings-doctrine.md`

---

## 1. Purpose & Scope

### Purpose

Event Settings configure how event records are structured, constrained, and made eligible across the platform. These settings control event type definitions, field visibility and requirements, role requirements, geo rules, and form linking rules—not the event records themselves, and not their scheduling, execution, or audit workflows.

### Scope

Event Settings apply **only** to event structure and configuration:
- Event type definitions and enablement
- Field definitions and visibility
- Role requirements per event type
- Geo rules (required/optional per event type)
- Form linking rules (allowed/required/forbidden)
- Relationship definitions
- Quick Create field configuration
- App participation settings

### Explicit Scope Exclusions

Event Settings **do not** manage events themselves or their execution. The following belong to other domains:

#### Scheduling
**Excluded:** Event scheduling, calendar management, time slot allocation, recurrence patterns, and availability management.

**Rationale:** Scheduling is a separate domain concern. Event Settings configure event structure; scheduling interfaces manage when and how events are scheduled. See Scheduling Controller and Calendar components.

**Location:** Scheduling belongs in Calendar interfaces, Scheduling API, and Work interfaces.

#### Execution
**Excluded:** Event execution, check-in/check-out, geo tracking execution, time tracking, and execution state management.

**Rationale:** Execution belongs to Work interfaces. Event Settings configure the structure that enables execution elsewhere (geo requirements, role assignments), not execution itself.

**Location:** Event execution belongs in EventExecution components and Work interfaces.

#### Audit Workflows
**Excluded:** Audit state transitions, workflow state management, approval/rejection flows, corrective action workflows, and audit lifecycle management.

**Rationale:** Audit workflows are execution concerns, not structure concerns. Event Settings configure which roles are required for audit events and which fields appear, but workflow execution belongs to Work interfaces.

**Location:** Audit workflows belong in Audit App interfaces and Work components.

#### Calendars
**Excluded:** Calendar views, calendar navigation, calendar filtering, and calendar display configuration.

**Rationale:** Calendars are Surfaces for viewing scheduled events, not Settings for configuring event structure. Calendar configuration belongs to Calendar doctrine, not Event Settings.

**Location:** Calendar configuration belongs in Calendar components and Calendar doctrine.

### Mental Model

```
Event Settings → Configure event structure, constraints, eligibility
Event Surfaces → Browse and view events (Calendar, Events list)
Event Work → Schedule, execute, complete events
Audit Workflows → Execute audit state transitions and workflows
```

---

## 2. Core Definitions

### 2.1 Event Type

Event Type is a picklist field that determines event behavior and required fields. Event Settings configure which event types are enabled and their display labels.

#### Available Event Types

1. **Meeting / Appointment**
   - Basic event type
   - No audit-specific fields required
   - Geo optional (can be enabled)

2. **Internal Audit**
   - Requires: `auditorId`, `correctiveOwnerId`, `relatedToId` (locked to requester's org)
   - Geo always required (cannot be disabled)
   - Audit workflow applies

3. **External Audit — Single Org**
   - Requires: `auditorId`, `reviewerId`, `correctiveOwnerId`, `relatedToId`
   - Geo always required (cannot be disabled)
   - Audit workflow applies

4. **External Audit Beat**
   - Requires: `auditorId`, `correctiveOwnerId`
   - Geo always required (cannot be disabled)
   - Multi-org route support
   - Audit workflow applies

5. **Field Sales Beat**
   - Geo optional (defaults to required, can be disabled)
   - Multi-org route support
   - KPI tracking support

**Configuration:** Event Settings allow enabling/disabling event types and renaming their display labels. Event Settings do not create new event types or modify event type behavior logic.

### 2.2 Event Lifecycle (System-Owned)

Event lifecycle is **system-controlled** and cannot be configured via Settings.

#### Status Field (System Categories + Configurable Labels)

**Lifecycle model (world-class lock):** See `docs/architecture/event-status-lifecycle.md`.

- **`statusCategory`** (`OPEN` | `DONE` | `CANCELLED`) — system-owned semantics
- **`status`** — display labels (tenant-configurable for non-audit types under each category)

**System seed labels:** `Planned` (OPEN), `Completed` (DONE), `Cancelled` (CANCELLED)

**Non-audit (Meeting, Field Sales Beat):**
- Admins add/rename/archive labels under categories in Settings → Events → Status
- Users may manually change status among type-allowed labels
- Complete/Cancel actions set the category default terminal labels

**Audit types:** system labels only; transitions via workflow / complete / cancel

**Architecture Lock:** Category set and audit system rules require architecture review. Tenant label vocabulary for non-audit types is supported.

#### Audit State (System-Controlled)

**Audit State Values:**
- `Ready to start` - Initial state for audit events
- `checked_in` - Event checked in
- `submitted` - Form submitted
- `pending_corrective` - Corrective actions pending
- `needs_review` - Ready for review
- `approved` - Approved by reviewer
- `rejected` - Rejected by reviewer
- `closed` - Audit closed

**System Behavior:**
- Audit state transitions are workflow-controlled
- Settings cannot configure audit state values or transitions
- Settings configure which roles are required, not how states transition

**Rationale:** Audit state is workflow execution state, not structure. Workflow execution belongs to Audit App and Work interfaces.

### 2.3 Event Roles

Event Settings configure **role requirements** per event type, not role assignment or execution.

#### Event Owner (`eventOwnerId`)

**Definition:** User who owns/created the event.

**Configuration:**
- Always required (system-enforced)
- Cannot be made optional
- Visibility can be configured

**Rationale:** Every event must have an owner. This is a platform invariant.

#### Auditor (`auditorId`)

**Definition:** User responsible for executing the audit (audit events only).

**Configuration:**
- Required for: Internal Audit, External Audit — Single Org, External Audit Beat
- Optional for: Meeting / Appointment, Field Sales Beat
- Visibility can be configured per event type
- Cannot be made optional for audit event types

**Rationale:** Audit events require an auditor. Settings configure this requirement, not assignment.

#### Reviewer (`reviewerId`)

**Definition:** User responsible for reviewing/approving audit responses (External Audit — Single Org only).

**Configuration:**
- Required for: External Audit — Single Org
- Optional for: All other event types
- Visibility can be configured per event type
- Cannot be made optional for External Audit — Single Org

**Rationale:** External audits require a reviewer. Settings configure this requirement, not assignment.

#### Corrective Owner (`correctiveOwnerId`)

**Definition:** User responsible for addressing corrective actions raised in audit events.

**Configuration:**
- Required for: Internal Audit, External Audit — Single Org, External Audit Beat
- Optional for: Meeting / Appointment, Field Sales Beat
- Visibility can be configured per event type
- Cannot be made optional for audit event types

**Rationale:** Audit events require a corrective owner. Settings configure this requirement, not assignment.

**Note:** Settings configure **which roles are mandatory per event type**, not role assignment or role execution. Role assignment belongs to Work interfaces.

---

## 3. UX Placement

### Location

Event Settings are located at:
**Settings → Core Modules → Events**

### Layout Structure

Event Settings follow the **exact same layout and component structure** as People Settings and Task Settings:

#### Left Navigation
- Located in Settings left nav under "Core Modules"
- Clicking "Core Modules" navigates to Core Modules list
- Selecting "Events" navigates to Event Settings detail

#### Right Panel Structure
- Header with module name and badges (Platform-Owned, Shared)
- Tabbed interface with four tabs:
  1. **Module Details**: Name, description, app participation
  2. **Field Configurations**: Field definitions, types, visibility, role requirements
  3. **Relationships**: Module-to-module relationships
  4. **Quick Create**: Field selection and order

### Component Reuse

Event Settings use the same components as People Settings:
- `CoreModuleDetail.vue` (wrapper component)
- `ModulesAndFields.vue` (configuration interface)
- Same visual design (badges, spacing, typography)
- Same permission model (`settings.edit` permission required)

**Rationale:** Consistency across module settings reduces cognitive load and ensures predictable admin experience.

---

## 4. Allowed Configuration Areas

### 4.1 Event Types

Event Settings allow configuration of:

#### Enable/Disable Event Types
- Enable or disable specific event types
- Disabled event types do not appear in event creation interfaces
- Cannot disable all event types (at least one must be enabled)

#### Rename Event Type Labels
- Configure display labels for event types
- Labels are tenant-specific
- Cannot modify event type internal values (enum values)

**Prohibited:**
- Creating new event types (requires platform changes)
- Modifying event type behavior logic (requires code changes)
- Configuring event type-specific field requirements (belongs in Field Configuration)

**Rationale:** Event types are platform-defined. Settings configure availability and labels, not type behavior.

### 4.2 Field Configuration

Event Settings allow configuration of fields grouped by ownership:

#### Core Event Fields (Platform-Owned)

**Required Fields:**
- `eventName` (required, cannot be made optional)
- `eventOwnerId` (required, cannot be made optional)
- `startDateTime` (required, cannot be made optional)
- `endDateTime` (required, cannot be made optional)

**Optional Core Fields:**
- `eventType` (picklist, see Section 4.1)
- `location` (text field)
- `notes` (text field)
- `relatedToId` (organization reference)
- `recurrence` (recurrence pattern)

**Allowed Actions:**
- Configure visibility (show/hide in list views, detail views, quick create)
- Configure requirements (mark optional fields as required, except locked required fields)
- Configure read-only state (where applicable)
- Reorder fields (where applicable)

**Prohibited:** Creating or deleting core fields. Core event fields are platform-defined. Settings configure visibility and behavior, not field existence.

#### App Participation Fields

**Audit App Fields:**
- `auditorId` (audit events only)
- `reviewerId` (External Audit — Single Org only)
- `correctiveOwnerId` (audit events only)
- `auditState` (system-controlled, visibility only)
- `allowSelfReview` (audit events only)
- `linkedFormId` (form linking)
- `minVisitDuration` (audit events only)
- `backgroundTracking` (External Audit Beat only)
- `partnerVisibility` (External Audit only)

**Sales App Fields:**
- `allowedActions` (Field Sales Beat only)
- `kpiTargets` (Field Sales Beat only)
- `kpiActuals` (Field Sales Beat only, read-only)

**Allowed Actions:**
- Configure visibility (show/hide based on app participation and event type)
- Configure requirements (mark as required/optional per event type)
- Configure read-only state
- Configure role requirements per event type (see Section 4.3)

**Prohibited:** Creating or deleting app participation fields. These fields are app-owned. Settings configure visibility and behavior, not field existence.

#### System Fields

**System-Managed Fields:**
- `_id` (MongoDB identifier)
- `eventId` (unique event identifier)
- `organizationId` (tenant isolation)
- `status` (system-controlled, visibility only)
- `createdTime`, `modifiedTime` (timestamps)
- `createdBy`, `modifiedBy` (creator/modifier references)
- `completedAt`, `cancelledAt` (execution timestamps)
- `cancelledBy`, `cancellationReason` (cancellation metadata)
- `checkIn`, `checkOut` (execution tracking, read-only)
- `executionStartTime`, `executionEndTime` (execution tracking, read-only)
- `timeSpent` (execution tracking, read-only)
- `isPaused`, `pauseReasons` (execution tracking, read-only)
- `orgList` (multi-org route data, read-only)
- `routeSequence`, `currentOrgIndex` (multi-org route tracking, read-only)
- `auditHistory` (audit trail, read-only)

**Allowed Actions:**
- Configure visibility only (show/hide in views)

**Prohibited:** Editing, deleting, or modifying system field behavior. System fields are required for platform operation and execution tracking.

### 4.3 Role Requirements

Event Settings allow configuration of:

#### Per-Event-Type Role Requirements

**Configuration:**
- Configure which roles are required per event type
- Configure which roles are optional per event type
- Configure role field visibility per event type

**Example:**
- Internal Audit: `auditorId` required, `reviewerId` optional, `correctiveOwnerId` required
- External Audit — Single Org: `auditorId` required, `reviewerId` required, `correctiveOwnerId` required
- Field Sales Beat: `auditorId` optional, `reviewerId` optional, `correctiveOwnerId` optional

**Prohibited:**
- Configuring role assignment (belongs in Work interfaces)
- Configuring role permissions (belongs in Security Settings)
- Configuring role execution (belongs in Work interfaces)

**Rationale:** Settings configure **which roles are mandatory**, not role assignment or execution.

### 4.4 Geo Rules

Event Settings allow configuration of:

#### Geo Required/Optional Per Event Type

**Configuration:**
- Configure `geoRequired` default per event type
- Configure whether `geoRequired` can be toggled per event type

**Rules:**
- **Audit Events** (Internal Audit, External Audit — Single Org, External Audit Beat): `geoRequired` always `true` (cannot be disabled)
- **Field Sales Beat**: `geoRequired` defaults to `true` (can be disabled)
- **Meeting / Appointment**: `geoRequired` defaults to `false` (can be enabled)

**Prohibited:**
- Configuring geo tracking execution (belongs in Work interfaces)
- Configuring geo radius or accuracy settings (belongs in Work interfaces)
- Configuring geo validation rules (belongs in Work interfaces)

**Rationale:** Settings configure **geo requirements**, not geo execution or validation.

### 4.5 Form Linking Rules

Event Settings allow configuration of:

#### Form Linking Allowed/Required/Forbidden

**Configuration:**
- Configure which event types allow form linking
- Configure which event types require form linking
- Configure which event types forbid form linking

**Rules:**
- **Audit Events**: Form linking allowed (typically required in practice)
- **Meeting / Appointment**: Form linking optional
- **Field Sales Beat**: Form linking optional

**Prohibited:**
- Configuring form assignment (belongs in Work interfaces)
- Configuring form execution (belongs in Work interfaces)
- Configuring form response workflows (belongs in Audit App)

**Rationale:** Settings configure **form linking eligibility**, not form assignment or execution.

### 4.6 Relationship Configuration

Event Settings allow configuration of:

#### Event ↔ People Relationship
- Configure cardinality (many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views

#### Event ↔ Organization Relationship
- Configure cardinality (many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views
- Configure `relatedToId` field behavior per event type

#### Event ↔ Form Relationship
- Configure cardinality (one-to-many via `linkedFormId`)
- Relationship labels and descriptions
- Relationship visibility rules

**Note:** Settings configure relationship definitions, not actual relationships between records. Actual relationships are created and managed in Surfaces and Work interfaces.

### 4.7 App Participation

Event Settings provide **read-only visibility** of:

#### Which Apps Use Events
- Display list of applications that use Events module
- Show required vs optional app participation
- Display app-specific field usage

**Prohibited:** Toggling app participation. App participation is controlled at the application level, not the module level. Event Settings display this information for transparency only.

---

## 5. Explicit Exclusions (Hard Lock)

Event Settings must **NEVER** include:

### 5.1 No Event List

**Excluded:** Tables, lists, or any display of actual event records.

**Rationale:** Lists belong in Surfaces (`/events`), not Settings. Settings configure how lists are displayed, not the lists themselves. See Module Settings Doctrine Section 3.1.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Event Settings -->
<DataTable :records="events" />
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure list structure -->
<FieldVisibilityConfiguration :fields="listViewFields" />
```

### 5.2 No Calendar

**Excluded:** Any calendar view, calendar navigation, calendar filtering, or calendar display configuration.

**Rationale:** Calendars are Surfaces for viewing scheduled events, not Settings for configuring event structure. Calendar configuration belongs to Calendar doctrine, not Event Settings.

**Excluded Areas:**
- Calendar views (month, week, day, agenda)
- Calendar navigation (date navigation, view switching)
- Calendar filtering (by event type, by assignee, by organization)
- Calendar display configuration (colors, time slots, working hours)
- Calendar event creation (belongs in Calendar components)

**Location:** Calendar configuration belongs in Calendar components and Calendar doctrine.

### 5.3 No Scheduling

**Excluded:** Any interface for scheduling events, managing time slots, allocating availability, or configuring recurrence patterns.

**Rationale:** Scheduling is a separate domain concern. Event Settings configure event structure; scheduling interfaces manage when and how events are scheduled.

**Excluded Areas:**
- Time slot allocation
- Availability management
- Recurrence pattern configuration (beyond basic field visibility)
- Scheduling conflicts resolution
- Scheduling automation

**Location:** Scheduling belongs in Calendar interfaces, Scheduling API (`/api/scheduling`), and Work interfaces.

**Note:** Event Settings can configure `recurrence` field visibility, but recurrence execution belongs to Scheduling domain.

### 5.4 No Audit State Transitions

**Excluded:** Any interface for executing audit state transitions, workflow state management, approval/rejection flows, or corrective action workflows.

**Rationale:** Audit state transitions are workflow execution concerns, not structure concerns. Event Settings configure which roles are required and which fields appear, but workflow execution belongs to Work interfaces.

**Excluded Actions:**
- Check-in/check-out (execution)
- Form submission (execution)
- State transitions (Ready to start → checked_in → submitted → needs_review → approved/rejected → closed)
- Approval/rejection (execution)
- Corrective action management (execution)

**Location:** Audit workflows belong in Audit App interfaces, EventExecution components, and Work components.

**Note:** Event Settings can configure `auditState` field visibility (read-only), but state transitions are excluded.

### 5.5 No Execution Controls

**Excluded:** Any interface for executing events, managing check-in/check-out, geo tracking execution, time tracking, or execution state management.

**Rationale:** Execution belongs to Work interfaces. Event Settings configure the structure that enables execution elsewhere (geo requirements, role assignments), not execution itself.

**Excluded Areas:**
- Check-in/check-out execution
- Geo tracking execution (GPS capture, radius validation)
- Time tracking execution (`executionStartTime`, `executionEndTime`, `timeSpent`)
- Execution pause/resume
- Multi-org route execution (`orgList` navigation, `currentOrgIndex` management)

**Location:** Event execution belongs in EventExecution components and Work interfaces.

**Note:** Event Settings can configure execution field visibility (read-only), but execution is excluded.

### 5.6 No SLA or KPI Dashboards

**Excluded:** Any interface for monitoring SLA compliance, displaying KPI dashboards, or tracking performance metrics.

**Rationale:** SLA and KPI monitoring are execution and reporting concerns, not structure concerns. Event Settings configure KPI field visibility, but monitoring belongs to Reporting and Dashboard interfaces.

**Excluded Areas:**
- SLA violation detection
- SLA compliance monitoring
- KPI target vs actual comparisons
- Performance dashboards
- Metric tracking and reporting

**Location:** SLA and KPI monitoring belongs in Dashboard components, Reporting interfaces, and Analytics modules.

**Note:** Event Settings can configure `kpiTargets` and `kpiActuals` field visibility, but monitoring is excluded.

### 5.7 No Record Editing or Creation

**Excluded:** Any interface for creating, editing, or deleting event records.

**Rationale:** Record manipulation belongs in Surfaces (`/events`) and Work interfaces, not Settings. Settings configure the structure that enables these actions elsewhere. See Module Settings Doctrine Section 3.2.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Event Settings -->
<button @click="createEvent">Create Event</button>
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure quick create fields -->
<QuickCreateConfiguration :fields="quickCreateFields" />
```

---

## 6. Field Ownership Model

Event fields follow a three-tier ownership model:

### 6.1 Core Event Fields (Platform-Owned)

**Owner:** Platform Core  
**Intent:** Event identity and basic scheduling information

**Fields Include:**
- `eventName` (event name)
- `eventType` (event type picklist)
- `eventOwnerId` (event owner)
- `startDateTime`, `endDateTime` (scheduling)
- `location` (location text)
- `notes` (notes text)
- `relatedToId` (related organization)
- `recurrence` (recurrence pattern)

**Characteristics:**
- Platform-owned and shared across all applications
- Cannot be deleted or renamed
- Visibility and requirements can be configured
- Appear in all apps that use Events

### 6.2 App Participation Fields

**Owner:** Applications (Audit, Sales, etc.)  
**Intent:** App-specific event attributes

**Fields Include:**
- **Audit App:**
  - `auditorId`, `reviewerId`, `correctiveOwnerId` (audit roles)
  - `auditState` (workflow state, read-only)
  - `allowSelfReview` (self-review flag)
  - `linkedFormId` (form linking)
  - `minVisitDuration` (visit duration requirement)
  - `backgroundTracking` (background tracking flag)
  - `partnerVisibility` (partner visibility flag)
- **Sales App:**
  - `allowedActions` (allowed actions for Field Sales Beat)
  - `kpiTargets` (KPI targets)
  - `kpiActuals` (KPI actuals, read-only)

**Characteristics:**
- Owned by specific applications
- Governed by field model (owner + intent + fieldScope)
- Visibility controlled by app participation and event type
- Can be configured but not deleted (app-owned)

### 6.3 System Fields

**Owner:** System  
**Intent:** System tracking, execution state, and metadata

**Fields Include:**
- `_id` (MongoDB identifier)
- `eventId` (unique event identifier)
- `organizationId` (tenant isolation)
- `status` (system-controlled execution status)
- `createdTime`, `modifiedTime` (timestamps)
- `createdBy`, `modifiedBy` (creator/modifier references)
- `completedAt`, `cancelledAt` (execution timestamps)
- `cancelledBy`, `cancellationReason` (cancellation metadata)
- `checkIn`, `checkOut` (execution tracking)
- `executionStartTime`, `executionEndTime` (execution tracking)
- `timeSpent` (execution tracking)
- `isPaused`, `pauseReasons` (execution tracking)
- `geoLocation` (geo data)
- `orgList` (multi-org route data)
- `routeSequence`, `currentOrgIndex` (multi-org route tracking)
- `auditHistory` (audit trail)

**Characteristics:**
- System-managed, not user-configurable
- Visibility can be controlled (read-only)
- Cannot be edited or deleted
- Required for system operation and execution tracking

### Field Configuration Rules

1. **Core fields:** Can configure visibility, requirements, default values. Cannot delete or rename.
2. **App participation fields:** Can configure visibility and requirements per event type. Cannot delete (app-owned).
3. **System fields:** Can configure visibility only (read-only). Cannot edit, delete, or modify behavior.

---

## 7. Quick Create Rules

Quick Create configuration is **critical** for Events because events are frequently created from various contexts (Calendar, Surfaces, Work interfaces).

### 7.1 Quick Create Fields ONLY

**Default Locked Order:**
1. **Event Name** (required, locked position, cannot be removed)
2. **Event Type** (required, can be reordered but cannot be removed)
3. **Start Date/Time** (required, can be reordered but cannot be removed)
4. **End Date/Time** (required, can be reordered but cannot be removed)
5. **Event Owner** (required, can be reordered but cannot be removed)
6. **Location** (optional, can be reordered or removed)
7. **Related To** (Organization, optional, can be reordered or removed)

### 7.2 Quick Create Rules

**Allowed Fields:**
- Core event fields only (`eventName`, `eventType`, `startDateTime`, `endDateTime`, `eventOwnerId`, `location`, `relatedToId`)
- Minimal scheduling-safe fields (no execution or workflow fields)

**Prohibited Fields:**
- **Audit fields** ❌ (`auditorId`, `reviewerId`, `correctiveOwnerId`, `auditState`, `allowSelfReview`, `linkedFormId`, `minVisitDuration`, `backgroundTracking`, `partnerVisibility`)
- **Workflow fields** ❌ (`status`, `auditState`, `checkIn`, `checkOut`, `executionStartTime`, `executionEndTime`)
- **Geo execution fields** ❌ (`geoLocation`, `checkIn.location`, `checkOut.location`)
- **Multi-org route fields** ❌ (`orgList`, `routeSequence`, `currentOrgIndex`, `isMultiOrg`)
- **KPI fields** ❌ (`kpiTargets`, `kpiActuals`, `allowedActions`)
- **System fields** ❌ (`_id`, `eventId`, `organizationId`, `createdTime`, `modifiedTime`, `createdBy`, `modifiedBy`, `auditHistory`)
- **Recurrence** ❌ (recurrence configuration belongs in full event edit, not quick create)
- **Notes** ❌ (notes can be added in full event edit)

**Rationale:** Quick Create must be fast and focused on minimal scheduling information. Only essential fields for event creation appear. Full event editing (including audit fields, workflow fields, and execution fields) happens in Work interfaces where all fields are available.

**Scheduling-Safe:** Quick Create fields are "scheduling-safe" because they contain only information needed to schedule an event, not execute it. Execution fields (check-in, geo tracking, audit state) are excluded to prevent premature execution configuration.

---

## 8. System-Owned Concepts

Event Settings include several concepts that are **system-owned** and **non-configurable**. These concepts are required for event execution and lifecycle management and cannot be modified via Settings.

### 8.1 Terminal Event Statuses (System-Owned)

**System-Owned Statuses:**
- `Planned` - Event created but not completed (default on creation)
- `Completed` - Event completed (via audit flow or manual completion)
- `Cancelled` - Event cancelled by user/admin

**Lock Rules:**
- **Cannot be deleted** - These statuses are required for event execution
- **Cannot be renamed** - Status values are fixed and used by execution logic
- **Cannot be reordered** - Status order is system-defined
- **Cannot be modified** - Any modification would break execution workflows

**Rationale:** Event execution depends on these statuses for lifecycle management. Status transitions happen via system actions (complete, cancel) in Work interfaces, not Settings. These statuses are displayed in Event Settings for visibility only.

**Architecture Reference:** See Section 2.2 for detailed status behavior.

### 8.2 Event Priority (System-Owned)

**Decision:** Event Priority is **SYSTEM-OWNED** and **NOT configurable** in Event Settings.

**System Behavior:**
- Event Priority is a runtime concern, not a structural concern
- Default priorities are: `Low` / `Medium` / `High`
- Priority configuration (if ever added) requires an architecture change
- **No Priority tab** exists in Event Settings
- **No priority picklist editor** exists in Event Settings
- **No quick-create configuration** for priority exists

**Rationale:** Unlike Tasks (which have configurable priority), Events do not expose priority configuration in Settings. Priority is a runtime attribute that may be used by execution logic, but it is not part of the structural configuration that Settings manage.

**Defensive Guard:** If any future code attempts to register Event Priority settings, it should log a dev-only warning explaining why it is forbidden.

**Architecture Reference:** This decision aligns with the principle that Event Settings configure structure and constraints, not runtime behavior.

### 8.3 Lock Statement

**Any change to these system-owned concepts requires architecture review.**

The following are **NON-NEGOTIABLE**:
1. Terminal event statuses (`Planned`, `Completed`, `Cancelled`) are system-locked
2. Event Priority is system-owned and non-configurable
3. These rules are enforced at the code level, not merely documented

**Change Process:** Any proposal to modify these system-owned concepts must:
1. **Justify the change** with clear architectural reasoning
2. **Propose alternative** that maintains system integrity
3. **Update this document** if the change is approved
4. **Update code guards** to reflect the new rules

---

## 9. Lock Statement

### Scope Lock

Event Settings are **locked in scope**. The following are **NON-NEGOTIABLE**:

1. **Settings do not display event records.** Lists, tables, and record browsers belong in Surfaces (`/events`) and Calendar components.
2. **Settings do not execute actions.** Create, update, delete, scheduling, execution, and lifecycle actions belong in Surfaces and Work interfaces.
3. **Settings configure structure only.** Field definitions, layouts, relationships, event types, role requirements, geo rules, and form linking rules are the sole domain of Settings.
4. **Settings exclude scheduling.** Scheduling, calendar management, and time slot allocation belong in Calendar interfaces and Scheduling API.
5. **Settings exclude execution.** Event execution, check-in/check-out, geo tracking execution, and execution state management belong in Work interfaces.
6. **Settings exclude audit workflows.** Audit state transitions, workflow state management, and approval/rejection flows belong in Audit App interfaces and Work components.
7. **Settings exclude calendars.** Calendar views, calendar navigation, and calendar display configuration belong in Calendar components and Calendar doctrine.
8. **Settings exclude SLA/KPI monitoring.** SLA compliance monitoring and KPI dashboards belong in Dashboard and Reporting interfaces.
9. **Settings must never mutate live events.** Settings configure structure that applies to new events; existing events are not modified by settings changes.

### Change Process

Any proposal to add functionality to Event Settings that violates these locks must:

1. **Justify the violation** with clear architectural reasoning
2. **Propose alternative** that maintains the Settings/Surfaces/Work separation
3. **Update this document** if the change is approved
4. **Update module-settings-doctrine.md** if the change affects the doctrine
5. **Update People Settings** if the change becomes the new canonical pattern

### Enforcement

- **Code Review:** Reject PRs that violate Event Settings scope
- **Architecture Review:** Require architecture approval for scope changes
- **Documentation:** Update this document before implementing scope changes
- **Testing:** Verify Event Settings do not include prohibited content
- **Data Integrity:** Verify settings changes do not mutate existing event records

### Future-Proofing

This specification prevents scope creep by:

- **Explicit boundaries** between Settings, Surfaces, and Work
- **Canonical reference** (People Settings) for consistency
- **Locked prohibitions** that require explicit override
- **Change process** that prevents ad-hoc additions
- **Clear separation** between event structure (Settings) and event management (Surfaces/Work)
- **Immutable settings** that never mutate live events

**These rules must be enforced at the code level, not merely documented.**

---

## Summary

Event Settings configure the structure, constraints, and eligibility of event records across the platform. They are distinct from Surfaces (data browsing, calendars) and Work (event scheduling, execution, audit workflows). Settings configure structure; they do not display or manipulate data.

**Key Principles:**
1. Settings configure, Surfaces navigate, Work executes
2. Settings use the same layout and components as People Settings
3. Settings never include lists, records, or execution actions
4. Settings exclude scheduling (belongs in Calendar and Scheduling API)
5. Settings exclude execution (belongs in Work interfaces)
6. Settings exclude audit workflows (belongs in Audit App and Work components)
7. Settings exclude calendars (belongs in Calendar components)
8. Settings exclude SLA/KPI monitoring (belongs in Dashboard and Reporting)
9. Settings must never mutate live events
10. Scope is locked; changes require architecture approval

**Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Doctrine:** Module Settings Doctrine (`module-settings-doctrine.md`)  
**Event Model:** Event Model Complete Documentation ([`EVENT_MODEL_COMPLETE.md`](./EVENT_MODEL_COMPLETE.md))  
**Enforcement:** Code review, architecture review, documentation updates

---

**This document defines NON-NEGOTIABLE invariants for Event Settings.**  
**These rules must never be violated, regardless of feature requests or UI preferences.**
