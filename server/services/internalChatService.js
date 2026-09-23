'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const InternalChatSpace = require('../models/InternalChatSpace');
const InternalChatMembership = require('../models/InternalChatMembership');
const InternalChatMessage = require('../models/InternalChatMessage');
const User = require('../models/User');
const internalChatSSEHub = require('./internalChatSSEHub');
const { getModelForModuleKey } = require('../utils/assignmentRecordLoader');
const { resolveRuntimePermission } = require('./runtimePermissionResolver');

function canViewInternalChat(user) {
  if (!user) return false;
  if (String(user.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL') return false;
  if (user.isOwner === true) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return user.permissions?.internalChat?.view === true;
}

function canManageInternalChat(user) {
  if (!user) return false;
  if (String(user.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL') return false;
  if (user.isOwner === true) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return user.permissions?.internalChat?.manage === true
    || user.permissions?.internalChat?.admin === true;
}

function isInternalTeamUserDoc(user) {
  return String(user?.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL';
}

/** Mongo filter: active org teammates only (exclude portal/external users). */
function internalTeammateFilter(organizationId) {
  return {
    organizationId,
    userType: { $nin: ['EXTERNAL', 'external'] },
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  };
}

function ServiceError(message, status = 400, code = 'INTERNAL_CHAT_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function looksLikeChatHtml(value) {
  return /<\/?(p|strong|em|ul|ol|li|a|code|pre|s|u|span|br|h[1-3]|blockquote)\b/i.test(String(value || ''));
}

function stripHtmlToPlain(html) {
  return String(html || '')
    // Mention tokens look like tags (`<@id>`); convert before `/<[^>]+>/` strip.
    .replace(/<@all>/gi, '@all')
    .replace(/<@([a-f0-9]{24})>/gi, '@$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Lightweight server-side scrub (client also sanitizes with DOMPurify). */
function sanitizeChatHtml(html) {
  let out = String(html || '');
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '');
  out = out.replace(/<\/?(?!\/?(?:p|br|strong|b|em|i|s|u|a|ul|ol|li|code|pre|span|h1|h2|h3|blockquote)\b)[a-z0-9]+\b[^>]*>/gi, '');
  return out.trim();
}

function normalizeMessageBody(body) {
  const raw = String(body || '').trim();
  if (!raw) return '';
  if (!looksLikeChatHtml(raw)) return raw;
  return sanitizeChatHtml(raw);
}

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase();
}

function buildDmKey(userIds) {
  const sorted = [...new Set(userIds.map((id) => String(id)))].sort();
  return crypto.createHash('sha256').update(sorted.join(':')).digest('hex');
}

function parseMentionsFromBody(body, explicitIds = []) {
  const fromBody = [];
  const re = /<@([a-f0-9]{24})>/gi;
  let match;
  while ((match = re.exec(String(body || ''))) !== null) {
    fromBody.push(match[1]);
  }
  const combined = [...explicitIds.map(String), ...fromBody];
  const userIds = [...new Set(combined)].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const { bodyHasMentionAll } = require('../utils/internalChatMentions');
  return {
    userIds,
    mentionAll: bodyHasMentionAll(body),
  };
}

async function listMemberUserIds(organizationId, spaceId) {
  const rows = await InternalChatMembership.find({ organizationId, spaceId })
    .select('userId')
    .lean();
  return rows.map((r) => r.userId);
}

async function publishToSpaceMembers(organizationId, spaceId, payload) {
  const userIds = await listMemberUserIds(organizationId, spaceId);
  return internalChatSSEHub.publishToUsers(organizationId, userIds, payload);
}

const SYSTEM_EVENT_TYPES = new Set([
  'group_created',
  'channel_created',
  'member_added',
  'member_removed',
  'member_left',
  'chat_pinned',
]);

function systemBodyFallback(eventType, actorName, targetName = '') {
  const actor = actorName || 'Someone';
  const target = targetName || 'Someone';
  switch (eventType) {
    case 'group_created':
      return `${actor} created the group`;
    case 'channel_created':
      return `${actor} created the channel`;
    case 'member_added':
      return `${actor} added ${target} to the group`;
    case 'member_removed':
      return `${actor} removed ${target} from the group`;
    case 'member_left':
      return `${actor} left the group`;
    case 'chat_pinned':
      return `${actor} pinned the chat`;
    default:
      return actor;
  }
}

/**
 * Persist a non-interactive activity notice in the space timeline and fan out via SSE.
 * Does not emit push/mention notifications.
 */
async function postSystemMessage({
  organizationId,
  spaceId,
  actorUser,
  eventType,
  targetUser = null,
}) {
  if (!SYSTEM_EVENT_TYPES.has(eventType) || !actorUser?._id) return null;

  const actorName = formatUserDisplayName(actorUser).slice(0, 120);
  const targetName = targetUser ? formatUserDisplayName(targetUser).slice(0, 120) : '';
  const systemEvent = {
    type: eventType,
    actorUserId: actorUser._id,
    actorName,
  };
  if (targetUser?._id) {
    systemEvent.targetUserId = targetUser._id;
    systemEvent.targetName = targetName;
  }

  const message = await InternalChatMessage.create({
    organizationId,
    spaceId,
    threadRootId: null,
    authorId: actorUser._id,
    kind: 'system',
    systemEvent,
    body: systemBodyFallback(eventType, actorName, targetName),
  });

  await InternalChatSpace.updateOne(
    { _id: spaceId, organizationId },
    { $set: { lastMessageAt: message.createdAt } }
  );

  const author = {
    _id: actorUser._id,
    firstName: actorUser.firstName,
    lastName: actorUser.lastName,
    email: actorUser.email,
    avatar: actorUser.avatar || '',
  };

  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'message.created',
    spaceId: String(spaceId),
    threadRootId: null,
    message: {
      ...message.toObject(),
      author,
    },
  });

  return message;
}

async function ensureMembership(organizationId, spaceId, userId, role = 'member') {
  const existing = await InternalChatMembership.findOne({ organizationId, spaceId, userId }).lean();
  if (existing) return existing;
  const doc = await InternalChatMembership.create({
    organizationId,
    spaceId,
    userId,
    role,
  });
  return doc.toObject();
}

async function assertMembership(organizationId, userId, spaceId) {
  const membership = await InternalChatMembership.findOne({
    organizationId,
    spaceId,
    userId,
  }).lean();
  if (!membership) {
    throw ServiceError('Not a member of this space', 403, 'INTERNAL_CHAT_NOT_MEMBER');
  }
  return membership;
}

async function getSpaceOrThrow(organizationId, spaceId) {
  const space = await InternalChatSpace.findOne({
    organizationId,
    _id: spaceId,
    archivedAt: null,
  }).lean();
  if (!space) {
    throw ServiceError('Space not found', 404, 'INTERNAL_CHAT_SPACE_NOT_FOUND');
  }
  return space;
}

function userCanViewModule(user, moduleKey) {
  if (user?.isOwner === true) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return resolveRuntimePermission(user, moduleKey, 'view', {}) === true;
}

function recordDisplayLabel(record) {
  if (!record) return '';
  const first = String(record.first_name || record.firstName || '').trim();
  const last = String(record.last_name || record.lastName || '').trim();
  const personName = [first, last].filter(Boolean).join(' ');
  return (
    personName
    || String(record.name || '').trim()
    || String(record.title || '').trim()
    || String(record.subject || '').trim()
    || String(record.displayName || '').trim()
    || String(record.caseNumber || '').trim()
    || String(record.dealName || '').trim()
    || String(record.personNumber || '').trim()
    || String(record.email || '').trim()
    || String(record._id)
  );
}

/**
 * Module view permission + record exists in tenant.
 * Sharing-scope filtering deferred; owners/admins + module.view gate P1.
 */
async function assertCanViewRecord(user, moduleKey, recordId) {
  const key = normalizeModuleKey(moduleKey);
  if (!key || !mongoose.Types.ObjectId.isValid(recordId)) {
    throw ServiceError('Invalid module or record', 400, 'INTERNAL_CHAT_INVALID_RECORD');
  }
  if (!userCanViewModule(user, key)) {
    throw ServiceError('No permission to view this record', 403, 'INTERNAL_CHAT_RECORD_FORBIDDEN');
  }
  const Model = getModelForModuleKey(key);
  if (!Model) {
    throw ServiceError('Unsupported module for chat', 400, 'INTERNAL_CHAT_UNSUPPORTED_MODULE');
  }
  const record = await Model.findOne({
    _id: recordId,
    organizationId: user.organizationId,
  })
    .select('_id name title subject displayName caseNumber dealName first_name last_name firstName lastName email personNumber')
    .lean();
  if (!record) {
    throw ServiceError('Record not found', 404, 'INTERNAL_CHAT_RECORD_NOT_FOUND');
  }
  return { moduleKey: key, record, label: recordDisplayLabel(record) };
}

async function assertCanAccessSpace(user, space) {
  if (space.type === 'record' && space.moduleKey && space.recordId) {
    await assertCanViewRecord(user, space.moduleKey, space.recordId);
  }
}

async function createChannel({ organizationId, user, name, topic = '', isPrivate = false, memberIds = [] }) {
  if (!canManageInternalChat(user) && !canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw ServiceError('Channel name is required', 400, 'INTERNAL_CHAT_NAME_REQUIRED');
  }

  const space = await InternalChatSpace.create({
    organizationId,
    type: 'channel',
    name: trimmed,
    topic: String(topic || '').trim(),
    isPrivate: Boolean(isPrivate),
    createdBy: user._id,
  });

  const members = new Set([String(user._id), ...memberIds.map(String)]);
  const validIds = [...members].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const teammateRows = await User.find({
    _id: { $in: validIds },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id')
    .lean();
  const allowed = new Set(teammateRows.map((r) => String(r._id)));
  // Creator is always allowed even if filter edge-cases (they already passed canView).
  allowed.add(String(user._id));

  for (const mid of validIds) {
    if (!allowed.has(mid)) continue;
    // eslint-disable-next-line no-await-in-loop
    await ensureMembership(
      organizationId,
      space._id,
      mid,
      mid === String(user._id) ? 'admin' : 'member'
    );
  }

  await postSystemMessage({
    organizationId,
    spaceId: space._id,
    actorUser: user,
    eventType: 'channel_created',
  });

  const payload = { type: 'space.updated', spaceId: String(space._id), action: 'created' };
  await publishToSpaceMembers(organizationId, space._id, payload);
  return {
    ...space.toObject(),
    isMember: true,
    canJoin: false,
  };
}

function formatUserDisplayName(user) {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || String(user._id || '');
}

async function enrichSpaceDisplayNames(organizationId, viewerUserId, spaces) {
  const dmSpaceIds = spaces
    .filter((s) => s.type === 'dm' || s.type === 'group_dm')
    .map((s) => s._id);

  const recordSpaces = spaces.filter((s) => s.type === 'record' && s.moduleKey && s.recordId);

  const allMemberships = dmSpaceIds.length
    ? await InternalChatMembership.find({
        organizationId,
        spaceId: { $in: dmSpaceIds },
      })
        .select('spaceId userId')
        .lean()
    : [];

  const peerIds = new Set();
  const peersBySpace = new Map();
  for (const row of allMemberships) {
    const sid = String(row.spaceId);
    if (!peersBySpace.has(sid)) peersBySpace.set(sid, []);
    if (String(row.userId) !== String(viewerUserId)) {
      peersBySpace.get(sid).push(row.userId);
      peerIds.add(String(row.userId));
    }
  }

  const users = peerIds.size
    ? await User.find({ _id: { $in: [...peerIds] } })
      .select('_id firstName lastName email avatar')
      .lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // Batch-load record labels by module
  const recordLabelBySpaceId = new Map();
  const byModule = new Map();
  for (const space of recordSpaces) {
    const key = normalizeModuleKey(space.moduleKey);
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key).push(space);
  }
  await Promise.all([...byModule.entries()].map(async ([moduleKey, moduleSpaces]) => {
    const Model = getModelForModuleKey(moduleKey);
    if (!Model) return;
    const ids = moduleSpaces.map((s) => s.recordId).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return;
    const records = await Model.find({
      _id: { $in: ids },
      organizationId,
    })
      .select('_id name title subject displayName caseNumber dealName first_name last_name firstName lastName email personNumber')
      .lean();
    const byId = new Map(records.map((r) => [String(r._id), r]));
    for (const space of moduleSpaces) {
      const record = byId.get(String(space.recordId));
      const label = recordDisplayLabel(record);
      if (label) recordLabelBySpaceId.set(String(space._id), label);
    }
  }));

  // Persist corrected names when space was saved with a raw ObjectId fallback
  const nameFixes = [];
  for (const space of recordSpaces) {
    const label = recordLabelBySpaceId.get(String(space._id));
    if (!label) continue;
    const current = String(space.name || '').trim();
    const looksLikeId = current === String(space.recordId) || /^[a-f0-9]{24}$/i.test(current);
    if (looksLikeId && label !== current) {
      nameFixes.push(
        InternalChatSpace.updateOne(
          { _id: space._id, organizationId },
          { $set: { name: label } }
        )
      );
    }
  }
  if (nameFixes.length) {
    await Promise.all(nameFixes);
  }

  return spaces.map((space) => {
    if (space.type === 'record') {
      const label = recordLabelBySpaceId.get(String(space._id));
      if (label) {
        return {
          ...space,
          name: label,
          displayName: label,
        };
      }
      return space;
    }
    if (space.type !== 'dm' && space.type !== 'group_dm') {
      return space;
    }
    const peers = peersBySpace.get(String(space._id)) || [];
    const peerUsers = peers
      .map((id) => userById.get(String(id)))
      .filter(Boolean)
      .map((u) => ({
        _id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatar: u.avatar || '',
      }));
    const labels = peerUsers.map((u) => formatUserDisplayName(u)).filter(Boolean);
    const displayName = labels.length
      ? labels.join(', ')
      : space.name || '';
    return {
      ...space,
      displayName,
      peerUserIds: peers.map(String),
      peerUsers,
      peer: peerUsers[0] || null,
    };
  });
}

async function createOrGetDm({ organizationId, user, otherUserId }) {
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw ServiceError('Invalid user', 400, 'INTERNAL_CHAT_INVALID_USER');
  }
  if (String(otherUserId) === String(user._id)) {
    throw ServiceError('Cannot DM yourself', 400, 'INTERNAL_CHAT_INVALID_DM');
  }

  const other = await User.findOne({
    _id: otherUserId,
    ...internalTeammateFilter(organizationId),
  })
    .select('_id firstName lastName email avatar userType')
    .lean();
  if (!other || !isInternalTeamUserDoc(other)) {
    throw ServiceError('User not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  const dmKey = buildDmKey([user._id, otherUserId]);
  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'dm',
    dmKey,
    archivedAt: null,
  }).lean();

  if (!space) {
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'dm',
      name: '',
      dmKey,
      isPrivate: true,
      createdBy: user._id,
    });
    await ensureMembership(organizationId, created._id, user._id, 'admin');
    await ensureMembership(organizationId, created._id, otherUserId, 'member');
    space = created.toObject();
    await publishToSpaceMembers(organizationId, space._id, {
      type: 'space.updated',
      spaceId: String(space._id),
      action: 'created',
    });
  } else {
    await ensureMembership(organizationId, space._id, user._id);
    await ensureMembership(organizationId, space._id, otherUserId);
  }

  return space;
}

async function discussRecord({ organizationId, user, moduleKey, recordId }) {
  const { moduleKey: key, record, label } = await assertCanViewRecord(user, moduleKey, recordId);

  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'record',
    moduleKey: key,
    recordId: record._id,
    archivedAt: null,
  }).lean();

  if (!space) {
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'record',
      name: label,
      moduleKey: key,
      recordId: record._id,
      isPrivate: true,
      createdBy: user._id,
    });
    space = created.toObject();
  } else {
    const current = String(space.name || '').trim();
    const looksLikeId = current === String(space.recordId) || /^[a-f0-9]{24}$/i.test(current);
    if (label && (looksLikeId || !current)) {
      await InternalChatSpace.updateOne(
        { _id: space._id, organizationId },
        { $set: { name: label } }
      );
      space = { ...space, name: label };
    }
  }

  await ensureMembership(organizationId, space._id, user._id, 'admin');
  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'discussed',
  });

  return { space, recordLabel: label, moduleKey: key };
}

