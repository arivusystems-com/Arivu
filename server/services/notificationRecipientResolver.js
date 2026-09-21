const Event = require('../models/Event');
const Task = require('../models/Task');
const Case = require('../models/Case');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Role = require('../models/Role');
const domainEvents = require('../constants/domainEvents');
const { aggregateDigest } = require('./notificationDigestService');

/**
 * Resolve semantic recipient keys into concrete user records.
 * This stays app-aware to prevent data leakage across SALES/AUDIT/PORTAL.
 */
async function resolveRecipients(recipientKeys, context) {
  const recipients = [];
  for (const key of recipientKeys) {
    // eslint-disable-next-line no-await-in-loop
    const resolved = await resolveKey(key, { ...context, appKey: context.appKey || context.sourceAppKey });
    if (resolved && Array.isArray(resolved)) {
      recipients.push(...resolved);
    }
  }
  // Deduplicate by userId
  const unique = new Map();
  for (const r of recipients) {
    unique.set(String(r.userId), r);
  }
  return Array.from(unique.values());
}

async function resolveKey(key, context) {
  switch (key) {
    case 'EVENT_AUDITOR':
      return resolveEventAuditor(context);
    case 'CRM_ADMIN':
      return resolveOrgAdmins(context);
    case 'USER_SELF':
      return resolveUserSelf(context);
    case 'TASK_ASSIGNEE':
      return resolveTaskAssignee(context);
    case 'PEOPLE_ASSIGNEE':
      return resolvePeopleAssignee(context);
    case 'DEAL_OWNER':
      return resolveDealOwnerNotify(context);
    case 'ORGANIZATION_ASSIGNEE':
      return resolveSalesOrganizationAssignee(context);
    case 'CASE_OWNER':
      return resolveCaseOwner(context);
    case 'CASE_NOTIFY_TARGETS':
      return resolveCaseNotifyTargets(context);
    case 'LIVE_CHAT_NOTIFY_TARGETS':
      return resolveLiveChatNotifyTargets(context);
    case 'INTERNAL_CHAT_MENTION_TARGETS':
      return resolveInternalChatMentionTargets(context);
    case 'INTERNAL_CHAT_SPACE_MEMBERS':
      return resolveInternalChatSpaceMembers(context);
    case 'TELEPHONY_NOTIFY_TARGETS':
      return resolveTelephonyNotifyTargets(context);
    case 'INBOX_SNOOZE_USER':
      return resolveInboxSnoozeWake(context);
    case 'PLAYBOOK_ALERT_RECIPIENTS':
      return resolvePlaybookAlertRecipients(context);
    case 'COMMENT_MENTION_RECIPIENTS':
      return resolveCommentMentionRecipients(context);
    case 'WEBFORM_NOTIFY_RECIPIENTS':
      return resolveWebformNotifyRecipients(context);
    case 'MARKETING_CAMPAIGN_REVIEWERS':
      return resolveMarketingCampaignReviewers(context);
    case 'MARKETING_CAMPAIGN_CREATOR':
      return resolveMarketingCampaignCreator(context);
    case 'PORTAL_CUSTOMER':
      return resolvePortalCustomer(context);
    case 'PORTAL_CASE_REQUESTER':
      return resolvePortalCaseRequester(context);
    case 'LEARNING_LEARNER':
      return resolveLearningLearner(context);
    case 'LEARNING_ADMINS':
      return resolveLearningAdmins(context);
    default:
      console.warn('[notificationRecipientResolver] Unhandled recipient key:', key);
      return [];
  }
}

