'use strict';

const mongoose = require('mongoose');
const {
  ITEM_STATUSES,
  PRICING_MODELS,
  BILLING_PERIODS,
} = require('../../constants/commercialBilling');

/**
 * Billable line on a commercial subscription.
 * unitAmountMinor is snapshotted at attach time — never recalculate from live catalog.
 */
const BillingSubscriptionItemSchema = new mongoose.Schema({
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingSubscription',
    required: true,
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingProduct',
    required: true,
  },
  productCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  priceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingPrice',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 1,
  },
  /** Snapshotted unit price (paise). */
  unitAmountMinor: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    uppercase: true,
    required: true,
  },
  billingModel: {
    type: String,
    enum: Object.values(PRICING_MODELS),
    required: true,
  },
  billingPeriod: {
    type: String,
    enum: Object.values(BILLING_PERIODS),
    required: true,
  },
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now,
  },
  effectiveTo: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: Object.values(ITEM_STATUSES),
    default: ITEM_STATUSES.ACTIVE,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_subscription_items',
});

BillingSubscriptionItemSchema.index(
  { subscriptionId: 1, productCode: 1, status: 1 },
  { name: 'billing_item_product_status' }
);

module.exports = mongoose.model('BillingSubscriptionItem', BillingSubscriptionItemSchema);
