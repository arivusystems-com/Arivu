/**
 * ============================================================================
 * Subscription Utilities
 * ============================================================================
 * 
 * Helper functions for subscription and seat management.
 * All functions validate app existence in both appRegistry and appPricingRegistry.
 * 
 * Rules:
 * - Seat usage is based on ACTIVE users with appAccess
 * - External users count if app is per-user
 * - Flat apps ignore seats
 * - All logic must validate app existence
 * 
 * SUBSCRIPTION RULE (NON-NEGOTIABLE):
 * ACTIVE and TRIAL are usable states
 * SUSPENDED and CANCELLED are blocked states
 * Missing subscription is blocked
 * 
 * ============================================================================
 */

const OrganizationSubscription = require('../models/OrganizationSubscription');
const User = require('../models/User');
const { getAppConfig } = require('./appAccessUtils');
const appPricingRegistry = require('../constants/appPricingRegistry');
const {
    isInternalOrganization,
    buildEnterpriseAppSubscription,
    normalizeExistingEntryForInternalOrg
} = require('./internalOrganization');

function normalizeAppKey(appKey) {
    const upper = String(appKey || '').toUpperCase();
    // Backward compatibility: CRM and SALES are equivalent
    if (upper === 'CRM') return 'SALES';
    return upper;
}

function isOrgPaid(organization) {
    const tier = organization?.subscription?.tier;
    const status = organization?.subscription?.status;
    // Treat "active" status as paid-ish for provisioning purposes
    return tier === 'paid' || status === 'active';
}

/**
 * Ensure OrganizationSubscription exists and includes all ACTIVE enabledApps.
 *
 * This keeps the billing/seat engine (OrganizationSubscription) aligned with
 * the tenant enablement model (Organization.enabledApps).
 *
 * - Creates missing subscription document
 * - Adds missing app entries for enabled apps
 * - If org is paid, ensures enabled apps are ACTIVE (unsuspends stale trials)
 *
 * @param {object} organization - Organization mongoose doc or plain object
 * @returns {Promise<object|null>} - Subscription doc (lean/plain) or null
 */
async function ensureOrgSubscriptionForEnabledApps(organization) {
    if (!organization?._id) return null;

    const enabledApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
    const enabledActiveAppKeys = enabledApps
        .filter((entry) => {
            if (typeof entry === 'string') return true; // legacy string array implies ACTIVE
            return entry?.status === 'ACTIVE';
        })
        .map((entry) => (typeof entry === 'string' ? entry : entry?.appKey))
        .map(normalizeAppKey)
        .filter(Boolean);

    if (enabledActiveAppKeys.length === 0) return null;

    let subscription = await OrganizationSubscription.findOne({ organizationId: organization._id });
    if (!subscription) {
        subscription = await OrganizationSubscription.create({
            organizationId: organization._id,
            apps: []
        });
    }

    const paid = isOrgPaid(organization);
    // Internal orgs (Arivu's own tenants) always get ENTERPRISE/unlimited/ACTIVE
    // regardless of billing tier or trial state. Look it up once per call.
    const internal = await isInternalOrganization(organization._id);
    const now = new Date();
    const trialEndFromOrg = organization?.subscription?.trialEndDate
        ? new Date(organization.subscription.trialEndDate)
        : null;

    let changed = false;

    for (const appKey of enabledActiveAppKeys) {
        // Validate app exists in both registries (billing requires pricing config)
        const appConfig = getAppConfig(appKey);
        const pricingConfig = appPricingRegistry[appKey];
        if (!appConfig || !pricingConfig) continue;

        const existing = subscription.apps.find((a) => normalizeAppKey(a.appKey) === appKey);

        if (internal) {
            if (!existing) {
                subscription.apps.push(buildEnterpriseAppSubscription(appKey));
                changed = true;
                continue;
            }
            // Normalize stored appKey if legacy (CRM)
            if (normalizeAppKey(existing.appKey) !== existing.appKey) {
                existing.appKey = appKey;
                changed = true;
            }
            if (normalizeExistingEntryForInternalOrg(existing)) {
                changed = true;
            }
            continue;
        }

        const planKey = pricingConfig.defaultPlan || 'BASIC';
        const planConfig = pricingConfig.plans?.[planKey] || {};
        const desiredSeatLimit =
            pricingConfig.billingType === 'FLAT'
                ? null
                : (planConfig.seatLimit ?? pricingConfig.defaultSeatLimit ?? null);

        if (!existing) {
            const trialEndsAt = (() => {
                if (paid) return null;
                if (trialEndFromOrg) return trialEndFromOrg;
                const trialDays = pricingConfig.trialDays || 14;
                const d = new Date(now);
                d.setDate(d.getDate() + trialDays);
                return d;
            })();

            subscription.apps.push({
                appKey,
                planKey,
                seatLimit: desiredSeatLimit,
                seatsUsed: 0,
                status: paid ? 'ACTIVE' : 'TRIAL',
                trialEndsAt,
                startedAt: now
            });
            changed = true;
            continue;
        }

        // Normalize stored appKey if legacy (CRM)
        if (normalizeAppKey(existing.appKey) !== existing.appKey) {
            existing.appKey = appKey;
            changed = true;
        }

        // Ensure planKey is valid / present
        if (!existing.planKey) {
            existing.planKey = planKey;
            changed = true;
        }

        // Ensure seatLimit matches plan defaults when missing/undefined
        if (typeof existing.seatLimit === 'undefined') {
            existing.seatLimit = desiredSeatLimit;
            changed = true;
        }

        // Paid orgs should not have enabled apps stuck in SUSPENDED/TRIAL
        if (paid && existing.status !== 'ACTIVE') {
            existing.status = 'ACTIVE';
            existing.trialEndsAt = null;
            changed = true;
        }
    }

    if (changed) {
        await subscription.save();
    }

    // Return a lean/plain object to keep callers safe from accidental mutations
    return subscription.toObject ? subscription.toObject() : subscription;
}

