'use strict';

const mongoose = require('mongoose');

/**
 * Consumed usage (portal seats, storage, AI credits, etc.).
 * Separate from entitlements and catalog prices.
 */
const BillingUsageSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  metricCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  unit: {
    type: String,
    trim: true,
    default: 'count',
  },
  periodStart: {
    type: Date,
    required: true,
  },
  periodEnd: {
    type: Date,
    required: true,
  },
  recordedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_usage',
});

BillingUsageSchema.index(
  { organizationId: 1, metricCode: 1, periodStart: 1, periodEnd: 1 },
  { name: 'billing_usage_period', unique: true }
);

module.exports = mongoose.model('BillingUsage', BillingUsageSchema);
