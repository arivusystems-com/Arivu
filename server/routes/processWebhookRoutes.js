'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { handleProcessWebhook } = require('../controllers/processWebhookController');
const {
  createRateLimitStore,
  shouldPassOnRateLimitStoreError,
} = require('../middleware/rateLimitRedisStore');

const router = express.Router();

const PROCESS_WEBHOOK_WINDOW_MS = 60 * 1000;

const processWebhookLimiter = rateLimit({
  windowMs: PROCESS_WEBHOOK_WINDOW_MS,
  max: parseInt(process.env.PROCESS_WEBHOOK_RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore({
    prefix: 'arivu:process-webhook:',
    windowMs: PROCESS_WEBHOOK_WINDOW_MS,
  }),
  passOnStoreError: shouldPassOnRateLimitStoreError(process.env.RATE_LIMIT_REDIS_FAILURE_MODE),
  keyGenerator: (req) => `process-webhook:${req.params.webhookKey || req.ip}`,
  message: { success: false, message: 'Too many webhook requests' },
  skip: () => process.env.NODE_ENV !== 'production' && process.env.SECURITY_DISABLED === 'true'
});

const captureRawBody = express.json({
  limit: '256kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

router.post('/:webhookKey', processWebhookLimiter, captureRawBody, handleProcessWebhook);

module.exports = router;
