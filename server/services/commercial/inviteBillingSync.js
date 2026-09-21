'use strict';

const BillingSubscription = require('../../models/commercial/BillingSubscription');
const { recordBillingEvent } = require('./billingService');
const {
  BILLING_EVENT_TYPES,
  APP_KEY_TO_PRODUCT_CODE,
} = require('../../constants/commercialBilling');

/**
 * After a successful invite, sync commercial subscription (if org already on commercial billing).
 * Never blocks invite — errors are logged only.
 *
 * @param {{
 *   organizationId: string|import('mongoose').Types.ObjectId,
 *   userId: string|import('mongoose').Types.ObjectId,
 *   userType?: string,
 *   appAccess?: Array<{ appKey: string }>,
 *   initiatedByUserId?: string|import('mongoose').Types.ObjectId|null,
 *   isNewBillableSeat?: boolean,
 * }} params
 */
async function syncCommercialBillingAfterInvite(params) {
  try {
    const organizationId = params.organizationId;
    const userId = params.userId;
    if (!organizationId || !userId) return { skipped: true, reason: 'missing_ids' };

    const subscription = await BillingSubscription.findOne({ organizationId }).lean();
    if (!subscription) {
      return { skipped: true, reason: 'no_commercial_subscription' };
    }

    const initiatedByUserId = params.initiatedByUserId || null;
    const userType = String(params.userType || 'INTERNAL').toUpperCase();
    const isNewSeat = params.isNewBillableSeat !== false;
    const results = [];

    if (userType === 'EXTERNAL' || userType === 'PORTAL') {
      if (isNewSeat) {
        results.push(await recordBillingEvent({
          organizationId,
          type: BILLING_EVENT_TYPES.PORTAL_USER_ADDED,
          idempotencyKey: `portal_user_added:${userId}`,
          payload: { userId: String(userId) },
          initiatedByUserId,
        }));
      }
      return { skipped: false, results };
    }

    if (isNewSeat) {
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.USER_ADDED,
        idempotencyKey: `user_added:${userId}`,
        payload: {
          userId: String(userId),
          userType,
        },
        initiatedByUserId,
      }));
    }

    const appAccess = Array.isArray(params.appAccess) ? params.appAccess : [];
    for (const entry of appAccess) {
      const appKey = String(entry.appKey || '').toUpperCase();
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      results.push(await recordBillingEvent({
        organizationId,
        type: BILLING_EVENT_TYPES.APPLICATION_ASSIGNED,
        idempotencyKey: `application_assigned:${userId}:${productCode}`,
        payload: {
          userId: String(userId),
          productCode,
          appKey,
        },
        initiatedByUserId,
      }));
    }

    return { skipped: false, results };
  } catch (err) {
    console.warn('[commercialInviteSync] failed (non-blocking):', err.message);
    return { skipped: true, reason: 'error', error: err.message };
  }
}

module.exports = {
  syncCommercialBillingAfterInvite,
};
