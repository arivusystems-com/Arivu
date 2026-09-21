const mongoose = require('mongoose');
const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const Case = require('../models/Case');
const Communication = require('../models/Communication');
const User = require('../models/User');
const {
  createInitialSlaCycle,
  applyStatusToSlaCycle
} = require('./caseLifecycleService');
const { finalizeCaseSlaOnCreate } = require('./sla/slaCaseBridgeService');
const caseExecutionService = require('./caseExecutionService');
const { applyCaseActivitySideEffects } = require('./caseAutoStatusService');

function toIdString(value) {
  if (value == null) return null;
  return value.toString ? value.toString() : String(value);
}

function normalizeSubject(value) {
  return String(value || '')
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

function getChannelRule(settings) {
  const channelRules = settings?.helpdeskExecution?.channelRules || settings?.channelRules || {};
  return channelRules.Email || channelRules.email || {};
}

function getChannelRuleByName(settings, channel) {
  const channelRules = settings?.helpdeskExecution?.channelRules || settings?.channelRules || {};
  if (!channel) return {};
  return channelRules[channel] || channelRules[String(channel).toLowerCase()] || {};
}

async function loadExecutionSettings(organizationId) {
  const config = await TenantAppConfiguration.findOne({
    organizationId,
    appKey: 'HELPDESK'
  })
    .select('settings')
    .lean();
  return config?.settings || {};
}

async function resolveDefaultOwner(organizationId, preferredOwnerId = null) {
  if (preferredOwnerId && mongoose.Types.ObjectId.isValid(preferredOwnerId)) {
    const preferred = await User.findOne({
      _id: preferredOwnerId,
      organizationId,
      status: { $ne: 'inactive' }
    })
      .select('_id')
      .lean();
    if (preferred?._id) return preferred._id;
  }

  const owner = await User.findOne({
    organizationId,
    status: { $ne: 'inactive' }
  })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();
  return owner?._id || null;
}

async function allocateCaseId(organizationId, at = new Date()) {
  const { allocateRequired } = require('./moduleNumberingService');
  return allocateRequired({
    organizationId,
    moduleKey: 'cases',
    at,
  });
}

async function createCaseFromInboundEmail({
  organizationId,
  actorId = null,
  subject,
  body,
  fromAddress,
  communicationId = null,
  parentCaseId = null,
  defaults = {}
}) {
  const assignedTo = await resolveDefaultOwner(organizationId, defaults.defaultOwnerId || null);
  if (!assignedTo) {
    throw new Error('No active helpdesk owner available for inbound email');
  }

  const status = 'New';
  const baseCycle = createInitialSlaCycle(1, new Date());
  const adjustedCycle = applyStatusToSlaCycle(baseCycle, status);
  const title = String(subject || '').trim() || 'Inbound email';
  const now = new Date();
  const caseId = await allocateCaseId(organizationId, now);
  const created = await Case.create({
    organizationId,
    caseId,
    title,
    caseType: defaults.defaultCaseType || defaults.caseType || 'Support Ticket',
    priority: defaults.defaultPriority || defaults.priority || 'Medium',
    status,
    assignedTo: assignedTo,
    channel: defaults.defaultChannel || defaults.channel || 'Email',
    queue: defaults.defaultQueue || defaults.queue || null,
    caseNotes: String(body || '').trim() || '',
    currentSlaCycle: adjustedCycle,
    activities: [
      {
        activityType: 'case_created',
        message: 'Case created from inbound email',
        internal: true,
        metadata: {
          communicationId: communicationId ? toIdString(communicationId) : null,
          fromAddress: fromAddress || null,
          parentCaseId: parentCaseId || null,
          mailroomClassification: defaults.classificationSuggestions || null,
          mailroomClassificationRuleIds: defaults.classificationMatchedRuleIds || null,
          mailroomAiRouteSuggestions: defaults.aiRouteSuggestions || null
        },
        actorId: actorId || null,
        actorName: 'Inbound Email',
        createdAt: now
      },
      {
        activityType: 'email_received',
        message: 'Inbound email captured in case timeline',
        internal: false,
        metadata: {
          communicationId: communicationId ? toIdString(communicationId) : null,
          fromAddress: fromAddress || null
        },
        actorId: null,
        actorName: fromAddress || 'External Sender',
        createdAt: now
      }
    ],
    createdBy: actorId || assignedTo,
    updatedBy: actorId || assignedTo
  });

  created.currentSlaCycle = await finalizeCaseSlaOnCreate({
    organizationId,
    caseRecord: created,
    actorId: actorId || assignedTo
  });
  await created.save();

  await caseExecutionService.onCaseCreated({ caseRecord: created, actorId: actorId || assignedTo });
  return created;
}

async function createCaseFromChannelInteraction({
  organizationId,
  actorId = null,
  channel,
  subject,
  message,
  externalReference = null,
  defaults = {},
  links = {}
}) {
  const assignedTo = await resolveDefaultOwner(organizationId, defaults.defaultOwnerId || null);
  if (!assignedTo) {
    throw new Error('No active helpdesk owner available for inbound channel interaction');
  }

  const status = 'New';
  const baseCycle = createInitialSlaCycle(1, new Date());
  const adjustedCycle = applyStatusToSlaCycle(baseCycle, status);
  const now = new Date();
  const title = String(subject || '').trim() || `${channel} interaction`;
  const caseId = await allocateCaseId(organizationId, now);
  const created = await Case.create({
    organizationId,
    caseId,
    title,
    caseType: defaults.defaultCaseType || 'Support Ticket',
    priority: defaults.defaultPriority || 'Medium',
    status,
    assignedTo: assignedTo,
    channel,
    contactId: links.contactId || null,
    organizationRefId: links.organizationRefId || null,
    caseNotes: String(message || '').trim() || '',
    currentSlaCycle: adjustedCycle,
    activities: [
      {
        activityType: 'case_created',
        message: `Case created from ${channel}`,
        internal: true,
        metadata: {
          channel,
          externalReference: externalReference || null
        },
        actorId: actorId || null,
        actorName: `${channel} Ingestion`,
        createdAt: now
      },
      {
        activityType: 'channel_message_received',
        message: `${channel} interaction captured in case timeline`,
        internal: false,
        metadata: {
          channel,
          externalReference: externalReference || null
        },
        actorId: null,
        actorName: channel,
        createdAt: now
      }
    ],
    createdBy: actorId || assignedTo,
    updatedBy: actorId || assignedTo
  });

  created.currentSlaCycle = await finalizeCaseSlaOnCreate({
    organizationId,
    caseRecord: created,
    actorId: actorId || assignedTo
  });
  await created.save();

  await caseExecutionService.onCaseCreated({ caseRecord: created, actorId: actorId || assignedTo });
  return created;
}

async function appendInboundEmailActivity({
  caseRecord,
  communicationId = null,
  fromAddress,
  subject,
  body
}) {
  caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
  caseRecord.activities.push({
    activityType: 'email_received',
    message: `Inbound email received: ${String(subject || '(no subject)').trim()}`,
    internal: false,
    metadata: {
      communicationId: communicationId ? toIdString(communicationId) : null,
      fromAddress: fromAddress || null,
      bodyPreview: String(body || '').slice(0, 400)
    },
    actorId: null,
    actorName: fromAddress || 'External Sender',
    createdAt: new Date()
  });
  const { statusResult } = await applyCaseActivitySideEffects(caseRecord, {
    activityType: 'email_received',
    internal: false,
    actorId: null,
    actorName: fromAddress || 'External Sender',
    channel: caseRecord.channel
  });
  await caseRecord.save();
  if (statusResult?.changed) {
    await caseExecutionService.onCaseStatusChanged({
      caseRecord,
      actorId: null,
      fromStatus: statusResult.fromStatus,
      toStatus: statusResult.toStatus
    });
  }
  await caseExecutionService.onCaseActivityLogged({
    caseRecord,
    actorId: null,
    activityType: 'email_received'
  });

  const { notifyCaseEmailReceived } = require('./caseNotificationService');
  await notifyCaseEmailReceived(caseRecord, {
    fromAddress,
    subject,
    preview: String(body || '').slice(0, 200)
  });
}

async function appendChannelActivity({
  caseRecord,
  channel,
  message,
  externalReference = null,
  actorId = null,
  metadata = {}
}) {
  caseRecord.activities = Array.isArray(caseRecord.activities) ? caseRecord.activities : [];
  caseRecord.activities.push({
    activityType: 'channel_message_received',
    message: `${channel} interaction received`,
    internal: false,
    metadata: {
      channel,
      externalReference: externalReference || null,
      messagePreview: String(message || '').slice(0, 400),
      ...metadata
    },
    actorId: actorId || null,
    actorName: channel,
    createdAt: new Date()
  });
  const { statusResult } = await applyCaseActivitySideEffects(caseRecord, {
    activityType: 'channel_message_received',
    internal: false,
    actorId: actorId || null,
    actorName: channel,
    channel: channel || caseRecord.channel
  });
  caseRecord.updatedBy = actorId || caseRecord.updatedBy || null;
  await caseRecord.save();
  if (statusResult?.changed) {
    await caseExecutionService.onCaseStatusChanged({
      caseRecord,
      actorId: actorId || null,
      fromStatus: statusResult.fromStatus,
      toStatus: statusResult.toStatus
    });
  }
  await caseExecutionService.onCaseActivityLogged({
    caseRecord,
    actorId,
    activityType: 'channel_message_received'
  });

  const channelLabel = String(channel || '').toLowerCase();
  if (channelLabel.includes('live chat') || channelLabel.includes('chat')) {
    const { notifyCaseChatMessageReceived } = require('./caseNotificationService');
    await notifyCaseChatMessageReceived(caseRecord, {
      authorName: metadata?.visitorName || metadata?.authorName || 'Visitor',
      preview: String(message || '').slice(0, 200),
      chatSessionId: metadata?.chatSessionId || null
    });
  }
}

async function resolveExistingOpenCaseByEmailContext({
  organizationId,
  fromAddress,
  normalizedSubject
}) {
  if (!fromAddress) return null;
  const relatedComms = await Communication.find({
    organizationId,
    'relatedTo.moduleKey': 'cases',
    fromAddress: String(fromAddress).toLowerCase().trim()
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('relatedTo.recordId subject')
    .lean();

  if (!relatedComms.length) return null;
  const matchedRecord = relatedComms.find((row) => normalizeSubject(row.subject) === normalizedSubject);
  const fallbackRecord = matchedRecord || relatedComms[0];
  if (!fallbackRecord?.relatedTo?.recordId) return null;

  return Case.findOne({
    _id: fallbackRecord.relatedTo.recordId,
    organizationId,
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null
  });
}

function resolveDuplicateHandling(rule = {}) {
  const mode = String(rule.duplicateHandling || rule.onDuplicate || 'append_to_existing_open_case').toLowerCase();
  if (mode === 'create_child_case' || mode === 'create_child') return 'create_child_case';
  if (mode === 'flag_for_review') return 'flag_for_review';
  return 'append_to_existing_open_case';
}

async function resolveExistingOpenCaseByExternalReference({
  organizationId,
  channel,
  externalReference
}) {
  if (!externalReference) return null;
  return Case.findOne({
    organizationId,
    channel,
    status: { $nin: ['Resolved', 'Closed'] },
    deletedAt: null,
    activities: {
      $elemMatch: {
        'metadata.externalReference': externalReference
      }
    }
  }).sort({ updatedAt: -1 });
}

async function handleInboundEmailForHelpdesk({
  organizationId,
  explicitCaseId = null,
  parsedEmail = {},
  communicationDraft = {}
}) {
  const settings = await loadExecutionSettings(organizationId);
  const rule = getChannelRule(settings);
  const normalizedSubject = normalizeSubject(parsedEmail.subject);
  const fromAddress = String(parsedEmail.fromAddress || '').toLowerCase().trim();

  let targetCase = null;
  let action = 'created_case';

  if (explicitCaseId && mongoose.Types.ObjectId.isValid(explicitCaseId)) {
    targetCase = await Case.findOne({
      _id: explicitCaseId,
      organizationId,
      deletedAt: null
    });
  }

  if (!targetCase && resolveDuplicateHandling(rule) === 'append_to_existing_open_case') {
    targetCase = await resolveExistingOpenCaseByEmailContext({
      organizationId,
      fromAddress,
      normalizedSubject
    });
  }

  if (!targetCase && resolveDuplicateHandling(rule) === 'flag_for_review') {
    const reviewCase = await resolveExistingOpenCaseByEmailContext({
      organizationId,
      fromAddress,
      normalizedSubject
    });
    if (reviewCase) {
      reviewCase.activities.push({
        activityType: 'email_duplicate_flagged',
        message: 'Potential duplicate inbound email flagged for review',
        internal: true,
        metadata: { fromAddress, subject: parsedEmail.subject || '' },
        actorId: null,
        actorName: 'Inbound Email',
        createdAt: new Date()
      });
      await reviewCase.save();
      targetCase = reviewCase;
      action = 'flagged_existing_case';
    }
  }

  if (!targetCase) {
    action = resolveDuplicateHandling(rule) === 'create_child_case' ? 'created_child_case' : 'created_case';
    targetCase = await createCaseFromInboundEmail({
      organizationId,
      actorId: null,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      fromAddress,
      communicationId: null,
      parentCaseId: explicitCaseId || null,
      defaults: {
        defaultCaseType: rule.defaultCaseType || 'Support Ticket',
        defaultPriority: rule.defaultPriority || 'Medium',
        defaultOwnerId: rule.defaultOwnerId || null
      }
    });
  } else {
    action = action === 'flagged_existing_case' ? action : 'appended_to_existing_case';
    await appendInboundEmailActivity({
      caseRecord: targetCase,
      communicationId: null,
      fromAddress,
      subject: parsedEmail.subject,
      body: parsedEmail.body
    });
  }

  communicationDraft.relatedTo = {
    moduleKey: 'cases',
    recordId: targetCase._id
  };

  return {
    caseRecord: targetCase,
    action
  };
}

async function handleChannelInteractionForHelpdesk({
  organizationId,
  actorId = null,
  channel,
  explicitCaseId = null,
  externalReference = null,
  subject = '',
  message = '',
  links = {},
  metadata = {}
}) {
  const settings = await loadExecutionSettings(organizationId);
  const rule = getChannelRuleByName(settings, channel);
  const duplicateHandling = resolveDuplicateHandling(rule);

  let targetCase = null;
  let action = 'created_case';

  if (explicitCaseId && mongoose.Types.ObjectId.isValid(explicitCaseId)) {
    targetCase = await Case.findOne({
      _id: explicitCaseId,
      organizationId,
      deletedAt: null
    });
  }

  if (!targetCase && duplicateHandling === 'append_to_existing_open_case') {
    targetCase = await resolveExistingOpenCaseByExternalReference({
      organizationId,
      channel,
      externalReference
    });
  }

  if (!targetCase && duplicateHandling === 'flag_for_review') {
    const reviewCase = await resolveExistingOpenCaseByExternalReference({
      organizationId,
      channel,
      externalReference
    });
    if (reviewCase) {
      reviewCase.activities.push({
        activityType: 'channel_duplicate_flagged',
        message: `Potential duplicate ${channel} interaction flagged for review`,
        internal: true,
        metadata: {
          channel,
          externalReference: externalReference || null,
          ...metadata
        },
        actorId: actorId || null,
        actorName: `${channel} Ingestion`,
        createdAt: new Date()
      });
      await reviewCase.save();
      targetCase = reviewCase;
      action = 'flagged_existing_case';
    }
  }

  if (!targetCase) {
    action = duplicateHandling === 'create_child_case' ? 'created_child_case' : 'created_case';
    targetCase = await createCaseFromChannelInteraction({
      organizationId,
      actorId,
      channel,
      subject,
      message,
      externalReference,
      defaults: {
        defaultCaseType: rule.defaultCaseType || 'Support Ticket',
        defaultPriority: rule.defaultPriority || 'Medium',
        defaultOwnerId: rule.defaultOwnerId || null
      },
      links
    });
  } else {
    action = action === 'flagged_existing_case' ? action : 'appended_to_existing_case';
    await appendChannelActivity({
      caseRecord: targetCase,
      channel,
      message,
      externalReference,
      actorId,
      metadata
    });
  }

  return {
    caseRecord: targetCase,
    action
  };
}

module.exports = {
  handleInboundEmailForHelpdesk,
  handleChannelInteractionForHelpdesk,
  createCaseFromInboundEmail,
  appendInboundEmailActivity,
  createCaseFromChannelInteraction,
};