/**
 * Get organization subscription document
 * @param {string|ObjectId} orgId - Organization ID
 * @returns {Promise<Object|null>} - Subscription document or null
 */
async function getOrgSubscription(orgId) {
    try {
        const subscription = await OrganizationSubscription.findOne({ organizationId: orgId });
        return subscription;
    } catch (error) {
        console.error(`[SubscriptionUtils] Error fetching subscription for org ${orgId}:`, error);
        return null;
    }
}

/**
 * Check if an app is subscribed for an organization
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key (CRM, AUDIT, PORTAL)
 * @returns {Promise<boolean>} - True if app is subscribed
 */
async function isAppSubscribed(orgId, appKey) {
    // Validate app exists in both registries
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return false;
    }

    const subscription = await getOrgSubscription(orgId);
    if (!subscription) {
        return false;
    }

    const appSubscription = subscription.apps.find(app => app.appKey === appKey);
    return !!appSubscription;
}

/**
 * Get seat limit for an app in an organization
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<number|null>} - Seat limit or null if unlimited
 */
async function getSeatLimit(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return null;
    }

    // FLAT apps don't have seat limits
    if (pricingConfig.billingType === 'FLAT') {
        return null;
    }

    const subscription = await getOrgSubscription(orgId);
    if (!subscription) {
        return null;
    }

    const appSubscription = subscription.apps.find(app => app.appKey === appKey);
    if (!appSubscription) {
        return null;
    }

    return appSubscription.seatLimit;
}

/**
 * Get current seats used for an app in an organization
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<number>} - Number of seats used
 */
async function getSeatsUsed(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return 0;
    }

    // FLAT apps don't count seats
    if (pricingConfig.billingType === 'FLAT') {
        return 0;
    }

    try {
        // Count ACTIVE users with appAccess containing this appKey
        const count = await User.countDocuments({
            organizationId: orgId,
            status: 'active',
            appAccess: {
                $elemMatch: {
                    appKey: appKey,
                    status: 'ACTIVE'
                }
            }
        });

        return count;
    } catch (error) {
        console.error(`[SubscriptionUtils] Error counting seats for org ${orgId} app ${appKey}:`, error);
        return 0;
    }
}

/**
 * Check if a new user can be added to an app
 * 
 * SUBSCRIPTION RULE:
 * ACTIVE and TRIAL are usable states
 * Do NOT block TRIAL
 * 
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<{allowed: boolean, reason?: string}>} - Result object
 */
