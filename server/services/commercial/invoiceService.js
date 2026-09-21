'use strict';

const mongoose = require('mongoose');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingInvoiceLine = require('../../models/commercial/BillingInvoiceLine');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const BillingProduct = require('../../models/commercial/BillingProduct');
const { calculateCommercialTax } = require('./taxService');
const {
  INVOICE_STATUSES,
  ITEM_STATUSES,
  SUBSCRIPTION_STATUSES,
} = require('../../constants/commercialBilling');

/**
 * Build draft invoice from subscription item snapshots (not live catalog).
 * Finalize freezes amounts permanently.
 */

async function nextInvoiceNumber(organizationId) {
  const year = new Date().getFullYear();
  const count = await BillingInvoice.countDocuments({
    organizationId: new mongoose.Types.ObjectId(String(organizationId)),
  });
  const seq = String(count + 1).padStart(5, '0');
  return `ARV-${year}-${seq}`;
}

/**
 * @param {{ organizationId: string|ObjectId, taxMinor?: number, taxDetails?: object|null }} params
 */
async function createDraftInvoiceFromSubscription(params) {
  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    throw new Error('Billing subscription missing');
  }
  if (
    subscription.status === SUBSCRIPTION_STATUSES.TRIALING
    && !params.allowWhileTrialing
  ) {
    throw new Error(
      'Billing starts when your trial ends. Start paid plan early, or wait until the trial completes.'
    );
  }
  if (
    subscription.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED
    && !params.allowWhileTrialing
    && !params.allowWhilePaymentPending
  ) {
    throw new Error('Subscribe to continue — your free trial has ended.');
  }
  if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
    throw new Error('Subscription period not set');
  }

  const Organization = require('../../models/Organization');
  const org = await Organization.findById(organizationId)
    .select('name companyName gstin gstRegistered billingEmail billingPhone billingAddressStructured')
    .lean();

  const items = await BillingSubscriptionItem.find({
    subscriptionId: subscription._id,
    status: ITEM_STATUSES.ACTIVE,
    quantity: { $gt: 0 },
  });

  const products = await BillingProduct.find({
    code: { $in: items.map((i) => i.productCode) },
  }).lean();
  const nameByCode = Object.fromEntries(products.map((p) => [p.code, p.name]));

  let subtotalMinor = 0;
  const lineSpecs = items.map((item) => {
    const amountMinor = item.unitAmountMinor * item.quantity;
    subtotalMinor += amountMinor;
    return {
      productCode: item.productCode,
      description: nameByCode[item.productCode] || item.productCode,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor,
      amountMinor,
      currency: item.currency,
      priceId: item.priceId,
      subscriptionItemId: item._id,
    };
  });

  const pendingDiscount = Math.max(0, Math.round(Number(subscription.pendingDiscountMinor) || 0));
  const recurringActive = (subscription.recurringDiscountPeriodsRemaining || 0) > 0
    ? Math.max(0, Math.round(Number(subscription.recurringDiscountMinor) || 0))
    : 0;
  const oneShotApplied = Math.min(pendingDiscount, subtotalMinor);
  const recurringApplied = Math.min(recurringActive, Math.max(0, subtotalMinor - oneShotApplied));
  const discountMinor = oneShotApplied + recurringApplied;
  const discountParts = [];
  if (oneShotApplied > 0) {
    discountParts.push(subscription.pendingDiscountReason || 'one-shot');
  }
  if (recurringApplied > 0) {
    discountParts.push(subscription.recurringDiscountReason || 'recurring');
  }
  const discountReason = discountParts.length ? discountParts.join(' · ') : null;

  const creditAppliedMinor = Math.min(
    subscription.creditBalanceMinor || 0,
    Math.max(0, subtotalMinor - discountMinor)
  );
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor - creditAppliedMinor);

  let taxMinor;
  let taxDetails;
  if (params.taxMinor != null || params.taxDetails) {
    taxMinor = Math.max(0, Number(params.taxMinor) || 0);
    taxDetails = params.taxDetails || null;
  } else if (params.applyTax === false || subscription.metadata?.notBillable) {
    const zero = calculateCommercialTax(taxableMinor, { enabled: false });
    taxMinor = 0;
    taxDetails = zero.taxDetails;
  } else {
    const tax = calculateCommercialTax(taxableMinor, params.taxOverride || null);
    taxMinor = tax.taxMinor;
    taxDetails = tax.taxDetails;
  }

  const totalMinor = Math.max(0, taxableMinor + taxMinor);

  const invoice = await BillingInvoice.create({
    organizationId,
    subscriptionId: subscription._id,
    invoiceNumber: await nextInvoiceNumber(organizationId),
    status: INVOICE_STATUSES.DRAFT,
    currency: subscription.currency,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    subtotalMinor,
    discountMinor,
    taxMinor,
    creditAppliedMinor,
    totalMinor,
    amountPaidMinor: 0,
    taxDetails,
    snapshot: {
      pricingProgramCode: subscription.pricingProgramCode,
      billingCycle: subscription.billingCycle,
      priceProtectionExpiresAt: subscription.priceProtectionExpiresAt,
      sandboxInternal: Boolean(subscription.metadata?.sandboxInternal),
      pendingDiscountReason: discountReason,
      pendingDiscountConsumed: oneShotApplied > 0,
      oneShotDiscountAppliedMinor: oneShotApplied,
      recurringDiscountAppliedMinor: recurringApplied,
      recurringDiscountPeriodsRemainingBefore: subscription.recurringDiscountPeriodsRemaining || 0,
      billTo: {
        companyName: org?.companyName || org?.name || null,
        gstin: org?.gstin || null,
        gstRegistered: Boolean(org?.gstRegistered),
        billingEmail: org?.billingEmail || null,
        billingPhone: org?.billingPhone || null,
        billingAddress: org?.billingAddressStructured || null,
      },
    },
  });

  await BillingInvoiceLine.insertMany(
    lineSpecs.map((line) => ({
      ...line,
      invoiceId: invoice._id,
      organizationId,
      taxMinor: 0,
    }))
  );

  // Consume one-shot and tick down repeating discount after minting period invoice.
  let subscriptionDirty = false;
  if (pendingDiscount > 0) {
    subscription.pendingDiscountMinor = 0;
    subscription.pendingDiscountReason = null;
    subscriptionDirty = true;
  }
  if (recurringApplied > 0) {
    subscription.recurringDiscountPeriodsRemaining = Math.max(
      0,
      (subscription.recurringDiscountPeriodsRemaining || 0) - 1
    );
    if (subscription.recurringDiscountPeriodsRemaining === 0) {
      subscription.recurringDiscountMinor = 0;
      subscription.recurringDiscountReason = null;
      subscription.recurringDiscountPeriodsTotal = 0;
    }
    subscriptionDirty = true;
  }
  if (subscriptionDirty) {
    await subscription.save();
  }

  return invoice;
}

