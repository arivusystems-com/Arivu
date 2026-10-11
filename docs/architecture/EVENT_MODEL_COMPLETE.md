# Event Model - Complete Documentation

## Event Schema (Full)

```javascript
const eventSchema = new Schema({
  // ===== PRIMARY KEY =====
  eventId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  
  // ===== BASIC INFORMATION =====
  eventName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 255
  },
  
  // ===== TYPE & STATUS (Picklist fields) =====
  eventType: { 
    type: String, 
    enum: [
      'Meeting / Appointment', 
      'Internal Audit', 
      'External Audit — Single Org', 
      'External Audit Beat', 
      'Field Sales Beat'
    ],
    required: true,
    default: 'Meeting / Appointment'
  },
  
  // ===== EXECUTION STATUS (System-controlled only) =====
  // Status transitions happen only through system actions (cancel, complete)
  status: { 
    type: String, 
    enum: [
      'Planned',      // Event created but not completed
      'Completed',    // Event completed (via audit flow or manual completion)
      'Cancelled'     // Event cancelled by user/admin
    ],
    required: true,
    default: 'Planned'
  },
  
  // Timestamps for status transitions
  completedAt: {
    type: Date,
    default: null
  },
  
  cancelledAt: {
    type: Date,
    default: null
  },
  
  cancelledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  cancellationReason: {
    type: String,
    maxlength: 500,
    default: null
  },
  
  // ===== AUDIT WORKFLOW STATE (for audit events only) =====
  auditState: {
    type: String,
    enum: [
      'Ready to start', 
      'checked_in', 
      'submitted', 
      'pending_corrective', 
      'needs_review', 
      'approved', 
      'rejected', 
      'closed'
    ],
    default: 'Ready to start'
  },
  
  // ===== LINKED ORGANIZATION (for audit events) =====
  relatedToId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  
  // ===== EVENT OWNER =====
  eventOwnerId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // ===== DATE & TIME =====
  startDateTime: { 
    type: Date, 
    required: true 
  },
  endDateTime: { 
    type: Date, 
    required: true 
  },
  
  // ===== LOCATION =====
  location: { 
    type: String,
    maxlength: 1024,
    default: ''
  },
  
  // ===== GEO & EXECUTION FIELDS =====
  geoRequired: {
    type: Boolean,
    default: false
  },
  
  // GEO Location Data
  geoLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: null },
    radius: { type: Number, default: 100 }, // meters, default 100m
    accuracy: { type: Number, default: null } // GPS accuracy in meters
  },
  
  // Check-in/Check-out tracking
  checkIn: {
    timestamp: { type: Date, default: null },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null }
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  
  checkOut: {
    timestamp: { type: Date, default: null },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null }
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  
  // Execution tracking
  executionStartTime: { type: Date, default: null },
  executionEndTime: { type: Date, default: null },
  timeSpent: { type: Number, default: 0 }, // seconds
  
  // Auto-pause tracking (GEO mode)
  isPaused: { type: Boolean, default: false },
  pauseReasons: [{
    reason: { 
      type: String, 
      enum: ['GPS_EXIT', 'GPS_DISABLED', 'POOR_ACCURACY', 'MANUAL'], 
      required: true 
    },
    timestamp: { type: Date, default: Date.now },
    resumedAt: { type: Date, default: null }
  }],
  
  // ===== MULTI-ORG ROUTE FIELDS =====
  // For External Audit Beat and Field Sales Beat
  isMultiOrg: {
    type: Boolean,
    default: false
  },
  
  orgList: [{
    organizationId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Organization', 
      required: true 
    },
    sequence: { type: Number, required: true }, // Order in route
    status: { 
      type: String, 
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
      default: 'PENDING'
    },
    checkIn: {
      timestamp: { type: Date, default: null },
      location: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
      }
    },
    checkOut: {
      timestamp: { type: Date, default: null },
      location: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null }
      }
    },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  }],
  
  routeSequence: {
    type: [Number], // Array of sequence numbers in order
    default: []
  },
  
  currentOrgIndex: {
    type: Number,
    default: 0 // Index of current org being visited
  },
  
  // ===== AUDIT-SPECIFIC FIELDS =====
  minVisitDuration: {
    type: Number,
    default: null // minutes
  },

  // Audit Auditor (AUDIT EVENTS ONLY)
  // Explicitly assigned user responsible for executing the audit.
  // NOTE: No default / no auto-assignment.
  auditorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType);
    }
  },

  // Audit Reviewer (AUDIT EVENTS ONLY)
  // Explicitly assigned reviewer responsible for reviewing/approving audit responses.
  // NOTE: No default / no auto-assignment. Visibility & required state are driven via Settings → Modules & Fields.
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      // Required ONLY for External Audit — Single Org.
      // IMPORTANT: No default; must be explicitly selected.
      return this.eventType === 'External Audit — Single Org';
    }
  },

  // Audit Corrective Owner (AUDIT EVENTS ONLY)
  // Explicitly assigned user responsible for addressing corrective actions raised in this audit.
  // NOTE: No default / no auto-assignment.
  correctiveOwnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType);
    }
  },

  // Controlled self-review support (AUDIT EVENTS ONLY)
  // NOTE: This is intentionally optional and defaults to false to preserve audit integrity.
  // Visibility is controlled via Settings → Modules & Fields → Event → Field Dependencies.
  allowSelfReview: {
    type: Boolean,
    default: false
  },
  
  backgroundTracking: {
    type: Boolean,
    default: false // For External Audit Beat
  },
  
  minTimePerStop: {
    type: Number,
    default: null // minutes, for multi-org routes
  },
  
  partnerVisibility: {
    type: Boolean,
    default: false // For External Audit with guest auditor
  },
  
  // ===== FIELD SALES-SPECIFIC FIELDS =====
  allowedActions: {
    orders: { type: Boolean, default: true },
    payments: { type: Boolean, default: false },
    feedback: { type: Boolean, default: true }
  },
  
  kpiTargets: {
    orderCount: { type: Number, default: null },
    orderValue: { type: Number, default: null },
    visitCompletionPercent: { type: Number, default: null },
    conversionRate: { type: Number, default: null }
  },
  
  kpiActuals: {
    orderCount: { type: Number, default: 0 },
    orderValue: { type: Number, default: 0 },
    visitsCompleted: { type: Number, default: 0 },
    ordersCreated: { type: Number, default: 0 }
  },
  
  // ===== VISIBILITY & PERMISSIONS =====
  visibility: {
    type: String,
    enum: ['Internal', 'Partner', 'Public'],
    default: 'Internal'
  },
  
  // ===== ATTACHMENTS =====
  attachments: [{
    filename: { type: String, required: true },
    filepath: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // ===== FORM LINKING (for Audit events) =====
  linkedFormId: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    default: null
  },
  
  // Form Assignment (for assigning forms to auditors)
  formAssignment: {
    assignedAuditor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    dueDate: {
      type: Date,
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    }
  },
  
  // ===== RECURRENCE =====
  recurrence: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Custom'],
    default: null
  },
  
  // ===== NOTES =====
  // Notes - Universal field (Optional)
  notes: { 
    type: String,
    maxlength: 5000,
    default: ''
  },
  
  // Notes (for user-added notes/comments - backward compatibility)
  notes: [{
    text: { type: String, required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    created_at: { type: Date, default: Date.now }
  }],
  
  // ===== AUDIT HISTORY =====
  auditHistory: [{
    timestamp: { 
      type: Date, 
      default: Date.now, 
      required: true 
    },
    actorUserId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    action: { 
      type: String, 
      required: true,
      enum: [
        'status_changed', 
        'rescheduled', 
        'attendee_added', 
        'attendee_removed', 
        'attendee_status_changed', 
        'created', 
        'updated', 
        'deleted', 
        'note_added'
      ]
    },
    from: Schema.Types.Mixed, // Previous value
    to: Schema.Types.Mixed,    // New value
    metadata: Schema.Types.Mixed // Additional context (reason, oldStart, newStart, etc.)
  }],
  
  // ===== METADATA =====
  // Metadata for storing additional data (form responses, etc.)
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // ===== MULTI-TENANCY =====
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization',
    required: true
  },
  
  // ===== TIMESTAMPS (auto-filled) =====
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  createdTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  modifiedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  modifiedTime: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { 
  timestamps: false // We use createdTime/modifiedTime instead
});
```

