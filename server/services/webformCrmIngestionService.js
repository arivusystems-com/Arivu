'use strict';

/**
 * WF2: Map webform field values to CRM records (People, Organizations, Cases, Deals).
 * Separate from Audit formProcessingService.
 */

const People = require('../models/People');
const Organization = require('../models/Organization');
const Case = require('../models/Case');
const Deal = require('../models/Deal');
const User = require('../models/User');
const { assignResolvedSource } = require('./sourceResolver');
const { extractCustomFields, buildUpdateWithCustomFields } = require('../utils/customFieldsExtractor');
const { getDefaultPipelineSettings } = require('../controllers/moduleController');
const { computeAndSetDerivedStatus } = require('./derivedStatusService');
const { validateStageInPipeline } = require('./systemInvariants');
const { syncPeopleOrganizationRelationship } = require('./peopleOrganizationRelationshipSync');
const { isWebformFileFieldType } = require('../constants/webformFileFields');

function buildCrmPayload(webform, fieldValues) {
  const payload = {};
  const fields = Array.isArray(webform?.fields) ? webform.fields : [];

  for (const field of fields) {
    const key = String(field.crmFieldKey || '').trim();
    if (!key) continue;
    const value = fieldValues[field.fieldId];
    if (value === undefined || value === null) continue;
    if (isWebformFileFieldType(field.type)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        payload[key] = String(value.downloadUrl || value.storagePath || value.fileName || '').trim();
      }
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') continue;
    payload[key] = value;
  }

  return payload;
}

function ensurePeopleDefaults(payload) {
  const next = { ...payload };
  if (!next.first_name) {
    if (next.email) {
      next.first_name = String(next.email).split('@')[0] || 'Webform';
    } else {
      next.first_name = 'Webform';
    }
  }
  if (!next.last_name) {
    next.last_name = '';
  }
  if (next.email) {
    next.email = String(next.email).toLowerCase().trim();
  }
  return next;
}

function ensureOrganizationDefaults(payload, webformName) {
  const next = { ...payload };
  if (!next.name || !String(next.name).trim()) {
    next.name = `${webformName || 'Webform'} submission`;
  }
  return next;
}

function ensureCaseDefaults(payload, webformName) {
  const next = { ...payload };
  if (!next.title || !String(next.title).trim()) {
    next.title = `${webformName || 'Webform'} submission`;
  }
  if (!next.channel) {
    next.channel = 'Customer Portal';
  }
  return next;
}

function ensureDealDefaults(payload, webformName) {
  const next = { ...payload };
  if (!next.name || !String(next.name).trim()) {
    next.name = `${webformName || 'Webform'} submission`;
  }
  if (next.amount === undefined || next.amount === null || next.amount === '') {
    next.amount = 0;
  } else {
    next.amount = Number(next.amount);
    if (Number.isNaN(next.amount) || next.amount < 0) {
      next.amount = 0;
    }
  }
  return next;
}

async function resolveActorUserId(organizationId, webform) {
  if (webform?.createdBy) {
    return webform.createdBy;
  }
  const user = await User.findOne({ organizationId, status: { $ne: 'inactive' } })
    .select('_id')
    .lean();
  if (!user?._id) {
    const error = new Error('No user available to process webform submission.');
    error.statusCode = 500;
    throw error;
  }
  return user._id;
}

async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId, status: { $ne: 'inactive' } })
    .select('_id')
    .lean();
  return users.map((row) => row._id);
}

async function findExistingRecord({ moduleKey, organizationId, payload, tenantUserIds }) {
  const key = String(moduleKey || '').toLowerCase();

  if (key === 'people') {
    if (payload.email) {
      return People.findOne({
        organizationId,
        email: String(payload.email).toLowerCase().trim(),
        deletedAt: null
      });
    }
    if (payload.phone) {
      return People.findOne({
        organizationId,
        phone: String(payload.phone).trim(),
        deletedAt: null
      });
    }
    return null;
  }

  if (key === 'organizations') {
    if (!payload.name || !tenantUserIds.length) return null;
    return Organization.findOne({
      isTenant: false,
      deletedAt: null,
      name: String(payload.name).trim(),
      createdBy: { $in: tenantUserIds }
    });
  }

  if (key === 'cases') {
    if (payload.requesterEmail) {
      return Case.findOne({
        organizationId,
        requesterEmail: String(payload.requesterEmail).toLowerCase().trim(),
        deletedAt: null
      }).sort({ createdAt: -1 });
    }
    return null;
  }

  if (key === 'deals') {
    if (!payload.name) return null;
    return Deal.findOne({
      organizationId,
      name: String(payload.name).trim(),
      deletedAt: null
    }).sort({ createdAt: -1 });
  }

  return null;
}

