'use strict';

const People = require('../../models/People');
const Organization = require('../../models/Organization');
const Item = require('../../models/Item');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const Case = require('../../models/Case');
const { getConfig } = require('./configService');
const {
  getFieldRawValue,
  normalizeFieldValue,
  valuesExactMatch,
  valuesSimilarMatch,
  personDisplayName,
} = require('./normalize');
const { emitDuplicateEvent } = require('./events');

const MODULE_MODELS = {
  people: People,
  organizations: Organization,
  items: Item,
  deals: Deal,
  tasks: Task,
  cases: Case,
};

async function getCrmOrgBaseQuery(organizationId) {
  const { buildTenantAccessibleCrmOrganizationQuery } = require('../../utils/crmOrganizationAccess');
  return buildTenantAccessibleCrmOrganizationQuery(organizationId);
}

function buildBaseScope(moduleKey, organizationId, config, crmBaseQuery) {
  const key = String(moduleKey).toLowerCase();
  if (key === 'organizations') {
    return { ...(crmBaseQuery || { isTenant: false, deletedAt: null }) };
  }
  const q = { organizationId, deletedAt: null };
  if (key === 'items' && !config.checkInactiveRecords) {
    q.status = { $ne: 'Inactive' };
  }
  if (key === 'people' && !config.checkInactiveRecords) {
    q.mergedInto = null;
  }
  return q;
}

function conditionMatches(moduleKey, field, matchType, candidate, existing, ignoreBlank) {
  const rawA = getFieldRawValue(moduleKey, field, candidate);
  const rawB = getFieldRawValue(moduleKey, field, existing);
  const normA = normalizeFieldValue(moduleKey, field, rawA);
  const normB = normalizeFieldValue(moduleKey, field, rawB);

  if (ignoreBlank && (normA == null || normB == null)) {
    return { matched: false, skippedBlank: true };
  }
  if (normA == null || normB == null) {
    return { matched: false, skippedBlank: false };
  }

  const matched = matchType === 'similar'
    ? valuesSimilarMatch(normA, normB)
    : valuesExactMatch(normA, normB);

  return {
    matched,
    skippedBlank: false,
    matchedField: field,
    matchedValue: String(normA),
    matchType,
  };
}

function recordMatchesConfig(moduleKey, candidate, existing, config) {
  const ignoreBlank = config.ignoreBlankValues !== false;
  const results = [];
  for (const cond of config.conditions || []) {
    results.push(conditionMatches(
      moduleKey,
      cond.field,
      cond.matchType || 'exact',
      candidate,
      existing,
      ignoreBlank
    ));
  }

  const active = results.filter((r) => !r.skippedBlank);
  if (active.length === 0) {
    return { isMatch: false, matchedFields: [] };
  }

  const logic = String(config.matchLogic || 'OR').toUpperCase();
  let isMatch = false;
  if (logic === 'AND') {
    isMatch = active.every((r) => r.matched);
  } else {
    isMatch = active.some((r) => r.matched);
  }

  const matchedFields = active.filter((r) => r.matched).map((r) => ({
    field: r.matchedField,
    value: r.matchedValue,
    matchType: r.matchType,
  }));

  return { isMatch, matchedFields };
}

function summarizeRecord(moduleKey, record) {
  if (!record) return null;
  const key = String(moduleKey).toLowerCase();
  if (key === 'people') {
    return {
      _id: record._id,
      name: personDisplayName(record),
      email: record.email || null,
      phone: record.phone || record.mobile || null,
      personNumber: record.personNumber || null,
    };
  }
  if (key === 'organizations') {
    return {
      _id: record._id,
      name: record.name || null,
      domain: record.domain || record.website || null,
      taxId: record.taxId || record.tax_id || null,
      organizationNumber: record.organizationNumber || null,
    };
  }
  if (key === 'deals') {
    return {
      _id: record._id,
      name: record.name || null,
      dealNumber: record.dealNumber || null,
      contactId: record.contactId || null,
    };
  }
  if (key === 'tasks') {
    return {
      _id: record._id,
      name: record.title || null,
      title: record.title || null,
      taskNumber: record.taskNumber || null,
    };
  }
  if (key === 'cases') {
    return {
      _id: record._id,
      name: record.title || null,
      title: record.title || null,
      caseId: record.caseId || null,
      contactId: record.contactId || null,
      requesterEmail: record.requesterEmail || null,
    };
  }
  return {
    _id: record._id,
    name: record.item_name || null,
    item_code: record.item_code || null,
    sku: record.sku || null,
  };
}