async function resolveTaskAssignee({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Task' || !entity.id) return [];
  const task = await Task.findOne({ _id: entity.id, organizationId })
    .select('assignedTo title');
  if (!task || !task.assignedTo) return [];

  const titles = {
    [domainEvents.TASK_ASSIGNED]: 'Task Assigned',
    [domainEvents.TASK_CREATED]: 'New Task',
    [domainEvents.TASK_STATUS_CHANGED]: 'Task Status Updated',
    [domainEvents.TASK_DUE_SOON]: 'Task Due Soon'
  };
  const bodies = {
    [domainEvents.TASK_ASSIGNED]: `You have been assigned to task "${task.title || 'Task'}".`,
    [domainEvents.TASK_CREATED]: `A new task "${task.title || 'Task'}" has been created and assigned to you.`,
    [domainEvents.TASK_STATUS_CHANGED]: `Task "${task.title || 'Task'}" status has been updated.`,
    [domainEvents.TASK_DUE_SOON]: `Task "${task.title || 'Task'}" is due soon.`
  };

  return [{
    userId: task.assignedTo,
    title: titles[eventType] || 'Task Notification',
    body: bodies[eventType] || `Update on task "${task.title || 'Task'}".`
  }];
}

async function resolvePeopleAssignee({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Person' || !entity.id || !organizationId) return [];
  const row = await People.findOne({ _id: entity.id, organizationId })
    .select('assignedTo first_name last_name');
  if (!row || !row.assignedTo) return [];

  const label = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Contact';
  const title = eventType === domainEvents.PEOPLE_ASSIGNED ? 'Contact assigned' : 'Contact update';
  const body =
    eventType === domainEvents.PEOPLE_ASSIGNED
      ? `You have been assigned to "${label}".`
      : `Update on contact "${label}".`;

  return [{ userId: row.assignedTo, title, body }];
}

async function resolvePlaybookAlertRecipients({ entity, organizationId }) {
  const recipientUserIds = Array.isArray(entity?.alertRecipientUserIds)
    ? entity.alertRecipientUserIds
    : [];
  if (!recipientUserIds.length || !organizationId) {
    return [];
  }

  const users = await User.find({
    _id: { $in: recipientUserIds },
    organizationId,
    status: { $in: ['active', null] }
  }).select('_id');

  const actionTitle = entity?.actionTitle || 'Playbook activity';
  const dealTitle = entity?.title || 'Deal';
  const title = `Playbook: ${actionTitle}`;
  const body = `Reminder for "${actionTitle}" on deal "${dealTitle}".`;

  return users.map((user) => ({
    userId: user._id,
    title,
    body
  }));
}

/**
 * Mentions: recipients are explicit on the entity (already resolved users/groups/@all).
 * Do not re-filter by User.organizationId — tenant DBs may be scoped without that field.
 */
async function resolveCommentMentionRecipients({ entity }) {
  const recipientUserIds = Array.isArray(entity?.mentionedUserIds)
    ? [...new Set(entity.mentionedUserIds.map((id) => String(id)).filter(Boolean))]
    : [];
  if (!recipientUserIds.length) {
    return [];
  }

  const authorName = String(entity?.authorName || 'Someone').trim() || 'Someone';
  const recordTitle = String(entity?.title || 'a record').trim() || 'a record';
  const preview = String(entity?.preview || '').trim();
  const title = `${authorName} mentioned you on ${recordTitle}`;
  const body = preview ? `"${preview}"` : `You were mentioned in a comment on ${recordTitle}.`;

  return recipientUserIds.map((userId) => ({
    userId,
    title,
    body
  }));
}

function marketingCampaignNotificationCopy(eventType, campaignName, entity = {}) {
  const label = campaignName || 'Campaign';
  const comment = String(entity.comment || '').trim();

  if (eventType === domainEvents.MARKETING_CAMPAIGN_SUBMITTED_FOR_REVIEW) {
    return {
      title: 'Campaign pending review',
      body: comment
        ? `"${label}" was submitted for your review: ${comment}`
        : `"${label}" was submitted for your review.`
    };
  }
  if (eventType === domainEvents.MARKETING_CAMPAIGN_APPROVED) {
    return {
      title: 'Campaign approved',
      body: comment
        ? `"${label}" was approved: ${comment}`
        : `"${label}" was approved and can be sent.`
    };
  }
  if (eventType === domainEvents.MARKETING_CAMPAIGN_REJECTED) {
    return {
      title: 'Campaign rejected',
      body: comment
        ? `"${label}" was rejected: ${comment}`
        : `"${label}" was rejected. Update it and resubmit for review.`
    };
  }

  return {
    title: 'Campaign update',
    body: `Update on "${label}".`
  };
}

async function resolveMarketingCampaignReviewers({ entity, organizationId, eventType }) {
  const recipientUserIds = Array.isArray(entity?.reviewerUserIds)
    ? entity.reviewerUserIds
    : [];
  if (!recipientUserIds.length || !organizationId) {
    return [];
  }

  const users = await User.find({
    _id: { $in: recipientUserIds },
    organizationId,
    status: { $in: ['active', null] }
  }).select('_id');

  const copy = marketingCampaignNotificationCopy(
    eventType,
    entity?.title || entity?.name,
    entity
  );

  return users.map((user) => ({
    userId: user._id,
    title: copy.title,
    body: copy.body
  }));
}

async function resolveMarketingCampaignCreator({ entity, organizationId, eventType }) {
  const creatorId = entity?.createdByUserId;
  if (!creatorId || !organizationId) return [];

  const exists = await User.exists({
    _id: creatorId,
    organizationId,
    status: { $in: ['active', null] }
  });
  if (!exists) return [];

  const copy = marketingCampaignNotificationCopy(
    eventType,
    entity?.title || entity?.name,
    entity
  );

  return [{
    userId: creatorId,
    title: copy.title,
    body: copy.body
  }];
}

async function resolveWebformNotifyRecipients({ entity, organizationId, eventType }) {
  if (eventType !== domainEvents.WEBFORM_SUBMISSION) return [];

  const recipientUserIds = Array.isArray(entity?.notifyRecipientUserIds)
    ? entity.notifyRecipientUserIds
    : [];
  if (!recipientUserIds.length || !organizationId) {
    return [];
  }

  const users = await User.find({
    _id: { $in: recipientUserIds },
    organizationId,
    status: { $in: ['active', null] }
  }).select('_id');

  const webformName = entity?.title || 'Webform';
  const title = `New submission: ${webformName}`;
  const body = 'A webform submission was received and processed.';

  return users.map((user) => ({
    userId: user._id,
    title,
    body
  }));
}

async function resolveDealOwnerNotify({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Deal' || !entity.id || !organizationId) return [];
  const row = await Deal.findOne({ _id: entity.id, organizationId }).select('assignedTo name');
  if (!row || !row.assignedTo) return [];

  const label = row.name || 'Deal';
  const title = eventType === domainEvents.DEAL_ASSIGNED ? 'Deal assigned' : 'Deal update';
  const body =
    eventType === domainEvents.DEAL_ASSIGNED
      ? `You are now the owner of "${label}".`
      : `Update on deal "${label}".`;

  return [{ userId: row.assignedTo, title, body }];
}

async function resolveSalesOrganizationAssignee({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Organization' || !entity.id || !organizationId) return [];
  const row = await Organization.findOne({ _id: entity.id, isTenant: false }).select(
    'assignedTo name createdBy'
  );
  if (!row || !row.assignedTo) return [];

  const allowed = await User.exists({ _id: row.createdBy, organizationId });
  if (!allowed) return [];

  const label = row.name || 'Organization';
  const title =
    eventType === domainEvents.ORGANIZATION_ASSIGNED ? 'Organization assigned' : 'Organization update';
  const body =
    eventType === domainEvents.ORGANIZATION_ASSIGNED
      ? `You have been assigned to "${label}".`
      : `Update on organization "${label}".`;

  return [{ userId: row.assignedTo, title, body }];
}

async function resolveInboxSnoozeWake({ entity, organizationId, eventType }) {
  if (eventType !== domainEvents.EMAIL_THREAD_SNOOZE_ENDED) return [];
  if (!entity || entity.type !== 'EmailThread' || !entity.notifyUserId) return [];
  if (!organizationId) return [];

  const subject = String(entity.subject || '(No subject)').trim().slice(0, 240) || '(No subject)';
  const title = 'Snoozed thread is back';
  const body = `"${subject}" is visible in your inbox again. Open Inbox to review.`;

  return [
    {
      userId: entity.notifyUserId,
      title,
      body
    }
  ];
}

function caseNotificationCopy(eventType, caseLabel, entity = {}) {
  const titles = {
    [domainEvents.CASE_CREATED]: 'New case',
    [domainEvents.CASE_ASSIGNED]: 'Case assigned',
    [domainEvents.CASE_STATUS_CHANGED]: 'Case status updated',
    [domainEvents.CASE_REOPENED]: 'Case reopened',
    [domainEvents.CASE_ESCALATED]: 'Case escalated',
    [domainEvents.CASE_SLA_WARNING]: 'SLA warning',
    [domainEvents.CASE_SLA_BREACHED]: 'SLA breached',
    [domainEvents.CASE_SLA_ESCALATION]: 'SLA escalation',
    [domainEvents.CASE_SLA_LEADERSHIP_ESCALATION]: 'SLA leadership escalation',
    [domainEvents.CASE_EMAIL_RECEIVED]: 'Customer email',
    [domainEvents.CASE_CHAT_MESSAGE_RECEIVED]: 'Live chat message'
  };

  const from = String(entity.fromAddress || '').trim();
  const author = String(entity.authorName || 'Visitor').trim();
  const preview = String(entity.preview || '').trim();
  const subject = String(entity.subject || '').trim();

  const bodies = {
    [domainEvents.CASE_CREATED]: `${caseLabel} was created.`,
    [domainEvents.CASE_ASSIGNED]: `${caseLabel} was assigned to you.`,
    [domainEvents.CASE_STATUS_CHANGED]: `${caseLabel} status has changed.`,
    [domainEvents.CASE_REOPENED]: `${caseLabel} was reopened.`,
    [domainEvents.CASE_ESCALATED]: `${caseLabel} was escalated.`,
    [domainEvents.CASE_SLA_WARNING]: `${caseLabel} is nearing SLA breach.`,
    [domainEvents.CASE_SLA_BREACHED]: `${caseLabel} has breached SLA.`,
    [domainEvents.CASE_SLA_ESCALATION]: `${caseLabel} triggered an SLA escalation rule.`,
    [domainEvents.CASE_SLA_LEADERSHIP_ESCALATION]: `${caseLabel} requires leadership attention for SLA.`,
    [domainEvents.CASE_EMAIL_RECEIVED]: from
      ? `New email on ${caseLabel} from ${from}${subject ? `: ${subject}` : ''}${preview ? ` — ${preview}` : ''}`
      : `New email on ${caseLabel}${preview ? ` — ${preview}` : ''}`,
    [domainEvents.CASE_CHAT_MESSAGE_RECEIVED]: `New chat on ${caseLabel} from ${author}${preview ? `: ${preview}` : ''}`
  };

  return {
    title: titles[eventType] || 'Case notification',
    body: bodies[eventType] || `Update on ${caseLabel}.`
  };
}

function liveChatNotificationCopy(eventType, entity = {}) {
  const author = String(entity.authorName || 'Visitor').trim();
  const preview = String(entity.preview || '').trim();
  const sessionKey = String(entity.sessionKey || entity.title || '').trim();
  const label = sessionKey || 'Live chat session';

  if (eventType === domainEvents.LIVE_CHAT_MESSAGE_RECEIVED) {
    return {
      title: 'Live chat message',
      body: preview
        ? `New message from ${author}: ${preview}`
        : `New message from ${author} on ${label}.`,
    };
  }

  if (eventType === domainEvents.LIVE_CHAT_SESSION_STARTED) {
    return {
      title: 'Live chat started',
      body: sessionKey ? `Visitor started ${sessionKey}.` : 'Visitor started a chat session.',
    };
  }

  return {
    title: 'Live chat notification',
    body: `Update on ${label}.`,
  };
}

async function resolveInternalChatMentionTargets({ entity, organizationId, eventType }) {
  const recipientUserIds = Array.isArray(entity?.alertRecipientUserIds)
    ? entity.alertRecipientUserIds
    : [];
  if (!recipientUserIds.length || !organizationId) return [];

  const users = await User.find({
    _id: { $in: recipientUserIds },
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  }).select('_id');

  const author = String(entity.authorName || 'Someone').trim();
  const { humanizeInternalChatMentions } = require('../utils/internalChatMentions');
  const preview = await humanizeInternalChatMentions(
    organizationId,
    String(entity.preview || '').trim()
  );
  const spaceName = String(entity.spaceName || entity.title || 'chat').trim();
  const title = eventType === domainEvents.INTERNAL_CHAT_MENTIONED
    ? 'Mentioned in Chat'
    : 'Chat update';
  const body = preview
    ? `${author} mentioned you in ${spaceName}: ${preview}`
    : `${author} mentioned you in ${spaceName}.`;

  return users.map((user) => ({ userId: user._id, title, body }));
}

async function resolveInternalChatSpaceMembers({ entity, organizationId, eventType, triggeredBy }) {
  const memberIds = Array.isArray(entity?.memberUserIds) ? entity.memberUserIds : [];
  if (!memberIds.length || !organizationId) return [];

  const actorId = triggeredBy ? String(triggeredBy) : '';
  const filtered = memberIds.filter((id) => String(id) !== actorId);
  if (!filtered.length) return [];

  const users = await User.find({
    _id: { $in: filtered },
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  }).select('_id');

  const author = String(entity.authorName || 'Someone').trim();
  const { humanizeInternalChatMentions } = require('../utils/internalChatMentions');
  const preview = await humanizeInternalChatMentions(
    organizationId,
    String(entity.preview || '').trim()
  );
  const spaceName = String(entity.spaceName || entity.title || 'chat').trim();
  const title = 'New chat message';
  const body = preview
    ? `${author} in ${spaceName}: ${preview}`
    : `${author} posted in ${spaceName}.`;

  return users.map((user) => ({ userId: user._id, title, body }));
}

async function resolveLiveChatNotifyTargets({ entity, organizationId, eventType }) {
  if (!organizationId) return [];

  const copy = liveChatNotificationCopy(eventType, entity);

  const liveChatRoles = await Role.find({
    organizationId,
    'permissions.liveChat.view': true,
  })
    .select('_id')
    .lean();

  const roleIds = liveChatRoles.map((row) => row._id);

  const agents = await User.find({
    organizationId,
    $or: [
      { isOwner: true },
      { role: { $in: ['owner', 'admin'] } },
      { 'permissions.liveChat.view': true },
      ...(roleIds.length ? [{ roleId: { $in: roleIds } }] : []),
    ],
    $and: [
      {
        $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
      },
    ],
  })
    .select('_id')
    .limit(40)
    .lean();

  if (!agents.length) {
    return resolveOrgAdmins({ organizationId }).then((admins) =>
      admins.map((admin) => ({ ...admin, title: copy.title, body: copy.body })),
    );
  }

  return agents.map((user) => ({
    userId: user._id,
    title: copy.title,
    body: copy.body,
  }));
}

function telephonyNotificationCopy(eventType, entity) {
  const from = entity?.from || 'Unknown';
  if (eventType === domainEvents.TELEPHONY_INCOMING_CALL) {
    return {
      title: 'Incoming call',
      body: `Incoming call from ${from}`,
    };
  }
  if (eventType === domainEvents.TELEPHONY_CALL_MISSED) {
    return {
      title: 'Missed call',
      body: `Missed call from ${from}`,
    };
  }
  if (eventType === domainEvents.TELEPHONY_RECORDING_READY) {
    return {
      title: 'Recording ready',
      body: entity?.title || 'Call recording is ready',
    };
  }
  return {
    title: 'Telephony update',
    body: entity?.title || 'Telephony event',
  };
}

async function resolveTelephonyNotifyTargets({ entity, organizationId, eventType }) {
  if (!organizationId) return [];

  const copy = telephonyNotificationCopy(eventType, entity);

  const telephonyRoles = await Role.find({
    organizationId,
    'permissions.telephony.view': true,
  })
    .select('_id')
    .lean();

  const roleIds = telephonyRoles.map((row) => row._id);

  const agents = await User.find({
    organizationId,
    $or: [
      { isOwner: true },
      { role: { $in: ['owner', 'admin'] } },
      { 'permissions.telephony.view': true },
      { 'permissions.telephony.call': true },
      ...(roleIds.length ? [{ roleId: { $in: roleIds } }] : []),
    ],
    $and: [
      {
        $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
      },
    ],
  })
    .select('_id')
    .limit(40)
    .lean();

  if (!agents.length) {
    return resolveOrgAdmins({ organizationId }).then((admins) =>
      admins.map((admin) => ({ ...admin, title: copy.title, body: copy.body })),
    );
  }

  return agents.map((user) => ({
    userId: user._id,
    title: copy.title,
    body: copy.body,
  }));
}

async function resolveCaseOwner({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Case' || !entity.id) return [];
  const row = await Case.findOne({ _id: entity.id, organizationId })
    .select('assignedTo caseId title');
  if (!row || !row.assignedTo) return [];

  const caseLabel = row.caseId || row.title || 'Case';
  const copy = caseNotificationCopy(eventType, caseLabel, entity);

  return [{
    userId: row.assignedTo,
    title: copy.title,
    body: copy.body
  }];
}

async function resolveCaseNotifyTargets({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Case' || !entity.id || !organizationId) return [];

  const row = await Case.findOne({ _id: entity.id, organizationId })
    .select('assignedTo caseId title');
  if (!row) return [];

  const caseLabel = row.caseId || row.title || 'Case';
  const copy = caseNotificationCopy(eventType, caseLabel, entity);

  // Queue-wide alerts: all helpdesk agents (not only the assigned owner).
  const broadcastToAllHelpdeskAgents =
    eventType === domainEvents.CASE_CREATED ||
    eventType === domainEvents.CASE_CHAT_MESSAGE_RECEIVED ||
    eventType === domainEvents.CASE_EMAIL_RECEIVED;

  if (row.assignedTo && !broadcastToAllHelpdeskAgents) {
    return [{
      userId: row.assignedTo,
      title: copy.title,
      body: copy.body
    }];
  }

  const agents = await User.find({
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
    allowedApps: { $in: ['HELPDESK'] }
  })
    .select('_id')
    .limit(40)
    .lean();

  if (!agents.length) {
    return resolveOrgAdmins({ organizationId }).then((admins) =>
      admins.map((a) => ({ ...a, title: copy.title, body: copy.body }))
    );
  }

  return agents.map((u) => ({
    userId: u._id,
    title: copy.title,
    body: copy.body
  }));
}

async function resolveEventAuditor({ entity, organizationId }) {
  if (!entity || entity.type !== 'Audit' || !entity.id) return [];
  const event = await Event.findOne({ _id: entity.id, organizationId })
    .select('formAssignment auditorId assignedTo eventName title');
  if (!event) return [];

  const userId = event.formAssignment?.assignedAuditor || event.auditorId || event.assignedTo;
  if (!userId) return [];

  return [{
    userId,
    title: 'Audit Assigned',
    body: `You have been assigned to audit "${event.eventName || event.title || 'Audit'}".`
  }];
}

const {
  resolvePortalCaseRequesterUserIds,
  isPortalChannelCase
} = require('./portalCaseAccessService');

function portalCaseCustomerNotificationCopy(eventType, caseRecord, entity = {}) {
  const caseLabel = caseRecord?.caseId || caseRecord?.title || 'your case';
  if (eventType === domainEvents.CASE_PORTAL_AGENT_REPLY) {
    const preview = String(entity.preview || '').trim();
    return {
      title: 'New reply on your support case',
      body: preview
        ? `Support replied on ${caseLabel}: ${preview}`
        : `Support replied on ${caseLabel}.`
    };
  }
  if (eventType === domainEvents.CASE_PORTAL_STATUS_UPDATE) {
    const status = String(entity.toStatus || caseRecord?.status || '').trim();
    return {
      title: 'Support case update',
      body: `${caseLabel} is now ${status}.`
    };
  }
  return {
    title: 'Support case update',
    body: `There is an update on ${caseLabel}.`
  };
}

async function resolvePortalCaseRequester({ entity, organizationId, eventType }) {
  if (!entity || entity.type !== 'Case' || !entity.id || !organizationId) return [];
  const row = await Case.findOne({ _id: entity.id, organizationId, deletedAt: null })
    .select('caseId title channel requesterEmail contactId status')
    .lean();
  if (!row || !isPortalChannelCase(row)) return [];

  const userIds = await resolvePortalCaseRequesterUserIds(organizationId, row);
  if (!userIds.length) return [];

  const copy = portalCaseCustomerNotificationCopy(eventType, row, entity);
  return userIds.map((userId) => ({
    userId,
    title: copy.title,
    body: copy.body
  }));
}

async function resolvePortalCustomer({ entity, organizationId, eventType }) {
  const userId = entity?.userId || entity?.portalUserId;
  if (userId && organizationId) {
    return [{
      userId,
      title: eventType === domainEvents.PORTAL_ACCOUNT_CREATED ? 'Welcome to your portal' : 'Portal notification',
      body: eventType === domainEvents.PORTAL_ACCOUNT_CREATED
        ? 'Your portal account is ready. Sign in to get started.'
        : 'You have a new portal notification.'
    }];
  }
  if (entity?.type === 'Case' && entity?.id) {
    return resolvePortalCaseRequester({ entity, organizationId, eventType });
  }
  return [];
}

async function resolveOrgAdmins({ organizationId }) {
  if (!organizationId) return [];
  const admins = await User.find({
    organizationId,
    role: { $in: ['admin', 'owner'] },
    status: 'active'
  }).select('_id firstName lastName');

  return admins.map(a => ({
    userId: a._id,
    title: 'Admin notification',
    body: 'You have a new notification.'
  }));
}

async function resolveUserSelf({ userId, eventType, organizationId, appKey, triggeredBy }) {
  // For digest events, triggeredBy contains the userId
  const targetUserId = userId || triggeredBy;
  if (!targetUserId) return [];
  
  const user = await User.findById(targetUserId).select('_id firstName lastName organizationId');
  if (!user) return [];

  // Handle digest events - generate digest content
  if (eventType === domainEvents.DIGEST_DAILY || eventType === domainEvents.DIGEST_WEEKLY) {
    const sinceDate = new Date();
    if (eventType === domainEvents.DIGEST_DAILY) {
      sinceDate.setDate(sinceDate.getDate() - 1);
    } else {
      sinceDate.setDate(sinceDate.getDate() - 7);
    }

    // Determine appKey if not provided (for '*' rules)
    const resolvedAppKey = appKey || determineAppKeyFromContext(user);
    
    const digest = await aggregateDigest(
      user._id,
      organizationId || user.organizationId,
      resolvedAppKey,
      sinceDate
    );

    if (!digest) {
      // No content - return empty to skip notification
      return [];
    }

    return [{
      userId: user._id,
      title: digest.title,
      body: digest.body
    }];
  }

  return [{
    userId: user._id,
    title: 'Your notification',
    body: 'You have a new notification.'
  }];
}

/**
 * Determine appKey from context when rule has appKey: '*'
 */
function determineAppKeyFromContext(user) {
  // Try to infer from user's app access
  if (user.appAccess && Array.isArray(user.appAccess) && user.appAccess.length > 0) {
    const activeApp = user.appAccess.find(access => access.status === 'ACTIVE');
    if (activeApp) return activeApp.appKey;
  }
  if (user.allowedApps && Array.isArray(user.allowedApps) && user.allowedApps.length > 0) {
    return user.allowedApps[0]; // Use first app
  }
  return 'SALES'; // Default
}

async function resolveLearningLearner({ entity, eventType }) {
  const learnerId = entity?.learnerUserId || entity?.userId;
  if (!learnerId) return [];
  const user = await User.findById(learnerId).select('_id');
  if (!user) return [];

  let title = 'Assigned a course';
  let body = entity?.title
    ? `You are enrolled in "${entity.title}".`
    : 'You have a new Learning enrollment.';

  if (eventType === domainEvents.LEARNING_COURSE_COMPLETED) {
    title = 'Course completed';
    body = entity?.title
      ? `You completed "${entity.title}".`
      : 'You completed a Learning course.';
  } else if (eventType === domainEvents.LEARNING_ASSIGNMENT_OVERDUE) {
    title = 'Learning assignment overdue';
    body = entity?.title
      ? `"${entity.title}" is past its due date.`
      : 'A Learning assignment is overdue.';
  } else if (entity?.type === 'LearningPath') {
    title = 'Assigned a learning path';
  } else if (entity?.type === 'LearningCohort') {
    title = 'Enrolled via cohort';
  }

  if (entity?.dueAt && eventType !== domainEvents.LEARNING_COURSE_COMPLETED) {
    const due = new Date(entity.dueAt);
    if (!Number.isNaN(due.getTime())) {
      body += ` Due ${due.toLocaleDateString()}.`;
    }
  }
  return [{ userId: user._id, title, body }];
}

async function resolveLearningAdmins({ organizationId, entity }) {
  if (!organizationId) return [];
  const users = await User.find({
    organizationId,
    status: { $in: ['active', 'invited'] },
    appAccess: {
      $elemMatch: {
        appKey: 'LMS',
        status: 'ACTIVE',
        roleKey: { $in: ['ADMIN', 'AUTHOR'] },
      },
    },
  })
    .select('_id')
    .lean();
  const title = 'Course published';
  const body = entity?.title
    ? `"${entity.title}" is now published in Learning.`
    : 'A course was published in Learning.';
  return users.map((u) => ({ userId: u._id, title, body }));
}

module.exports = resolveRecipients;

