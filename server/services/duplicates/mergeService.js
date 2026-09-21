'use strict';

const People = require('../../models/People');
const Organization = require('../../models/Organization');
const Item = require('../../models/Item');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const Event = require('../../models/Event');
const Case = require('../../models/Case');
const { MODULE_MODELS, summarizeRecord } = require('./evaluate');
const { emitDuplicateEvent } = require('./events');
const { personDisplayName } = require('./normalize');
const { isMergeableModule } = require('./constants');
const { appendRecordActivityLog } = require('../../utils/recordActivityLogger');

const MERGEABLE_IDENTITY_FIELDS = {
  people: ['first_name', 'last_name', 'email', 'phone', 'mobile', 'organization'],
  organizations: ['name', 'domain', 'website', 'taxId', 'tax_id', 'phone', 'email'],
  items: ['item_name', 'item_code', 'sku', 'description'],
};

function duplicateDisplayLabel(moduleKey, record) {
  if (!record) return '';
  if (moduleKey === 'people') return personDisplayName(record) || String(record._id);
  if (moduleKey === 'items') return record.item_name || record.sku || record.item_code || String(record._id);
  return record.name || String(record._id);
}

/**
 * Embedded activityLogs (people/orgs) + RecordActivity (ModuleRecordPage).
 */
async function writeMergeActivityLogs({
  organizationId,
  moduleKey,
  master,
  duplicate,
  userId,
  userName,
}) {
  const dupLabel = duplicateDisplayLabel(moduleKey, duplicate);
  const message = `Merged duplicate "${dupLabel}" into this record`;
  const details = {
    type: 'merge',
    duplicateId: String(duplicate._id),
    duplicateLabel: dupLabel,
  };
  if (moduleKey === 'people' && duplicate.personNumber) {
    details.duplicatePersonNumber = duplicate.personNumber;
  }

  if (moduleKey === 'people' || moduleKey === 'organizations') {
    if (!Array.isArray(master.activityLogs)) master.activityLogs = [];
    const entry = {
      user: userName || 'User',
      userId: userId || undefined,
      action: 'records_merged',
      details,
      timestamp: new Date(),
    };
    if (moduleKey === 'people') entry.message = message;
    master.activityLogs.push(entry);
    master.markModified('activityLogs');
  }

  if (userId && organizationId && master._id) {
    try {
      await appendRecordActivityLog({
        organizationId,
        moduleKey,
        recordId: master._id,
        authorId: userId,
        action: 'merged',
        message,
        details,
      });
    } catch (logErr) {
      console.warn('[duplicates.merge] RecordActivity log failed:', logErr?.message || logErr);
    }
  }
}

function unionParticipations(masterParts = {}, dupParts = {}) {
  const out = { ...(masterParts && typeof masterParts === 'object' ? masterParts : {}) };
  const src = dupParts && typeof dupParts === 'object' ? dupParts : {};
  for (const [appKey, value] of Object.entries(src)) {
    if (!out[appKey]) {
      out[appKey] = value;
      continue;
    }
    // Same app: keep master role/status; fill blanks from duplicate
    const merged = { ...value, ...out[appKey] };
    for (const [k, v] of Object.entries(value || {})) {
      if (merged[k] == null || merged[k] === '') merged[k] = v;
    }
    out[appKey] = merged;
  }
  return out;
}

async function reassignPeopleRelations(organizationId, masterId, duplicateId) {
  const mid = masterId;
  const did = duplicateId;
  await Deal.updateMany(
    { organizationId, contactId: did },
    { $set: { contactId: mid } }
  );
  await Deal.updateMany(
    { organizationId, 'dealPeople.personId': did },
    { $set: { 'dealPeople.$[el].personId': mid } },
    { arrayFilters: [{ 'el.personId': did }] }
  );
  await Task.updateMany(
    { organizationId, 'relatedTo.type': 'People', 'relatedTo.id': did },
    { $set: { 'relatedTo.id': mid } }
  );
  await Event.updateMany(
    { organizationId, relatedToId: did, relatedToType: { $in: ['People', 'people', 'Contact', 'contact'] } },
    { $set: { relatedToId: mid } }
  );
  try {
    await Case.updateMany(
      { organizationId, requesterId: did },
      { $set: { requesterId: mid } }
    );
  } catch (_) { /* Case schema may differ */ }
}

