const { createClient } = require('redis');

/**
 * True when the app is configured to use Redis (Bull, cache, or Upstash).
 */
function isRedisRequiredForHealth() {
  return Boolean(
    String(process.env.REDIS_URL || '').trim()
    || String(process.env.REDIS_HOST || '').trim()
    || process.env.ENABLE_REDIS_REQUIRED === 'true',
  );
}

/**
 * PING Redis if configured. Used by /health/ready.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function checkRedis() {
  const url = process.env.REDIS_URL;
  if (!url && !process.env.REDIS_HOST) {
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  const connectUrl = url || buildUrlFromParts();
  if (!connectUrl) {
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  const client = createClient({
    url: connectUrl,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: () => new Error('no-reconnect-in-health'),
    },
  });

  try {
    await client.connect();
    const pong = await client.ping();
    await client.disconnect().catch(() => {});
    return { ok: pong === 'PONG' || pong === 'pong' };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function buildUrlFromParts() {
  const host = process.env.REDIS_HOST;
  if (!host) return null;
  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

/**
 * Production (or an explicit flag) fails readiness when Redis is missing or down.
 * Development stays ready unless REDIS_HEALTH_BLOCKS_READY=true or ENABLE_REDIS_REQUIRED=true.
 * @param {{ skipped?: boolean, ok?: boolean }} redisResult
 * @param {NodeJS.ProcessEnv} [env]
 */
function redisFailureBlocksReadiness(redisResult, env = process.env) {
  const explicit = env.REDIS_HEALTH_BLOCKS_READY;
  const production = env.NODE_ENV === 'production';
  const blocks =
    explicit === 'true'
    || env.ENABLE_REDIS_REQUIRED === 'true'
    || (explicit !== 'false' && production);
  if (!blocks) return false;
  if (redisResult && redisResult.skipped) {
    return production && explicit !== 'false';
  }
  return !redisResult || redisResult.ok !== true;
}

module.exports = { checkRedis, isRedisRequiredForHealth, redisFailureBlocksReadiness };
