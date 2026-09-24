const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { QUOTE_STATUSES, QUOTE_STATUS_DEFAULT } = require('../constants/quoteLifecycle');

const { Schema } = mongoose;

const QuoteSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    // Human-friendly quote number (per org), e.g. QT-0001
    quoteNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    revisionNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      index: true
    },

    activeRevision: {
      type: Boolean,
      default: true,
      index: true
    },

    sourceQuoteId: {
      type: Schema.Types.ObjectId,
      ref: 'Quote',
      default: null,
      index: true
    },

    quoteTitle: {
      type: String,
      trim: true,
      default: null
    },

    quoteDate: {
      type: Date,
      default: Date.now
    },

    validUntil: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: QUOTE_STATUSES,
      required: true,
      default: QUOTE_STATUS_DEFAULT,
      index: true
    },

    lifecycleState: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true
    },
    closedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },

    // Multi-currency snapshot fields (MVP: store; FX service can fill later)
    currency: { type: String, trim: true, default: 'USD', index: true },
    exchangeRateSnapshot: { type: Number, default: 1 },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Optional links (module-agnostic; do not require Sales)
    customerId: { type: Schema.Types.ObjectId, default: null, index: true },
    organizationRefId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', default: null, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null, index: true },
    customRecordId: { type: Schema.Types.ObjectId, default: null, index: true },

    // Source metadata (analytics + automation)
    sourceContext: {
      type: String,
      trim: true,
      default: 'manual',
      index: true
    },
    sourceRef: {
      type: Schema.Types.Mixed,
      default: null
      // e.g. { moduleKey, recordId }
    },

    // Quote-level discount (applied after line discounts)
    globalDiscountType: { type: String, trim: true, default: null },
    globalDiscountValue: { type: Number, default: 0 },
    globalDiscountAmount: { type: Number, default: 0 },

    // Totals snapshots (authoritative, computed by quoteTotalsService later)
    subtotal: { type: Number, default: 0 },
    lineDiscountTotal: { type: Number, default: 0 },
    globalDiscountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    chargesTotal: { type: Number, default: 0 },
    adjustmentTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    /** Applied transaction-level taxes (engine snapshots) */
    transactionTaxSnapshot: { type: Schema.Types.Mixed, default: { taxes: [] } },
    /** Applied transaction-level charges (engine snapshots) */
    chargeDocumentSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
    taxDocumentSnapshot: { type: Schema.Types.Mixed, default: {} },

    // Approval/sharing/conversion flags (detailed entities come in later phases)
    approvalRequired: { type: Boolean, default: false, index: true },
    approvalStatus: { type: String, trim: true, default: 'Not Required', index: true },
    approvalLocked: { type: Boolean, default: false, index: true },

    sentToCustomer: { type: Boolean, default: false, index: true },
    sentAt: { type: Date, default: null },
    publicShareToken: { type: String, default: null, index: true },
    portalAccessEnabled: { type: Boolean, default: false },
    /** null | draft (provisional) | formal (binding customer release) */
    customerShareMode: { type: String, trim: true, default: null, index: true },
    draftSharedAt: { type: Date, default: null },

    /** Customer portal response (accept full/partial, reject) */
    customerResponse: {
      responseType: { type: String, trim: true, default: null },
      acceptedLineIds: { type: [String], default: [] },
      acceptedSectionIds: { type: [String], default: [] },
      acceptedSubtotal: { type: Number, default: null },
      acceptedTaxTotal: { type: Number, default: null },
      acceptedGrandTotal: { type: Number, default: null },
      comment: { type: String, trim: true, default: null, maxlength: 2000 },
      signerName: { type: String, trim: true, default: null, maxlength: 200 },
      signatureText: { type: String, trim: true, default: null, maxlength: 200 },
      signatureSignedAt: { type: Date, default: null },
      agreedToTerms: { type: Boolean, default: null },
      agreedToTermsAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null }
    },

    converted: { type: Boolean, default: false, index: true },
    conversionStatus: { type: String, trim: true, default: 'Not Converted', index: true },

    // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 },

    // Custom fields (metadata-driven; controlled by ModuleDefinition)
    customFields: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Ensure uniqueness per org (and allow future multi-tenant DB separation)
QuoteSchema.index({ organizationId: 1, quoteNumber: 1, revisionNumber: 1 }, { unique: true });

// Assign before Mongoose required-field validation (pre('save') runs too late).
QuoteSchema.pre('validate', async function generateQuoteNumber(next) {
  if (this.quoteNumber) return next();
  try {
    const { allocate } = require('../services/moduleNumberingService');
    const result = await allocate({
      organizationId: this.organizationId,
      moduleKey: 'quotes',
    });
    if (result?.recordId) {
      this.quoteNumber = result.recordId;
      return next();
    }
    // Auto-numbering disabled: keep legacy fallback so required field still validates
    const QuoteModel = this.constructor;
    const count = await QuoteModel.countDocuments({ organizationId: this.organizationId });
    this.quoteNumber = `QT-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (e) {
    return next(e);
  }
});

module.exports = wrapTenantModel(mongoose.model('Quote', QuoteSchema));

