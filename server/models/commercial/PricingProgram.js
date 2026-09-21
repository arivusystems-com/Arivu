'use strict';

const mongoose = require('mongoose');
const { FOUNDER_LAUNCH } = require('../../constants/commercialBilling');

/**
 * Commercial pricing program (Founder Launch, Standard, Enterprise).
 * Prefer this over Organization.isFounder boolean.
 * Master DB — not tenant-proxied.
 */
const PricingProgramSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  capacity: {
    type: Number,
    default: null,
  },
  claimed: {
    type: Number,
    default: 0,
    min: 0,
  },
  priceProtectionMonths: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  collection: 'billing_pricing_programs',
});

PricingProgramSchema.virtual('remaining').get(function remaining() {
  if (this.capacity == null) return null;
  return Math.max(0, this.capacity - (this.claimed || 0));
});

PricingProgramSchema.set('toJSON', { virtuals: true });
PricingProgramSchema.set('toObject', { virtuals: true });

PricingProgramSchema.statics.founderDefaults = function founderDefaults() {
  return {
    code: FOUNDER_LAUNCH.code,
    name: FOUNDER_LAUNCH.name,
    description: 'First 100 customers — 24 months Founder price protection.',
    capacity: FOUNDER_LAUNCH.capacity,
    claimed: 0,
    priceProtectionMonths: FOUNDER_LAUNCH.priceProtectionMonths,
    status: 'active',
  };
};

module.exports = mongoose.model('PricingProgram', PricingProgramSchema);
