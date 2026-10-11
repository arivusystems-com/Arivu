const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { checkRedis, redisFailureBlocksReadiness } = require('../lib/redisHealth');

function tokensMatch(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function providedToken(req, headerName) {
  return req.get('Authorization')?.replace(/^Bearer\s+/i, '')
    || (headerName && req.get(headerName))
    || '';
}

/**
 * Operator-only endpoints: require `tokenEnv` when set. When unset, they stay open outside
 * production and are hidden (404) in production.
 * @returns {boolean} true when the request may proceed
 */
function authorizeOperator(req, res, tokenEnv, headerName) {
  const token = String(process.env[tokenEnv] || '').trim();
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ success: false, message: 'Not found' });
      return false;
    }
    return true;
  }
  if (!tokensMatch(providedToken(req, headerName), token)) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  return true;
}

function hasHealthDetailsAccess(req) {
  const token = String(process.env.HEALTH_DETAILS_TOKEN || '').trim();
  return Boolean(token) && tokensMatch(providedToken(req, 'X-Health-Token'), token);
}

/**
 * Prometheus text metrics for Mailroom (token via MAILROOM_METRICS_TOKEN).
 */
router.get('/mailroom-metrics', (req, res) => {
  if (!authorizeOperator(req, res, 'MAILROOM_METRICS_TOKEN', 'X-Metrics-Token')) return undefined;

  const { renderPrometheus } = require('../platform/mailroom/observability/mailroomMetrics');
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(renderPrometheus());
});

/**
 * Liveness: process is up (no dependency checks). Use for cheap probes.
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'arivu-api',
        liveness: true
    });
});

/**
 * Readiness: MongoDB + optional Redis when configured. Public (load balancer probe);
 * dependency error strings are only returned with HEALTH_DETAILS_TOKEN.
 */
router.get('/ready', async (req, res) => {
    const mongoose = require('mongoose');
    const mongoOk = mongoose.connection.readyState === 1;
    const payload = {
        status: mongoOk ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'arivu-api',
        database: {
            connected: mongoOk,
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
        }
    };

    const redisResult = await checkRedis();
    payload.redis = redisResult.skipped
        ? { configured: false }
        : { configured: true, ok: redisResult.ok };
    if (!redisResult.skipped && redisResult.error && hasHealthDetailsAccess(req)) {
        payload.redis.error = redisResult.error;
    }

    // Production requires REDIS_HEALTH_BLOCKS_READY=true.
    // Development does not fail this probe when Redis is down unless that flag
    // (or ENABLE_REDIS_REQUIRED) is set.
    const redisBlocks = redisFailureBlocksReadiness(redisResult);
    const ok = mongoOk && !redisBlocks;
    res.status(ok ? 200 : 503).json({ ...payload, status: ok ? 'ready' : 'not_ready' });
});

/**
 * Master Control Plane Health Check Endpoint
 * This is for checking the health of the master server itself
 */
router.get('/', (req, res) => {
    const mongoose = require('mongoose');
    
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Arivu API (master control plane)',
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        },
        database: {
            connected: mongoose.connection.readyState === 1,
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
        }
    };

    const statusCode = health.database.connected ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * Detailed System Status (operator-only: HEALTH_DETAILS_TOKEN).
 */
router.get('/status', async (req, res) => {
    if (!authorizeOperator(req, res, 'HEALTH_DETAILS_TOKEN', 'X-Health-Token')) return undefined;
    const mongoose = require('mongoose');
    const InstanceRegistry = require('../models/InstanceRegistry');

    try {
        // Get instance statistics
        const stats = await InstanceRegistry.aggregate([
            {
                $group: {
                    _id: null,
                    totalInstances: { $sum: 1 },
                    activeInstances: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    healthyInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'healthy'] }, 1, 0] }
                    },
                    degradedInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'degraded'] }, 1, 0] }
                    },
                    unhealthyInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'unhealthy'] }, 1, 0] }
                    }
                }
            }
        ]);

        const status = {
            service: 'Arivu API (master control plane)',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: Math.floor(process.uptime()),
                readable: formatUptime(process.uptime())
            },
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                unit: 'MB'
            },
            database: {
                connected: mongoose.connection.readyState === 1,
                state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
                name: mongoose.connection.name
            },
            instances: stats[0] || {
                totalInstances: 0,
                activeInstances: 0,
                healthyInstances: 0,
                degradedInstances: 0,
                unhealthyInstances: 0
            }
        };

        res.status(200).json(status);
    } catch (error) {
        console.error('Status endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Status check failed'
        });
    }
});

/**
 * Helper function to format uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

module.exports = router;