async function canAddUserToApp(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig) {
        return {
            allowed: false,
            reason: `App ${appKey} is not registered in the system`
        };
    }

    // Learning (and any app without legacy PER_USER pricing): access grants are allowed;
    // capacity is enforced by commercial / LearningSeatService, not invite seats.
    if (!pricingConfig || pricingConfig.billingType === 'FLAT') {
        return { allowed: true };
    }

    // Check subscription exists
    const subscription = await getOrgSubscription(orgId);
    if (!subscription) {
        return {
            allowed: false,
            reason: 'Organization subscription not found'
        };
    }

    const appSubscription = subscription.apps.find(app => app.appKey === appKey);
    if (!appSubscription) {
        return {
            allowed: false,
            reason: `App ${appKey} is not subscribed`
        };
    }

    // SUBSCRIPTION RULE: ACTIVE and TRIAL are usable, SUSPENDED/CANCELLED are blocked
    // Check for expired trial (auto-suspend)
    if (appSubscription.status === 'TRIAL' && appSubscription.trialEndsAt) {
        if (new Date() > appSubscription.trialEndsAt) {
            // Auto-suspend expired trials
            await OrganizationSubscription.updateOne(
                { organizationId: orgId, 'apps.appKey': appKey },
                { $set: { 'apps.$.status': 'SUSPENDED' } }
            );
            appSubscription.status = 'SUSPENDED';
        }
    }

    // Use canonical helper to check if subscription is usable
    if (!isSubscriptionUsable(appSubscription)) {
        return {
            allowed: false,
            reason: `App ${appKey} subscription is ${appSubscription.status || 'not active'}`
        };
    }

    // Check seat limit
    const seatLimit = appSubscription.seatLimit;
    if (seatLimit === null) {
        // Unlimited
        return { allowed: true };
    }

    const seatsUsed = await getSeatsUsed(orgId, appKey);
    if (seatsUsed >= seatLimit) {
        return {
            allowed: false,
            reason: `Seat limit reached for ${appKey} app (${seatsUsed}/${seatLimit})`
        };
    }

    return { allowed: true };
}

/**
 * Increment seat usage for an app (atomic operation)
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<boolean>} - True if successful
 */
async function incrementSeat(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return false;
    }

    // FLAT apps don't track seats
    if (pricingConfig.billingType === 'FLAT') {
        return true;
    }

    try {
        // Atomically increment seatsUsed
        const result = await OrganizationSubscription.updateOne(
            { organizationId: orgId, 'apps.appKey': appKey },
            { $inc: { 'apps.$.seatsUsed': 1 } }
        );

        // Recalculate actual seats used to keep in sync
        const actualSeatsUsed = await getSeatsUsed(orgId, appKey);
        await OrganizationSubscription.updateOne(
            { organizationId: orgId, 'apps.appKey': appKey },
            { $set: { 'apps.$.seatsUsed': actualSeatsUsed } }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error(`[SubscriptionUtils] Error incrementing seat for org ${orgId} app ${appKey}:`, error);
        return false;
    }
}

/**
 * Decrement seat usage for an app (atomic operation)
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<boolean>} - True if successful
 */
async function decrementSeat(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return false;
    }

    // FLAT apps don't track seats
    if (pricingConfig.billingType === 'FLAT') {
        return true;
    }

    try {
        // Atomically decrement seatsUsed (but not below 0)
        const result = await OrganizationSubscription.updateOne(
            { 
                organizationId: orgId, 
                'apps.appKey': appKey,
                'apps.$.seatsUsed': { $gt: 0 }
            },
            { $inc: { 'apps.$.seatsUsed': -1 } }
        );

        // Recalculate actual seats used to keep in sync
        const actualSeatsUsed = await getSeatsUsed(orgId, appKey);
        await OrganizationSubscription.updateOne(
            { organizationId: orgId, 'apps.appKey': appKey },
            { $set: { 'apps.$.seatsUsed': actualSeatsUsed } }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error(`[SubscriptionUtils] Error decrementing seat for org ${orgId} app ${appKey}:`, error);
        return false;
    }
}

