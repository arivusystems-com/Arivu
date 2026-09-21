'use strict';

const mongoose = require('mongoose');

/**
 * Line on a platform invoice (price snapshot).
 * Qty/unit are fixed after create; unpaid negotiation may adjust discountMinor only.
 */
const BillingInvoiceLineSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingInvoice',
    required: true,
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  productCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitAmountMinor: {
    type: Number,
    required: true,
    min: 0,
  },
  /** Line-level discount (paise), applied before amountMinor. */
  discountMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Net line amount after line discount (qty × unit − discountMinor). */
  amountMinor: {
    type: Number,
    required: true,
    min: 0,
  },
  taxMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    uppercase: true,
    required: true,
  },
  priceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingPrice',
    default: null,
  },
  subscriptionItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingSubscriptionItem',
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_invoice_lines',
});

module.exports = mongoose.model('BillingInvoiceLine', BillingInvoiceLineSchema);