async function reassignOrganizationRelations(organizationId, masterId, duplicateId) {
  await People.updateMany(
    { organizationId, organization: duplicateId },
    { $set: { organization: masterId } }
  );
  await Deal.updateMany(
    { organizationId, 'dealOrganizations.organizationId': duplicateId },
    { $set: { 'dealOrganizations.$[el].organizationId': masterId } },
    { arrayFilters: [{ 'el.organizationId': duplicateId }] }
  );
  await Task.updateMany(
    { organizationId, 'relatedTo.type': { $in: ['Organization', 'Organizations'] }, 'relatedTo.id': duplicateId },
    { $set: { 'relatedTo.id': masterId } }
  );
}

async function reassignItemRelations(organizationId, masterId, duplicateId) {
  // Line items often store itemId — best-effort
  try {
    const Quote = require('../../models/Quote');
    await Quote.updateMany(
      { organizationId, 'lineItems.itemId': duplicateId },
      { $set: { 'lineItems.$[el].itemId': masterId } },
      { arrayFilters: [{ 'el.itemId': duplicateId }] }
    );
  } catch (_) { /* optional */ }
}

/**
 * @param {object} params
 * @param {object} params.fieldSelections - map fieldKey -> 'master' | 'duplicate' | raw value
 */
async function mergeRecords({
  organizationId,
  moduleKey,
  masterId,
  duplicateId,
  fieldSelections = {},
  userId,
  userName = 'User',
}) {
  const key = String(moduleKey || '').toLowerCase();
  if (!isMergeableModule(key)) {
    const err = new Error(`Merge not supported for module: ${moduleKey}`);
    err.statusCode = 400;
    err.code = 'MERGE_UNSUPPORTED';
    throw err;
  }
  const Model = MODULE_MODELS[key];
  if (!Model) {
    const err = new Error(`Merge not supported for module: ${moduleKey}`);
    err.statusCode = 400;
    err.code = 'UNSUPPORTED_MODULE';
    throw err;
  }
  if (String(masterId) === String(duplicateId)) {
    const err = new Error('Master and duplicate must be different records');
    err.statusCode = 400;
    err.code = 'SAME_RECORD';
    throw err;
  }

  emitDuplicateEvent({
    eventType: 'record.merge.started',
    organizationId,
    moduleKey: key,
    entityId: masterId,
    triggeredBy: userId,
    currentState: { masterId: String(masterId), duplicateId: String(duplicateId) },
  });

  try {
    const masterQuery = key === 'organizations'
      ? { _id: masterId, isTenant: false }
      : { _id: masterId, organizationId };
    const dupQuery = key === 'organizations'
      ? { _id: duplicateId, isTenant: false }
      : { _id: duplicateId, organizationId };

    const [master, duplicate] = await Promise.all([
      Model.findOne(masterQuery),
      Model.findOne(dupQuery),
    ]);

    if (!master || !duplicate) {
      const err = new Error('Master or duplicate record not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (duplicate.mergedInto || master.mergedInto) {
      const err = new Error('One of the records was already merged');
      err.statusCode = 409;
      err.code = 'ALREADY_MERGED';
      throw err;
    }

    const allowed = new Set(MERGEABLE_IDENTITY_FIELDS[key] || []);
    for (const [field, choice] of Object.entries(fieldSelections || {})) {
      if (!allowed.has(field) && field !== 'customFields') continue;
      let value;
      if (choice === 'master') value = master[field];
      else if (choice === 'duplicate') value = duplicate[field];
      else value = choice;
      if (value !== undefined) master[field] = value;
    }

    // Fill blanks from duplicate for identity fields not explicitly selected
    for (const field of allowed) {
      if (fieldSelections && Object.prototype.hasOwnProperty.call(fieldSelections, field)) continue;
      const cur = master[field];
      const alt = duplicate[field];
      if ((cur == null || cur === '') && alt != null && alt !== '') {
        master[field] = alt;
      }
    }

    if (key === 'people') {
      master.participations = unionParticipations(master.participations, duplicate.participations);
      master.markModified('participations');
    }

    if (key === 'organizations' && Array.isArray(duplicate.types)) {
      const types = new Set([...(master.types || []), ...duplicate.types]);
      master.types = [...types];
    }

    await writeMergeActivityLogs({
      organizationId,
      moduleKey: key,
      master,
      duplicate,
      userId,
      userName,
    });

    await master.save();

    if (key === 'people') await reassignPeopleRelations(organizationId, master._id, duplicate._id);
    if (key === 'organizations') await reassignOrganizationRelations(organizationId, master._id, duplicate._id);
    if (key === 'items') await reassignItemRelations(organizationId, master._id, duplicate._id);

    duplicate.mergedInto = master._id;
    duplicate.mergedAt = new Date();
    duplicate.mergedBy = userId;
    duplicate.deletedAt = new Date();
    duplicate.deletedBy = userId;
    duplicate.deletionReason = `Merged into ${master._id}`;
    await duplicate.save();

    emitDuplicateEvent({
      eventType: 'record.merge.completed',
      organizationId,
      moduleKey: key,
      entityId: master._id,
      triggeredBy: userId,
      currentState: {
        masterId: String(master._id),
        duplicateId: String(duplicate._id),
        master: summarizeRecord(key, master.toObject ? master.toObject() : master),
      },
    });

    return {
      master: summarizeRecord(key, master.toObject ? master.toObject() : master),
      duplicateId: String(duplicate._id),
      mergedAt: duplicate.mergedAt,
    };
  } catch (err) {
    emitDuplicateEvent({
      eventType: 'record.merge.failed',
      organizationId,
      moduleKey: key,
      entityId: masterId,
      triggeredBy: userId,
      currentState: { error: err.message, duplicateId: String(duplicateId) },
    });
    throw err;
  }
}

async function markNotDuplicate({
  organizationId,
  moduleKey,
  recordIdA,
  recordIdB,
  userId,
}) {
  emitDuplicateEvent({
    eventType: 'record.duplicate.rejected',
    organizationId,
    moduleKey,
    entityId: recordIdA,
    triggeredBy: userId,
    currentState: {
      recordIdA: String(recordIdA),
      recordIdB: String(recordIdB),
      decision: 'not_duplicate',
    },
  });
  return { ok: true };
}

async function getComparePayload({ organizationId, moduleKey, recordIdA, recordIdB }) {
  const key = String(moduleKey || '').toLowerCase();
  if (!isMergeableModule(key)) {
    const err = new Error(`Compare/merge not supported for module: ${moduleKey}`);
    err.statusCode = 400;
    err.code = 'MERGE_UNSUPPORTED';
    throw err;
  }
  const Model = MODULE_MODELS[key];
  if (!Model) {
    const err = new Error(`Unsupported module: ${moduleKey}`);
    err.statusCode = 400;
    throw err;
  }
  const q = (id) => (key === 'organizations'
    ? { _id: id, isTenant: false }
    : { _id: id, organizationId });
  const [a, b] = await Promise.all([
    Model.findOne(q(recordIdA)).lean(),
    Model.findOne(q(recordIdB)).lean(),
  ]);
  if (!a || !b) {
    const err = new Error('One or both records not found');
    err.statusCode = 404;
    throw err;
  }
  const fields = MERGEABLE_IDENTITY_FIELDS[key] || [];
  const comparison = fields.map((field) => ({
    field,
    recordA: a[field] ?? null,
    recordB: b[field] ?? null,
  }));
  return {
    recordA: { ...summarizeRecord(key, a), participations: a.participations || null },
    recordB: { ...summarizeRecord(key, b), participations: b.participations || null },
    comparison,
    fullA: a,
    fullB: b,
  };
}

module.exports = {
  mergeRecords,
  markNotDuplicate,
  getComparePayload,
  unionParticipations,
  MERGEABLE_IDENTITY_FIELDS,
};
