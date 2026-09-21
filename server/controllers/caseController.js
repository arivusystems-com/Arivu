const mongoose = require('mongoose');
const Case = require('../models/Case');
const User = require('../models/User');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
const {
  validateCaseRecordId,
  normalizeRelatedItemIds,
  normalizeOptionalText
} = require('../utils/caseApiValidators');
const { parseCaseListQuery } = require('../utils/caseListQuery');
const {
  computeResolutionMetrics,
  computeResponseMetrics,
  computeDailyTrends,
  computeOwnerPerformance,
  computeSegmentPerformance
} = require('../utils/caseAnalytics');
const { handleChannelInteractionForHelpdesk } = require('../services/helpdeskChannelIngestionService');
const { getLiveChatSummaryForCase } = require('../services/liveChatCaseAdapter');
const { stripClientSource, assignResolvedSource } = require('../services/sourceResolver');
const {
  CASE_TYPES,
  CASE_PRIORITIES,
  CASE_CHANNELS
} = require('../constants/caseLifecycle');
const { buildCasesListQuery, computeCasesListStatistics } = require('../utils/listQueryBuilders/casesListQuery');
const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
const {
  isValidCaseStatus,
  canTransitionCaseStatus,
  createInitialSlaCycle,
  applyStatusToSlaCycle,
  createReopenedSlaState
} = require('../services/caseLifecycleService');
const {
  finalizeCaseSlaOnCreate,
  applyCaseSlaLifecycle,
  recalculateCaseSlaTargets,
  reopenCaseSla,
  buildSlaContextFromCase
} = require('../services/sla/slaCaseBridgeService');
const { getSlaScheduleContext, resolveSlaScheduleForOrganization } = require('../services/helpdeskBusinessHoursService');
const { computeCycleSlaProgress } = require('../services/helpdeskSlaClockService');
const { applyCaseActivitySideEffects } = require('../services/caseAutoStatusService');
const caseExecutionService = require('../services/caseExecutionService');

function getActorDisplayName(user) {
  if (!user) return 'System';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username || user.email || 'System';
}

function enrichCaseListSlaFields(row) {
  const cycle = row?.currentSlaCycle;
  if (!cycle) return row;
  return {
    ...row,
    responseMetAt: cycle.responseMetAt || null,
    firstResponseDueAt: row.firstResponseDueAt || cycle.responseTargetAt || null
  };
}


/**
 * "Contact Id" / "contactid" / "ContactId" → `contactid` (matches ModuleDefinition label-style keys).
 */
function looseCaseFieldName(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const CASE_REF_LOOSE_TO_CANONICAL = {
  contactid: 'contactId',
  organizationrefid: 'organizationRefId',
  assignedto: 'assignedTo'
};

/**
 * Module definitions / UIs may send `contactid`, "Contact Id", etc.; Case schema uses `contactId`.
 * Without this, extractCustomFields routes the wrong key into `customFields` and `contactId` stays null.
 */
function normalizeCaseRequestBody(body) {
  if (!body || typeof body !== 'object') return;
  const keys = Object.keys(body);
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
    const loose = looseCaseFieldName(k);
    const canonical = CASE_REF_LOOSE_TO_CANONICAL[loose];
    if (!canonical) continue;
    if (k === canonical) continue;
    if (!Object.prototype.hasOwnProperty.call(body, canonical) || body[canonical] == null || body[canonical] === '') {
      body[canonical] = body[k];
    }
    delete body[k];
  }
}

/** Legacy rows may only have IDs under customFields with odd keys; promote before populate. */
function promoteCaseReferenceIdsFromCustomFields(doc) {
  if (!doc || typeof doc !== 'object') return;
  const cf = doc.customFields;
  if (!cf || typeof cf !== 'object') return;
  for (const [k, v] of Object.entries(cf)) {
    if (v == null || v === '') continue;
    const loose = looseCaseFieldName(k);
    const canonical = CASE_REF_LOOSE_TO_CANONICAL[loose];
    if (!canonical) continue;
    if (!doc[canonical]) {
      doc[canonical] = v;
    }
  }
}

/** After flattenCustomFieldsForResponse, promote alias keys to canonical; drop duplicate alias props. */
function patchCaseFlattenedAliases(plain) {
  if (!plain || typeof plain !== 'object') return;
  if (typeof plain.caseId !== 'string' || !String(plain.caseId).startsWith('CAS-')) return;
  for (const [k, v] of Object.entries(plain)) {
    if (v == null || v === '') continue;
    const loose = looseCaseFieldName(k);
    const canonical = CASE_REF_LOOSE_TO_CANONICAL[loose];
    if (!canonical) continue;
    if (k === canonical) continue;
    if (plain[canonical] == null || plain[canonical] === '') {
      plain[canonical] = v;
    }
  }
  for (const k of Object.keys(plain)) {
    const loose = looseCaseFieldName(k);
    if (!CASE_REF_LOOSE_TO_CANONICAL[loose]) continue;
    const canonical = CASE_REF_LOOSE_TO_CANONICAL[loose];
    if (k !== canonical && plain[canonical] != null && plain[canonical] !== '') {
      delete plain[k];
    }
  }
}

function toSafeObject(record) {
  const plain = typeof record?.toObject === 'function' ? record.toObject() : record;
  const out = flattenCustomFieldsForResponse(plain, plain?.customFields);
  patchCaseFlattenedAliases(out);
  return out;
}

const CASE_REFERENCE_POPULATE = [
  { path: 'assignedTo', select: 'firstName lastName email username' },
  { path: 'contactId', select: 'first_name last_name email' },
  { path: 'organizationRefId', select: 'name' }
];

async function populateCaseReferences(row) {
  if (!row) return;
  await Case.populate(row, CASE_REFERENCE_POPULATE);
}

async function toPopulatedSafeObject(row) {
  await populateCaseReferences(row);
  return toSafeObject(row);
}

async function ensureOwnerInOrg(assignedTo, organizationId) {
  if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) return false;
  const user = await User.findOne({ _id: assignedTo, organizationId }).select('_id').lean();
  return Boolean(user);
}

function buildSlaContextFromCasePayload(payload) {
  return buildSlaContextFromCase(payload);
}

function isValidOptionalObjectId(value) {
  return value == null || value === '' || mongoose.Types.ObjectId.isValid(value);
}

