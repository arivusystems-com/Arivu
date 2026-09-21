'use strict';

const BillingProduct = require('../../models/commercial/BillingProduct');
const BillingPrice = require('../../models/commercial/BillingPrice');
const {
  PRICE_STATUSES,
  PRODUCT_STATUSES,
  BILLING_PERIODS,
  PRICING_PROGRAM_CODES,
  ANNUAL_MONTH_MULTIPLIER,
} = require('../../constants/commercialBilling');

/**
 * Read-only commercial catalog. Controllers must not hardcode prices.
 */
async function listActiveProducts() {
  return BillingProduct.find({ status: PRODUCT_STATUSES.ACTIVE })
    .sort({ sortOrder: 1 })
    .lean();
}

/**
 * @param {string} productCode
 * @param {{ pricingProgramCode?: string, billingPeriod?: string, at?: Date, includedQuantity?: number }} [opts]
 */
async function getActivePrice(productCode, opts = {}) {
  const pricingProgramCode = opts.pricingProgramCode || PRICING_PROGRAM_CODES.FOUNDER_LAUNCH;
  const billingPeriod = opts.billingPeriod || BILLING_PERIODS.MONTHLY;
  const at = opts.at || new Date();

  const query = {
    productCode: String(productCode).toLowerCase(),
    pricingProgramCode,
    billingPeriod,
    status: PRICE_STATUSES.ACTIVE,
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
  };

  if (opts.includedQuantity != null) {
    query.includedQuantity = Number(opts.includedQuantity);
  }

  return BillingPrice.findOne(query)
    .sort({ effectiveFrom: -1 })
    .lean();
}

/**
 * Public pricing calculator estimate (does not create subscription).
 * @param {{
 *   billingPeriod?: string,
 *   pricingProgramCode?: string,
 *   adminUsers?: number,
 *   standardUsers?: number,
 *   internalUsers?: number,
 *   portalUsers?: number,
 *   applications?: Array<{ productCode: string, users: number }>,
 * }} input
 */
