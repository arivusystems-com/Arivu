'use strict';

/**
 * Universal module fabric — module.search|get|create|update for any CapIndex-ready module.
 */

const mongoose = require('mongoose');
const {
  getModule,
  buildModuleFilter,
  normalizeModuleHit,
  resolveModel,
  escapeRegex,
} = require('./moduleCatalog');
const { RISK } = require('../governance/risk');
const { buildConfirmation } = require('../governance/confirmAction');

const WRITE_DENYLIST = new Set([
  'roles',
  'sharing',
  'settings',
  'numbering',
  'users',
  'billing',
  'addons',
]);

function mutabilityOf(mod) {
  if (!mod || mod.support !== 'ready') return 'unavailable';
  return mod.mutability || 'write';
}

function resolveModuleModel(moduleKey, deps = {}) {
  return resolveModel(moduleKey, deps);
}

async function runList(model, filter, { limit = 25, sort = { updatedAt: -1 } } = {}) {
  let q = model.find(filter).sort(sort).limit(limit);
  if (q && typeof q.lean === 'function') q = q.lean();
  return q;
}

async function runCount(model, filter) {
  if (typeof model.countDocuments === 'function') {
    return model.countDocuments(filter);
  }
  const rows = await runList(model, filter, { limit: 1000 });
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * @param {{ moduleKey: string, query?: string, limit?: number, openOnly?: boolean }} input
 */
async function runModuleSearch(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || input.entity || '').trim().toLowerCase();
  if (!moduleKey) {
    return { ok: false, hits: [], guidance: 'moduleKey is required.', counts: { total: 0, returned: 0 } };
  }
  if (WRITE_DENYLIST.has(moduleKey)) {
    return { ok: false, moduleKey, hits: [], guidance: 'This module is not searchable via Astra.', unsupported: true };
  }

  const mod = getModule(moduleKey);
  if (!mod || mod.support !== 'ready') {
    return {
      ok: false,
      moduleKey,
      hits: [],
      counts: { total: 0, returned: 0 },
      guidance: mod?.unavailableReason || `Module ${moduleKey} is not wired yet.`,
      unsupported: true,
      status: 'unavailable',
    };
  }

  const searchTerm = String(input.query || input.searchTerm || '').trim() || null;
  const built = buildModuleFilter(moduleKey, {
    organizationId: ctx.organizationId,
    openOnly: input.openOnly === true,
    overdueOnly: input.overdueOnly === true,
    searchTerm,
    toOrgId: (id) => (mongoose.Types.ObjectId.isValid(id) ? id : id),
  });

  let filter = built.filter;
  if (moduleKey === 'organizations' && ctx.organizationId) {
    const { buildTenantAccessibleCrmOrganizationQuery } = require('../../../utils/crmOrganizationAccess');
    filter = await buildTenantAccessibleCrmOrganizationQuery(ctx.organizationId);
    if (searchTerm) {
      filter = { ...filter, name: { $regex: escapeRegex(searchTerm), $options: 'i' } };
    }
  } else if (searchTerm && mod.titleFields?.length) {
    const ors = mod.titleFields.map((f) => ({ [f]: { $regex: escapeRegex(searchTerm), $options: 'i' } }));
    filter = { ...filter, $or: ors };
  }

  const model = resolveModuleModel(moduleKey, ctx.deps);
  if (!model || typeof model.find !== 'function') {
    return {
      ok: false,
      moduleKey,
      hits: [],
      counts: { total: 0, returned: 0 },
      guidance: `No data model is wired for ${moduleKey} yet.`,
      unsupported: true,
      status: 'unavailable',
    };
  }

  const limit = Math.min(Math.max(Number(input.limit) || 25, 1), 100);
  const [rows, total] = await Promise.all([
    runList(model, filter, { limit, sort: built.sort || { updatedAt: -1 } }),
    runCount(model, filter),
  ]);
  const hits = (Array.isArray(rows) ? rows : []).map((row) => normalizeModuleHit(moduleKey, row));
  return {
    ok: true,
    moduleKey,
    hits,
    counts: { total: Number(total) || hits.length, returned: hits.length },
    entity: moduleKey,
    listIntent: true,
    guidance: hits.length ? `Found ${hits.length} ${mod.label}.` : `No ${mod.label} matched.`,
    status: 'ready',
  };
}

async function runModuleGet(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || input.entity || '').trim().toLowerCase();
  const recordId = String(input.recordId || input.id || '').trim();
  if (!moduleKey || !recordId) {
    return { ok: false, guidance: 'moduleKey and recordId are required.' };
  }
  if (WRITE_DENYLIST.has(moduleKey)) {
    return { ok: false, guidance: 'This module is not readable via Astra.' };
  }
  const model = resolveModuleModel(moduleKey, ctx.deps);
  if (!model || typeof model.findOne !== 'function') {
    return { ok: false, moduleKey, recordId, guidance: `No model wired for ${moduleKey}.`, status: 'unavailable' };
  }

  const filter = { _id: recordId };
  if (model.schema?.paths?.deletedAt) filter.deletedAt = null;
  if (moduleKey !== 'organizations' && ctx.organizationId && model.schema?.paths?.organizationId) {
    filter.organizationId = ctx.organizationId;
  }

  let q = model.findOne(filter);
  if (q && typeof q.lean === 'function') q = q.lean();
  const row = await q;
  if (!row) {
    return { ok: false, moduleKey, recordId, guidance: 'Record not found.', record: null };
  }
  return {
    ok: true,
    moduleKey,
    recordId,
    record: normalizeModuleHit(moduleKey, row),
    guidance: `Loaded ${moduleKey} record.`,
    status: 'ready',
  };
}