function isAllowedEnumValue(value, allowed) {
  return value == null || value === '' || allowed.includes(value);
}

const MUTABLE_CASE_FIELDS = new Set([
  'title',
  'description',
  'caseType',
  'priority',
  'severity',
  'impact',
  'tags',
  'contactId',
  'organizationRefId',
  'requesterEmail',
  'requesterPhone',
  'preferredLanguage',
  'customerTier',
  'vipCustomer',
  'assignedTo',
  'team',
  'queue',
  'escalationLevel',
  'watchers',
  'channel',
  'relatedItemIds',
  'serialNumber',
  'warrantyStatus',
  'amcStatus',
  'productVersion',
  'environment',
  'caseNotes',
  'resolutionSummary',
  'rootCause',
  'resolutionCode',
  'closureNotes',
  'customerConfirmation',
  'preferredReplyChannel',
  'ccEmails',
  'siteVisitRequired',
  'technicianId',
  'visitDate',
  'visitStatus',
  'replacementRequired'
]);

/** Reserved incoming keys to skip when merging `incoming` onto the document (extend if needed). */
const CASE_INCOMING_ASSIGN_BLOCKED = new Set();

async function loadChannelDefaults(organizationId, channel) {
  if (!channel) return {};
  const config = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK'
  })
    .select('settings.helpdeskExecution.channelRules settings.channelRules')
    .lean();
  const channelRules =
    config?.settings?.helpdeskExecution?.channelRules ||
    config?.settings?.channelRules ||
    {};
  const rule = channelRules[channel] || channelRules[String(channel).toLowerCase()] || {};
  return {
    defaultCaseType: rule.defaultCaseType || null,
    defaultPriority: rule.defaultPriority || null
  };
}

exports.createCase = async (req, res) => {
  try {
    stripClientSource(req.body);
    normalizeCaseRequestBody(req.body);
    const {
      title,
      description,
      caseType,
      priority,
      status,
      severity,
      impact,
      tags,
      contactId,
      organizationRefId,
      requesterEmail,
      requesterPhone,
      preferredLanguage,
      customerTier,
      vipCustomer,
      assignedTo,
      channel,
      relatedItemIds,
      serialNumber,
      warrantyStatus,
      amcStatus,
      productVersion,
      environment,
      caseNotes,
      resolutionSummary,
      rootCause,
      resolutionCode,
      closureNotes,
      customerConfirmation,
      preferredReplyChannel,
      ccEmails,
      team,
      queue,
      escalationLevel,
      watchers,
      siteVisitRequired,
      technicianId,
      visitDate,
      visitStatus,
      replacementRequired
    } = req.body || {};

    const resolvedChannel = channel || 'Internal';
    const channelDefaults = await loadChannelDefaults(req.user.organizationId, resolvedChannel);
    const resolvedCaseType = caseType || channelDefaults.defaultCaseType || 'Support Ticket';
    const resolvedPriority = priority || channelDefaults.defaultPriority || 'Medium';

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    if (!isAllowedEnumValue(resolvedCaseType, CASE_TYPES)) {
      return res.status(400).json({ success: false, message: 'Invalid caseType value' });
    }
    if (!isAllowedEnumValue(resolvedPriority, CASE_PRIORITIES)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value' });
    }
    if (!isAllowedEnumValue(resolvedChannel, CASE_CHANNELS)) {
      return res.status(400).json({ success: false, message: 'Invalid channel value' });
    }

    if (!isValidOptionalObjectId(contactId) || !isValidOptionalObjectId(organizationRefId)) {
      return res.status(400).json({ success: false, message: 'Invalid contactId or organizationRefId' });
    }
    const relatedItemsValidation = normalizeRelatedItemIds(relatedItemIds);
    if (!relatedItemsValidation.valid) {
      return res.status(400).json({ success: false, message: relatedItemsValidation.error });
    }
    const notesValidation = normalizeOptionalText(caseNotes, 4000);
    if (!notesValidation.valid) {
      return res.status(400).json({ success: false, message: notesValidation.error });
    }
    const descValidation = normalizeOptionalText(description, 20000);
    if (!descValidation.valid) {
      return res.status(400).json({ success: false, message: descValidation.error });
    }
    const resolutionValidation = normalizeOptionalText(resolutionSummary, 4000);
    if (!resolutionValidation.valid) {
      return res.status(400).json({ success: false, message: resolutionValidation.error });
    }

    const tagsNormalized = Array.isArray(tags)
      ? [...new Set(tags.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 50)
      : [];
    const ccNormalized = Array.isArray(ccEmails)
      ? [...new Set(ccEmails.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 50)
      : [];

    const resolvedAssignedTo = assignedTo || req.user._id;
    const ownerExists = await ensureOwnerInOrg(resolvedAssignedTo, req.user.organizationId);
    if (!ownerExists) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo must be an active user in your organization'
      });
    }

    const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
    const ownerAssignCheck = await validateRecordAssignmentRequest(req, resolvedAssignedTo, { skipSelf: true });
    if (ownerAssignCheck) {
      return res.status(ownerAssignCheck.status).json(ownerAssignCheck.body);
    }

    if (status && !isValidCaseStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const normalizedStatus = status || 'New';
    if ((normalizedStatus === 'Resolved' || normalizedStatus === 'Closed') && !String(resolutionSummary || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'resolutionSummary is required when creating a Resolved or Closed case'
      });
    }
    const cycle = createInitialSlaCycle(1, new Date());
    const adjustedCycle = applyStatusToSlaCycle(cycle, normalizedStatus);

    const { customFieldsSet } = extractCustomFields(req.body, Case);
    const now = new Date();
    let caseId = req.body?.caseId ? String(req.body.caseId).trim() : '';
    if (!caseId) {
      const { allocateRequired } = require('../services/moduleNumberingService');
      caseId = await allocateRequired({
        organizationId: req.user.organizationId,
        moduleKey: 'cases',
        at: now,
      });
    }
    const actorName = getActorDisplayName(req.user);

    const payload = {
      organizationId: req.user.organizationId,
      caseId,
      title: String(title).trim(),
      description: descValidation.value,
      caseType: resolvedCaseType,
      priority: resolvedPriority,
      status: normalizedStatus,
      severity: severity ? String(severity).trim() : null,
      impact: impact ? String(impact).trim() : null,
      tags: tagsNormalized,
      contactId: contactId || null,
      organizationRefId: organizationRefId || null,
      requesterEmail: requesterEmail ? String(requesterEmail).trim() : null,
      requesterPhone: requesterPhone ? String(requesterPhone).trim() : null,
      preferredLanguage: preferredLanguage ? String(preferredLanguage).trim() : null,
      customerTier: customerTier ? String(customerTier).trim() : null,
      vipCustomer: Boolean(vipCustomer),
      assignedTo: resolvedAssignedTo,
      team: team ? String(team).trim() : null,
      queue: queue ? String(queue).trim() : null,
      escalationLevel: escalationLevel ? String(escalationLevel).trim() : null,
      watchers: Array.isArray(watchers) ? watchers.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [],
      channel: resolvedChannel,
      relatedItemIds: relatedItemsValidation.ids,
      serialNumber: serialNumber ? String(serialNumber).trim() : null,
      warrantyStatus: warrantyStatus ? String(warrantyStatus).trim() : null,
      amcStatus: amcStatus ? String(amcStatus).trim() : null,
      productVersion: productVersion ? String(productVersion).trim() : null,
      environment: environment ? String(environment).trim() : null,
      caseNotes: notesValidation.value,
      resolutionSummary: resolutionValidation.value,
      rootCause: rootCause ? String(rootCause).trim() : null,
      resolutionCode: resolutionCode ? String(resolutionCode).trim() : null,
      closureNotes: closureNotes ? String(closureNotes).trim() : null,
      customerConfirmation: Boolean(customerConfirmation),
      preferredReplyChannel: preferredReplyChannel ? String(preferredReplyChannel).trim() : null,
      ccEmails: ccNormalized,
      siteVisitRequired: Boolean(siteVisitRequired),
      technicianId: mongoose.Types.ObjectId.isValid(technicianId) ? technicianId : null,
      visitDate: visitDate ? new Date(visitDate) : null,
      visitStatus: visitStatus ? String(visitStatus).trim() : null,
      replacementRequired: Boolean(replacementRequired),
      currentSlaCycle: adjustedCycle,
      activities: [
        {
          activityType: 'case_created',
          message: 'Case created',
          internal: true,
          metadata: {},
          actorId: req.user._id,
          actorName,
          createdAt: now
        }
      ],
      ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    assignResolvedSource(payload, 'ui');

    try {
      const { evaluateDuplicates } = require('../services/duplicates');
      const dupResult = await evaluateDuplicates({
        organizationId: req.user.organizationId,
        moduleKey: 'cases',
        candidate: payload,
        emitEvent: true,
        triggeredBy: req.user._id,
        limit: 5,
      });
      if (dupResult.enabled && dupResult.hasMatch) {
        const policy = dupResult.policy || 'warn';
        if (policy === 'reject' || policy === 'warn') {
          return res.status(409).json({
            success: false,
            code: policy === 'reject' ? 'DUPLICATE_REJECTED' : 'DUPLICATE_WARNING',
            message: 'A matching Case already exists.',
            data: { matches: dupResult.matches, policy },
          });
        }
      }
    } catch (dupErr) {
      console.warn('[caseController.createCase] duplicate check failed:', dupErr.message);
    }

    const created = await Case.create(payload);
    created.currentSlaCycle = await finalizeCaseSlaOnCreate({
      organizationId: req.user.organizationId,
      caseRecord: created,
      actorId: req.user._id
    });
    await created.save();
    await caseExecutionService.onCaseCreated({
      caseRecord: created,
      actorId: req.user._id
    });

    // Legacy Astra Super Agent case-created trigger removed with Astra v2 cutover.

    return res.status(201).json({
      success: true,
      data: toSafeObject(created),
      meta: {
        operation: 'create_case'
      }
    });
  } catch (error) {
    console.error('[caseController] createCase error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create case'
    });
  }
};

