/**
 * ============================================================================
 * PLATFORM CORE: People (Contacts) Model
 * ============================================================================
 *
 * This model represents people/contacts (app-agnostic):
 * - Basic contact information (name, email, phone)
 * - Organization reference (multi-tenancy)
 * - Assignment tracking
 * - Activity logs (generic audit trail)
 * - participations: app-specific data (e.g. SALES: role, lead_status, contact_status)
 *
 * SALES participation fields (role, lead_status, contact_status) live in
 * participations.SALES only. See syncSalesParticipation, getSalesParticipationValues.
 *
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {
  PEOPLE_SALES_ROLE_PATH,
  PEOPLE_SALES_LEAD_STATUS_PATH,
  PEOPLE_SALES_CONTACT_STATUS_PATH,
} = require('../utils/peopleFieldRegistry');
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { PEOPLE_SALUTATION_VALUES } = require('../constants/peopleSalutation');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const PeopleSchema = new Schema({
  // Multi-tenancy
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  // System fields
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  legacyContactId: { type: Schema.Types.ObjectId, index: true },

  // Core — system-managed creation channel (set server-side only)
  source: {
    type: String,
    enum: RECORD_SOURCE_VALUES,
    default: DEFAULT_RECORD_SOURCE
  },

  salutation: {
    type: String,
    enum: PEOPLE_SALUTATION_VALUES,
    trim: true,
  },
  first_name: { type: String, trim: true, required: true }, // Default: required (can be configured by admin)
  personNumber: {
    type: String,
    trim: true,
    index: true,
  },
  last_name: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        // Document.save(): `this` is the doc — use .get or property.
        // findOneAndUpdate + runValidators: `this` is the Query; use .get('first_name')
        // for the value participating in this update (see Mongoose "Update Validators and this").
        const first =
          typeof this.get === 'function'
            ? this.get('first_name')
            : this.first_name;
        return !!(first || v);
      },
      message: 'Last Name is required if First Name is missing'
    }
  },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  mobile: { type: String, trim: true },

  organization: { type: Schema.Types.ObjectId, ref: 'Organization' }, // SALES Organization (company), not tenant Organization

  tags: [{ type: String, trim: true }],
  do_not_contact: { type: Boolean, default: false },

  // ⚠️ SALES-SPECIFIC: Lead-specific fields (used by SALES app)
  // Lead-specific (lead_status lives in participations.SALES only)
  lead_owner: { type: Schema.Types.ObjectId, ref: 'User' },
  lead_score: { type: Number, min: 0 },

  interest_products: [{ type: String, trim: true }],
  qualification_date: { type: Date },
  qualification_notes: { type: String, trim: true },
  estimated_value: { type: Number, min: 0 },

  // ⚠️ SALES-SPECIFIC: Contact-specific fields (used by SALES app)
  // Contact-specific (contact_status lives in participations.SALES only)
  role: {
    type: String,
    enum: ['Decision Maker', 'Influencer', 'Support', 'Other']
  },
  birthday: { type: Date },
  preferred_contact_method: {
    type: String,
    enum: ['Email', 'Phone', 'WhatsApp', 'SMS', 'None']
  },
  
  // Derived Status (computed from Configuration Registry)
  // This field is computed from lifecycle mappings and is nullable
  // If no config exists or computation fails, this remains null
  derivedStatus: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  
  // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  importHistoryId: { type: Schema.Types.ObjectId, ref: 'ImportHistory', default: null, index: true },
  deletionReason: { type: String, trim: true, maxlength: 500 },

  // Duplicate merge (master survives; duplicate points here)
  mergedInto: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },
  mergedAt: { type: Date, default: null },
  mergedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Activity Logs (Generic audit trail - app-agnostic structure)
  // ⚠️ NOTE: The action field is a generic string, but action values may be app-specific
  //    SALES app may use values like "lead_status_changed", "contact_created", etc.
  //    Other apps can use their own action types. The structure itself is app-agnostic.
  activityLogs: [{
    user: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // Generic action type (values are app-specific)
    /** Human-readable line for activity timeline (optional; older entries may omit). */
    message: { type: String, trim: true },
    details: { type: Schema.Types.Mixed },
    appContext: { type: String }, // App context (appKey) - optional for backward compatibility
    timestamp: { type: Date, default: Date.now, required: true }
  }],

  // Description version history (native, task/deal parity)
  descriptionVersions: [{
    content: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }],

  // Custom fields (user-defined via Settings → Modules & Fields)
  customFields: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // External User / Portal access (platform capability — not app participation)
  portalAccess: {
    enabled: { type: Boolean, default: false, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    enabledAt: { type: Date, default: null },
    enabledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    disabledAt: { type: Date, default: null },
    disabledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastSyncedAt: { type: Date, default: null }
  },

  // Multi-app participation structure (appKey -> { role, lead_status, contact_status, ... })
  // SALES: role (Lead/Contact), lead_status, contact_status. Sole source of truth.
  participations: {
    type: Schema.Types.Mixed,
    default: () => ({})
  }
}, {
  timestamps: true
});

PeopleSchema.index({ organizationId: 1, assignedTo: 1 });
PeopleSchema.index({ organizationId: 1, email: 1 }, { unique: false, sparse: true });
PeopleSchema.index({ organizationId: 1, [PEOPLE_SALES_ROLE_PATH]: 1 });
PeopleSchema.index({ organizationId: 1, [PEOPLE_SALES_LEAD_STATUS_PATH]: 1 });
PeopleSchema.index({ organizationId: 1, [PEOPLE_SALES_CONTACT_STATUS_PATH]: 1 });
PeopleSchema.index({ organizationId: 1, legacyContactId: 1 }, { unique: false, sparse: true });
PeopleSchema.index({ organizationId: 1, deletedAt: 1 });
PeopleSchema.index({ organizationId: 1, importHistoryId: 1 });
PeopleSchema.index({ organizationId: 1, personNumber: 1 }, { unique: true, sparse: true });

// Prevent createdBy from being modified after creation
PeopleSchema.pre('findOneAndUpdate', function() {
  // Remove createdBy from update if it exists
  const update = this.getUpdate();
  if (update && update.createdBy !== undefined) {
    delete update.createdBy;
  }
  // Also handle $set operations
  if (update && update.$set && update.$set.createdBy !== undefined) {
    delete update.$set.createdBy;
  }
});

PeopleSchema.pre('validate', async function assignPersonNumber(next) {
  if (this.personNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'people', fieldKey: 'personNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

PeopleSchema.pre('save', async function(next) {
  // If this is an update (not new document) and createdBy is being changed, prevent it
  if (!this.isNew && this.isModified('createdBy')) {
    try {
      // Fetch the original document to get the original createdBy value
      const original = await this.constructor.findById(this._id).select('createdBy').lean();
      if (original && original.createdBy) {
        // Restore the original value
        this.createdBy = original.createdBy;
        // Mark the field as unmodified
        this.unmarkModified('createdBy');
      }
      next();
    } catch (error) {
      // If we can't fetch the original, prevent the save
      next(new Error('createdBy field cannot be modified after creation'));
    }
  } else {
    next();
  }
});

module.exports = wrapTenantModel(mongoose.model('People', PeopleSchema));


