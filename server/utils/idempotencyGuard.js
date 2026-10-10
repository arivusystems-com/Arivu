/**
 * ============================================================================
 * Phase 1F: Execution Idempotency Guard
 * ============================================================================
 * 
 * Prevents duplicate execution caused by:
 * - Double-click
 * - Network retry
 * - Page refresh
 * 
 * Implementation:
 * - Accepts optional idempotencyKey in execution request
 * - Stores short-lived hashes (Redis or in-memory fallback)
 * - Blocks duplicate execution within 30-60s window
 * - Returns safe "already executed" response
 * 
 * ============================================================================
 */

const { getRedisClient, isRedisConfigured } = require('../lib/redisClient');

// Shared Redis when configured. In-memory only when Redis is not configured (single local process).
let redisClient = null;
let inMemoryStore = new Map();

// TTL for idempotency keys (60 seconds)
const IDEMPOTENCY_TTL_SECONDS = 60;

/**
 * Initialize Redis client (optional)
 * @param {Object} redis - Redis client instance
 */
function initializeRedis(redis) {
  if (redis) {
    redisClient = redis;
    console.log('[IdempotencyGuard] Redis initialized');
  } else {
    console.log('[IdempotencyGuard] Using in-memory fallback (no Redis)');
  }
}

async function resolveRedis() {
  if (redisClient) return redisClient;
  if (!isRedisConfigured()) return null;
  return getRedisClient({ component: 'idempotency', required: false });
}

/**
 * Generate idempotency key hash
 * @param {string} idempotencyKey - User-provided idempotency key
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {string} capabilityKey - Capability key
 * @param {string} recordId - Record ID
 * @returns {string} - Hash key
 */
function generateHash(idempotencyKey, userId, organizationId, capabilityKey, recordId) {
  const crypto = require('crypto');
  const input = `${idempotencyKey || 'auto'}:${userId}:${organizationId}:${capabilityKey}:${recordId}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Check if execution is duplicate (idempotent)
 * @param {string} idempotencyKey - Optional user-provided idempotency key
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {string} capabilityKey - Capability key
 * @param {string} recordId - Record ID
 * @returns {Promise<{isDuplicate: boolean, existingResult: Object|null}>}
 */
async function checkIdempotency(idempotencyKey, userId, organizationId, capabilityKey, recordId) {
  const hash = generateHash(idempotencyKey, userId, organizationId, capabilityKey, recordId);
  const key = `idempotency:${hash}`;

  try {
    const client = await resolveRedis();
    if (isRedisConfigured() || redisClient) {
      if (!client) {
        return { isDuplicate: false, existingResult: null };
      }
      const existing = await client.get(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        return {
          isDuplicate: true,
          existingResult: parsed
        };
      }
      return { isDuplicate: false, existingResult: null };
    } else {
      // Use in-memory store
      const existing = inMemoryStore.get(key);
      if (existing) {
        // Check if expired
        if (Date.now() - existing.timestamp < IDEMPOTENCY_TTL_SECONDS * 1000) {
          return {
            isDuplicate: true,
            existingResult: existing.result
          };
        } else {
          // Expired, remove it
          inMemoryStore.delete(key);
        }
      }
      return { isDuplicate: false, existingResult: null };
    }
  } catch (error) {
    console.error('[IdempotencyGuard] Error checking idempotency:', error);
    // On error, allow execution (fail open)
    return { isDuplicate: false, existingResult: null };
  }
}

/**
 * Store execution result for idempotency
 * @param {string} idempotencyKey - Optional user-provided idempotency key
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {string} capabilityKey - Capability key
 * @param {string} recordId - Record ID
 * @param {Object} result - Execution result to store
 * @returns {Promise<void>}
 */
async function storeIdempotencyResult(idempotencyKey, userId, organizationId, capabilityKey, recordId, result) {
  const hash = generateHash(idempotencyKey, userId, organizationId, capabilityKey, recordId);
  const key = `idempotency:${hash}`;

  try {
    const client = await resolveRedis();
    if (isRedisConfigured() || redisClient) {
      if (!client) return;
      if (typeof client.setEx === 'function') {
        await client.setEx(key, IDEMPOTENCY_TTL_SECONDS, JSON.stringify(result));
      } else {
        await client.set(key, JSON.stringify(result), { EX: IDEMPOTENCY_TTL_SECONDS });
      }
    } else {
      // Use in-memory store with timestamp
      inMemoryStore.set(key, {
        result,
        timestamp: Date.now()
      });
      
      // Clean up expired entries periodically (every 5 minutes)
      if (Math.random() < 0.01) { // 1% chance on each call
        cleanupExpiredEntries();
      }
    }
  } catch (error) {
    console.error('[IdempotencyGuard] Error storing idempotency result:', error);
    // Fail silently - idempotency is best-effort
  }
}

/**
 * Clean up expired entries from in-memory store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, value] of inMemoryStore.entries()) {
    if (now - value.timestamp >= IDEMPOTENCY_TTL_SECONDS * 1000) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => inMemoryStore.delete(key));
  
  if (expiredKeys.length > 0) {
    console.log(`[IdempotencyGuard] Cleaned up ${expiredKeys.length} expired entries`);
  }
}

module.exports = {
  initializeRedis,
  checkIdempotency,
  storeIdempotencyResult,
  generateHash
};

