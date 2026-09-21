'use strict';

const mongoose = require('mongoose');
const {
  ENTITLEMENT_TYPES,
  ENTITLEMENT_SCOPES,
} = require('../../constants/commercialBilling');

/**
 * What the org/user is allowed to use commercially.
 * Authorization consumes this; it does not encode role permissions.
 */
const BillingEntitlementSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: Object.values(ENTITLEMENT_TYPES),
    required: true,
    index: true,
  },
  scope: {
    type: String,
    enum: Object.values(ENTITLEMENT_SCOPES),
    required: true,
  },
  /** Null when scope === organization. */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  productCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  appKey: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 0,
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'revoked', 'expired'],
    default: 'active',
    index: true,
  },
  effectiveFrom: {
    type: Date,
    default: Date.now,
  },
  effectiveTo: {
    type: Date,
    default: null,
  },
  sourceSubscriptionItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingSubscriptionItem',
    default: null,
  },
}, {
  timestamps: true,
  collection: 'billing_entitlements',
});

BillingEntitlementSchema.index(
  { organizationId: 1, type: 1, userId: 1, productCode: 1, status: 1 },
  { name: 'billing_entitlement_lookup' }
);

module.exports = mongoose.model('BillingEntitlement', BillingEntitlementSchema);
