const { getRedisClient, isRedisConfigured } = require('./redisClient');

const DEFAULT_WINDOW_MS = 55_000;

/**
 * SET NX PX for one schedule bucket. Shared by every Worker.
 * @param {{ set: Function }} client
 * @param {string} name
 * @param {number} [windowMs]
 * @param {number} [nowMs]
 */
async function claimSchedulerLock(client, name, windowMs = DEFAULT_WINDOW_MS, nowMs = Date.now()) {
  const window = Math.max(1000, Number(windowMs) || DEFAULT_WINDOW_MS);
  const bucket = Math.floor(nowMs / window);
  const key = `arivu:scheduler-lock:${name}:${bucket}`;
  const result = await client.set(key, String(process.pid), { NX: true, PX: window });
  return { acquired: result === 'OK', key, bucket, ttlMs: window };
}

/**
 * One winner per time bucket across Worker processes.
 * Redis not configured: run (single local process).
 * Redis configured but unavailable, or lock held: skip.
 * @param {string} name
 * @param {number} [windowMs]
 * @returns {Promise<boolean>}
 */
async function acquireSchedulerLock(name, windowMs = DEFAULT_WINDOW_MS) {
  if (!isRedisConfigured()) {
    return true;
  }

  let client;
  try {
    client = await getRedisClient({ component: 'scheduler-lock', required: false });
  } catch (err) {
    console.warn(`[schedulerLock] Redis unavailable; skipping ${name}:`, err.message);
    return false;
  }
  if (!client) {
    console.warn(`[schedulerLock] Redis unavailable; skipping ${name}`);
    return false;
  }

  try {
    const claim = await claimSchedulerLock(client, name, windowMs);
    return claim.acquired;
  } catch (err) {
    console.warn(`[schedulerLock] lock failed; skipping ${name}:`, err.message);
    return false;
  }
}

module.exports = {
  acquireSchedulerLock,
  claimSchedulerLock,
};