/** Platform / infra keys Astra must never $set via NL update. */
const WRITE_FIELD_DENYLIST = new Set([
  '_id',
  'id',
  'organizationId',
  'createdBy',
  'modifiedBy',
  'updatedBy',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'createdAt',
  'updatedAt',
  '__v',
  'isTenant',
]);

/**
 * Map common NL aliases onto module-native keys (title → eventName, etc.).
 */
function normalizeFieldAliases(moduleKey, fields = {}) {
  const out = { ...fields };
  const mod = String(moduleKey || '').toLowerCase();
  if (mod === 'events') {
    if (out.title != null && out.eventName == null) {
      out.eventName = out.title;
      delete out.title;
    }
    if (out.name != null && out.eventName == null) {
      out.eventName = out.name;
      delete out.name;
    }
  }
  if (mod === 'tasks') {
    if (out.name != null && out.title == null) {
      out.title = out.name;
      delete out.name;
    }
    if (out.subject != null && out.title == null) {
      out.title = out.subject;
      delete out.subject;
    }
  }
  if (mod === 'deals' || mod === 'organizations' || mod === 'cases') {
    if (out.title != null && out.name == null) {
      out.name = out.title;
      delete out.title;
    }
  }
  return out;
}

function pickWritableFields(moduleKey, fields = {}) {
  const aliased = normalizeFieldAliases(moduleKey, fields);
  const out = {};
  for (const [k, v] of Object.entries(aliased || {})) {
    const key = String(k || '').trim();
    if (!key || WRITE_FIELD_DENYLIST.has(key)) continue;
    if (v === undefined) continue;
    out[key] = v;
  }
  return out;
}

async function runModuleCreate(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || '').trim().toLowerCase();
  const mod = getModule(moduleKey);
  const mut = mutabilityOf(mod);
  if (mut !== 'write' || WRITE_DENYLIST.has(moduleKey)) {
    return { ok: false, guidance: `Create is not available for ${moduleKey}.`, status: mut };
  }
  const fields = pickWritableFields(moduleKey, input.fields || input);
  if (!Object.keys(fields).length) {
    return { ok: false, guidance: 'No writable fields provided.' };
  }
  if (input.confirmed !== true) {
    return buildConfirmation({
      toolName: 'module.create',
      risk: RISK.WRITE,
      summary: `Create ${moduleKey}: ${fields.title || fields.name || fields.first_name || 'new record'}`,
      payload: { moduleKey, fields, action: 'create' },
    });
  }
  const model = resolveModuleModel(moduleKey, ctx.deps);
  if (!model) {
    return { ok: false, guidance: `No model wired for ${moduleKey}.` };
  }
  const doc = {
    ...fields,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId || null,
  };
  const created = await model.create(doc);
  try {
    const { publishDataChange } = require('../../dataChangeService');
    publishDataChange({
      organizationId: ctx.organizationId,
      moduleKey,
      recordId: String(created._id),
      op: 'create',
    });
  } catch {
    /* non-blocking */
  }
  return {
    ok: true,
    moduleKey,
    recordId: String(created._id),
    record: normalizeModuleHit(moduleKey, created.toObject ? created.toObject() : created),
    guidance: `Created ${moduleKey}.`,
  };
}

async function runModuleUpdate(input = {}, ctx = {}) {
  const moduleKey = String(input.moduleKey || '').trim().toLowerCase();
  const recordId = String(input.recordId || input.id || '').trim();
  const mod = getModule(moduleKey);
  const mut = mutabilityOf(mod);
  if (mut !== 'write' || WRITE_DENYLIST.has(moduleKey)) {
    return { ok: false, guidance: `Update is not available for ${moduleKey}.`, status: mut };
  }
  if (!recordId) {
    return { ok: false, guidance: 'recordId is required.' };
  }
  const fields = pickWritableFields(moduleKey, input.fields || input.patch || {});
  if (!Object.keys(fields).length) {
    return { ok: false, guidance: 'No writable fields provided.' };
  }
  if (input.confirmed !== true) {
    const label = fields.eventName || fields.title || fields.name || recordId;
    return buildConfirmation({
      toolName: 'module.update',
      risk: RISK.WRITE,
      summary: `Update ${moduleKey}: ${label}`,
      payload: { moduleKey, recordId, fields, action: 'update' },
      effects: Object.entries(fields).map(([k, v]) => ({ field: k, to: v })),
    });
  }
  const model = resolveModuleModel(moduleKey, ctx.deps);
  if (!model) {
    return { ok: false, guidance: `No model wired for ${moduleKey}.` };
  }
  const filter = { _id: recordId };
  if (model.schema?.paths?.deletedAt) filter.deletedAt = null;
  if (moduleKey !== 'organizations' && ctx.organizationId && model.schema?.paths?.organizationId) {
    filter.organizationId = ctx.organizationId;
  }
  const updated = await model.findOneAndUpdate(filter, { $set: fields }, { new: true }).lean();
  if (!updated) {
    return { ok: false, guidance: 'Record not found.' };
  }
  try {
    const { publishDataChange } = require('../../dataChangeService');
    publishDataChange({
      organizationId: ctx.organizationId,
      moduleKey,
      recordId,
      op: 'update',
    });
  } catch {
    /* non-blocking */
  }
  return {
    ok: true,
    moduleKey,
    recordId,
    record: normalizeModuleHit(moduleKey, updated),
    guidance: `Updated ${moduleKey}.`,
  };
}

module.exports = {
  WRITE_DENYLIST,
  runModuleSearch,
  runModuleGet,
  runModuleCreate,
  runModuleUpdate,
  mutabilityOf,
  pickWritableFields,
};
