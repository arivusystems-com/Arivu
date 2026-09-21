'use strict';

const mongoose = require('mongoose');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const BillingProduct = require('../../models/commercial/BillingProduct');
const { getActivePrice } = require('./pricingCatalogService');
const {
  reserveFounderAllocation,
  activateFounderAllocation,
} = require('./founderProgramService');
const {
  SUBSCRIPTION_STATUSES,
  BILLING_PERIODS,
  ITEM_STATUSES,
  PRODUCT_CODES,
  PRICING_PROGRAM_CODES,
  CURRENCY_INR,
} = require('../../constants/commercialBilling');

function addPeriod(date, billingCycle) {
  const d = new Date(date);
  if (billingCycle === BILLING_PERIODS.ANNUAL) {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Ensure one commercial subscription for the org (idempotent).
 * @param {{
 *   organizationId: string|ObjectId,
 *   billingCycle?: string,
 *   pricingProgramCode?: string|null,
 *   claimFounder?: boolean,
 *   trialDays?: number,
 * }} params
 */
async function ensureBillingSubscription(params) {
  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const billingCycle = params.billingCycle || BILLING_PERIODS.MONTHLY;
  let claimFounder = params.claimFounder !== false;
  let pricingProgramCode = params.pricingProgramCode || null;

  let subscription = await BillingSubscription.findOne({ organizationId });
  if (subscription) {
    return { created: false, subscription };
  }

  const { isInternalOrganization } = require('../../utils/internalOrganization');
  const isInternal = await isInternalOrganization(organizationId);
  let sandboxInternal = false;
  if (isInternal) {
    // Internal/master orgs must never consume Founder capacity.
    claimFounder = false;
    sandboxInternal = true;
    // Use Founder Launch price book for sandbox totals without FounderAllocation.
    pricingProgramCode = pricingProgramCode || PRICING_PROGRAM_CODES.FOUNDER_LAUNCH;
  }

  let priceProtectionExpiresAt = null;
  if (claimFounder && !pricingProgramCode) {
    const reserved = await reserveFounderAllocation({ organizationId });
    if (reserved.allocated || reserved.reason === 'already_allocated') {
      pricingProgramCode = PRICING_PROGRAM_CODES.FOUNDER_LAUNCH;
      priceProtectionExpiresAt = reserved.allocation?.priceProtectionExpiresAt || null;
    }
  }

  const now = new Date();
  const trialDays = Math.max(0, Number(params.trialDays) || 0);
  const trialEnd = trialDays > 0
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  // Trial window: no paid period yet. currentPeriodEnd = trialEnd so first bill lands at trial completion.
  const periodStart = now;
  const periodEnd = trialEnd || addPeriod(now, billingCycle);

  subscription = await BillingSubscription.create({
    organizationId,
    status: trialEnd && !sandboxInternal ? SUBSCRIPTION_STATUSES.TRIALING : SUBSCRIPTION_STATUSES.ACTIVE,
    billingCycle,
    currency: CURRENCY_INR,
    pricingProgramCode,
    priceProtectionExpiresAt: sandboxInternal ? null : priceProtectionExpiresAt,
    startDate: now,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEnd: sandboxInternal ? null : trialEnd,
    metadata: sandboxInternal ? { sandboxInternal: true, notBillable: true } : {},
  });

  if (!sandboxInternal && pricingProgramCode === PRICING_PROGRAM_CODES.FOUNDER_LAUNCH) {
    await activateFounderAllocation({
      organizationId,
      billingSubscriptionId: subscription._id,
    });
  }

  await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.ADMIN_USER,
    quantity: 0,
  });

  await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.STANDARD_USER,
    quantity: 0,
  });

  // Zero out legacy platform / internal_user include model when present.
  try {
    await attachOrUpdateItem({
      subscription,
      productCode: PRODUCT_CODES.PLATFORM,
      quantity: 0,
    });
  } catch (_) {
    /* platform product may be inactive */
  }
  try {
    await attachOrUpdateItem({
      subscription,
      productCode: PRODUCT_CODES.INTERNAL_USER,
      quantity: 0,
    });
  } catch (_) {
    /* optional legacy */
  }

  return { created: true, subscription };
}

/**
 * Attach or set quantity on a subscription item with price snapshot.
 * @param {{ subscription: object, productCode: string, quantity: number }} params
 */
