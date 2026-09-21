'use strict';

const mongoose = require('mongoose');
const {
  SUBSCRIPTION_STATUSES,
  BILLING_PERIODS,
  CURRENCY_INR,
} = require('../../constants/commercialBilling');

/**
 * Organization commercial subscription (one primary per org).
 * Distinct from OrganizationSubscription (runtime app/addon seats).
 * Master DB — not tenant-proxied.
 */
const BillingSubscriptionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(SUBSCRIPTION_STATUSES),
    default: SUBSCRIPTION_STATUSES.TRIALING,
    index: true,
  },
  billingCycle: {
    type: String,
    enum: Object.values(BILLING_PERIODS),
    default: BILLING_PERIODS.MONTHLY,
  },
  currency: {
    type: String,
    uppercase: true,
    default: CURRENCY_INR,
  },
  pricingProgramCode: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
    index: true,
  },
  priceProtectionExpiresAt: {
    type: Date,
    default: null,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  currentPeriodStart: {
    type: Date,
    default: null,
  },
  currentPeriodEnd: {
    type: Date,
    default: null,
  },
  trialEnd: {
    type: Date,
    default: null,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  /** Scheduled cycle change at period end (monthly ↔ annual). */
  pendingBillingCycle: {
    type: String,
    enum: Object.values(BILLING_PERIODS),
    default: null,
  },
  canceledAt: {
    type: Date,
    default: null,
  },
  /** Credit balance in minor units applied to next invoice. */
  creditBalanceMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  /**
   * One-shot sales deal discount (paise) applied on the next period invoice draft, then cleared.
   * Not used for proration invoices.
   */
  pendingDiscountMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  pendingDiscountReason: {
    type: String,
    trim: true,
    default: null,
    maxlength: 500,
  },
  /**
   * Repeating sales deal: ₹ off each period invoice until remaining periods hit 0.
   * Counted in billing periods (monthly: 12 ≈ 1 year; annual: 1 ≈ 1 year).
   */
  recurringDiscountMinor: {
    type: Number,
    default: 0,
    min: 0,
  },
  recurringDiscountPeriodsRemaining: {
    type: Number,
    default: 0,
    min: 0,
  },
  recurringDiscountPeriodsTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  recurringDiscountReason: {
    type: String,
    trim: true,
    default: null,
    maxlength: 500,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_subscriptions',
});

module.exports = mongoose.model('BillingSubscription', BillingSubscriptionSchema);