function isMembershipMuted(membership) {
  if (!membership?.muted) return false;
  if (membership.mutedUntil && new Date(membership.mutedUntil).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

async function listSpacesForUser(organizationId, userId) {
  const memberships = await InternalChatMembership.find({ organizationId, userId })
    .select('spaceId role muted mutedUntil forceUnread pinnedAt lastReadAt lastReadMessageId joinedAt')
    .lean();

  const membershipBySpace = new Map(memberships.map((m) => [String(m.spaceId), m]));
  const memberSpaceIds = memberships.map((m) => m.spaceId);

  const now = new Date();
  await InternalChatMembership.updateMany(
    {
      organizationId,
      userId,
      muted: true,
      mutedUntil: { $ne: null, $lte: now },
    },
    { $set: { muted: false, mutedUntil: null } }
  );
  for (const m of memberships) {
    if (m.muted && m.mutedUntil && new Date(m.mutedUntil).getTime() <= now.getTime()) {
      m.muted = false;
      m.mutedUntil = null;
    }
  }

  const [memberSpaces, publicChannels] = await Promise.all([
    memberSpaceIds.length
      ? InternalChatSpace.find({
          organizationId,
          _id: { $in: memberSpaceIds },
          archivedAt: null,
        }).lean()
      : Promise.resolve([]),
    InternalChatSpace.find({
      organizationId,
      type: 'channel',
      isPrivate: false,
      archivedAt: null,
      ...(memberSpaceIds.length ? { _id: { $nin: memberSpaceIds } } : {}),
    }).lean(),
  ]);

  const withUnread = await Promise.all(
    memberSpaces.map(async (space) => {
      const membership = membershipBySpace.get(String(space._id));
      let unreadCount = 0;
      if (membership?.lastReadAt) {
        unreadCount = await InternalChatMessage.countDocuments({
          organizationId,
          spaceId: space._id,
          deletedAt: null,
          createdAt: { $gt: membership.lastReadAt },
          authorId: { $ne: userId },
        });
      } else if (membership) {
        unreadCount = await InternalChatMessage.countDocuments({
          organizationId,
          spaceId: space._id,
          deletedAt: null,
          authorId: { $ne: userId },
        });
      }
      if (membership?.forceUnread) {
        unreadCount = Math.max(1, unreadCount);
      }
      const mutedActive = isMembershipMuted(membership);
      return {
        ...space,
        unreadCount,
        isMember: true,
        canJoin: false,
        membership: membership
          ? {
              role: membership.role,
              muted: mutedActive,
              mutedUntil: mutedActive ? (membership.mutedUntil || null) : null,
              forceUnread: membership.forceUnread === true,
              pinnedAt: membership.pinnedAt || null,
              lastReadAt: membership.lastReadAt,
              lastReadMessageId: membership.lastReadMessageId,
              joinedAt: membership.joinedAt,
            }
          : null,
      };
    })
  );

  const joinablePublic = publicChannels.map((space) => ({
    ...space,
    unreadCount: 0,
    isMember: false,
    canJoin: true,
    membership: null,
  }));

  const combined = [...withUnread, ...joinablePublic].sort((a, b) => {
    const aAt = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
    const bAt = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
    return bAt - aAt;
  });

  return enrichSpaceDisplayNames(organizationId, userId, combined);
}

async function joinPublicChannel({ organizationId, user, spaceId }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel') {
    throw ServiceError('Only channels can be joined', 400, 'INTERNAL_CHAT_NOT_CHANNEL');
  }
  if (space.isPrivate) {
    throw ServiceError('This channel is private — ask a member to invite you', 403, 'INTERNAL_CHAT_PRIVATE');
  }

  await ensureMembership(organizationId, space._id, user._id, 'member');
  const [enriched] = await enrichSpaceDisplayNames(organizationId, user._id, [{
    ...space,
    unreadCount: 0,
    isMember: true,
    canJoin: false,
  }]);

  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'member_joined',
    userId: String(user._id),
  });

  return enriched;
}

