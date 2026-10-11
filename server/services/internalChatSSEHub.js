'use strict';

/**
 * SSE hub for internal chat realtime events.
 * Best-effort, in-memory — clients may poll as fallback.
 *
 * Event types: message.created | message.updated | message.deleted |
 * membership.updated | space.updated | typing | presence | unread.bump |
 * read.updated
 * (message.updated carries reactions and/or body+editedAt for edits)
 */

const { INTERNAL_CHAT_SSE_EVENT } = require('../constants/internalChatConstants');

const INTERNAL_CHAT_SSE_DEBUG = process.env.INTERNAL_CHAT_SSE_DEBUG === 'true';
const MAX_CONNECTIONS_PER_USER = parseInt(
  process.env.MAX_INTERNAL_CHAT_SSE_CONNECTIONS_PER_USER || '2',
  10
);
const MAX_CONNECTIONS_PER_ORG = parseInt(
  process.env.MAX_INTERNAL_CHAT_SSE_CONNECTIONS_PER_ORG || '500',
  10
);
const INACTIVE_CONNECTION_TIMEOUT = 60000;

function debugLog(event, data) {
  if (INTERNAL_CHAT_SSE_DEBUG) {
    console.log(`[internalChatSSEHub:${event}]`, JSON.stringify(data));
  }
}

class InternalChatSSEHub {
  constructor() {
    this.connections = new Map();
    this.subscribersByKey = new Map();
    this.connectionsByOrg = new Map();
    this.heartbeatInterval = 25000;
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    this.startedAt = Date.now();
    this.startHeartbeat();
    this.startCleanupTimer();
  }