function resolveRecordIntent(recordAction, existingRecord) {
  const action = String(recordAction || 'create').toLowerCase();

  if (action === 'create') {
    return { intent: 'create', crmAction: 'created' };
  }

  if (action === 'update') {
    if (!existingRecord) {
      const error = new Error('No matching CRM record found to update.');
      error.statusCode = 404;
      throw error;
    }
    return { intent: 'update', crmAction: 'updated' };
  }

  if (existingRecord) {
    return { intent: 'update', crmAction: 'updated' };
  }
  return { intent: 'create', crmAction: 'created' };
}

function buildSalesParticipation(appKey) {
  const normalized = String(appKey || 'SALES').toUpperCase();
  // Platform-target webforms still create SALES leads by default (lead capture).
  if (normalized === 'PLATFORM' || normalized === 'SALES') {
    return {
      SALES: {
        role: 'Lead',
        lead_status: 'New'
      }
    };
  }
  return null;
}

async function applyDefaultDealPipeline(payload, organizationId, appKey) {
  if (payload.pipeline && payload.stage) return payload;

  const defaultSettings = getDefaultPipelineSettings();
  const defaultPipeline = defaultSettings.find((row) => row.isDefault) || defaultSettings[0];
  if (!defaultPipeline?.stages?.length) return payload;

  const next = { ...payload };
  next.pipeline = next.pipeline || defaultPipeline.key;
  next.stage = next.stage || (defaultPipeline.stages[0].name || 'New');

  const stageResult = await validateStageInPipeline({
    moduleKey: 'deals',
    organizationId,
    updateData: next,
    appKey
  });
  if (!stageResult.valid) {
    const error = new Error(stageResult.message || 'Invalid deal pipeline configuration.');
    error.statusCode = 400;
    throw error;
  }

  if (!next.status) {
    next.status = 'Open';
  }
  return next;
}

