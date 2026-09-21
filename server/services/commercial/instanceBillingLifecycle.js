'use strict';

const Instance = require('../../models/Instance');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const { INSTANCE_STATUS } = require('../../constants/instanceLifecycle');

/**
 * Suspend tenant instance for commercial non-payment (renewal overdue).
 * Only ACTIVE / TRIAL instances can move to SUSPENDED.
 */
async function suspendInstanceForBilling(organizationId, reason = 'commercial_past_due') {
  const instance = await Instance.findOne({ organizationId });
  if (!instance) return null;
  if (
    instance.status !== INSTANCE_STATUS.ACTIVE
    && instance.status !== INSTANCE_STATUS.TRIAL
  ) {
    return instance;
  }

  instance.status = INSTANCE_STATUS.SUSPENDED;
  instance.suspendedAt = new Date();
  await instance.save();

  await BillingSubscription.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        'metadata.commercialSuspendReason': reason,
        'metadata.instanceSuspendedAt': new Date().toISOString(),
      },
    }
  );

  return instance;
}

/**
 * Restore instance after commercial payment when suspended for billing.
 */
async function restoreInstanceAfterBilling(organizationId) {
  const sub = await BillingSubscription.findOne({ organizationId });
  const reason = sub?.metadata?.commercialSuspendReason;
  if (!reason || !String(reason).startsWith('commercial_')) {
    return null;
  }

  const instance = await Instance.findOne({ organizationId });
  if (!instance || instance.status !== INSTANCE_STATUS.SUSPENDED) {
    return instance;
  }

  instance.status = INSTANCE_STATUS.ACTIVE;
  instance.suspendedAt = undefined;
  await instance.save();

  if (sub) {
    if (sub.metadata) {
      delete sub.metadata.commercialSuspendReason;
      delete sub.metadata.instanceSuspendedAt;
    }
    sub.markModified('metadata');
    await sub.save();
  }

  return instance;
}

module.exports = {
  suspendInstanceForBilling,
  restoreInstanceAfterBilling,
};