async function listSpaceMembers({ organizationId, user, spaceId }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const memberships = await InternalChatMembership.find({ organizationId, spaceId })
    .select('userId role')
    .lean();
  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const meId = String(user._id);
  const myMembership = memberships.find((m) => String(m.userId) === meId);
  const myRole = myMembership?.role || 'member';
  const supportsMemberMgmt = space.type === 'channel' || space.type === 'group_dm';
  const minMembers = space.type === 'group_dm' ? 2 : 1;
  const canShrink = memberships.length > minMembers;
  const canRemoveOthers = supportsMemberMgmt && canShrink && (
    space.type === 'group_dm' || myRole === 'admin'
  );
  const canLeave = supportsMemberMgmt && canShrink;

  const members = memberships
    .map((m) => {
      const u = byId.get(String(m.userId)) || {};
      const uid = String(m.userId);
      const isSelf = uid === meId;
      return {
        userId: uid,
        role: m.role || 'member',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        avatar: u.avatar || '',
        canRemove: isSelf ? canLeave : canRemoveOthers,
      };
    })
    .sort((a, b) => {
      const an = formatUserDisplayName(a).toLowerCase();
      const bn = formatUserDisplayName(b).toLowerCase();
      return an.localeCompare(bn);
    });

  return {
    spaceId: String(space._id),
    spaceType: space.type,
    canInvite: supportsMemberMgmt,
    canRemoveOthers,
    canLeave,
    currentUserRole: myRole,
    memberCount: members.length,
    members,
  };
}

/**
 * Remove a member from a channel or group DM (or leave when target is self).
 */
