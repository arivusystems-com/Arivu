/**
 * Closed Records — tenant module-level lifecycle configuration.
 * Status values stay on the module picklist; this maps which are Closed + reopen targets.
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ClosedStateSchema = new mongoose.Schema(
  {
    statusValue: { type: String, required: true, trim: true },
    reopenStatusValue: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const ClosedRecordsConfigSchema = new mongoose.Schema(
  {
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    enabled: { type: Boolean, default: true },
    statusField: { type: String, required: true, trim: true },
    statusPicklistKey: { type: String, trim: true, default: null },
    allowLinkingToClosed: { type: Boolean, default: true },
    reopenEnabled: { type: Boolean, default: true },
    closedStates: { type: [ClosedStateSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = wrapTenantModel(
  mongoose.model('ClosedRecordsConfig', ClosedRecordsConfigSchema)
);
