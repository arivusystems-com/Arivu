'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');

const MENTION_USER_TOKEN_RE = /<@([a-f0-9]{24})>/gi;

function displayNameFromUser(user) {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || '';
}

function bodyHasMentionAll(text) {
  const raw = String(text || '');
  return /<@all>/i.test(raw) || /(^|[\s])@all\b/i.test(raw);
}

function extractMentionUserIds(text) {
  const ids = [];
  const re = /<@([a-f0-9]{24})>/gi;
  let match;
  while ((match = re.exec(String(text || ''))) !== null) {
    if (mongoose.Types.ObjectId.isValid(match[1])) ids.push(match[1]);
  }
  return [...new Set(ids)];
}

/**
 * Replace <@userId> / <@all> tokens with display forms for emails/toasts/previews.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} text
 * @returns {Promise<string>}
 */
async function humanizeInternalChatMentions(organizationId, text) {
  let raw = String(text || '').replace(/<@all>/gi, '@all');
  const ids = extractMentionUserIds(raw);
  if (ids.length && organizationId) {
    const users = await User.find({
      _id: { $in: ids },
      organizationId,
    })
      .select('_id firstName lastName email')
      .lean();

    const map = new Map(
      users.map((u) => [String(u._id), displayNameFromUser(u) || 'someone'])
    );

    raw = raw.replace(MENTION_USER_TOKEN_RE, (_, id) => {
      const label = map.get(String(id));
      return label ? `@${label}` : '@someone';
    });
  }

  if (/<\/?[a-z][\s\S]*>/i.test(raw) || /<@(?:all|[a-f0-9]{24})>/i.test(raw)) {
    raw = raw
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
      .replace(/\s+\n/g, '\n')
      .trim();
  }
  return raw;
}

module.exports = {
  bodyHasMentionAll,
  extractMentionUserIds,
  humanizeInternalChatMentions,
  displayNameFromUser,
};
