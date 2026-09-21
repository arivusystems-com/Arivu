'use strict';

const mongoose = require('mongoose');
const BillingEvent = require('../../models/commercial/BillingEvent');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const {
  ensureBillingSubscription,
  attachOrUpdateItem,
  prorationFactor,
  changeBillingCycle,
} = require('./subscriptionService');
const {
  ensurePlatformEntitlements,
  grantUserApplicationEntitlement,
  revokeUserApplicationEntitlement,
} = require('./entitlementService');
const { getActivePrice } = require('./pricingCatalogService');
const {
  BILLING_EVENT_TYPES,
  BILLING_EVENT_STATUSES,
  ITEM_STATUSES,
  PRODUCT_CODES,
  SUBSCRIPTION_STATUSES,
} = require('../../constants/commercialBilling');

async function chargeProrationIfNeeded({
  organizationId,
  subscription,
  productCode,
  proratedChargeMinor,
  prorationFactor: factor,
  billingEventId,
  description,
}) {
  const amount = Math.max(0, Math.round(Number(proratedChargeMinor) || 0));
  if (amount <= 0) return null;

  const price = await getActivePrice(productCode, {
    pricingProgramCode: subscription.pricingProgramCode,
    billingPeriod: subscription.billingCycle,
  });
  const { issueImmediateProrationInvoice } = require('./invoiceService');
  return issueImmediateProrationInvoice({
    organizationId,
    productCode,
    description,
    quantity: 1,
    unitAmountMinor: price?.amountMinor || amount,
    amountMinor: amount,
    prorationFactor: factor,
    billingEventId,
    priceId: price?._id || null,
  });
}

/**
 * Mid-period removal credit. Never mint while trialing / not-billable, or when qty did not drop.
 */
function removalCreditMinor({ subscription, unitAmountMinor, previousQty, nextQty }) {
  if (!subscription) return 0;
  if (subscription.status === SUBSCRIPTION_STATUSES.TRIALING) return 0;
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) return 0;
  const prev = Math.max(0, Number(previousQty) || 0);
  const next = Math.max(0, Number(nextQty) || 0);
  if (next >= prev) return 0;
  const unit = Math.max(0, Math.round(Number(unitAmountMinor) || 0));
  if (unit <= 0) return 0;
  const factor = prorationFactor(subscription);
  return Math.round(unit * factor) * (prev - next);
}

/**
 * Normalize org id from string | ObjectId | populated doc.
 * @param {unknown} value
 * @returns {mongoose.Types.ObjectId}
 */
function toOrganizationObjectId(value) {
  if (!value) {
    throw new Error('organizationId is required');
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'object' && value._id) {
    return new mongoose.Types.ObjectId(String(value._id));
  }
  return new mongoose.Types.ObjectId(String(value));
}

/**
 * Emit + process commercial billing events (idempotent).
 * Controllers must call this instead of mutating invoices directly.
 *
 * @param {{
 *   organizationId: string|ObjectId,
 *   type: string,
 *   idempotencyKey: string,
 *   payload?: object,
 *   initiatedByUserId?: string|ObjectId|null,
 * }} input
 */
async function recordBillingEvent(input) {
  const organizationId = toOrganizationObjectId(input.organizationId);
  const type = input.type;
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }
  if (!Object.values(BILLING_EVENT_TYPES).includes(type)) {
    throw new Error(`Unsupported billing event type: ${type}`);
  }

  try {
    const created = await BillingEvent.create({
      organizationId,
      type,
      idempotencyKey,
      payload: input.payload || {},
      status: BILLING_EVENT_STATUSES.PENDING,
      initiatedByUserId: input.initiatedByUserId || null,
    });
    return processBillingEvent(created);
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await BillingEvent.findOne({ organizationId, idempotencyKey });
      if (!existing) {
        throw err;
      }
      // Re-run failed / stuck pending events so Activate can recover after infra errors.
      if (
        existing.status === BILLING_EVENT_STATUSES.FAILED
        || existing.status === BILLING_EVENT_STATUSES.PENDING
      ) {
        existing.status = BILLING_EVENT_STATUSES.PENDING;
        existing.errorMessage = null;
        await existing.save();
        return processBillingEvent(existing);
      }
      return {
        duplicate: true,
        event: existing,
        result: existing.result || null,
      };
    }
    throw err;
  }
}

async function processBillingEvent(eventDoc) {
  const event = eventDoc;
  try {
    const result = await dispatchEvent(event);
    event.status = BILLING_EVENT_STATUSES.PROCESSED;
    event.processedAt = new Date();
    event.result = result;
    event.errorMessage = null;
    await event.save();
    return { duplicate: false, event, result };
  } catch (err) {
    event.status = BILLING_EVENT_STATUSES.FAILED;
    event.errorMessage = err.message || String(err);
    await event.save();
    throw err;
  }
}