/**
 * Validate subscription status for an app
 * 
 * SUBSCRIPTION RULE:
 * ACTIVE and TRIAL are usable states
 * Do NOT block TRIAL
 * 
 * @param {string|ObjectId} orgId - Organization ID
 * @param {string} appKey - App key
 * @returns {Promise<{valid: boolean, status?: string, reason?: string}>} - Validation result
 */
async function validateSubscriptionStatus(orgId, appKey) {
    // Validate app exists
    const appConfig = getAppConfig(appKey);
    const pricingConfig = appPricingRegistry[appKey];
    
    if (!appConfig || !pricingConfig) {
        return {
            valid: false,
            reason: `App ${appKey} is not registered in the system`
        };
    }

    const subscription = await getOrgSubscription(orgId);
    if (!subscription) {
        return {
            valid: false,
            reason: 'Organization subscription not found'
        };
    }

    const appSubscription = subscription.apps.find(app => app.appKey === appKey);
    if (!appSubscription) {
        return {
            valid: false,
            reason: `App ${appKey} is not subscribed`
        };
    }

    // SUBSCRIPTION RULE: ACTIVE and TRIAL are usable, SUSPENDED/CANCELLED are blocked
    // Check for expired trial (auto-suspend)
    if (appSubscription.status === 'TRIAL' && appSubscription.trialEndsAt) {
        if (new Date() > appSubscription.trialEndsAt) {
            // Auto-suspend expired trials
            await OrganizationSubscription.updateOne(
                { organizationId: orgId, 'apps.appKey': appKey },
                { $set: { 'apps.$.status': 'SUSPENDED' } }
            );
            appSubscription.status = 'SUSPENDED';
        }
    }

    // Use canonical helper to check if subscription is usable
    if (isSubscriptionUsable(appSubscription)) {
        return {
            valid: true,
            status: appSubscription.status
        };
    }

    // Subscription is blocked
    return {
        valid: false,
        status: appSubscription.status || 'NONE',
        reason: `Subscription is ${appSubscription.status || 'not active'}`
    };
}

/**
 * ============================================================================
 * Canonical Subscription State Helpers (MANDATORY)
 * ============================================================================
 * 
 * These helpers enforce the subscription semantics rule:
 * - ACTIVE and TRIAL are usable states
 * - SUSPENDED and CANCELLED are blocked states
 * - Missing subscription is blocked
 * 
 * 🚫 No direct status === 'ACTIVE' checks allowed anywhere else
 * ============================================================================
 */

/**
 * Check if a subscription is in a usable state
 * @param {Object|null} subscription - App subscription object (from OrganizationSubscription.apps[])
 * @returns {boolean} - True if subscription is usable (ACTIVE or TRIAL)
 */
function isSubscriptionUsable(subscription) {
    if (!subscription) return false;
    return ['ACTIVE', 'TRIAL'].includes(subscription.status);
}

/**
 * Check if a subscription is in a blocked state
 * @param {Object|null} subscription - App subscription object
 * @returns {boolean} - True if subscription is blocked (SUSPENDED, CANCELLED, or missing)
 */
function isSubscriptionBlocked(subscription) {
    if (!subscription) return true;
    return ['SUSPENDED', 'CANCELLED'].includes(subscription.status);
}

/**
 * Assert that a subscription is usable, throw error if not
 * @param {Object|null} subscription - App subscription object
 * @param {string} appKey - App key for error message
 * @throws {Error} - Error with code 'SUBSCRIPTION_INACTIVE' and httpStatus 402
 */
function assertSubscriptionUsable(subscription, appKey) {
    if (!isSubscriptionUsable(subscription)) {
        const status = subscription?.status || 'NONE';
        const error = new Error(`Subscription for ${appKey} is not active`);
        error.code = 'SUBSCRIPTION_INACTIVE';
        error.httpStatus = 402;
        error.meta = { appKey, status };
        throw error;
    }
}

module.exports = {
    getOrgSubscription,
    ensureOrgSubscriptionForEnabledApps,
    isAppSubscribed,
    getSeatLimit,
    getSeatsUsed,
    canAddUserToApp,
    incrementSeat,
    decrementSeat,
    validateSubscriptionStatus,
    // Canonical subscription state helpers
    isSubscriptionUsable,
    isSubscriptionBlocked,
    assertSubscriptionUsable
};


