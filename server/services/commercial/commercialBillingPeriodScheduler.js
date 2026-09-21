'use strict';

const BillingSubscription = require('../../models/commercial/BillingSubscription');
const {
  expireTrialIfDue,
} = require('./subscriptionService');
const {
  applyPendingBillingCycleIfDue,
} = require('./reconcileCommercialSubscription');
const {
  renewDueBillingPeriod,
} = require('./invoiceService');
const {
  markOverdueCommercialInvoices,
} = require('./dunningService');
const { SUBSCRIPTION_STATUSES } = require('../../constants/commercialBilling');

/**
 * Apply due pending billing-cycle changes, expire ended trials (lock),
 * and renew ended paid periods.
 */
async function tickCommercialBillingPeriods({ limit = 100 } = {}) {
  const now = new Date();
  const cap = Math.max(1, Number(limit) || 100);

  const due = await BillingSubscription.find({
    pendingBillingCycle: { $ne: null },
    currentPeriodEnd: { $lte: now },
    status: {
      $in: [
        SUBSCRIPTION_STATUSES.ACTIVE,
        SUBSCRIPTION_STATUSES.TRIALING,
        SUBSCRIPTION_STATUSES.PAST_DUE,
        SUBSCRIPTION_STATUSES.PAYMENT_PENDING,
      ],
    },
  })
    .limit(cap)
    .select('_id organizationId pendingBillingCycle currentPeriodEnd billingCycle');

  let applied = 0;
  const details = [];

  for (const sub of due) {
    try {
      const result = await applyPendingBillingCycleIfDue(sub);
      if (result?.changed || result?.applied || result?.effective === 'immediate') {
        applied += 1;
        details.push({
          organizationId: String(sub.organizationId),
          subscriptionId: String(sub._id),
          to: sub.pendingBillingCycle,
        });
      }
    } catch (err) {
      console.warn('[commercialBillingPeriodScheduler] cycle failed', {
        organizationId: String(sub.organizationId),
        error: err.message,
      });
    }
  }

  const trialsDue = await BillingSubscription.find({
    status: SUBSCRIPTION_STATUSES.TRIALING,
    trialEnd: { $lte: now },
    $or: [
      { 'metadata.notBillable': { $ne: true } },
      { metadata: { $exists: false } },
    ],
  })
    .limit(cap)
    .select('_id organizationId trialEnd status metadata');

  let trialsExpired = 0;
  const trialDetails = [];

  for (const sub of trialsDue) {
    if (sub.metadata?.notBillable || sub.metadata?.sandboxInternal) continue;
    try {
      const result = await expireTrialIfDue(sub, { at: now });
      if (result?.applied) {
        trialsExpired += 1;
        trialDetails.push({
          organizationId: String(sub.organizationId),
          subscriptionId: String(sub._id),
        });
      }
    } catch (err) {
      console.warn('[commercialBillingPeriodScheduler] trial expire failed', {
        organizationId: String(sub.organizationId),
        error: err.message,
      });
    }
  }

  const renewalsDue = await BillingSubscription.find({
    status: {
      $in: [SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.PAST_DUE],
    },
    currentPeriodEnd: { $lte: now },
    $or: [
      { 'metadata.notBillable': { $ne: true } },
      { metadata: { $exists: false } },
    ],
  })
    .limit(cap)
    .select('_id organizationId currentPeriodStart currentPeriodEnd status metadata');

  let renewals = 0;
  const renewalDetails = [];

  for (const sub of renewalsDue) {
    if (sub.metadata?.notBillable || sub.metadata?.sandboxInternal) continue;
    try {
      const result = await renewDueBillingPeriod({
        organizationId: sub.organizationId,
        at: now,
      });
      if (result?.renewed) {
        renewals += 1;
        renewalDetails.push({
          organizationId: String(sub.organizationId),
          subscriptionId: String(sub._id),
          endingInvoiceId: result.endingInvoiceId
            ? String(result.endingInvoiceId)
            : null,
          renewalInvoiceId: result.renewalInvoiceId
            ? String(result.renewalInvoiceId)
            : null,
        });
      }
    } catch (err) {
      console.warn('[commercialBillingPeriodScheduler] period renew failed', {
        organizationId: String(sub.organizationId),
        error: err.message,
      });
    }
  }

  let dunning = { scanned: 0, invoicesMarked: 0, subscriptionsMarked: 0 };
  try {
    dunning = await markOverdueCommercialInvoices({ limit: cap, at: now });
  } catch (err) {
    console.warn('[commercialBillingPeriodScheduler] dunning failed', {
      error: err.message,
    });
  }

  return {
    scanned: due.length,
    applied,
    details,
    trialsScanned: trialsDue.length,
    trialsExpired,
    trialsConverted: trialsExpired,
    trialDetails,
    renewalsScanned: renewalsDue.length,
    renewals,
    renewalDetails,
    dunning,
  };
}

module.exports = {
  tickCommercialBillingPeriods,
};
