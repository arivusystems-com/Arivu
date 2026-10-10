'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { redisFailureBlocksReadiness } = require('../redisHealth');
const { resolveClientUrl, productionClientUrlError } = require('../../utils/clientUrl');

describe('production readiness', () => {
  it('fails readiness in production when Redis is down or missing', () => {
    const production = { NODE_ENV: 'production', REDIS_HEALTH_BLOCKS_READY: 'true' };
    assert.equal(redisFailureBlocksReadiness({ ok: false }, production), true);
    assert.equal(redisFailureBlocksReadiness({ skipped: true }, production), true);
    assert.equal(redisFailureBlocksReadiness({ ok: true }, production), false);
  });

  it('keeps development ready when Redis is down unless the flag is set', () => {
    const development = { NODE_ENV: 'development' };
    assert.equal(redisFailureBlocksReadiness({ ok: false }, development), false);
    assert.equal(redisFailureBlocksReadiness({ skipped: true }, development), false);
    assert.equal(
      redisFailureBlocksReadiness({ ok: false }, { ...development, REDIS_HEALTH_BLOCKS_READY: 'true' }),
      true
    );
    assert.equal(
      redisFailureBlocksReadiness({ skipped: true }, { ...development, REDIS_HEALTH_BLOCKS_READY: 'true' }),
      false
    );
  });

  it('requires a non-localhost CLIENT_URL in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousClientUrl = process.env.CLIENT_URL;
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.CLIENT_URL;
      assert.equal(resolveClientUrl(), 'http://localhost:5173');
      assert.equal(productionClientUrlError(), null);

      process.env.NODE_ENV = 'production';
      delete process.env.CLIENT_URL;
      assert.match(productionClientUrlError(), /CLIENT_URL/);
      assert.throws(() => resolveClientUrl(), /CLIENT_URL/);

      process.env.CLIENT_URL = 'http://localhost:5173';
      assert.match(productionClientUrlError(), /CLIENT_URL/);
      assert.throws(() => resolveClientUrl(), /CLIENT_URL/);

      process.env.CLIENT_URL = 'https://app.example.com';
      assert.equal(productionClientUrlError(), null);
      assert.equal(resolveClientUrl(), 'https://app.example.com');
    } finally {
      if (previousNodeEnv == null) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousClientUrl == null) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = previousClientUrl;
    }
  });
});
