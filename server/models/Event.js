const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { v4: uuidv4 } = require('uuid');
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

// Audit history entry schema
const auditHistoryEntrySchema = new Schema({
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
    enum: ['status_changed', 'rescheduled', 'attendee_added', 'attendee_removed', 'attendee_status_changed', 'created', 'updated', 'deleted', 'note_added'] // Picklist
  },
  from: Schema.Types.Mixed, // Previous value
  to: Schema.Types.Mixed,    // New value
  metadata: Schema.Types.Mixed // Additional context (reason, oldStart, newStart, etc.)
}, { _id: false });


const eventSchema = new Schema({
  // Primary Key - UUID
  eventId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },

  eventNumber: {
    type: String,
    trim: true,
    index: true,
  },
  
  // Basic Information
  eventName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 255
  },
  
  // Type & Status (Picklist fields) - Per Events Module Spec
  eventType: { 
    type: String, 
    enum: [
      'Meeting',
      'Internal Audit', 
      'External Audit — Single Org', 
      'External Audit Beat', 
      'Field Sales Beat'
    ],
    required: true,
    default: 'Meeting'
  },
  
  // Execution status vocabulary (labels). Category is system-owned semantics.
  // Non-audit types may use tenant-defined labels under OPEN|DONE|CANCELLED.
  // See: server/domain/events/eventStatus.js
  status: {
    type: String,
    required: true,
    default: 'Scheduled',
    trim: true,
    index: true,
  },

  // System-owned lifecycle category (derived/enforced from status value)
  // Not strictly required for legacy rows; pre-save backfills from status label.
  statusCategory: {
    type: String,
    enum: ['OPEN', 'DONE', 'CANCELLED'],
    default: 'OPEN',
    index: true,
  },

  lifecycleState: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
    index: true
  },
  closedAt: { type: Date, default: null },
  reopenedAt: { type: Date, default: null },
  
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
  
  // Audit Workflow State (for audit events only)
  auditState: {
    type: String,
    enum: ['Ready to start', 'checked_in', 'submitted', 'pending_corrective', 'needs_review', 'approved', 'rejected', 'closed'],
    default: 'Ready to start'
  },
  
  // Linked Organization (for audit events)
  relatedToId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  
  // Event Owner
  assignedTo: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Date & Time
  startDateTime: { 
    type: Date, 
    required: true 
  },
  endDateTime: { 
    type: Date, 
    required: true 
  },
  
  // Location (physical address / place name)
  location: { 
    type: String,
    maxlength: 1024,
    default: ''
  },

  // ===== MEETING FIELDS (eventType = Meeting) =====
  // Meeting mode (optional; create form defaults Virtual for Meeting type)
  meetingMode: {
    type: String,
    enum: ['In-person', 'Virtual', 'Hybrid'],
    required: false
  },
  meetingLink: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: null
  },
  // Virtual/Hybrid only: google_meet | ms_teams | zoom (no custom provider)
  conferenceProvider: {
    type: String,
    enum: ['google_meet', 'ms_teams', 'zoom'],
    required: false
  },
  // Internal participants (User ids). Owner remains assignedTo.
  attendees: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Agenda / purpose for meetings (separate from system notes array/history)
  agendaNotes: {
    type: String,
    maxlength: 5000,
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
    reason: { type: String, enum: ['GPS_EXIT', 'GPS_DISABLED', 'POOR_ACCURACY', 'MANUAL'], required: true },
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
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
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

  // Form Linking (for Audit events)
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
  
  // Recurrence - Universal field (Optional)
  recurrence: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Custom'],
    default: null
  },
  
  // Notes - Universal field (Optional)
  notes: { 
    type: String,
    maxlength: 5000,
    default: ''
  },

  // Description version history (native, task/deal parity)
  descriptionVersions: [{
    content: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Audit History
  auditHistory: [auditHistoryEntrySchema],
  
  // Metadata for storing additional data (form responses, etc.)
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // User-level personal calendar sync (Google / Microsoft 365)
  calendarSync: {
    googleEventId: { type: String, default: null, trim: true },
    microsoftEventId: { type: String, default: null, trim: true },
    /** When true, last write originated from Google inbound sync */
    fromGoogle: { type: Boolean, default: false }
  },

  // Public booking / appointment extension (Events sub-module)
  appointment: {
    isAppointment: { type: Boolean, default: false, index: true },
    bookingConfigId: { type: Schema.Types.ObjectId, ref: 'AppointmentBookingConfig', default: null },
    publicPageSlug: { type: String, default: null, trim: true },
    bookingSource: {
      type: String,
      enum: ['public_page', 'manual', 'integration', 'campaign'],
      default: null
    },
    meetingType: { type: String, enum: ['online', 'offline'], default: null },
    meetingLink: { type: String, default: null, trim: true, maxlength: 2048 },
    meetingLinkAutoGenerated: { type: Boolean, default: false },
    externalCalendarProvider: {
      type: String,
      enum: ['google', 'microsoft'],
      default: null
    },
    externalCalendarEventId: { type: String, default: null, trim: true },
    customerTimezone: { type: String, default: null, trim: true },
    appointmentType: {
      type: String,
      enum: ['demo', 'support', 'consultation', 'other'],
      default: null
    },
    reminderStatus: {
      type: String,
      enum: ['pending', 'sent', 'none'],
      default: 'pending'
    },
    confirmationEmailSentAt: { type: Date, default: null },
    reminderEmailSentAt: { type: Date, default: null },
    /** Secret token for guest self-service cancel/reschedule (public manage page) */
    manageToken: { type: String, default: null, trim: true, index: true, sparse: true },
    bookedByPersonId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
    bookedByEmail: { type: String, default: null, trim: true, lowercase: true },
    bookedByName: { type: String, default: null, trim: true },
    attendeeCount: { type: Number, default: 1, min: 1 },
    bookingChannel: { type: String, default: 'Web', trim: true },
    cancellationSource: {
      type: String,
      enum: ['customer', 'user', 'system'],
      default: null
    },
    noShow: { type: Boolean, default: false },
    noShowMarkedAt: { type: Date, default: null },
    formResponses: { type: Schema.Types.Mixed, default: {} }
  },

  // Custom fields (user-defined via Settings → Modules & Fields)
  customFields: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  /** System-managed creation channel (set server-side only) */
  source: {
    type: String,
    enum: RECORD_SOURCE_VALUES,
    default: DEFAULT_RECORD_SOURCE
  },

  // Multi-tenancy
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization',
    required: true
  },
  
  // Timestamps (auto-filled)
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
  },

  // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletionReason: { type: String, trim: true, maxlength: 500 }
}, {
  timestamps: false // We use createdTime/modifiedTime instead
});

