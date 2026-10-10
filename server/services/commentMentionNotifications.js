/**
 * Notify users and group members when they are @mentioned in a task comment.
 * Parses content for @[Name](user:id), @[Name](group:id), and @[all](all:all),
 * creates in-app notifications, publishes to SSE, and sends email.
 */

const mongoose = require('mongoose');
const Group = require('../models/Group');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Event = require('../models/Event');
const People = require('../models/People');
const Organization = require('../models/Organization');
const { getScopedUserModel } = require('./userInviteService');
const { escapeHtml } = require('../utils/appointmentEmailUtils');
// Same format as CommentContent.vue and CommentInput.vue
const MENTION_REGEX = /@\[([^\]]+)\]\((user|group|all):([^)]+)\)/g;
const EMAIL_COMMENT_MAX_CHARS = 2000;

const MODULE_KEY_TO_ENTITY_TYPE = {
  deals: 'Deal',
  tasks: 'Task',
  events: 'Event',
  people: 'People',
  organizations: 'Organization',
  items: 'Item',
  quotes: 'Quote',
  sales_orders: 'SalesOrder',
  cases: 'Case'
};

const ENTITY_BODY_LABEL = {
  Task: 'Task',
  Deal: 'Deal',
  Event: 'Event',
  People: 'Contact',
  Organization: 'Organization',
  Item: 'Item',
  Quote: 'Quote',
  SalesOrder: 'Sales order',
  Case: 'Case'
};

const MODULE_KEY_TO_PATH = {
  deals: 'deals',
  tasks: 'tasks',
  events: 'events',
  people: 'people',
  organizations: 'organizations',
  items: 'items',
  quotes: 'quotes',
  sales_orders: 'sales-orders',
  cases: 'helpdesk/cases'
};

const ENTITY_TYPE_TO_PATH = {
  Deal: 'deals',
  Task: 'tasks',
  Event: 'events',
  People: 'people',
  Organization: 'organizations',
  Item: 'items',
  Quote: 'quotes',
  SalesOrder: 'sales-orders',
  Case: 'helpdesk/cases'
};

