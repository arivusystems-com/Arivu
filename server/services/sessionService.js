'use strict';

/**
 * Auth session store — JWT jti/sv validation, device-class concurrent limits, revocation.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §11
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const { parseUserAgent } = require('../utils/liveChatUserAgentUtils');
const { normalizePlatformUserType } = require('../constants/platformUserTypes');

const DEVICE_CLASS_LIMITS = Object.freeze({
  desktop: 2,
  mobile: 1
});

const LOGIN_CHALLENGE_TYP = 'login_challenge';
const LOGIN_CHALLENGE_TTL = '10m';

function normalizeSessionVersion(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function resolveMaxConcurrentSessions(organization) {
  const configured = organization?.security?.sessionRules?.maxConcurrentSessions;
  if (typeof configured === 'number' && configured > 0) {
    return configured;
  }
  return 5;
}

function classifyDeviceClass(userAgent) {
  const { deviceType } = parseUserAgent(userAgent);
  if (deviceType === 'mobile' || deviceType === 'tablet') {
    return 'mobile';
  }
  return 'desktop';
}

function hashUserAgent(userAgent) {
  const raw = String(userAgent || '').trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function resolveDeviceClassLimit(deviceClass) {
  const key = deviceClass === 'mobile' ? 'mobile' : 'desktop';
  return DEVICE_CLASS_LIMITS[key];
}

function isBlankLabel(value) {
  const raw = String(value || '').trim();
  return !raw || /^unknown$/i.test(raw);
}

function cleanUaLabel(value) {
  return isBlankLabel(value) ? null : String(value).trim();
}

function formatPublicIp(ipAddress) {
  const raw = String(ipAddress || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/^::ffff:/i, '');
  if (
    normalized === '::1'
    || normalized === '127.0.0.1'
    || normalized === '0:0:0:0:0:0:0:1'
    || normalized === 'localhost'
  ) {
    return null;
  }
  return normalized;
}

function enrichSessionLabels(session) {
  const parsed = parseUserAgent(session.userAgent);
  let deviceClass = session.deviceClass === 'mobile' ? 'mobile' : 'desktop';
  if ((!session.deviceClass || session.deviceClass === 'desktop') && session.userAgent) {
    deviceClass = classifyDeviceClass(session.userAgent);
  } else if (session.deviceClass === 'mobile') {
    deviceClass = 'mobile';
  }

  const browser = cleanUaLabel(session.browser)
    || cleanUaLabel(parsed.browserLabel)
    || cleanUaLabel(parsed.browser);
  const os = cleanUaLabel(session.os)
    || cleanUaLabel(parsed.osLabel)
    || cleanUaLabel(parsed.operatingSystem);

  return {
    deviceClass,
    browser,
    os,
    labelFallback: !browser && !os
  };
}

function serializeSessionForClient(session, options = {}) {
  const enriched = enrichSessionLabels(session);
  const lastSeenAt = session.lastSeenAt || session.issuedAt || null;
  let displayName = null;
  if (enriched.browser && enriched.os) {
    displayName = `${enriched.browser} on ${enriched.os}`;
  } else if (enriched.browser) {
    displayName = enriched.browser;
  } else if (enriched.os) {
    displayName = enriched.os;
  }

  return {
    id: session.sessionId,
    deviceClass: enriched.deviceClass,
    browser: enriched.browser,
    os: enriched.os,
    displayName,
    labelFallback: enriched.labelFallback === true,
    ipAddress: formatPublicIp(session.ipAddress),
    lastSeenAt,
    issuedAt: session.issuedAt || null,
    isRecent: options.isRecent === true,
    isOldest: options.isOldest === true,
    recommended: options.recommended === true
  };
}

function buildSessionLimitPayload(sessions, deviceClass) {
  const classKey = deviceClass === 'mobile' ? 'mobile' : 'desktop';
  const max = resolveDeviceClassLimit(classKey);
  const normalized = sessions.map((session) => serializeSessionForClient(session));

  const conflicting = normalized
    .filter((session) => session.deviceClass === classKey)
    .sort((a, b) => {
      const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bTime - aTime;
    });

  const others = normalized
    .filter((session) => session.deviceClass !== classKey)
    .sort((a, b) => {
      const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bTime - aTime;
    });

  if (conflicting.length) {
    conflicting[0].isRecent = true;
    const oldest = conflicting[conflicting.length - 1];
    oldest.isOldest = true;
    oldest.recommended = true;
  }

  const used = conflicting.length;
  const needToFree = Math.max(0, used - max + 1);

  return {
    deviceClass: classKey,
    limits: { ...DEVICE_CLASS_LIMITS },
    usage: {
      deviceClass: classKey,
      used,
      max,
      needToFree
    },
    sessions: [...conflicting, ...others]
  };
}

async function listActiveSessionsRaw(userId, organizationId) {
  return UserSession.find({
    organizationId,
    userId,
    revokedAt: null
  })
    .sort({ lastSeenAt: -1, issuedAt: -1 })
    .select('sessionId deviceClass browser os uaHash userAgent ipAddress lastSeenAt issuedAt')
    .lean();
}

async function listActiveSessions(userId, organizationId) {
  const sessions = await listActiveSessionsRaw(userId, organizationId);
  return sessions.map((session) => serializeSessionForClient(session));
}

async function listSessionsForLimitChallenge(userId, organizationId, deviceClass) {
  const sessions = await listActiveSessionsRaw(userId, organizationId);
  return buildSessionLimitPayload(sessions, deviceClass);
}

async function countActiveByDeviceClass(userId, organizationId, deviceClass) {
  const classKey = deviceClass === 'mobile' ? 'mobile' : 'desktop';
  if (classKey === 'mobile') {
    return UserSession.countDocuments({
      organizationId,
      userId,
      revokedAt: null,
      deviceClass: 'mobile'
    });
  }
  // Legacy rows without deviceClass count as desktop
  return UserSession.countDocuments({
    organizationId,
    userId,
    revokedAt: null,
    $or: [{ deviceClass: 'desktop' }, { deviceClass: { $exists: false } }, { deviceClass: null }]
  });
}

async function revokeMatchingUaSessions(userId, organizationId, uaHash) {
  if (!uaHash) return 0;
  const result = await UserSession.updateMany(
    {
      organizationId,
      userId,
      revokedAt: null,
      uaHash
    },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount || 0;
}

/**
 * Admit a new session or signal SESSION_LIMIT (after same-UA reuse revoke).
 * Does not auto-evict other devices — caller must challenge the user.
 */