exports.getCases = async (req, res) => {
  try {
    const queryParams = { ...(req.query || {}) };
    if (queryParams.assignedTo === 'me') {
      queryParams.assignedTo = req.user?._id;
    }
    const parsedQuery = parseCaseListQuery(queryParams, {
      CASE_STATUSES: Case.CASE_STATUSES || [],
      CASE_PRIORITIES: CASE_PRIORITIES,
      CASE_TYPES: CASE_TYPES,
      CASE_CHANNELS: CASE_CHANNELS
    });
    if (parsedQuery.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: parsedQuery.errors[0]
      });
    }

    let query;
    try {
      query = buildCasesListQuery(req);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to fetch cases'
      });
    }

    const limit = parsedQuery.limit;
    const skip = parsedQuery.skip;

    const [rows, total, listCardBreakdown] = await Promise.all([
      Case.find(query).sort(parsedQuery.sort).skip(skip).limit(limit).lean(),
      Case.countDocuments(query),
      computeCasesListStatistics(query)
    ]);
    for (const row of rows) {
      promoteCaseReferenceIdsFromCustomFields(row);
    }
    await Case.populate(rows, [
      { path: 'assignedTo', select: 'firstName lastName email username' },
      { path: 'contactId', select: 'first_name last_name name email' },
      { path: 'organizationRefId', select: 'name' }
    ]);

    return res.json({
      success: true,
      data: rows.map((row) => {
        const enriched = enrichCaseListSlaFields(row);
        const flat = flattenCustomFieldsForResponse(enriched, enriched.customFields);
        patchCaseFlattenedAliases(flat);
        return flat;
      }),
      meta: { total, totalRecords: total, skip, limit },
      pagination: {
        totalRecords: total,
        totalCases: total,
        limit
      },
      listStatistics: {
        ...listCardBreakdown,
        totalCases: total,
        myCases: total
      }
    });
  } catch (error) {
    console.error('[caseController] getCases error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cases'
    });
  }
};

