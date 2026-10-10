'use strict';

const { acquireSchedulerLock } = require('../../../lib/schedulerLock');
const MailroomProcessingFailure = require('../../../models/MailroomProcessingFailure');
const {
  MAX_REPLAY_ATTEMPTS,
  replayRawPayload
} = require('../services/processingFailureService');

const DEFAULT_INTERVAL_MS = Number(process.env.MAILROOM_FAILURE_RETRY_INTERVAL_MS) || 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = Number(process.env.MAILROOM_FAILURE_RETRY_BATCH_SIZE) || 10;
const MIN_RETRY_GAP_MS = Number(process.env.MAILROOM_FAILURE_RETRY_GAP_MS) || 15 * 60 * 1000;

let intervalHandle = null;
let running = false;

async function processRetryBatch() {
  if (running) return;
  const acquired = await acquireSchedulerLock(
    'mailroom-failure-retry',
    Math.max(30_000, DEFAULT_INTERVAL_MS - 5000)
  );
  if (!acquired) return;
  running = true;

  try {
    const staleBefore = new Date(Date.now() - MIN_RETRY_GAP_MS);
    const failures = await MailroomProcessingFailure.find({
      status: { $in: ['open', 'retrying'] },
      retryCount: { $lt: MAX_REPLAY_ATTEMPTS },
      $or: [
        { lastRetryAt: null },
        { lastRetryAt: { $lte: staleBefore } }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(DEFAULT_BATCH_SIZE)
      .lean();

    for (const failure of failures) {
      try {
        await replayRawPayload(failure.organizationId, failure.rawPayloadId);
        console.log(
          `[mailroomFailureRetry] replayed rawPayload=${failure.rawPayloadId} org=${failure.organizationId}`
        );
      } catch (err) {
        console.warn(
          `[mailroomFailureRetry] replay failed rawPayload=${failure.rawPayloadId}: ${err.message}`
        );
      }
    }
  } catch (err) {
    console.error('[mailroomFailureRetry] batch error:', err.message);
  } finally {
    running = false;
  }
}

function startMailroomFailureRetryWorker() {
  if (process.env.MAILROOM_FAILURE_RETRY_ENABLED === 'false') {
    return;
  }
  if (intervalHandle) return;

  void processRetryBatch();
  intervalHandle = setInterval(processRetryBatch, DEFAULT_INTERVAL_MS);
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  console.log(
    `[mailroomFailureRetry] Worker started (interval=${DEFAULT_INTERVAL_MS}ms, batch=${DEFAULT_BATCH_SIZE})`
  );
}

function stopMailroomFailureRetryWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startMailroomFailureRetryWorker,
  stopMailroomFailureRetryWorker,
  processRetryBatch
};
