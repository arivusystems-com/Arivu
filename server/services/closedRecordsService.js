/**
 * Closed Records — Core Platform lifecycle engine.
 * Config CRUD, validation, evaluation, reopen, close-on-status-change.
 */

const ClosedRecordsConfig = require('../models/ClosedRecordsConfig');
const {
  getModuleDef,
  isEligibleModule,
  listEligibleModules,
  resolveModuleKeyFromEntityType
} = require('../constants/closedRecordsModules');
const { emit } = require('./domainEvents');
const { appendRecordActivityLog } = require('../utils/recordActivityLogger');

const configCache = new Map();
const CACHE_TTL_MS = 30_000;

function cacheKey(organizationId, moduleKey) {
  return `${organizationId || 'default'}:${moduleKey}`;
}

function invalidateConfigCache(organizationId, moduleKey) {
  if (moduleKey) {
    configCache.delete(cacheKey(organizationId, moduleKey));
    return;
  }
  const prefix = `${organizationId || 'default'}:`;
  for (const k of configCache.keys()) {
    if (k.startsWith(prefix)) configCache.delete(k);
  }
}

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '')
    .trim()
    .toLowerCase();
}

function getStatusValue(record, statusField) {
  if (!record || !statusField) return null;
  const v = record[statusField];
  if (v == null) return null;
  return String(v).trim();
}

function closedValueSet(config) {
  return new Set(
    (config?.closedStates || []).map((s) => String(s.statusValue || '').trim()).filter(Boolean)
  );
}

/**
 * Validate config payload against picklist values and reopen rules.
 * @returns {{ ok: true, value: object } | { ok: false, code: string, message: string, details?: object }}
 */
function validateConfigPayload(def, payload, picklistValues) {
  const enabled = payload.enabled !== false;
  const reopenEnabled =
    payload.reopenEnabled != null ? Boolean(payload.reopenEnabled) : def.reopenEnabledDefault;
  const allowLinkingToClosed =
    payload.allowLinkingToClosed != null
      ? Boolean(payload.allowLinkingToClosed)
      : def.allowLinkingDefault;
  const statusField = String(payload.statusField || def.statusField).trim();
  const statusPicklistKey =
    payload.statusPicklistKey != null
      ? String(payload.statusPicklistKey).trim() || null
      : def.statusPicklistKey || null;

  const pickSet = new Set((picklistValues || []).map((v) => String(v).trim()));
  const rawStates = Array.isArray(payload.closedStates) ? payload.closedStates : [];
  const closedStates = [];

  for (const row of rawStates) {
    const statusValue = String(row?.statusValue || '').trim();
    if (!statusValue) continue;
    if (pickSet.size > 0 && !pickSet.has(statusValue)) {
      return {
        ok: false,
        code: 'INVALID_CLOSED_STATE',
        message: `Closed state "${statusValue}" is not in the selected status picklist`,
        details: { statusValue }
      };
    }
    let reopenStatusValue =
      row?.reopenStatusValue != null ? String(row.reopenStatusValue).trim() || null : null;
    closedStates.push({ statusValue, reopenStatusValue });
  }

  if (enabled && closedStates.length === 0) {
    return {
      ok: false,
      code: 'CLOSED_STATE_REQUIRED',
      message: 'At least one Closed State is required when Closed Records is enabled'
    };
  }

  const closedSet = new Set(closedStates.map((s) => s.statusValue));

  if (reopenEnabled) {
    for (const row of closedStates) {
      if (!row.reopenStatusValue) {
        return {
          ok: false,
          code: 'REOPEN_STATUS_REQUIRED',
          message: `Reopen Status is required for Closed State "${row.statusValue}"`,
          details: { statusValue: row.statusValue }
        };
      }
      if (pickSet.size > 0 && !pickSet.has(row.reopenStatusValue)) {
        return {
          ok: false,
          code: 'REOPEN_NOT_IN_PICKLIST',
          message: `Reopen Status "${row.reopenStatusValue}" must belong to the same status picklist`,
          details: { reopenStatusValue: row.reopenStatusValue }
        };
      }
      if (closedSet.has(row.reopenStatusValue)) {
        return {
          ok: false,
          code: 'REOPEN_CANNOT_BE_CLOSED',
          message: `Reopen Status cannot itself be a Closed State ("${row.reopenStatusValue}")`,
          details: { reopenStatusValue: row.reopenStatusValue }
        };
      }
    }
  } else {
    for (const row of closedStates) {
      row.reopenStatusValue = null;
    }
  }

  return {
    ok: true,
    value: {
      moduleKey: def.moduleKey,
      enabled,
      statusField,
      statusPicklistKey,
      allowLinkingToClosed,
      reopenEnabled,
      closedStates
    }
  };
}