async function estimateQuote(input = {}) {
  const billingPeriod = input.billingPeriod || BILLING_PERIODS.MONTHLY;
  const pricingProgramCode = input.pricingProgramCode || PRICING_PROGRAM_CODES.FOUNDER_LAUNCH;
  const adminUsers = Math.max(0, Number(input.adminUsers) || 0);
  const standardUsers = Math.max(
    0,
    Number(input.standardUsers != null ? input.standardUsers : input.internalUsers) || 0
  );
  const portalUsers = Math.max(0, Number(input.portalUsers) || 0);
  const applications = Array.isArray(input.applications) ? input.applications : [];

  const lines = [];
  let subtotalMinor = 0;

  async function addLine(productCode, quantity, label) {
    if (quantity <= 0) return;
    const price = await getActivePrice(productCode, { pricingProgramCode, billingPeriod });
    if (!price) {
      throw new Error(`No active price for ${productCode} (${pricingProgramCode}/${billingPeriod})`);
    }
    const product = await BillingProduct.findOne({ code: productCode }).lean();
    const amountMinor = price.amountMinor * quantity;
    lines.push({
      productCode,
      label: label || product?.name || productCode,
      quantity,
      unitAmountMinor: price.amountMinor,
      amountMinor,
      currency: price.currency,
      priceId: price._id,
      pricingModel: price.pricingModel,
    });
    subtotalMinor += amountMinor;
  }

  // Every Admin @ ₹999, every Standard @ ₹699 — no free included seat / platform flat.
  await addLine('admin_user', adminUsers);
  await addLine('standard_user', standardUsers);
  await addLine('portal_user', portalUsers);

  for (const app of applications) {
    const code = String(app.productCode || '').toLowerCase();
    if (code === 'learning_app') {
      const {
        LEARNING_PLANS,
        LEARNING_PRIMARY_PLAN_KEY,
        PRODUCT_CODES,
      } = require('../../constants/commercialBilling');
      const planKey = String(app.planKey || LEARNING_PRIMARY_PLAN_KEY).toLowerCase();
      const plan = LEARNING_PLANS[planKey] || LEARNING_PLANS[LEARNING_PRIMARY_PLAN_KEY];
      const price = await getActivePrice(PRODUCT_CODES.LEARNING, {
        pricingProgramCode,
        billingPeriod,
        includedQuantity: plan.capacity,
      });
      if (!price) {
        throw new Error(`No active Learning price for plan ${planKey}`);
      }
      const product = await BillingProduct.findOne({ code: PRODUCT_CODES.LEARNING }).lean();
      const amountMinor = price.amountMinor;
      lines.push({
        productCode: PRODUCT_CODES.LEARNING,
        label: `${product?.name || 'Learning'} · ${plan.capacity} learner seats`,
        quantity: 1,
        unitAmountMinor: price.amountMinor,
        amountMinor,
        currency: price.currency,
        priceId: price._id,
        pricingModel: price.pricingModel,
        includedQuantity: plan.capacity,
        planKey: plan.planKey,
        capacityUnit: 'LEARNER_SEAT',
      });
      subtotalMinor += amountMinor;
      continue;
    }
    const users = Math.max(0, Number(app.users) || 0);
    await addLine(code, users);
  }

  const monthlyEquivalentMinor = billingPeriod === BILLING_PERIODS.ANNUAL
    ? Math.round(subtotalMinor / ANNUAL_MONTH_MULTIPLIER)
    : subtotalMinor;

  const annualIfMonthlyMinor = billingPeriod === BILLING_PERIODS.MONTHLY
    ? subtotalMinor * 12
    : null;
  const annualDiscountedMinor = billingPeriod === BILLING_PERIODS.MONTHLY
    ? subtotalMinor * ANNUAL_MONTH_MULTIPLIER
    : subtotalMinor;
  const annualSavingsMinor = annualIfMonthlyMinor != null
    ? annualIfMonthlyMinor - annualDiscountedMinor
    : (subtotalMinor / ANNUAL_MONTH_MULTIPLIER) * 12 - subtotalMinor;

  return {
    billingPeriod,
    pricingProgramCode,
    currency: lines[0]?.currency || 'INR',
    lines,
    subtotalMinor,
    monthlyEquivalentMinor,
    annualSavingsMinor: Math.max(0, Math.round(annualSavingsMinor)),
    note: 'Estimates exclude applicable taxes.',
  };
}

/**
 * Cost preview when assigning apps to a new/existing internal user.
 * @param {{ applicationProductCodes?: string[], includeInternalUserLicense?: boolean, billingPeriod?: string, pricingProgramCode?: string }} opts
 */
async function previewUserAssignmentCost(opts = {}) {
  const billingPeriod = opts.billingPeriod || BILLING_PERIODS.MONTHLY;
  const pricingProgramCode = opts.pricingProgramCode || PRICING_PROGRAM_CODES.FOUNDER_LAUNCH;
  const includeInternalUserLicense = opts.includeInternalUserLicense !== false;
  const codes = Array.isArray(opts.applicationProductCodes)
    ? opts.applicationProductCodes.map((c) => String(c).toLowerCase())
    : [];

  const lines = [];
  let totalMinor = 0;

  if (includeInternalUserLicense) {
    const productCode = String(opts.userTypeProductCode || 'standard_user').toLowerCase();
    const price = await getActivePrice(productCode, { pricingProgramCode, billingPeriod });
    if (price) {
      lines.push({
        productCode,
        label: productCode === 'admin_user' ? 'Admin User' : 'Standard User',
        unitAmountMinor: price.amountMinor,
        amountMinor: price.amountMinor,
      });
      totalMinor += price.amountMinor;
    }
  }

  for (const code of codes) {
    const price = await getActivePrice(code, { pricingProgramCode, billingPeriod });
    if (!price) continue;
    const product = await BillingProduct.findOne({ code }).lean();
    lines.push({
      productCode: code,
      label: product?.name || code,
      unitAmountMinor: price.amountMinor,
      amountMinor: price.amountMinor,
    });
    totalMinor += price.amountMinor;
  }

  return {
    billingPeriod,
    pricingProgramCode,
    currency: 'INR',
    lines,
    totalMinor,
  };
}

module.exports = {
  listActiveProducts,
  getActivePrice,
  estimateQuote,
  previewUserAssignmentCost,
};
