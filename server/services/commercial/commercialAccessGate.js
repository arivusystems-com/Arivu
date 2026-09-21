'use strict';

const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingEntitlement = require('../../models/commercial/BillingEntitlement');
const {
  organizationHasPlatformEntitlement,
  userHasApplicationEntitlement,
} = require('./entitlementService');
const {
  APP_KEY_TO_PRODUCT_CODE,
  SUBSCRIPTION_STATUSES,
  INVOICE_STATUSES,
  ENTITLEMENT_TYPES,
  ENTITLEMENT_SCOPES,
} = require('../../constants/commercialBilling');

/**
 * FEATURE_COMMERCIAL_BILLING_ENFORCEMENT=true enables commercial entitlement checks.
 * Default off — legacy OrganizationSubscription / allowedApps remain authoritative.
 */
function isCommercialBillingEnforcementEnabled() {
  return String(process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT || '').toLowerCase() === 'true';
}

/**
 * Soft commercial gate for application access.
 */
async function evaluateCommercialAppAccess(params) {
  if (!isCommercialBillingEnforcementEnabled()) {
    return { enforced: false, allowed: true, reason: 'FEATURE_DISABLED' };
  }

  const appKey = String(params.appKey || '').toUpperCase();
  const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
  if (!productCode) {
    return { enforced: false, allowed: true, reason: 'APP_NOT_IN_COMMERCIAL_CATALOG' };
  }

  const subscription = await BillingSubscription.findOne({
    organizationId: params.organizationId,
  }).lean();

  if (!subscription) {
    return { enforced: false, allowed: true, reason: 'NO_COMMERCIAL_SUBSCRIPTION' };
  }

  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { enforced: true, allowed: true, reason: 'SANDBOX_NOT_BILLABLE' };
  }

  const blockedStatuses = new Set([
    SUBSCRIPTION_STATUSES.CANCELED,
    SUBSCRIPTION_STATUSES.EXPIRED,
    SUBSCRIPTION_STATUSES.TRIAL_EXPIRED,
    SUBSCRIPTION_STATUSES.PAYMENT_PENDING,
  ]);
  if (blockedStatuses.has(subscription.status)) {
    const code = subscription.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED
      || subscription.status === SUBSCRIPTION_STATUSES.PAYMENT_PENDING
      ? 'COMMERCIAL_SUBSCRIBE_REQUIRED'
      : 'COMMERCIAL_SUBSCRIPTION_INACTIVE';
    return {
      enforced: true,
      allowed: false,
      reason: code,
      code,
      subscriptionStatus: subscription.status,
    };
  }

  if (subscription.status === SUBSCRIPTION_STATUSES.PAST_DUE) {
    return {
      enforced: true,
      allowed: false,
      reason: 'COMMERCIAL_PAYMENT_PAST_DUE',
      code: 'COMMERCIAL_PAYMENT_REQUIRED',
      subscriptionStatus: subscription.status,
    };
  }

  const unpaidPastDue = await BillingInvoice.exists({
    organizationId: params.organizationId,
    status: INVOICE_STATUSES.PAST_DUE,
    'snapshot.kind': { $ne: 'proration' },
  });
  if (unpaidPastDue) {
    return {
      enforced: true,
      allowed: false,
      reason: 'COMMERCIAL_INVOICE_PAST_DUE',
      code: 'COMMERCIAL_PAYMENT_REQUIRED',
    };
  }

  const hasPlatform = await organizationHasPlatformEntitlement(params.organizationId);
  if (!hasPlatform) {
    return {
      enforced: true,
      allowed: false,
      reason: 'PLATFORM_ENTITLEMENT_MISSING',
      code: 'PLATFORM_ENTITLEMENT_REQUIRED',
    };
  }

  if (params.accessMode === 'ADMIN') {
    return { enforced: true, allowed: true, reason: 'ADMIN_PLATFORM_OK' };
  }

  // Learning: org-scoped TIERED_CAPACITY entitlement (not per-user app license).
  if (appKey === 'LMS' || productCode === 'learning_app') {
    const orgLearning = await BillingEntitlement.findOne({
      organizationId: params.organizationId,
      type: ENTITLEMENT_TYPES.APPLICATION,
      productCode: 'learning_app',
      scope: ENTITLEMENT_SCOPES.ORGANIZATION,
      status: 'active',
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: new Date() } }],
    }).lean();
    if (!orgLearning) {
      return {
        enforced: true,
        allowed: false,
        reason: 'COMMERCIAL_APP_ENTITLEMENT_MISSING',
        code: 'COMMERCIAL_APP_ENTITLEMENT_REQUIRED',
        productCode,
      };
    }
    return {
      enforced: true,
      allowed: true,
      reason: 'COMMERCIAL_LEARNING_CAPACITY_OK',
      productCode,
      learnerSeatCapacity: orgLearning.quantity || 0,
    };
  }

  const entitled = await userHasApplicationEntitlement({
    organizationId: params.organizationId,
    userId: params.userId,
    appKey,
  });

  if (!entitled) {
    return {
      enforced: true,
      allowed: false,
      reason: 'COMMERCIAL_APP_ENTITLEMENT_MISSING',
      code: 'COMMERCIAL_APP_ENTITLEMENT_REQUIRED',
      productCode,
    };
  }

  return { enforced: true, allowed: true, reason: 'COMMERCIAL_ENTITLEMENT_OK', productCode };
}

module.exports = {
  isCommercialBillingEnforcementEnabled,
  evaluateCommercialAppAccess,
};
