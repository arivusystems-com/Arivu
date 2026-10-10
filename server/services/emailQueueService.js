/**
 * Email Queue Service (Async send)
 * Uses Bull + Redis when available. Falls back to sync send when not.
 */

const crypto = require('crypto');
const { classifyCommunicationFailure } = require('../platform/communication/domain/failureTaxonomy');
let emailQueue = null;

const COMMUNICATION_QUEUE_NAMES = Object.freeze({
  EMAIL_SEND: 'communication:email:send'
});

const COMMUNICATION_RETRY_PROFILES = Object.freeze({
  EMAIL_SEND: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

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

function initQueue() {
  if (emailQueue !== null) return emailQueue;
  if (!isRedisConfigured()) {
    emailQueue = false;
    return false;
  }
  try {
    const Bull = require('bull');
    const redisUrl = process.env.REDIS_URL || getLegacyRedisUrl();
    const isTls = redisUrl.startsWith('rediss://');
    /**
     * ioredis (used by Bull) + Atlas/Upstash: use TLS and disable ready check friction.
     */
    const opts = {
      defaultJobOptions: {
        ...COMMUNICATION_RETRY_PROFILES.EMAIL_SEND
      },
    };
    if (isTls) {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: { rejectUnauthorized: true },
      };
    } else {
      opts.redis = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    }
    emailQueue = new Bull(COMMUNICATION_QUEUE_NAMES.EMAIL_SEND, redisUrl, opts);
    emailQueue.on('error', (err) => console.error('[emailQueue] Redis error:', err.message));
    return emailQueue;
  } catch (err) {
    console.error('[emailQueue] Failed to init:', err.message);
    emailQueue = false;
    return false;
  }
}

/**
 * Add delayed send job. Returns true if queued, false if queue unavailable.
 * @param {string} communicationId
 * @param {string|null} organizationId
 * @param {Date|string|number} runAt
 */
function enqueueSendDelayed(communicationId, organizationId, runAt) {
  const queue = initQueue();
  if (!queue) return false;
  try {
    const runAtMs = runAt instanceof Date ? runAt.getTime() : new Date(runAt).getTime();
    if (!Number.isFinite(runAtMs)) return false;
    const delay = Math.max(0, runAtMs - Date.now());
    queue.add(
      { communicationId, organizationId: organizationId ? String(organizationId) : null },
      {
        jobId: `email-${communicationId}`,
        delay,
        ...COMMUNICATION_RETRY_PROFILES.EMAIL_SEND
      }
    );
    return true;
  } catch (err) {
    console.error('[emailQueue] Delayed enqueue failed:', err.message);
    return false;
  }
}

/**
 * Remove a delayed send job (e.g. user cancelled schedule).
 */
async function removeSendJob(communicationId) {
  const queue = initQueue();
  if (!queue) return false;
  try {
    const job = await queue.getJob(`email-${communicationId}`);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (err) {
    console.error('[emailQueue] remove job failed:', err.message);
    return false;
  }
}

/**
 * Claim due scheduled emails and enqueue/process them.
 * Safety net when Redis delayed jobs miss, or when schedule was stored without a queue.
 * Scans tenant DBs (communications are tenant-scoped).
 */
async function processDueScheduledEmails({ limitPerTenant = 25 } = {}) {
  const Communication = require('../models/Communication');
  const Organization = require('../models/Organization');
  const { runWithOrganizationTenantContext } = require('../utils/organizationTenantContext');
  const now = new Date();

  let tenants = [];
  try {
    tenants = await Organization.find({
      isTenant: true,
      isActive: true,
      'database.name': { $exists: true, $nin: [null, ''] }
    })
      .select('_id')
      .lean();
  } catch (err) {
    console.error('[emailQueue] Due scheduled tenants query failed:', err.message);
    return { processed: 0 };
  }

  let processed = 0;
  for (const tenant of tenants) {
    try {
      await runWithOrganizationTenantContext(tenant._id, async () => {
        const claimed = await Communication.find({
          organizationId: tenant._id,
          kind: 'email',
          direction: 'outbound',
          status: 'scheduled',
          scheduledAt: { $lte: now }
        })
          .sort({ scheduledAt: 1 })
          .limit(limitPerTenant)
          .select('_id')
          .lean();

        for (const row of claimed) {
          const updated = await Communication.findOneAndUpdate(
            { _id: row._id, status: 'scheduled' },
            { $set: { status: 'sending' } },
            { new: true }
          ).lean();
          if (!updated) continue;
          const orgId = String(tenant._id);
          if (!enqueueSend(String(updated._id), orgId)) {
            await processSendJob(String(updated._id), orgId);
          }
          processed += 1;
        }
      });
    } catch (err) {
      console.error('[emailQueue] process due scheduled tenant failed:', tenant._id, err.message);
    }
  }
  return { processed };
}

let dueScheduledTimer = null;

/**
 * Add send job to queue. Returns true if queued, false if queue unavailable.
 */
function enqueueSend(communicationId, organizationId) {
  const queue = initQueue();
  if (!queue) return false;
  try {
    queue.add(
      { communicationId, organizationId: organizationId ? String(organizationId) : null },
      {
        jobId: `email-${communicationId}`,
        ...COMMUNICATION_RETRY_PROFILES.EMAIL_SEND
      }
    );
    return true;
  } catch (err) {
    console.error('[emailQueue] Enqueue failed:', err.message);
    return false;
  }
}

async function getQueueStats() {
  const queue = initQueue();
  if (!queue) {
    return {
      queueAvailable: false,
      queueName: COMMUNICATION_QUEUE_NAMES.EMAIL_SEND,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0
    };
  }
  try {
    const [waiting, active, delayed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount()
    ]);
    return {
      queueAvailable: true,
      queueName: COMMUNICATION_QUEUE_NAMES.EMAIL_SEND,
      waiting,
      active,
      delayed,
      failed
    };
  } catch (error) {
    return {
      queueAvailable: true,
      queueName: COMMUNICATION_QUEUE_NAMES.EMAIL_SEND,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      error: error.message
    };
  }
}

/**
 * Process a single send job. Called by worker or for manual processing.
 */
async function processSendJob(communicationId, organizationId) {
  const Communication = require('../models/Communication');
  const { runWithOrganizationTenantContext } = require('../utils/organizationTenantContext');

  const run = async () => processSendJobInner(communicationId);

  if (organizationId) {
    return runWithOrganizationTenantContext(organizationId, run);
  }

  // Legacy queued jobs may lack organizationId — resolve from master, then tenant DB.
  const masterDoc = await Communication.findById(communicationId).select('organizationId').lean();
  if (masterDoc?.organizationId) {
    return runWithOrganizationTenantContext(masterDoc.organizationId, run);
  }

  return run();
}

async function processSendJobInner(communicationId) {
  // DESIGN NOTE: there is no reconciler for status "sending".
  // metadata.sendClaimId is set before the provider call and is never cleared on retry.
  // A crash after the claim (including after the provider accepts and before the status
  // write) must not send again. Recovering those rows requires a separate operator path
  // that can prove the provider did not accept the message. Do not clear sendClaimId here.
  const Communication = require('../models/Communication');
  const People = require('../models/People');
  const Organization = require('../models/Organization');
  const Case = require('../models/Case');
  const User = require('../models/User');
  const outboundEmailSendService = require('../platform/communication/outbound/outboundEmailSendService');
  const { appendCommunicationEvent } = require('./communicationEventWriter');
  const caseExecutionService = require('./caseExecutionService');
  const { applyCaseActivitySideEffects } = require('./caseAutoStatusService');

  let doc = await Communication.findById(communicationId).lean();
  if (!doc) return;
  if (doc.status === 'sent' || doc.status === 'delivered' || doc.status === 'opened' || doc.status === 'cancelled') {
    return;
  }

  const claimId = crypto.randomBytes(12).toString('hex');
  const unclaimed = [
    { 'metadata.sendClaimId': { $exists: false } },
    { 'metadata.sendClaimId': null },
    { 'metadata.sendClaimId': '' }
  ];

  if (doc.status === 'scheduled') {
    const dueMs = doc.scheduledAt ? new Date(doc.scheduledAt).getTime() : 0;
    if (Number.isFinite(dueMs) && dueMs > Date.now() + 5000) {
      // Job fired early — leave as scheduled for poller / re-delay
      return;
    }
    doc = await Communication.findOneAndUpdate(
      { _id: communicationId, status: 'scheduled', $or: unclaimed },
      { $set: { status: 'sending', 'metadata.sendClaimId': claimId } },
      { new: true }
    ).lean();
    if (!doc) return;
  } else if (doc.status === 'sending') {
    doc = await Communication.findOneAndUpdate(
      { _id: communicationId, status: 'sending', $or: unclaimed },
      { $set: { 'metadata.sendClaimId': claimId } },
      { new: true }
    ).lean();
    if (!doc) return;
  } else {
    return;
  }

  const { organizationId, relatedTo, toAddresses, ccAddresses, bccAddresses, subject, body, attachments } = doc;
  const moduleKey = relatedTo?.moduleKey;
  const recordId = relatedTo?.recordId;
  await appendCommunicationEvent({
    organizationId,
    communicationId: doc._id,
    eventType: 'processing',
    source: 'email-worker',
    idempotencyKeyHash: doc.idempotencyKeyHash || '',
    payload: {
      queue: COMMUNICATION_QUEUE_NAMES.EMAIL_SEND,
      retryProfile: COMMUNICATION_RETRY_PROFILES.EMAIL_SEND
    }
  });

  const result = await outboundEmailSendService.sendOutboundCommunication(doc);
  const finalStatus = result.success ? 'sent' : 'failed';
  await Communication.findByIdAndUpdate(
    communicationId,
    outboundEmailSendService.buildCommunicationUpdateFromSendResult(result)
  );
  await appendCommunicationEvent({
    organizationId,
    communicationId: doc._id,
    eventType: finalStatus,
    source: 'email-worker',
    idempotencyKeyHash: doc.idempotencyKeyHash || '',
    payload: {
      provider: result.provider || null,
      externalMessageId: result.messageId || null,
      error: result.success ? null : (result.error || 'send_failed'),
      code: result.success ? null : (result.code || null),
      domain: result.domain || null,
      suppressed: result.suppressed || null,
      failureCategory: result.success ? null : classifyCommunicationFailure(result.error)
    }
  });

  const user = await User.findById(doc.sentByUserId).select('firstName lastName email').lean();
  const userName = String(user?.firstName || user?.lastName || user?.email || 'User');
  const newLog = {
    user: userName,
    userId: doc.sentByUserId,
    action: 'email_sent',
    details: {
      communicationId: doc._id,
      subject: subject || '',
      to: toAddresses?.[0],
      status: finalStatus
    },
    timestamp: new Date()
  };

  const pushActivityLog = async (Model, query) => {
    const forUpdate = await Model.findOne(query).select('activityLogs').lean();
    if (!forUpdate) return;
    if (!Array.isArray(forUpdate.activityLogs)) {
      await Model.findOneAndUpdate(query, { $set: { activityLogs: [newLog] } }, { runValidators: false });
    } else {
      await Model.findOneAndUpdate(query, { $push: { activityLogs: newLog } }, { runValidators: false });
    }
  };

  if (moduleKey === 'workspace') {
    await pushActivityLog(Organization, { _id: organizationId, deletedAt: null });
  } else if (moduleKey === 'people') {
    await pushActivityLog(People, { _id: recordId, organizationId, deletedAt: null });
  } else if (moduleKey === 'organizations') {
    await pushActivityLog(Organization, { _id: recordId, organizationId, isTenant: false, deletedAt: null });
  } else if (moduleKey === 'cases') {
    const caseRow = await Case.findOne({ _id: recordId, organizationId, deletedAt: null });
    if (caseRow) {
      caseRow.activities = Array.isArray(caseRow.activities) ? caseRow.activities : [];
      caseRow.activities.push({
        activityType: 'email_sent',
        message: `Email sent: ${(subject || '').trim()}`,
        internal: true,
        metadata: {
          communicationId: String(doc._id),
          to: toAddresses?.[0],
          status: finalStatus,
          deliveryStatus:
            result.success && result.messageId
              ? 'queued'
              : finalStatus === 'failed'
                ? 'failed'
                : 'processing',
          amdsMessageId: result.messageId || null,
          deliveryError: result.success ? null : result.error || null,
          sendErrorCode: result.success ? null : result.code || null
        },
        actorId: doc.sentByUserId,
        actorName: userName,
        createdAt: new Date()
      });
      const { slaMarked, statusResult } = await applyCaseActivitySideEffects(caseRow, {
        activityType: 'email_sent',
        internal: true,
        actorId: doc.sentByUserId,
        actorName: userName,
        channel: caseRow.channel
      });
      if (slaMarked) {
        caseRow.activities.push({
          activityType: 'sla_response_met',
          message: 'First response SLA met',
          internal: true,
          metadata: { responseMetAt: caseRow.currentSlaCycle.responseMetAt },
          actorId: doc.sentByUserId,
          actorName: userName,
          createdAt: new Date()
        });
      }
      caseRow.updatedBy = doc.sentByUserId;
      await caseRow.save();
      if (statusResult?.changed) {
        await caseExecutionService.onCaseStatusChanged({
          caseRecord: caseRow,
          actorId: doc.sentByUserId,
          fromStatus: statusResult.fromStatus,
          toStatus: statusResult.toStatus
        });
      }
      const { isPortalChannelCase, notifyPortalCaseAgentReply } = require('./portalCaseNotificationService');
      if (isPortalChannelCase(caseRow)) {
        const requester = String(caseRow.requesterEmail || '').toLowerCase();
        const sentToRequester = !requester || (toAddresses || []).some(
          (addr) => String(addr || '').toLowerCase() === requester
        );
        if (sentToRequester) {
          await notifyPortalCaseAgentReply(caseRow, {
            actorId: doc.sentByUserId,
            preview: (subject || '').trim(),
            subject: (subject || '').trim()
          });
        }
      }
    }
  }
}

function startDueScheduledPoller() {
  if (dueScheduledTimer) return;
  dueScheduledTimer = setInterval(() => {
    processDueScheduledEmails().catch((err) => {
      console.error('[emailQueue] due scheduled poll error:', err.message);
    });
  }, 30_000);
  if (typeof dueScheduledTimer.unref === 'function') dueScheduledTimer.unref();
  processDueScheduledEmails().catch(() => {});
}

function startWorker() {
  const queue = initQueue();
  if (queue) {
    queue.process(async (job) => {
      const { communicationId, organizationId } = job.data || {};
      await processSendJob(communicationId, organizationId);
    });
    console.log('[emailQueue] Worker started (Bull)');
  } else {
    console.log('[emailQueue] Worker started (due-scheduled poll only; Redis unavailable)');
  }
  startDueScheduledPoller();
}

async function closeQueue() {
  if (dueScheduledTimer) {
    clearInterval(dueScheduledTimer);
    dueScheduledTimer = null;
  }
  if (emailQueue && emailQueue !== false) {
    try {
      await emailQueue.close();
    } catch (e) {
      console.error('[emailQueue] close error:', e.message);
    }
  }
  emailQueue = null;
}

module.exports = {
  COMMUNICATION_QUEUE_NAMES,
  COMMUNICATION_RETRY_PROFILES,
  initQueue,
  enqueueSend,
  enqueueSendDelayed,
  removeSendJob,
  processDueScheduledEmails,
  processSendJob,
  startWorker,
  getQueueStats,
  isQueueAvailable: () => !!initQueue(),
  closeQueue,
};
