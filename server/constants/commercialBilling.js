/**
 * Arivu commercial billing — catalog codes, enums, Founder Launch defaults.
 * Prices live in BillingPrice documents; this file seeds defaults only.
 * Never read these amounts from application/business controllers for invoices.
 */

'use strict';

const PRODUCT_TYPES = Object.freeze({
  PLATFORM: 'platform',
  INTERNAL_USER: 'internal_user',
  ADMIN_USER: 'admin_user',
  STANDARD_USER: 'standard_user',
  PORTAL_USER: 'portal_user',
  APPLICATION: 'application',
  BOOSTER: 'booster',
});

const PRODUCT_CODES = Object.freeze({
  /** @deprecated Seat math — Admin users bill as ADMIN_USER; kept for legacy items. */
  PLATFORM: 'arivu_platform',
  /** @deprecated Prefer STANDARD_USER; aliased in reconcile for legacy subscriptions. */
  INTERNAL_USER: 'internal_user',
  ADMIN_USER: 'admin_user',
  STANDARD_USER: 'standard_user',
  PORTAL_USER: 'portal_user',
  HELPDESK: 'helpdesk_app',
  SALES: 'sales_app',
  AUDIT: 'audit_app',
  INVENTORY: 'inventory_app',
  FIELD_SALES: 'field_sales_app',
  MARKETING: 'marketing_app',
  /** Learning App — TIERED_CAPACITY learner seats (not per assigned staff). */
  LEARNING: 'learning_app',
  STOCKROOM: 'stockroom_addon',
  LIVE_AGENT: 'live_agent_booster',
  CUSTOM_FIELDS: 'custom_fields_booster',
  CUSTOM_BUILDER: 'custom_builder_booster',
  STORAGE_GUARD: 'storage_guard_booster',
});

const PRICING_MODELS = Object.freeze({
  PER_UNIT: 'per_unit',
  TIERED: 'tiered',
  /** Org-scoped plan capacity (e.g. Learning learner seats). Invoice qty = 1; capacity = includedQuantity. */
  TIERED_CAPACITY: 'tiered_capacity',
  INCLUDED_QUANTITY: 'included_quantity',
  USAGE: 'usage',
  FLAT: 'flat',
});

/** Billable capacity units for TIERED_CAPACITY products. */
const CAPACITY_UNITS = Object.freeze({
  LEARNER_SEAT: 'LEARNER_SEAT',
});

/**
 * Learning App launch plans — capacity + Founder monthly paise.
 * Enterprise (500+) is custom / not in public catalog.
 */
const LEARNING_PLANS = Object.freeze({
  starter: Object.freeze({ planKey: 'starter', capacity: 50, monthlyPaise: 199900 }),
  growth: Object.freeze({ planKey: 'growth', capacity: 200, monthlyPaise: 599900 }),
  business: Object.freeze({ planKey: 'business', capacity: 500, monthlyPaise: 1199900 }),
});

/** Default Learning plan for checkout / Pricing primary CTA. */
const LEARNING_PRIMARY_PLAN_KEY = 'growth';

const BILLING_PERIODS = Object.freeze({
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
});

const PRICE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'archived',
});

const PRODUCT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

const SUBSCRIPTION_STATUSES = Object.freeze({
  TRIALING: 'trialing',
  /** Trial ended; instance locked until Subscribe + payment. */
  TRIAL_EXPIRED: 'trial_expired',
  /** First invoice issued; awaiting Razorpay or manual verification. */
  PAYMENT_PENDING: 'payment_pending',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  PAUSED: 'paused',
  CANCELING: 'canceling',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
});

/** Default free trial length (days). */
const DEFAULT_TRIAL_DAYS = 14;

/** Monthly cancel: 50% refund within first N days of paid activation. */
const MONTHLY_REFUND = Object.freeze({
  windowDays: 6,
  percentBps: 5000,
});

/** Yearly cancel: AmountPaid − usedCost − (3 × monthly equivalent). */
const YEARLY_CANCEL_COMMITMENT_MONTHS = 3;

const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
});

