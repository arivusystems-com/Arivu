const INBOUND_ACTIVITY_TYPES = new Set([
  'email_received',
  'channel_message_received'
]);

const OUTBOUND_MESSAGE_TYPES = new Set([
  'email_sent',
  'comment',
  'agent_message',
  'message_sent',
  'note'
]);

const SYSTEM_ACTIVITY_TYPES = new Set([
  'case_created',
  'status_changed',
  'case_reopened',
  'sla_recalculated',
  'assignment_auto_applied',
  'assignment_locked',
  'assignment_reverted',
  'assignment_scheduled_applied',
  'assignment_escalated',
  'assignment_queued',
  'assignment_deferred',
  'assignment_rule_matched',
  'email_duplicate_flagged',
  'channel_duplicate_flagged'
]);

export function isCaseSystemActivity(activity) {
  if (!activity) return true;
  const type = String(activity.activityType || '').trim();
  if (SYSTEM_ACTIVITY_TYPES.has(type)) return true;
  if (type.startsWith('assignment_')) return true;
  if (type.startsWith('sla_')) return true;
  return false;
}

export function isCaseInboundMessage(activity) {
  const type = String(activity?.activityType || '').trim();
  return INBOUND_ACTIVITY_TYPES.has(type);
}

export function isCaseOutboundMessage(activity) {
  const type = String(activity?.activityType || '').trim();
  // email_sent is always logged with internal:true for audit; still customer-facing mail
  if (type === 'email_sent' || type === 'message_sent') return true;
  if (activity?.internal) return false;
  if (OUTBOUND_MESSAGE_TYPES.has(type)) return true;
  return type === 'message';
}

const INTERNAL_COMMENT_ACTIVITY_TYPES = new Set(['comment', 'note']);

/** Team-only comment on a case (not visible to the customer). */
export function isCaseInternalComment(activity) {
  if (!activity?.internal) return false;
  if (isCaseSystemActivity(activity)) return false;
  const type = String(activity?.activityType || '').trim();
  // email_sent / other activities also set internal:true — only comment|note are notes-tab items
  return INTERNAL_COMMENT_ACTIVITY_TYPES.has(type);
}

function splitPersonName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function nameFromEmailLocal(email) {
  const local = String(email || '').split('@')[0] || '';
  if (!local) return { firstName: '', lastName: '' };
  return splitPersonName(local.replace(/[._+-]/g, ' '));
}

function parseAddressWithName(raw) {
  const text = String(raw || '').trim();
  const angle = text.match(/^(.+?)\s*<([^>]+)>$/);
  if (!angle) return null;
  const email = angle[2].trim();
  const name = splitPersonName(angle[1].trim());
  if (!name.firstName && !name.lastName) {
    return { firstName: email.split('@')[0], lastName: '', email };
  }
  return { ...name, email };
}

