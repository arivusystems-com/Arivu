'use strict';

const mongoose = require('mongoose');
const {
  BILLING_PERIODS,
  PRICING_MODELS,
  PRICE_STATUSES,
  CURRENCY_INR,
} = require('../../constants/commercialBilling');

/**
 * Versioned price for a product. Never mutate amount — supersede with a new row.
 * Master DB — not tenant-proxied.
 */
const BillingPriceSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingProduct',
    required: true,
    index: true,
  },
  productCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  pricingProgramCode: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  billingPeriod: {
    type: String,
    required: true,
    enum: Object.values(BILLING_PERIODS),
    index: true,
  },
  pricingModel: {
    type: String,
    required: true,
    enum: Object.values(PRICING_MODELS),
    default: PRICING_MODELS.PER_UNIT,
  },
  /** Unit amount in minor currency units (paise for INR). */
  amountMinor: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: CURRENCY_INR,
  },
  /**
   * Optional tiers for portal / usage models.
   * [{ upTo: 50, amountMinor }, { upTo: null, amountMinor }]
   */
  tiers: {
    type: [{
      upTo: { type: Number, default: null },
      amountMinor: { type: Number, required: true, min: 0 },
    }],
    default: undefined,
  },
  includedQuantity: {
    type: Number,
    default: null,
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
    enum: Object.values(PRICE_STATUSES),
    default: PRICE_STATUSES.ACTIVE,
    index: true,
  },
  label: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'billing_prices',
});

BillingPriceSchema.index(
  { productCode: 1, pricingProgramCode: 1, billingPeriod: 1, status: 1, effectiveFrom: -1 },
  { name: 'billing_price_lookup' }
);

module.exports = mongoose.model('BillingPrice', BillingPriceSchema);