/** Instance-level add-on / booster product codes (aliases of PRODUCT_CODES). */
const BOOSTER_PRODUCT_CODES = Object.freeze({
  STOCKROOM: PRODUCT_CODES.STOCKROOM,
  LIVE_AGENT: PRODUCT_CODES.LIVE_AGENT,
  CUSTOM_FIELDS: PRODUCT_CODES.CUSTOM_FIELDS,
  CUSTOM_BUILDER: PRODUCT_CODES.CUSTOM_BUILDER,
  STORAGE_GUARD: PRODUCT_CODES.STORAGE_GUARD,
});

/** Map booster/addon product → runtime addonKeys when applicable. */
const PRODUCT_CODE_TO_ADDON_KEY = Object.freeze({
  [PRODUCT_CODES.STOCKROOM]: 'stockroom',
  [PRODUCT_CODES.LIVE_AGENT]: 'live_chat',
});

const ITEM_STATUSES = Object.freeze({
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  ENDED: 'ended',
  CANCELED: 'canceled',
});

const ENTITLEMENT_TYPES = Object.freeze({
  PLATFORM: 'platform',
  INTERNAL_USER: 'internal_user',
  ADMIN_USER: 'admin_user',
  STANDARD_USER: 'standard_user',
  PORTAL_USER: 'portal_user',
  APPLICATION: 'application',
  BOOSTER: 'booster',
});

const ENTITLEMENT_SCOPES = Object.freeze({
  ORGANIZATION: 'organization',
  USER: 'user',
});

const BILLING_EVENT_TYPES = Object.freeze({
  USER_ADDED: 'USER_ADDED',
  USER_REMOVED: 'USER_REMOVED',
  APPLICATION_ASSIGNED: 'APPLICATION_ASSIGNED',
  APPLICATION_UNASSIGNED: 'APPLICATION_UNASSIGNED',
  PORTAL_USER_ADDED: 'PORTAL_USER_ADDED',
  PORTAL_USER_REMOVED: 'PORTAL_USER_REMOVED',
  BOOSTER_ENABLED: 'BOOSTER_ENABLED',
  BOOSTER_DISABLED: 'BOOSTER_DISABLED',
  SUBSCRIPTION_CREATED: 'SUBSCRIPTION_CREATED',
  BILLING_CYCLE_CHANGED: 'BILLING_CYCLE_CHANGED',
  PRICING_PROGRAM_APPLIED: 'PRICING_PROGRAM_APPLIED',
  OPS_CREDIT_APPLIED: 'OPS_CREDIT_APPLIED',
  OPS_INVOICE_VOIDED: 'OPS_INVOICE_VOIDED',
  OPS_CREDIT_NOTE_ISSUED: 'OPS_CREDIT_NOTE_ISSUED',
  OPS_PENDING_DISCOUNT_SET: 'OPS_PENDING_DISCOUNT_SET',
  OPS_RECURRING_DISCOUNT_SET: 'OPS_RECURRING_DISCOUNT_SET',
  OPS_BILLING_PARTY_CORRECTED: 'OPS_BILLING_PARTY_CORRECTED',
  OPS_INVOICE_REVISED: 'OPS_INVOICE_REVISED',
});

const BILLING_EVENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  PROCESSED: 'processed',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
});

const INVOICE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  FINALIZED: 'finalized',
  PAID: 'paid',
  VOID: 'void',
  PAST_DUE: 'past_due',
});

const PRICING_PROGRAM_CODES = Object.freeze({
  FOUNDER_LAUNCH: 'founder_launch',
  STANDARD: 'standard',
  ENTERPRISE: 'enterprise',
});

const CURRENCY_INR = 'INR';

/** Annual = 10 × monthly (2 months free). */
const ANNUAL_MONTH_MULTIPLIER = 10;

const FOUNDER_LAUNCH = Object.freeze({
  code: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
  name: "Founder's Launch",
  capacity: 100,
  priceProtectionMonths: 24,
  currency: CURRENCY_INR,
});

/**
 * Founder Launch monthly unit amounts in minor units (paise).
 * Annual amounts = monthly × ANNUAL_MONTH_MULTIPLIER.
 */