/**
 * Finalize invoice — after this, lines/amounts must not change.
 */
async function finalizeInvoice(invoiceId) {
  const invoice = await BillingInvoice.findById(invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === INVOICE_STATUSES.FINALIZED || invoice.status === INVOICE_STATUSES.PAID) {
    return invoice;
  }
  if (invoice.status === INVOICE_STATUSES.VOID) {
    throw new Error('Cannot finalize void invoice');
  }

  invoice.status = INVOICE_STATUSES.FINALIZED;
  invoice.finalizedAt = new Date();
  invoice.dueAt = invoice.dueAt || invoice.periodEnd;
  await invoice.save();

  if (invoice.creditAppliedMinor > 0) {
    await BillingSubscription.findByIdAndUpdate(invoice.subscriptionId, {
      $inc: { creditBalanceMinor: -invoice.creditAppliedMinor },
    });
  }

  return invoice;
}

/**
 * @param {string|ObjectId} invoiceId
 */
async function getInvoiceWithLines(invoiceId) {
  const invoice = await BillingInvoice.findById(invoiceId).lean();
  if (!invoice) return null;
  if (invoice.status === INVOICE_STATUSES.DRAFT) {
    // draft may still be adjusted before finalize — caller must not treat as historical
  }
  const lines = await BillingInvoiceLine.find({ invoiceId: invoice._id }).lean();
  return { invoice, lines };
}

/**
 * @param {{ subscriptionId: ObjectId|string, periodStart: Date, periodEnd: Date }} params
 */
async function findNonVoidInvoiceForPeriod(params) {
  const subscriptionId = new mongoose.Types.ObjectId(String(params.subscriptionId));
  const periodStart = new Date(params.periodStart);
  const periodEnd = new Date(params.periodEnd);
  return BillingInvoice.findOne({
    subscriptionId,
    periodStart,
    periodEnd,
    status: { $ne: INVOICE_STATUSES.VOID },
  }).sort({ createdAt: 1 });
}

