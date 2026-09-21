'use strict';

const DuplicatePreventionConfig = require('../../models/DuplicatePreventionConfig');
const {
  MAX_CONDITIONS,
  SUPPORTED_MODULES,
  MERGEABLE_MODULES,
  isMergeableModule,
  MATCH_TYPES,
  MATCH_LOGIC,
  API_MATCH_POLICIES,
  MODULE_FIELD_OPTIONS,
  DEFAULT_CONFIGS,
} = require('./constants');

function isSupportedModule(moduleKey) {
  return SUPPORTED_MODULES.includes(String(moduleKey || '').toLowerCase());
}

function allowedFieldsFor(moduleKey) {
  return new Set((MODULE_FIELD_OPTIONS[moduleKey] || []).map((f) => f.field));
}

function sanitizeConfig(moduleKey, input = {}) {
  const key = String(moduleKey || '').toLowerCase();
  if (!isSupportedModule(key)) {
    const err = new Error(`Unsupported module for duplicate prevention: ${moduleKey}`);
    err.statusCode = 400;
    err.code = 'UNSUPPORTED_MODULE';
    throw err;
  }

  const defaults = DEFAULT_CONFIGS[key];
  const allowed = allowedFieldsFor(key);
  const rawConditions = Array.isArray(input.conditions) ? input.conditions : defaults.conditions;
  const conditions = [];
  const seen = new Set();

  for (const c of rawConditions) {
    if (!c || !c.field) continue;
    const field = String(c.field).trim();
    if (!allowed.has(field) || seen.has(field)) continue;
    const matchType = MATCH_TYPES.includes(String(c.matchType || '').toLowerCase())
      ? String(c.matchType).toLowerCase()
      : 'exact';
    seen.add(field);
    conditions.push({ field, matchType });
    if (conditions.length >= MAX_CONDITIONS) break;
  }

  if (conditions.length === 0) {
    conditions.push(...defaults.conditions.slice(0, MAX_CONDITIONS));
  }

  const matchLogic = MATCH_LOGIC.includes(String(input.matchLogic || '').toUpperCase())
    ? String(input.matchLogic).toUpperCase()
    : defaults.matchLogic;

  const apiMatchPolicy = API_MATCH_POLICIES.includes(String(input.apiMatchPolicy || '').toLowerCase())
    ? String(input.apiMatchPolicy).toLowerCase()
    : defaults.apiMatchPolicy;

  return {
    enabled: input.enabled !== false,
    matchLogic,
    conditions,
    ignoreBlankValues: input.ignoreBlankValues !== false,
    checkInactiveRecords: input.checkInactiveRecords !== false,
    apiMatchPolicy,
  };
}

function toPublicConfig(doc, moduleKey) {
  const key = String(moduleKey || doc?.moduleKey || '').toLowerCase();
  if (!doc) {
    return {
      moduleKey: key,
      ...DEFAULT_CONFIGS[key],
      fieldOptions: MODULE_FIELD_OPTIONS[key] || [],
      maxConditions: MAX_CONDITIONS,
      isDefault: true,
    };
  }
  return {
    moduleKey: key,
    enabled: doc.enabled !== false,
    matchLogic: doc.matchLogic || 'OR',
    conditions: Array.isArray(doc.conditions) ? doc.conditions : [],
    ignoreBlankValues: doc.ignoreBlankValues !== false,
    checkInactiveRecords: doc.checkInactiveRecords !== false,
    apiMatchPolicy: doc.apiMatchPolicy || DEFAULT_CONFIGS[key]?.apiMatchPolicy || 'warn',
    fieldOptions: MODULE_FIELD_OPTIONS[key] || [],
    maxConditions: MAX_CONDITIONS,
    isDefault: false,
    updatedAt: doc.updatedAt || null,
  };
}

async function getConfig(organizationId, moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (!isSupportedModule(key)) {
    return toPublicConfig(null, key);
  }
  const doc = await DuplicatePreventionConfig.findOne({ organizationId, moduleKey: key }).lean();
  return toPublicConfig(doc, key);
}

async function upsertConfig(organizationId, moduleKey, input, userId = null) {
  const key = String(moduleKey || '').toLowerCase();
  const sanitized = sanitizeConfig(key, input);
  const doc = await DuplicatePreventionConfig.findOneAndUpdate(
    { organizationId, moduleKey: key },
    {
      $set: {
        ...sanitized,
        updatedBy: userId || undefined,
      },
      $setOnInsert: {
        organizationId,
        moduleKey: key,
        createdBy: userId || undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toPublicConfig(doc, key);
}

async function seedDefaultsForOrg(organizationId, userId = null) {
  const results = [];
  for (const moduleKey of SUPPORTED_MODULES) {
    const existing = await DuplicatePreventionConfig.findOne({ organizationId, moduleKey }).lean();
    if (existing) {
      results.push(toPublicConfig(existing, moduleKey));
      continue;
    }
    const created = await upsertConfig(organizationId, moduleKey, DEFAULT_CONFIGS[moduleKey], userId);
    results.push(created);
  }
  return results;
}

module.exports = {
  isSupportedModule,
  isMergeableModule,
  sanitizeConfig,
  toPublicConfig,
  getConfig,
  upsertConfig,
  seedDefaultsForOrg,
  MAX_CONDITIONS,
  SUPPORTED_MODULES,
  MERGEABLE_MODULES,
  MODULE_FIELD_OPTIONS,
  DEFAULT_CONFIGS,
};