exports.getCaseById = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    }).lean();

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    promoteCaseReferenceIdsFromCustomFields(row);
    await Case.populate(row, [
      { path: 'assignedTo', select: 'firstName lastName email' },
      { path: 'contactId', select: 'first_name last_name email' },
      { path: 'organizationRefId', select: 'name' },
      { path: 'relatedItemIds', select: 'name sku' }
    ]);

    const activityLimit = Math.max(0, Math.min(Number(req.query.activityLimit) || 200, 500));
    const allActivities = Array.isArray(row.activities) ? row.activities : [];
    const trimmedActivities = activityLimit > 0 ? allActivities.slice(-activityLimit) : [];
    const { buildCaseTimelineActivities } = require('../platform/mailroom/services/caseTimelineAdapter');
    const {
      enrichCaseActivitiesWithMailroomAttachments
    } = require('../platform/mailroom/services/caseActivityAttachmentService');
    let mergedTimeline = trimmedActivities;
    try {
      mergedTimeline = await buildCaseTimelineActivities(
        req.user.organizationId,
        row._id,
        trimmedActivities
      );
    } catch (timelineErr) {
      console.error('[caseController] getCaseById timeline merge failed', timelineErr);
    }
    let activitiesWithAttachments = mergedTimeline;
    try {
      activitiesWithAttachments = await enrichCaseActivitiesWithMailroomAttachments(
        req.user.organizationId,
        mergedTimeline,
        row._id
      );
    } catch (attachErr) {
      console.error('[caseController] getCaseById attachment enrich failed', attachErr);
    }
    let activitiesWithDelivery = activitiesWithAttachments;
    try {
      activitiesWithDelivery = await enrichCaseActivitiesWithEmailDelivery(
        req.user.organizationId,
        activitiesWithAttachments
      );
    } catch (deliveryErr) {
      console.error('[caseController] getCaseById delivery enrich failed', deliveryErr);
    }
    const shaped = {
      ...row,
      activities: activitiesWithDelivery
    };

    const flat = flattenCustomFieldsForResponse(shaped, shaped.customFields);
    patchCaseFlattenedAliases(flat);

    let slaContext = null;
    let slaProgress = null;
    try {
      slaContext = await getSlaScheduleContext(req.user.organizationId);
      const scheduleResolution = await resolveSlaScheduleForOrganization(req.user.organizationId);
      if (row.currentSlaCycle) {
        slaProgress = computeCycleSlaProgress(
          row.currentSlaCycle?.toObject?.() || row.currentSlaCycle,
          scheduleResolution
        );
      }
    } catch (slaCtxErr) {
      console.warn('[caseController] slaContext:', slaCtxErr.message);
    }

    return res.json({
      success: true,
      data: {
        ...flat,
        slaContext,
        slaProgress
      },
      meta: {
        totalActivities: allActivities.length,
        returnedActivities: trimmedActivities.length,
        activityLimit,
        slaContext,
        slaProgress
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseById error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case'
    });
  }
};

