'use strict';

const mongoose = require('mongoose');
const BillingEntitlement = require('../../models/commercial/BillingEntitlement');
const BillingProduct = require('../../models/commercial/BillingProduct');
const {
  ENTITLEMENT_TYPES,
  ENTITLEMENT_SCOPES,
  PRODUCT_CODES,
  PRODUCT_CODE_TO_APP_KEY,
  PLATFORM_INCLUDED_INTERNAL_USERS,
} = require('../../constants/commercialBilling');

/**
 * Central commercial entitlement reads. Authorization should call these —
 * never embed catalog prices or invoice logic in app controllers.
 */

async function listActiveEntitlements(organizationId, filters = {}) {
  const query = {
    organizationId: new mongoose.Types.ObjectId(String(organizationId)),
    status: 'active',
    ...filters,
  };
  return BillingEntitlement.find(query).lean();
}

/**
 * @param {{ organizationId: string|ObjectId, userId: string|ObjectId, appKey: string }} params
 */
async function userHasApplicationEntitlement({ organizationId, userId, appKey }) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const uid = new mongoose.Types.ObjectId(String(userId));
  const key = String(appKey).toUpperCase();

  const entitlement = await BillingEntitlement.findOne({
    organizationId: orgId,
    userId: uid,
    type: ENTITLEMENT_TYPES.APPLICATION,
    appKey: key,
    status: 'active',
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: new Date() } }],
  }).lean();

  return Boolean(entitlement);
}

/**
 * Org-level platform entitlement present and active.
 */
async function organizationHasPlatformEntitlement(organizationId) {
  const entitlement = await BillingEntitlement.findOne({
    organizationId: new mongoose.Types.ObjectId(String(organizationId)),
    type: ENTITLEMENT_TYPES.PLATFORM,
    productCode: PRODUCT_CODES.PLATFORM,
    status: 'active',
  }).lean();
  return Boolean(entitlement);
}

/**
 * Grant or refresh entitlements derived from subscription bootstrap.
 * Does not set role permissions.
 */
async function ensurePlatformEntitlements({ organizationId, subscriptionId }) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const subId = new mongoose.Types.ObjectId(String(subscriptionId));

  await BillingEntitlement.findOneAndUpdate(
    {
      organizationId: orgId,
      type: ENTITLEMENT_TYPES.PLATFORM,
      productCode: PRODUCT_CODES.PLATFORM,
      scope: ENTITLEMENT_SCOPES.ORGANIZATION,
      userId: null,
    },
    {
      $set: {
        subscriptionId: subId,
        quantity: 1,
        status: 'active',
        effectiveFrom: new Date(),
        effectiveTo: null,
      },
    },
    { upsert: true, new: true }
  );

  await BillingEntitlement.findOneAndUpdate(
    {
      organizationId: orgId,
      type: ENTITLEMENT_TYPES.INTERNAL_USER,
      productCode: PRODUCT_CODES.INTERNAL_USER,
      scope: ENTITLEMENT_SCOPES.ORGANIZATION,
      userId: null,
    },
    {
      $set: {
        subscriptionId: subId,
        quantity: PLATFORM_INCLUDED_INTERNAL_USERS,
        status: 'active',
        effectiveFrom: new Date(),
        effectiveTo: null,
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Assign application entitlement to a user (billing gate, not RBAC).
 */
async function grantUserApplicationEntitlement({
  organizationId,
  subscriptionId,
  userId,
  productCode,
  sourceSubscriptionItemId = null,
}) {
  const code = String(productCode).toLowerCase();
  const product = await BillingProduct.findOne({ code }).lean();
  const appKey = product?.appKey || PRODUCT_CODE_TO_APP_KEY[code] || null;

  return BillingEntitlement.findOneAndUpdate(
    {
      organizationId: new mongoose.Types.ObjectId(String(organizationId)),
      userId: new mongoose.Types.ObjectId(String(userId)),
      type: ENTITLEMENT_TYPES.APPLICATION,
      productCode: code,
      scope: ENTITLEMENT_SCOPES.USER,
    },
    {
      $set: {
        subscriptionId: new mongoose.Types.ObjectId(String(subscriptionId)),
        appKey,
        quantity: 1,
        status: 'active',
        effectiveFrom: new Date(),
        effectiveTo: null,
        sourceSubscriptionItemId,
      },
    },
    { upsert: true, new: true }
  );
}

/**
 * Revoke user application entitlement immediately (credit policy handled by billingService).
 */
async function revokeUserApplicationEntitlement({ organizationId, userId, productCode }) {
  return BillingEntitlement.findOneAndUpdate(
    {
      organizationId: new mongoose.Types.ObjectId(String(organizationId)),
      userId: new mongoose.Types.ObjectId(String(userId)),
      productCode: String(productCode).toLowerCase(),
      type: ENTITLEMENT_TYPES.APPLICATION,
      status: 'active',
    },
    {
      $set: {
        status: 'revoked',
        effectiveTo: new Date(),
      },
    },
    { new: true }
  );
}

/**
 * Org-scoped Learning capacity entitlement (quantity = learner seat capacity).
 */
async function grantOrgLearningCapacityEntitlement({
  organizationId,
  subscriptionId,
  capacity,
  sourceSubscriptionItemId = null,
}) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const seats = Math.max(0, Number(capacity) || 0);
  return BillingEntitlement.findOneAndUpdate(
    {
      organizationId: orgId,
      type: ENTITLEMENT_TYPES.APPLICATION,
      productCode: PRODUCT_CODES.LEARNING,
      scope: ENTITLEMENT_SCOPES.ORGANIZATION,
      userId: null,
    },
    {
      $set: {
        subscriptionId: new mongoose.Types.ObjectId(String(subscriptionId)),
        appKey: 'LMS',
        quantity: seats,
        status: 'active',
        effectiveFrom: new Date(),
        effectiveTo: null,
        sourceSubscriptionItemId,
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = {
  listActiveEntitlements,
  userHasApplicationEntitlement,
  organizationHasPlatformEntitlement,
  ensurePlatformEntitlements,
  grantUserApplicationEntitlement,
  revokeUserApplicationEntitlement,
  grantOrgLearningCapacityEntitlement,
};