async function removeSpaceMember({ organizationId, user, spaceId, targetUserId }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw ServiceError('Invalid user', 400, 'INTERNAL_CHAT_INVALID_USER');
  }

  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel' && space.type !== 'group_dm') {
    throw ServiceError(
      'Only channels and group chats support member removal',
      400,
      'INTERNAL_CHAT_REMOVE_UNSUPPORTED'
    );
  }

  const callerMembership = await assertMembership(organizationId, user._id, spaceId);
  const targetId = String(targetUserId);
  const isSelf = targetId === String(user._id);

  if (!isSelf) {
    if (space.type === 'channel' && callerMembership.role !== 'admin') {
      throw ServiceError(
        'Only channel admins can remove members',
        403,
        'INTERNAL_CHAT_REMOVE_FORBIDDEN'
      );
    }
  }

  const memberships = await InternalChatMembership.find({ organizationId, spaceId })
    .select('userId role joinedAt')
    .sort({ joinedAt: 1 })
    .lean();
  const targetMembership = memberships.find((m) => String(m.userId) === targetId);
  if (!targetMembership) {
    throw ServiceError('User is not a member of this space', 404, 'INTERNAL_CHAT_NOT_MEMBER');
  }

  if (memberships.length <= 1) {
    throw ServiceError(
      'Cannot remove the last member of this space',
      400,
      'INTERNAL_CHAT_LAST_MEMBER'
    );
  }

  if (space.type === 'group_dm' && memberships.length <= 2) {
    throw ServiceError(
      'Group chats need at least 2 members',
      400,
      'INTERNAL_CHAT_GROUP_TOO_SMALL'
    );
  }

  const remaining = memberships.filter((m) => String(m.userId) !== targetId);

  if (space.type === 'group_dm') {
    const nextIds = remaining.map((m) => String(m.userId));
    const nextDmKey = buildDmKey(nextIds);
    if (nextDmKey !== space.dmKey) {
      const conflict = await InternalChatSpace.findOne({
        organizationId,
        type: 'group_dm',
        dmKey: nextDmKey,
        archivedAt: null,
        _id: { $ne: space._id },
      })
        .select('_id')
        .lean();
      if (conflict) {
        throw ServiceError(
          'A group chat with these members already exists',
          409,
          'INTERNAL_CHAT_GROUP_EXISTS'
        );
      }
    }
  }

  const adminsRemaining = remaining.filter((m) => m.role === 'admin');
  if (targetMembership.role === 'admin' && adminsRemaining.length === 0 && remaining.length) {
    await InternalChatMembership.updateOne(
      { organizationId, spaceId, userId: remaining[0].userId },
      { $set: { role: 'admin' } }
    );
  }

  const targetUserDoc = await User.findById(targetMembership.userId)
    .select('_id firstName lastName email avatar')
    .lean();
  await postSystemMessage({
    organizationId,
    spaceId: space._id,
    actorUser: user,
    eventType: isSelf ? 'member_left' : 'member_removed',
    targetUser: isSelf ? null : (targetUserDoc || { _id: targetMembership.userId }),
  });

  await InternalChatMembership.deleteOne({
    organizationId,
    spaceId,
    userId: targetMembership.userId,
  });

  if (space.type === 'group_dm') {
    const nextIds = remaining.map((m) => String(m.userId));
    const nextDmKey = buildDmKey(nextIds);
    const allUsers = await User.find({ _id: { $in: nextIds } })
      .select('_id firstName lastName')
      .lean();
    const label = allUsers
      .map((u) => formatUserDisplayName(u))
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
    await InternalChatSpace.updateOne(
      { _id: space._id, organizationId, type: 'group_dm', archivedAt: null },
      { $set: { dmKey: nextDmKey, name: label || space.name || '' } }
    );
  }

  const fanoutIds = [
    ...remaining.map((m) => m.userId),
    targetMembership.userId,
  ];
  await internalChatSSEHub.publishToUsers(organizationId, fanoutIds, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'member_removed',
    removedUserId: targetId,
    removedByUserId: String(user._id),
    left: isSelf,
  });

  return {
    spaceId: String(space._id),
    removedUserId: targetId,
    left: isSelf,
  };
}

async function inviteMembersToChannel({ organizationId, user, spaceId, memberIds = [] }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel' && space.type !== 'group_dm') {
    throw ServiceError(
      'Only channels and group chats support invites',
      400,
      'INTERNAL_CHAT_INVITE_UNSUPPORTED'
    );
  }
  await assertMembership(organizationId, user._id, spaceId);

  const ids = [...new Set(memberIds.map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== String(user._id));
  if (!ids.length) {
    throw ServiceError('Select at least one teammate', 400, 'INTERNAL_CHAT_NO_INVITEES');
  }

  const teammates = await User.find({
    _id: { $in: ids },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id firstName lastName email avatar userType')
    .lean();
  if (
    teammates.length !== ids.length
    || teammates.some((u) => !isInternalTeamUserDoc(u))
  ) {
    throw ServiceError('One or more users not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  const existingIds = new Set(
    (await listMemberUserIds(organizationId, space._id)).map(String)
  );
  const toAdd = teammates.filter((row) => !existingIds.has(String(row._id)));
  if (!toAdd.length) {
    throw ServiceError('All selected people are already members', 400, 'INTERNAL_CHAT_ALREADY_MEMBERS');
  }

  if (space.type === 'group_dm') {
    const nextIds = [...existingIds, ...toAdd.map((row) => String(row._id))];
    const nextDmKey = buildDmKey(nextIds);
    if (nextDmKey !== space.dmKey) {
      const conflict = await InternalChatSpace.findOne({
        organizationId,
        type: 'group_dm',
        dmKey: nextDmKey,
        archivedAt: null,
        _id: { $ne: space._id },
      })
        .select('_id')
        .lean();
      if (conflict) {
        throw ServiceError(
          'A group chat with these members already exists',
          409,
          'INTERNAL_CHAT_GROUP_EXISTS'
        );
      }
    }

    for (const row of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(organizationId, space._id, row._id, 'member');
    }

    const allUsers = await User.find({ _id: { $in: nextIds } })
      .select('_id firstName lastName')
      .lean();
    const label = allUsers
      .map((u) => formatUserDisplayName(u))
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
    await InternalChatSpace.updateOne(
      { _id: space._id, organizationId, type: 'group_dm', archivedAt: null },
      { $set: { dmKey: nextDmKey, name: label || space.name || '' } }
    );
  } else {
    for (const row of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(organizationId, space._id, row._id, 'member');
    }
  }

  for (const row of toAdd) {
    // eslint-disable-next-line no-await-in-loop
    await postSystemMessage({
      organizationId,
      spaceId: space._id,
      actorUser: user,
      eventType: 'member_added',
      targetUser: row,
    });
  }

  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'members_invited',
    invitedUserIds: toAdd.map((t) => String(t._id)),
  });

  return {
    spaceId: String(space._id),
    invitedCount: toAdd.length,
  };
}

/**
 * Rename (and optionally retopic) an existing channel — does not create a new space.
 * Authorized: channel members (same bar as invite).
 */
async function updateChannel({ organizationId, user, spaceId, name, topic }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel') {
    throw ServiceError('Only channels can be renamed', 400, 'INTERNAL_CHAT_NOT_CHANNEL');
  }
  await assertMembership(organizationId, user._id, spaceId);

  const patch = {};
  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      throw ServiceError('Channel name is required', 400, 'INTERNAL_CHAT_NAME_REQUIRED');
    }
    if (trimmed.length > 120) {
      throw ServiceError('Channel name too long', 400, 'INTERNAL_CHAT_NAME_TOO_LONG');
    }
    patch.name = trimmed;
  }
  if (topic !== undefined) {
    patch.topic = String(topic || '').trim().slice(0, 500);
  }
  if (!Object.keys(patch).length) {
    throw ServiceError('No changes provided', 400, 'INTERNAL_CHAT_NO_CHANGES');
  }

  const updated = await InternalChatSpace.findOneAndUpdate(
    { _id: space._id, organizationId, type: 'channel', archivedAt: null },
    { $set: patch },
    { new: true }
  ).lean();
  if (!updated) {
    throw ServiceError('Space not found', 404, 'INTERNAL_CHAT_SPACE_NOT_FOUND');
  }

  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'renamed',
    name: updated.name,
    topic: updated.topic,
  });

  return {
    ...updated,
    isMember: true,
    canJoin: false,
  };
}