exports.updateCase = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (row.status === 'Closed') {
      return res.status(403).json({
        success: false,
        message: 'Closed cases cannot be edited. Reopen the case to make changes.'
      });
    }

    const previousSnapshot = row.toObject ? row.toObject() : { ...row };

    const incomingRaw = { ...req.body };
    stripClientSource(incomingRaw);
    normalizeCaseRequestBody(incomingRaw);
    const { standardPayload, customFieldsSet } = extractCustomFields(incomingRaw, Case);
    const incoming = {};
    const previousState = {
      assignedTo: row.assignedTo,
      status: row.status,
      priority: row.priority,
      caseType: row.caseType,
      channel: row.channel
    };
    const changedFields = [];

    if (Object.prototype.hasOwnProperty.call(incomingRaw, 'status')) {
      return res.status(400).json({
        success: false,
        message: 'Use PATCH /:id/status for lifecycle transitions'
      });
    }

    const disallowedSystemFields = Object.keys(standardPayload).filter((key) => !MUTABLE_CASE_FIELDS.has(key));
    if (disallowedSystemFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported or system-managed fields in payload: ${disallowedSystemFields.join(', ')}`
      });
    }

    Object.keys(standardPayload).forEach((key) => {
      if (MUTABLE_CASE_FIELDS.has(key)) {
        incoming[key] = standardPayload[key];
      }
    });

    if (!isAllowedEnumValue(incoming.caseType, CASE_TYPES)) {
      return res.status(400).json({ success: false, message: 'Invalid caseType value' });
    }
    if (!isAllowedEnumValue(incoming.priority, CASE_PRIORITIES)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value' });
    }
    if (!isAllowedEnumValue(incoming.channel, CASE_CHANNELS)) {
      return res.status(400).json({ success: false, message: 'Invalid channel value' });
    }
    if (
      !isValidOptionalObjectId(incoming.contactId) ||
      !isValidOptionalObjectId(incoming.organizationRefId)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid contactId or organizationRefId' });
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'relatedItemIds')) {
      const relatedItemsValidation = normalizeRelatedItemIds(incoming.relatedItemIds);
      if (!relatedItemsValidation.valid) {
        return res.status(400).json({ success: false, message: relatedItemsValidation.error });
      }
      incoming.relatedItemIds = relatedItemsValidation.ids;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'caseNotes')) {
      const notesValidation = normalizeOptionalText(incoming.caseNotes, 4000);
      if (!notesValidation.valid) {
        return res.status(400).json({ success: false, message: notesValidation.error });
      }
      incoming.caseNotes = notesValidation.value;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'description')) {
      const descValidation = normalizeOptionalText(incoming.description, 20000);
      if (!descValidation.valid) {
        return res.status(400).json({ success: false, message: descValidation.error });
      }
      incoming.description = descValidation.value;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'resolutionSummary')) {
      const resolutionValidation = normalizeOptionalText(incoming.resolutionSummary, 4000);
      if (!resolutionValidation.valid) {
        return res.status(400).json({ success: false, message: resolutionValidation.error });
      }
      incoming.resolutionSummary = resolutionValidation.value;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'closureNotes')) {
      const closureValidation = normalizeOptionalText(incoming.closureNotes, 8000);
      if (!closureValidation.valid) {
        return res.status(400).json({ success: false, message: closureValidation.error });
      }
      incoming.closureNotes = closureValidation.value;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'tags')) {
      incoming.tags = Array.isArray(incoming.tags)
        ? [...new Set(incoming.tags.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 50)
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'ccEmails')) {
      incoming.ccEmails = Array.isArray(incoming.ccEmails)
        ? [...new Set(incoming.ccEmails.map((t) => String(t || '').trim()).filter(Boolean))].slice(0, 50)
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'watchers')) {
      incoming.watchers = Array.isArray(incoming.watchers)
        ? incoming.watchers.filter((id) => mongoose.Types.ObjectId.isValid(id))
        : [];
    }

    if (incoming.assignedTo && String(incoming.assignedTo) !== String(row.assignedTo)) {
      const ownerExists = await ensureOwnerInOrg(incoming.assignedTo, req.user.organizationId);
      if (!ownerExists) {
        return res.status(400).json({
          success: false,
          message: 'assignedTo must be an active user in your organization'
        });
      }

      const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
      const ownerAssignCheck = await validateRecordAssignmentRequest(req, incoming.assignedTo, { skipSelf: true });
      if (ownerAssignCheck) {
        return res.status(ownerAssignCheck.status).json(ownerAssignCheck.body);
      }
    }

    Object.keys(incoming).forEach((key) => {
      if (CASE_INCOMING_ASSIGN_BLOCKED.has(key)) {
        return;
      }
      const previousValue = row[key];
      row[key] = incoming[key];
      if (String(previousValue ?? '') !== String(incoming[key] ?? '')) {
        changedFields.push(key);
      }
    });

    const shouldRecalculateSlaTargets = ['priority', 'caseType', 'channel']
      .some((key) => Object.prototype.hasOwnProperty.call(incoming, key));

    if (Object.keys(customFieldsSet).length > 0) {
      row.customFields = {
        ...(row.customFields || {}),
        ...customFieldsSet
      };
    }

    row.updatedBy = req.user._id;
    assignResolvedSource(row, row.source || 'ui');

    if (shouldRecalculateSlaTargets && row.currentSlaCycle?.status !== 'stopped') {
      row.currentSlaCycle = await recalculateCaseSlaTargets({
        organizationId: req.user.organizationId,
        caseRecord: row,
        cycle: row.currentSlaCycle?.toObject?.() || row.currentSlaCycle
      });
      row.activities.push({
        activityType: 'sla_recalculated',
        message: 'SLA targets recalculated from updated case context',
        internal: true,
        metadata: { reason: 'case_context_changed' },
        actorId: req.user._id,
        actorName: getActorDisplayName(req.user),
        createdAt: new Date()
      });
    }

    await row.save();

    const prevCustom = { ...(previousSnapshot.customFields || {}) };
    const nextCustom = { ...(row.customFields || {}) };
    const customChangedKeys = [];
    for (const ck of Object.keys(customFieldsSet)) {
      if (String(prevCustom[ck] ?? '') !== String(nextCustom[ck] ?? '')) {
        customChangedKeys.push(ck);
      }
    }
    const recordActivityKeys = [...changedFields, ...customChangedKeys];
    if (recordActivityKeys.length > 0) {
      try {
        const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
        const ModuleDefinition = require('../models/ModuleDefinition');
        const rowPlain = row.toObject ? row.toObject() : row;
        const previousForLog = {};
        const updatedForLog = {};
        for (const k of changedFields) {
          previousForLog[k] = previousSnapshot[k];
          updatedForLog[k] = rowPlain[k];
        }
        for (const ck of customChangedKeys) {
          previousForLog[ck] = prevCustom[ck];
          updatedForLog[ck] = nextCustom[ck];
        }
        const moduleDef = await ModuleDefinition.findOne({
          organizationId: req.user.organizationId,
          key: 'cases'
        });
        await appendFieldChangeLogs({
          organizationId: req.user.organizationId,
          moduleKey: 'cases',
          recordId: req.params.id,
          authorId: req.user._id,
          previous: previousForLog,
          updated: updatedForLog,
          updateDataKeys: recordActivityKeys,
          fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
        });
      } catch (logErr) {
        console.warn('Record activity log (case update) failed:', logErr?.message || logErr);
      }
    }

    await caseExecutionService.onCaseUpdated({
      caseRecord: row,
      actorId: req.user._id,
      previousState,
      changedFields
    });
    return res.json({
      success: true,
      data: await toPopulatedSafeObject(row),
      meta: {
        operation: 'update_case',
        changedFields
      }
    });
  } catch (error) {
    console.error('[caseController] updateCase error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update case'
    });
  }
};

exports.deleteCase = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'cases',
      recordId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      appKey: 'HELPDESK',
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body.cascadeConfirmed
    });

    if (!result.ok) {
      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          dependencies: result.dependencies,
          message: result.message
        });
      }
      const msg = result.message || '';
      if (/not found|access denied/i.test(msg)) {
        return res.status(404).json({ success: false, message: msg || 'Case not found' });
      }
      return res.status(400).json({ success: false, message: msg || 'Failed to delete case' });
    }

    return res.status(200).json({
      success: true,
      message: 'Case moved to trash',
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (error) {
    console.error('[caseController] deleteCase error', error);
    return res.status(500).json({ success: false, message: 'Failed to delete case' });
  }
};

exports.updateCaseStatus = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    if (!isValidCaseStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (!canTransitionCaseStatus(row.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid lifecycle transition from ${row.status} to ${status}`
      });
    }

    if ((status === 'Resolved' || status === 'Closed') && !String(req.body.resolutionSummary || row.resolutionSummary || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'resolutionSummary is required before resolving or closing a case'
      });
    }

    const fromStatus = row.status;
    row.status = status;
    row.currentSlaCycle = applyStatusToSlaCycle(row.currentSlaCycle?.toObject?.() || row.currentSlaCycle, status);
    row.currentSlaCycle = await applyCaseSlaLifecycle({
      organizationId: req.user.organizationId,
      caseRecord: row,
      cycle: row.currentSlaCycle,
      changes: { status, fromStatus },
      event: { type: 'field_change', field: 'status', fromValue: fromStatus, toValue: status },
      actorId: req.user._id
    });
    if (typeof req.body.resolutionSummary === 'string') {
      row.resolutionSummary = req.body.resolutionSummary.trim();
    }
    row.updatedBy = req.user._id;

    row.activities.push({
      activityType: 'status_changed',
      message: `Status changed from ${fromStatus} to ${status}`,
      internal: true,
      metadata: { fromStatus, toStatus: status },
      actorId: req.user._id,
      actorName: getActorDisplayName(req.user),
      createdAt: new Date()
    });

    await row.save();
    await caseExecutionService.onCaseStatusChanged({
      caseRecord: row,
      actorId: req.user._id,
      fromStatus,
      toStatus: status
    });
    return res.json({
      success: true,
      data: await toPopulatedSafeObject(row),
      meta: {
        operation: 'update_case_status',
        fromStatus,
        toStatus: status
      }
    });
  } catch (error) {
    console.error('[caseController] updateCaseStatus error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update case status'
    });
  }
};

