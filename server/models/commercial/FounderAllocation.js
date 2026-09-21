'use strict';

const mongoose = require('mongoose');

/**
 * Auditable Founder Launch slot allocation (capacity 100).
 * Master DB — not tenant-proxied.
 */
const FounderAllocationSchema = new mongoose.Schema({
  pricingProgramCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    default: 'founder_launch',
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true,
  },
  billingSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingSubscription',
    default: null,
  },
  status: {
    type: String,
    enum: ['reserved', 'activated', 'released', 'expired'],
    default: 'reserved',
    index: true,
  },
  reservedAt: {
    type: Date,
    default: Date.now,
  },
  activatedAt: {
    type: Date,
    default: null,
  },
  priceProtectionExpiresAt: {
    type: Date,
    default: null,
  },
  releasedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'billing_founder_allocations',
});

module.exports = mongoose.model('FounderAllocation', FounderAllocationSchema);
