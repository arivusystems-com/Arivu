const whatsappService = require('../whatsappService');
const NotificationPreference = require('../../models/NotificationPreference');
const User = require('../../models/User');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[whatsappChannel:${event}]`, JSON.stringify(data));
  }
}

/**
 * WhatsApp notification channel.
 * 
 * Phase 13: External Notification Channels
 * 
 * Rules:
 * - Only sends for HIGH priority events
 * - Only for Audit & Portal apps
 * - Respects user preferences (whatsapp.enabled && whatsapp.available)
 * - One message per event per user (no batching)
 * - No marketing content
 */
async function send({ notification, user, context }) {
  try {
    // Only send for HIGH priority events
    if (notification.priority !== 'HIGH') {
      debugLog('Skipped', {
        notificationId: String(notification._id),
        reason: 'not_high_priority',
        priority: notification.priority
      });
      return { success: false, skipped: true, reason: 'not_high_priority' };
    }

    // Only for Audit & Portal apps
    if (notification.appKey !== 'AUDIT' && notification.appKey !== 'PORTAL') {
      debugLog('Skipped', {
        notificationId: String(notification._id),
        reason: 'app_not_supported',
        appKey: notification.appKey
      });
      return { success: false, skipped: true, reason: 'app_not_supported' };
    }

    // Check if WhatsApp service is enabled
    if (!whatsappService.enabled()) {
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
    if (!user.phoneNumber || !whatsappService.isValidPhoneNumber(user.phoneNumber)) {
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

    if (preference && preference.events) {
      const eventPref = preference.events.get(notification.eventType);
      if (eventPref) {
        // Check if WhatsApp is enabled and available
        if (!eventPref.whatsapp || !eventPref.whatsapp.enabled || !eventPref.whatsapp.available) {
          debugLog('Skipped', {
            notificationId: String(notification._id),
            reason: 'whatsapp_disabled_or_unavailable',
            enabled: eventPref.whatsapp?.enabled,
            available: eventPref.whatsapp?.available
          });
          return { success: false, skipped: true, reason: 'whatsapp_disabled_or_unavailable' };
        }
      }
    }

    // Build WhatsApp message (short, transactional)
    const message = `${notification.title}\n\n${notification.body}\n\n${getAppDeepLink(notification.appKey, notification.entity)}`;

    // Send WhatsApp message
    const result = await whatsappService.sendWhatsAppMessage({
      to: user.phoneNumber,
      message
    });

    debugLog('WhatsAppSent', {
      notificationId: String(notification._id),
      userId: String(notification.userId),
      success: result.success
    });

    return result;
  } catch (err) {
    // Never throw - channel failures must not block execution
    console.error('[whatsappChannel] Failed to send WhatsApp notification:', err);
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
