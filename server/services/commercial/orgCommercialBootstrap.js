'use strict';

const { recordBillingEvent } = require('./billingService');
const {
  BILLING_EVENT_TYPES,
  APP_KEY_TO_PRODUCT_CODE,
} = require('../../constants/commercialBilling');

/**
 * Provision commercial Founder subscription for a new tenant org.
 * Owner is the included Admin — do not emit USER_ADDED for them.
 * Application licenses for owner app assignments are billed.
 *
 * Non-blocking callers should try/catch.
 */
async function bootstrapCommercialBillingForOrganization({
  organizationId,
  ownerUserId = null,
  appAccess = [],
  initiatedByUserId = null,
  claimFounder = true,
  billingCycle = 'monthly',
  trialDays = require('../../constants/commercialBilling').DEFAULT_TRIAL_DAYS,
}) {
  const { isInternalOrganization } = require('../../utils/internalOrganization');
  const isInternal = await isInternalOrganization(organizationId);
  const effectiveClaimFounder = isInternal ? false : claimFounder;
  const effectiveTrialDays = isInternal ? 0 : trialDays;

  const results = [];

  results.push(await recordBillingEvent({
    organizationId,
    type: BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED,
    idempotencyKey: `subscription_created:${organizationId}`,
    payload: {
      billingCycle,
      claimFounder: effectiveClaimFounder,
      trialDays: effectiveTrialDays,
    },
    initiatedByUserId,
  }));

  if (!ownerUserId) {
    return { results, isInternalOrganization: isInternal };
  }

  const apps = Array.isArray(appAccess) ? appAccess : [];
  for (const entry of apps) {
    const status = String(entry.status || 'ACTIVE').toUpperCase();
    if (status !== 'ACTIVE') continue;
    const appKey = String(entry.appKey || '').toUpperCase();
    const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
    if (!productCode) continue;

    results.push(await recordBillingEvent({
      organizationId,
      type: BILLING_EVENT_TYPES.APPLICATION_ASSIGNED,
      idempotencyKey: `application_assigned:${ownerUserId}:${productCode}`,
      payload: {
        userId: String(ownerUserId),
        productCode,
        appKey,
      },
      initiatedByUserId: initiatedByUserId || ownerUserId,
    }));
  }

  return { results, isInternalOrganization: isInternal };
}

module.exports = {
  bootstrapCommercialBillingForOrganization,
};
