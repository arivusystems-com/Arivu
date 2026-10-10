'use strict';

const jwt = require('jsonwebtoken');
const UserCalendarConnection = require('../models/UserCalendarConnection');
const { getGmailOAuthAppCredentialsForServer } = require('../platform/communication/config/communicationConfigService');
const { encryptTenantSecret, decryptTenantSecret } = require('../utils/tenantSecretCrypto');
const { loadGoogleapis } = require('../utils/loadGoogleapis');

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

const MICROSOFT_SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite'
];

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function oauthClientBaseUrl() {
  const { resolveClientUrl } = require('../utils/clientUrl');
  return resolveClientUrl();
}

async function getGoogleOAuthClient(organizationId) {
  const creds = await getGmailOAuthAppCredentialsForServer(organizationId);
  if (creds.error) return { error: creds.error };
  let google;
  try {
    google = loadGoogleapis().google;
  } catch (err) {
    return { error: err.message };
  }
  const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
  return { google, oauth2Client, redirectUri: creds.redirectUri };
}

function googleUserCalendarRedirectUri(apiRedirectUri) {
  try {
    const u = new URL(apiRedirectUri);
    return `${u.origin}/api/user/calendar-connections/google/callback`;
  } catch {
    return '';
  }
}

function resolveMicrosoftOAuthOrigin() {
  const explicit = String(process.env.MICROSOFT_CALENDAR_REDIRECT_URI || '').trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }
  const gmailRedirect = String(process.env.GOOGLE_GMAIL_REDIRECT_URI || '').trim();
  if (gmailRedirect) {
    try {
      return new URL(gmailRedirect).origin;
    } catch {
      /* fall through */
    }
  }
  const apiPublic = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (apiPublic) return apiPublic;
  return 'http://localhost:3000';
}

function microsoftUserCalendarRedirectUri() {
  return `${resolveMicrosoftOAuthOrigin()}/api/user/calendar-connections/microsoft/callback`;
}

function getMicrosoftOAuthConfig() {
  const clientId = String(process.env.MICROSOFT_CALENDAR_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || '').trim();
  const tenantId = String(process.env.MICROSOFT_CALENDAR_TENANT_ID || 'common').trim() || 'common';
  if (!clientId || !clientSecret) {
    return {
      error:
        'Microsoft Calendar is not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET on the API server.'
    };
  }
  return { clientId, clientSecret, tenantId };
}

function isMicrosoftCalendarConfigured() {
  return !getMicrosoftOAuthConfig().error;
}

async function buildGoogleAuthorizeUrl({ userId, organizationId }) {
  const r = await getGoogleOAuthClient(organizationId);
  if (r.error) return { error: r.error };
  const { oauth2Client, redirectUri: gmailRedirect } = r;
  const redirectUri = googleUserCalendarRedirectUri(gmailRedirect);
  if (!redirectUri) return { error: 'Google OAuth redirect URI is not configured.' };
  oauth2Client.redirectUri = redirectUri;

  if (!process.env.JWT_SECRET) {
    return { error: 'JWT_SECRET is required for OAuth state signing.' };
  }

  const state = jwt.sign(
    { uid: String(userId), oid: String(organizationId), provider: 'google', flow: 'user_calendar' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
    state
  });
  return { url, redirectUri };
}

