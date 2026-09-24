/**
 * Guard creating relationships that point at a closed record.
 * Returns { allowed: true } or { allowed: false, message, code }.
 */
async function assertCanLinkToRecord(moduleKey, record, { organizationId = null } = {}) {
  if (!record) {
    return { allowed: false, code: 'NOT_FOUND', message: 'Target record not found' };
  }
  try {
    const closedRecordsService = require('./closedRecordsService');
    const { isEligibleModule } = require('../constants/closedRecordsModules');
    const key = String(moduleKey || '')
      .trim()
      .toLowerCase();
    if (!isEligibleModule(key)) {
      return { allowed: true };
    }
    const closed = await closedRecordsService.isLifecycleClosed(key, record, { organizationId });
    if (!closed) return { allowed: true };
    const allow = await closedRecordsService.allowLinkingToClosed(key, { organizationId });
    if (allow) return { allowed: true };
    return {
      allowed: false,
      code: 'LINK_TO_CLOSED_BLOCKED',
      message: `Linking to closed ${key} records is disabled for this organization`
    };
  } catch (err) {
    return { allowed: true };
  }
}

module.exports = {
  assertCanLinkToRecord
};