/**
 * Evaluate candidate values against existing tenant records.
 * @returns {{ enabled: boolean, hasMatch: boolean, matches: object[], policy: string, config: object }}
 */
async function evaluateDuplicates({
  organizationId,
  moduleKey,
  candidate,
  excludeRecordId = null,
  config: configOverride = null,
  emitEvent = false,
  triggeredBy = null,
  limit = 10,
}) {
  const key = String(moduleKey || '').toLowerCase();
  const config = configOverride || await getConfig(organizationId, key);

  if (!config.enabled) {
    return {
      enabled: false,
      hasMatch: false,
      matches: [],
      policy: config.apiMatchPolicy || 'warn',
      config,
    };
  }

  const Model = MODULE_MODELS[key];
  if (!Model) {
    return {
      enabled: false,
      hasMatch: false,
      matches: [],
      policy: 'warn',
      config,
    };
  }

  const crmBaseQuery = key === 'organizations'
    ? await getCrmOrgBaseQuery(organizationId)
    : null;
  const base = buildBaseScope(key, organizationId, config, crmBaseQuery);

  // Prefetch candidates via field $or, then apply full AND/OR + exact/similar in memory.
  // Always prefer normalized seeds for text names so "qwerty." still finds "qwerty".
  const orClauses = [];
  for (const cond of config.conditions || []) {
    const raw = getFieldRawValue(key, cond.field, candidate);
    const norm = normalizeFieldValue(key, cond.field, raw);
    if (norm == null) continue;
    if (cond.matchType === 'exact') {
      if (cond.field === 'email') {
        orClauses.push({ email: norm });
      } else if (cond.field === 'phone') {
        orClauses.push({ phone: raw }, { phone: norm }, { mobile: raw }, { mobile: norm });
      } else if (cond.field === 'item_code') {
        orClauses.push({ item_code: new RegExp(`^${escapeRegex(norm)}$`, 'i') });
      } else if (cond.field === 'sku') {
        orClauses.push({ sku: new RegExp(`^${escapeRegex(norm)}$`, 'i') });
      } else if (cond.field === 'taxId') {
        orClauses.push(
          { taxId: raw },
          { tax_id: raw },
          { gstin: raw },
          { taxId: norm },
          { tax_id: norm }
        );
      } else if (cond.field === 'domain') {
        orClauses.push(
          { domain: norm },
          { website: new RegExp(escapeRegex(norm), 'i') }
        );
      } else if (cond.field === 'name' && key === 'organizations') {
        orClauses.push({ name: new RegExp(escapeRegex(norm), 'i') });
      } else if (cond.field === 'name' && key === 'people') {
        const parts = String(norm).split(/\s+/).filter(Boolean);
        if (parts[0]) orClauses.push({ first_name: new RegExp(escapeRegex(parts[0]), 'i') });
        if (parts.length > 1) {
          orClauses.push({ last_name: new RegExp(escapeRegex(parts[parts.length - 1]), 'i') });
        }
      } else if (cond.field === 'item_name') {
        orClauses.push({ item_name: new RegExp(escapeRegex(norm.slice(0, 40)), 'i') });
      } else if (cond.field === 'name' && key === 'deals') {
        orClauses.push({ name: new RegExp(escapeRegex(norm), 'i') });
      } else if (cond.field === 'title' && (key === 'tasks' || key === 'cases')) {
        orClauses.push({ title: new RegExp(escapeRegex(norm), 'i') });
      } else if (cond.field === 'caseId') {
        orClauses.push({ caseId: new RegExp(`^${escapeRegex(String(raw).trim())}$`, 'i') });
      } else if (cond.field === 'contactId') {
        orClauses.push({ contactId: raw }, { contactId: norm });
      } else if (cond.field === 'requesterEmail') {
        orClauses.push({ requesterEmail: norm }, { requesterEmail: raw });
      }
    } else {
      // Similar: broad regex prefetch from normalized tokens
      const seed = String(norm).slice(0, 24);
      if (!seed) continue;
      if (key === 'people' && cond.field === 'name') {
        const parts = seed.split(/\s+/).filter(Boolean);
        const clauses = [];
        if (parts[0]) clauses.push({ first_name: new RegExp(escapeRegex(parts[0]), 'i') });
        if (parts.length > 1) {
          clauses.push({ last_name: new RegExp(escapeRegex(parts[parts.length - 1]), 'i') });
        } else if (parts[0]) {
          clauses.push({ last_name: new RegExp(escapeRegex(parts[0]), 'i') });
        }
        if (clauses.length) orClauses.push(...clauses);
      } else if (key === 'organizations' && cond.field === 'name') {
        orClauses.push({ name: new RegExp(escapeRegex(seed), 'i') });
      } else if (key === 'deals' && cond.field === 'name') {
        orClauses.push({ name: new RegExp(escapeRegex(seed), 'i') });
      } else if ((key === 'tasks' || key === 'cases') && cond.field === 'title') {
        orClauses.push({ title: new RegExp(escapeRegex(seed), 'i') });
      } else if (cond.field === 'item_name') {
        orClauses.push({ item_name: new RegExp(escapeRegex(seed), 'i') });
      }
    }
  }

  let docs = [];
  if (orClauses.length === 0) {
    return {
      enabled: true,
      hasMatch: false,
      matches: [],
      policy: config.apiMatchPolicy || 'warn',
      config,
    };
  }

  // Use $and so access-scope $or (CRM orgs) is not overwritten by match $or
  const andClauses = [base, { $or: orClauses }];
  if (excludeRecordId) {
    andClauses.push({ _id: { $ne: excludeRecordId } });
  }
  if (key === 'people' || key === 'organizations' || key === 'items') {
    andClauses.push({
      $or: [{ mergedInto: null }, { mergedInto: { $exists: false } }],
    });
  }

  const filter = { $and: andClauses };
  docs = await Model.find(filter).limit(Math.max(limit * 5, 50)).lean();

  const matches = [];
  for (const doc of docs) {
    if (doc.mergedInto) continue;
    const { isMatch, matchedFields } = recordMatchesConfig(key, candidate, doc, config);
    if (!isMatch || matchedFields.length === 0) continue;
    matches.push({
      record: summarizeRecord(key, doc),
      matchedFields,
      confidence: matchedFields.every((m) => m.matchType === 'exact') ? 'high' : 'medium',
    });
    if (matches.length >= limit) break;
  }

  const result = {
    enabled: true,
    hasMatch: matches.length > 0,
    matches,
    policy: config.apiMatchPolicy || 'warn',
    config,
  };

  if (emitEvent && result.hasMatch) {
    emitDuplicateEvent({
      eventType: 'record.duplicate.detected',
      organizationId,
      moduleKey: key,
      triggeredBy,
      currentState: {
        matchCount: matches.length,
        matchedIds: matches.map((m) => String(m.record._id)),
        policy: result.policy,
      },
    });
  }

  return result;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  evaluateDuplicates,
  recordMatchesConfig,
  summarizeRecord,
  getCrmOrgBaseQuery,
  MODULE_MODELS,
};
