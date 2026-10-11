'use strict';

/**
 * Per-mailbox outbound SMTP (direct provider connection — no org gmail-smtp relay required).
 */

const Mailbox = require('../models/Mailbox');
const { encryptTenantSecret, decryptTenantSecret } = require('../utils/tenantSecretCrypto');
const {
  SMTP_PROVIDERS,
  detectSmtpProvider,
  resolveSmtpPreset,
  isConsumerDomain,
  extractEmailDomain
} = require('../constants/smtpProviderPresets');

const VERIFY_STATUS = Object.freeze({
  CONNECTED: 'CONNECTED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TLS_ERROR: 'TLS_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  HOST_NOT_FOUND: 'HOST_NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
});

function classifySmtpError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toUpperCase();
  if (
    // Whole reply codes only: socket errors embed host:port (e.g. "connect ECONNRESET 127.0.0.1:45351").
    /invalid.?login|authentication|\b53[45]\b|auth/i.test(msg)
    || code === 'EAUTH'
  ) {
    return VERIFY_STATUS.INVALID_CREDENTIALS;
  }
  if (/certificate|tls|ssl|secure/i.test(msg)) {
    return VERIFY_STATUS.TLS_ERROR;
  }
  if (code === 'ENOTFOUND' || /getaddrinfo|host not found|dns/i.test(msg)) {
    return VERIFY_STATUS.HOST_NOT_FOUND;
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || /timeout/i.test(msg)) {
    return VERIFY_STATUS.TIMEOUT;
  }
  // Nodemailer wraps socket failures as ESOCKET and early disconnects as ECONNECTION.
  if (
    ['ECONNREFUSED', 'ECONNRESET', 'ECONNECTION', 'ESOCKET'].includes(code)
    || /network|econn|connection closed/i.test(msg)
  ) {
    return VERIFY_STATUS.NETWORK_ERROR;
  }
  if (/auth.*required|must authenticate/i.test(msg)) {
    return VERIFY_STATUS.AUTH_REQUIRED;
  }
  return VERIFY_STATUS.UNKNOWN;
}

function isMailboxSmtpChannel(channel) {
  const c = String(channel || '').trim().toLowerCase();
  return c === 'smtp' || c === 'gmail_smtp';
}

function isMailboxSmtpReady(mailboxLean) {
  if (!mailboxLean) return false;
  const enc = String(mailboxLean.smtpOutboundEncryptedAppPassword || '').trim();
  if (!enc) return false;
  const email = String(mailboxLean.emailAddress || mailboxLean.inboxSyncAccountEmail || '')
    .trim()
    .toLowerCase();
  if (!(email && email.includes('@'))) return false;
  // Prefer explicit channel when present; legacy rows may still only have credentials.
  const channel = String(mailboxLean.outboundChannel || '').trim().toLowerCase();
  if (channel && channel !== 'smtp' && channel !== 'gmail_smtp' && channel !== 'none') {
    // e.g. gmail_api — credentials alone do not mean SMTP send path
    if (channel === 'gmail_api') return false;
  }
  return true;
}

/** Alias for existing call sites. */
function isMailboxGmailSmtpReady(mailboxLean) {
  return isMailboxSmtpReady(mailboxLean);
}

function resolveMailboxSmtpTransportConfig(mailboxLean) {
  const provider =
    String(mailboxLean?.smtpOutboundProvider || '').trim().toLowerCase()
    || detectSmtpProvider(mailboxLean?.emailAddress || mailboxLean?.inboxSyncAccountEmail);
  return resolveSmtpPreset(provider, {
    host: mailboxLean?.smtpOutboundHost,
    port: mailboxLean?.smtpOutboundPort,
    secure: mailboxLean?.smtpOutboundSecure
  });
}

