const { getRedisClient, isRedisConfigured } = require('../lib/redisClient');

const RATE_LIMIT_APP_NAME = process.env.CACHE_APP_NAME || process.env.APP_NAME || 'arivu';
const RATE_LIMIT_ENV = process.env.CACHE_ENV || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const DEFAULT_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || `${RATE_LIMIT_APP_NAME}:${RATE_LIMIT_ENV}:rate-limit:`;
const redisRequired = process.env.RATE_LIMIT_REDIS_REQUIRED === 'true';

let warnedMemoryFallback = false;

class RedisRateLimitStore {
    constructor({ prefix = DEFAULT_PREFIX, windowMs } = {}) {
        this.prefix = prefix;
        this.windowMs = windowMs;
    }

    init(options) {
        this.windowMs = this.windowMs || options.windowMs;
    }

    key(key) {
        return `${this.prefix}${key}`;
    }

    async increment(key) {
        const client = await getRedisClient({ component: 'rate-limit', required: true });
        const redisKey = this.key(key);
        const windowMs = this.windowMs;
        const result = await client.eval(
            `
            local current = redis.call("INCR", KEYS[1])
            if current == 1 then
                redis.call("PEXPIRE", KEYS[1], ARGV[1])
                return { current, ARGV[1] }
            end
            local ttl = redis.call("PTTL", KEYS[1])
            if ttl < 0 then
                redis.call("PEXPIRE", KEYS[1], ARGV[1])
                ttl = ARGV[1]
            end
            return { current, ttl }
            `,
            {
                keys: [redisKey],
                arguments: [String(windowMs)],
            }
        );

        const totalHits = Number(result[0]);
        const ttlMs = Math.max(Number(result[1]), 0);
        return {
            totalHits,
            resetTime: new Date(Date.now() + ttlMs),
        };
    }

    async decrement(key) {
        const client = await getRedisClient({ component: 'rate-limit', required: true });
        await client.decr(this.key(key));
    }

    async resetKey(key) {
        const client = await getRedisClient({ component: 'rate-limit', required: true });
        await client.del(this.key(key));
    }
}

function createRateLimitStore({ prefix, windowMs } = {}) {
    if (!isRedisConfigured()) {
        if (redisRequired) {
            throw new Error('[rate-limit] RATE_LIMIT_REDIS_REQUIRED=true but Redis is not configured');
        }

        if (!warnedMemoryFallback) {
            warnedMemoryFallback = true;
            console.warn('[rate-limit] Redis is not configured; using express-rate-limit memory store');
        }
        return undefined;
    }

    return new RedisRateLimitStore({ prefix, windowMs });
}

function shouldPassOnRateLimitStoreError(failureMode) {
    return (failureMode || process.env.RATE_LIMIT_REDIS_FAILURE_MODE) === 'fail-open';
}

/**
 * Production with Redis configured fails closed. Development, or production
 * without Redis, stays fail-open so a missing local Redis does not block the API.
 * @param {{ isProduction?: boolean, redisConfigured?: boolean, explicit?: string }} [opts]
 */
function resolveSharedRateLimitFailureMode(opts = {}) {
    if (opts.explicit) return opts.explicit;
    const isProduction = opts.isProduction != null
        ? opts.isProduction
        : process.env.NODE_ENV === 'production';
    const redisConfigured = opts.redisConfigured != null
        ? opts.redisConfigured
        : isRedisConfigured();
    if (isProduction && redisConfigured) return 'fail-closed';
    return 'fail-open';
}

module.exports = {
    RedisRateLimitStore,
    createRateLimitStore,
    shouldPassOnRateLimitStoreError,
    resolveSharedRateLimitFailureMode,
};