const FOUNDER_MONTHLY_PAISE = Object.freeze({
  /** Legacy flat platform SKU — no longer used for seat include; Admin seats are per-user. */
  [PRODUCT_CODES.PLATFORM]: 0,
  [PRODUCT_CODES.ADMIN_USER]: 99900,
  [PRODUCT_CODES.STANDARD_USER]: 69900,
  /** Legacy alias of STANDARD_USER pricing. */
  [PRODUCT_CODES.INTERNAL_USER]: 69900,
  [PRODUCT_CODES.PORTAL_USER]: 19900,
  [PRODUCT_CODES.HELPDESK]: 14900,
  [PRODUCT_CODES.SALES]: 19900,
  [PRODUCT_CODES.AUDIT]: 19900,
  [PRODUCT_CODES.INVENTORY]: 24900,
  [PRODUCT_CODES.FIELD_SALES]: 29900,
  [PRODUCT_CODES.MARKETING]: 49900,
  /** Learning default/Growth plan monthly — plan prices also in LEARNING_PLANS. */
  [PRODUCT_CODES.LEARNING]: 599900,
  [PRODUCT_CODES.STOCKROOM]: 99900,
  [PRODUCT_CODES.LIVE_AGENT]: 149900,
  [PRODUCT_CODES.CUSTOM_FIELDS]: 49900,
  [PRODUCT_CODES.CUSTOM_BUILDER]: 99900,
  [PRODUCT_CODES.STORAGE_GUARD]: 29900,
});

const FOUNDER_BOOSTER_MONTHLY_PAISE = Object.freeze({
  [PRODUCT_CODES.STOCKROOM]: FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.STOCKROOM],
  [PRODUCT_CODES.LIVE_AGENT]: FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.LIVE_AGENT],
  [PRODUCT_CODES.CUSTOM_FIELDS]: FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.CUSTOM_FIELDS],
  [PRODUCT_CODES.CUSTOM_BUILDER]: FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.CUSTOM_BUILDER],
  [PRODUCT_CODES.STORAGE_GUARD]: FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.STORAGE_GUARD],
});

/** No free included Admin seat — every Admin bills at ADMIN_USER. */
const PLATFORM_INCLUDED_INTERNAL_USERS = 0;

/**
 * Map commercial application product → runtime APP_KEYS (when present).
 * field_sales_app has no APP_KEYS entry yet — catalog-only until wired.
 */
const PRODUCT_CODE_TO_APP_KEY = Object.freeze({
  [PRODUCT_CODES.HELPDESK]: 'HELPDESK',
  [PRODUCT_CODES.SALES]: 'SALES',
  [PRODUCT_CODES.AUDIT]: 'AUDIT',
  [PRODUCT_CODES.INVENTORY]: 'INVENTORY',
  [PRODUCT_CODES.MARKETING]: 'MARKETING',
  [PRODUCT_CODES.LEARNING]: 'LMS',
});

const APP_KEY_TO_PRODUCT_CODE = Object.freeze(
  Object.fromEntries(
    Object.entries(PRODUCT_CODE_TO_APP_KEY).map(([code, appKey]) => [appKey, code])
  )
);

module.exports = {
  PRODUCT_TYPES,
  PRODUCT_CODES,
  PRICING_MODELS,
  CAPACITY_UNITS,
  LEARNING_PLANS,
  LEARNING_PRIMARY_PLAN_KEY,
  BILLING_PERIODS,
  PRICE_STATUSES,
  PRODUCT_STATUSES,
  SUBSCRIPTION_STATUSES,
  ITEM_STATUSES,
  ENTITLEMENT_TYPES,
  ENTITLEMENT_SCOPES,
  BILLING_EVENT_TYPES,
  BILLING_EVENT_STATUSES,
  INVOICE_STATUSES,
  PRICING_PROGRAM_CODES,
  CURRENCY_INR,
  ANNUAL_MONTH_MULTIPLIER,
  FOUNDER_LAUNCH,
  FOUNDER_MONTHLY_PAISE,
  PLATFORM_INCLUDED_INTERNAL_USERS,
  PRODUCT_CODE_TO_APP_KEY,
  APP_KEY_TO_PRODUCT_CODE,
  DEFAULT_TRIAL_DAYS,
  MONTHLY_REFUND,
  YEARLY_CANCEL_COMMITMENT_MONTHS,
  PAYMENT_STATUSES,
  BOOSTER_PRODUCT_CODES,
  FOUNDER_BOOSTER_MONTHLY_PAISE,
  PRODUCT_CODE_TO_ADDON_KEY,
};
