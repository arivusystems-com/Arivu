'use strict';

const securityLogger = require('../middleware/securityLoggingMiddleware');
const { finalizeLoginForResolvedUser } = require('./authController');
const {
  GENERIC_PROVISION_MESSAGE,
  isGoogleLoginConfigured,
  buildAuthorizeUrl,
  verifyOAuthState,
  exchangeCodeAndVerifyIdentity,
  resolveLoginUserFromGoogleIdentity,
  persistGoogleLink,
  buildClientLoginRedirect,
  encodeTransferPayload,
  encodeSessionLimitPayload
} = require('../services/googleLoginAuthService');

function redirectProvisionError(res, reason, req) {
  securityLogger.logAuthEvent('GOOGLE_LOGIN_FAILED', {
    reason,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  return res.redirect(
    buildClientLoginRedirect({ google_auth: 'error' })
  );
}

/**
 * GET /api/auth/google/status — whether Sign-In with Google is configured.
 */
exports.getGoogleLoginStatus = async (req, res) => {
  return res.json({ enabled: isGoogleLoginConfigured() });
};

/**
 * GET /api/auth/google — start OAuth (openid email profile only).
 */
exports.startGoogleLogin = async (req, res) => {
  try {
    if (!isGoogleLoginConfigured()) {
      return res.redirect(buildClientLoginRedirect({ google_auth: 'error' }));
    }
    const started = buildAuthorizeUrl();
    if (started.error) {
      console.error('[GoogleLogin] authorize url:', started.error);
      return res.redirect(buildClientLoginRedirect({ google_auth: 'error' }));
    }
    return res.redirect(started.url);
  } catch (err) {
    console.error('[GoogleLogin] start error:', err);
    return res.redirect(buildClientLoginRedirect({ google_auth: 'error' }));
  }
};

/**
 * GET /api/auth/google/callback — verify Google identity, link, issue Arivu session.
 */
exports.handleGoogleLoginCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return redirectProvisionError(res, `OAUTH_${String(oauthError).toUpperCase()}`, req);
    }

    if (!verifyOAuthState(state)) {
      return redirectProvisionError(res, 'INVALID_STATE', req);
    }

    const identity = await exchangeCodeAndVerifyIdentity(code);
    if (!identity.ok) {
      return redirectProvisionError(res, identity.reason || 'VERIFY_FAILED', req);
    }

    const resolved = await resolveLoginUserFromGoogleIdentity({
      subject: identity.subject,
      email: identity.email
    });

    if (!resolved?.orgUser || !resolved?.organizationForLogin) {
      return redirectProvisionError(res, 'USER_NOT_PROVISIONED', req);
    }

    const linked = await persistGoogleLink({
      orgUser: resolved.orgUser,
      masterUser: resolved.masterUser,
      subject: identity.subject,
      email: identity.email
    });
    if (!linked.ok) {
      return redirectProvisionError(res, linked.reason || 'LINK_FAILED', req);
    }

    const finalized = await finalizeLoginForResolvedUser(req, {
      orgUser: resolved.orgUser,
      masterUser: resolved.masterUser,
      organizationForLogin: resolved.organizationForLogin,
      normalizedEmail: identity.email,
      authMethod: 'google'
    });

    if (!finalized.ok) {
      if (finalized.status === 409 && finalized.body?.code === 'SESSION_LIMIT') {
        const encoded = encodeSessionLimitPayload(finalized.body);
        return res.redirect(
          buildClientLoginRedirect(
            { google_auth: 'session_limit' },
            `google_challenge=${encodeURIComponent(encoded)}`
          )
        );
      }
      // Invite pending / suspended / org issues — still use generic copy for unknown accounts;
      // known account state messages can surface via google_auth + code for client mapping.
      if (finalized.body?.code === 'INVITE_PENDING' || finalized.body?.code === 'ACCOUNT_SUSPENDED') {
        return res.redirect(
          buildClientLoginRedirect({
            google_auth: 'error',
            google_code: finalized.body.code
          })
        );
      }
      return redirectProvisionError(res, finalized.body?.code || 'LOGIN_FAILED', req);
    }

    const transfer = encodeTransferPayload(finalized.sessionPayload);
    return res.redirect(
      buildClientLoginRedirect({}, `ld_session=${encodeURIComponent(transfer)}`)
    );
  } catch (err) {
    console.error('[GoogleLogin] callback error:', err);
    securityLogger.logAuthEvent('GOOGLE_LOGIN_FAILED', {
      reason: 'SERVER_ERROR',
      detail: err.message,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    return res.redirect(buildClientLoginRedirect({ google_auth: 'error' }));
  }
};

exports.GENERIC_PROVISION_MESSAGE = GENERIC_PROVISION_MESSAGE;