async function listMessages({
  organizationId,
  user,
  spaceId,
  threadRootId = null,
  before = null,
  aroundMessageId = null,
  limit = 50,
}) {
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const [enrichedSpace] = await enrichSpaceDisplayNames(organizationId, user._id, [space]);

  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  let messages = null;
  let focus = null;

  // Deep-link window: load roots around the target (or its thread root).
  if (
    aroundMessageId
    && mongoose.Types.ObjectId.isValid(aroundMessageId)
    && !before
    && !threadRootId
  ) {
    const target = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: aroundMessageId,
    }).lean();
    if (target) {
      const rootId = target.threadRootId || target._id;
      const anchor = target.threadRootId
        ? await InternalChatMessage.findOne({
          organizationId,
          spaceId,
          _id: target.threadRootId,
          threadRootId: null,
        }).lean()
        : target;
      if (anchor) {
        const half = Math.floor(take / 2);
        const older = await InternalChatMessage.find({
          organizationId,
          spaceId,
          threadRootId: null,
          createdAt: { $lte: anchor.createdAt },
        })
          .sort({ createdAt: -1 })
          .limit(half + 1)
          .lean();
        const newer = await InternalChatMessage.find({
          organizationId,
          spaceId,
          threadRootId: null,
          createdAt: { $gt: anchor.createdAt },
        })
          .sort({ createdAt: 1 })
          .limit(Math.max(take - older.length, 0))
          .lean();
        messages = [...older.reverse(), ...newer];
        focus = {
          messageId: String(target._id),
          threadRootId: target.threadRootId ? String(rootId) : null,
        };
      }
    }
  }

  if (!messages) {
    const query = {
      organizationId,
      spaceId,
    };

    if (threadRootId) {
      query.threadRootId = threadRootId;
    } else {
      query.threadRootId = null;
    }

    if (before && mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: before };
    }

    messages = await InternalChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(take)
      .lean();
    messages = messages.reverse();
  }

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  let enriched = messages.map((m) => ({
    ...m,
    author: authorById.get(String(m.authorId)) || null,
    reactions: summarizeReactions(m.reactions, user._id),
    replyCount: 0,
  }));

  // Root timeline: attach reply counts for thread discovery.
  if (!threadRootId && enriched.length) {
    const rootIds = enriched.map((m) => m._id);
    const counts = await InternalChatMessage.aggregate([
      {
        $match: {
          organizationId,
          spaceId: space._id,
          threadRootId: { $in: rootIds },
          deletedAt: null,
        },
      },
      { $group: { _id: '$threadRootId', count: { $sum: 1 } } },
    ]);
    const countByRoot = new Map(counts.map((c) => [String(c._id), c.count]));
    enriched = enriched.map((m) => ({
      ...m,
      replyCount: countByRoot.get(String(m._id)) || 0,
    }));
  }

  let readState = { mode: 'off', memberCount: 0, members: [] };
  try {
    readState = await listSpaceReadState({ organizationId, user, spaceId });
  } catch {
    /* membership already asserted above; ignore read-state failures */
  }

  let pinnedMessages = [];
  const pinIds = Array.isArray(space.pinnedMessageIds) ? space.pinnedMessageIds : [];
  if (pinIds.length && !threadRootId) {
    const pinnedRows = await InternalChatMessage.find({
      organizationId,
      spaceId,
      _id: { $in: pinIds },
      deletedAt: null,
    })
      .select('_id authorId body attachments createdAt kind systemEvent')
      .lean();
    const pinnedAuthorIds = [...new Set(pinnedRows.map((m) => String(m.authorId)))];
    const pinnedAuthors = pinnedAuthorIds.length
      ? await User.find({ _id: { $in: pinnedAuthorIds } })
        .select('_id firstName lastName email avatar')
        .lean()
      : [];
    const pinnedAuthorById = new Map(pinnedAuthors.map((a) => [String(a._id), a]));
    const byId = new Map(pinnedRows.map((m) => [String(m._id), m]));
    pinnedMessages = pinIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((m) => ({
        ...m,
        author: pinnedAuthorById.get(String(m.authorId)) || null,
      }));
  }

  return {
    space: enrichedSpace,
    messages: enriched,
    pinnedMessages,
    readState,
    focus,
  };
}

async function postMessage({
  organizationId,
  user,
  spaceId,
  body,
  threadRootId = null,
  quoteMessageId = null,
  mentionUserIds = [],
  recordRefs = [],
  attachments = [],
}) {
  const rawBody = String(body || '').trim();
  const text = normalizeMessageBody(rawBody);
  const plain = stripHtmlToPlain(text);
  const safeAttachments = normalizeAttachments(attachments);
  assertHomogeneousAttachments(safeAttachments);
  if (!plain && !safeAttachments.length) {
    throw ServiceError('Message body or attachment is required', 400, 'INTERNAL_CHAT_EMPTY_BODY');
  }
  if (text.length > 16000) {
    throw ServiceError('Message too long', 400, 'INTERNAL_CHAT_BODY_TOO_LONG');
  }

  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  let rootId = null;
  if (threadRootId) {
    if (!mongoose.Types.ObjectId.isValid(threadRootId)) {
      throw ServiceError('Invalid thread', 400, 'INTERNAL_CHAT_INVALID_THREAD');
    }
    const root = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: threadRootId,
      threadRootId: null,
      deletedAt: null,
    }).lean();
    if (!root) {
      throw ServiceError('Thread root not found', 404, 'INTERNAL_CHAT_THREAD_NOT_FOUND');
    }
    rootId = root._id;
  }

  // Quote-in-reply is a channel/DM root message affordance (not used inside threads).
  let quote = null;
  if (!rootId && quoteMessageId && mongoose.Types.ObjectId.isValid(quoteMessageId)) {
    const quoted = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: quoteMessageId,
      deletedAt: null,
    }).lean();
    if (quoted) {
      const quotedAuthor = await User.findById(quoted.authorId)
        .select('firstName lastName email')
        .lean();
      const authorName = quotedAuthor
        ? ([quotedAuthor.firstName, quotedAuthor.lastName].filter(Boolean).join(' ').trim()
          || quotedAuthor.email
          || 'Someone')
        : 'Someone';
      const { humanizeInternalChatMentions } = require('../utils/internalChatMentions');
      let preview = stripHtmlToPlain(
        await humanizeInternalChatMentions(organizationId, quoted.body || '')
      ).trim();
      if (!preview && Array.isArray(quoted.attachments) && quoted.attachments.length) {
        preview = quoted.attachments[0].fileName || 'Attachment';
      }
      quote = {
        messageId: quoted._id,
        authorId: quoted.authorId || null,
        authorName: String(authorName).slice(0, 120),
        bodyPreview: String(preview).slice(0, 280),
      };
    }
  }

  let { userIds: mentions, mentionAll } = parseMentionsFromBody(text, mentionUserIds);
  if (mentions.length) {
    const mentionUsers = await User.find({
      _id: { $in: mentions },
      ...internalTeammateFilter(organizationId),
    })
      .select('_id')
      .lean();
    const allowed = new Set(mentionUsers.map((u) => String(u._id)));
    mentions = mentions.filter((id) => allowed.has(String(id)));
  }

  const memberIds = await listMemberUserIds(organizationId, spaceId);
  if (mentionAll) {
    const memberMentionIds = memberIds
      .map((id) => String(id))
      .filter((id) => id !== String(user._id));
    mentions = [...new Set([...mentions.map(String), ...memberMentionIds])];
  }
  const safeRefs = Array.isArray(recordRefs)
    ? recordRefs
      .filter((r) => r?.moduleKey && mongoose.Types.ObjectId.isValid(r.recordId))
      .slice(0, 10)
      .map((r) => ({
        moduleKey: normalizeModuleKey(r.moduleKey),
        recordId: r.recordId,
        label: String(r.label || '').slice(0, 200),
      }))
    : [];

  const message = await InternalChatMessage.create({
    organizationId,
    spaceId,
    threadRootId: rootId,
    authorId: user._id,
    body: text,
    quote,
    attachments: safeAttachments,
    mentionUserIds: mentions,
    recordRefs: safeRefs,
  });

  await InternalChatSpace.updateOne(
    { _id: spaceId, organizationId },
    { $set: { lastMessageAt: message.createdAt } }
  );

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    {
      $set: {
        lastReadAt: message.createdAt,
        lastReadMessageId: message._id,
      },
    }
  );

  const author = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar || '',
  };

  const payload = {
    type: 'message.created',
    spaceId: String(spaceId),
    threadRootId: rootId ? String(rootId) : null,
    message: {
      ...message.toObject(),
      author,
    },
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);

  const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.email
    || 'Someone';
  const { humanizeInternalChatMentions } = require('../utils/internalChatMentions');
  const preview = (await humanizeInternalChatMentions(organizationId, text)).slice(0, 140);
  const spaceName = space.name || space.type || 'chat';

  try {
    const { emitNotification } = require('./notificationEngine');
    const domainEvents = require('../constants/domainEvents');
    const mentionTargets = mentions.filter((id) => String(id) !== String(user._id));
    if (mentionTargets.length) {
      await emitNotification({
        eventType: domainEvents.INTERNAL_CHAT_MENTIONED,
        entity: {
          type: 'InternalChatMessage',
          id: String(message._id),
          title: spaceName,
          spaceName,
          spaceId: String(spaceId),
          authorName,
          preview,
          alertRecipientUserIds: mentionTargets,
          mentionAll: Boolean(mentionAll),
          threadRootId: rootId ? String(rootId) : undefined,
        },
        organizationId,
        triggeredBy: user._id,
        sourceAppKey: 'PLATFORM',
      });
    }

    // DMs/group DMs always notify; channels/records when tenant enables notifyChannelMessages.
    // Skip members already covered by @mention / @all. Skip muted members for non-mention posts.
    const mentionSet = new Set(mentionTargets.map(String));
    let otherMembers = memberIds.filter(
      (id) => String(id) !== String(user._id) && !mentionSet.has(String(id))
    );
    const mutedOtherIds = await listMutedUserIds(organizationId, spaceId, otherMembers);
    otherMembers = otherMembers.filter((id) => !mutedOtherIds.has(String(id)));
    const addonSettings = await getAddonSettings(organizationId);
    const notifySpaceMembers = (
      space.type === 'dm'
      || space.type === 'group_dm'
      || (
        (space.type === 'channel' || space.type === 'record')
        && addonSettings.notifyChannelMessages === true
      )
    );
    if (otherMembers.length && notifySpaceMembers) {
      await emitNotification({
        eventType: domainEvents.INTERNAL_CHAT_MESSAGE_POSTED,
        entity: {
          type: 'InternalChatMessage',
          id: String(message._id),
          title: spaceName,
          spaceName,
          spaceId: String(spaceId),
          authorName,
          preview,
          memberUserIds: otherMembers,
          threadRootId: rootId ? String(rootId) : undefined,
        },
        organizationId,
        triggeredBy: user._id,
        sourceAppKey: 'PLATFORM',
      });
    }
  } catch (notifyErr) {
    console.error('[internalChatService] notification emit failed', notifyErr.message);
  }

  try {
    const { emit } = require('./domainEvents');
    emit({
      entityType: 'internal_chat_message',
      entityId: message._id,
      eventType: 'internal_chat_message.created',
      previousState: null,
      currentState: {
        spaceId: String(spaceId),
        threadRootId: rootId ? String(rootId) : null,
        bodyPreview: preview,
      },
      appKey: 'PLATFORM',
      triggeredBy: user._id,
      organizationId,
    });
  } catch (emitErr) {
    console.error('[internalChatService] domain event emit failed', emitErr.message);
  }

  for (const mentionId of mentions) {
    if (String(mentionId) === String(user._id)) continue;
    internalChatSSEHub.publishToUser(organizationId, mentionId, {
      type: 'mention',
      spaceId: String(spaceId),
      messageId: String(message._id),
    });
  }

  return payload.message;
}

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && (row.url || row.storagePath) && row.fileName)
    .slice(0, 5)
    .map((row) => ({
      fileName: String(row.fileName).slice(0, 255),
      mimeType: String(row.mimeType || '').slice(0, 120),
      size: Number(row.size) || 0,
      url: String(row.url || '').slice(0, 2000),
      storagePath: String(row.storagePath || '').slice(0, 2000),
    }));
}