## Indexes

```javascript
eventSchema.index({ eventOwnerId: 1, startDateTime: 1 }, { name: 'idx_events_owner_start' });
eventSchema.index({ relatedToId: 1 }, { name: 'idx_events_relatedTo' });
eventSchema.index({ organizationId: 1, startDateTime: 1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ organizationId: 1, eventType: 1 });
eventSchema.index({ organizationId: 1, auditState: 1 });
eventSchema.index({ linkedFormId: 1 });
eventSchema.index({ 'formAssignment.assignedAuditor': 1 });
eventSchema.index({ isMultiOrg: 1, 'orgList.organizationId': 1 });
eventSchema.index({ 'orgList.organizationId': 1, 'orgList.sequence': 1 });
eventSchema.index({ geoRequired: 1, 'checkIn.timestamp': 1 });
eventSchema.index({ executionStartTime: 1 });
// eventId is already indexed via unique: true, no need for explicit index
```

## Relations

### 1. Relations to Forms

**Direct Relation:**
- `linkedFormId` (ObjectId, ref: 'Form') - Links an Event to a Form
  - Used primarily for audit events
  - When a form is linked to an event, if the form status is 'Ready', it's automatically activated to 'Active'
  - Default form assignment is set to event owner with due date = event end date

**Form Assignment:**
- `formAssignment.assignedAuditor` (ObjectId, ref: 'User') - User assigned to complete the form
- `formAssignment.dueDate` (Date) - Due date for form completion
- `formAssignment.assignedAt` (Date) - When form was assigned

