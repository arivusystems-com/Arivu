const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const {
  buildCalendarAuthorizeUrl,
  completeCalendarOAuthCallback,
  disconnectGoogleCalendar,
  getExpectedCalendarRedirectUri
} = require('../services/appointmentCalendarService');
const {
  buildMicrosoftAuthorizeUrl,
  completeMicrosoftOAuthCallback,
  disconnectMicrosoftCalendar,
  getExpectedMicrosoftRedirectUri,
  isMicrosoftCalendarConfigured
} = require('../services/appointmentMicrosoftCalendarService');

function requireConfigAccess(req, config) {
  if (!config) return false;
  const isAdmin =
    req.user.isOwner || req.user.role === 'admin' || req.user.isPlatformAdmin;
  if (isAdmin) return true;
  return (
    config.ownerType === 'user' &&
    String(config.assignedTo) === String(req.user._id)
  );
}

exports.googleOAuthStart = async (req, res) => {
  try {
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.configId,
      organizationId: req.user.organizationId
    });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }
    if (!requireConfigAccess(req, config)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await buildCalendarAuthorizeUrl({
      configId: config._id,
      userId: req.user._id,
      organizationId: req.user.organizationId
    });
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.status(200).json({
      success: true,
      data: { url: result.url, redirectUri: result.redirectUri }
    });
  } catch (error) {
    const message =
      error.code === 'GOOGLEAPIS_MISSING' || error.code === 'MODULE_NOT_FOUND'
        ? 'Google Calendar requires server dependencies. Run npm install in the server folder, then restart the API.'
        : error.message;
    res.status(500).json({ success: false, message });
  }
};

function oauthClientBaseUrl() {
  const { resolveClientUrl } = require('../utils/clientUrl');
  return resolveClientUrl();
}

exports.googleOAuthCallback = async (req, res) => {
  const base = oauthClientBaseUrl();
  try {
    const result = await completeCalendarOAuthCallback({
      code: req.query.code,
      state: req.query.state
    });
    if (result.ok) {
      return res.redirect(`${base}/appointments/configure?calendar=connected&provider=google`);
    }
    const msg = encodeURIComponent(String(result.error || 'oauth_failed').slice(0, 800));
    return res.redirect(`${base}/appointments/configure?calendar=error&provider=google&message=${msg}`);
  } catch (err) {
    console.error('[appointmentCalendar] google callback:', err);
    return res.redirect(
      `${base}/appointments/configure?calendar=error&provider=google&message=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
};

exports.microsoftOAuthStart = async (req, res) => {
  try {
    if (!isMicrosoftCalendarConfigured()) {
      return res.status(400).json({
        success: false,
        message:
          'Microsoft Calendar is not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET on the API server.'
      });
    }
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.configId,
      organizationId: req.user.organizationId
    });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }
    if (!requireConfigAccess(req, config)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await buildMicrosoftAuthorizeUrl({
      configId: config._id,
      userId: req.user._id,
      organizationId: req.user.organizationId
    });
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.status(200).json({
      success: true,
      data: { url: result.url, redirectUri: result.redirectUri }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.microsoftOAuthCallback = async (req, res) => {
  const base = oauthClientBaseUrl();
  try {
    const result = await completeMicrosoftOAuthCallback({
      code: req.query.code,
      state: req.query.state
    });
    if (result.ok) {
      return res.redirect(`${base}/appointments/configure?calendar=connected&provider=microsoft`);
    }
    const msg = encodeURIComponent(String(result.error || 'oauth_failed').slice(0, 800));
    return res.redirect(`${base}/appointments/configure?calendar=error&provider=microsoft&message=${msg}`);
  } catch (err) {
    console.error('[appointmentCalendar] microsoft callback:', err);
    return res.redirect(
      `${base}/appointments/configure?calendar=error&provider=microsoft&message=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
};

exports.microsoftDisconnect = async (req, res) => {
  try {
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.configId,
      organizationId: req.user.organizationId
    });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }
    if (!requireConfigAccess(req, config)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await disconnectMicrosoftCalendar(config._id, req.user.organizationId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.googleDisconnect = async (req, res) => {
  try {
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.configId,
      organizationId: req.user.organizationId
    });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }
    if (!requireConfigAccess(req, config)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    await disconnectGoogleCalendar(config._id, req.user.organizationId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCalendarStatus = async (req, res) => {
  try {
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.configId,
      organizationId: req.user.organizationId
    }).lean();
    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }
    if (!requireConfigAccess(req, config)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const googleRedirect = await getExpectedCalendarRedirectUri(req.user.organizationId);
    const microsoftRedirect = getExpectedMicrosoftRedirectUri();
    res.status(200).json({
      success: true,
      data: {
        connected: !!config.googleCalendar?.encryptedRefreshToken,
        accountEmail: config.googleCalendar?.accountEmail || null,
        connectedAt: config.googleCalendar?.connectedAt || null,
        redirectUri: googleRedirect.redirectUri || null,
        google: {
          connected: !!config.googleCalendar?.encryptedRefreshToken,
          accountEmail: config.googleCalendar?.accountEmail || null,
          connectedAt: config.googleCalendar?.connectedAt || null,
          redirectUri: googleRedirect.redirectUri || null
        },
        microsoft: {
          configured: isMicrosoftCalendarConfigured(),
          connected: !!config.microsoftCalendar?.encryptedRefreshToken,
          accountEmail: config.microsoftCalendar?.accountEmail || null,
          connectedAt: config.microsoftCalendar?.connectedAt || null,
          redirectUri: microsoftRedirect.redirectUri || null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
