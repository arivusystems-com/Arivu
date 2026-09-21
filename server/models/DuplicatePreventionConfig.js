'use strict';

const mongoose = require('mongoose');
const { MAX_CONDITIONS, MATCH_TYPES, MATCH_LOGIC, API_MATCH_POLICIES, SUPPORTED_MODULES } = require('../services/duplicates/constants');

const ConditionSchema = new mongoose.Schema({
  field: { type: String, required: true, trim: true },
  matchType: { type: String, enum: MATCH_TYPES, default: 'exact' },
}, { _id: false });

const DuplicatePreventionConfigSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  moduleKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    enum: SUPPORTED_MODULES,
    index: true,
  },
  enabled: { type: Boolean, default: true },
  matchLogic: { type: String, enum: MATCH_LOGIC, default: 'OR' },
  conditions: {
    type: [ConditionSchema],
    validate: {
      validator(v) {
        return Array.isArray(v) && v.length >= 1 && v.length <= MAX_CONDITIONS;
      },
      message: `Conditions must be 1–${MAX_CONDITIONS}`,
    },
  },
  ignoreBlankValues: { type: Boolean, default: true },
  checkInactiveRecords: { type: Boolean, default: true },
  apiMatchPolicy: { type: String, enum: API_MATCH_POLICIES, default: 'warn' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

DuplicatePreventionConfigSchema.index(
  { organizationId: 1, moduleKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('DuplicatePreventionConfig', DuplicatePreventionConfigSchema);
