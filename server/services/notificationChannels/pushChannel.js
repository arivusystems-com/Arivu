const pushService = require('../pushService');
const nativePushService = require('../nativePushService');
const NotificationPreference = require('../../models/NotificationPreference');
const User = require('../../models/User');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    console.log(`[pushChannel:${event}]`, JSON.stringify(data));
  }
}

/**
 * Push notification channel.
 * 
 * Phase 13: External Notification Channels
 * 
 * Rules:
 * - Only sends for HIGH priority events
 * - Respects user preferences (push.enabled && push.available)
 * - Auto-disables subscription if push fails repeatedly
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

    // Load user if not provided
    if (!user) {
      user = await User.findById(notification.userId).select('email firstName lastName');
      if (!user) {
        debugLog('UserNotFound', { notificationId: String(notification._id) });
        return { success: false, skipped: true, reason: 'user_not_found' };
      }
    }

    // Check user preferences
    const preference = await NotificationPreference.findOne({
      userId: notification.userId,
      appKey: notification.appKey
    });

    if (preference && preference.events) {
      const eventPref = preference.events.get(notification.eventType);
      if (eventPref) {
        // Check if push is enabled and available
        if (!eventPref.push || !eventPref.push.enabled || !eventPref.push.available) {
          debugLog('Skipped', {
            notificationId: String(notification._id),
            reason: 'push_disabled_or_unavailable',
            enabled: eventPref.push?.enabled,
            available: eventPref.push?.available
          });
          return { success: false, skipped: true, reason: 'push_disabled_or_unavailable' };
        }
      }
    }

    const webReady = pushService.initialized();
    const nativeReady = nativePushService.initialized();
    if (!webReady && !nativeReady) {
      debugLog('ServiceNotInitialized', { notificationId: String(notification._id) });
      return { success: false, skipped: true, reason: 'service_not_initialized' };
    }

    const mobileUrl = getMobileDeepLink(notification.appKey, notification.entity);
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        notificationId: String(notification._id),
        eventType: notification.eventType,
        appKey: notification.appKey,
        entity: notification.entity,
        url: getAppDeepLink(notification.appKey, notification.entity),
        mobileUrl
      },
      tag: `${notification.eventType}_${notification.entity?.id || 'none'}`
    };

    let webSuccessCount = 0;
    let webFailedCount = 0;
    let webSubscriptions = 0;

    if (webReady) {
      const subscriptions = await pushService.getActiveSubscriptions(
        notification.userId,
        notification.appKey
      );
      webSubscriptions = subscriptions?.length || 0;
      if (webSubscriptions > 0) {
        const results = await Promise.allSettled(
          subscriptions.map(sub => pushService.sendPushNotification(sub, payload))
        );
        webSuccessCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        webFailedCount = results.length - webSuccessCount;
      }
    }

    const nativeResult = await nativePushService.sendToUser(
      notification.userId,
      notification.appKey,
      payload
    );

    const nativeSuccessCount = nativeResult.successCount || 0;
    const successCount = webSuccessCount + nativeSuccessCount;
    const failedCount = webFailedCount + (nativeResult.failedCount || 0);
    const totalTargets = webSubscriptions + (nativeResult.devices || 0);

    if (totalTargets === 0) {
      debugLog('NoSubscriptions', {
        notificationId: String(notification._id),
        userId: String(notification.userId),
        appKey: notification.appKey
      });
      return { success: false, skipped: true, reason: 'no_subscriptions' };
    }

    debugLog('PushSent', {
      notificationId: String(notification._id),
      webSubscriptions,
      nativeDevices: nativeResult.devices || 0,
      successCount,
      failedCount
    });

    return {
      success: successCount > 0,
      subscriptions: totalTargets,
      successCount,
      failedCount,
      webSuccessCount,
      nativeSuccessCount
    };
  } catch (err) {
    // Never throw - channel failures must not block execution
    console.error('[pushChannel] Failed to send push notification:', err);
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
      case 'SALES':
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
      return `${baseUrl}/events/${entity.id}`;
    case 'CorrectiveAction':
      return `${baseUrl}/portal/actions/${entity.id}`;
    case 'Task':
      return `${baseUrl}/tasks/${entity.id}`;
    case 'Deal':
      return `${baseUrl}/deals/${entity.id}`;
    case 'People':
    case 'Person':
      return `${baseUrl}/people/${entity.id}`;
    case 'Organization':
      return `${baseUrl}/organizations/${entity.id}`;
    case 'Item':
      return `${baseUrl}/items/${entity.id}`;
    case 'Quote':
      return `${baseUrl}/quotes/${entity.id}`;
    case 'SalesOrder':
      return `${baseUrl}/sales-orders/${entity.id}`;
    case 'Case':
      return `${baseUrl}/helpdesk/cases/${entity.id}`;
    case 'EmailThread':
    case 'CommunicationThread':
      return `${baseUrl}/inbox?thread=${entity.id}`;
    default:
      return getAppDeepLink(appKey, null);
  }
}

/**
 * Capacitor app deep links (custom URL scheme).
 */
function getMobileDeepLink(appKey, entity) {
  if (!entity || !entity.id) {
    if (appKey === 'AUDIT') return 'arivu://tasks';
    return 'arivu://inbox';
  }
  switch (entity.type) {
    case 'Task':
      return `arivu://tasks/${entity.id}`;
    case 'EmailThread':
    case 'CommunicationThread':
      return `arivu://inbox/${entity.id}`;
    default:
      return 'arivu://inbox';
  }
}

module.exports = { send };
