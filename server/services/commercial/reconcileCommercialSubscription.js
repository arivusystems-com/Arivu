'use strict';

const mongoose = require('mongoose');
const User = require('../../models/User');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const {
  ensureBillingSubscription,
  attachOrUpdateItem,
  changeBillingCycle,
  addPeriod,
} = require('./subscriptionService');
const {
  ensurePlatformEntitlements,
  grantUserApplicationEntitlement,
  revokeUserApplicationEntitlement,
  listActiveEntitlements,
} = require('./entitlementService');
const {
  PRODUCT_CODES,
  APP_KEY_TO_PRODUCT_CODE,
  ITEM_STATUSES,
} = require('../../constants/commercialBilling');
const {
  normalizePlatformUserType,
  PLATFORM_USER_TYPES,
  isExternalUserType,
} = require('../../constants/platformUserTypes');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');

function toOrgId(organizationId) {
  if (organizationId instanceof mongoose.Types.ObjectId) return organizationId;
  if (organizationId && typeof organizationId === 'object' && organizationId._id) {
    return new mongoose.Types.ObjectId(String(organizationId._id));
  }
  return new mongoose.Types.ObjectId(String(organizationId));
}

/**
 * Recompute commercial subscription item quantities from live users.
 * Does not invent prices — updates quantities on existing snapshotted items
 * or attaches new items with current catalog prices when first introduced.
 *
 * @param {{ organizationId: string|ObjectId, ensureSubscription?: boolean }} params
 */