async function attachOrUpdateItem({ subscription, productCode, quantity, includedQuantity = null }) {
  const code = String(productCode).toLowerCase();
  const product = await BillingProduct.findOne({ code });
  if (!product) {
    throw new Error(`Unknown billing product: ${code}`);
  }

  const {
    PRODUCT_CODES,
    LEARNING_PLANS,
    LEARNING_PRIMARY_PLAN_KEY,
    PRICING_MODELS,
  } = require('../../constants/commercialBilling');

  let priceOpts = {
    pricingProgramCode: subscription.pricingProgramCode || PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
    billingPeriod: subscription.billingCycle,
  };

  if (code === PRODUCT_CODES.LEARNING) {
    const plan = LEARNING_PLANS[LEARNING_PRIMARY_PLAN_KEY];
    const capacity = includedQuantity != null ? Number(includedQuantity) : plan.capacity;
    priceOpts.includedQuantity = capacity;
    quantity = 1;
  }

  const price = await getActivePrice(code, priceOpts);
  if (!price) {
    throw new Error(`No price for ${code}`);
  }

  const existing = await BillingSubscriptionItem.findOne({
    subscriptionId: subscription._id,
    productCode: code,
    status: ITEM_STATUSES.ACTIVE,
  });

  if (existing) {
    // Quantity only for most products — never rewrite snapshotted unitAmountMinor / priceId.
    // Learning: capacity is on price.includedQuantity; plan changes end + re-attach.
    if (code === PRODUCT_CODES.LEARNING) {
      const BillingPrice = require('../../models/commercial/BillingPrice');
      const desiredCapacity =
        includedQuantity != null
          ? Number(includedQuantity)
          : LEARNING_PLANS[LEARNING_PRIMARY_PLAN_KEY].capacity;
      const currentPrice = existing.priceId
        ? await BillingPrice.findById(existing.priceId).lean()
        : null;
      if (currentPrice && Number(currentPrice.includedQuantity) === desiredCapacity) {
        existing.quantity = 1;
        await existing.save();
        return existing;
      }
      existing.status = ITEM_STATUSES.ENDED;
      existing.effectiveTo = new Date();
      await existing.save();
    } else {
      existing.quantity = Math.max(0, Number(quantity) || 0);
      await existing.save();
      return existing;
    }
  }

  return BillingSubscriptionItem.create({
    subscriptionId: subscription._id,
    organizationId: subscription.organizationId,
    productId: product._id,
    productCode: code,
    priceId: price._id,
    quantity: code === PRODUCT_CODES.LEARNING ? 1 : Math.max(0, Number(quantity) || 0),
    unitAmountMinor: price.amountMinor,
    currency: price.currency,
    billingModel: price.pricingModel || (code === PRODUCT_CODES.LEARNING ? PRICING_MODELS.TIERED_CAPACITY : undefined),
    billingPeriod: subscription.billingCycle,
    effectiveFrom: new Date(),
    status: ITEM_STATUSES.ACTIVE,
  });
}

/**
 * Proration factor for mid-cycle addition (remaining days / period days).
 * @param {object} subscription
 * @param {Date} [at]
 */
function prorationFactor(subscription, at = new Date()) {
  const start = subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : null;
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (!start || !end || end <= start) return 1;
  const totalMs = end.getTime() - start.getTime();
  const remainingMs = Math.max(0, end.getTime() - at.getTime());
  return Math.min(1, remainingMs / totalMs);
}

/**
 * @param {string|ObjectId} organizationId
 */
async function getSubscriptionWithItems(organizationId) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId: orgId }).lean();
  if (!subscription) return null;
  const items = await BillingSubscriptionItem.find({
    subscriptionId: subscription._id,
    status: ITEM_STATUSES.ACTIVE,
  }).lean();
  return { subscription, items };
}

/**
 * Keep trialing subscriptions' billing window aligned to trialEnd (repairs older rows
 * that used a full monthly period during trial).
 */
async function normalizeTrialBillingWindow(subscription) {
  if (!subscription?._id) return subscription;
  if (subscription.status !== SUBSCRIPTION_STATUSES.TRIALING) return subscription;
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return subscription;
  }

  const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const periodAligned = Boolean(trialEnd && periodEnd && periodEnd.getTime() === trialEnd.getTime());
  const hasPhantomCredit = (subscription.creditBalanceMinor || 0) > 0;

  if (periodAligned && !hasPhantomCredit) {
    return subscription;
  }

  const doc = subscription.save
    ? subscription
    : await BillingSubscription.findById(subscription._id);
  if (!doc) return subscription;

  if (trialEnd && (!periodEnd || periodEnd.getTime() !== trialEnd.getTime())) {
    doc.currentPeriodEnd = trialEnd;
    if (!doc.currentPeriodStart) {
      doc.currentPeriodStart = doc.startDate || new Date();
    }
  }
  // Trial never charges — wipe phantom removal credits accrued from sync bugs.
  if ((doc.creditBalanceMinor || 0) > 0) {
    doc.creditBalanceMinor = 0;
  }
  await doc.save();
  return doc;
}

