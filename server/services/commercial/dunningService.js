'use strict';

const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const {
  INVOICE_STATUSES,
  SUBSCRIPTION_STATUSES,
  ITEM_STATUSES,
} = require('../../constants/commercialBilling');
const { suspendInstanceForBilling } = require('./instanceBillingLifecycle');

/**
 * Mark finalized invoices past dueAt as past_due and flip subscription status.
 * Renewal (non-proration) overdue → instance suspended.
 * Proration overdue → mark related subscription items payment_pending via metadata hold.
 */
async function markOverdueCommercialInvoices({ limit = 200, at = new Date() } = {}) {
  const graceDays = Math.max(0, Number(process.env.COMMERCIAL_BILLING_GRACE_DAYS) || 0);
  const cutoff = new Date(at);
  if (graceDays > 0) {
    cutoff.setDate(cutoff.getDate() - graceDays);
  }

  const due = await BillingInvoice.find({
    status: INVOICE_STATUSES.FINALIZED,
    dueAt: { $ne: null, $lte: cutoff },
  })
    .limit(Math.max(1, Number(limit) || 200))
    .select('_id organizationId subscriptionId status dueAt amountPaidMinor totalMinor snapshot');

  let invoicesMarked = 0;
  const subscriptionIds = new Set();
  const prorationHolds = [];

  for (const inv of due) {
    const paid = Math.max(0, Number(inv.amountPaidMinor) || 0);
    if (paid >= inv.totalMinor) continue;

    inv.status = INVOICE_STATUSES.PAST_DUE;
    await inv.save();
    invoicesMarked += 1;
    if (inv.subscriptionId) {
      subscriptionIds.add(String(inv.subscriptionId));
    }
    if (inv.snapshot?.kind === 'proration') {
      prorationHolds.push(inv);
    }
  }

  for (const inv of prorationHolds) {
    try {
      await holdProrationComponents(inv);
    } catch (err) {
      console.warn('[dunning] proration hold failed', err.message);
    }
  }

  let subscriptionsMarked = 0;
  let instancesSuspended = 0;
  for (const subId of subscriptionIds) {
    const sub = await BillingSubscription.findById(subId);
    if (!sub) continue;
    if (sub.metadata?.notBillable || sub.metadata?.sandboxInternal) continue;

    const hasRenewalPastDue = await BillingInvoice.exists({
      subscriptionId: sub._id,
      status: INVOICE_STATUSES.PAST_DUE,
      'snapshot.kind': { $ne: 'proration' },
    });

    if (
      hasRenewalPastDue
      && (
        sub.status === SUBSCRIPTION_STATUSES.ACTIVE
        || sub.status === SUBSCRIPTION_STATUSES.PAST_DUE
        || sub.status === SUBSCRIPTION_STATUSES.PAYMENT_PENDING
      )
    ) {
      if (sub.status !== SUBSCRIPTION_STATUSES.PAST_DUE) {
        sub.status = SUBSCRIPTION_STATUSES.PAST_DUE;
        await sub.save();
        subscriptionsMarked += 1;
      }
      try {
        await suspendInstanceForBilling(sub.organizationId, 'commercial_past_due');
        instancesSuspended += 1;
      } catch (err) {
        console.warn('[dunning] instance suspend failed', err.message);
      }
    }
  }

  return {
    scanned: due.length,
    invoicesMarked,
    subscriptionsMarked,
    instancesSuspended,
  };
}

/**
 * Deactivate subscription items tied to an unpaid proration invoice (component hold).
 */
async function holdProrationComponents(invoice) {
  const lines = await require('../../models/commercial/BillingInvoiceLine').find({
    invoiceId: invoice._id,
  }).lean();

  for (const line of lines) {
    if (!line.subscriptionItemId) continue;
    const item = await BillingSubscriptionItem.findById(line.subscriptionItemId);
    if (!item || item.status !== ITEM_STATUSES.ACTIVE) continue;
    const holdQty = Math.max(0, Number(line.quantity) || 0);
    if (holdQty <= 0) continue;
    item.quantity = Math.max(0, (item.quantity || 0) - holdQty);
    item.metadata = {
      ...(item.metadata || {}),
      paymentHold: {
        invoiceId: String(invoice._id),
        heldQuantity: holdQty,
        at: new Date().toISOString(),
      },
    };
    await item.save();
  }
}

/**
 * After full invoice payment, restore subscription to active when no other unpaid past_due remain.
 */
async function restoreSubscriptionIfCurrent(subscriptionId) {
  if (!subscriptionId) return null;
  const sub = await BillingSubscription.findById(subscriptionId);
  if (!sub) return null;
  if (
    sub.status !== SUBSCRIPTION_STATUSES.PAST_DUE
    && sub.status !== SUBSCRIPTION_STATUSES.PAYMENT_PENDING
  ) {
    return sub;
  }

  const blocking = await BillingInvoice.countDocuments({
    subscriptionId: sub._id,
    status: INVOICE_STATUSES.PAST_DUE,
    'snapshot.kind': { $ne: 'proration' },
  });

  if (blocking === 0) {
    sub.status = SUBSCRIPTION_STATUSES.ACTIVE;
    await sub.save();
  }

  return sub;
}

module.exports = {
  markOverdueCommercialInvoices,
  restoreSubscriptionIfCurrent,
  holdProrationComponents,
};