**How Forms are Linked:**
1. During event creation, `linkedFormId` can be provided
2. If provided and form status is 'Ready', form is automatically activated
3. Form assignment is auto-set if not provided (defaults to event owner)

### 2. Relations to Audits

**Audit Event Types:**
- `Internal Audit` - Audits within the same organization
- `External Audit — Single Org` - Audits of a specific external organization
- `External Audit Beat` - Route-based audits (multiple organizations)

**Audit-Specific Fields:**
- `auditorId` - User responsible for executing the audit (required for audit events)
- `reviewerId` - User responsible for reviewing/approving audit responses (required for External Audit — Single Org)
- `correctiveOwnerId` - User responsible for addressing corrective actions (required for audit events)
- `auditState` - Workflow state: 'Ready to start', 'checked_in', 'submitted', 'pending_corrective', 'needs_review', 'approved', 'rejected', 'closed'
- `relatedToId` - Organization being audited

**Audit App Sync (One-Way: CRM → Audit App):**
Events automatically sync to Audit App models via post-save hook:

1. **AuditAssignment** - Synced when:
   - Audit event is created
   - `auditState` changes
   - Event is approved/rejected/closed
   
   Fields synced:
   - `auditorId` (from `event.auditorId` or `event.eventOwnerId`)
   - `organizationId`
   - `eventId` (reference to Event)
   - `auditType` (from `event.eventType`)
   - `auditState` (read-only cache from Event)
   - `scheduledAt` (from `event.startDateTime`)
   - `dueAt` (from `event.endDateTime`)
   - `status` ('active' or 'closed' based on auditState)

2. **AuditTimeline** - Created when:
   - Event is created
   - `auditState` changes
   - Approve/reject happens
   - Reschedule happens

3. **AuditExecutionContext** - Updated when:
   - FormResponse is submitted (if linked to audit event)
   - Corrective actions completed

**Sync Safety:**
- One-way sync only (CRM → Audit App)
- Never blocks CRM execution (errors are logged, not thrown)
- Kill switch: `AUDIT_SYNC_ENABLED` env flag
- Only syncs audit event types: `['Internal Audit', 'External Audit — Single Org', 'External Audit Beat']`

### 3. Relations to Responses (FormResponse)

**Polymorphic Link:**
FormResponse model uses a polymorphic `linkedTo` field:

```javascript
linkedTo: {
  type: {
    type: String,
    enum: ['Organization', 'Deal', 'Task', 'Event', 'Lead', 'Contact', null],
    default: null
  },
  id: {
    type: Schema.Types.ObjectId,
    refPath: 'linkedTo.type'
  }
}
```

**How Events Link to FormResponses:**
1. When an audit event is checked in, a FormResponse is created/retrieved:
   - `linkedTo.type = 'Event'`
   - `linkedTo.id = event._id`
   - `formId = event.linkedFormId`

2. FormResponse submission updates Event `auditState`:
   - When FormResponse `executionStatus` becomes 'Submitted', Event `auditState` transitions to 'submitted' or 'pending_corrective'

3. Corrective actions in FormResponse affect Event:
   - All corrective actions completed → Event `auditState` → 'needs_review'
   - Any corrective action reopened → Event `auditState` → 'pending_corrective'

**Bidirectional Updates:**
- Event → FormResponse: When event is checked in, FormResponse is created/retrieved
- FormResponse → Event: When FormResponse is submitted or corrective actions change, Event `auditState` is updated

## Polymorphic & Subtype Logic

### Event Type Polymorphism

Events use **subtype polymorphism** based on `eventType` field:

1. **Meeting / Appointment**
   - Basic event type
   - No audit-specific fields required
   - `geoRequired` defaults to `false` (can be enabled)