async function loadPicklistValues(moduleKey, { organizationId = null } = {}) {
  const def = getModuleDef(moduleKey);
  if (!def) return [];
  const values = await Promise.resolve(def.listStatusValues({ organizationId }));
  return (values || []).map((v) => String(v).trim()).filter(Boolean);
}

async function buildDefaultConfig(moduleKey, { organizationId = null } = {}) {
  const def = getModuleDef(moduleKey);
  if (!def) return null;
  const values = await loadPicklistValues(moduleKey, { organizationId });
  const closedStates = def.buildDefaults(values) || [];
  return {
    moduleKey: def.moduleKey,
    enabled: true,
    statusField: def.statusField,
    statusPicklistKey: def.statusPicklistKey || null,
    allowLinkingToClosed: def.allowLinkingDefault,
    reopenEnabled: def.reopenEnabledDefault,
    closedStates
  };
}

/**
 * Get config for module; seed defaults on first read if missing.
 */
async function getOrCreateConfig(moduleKey, { organizationId = null } = {}) {
  const key = normalizeModuleKey(moduleKey);
  if (!isEligibleModule(key)) {
    const err = new Error(`Module "${moduleKey}" does not support Closed Records`);
    err.code = 'MODULE_NOT_ELIGIBLE';
    throw err;
  }

  const ck = cacheKey(organizationId, key);
  const cached = configCache.get(ck);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.doc;
  }

  let doc = await ClosedRecordsConfig.findOne({ moduleKey: key }).lean();
  if (!doc) {
    const defaults = await buildDefaultConfig(key, { organizationId });
    doc = await ClosedRecordsConfig.findOneAndUpdate(
      { moduleKey: key },
      { $setOnInsert: defaults },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  configCache.set(ck, { at: Date.now(), doc });
  return doc;
}

async function getConfig(moduleKey, opts = {}) {
  return getOrCreateConfig(moduleKey, opts);
}

async function saveConfig(moduleKey, payload, { organizationId = null, userId = null } = {}) {
  const key = normalizeModuleKey(moduleKey);
  const def = getModuleDef(key);
  if (!def) {
    const err = new Error(`Module "${moduleKey}" does not support Closed Records`);
    err.code = 'MODULE_NOT_ELIGIBLE';
    throw err;
  }

  const picklistValues = await loadPicklistValues(key, { organizationId });
  const validated = validateConfigPayload(def, payload || {}, picklistValues);
  if (!validated.ok) {
    const err = new Error(validated.message);
    err.code = validated.code;
    err.details = validated.details;
    throw err;
  }

  const doc = await ClosedRecordsConfig.findOneAndUpdate(
    { moduleKey: key },
    { $set: validated.value },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  invalidateConfigCache(organizationId, key);
  void userId;
  return doc;
}

/**
 * Whether record is lifecycle-closed per config (or lifecycleState field).
 */
async function isLifecycleClosed(moduleKey, record, opts = {}) {
  if (!record) return false;
  if (record.deletedAt) return true;

  const key =
    normalizeModuleKey(moduleKey) || resolveModuleKeyFromEntityType(moduleKey) || null;
  if (!key || !isEligibleModule(key)) {
    return record.lifecycleState === 'closed';
  }

  if (record.lifecycleState === 'closed') return true;
  if (record.lifecycleState === 'active') {
    // Still re-check status in case field drifted without lifecycle sync
  }

  try {
    const config = await getConfig(key, opts);
    if (!config?.enabled) return false;
    const statusValue = getStatusValue(record, config.statusField);
    if (!statusValue) return false;
    return closedValueSet(config).has(statusValue);
  } catch {
    return record.lifecycleState === 'closed';
  }
}

/**
 * Sync evaluation using already-loaded config (no I/O).
 */
function isLifecycleClosedSync(config, record) {
  if (!record) return false;
  if (record.deletedAt) return true;
  if (record.lifecycleState === 'closed') return true;
  if (!config?.enabled) return false;
  const statusValue = getStatusValue(record, config.statusField);
  if (!statusValue) return false;
  return closedValueSet(config).has(statusValue);
}

function getReopenStatusForValue(config, closedStatusValue) {
  if (!config?.reopenEnabled) return null;
  const match = (config.closedStates || []).find(
    (s) => String(s.statusValue).trim() === String(closedStatusValue || '').trim()
  );
  return match?.reopenStatusValue ? String(match.reopenStatusValue).trim() : null;
}

async function getReopenStatus(moduleKey, closedStatusValue, opts = {}) {
  const config = await getConfig(moduleKey, opts);
  return getReopenStatusForValue(config, closedStatusValue);
}

function emitLifecycleDomainEvent({
  entityType,
  entityId,
  eventSuffix,
  previousState,
  currentState,
  appKey,
  triggeredBy,
  organizationId,
  assignedTo
}) {
  emit({
    entityType,
    entityId,
    eventType: `${entityType}.${eventSuffix}`,
    previousState,
    currentState,
    changedFields: ['lifecycleState', 'status', 'stage'].filter(
      (k) => previousState?.[k] !== currentState?.[k]
    ),
    appKey,
    triggeredBy,
    organizationId,
    assignedTo: assignedTo != null ? assignedTo : currentState?.assignedTo
  });
}

/**
 * Apply lifecycle fields after a status/stage change on a mongoose doc (mutates doc).
 * Caller must save.
 * @returns {{ transitioned: 'closed'|'reopened'|null, previousLifecycle: string }}
 */
async function applyLifecycleOnStatusChange(moduleKey, doc, {
  previousStatusValue = null,
  organizationId = null,
  userId = null,
  appKey = null,
  skipEvents = false
} = {}) {
  const key = normalizeModuleKey(moduleKey);
  const config = await getConfig(key, { organizationId });
  if (!config?.enabled) {
    return { transitioned: null, previousLifecycle: doc.lifecycleState || 'active' };
  }

  const statusField = config.statusField;
  const newStatus = getStatusValue(doc, statusField);
  const wasClosed = closedValueSet(config).has(String(previousStatusValue || '').trim());
  const isClosed = closedValueSet(config).has(String(newStatus || '').trim());
  const previousLifecycle = doc.lifecycleState || (wasClosed ? 'closed' : 'active');

  if (isClosed && previousLifecycle !== 'closed') {
    doc.lifecycleState = 'closed';
    doc.closedAt = new Date();
    if (!skipEvents) {
      emitLifecycleDomainEvent({
        entityType: key,
        entityId: doc._id,
        eventSuffix: 'closed',
        previousState: {
          [statusField]: previousStatusValue,
          lifecycleState: previousLifecycle
        },
        currentState: {
          [statusField]: newStatus,
          lifecycleState: 'closed',
          closedAt: doc.closedAt,
          assignedTo: doc.assignedTo
        },
        appKey,
        triggeredBy: userId,
        organizationId: organizationId || doc.organizationId
      });
      try {
        await appendRecordActivityLog({
          moduleKey: key,
          recordId: doc._id,
          organizationId: organizationId || doc.organizationId,
          authorId: userId,
          action: 'closed',
          message: `Record closed (${statusField}: ${previousStatusValue || '—'} → ${newStatus})`,
          details: {
            changes: [
              { field: statusField, from: previousStatusValue, to: newStatus },
              { field: 'lifecycleState', from: previousLifecycle, to: 'closed' }
            ]
          }
        });
      } catch {
        /* activity optional */
      }
    }
    return { transitioned: 'closed', previousLifecycle };
  }

  return { transitioned: null, previousLifecycle };
}

/**
 * Reopen a closed record: set status to mapped reopen value, lifecycle active.
 */
async function reopenRecord(moduleKey, {
  recordId,
  reason = null,
  organizationId = null,
  userId = null,
  appKey = null,
  Model = null
} = {}) {
  const key = normalizeModuleKey(moduleKey);
  const def = getModuleDef(key);
  if (!def) {
    const err = new Error(`Module "${moduleKey}" does not support Closed Records`);
    err.code = 'MODULE_NOT_ELIGIBLE';
    throw err;
  }

  const config = await getConfig(key, { organizationId });
  if (!config.reopenEnabled) {
    const err = new Error('Reopening is disabled for this module');
    err.code = 'REOPEN_DISABLED';
    throw err;
  }

  let DocModel = Model;
  if (!DocModel) {
    if (!def.modelPath) {
      const err = new Error(`No model registered for module "${key}"`);
      err.code = 'MODEL_MISSING';
      throw err;
    }
    DocModel = require(def.modelPath);
  }

  const doc = await DocModel.findOne({
    _id: recordId,
    ...(organizationId ? { organizationId } : {})
  });
  if (!doc) {
    const err = new Error('Record not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const statusField = config.statusField;
  const currentStatus = getStatusValue(doc, statusField);
  const closed = isLifecycleClosedSync(config, doc);
  if (!closed) {
    const err = new Error('Record is not closed');
    err.code = 'NOT_CLOSED';
    throw err;
  }

  const reopenStatus = getReopenStatusForValue(config, currentStatus);
  if (!reopenStatus) {
    const err = new Error(
      `No Reopen Status configured for Closed State "${currentStatus}"`
    );
    err.code = 'REOPEN_STATUS_MISSING';
    throw err;
  }

  if (closedValueSet(config).has(reopenStatus)) {
    const err = new Error('Reopen Status cannot be a Closed State');
    err.code = 'REOPEN_CANNOT_BE_CLOSED';
    throw err;
  }

  const previous = {
    [statusField]: currentStatus,
    lifecycleState: doc.lifecycleState || 'closed',
    assignedTo: doc.assignedTo
  };

  doc[statusField] = reopenStatus;
  doc.lifecycleState = 'active';
  doc.reopenedAt = new Date();
  if (reason != null && doc.reopenReason !== undefined) {
    doc.reopenReason = String(reason).trim() || null;
  }
  if (doc.reopenCount != null) {
    doc.reopenCount = (doc.reopenCount || 0) + 1;
  }

  await doc.save();

  emitLifecycleDomainEvent({
    entityType: key,
    entityId: doc._id,
    eventSuffix: 'reopened',
    previousState: previous,
    currentState: {
      [statusField]: reopenStatus,
      lifecycleState: 'active',
      reopenedAt: doc.reopenedAt,
      assignedTo: doc.assignedTo
    },
    appKey,
    triggeredBy: userId,
    organizationId: organizationId || doc.organizationId
  });

  try {
    await appendRecordActivityLog({
      moduleKey: key,
      recordId: doc._id,
      organizationId: organizationId || doc.organizationId,
      authorId: userId,
      action: 'reopened',
      message: reason
        ? `Record reopened (${statusField}: ${currentStatus} → ${reopenStatus}). Reason: ${reason}`
        : `Record reopened (${statusField}: ${currentStatus} → ${reopenStatus})`,
      details: {
        changes: [
          { field: statusField, from: currentStatus, to: reopenStatus },
          { field: 'lifecycleState', from: 'closed', to: 'active' }
        ],
        reason: reason || null
      }
    });
  } catch {
    /* optional */
  }

  return doc;
}

/**
 * Mongo query fragments for open vs closed lists / ownership transfer.
 */
function buildLifecycleQueries(config) {
  if (!config?.enabled) {
    return { openQuery: {}, closedQuery: { _id: null } };
  }
  const field = config.statusField;
  const closedValues = [...closedValueSet(config)];
  if (closedValues.length === 0) {
    return {
      openQuery: { $or: [{ lifecycleState: { $ne: 'closed' } }, { lifecycleState: { $exists: false } }] },
      closedQuery: { lifecycleState: 'closed' }
    };
  }
  return {
    openQuery: {
      $and: [
        { [field]: { $nin: closedValues } },
        {
          $or: [{ lifecycleState: { $ne: 'closed' } }, { lifecycleState: { $exists: false } }]
        }
      ]
    },
    closedQuery: {
      $or: [{ [field]: { $in: closedValues } }, { lifecycleState: 'closed' }]
    }
  };
}

async function allowLinkingToClosed(moduleKey, opts = {}) {
  try {
    const config = await getConfig(moduleKey, opts);
    return config?.allowLinkingToClosed !== false;
  } catch {
    return true;
  }
}

module.exports = {
  validateConfigPayload,
  loadPicklistValues,
  buildDefaultConfig,
  getOrCreateConfig,
  getConfig,
  saveConfig,
  isLifecycleClosed,
  isLifecycleClosedSync,
  getReopenStatus,
  getReopenStatusForValue,
  applyLifecycleOnStatusChange,
  reopenRecord,
  buildLifecycleQueries,
  allowLinkingToClosed,
  listEligibleModules,
  invalidateConfigCache,
  closedValueSet,
  getStatusValue
};