async function completeGoogleOAuthCallback({ code, state }) {
  let payload;
  try {
    payload = jwt.verify(String(state || ''), process.env.JWT_SECRET);
  } catch {
    return { ok: false, error: 'Invalid or expired OAuth state' };
  }

  const userId = payload.uid;
  const organizationId = payload.oid;
  if (!userId || !organizationId || payload.flow !== 'user_calendar') {
    return { ok: false, error: 'OAuth state missing context' };
  }

  const r = await getGoogleOAuthClient(organizationId);
  if (r.error) return { ok: false, error: r.error };
  const { google, oauth2Client, redirectUri: gmailRedirect } = r;
  oauth2Client.redirectUri = googleUserCalendarRedirectUri(gmailRedirect);

  const { tokens } = await oauth2Client.getToken(String(code || ''));
  if (!tokens?.refresh_token) {
    return {
      ok: false,
      error:
        'No refresh token returned. Disconnect the app in Google account settings and try again.'
    };
  }

  oauth2Client.setCredentials(tokens);

  let accountEmail = '';
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    accountEmail = String(profile.email || '').toLowerCase().trim();
  } catch (err) {
    return { ok: false, error: `Google Calendar connection failed: ${err.message}` };
  }

  const connection = await UserCalendarConnection.findOneAndUpdate(
    { organizationId, userId, provider: 'google' },
    {
      $set: {
        encryptedRefreshToken: encryptTenantSecret(tokens.refresh_token),
        accountEmail,
        connectedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Near real-time Google → Arivu: register watch + initial pull (non-blocking for redirect)
  setImmediate(() => {
    const {
      ensureGoogleInboundForConnection
    } = require('./userCalendarInboundSyncService');
    ensureGoogleInboundForConnection(connection).catch((err) => {
      console.warn('[userCalendar] inbound bootstrap failed:', err.message);
    });
  });

  return { ok: true, accountEmail, provider: 'google' };
}

async function buildMicrosoftAuthorizeUrl({ userId, organizationId }) {
  const creds = getMicrosoftOAuthConfig();
  if (creds.error) return { error: creds.error };
  if (!process.env.JWT_SECRET) {
    return { error: 'JWT_SECRET is required for OAuth state signing.' };
  }

  const redirectUri = microsoftUserCalendarRedirectUri();
  const state = jwt.sign(
    { uid: String(userId), oid: String(organizationId), provider: 'microsoft', flow: 'user_calendar' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES.join(' '),
    state,
    prompt: 'consent'
  });

  return {
    url: `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/authorize?${params.toString()}`,
    redirectUri
  };
}

async function exchangeMicrosoftCode(code) {
  const creds = getMicrosoftOAuthConfig();
  if (creds.error) return { error: creds.error };

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: String(code || ''),
    redirect_uri: microsoftUserCalendarRedirectUri(),
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPES.join(' ')
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error_description || data.error || `Token exchange failed (${res.status})` };
  }
  if (!data.refresh_token) {
    return {
      error:
        'No refresh token returned. Disconnect the app in your Microsoft account and connect again with consent.'
    };
  }
  return { tokens: data };
}

async function graphRequest(accessToken, path, options = {}) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Graph API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function completeMicrosoftOAuthCallback({ code, state }) {
  let payload;
  try {
    payload = jwt.verify(String(state || ''), process.env.JWT_SECRET);
  } catch {
    return { ok: false, error: 'Invalid or expired OAuth state' };
  }

  const userId = payload.uid;
  const organizationId = payload.oid;
  if (!userId || !organizationId || payload.flow !== 'user_calendar') {
    return { ok: false, error: 'OAuth state missing context' };
  }

  const tokenResult = await exchangeMicrosoftCode(code);
  if (tokenResult.error) return { ok: false, error: tokenResult.error };

  let accountEmail = '';
  try {
    const profile = await graphRequest(
      tokenResult.tokens.access_token,
      '/me?$select=mail,userPrincipalName'
    );
    accountEmail = String(profile.mail || profile.userPrincipalName || '')
      .toLowerCase()
      .trim();
  } catch (err) {
    return { ok: false, error: `Microsoft connection failed: ${err.message}` };
  }

  await UserCalendarConnection.findOneAndUpdate(
    { organizationId, userId, provider: 'microsoft' },
    {
      $set: {
        encryptedRefreshToken: encryptTenantSecret(tokenResult.tokens.refresh_token),
        accountEmail,
        connectedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { ok: true, accountEmail, provider: 'microsoft' };
}

async function disconnectProvider({ organizationId, userId, provider }) {
  if (provider === 'google') {
    try {
      const { teardownGoogleInboundForUser } = require('./userCalendarInboundSyncService');
      await teardownGoogleInboundForUser({ organizationId, userId });
    } catch (err) {
      console.warn('[userCalendar] teardown inbound failed:', err.message);
    }
  }

  await UserCalendarConnection.findOneAndUpdate(
    { organizationId, userId, provider },
    {
      $set: {
        encryptedRefreshToken: '',
        accountEmail: '',
        connectedAt: null,
        googleSyncToken: '',
        googleWatchChannelId: '',
        googleWatchResourceId: '',
        googleWatchExpiration: null,
        googleWebhookToken: '',
        inboundSyncLockUntil: null,
        lastInboundSyncAt: null,
        lastInboundSyncError: ''
      }
    }
  );
}

async function isGoogleCalendarConfigured(organizationId) {
  const r = await getGmailOAuthAppCredentialsForServer(organizationId);
  return !r.error;
}

async function listConnectionStatus({ organizationId, userId }) {
  const rows = await UserCalendarConnection.find({ organizationId, userId }).lean();
  const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]));

  const google = byProvider.google;
  const microsoft = byProvider.microsoft;
  const googleAvailable = await isGoogleCalendarConfigured(organizationId);

  // Existing connections: bootstrap/renew inbound when needed (not on every list poll)
  if (google?.encryptedRefreshToken && String(google.encryptedRefreshToken).trim()) {
    const exp = google.googleWatchExpiration ? new Date(google.googleWatchExpiration).getTime() : 0;
    const lastSync = google.lastInboundSyncAt ? new Date(google.lastInboundSyncAt).getTime() : 0;
    const needsInbound =
      !google.googleSyncToken ||
      !google.googleWatchChannelId ||
      !exp ||
      exp < Date.now() + 24 * 60 * 60 * 1000 ||
      !lastSync ||
      Date.now() - lastSync > 5 * 60 * 1000;
    if (needsInbound) {
      const { ensureGoogleInboundForUser } = require('./userCalendarInboundSyncService');
      ensureGoogleInboundForUser({ organizationId, userId }).catch(() => {});
    }
  }

  return {
    connectors: [
      {
        id: 'google',
        provider: 'google',
        label: 'Google',
        available: googleAvailable,
        connected: !!(google?.encryptedRefreshToken && String(google.encryptedRefreshToken).trim()),
        accountEmail: google?.accountEmail || null,
        connectedAt: google?.connectedAt || null
      },
      {
        id: 'microsoft',
        provider: 'microsoft',
        label: 'Microsoft 365',
        available: isMicrosoftCalendarConfigured(),
        connected: !!(
          microsoft?.encryptedRefreshToken && String(microsoft.encryptedRefreshToken).trim()
        ),
        accountEmail: microsoft?.accountEmail || null,
        connectedAt: microsoft?.connectedAt || null
      },
      {
        id: 'zoom',
        provider: 'zoom',
        label: 'Zoom',
        available: false,
        comingSoon: true,
        connected: false,
        accountEmail: null,
        connectedAt: null
      },
      {
        id: 'jio_meet',
        provider: 'jio_meet',
        label: 'Jio Meet',
        available: false,
        comingSoon: true,
        connected: false,
        accountEmail: null,
        connectedAt: null
      }
    ]
  };
}