2. **Internal Audit**
   - Requires: `auditorId`, `correctiveOwnerId`, `relatedToId` (locked to requester's org)
   - `geoRequired` always `true` (cannot be disabled)
   - `allowSelfReview` defaults to `true`
   - `auditState` workflow applies

3. **External Audit — Single Org**
   - Requires: `auditorId`, `reviewerId`, `correctiveOwnerId`, `relatedToId`
   - `geoRequired` always `true` (cannot be disabled)
   - `allowSelfReview` defaults to `false`
   - `auditState` workflow applies

4. **External Audit Beat**
   - Requires: `auditorId`, `correctiveOwnerId`
   - `geoRequired` always `true` (cannot be disabled)
   - `isMultiOrg` automatically set to `true`
   - Supports `orgList` with route sequencing
   - `backgroundTracking` supported
   - `auditState` workflow applies

5. **Field Sales Beat**
   - `geoRequired` defaults to `true` (can be disabled)
   - `isMultiOrg` automatically set to `true`
   - Supports `orgList` with route sequencing
   - Has KPI tracking (`kpiTargets`, `kpiActuals`)
   - Has `allowedActions` (orders, payments, feedback)

### Conditional Field Requirements

Fields are conditionally required based on `eventType`:

```javascript
// auditorId - Required for audit events only
required: function () {
  return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType);
}

// reviewerId - Required ONLY for External Audit — Single Org
required: function () {
  return this.eventType === 'External Audit — Single Org';
}

// correctiveOwnerId - Required for audit events only
required: function () {
  return ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType);
}
```

### Self-Review Constraints

Pre-validation hook enforces:
- If `reviewerId === auditorId` (or `eventOwnerId`), then `allowSelfReview` MUST be `true`
- If `allowSelfReview === false`, then `reviewerId` MUST be different from auditor

Defaults:
- Internal Audit → `allowSelfReview = true`
- External Audit — Single Org → `allowSelfReview = false`
- External Audit Beat → `allowSelfReview = false` (can be enabled explicitly)

### Multi-Org Logic

For `External Audit Beat` and `Field Sales Beat`:
- `isMultiOrg` automatically set to `true`
- `orgList` contains organizations with sequence numbers
- `routeSequence` auto-generated from `orgList` sorted by sequence
- `currentOrgIndex` tracks which org is currently being visited

## How Events are Triggered Today

### 1. Manual Creation (Primary Method)

**Endpoint:** `POST /api/events`

**Flow:**
1. User creates event via UI (Events module or Calendar)
2. Controller validates:
   - Strips `status` from request (system-controlled)
   - Validates `eventType` against projection metadata
   - For audit events, validates required fields (`auditorId`, `correctiveOwnerId`, etc.)
   - Validates user role scopes for audit assignments
3. Model pre-save hook:
   - Sets `status` to 'Planned' (enforced)
   - Sets `createdTime` and `modifiedTime`
   - Adds creation entry to `auditHistory`
   - Enforces `geoRequired` based on `eventType`
   - Initializes `auditState` for audit events
   - Sets `isMultiOrg` for beat events
4. Model post-save hook:
   - Syncs to Audit App (for audit events only)
   - Creates/updates `AuditAssignment`
5. Domain event emitted:
   - `AUDIT_ASSIGNED` domain event (for audit events)
   - Triggers notifications

**Key Behaviors:**
- Status is **always** set to 'Planned' on creation (cannot be set by client)
- For audit events, `auditorId` is source of truth (mirrored to `eventOwnerId`)
- Forms linked via `linkedFormId` are auto-activated if status is 'Ready'
- Form assignment defaults to event owner if not provided

### 2. Form Linking & Response Creation

**When Event is Checked In:**
1. User checks in to event (sets `auditState` to 'checked_in')
2. If `linkedFormId` exists:
   - FormResponse is created/retrieved with `linkedTo.type = 'Event'` and `linkedTo.id = event._id`
   - FormResponse `formId = event.linkedFormId`
   - FormResponse `executionStatus` starts as 'Not Started' or 'In Progress'

**When FormResponse is Submitted:**
1. FormResponse `executionStatus` → 'Submitted'
2. Event `auditState` transitions:
   - If corrective actions exist → 'pending_corrective'
   - Otherwise → 'submitted' or 'needs_review'
3. AuditExecutionContext is updated (if exists)

**When Corrective Actions Change:**
1. FormResponse corrective actions updated
2. Event `auditState` updated:
   - All completed → 'needs_review'
   - Any reopened → 'pending_corrective'

### 3. Audit Workflow State Transitions

**State Machine:**
```
'Ready to start' 
  → (check in) → 'checked_in'
    → (submit form) → 'submitted' or 'pending_corrective'
      → (corrective actions complete) → 'needs_review'
        → (reviewer approves) → 'approved' → 'closed'
        → (reviewer rejects) → 'rejected'
```

**Transitions Triggered By:**
- **Check-in:** User action via EventExecution component
- **Submit:** FormResponse submission
- **Needs Review:** All corrective actions completed
- **Approve/Reject:** Reviewer action
- **Closed:** When `auditState = 'approved'` and workflow completes

**Automatic Status Update:**
- When `auditState` reaches 'closed', Event `status` automatically transitions to 'Completed'
- `completedAt` timestamp is set

### 4. Audit App Sync (Automatic)

**Post-Save Hook:**
```javascript
eventSchema.post('save', async function (doc) {
  // Only sync audit event types
  const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
  if (!AUDIT_EVENT_TYPES.includes(doc.eventType)) {
    return;
  }
  
  // Sync AuditAssignment (non-blocking)
  await auditSyncService.syncAuditAssignmentFromEvent(doc);
});
```

**Triggers:**
- Event created
- Event updated (any field change)
- `auditState` changes
- Event approved/rejected/closed

**What Gets Synced:**
- `AuditAssignment` - Assignment record in Audit App
- `AuditTimeline` - Timeline entries (via explicit calls in controllers)
- `AuditExecutionContext` - Execution context (via FormResponse sync)

### 5. Domain Events & Notifications

**Domain Events Emitted:**
- `AUDIT_ASSIGNED` - When audit event is created
- `AUDIT_CHECKED_IN` - When event is checked in
- `AUDIT_SUBMITTED` - When FormResponse is submitted
- `AUDIT_APPROVED` - When reviewer approves
- `AUDIT_REJECTED` - When reviewer rejects

**Notification Flow:**
1. Domain event emitted
2. Notification rule engine evaluates rules
3. Recipients resolved
4. Notifications created
5. Notifications delivered via configured channels (email, in-app, etc.)

### 6. Scheduling API (Legacy/Alternative)

**Endpoint:** `POST /api/scheduling`

**Flow:**
- Creates events via Scheduling model
- May create corresponding Event records
- Used by Calendar component for quick event creation

**Note:** Primary creation method is direct Event API, not Scheduling API.

## Key Model Behaviors

### Pre-Save Middleware

1. **Status Enforcement:**
   - New events: Status forced to 'Planned' (rejects client-provided status)
   - Existing events: Status changes validated (only system transitions allowed)

2. **GEO Required Enforcement:**
   - Audit events: `geoRequired = true` (cannot be disabled)
   - Field Sales Beat: `geoRequired = true` by default (can be disabled)
   - Meeting/Appointment: `geoRequired = false` by default (can be enabled)

3. **Audit State Initialization:**
   - Audit events: `auditState = 'Ready to start'`
   - Non-audit events: `auditState = null`

4. **Multi-Org Setup:**
   - Beat events: `isMultiOrg = true`
   - `routeSequence` auto-generated from `orgList`

5. **Status Transition to Completed:**
   - When `auditState = 'closed'`, Event `status` → 'Completed'
   - `completedAt` timestamp set

### Pre-Validate Middleware

**Self-Review Constraints:**
- Enforces `allowSelfReview` must be `true` if reviewer = auditor
- Enforces reviewer must be different if `allowSelfReview = false`
- Sets defaults based on event type

### Virtual Properties

```javascript
eventSchema.virtual('duration').get(function() {
  if (this.startDateTime && this.endDateTime) {
    return this.endDateTime - this.startDateTime;
  }
  return null;
});
```

## Summary

**Event Model Characteristics:**
- **Polymorphic:** Uses `eventType` to determine behavior and required fields
- **System-Controlled Status:** Status transitions only via system actions
- **Audit Integration:** Deep integration with Audit App via one-way sync
- **Form Integration:** Links to Forms and creates FormResponses during execution
- **Multi-Org Support:** Supports route-based events with multiple organizations
- **GEO Tracking:** Supports location-based check-in/check-out with radius validation
- **Workflow State:** Audit events have workflow state machine (`auditState`)
- **Domain Events:** Emits domain events for notification system

**Key Relationships:**
- **Event → Form:** `linkedFormId` (one-to-one)
- **Event → FormResponse:** Polymorphic `linkedTo` in FormResponse (one-to-many)
- **Event → AuditAssignment:** Synced one-way (one-to-one)
- **Event → AuditTimeline:** Synced one-way (one-to-many)
- **Event → Organization:** `relatedToId` (many-to-one, for audit events)
- **Event → User:** `eventOwnerId`, `auditorId`, `reviewerId`, `correctiveOwnerId` (many-to-one)