/** Derive 1–2 letter initials from any person-shaped record (no hardcoded placeholders). */
export function getPersonInitials(person = {}) {
  const first = String(person.firstName || person.first_name || '').trim();
  const last = String(person.lastName || person.last_name || '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first) return first[0].toUpperCase();
  if (last.length >= 2) return last.slice(0, 2).toUpperCase();
  if (last) return last[0].toUpperCase();

  const full = String(person.name || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  const email = String(person.email || '').trim();
  if (email) {
    const local = email.split('@')[0] || '';
    const parts = local.replace(/[._+-]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local) return local[0].toUpperCase();
  }

  return '';
}

export function enrichPersonForAvatar(person = {}) {
  const first = String(person.firstName || person.first_name || '').trim();
  const last = String(person.lastName || person.last_name || '').trim();
  const email = person.email || '';
  const name = person.name;
  const initials =
    String(person.initials || '').trim() || getPersonInitials({ firstName: first, lastName: last, email, name });
  return {
    ...person,
    firstName: first,
    lastName: last,
    email: email || person.email,
    initials
  };
}

/** Resolved customer profile for avatars / labels (contact, from address, requester email). */
export function resolveCaseContactProfile(caseRecord, message = null) {
  const contact = caseRecord?.contactId;
  if (contact && typeof contact === 'object') {
    const first = String(contact.first_name || contact.firstName || '').trim();
    const last = String(contact.last_name || contact.lastName || '').trim();
    if (first || last) {
      return enrichPersonForAvatar({
        firstName: first,
        lastName: last,
        email: contact.email,
        avatar: contact.avatar
      });
    }
    const full = String(contact.name || '').trim();
    if (full) {
      const split = splitPersonName(full);
      return enrichPersonForAvatar({ ...split, email: contact.email, avatar: contact.avatar });
    }
    if (contact.email) {
      const split = nameFromEmailLocal(contact.email);
      return enrichPersonForAvatar({
        firstName: split.firstName || contact.email.split('@')[0],
        lastName: split.lastName,
        email: contact.email,
        avatar: contact.avatar
      });
    }
  }

  const fromParsed = parseAddressWithName(message?.fromAddress);
  if (fromParsed?.firstName || fromParsed?.lastName || fromParsed?.email) {
    return enrichPersonForAvatar(fromParsed);
  }

  const requester = String(caseRecord?.requesterEmail || '').trim();
  if (requester) {
    const split = nameFromEmailLocal(requester);
    return enrichPersonForAvatar({
      firstName: split.firstName || requester.split('@')[0],
      lastName: split.lastName,
      email: requester
    });
  }

  const fromRaw = String(message?.fromAddress || '').trim();
  if (fromRaw.includes('@')) {
    const split = nameFromEmailLocal(fromRaw);
    return enrichPersonForAvatar({
      firstName: split.firstName || fromRaw.split('@')[0],
      lastName: split.lastName,
      email: fromRaw
    });
  }

  return enrichPersonForAvatar({ email: caseRecord?.requesterEmail || '' });
}

export function formatCaseContactDisplayName(profile, fallback = 'Customer') {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  return name || profile?.email || fallback;
}

export function getCaseActivityDisplayName(activity, caseRecord) {
  if (activity?.actorName) return activity.actorName;
  if (isCaseInboundMessage(activity)) {
    return formatCaseContactDisplayName(resolveCaseContactProfile(caseRecord));
  }
  const owner = caseRecord?.assignedTo;
  if (owner && typeof owner === 'object') {
    const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
    return name || owner.email || 'Agent';
  }
  return 'Agent';
}

export function getCaseActivityAvatarUser(activity, caseRecord) {
  if (isCaseInboundMessage(activity)) {
    return resolveCaseContactProfile(caseRecord);
  }
  const parts = splitPersonName(activity?.actorName);
  if (parts.firstName || parts.lastName) return enrichPersonForAvatar(parts);
  const owner = caseRecord?.assignedTo;
  if (owner && typeof owner === 'object') return enrichPersonForAvatar(owner);
  return enrichPersonForAvatar({ email: owner?.email || '' });
}

export function formatCaseChannelLabel(channel) {
  const c = String(channel || '').trim();
  return c || 'Internal';
}

function normalizeActivityText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Headline for system / audit timeline rows (conversation tab). */
export function getCaseSystemActivityHeadline(activity, t) {
  const type = String(activity?.activityType || '');
  if (type === 'status_changed' && activity?.metadata?.toStatus) {
    return t('cases.recordEventStatus', {
      from: activity.metadata.fromStatus,
      to: activity.metadata.toStatus
    });
  }
  if (type === 'case_created') return t('cases.recordEventCreated');
  if (type === 'case_reopened') return t('cases.recordEventReopened');
  if (type === 'sla_response_met') return t('cases.recordEventResponseSlaMet');
  if (type.startsWith('assignment_')) return t('cases.recordEventAssignment');
  if (type.startsWith('sla_')) return t('cases.recordEventSla');
  const message = String(activity?.message || '').trim();
  if (message) return message;
  return type.replace(/_/g, ' ');
}

function isRedundantSystemMessage(message, headline, activityType) {
  const msg = normalizeActivityText(message);
  const head = normalizeActivityText(headline);
  if (!msg) return true;
  if (msg === head) return true;
  if (activityType === 'status_changed') return true;
  if (msg.startsWith(head)) {
    const suffix = msg.slice(head.length).replace(/^[\s.:·—-]+/, '');
    if (!suffix) return true;
  }
  return false;
}

/** Extra detail when message adds information beyond the headline. */
export function getCaseSystemActivitySupplement(activity, headline) {
  const type = String(activity?.activityType || '');
  const message = String(activity?.message || '').trim();
  if (!message || isRedundantSystemMessage(message, headline, type)) return '';

  const msgNorm = normalizeActivityText(message);
  const headNorm = normalizeActivityText(headline);
  if (msgNorm.startsWith(headNorm)) {
    const suffix = message.slice(headline.length).replace(/^[\s.:·—-]+/, '').trim();
    return suffix || '';
  }
  if (type === 'status_changed' || type === 'sla_response_met') return '';
  return message;
}

/** Single-line label for system events, e.g. "Case created 48 mins ago". */
export function formatCaseSystemActivityLine(activity, { t, formatTime }) {
  const headline = getCaseSystemActivityHeadline(activity, t);
  const supplement = getCaseSystemActivitySupplement(activity, headline);
  const type = String(activity?.activityType || '');
  const eventTime =
    type === 'sla_response_met'
      ? activity?.metadata?.responseMetAt || activity?.createdAt
      : activity?.createdAt;
  const time = formatTime(eventTime) || '';
  const label = supplement ? `${headline} ${supplement}` : headline;
  return time ? `${label} · ${time}` : label;
}

export function isCaseResponseSlaMetActivity(activity) {
  return String(activity?.activityType || '').trim() === 'sla_response_met';
}

export function sortCaseActivitiesChronologically(activities) {
  const list = Array.isArray(activities) ? [...activities] : [];
  return list.sort((a, b) => {
    const ta = new Date(a?.createdAt || 0).getTime();
    const tb = new Date(b?.createdAt || 0).getTime();
    return ta - tb;
  });
}

export function filterActivitiesForTab(activities, tab) {
  const sorted = sortCaseActivitiesChronologically(activities);
  if (tab === 'conversation') {
    return sorted.filter((a) => {
      if (isCaseSystemActivity(a)) return true;
      if (isCaseInternalComment(a)) return true;
      if (isCaseInboundMessage(a) || isCaseOutboundMessage(a)) return true;
      return false;
    });
  }
  if (tab === 'notes') {
    return sorted.filter((a) => isCaseInternalComment(a));
  }
  return sorted;
}