async function createPeopleRecord({ payload, organizationId, actorUserId, appKey }) {
  const normalized = ensurePeopleDefaults(payload);
  const { standardPayload, customFieldsSet } = extractCustomFields(normalized, People);

  const participations = buildSalesParticipation(appKey);
  const createPayload = {
    ...standardPayload,
    organizationId,
    createdBy: actorUserId,
    assignedTo: actorUserId,
    ...(participations && { participations }),
    ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet })
  };

  assignResolvedSource(createPayload, 'web_form');
  const record = await People.create(createPayload);

  if (record.organization) {
    try {
      await syncPeopleOrganizationRelationship({
        tenantOrganizationId: organizationId,
        personId: record._id,
        organizationValue: record.organization,
        userId: actorUserId
      });
    } catch (syncErr) {
      console.warn('[webformCrmIngestion] people org sync failed:', syncErr?.message || syncErr);
    }
  }

  await computeAndSetDerivedStatus('people', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function updatePeopleRecord({ existingRecord, payload, organizationId, actorUserId, appKey }) {
  const normalized = ensurePeopleDefaults({ ...payload });
  const $set = buildUpdateWithCustomFields(normalized, People);
  delete $set.source;

  const record = await People.findOneAndUpdate(
    { _id: existingRecord._id, organizationId, deletedAt: null },
    { $set },
    { new: true, runValidators: true }
  );

  if (!record) {
    const error = new Error('Failed to update person record.');
    error.statusCode = 500;
    throw error;
  }

  if (record.organization) {
    try {
      await syncPeopleOrganizationRelationship({
        tenantOrganizationId: organizationId,
        personId: record._id,
        organizationValue: record.organization,
        userId: actorUserId
      });
    } catch (syncErr) {
      console.warn('[webformCrmIngestion] people org sync failed:', syncErr?.message || syncErr);
    }
  }

  await computeAndSetDerivedStatus('people', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function createOrganizationRecord({ payload, actorUserId, appKey, webformName }) {
  const normalized = ensureOrganizationDefaults(payload, webformName);
  const { standardPayload, customFieldsSet } = extractCustomFields(normalized, Organization);

  const createPayload = {
    ...standardPayload,
    createdBy: actorUserId,
    assignedTo: standardPayload.assignedTo || actorUserId,
    isTenant: false,
    ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet })
  };

  assignResolvedSource(createPayload, 'web_form');
  const record = await Organization.create(createPayload);

  await computeAndSetDerivedStatus('organization', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function updateOrganizationRecord({ existingRecord, payload, actorUserId, appKey, webformName }) {
  const normalized = ensureOrganizationDefaults(payload, webformName);
  const $set = buildUpdateWithCustomFields(normalized, Organization);
  delete $set.source;
  delete $set.createdBy;

  const record = await Organization.findOneAndUpdate(
    { _id: existingRecord._id, isTenant: false, deletedAt: null },
    { $set },
    { new: true, runValidators: true }
  );

  if (!record) {
    const error = new Error('Failed to update organization record.');
    error.statusCode = 500;
    throw error;
  }

  await computeAndSetDerivedStatus('organization', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function createCaseRecord({ payload, organizationId, actorUserId, webformName }) {
  const normalized = ensureCaseDefaults(payload, webformName);
  const { standardPayload, customFieldsSet } = extractCustomFields(normalized, Case);
  const now = new Date();
  const { allocateRequired } = require('./moduleNumberingService');
  const caseId = await allocateRequired({
    organizationId,
    moduleKey: 'cases',
    at: now,
  });

  const createPayload = {
    ...standardPayload,
    organizationId,
    caseId,
    assignedTo: actorUserId,
    ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
    activities: [
      {
        activityType: 'case_created',
        message: 'Case created from webform submission',
        internal: true,
        metadata: { source: 'web_form' },
        actorId: actorUserId,
        createdAt: now
      }
    ],
    createdBy: actorUserId
  };

  return Case.create(createPayload);
}

async function updateCaseRecord({ existingRecord, payload, organizationId, actorUserId, webformName }) {
  const normalized = ensureCaseDefaults(payload, webformName);
  const $set = buildUpdateWithCustomFields(normalized, Case);
  delete $set.createdBy;
  delete $set.caseId;
  delete $set.assignedTo;

  const record = await Case.findOneAndUpdate(
    { _id: existingRecord._id, organizationId, deletedAt: null },
    { $set, updatedBy: actorUserId },
    { new: true, runValidators: true }
  );

  if (!record) {
    const error = new Error('Failed to update case record.');
    error.statusCode = 500;
    throw error;
  }

  return record;
}

async function createDealRecord({ payload, organizationId, actorUserId, appKey, webformName }) {
  let normalized = ensureDealDefaults(payload, webformName);
  normalized = await applyDefaultDealPipeline(normalized, organizationId, appKey);

  const { standardPayload, customFieldsSet } = extractCustomFields(normalized, Deal);
  const createPayload = {
    ...standardPayload,
    organizationId,
    assignedTo: standardPayload.assignedTo || actorUserId,
    createdBy: actorUserId,
    modifiedBy: actorUserId,
    ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet })
  };

  assignResolvedSource(createPayload, 'web_form');
  const record = await Deal.create(createPayload);

  await computeAndSetDerivedStatus('deal', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function updateDealRecord({ existingRecord, payload, organizationId, actorUserId, appKey, webformName }) {
  let normalized = ensureDealDefaults(payload, webformName);
  if (normalized.pipeline || normalized.stage) {
    normalized = await applyDefaultDealPipeline(normalized, organizationId, appKey);
  }

  const $set = buildUpdateWithCustomFields(normalized, Deal);
  delete $set.source;
  delete $set.createdBy;

  const record = await Deal.findOneAndUpdate(
    { _id: existingRecord._id, organizationId, deletedAt: null },
    { $set, modifiedBy: actorUserId },
    { new: true, runValidators: true }
  );

  if (!record) {
    const error = new Error('Failed to update deal record.');
    error.statusCode = 500;
    throw error;
  }

  await computeAndSetDerivedStatus('deal', record, appKey);
  if (record.isModified()) {
    await record.save();
  }

  return record;
}

async function runPostIngestionAssignment({ record, moduleKey, appKey, actorUserId, organizationId, intent }) {
  try {
    const { runImmediateAssignmentForRecord } = require('./assignmentExecutionService');
    return await runImmediateAssignmentForRecord({
      record,
      moduleKey,
      appKey,
      actorId: actorUserId,
      triggerSource: 'immediate',
      changedFields: intent === 'update' ? ['*'] : [],
      tenantOrganizationId: organizationId
    });
  } catch (assignErr) {
    console.warn('[webformCrmIngestion] assignment hook failed:', assignErr?.message || assignErr);
    return { executed: false, reason: assignErr?.message || 'assignment_failed' };
  }
}

/**
 * @param {object} params
 * @param {import('mongoose').Document} params.webform
 * @param {Record<string, unknown>} params.fieldValues
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 */
async function ingestCrmRecord({
  webform,
  fieldValues,
  organizationId,
  existingRecord = null,
  recordActionOverride = null
}) {
  const moduleKey = String(webform?.targetModuleKey || 'people').toLowerCase();
  const appKey = String(webform?.targetAppKey || 'SALES').toUpperCase();
  const payload = buildCrmPayload(webform, fieldValues);
  const actorUserId = await resolveActorUserId(organizationId, webform);
  const tenantUserIds = moduleKey === 'organizations' ? await getTenantUserIds(organizationId) : [];

  const existing = existingRecord
    || await findExistingRecord({
      moduleKey,
      organizationId,
      payload,
      tenantUserIds
    });

  const actionToUse = recordActionOverride || webform.recordAction;
  const { intent, crmAction } = resolveRecordIntent(actionToUse, existing);
  let record;

  if (moduleKey === 'people') {
    record =
      intent === 'update'
        ? await updatePeopleRecord({ existingRecord: existing, payload, organizationId, actorUserId, appKey })
        : await createPeopleRecord({ payload, organizationId, actorUserId, appKey });
  } else if (moduleKey === 'organizations') {
    record =
      intent === 'update'
        ? await updateOrganizationRecord({
            existingRecord: existing,
            payload,
            actorUserId,
            appKey,
            webformName: webform.name
          })
        : await createOrganizationRecord({
            payload,
            actorUserId,
            appKey,
            webformName: webform.name
          });
  } else if (moduleKey === 'cases') {
    record =
      intent === 'update'
        ? await updateCaseRecord({
            existingRecord: existing,
            payload,
            organizationId,
            actorUserId,
            webformName: webform.name
          })
        : await createCaseRecord({
            payload,
            organizationId,
            actorUserId,
            webformName: webform.name
          });
  } else if (moduleKey === 'deals') {
    record =
      intent === 'update'
        ? await updateDealRecord({
            existingRecord: existing,
            payload,
            organizationId,
            actorUserId,
            appKey,
            webformName: webform.name
          })
        : await createDealRecord({
            payload,
            organizationId,
            actorUserId,
            appKey,
            webformName: webform.name
          });
  } else {
    const error = new Error(`Unsupported target module "${moduleKey}".`);
    error.statusCode = 400;
    throw error;
  }

  const assignmentResult = await runPostIngestionAssignment({
    record,
    moduleKey,
    appKey,
    actorUserId,
    organizationId,
    intent
  });

  return {
    moduleKey,
    recordId: record._id,
    action: crmAction,
    record,
    assignmentResult
  };
}

module.exports = {
  buildCrmPayload,
  ensurePeopleDefaults,
  ensureOrganizationDefaults,
  ensureCaseDefaults,
  ensureDealDefaults,
  resolveRecordIntent,
  resolveActorUserId,
  ingestCrmRecord
};