async function reconcileCommercialSubscriptionFromUsage(params) {
  const organizationId = toOrgId(params.organizationId);

  let subscription = await BillingSubscription.findOne({ organizationId });
  if (!subscription) {
    if (params.ensureSubscription === false) {
      return { reconciled: false, reason: 'no_commercial_subscription' };
    }
    const ensured = await ensureBillingSubscription({
      organizationId,
      claimFounder: params.claimFounder !== false,
      billingCycle: params.billingCycle || 'monthly',
      trialDays: params.trialDays ?? require('../../constants/commercialBilling').DEFAULT_TRIAL_DAYS,
    });
    subscription = ensured.subscription;
  }

  await applyPendingBillingCycleIfDue(subscription);
  subscription = await BillingSubscription.findById(subscription._id);

  const Organization = require('../../models/Organization');
  const organization = await Organization.findById(organizationId).lean();
  if (organization) {
    const { syncPrivilegedUsersAppAccessForApp } = require('../roleSeedService');
    const enabledApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
    for (const entry of enabledApps) {
      const appKey = typeof entry === 'string' ? entry : entry?.appKey;
      const status = typeof entry === 'object' ? String(entry.status || 'ACTIVE') : 'ACTIVE';
      if (!appKey || status.toUpperCase() !== 'ACTIVE') continue;
      const productCode = APP_KEY_TO_PRODUCT_CODE[String(appKey).toUpperCase()];
      if (!productCode) continue;
      try {
        await syncPrivilegedUsersAppAccessForApp(organizationId, appKey, {
          organization,
          initiatedByUserId: params.initiatedByUserId || null,
        });
      } catch (syncErr) {
        console.warn('[reconcileCommercial] privileged appAccess sync failed:', syncErr.message);
      }
    }
  }

  const users = await User.find({
    organizationId,
    status: { $in: ['active', 'invited'] },
  })
    .select('_id userType isOwner role appAccess status')
    .lean();

  const adminUsers = [];
  const standardUsers = [];
  const portalUsers = [];
  for (const u of users) {
    if (isExternalUserType(u.userType)) {
      portalUsers.push(u);
      continue;
    }
    const type = normalizePlatformUserType(u.userType, {
      isOwner: u.isOwner,
      roleName: u.role,
    });
    if (type === PLATFORM_USER_TYPES.ADMIN) adminUsers.push(u);
    else standardUsers.push(u);
  }

  const staffUsers = [...adminUsers, ...standardUsers];

  const appLicenseCounts = {};
  for (const user of staffUsers) {
    const access = Array.isArray(user.appAccess) ? user.appAccess : [];
    for (const entry of access) {
      if (String(entry.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') continue;
      const appKey = String(entry.appKey || '').toUpperCase();
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      if (productCode === PRODUCT_CODES.LEARNING) continue;
      appLicenseCounts[productCode] = (appLicenseCounts[productCode] || 0) + 1;
    }
  }

  // Zero legacy platform flat fee; bill Admin @ 999 and Standard @ 699 per seat.
  try {
    await attachOrUpdateItem({
      subscription,
      productCode: PRODUCT_CODES.PLATFORM,
      quantity: 0,
    });
  } catch (_) { /* optional */ }

  await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.ADMIN_USER,
    quantity: adminUsers.length,
  });
  await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.STANDARD_USER,
    quantity: standardUsers.length,
  });
  // Keep legacy internal_user qty at 0 so old invoices/items don't double-count.
  try {
    await attachOrUpdateItem({
      subscription,
      productCode: PRODUCT_CODES.INTERNAL_USER,
      quantity: 0,
    });
  } catch (_) { /* optional */ }

  await attachOrUpdateItem({
    subscription,
    productCode: PRODUCT_CODES.PORTAL_USER,
    quantity: portalUsers.length,
  });

  const commercialAppCodes = Object.values(APP_KEY_TO_PRODUCT_CODE);
  for (const productCode of commercialAppCodes) {
    // Learning is TIERED_CAPACITY — plan qty stays 1; never reconcile from appAccess headcount.
    if (productCode === PRODUCT_CODES.LEARNING) continue;
    const qty = appLicenseCounts[productCode] || 0;
    const existing = await BillingSubscriptionItem.findOne({
      subscriptionId: subscription._id,
      productCode,
      status: ITEM_STATUSES.ACTIVE,
    });
    if (qty > 0 || existing) {
      await attachOrUpdateItem({
        subscription,
        productCode,
        quantity: qty,
      });
    }
  }

  // Instance add-ons / boosters from OrganizationSubscription.addons
  const addonCounts = {};
  try {
    const OrganizationSubscription = require('../../models/OrganizationSubscription');
    const {
      PRODUCT_CODE_TO_ADDON_KEY,
      PRODUCT_CODES: PC,
    } = require('../../constants/commercialBilling');
    const ADDON_TO_PRODUCT = Object.fromEntries(
      Object.entries(PRODUCT_CODE_TO_ADDON_KEY).map(([code, key]) => [key, code])
    );
    // Also map common booster codes without addon key
    const boosterCodes = [
      PC.STOCKROOM,
      PC.LIVE_AGENT,
      PC.CUSTOM_FIELDS,
      PC.CUSTOM_BUILDER,
      PC.STORAGE_GUARD,
    ];

    const orgSub = await OrganizationSubscription.findOne({ organizationId }).lean();
    const addons = Array.isArray(orgSub?.addons) ? orgSub.addons : [];
    for (const entry of addons) {
      const key = String(entry?.addonKey || entry?.key || entry || '').toLowerCase();
      const status = String(entry?.status || 'ACTIVE').toUpperCase();
      if (!key || (status !== 'ACTIVE' && status !== 'ENABLED')) continue;
      const productCode = ADDON_TO_PRODUCT[key];
      if (productCode) addonCounts[productCode] = 1;
    }

    for (const code of boosterCodes) {
      const existing = await BillingSubscriptionItem.findOne({
        subscriptionId: subscription._id,
        productCode: code,
        status: ITEM_STATUSES.ACTIVE,
      });
      const qty = addonCounts[code] || (existing?.quantity > 0 ? existing.quantity : 0);
      // Only sync when mapped from install OR already on subscription
      if (addonCounts[code] != null || existing) {
        await attachOrUpdateItem({
          subscription,
          productCode: code,
          quantity: addonCounts[code] != null ? addonCounts[code] : qty,
        });
      }
    }
  } catch (addonErr) {
    console.warn('[reconcileCommercial] addon sync skipped', addonErr.message);
  }

  await ensurePlatformEntitlements({
    organizationId,
    subscriptionId: subscription._id,
  });

  // Sync user application entitlements to match live appAccess
  const desired = new Set();
  for (const user of staffUsers) {
    const access = Array.isArray(user.appAccess) ? user.appAccess : [];
    for (const entry of access) {
      if (String(entry.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') continue;
      const appKey = String(entry.appKey || '').toUpperCase();
      const productCode = APP_KEY_TO_PRODUCT_CODE[appKey];
      if (!productCode) continue;
      desired.add(`${user._id}:${productCode}`);
      await grantUserApplicationEntitlement({
        organizationId,
        subscriptionId: subscription._id,
        userId: user._id,
        productCode,
      });
    }
  }

  const activeEntitlements = await listActiveEntitlements(organizationId, {
    type: 'application',
  });
  for (const ent of activeEntitlements) {
    if (!ent.userId) continue;
    const key = `${ent.userId}:${ent.productCode}`;
    if (!desired.has(key)) {
      await revokeUserApplicationEntitlement({
        organizationId,
        userId: ent.userId,
        productCode: ent.productCode,
      });
    }
  }

  return {
    reconciled: true,
    subscriptionId: subscription._id,
    counts: {
      adminUsers: adminUsers.length,
      standardUsers: standardUsers.length,
      portalUsers: portalUsers.length,
      applications: appLicenseCounts,
    },
  };
}

/**
 * If pendingBillingCycle is set and current period has ended, apply cycle change.
 * @param {object} subscription — mongoose doc or lean
 */
async function applyPendingBillingCycleIfDue(subscription) {
  if (!subscription?.pendingBillingCycle) {
    return { applied: false, reason: 'none_pending' };
  }
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (!end || end > new Date()) {
    return { applied: false, reason: 'period_not_ended' };
  }

  return changeBillingCycle({
    organizationId: subscription.organizationId,
    billingCycle: subscription.pendingBillingCycle,
    immediate: true,
  });
}

/**
 * Reconcile commercial seat/app quantities after a roster or app-access mutation.
 * Non-fatal: never throws to callers. No-ops when the org has no commercial subscription.
 *
 * @param {{
 *   organizationId: string|ObjectId,
 *   initiatedByUserId?: string|ObjectId|null,
 * }} params
 */
async function reconcileCommercialBillingAfterMutation(params = {}) {
  try {
    const organizationId = params.organizationId;
    if (!organizationId) return { skipped: true, reason: 'missing_organizationId' };

    const result = await reconcileCommercialSubscriptionFromUsage({
      organizationId,
      ensureSubscription: false,
      initiatedByUserId: params.initiatedByUserId || null,
    });

    if (!result?.reconciled) {
      return {
        skipped: true,
        reason: result?.reason || 'not_reconciled',
      };
    }
    return { skipped: false, ...result };
  } catch (err) {
    console.warn(
      '[commercialReconcileAfterMutation] failed (non-blocking):',
      err.message
    );
    return { skipped: true, reason: 'error', error: err.message };
  }
}

/**
 * Advance period markers after a finalized invoice for the current period.
 * @param {object} subscription
 */
async function advanceSubscriptionPeriod(subscription) {
  const doc = await BillingSubscription.findById(subscription._id || subscription);
  if (!doc) return null;

  if (doc.pendingBillingCycle) {
    await changeBillingCycle({
      organizationId: doc.organizationId,
      billingCycle: doc.pendingBillingCycle,
      immediate: true,
    });
    return BillingSubscription.findById(doc._id);
  }

  const start = doc.currentPeriodEnd || new Date();
  doc.currentPeriodStart = start;
  doc.currentPeriodEnd = addPeriod(start, doc.billingCycle);
  await doc.save();
  return doc;
}

module.exports = {
  reconcileCommercialSubscriptionFromUsage,
  reconcileCommercialBillingAfterMutation,
  applyPendingBillingCycleIfDue,
  advanceSubscriptionPeriod,
};
