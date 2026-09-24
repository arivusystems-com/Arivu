'use strict';

/**
 * Google Sign-In (CRM web login only).
 * Identity method — not provisioning. Scopes: openid email profile only (no CASA).
 * Uses dedicated GOOGLE_LOGIN_* credentials — never Calendar/Gmail OAuth clients.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const { loadGoogleapis } = require('../utils/loadGoogleapis');

const LOGIN_SCOPES = ['openid', 'email', 'profile'];
const ORG_LOGIN_SELECT = 'name industry subscription limits enabledApps enabledModules settings isActive database security';
const STATE_TTL = '10m';
const GENERIC_PROVISION_MESSAGE =
  "Your Arivu account hasn't been provisioned yet. Please contact your administrator.";

function getGoogleLoginConfig() {
  const clientId = String(process.env.GOOGLE_LOGIN_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_LOGIN_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_LOGIN_REDIRECT_URI || '').trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return {
      error:
        'Google Sign-In is not configured. Set GOOGLE_LOGIN_CLIENT_ID, GOOGLE_LOGIN_CLIENT_SECRET, and GOOGLE_LOGIN_REDIRECT_URI.'
    };
  }
  return { clientId, clientSecret, redirectUri };
}

function isGoogleLoginConfigured() {
  return !getGoogleLoginConfig().error;
}

function clientLoginBaseUrl() {
  let base = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (!base) base = 'http://localhost:5173';
  return base;
}

function getOAuth2Client() {
  const config = getGoogleLoginConfig();
  if (config.error) return { error: config.error };
  let google;
  try {
    google = loadGoogleapis().google;
  } catch (err) {
    return { error: err.message };
  }
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
  return { google, oauth2Client, redirectUri: config.redirectUri, clientId: config.clientId };
}

function signOAuthState(extra = {}) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for Google Sign-In state.');
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { flow: 'google_login', nonce, ...extra },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL }
  );
}

function verifyOAuthState(state) {
  if (!state || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(String(state), process.env.JWT_SECRET);
    if (payload?.flow !== 'google_login') return null;
    return payload;
  } catch {
    return null;
  }
}

function buildAuthorizeUrl() {
  const r = getOAuth2Client();
  if (r.error) return { error: r.error };
  const state = signOAuthState();
  const url = r.oauth2Client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: LOGIN_SCOPES,
    state
  });
  return { url, state };
}

/**
 * Exchange code, verify id_token, require email_verified.
 * @returns {{ ok: true, subject, email, emailVerified, name } | { ok: false, reason, message }}
 */
async function exchangeCodeAndVerifyIdentity(code) {
  const r = getOAuth2Client();
  if (r.error) {
    return { ok: false, reason: 'NOT_CONFIGURED', message: r.error };
  }
  if (!code) {
    return { ok: false, reason: 'MISSING_CODE', message: GENERIC_PROVISION_MESSAGE };
  }

  let tokens;
  try {
    const tokenResponse = await r.oauth2Client.getToken(String(code));
    tokens = tokenResponse.tokens;
  } catch (err) {
    return {
      ok: false,
      reason: 'TOKEN_EXCHANGE_FAILED',
      message: GENERIC_PROVISION_MESSAGE,
      detail: err.message
    };
  }

  const idToken = tokens?.id_token;
  if (!idToken) {
    return { ok: false, reason: 'MISSING_ID_TOKEN', message: GENERIC_PROVISION_MESSAGE };
  }

  let ticket;
  try {
    ticket = await r.oauth2Client.verifyIdToken({
      idToken,
      audience: r.clientId
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'ID_TOKEN_INVALID',
      message: GENERIC_PROVISION_MESSAGE,
      detail: err.message
    };
  }

  const payload = ticket.getPayload() || {};
  const subject = String(payload.sub || '').trim();
  const email = String(payload.email || '').toLowerCase().trim();
  const emailVerified = payload.email_verified === true;

  if (!subject || !email) {
    return { ok: false, reason: 'IDENTITY_INCOMPLETE', message: GENERIC_PROVISION_MESSAGE };
  }
  if (!emailVerified) {
    return { ok: false, reason: 'EMAIL_NOT_VERIFIED', message: GENERIC_PROVISION_MESSAGE };
  }

  return {
    ok: true,
    subject,
    email,
    emailVerified: true,
    name: payload.name || null
  };
}

function getOrgUserModel(orgDbConnection) {
  if (orgDbConnection.models.User) {
    return orgDbConnection.models.User;
  }
  const mongoose = require('mongoose');
  const originalSchema = User.schema;
  const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);
  if (originalSchema.methods) {
    Object.keys(originalSchema.methods).forEach((methodName) => {
      UserSchema.methods[methodName] = originalSchema.methods[methodName];
    });
  }
  if (originalSchema.statics) {
    Object.keys(originalSchema.statics).forEach((staticName) => {
      UserSchema.statics[staticName] = originalSchema.statics[staticName];
    });
  }
  return orgDbConnection.model('User', UserSchema);
}

