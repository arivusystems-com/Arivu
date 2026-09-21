'use strict';

const mongoose = require('mongoose');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const {
  BILLING_PERIODS,
  MONTHLY_REFUND,
  YEARLY_CANCEL_COMMITMENT_MONTHS,
  SUBSCRIPTION_STATUSES,
  INVOICE_STATUSES,
  ANNUAL_MONTH_MULTIPLIER,
} = require('../../constants/commercialBilling');

/**
 * Preview cancel / refund eligibility without mutating state.
 */
async function previewCancellation(organizationId, at = new Date()) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId: orgId }).lean();
  if (!subscription) {
    throw new Error('Billing subscription missing');
  }

  const paidInvoices = await BillingInvoice.find({
    organizationId: orgId,
    status: INVOICE_STATUSES.PAID,
  })
    .sort({ paidAt: -1 })
    .lean();

  const amountPaidMinor = paidInvoices.reduce(
    (sum, inv) => sum + Math.max(0, Number(inv.amountPaidMinor) || Number(inv.totalMinor) || 0),
    0
  );

  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : subscription.startDate
      ? new Date(subscription.startDate)
      : null;
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const now = new Date(at);

  const activation = periodStart || (subscription.startDate ? new Date(subscription.startDate) : now);
  const daysSinceActivation = Math.max(
    0,
    Math.floor((now.getTime() - activation.getTime()) / (24 * 60 * 60 * 1000))
  );

  let refundEligible = false;
  let estimatedRefundMinor = 0;
  let policy = 'none';

  if (subscription.billingCycle === BILLING_PERIODS.MONTHLY) {
    policy = 'monthly_window';
    if (daysSinceActivation <= MONTHLY_REFUND.windowDays && amountPaidMinor > 0) {
      refundEligible = true;
      estimatedRefundMinor = Math.round(
        (amountPaidMinor * MONTHLY_REFUND.percentBps) / 10000
      );
    }
  } else if (subscription.billingCycle === BILLING_PERIODS.ANNUAL) {
    policy = 'yearly_commitment';
    if (periodStart && periodEnd && periodEnd > periodStart && amountPaidMinor > 0) {
      const totalMs = periodEnd.getTime() - periodStart.getTime();
      const usedMs = Math.min(totalMs, Math.max(0, now.getTime() - periodStart.getTime()));
      const usedCost = Math.round(amountPaidMinor * (usedMs / totalMs));
      const monthlyEquivalent = Math.round(amountPaidMinor / ANNUAL_MONTH_MULTIPLIER);
      const commitmentCharge = monthlyEquivalent * YEARLY_CANCEL_COMMITMENT_MONTHS;
      estimatedRefundMinor = Math.max(0, amountPaidMinor - usedCost - commitmentCharge);
      refundEligible = estimatedRefundMinor > 0;
    }
  }

  return {
    subscriptionId: subscription._id,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    activationDate: activation,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    amountPaidMinor,
    usedPeriodDays: daysSinceActivation,
    refundEligible,
    estimatedRefundMinor,
    policy,
    monthlyRefundWindowDays: MONTHLY_REFUND.windowDays,
    yearlyCommitmentMonths: YEARLY_CANCEL_COMMITMENT_MONTHS,
  };
}

/**
 * Cancel subscription at period end or immediately after refund calc (records estimate).
 */
async function cancelSubscription(params) {
  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) throw new Error('Billing subscription missing');
  if (
    subscription.status === SUBSCRIPTION_STATUSES.CANCELED
    || subscription.status === SUBSCRIPTION_STATUSES.EXPIRED
  ) {
    return { canceled: false, reason: 'already_canceled', subscription };
  }

  const preview = await previewCancellation(organizationId, params.at);
  const immediate = params.immediate === true;

  if (immediate) {
    subscription.status = SUBSCRIPTION_STATUSES.CANCELED;
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = false;
  } else {
    subscription.cancelAtPeriodEnd = true;
    subscription.status = SUBSCRIPTION_STATUSES.CANCELING;
    subscription.canceledAt = null;
  }

  subscription.metadata = {
    ...(subscription.metadata || {}),
    cancelPreview: {
      refundEligible: preview.refundEligible,
      estimatedRefundMinor: preview.estimatedRefundMinor,
      policy: preview.policy,
      at: new Date().toISOString(),
    },
  };
  await subscription.save();

  return {
    canceled: true,
    immediate,
    subscription,
    preview,
  };
}

module.exports = {
  previewCancellation,
  cancelSubscription,
};
