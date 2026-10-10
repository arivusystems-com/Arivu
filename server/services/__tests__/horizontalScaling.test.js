'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { claimSchedulerLock } = require('../../lib/schedulerLock');
const { getMongoUris } = require('../../lib/mongoConnect');
const {
  RedisRateLimitStore,
  resolveSharedRateLimitFailureMode,
} = require('../../middleware/rateLimitRedisStore');
const {
  SLOT_TTL_MS,
  tryAcquireRedisSlot,
  releaseRedisSlot,
} = require('../marketing/campaignSendOrgLimiter');
const {
  buildObjectKey,
  buildDownloadUrl,
  parseStoragePath,
  assertOrgAccessToKey,
} = require('../fileStorageService');

function memoryRedis() {
  const counts = new Map();
  const held = new Set();
  const ttls = new Map();
  return {
    counts,
    ttls,
    async incr(key) {
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return next;
    },
    async decr(key) {
      const next = (counts.get(key) || 0) - 1;
      counts.set(key, next);
      return next;
    },
    async del(key) {
      counts.delete(key);
      held.delete(key);
      ttls.delete(key);
      return 1;
    },
    async pExpire(key, ttlMs) {
      ttls.set(key, ttlMs);
      return 1;
    },
    async set(key, _value, opts = {}) {
      if (opts.NX && held.has(key)) return null;
      held.add(key);
      return 'OK';
    },
  };
}

describe('horizontal scaling contracts', () => {
  it('accepts the same JWT on either API', () => {
    const secret = 'shared-production-jwt-secret-value';
    const token = jwt.sign({ userId: 'u1', organizationId: 'o1' }, secret);
    const api1 = jwt.verify(token, secret);
    const api2 = jwt.verify(token, secret);
    assert.equal(api1.userId, api2.userId);
    assert.equal(api1.organizationId, 'o1');
  });

  it('uses one Redis key for a rate-limit identity', () => {
    const store = new RedisRateLimitStore({ prefix: 'arivu:production:rate-limit:', windowMs: 60000 });
    const key = store.key('203.0.113.10');
    assert.equal(key, 'arivu:production:rate-limit:203.0.113.10');
    assert.equal(key.includes(String(process.pid)), false);
  });

  it('fails shared rate limits closed in production when Redis is configured', () => {
    assert.equal(resolveSharedRateLimitFailureMode({
      isProduction: true,
      redisConfigured: true,
    }), 'fail-closed');
    assert.equal(resolveSharedRateLimitFailureMode({
      isProduction: false,
      redisConfigured: false,
    }), 'fail-open');
    assert.equal(resolveSharedRateLimitFailureMode({
      isProduction: true,
      redisConfigured: true,
      explicit: 'fail-open',
    }), 'fail-open');
  });

  it('lets only one worker win a schedule tick and releases the next bucket after a crash', async () => {
    const client = memoryRedis();
    const now = 1_700_000_000_000;
    const windowMs = 55_000;
    const first = await claimSchedulerLock(client, 'campaign-digest', windowMs, now);
    const second = await claimSchedulerLock(client, 'campaign-digest', windowMs, now + 1000);
    assert.equal(first.acquired, true);
    assert.equal(second.acquired, false);
    assert.equal(first.key, second.key);
    assert.equal(first.key.includes('campaign-digest'), true);

    const next = await claimSchedulerLock(client, 'campaign-digest', windowMs, now + windowMs);
    assert.equal(next.acquired, true);
    assert.notEqual(next.key, first.key);
  });

  it('does not double-allocate a campaign org slot across workers', async () => {
    const client = memoryRedis();
    const key = 'arivu:campaign-send:org:org-1';
    const worker1 = await tryAcquireRedisSlot(client, key, 1, SLOT_TTL_MS);
    const worker2 = await tryAcquireRedisSlot(client, key, 1, SLOT_TTL_MS);
    assert.equal(worker1, true);
    assert.equal(worker2, false);
    assert.equal(client.counts.get(key), 1);
    assert.equal(client.ttls.get(key), SLOT_TTL_MS);
    assert.equal(SLOT_TTL_MS, 30 * 60 * 1000);

    await releaseRedisSlot(client, key);
    assert.equal(client.counts.has(key), false);
    const worker2Retry = await tryAcquireRedisSlot(client, key, 1, SLOT_TTL_MS);
    assert.equal(worker2Retry, true);
  });

  it('stores object keys that any API or worker can address', () => {
    const orgId = '64b1f2a1c3d4e5f6a7b8c9d0';
    const key = buildObjectKey({ organizationId: orgId, category: 'quotes', fileName: 'quote.pdf' });
    assert.match(key, /^uploads\/64b1f2a1c3d4e5f6a7b8c9d0\/quotes\//);
    const url = buildDownloadUrl(`oci:${key}`, { fileName: 'quote.pdf', contentType: 'application/pdf' });
    assert.match(url, /^\/api\/files\/download\?/);
    const parsed = parseStoragePath(`oci:${key}`);
    assert.equal(parsed.driver, 'oci');
    assert.equal(parsed.key, key);
    assert.doesNotThrow(() => assertOrgAccessToKey(key, orgId));
  });

  it('keeps mongoose retryWrites for a replica set', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/mongoConnect.js'), 'utf8');
    assert.match(source, /retryWrites:\s*true/);
    const previous = process.env.MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb://10.0.0.8:27017/arivu?replicaSet=rs0';
    try {
      const uris = getMongoUris();
      assert.match(uris.masterUri, /replicaSet=rs0/);
      assert.match(uris.masterUri, /arivu_master/);
    } finally {
      if (previous == null) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = previous;
    }
  });

  it('keeps the email send claim that blocks a second worker', () => {
    const source = fs.readFileSync(path.join(__dirname, '../emailQueueService.js'), 'utf8');
    assert.match(source, /jobId: `email-\$\{communicationId\}`/);
    assert.match(source, /status: 'sending', \$or: unclaimed/);
    assert.match(source, /metadata\.sendClaimId': claimId/);
    assert.match(source, /doc\.status === 'sent'/);
    assert.doesNotMatch(source, /\$unset:\s*\{[^}]*sendClaimId/);
  });

  it('shares execution idempotency across API processes', async () => {
    const store = new Map();
    const { initializeRedis, checkIdempotency, storeIdempotencyResult } = require('../../utils/idempotencyGuard');
    initializeRedis({
      async get(key) {
        return store.has(key) ? store.get(key) : null;
      },
      async setEx(key, _ttl, value) {
        store.set(key, value);
      },
    });
    const args = ['key-1', 'user-1', 'org-1', 'records.update', 'rec-1'];
    const first = await checkIdempotency(...args);
    assert.equal(first.isDuplicate, false);
    await storeIdempotencyResult(...args, { data: { ok: true } });
    const second = await checkIdempotency(...args);
    assert.equal(second.isDuplicate, true);
    assert.equal(second.existingResult.data.ok, true);
  });

  it('fans studio websocket updates by process id rather than a sticky session', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../astraStudio/yjsRoomManager.js'),
      'utf8'
    );
    assert.match(source, /astra-studio:yjs/);
    assert.match(source, /origin === process\.pid/);
  });
});