// Indexes as per specification
eventSchema.index({ assignedTo: 1, startDateTime: 1 }, { name: 'idx_events_owner_start' });
eventSchema.index({ relatedToId: 1 }, { name: 'idx_events_relatedTo' });
eventSchema.index({ organizationId: 1, startDateTime: 1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ organizationId: 1, statusCategory: 1 });
eventSchema.index({ organizationId: 1, eventType: 1 });
eventSchema.index({ organizationId: 1, auditState: 1 });
eventSchema.index({ linkedFormId: 1 });
eventSchema.index({ 'formAssignment.assignedAuditor': 1 });
eventSchema.index({ isMultiOrg: 1, 'orgList.organizationId': 1 });
eventSchema.index({ 'orgList.organizationId': 1, 'orgList.sequence': 1 });
eventSchema.index({ geoRequired: 1, 'checkIn.timestamp': 1 });
eventSchema.index({ executionStartTime: 1 });
eventSchema.index({ organizationId: 1, deletedAt: 1 });
eventSchema.index({ organizationId: 1, 'appointment.isAppointment': 1, startDateTime: 1 });
eventSchema.index({ organizationId: 1, eventNumber: 1 }, { unique: true, sparse: true });
eventSchema.index(
  { organizationId: 1, 'calendarSync.googleEventId': 1 },
  { sparse: true, name: 'idx_events_org_google_event' }
);
// eventId is already indexed via unique: true, no need for explicit index