async function findUserByGoogleSubject(subject) {
  const master = await User.findOne({
    authIdentities: { $elemMatch: { provider: 'google', subject } }
  })
    .populate('organizationId', ORG_LOGIN_SELECT)
    .populate(
      'roleId',
      'name description color icon level permissions canViewAllData canManageTeam canExportData isSystemRole'
    );

  if (master) {
    return { masterUser: master, organizationFromDirectory: null, matchedBy: 'subject' };
  }

  // Tenant-only users: scan directory orgs with dedicated DBs (bounded by initialized tenants).
  const tenantOrgs = await Organization.find({
    'database.initialized': true,
    'database.name': { $exists: true, $ne: null }
  }).select('_id name industry subscription limits enabledApps enabledModules settings isActive database security');

  const dbConnectionManager = require('../utils/databaseConnectionManager');
  for (const tenantOrg of tenantOrgs) {
    try {
      const orgDbConnection = await dbConnectionManager.getOrganizationConnection(tenantOrg.database.name);
      const OrgUser = getOrgUserModel(orgDbConnection);
      const discovered = await OrgUser.findOne({
        authIdentities: { $elemMatch: { provider: 'google', subject } }
      });
      if (discovered) {
        return {
          masterUser: null,
          organizationFromDirectory: tenantOrg,
          tenantUser: discovered,
          matchedBy: 'subject'
        };
      }
    } catch (err) {
      console.warn(`[GoogleLogin] Tenant subject scan skipped for ${tenantOrg.database?.name}:`, err.message);
    }
  }

  return null;
}

/**
 * Same resolution path as password login (master User → directory → tenant discovery).
 */
