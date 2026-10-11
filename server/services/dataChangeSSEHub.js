/**
 * SSE hub for tenant-scoped CRM data change invalidation (list/record freshness).
 */

const MAX_CONNECTIONS_PER_ORG = parseInt(process.env.DATA_CHANGE_SSE_MAX_ORG || '200', 10);
const INACTIVE_CONNECTION_TIMEOUT = 60000;

class DataChangeSSEHub {
  constructor() {
    /** @type {Map<string, { res: object, organizationId: string, userId: string, lastHeartbeat: number }>} */
    this.connections = new Map();
    /** @type {Map<string, Set<string>>} */
    this.connectionsByOrg = new Map();
    this.heartbeatInterval = 25000;
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    this.startHeartbeat();
    this.startCleanupTimer();
  }

  generateConnectionId() {
    return `dc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  subscribe(res, userId, organizationId) {
    const orgIdStr = String(organizationId);
    const orgConnections = this.connectionsByOrg.get(orgIdStr) || new Set();

    if (orgConnections.size >= MAX_CONNECTIONS_PER_ORG) {
      const oldest = Array.from(orgConnections)[0];
      this.unsubscribe(oldest);
    }

    const connectionId = this.generateConnectionId();
    const now = Date.now();
    this.connections.set(connectionId, {
      res,
      userId: String(userId),
      organizationId: orgIdStr,
      lastHeartbeat: now,
    });

    if (!this.connectionsByOrg.has(orgIdStr)) {
      this.connectionsByOrg.set(orgIdStr, new Set());
    }
    this.connectionsByOrg.get(orgIdStr).add(connectionId);

    res.on('close', () => this.unsubscribe(connectionId));
    return connectionId;
  }

  unsubscribe(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const orgSet = this.connectionsByOrg.get(conn.organizationId);
    if (orgSet) {
      orgSet.delete(connectionId);
      if (orgSet.size === 0) this.connectionsByOrg.delete(conn.organizationId);
    }
    this.connections.delete(connectionId);
  }

  publish({ organizationId, payload }) {
    if (!organizationId || !payload) return;

    const orgIdStr = String(organizationId);
    const subscribers = this.connectionsByOrg.get(orgIdStr);
    if (!subscribers || subscribers.size === 0) return;

    const message = `data: ${JSON.stringify(payload)}\n\n`;
    const dead = [];

    for (const connectionId of subscribers) {
      const conn = this.connections.get(connectionId);
      if (!conn) {
        dead.push(connectionId);
        continue;
      }
      try {
        conn.res.write(message);
        conn.lastHeartbeat = Date.now();
      } catch {
        dead.push(connectionId);
      }
    }
    dead.forEach((id) => this.unsubscribe(id));
  }

  sendHeartbeat() {
    const ping = `event: ping\ndata: {"timestamp":${Date.now()}}\n\n`;
    const dead = [];
    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.res.write(ping);
        conn.lastHeartbeat = Date.now();
      } catch {
        dead.push(connectionId);
      }
    }
    dead.forEach((id) => this.unsubscribe(id));
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const dead = [];
    for (const [connectionId, conn] of this.connections.entries()) {
      if (now - conn.lastHeartbeat > INACTIVE_CONNECTION_TIMEOUT) {
        dead.push(connectionId);
      }
    }
    dead.forEach((id) => this.unsubscribe(id));
  }

  startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
    // Created at require time; must not keep scripts, workers, or tests alive on its own.
    this.heartbeatTimer.unref();
  }

  startCleanupTimer() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupInactiveConnections(), 30000);
    this.cleanupTimer.unref();
  }

  shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const conn of this.connections.values()) {
      try { conn.res.end(); } catch { /* ignore */ }
    }
    this.connections.clear();
    this.connectionsByOrg.clear();
  }
}

module.exports = new DataChangeSSEHub();
