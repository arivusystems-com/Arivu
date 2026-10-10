/**
 * ============================================================================
 * Communication Model (In-Product Email)
 * ============================================================================
 *
 * Stores sent and received emails tied to records (People, Organizations, etc.).
 * See docs/IN_PRODUCT_EMAIL_PLAN.md for full spec.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Schema = mongoose.Schema;

// Attachment size limits (plan: 10MB per file, 25MB total)
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_ATTACHMENTS_BYTES = 25 * 1024 * 1024; // 25MB

const CommunicationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  kind: { type: String, enum: ['email'], default: 'email' },
  direction: { type: String, enum: ['outbound', 'inbound'], required: true },
  threadId: { type: Schema.Types.ObjectId, ref: 'Communication' },
  parentCommunicationId: { type: Schema.Types.ObjectId, ref: 'Communication', default: null },

  subject: { type: String, trim: true, default: '' },
  body: { type: String, default: '' }, // text or HTML

  fromAddress: { type: String, trim: true },
  toAddresses: [{ type: String, trim: true }],
  ccAddresses: [{ type: String, trim: true }],
  bccAddresses: [{ type: String, trim: true }],

  messageId: { type: String, trim: true }, // RFC Message-ID for In-Reply-To matching
  inReplyTo: { type: String, trim: true },
  references: { type: String, trim: true },
  externalMessageId: { type: String, trim: true }, // SES/nodemailer result.messageId

  sentAt: { type: Date },
  receivedAt: { type: Date },

  /** Absolute UTC when a scheduled outbound email should be sent. */
  scheduledAt: { type: Date, default: null },

  status: {
    type: String,
    enum: ['scheduled', 'sending', 'sent', 'failed', 'delivered', 'opened', 'bounced', 'complained', 'cancelled'],
    default: 'sending'
  },

  relatedTo: {
    moduleKey: { type: String, required: true }, // 'people', 'organizations', 'deals', etc.
    recordId: { type: Schema.Types.ObjectId, required: true }
  },

  /** Optional: workspace mailbox (personal or group) this message belongs to. */
  mailboxId: { type: Schema.Types.ObjectId, ref: 'Mailbox', default: null, index: true },

  sentByUserId: { type: Schema.Types.ObjectId, ref: 'User' },

  attachments: [{
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storagePath: { type: String, required: true }
  }],

  metadata: {
    provider: { type: String },
    amdsMessageId: { type: String, trim: true, default: null },
    deliveryError: { type: String, trim: true, default: null },
    deliveryUpdatedAt: { type: Date, default: null },
    bounceClassification: { type: String, trim: true, default: null },
    bounceDiagnostic: { type: String, trim: true, default: null },
    bounceRecipient: { type: String, trim: true, default: null },
    lastAmdsEvent: { type: String, trim: true, default: null },
    sendErrorCode: { type: String, trim: true, default: null },
    sendErrorDomain: { type: String, trim: true, default: null },
    amdsQueue: { type: String, trim: true, default: null },
    campaignId: { type: String, trim: true, default: null },
    recipientId: { type: String, trim: true, default: null },
    openedAt: { type: Date, default: null },
    openCount: { type: Number, default: null },
    clickedAt: { type: Date, default: null },
    clickedUrl: { type: String, trim: true, default: null },
    clickCount: { type: Number, default: null },
    /** Set when a worker wins the send. A Bull retry must not send again. */
    sendClaimId: { type: String, trim: true, default: null }
  },

  idempotencyKey: { type: String, trim: true },
  idempotencyKeyHash: { type: String, trim: true, index: true },

  /** Stable id for provider inbox sync dedupe, e.g. `gmail:<apiMessageId>`. */
  providerMessageKey: { type: String, trim: true, default: null },
  /** Native provider thread id (e.g. Gmail threadId) for dual threading (blueprint R1). */
  providerThreadId: { type: String, trim: true, default: null },

  /** Gmail label ids at import time (e.g. INBOX, STARRED) for workspace inbox filtering. */
  gmailLabelIds: [{ type: String, trim: true, maxlength: 128 }],

  /**
   * Optional follow-up reminder set at compose time (associated with this email record).
   * remindAt is absolute UTC from send time + days; status drives future delivery jobs.
   */
  followUpReminder: {
    days: { type: Number, min: 1, max: 365, default: null },
    remindAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['none', 'pending', 'delivered', 'cancelled'],
      default: 'none'
    }
  }
}, {
  timestamps: true
});

// Indexes per docs/IN_PRODUCT_EMAIL_PLAN.md
CommunicationSchema.index({ organizationId: 1, 'relatedTo.moduleKey': 1, 'relatedTo.recordId': 1, threadId: 1 });
CommunicationSchema.index(
  { organizationId: 1, providerMessageKey: 1 },
  { unique: true, partialFilterExpression: { providerMessageKey: { $exists: true, $type: 'string', $ne: '' } } }
);
CommunicationSchema.index({ organizationId: 1, mailboxId: 1, receivedAt: -1 });
CommunicationSchema.index({ externalMessageId: 1 });
CommunicationSchema.index({ messageId: 1 });
CommunicationSchema.index({ parentCommunicationId: 1 });
CommunicationSchema.index(
  { organizationId: 1, idempotencyKeyHash: 1 },
  { unique: true, partialFilterExpression: { idempotencyKeyHash: { $exists: true, $type: 'string' } } }
);
CommunicationSchema.index(
  { organizationId: 1, 'followUpReminder.status': 1, 'followUpReminder.remindAt': 1 },
  {
    partialFilterExpression: {
      'followUpReminder.status': 'pending',
      'followUpReminder.remindAt': { $exists: true, $type: 'date' }
    }
  }
);
CommunicationSchema.index(
  { status: 1, scheduledAt: 1 },
  {
    partialFilterExpression: {
      status: 'scheduled',
      scheduledAt: { $exists: true, $type: 'date' }
    }
  }
);

const Communication = mongoose.model('Communication', CommunicationSchema);

module.exports = wrapTenantModel(Communication);
module.exports.MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_BYTES;
module.exports.MAX_TOTAL_ATTACHMENTS_BYTES = MAX_TOTAL_ATTACHMENTS_BYTES;