// Virtual for duration
eventSchema.virtual('duration').get(function() {
  if (this.startDateTime && this.endDateTime) {
    return this.endDateTime - this.startDateTime;
  }
  return null;
});

// Pre-save middleware to update timestamps and add audit entries
eventSchema.pre('save', function(next) {
  const now = new Date();
  
  // Set createdTime on new documents
  if (this.isNew) {
    this.createdTime = now;
    this.modifiedTime = now;
    
    // Default OPEN status; create path sets type-specific OPEN default before save
    if (!this.status) {
      this.status =
        this.eventType === 'Meeting' || this.eventType === 'Meeting / Appointment'
          ? 'Scheduled'
          : 'Planned';
    }
    // Meetings never use "Planned" — normalize legacy values
    if (
      (this.eventType === 'Meeting' || this.eventType === 'Meeting / Appointment') &&
      this.status === 'Planned'
    ) {
      this.status = 'Scheduled';
    }
    if (!this.statusCategory) {
      this.statusCategory = 'OPEN';
    }

    // Add creation audit entry
    if (!this.auditHistory) {
      this.auditHistory = [];
    }
    this.auditHistory.push({
      timestamp: now,
      actorUserId: this.createdBy,
      action: 'created',
      from: null,
      to: null,
      metadata: {
        eventName: this.eventName,
        eventType: this.eventType,
        startDateTime: this.startDateTime,
        status: this.status,
        statusCategory: this.statusCategory,
      }
    });
  } else {
    // Update modifiedTime on existing documents
    this.modifiedTime = now;

    // Meetings never use "Planned" — coerce to Scheduled (OPEN vocab)
    if (
      (this.eventType === 'Meeting' || this.eventType === 'Meeting / Appointment') &&
      this.status === 'Planned'
    ) {
      this.status = 'Scheduled';
    }

    // Align category when status changes without explicit statusCategory
    if (this.isModified('status') && !this.isModified('statusCategory')) {
      const { resolveStatusCategory } = require('../domain/events/eventStatus');
      this.statusCategory = resolveStatusCategory(this.status);
    }
  }
  
  // Backfill statusCategory for legacy documents
  if (!this.statusCategory && this.status) {
    const { resolveStatusCategory } = require('../domain/events/eventStatus');
    this.statusCategory = resolveStatusCategory(this.status);
  }

  // Validate end date is after start date
  if (this.endDateTime && this.startDateTime && this.endDateTime <= this.startDateTime) {
    return next(new Error('End date must be after start date'));
  }

  // Backward-compat normalization: persist the renamed meeting type label.
  if (this.eventType === 'Meeting / Appointment') {
    this.eventType = 'Meeting';
  }
  
  // ===== GEO REQUIRED ENFORCEMENT =====
  // Enforce GEO Required based on event type per spec
  if (this.isNew || this.isModified('eventType')) {
    if (['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType)) {
      // Audit event types: Always ON, cannot be disabled
      this.geoRequired = true;
    } else if (this.eventType === 'Field Sales Beat') {
      // ON by default, but can be disabled by admin
      if (this.geoRequired === undefined || this.geoRequired === null) {
        this.geoRequired = true;
      }
    } else if (this.eventType === 'Meeting / Appointment' || this.eventType === 'Meeting') {
      // OFF by default, but can be enabled
      if (this.geoRequired === undefined || this.geoRequired === null) {
        this.geoRequired = false;
      }
    }
  }

  
  // ===== AUDIT STATE INITIALIZATION =====
  // Set audit state for audit event types
  if (['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(this.eventType)) {
    if (!this.auditState) {
      this.auditState = 'Ready to start';
    }
  } else {
    // Clear audit state for non-audit events
    this.auditState = null;
  }
  
  // ===== MULTI-ORG SETUP =====
  // Auto-set isMultiOrg flag
  if (['External Audit Beat', 'Field Sales Beat'].includes(this.eventType)) {
    this.isMultiOrg = true;
    // Auto-generate route sequence if orgList has more than 1 org
    if (this.orgList && this.orgList.length > 1) {
      this.routeSequence = this.orgList
        .map((org, index) => ({ org, index }))
        .sort((a, b) => a.org.sequence - b.org.sequence)
        .map(item => item.index);
    }
  } else {
    this.isMultiOrg = false;
  }
  
  // ===== STATUS TRANSITION: COMPLETED =====
  // When auditState reaches 'closed' (approved and closed), mark event as Completed
  if (this.auditState === 'closed' && this.status !== 'Completed' && this.status !== 'Cancelled') {
    this.status = 'Completed';
    if (!this.completedAt) {
      this.completedAt = now;
    }
    // Add audit entry for completion
    if (!this.auditHistory) {
      this.auditHistory = [];
    }
    this.auditHistory.push({
      timestamp: now,
      actorUserId: this.modifiedBy || this.createdBy,
      action: 'status_changed',
      from: this.get('status', null, { getters: false }) || 'Planned',
      to: 'Completed',
      metadata: {
        reason: 'Audit workflow completed',
        auditState: this.auditState
      }
    });
  }
  
  next();
});

// ===== AUDIT SELF-REVIEW CONSTRAINTS =====
// Enforce:
// - If reviewerId === auditor (assignedTo), allowSelfReview MUST be true
// - If allowSelfReview = false, reviewerId MUST be different from auditor (assignedTo)
eventSchema.pre('validate', async function assignEventNumber(next) {
  if (!this.eventNumber && this.isNew) {
    try {
      const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
      await assignModuleRecordNumber(this, { moduleKey: 'events', fieldKey: 'eventNumber' });
    } catch (err) {
      return next(err);
    }
  }
  return next();
});

eventSchema.pre('validate', function (next) {
  try {
    // Canonicalize legacy eventType label before enum validation.
    if (this.eventType === 'Meeting / Appointment') {
      this.eventType = 'Meeting';
    }

    const auditTypes = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
    if (!auditTypes.includes(this.eventType)) return next();

    // ===== SELF-REVIEW DEFAULTS (must run before validation) =====
    // Defaults are per audit type:
    // - Internal Audit -> allowSelfReview = true
    // - External Audit — Single Org -> allowSelfReview = false
    // (External Audit Beat defaults to false; can be enabled explicitly if org wants it.)
    if (this.allowSelfReview === undefined || this.allowSelfReview === null) {
      this.allowSelfReview = this.eventType === 'Internal Audit';
    }

    const auditor = this.assignedTo || this.auditorId;
    const reviewer = this.reviewerId;
    if (!auditor || !reviewer) return next();

    const same = auditor.toString() === reviewer.toString();
    if (same && this.allowSelfReview !== true) {
      this.invalidate('allowSelfReview', 'allowSelfReview must be true when Reviewer is the same as Auditor.');
      this.invalidate('reviewerId', 'Reviewer must be different from Auditor unless allowSelfReview is enabled.');
    }

    next();
  } catch (e) {
    next(e);
  }
});

// Method to add audit history entry
eventSchema.methods.addAuditEntry = function(action, actorUserId, from, to, metadata) {
  if (!this.auditHistory) {
    this.auditHistory = [];
  }
  this.auditHistory.push({
    timestamp: new Date(),
    actorUserId: actorUserId,
    action: action,
    from: from,
    to: to,
    metadata: metadata || {}
  });
};

// ===== AUDIT APP SYNC HOOKS =====
// Post-save hook: Sync to Audit App when audit event is created or updated
eventSchema.post('save', async function (doc) {
    try {
        // Only sync audit event types
        const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
        if (!AUDIT_EVENT_TYPES.includes(doc.eventType)) {
            return;
        }
        
        // Sync AuditAssignment (non-blocking)
        const auditSyncService = require('../services/auditSyncService');
        await auditSyncService.syncAuditAssignmentFromEvent(doc);
    } catch (error) {
        // Never throw - log and continue (don't block SALES execution)
        console.error('[Event Model] Error in post-save sync hook:', error.message);
    }
});

module.exports = wrapTenantModel(mongoose.model('Event', eventSchema));
