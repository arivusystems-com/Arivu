const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVOICE_STATUSES,
  INVOICE_STATUS_DEFAULT,
  INVOICE_SOURCE_TYPES,
  INVOICE_TYPES,
  INVOICE_TYPE_DEFAULT
} = require('../constants/invoiceLifecycle');
const { IRN_STATUS_VALUES } = require('../constants/indiaGstConstants');

const { Schema } = mongoose;

const InvoiceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    invoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    invoiceTitle: { type: String, trim: true, default: null },
    invoiceType: {
      type: String,
      enum: INVOICE_TYPES,
      default: INVOICE_TYPE_DEFAULT,
      index: true
    },

    status: {
      type: String,
      enum: INVOICE_STATUSES,
      required: true,
      default: INVOICE_STATUS_DEFAULT,
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

    invoiceDate: { type: Date, default: Date.now, index: true },
    dueDate: { type: Date, default: null },
    postedAt: { type: Date, default: null, index: true },
    voidedAt: { type: Date, default: null },

    currency: { type: String, trim: true, default: 'USD', index: true },
    exchangeRateSnapshot: { type: Number, default: 1 },

    customerId: { type: Schema.Types.ObjectId, default: null, index: true },
    organizationRefId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', default: null, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    billToAddressSnapshot: { type: Schema.Types.Mixed, default: null },
    shipToAddressSnapshot: { type: Schema.Types.Mixed, default: null },
    paymentTermsSnapshot: { type: String, trim: true, default: null },
    incotermsSnapshot: { type: String, trim: true, default: null },
    termsConditionsSnapshot: { type: String, default: null },

    globalDiscountType: { type: String, trim: true, default: null },
    globalDiscountValue: { type: Number, default: 0 },
    globalDiscountAmount: { type: Number, default: 0 },

    subtotal: { type: Number, default: 0 },
    lineDiscountTotal: { type: Number, default: 0 },
    sectionDiscountTotal: { type: Number, default: 0 },
    globalDiscountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    chargesTotal: { type: Number, default: 0 },
    adjustmentTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    transactionTaxSnapshot: { type: Schema.Types.Mixed, default: { taxes: [] } },
    chargeDocumentSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
    taxDocumentSnapshot: { type: Schema.Types.Mixed, default: {} },

    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    writeOffTotal: { type: Number, default: 0 },
    creditAppliedTotal: { type: Number, default: 0 },

    sourceType: {
      type: String,
      enum: INVOICE_SOURCE_TYPES,
      default: 'manual',
      index: true
    },
    sourceSalesOrderIds: [{ type: Schema.Types.ObjectId, ref: 'SalesOrder' }],
    sourceInvoiceId: { type: String, trim: true, default: null, index: true },
    creditReason: { type: String, trim: true, default: null, index: true },
    creditReasonNote: { type: String, trim: true, maxlength: 500, default: null },

    sourceContext: {
      type: String,
      trim: true,
      default: 'manual',
      index: true
    },
    sourceRef: {
      type: Schema.Types.Mixed,
      default: null
    },

    approvalRequired: { type: Boolean, default: false, index: true },
    approvalStatus: { type: String, trim: true, default: 'none', index: true },
    approvalLocked: { type: Boolean, default: false, index: true },

    paymentStatus: {
      type: String,
      trim: true,
      default: 'unpaid',
      index: true
    },
    lastPaymentAt: { type: Date, default: null },

    // India GST (GTM-1) — e-invoice / e-way bill hooks
    placeOfSupply: { type: String, trim: true, default: null },
    partyGstin: { type: String, trim: true, uppercase: true, default: null },
    irn: { type: String, trim: true, default: null, index: true },
    irnStatus: {
      type: String,
      enum: IRN_STATUS_VALUES,
      default: 'not_generated',
      index: true
    },
    qrPayload: { type: String, default: null },
    ackNo: { type: String, trim: true, default: null },
    ackDate: { type: Date, default: null },
    ewayBillNo: { type: String, trim: true, default: null, index: true },
    ewayBillDate: { type: Date, default: null },

    // External sync triad (Tally / accounting connectors)
    externalReferenceId: { type: String, trim: true, default: null, index: true },
    syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
    lastSyncAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 },

    customFields: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

InvoiceSchema.pre('validate', async function assignInvoiceIds(next) {
  try {
    if (!this.invoiceId) {
      const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      this.invoiceId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
    }
    if (this.invoiceNumber) return next();

    const invoiceType = String(this.invoiceType || INVOICE_TYPE_DEFAULT);
    const { allocate, resolveInvoiceModuleKey } = require('../services/moduleNumberingService');
    const result = await allocate({
      organizationId: this.organizationId,
      moduleKey: resolveInvoiceModuleKey(invoiceType),
    });
    if (result?.recordId) {
      this.invoiceNumber = result.recordId;
      return next();
    }
    const InvoiceModel = this.constructor;
    const prefix = invoiceType === 'credit_note' ? 'CN' : 'INV';
    const count = await InvoiceModel.countDocuments({
      organizationId: this.organizationId,
      invoiceType
    });
    this.invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('Invoice', InvoiceSchema));
