const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_DEFAULT,
  SALES_ORDER_SOURCE_TYPES
} = require('../constants/salesOrderLifecycle');
const {
  SALES_ORDER_FULFILLMENT_MODES,
  SALES_ORDER_FULFILLMENT_MODE_DEFAULT,
  SALES_ORDER_HEADER_FULFILLMENT_STATUSES,
  SALES_ORDER_HEADER_FULFILLMENT_DEFAULT
} = require('../constants/salesOrderFulfillment');

const { Schema } = mongoose;

const SalesOrderSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    salesOrderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    salesOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    orderTitle: { type: String, trim: true, default: null },
    orderDate: { type: Date, default: Date.now, index: true },
    requestedDeliveryDate: { type: Date, default: null },
    promisedDeliveryDate: { type: Date, default: null },

    status: {
      type: String,
      enum: SALES_ORDER_STATUSES,
      required: true,
      default: SALES_ORDER_STATUS_DEFAULT,
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

    fulfillmentMode: {
      type: String,
      enum: SALES_ORDER_FULFILLMENT_MODES,
      default: SALES_ORDER_FULFILLMENT_MODE_DEFAULT,
      index: true
    },

    fulfillmentStatus: {
      type: String,
      enum: SALES_ORDER_HEADER_FULFILLMENT_STATUSES,
      default: SALES_ORDER_HEADER_FULFILLMENT_DEFAULT,
      index: true
    },

    currency: { type: String, trim: true, default: 'USD', index: true },
    exchangeRateSnapshot: { type: Number, default: 1 },

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

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    customerId: { type: Schema.Types.ObjectId, default: null, index: true },
    organizationRefId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', default: null, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null, index: true },

    billToAddressSnapshot: { type: Schema.Types.Mixed, default: null },
    shipToAddressSnapshot: { type: Schema.Types.Mixed, default: null },

    paymentTermsSnapshot: { type: String, trim: true, default: null },
    incotermsSnapshot: { type: String, trim: true, default: null },
    termsConditionsSnapshot: { type: String, default: null },

    internalNotes: { type: String, default: null },
    customerNotes: { type: String, default: null },

    sourceType: {
      type: String,
      enum: SALES_ORDER_SOURCE_TYPES,
      default: 'manual',
      index: true
    },

    sourceQuoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
    sourceQuoteNumber: { type: String, trim: true, default: null, index: true },
    sourceRevisionNumber: { type: Number, default: null, min: 1 },
    quoteConversionLinkId: {
      type: Schema.Types.ObjectId,
      ref: 'QuoteConversionLink',
      default: null,
      index: true
    },

    conversionType: { type: String, trim: true, default: null },

    lineageType: {
      type: String,
      trim: true,
      default: 'standalone',
      index: true
    },
    parentSalesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    rootSalesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    mergedFromSalesOrderIds: [{ type: Schema.Types.ObjectId, ref: 'SalesOrder' }],
    mergedIntoSalesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },

    invoiceStatus: {
      type: String,
      trim: true,
      default: 'not_invoiced',
      index: true
    },
    invoicedAmount: { type: Number, default: 0 },
    remainingBillableAmount: { type: Number, default: 0 },

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

SalesOrderSchema.index({ organizationId: 1, salesOrderNumber: 1 }, { unique: true });
SalesOrderSchema.index({ organizationId: 1, sourceQuoteId: 1 });
SalesOrderSchema.index({ organizationId: 1, rootSalesOrderId: 1 });

SalesOrderSchema.pre('validate', async function assignSalesOrderIds(next) {
  try {
    if (!this.salesOrderId) {
      const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      this.salesOrderId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
    }
    if (this.salesOrderNumber) return next();

    const { allocate } = require('../services/moduleNumberingService');
    const result = await allocate({
      organizationId: this.organizationId,
      moduleKey: 'sales_orders',
    });
    if (result?.recordId) {
      this.salesOrderNumber = result.recordId;
      return next();
    }
    const SalesOrder = this.constructor;
    const count = await SalesOrder.countDocuments({ organizationId: this.organizationId });
    this.salesOrderNumber = `SO-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('SalesOrder', SalesOrderSchema));
