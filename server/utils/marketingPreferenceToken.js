'use strict';

const crypto = require('crypto');

const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret =
    process.env.MARKETING_PREFERENCE_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'dev-marketing-preference-secret';
  return String(secret);
}

function resolveClientBaseUrl(req) {
  const origin = req?.get?.('origin');
  if (origin && /^https?:\/\//i.test(origin)) {
    return String(origin).replace(/\/$/, '');
  }
  const { resolveClientUrl } = require('./clientUrl');
  return resolveClientUrl([process.env.CLIENT_URL, process.env.PUBLIC_APP_URL]);
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.email
 * @param {string} [params.personId]
 * @param {string} [params.campaignId]
 * @param {number} [params.exp]
 */
function createPreferenceToken(params) {
  const email = String(params.email || '').trim().toLowerCase();
  if (!email || !params.organizationId) {
    throw new Error('organizationId and email are required for preference token');
  }

  const body = {
    o: String(params.organizationId),
    e: email,
    ...(params.personId ? { p: String(params.personId) } : {}),
    ...(params.campaignId ? { c: String(params.campaignId) } : {}),
    exp: params.exp || Date.now() + DEFAULT_TTL_MS
  };

  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

/**
 * @param {string} token
 */
function verifyPreferenceToken(token) {
  const raw = String(token || '').trim();
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) {
    throw new Error('Invalid preference token');
  }

  const encoded = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid preference token');
  }

  /** @type {{ o: string, e: string, p?: string, c?: string, exp?: number }} */
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.o || !payload?.e) {
    throw new Error('Invalid preference token payload');
  }
  if (payload.exp && Number(payload.exp) <= Date.now()) {
    throw new Error('Preference token expired');
  }

  return {
    organizationId: payload.o,
    email: String(payload.e).trim().toLowerCase(),
    personId: payload.p ? String(payload.p) : null,
    campaignId: payload.c ? String(payload.c) : null,
    exp: payload.exp || null
  };
}

function buildPreferenceCenterUrl(token, req) {
  const base = resolveClientBaseUrl(req);
  return `${base}/marketing/preferences/${encodeURIComponent(token)}`;
}

function buildUnsubscribeUrl(token, req) {
  const base = resolveClientBaseUrl(req);
  return `${base}/marketing/preferences/${encodeURIComponent(token)}?action=unsubscribe`;
}

module.exports = {
  DEFAULT_TTL_MS,
  createPreferenceToken,
  verifyPreferenceToken,
  resolveClientBaseUrl,
  buildPreferenceCenterUrl,
  buildUnsubscribeUrl
};
