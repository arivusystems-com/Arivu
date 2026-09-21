'use strict';

const DemoRequest = require('../models/DemoRequest');
const { VERTICAL_CATALOG } = require('../constants/verticalCatalog');
const { sendDemoTrialVerificationEmail, sendDemoTrialContinueEmail } = require('./userAccountEmailService');
const {
  generateRawToken,
  hashToken,
  getDemoVerificationExpiry,
  getDemoSetupExpiry,
  isTokenExpired,
} = require('../utils/userAuthTokens');
const { buildVerticalProvisionPreview } = require('./verticalPresetService');

const ACTIVE_SETUP_STATUSES = new Set(['pending_verification', 'email_verified', 'pending']);

function mapAccountEmailResult(result) {
  return {
    sent: result?.success === true,
    skipped: result?.skipped === true,
    reason: result?.reason || result?.error || null,
    channel: result?.channel || null,
  };
}

function dispatchTrialEmailInBackground(emailPromise, contextLabel) {
  void Promise.resolve(emailPromise)
    .then(mapAccountEmailResult)
    .then((result) => {
      if (result.sent) {
        console.log(`[demoTrialService] ${contextLabel}: sent`);
        return;
      }
      console.warn(`[demoTrialService] ${contextLabel}: not sent`, result.reason || 'unknown');
    })
    .catch((err) => {
      console.warn(`[demoTrialService] ${contextLabel} failed:`, err.message);
    });
}

function serializeDemoSetupSession(demoRequest) {
  if (!demoRequest) return null;
  return {
    requestId: demoRequest._id,
    contactName: demoRequest.contactName,
    email: demoRequest.email,
    companyName: demoRequest.companyName,
    industry: demoRequest.industry || '',
    status: demoRequest.status,
    emailVerified: Boolean(demoRequest.emailVerifiedAt),
  };
}

async function issueVerificationToken(demoRequest) {
  const rawToken = generateRawToken();
  demoRequest.emailVerificationTokenHash = hashToken(rawToken);
  demoRequest.emailVerificationExpiresAt = getDemoVerificationExpiry();
  if (demoRequest.status === 'pending') {
    demoRequest.status = 'pending_verification';
  }
  await demoRequest.save();
  return rawToken;
}

async function issueSetupToken(demoRequest) {
  const setupTokenRaw = generateRawToken();
  demoRequest.setupTokenHash = hashToken(setupTokenRaw);
  demoRequest.setupTokenExpiresAt = getDemoSetupExpiry();
  await demoRequest.save();
  return setupTokenRaw;
}

async function sendVerificationEmailForDemoRequest(demoRequest, rawToken) {
  return sendDemoTrialVerificationEmail({
    to: demoRequest.email,
    contactName: demoRequest.contactName,
    companyName: demoRequest.companyName,
    verifyToken: rawToken,
  });
}

async function issueVerifiedSetupSession(demoRequest) {
  const setupTokenRaw = await issueSetupToken(demoRequest);
  return {
    ok: true,
    setupToken: setupTokenRaw,
    session: serializeDemoSetupSession(demoRequest),
  };
}

async function confirmEmailVerification(rawToken) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const setupTokenRaw = generateRawToken();

  const claimed = await DemoRequest.findOneAndUpdate(
    {
      emailVerificationTokenHash: tokenHash,
      status: { $in: ['pending_verification', 'pending'] },
      emailVerificationExpiresAt: { $gt: now },
    },
    {
      $set: {
        emailVerifiedAt: now,
        status: 'email_verified',
        setupTokenHash: hashToken(setupTokenRaw),
        setupTokenExpiresAt: getDemoSetupExpiry(),
      },
    },
    { new: true }
  );

  if (claimed) {
    return {
      ok: true,
      setupToken: setupTokenRaw,
      session: serializeDemoSetupSession(claimed),
    };
  }

  const existing = await DemoRequest.findOne({ emailVerificationTokenHash: tokenHash });
  if (!existing) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Invalid or expired verification link.' };
  }

  if (existing.status === 'converted') {
    return { ok: false, code: 'ALREADY_CONVERTED', message: 'Workspace already set up. Sign in to continue.' };
  }

  if (isTokenExpired(existing.emailVerificationExpiresAt)) {
    return { ok: false, code: 'TOKEN_EXPIRED', message: 'Verification link expired. Request a new one.' };
  }

  if (existing.status === 'email_verified') {
    return issueVerifiedSetupSession(existing);
  }

  return { ok: false, code: 'INVALID_TOKEN', message: 'Invalid or expired verification link.' };
}

