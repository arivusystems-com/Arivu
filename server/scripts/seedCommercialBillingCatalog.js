/**
 * Seed Founder's Launch commercial catalog (products, prices, pricing program).
 * Idempotent. Never overwrites existing price amounts — only inserts missing rows.
 *
 * Usage: node server/scripts/seedCommercialBillingCatalog.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getMongoUris } = require('../lib/mongoConnect');
const BillingProduct = require('../models/commercial/BillingProduct');
const BillingPrice = require('../models/commercial/BillingPrice');
const PricingProgram = require('../models/commercial/PricingProgram');
const {
  PRODUCT_TYPES,
  PRODUCT_CODES,
  PRICING_MODELS,
  BILLING_PERIODS,
  PRICE_STATUSES,
  PRODUCT_STATUSES,
  PRICING_PROGRAM_CODES,
  CURRENCY_INR,
  ANNUAL_MONTH_MULTIPLIER,
  FOUNDER_LAUNCH,
  FOUNDER_MONTHLY_PAISE,
  PRODUCT_CODE_TO_APP_KEY,
  PRODUCT_CODE_TO_ADDON_KEY,
  LEARNING_PLANS,
} = require('../constants/commercialBilling');

const CATALOG = [
  {
    code: PRODUCT_CODES.ADMIN_USER,
    name: 'Admin User',
    type: PRODUCT_TYPES.ADMIN_USER,
    description: 'Admin seat — organization Settings access. ₹999/user/month.',
    sortOrder: 10,
  },
  {
    code: PRODUCT_CODES.STANDARD_USER,
    name: 'Standard User',
    type: PRODUCT_TYPES.STANDARD_USER,
    description: 'Standard staff seat — no organization Settings. ₹699/user/month.',
    sortOrder: 20,
  },
  {
    code: PRODUCT_CODES.INTERNAL_USER,
    name: 'Arivu User (legacy)',
    type: PRODUCT_TYPES.INTERNAL_USER,
    description: 'Legacy additional internal user — superseded by Standard User.',
    sortOrder: 25,
  },
  {
    code: PRODUCT_CODES.PLATFORM,
    name: 'Arivu Platform (legacy)',
    type: PRODUCT_TYPES.PLATFORM,
    description: 'Legacy flat platform fee — superseded by per-Admin seating.',
    sortOrder: 5,
  },
  {
    code: PRODUCT_CODES.PORTAL_USER,
    name: 'Portal User',
    type: PRODUCT_TYPES.PORTAL_USER,
    description: 'External portal user license (configurable pricing model).',
    sortOrder: 30,
  },
  {
    code: PRODUCT_CODES.HELPDESK,
    name: 'Helpdesk',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Helpdesk application access per assigned user.',
    sortOrder: 40,
  },
  {
    code: PRODUCT_CODES.SALES,
    name: 'Sales',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Sales application access per assigned user.',
    sortOrder: 50,
  },
  {
    code: PRODUCT_CODES.AUDIT,
    name: 'Audit Management',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Audit Management application access per assigned user.',
    sortOrder: 60,
  },
  {
    code: PRODUCT_CODES.INVENTORY,
    name: 'Inventory',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Inventory application access per assigned user.',
    sortOrder: 70,
  },
  {
    code: PRODUCT_CODES.FIELD_SALES,
    name: 'Field Sales',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Field Sales application access per assigned user.',
    sortOrder: 80,
  },
  {
    code: PRODUCT_CODES.MARKETING,
    name: 'Marketing',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Marketing application access per assigned user.',
    sortOrder: 90,
  },
  {
    code: PRODUCT_CODES.LEARNING,
    name: 'Learning',
    type: PRODUCT_TYPES.APPLICATION,
    description: 'Learning App — TIERED_CAPACITY learner seats (Starter/Growth/Business).',
    sortOrder: 95,
  },
  {
    code: PRODUCT_CODES.STOCKROOM,
    name: 'Stockroom Add-on',
    type: PRODUCT_TYPES.BOOSTER,
    description: 'Multi-stockroom / warehouse locations (instance-level).',
    sortOrder: 100,
  },
  {
    code: PRODUCT_CODES.LIVE_AGENT,
    name: 'Live Agent Booster',
    type: PRODUCT_TYPES.BOOSTER,
    description: 'Live chat agent capacity (instance-level).',
    sortOrder: 110,
  },
  {
    code: PRODUCT_CODES.CUSTOM_FIELDS,
    name: 'Custom Fields Booster',
    type: PRODUCT_TYPES.BOOSTER,
    description: 'Extended custom fields capacity (instance-level).',
    sortOrder: 120,
  },
  {
    code: PRODUCT_CODES.CUSTOM_BUILDER,
    name: 'Custom Builder Booster',
    type: PRODUCT_TYPES.BOOSTER,
    description: 'Custom builder capacity (instance-level).',
    sortOrder: 130,
  },
  {
    code: PRODUCT_CODES.STORAGE_GUARD,
    name: 'Storage Guard Booster',
    type: PRODUCT_TYPES.BOOSTER,
    description: 'Additional storage guard (instance-level).',
    sortOrder: 140,
  },
];

function pricingModelForCode(code) {
  if (code === PRODUCT_CODES.PLATFORM) return PRICING_MODELS.FLAT;
  if (code === PRODUCT_CODES.LEARNING) return PRICING_MODELS.TIERED_CAPACITY;
  return PRICING_MODELS.PER_UNIT;
}

async function upsertProducts() {
  const results = [];
  for (const entry of CATALOG) {
    const appKey = PRODUCT_CODE_TO_APP_KEY[entry.code] || null;
    const addonKey = PRODUCT_CODE_TO_ADDON_KEY[entry.code] || null;
    const doc = await BillingProduct.findOneAndUpdate(
      { code: entry.code },
      {
        $set: {
          name: entry.name,
          type: entry.type,
          description: entry.description,
          sortOrder: entry.sortOrder,
          appKey,
          addonKey,
          status: PRODUCT_STATUSES.ACTIVE,
        },
        $setOnInsert: { code: entry.code },
      },
      { upsert: true, new: true }
    );
    results.push(doc);
  }
  return results;
}

async function ensureFounderProgram() {
  return PricingProgram.findOneAndUpdate(
    { code: FOUNDER_LAUNCH.code },
    {
      $setOnInsert: {
        code: FOUNDER_LAUNCH.code,
        claimed: 0,
        description: 'First 100 customers — 24 months Founder price protection.',
      },
      $set: {
        name: FOUNDER_LAUNCH.name,
        capacity: FOUNDER_LAUNCH.capacity,
        priceProtectionMonths: FOUNDER_LAUNCH.priceProtectionMonths,
        status: 'active',
      },
    },
    { upsert: true, new: true }
  );
}

async function ensurePrice({ product, billingPeriod, amountMinor, includedQuantity = null, label }) {
  const query = {
    productCode: product.code,
    pricingProgramCode: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
    billingPeriod,
    status: PRICE_STATUSES.ACTIVE,
  };
  if (includedQuantity != null) {
    query.includedQuantity = includedQuantity;
  }

  const existing = await BillingPrice.findOne(query).sort({ effectiveFrom: -1 });

  if (existing) {
    return { created: false, price: existing };
  }

  const price = await BillingPrice.create({
    productId: product._id,
    productCode: product.code,
    pricingProgramCode: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
    billingPeriod,
    pricingModel: pricingModelForCode(product.code),
    amountMinor,
    currency: CURRENCY_INR,
    includedQuantity: includedQuantity != null ? includedQuantity : null,
    effectiveFrom: new Date(),
    status: PRICE_STATUSES.ACTIVE,
    label: label || `Founder's Launch ${billingPeriod}`,
  });
  return { created: true, price };
}

async function seedPrices(products) {
  const summary = { created: 0, skipped: 0 };
  for (const product of products) {
    if (product.code === PRODUCT_CODES.LEARNING) {
      for (const plan of Object.values(LEARNING_PLANS)) {
        const m = await ensurePrice({
          product,
          billingPeriod: BILLING_PERIODS.MONTHLY,
          amountMinor: plan.monthlyPaise,
          includedQuantity: plan.capacity,
          label: `Learning ${plan.planKey} · ${plan.capacity} learner seats (monthly)`,
        });
        summary[m.created ? 'created' : 'skipped'] += 1;

        const a = await ensurePrice({
          product,
          billingPeriod: BILLING_PERIODS.ANNUAL,
          amountMinor: plan.monthlyPaise * ANNUAL_MONTH_MULTIPLIER,
          includedQuantity: plan.capacity,
          label: `Learning ${plan.planKey} · ${plan.capacity} learner seats (annual)`,
        });
        summary[a.created ? 'created' : 'skipped'] += 1;
      }
      continue;
    }

    const monthly = FOUNDER_MONTHLY_PAISE[product.code];
    if (monthly == null || monthly <= 0) continue;

    const m = await ensurePrice({
      product,
      billingPeriod: BILLING_PERIODS.MONTHLY,
      amountMinor: monthly,
    });
    summary[m.created ? 'created' : 'skipped'] += 1;

    const a = await ensurePrice({
      product,
      billingPeriod: BILLING_PERIODS.ANNUAL,
      amountMinor: monthly * ANNUAL_MONTH_MULTIPLIER,
    });
    summary[a.created ? 'created' : 'skipped'] += 1;
  }
  return summary;
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);
  console.info('[CommercialBillingSeed] Connected');

  const program = await ensureFounderProgram();
  console.info('[CommercialBillingSeed] Pricing program', {
    code: program.code,
    capacity: program.capacity,
    claimed: program.claimed,
    remaining: program.remaining,
  });

  const products = await upsertProducts();
  console.info('[CommercialBillingSeed] Products', { count: products.length });

  const priceSummary = await seedPrices(products);
  console.info('[CommercialBillingSeed] Prices', priceSummary);

  await mongoose.disconnect();
  console.info('[CommercialBillingSeed] Done');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[CommercialBillingSeed] Failed', err);
    process.exit(1);
  });
}

module.exports = { CATALOG, upsertProducts, ensureFounderProgram, seedPrices };