function resolveMailboxSmtpCredentials(mailboxLean) {
  const enc = mailboxLean?.smtpOutboundEncryptedAppPassword;
  if (!enc) return { user: null, pass: null, error: 'SMTP_NOT_CONNECTED' };
  const pass = decryptTenantSecret(enc);
  if (!pass) {
    return { user: null, pass: null, error: 'SMTP_DECRYPT_FAILED' };
  }
  const user = String(mailboxLean.emailAddress || mailboxLean.inboxSyncAccountEmail || '')
    .trim()
    .toLowerCase();
  if (!user) {
    return { user: null, pass: null, error: 'MAILBOX_NO_FROM' };
  }
  return { user, pass, error: null };
}

/**
 * @param {{ host: string, port: number, secure: boolean }} transport
 * @param {string} user
 * @param {string} pass
 * @returns {Promise<{ ok: boolean, status: string, error?: string }>}
 */
async function verifySmtpCredentials(transport, user, pass) {
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: transport.host,
    port: transport.port,
    secure: transport.secure === true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
  try {
    await t.verify();
    return { ok: true, status: VERIFY_STATUS.CONNECTED };
  } catch (err) {
    const status = classifySmtpError(err);
    return {
      ok: false,
      status,
      error: err?.message || String(err)
    };
  } finally {
    try {
      t.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Verify without persisting (wizard Step 3).
 * @param {object} params
 */
async function verifyMailboxSmtpParams({
  emailAddress,
  password,
  provider,
  smtpHost,
  smtpPort,
  smtpSecure
} = {}) {
  const email = String(emailAddress || '').trim().toLowerCase();
  const pass = String(password || '').replace(/\s/g, '');
  if (!email || !email.includes('@')) {
    return { ok: false, status: VERIFY_STATUS.UNKNOWN, error: 'A valid email address is required', code: 'INVALID_EMAIL' };
  }
  if (!pass || pass.length < 8) {
    return {
      ok: false,
      status: VERIFY_STATUS.INVALID_CREDENTIALS,
      error: 'App password or SMTP password is required',
      code: 'INVALID_PASSWORD'
    };
  }

  const detected = provider || detectSmtpProvider(email);
  const transport = resolveSmtpPreset(detected, {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure
  });
  if (!transport.host) {
    return {
      ok: false,
      status: VERIFY_STATUS.HOST_NOT_FOUND,
      error: 'SMTP host is required',
      code: 'MISSING_HOST'
    };
  }

  const result = await verifySmtpCredentials(transport, email, pass);
  return {
    ...result,
    provider: transport.provider,
    host: transport.host,
    port: transport.port,
    secure: transport.secure
  };
}

/**
 * Connect mailbox SMTP (direct to provider).
 */
async function connectMailboxSmtp({
  organizationId,
  mailboxId,
  emailAddress,
  password,
  provider,
  smtpHost,
  smtpPort,
  smtpSecure,
  displayName
} = {}) {
  const verified = await verifyMailboxSmtpParams({
    emailAddress,
    password,
    provider,
    smtpHost,
    smtpPort,
    smtpSecure
  });
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error || 'SMTP verification failed',
      code: verified.code || verified.status || 'SMTP_VERIFY_FAILED',
      status: verified.status
    };
  }

  const email = String(emailAddress || '').trim().toLowerCase();
  const pass = String(password || '').replace(/\s/g, '');
  const trimmedDisplay = displayName != null ? String(displayName).trim().slice(0, 160) : '';
  const set = {
    emailAddress: email,
    outboundChannel: verified.provider === 'gmail' ? 'gmail_smtp' : 'smtp',
    smtpOutboundProvider: verified.provider,
    smtpOutboundHost: verified.host,
    smtpOutboundPort: verified.port,
    smtpOutboundSecure: verified.secure === true,
    smtpOutboundEncryptedAppPassword: encryptTenantSecret(pass),
    smtpOutboundVerifiedAt: new Date(),
    smtpOutboundFromName: trimmedDisplay,
    syncStatus: 'connected',
    status: 'active',
    lastInboxSyncError: ''
  };
  if (trimmedDisplay) {
    set.label = trimmedDisplay;
  }

  await Mailbox.updateOne({ _id: mailboxId, organizationId }, { $set: set });
  return {
    ok: true,
    emailAddress: email,
    provider: verified.provider,
    status: VERIFY_STATUS.CONNECTED
  };
}

async function disconnectMailboxSmtp(mailboxId, organizationId) {
  await Mailbox.updateOne(
    { _id: mailboxId, organizationId },
    {
      $set: {
        outboundChannel: 'none',
        smtpOutboundEncryptedAppPassword: '',
        smtpOutboundVerifiedAt: null,
        smtpOutboundProvider: '',
        smtpOutboundHost: '',
        smtpOutboundPort: null,
        smtpOutboundSecure: false,
        smtpOutboundFromName: ''
      }
    }
  );
  return { ok: true };
}

/**
 * Send via mailbox SMTP using stored credentials + preset/host on mailbox.
 */
async function sendViaMailboxSmtp(doc, mailboxLean, extras = {}) {
  const transportCfg = resolveMailboxSmtpTransportConfig(mailboxLean);
  if (!transportCfg.host) {
    return {
      success: false,
      provider: transportCfg.provider || 'smtp',
      error: 'Mailbox SMTP host is not configured',
      code: 'SMTP_HOST_MISSING'
    };
  }

  const creds = resolveMailboxSmtpCredentials(mailboxLean);
  if (creds.error) {
    return {
      success: false,
      provider: transportCfg.provider || 'smtp',
      error: 'Mailbox SMTP credentials are missing or invalid',
      code: creds.error
    };
  }

  const textBody = (doc.body || '').replace(/<[^>]+>/g, '');
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: transportCfg.host,
    port: transportCfg.port,
    secure: transportCfg.secure === true,
    auth: { user: creds.user, pass: creds.pass }
  });

  try {
    let fromName = String(mailboxLean?.smtpOutboundFromName || '').trim();
    if (!fromName) {
      const named = String(doc.fromAddress || '').match(/^(?:"([^"]+)"|([^<]*?))\s*<([^>]+)>/);
      if (named) {
        fromName = String(named[1] || named[2] || '').trim();
      }
    }
    if (!fromName) {
      const label = String(mailboxLean?.label || '').trim();
      const email = String(creds.user || '').toLowerCase();
      if (label && label.toLowerCase() !== email) fromName = label;
    }
    const from = fromName ? `"${fromName.replace(/"/g, '')}" <${creds.user}>` : creds.user;
    const info = await transport.sendMail({
      from,
      to: doc.toAddresses,
      cc: doc.ccAddresses?.length ? doc.ccAddresses : undefined,
      bcc: doc.bccAddresses?.length ? doc.bccAddresses : undefined,
      subject: doc.subject || '',
      html: doc.body || undefined,
      text: textBody || undefined,
      replyTo: extras.replyTo || undefined,
      inReplyTo: doc.inReplyTo || undefined,
      references: doc.references || undefined,
      messageId: doc.messageId || undefined,
      attachments: extras.attachments?.length ? extras.attachments : undefined
    });
    return {
      success: true,
      provider: transportCfg.provider || 'smtp',
      messageId: info.messageId || null,
      threadId: null,
      providerMessageKey: null
    };
  } catch (err) {
    const msg = err?.message || String(err);
    const status = classifySmtpError(err);
    return {
      success: false,
      provider: transportCfg.provider || 'smtp',
      error: msg,
      code: status,
      status
    };
  } finally {
    try {
      transport.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  VERIFY_STATUS,
  SMTP_PROVIDERS,
  isConsumerDomain,
  extractEmailDomain,
  detectSmtpProvider,
  resolveSmtpPreset,
  isMailboxSmtpChannel,
  isMailboxSmtpReady,
  isMailboxGmailSmtpReady,
  resolveMailboxSmtpTransportConfig,
  resolveMailboxSmtpCredentials,
  verifySmtpCredentials,
  verifyMailboxSmtpParams,
  connectMailboxSmtp,
  disconnectMailboxSmtp,
  sendViaMailboxSmtp,
  classifySmtpError
};
