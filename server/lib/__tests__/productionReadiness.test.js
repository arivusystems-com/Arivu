'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { redisFailureBlocksReadiness } = require('../redisHealth');
const { getMongoUris } = require('../mongoConnect');
const { resolveClientUrl, productionClientUrlError } = require('../../utils/clientUrl');
const {
  processConfigErrors,
  productionConfigErrors,
  resolveAdminSeedPassword
} = require('../../config/validateEnv');

describe('process configuration', () => {
  it('accepts the documented API VM configuration', () => {
    assert.deepEqual(
      processConfigErrors({ PORT: '5000', ENABLE_SCHEDULED_JOBS: 'false', ENABLE_BULL_IN_WEB: 'false' }),
      []
    );
  });

  it('accepts a worker configuration without PORT', () => {
    assert.deepEqual(processConfigErrors({ ENABLE_SCHEDULED_JOBS: 'true' }), []);
  });

  it('rejects non-boolean process flags that would silently enable jobs', () => {
    const errors = processConfigErrors({ ENABLE_BULL_IN_WEB: 'False', ENABLE_SCHEDULED_JOBS: '0' });
    assert.equal(errors.length, 2);
    assert.match(errors.join('\n'), /ENABLE_BULL_IN_WEB must be "true" or "false" \(got "False"\)/);
    assert.match(errors.join('\n'), /ENABLE_SCHEDULED_JOBS must be "true" or "false" \(got "0"\)/);
  });

  it('rejects invalid PORT values', () => {
    assert.match(processConfigErrors({ PORT: 'abc' })[0], /PORT/);
    assert.match(processConfigErrors({ PORT: '70000' })[0], /PORT/);
  });
});

describe('production configuration', () => {
  const base = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://10.0.0.5:27017/arivu',
    REDIS_URL: 'redis://10.0.0.6:6379'
  };

  it('passes with MongoDB and Redis configured', () => {
    assert.deepEqual(productionConfigErrors(base), []);
  });

  it('requires a MongoDB URI', () => {
    const errors = productionConfigErrors({ ...base, MONGODB_URI: '' });
    assert.match(errors.join('\n'), /MONGODB_URI/);
  });

  it('requires Redis unless readiness explicitly ignores it', () => {
    assert.match(productionConfigErrors({ ...base, REDIS_URL: '' }).join('\n'), /REDIS_URL/);
    assert.deepEqual(productionConfigErrors({ ...base, REDIS_URL: '', REDIS_HEALTH_BLOCKS_READY: 'false' }), []);
  });

  it('never echoes credentials in configuration errors', () => {
    const errors = productionConfigErrors({ ...base, MONGODB_URI: 'mongodb://admin:s3cr@t@db:27017/arivu' });
    assert.equal(errors.length, 1);
    assert.ok(!errors[0].includes('s3cr'));
  });
});

describe('admin seed password policy', () => {
  it('keeps the development fallback outside production', () => {
    assert.equal(resolveAdminSeedPassword(undefined, { NODE_ENV: 'development' }), 'Admin@123');
  });

  it('requires an explicit strong password in production', () => {
    assert.throws(() => resolveAdminSeedPassword(undefined, { NODE_ENV: 'production' }), /explicit admin password/);
    assert.throws(
      () => resolveAdminSeedPassword(undefined, { NODE_ENV: 'production', DEFAULT_ADMIN_PASSWORD: 'Admin@123456' }),
      /known default/
    );
    assert.throws(() => resolveAdminSeedPassword('short', { NODE_ENV: 'production' }), /12 characters/);
    assert.equal(
      resolveAdminSeedPassword('a-long-unique-passphrase', { NODE_ENV: 'production' }),
      'a-long-unique-passphrase'
    );
  });
});

describe('getMongoUris', () => {
  it('builds the master URI from a private host with database and query', () => {
    const uris = getMongoUris({ MONGODB_URI: 'mongodb://arivu:pw@10.0.0.5:27017/arivu?authSource=admin&tls=false' });
    assert.equal(uris.baseUri, 'mongodb://arivu:pw@10.0.0.5:27017');
    assert.equal(uris.masterUri, 'mongodb://arivu:pw@10.0.0.5:27017/arivu_master?authSource=admin&tls=false');
    assert.equal(uris.mongoQueryString, '?authSource=admin&tls=false');
  });

  it('preserves percent-encoded special characters in credentials', () => {
    const encoded = encodeURIComponent('p@ss/w:rd?#%');
    const uris = getMongoUris({ MONGODB_URI: `mongodb://arivu:${encoded}@db.internal:27017/?authSource=admin` });
    assert.equal(uris.masterUri, `mongodb://arivu:${encoded}@db.internal:27017/arivu_master?authSource=admin`);
    assert.equal(decodeURIComponent(encoded), 'p@ss/w:rd?#%');
  });

  it('supports mongodb+srv and replica-set host lists', () => {
    assert.equal(
      getMongoUris({ MONGODB_URI: 'mongodb+srv://u:p@cluster0.example.net/?retryWrites=true' }).masterUri,
      'mongodb+srv://u:p@cluster0.example.net/arivu_master?retryWrites=true'
    );
    assert.equal(
      getMongoUris({ MONGODB_URI: 'mongodb://u:p@h1:27017,h2:27017/app?replicaSet=rs0', MASTER_DB_NAME: 'm' }).masterUri,
      'mongodb://u:p@h1:27017,h2:27017/m?replicaSet=rs0'
    );
  });

  for (const [label, uri] of [
    ['unencoded @', 'mongodb://arivu:p@ss@db:27017/arivu'],
    ['unencoded /', 'mongodb://arivu:pa/ss@db:27017/arivu'],
    ['unencoded ?', 'mongodb://arivu:pa?ss@db:27017/arivu'],
    ['unencoded :', 'mongodb://arivu:pa:ss@db:27017/arivu'],
    ['bad percent-encoding', 'mongodb://arivu:pa%zzss@db:27017/arivu'],
    ['wrong scheme', 'http://db:27017/arivu']
  ]) {
    it(`rejects ${label} without leaking the URI`, () => {
      assert.throws(() => getMongoUris({ MONGODB_URI: uri }), (error) => {
        assert.equal(error.code, 'MONGODB_CONFIG_INVALID');
        assert.ok(!error.message.includes('db:27017'));
        return true;
      });
    });
  }
});

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
