/**
 * Shared mongoose field definitions for Closed Records lifecycle metadata.
 * Apply via schema.add(LIFECYCLE_STATE_FIELDS) on eligible models.
 */

const LIFECYCLE_STATE_FIELDS = {
  lifecycleState: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
    index: true
  },
  closedAt: { type: Date, default: null },
  reopenedAt: { type: Date, default: null }
};

function addLifecycleStateFields(schema) {
  schema.add(LIFECYCLE_STATE_FIELDS);
  schema.index({ organizationId: 1, lifecycleState: 1 });
}

module.exports = {
  LIFECYCLE_STATE_FIELDS,
  addLifecycleStateFields
};