function isAttachmentImageMeta(att) {
  const mime = String(att?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = String(att?.fileName || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i.test(name);
}

/** Images and documents must not be mixed on one message. */
function assertHomogeneousAttachments(attachments) {
  if (!attachments || attachments.length <= 1) return;
  const kinds = new Set(attachments.map((a) => (isAttachmentImageMeta(a) ? 'image' : 'file')));
  if (kinds.size > 1) {
    throw ServiceError(
      'Cannot mix images and documents in one message',
      400,
      'INTERNAL_CHAT_MIXED_ATTACHMENTS'
    );
  }
}

function normalizeReactionEmoji(value) {
  const emoji = String(value || '').trim();
  if (!emoji || emoji.length > 16) return null;
  return emoji;
}

function summarizeReactions(reactions, currentUserId) {
  const currentUserIdString = String(currentUserId || '');
  return (Array.isArray(reactions) ? reactions : [])
    .map((reaction) => {
      const emoji = normalizeReactionEmoji(reaction?.emoji);
      if (!emoji) return null;
      const users = Array.isArray(reaction.users) ? reaction.users : [];
      const userIds = users.map((u) => String(u?._id || u));
      return {
        emoji,
        count: userIds.length,
        reacted: userIds.includes(currentUserIdString),
        userIds,
      };
    })
    .filter((r) => r && r.count > 0);
}

async function toggleReaction({ organizationId, user, spaceId, messageId, emoji: rawEmoji }) {
  const emoji = normalizeReactionEmoji(rawEmoji);
  if (!emoji) {
    throw ServiceError('Invalid emoji', 400, 'INTERNAL_CHAT_INVALID_EMOJI');
  }

  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const message = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }
  if (message.kind === 'system') {
    throw ServiceError('Cannot react to system messages', 400, 'INTERNAL_CHAT_REACT_SYSTEM');
  }

  if (!Array.isArray(message.reactions)) message.reactions = [];
  let reaction = message.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);
  const currentUserId = String(user._id);

  if (!reaction) {
    message.reactions.push({ emoji, users: [user._id] });
  } else {
    const userIndex = reaction.users.findIndex((uid) => String(uid) === currentUserId);
    if (userIndex >= 0) {
      reaction.users.splice(userIndex, 1);
    } else {
      reaction.users.push(user._id);
    }
    if (!reaction.users.length) {
      message.reactions = message.reactions.filter(
        (entry) => normalizeReactionEmoji(entry?.emoji) !== emoji
      );
    }
  }

  message.markModified('reactions');
  await message.save();

  const summarized = summarizeReactions(message.reactions, user._id);
  const payload = {
    type: 'message.updated',
    spaceId: String(spaceId),
    messageId: String(message._id),
    reactions: summarized,
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);
  return { messageId: message._id, reactions: summarized };
}

async function searchMessages({ organizationId, user, q, spaceId = null, limit = 30 }) {
  const queryText = String(q || '').trim();
  if (queryText.length < 2) {
    throw ServiceError('Search query too short', 400, 'INTERNAL_CHAT_SEARCH_SHORT');
  }

  const memberships = await InternalChatMembership.find({
    organizationId,
    userId: user._id,
  })
    .select('spaceId')
    .lean();
  let spaceIds = memberships.map((m) => m.spaceId);
  if (spaceId) {
    if (!spaceIds.some((id) => String(id) === String(spaceId))) {
      throw ServiceError('Not a member of this space', 403, 'INTERNAL_CHAT_NOT_MEMBER');
    }
    spaceIds = [spaceId];
  }
  if (!spaceIds.length) return { results: [] };

  const take = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexFilter = {
    organizationId,
    spaceId: { $in: spaceIds },
    deletedAt: null,
    body: { $regex: escaped, $options: 'i' },
  };

  let messages;
  try {
    messages = await InternalChatMessage.find({
      organizationId,
      spaceId: { $in: spaceIds },
      deletedAt: null,
      $text: { $search: queryText },
    })
      .select({ score: { $meta: 'textScore' }, body: 1, spaceId: 1, authorId: 1, createdAt: 1, threadRootId: 1 })
      .sort({ score: { $meta: 'textScore' } })
      .limit(take)
      .lean();
  } catch {
    messages = [];
  }

  // Text index stop-words (e.g. "about") return empty without error — fall back to regex
  if (!messages.length) {
    messages = await InternalChatMessage.find(regexFilter)
      .select('body spaceId authorId createdAt threadRootId')
      .sort({ createdAt: -1 })
      .limit(take)
      .lean();
  }

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  const spaceDocs = await InternalChatSpace.find({ _id: { $in: spaceIds } })
    .select('_id name type moduleKey')
    .lean();
  const spaceById = new Map(spaceDocs.map((s) => [String(s._id), s]));

  return {
    results: messages.map((m) => ({
      ...m,
      author: authorById.get(String(m.authorId)) || null,
      space: spaceById.get(String(m.spaceId)) || null,
    })),
  };
}

async function publishTyping({ organizationId, user, spaceId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Someone';
  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'typing',
    spaceId: String(spaceId),
    userId: String(user._id),
    name,
    at: Date.now(),
  });
  return { ok: true };
}

