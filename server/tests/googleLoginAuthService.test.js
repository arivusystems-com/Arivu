'use strict';

const assert = require('assert');
const {
  isGoogleLoginConfigured,
  getGoogleLoginConfig,
  LOGIN_SCOPES,
  GENERIC_PROVISION_MESSAGE,
  encodeTransferPayload,
  encodeSessionLimitPayload
} = require('../services/googleLoginAuthService');

describe('googleLoginAuthService', () => {
  const original = {
    id: process.env.GOOGLE_LOGIN_CLIENT_ID,
    secret: process.env.GOOGLE_LOGIN_CLIENT_SECRET,
    redirect: process.env.GOOGLE_LOGIN_REDIRECT_URI
  };

  afterEach(() => {
    if (original.id === undefined) delete process.env.GOOGLE_LOGIN_CLIENT_ID;
    else process.env.GOOGLE_LOGIN_CLIENT_ID = original.id;
    if (original.secret === undefined) delete process.env.GOOGLE_LOGIN_CLIENT_SECRET;
    else process.env.GOOGLE_LOGIN_CLIENT_SECRET = original.secret;
    if (original.redirect === undefined) delete process.env.GOOGLE_LOGIN_REDIRECT_URI;
    else process.env.GOOGLE_LOGIN_REDIRECT_URI = original.redirect;
  });

  it('reports not configured without env', () => {
    delete process.env.GOOGLE_LOGIN_CLIENT_ID;
    delete process.env.GOOGLE_LOGIN_CLIENT_SECRET;
    delete process.env.GOOGLE_LOGIN_REDIRECT_URI;
    assert.strictEqual(isGoogleLoginConfigured(), false);
    assert.ok(getGoogleLoginConfig().error);
  });

  it('reports configured when env present', () => {
    process.env.GOOGLE_LOGIN_CLIENT_ID = 'cid';
    process.env.GOOGLE_LOGIN_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_LOGIN_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
    assert.strictEqual(isGoogleLoginConfigured(), true);
  });

  it('uses CASA-safe login scopes only', () => {
    assert.deepStrictEqual(LOGIN_SCOPES, ['openid', 'email', 'profile']);
    assert.ok(!LOGIN_SCOPES.some((s) => /gmail|drive|calendar/i.test(s)));
  });

  it('exposes a generic provisioning message', () => {
    assert.match(GENERIC_PROVISION_MESSAGE, /provisioned/i);
  });

  it('encodes transfer payload with user token', () => {
    const encoded = encodeTransferPayload({
      _id: 'u1',
      email: 'a@b.com',
      token: 'jwt',
      organization: { _id: 'o1', name: 'Org' },
      authMethod: 'google'
    });
    const parsed = JSON.parse(decodeURIComponent(Buffer.from(encoded, 'base64').toString('utf8')));
    assert.strictEqual(parsed.user.token, 'jwt');
    assert.strictEqual(parsed.user._id, 'u1');
    assert.strictEqual(parsed.organization._id, 'o1');
    assert.strictEqual(parsed.authMethod, 'google');
  });

  it('encodes session limit payload', () => {
    const encoded = encodeSessionLimitPayload({ code: 'SESSION_LIMIT', challengeId: 'c1' });
    const parsed = JSON.parse(decodeURIComponent(Buffer.from(encoded, 'base64').toString('utf8')));
    assert.strictEqual(parsed.code, 'SESSION_LIMIT');
    assert.strictEqual(parsed.challengeId, 'c1');
  });
});