async function admitOrBlockAuthSession(user, organization, meta = {}) {
  const organizationId = organization?._id || user.organizationId;
  const userAgent = meta.userAgent || null;
  const deviceClass = classifyDeviceClass(userAgent);
  const parsed = parseUserAgent(userAgent);
  const uaHash = hashUserAgent(userAgent);

  await revokeMatchingUaSessions(user._id, organizationId, uaHash);

  const activeCount = await countActiveByDeviceClass(user._id, organizationId, deviceClass);
  const max = resolveDeviceClassLimit(deviceClass);

  if (activeCount >= max) {
    const limitPayload = await listSessionsForLimitChallenge(user._id, organizationId, deviceClass);
    return {
      ok: false,
      code: 'SESSION_LIMIT',
      ...limitPayload
    };
  }

  const jti = crypto.randomUUID();
  const sessionVersion = normalizeSessionVersion(user.authSessionVersion);

  await UserSession.create({
    organizationId,
    userId: user._id,
    sessionId: jti,
    authSessionVersion: sessionVersion,
    userType: normalizePlatformUserType(user.userType, {
      isOwner: user.isOwner,
      roleName: user.role
    }),
    deviceClass,
    browser: cleanUaLabel(parsed.browserLabel) || cleanUaLabel(parsed.browser),
    os: cleanUaLabel(parsed.osLabel) || cleanUaLabel(parsed.operatingSystem),
    uaHash,
    ipAddress: meta.ip || null,
    userAgent,
    issuedAt: new Date(),
    lastSeenAt: new Date()
  });

  return {
    ok: true,
    jti,
    sessionVersion,
    deviceClass
  };
}

/** @deprecated Prefer admitOrBlockAuthSession — kept for callers that expect create-then-enforce */
async function issueAuthSession(user, organization, meta = {}) {
  const result = await admitOrBlockAuthSession(user, organization, meta);
  if (!result.ok) {
    const err = new Error('SESSION_LIMIT');
    err.code = 'SESSION_LIMIT';
    err.deviceClass = result.deviceClass;
    err.limits = result.limits;
    err.sessions = result.sessions;
    throw err;
  }
  return { jti: result.jti, sessionVersion: result.sessionVersion };
}

