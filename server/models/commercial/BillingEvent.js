'use strict';

const mongoose = require('mongoose');
const {
  BILLING_EVENT_TYPES,
  BILLING_EVENT_STATUSES,
} = require('../../constants/commercialBilling');

/**
 * Idempotent commercial billing events.
 * Controllers emit events; billingService alone mutates subscription/invoices.
 */
const BillingEventSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: Object.values(BILLING_EVENT_TYPES),
    required: true,
    index: true,
  },
  /** Client/server idempotency key — unique per org. */
  idempotencyKey: {
    type: String,
    required: true,
    trim: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: Object.values(BILLING_EVENT_STATUSES),
    default: BILLING_EVENT_STATUSES.PENDING,
    index: true,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  errorMessage: {
    type: String,
    trim: true,
    default: null,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  initiatedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
  collection: 'billing_events',
});

BillingEventSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, name: 'billing_event_idempotency' }
);

module.exports = mongoose.model('BillingEvent', BillingEventSchema);