async function dispatchEvent(event) {
  const { organizationId, type, payload } = event;

  switch (type) {
    case BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED: {
      const { created, subscription } = await ensureBillingSubscription({
        organizationId,
        billingCycle: payload.billingCycle,
        claimFounder: payload.claimFounder !== false,
        trialDays: payload.trialDays,
      });
      await ensurePlatformEntitlements({
        organizationId,
        subscriptionId: subscription._id,
      });
      return { created, subscriptionId: subscription._id };
    }

    case BILLING_EVENT_TYPES.USER_ADDED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const {
        normalizePlatformUserType,
        PLATFORM_USER_TYPES,
      } = require('../../constants/platformUserTypes');
      const seatType = normalizePlatformUserType(payload.userType, {
        isOwner: payload.isOwner,
        roleName: payload.roleName,
      });
      const productCode = seatType === PLATFORM_USER_TYPES.ADMIN
        ? PRODUCT_CODES.ADMIN_USER
        : PRODUCT_CODES.STANDARD_USER;
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const nextQty = (item?.quantity || 0) + 1;
      await attachOrUpdateItem({
        subscription,
        productCode,
        quantity: nextQty,
      });
      const factor = prorationFactor(subscription);
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const proratedChargeMinor = price ? Math.round(price.amountMinor * factor) : 0;
      const prorationInvoice = await chargeProrationIfNeeded({
        organizationId,
        subscription,
        productCode,
        proratedChargeMinor,
        prorationFactor: factor,
        billingEventId: event._id,
        description: `Prorated ${productCode === PRODUCT_CODES.ADMIN_USER ? 'Admin' : 'Standard'} seat`,
      });
      return {
        productCode,
        quantity: nextQty,
        proratedChargeMinor,
        prorationFactor: factor,
        prorationInvoiceId: prorationInvoice?.invoice?._id || null,
        prorationIssued: Boolean(prorationInvoice?.issued),
      };
    }

    case BILLING_EVENT_TYPES.USER_REMOVED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const {
        normalizePlatformUserType,
        PLATFORM_USER_TYPES,
      } = require('../../constants/platformUserTypes');
      const seatType = normalizePlatformUserType(payload.userType, {
        isOwner: payload.isOwner,
        roleName: payload.roleName,
      });
      const productCode = seatType === PLATFORM_USER_TYPES.ADMIN
        ? PRODUCT_CODES.ADMIN_USER
        : PRODUCT_CODES.STANDARD_USER;
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const previousQty = item?.quantity || 0;
      const nextQty = Math.max(0, previousQty - 1);
      await attachOrUpdateItem({
        subscription,
        productCode,
        quantity: nextQty,
      });
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const credit = removalCreditMinor({
        subscription,
        unitAmountMinor: price?.amountMinor,
        previousQty,
        nextQty,
      });
      if (credit > 0) {
        subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + credit;
        await subscription.save();
      }
      return { productCode, quantity: nextQty, creditAppliedMinor: credit };
    }

    case BILLING_EVENT_TYPES.APPLICATION_ASSIGNED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const productCode = String(payload.productCode || '').toLowerCase();
      if (!productCode) throw new Error('productCode required');
      if (!payload.userId) throw new Error('userId required');

      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const nextQty = (item?.quantity || 0) + 1;
      const updatedItem = await attachOrUpdateItem({
        subscription,
        productCode,
        quantity: nextQty,
      });
      await grantUserApplicationEntitlement({
        organizationId,
        subscriptionId: subscription._id,
        userId: payload.userId,
        productCode,
        sourceSubscriptionItemId: updatedItem._id,
      });
      const factor = prorationFactor(subscription);
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const proratedChargeMinor = price ? Math.round(price.amountMinor * factor) : 0;
      const prorationInvoice = await chargeProrationIfNeeded({
        organizationId,
        subscription,
        productCode,
        proratedChargeMinor,
        prorationFactor: factor,
        billingEventId: event._id,
        description: `Prorated ${productCode} license`,
      });
      return {
        productCode,
        quantity: nextQty,
        proratedChargeMinor,
        prorationFactor: factor,
        prorationInvoiceId: prorationInvoice?.invoice?._id || null,
        prorationIssued: Boolean(prorationInvoice?.issued),
      };
    }

    case BILLING_EVENT_TYPES.APPLICATION_UNASSIGNED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const productCode = String(payload.productCode || '').toLowerCase();
      if (!productCode || !payload.userId) {
        throw new Error('productCode and userId required');
      }
      await revokeUserApplicationEntitlement({
        organizationId,
        userId: payload.userId,
        productCode,
      });
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const previousQty = item?.quantity || 0;
      const nextQty = Math.max(0, previousQty - 1);
      await attachOrUpdateItem({ subscription, productCode, quantity: nextQty });
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const credit = removalCreditMinor({
        subscription,
        unitAmountMinor: price?.amountMinor,
        previousQty,
        nextQty,
      });
      if (credit > 0) {
        subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + credit;
        await subscription.save();
      }
      return { productCode, quantity: nextQty, creditAppliedMinor: credit };
    }

    case BILLING_EVENT_TYPES.PORTAL_USER_ADDED:
    case BILLING_EVENT_TYPES.PORTAL_USER_REMOVED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode: PRODUCT_CODES.PORTAL_USER,
        status: ITEM_STATUSES.ACTIVE,
      });
      const delta = type === BILLING_EVENT_TYPES.PORTAL_USER_ADDED ? 1 : -1;
      const previousQty = item?.quantity || 0;
      const nextQty = Math.max(0, previousQty + delta);
      await attachOrUpdateItem({
        subscription,
        productCode: PRODUCT_CODES.PORTAL_USER,
        quantity: nextQty,
      });
      const factor = prorationFactor(subscription);
      const price = await getActivePrice(PRODUCT_CODES.PORTAL_USER, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      if (delta > 0) {
        const proratedChargeMinor = price ? Math.round(price.amountMinor * factor) : 0;
        const prorationInvoice = await chargeProrationIfNeeded({
          organizationId,
          subscription,
          productCode: PRODUCT_CODES.PORTAL_USER,
          proratedChargeMinor,
          prorationFactor: factor,
          billingEventId: event._id,
          description: 'Prorated portal user',
        });
        return {
          quantity: nextQty,
          proratedChargeMinor,
          prorationFactor: factor,
          prorationInvoiceId: prorationInvoice?.invoice?._id || null,
          prorationIssued: Boolean(prorationInvoice?.issued),
        };
      }
      const credit = removalCreditMinor({
        subscription,
        unitAmountMinor: price?.amountMinor,
        previousQty,
        nextQty,
      });
      if (credit > 0) {
        subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + credit;
        await subscription.save();
      }
      return { quantity: nextQty, creditAppliedMinor: credit };
    }

    case BILLING_EVENT_TYPES.BILLING_CYCLE_CHANGED: {
      return changeBillingCycle({
        organizationId,
        billingCycle: payload.billingCycle,
        immediate: payload.immediate === true,
      });
    }

    case BILLING_EVENT_TYPES.BOOSTER_ENABLED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const productCode = String(payload.productCode || '').toLowerCase();
      if (!productCode) throw new Error('productCode required');
      const qty = Math.max(1, Number(payload.quantity) || 1);
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const nextQty = (item?.quantity || 0) + qty;
      const updatedItem = await attachOrUpdateItem({
        subscription,
        productCode,
        quantity: nextQty,
      });
      const factor = prorationFactor(subscription);
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const proratedChargeMinor = price ? Math.round(price.amountMinor * factor * qty) : 0;
      const prorationInvoice = await chargeProrationIfNeeded({
        organizationId,
        subscription,
        productCode,
        proratedChargeMinor,
        prorationFactor: factor,
        billingEventId: event._id,
        description: `Prorated ${productCode}`,
      });
      return {
        productCode,
        quantity: nextQty,
        subscriptionItemId: updatedItem._id,
        proratedChargeMinor,
        prorationFactor: factor,
        prorationInvoiceId: prorationInvoice?.invoice?._id || null,
        prorationIssued: Boolean(prorationInvoice?.issued),
      };
    }

    case BILLING_EVENT_TYPES.BOOSTER_DISABLED: {
      const subscription = await BillingSubscription.findOne({ organizationId });
      if (!subscription) throw new Error('Billing subscription missing');
      const productCode = String(payload.productCode || '').toLowerCase();
      if (!productCode) throw new Error('productCode required');
      const item = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode,
        status: ITEM_STATUSES.ACTIVE,
      });
      const previousQty = item?.quantity || 0;
      const nextQty = Math.max(0, previousQty - Math.max(1, Number(payload.quantity) || 1));
      await attachOrUpdateItem({ subscription, productCode, quantity: nextQty });
      const price = await getActivePrice(productCode, {
        pricingProgramCode: subscription.pricingProgramCode,
        billingPeriod: subscription.billingCycle,
      });
      const credit = removalCreditMinor({
        subscription,
        unitAmountMinor: price?.amountMinor,
        previousQty,
        nextQty,
      });
      if (credit > 0) {
        subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + credit;
        await subscription.save();
      }
      return { productCode, quantity: nextQty, creditAppliedMinor: credit };
    }

    default:
      return { skipped: true, reason: 'handler_not_implemented', type };
  }
}

module.exports = {
  recordBillingEvent,
  processBillingEvent,
  toOrganizationObjectId,
};