/**
 * Ensure a finalized/paid invoice exists for the subscription's current period window.
 * @returns {Promise<{ invoice: object, created: boolean }>}
 */
async function ensureFinalizedInvoiceForCurrentPeriod(organizationId) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId: orgId });
  if (!subscription) throw new Error('Billing subscription missing');
  if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
    throw new Error('Subscription period not set');
  }

  const existing = await findNonVoidInvoiceForPeriod({
    subscriptionId: subscription._id,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  });

  if (existing) {
    if (
      existing.status === INVOICE_STATUSES.FINALIZED
      || existing.status === INVOICE_STATUSES.PAID
      || existing.status === INVOICE_STATUSES.PAST_DUE
    ) {
      return { invoice: existing, created: false };
    }
    if (existing.status === INVOICE_STATUSES.DRAFT) {
      const finalized = await finalizeInvoice(existing._id);
      return { invoice: finalized, created: false };
    }
  }

  const draft = await createDraftInvoiceFromSubscription({ organizationId: orgId });
  const finalized = await finalizeInvoice(draft._id);
  return { invoice: finalized, created: true };
}

/**
 * When currentPeriodEnd has passed: finalize invoice for the ending period (if needed),
 * advance the subscription window, then invoice the new period in advance.
 * Idempotent across scheduler ticks.
 *
 * @param {{ organizationId: string|ObjectId, at?: Date, reconcile?: boolean }} params
 */
async function renewDueBillingPeriod(params) {
  const {
    advanceSubscriptionPeriod,
    applyPendingBillingCycleIfDue,
    reconcileCommercialSubscriptionFromUsage,
  } = require('./reconcileCommercialSubscription');

  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const now = params.at ? new Date(params.at) : new Date();

  let subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    return { renewed: false, reason: 'missing' };
  }
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { renewed: false, reason: 'not_billable' };
  }
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.ACTIVE
    && subscription.status !== SUBSCRIPTION_STATUSES.PAST_DUE
  ) {
    return { renewed: false, reason: 'status' };
  }

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  if (!periodEnd || periodEnd > now) {
    return { renewed: false, reason: 'period_not_ended' };
  }

  await applyPendingBillingCycleIfDue(subscription);
  subscription = await BillingSubscription.findById(subscription._id);
  if (!subscription) {
    return { renewed: false, reason: 'missing' };
  }

  const endAfterCycle = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  if (!endAfterCycle || endAfterCycle > now) {
    return { renewed: false, reason: 'period_not_ended_after_cycle' };
  }

  if (params.reconcile !== false) {
    try {
      await reconcileCommercialSubscriptionFromUsage({ organizationId });
      subscription = await BillingSubscription.findById(subscription._id);
    } catch (err) {
      console.warn('[renewDueBillingPeriod] reconcile failed', {
        organizationId: String(organizationId),
        error: err.message,
      });
    }
  }

  const endingPeriodStart = subscription.currentPeriodStart;
  const endingPeriodEnd = subscription.currentPeriodEnd;

  const ending = await ensureFinalizedInvoiceForCurrentPeriod(organizationId);

  const advanced = await advanceSubscriptionPeriod(subscription);
  if (!advanced) {
    return {
      renewed: false,
      reason: 'advance_failed',
      endingInvoiceId: ending.invoice?._id || null,
    };
  }

  const advancedStart = advanced.currentPeriodStart
    ? new Date(advanced.currentPeriodStart).getTime()
    : null;
  const endingStartMs = endingPeriodStart
    ? new Date(endingPeriodStart).getTime()
    : null;

  let renewal = null;
  if (advancedStart != null && advancedStart !== endingStartMs) {
    renewal = await ensureFinalizedInvoiceForCurrentPeriod(organizationId);
  }

  return {
    renewed: true,
    endingPeriodStart,
    endingPeriodEnd,
    endingInvoiceId: ending.invoice?._id || null,
    endingInvoiceCreated: ending.created,
    renewalInvoiceId: renewal?.invoice?._id || null,
    renewalInvoiceCreated: Boolean(renewal?.created),
    subscription: advanced,
  };
}