exports.bulkUpdateCases = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids is required' });
    }
    const normalizedIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
    if (normalizedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ success: false, message: 'All ids must be valid case ids' });
    }

    const allowedBulkFields = new Set(['assignedTo', 'priority', 'status']);
    const incoming = req.body?.updates && typeof req.body.updates === 'object' ? req.body.updates : {};
    const updateKeys = Object.keys(incoming).filter((key) => allowedBulkFields.has(key));
    if (updateKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'updates must include one of: assignedTo, priority, status' });
    }

    if (updateKeys.includes('priority') && !isAllowedEnumValue(incoming.priority, CASE_PRIORITIES)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value' });
    }
    if (updateKeys.includes('status') && !isValidCaseStatus(incoming.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    if (updateKeys.includes('assignedTo')) {
      const ownerExists = await ensureOwnerInOrg(incoming.assignedTo, req.user.organizationId);
      if (!ownerExists) {
        return res.status(400).json({
          success: false,
          message: 'assignedTo must be an active user in your organization'
        });
      }
    }

    const rows = await Case.find({
      _id: { $in: normalizedIds },
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No cases found for provided ids' });
    }

    const results = {
      updated: 0,
      skipped: 0,
      skippedIds: []
    };
    const actorName = getActorDisplayName(req.user);

    for (const row of rows) {
      if (row.status === 'Closed' && updateKeys.some((key) => key !== 'status')) {
        results.skipped += 1;
        results.skippedIds.push(String(row._id));
        continue;
      }
      const fromStatus = row.status;
      let changed = false;

      if (updateKeys.includes('assignedTo') && String(row.assignedTo || '') !== String(incoming.assignedTo || '')) {
        row.assignedTo = incoming.assignedTo;
        changed = true;
      }
      if (updateKeys.includes('priority') && String(row.priority || '') !== String(incoming.priority || '')) {
        row.priority = incoming.priority;
        changed = true;
      }
      if (updateKeys.includes('status') && String(row.status || '') !== String(incoming.status || '')) {
        if (!canTransitionCaseStatus(row.status, incoming.status)) {
          results.skipped += 1;
          results.skippedIds.push(String(row._id));
          continue;
        }
        row.status = incoming.status;
        row.currentSlaCycle = applyStatusToSlaCycle(row.currentSlaCycle?.toObject?.() || row.currentSlaCycle, incoming.status);
        row.currentSlaCycle = await applyCaseSlaLifecycle({
          organizationId: req.user.organizationId,
          caseRecord: row,
          cycle: row.currentSlaCycle,
          changes: { status: incoming.status, fromStatus },
          event: { type: 'field_change', field: 'status', fromValue: fromStatus, toValue: incoming.status },
          actorId: req.user._id
        });
        row.activities.push({
          activityType: 'status_changed',
          message: `Status changed from ${fromStatus} to ${incoming.status}`,
          internal: true,
          metadata: { fromStatus, toStatus: incoming.status, source: 'bulk_update' },
          actorId: req.user._id,
          actorName,
          createdAt: new Date()
        });
        changed = true;
      }

      if (!changed) continue;
      row.updatedBy = req.user._id;
      await row.save();
      results.updated += 1;
    }

    return res.json({
      success: true,
      data: results,
      meta: {
        operation: 'bulk_update_cases',
        updatedFields: updateKeys
      }
    });
  } catch (error) {
    console.error('[caseController] bulkUpdateCases error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update cases'
    });
  }
};

exports.reopenCase = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    if (row.status !== 'Resolved' && row.status !== 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Only Resolved or Closed cases can be reopened'
      });
    }

    const reopenReasonValidation = normalizeOptionalText(req.body?.reopenReason, 1000);
    if (!reopenReasonValidation.valid) {
      return res.status(400).json({
        success: false,
        message: reopenReasonValidation.error
      });
    }
    if (!String(reopenReasonValidation.value || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'reopenReason is required to reopen a case'
      });
    }

    const { previousCycle, nextCycle } = createReopenedSlaState(row.currentSlaCycle?.toObject?.() || row.currentSlaCycle, new Date());
    row.slaCycles.push(previousCycle);
    row.currentSlaCycle = await reopenCaseSla({
      organizationId: req.user.organizationId,
      caseRecord: row,
      previousCycle,
      nextCycle,
      actorId: req.user._id
    });
    row.status = 'In Progress';
    row.reopenReason = reopenReasonValidation.value;
    row.reopenCount = (Number(row.reopenCount) || 0) + 1;
    row.updatedBy = req.user._id;

    row.activities.push({
      activityType: 'case_reopened',
      message: 'Case reopened and moved to In Progress',
      internal: true,
      metadata: {
        previousCycleNo: previousCycle.cycleNo,
        newCycleNo: row.currentSlaCycle.cycleNo,
        reopenReason: reopenReasonValidation.value
      },
      actorId: req.user._id,
      actorName: getActorDisplayName(req.user),
      createdAt: new Date()
    });

    await row.save();
    await caseExecutionService.onCaseReopened({
      caseRecord: row,
      actorId: req.user._id,
      previousCycleNo: previousCycle.cycleNo,
      newCycleNo: row.currentSlaCycle.cycleNo
    });
    return res.json({
      success: true,
      data: await toPopulatedSafeObject(row),
      meta: {
        operation: 'reopen_case'
      }
    });
  } catch (error) {
    console.error('[caseController] reopenCase error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reopen case'
    });
  }
};

