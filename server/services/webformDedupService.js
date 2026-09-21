'use strict';

const People = require('../models/People');
const Organization = require('../models/Organization');
const Case = require('../models/Case');
const Deal = require('../models/Deal');
const User = require('../models/User');
const { buildCrmPayload } = require('./webformCrmIngestionService');
const { WEBFORM_DEDUP_ACTIONS } = require('../constants/webformFields');

const DEFAULT_DEDUP_KEYS = {
  people: ['email', 'phone'],
  organizations: ['name'],
  cases: ['requesterEmail'],
  deals: ['name']
};

async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId, status: { $ne: 'inactive' } })
    .select('_id')
    .lean();
  return users.map((row) => row._id);
}

function normalizeDedupKeys(webform) {
  const moduleKey = String(webform?.targetModuleKey || 'people').toLowerCase();
  const configured = Array.isArray(webform?.dedup?.keys)
    ? webform.dedup.keys.map((key) => String(key).trim()).filter(Boolean)
    : [];
  if (configured.length) return configured;
  return DEFAULT_DEDUP_KEYS[moduleKey] || ['email'];
}

async function findPeopleByDedupKey(organizationId, key, payload) {
  if (key === 'email' && payload.email) {
    return People.findOne({
      organizationId,
      email: String(payload.email).toLowerCase().trim(),
      deletedAt: null
    });
  }
  if (key === 'phone' && payload.phone) {
    return People.findOne({
      organizationId,
      phone: String(payload.phone).trim(),
      deletedAt: null
    });
  }
  if (payload[key] !== undefined && payload[key] !== null && String(payload[key]).trim() !== '') {
    return People.findOne({
      organizationId,
      [key]: payload[key],
      deletedAt: null
    });
  }
  return null;
}

async function findOrganizationByDedupKey(organizationId, tenantUserIds, key, payload) {
  if (!tenantUserIds.length) return null;
  if (key === 'name' && payload.name) {
    return Organization.findOne({
      isTenant: false,
      deletedAt: null,
      name: String(payload.name).trim(),
      createdBy: { $in: tenantUserIds }
    });
  }
  if (payload[key] !== undefined && payload[key] !== null && String(payload[key]).trim() !== '') {
    return Organization.findOne({
      isTenant: false,
      deletedAt: null,
      [key]: payload[key],
      createdBy: { $in: tenantUserIds }
    });
  }
  return null;
}

async function findCaseByDedupKey(organizationId, key, payload) {
  const email = key === 'requesterEmail' || key === 'email' ? payload.requesterEmail || payload.email : payload[key];
  if (email) {
    return Case.findOne({
      organizationId,
      requesterEmail: String(email).toLowerCase().trim(),
      deletedAt: null
    }).sort({ createdAt: -1 });
  }
  return null;
}

async function findDealByDedupKey(organizationId, key, payload) {
  if ((key === 'name' || key in payload) && payload.name) {
    return Deal.findOne({
      organizationId,
      name: String(payload.name).trim(),
      deletedAt: null
    }).sort({ createdAt: -1 });
  }
  if (payload[key] !== undefined && payload[key] !== null && String(payload[key]).trim() !== '') {
    return Deal.findOne({
      organizationId,
      [key]: payload[key],
      deletedAt: null
    }).sort({ createdAt: -1 });
  }
  return null;
}

async function findExistingByDedupKeys({ moduleKey, organizationId, payload, keys, tenantUserIds }) {
  const key = String(moduleKey || '').toLowerCase();
  for (const dedupKey of keys) {
    let record = null;
    if (key === 'people') {
      record = await findPeopleByDedupKey(organizationId, dedupKey, payload);
    } else if (key === 'organizations') {
      record = await findOrganizationByDedupKey(organizationId, tenantUserIds, dedupKey, payload);
    } else if (key === 'cases') {
      record = await findCaseByDedupKey(organizationId, dedupKey, payload);
    } else if (key === 'deals') {
      record = await findDealByDedupKey(organizationId, dedupKey, payload);
    }
    if (record) {
      return { record, matchedKey: dedupKey };
    }
  }
  return { record: null, matchedKey: null };
}

function resolveEffectiveRecordAction(webform, dedupMatch) {
  const baseAction = String(webform?.recordAction || 'create').toLowerCase();
  if (!webform?.dedup?.enabled || !dedupMatch?.record) {
    return { shouldReject: false, recordAction: baseAction };
  }

  const dedupAction = WEBFORM_DEDUP_ACTIONS.includes(webform.dedup.action)
    ? webform.dedup.action
    : 'update';

  if (dedupAction === 'reject') {
    return { shouldReject: true, recordAction: null };
  }
  if (dedupAction === 'create_anyway') {
    return { shouldReject: false, recordAction: 'create' };
  }
  return { shouldReject: false, recordAction: 'update' };
}

/**
 * Evaluate dedup policy for a webform submission before CRM ingestion.
 */
async function evaluateSubmissionDedup({ webform, fieldValues, organizationId }) {
  const moduleKey = String(webform?.targetModuleKey || 'people').toLowerCase();
  const payload = buildCrmPayload(webform, fieldValues);
  const tenantUserIds = moduleKey === 'organizations' ? await getTenantUserIds(organizationId) : [];

  // Prefer Core Duplicate Engine for master modules when tenant rules are enabled
  if (moduleKey === 'people' || moduleKey === 'organizations' || moduleKey === 'items') {
    try {
      const { getConfig, evaluateDuplicates } = require('./duplicates');
      const config = await getConfig(organizationId, moduleKey);
      if (config.enabled) {
        const result = await evaluateDuplicates({
          organizationId,
          moduleKey,
          candidate: payload,
          config,
          limit: 1,
        });
        const record = result.hasMatch && result.matches[0]?.record?._id
          ? await (async () => {
            const { MODULE_MODELS } = require('./duplicates/evaluate');
            return MODULE_MODELS[moduleKey].findById(result.matches[0].record._id);
          })()
          : null;

        // create_anyway blocked when platform rules are ON
        const webformForPolicy = {
          ...webform,
          dedup: {
            ...(webform.dedup || {}),
            enabled: true,
            action: webform?.dedup?.action === 'create_anyway' ? 'reject' : (webform?.dedup?.action || 'update'),
          },
        };
        const policy = resolveEffectiveRecordAction(webformForPolicy, { record });
        return {
          matched: Boolean(record),
          matchedRecordId: record?._id || null,
          matchedKey: result.matches[0]?.matchedFields?.[0]?.field || null,
          existingRecord: record,
          shouldReject: policy.shouldReject,
          recordAction: policy.recordAction,
        };
      }
    } catch (err) {
      console.warn('[webformDedup] engine fallback:', err.message);
    }
  }

  const keys = normalizeDedupKeys(webform);

  const { record, matchedKey } = await findExistingByDedupKeys({
    moduleKey,
    organizationId,
    payload,
    keys,
    tenantUserIds
  });

  const policy = resolveEffectiveRecordAction(webform, { record });

  return {
    matched: Boolean(record),
    matchedRecordId: record?._id || null,
    matchedKey,
    existingRecord: record,
    shouldReject: policy.shouldReject,
    recordAction: policy.recordAction
  };
}

module.exports = {
  normalizeDedupKeys,
  resolveEffectiveRecordAction,
  evaluateSubmissionDedup,
  findExistingByDedupKeys
};