async function findDemoRequestBySetupToken(rawSetupToken) {
  const tokenHash = hashToken(rawSetupToken);
  const demoRequest = await DemoRequest.findOne({
    setupTokenHash: tokenHash,
    status: 'email_verified',
  });

  if (!demoRequest) {
    return { ok: false, code: 'INVALID_SETUP', message: 'Setup session invalid or expired.' };
  }

  if (isTokenExpired(demoRequest.setupTokenExpiresAt)) {
    return { ok: false, code: 'SETUP_EXPIRED', message: 'Setup session expired. Request a new verification email.' };
  }

  if (demoRequest.status === 'converted') {
    return { ok: false, code: 'ALREADY_CONVERTED', message: 'This workspace has already been set up.' };
  }

  return { ok: true, demoRequest };
}

function listVerticalOptionsWithPreview() {
  return VERTICAL_CATALOG.map((entry) => ({
    label: entry.label,
    templateKey: entry.templateKey,
    preview: buildVerticalProvisionPreview(entry.label),
  }));
}

function getVerticalPreview(industry) {
  return buildVerticalProvisionPreview(industry);
}

async function resendVerificationForEmail(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    return { ok: false, code: 'INVALID_EMAIL', message: 'Email is required.' };
  }

  const demoRequest = await DemoRequest.findOne({ email: normalizedEmail });
  if (!demoRequest) {
    return { ok: false, code: 'NOT_FOUND', message: 'No demo request found for this email.' };
  }

  if (demoRequest.status === 'converted') {
    return { ok: false, code: 'ALREADY_CONVERTED', message: 'Workspace already set up. Sign in to continue.' };
  }

  if (demoRequest.status === 'email_verified') {
    const setupTokenRaw = await issueSetupToken(demoRequest);
    dispatchTrialEmailInBackground(
      sendDemoTrialContinueEmail({
        to: demoRequest.email,
        contactName: demoRequest.contactName,
        companyName: demoRequest.companyName,
        setupToken: setupTokenRaw,
      }),
      'continue-setup-email'
    );
    return {
      ok: true,
      emailSent: null,
      emailReason: null,
      continueSetup: true,
    };
  }

  if (!ACTIVE_SETUP_STATUSES.has(demoRequest.status)) {
    return { ok: false, code: 'NOT_ELIGIBLE', message: 'This request cannot be verified automatically.' };
  }

  const rawToken = await issueVerificationToken(demoRequest);
  dispatchTrialEmailInBackground(
    sendVerificationEmailForDemoRequest(demoRequest, rawToken),
    'verification-email'
  );

  return {
    ok: true,
    emailSent: null,
    emailReason: null,
  };
}

async function clearSetupToken(demoRequest) {
  demoRequest.setupTokenHash = null;
  demoRequest.setupTokenExpiresAt = null;
  await demoRequest.save();
}

module.exports = {
  ACTIVE_SETUP_STATUSES,
  dispatchTrialEmailInBackground,
  serializeDemoSetupSession,
  issueVerificationToken,
  issueSetupToken,
  sendVerificationEmailForDemoRequest,
  confirmEmailVerification,
  findDemoRequestBySetupToken,
  listVerticalOptionsWithPreview,
  getVerticalPreview,
  resendVerificationForEmail,
  clearSetupToken,
};
