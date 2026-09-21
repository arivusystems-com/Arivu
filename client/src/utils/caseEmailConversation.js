import { formatUserDate, formatTime } from '@/utils/localeFormat';
import { normalizeCaseEmailAttachment } from '@/utils/caseEmailAttachments';
import { extractEmailFromActorName } from '@/utils/caseEmailReply';
import {
  formatCaseSystemActivityLine,
  isCaseInboundMessage,
  isCaseInternalComment,
  isCaseOutboundMessage,
  isCaseSystemActivity,
  enrichPersonForAvatar,
  resolveCaseContactProfile,
  sortCaseActivitiesChronologically
} from '@/utils/caseTimeline';

export function isCaseEmailMessageActivity(activity) {
  if (!activity) return false;
  const type = String(activity.activityType || '').trim();
  if (type === 'email_received' || type === 'email_sent') return true;
  if (type === 'channel_message_received' || type === 'agent_message') {
    return Boolean(
      activity.metadata?.mailroomMessageId
      || activity.metadata?.source === 'mailroom'
      || activity.metadata?.communicationId
    );
  }
  return false;
}

function collectThreadedCommunicationIds(emailThreads = []) {
  const ids = new Set();
  for (const thread of emailThreads) {
    for (const msg of thread?.messages || []) {
      if (msg?._id) ids.add(String(msg._id));
    }
  }
  return ids;
}

function isMailroomEmailTimelineActivity(activity) {
  const meta = activity?.metadata || {};
  return meta.source === 'mailroom' && Boolean(String(meta.mailroomMessageId || '').trim());
}

function shouldSkipActivityAsThreadedEmail(activity, threadedCommIds) {
  const commId = String(activity?.metadata?.communicationId || '').trim();
  if (commId && threadedCommIds.has(commId)) return true;
  // Communications are canonical in the email conversation feed; mailroom rows duplicate them.
  if (isMailroomEmailTimelineActivity(activity) && threadedCommIds.size > 0) return true;
  return false;
}

function activityTimestamp(activity) {
  return activity?.createdAt || activity?.updatedAt || new Date().toISOString();
}

function messageTimestamp(msg) {
  return msg?.sentAt || msg?.receivedAt || new Date().toISOString();
}

