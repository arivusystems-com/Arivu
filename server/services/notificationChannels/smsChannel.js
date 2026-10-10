const smsService = require('../smsService');
const NotificationPreference = require('../../models/NotificationPreference');
const User = require('../../models/User');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[smsChannel:${event}]`, JSON.stringify(data));
  }
}

/**
 * SMS notification channel (fallback only).
 * 
 * Phase 13: External Notification Channels
 * 
 * Rules:
 * - Only sends when push + email both unavailable OR disabled
 * - Only for Portal customers primarily
 * - Short messages (<160 chars)
 * - Include deep link when possible
 * - Feature-flagged: ENABLE_SMS_NOTIFICATIONS=false by default
 */
async function send({ notification, user, context }) {
  try {
    // Check if SMS service is enabled
    if (!smsService.enabled()) {
      debugLog('ServiceDisabled', { notificationId: String(notification._id) });
      return { success: false, skipped: true, reason: 'service_disabled' };
    }

    // Load user if not provided
    if (!user) {
      user = await User.findById(notification.userId).select('email firstName lastName phoneNumber');
      if (!user) {
        debugLog('UserNotFound', { notificationId: String(notification._id) });
        return { success: false, skipped: true, reason: 'user_not_found' };
      }
    }

    // Check if user has phone number
    if (!user.phoneNumber || !smsService.isValidPhoneNumber(user.phoneNumber)) {
      debugLog('Skipped', {
        notificationId: String(notification._id),
        reason: 'no_valid_phone',
        hasPhone: !!user.phoneNumber
      });
      return { success: false, skipped: true, reason: 'no_valid_phone' };
    }

    // Check user preferences
    const preference = await NotificationPreference.findOne({
      userId: notification.userId,
      appKey: notification.appKey
    });

    // SMS is fallback only - check if other channels are disabled/unavailable
    let shouldUseSMS = false;
    if (preference && preference.events) {
      const eventPref = preference.events.get(notification.eventType);
      if (eventPref) {
        // Use SMS only if push and email are both disabled or unavailable
        const pushAvailable = eventPref.push?.enabled && eventPref.push?.available;
        const emailAvailable = eventPref.email;
        
        if (!pushAvailable && !emailAvailable) {
          // Check if SMS is explicitly enabled
          if (eventPref.sms?.enabled && eventPref.sms?.available) {
            shouldUseSMS = true;
          }
        }
      }
    }

    if (!shouldUseSMS) {
      debugLog('Skipped', {
        notificationId: String(notification._id),
        reason: 'not_fallback_needed',
        message: 'Other channels available or SMS not enabled'
      });
      return { success: false, skipped: true, reason: 'not_fallback_needed' };
    }

    // Build SMS message (short, <160 chars)
    const baseMessage = `${notification.title}: ${notification.body}`;
    const deepLink = getAppDeepLink(notification.appKey, notification.entity);
    
    // Try to fit deep link, but prioritize message content
    let message = baseMessage;
    if (baseMessage.length + deepLink.length + 3 <= 160) {
      message = `${baseMessage}\n${deepLink}`;
    } else if (baseMessage.length > 157) {
      // Truncate base message to fit
      message = baseMessage.substring(0, 157) + '...';
    }

    // Send SMS
    const result = await smsService.sendSMS({
      to: user.phoneNumber,
      message
    });

    debugLog('SMSSent', {
      notificationId: String(notification._id),
      userId: String(notification.userId),
      success: result.success,
      messageLength: message.length
    });

    return result;
  } catch (err) {
    // Never throw - channel failures must not block execution
    console.error('[smsChannel] Failed to send SMS notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get deep link URL for app with entity context.
 */
function getAppDeepLink(appKey, entity) {
  const { resolveClientUrl } = require('../../utils/clientUrl');
  const baseUrl = resolveClientUrl();
  
  if (!entity || !entity.id) {
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

  // Entity-specific deep links
  switch (entity.type) {
    case 'Event':
      return `${baseUrl}/audit/audits/${entity.id}`;
    case 'CorrectiveAction':
      return `${baseUrl}/portal/actions/${entity.id}`;
    default:
      return getAppDeepLink(appKey, null);
  }
}

module.exports = { send };
