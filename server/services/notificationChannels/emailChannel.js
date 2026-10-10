const User = require('../../models/User');
const domainEvents = require('../../constants/domainEvents');
const { sendAccountEmail } = require('../userAccountEmailService');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[emailChannel:${event}]`, JSON.stringify(data));
  }
}

/**
 * Email channel implementation.
 * Handles regular notifications and digest notifications.
 * Tries system email first, then tenant/env CRM (via sendAccountEmail).
 * RECORD_COMMENT_MENTION emails are never sent here (dedicated pref-gated path).
 */
async function send({ notification }) {
  try {
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
      return { success: false, skipped: true, reason: 'email_notifications_disabled' };
    }

    const orgId = notification.organizationId;

    if (notification.eventType === domainEvents.RECORD_COMMENT_MENTION) {
      console.log(
        `[emailChannel] Skipping RECORD_COMMENT_MENTION via engine email channel user=${notification.userId}`
      );
      return { success: false, skipped: true, reason: 'mention_email_dedicated_path_only' };
    }

    const user = await User.findById(notification.userId).select('email firstName lastName');
    if (!user || !user.email) {
      console.warn('[emailChannel] User not found or no email:', notification.userId);
      return { success: false, skipped: true, reason: 'no_email' };
    }

    let subject;
    let text;
    let html;

    if (
      notification.eventType === domainEvents.DIGEST_DAILY ||
      notification.eventType === domainEvents.DIGEST_WEEKLY
    ) {
      const digestContent = renderDigestEmail(notification, user);
      subject = digestContent.subject;
      text = digestContent.text;
      html = digestContent.html;
    } else {
      const regularContent = renderRegularEmail(notification, user);
      subject = regularContent.subject;
      text = regularContent.text;
      html = regularContent.html;
    }

    const result = await sendAccountEmail({
      organizationId: orgId,
      to: user.email,
      subject,
      text,
      html,
      replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
    });

    debugLog('EmailSent', {
      notificationId: String(notification._id),
      userId: String(notification.userId),
      eventType: notification.eventType,
      success: result.success,
      channel: result.channel
    });

    if (result.skipped) {
      return { success: false, skipped: true, reason: result.reason || 'email_not_configured' };
    }
    if (!result.success) {
      return { success: false, error: result.error || result.reason };
    }
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error('[emailChannel] Failed to send email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Render digest email content.
 */
function renderDigestEmail(notification, user) {
  const userName = user.firstName || user.email.split('@')[0];
  const isWeekly = notification.eventType === domainEvents.DIGEST_WEEKLY;
  const period = isWeekly ? 'weekly' : 'daily';
  
  const subject = notification.title || `Your ${period} summary`;
  
  // Simple text-based email (no branding yet)
  const text = `Hi ${userName},\n\n${notification.body}\n\nOpen Arivu to review.\n\n${getAppDeepLink(notification.appKey)}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">${subject}</h2>
      <p>Hi ${userName},</p>
      <p>${notification.body}</p>
      <p style="margin-top: 30px;">
        <a href="${getAppDeepLink(notification.appKey)}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Open Arivu</a>
      </p>
    </body>
    </html>
  `;
  
  return { subject, text, html };
}

/**
 * Render regular notification email content.
 */
function renderRegularEmail(notification, user) {
  const userName = user.firstName || user.email.split('@')[0];
  const subject = notification.title || 'Notification from Arivu';
  
  const text = `Hi ${userName},\n\n${notification.body}\n\n${getAppDeepLink(notification.appKey)}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb;">${subject}</h2>
      <p>Hi ${userName},</p>
      <p>${notification.body}</p>
      <p style="margin-top: 30px;">
        <a href="${getAppDeepLink(notification.appKey)}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Arivu</a>
      </p>
    </body>
    </html>
  `;
  
  return { subject, text, html };
}

/**
 * Get deep link URL for app.
 */
function getAppDeepLink(appKey) {
  const { resolveClientUrl } = require('../../utils/clientUrl');
  const baseUrl = resolveClientUrl();
  
  switch (appKey) {
    case 'CRM':
      return `${baseUrl}/dashboard`;
    case 'AUDIT':
      return `${baseUrl}/audit/dashboard`;
    case 'PORTAL':
      return `${baseUrl}/portal/actions`;
    default:
      return baseUrl;
  }
}

module.exports = { send };

