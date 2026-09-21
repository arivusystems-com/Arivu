'use strict';

const BillingSubscription = require('../../models/commercial/BillingSubscription');
const { recordBillingEvent } = require('./billingService');
const {
  BILLING_EVENT_TYPES,
  APP_KEY_TO_PRODUCT_CODE,
} = require('../../constants/commercialBilling');

async function hasCommercialSubscription(organizationId) {
  const sub = await BillingSubscription.findOne({ organizationId }).select('_id').lean();
  return Boolean(sub);
}

/**
 * Deactivate / remove internal or portal user from commercial billing.
 * Pass appKeys that were ACTIVE before deactivation.
 */
async function syncCommercialBillingAfterDeactivation({
  organizationId,
  userId,
  userType = 'INTERNAL',
  activeAppKeys = [],
  initiatedByUserId = null,
}) {
  try {
    if (!organizationId || !userId) return { skipped: true, reason: 'missing_ids' };
    if (!(await hasCommercialSubscription(organizationId))) {
      return { skipped: true, reason: 'no_commercial_subscription' };
    }

    const results = [];
    const type = String(userType || 'INTERNAL').toUpperCase();
    const stamp = Date.now();

    if (type === 'EXTERNAL' || type === 'PORTAL') {
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.PORTAL_USER_REMOVED,
        idempotencyKey: `portal_user_removed:${userId}:${stamp}`,
        payload: { userId: String(userId) },
        initiatedByUserId,
      }));
      return { skipped: false, results };
    }

    for (const rawKey of activeAppKeys || []) {
      const appKey = String(rawKey || '').toUpperCase();
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.APPLICATION_UNASSIGNED,
        idempotencyKey: `application_unassigned:${userId}:${productCode}:${stamp}`,
        payload: {
          userId: String(userId),
          productCode,
          appKey,
        },
        initiatedByUserId,
      }));
    }

    results.push(await recordBillingEvent({
      organizationId,
      type: BILLING_EVENT_TYPES.USER_REMOVED,
      idempotencyKey: `user_removed:${userId}:${stamp}`,
      payload: { userId: String(userId) },
      initiatedByUserId,
    }));

    return { skipped: false, results };
  } catch (err) {
    console.warn('[commercialLifecycle] deactivation sync failed:', err.message);
    return { skipped: true, reason: 'error', error: err.message };
  }
}

/**
 * Diff-based app access commercial sync.
 * @param {{ previousActiveAppKeys: string[], nextActiveAppKeys: string[] }} params
 */
async function syncCommercialBillingAfterAppAccessChange({
  organizationId,
  userId,
  previousActiveAppKeys = [],
  nextActiveAppKeys = [],
  initiatedByUserId = null,
}) {
  try {
    if (!organizationId || !userId) return { skipped: true, reason: 'missing_ids' };
    if (!(await hasCommercialSubscription(organizationId))) {
      return { skipped: true, reason: 'no_commercial_subscription' };
    }

    const prev = new Set((previousActiveAppKeys || []).map((k) => String(k).toUpperCase()));
    const next = new Set((nextActiveAppKeys || []).map((k) => String(k).toUpperCase()));
    const results = [];
    const stamp = Date.now();

    for (const appKey of next) {
      if (prev.has(appKey)) continue;
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.APPLICATION_ASSIGNED,
        // Stable per assign wave — Date.now()-only keys re-fire every refresh.
        idempotencyKey: `application_assigned:${userId}:${productCode}:${stamp}`,
        payload: { userId: String(userId), productCode, appKey },
        initiatedByUserId,
      }));
    }

    for (const appKey of prev) {
      if (next.has(appKey)) continue;
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.APPLICATION_UNASSIGNED,
        idempotencyKey: `application_unassigned:${userId}:${productCode}:${stamp}`,
        payload: { userId: String(userId), productCode, appKey },
        initiatedByUserId,
      }));
    }

    return { skipped: false, results };
  } catch (err) {
    console.warn('[commercialLifecycle] appAccess sync failed:', err.message);
    return { skipped: true, reason: 'error', error: err.message };
  }
}

module.exports = {
  syncCommercialBillingAfterDeactivation,
  syncCommercialBillingAfterAppAccessChange,
  hasCommercialSubscription,
};
