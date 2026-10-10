'use strict';

/**
 * Emit inbox refresh signals to connected SSE clients (R3).
 */

const Mailbox = require('../models/Mailbox');
const User = require('../models/User');
const inboxSSEHub = require('./inboxSSEHub');
const { canUserAccessMailboxThreads } = require('./mailboxAccessService');
const { CHANNELS, publishCluster } = require('./realtimeClusterFanout');

/**
 * Notify clients that workspace inbox data may have changed.
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.organizationId
 * @param {string|import('mongoose').Types.ObjectId|null} [params.mailboxId]
 * @param {'sync'|'inbound'|'outbound'|'manual'} [params.reason]
 * @param {object} [params.meta]
 */
async function emitInboxUpdated({ organizationId, mailboxId = null, reason = 'sync', meta = {} }) {
  if (!organizationId) return { delivered: 0 };

  const payload = {
    type: 'inbox:updated',
    mailboxId: mailboxId ? String(mailboxId) : null,
    reason,
    at: Date.now(),
    ...meta
  };

  try {
    if (mailboxId) {
      const delivered = await emitToMailboxSubscribers(organizationId, mailboxId, payload);
      return { delivered };
    }
    const delivered = inboxSSEHub.publishToOrganization(organizationId, payload);
    await publishCluster(CHANNELS.inbox, {
      kind: 'org',
      organizationId: String(organizationId),
      payload,
    });
    return { delivered };
  } catch (err) {
    console.warn('[inboxRealtime] emitInboxUpdated failed:', err.message);
    return { delivered: 0 };
  }
}

async function emitToMailboxSubscribers(organizationId, mailboxId, payload) {
  const mb = await Mailbox.findOne({ _id: mailboxId, organizationId }).lean();
  if (!mb) {
    return inboxSSEHub.publishToOrganization(organizationId, payload);
  }

  const users = await User.find({ organizationId }).select('_id role isOwner').lean();
  const userIds = [];
  let delivered = 0;
  for (const user of users) {
    if (!canUserAccessMailboxThreads(user, mb)) continue;
    userIds.push(String(user._id));
    delivered += inboxSSEHub.publishToUser(organizationId, user._id, payload);
  }
  await publishCluster(CHANNELS.inbox, {
    kind: 'users',
    organizationId: String(organizationId),
    userIds,
    payload,
  });
  return delivered;
}

module.exports = {
  emitInboxUpdated,
  emitToMailboxSubscribers
};