exports.addCaseActivity = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const { activityType, message, channel, internal = true, metadata = {} } = req.body || {};
    if (!activityType || !String(activityType).trim()) {
      return res.status(400).json({ success: false, message: 'activityType is required' });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    row.activities.push({
      activityType: String(activityType).trim(),
      message: message ? String(message).trim() : '',
      channel,
      internal: Boolean(internal),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      actorId: req.user._id,
      actorName: getActorDisplayName(req.user),
      createdAt: new Date()
    });

    const { slaMarked: responseMarked, statusResult } = await applyCaseActivitySideEffects(row, {
      activityType: String(activityType).trim(),
      internal: Boolean(internal),
      actorId: req.user._id,
      actorName: getActorDisplayName(req.user),
      channel: channel || row.channel
    });

    if (responseMarked) {
      row.activities.push({
        activityType: 'sla_response_met',
        message: 'First response SLA met',
        internal: true,
        metadata: { responseMetAt: row.currentSlaCycle.responseMetAt },
        actorId: req.user._id,
        actorName: getActorDisplayName(req.user),
        createdAt: new Date()
      });
    }

    row.updatedBy = req.user._id;
    await row.save();

    if (statusResult?.changed) {
      await caseExecutionService.onCaseStatusChanged({
        caseRecord: row,
        actorId: req.user._id,
        fromStatus: statusResult.fromStatus,
        toStatus: statusResult.toStatus
      });
    }

    await caseExecutionService.onCaseActivityLogged({
      caseRecord: row,
      actorId: req.user._id,
      activityType: String(activityType).trim()
    });

    const lastActivity = row.activities[row.activities.length - 1];
    const { notifyPortalCaseCustomerActivity } = require('../services/portalCaseNotificationService');
    await notifyPortalCaseCustomerActivity(row, lastActivity, { actorId: req.user._id });

    return res.status(201).json({
      success: true,
      data: await toPopulatedSafeObject(row),
      meta: {
        operation: 'add_case_activity',
        activityType: String(activityType).trim()
      }
    });
  } catch (error) {
    console.error('[caseController] addCaseActivity error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add case activity'
    });
  }
};

exports.getCaseAnalyticsSummary = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ success: false, message: 'Invalid from/to date filter' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ success: false, message: 'from must be earlier than to' });
    }

    const baseQuery = {
      organizationId: req.user.organizationId,
      deletedAt: null
    };
    if (from || to) {
      baseQuery.createdAt = {};
      if (from) baseQuery.createdAt.$gte = from;
      if (to) baseQuery.createdAt.$lte = to;
    }

    const [cases, statusCounts, ownerLoads] = await Promise.all([
      Case.find(baseQuery)
        .select('status createdAt activities currentSlaCycle slaCycles assignedTo')
        .lean(),
      Case.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Case.aggregate([
        {
          $match: {
            ...baseQuery,
            status: { $nin: ['Resolved', 'Closed'] }
          }
        },
        { $group: { _id: '$assignedTo', openCases: { $sum: 1 } } },
        { $sort: { openCases: -1 } },
        { $limit: 20 }
      ])
    ]);

    const statusMap = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
    const totals = {
      totalCases: cases.length,
      openCases: (statusMap.New || 0) + (statusMap.Assigned || 0) + (statusMap['In Progress'] || 0) + (statusMap['On Hold'] || 0) + (statusMap['Waiting for Customer'] || 0),
      closedCases: (statusMap.Resolved || 0) + (statusMap.Closed || 0),
      reopenCount: cases.filter((row) => Array.isArray(row.slaCycles) && row.slaCycles.length > 0).length
    };

    const resolution = computeResolutionMetrics(cases);
    const response = computeResponseMetrics(cases);

    return res.json({
      success: true,
      data: {
        totals,
        resolution,
        response,
        statusBreakdown: statusMap,
        workloadByOwner: ownerLoads.map((row) => ({
          assignedTo: row._id,
          openCases: row.openCases
        }))
      },
      meta: {
        operation: 'case_analytics_summary',
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseAnalyticsSummary error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case analytics summary'
    });
  }
};

exports.getCaseAnalyticsTrends = async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000));
    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid from/to date filter' });
    }
    if (from > to) {
      return res.status(400).json({ success: false, message: 'from must be earlier than to' });
    }

    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 180) {
      return res.status(400).json({ success: false, message: 'Date range too large. Max 180 days.' });
    }

    const rows = await Case.find({
      organizationId: req.user.organizationId,
      deletedAt: null,
      createdAt: { $lte: to },
      $or: [
        { createdAt: { $gte: from } },
        { 'currentSlaCycle.stoppedAt': { $gte: from, $lte: to } },
        { slaCycles: { $elemMatch: { stoppedAt: { $gte: from, $lte: to } } } }
      ]
    })
      .select('createdAt currentSlaCycle slaCycles')
      .lean();

    const points = computeDailyTrends(rows, { from, to });

    return res.json({
      success: true,
      data: {
        granularity: 'day',
        points
      },
      meta: {
        operation: 'case_analytics_trends',
        from: from.toISOString(),
        to: to.toISOString(),
        days
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseAnalyticsTrends error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case analytics trends'
    });
  }
};

exports.getCaseAnalyticsOwners = async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000));
    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid from/to date filter' });
    }
    if (from > to) {
      return res.status(400).json({ success: false, message: 'from must be earlier than to' });
    }
    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 180) {
      return res.status(400).json({ success: false, message: 'Date range too large. Max 180 days.' });
    }

    const rows = await Case.find({
      organizationId: req.user.organizationId,
      deletedAt: null,
      createdAt: { $gte: from, $lte: to },
      assignedTo: { $ne: null }
    })
      .select('assignedTo status currentSlaCycle slaCycles')
      .lean();

    const metrics = computeOwnerPerformance(rows)
      .sort((a, b) => b.totalCases - a.totalCases)
      .slice(0, 50);

    const ownerIds = metrics
      .map((row) => row.assignedTo)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    const owners = await User.find({
      _id: { $in: ownerIds },
      organizationId: req.user.organizationId
    })
      .select('_id firstName lastName email')
      .lean();
    const ownerMap = new Map(owners.map((row) => [String(row._id), row]));

    const data = metrics.map((row) => {
      const owner = ownerMap.get(String(row.assignedTo));
      return {
        ...row,
        owner: owner
          ? {
              id: owner._id,
              firstName: owner.firstName || '',
              lastName: owner.lastName || '',
              email: owner.email || ''
            }
          : null
      };
    });

    return res.json({
      success: true,
      data,
      meta: {
        operation: 'case_analytics_owners',
        from: from.toISOString(),
        to: to.toISOString(),
        days,
        ownerCount: data.length
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseAnalyticsOwners error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case owner analytics'
    });
  }
};