async function getConnection(organizationId, userId, provider) {
  return UserCalendarConnection.findOne({ organizationId, userId, provider });
}

async function getGoogleCalendarClient(connection) {
  const refreshToken = decryptTenantSecret(connection?.encryptedRefreshToken);
  if (!refreshToken) return { error: 'Google Calendar is not connected' };

  const r = await getGoogleOAuthClient(connection.organizationId);
  if (r.error) return { error: r.error };
  const { google, oauth2Client, redirectUri: gmailRedirect } = r;
  oauth2Client.redirectUri = googleUserCalendarRedirectUri(gmailRedirect);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return {
    google,
    oauth2Client,
    calendar: google.calendar({ version: 'v3', auth: oauth2Client })
  };
}

async function refreshMicrosoftAccessToken(refreshToken) {
  const creds = getMicrosoftOAuthConfig();
  if (creds.error) return { error: creds.error };

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_SCOPES.join(' ')
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error_description || data.error || `Token refresh failed (${res.status})` };
  }
  return { accessToken: data.access_token };
}

async function getMicrosoftAccessToken(connection) {
  const refreshToken = decryptTenantSecret(connection?.encryptedRefreshToken);
  if (!refreshToken) return { error: 'Microsoft Calendar is not connected' };
  return refreshMicrosoftAccessToken(refreshToken);
}

function redirectAfterOAuth({ provider, ok, error }) {
  const base = oauthClientBaseUrl();
  if (ok) {
    return `${base}/events?calendarSync=connected&provider=${encodeURIComponent(provider)}`;
  }
  const msg = encodeURIComponent(String(error || 'oauth_failed').slice(0, 800));
  return `${base}/events?calendarSync=error&provider=${encodeURIComponent(provider)}&message=${msg}`;
}

module.exports = {
  buildGoogleAuthorizeUrl,
  completeGoogleOAuthCallback,
  buildMicrosoftAuthorizeUrl,
  completeMicrosoftOAuthCallback,
  disconnectProvider,
  listConnectionStatus,
  getConnection,
  getGoogleCalendarClient,
  getMicrosoftAccessToken,
  graphRequest,
  isGoogleCalendarConfigured,
  isMicrosoftCalendarConfigured,
  redirectAfterOAuth,
  oauthClientBaseUrl
};