async function enforceConcurrentSessionLimit() {
  // Device-class limits are enforced at admit time (block + user revoke).
  // FIFO auto-evict removed to match product policy.
}

async function touchAuthSession(sessionId) {
  if (!sessionId) {
    return;
  }
  await UserSession.updateOne(
    { sessionId, revokedAt: null },
    { $set: { lastSeenAt: new Date() } }
  ).catch(() => {});
}

async function validateAuthSession(user, decoded) {
  const tokenSv = decoded?.sv;
  const tokenJti = decoded?.jti;
  const userSv = normalizeSessionVersion(user.authSessionVersion);

  if (tokenSv == null && !tokenJti) {
    return { ok: true, legacy: true };
  }

  if (tokenSv != null && normalizeSessionVersion(tokenSv) !== userSv) {
    return { ok: false, code: 'SESSION_REVOKED' };
  }

  if (tokenJti) {
    // Match by sessionId only first — userId ObjectId identity can differ slightly
    // across BSON serializations while remaining the same user.
    const session = await UserSession.findOne({
      sessionId: String(tokenJti),
      revokedAt: null
    })
      .select('_id userId')
      .lean();

    if (!session) {
      return { ok: false, code: 'SESSION_INVALID' };
    }

    if (user?._id && session.userId && String(session.userId) !== String(user._id)) {
      return { ok: false, code: 'SESSION_INVALID' };
    }

    void touchAuthSession(tokenJti);
  }

  return { ok: true };
}

async function revokeSessionById(userId, organizationId, sessionId) {
  if (!sessionId) {
    return { ok: false, revoked: false };
  }
  const result = await UserSession.updateOne(
    {
      sessionId: String(sessionId),
      userId,
      organizationId,
      revokedAt: null
    },
    { $set: { revokedAt: new Date() } }
  );
  return { ok: true, revoked: (result.modifiedCount || 0) > 0 };
}

async function revokeAllUserSessions(user, organizationId) {
  const nextVersion = normalizeSessionVersion(user.authSessionVersion) + 1;
  user.authSessionVersion = nextVersion;
  await user.save();

  const orgId = organizationId || user.organizationId;
  await UserSession.updateMany(
    { organizationId: orgId, userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { authSessionVersion: nextVersion };
}

async function revokeUserSessionsByUserId(userId, organizationId, tenantOrg) {
  const { getScopedUserModel } = require('./userInviteService');
  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(userId);
  if (!user) {
    return { ok: false, revoked: false };
  }

  const result = await revokeAllUserSessions(user, organizationId);
  return { ok: true, revoked: true, ...result };
}

function createLoginChallenge({ userId, organizationId, deviceClass, email }) {
  if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set!');
  }
  return jwt.sign(
    {
      typ: LOGIN_CHALLENGE_TYP,
      uid: String(userId),
      oid: String(organizationId),
      dc: deviceClass === 'mobile' ? 'mobile' : 'desktop',
      email: String(email || '').toLowerCase().trim()
    },
    process.env.JWT_SECRET,
    { expiresIn: LOGIN_CHALLENGE_TTL }
  );
}

function verifyLoginChallenge(challengeId) {
  if (!challengeId || !process.env.JWT_SECRET) {
    return null;
  }
  try {
    const decoded = jwt.verify(String(challengeId), process.env.JWT_SECRET);
    if (decoded?.typ !== LOGIN_CHALLENGE_TYP || !decoded.uid || !decoded.oid) {
      return null;
    }
    return {
      userId: decoded.uid,
      organizationId: decoded.oid,
      deviceClass: decoded.dc === 'mobile' ? 'mobile' : 'desktop',
      email: decoded.email || null
    };
  } catch (_err) {
    return null;
  }
}

module.exports = {
  DEVICE_CLASS_LIMITS,
  normalizeSessionVersion,
  resolveMaxConcurrentSessions,
  classifyDeviceClass,
  listActiveSessions,
  listSessionsForLimitChallenge,
  buildSessionLimitPayload,
  admitOrBlockAuthSession,
  issueAuthSession,
  enforceConcurrentSessionLimit,
  validateAuthSession,
  touchAuthSession,
  revokeSessionById,
  revokeAllUserSessions,
  revokeUserSessionsByUserId,
  createLoginChallenge,
  verifyLoginChallenge
};