/**
 * End trial and open the first paid billing period.
 * When createInvoice is true, status becomes payment_pending until payment succeeds.
 *
 * @param {{
 *   organizationId: string|ObjectId,
 *   at?: Date,
 *   createInvoice?: boolean,
 *   early?: boolean,
 *   billingCycle?: string,
 * }} params
 */
async function convertTrialToPaid(params) {
  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    throw new Error('Billing subscription missing');
  }
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { converted: false, reason: 'not_billable', subscription };
  }

  const convertible = new Set([
    SUBSCRIPTION_STATUSES.TRIALING,
    SUBSCRIPTION_STATUSES.TRIAL_EXPIRED,
    SUBSCRIPTION_STATUSES.PAYMENT_PENDING,
    SUBSCRIPTION_STATUSES.CANCELED,
    SUBSCRIPTION_STATUSES.EXPIRED,
  ]);
  if (!convertible.has(subscription.status)) {
    return { converted: false, reason: 'not_eligible', subscription };
  }

  const now = params.at ? new Date(params.at) : new Date();
  if (
    !params.early
    && subscription.status === SUBSCRIPTION_STATUSES.TRIALING
    && subscription.trialEnd
    && new Date(subscription.trialEnd) > now
  ) {
    return { converted: false, reason: 'trial_not_ended', subscription };
  }

  if (
    params.billingCycle
    && Object.values(BILLING_PERIODS).includes(String(params.billingCycle).toLowerCase())
  ) {
    subscription.billingCycle = String(params.billingCycle).toLowerCase();
  }

  // Re-snapshot line prices when cycle changed (monthly ↔ annual) before invoicing.
  {
    const items = await BillingSubscriptionItem.find({
      subscriptionId: subscription._id,
      status: ITEM_STATUSES.ACTIVE,
    });
    const needsReprice = items.some(
      (item) => String(item.billingPeriod || '') !== String(subscription.billingCycle)
    );
    if (needsReprice && items.length) {
      const snapshot = items.map((item) => ({
        productCode: item.productCode,
        quantity: item.quantity,
      }));
      for (const item of items) {
        item.status = ITEM_STATUSES.ENDED;
        item.effectiveTo = now;
        await item.save();
      }
      await subscription.save();
      for (const row of snapshot) {
        await attachOrUpdateItem({
          subscription,
          productCode: row.productCode,
          quantity: row.quantity,
        });
      }
    }
  }

  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = addPeriod(now, subscription.billingCycle);
  subscription.cancelAtPeriodEnd = false;
  subscription.canceledAt = null;
  if (subscription.metadata?.cancelPreview) {
    delete subscription.metadata.cancelPreview;
    subscription.markModified('metadata');
  }

  let invoice = null;
  const shouldInvoice = params.createInvoice !== false;
  if (shouldInvoice) {
    subscription.status = SUBSCRIPTION_STATUSES.PAYMENT_PENDING;
    await subscription.save();
    const {
      createDraftInvoiceFromSubscription,
      finalizeInvoice,
    } = require('./invoiceService');
    const draft = await createDraftInvoiceFromSubscription({
      organizationId,
      allowWhileTrialing: true,
      allowWhilePaymentPending: true,
    });
    invoice = await finalizeInvoice(draft._id);
  } else {
    subscription.status = SUBSCRIPTION_STATUSES.ACTIVE;
    await subscription.save();
  }

  return {
    converted: true,
    early: Boolean(params.early),
    subscription,
    invoice,
  };
}

/**
 * Expire trial without invoicing — lock until Subscribe.
 */
async function expireTrialIfDue(subscription, options = {}) {
  if (!subscription) return { applied: false, reason: 'missing' };
  if (subscription.status !== SUBSCRIPTION_STATUSES.TRIALING) {
    return { applied: false, reason: 'not_trialing' };
  }
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { applied: false, reason: 'not_billable' };
  }
  const at = options.at ? new Date(options.at) : new Date();
  const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;
  if (!trialEnd || trialEnd > at) {
    await normalizeTrialBillingWindow(subscription);
    return { applied: false, reason: 'trial_not_ended' };
  }

  const doc = subscription.save
    ? subscription
    : await BillingSubscription.findById(subscription._id);
  if (!doc) return { applied: false, reason: 'missing' };
  doc.status = SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
  await doc.save();

  try {
    const { suspendInstanceForBilling } = require('./instanceBillingLifecycle');
    await suspendInstanceForBilling(doc.organizationId, 'commercial_trial_expired');
  } catch (err) {
    console.warn('[expireTrialIfDue] instance suspend failed', err.message);
  }

  return { applied: true, subscription: doc };
}

