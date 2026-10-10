'use strict';

const {
  CAMPAIGN_SEND_QUEUE_NAME,
  CAMPAIGN_SEND_WORKER_CONCURRENCY,
  CAMPAIGN_SEND_RETRY_PROFILE,
  CAMPAIGN_SEND_INLINE_MAX,
  CAMPAIGN_SEND_ALERT_INTERVAL_MS
} = require('./campaignSendConstants');
const { runCampaignSendJob } = require('./campaignSendOrchestrator');
const {
  acquireCampaignSendOrgSlot,
  releaseCampaignSendOrgSlot
} = require('./campaignSendOrgLimiter');
const { assertCampaignSendScaleReady } = require('./campaignSendScaleGuard');
const { recordCampaignSendQueueLag } = require('./campaignSendMetrics');

let campaignSendQueue = null;
/** @type {ReturnType<typeof setInterval>|null} */
let alertMonitorTimer = null;

function getLegacyRedisUrl() {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

function isRedisConfigured() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim() || String(process.env.REDIS_HOST || '').trim()
  );
}

function isCampaignSendWorkerEnabled() {
  return process.env.ENABLE_MARKETING_CAMPAIGN_SEND_WORKER !== 'false';
}

function initQueue() {
  if (campaignSendQueue !== null) return campaignSendQueue;
  if (!isRedisConfigured() || !isCampaignSendWorkerEnabled()) {
    campaignSendQueue = false;
    return false;
  }

  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    const opts = { defaultJobOptions: { ...CAMPAIGN_SEND_RETRY_PROFILE } };
    if (isTls) {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: { rejectUnauthorized: true }
      };
    } else {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      };
    }

    campaignSendQueue = new Bull(CAMPAIGN_SEND_QUEUE_NAME, redisUrl, opts);
    campaignSendQueue.on('error', (err) => {
      console.error('[campaignSendQueue] Redis error:', err.message);
    });
    return campaignSendQueue;
  } catch (err) {
    console.error('[campaignSendQueue] Failed to init:', err.message);
    campaignSendQueue = false;
    return false;
  }
}

function runCampaignSendInline(payload) {
  setImmediate(() => {
    runCampaignSendJob(payload).catch((err) => {
      console.error(
        '[campaignSendQueue] Inline campaign send failed:',
        payload?.campaignId,
        err?.message || err
      );
    });
  });
}

/**
 * @returns {Promise<object>}
 */
async function getCampaignSendQueueState() {
  const queue = initQueue();
  if (!queue) {
    return {
      available: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      oldestWaitingLagMs: 0
    };
  }

  const [waiting, active, delayed, failed, waitingJobs] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getFailedCount(),
    queue.getWaiting(0, 1)
  ]);

  const oldestWaitingLagMs =
    waitingJobs.length > 0 && waitingJobs[0]?.timestamp
      ? Math.max(0, Date.now() - waitingJobs[0].timestamp)
      : 0;

  if (oldestWaitingLagMs > 0) {
    recordCampaignSendQueueLag(oldestWaitingLagMs);
  }

  return {
    available: true,
    waiting,
    active,
    delayed,
    failed,
    oldestWaitingLagMs
  };
}

/**
 * @param {object} payload
 * @param {{ recipientCount?: number, forceQueue?: boolean }} [options]
 */
function enqueueCampaignSendJob(payload, options = {}) {
  const recipientCount = Math.max(
    0,
    Number(options.recipientCount) || (Array.isArray(payload.recipients) ? payload.recipients.length : 0)
  );
  const forceQueue = options.forceQueue === true;

  assertCampaignSendScaleReady(recipientCount, { allowInline: !forceQueue });

  const canUseInline =
    !forceQueue
    && recipientCount <= CAMPAIGN_SEND_INLINE_MAX
    && (!isRedisConfigured() || !isCampaignSendWorkerEnabled());

  if (canUseInline) {
    runCampaignSendInline(payload);
    return { mode: 'inline' };
  }

  const queue = initQueue();
  if (!queue) {
    assertCampaignSendScaleReady(recipientCount, { allowInline: false });
    runCampaignSendInline(payload);
    return { mode: 'inline-fallback' };
  }

  const campaignId = String(payload.campaignId || '');
  const jobId = String(payload.jobId || campaignId);

  try {
    queue.add(payload, {
      jobId,
      ...CAMPAIGN_SEND_RETRY_PROFILE
    });
    return { mode: 'queued' };
  } catch (err) {
    console.error('[campaignSendQueue] Enqueue failed, falling back to inline:', err.message);
    assertCampaignSendScaleReady(recipientCount, { allowInline: false });
    runCampaignSendInline(payload);
    return { mode: 'inline-fallback' };
  }
}

function startCampaignSendAlertMonitor() {
  if (alertMonitorTimer) return;
  const { checkCampaignSendAlerts } = require('./campaignSendAlertService');
  alertMonitorTimer = setInterval(() => {
    checkCampaignSendAlerts().catch((err) => {
      console.warn('[campaignSendQueue] Alert check failed:', err?.message || err);
    });
  }, CAMPAIGN_SEND_ALERT_INTERVAL_MS);
}

function startWorker() {
  if (!isCampaignSendWorkerEnabled()) {
    console.log('[campaignSendQueue] Worker disabled (ENABLE_MARKETING_CAMPAIGN_SEND_WORKER=false)');
    return false;
  }

  const queue = initQueue();
  if (!queue) {
    console.log('[campaignSendQueue] Redis unavailable — campaign sends run inline in API process');
    return false;
  }

  queue.process(CAMPAIGN_SEND_WORKER_CONCURRENCY, async (job) => {
    const jobPayload = job.data || {};
    if (!jobPayload.organizationId || !jobPayload.campaignId) {
      throw new Error('organizationId and campaignId are required in campaign send job payload');
    }

    await acquireCampaignSendOrgSlot(jobPayload.organizationId);
    try {
      await runCampaignSendJob({
        ...jobPayload,
        resume: jobPayload.resume === true || (job.attemptsMade || 0) > 1
      });
    } finally {
      await releaseCampaignSendOrgSlot(jobPayload.organizationId);
    }
  });

  startCampaignSendAlertMonitor();

  console.log(
    `[campaignSendQueue] Worker started (${CAMPAIGN_SEND_QUEUE_NAME}, concurrency=${CAMPAIGN_SEND_WORKER_CONCURRENCY})`
  );
  return true;
}

async function closeQueue() {
  if (alertMonitorTimer) {
    clearInterval(alertMonitorTimer);
    alertMonitorTimer = null;
  }
  if (campaignSendQueue && campaignSendQueue !== false) {
    await campaignSendQueue.close();
    campaignSendQueue = null;
  }
}

module.exports = {
  CAMPAIGN_SEND_QUEUE_NAME,
  enqueueCampaignSendJob,
  startWorker,
  closeQueue,
  runCampaignSendJob,
  getCampaignSendQueueState
};