async function resolveUserByEmail(normalizedEmail) {
  let user = await User.findOne({ email: normalizedEmail })
    .populate('organizationId', ORG_LOGIN_SELECT)
    .populate(
      'roleId',
      'name description color icon level permissions canViewAllData canManageTeam canExportData isSystemRole'
    );

  let organizationFromDirectory = null;
  if (!user) {
    const directoryEntry = await UserDirectory.findOne({ email: normalizedEmail, status: 'active' })
      .populate('organizationId', ORG_LOGIN_SELECT);
    if (directoryEntry?.organizationId) {
      organizationFromDirectory = directoryEntry.organizationId;
    }
  }

  if (!user && !organizationFromDirectory) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const tenantOrgs = await Organization.find({
      'database.initialized': true,
      'database.name': { $exists: true, $ne: null }
    }).select('_id name industry subscription limits enabledApps enabledModules settings isActive database security');

    for (const tenantOrg of tenantOrgs) {
      try {
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(tenantOrg.database.name);
        const OrgUser = getOrgUserModel(orgDbConnection);
        const discoveredUser = await OrgUser.findOne({ email: normalizedEmail }).select('_id');
        if (discoveredUser) {
          organizationFromDirectory = tenantOrg;
          await UserDirectory.findOneAndUpdate(
            { email: normalizedEmail },
            {
              $set: {
                organizationId: tenantOrg._id,
                tenantDatabaseName: tenantOrg.database.name,
                tenantUserId: discoveredUser._id,
                status: 'active'
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          break;
        }
      } catch (discoveryError) {
        console.warn(`[GoogleLogin] Tenant discovery skipped for ${tenantOrg.database?.name}:`, discoveryError.message);
      }
    }
  }

  if (!user && !organizationFromDirectory) {
    return null;
  }

  let orgUser = user;
  const organizationForLogin = user?.organizationId || organizationFromDirectory;
  if (organizationForLogin?.database?.name && organizationForLogin.database.initialized) {
    try {
      const dbConnectionManager = require('../utils/databaseConnectionManager');
      const orgDbConnection = await dbConnectionManager.getOrganizationConnection(
        organizationForLogin.database.name
      );
      const OrgUser = getOrgUserModel(orgDbConnection);
      const orgDbUser = await OrgUser.findOne({ email: normalizedEmail });
      if (orgDbUser) {
        orgUser = orgDbUser;
      }
    } catch (orgDbError) {
      console.error('[GoogleLogin] Org DB access failed:', orgDbError.message);
      orgUser = user;
    }
  }

  if (!orgUser) {
    return null;
  }

  return {
    masterUser: user,
    orgUser,
    organizationForLogin,
    matchedBy: 'email'
  };
}

async function resolveLoginUserFromGoogleIdentity({ subject, email }) {
  const bySubject = await findUserByGoogleSubject(subject);
  if (bySubject?.tenantUser) {
    return {
      masterUser: bySubject.masterUser,
      orgUser: bySubject.tenantUser,
      organizationForLogin: bySubject.organizationFromDirectory,
      matchedBy: 'subject'
    };
  }
  if (bySubject?.masterUser) {
    const master = bySubject.masterUser;
    let orgUser = master;
    const organizationForLogin = master.organizationId;
    if (organizationForLogin?.database?.name && organizationForLogin.database.initialized) {
      try {
        const dbConnectionManager = require('../utils/databaseConnectionManager');
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(
          organizationForLogin.database.name
        );
        const OrgUser = getOrgUserModel(orgDbConnection);
        const orgDbUser = await OrgUser.findOne({
          $or: [
            { authIdentities: { $elemMatch: { provider: 'google', subject } } },
            { email: master.email }
          ]
        });
        if (orgDbUser) orgUser = orgDbUser;
      } catch (err) {
        console.warn('[GoogleLogin] Org user load by subject failed:', err.message);
      }
    }
    return {
      masterUser: master,
      orgUser,
      organizationForLogin,
      matchedBy: 'subject'
    };
  }

  return resolveUserByEmail(email);
}

/**
 * Upsert google + subject on user doc(s). Does not change password or authProvider.
 */
async function linkGoogleIdentity(userDoc, { subject, email }) {
  if (!userDoc) return { ok: true };
  const identities = Array.isArray(userDoc.authIdentities) ? [...userDoc.authIdentities] : [];
  const sameSubject = identities.find(
    (i) => i.provider === 'google' && String(i.subject) === String(subject)
  );
  if (sameSubject) {
    return { ok: true, alreadyLinked: true };
  }
  const otherGoogle = identities.find((i) => i.provider === 'google');
  if (otherGoogle && String(otherGoogle.subject) !== String(subject)) {
    return { ok: false, reason: 'IDENTITY_CONFLICT' };
  }
  // Subject claimed by another user?
  const claimed = await User.findOne({
    _id: { $ne: userDoc._id },
    authIdentities: { $elemMatch: { provider: 'google', subject } }
  }).select('_id').lean();
  if (claimed) {
    return { ok: false, reason: 'IDENTITY_CONFLICT' };
  }

  identities.push({
    provider: 'google',
    subject: String(subject),
    linkedAt: new Date(),
    emailAtLink: email || null
  });
  userDoc.authIdentities = identities;
  return { ok: true, alreadyLinked: false };
}

async function persistGoogleLink({ orgUser, masterUser, subject, email }) {
  const linkOrg = await linkGoogleIdentity(orgUser, { subject, email });
  if (!linkOrg.ok) return linkOrg;

  if (masterUser && masterUser !== orgUser && String(masterUser._id) !== String(orgUser._id)) {
    const linkMaster = await linkGoogleIdentity(masterUser, { subject, email });
    if (!linkMaster.ok) return linkMaster;
    if (!linkMaster.alreadyLinked) {
      await masterUser.save();
    }
  } else if (masterUser && masterUser === orgUser && !linkOrg.alreadyLinked) {
    // saved with orgUser below
  }

  if (!linkOrg.alreadyLinked) {
    await orgUser.save();
  }
  return { ok: true };
}

function buildClientLoginRedirect(query = {}, hash = null) {
  const url = new URL('/login', `${clientLoginBaseUrl()}/`);
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  if (hash) {
    url.hash = hash.startsWith('#') ? hash.slice(1) : hash;
  }
  return url.toString();
}

function encodeTransferPayload(sessionPayload) {
  const {
    organization = null,
    trial = null,
    instance = null,
    onboarding = null,
    authMethod = 'google',
    ...userFields
  } = sessionPayload || {};
  const payload = {
    user: userFields,
    organization,
    trial,
    instance,
    onboarding,
    transferredAt: Date.now(),
    authMethod
  };
  return Buffer.from(encodeURIComponent(JSON.stringify(payload)), 'utf8').toString('base64');
}

function encodeSessionLimitPayload(body) {
  return Buffer.from(encodeURIComponent(JSON.stringify(body)), 'utf8').toString('base64');
}

module.exports = {
  LOGIN_SCOPES,
  GENERIC_PROVISION_MESSAGE,
  getGoogleLoginConfig,
  isGoogleLoginConfigured,
  clientLoginBaseUrl,
  buildAuthorizeUrl,
  verifyOAuthState,
  exchangeCodeAndVerifyIdentity,
  resolveLoginUserFromGoogleIdentity,
  persistGoogleLink,
  buildClientLoginRedirect,
  encodeTransferPayload,
  encodeSessionLimitPayload,
  getOrgUserModel
};