/**
 * If trial has ended, expire (lock) — do not auto-convert to paid.
 */
async function applyTrialEndIfDue(subscription, options = {}) {
  return expireTrialIfDue(subscription, options);
}

/**
 * Subscribe / activate from trial or trial_expired: open period + first invoice (payment_pending).
 */
async function subscribeAndInvoice(params) {
  return convertTrialToPaid({
    organizationId: params.organizationId,
    billingCycle: params.billingCycle,
    createInvoice: true,
    early: true,
    at: params.at,
  });
}

/**
 * Attach or change Learning (learning_app) TIERED_CAPACITY plan and grant org entitlement.
 * @param {{ organizationId: string|ObjectId, planKey?: string }} params
 */
async function setOrgLearningPlan(params) {
  const {
    LEARNING_PLANS,
    LEARNING_PRIMARY_PLAN_KEY,
  } = require('../../constants/commercialBilling');
  const { grantOrgLearningCapacityEntitlement } = require('./entitlementService');

  const planKey = String(params.planKey || LEARNING_PRIMARY_PLAN_KEY).toLowerCase();
  const plan = LEARNING_PLANS[planKey];
  if (!plan) {
    const err = new Error(`Unknown Learning plan: ${params.planKey}`);
    err.code = 'INVALID_LEARNING_PLAN';
    throw err;
  }

  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  let subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    const ensured = await ensureBillingSubscription({
      organizationId,
      claimFounder: false,
      billingCycle: params.billingCycle || BILLING_PERIODS.MONTHLY,
    });
    subscription = ensured.subscription;
  }

  const item = await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.LEARNING,
    quantity: 1,
    includedQuantity: plan.capacity,
  });

  const entitlement = await grantOrgLearningCapacityEntitlement({
    organizationId,
    subscriptionId: subscription._id,
    capacity: plan.capacity,
    sourceSubscriptionItemId: item._id,
  });

  return {
    planKey: plan.planKey,
    capacity: plan.capacity,
    monthlyPaise: plan.monthlyPaise,
    item,
    entitlement,
    subscription,
  };
}

module.exports = {
  ensureBillingSubscription,
  attachOrUpdateItem,
  prorationFactor,
  getSubscriptionWithItems,
  addPeriod,
  changeBillingCycle,
  normalizeTrialBillingWindow,
  convertTrialToPaid,
  applyTrialEndIfDue,
  expireTrialIfDue,
  subscribeAndInvoice,
  setOrgLearningPlan,
};

/**
 * Change billing cycle.
 * Default: schedule at period end (annual ↔ monthly policy).
 * immediate=true: apply now, end active items, re-attach with new period price snapshots.
 *
 * @param {{
 *   organizationId: string|ObjectId,
 *   billingCycle: string,
 *   immediate?: boolean,
 * }} params
 */
async function changeBillingCycle(params) {
  const organizationId = new mongoose.Types.ObjectId(String(params.organizationId));
  const nextCycle = String(params.billingCycle || '').toLowerCase();
  if (!Object.values(BILLING_PERIODS).includes(nextCycle)) {
    throw new Error('billingCycle must be monthly or annual');
  }

  const subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    throw new Error('Billing subscription missing');
  }

  if (subscription.billingCycle === nextCycle && !subscription.pendingBillingCycle) {
    return { changed: false, subscription, reason: 'already_on_cycle' };
  }

  if (!params.immediate) {
    subscription.pendingBillingCycle = nextCycle;
    await subscription.save();
    return {
      changed: true,
      effective: 'renewal',
      subscription,
      pendingBillingCycle: nextCycle,
    };
  }

  const items = await BillingSubscriptionItem.find({
    subscriptionId: subscription._id,
    status: ITEM_STATUSES.ACTIVE,
  });

  const snapshot = items.map((item) => ({
    productCode: item.productCode,
    quantity: item.quantity,
  }));

  const now = new Date();
  for (const item of items) {
    item.status = ITEM_STATUSES.ENDED;
    item.effectiveTo = now;
    await item.save();
  }

  subscription.billingCycle = nextCycle;
  subscription.pendingBillingCycle = null;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = addPeriod(now, nextCycle);
  await subscription.save();

  for (const row of snapshot) {
    await attachOrUpdateItem({
      subscription,
      productCode: row.productCode,
      quantity: row.quantity,
    });
  }

  return {
    changed: true,
    effective: 'immediate',
    subscription,
    itemsRepriced: snapshot.length,
  };
}
