'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const express = require('express');

const instanceRegistryPath = require.resolve(path.join(__dirname, '../../models/InstanceRegistry'));
require.cache[instanceRegistryPath] = {
  id: instanceRegistryPath,
  filename: instanceRegistryPath,
  loaded: true,
  exports: { aggregate: async () => [] }
};

const healthRoutes = require('../healthRoutes');

const ENV_KEYS = [
  'NODE_ENV',
  'HEALTH_DETAILS_TOKEN',
  'MAILROOM_METRICS_TOKEN',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_HEALTH_BLOCKS_READY',
  'ENABLE_REDIS_REQUIRED'
];
const savedEnv = {};
let server;
let baseUrl;
let closedRedisUrl;

async function get(pathname, headers = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, { headers });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* prometheus text */
  }
  return { status: res.status, body, text };
}

before(async () => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  const closed = net.createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
  closedRedisUrl = `redis://127.0.0.1:${closed.address().port}`;
  await new Promise((resolve) => closed.close(resolve));

  const app = express();
  app.use('/health', healthRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('GET /health/live', () => {
  it('is public and returns 200', async () => {
    process.env.NODE_ENV = 'production';
    const res = await get('/health/live');
    assert.equal(res.status, 200);
    assert.equal(res.body.liveness, true);
  });
});

describe('GET /health/ready', () => {
  it('is public and reports not_ready (503) without a database connection', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_HEALTH_BLOCKS_READY = 'false';
    const res = await get('/health/ready');
    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'not_ready');
    assert.equal(res.body.database.connected, false);
    assert.deepEqual(res.body.redis, { configured: false });
  });

  it('does not disclose Redis error details to anonymous callers', async () => {
    process.env.REDIS_URL = closedRedisUrl;
    process.env.HEALTH_DETAILS_TOKEN = 'details-token';
    const res = await get('/health/ready');
    assert.deepEqual(res.body.redis, { configured: true, ok: false });
    assert.ok(!res.text.includes('127.0.0.1'));
  });

  it('includes Redis error details with HEALTH_DETAILS_TOKEN', async () => {
    process.env.REDIS_URL = closedRedisUrl;
    process.env.HEALTH_DETAILS_TOKEN = 'details-token';
    const res = await get('/health/ready', { Authorization: 'Bearer details-token' });
    assert.equal(res.body.redis.ok, false);
    assert.match(res.body.redis.error, /ECONNREFUSED/);
  });
});

describe('GET /health/status', () => {
  it('is hidden in production when HEALTH_DETAILS_TOKEN is unset', async () => {
    process.env.NODE_ENV = 'production';
    const res = await get('/health/status');
    assert.equal(res.status, 404);
  });

  it('rejects missing or wrong tokens', async () => {
    process.env.NODE_ENV = 'production';
    process.env.HEALTH_DETAILS_TOKEN = 'details-token';
    assert.equal((await get('/health/status')).status, 401);
    assert.equal((await get('/health/status', { Authorization: 'Bearer nope' })).status, 401);
  });

  it('returns status without the database host for authorized callers', async () => {
    process.env.NODE_ENV = 'production';
    process.env.HEALTH_DETAILS_TOKEN = 'details-token';
    const res = await get('/health/status', { 'X-Health-Token': 'details-token' });
    assert.equal(res.status, 200);
    assert.equal(res.body.environment, 'production');
    assert.ok(!('host' in res.body.database));
  });

  it('stays open outside production when no token is configured', async () => {
    process.env.NODE_ENV = 'development';
    const res = await get('/health/status');
    assert.equal(res.status, 200);
    assert.ok(!('host' in res.body.database));
  });
});

describe('GET /health/mailroom-metrics', () => {
  it('is hidden in production when MAILROOM_METRICS_TOKEN is unset', async () => {
    process.env.NODE_ENV = 'production';
    assert.equal((await get('/health/mailroom-metrics')).status, 404);
  });

  it('requires the metrics token when configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MAILROOM_METRICS_TOKEN = 'metrics-token';
    assert.equal((await get('/health/mailroom-metrics')).status, 401);
    assert.equal((await get('/health/mailroom-metrics', { 'X-Metrics-Token': 'wrong' })).status, 401);

    const res = await get('/health/mailroom-metrics', { 'X-Metrics-Token': 'metrics-token' });
    assert.equal(res.status, 200);
    const bearer = await get('/health/mailroom-metrics', { Authorization: 'Bearer metrics-token' });
    assert.equal(bearer.status, 200);
  });
});
