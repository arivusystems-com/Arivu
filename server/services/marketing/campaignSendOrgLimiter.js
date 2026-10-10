'use strict';

const { CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG } = require('./campaignSendConstants');
const { getRedisClient, isRedisConfigured } = require('../../lib/redisClient');

/** @type {Map<string, number>} */
const orgActiveCounts = new Map();
/** @type {Map<string, Array<() => void>>} */
const orgWaitQueues = new Map();

const SLOT_TTL_MS = 30 * 60 * 1000;

async function tryAcquireRedisSlot(client, key, limit, ttlMs = SLOT_TTL_MS) {
  const count = Number(await client.incr(key));
  await client.pExpire(key, ttlMs);
  if (count <= limit) return true;
  await client.decr(key);
  return false;
}

async function releaseRedisSlot(client, key) {
  const count = Number(await client.decr(key));
  if (!Number.isFinite(count) || count <= 0) {
    await client.del(key);
  }
  return count;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function orgKey(organizationId) {
  return `arivu:campaign-send:org:${String(organizationId)}`;
}

async function acquireMemorySlot(organizationId, limit) {
  const key = String(organizationId);
  const active = orgActiveCounts.get(key) || 0;

  if (active < limit) {
    orgActiveCounts.set(key, active + 1);
    return;
  }

  await new Promise((resolve) => {
    const queue = orgWaitQueues.get(key) || [];
    queue.push(resolve);
    orgWaitQueues.set(key, queue);
  });

  return acquireMemorySlot(organizationId, limit);
}

function releaseMemorySlot(organizationId) {
  const key = String(organizationId);
  const active = Math.max(0, (orgActiveCounts.get(key) || 1) - 1);
  orgActiveCounts.set(key, active);

  const queue = orgWaitQueues.get(key) || [];
  if (queue.length === 0) return;

  orgActiveCounts.set(key, active + 1);
  const resume = queue.shift();
  orgWaitQueues.set(key, queue);
  resume();
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} [maxConcurrent]
 */
async function acquireCampaignSendOrgSlot(organizationId, maxConcurrent = CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG) {
  const limit = Math.max(1, Number(maxConcurrent) || CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG);
  if (!isRedisConfigured()) {
    return acquireMemorySlot(organizationId, limit);
  }

  const client = await getRedisClient({ component: 'campaign-send-limit', required: true });
  const key = orgKey(organizationId);
  for (;;) {
    const acquired = await tryAcquireRedisSlot(client, key, limit);
    if (acquired) return;
    await sleep(200);
  }
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function releaseCampaignSendOrgSlot(organizationId) {
  if (!isRedisConfigured()) {
    releaseMemorySlot(organizationId);
    return;
  }

  const client = await getRedisClient({ component: 'campaign-send-limit', required: false });
  if (!client) {
    releaseMemorySlot(organizationId);
    return;
  }
  await releaseRedisSlot(client, orgKey(organizationId));
}

function getCampaignSendOrgLimiterSnapshot() {
  return {
    maxConcurrentPerOrg: CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG,
    backend: isRedisConfigured() ? 'redis' : 'memory',
    activeByOrg: Object.fromEntries(orgActiveCounts.entries()),
    waitingByOrg: Object.fromEntries(
      [...orgWaitQueues.entries()].map(([orgId, queue]) => [orgId, queue.length])
    )
  };
}

module.exports = {
  SLOT_TTL_MS,
  tryAcquireRedisSlot,
  releaseRedisSlot,
  acquireCampaignSendOrgSlot,
  releaseCampaignSendOrgSlot,
  getCampaignSendOrgLimiterSnapshot
};