exports.getCaseAnalyticsDistribution = async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000));
    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid from/to date filter' });
    }
    if (from > to) {
      return res.status(400).json({ success: false, message: 'from must be earlier than to' });
    }
    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 180) {
      return res.status(400).json({ success: false, message: 'Date range too large. Max 180 days.' });
    }

    const rows = await Case.find({
      organizationId: req.user.organizationId,
      deletedAt: null,
      createdAt: { $gte: from, $lte: to }
    })
      .select('priority channel caseType currentSlaCycle slaCycles')
      .lean();

    const byPriority = computeSegmentPerformance(rows, 'priority')
      .sort((a, b) => b.totalCases - a.totalCases);
    const byChannel = computeSegmentPerformance(rows, 'channel')
      .sort((a, b) => b.totalCases - a.totalCases);
    const byCaseType = computeSegmentPerformance(rows, 'caseType')
      .sort((a, b) => b.totalCases - a.totalCases);

    return res.json({
      success: true,
      data: {
        byPriority,
        byChannel,
        byCaseType
      },
      meta: {
        operation: 'case_analytics_distribution',
        from: from.toISOString(),
        to: to.toISOString(),
        days
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseAnalyticsDistribution error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case analytics distribution'
    });
  }
};

exports.getCaseAuditExport = async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ success: false, message: 'Invalid from/to date filter' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ success: false, message: 'from must be earlier than to' });
    }

    const baseQuery = {
      organizationId: req.user.organizationId,
      deletedAt: null
    };
    if (from || to) {
      baseQuery.updatedAt = {};
      if (from) baseQuery.updatedAt.$gte = from;
      if (to) baseQuery.updatedAt.$lte = to;
    }

    const rows = await Case.find(baseQuery)
      .select('caseId title status priority assignedTo currentSlaCycle slaCycles activities updatedAt')
      .lean();

    const data = rows.map((row) => {
      const activities = Array.isArray(row.activities) ? row.activities : [];
      const assignmentEvents = activities.filter((a) => String(a?.activityType || '').startsWith('assignment_'));
      const slaEvents = activities.filter((a) => String(a?.activityType || '').startsWith('sla_'));
      const timeline = activities.map((a) => ({
        type: a.activityType || null,
        message: a.message || null,
        internal: Boolean(a.internal),
        createdAt: a.createdAt || null,
        actorId: a.actorId || null,
        actorName: a.actorName || null,
        metadata: a.metadata || {}
      }));
      return {
        caseId: row.caseId,
        title: row.title,
        status: row.status,
        priority: row.priority,
        assignedTo: row.assignedTo || null,
        updatedAt: row.updatedAt || null,
        currentSlaCycle: row.currentSlaCycle || null,
        historicalSlaCycles: Array.isArray(row.slaCycles) ? row.slaCycles : [],
        assignmentEvents,
        slaEvents,
        timeline
      };
    });

    return res.json({
      success: true,
      data,
      meta: {
        operation: 'case_audit_export',
        exportedAt: new Date().toISOString(),
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        totalCases: data.length
      }
    });
  } catch (error) {
    console.error('[caseController] getCaseAuditExport error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export case audit data'
    });
  }
};

exports.ingestCaseChannelInteraction = async (req, res) => {
  try {
    const {
      channel,
      caseId,
      externalReference,
      subject,
      message,
      contactId,
      organizationRefId,
      metadata
    } = req.body || {};

    if (!channel || !CASE_CHANNELS.includes(channel)) {
      return res.status(400).json({ success: false, message: 'Valid channel is required' });
    }
    if (channel === 'Email') {
      return res.status(400).json({
        success: false,
        message: 'Use inbound email webhook for Email channel ingestion'
      });
    }
    if (!externalReference || !String(externalReference).trim()) {
      return res.status(400).json({ success: false, message: 'externalReference is required' });
    }
    if (!isValidOptionalObjectId(contactId) || !isValidOptionalObjectId(organizationRefId)) {
      return res.status(400).json({ success: false, message: 'Invalid contactId or organizationRefId' });
    }

    const result = await handleChannelInteractionForHelpdesk({
      organizationId: req.user.organizationId,
      actorId: req.user._id,
      channel,
      explicitCaseId: caseId || null,
      externalReference: String(externalReference).trim(),
      subject: subject ? String(subject).trim() : '',
      message: message ? String(message).trim() : '',
      links: {
        contactId: contactId || null,
        organizationRefId: organizationRefId || null
      },
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    });

    return res.status(201).json({
      success: true,
      data: toSafeObject(result.caseRecord),
      meta: {
        operation: 'ingest_case_channel_interaction',
        channel,
        action: result.action
      }
    });
  } catch (error) {
    console.error('[caseController] ingestCaseChannelInteraction error', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to ingest channel interaction'
    });
  }
};

exports.getCaseLiveChatSession = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const row = await Case.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null,
    }).lean();

    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const summary = await getLiveChatSummaryForCase({
      organizationId: req.user.organizationId,
      caseRecord: row,
    });

    return res.json({ success: true, data: summary ?? null });
  } catch (error) {
    console.error('[caseController] getCaseLiveChatSession error', error);
    return res.status(500).json({ success: false, message: 'Failed to load live chat session summary' });
  }
};

exports.getCasesListMeta = async (req, res) => {
  try {
    const query = buildCasesListQuery(req);
    const meta = await fetchListMeta(Case, query);
    sendListMetaResponse(res, meta);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('[caseController.getCasesListMeta] error', error);
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch cases list meta',
    });
  }
};

exports.getCaseRecordMeta = async (req, res) => {
  try {
    const caseIdValidation = validateCaseRecordId(req.params.id);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const { fetchRecordUpdatedAtMeta, sendRecordMetaResponse } = require('../utils/recordMetaService');
    const meta = await fetchRecordUpdatedAtMeta(Case, {
      organizationId: req.user.organizationId,
      recordId: req.params.id,
    });
    sendRecordMetaResponse(res, meta);
  } catch (error) {
    console.error('[caseController.getCaseRecordMeta] error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch case record meta' });
  }
};

