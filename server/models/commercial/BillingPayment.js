'use strict';

const mongoose = require('mongoose');

/**
 * Payment against a platform SaaS BillingInvoice (master DB).
 * Distinct from CRM PaymentAllocation.
 */
const BillingPaymentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingInvoice',
    required: true,
    index: true,
  },
  amountMinor: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    uppercase: true,
    required: true,
  },
  method: {
    type: String,
    enum: ['manual', 'razorpay', 'stripe', 'bank_transfer', 'other'],
    default: 'manual',
  },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'succeeded', 'failed', 'rejected', 'refunded'],
    default: 'succeeded',
    index: true,
  },
  providerReference: {
    type: String,
    trim: true,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  recordedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  paidAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_payments',
});

BillingPaymentSchema.index({ invoiceId: 1, createdAt: -1 });
BillingPaymentSchema.index(
  { providerReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerReference: { $type: 'string' },
    },
  }
);

module.exports = mongoose.model('BillingPayment', BillingPaymentSchema);