function personFromFromAddress(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const angle = text.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const email = angle[2].trim();
    const nameParts = angle[1].replace(/^["']|["']$/g, '').trim().split(/\s+/).filter(Boolean);
    return enrichPersonForAvatar({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      email
    });
  }
  if (text.includes('@')) {
    return enrichPersonForAvatar({ email: extractEmailFromActorName(text) || text });
  }
  return enrichPersonForAvatar({ name: text });
}

function actorToSentByUser(activity) {
  const name = String(activity?.actorName || '').trim();
  if (!name && !activity?.actorId) return null;
  const parts = name.split(/\s+/).filter(Boolean);
  return enrichPersonForAvatar({
    _id: activity?.actorId || undefined,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  });
}

function threadMessageToEmailMessage(msg, thread, caseRecord) {
  const inbound = String(msg?.direction || '').toLowerCase() === 'inbound';
  const attachments = (msg?.attachments || []).map((a, idx) => normalizeCaseEmailAttachment(a, idx));

  return {
    _id: String(msg._id || ''),
    direction: inbound ? 'inbound' : 'outbound',
    subject: msg?.subject || thread?.subject || caseRecord?.title || '',
    body: msg?.body || '',
    fromAddress: msg?.fromAddress || '',
    toAddresses: Array.isArray(msg?.toAddresses) ? msg.toAddresses : [],
    sentAt: msg?.sentAt || null,
    receivedAt: msg?.receivedAt || null,
    sentByUserId: msg?.sentByUserId || null,
    sentByUser: msg?.sentByUser && typeof msg.sentByUser === 'object' ? msg.sentByUser : null,
    attachments
  };
}

/**
 * Map a case activity to a communication-style message for email cards.
 */
export function caseActivityToEmailMessage(activity, caseRecord) {
  const inbound = isCaseInboundMessage(activity);
  const meta = activity?.metadata || {};
  const fromMeta = String(meta.fromAddress || '').trim();
  const fromActor = extractEmailFromActorName(activity?.actorName);
  const sentByUser = inbound ? null : actorToSentByUser(activity);

  return {
    _id: meta.communicationId || activity._id || activity.id,
    direction: inbound ? 'inbound' : 'outbound',
    subject: meta.subject || caseRecord?.title || '',
    body: activity?.message || '',
    fromAddress: fromMeta || (inbound ? fromActor : ''),
    toAddresses: Array.isArray(meta.toAddresses) ? meta.toAddresses : [],
    sentAt: inbound ? null : activityTimestamp(activity),
    receivedAt: inbound ? activityTimestamp(activity) : null,
    sentByUserId: inbound ? null : (activity?.actorId || null),
    sentByUser,
    deliveryStatus: meta.deliveryStatus || meta.status || null,
    deliveryError: meta.deliveryError || null,
    bounceDiagnostic: meta.bounceDiagnostic || null,
    bounceClassification: meta.bounceClassification || null,
    attachments: (Array.isArray(meta.mailroomAttachments) ? meta.mailroomAttachments : []).map((a, idx) =>
      normalizeCaseEmailAttachment(a, idx)
    )
  };
}

/** "Today • 10:42 AM" style stamp for timeline cards. */
export function formatCaseEmailTimelineStamp(date, t) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);

  let dayLabel;
  if (diffDays === 0) dayLabel = t('cases.recordEmailTimelineToday');
  else if (diffDays === 1) dayLabel = t('cases.recordEmailTimelineYesterday');
  else {
    dayLabel = formatUserDate(d);
  }

  const timeLabel = formatTime(d, { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel} • ${timeLabel}`;
}

export function getCaseEmailMessageAvatarUser(message, caseRecord = null) {
  const inbound = String(message?.direction || '').toLowerCase() === 'inbound';
  if (inbound) {
    return resolveCaseContactProfile(caseRecord, message);
  }
  // Historical outbound: use sender snapshot only — never live case assignedTo.
  const sender = message?.sentByUser;
  if (sender && typeof sender === 'object') {
    const enriched = enrichPersonForAvatar(sender);
    if (enriched.firstName || enriched.lastName || enriched.email || enriched.name) {
      return enriched;
    }
  }
  const fromPerson = personFromFromAddress(message?.fromAddress);
  if (fromPerson && (fromPerson.firstName || fromPerson.lastName || fromPerson.email || fromPerson.name)) {
    return fromPerson;
  }
  return enrichPersonForAvatar({});
}

export function getCaseEmailMessageBadge(message, { isFirstInbound = false } = {}) {
  const inbound = String(message?.direction || '').toLowerCase() === 'inbound';
  if (!inbound) return { key: 'agentReply', tone: 'green' };
  if (isFirstInbound) return { key: 'incomingEmail', tone: 'blue' };
  return { key: 'customerReplied', tone: 'sky' };
}

export function formatCaseEmailSystemPill(activity, t) {
  const type = String(activity?.activityType || '');
  if (type === 'status_changed' && activity?.metadata?.toStatus) {
    return t('cases.recordEmailTimelineStatusUpdated', {
      status: activity.metadata.toStatus
    });
  }
  return formatCaseSystemActivityLine(activity, {
    t,
    formatTime: () => ''
  }).trim();
}

/**
 * Chronological conversation items for email channel cases.
 */
export function buildCaseEmailConversationItems({
  activities = [],
  emailThreads = [],
  caseRecord = null
} = {}) {
  const threadedCommIds = collectThreadedCommunicationIds(emailThreads);
  const items = [];
  let sawOutbound = false;

  for (const thread of emailThreads) {
    const messages = [...(thread?.messages || [])].sort(
      (a, b) => new Date(messageTimestamp(a)) - new Date(messageTimestamp(b))
    );
    for (const msg of messages) {
      const normalized = threadMessageToEmailMessage(msg, thread, caseRecord);
      const inbound = normalized.direction === 'inbound';
      const isFirstInbound = inbound && !sawOutbound;
      if (!inbound) sawOutbound = true;
      items.push({
        kind: 'message',
        id: `msg-${normalized._id}`,
        createdAt: messageTimestamp(msg),
        message: normalized,
        badge: getCaseEmailMessageBadge(normalized, { isFirstInbound }),
        threadUnread: Boolean(thread?.unread)
      });
    }
  }

  for (const activity of sortCaseActivitiesChronologically(activities)) {
    if (isCaseSystemActivity(activity)) {
      items.push({
        kind: 'system',
        id: String(activity._id || activity.id || `sys-${activity.createdAt}`),
        createdAt: activityTimestamp(activity),
        activity
      });
      continue;
    }

    if (isCaseEmailMessageActivity(activity)) {
      if (shouldSkipActivityAsThreadedEmail(activity, threadedCommIds)) continue;
      const normalized = caseActivityToEmailMessage(activity, caseRecord);
      const inbound = normalized.direction === 'inbound';
      const isFirstInbound = inbound && !sawOutbound;
      if (!inbound) sawOutbound = true;
      items.push({
        kind: 'message',
        id: String(activity._id || activity.id || `email-${activity.createdAt}`),
        createdAt: activityTimestamp(activity),
        message: normalized,
        badge: getCaseEmailMessageBadge(normalized, { isFirstInbound })
      });
      continue;
    }

    if (isCaseInternalComment(activity)) {
      items.push({
        kind: 'internal_comment',
        id: String(activity._id || activity.id || `internal-${activity.createdAt}`),
        createdAt: activityTimestamp(activity),
        activity
      });
      continue;
    }

    if (isCaseInboundMessage(activity) || isCaseOutboundMessage(activity)) {
      items.push({
        kind: 'note',
        id: String(activity._id || activity.id || `note-${activity.createdAt}`),
        createdAt: activityTimestamp(activity),
        activity
      });
    }
  }

  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export { formatCaseSystemActivityLine };
