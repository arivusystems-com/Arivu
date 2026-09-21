'use strict';

const mongoose = require('mongoose');
const {
  INVOICE_STATUSES,
  CURRENCY_INR,
} = require('../../constants/commercialBilling');

/**
 * Platform SaaS invoice (immutable once paid).
 * Unpaid draft/finalized/past_due may be revised in place (discounts) with snapshot.revisions audit.
 * Distinct from CRM Invoice (customer AR).
 */
const BillingInvoiceSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingSubscription',
    required: true,
    index: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  status: {
    type: String,
    enum: Object.values(INVOICE_STATUSES),
    default: INVOICE_STATUSES.DRAFT,
    index: true,
  },
  currency: {
    type: String,
    uppercase: true,
    default: CURRENCY_INR,
  },
  periodStart: {
    type: Date,
    required: true,
  },
  periodEnd: {
    type: Date,
    required: true,
  },
  subtotalMinor: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  discountMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  creditAppliedMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalMinor: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  taxDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  finalizedAt: {
    type: Date,
    default: null,
  },
  dueAt: {
    type: Date,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  /** Cumulative succeeded payments (minor units). */
  amountPaidMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Snapshot of subscription commercial context at finalize time. */
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_invoices',
});

module.exports = mongoose.model('BillingInvoice', BillingInvoiceSchema);