  generateConnectionId() {
    return `internal_chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  getSubscriberKey(userId, organizationId) {
    return `${String(organizationId)}_${String(userId)}`;
  }

  subscribe(res, userId, organizationId) {
    const connectionId = this.generateConnectionId();
    const key = this.getSubscriberKey(userId, organizationId);
    const orgIdStr = String(organizationId);

    const userConnections = this.subscribersByKey.get(key) || new Set();
    if (userConnections.size >= MAX_CONNECTIONS_PER_USER) {
      this.unsubscribe(Array.from(userConnections)[0]);
    }

    const orgConnections = this.connectionsByOrg.get(orgIdStr) || new Set();
    if (orgConnections.size >= MAX_CONNECTIONS_PER_ORG) {
      this.unsubscribe(Array.from(orgConnections)[0]);
    }

    const now = Date.now();
    this.connections.set(connectionId, {
      res,
      userId: String(userId),
      organizationId: orgIdStr,
      lastHeartbeat: now,
      createdAt: now,
      presenceSpaceId: null,
    });

    if (!this.subscribersByKey.has(key)) {
      this.subscribersByKey.set(key, new Set());
    }
    this.subscribersByKey.get(key).add(connectionId);

    if (!this.connectionsByOrg.has(orgIdStr)) {
      this.connectionsByOrg.set(orgIdStr, new Set());
    }
    this.connectionsByOrg.get(orgIdStr).add(connectionId);

    res.on('close', () => this.unsubscribe(connectionId));

    debugLog('connect', { connectionId, userId: String(userId), organizationId: orgIdStr });
    return connectionId;
  }

  /**
   * Track which space a user is currently viewing (presence).
   * @param {string} organizationId
   * @param {string} userId
   * @param {string|null} spaceId
   * @param {{ firstName?: string, lastName?: string, email?: string }} [user]
   */
  setPresence(organizationId, userId, spaceId, user = {}) {
    const key = this.getSubscriberKey(userId, organizationId);
    const connectionIds = this.subscribersByKey.get(key);
    if (!connectionIds) return;

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email
      || String(userId);

    for (const connectionId of connectionIds) {
      const conn = this.connections.get(connectionId);
      if (!conn) continue;
      conn.presenceSpaceId = spaceId ? String(spaceId) : null;
      conn.presenceName = displayName;
      conn.presenceAvatar = user.avatar || '';
      conn.presenceFirstName = user.firstName || '';
      conn.presenceLastName = user.lastName || '';
      conn.presenceEmail = user.email || '';
      conn.presenceAt = Date.now();
    }
  }

  getPresenceForSpace(organizationId, spaceId) {
    const orgIdStr = String(organizationId);
    const spaceIdStr = String(spaceId);
    const byUser = new Map();
    const now = Date.now();
    for (const conn of this.connections.values()) {
      if (conn.organizationId !== orgIdStr) continue;
      if (conn.presenceSpaceId !== spaceIdStr) continue;
      if (now - (conn.presenceAt || 0) > 120000) continue;
      byUser.set(conn.userId, {
        userId: conn.userId,
        name: conn.presenceName || conn.userId,
        avatar: conn.presenceAvatar || '',
        firstName: conn.presenceFirstName || '',
        lastName: conn.presenceLastName || '',
        email: conn.presenceEmail || '',
        at: conn.presenceAt,
      });
    }
    return Array.from(byUser.values());
  }

  unsubscribe(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const key = this.getSubscriberKey(conn.userId, conn.organizationId);
    const orgIdStr = conn.organizationId;

    const subscribers = this.subscribersByKey.get(key);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) this.subscribersByKey.delete(key);
    }

    const orgConnections = this.connectionsByOrg.get(orgIdStr);
    if (orgConnections) {
      orgConnections.delete(connectionId);
      if (orgConnections.size === 0) this.connectionsByOrg.delete(orgIdStr);
    }

    this.connections.delete(connectionId);

    // End the response so the browser EventSource errors and reconnects
    // instead of sitting on a zombie socket the hub no longer writes to.
    try {
      if (!conn.res.writableEnded) conn.res.end();
    } catch {
      /* ignore */
    }
  }

  _write(conn, payload) {
    const message = `event: ${INTERNAL_CHAT_SSE_EVENT}\ndata: ${JSON.stringify(payload)}\n\n`;
    conn.res.write(message);
    if (typeof conn.res.flush === 'function') conn.res.flush();
    conn.lastHeartbeat = Date.now();
  }

  publishToUser(organizationId, userId, payload, options = {}) {
    if (!organizationId || !userId || !payload) return 0;
    const key = this.getSubscriberKey(userId, organizationId);
    const subscribers = this.subscribersByKey.get(key);

    let delivered = 0;
    const dead = [];
    for (const connectionId of subscribers || []) {
      const conn = this.connections.get(connectionId);
      if (!conn) {
        dead.push(connectionId);
        continue;
      }
      try {
        this._write(conn, payload);
        delivered += 1;
      } catch {
        dead.push(connectionId);
      }
    }
    dead.forEach((id) => this.unsubscribe(id));
    if (!options.fromCluster && !options.skipCluster) {
      const { CHANNELS, publishCluster } = require('./realtimeClusterFanout');
      void publishCluster(CHANNELS.internalChat, {
        kind: 'user',
        organizationId: String(organizationId),
        userId: String(userId),
        payload,
      });
    }
    return delivered;
  }

  /**
   * Fan-out to multiple members (e.g. after message create).
   * @param {string|import('mongoose').Types.ObjectId} organizationId
   * @param {Array<string|import('mongoose').Types.ObjectId>} userIds
   * @param {object} payload
   * @param {{ fromCluster?: boolean }} [options]
   */
  publishToUsers(organizationId, userIds, payload, options = {}) {
    if (!organizationId || !payload || !Array.isArray(userIds)) return 0;
    let delivered = 0;
    const seen = new Set();
    for (const userId of userIds) {
      const id = String(userId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      delivered += this.publishToUser(organizationId, id, payload, { skipCluster: true });
    }
    if (!options.fromCluster) {
      const { CHANNELS, publishCluster } = require('./realtimeClusterFanout');
      void publishCluster(CHANNELS.internalChat, {
        kind: 'users',
        organizationId: String(organizationId),
        userIds: [...seen],
        payload,
      });
    }
    return delivered;
  }

  sendHeartbeat() {
    const ping = `event: ping\ndata: {"timestamp":${Date.now()}}\n\n`;
    const dead = [];
    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.res.write(ping);
        if (typeof conn.res.flush === 'function') conn.res.flush();
        conn.lastHeartbeat = Date.now();
      } catch {
        dead.push(connectionId);
      }
    }
    dead.forEach((id) => this.unsubscribe(id));
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    for (const [connectionId, conn] of this.connections.entries()) {
      if (now - conn.lastHeartbeat > INACTIVE_CONNECTION_TIMEOUT) {
        this.unsubscribe(connectionId);
      }
    }
  }

  startCleanupTimer() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupInactiveConnections(), 30000);
    // Created at require time; must not keep scripts, workers, or tests alive on its own.
    this.cleanupTimer.unref();
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
    this.heartbeatTimer.unref();
  }

  shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const conn of this.connections.values()) {
      try {
        conn.res.end();
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    this.subscribersByKey.clear();
    this.connectionsByOrg.clear();
  }

  getHealthStats() {
    return {
      total: this.connections.size,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}

module.exports = new InternalChatSSEHub();