async function setSpacePresence({ organizationId, user, spaceId }) {
  if (spaceId) {
    await assertMembership(organizationId, user._id, spaceId);
    const space = await getSpaceOrThrow(organizationId, spaceId);
    await assertCanAccessSpace(user, space);
  }
  internalChatSSEHub.setPresence(organizationId, user._id, spaceId || null, user);
  if (spaceId) {
    const viewers = internalChatSSEHub.getPresenceForSpace(organizationId, spaceId);
    await publishToSpaceMembers(organizationId, spaceId, {
      type: 'presence',
      spaceId: String(spaceId),
      viewers,
    });
    return { viewers };
  }
  return { viewers: [] };
}

async function markRead({ organizationId, user, spaceId, messageId = null }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  let lastReadAt = new Date();
  let lastReadMessageId = null;

  if (messageId && mongoose.Types.ObjectId.isValid(messageId)) {
    const msg = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: messageId,
      deletedAt: null,
    })
      .select('_id createdAt')
      .lean();
    if (msg) {
      lastReadAt = msg.createdAt;
      lastReadMessageId = msg._id;
    }
  } else {
    const latest = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .select('_id createdAt')
      .lean();
    if (latest) {
      lastReadAt = latest.createdAt;
      lastReadMessageId = latest._id;
    }
  }

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    { $set: { lastReadAt, lastReadMessageId, forceUnread: false } }
  );

  const readPayload = {
    type: 'read.updated',
    spaceId: String(spaceId),
    userId: String(user._id),
    lastReadAt,
    lastReadMessageId: lastReadMessageId ? String(lastReadMessageId) : null,
  };
  await publishToSpaceMembers(organizationId, spaceId, readPayload);

  return readPayload;
}

async function createOrGetGroupDm({ organizationId, user, memberIds = [] }) {
  const ids = [...new Set([String(user._id), ...memberIds.map(String)])]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length < 3) {
    throw ServiceError('Group DM needs at least 2 other members', 400, 'INTERNAL_CHAT_GROUP_TOO_SMALL');
  }

  const users = await User.find({
    _id: { $in: ids },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id firstName lastName email avatar userType')
    .lean();
  if (users.length !== ids.length || users.some((u) => !isInternalTeamUserDoc(u))) {
    throw ServiceError('One or more users not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  const dmKey = buildDmKey(ids);
  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'group_dm',
    dmKey,
    archivedAt: null,
  }).lean();

  if (!space) {
    const label = users
      .map((u) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'User')
      .slice(0, 4)
      .join(', ');
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'group_dm',
      name: label,
      dmKey,
      isPrivate: true,
      createdBy: user._id,
    });
    for (const mid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(
        organizationId,
        created._id,
        mid,
        mid === String(user._id) ? 'admin' : 'member'
      );
    }
    space = created.toObject();
    await postSystemMessage({
      organizationId,
      spaceId: space._id,
      actorUser: user,
      eventType: 'group_created',
    });
    await publishToSpaceMembers(organizationId, space._id, {
      type: 'space.updated',
      spaceId: String(space._id),
      action: 'created',
    });
  } else {
    for (const mid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(organizationId, space._id, mid);
    }
  }

  return space;
}

/**
 * Per-user pin of a space in the chat list (does not affect other members).
 */
async function setSpacePinned({ organizationId, user, spaceId, pin = true }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const pinnedAt = pin ? new Date() : null;
  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    { $set: { pinnedAt } }
  );

  return { spaceId: String(spaceId), pinnedAt };
}

const MUTE_DURATION_MS = {
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  forever: null,
};

/**
 * Mute / unmute notifications for a space. durationKey: 1h | 8h | 24h | forever
 */
async function setSpaceMuted({ organizationId, user, spaceId, muted = true, durationKey = 'forever' }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  let mutedUntil = null;
  if (muted) {
    const key = String(durationKey || 'forever');
    if (!(key in MUTE_DURATION_MS)) {
      throw ServiceError('Invalid mute duration', 400, 'INTERNAL_CHAT_MUTE_DURATION');
    }
    const ms = MUTE_DURATION_MS[key];
    mutedUntil = ms == null ? null : new Date(Date.now() + ms);
  }

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    { $set: { muted: Boolean(muted), mutedUntil: muted ? mutedUntil : null } }
  );

  return {
    spaceId: String(spaceId),
    muted: Boolean(muted),
    mutedUntil: muted ? mutedUntil : null,
  };
}

/** Mark a space unread from a message (rewinds lastReadAt to that message). */
async function markSpaceUnread({ organizationId, user, spaceId, messageId = null }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const update = { forceUnread: true };
  if (messageId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw ServiceError('Invalid message', 400, 'INTERNAL_CHAT_INVALID_MESSAGE');
    }
    const message = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: messageId,
    })
      .select('_id createdAt kind deletedAt')
      .lean();
    if (!message || message.deletedAt || message.kind === 'system') {
      throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
    }
    // Unread from this message onward: lastRead sits just before it.
    update.lastReadAt = new Date(new Date(message.createdAt).getTime() - 1);
    update.lastReadMessageId = null;
  }

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    { $set: update }
  );

  return {
    spaceId: String(spaceId),
    forceUnread: true,
    messageId: messageId ? String(messageId) : null,
    lastReadAt: update.lastReadAt || null,
  };
}

async function listMutedUserIds(organizationId, spaceId, userIds = []) {
  const ids = [...new Set(userIds.map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Set();
  const now = new Date();
  const rows = await InternalChatMembership.find({
    organizationId,
    spaceId,
    userId: { $in: ids },
    muted: true,
    $or: [{ mutedUntil: null }, { mutedUntil: { $gt: now } }],
  })
    .select('userId')
    .lean();
  return new Set(rows.map((r) => String(r.userId)));
}

async function pinMessage({ organizationId, user, spaceId, messageId, pin = true }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw ServiceError('Invalid message', 400, 'INTERNAL_CHAT_INVALID_MESSAGE');
  }
  const msg = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  })
    .select('_id kind')
    .lean();
  if (!msg) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }
  if (msg.kind === 'system') {
    throw ServiceError('Cannot pin system messages', 400, 'INTERNAL_CHAT_PIN_SYSTEM');
  }

  const pinned = Array.isArray(space.pinnedMessageIds)
    ? space.pinnedMessageIds.map(String)
    : [];
  let next;
  if (pin) {
    next = [...new Set([String(messageId), ...pinned])].slice(0, 20);
  } else {
    next = pinned.filter((id) => id !== String(messageId));
  }

  await InternalChatSpace.updateOne(
    { _id: spaceId, organizationId },
    { $set: { pinnedMessageIds: next } }
  );

  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'space.updated',
    spaceId: String(spaceId),
    action: pin ? 'pinned' : 'unpinned',
    pinnedMessageIds: next,
  });

  return { pinnedMessageIds: next };
}

async function editMessage({
  organizationId,
  user,
  spaceId,
  messageId,
  body,
  mentionUserIds = [],
}) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw ServiceError('Invalid message', 400, 'INTERNAL_CHAT_INVALID_MESSAGE');
  }

  const message = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }
  if (message.kind === 'system') {
    throw ServiceError('Cannot edit system messages', 403, 'INTERNAL_CHAT_EDIT_SYSTEM');
  }
  if (String(message.authorId) !== String(user._id)) {
    throw ServiceError('Cannot edit this message', 403, 'INTERNAL_CHAT_EDIT_FORBIDDEN');
  }

  const text = normalizeMessageBody(body);
  const plain = stripHtmlToPlain(text);
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
  if (!plain && !hasAttachments) {
    throw ServiceError('Message body or attachment is required', 400, 'INTERNAL_CHAT_EMPTY_BODY');
  }
  if (text.length > 16000) {
    throw ServiceError('Message too long', 400, 'INTERNAL_CHAT_BODY_TOO_LONG');
  }

  let { userIds: mentions, mentionAll } = parseMentionsFromBody(text, mentionUserIds);
  if (mentions.length) {
    const mentionUsers = await User.find({
      _id: { $in: mentions },
      ...internalTeammateFilter(organizationId),
    })
      .select('_id')
      .lean();
    const allowed = new Set(mentionUsers.map((u) => String(u._id)));
    mentions = mentions.filter((id) => allowed.has(String(id)));
  }
  if (mentionAll) {
    const memberIds = await listMemberUserIds(organizationId, spaceId);
    const memberMentionIds = memberIds
      .map((id) => String(id))
      .filter((id) => id !== String(user._id));
    mentions = [...new Set([...mentions.map(String), ...memberMentionIds])];
  }

  message.body = text;
  message.mentionUserIds = mentions;
  message.editedAt = new Date();
  await message.save();

  const author = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar || '',
  };

  const payload = {
    type: 'message.updated',
    spaceId: String(spaceId),
    messageId: String(message._id),
    body: message.body,
    editedAt: message.editedAt,
    mentionUserIds: mentions.map(String),
    reactions: summarizeReactions(message.reactions, user._id),
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);

  return {
    ...message.toObject(),
    author,
    reactions: payload.reactions,
  };
}

