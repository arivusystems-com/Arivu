/**
 * Closed Records write guard — block business field edits on closed records.
 * Comments / activity append paths should bypass this guard.
 */

const closedRecordsService = require('./closedRecordsService');
const {
  isEligibleModule,
  resolveModuleKeyFromEntityType
} = require('../constants/closedRecordsModules');

const ALWAYS_ALLOWED_KEYS = new Set([
  'lifecycleState',
  'closedAt',
  'reopenedAt',
  'reopenReason',
  'reopenCount',
  'modifiedBy',
  'updatedAt',
  'activityLogs',
  'lastSlaEventAt',
  'conversationCount',
  'lastCustomerReplyAt',
  'lastAgentReplyAt'
]);

function createClosedRecordError(moduleKey, statusValue) {
  const err = new Error(
    `This ${moduleKey || 'record'} is closed and cannot be edited. Reopen it to make changes.`
  );
  err.code = 'RECORD_CLOSED_READONLY';
  err.statusCode = 403;
  err.details = { moduleKey, statusValue };
  return err;
}

/**
 * @param {string} moduleKey
 * @param {object} record
 * @param {object} [opts]
 * @param {string[]} [opts.changedKeys] - keys being written; empty = any write blocked
 * @param {boolean} [opts.allowStatusChangeViaReopen] - internal
 * @returns {Promise<void>}
 */
async function assertRecordWritable(moduleKey, record, opts = {}) {
  const key =
    String(moduleKey || '')
      .trim()
      .toLowerCase() || resolveModuleKeyFromEntityType(moduleKey);
  if (!key || !isEligibleModule(key)) return;
  if (!record) return;

  const closed = await closedRecordsService.isLifecycleClosed(key, record, {
    organizationId: opts.organizationId || record.organizationId
  });
  if (!closed) return;

  const changedKeys = Array.isArray(opts.changedKeys) ? opts.changedKeys : null;
  if (changedKeys && changedKeys.length > 0) {
    const blocked = changedKeys.filter((k) => !ALWAYS_ALLOWED_KEYS.has(k));
    if (blocked.length === 0) return;
  }

  const config = await closedRecordsService.getConfig(key, {
    organizationId: opts.organizationId || record.organizationId
  });
  const statusValue = closedRecordsService.getStatusValue(record, config.statusField);
  throw createClosedRecordError(key, statusValue);
}

/**
 * Sync check when config already loaded.
 */
function assertRecordWritableSync(config, moduleKey, record, changedKeys = null) {
  if (!config?.enabled) return;
  if (!closedRecordsService.isLifecycleClosedSync(config, record)) return;
  if (changedKeys && changedKeys.length > 0) {
    const blocked = changedKeys.filter((k) => !ALWAYS_ALLOWED_KEYS.has(k));
    if (blocked.length === 0) return;
  }
  const statusValue = closedRecordsService.getStatusValue(record, config.statusField);
  throw createClosedRecordError(moduleKey, statusValue);
}

module.exports = {
  assertRecordWritable,
  assertRecordWritableSync,
  createClosedRecordError,
  ALWAYS_ALLOWED_KEYS
};
