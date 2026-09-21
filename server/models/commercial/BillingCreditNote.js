'use strict';

const mongoose = require('mongoose');
const { CURRENCY_INR } = require('../../constants/commercialBilling');

/**
 * Immutable commercial credit note (ops / system).
 * Does not mutate finalized invoices — applies as subscription credit balance.
 */
const BillingCreditNoteSchema = new mongoose.Schema({
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
  /** Source invoice when issued against a specific bill; null for goodwill credit. */
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingInvoice',
    default: null,
    index: true,
  },
  creditNoteNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  currency: {
    type: String,
    uppercase: true,
    default: CURRENCY_INR,
  },
  amountMinor: {
    type: Number,
    required: true,
    min: 1,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  /** goodwill | invoice_adjustment | void_companion */
  kind: {
    type: String,
    enum: ['goodwill', 'invoice_adjustment', 'void_companion'],
    default: 'goodwill',
  },
  issuedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  issuedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_credit_notes',
});

module.exports = mongoose.model('BillingCreditNote', BillingCreditNoteSchema);
