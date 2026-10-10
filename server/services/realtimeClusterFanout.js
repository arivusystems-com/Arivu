'use strict';

/**
 * Cross-instance fan-out for inbox, data-change, and internal chat SSE.
 * The process that emits publishes locally and on Redis. Other API processes
 * apply the message to their local hubs. The origin instance id is skipped.
 */

const { createClient } = require('redis');
const {
  buildRedisUrl,
  defaultReconnectStrategy,
  forceCloseClient,
  getRedisClient,
  isRedisConfigured,
  registerManagedClient,
} = require('../lib/redisClient');

const CHANNELS = Object.freeze({
  inbox: 'arivu:inbox:sse',
  dataChange: 'arivu:data-change:sse',
  internalChat: 'arivu:internal-chat:sse',
  telephony: 'arivu:telephony:sse',
});

const INSTANCE_ID = `inst_${process.pid}_${Date.now()}`;

let subscriberClient = null;
let subscriberStarted = false;

async function publishCluster(channel, envelope) {
  if (!channel || !envelope || !isRedisConfigured()) return false;
  try {
    const pub = await getRedisClient({ component: 'realtime-fanout' });
    if (!pub) return false;
    await pub.publish(channel, JSON.stringify({ ...envelope, originInstanceId: INSTANCE_ID }));
    return true;
  } catch (err) {
    console.error('[realtimeClusterFanout] publish failed:', err.message);
    return false;
  }
}

function applyClusterMessage(channel, message) {
  let envelope;
  try {
    envelope = JSON.parse(message);
  } catch (err) {
    console.error('[realtimeClusterFanout] message parse failed:', err.message);
    return;
  }
  if (!envelope || envelope.originInstanceId === INSTANCE_ID) return;

  if (channel === CHANNELS.inbox) {
    const inboxSSEHub = require('./inboxSSEHub');
    if (envelope.kind === 'org') {
      inboxSSEHub.publishToOrganization(envelope.organizationId, envelope.payload);
      return;
    }
    if (envelope.kind === 'users' && Array.isArray(envelope.userIds)) {
      for (const userId of envelope.userIds) {
        inboxSSEHub.publishToUser(envelope.organizationId, userId, envelope.payload);
      }
    }
    return;
  }

  if (channel === CHANNELS.dataChange) {
    const dataChangeSSEHub = require('./dataChangeSSEHub');
    dataChangeSSEHub.publish({
      organizationId: envelope.organizationId,
      payload: envelope.payload,
    });
    return;
  }

  if (channel === CHANNELS.internalChat) {
    const internalChatSSEHub = require('./internalChatSSEHub');
    if (envelope.kind === 'users' && Array.isArray(envelope.userIds)) {
      internalChatSSEHub.publishToUsers(
        envelope.organizationId,
        envelope.userIds,
        envelope.payload,
        { fromCluster: true }
      );
      return;
    }
    internalChatSSEHub.publishToUser(
      envelope.organizationId,
      envelope.userId,
      envelope.payload,
      { fromCluster: true }
    );
    return;
  }

  if (channel === CHANNELS.telephony && envelope.kind === 'org') {
    const telephonySSEHub = require('./telephony/telephonySSEHub');
    telephonySSEHub.publishToOrg(envelope.organizationId, envelope.payload, { fromCluster: true });
  }
}

async function startRealtimeClusterSubscriber() {
  if (subscriberStarted || !isRedisConfigured()) return;
  subscriberStarted = true;

  const url = buildRedisUrl();
  subscriberClient = createClient({
    url,
    socket: {
      reconnectStrategy: defaultReconnectStrategy,
    },
  });
  registerManagedClient(subscriberClient);
  subscriberClient.on('error', (err) => {
    console.error('[realtimeClusterFanout] subscriber error:', err.message);
  });

  await subscriberClient.connect();
  for (const channel of Object.values(CHANNELS)) {
    await subscriberClient.subscribe(channel, (message) => {
      applyClusterMessage(channel, message);
    });
  }
  console.log('[realtimeClusterFanout] Subscribed to inbox, data-change, internal chat, and telephony');
}

async function stopRealtimeClusterSubscriber() {
  subscriberStarted = false;
  const sub = subscriberClient;
  subscriberClient = null;
  if (sub) await forceCloseClient(sub);
}

module.exports = {
  CHANNELS,
  INSTANCE_ID,
  publishCluster,
  applyClusterMessage,
  startRealtimeClusterSubscriber,
  stopRealtimeClusterSubscriber,
};
