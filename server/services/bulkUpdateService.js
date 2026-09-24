const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const { validateFieldWrite } = require('../utils/fieldAccessControl');
const {
  buildUpdateWithCustomFields,
  flattenCustomFieldsForResponse,
} = require('../utils/customFieldsExtractor');
const { resolveMatchingRecordIds } = require('./bulkDeleteMatchingResolver');
const {
  isBulkUpdateModule,
  filterAllowedBulkUpdates,
} = require('../utils/bulkUpdateFieldPolicy');
const {
  appendFieldChangeLogs,
  buildFieldChangeLogDetails,
} = require('../utils/recordActivityLogger');

const DEFAULT_BATCH_SIZE = 500;
const MAX_FIELDS_PER_REQUEST = 10;

/** Modules whose ModuleRecordPage activity reads embedded activityLogs (not RecordActivity). */
const NATIVE_ACTIVITY_LOG_MODULES = new Set(['deals', 'tasks']);

const MODEL_BY_KEY = {
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  deals: () => require('../models/Deal'),
  quotes: () => require('../models/Quote'),
  tasks: () => require('../models/Task'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  cases: () => require('../models/Case'),
};

function normalizeIds(ids) {
  return [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
}

function buildBaseRecordQuery(moduleKey, organizationId, ids) {
  const orgId = mongoose.Types.ObjectId.isValid(organizationId)
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;

  const query = {
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    organizationId: orgId,
  };

  const mk = String(moduleKey || '').toLowerCase();
  const Model = MODEL_BY_KEY[mk]?.();
  if (Model?.schema?.paths?.deletedAt) {
    query.deletedAt = null;
  }
  if (mk === 'cases') {
    query.status = { $ne: 'Closed' };
  }
  // Prefer Closed Records lifecycle exclusion when field exists on the model
  if (Model?.schema?.paths?.lifecycleState) {
    query.lifecycleState = { $ne: 'closed' };
  }
  if (mk === 'organizations') {
    query.isTenant = false;
  }

  return query;
}

async function loadModuleFields(organizationId, moduleKey) {
  const mod = await ModuleDefinition.findOne({
    organizationId,
    key: String(moduleKey || '').toLowerCase(),
  }).lean();
  return Array.isArray(mod?.fields) ? mod.fields : [];
}

function validateUpdatesAgainstModule(updates, moduleFields, user, moduleKey) {
  const violations = [];
  for (const fieldKey of Object.keys(updates)) {
    const validation = validateFieldWrite(fieldKey, moduleFields, user, moduleKey);
    if (!validation.allowed) {
      violations.push({ field: fieldKey, reason: validation.reason });
    }
  }
  return violations;
}

function getActorDisplayName(user) {
  if (!user) return 'System';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || user.email || 'System';
}

function selectFieldsForActivity(Model, updateKeys) {
  const paths = Model?.schema?.paths || {};
  const select = new Set(['_id']);
  if (paths.customFields) select.add('customFields');
  for (const key of updateKeys) {
    if (paths[key] || key === 'customFields') {
      select.add(key);
    } else if (paths.customFields) {
      // custom field — value lives under customFields; already selected
    } else {
      select.add(key);
    }
  }
  return [...select].join(' ');
}

/**
 * Write Mass Edit field-change activity for each record that actually changed.
 * Failures are logged and never fail the bulk update itself.
 */
async function logMassEditActivities({
  moduleKey,
  organizationId,
  user,
  moduleFields,
  previousDocs,
  updates,
}) {
  if (!previousDocs.length) return;

  const mk = String(moduleKey || '').toLowerCase();
  const updateKeys = Object.keys(updates || {});
  if (updateKeys.length === 0) return;

  const authorId = user?._id;
  const actorName = getActorDisplayName(user);
  const detailsExtras = { source: 'mass_edit' };
  const now = new Date();

  try {
    if (NATIVE_ACTIVITY_LOG_MODULES.has(mk)) {
      const Model = MODEL_BY_KEY[mk]?.();
      if (!Model) return;

      const ops = [];
      for (const prev of previousDocs) {
        const flatPrev = flattenCustomFieldsForResponse(prev);
        const flatNext = { ...flatPrev, ...updates };
        const rows = buildFieldChangeLogDetails({
          previous: flatPrev,
          updated: flatNext,
          updateDataKeys: updateKeys,
          fieldLabels: moduleFields,
          detailsExtras,
        });
        if (rows.length === 0) continue;

        const logEntries = rows.map((row) => ({
          user: actorName,
          userId: authorId,
          action: row.action,
          details: row.details,
          timestamp: now,
        }));

        ops.push({
          updateOne: {
            filter: { _id: prev._id, organizationId },
            update: { $push: { activityLogs: { $each: logEntries } } },
          },
        });
      }

      if (ops.length > 0) {
        await Model.bulkWrite(ops, { ordered: false });
      }
      return;
    }

    // people, organizations, events, items, cases, quotes → RecordActivity
    await Promise.all(
      previousDocs.map(async (prev) => {
        const flatPrev = flattenCustomFieldsForResponse(prev);
        const flatNext = { ...flatPrev, ...updates };
        try {
          await appendFieldChangeLogs({
            organizationId,
            moduleKey: mk,
            recordId: prev._id,
            authorId,
            previous: flatPrev,
            updated: flatNext,
            updateDataKeys: updateKeys,
            fieldLabels: moduleFields,
            detailsExtras,
          });
        } catch (err) {
          console.error('[bulkUpdateService] mass-edit activity log failed for record', String(prev._id), err?.message || err);
        }
      })
    );
  } catch (err) {
    console.error('[bulkUpdateService] mass-edit activity logging failed', err?.message || err);
  }
}

async function applyBulkUpdateBatch({
  moduleKey,
  organizationId,
  userId,
  user,
  ids,
  updates,
  moduleFields,
}) {
  const mk = String(moduleKey || '').toLowerCase();
  const Model = MODEL_BY_KEY[mk]?.();
  if (!Model) {
    throw new Error(`Bulk update is not supported for module: ${mk}`);
  }

  const uniqueIds = normalizeIds(ids);
  if (uniqueIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      requestedCount: 0,
      matchedCount: 0,
    };
  }

  const query = buildBaseRecordQuery(mk, organizationId, uniqueIds);
  const updateKeys = Object.keys(updates || {});
  const previousDocs = await Model.find(query)
    .select(selectFieldsForActivity(Model, updateKeys))
    .lean();

  const $set = buildUpdateWithCustomFields(updates, Model);
  $set.updatedBy = userId;
  $set.updatedAt = new Date();
  // Prefer model-native modifiedBy when present (deals/items/events).
  if (Model.schema?.paths?.modifiedBy) {
    $set.modifiedBy = userId;
  }

  const result = await Model.updateMany(query, { $set });
  const matchedCount = Number(result?.matchedCount ?? 0);
  const modifiedCount = Number(result?.modifiedCount ?? 0);
  const skippedCount = Math.max(0, uniqueIds.length - matchedCount);
  const unchangedCount = Math.max(0, matchedCount - modifiedCount);

  if (previousDocs.length > 0) {
    await logMassEditActivities({
      moduleKey: mk,
      organizationId,
      user: user || { _id: userId },
      moduleFields,
      previousDocs,
      updates,
    });
  }

  return {
    updatedCount: modifiedCount,
    skippedCount: skippedCount + unchangedCount,
    failedCount: 0,
    failures: [],
    requestedCount: uniqueIds.length,
    matchedCount,
  };
}

/**
 * @param {object} params
 * @returns {Promise<object>}
 */
async function bulkUpdateRecords(params) {
  const {
    moduleKey,
    organizationId,
    user,
    updates,
    ids = [],
    updateMatching = false,
    listQuery = {},
    excludedIds = [],
    appKey,
    batchSize = DEFAULT_BATCH_SIZE,
    afterId = null,
  } = params;

  const mk = String(moduleKey || '').toLowerCase().trim();
  if (!isBulkUpdateModule(mk)) {
    const error = new Error(`Bulk update is not supported for module: ${mk}`);
    error.code = 'MODULE_BULK_UPDATE_UNSUPPORTED';
    throw error;
  }

  const rawUpdates = updates && typeof updates === 'object' ? updates : {};
  const updateKeys = Object.keys(rawUpdates);
  if (updateKeys.length === 0) {
    const error = new Error('updates must include at least one field');
    error.code = 'BULK_UPDATE_EMPTY';
    throw error;
  }
  if (updateKeys.length > MAX_FIELDS_PER_REQUEST) {
    const error = new Error(`Bulk update supports at most ${MAX_FIELDS_PER_REQUEST} fields per request`);
    error.code = 'BULK_UPDATE_TOO_MANY_FIELDS';
    throw error;
  }

  const moduleFields = await loadModuleFields(organizationId, mk);
  const { allowed, denied } = filterAllowedBulkUpdates(mk, rawUpdates, moduleFields);
  if (denied.length > 0) {
    const error = new Error(`Fields not allowed for bulk update: ${denied.join(', ')}`);
    error.code = 'BULK_UPDATE_FIELD_DENIED';
    error.deniedFields = denied;
    throw error;
  }
  if (Object.keys(allowed).length === 0) {
    const error = new Error('No allowed fields in updates payload');
    error.code = 'BULK_UPDATE_EMPTY';
    throw error;
  }

  const violations = validateUpdatesAgainstModule(allowed, moduleFields, user, mk);
  if (violations.length > 0) {
    const error = new Error('Field access denied');
    error.code = 'FIELD_ACCESS_DENIED';
    error.violations = violations;
    throw error;
  }

  const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
  // Bulk payloads are partial — only enforce when controlling + dependent values are both present
  // or when a dependent value is set without any parent key (treated as empty parent → reject).
  const picklistErrors = validatePicklistDependencyValues(moduleFields, allowed);
  if (picklistErrors.length > 0) {
    const error = new Error('Picklist dependency validation failed');
    error.code = 'PICKLIST_DEPENDENCY_VIOLATION';
    error.validationErrors = picklistErrors;
    throw error;
  }

  let targetIds = normalizeIds(ids);
  const limit = Math.min(Math.max(Number(batchSize) || DEFAULT_BATCH_SIZE, 1), 5000);

  if (updateMatching) {
    targetIds = await resolveMatchingRecordIds({
      moduleKey: mk,
      organizationId,
      listQuery,
      excludedIds,
      user,
      appKey: appKey || listQuery?.appKey,
      limit,
      afterId,
    });
  } else if (targetIds.length === 0) {
    const error = new Error('ids array is required');
    error.code = 'BULK_UPDATE_NO_IDS';
    throw error;
  }

  if (targetIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      requestedCount: 0,
      hasMore: false,
      lastId: null,
      updatedFields: Object.keys(allowed),
    };
  }

  const batchOutcome = await applyBulkUpdateBatch({
    moduleKey: mk,
    organizationId,
    userId: user._id,
    user,
    ids: targetIds,
    updates: allowed,
    moduleFields,
  });

  const hasMore = Boolean(updateMatching && targetIds.length === limit);
  const lastId = targetIds.length > 0 ? targetIds[targetIds.length - 1] : null;

  return {
    ...batchOutcome,
    hasMore,
    lastId,
    updatedFields: Object.keys(allowed),
  };
}

module.exports = {
  bulkUpdateRecords,
  DEFAULT_BATCH_SIZE,
  MAX_FIELDS_PER_REQUEST,
};
