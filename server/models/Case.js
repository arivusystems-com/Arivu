const mongoose = require('mongoose');
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_CHANNELS
} = require('../constants/caseLifecycle');

const { Schema } = mongoose;

const CaseActivitySchema = new Schema(
  {
    activityType: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      trim: true
    },
    channel: {
      type: String,
      trim: true
    },
    internal: {
      type: Boolean,
      default: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    actorName: {
      type: String,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const SlaCycleSchema = new Schema(
  {
    cycleNo: { type: Number, required: true, min: 1 },
    startedAt: { type: Date, required: true },
    pausedAt: { type: Date, default: null },
    pauseSegments: {
      type: [{
        from: { type: Date, required: true },
        to: { type: Date, required: true }
      }],
      default: []
    },
    stoppedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['running', 'paused', 'stopped'],
      default: 'running'
    },
    responseTargetAt: { type: Date, default: null },
    responseMetAt: { type: Date, default: null },
    resolutionTargetAt: { type: Date, default: null },
    policySnapshot: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const CaseSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    caseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: null
    },
    caseType: {
      type: String,
      enum: CASE_TYPES,
      required: true,
      default: 'Support Ticket'
    },
    priority: {
      type: String,
      enum: CASE_PRIORITIES,
      required: true,
      default: 'Medium'
    },
    status: {
      type: String,
      enum: CASE_STATUSES,
      required: true,
      default: 'New',
      index: true
    },
    severity: { type: String, default: null, trim: true },
    impact: { type: String, default: null, trim: true },
    tags: { type: [String], default: [] },
    aiAssist: {
      type: Schema.Types.Mixed,
      default: null,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'People',
      default: null
    },
    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null
    },
    requesterEmail: { type: String, trim: true, default: null },
    requesterPhone: { type: String, trim: true, default: null },
    preferredLanguage: { type: String, trim: true, default: null },
    customerTier: { type: String, trim: true, default: null },
    vipCustomer: { type: Boolean, default: false },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    team: { type: String, trim: true, default: null },
    queue: { type: String, trim: true, default: null },
    escalationLevel: { type: String, trim: true, default: null },
    watchers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    channel: {
      type: String,
      enum: CASE_CHANNELS,
      default: 'Internal'
    },
    relatedItemIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Item'
      }
    ],
    serialNumber: { type: String, trim: true, default: null },
    warrantyStatus: { type: String, trim: true, default: null },
    amcStatus: { type: String, trim: true, default: null },
    productVersion: { type: String, trim: true, default: null },
    environment: { type: String, trim: true, default: null },
    caseNotes: {
      type: String,
      trim: true
    },
    resolutionSummary: {
      type: String,
      trim: true
    },
    rootCause: { type: String, trim: true, default: null },
    resolutionCode: { type: String, trim: true, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    closureNotes: { type: String, trim: true, default: null },
    customerConfirmation: { type: Boolean, default: false },
    currentSlaCycle: {
      type: SlaCycleSchema,
      required: true
    },
    slaCycles: {
      type: [SlaCycleSchema],
      default: []
    },
    activities: {
      type: [CaseActivitySchema],
      default: []
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {}
    },
    source: {
      type: String,
      enum: RECORD_SOURCE_VALUES,
      default: DEFAULT_RECORD_SOURCE
    },
    slaPolicyKey: { type: String, trim: true, default: null },
    firstResponseDueAt: { type: Date, default: null },
    resolutionDueAt: { type: Date, default: null },
    slaStatus: { type: String, trim: true, default: null },
    slaBreached: { type: Boolean, default: false },
    businessHoursCalendarId: { type: Schema.Types.ObjectId, ref: 'BusinessHourSet', default: null },
    reopenCount: { type: Number, default: 0, min: 0 },
    reopenReason: { type: String, trim: true, default: null, maxlength: 1000 },
    /** Closed Records lifecycle — Active/Closed (status value unchanged) */
    lifecycleState: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true
    },
    closedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
    lastSlaEventAt: { type: Date, default: null },
    lastCustomerReplyAt: { type: Date, default: null },
    lastAgentReplyAt: { type: Date, default: null },
    preferredReplyChannel: { type: String, trim: true, default: null },
    ccEmails: { type: [String], default: [] },
    conversationCount: { type: Number, default: 0, min: 0 },
    mergeParentCaseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    duplicateFlag: { type: Boolean, default: false },
    sourceMessageId: { type: String, trim: true, default: null },
    threadId: { type: String, trim: true, default: null },
    assignmentControl: {
      isLocked: { type: Boolean, default: false },
      lockReason: { type: String, default: null, trim: true },
      lockRuleId: { type: String, default: null, trim: true },
      lockedAt: { type: Date, default: null },
      lockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      manualOverrideAt: { type: Date, default: null },
      previousOwnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    },
    siteVisitRequired: { type: Boolean, default: false },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    visitDate: { type: Date, default: null },
    visitStatus: { type: String, trim: true, default: null },
    replacementRequired: { type: Boolean, default: false },
    sentiment: { type: String, trim: true, default: null },
    aiSummary: { type: String, trim: true, default: null },
    suggestedResolution: { type: String, trim: true, default: null },
    categoryConfidenceScore: { type: Number, default: null, min: 0, max: 1 },
    autoClassification: { type: Boolean, default: false },
    portalReadReceipts: {
      type: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        readAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    portalCsat: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, trim: true, maxlength: 2000, default: null },
      submittedAt: { type: Date, default: null },
      submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

CaseSchema.index({ organizationId: 1, status: 1, priority: 1 });
CaseSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });

CaseSchema.statics.CASE_TYPES = CASE_TYPES;
CaseSchema.statics.CASE_PRIORITIES = CASE_PRIORITIES;
CaseSchema.statics.CASE_STATUSES = CASE_STATUSES;
CaseSchema.statics.CASE_CHANNELS = CASE_CHANNELS;

module.exports = wrapTenantModel(mongoose.model('Case', CaseSchema));
