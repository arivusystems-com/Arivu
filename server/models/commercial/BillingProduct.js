'use strict';

const mongoose = require('mongoose');
const {
  PRODUCT_TYPES,
  PRODUCT_STATUSES,
} = require('../../constants/commercialBilling');

/**
 * What Arivu sells (catalog). Not what a tenant purchased.
 * Master DB — not tenant-proxied.
 */
const BillingProductSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(PRODUCT_TYPES),
    index: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  /** Runtime app key when type === application (optional). */
  appKey: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  /** Addon key when type === booster (optional). */
  addonKey: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
  },
  status: {
    type: String,
    enum: Object.values(PRODUCT_STATUSES),
    default: PRODUCT_STATUSES.ACTIVE,
    index: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  collection: 'billing_products',
});

module.exports = mongoose.model('BillingProduct', BillingProductSchema);