async function softDeleteMessage({ organizationId, user, spaceId, messageId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const message = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }
  if (message.kind === 'system') {
    throw ServiceError('Cannot delete system messages', 403, 'INTERNAL_CHAT_DELETE_SYSTEM');
  }

  const isAuthor = String(message.authorId) === String(user._id);
  if (!isAuthor && !canManageInternalChat(user)) {
    throw ServiceError('Cannot delete this message', 403, 'INTERNAL_CHAT_DELETE_FORBIDDEN');
  }

  message.deletedAt = new Date();
  message.deletedBy = user._id;
  message.body = '';
  message.attachments = [];
  message.quote = null;
  message.reactions = [];
  await message.save();

  const pinned = Array.isArray(space.pinnedMessageIds)
    ? space.pinnedMessageIds.map(String)
    : [];
  if (pinned.includes(String(messageId))) {
    const nextPins = pinned.filter((id) => id !== String(messageId));
    await InternalChatSpace.updateOne(
      { _id: spaceId, organizationId },
      { $set: { pinnedMessageIds: nextPins } }
    );
    await publishToSpaceMembers(organizationId, spaceId, {
      type: 'space.updated',
      spaceId: String(spaceId),
      action: 'unpinned',
      pinnedMessageIds: nextPins,
    });
  }

  const payload = {
    type: 'message.updated',
    spaceId: String(spaceId),
    messageId: String(messageId),
    deletedAt: message.deletedAt,
    deletedBy: String(user._id),
    body: '',
    attachments: [],
    quote: null,
    reactions: [],
    threadRootId: message.threadRootId ? String(message.threadRootId) : null,
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);

  return {
    ok: true,
    message: {
      _id: message._id,
      deletedAt: message.deletedAt,
      deletedBy: user._id,
      body: '',
      attachments: [],
    },
  };
}

async function exportSpaceTranscript({ organizationId, user, spaceId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const messages = await InternalChatMessage.find({
    organizationId,
    spaceId,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  return {
    exportedAt: new Date().toISOString(),
    space: {
      _id: space._id,
      type: space.type,
      name: space.name,
      moduleKey: space.moduleKey,
      recordId: space.recordId,
    },
    messages: messages.map((m) => {
      const a = authorById.get(String(m.authorId));
      return {
        id: m._id,
        createdAt: m.createdAt,
        threadRootId: m.threadRootId,
        body: m.body,
        author: a
          ? {
              id: a._id,
              name: [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email,
              email: a.email,
            }
          : null,
        attachments: m.attachments || [],
        reactions: summarizeReactions(m.reactions, user._id),
      };
    }),
  };
}

async function getAddonSettings(organizationId) {
  const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
  const { ADDON_KEYS } = require('../constants/addonKeys');
  const config = await TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.INTERNAL_CHAT,
  }).lean();
  const settings = config?.settings && typeof config.settings === 'object' ? config.settings : {};
  const seenModeRaw = String(settings.seenReceiptsMode || 'private').toLowerCase();
  const seenReceiptsMode = ['off', 'private', 'on'].includes(seenModeRaw) ? seenModeRaw : 'private';
  return {
    retentionDays: Number.isFinite(Number(settings.retentionDays))
      ? Number(settings.retentionDays)
      : 0,
    notifyChannelMessages: settings.notifyChannelMessages === true,
    seenReceiptsMode,
  };
}

async function listSpaceReadState({ organizationId, user, spaceId }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const settings = await getAddonSettings(organizationId);
  if (settings.seenReceiptsMode === 'off') {
    return { mode: 'off', memberCount: 0, members: [] };
  }

  const memberships = await InternalChatMembership.find({ organizationId, spaceId })
    .select('userId lastReadAt lastReadMessageId muted')
    .lean();
  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const members = memberships.map((m) => {
    const u = byId.get(String(m.userId)) || {};
    return {
      userId: String(m.userId),
      lastReadAt: m.lastReadAt || null,
      lastReadMessageId: m.lastReadMessageId ? String(m.lastReadMessageId) : null,
      muted: m.muted === true,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      avatar: u.avatar || '',
    };
  });

  return {
    mode: settings.seenReceiptsMode,
    memberCount: members.length,
    members,
  };
}

async function updateAddonSettings(organizationId, patch = {}) {
  const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
  const { ADDON_KEYS } = require('../constants/addonKeys');
  const current = await getAddonSettings(organizationId);

  let retentionDays = current.retentionDays;
  if (patch.retentionDays !== undefined) {
    retentionDays = Number(patch.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays < 0) retentionDays = 0;
    if (retentionDays > 3650) retentionDays = 3650;
  }

  let notifyChannelMessages = current.notifyChannelMessages;
  if (patch.notifyChannelMessages !== undefined) {
    notifyChannelMessages = patch.notifyChannelMessages === true;
  }

  let seenReceiptsMode = current.seenReceiptsMode;
  if (patch.seenReceiptsMode !== undefined) {
    const raw = String(patch.seenReceiptsMode || '').toLowerCase();
    seenReceiptsMode = ['off', 'private', 'on'].includes(raw) ? raw : current.seenReceiptsMode;
  }

  const next = {
    retentionDays,
    notifyChannelMessages,
    seenReceiptsMode,
  };

  await TenantAddonConfiguration.findOneAndUpdate(
    { organizationId, addonKey: ADDON_KEYS.INTERNAL_CHAT },
    { $set: { settings: next, enabled: true } },
    { upsert: true, new: true }
  );
  return next;
}

async function listTeammatesForChat({ organizationId, user, limit = 200 }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const take = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const me = String(user._id);
  const rows = await User.find({
    ...internalTeammateFilter(organizationId),
    _id: { $ne: user._id },
  })
    .select('_id firstName lastName email username avatar userType')
    .sort({ firstName: 1, lastName: 1 })
    .limit(take)
    .lean();

  // Hard deny: never return portal/external users even if filter regresses.
  return rows
    .filter((u) => isInternalTeamUserDoc(u) && String(u._id) !== me)
    .map((u) => ({
      _id: u._id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      username: u.username || '',
      avatar: u.avatar || '',
      userType: 'INTERNAL',
    }));
}

module.exports = {
  canViewInternalChat,
  canManageInternalChat,
  ServiceError,
  createChannel,
  createOrGetDm,
  createOrGetGroupDm,
  discussRecord,
  listSpacesForUser,
  joinPublicChannel,
  inviteMembersToChannel,
  listSpaceMembers,
  removeSpaceMember,
  updateChannel,
  listMessages,
  postMessage,
  markRead,
  listSpaceReadState,
  toggleReaction,
  searchMessages,
  publishTyping,
  setSpacePresence,
  setSpacePinned,
  setSpaceMuted,
  markSpaceUnread,
  pinMessage,
  editMessage,
  softDeleteMessage,
  exportSpaceTranscript,
  getAddonSettings,
  updateAddonSettings,
  listTeammatesForChat,
  assertCanViewRecord,
  publishToSpaceMembers,
  normalizeAttachments,
};