/**
 * Immediate mid-cycle charge invoice (adds only). Idempotent per billingEventId.
 * Skips while trialing / not-billable / zero amount.
 *
 * @param {{
 *   organizationId: string|ObjectId,
 *   productCode: string,
 *   description?: string,
 *   quantity?: number,
 *   unitAmountMinor: number,
 *   amountMinor: number,
 *   prorationFactor?: number,
 *   billingEventId?: string|ObjectId|null,
 *   priceId?: string|ObjectId|null,
 *   subscriptionItemId?: string|ObjectId|null,
 * }} params
 */
async function issueImmediateProrationInvoice(params) {
  const amountMinor = Math.max(0, Math.round(Number(params.amountMinor) || 0));
  if (amountMinor <= 0) {
    return { issued: false, reason: 'zero_amount' };
  }

  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const billingEventId = params.billingEventId ? String(params.billingEventId) : null;

  if (billingEventId) {
    const existingLine = await BillingInvoiceLine.findOne({
      organizationId,
      'metadata.billingEventId': billingEventId,
    }).lean();
    if (existingLine) {
      const existing = await getInvoiceWithLines(existingLine.invoiceId);
      return {
        issued: false,
        reason: 'duplicate_event',
        invoice: existing?.invoice || null,
        lines: existing?.lines || [],
      };
    }
  }

  const subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    return { issued: false, reason: 'missing_subscription' };
  }
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { issued: false, reason: 'not_billable' };
  }
  if (subscription.status === SUBSCRIPTION_STATUSES.TRIALING) {
    return { issued: false, reason: 'trialing' };
  }
  if (subscription.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED) {
    return { issued: false, reason: 'trial_expired' };
  }
  if (
    subscription.status !== SUBSCRIPTION_STATUSES.ACTIVE
    && subscription.status !== SUBSCRIPTION_STATUSES.PAST_DUE
    && subscription.status !== SUBSCRIPTION_STATUSES.PAYMENT_PENDING
  ) {
    return { issued: false, reason: 'status' };
  }

  const productCode = String(params.productCode || '').toLowerCase();
  const quantity = Math.max(1, Math.round(Number(params.quantity) || 1));
  const unitAmountMinor = Math.max(0, Math.round(Number(params.unitAmountMinor) || 0));
  const now = new Date();
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : now;

  const creditAppliedMinor = Math.min(
    subscription.creditBalanceMinor || 0,
    amountMinor
  );
  const taxableMinor = Math.max(0, amountMinor - creditAppliedMinor);
  const tax = subscription.metadata?.notBillable
    ? calculateCommercialTax(taxableMinor, { enabled: false })
    : calculateCommercialTax(taxableMinor);
  const totalMinor = Math.max(0, taxableMinor + tax.taxMinor);

  const invoice = await BillingInvoice.create({
    organizationId,
    subscriptionId: subscription._id,
    invoiceNumber: await nextInvoiceNumber(organizationId),
    status: INVOICE_STATUSES.DRAFT,
    currency: subscription.currency,
    periodStart: now,
    periodEnd,
    subtotalMinor: amountMinor,
    discountMinor: 0,
    taxMinor: tax.taxMinor,
    creditAppliedMinor,
    totalMinor,
    amountPaidMinor: 0,
    taxDetails: tax.taxDetails,
    dueAt: now,
    snapshot: {
      pricingProgramCode: subscription.pricingProgramCode,
      billingCycle: subscription.billingCycle,
      kind: 'proration',
      prorationFactor: params.prorationFactor ?? null,
      billingEventId,
    },
  });

  await BillingInvoiceLine.create({
    invoiceId: invoice._id,
    organizationId,
    productCode,
    description: params.description
      || `Prorated ${productCode} (${Math.round((params.prorationFactor || 0) * 100)}% of period)`,
    quantity,
    unitAmountMinor,
    amountMinor,
    taxMinor: tax.taxMinor,
    currency: subscription.currency,
    priceId: params.priceId || null,
    subscriptionItemId: params.subscriptionItemId || null,
    metadata: {
      kind: 'proration',
      prorationFactor: params.prorationFactor ?? null,
      billingEventId,
    },
  });

  const finalized = await finalizeInvoice(invoice._id);
  return {
    issued: true,
    invoice: finalized,
    creditAppliedMinor,
  };
}

module.exports = {
  createDraftInvoiceFromSubscription,
  finalizeInvoice,
  getInvoiceWithLines,
  nextInvoiceNumber,
  findNonVoidInvoiceForPeriod,
  ensureFinalizedInvoiceForCurrentPeriod,
  renewDueBillingPeriod,
  issueImmediateProrationInvoice,
};