function moduleKeyToEntityType(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (MODULE_KEY_TO_ENTITY_TYPE[key]) return MODULE_KEY_TO_ENTITY_TYPE[key];
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Absolute client URL for a record (email deep link).
 */
function buildRecordDeepLink({ moduleKey, entityType, entityId }) {
  if (!entityId) return null;
  const { resolveClientUrl } = require('../utils/clientUrl');
  const baseUrl = resolveClientUrl();
  const key = String(moduleKey || '').toLowerCase();
  const pathPrefix =
    MODULE_KEY_TO_PATH[key] ||
    ENTITY_TYPE_TO_PATH[entityType] ||
    null;
  if (!pathPrefix) return null;
  return `${baseUrl}/${pathPrefix}/${entityId}`;
}

async function resolveRecordTitle(organizationId, moduleKey, recordId) {
  if (!organizationId || !moduleKey || !recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
    return null;
  }
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const id = new mongoose.Types.ObjectId(recordId);
  const key = String(moduleKey || '').toLowerCase();

  try {
    if (key === 'deals') {
      const doc = await Deal.findOne({ _id: id, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    if (key === 'tasks') {
      const doc = await Task.findOne({ _id: id, organizationId: orgId }).select('title').lean();
      return doc?.title || null;
    }
    if (key === 'events') {
      const doc = await Event.findOne({ _id: id, organizationId: orgId }).select('eventName').lean();
      return doc?.eventName || null;
    }
    if (key === 'people') {
      const doc = await People.findOne({ _id: id, organizationId: orgId }).select('first_name last_name email').lean();
      if (!doc) return null;
      const name = [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim();
      return name || doc.email || null;
    }
    if (key === 'organizations') {
      const doc = await Organization.findOne({ _id: id, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    return null;
  } catch (err) {
    console.error('[commentMentionNotifications] resolveRecordTitle error:', err.message);
    return null;
  }
}

/**
 * Parse comment content for @[Name](type:id) mentions.
 * @param {string} content - Raw comment content
 * @returns {{ userIds: Set<string>, groupIds: Set<string>, mentionAll: boolean }}
 */
function parseMentionedIds(content) {
  const userIds = new Set();
  const groupIds = new Set();
  let mentionAll = false;
  if (!content || typeof content !== 'string') return { userIds, groupIds, mentionAll };
  let match;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const type = match[2];
    const id = match[3].trim();
    if (type === 'all') {
      mentionAll = true;
      continue;
    }
    if (!id || !mongoose.Types.ObjectId.isValid(id)) continue;
    if (type === 'user') userIds.add(id);
    else if (type === 'group') groupIds.add(id);
  }
  return { userIds, groupIds, mentionAll };
}

/**
 * Resolve all active users in the tenant instance.
 * @param {string} organizationId
 * @returns {Promise<string[]>}
 */
async function resolveAllOrgUserIds(organizationId) {
  if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) return [];
  const organization = await Organization.findById(organizationId).select('database name').lean();
  const ScopedUser = await getScopedUserModel(organization);
  const scopeQuery =
    organization?.database?.name && organization.database.initialized
      ? {}
      : { organizationId: new mongoose.Types.ObjectId(organizationId) };
  const users = await ScopedUser.find({
    ...scopeQuery,
    status: 'active'
  })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
}

/**
 * Resolve mentioned user IDs and group member IDs (same org) into a single set of recipient user IDs.
 * @param {string} organizationId - Organization ID
 * @param {Set<string>} userIds - Mentioned user IDs
 * @param {Set<string>} groupIds - Mentioned group IDs
 * @param {boolean} [mentionAll=false] - When true, include all active org users
 * @returns {Promise<Set<string>>} All recipient user IDs
 */
async function resolveRecipientUserIds(organizationId, userIds, groupIds, mentionAll = false) {
  const recipientIds = new Set(userIds);

  if (mentionAll) {
    const allIds = await resolveAllOrgUserIds(organizationId);
    allIds.forEach((id) => recipientIds.add(id));
  }

  if (groupIds.size > 0) {
    const groups = await Group.find({
      _id: { $in: Array.from(groupIds) },
      organizationId: new mongoose.Types.ObjectId(organizationId)
    })
      .select('members')
      .lean();
    for (const g of groups) {
      if (g.members && Array.isArray(g.members)) {
        g.members.forEach((id) => recipientIds.add(String(id)));
      }
    }
  }

  return recipientIds;
}

/**
 * Strip mention syntax to plain text for notification body (e.g. "@John" instead of @[John](user:id)).
 * @param {string} content - Comment content with mentions
 * @returns {string} Plain text, mentions as @Name
 */
function contentToPlainSnippet(content) {
  if (!content || typeof content !== 'string') return '';
  MENTION_REGEX.lastIndex = 0;
  return content
    .replace(MENTION_REGEX, '@$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build mention email subject/text/html.
 * Subject: [Mentioning User Name] mentioned you on [Record Name]
 * Record name is a hyperlink when recordUrl is provided.
 */
function buildMentionEmailContent({ authorName, recordName, commentText, recordUrl }) {
  const safeAuthor = String(authorName || 'Someone').trim() || 'Someone';
  const safeRecord = String(recordName || 'a record').trim() || 'a record';
  let plainComment = String(commentText || '').trim();
  if (plainComment.length > EMAIL_COMMENT_MAX_CHARS) {
    plainComment = `${plainComment.slice(0, EMAIL_COMMENT_MAX_CHARS - 3)}...`;
  }

  const subject = `${safeAuthor} mentioned you on ${safeRecord}`;
  const textLines = [
    `You were mentioned by ${safeAuthor} in a comment on ${safeRecord}.`,
    '',
    `"${plainComment}"`
  ];
  if (recordUrl) {
    textLines.push('', `Open record: ${recordUrl}`);
  }
  const text = textLines.join('\n');

  const recordHtml = recordUrl
    ? `<a href="${escapeHtml(recordUrl)}" style="color:#4f46e5;text-decoration:underline;font-weight:700;">${escapeHtml(safeRecord)}</a>`
    : `<strong>${escapeHtml(safeRecord)}</strong>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>You were mentioned by <strong>${escapeHtml(safeAuthor)}</strong> in a comment on ${recordHtml}.</p>
      <p style="margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid #6366f1; color: #334155;">
        “${escapeHtml(plainComment)}”
      </p>
    </body>
    </html>
  `.trim();

  return { subject, text, html };
}

/**
 * Send mention email only when preference email === true (native read, both DBs).
 */
async function sendMentionEmailIfEnabled({
  organizationId,
  userId,
  appKey,
  authorName,
  recordName,
  commentText,
  recordUrl,
  commentId
}) {
  // Hard kill-switch for debugging / emergency: MENTION_EMAIL_FORCE_OFF=true
  if (process.env.MENTION_EMAIL_FORCE_OFF === 'true') {
    console.log('[commentMentionNotifications] Mention email force-off via env');
    return { sent: false, reason: 'force_off' };
  }

  const { isMentionEmailEnabled } = require('./mentionNotificationPreference');
  const { sendAccountEmail } = require('./userAccountEmailService');
  const { getScopedUserModel } = require('./userInviteService');
  const Organization = require('../models/Organization');

  const allowed = await isMentionEmailEnabled(userId, appKey);
  if (!allowed) {
    console.log(
      `[commentMentionNotifications] Mention email BLOCKED (pref email!==true) user=${userId} appKey=${appKey} comment=${commentId}`
    );
    return { sent: false, reason: 'preference_off' };
  }

  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
    return { sent: false, reason: 'email_disabled' };
  }

  const organization = await Organization.findById(organizationId).select('database name').lean();
  const ScopedUser = await getScopedUserModel(organization);
  const scopeQuery =
    organization?.database?.name && organization.database.initialized
      ? {}
      : { organizationId };
  const user = await ScopedUser.findOne({
    ...scopeQuery,
    _id: userId,
    email: { $exists: true, $nin: [null, ''] }
  })
    .select('email')
    .lean();

  if (!user?.email) {
    console.warn(`[commentMentionNotifications] No email for user=${userId}`);
    return { sent: false, reason: 'no_email' };
  }

  const { subject, text, html } = buildMentionEmailContent({
    authorName,
    recordName,
    commentText,
    recordUrl
  });

  const result = await sendAccountEmail({
    organizationId,
    to: user.email,
    subject,
    text,
    html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });

  console.log(
    `[commentMentionNotifications] Mention email result user=${userId} success=${!!result.success} comment=${commentId}`
  );
  return { sent: !!result.success, result };
}

/**
 * Resolve enabled channels for a mention recipient from saved preferences.
 * Email is never returned here — dedicated sendMentionEmailIfEnabled path only.
 */
async function resolveMentionChannelsForUser(userId, appKey) {
  const { resolveMentionChannels } = require('./mentionNotificationPreference');

  // Do NOT call ensureDefaultPreferences here — it can create email:true defaults
  // that fight a user who already turned mention email off.
  const channels = await resolveMentionChannels(userId, appKey);
  console.log(
    `[commentMentionNotifications] Pref user=${userId} appKey=${appKey} → ${channels.join(',') || 'none'}`
  );
  return channels;
}

/**
 * Create mention notifications via notificationEngine (IN_APP / PUSH).
 * Email is sent separately only when preference email is on.
 */
async function notifyMentionedUsers(opts) {
  const {
    organizationId,
    appKey,
    entityId,
    entityType,
    moduleKey,
    recordTitle,
    taskId,
    taskTitle,
    commentId,
    commentContent,
    authorName,
    mentionedUserIds,
    authorId
  } = opts;

  const resolvedEntityId = entityId || taskId;
  const resolvedEntityType = entityType || 'Task';
  const resolvedRecordTitle = recordTitle || taskTitle || null;

  const recipientIds = Array.from(mentionedUserIds).filter((id) => String(id) !== String(authorId));
  if (recipientIds.length === 0 || !resolvedEntityId) return;

  const snippet = contentToPlainSnippet(commentContent);
  const snippetDisplay = snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet;
  const entityLabel = ENTITY_BODY_LABEL[resolvedEntityType] || resolvedEntityType;
  const recordDisplayName = resolvedRecordTitle || entityLabel || 'a record';
  const title = `${authorName} mentioned you on ${recordDisplayName}`;
  const body = `"${snippetDisplay}"`;
  const normalizedAppKey = (appKey || 'SALES').toUpperCase();
  const recordUrl = buildRecordDeepLink({
    moduleKey,
    entityType: resolvedEntityType,
    entityId: resolvedEntityId
  });

  try {
    const domainEvents = require('../constants/domainEvents');
    const { emitNotification } = require('./notificationEngine');
    const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');

    await runWithOrganizationTenantContext(organizationId, async () => {
      for (const userId of recipientIds) {
        const channels = await resolveMentionChannelsForUser(userId, normalizedAppKey);
        // Never pass EMAIL to the engine
        const engineChannels = channels.filter((c) => c !== 'EMAIL');

        if (engineChannels.length) {
          console.log(
            `[commentMentionNotifications] user ${userId} comment ${commentId} engineChannels=${engineChannels.join(',')}`
          );
          await emitNotification({
            eventType: domainEvents.RECORD_COMMENT_MENTION,
            organizationId,
            triggeredBy: authorId,
            sourceAppKey: normalizedAppKey,
            title,
            body,
            channels: engineChannels,
            entity: {
              type: resolvedEntityType,
              id: String(resolvedEntityId),
              title: recordDisplayName,
              authorName: authorName || 'Someone',
              preview: snippetDisplay,
              moduleKey: moduleKey || null,
              mentionedUserIds: [String(userId)]
            }
          });
        } else {
          console.log(
            `[commentMentionNotifications] Skip engine notify user=${userId} comment=${commentId}: no IN_APP/PUSH`
          );
        }

        await sendMentionEmailIfEnabled({
          organizationId,
          userId,
          appKey: normalizedAppKey,
          authorName,
          recordName: recordDisplayName,
          commentText: snippet,
          recordUrl,
          commentId
        });
      }
    });

    console.log(
      `[commentMentionNotifications] Finished RECORD_COMMENT_MENTION for comment ${commentId} (${recipientIds.length} recipient(s))`
    );
  } catch (err) {
    console.error('[commentMentionNotifications] Failed to emit mention notifications:', err);
  }
}

/**
 * Process a new or updated comment: parse mentions, resolve recipients, and send notifications.
 * Call this after saving a comment (fire-and-forget).
 *
 * @param {Object} opts
 * @param {string} opts.organizationId - Organization ID
 * @param {string} [opts.appKey] - App key (default SALES)
 * @param {string} [opts.entityId] - Record ID (alias: taskId)
 * @param {string} [opts.entityType] - Entity type for deep-linking
 * @param {string} [opts.moduleKey] - Module key used to resolve entity type/title
 * @param {string} [opts.recordTitle] - Record title (alias: taskTitle)
 * @param {string} [opts.taskId] - Legacy alias for entityId
 * @param {string} [opts.taskTitle] - Legacy alias for recordTitle
 * @param {string} opts.commentId - Comment ID
 * @param {string} opts.commentContent - Comment content with @[Name](type:id)
 * @param {string} opts.authorId - Comment author user ID
 * @param {string} opts.authorName - Comment author display name
 */
async function processCommentMentions(opts) {
  try {
    const { userIds, groupIds, mentionAll } = parseMentionedIds(opts.commentContent);
    if (userIds.size === 0 && groupIds.size === 0 && !mentionAll) return;

    const mentionedUserIds = await resolveRecipientUserIds(
      opts.organizationId,
      userIds,
      groupIds,
      mentionAll
    );
    if (mentionedUserIds.size === 0) return;

    const entityId = opts.entityId || opts.taskId;
    const entityType = opts.entityType || (opts.moduleKey ? moduleKeyToEntityType(opts.moduleKey) : 'Task');
    let recordTitle = opts.recordTitle || opts.taskTitle || null;
    if (!recordTitle && opts.moduleKey && entityId) {
      recordTitle = await resolveRecordTitle(opts.organizationId, opts.moduleKey, entityId);
    }

    await notifyMentionedUsers({
      organizationId: opts.organizationId,
      appKey: opts.appKey || 'SALES',
      entityId,
      entityType,
      moduleKey: opts.moduleKey,
      recordTitle,
      commentId: opts.commentId,
      commentContent: opts.commentContent,
      authorName: opts.authorName,
      mentionedUserIds,
      authorId: opts.authorId
    });
  } catch (err) {
    console.error('[commentMentionNotifications] processCommentMentions error:', err);
  }
}

module.exports = {
  parseMentionedIds,
  resolveAllOrgUserIds,
  resolveRecipientUserIds,
  contentToPlainSnippet,
  moduleKeyToEntityType,
  resolveRecordTitle,
  buildRecordDeepLink,
  buildMentionEmailContent,
  notifyMentionedUsers,
  processCommentMentions
};
