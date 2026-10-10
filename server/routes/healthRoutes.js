const express = require('express');
const router = express.Router();
const { checkRedis, redisFailureBlocksReadiness } = require('../lib/redisHealth');

/**
 * Liveness: process is up (no dependency checks). Use for cheap probes.
 */
/**
 * Prometheus text metrics for Mailroom (optional token via MAILROOM_METRICS_TOKEN).
 */
router.get('/mailroom-metrics', (req, res) => {
  const token = process.env.MAILROOM_METRICS_TOKEN || '';
  if (token) {
    const provided = req.get('Authorization')?.replace(/^Bearer\s+/i, '')
      || req.get('X-Metrics-Token')
      || '';
    if (provided !== token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  }

  const { renderPrometheus } = require('../platform/mailroom/observability/mailroomMetrics');
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(renderPrometheus());
});

router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'arivu-api',
        liveness: true
    });
});

/**
 * Readiness: MongoDB + optional Redis when configured.
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
        : { configured: true, ok: redisResult.ok, error: redisResult.error };

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
 * Detailed System Status
 */
router.get('/status', async (req, res) => {
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
                host: mongoose.connection.host,
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
            message: error.message
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

