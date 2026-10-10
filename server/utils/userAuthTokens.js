'use strict';

const crypto = require('crypto');

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEMO_VERIFICATION_TTL_MS = 72 * 60 * 60 * 1000;
const DEMO_SETUP_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex');
}

function getInviteExpiry() {
  return new Date(Date.now() + INVITE_TTL_MS);
}

function getVerificationExpiry() {
  return new Date(Date.now() + VERIFICATION_TTL_MS);
}

function getPasswordResetExpiry() {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MS);
}

function buildClientUrl(path) {
  const { resolveClientUrl } = require('./clientUrl');
  const base = resolveClientUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildInviteUrl(rawToken) {
  return buildClientUrl(`/accept-invite?token=${encodeURIComponent(rawToken)}`);
}

function buildPortalLoginUrl() {
  return buildClientUrl('/login');
}

function buildVerifyEmailUrl(rawToken) {
  return buildClientUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`);
}

function buildTrialSetupVerifyUrl(rawToken) {
  return buildClientUrl(`/trial/setup?verify=${encodeURIComponent(rawToken)}`);
}

function buildTrialSetupContinueUrl(rawSetupToken) {
  return buildClientUrl(`/trial/setup?setup=${encodeURIComponent(rawSetupToken)}`);
}

function getDemoVerificationExpiry() {
  return new Date(Date.now() + DEMO_VERIFICATION_TTL_MS);
}

function getDemoSetupExpiry() {
  return new Date(Date.now() + DEMO_SETUP_TTL_MS);
}

function buildResetPasswordUrl(rawToken) {
  return buildClientUrl(`/reset-password?token=${encodeURIComponent(rawToken)}`);
}

function isTokenExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now();
}

module.exports = {
  INVITE_TTL_MS,
  VERIFICATION_TTL_MS,
  DEMO_VERIFICATION_TTL_MS,
  DEMO_SETUP_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  generateRawToken,
  hashToken,
  getInviteExpiry,
  getVerificationExpiry,
  getDemoVerificationExpiry,
  getDemoSetupExpiry,
  getPasswordResetExpiry,
  buildInviteUrl,
  buildPortalLoginUrl,
  buildVerifyEmailUrl,
  buildTrialSetupVerifyUrl,
  buildTrialSetupContinueUrl,
  buildResetPasswordUrl,
  buildClientUrl,
  isTokenExpired
};
