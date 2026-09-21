'use strict';

const mongoose = require('mongoose');
const PricingProgram = require('../../models/commercial/PricingProgram');
const FounderAllocation = require('../../models/commercial/FounderAllocation');
const {
  FOUNDER_LAUNCH,
  PRICING_PROGRAM_CODES,
} = require('../../constants/commercialBilling');

/**
 * Founder Launch capacity + allocation (auditable, not isFounder boolean).
 * Uses atomic findOneAndUpdate — no multi-doc transactions (works on standalone Mongo).
 */
async function getFounderProgramStatus() {
  let program = await PricingProgram.findOne({ code: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH });
  if (!program) {
    program = await PricingProgram.create(PricingProgram.founderDefaults());
  }
  return {
    code: program.code,
    name: program.name,
    capacity: program.capacity,
    claimed: program.claimed,
    remaining: program.capacity == null ? null : Math.max(0, program.capacity - program.claimed),
    priceProtectionMonths: program.priceProtectionMonths,
    status: program.status,
  };
}

/**
 * Reserve a Founder slot for an organization (idempotent per org).
 * @param {{ organizationId: string|ObjectId, billingSubscriptionId?: string|ObjectId|null }} params
 */
async function reserveFounderAllocation({ organizationId, billingSubscriptionId = null }) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));

  const existing = await FounderAllocation.findOne({ organizationId: orgId });
  if (existing && ['reserved', 'activated'].includes(existing.status)) {
    return { allocated: false, allocation: existing, reason: 'already_allocated' };
  }

  const program = await PricingProgram.findOne({ code: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH });
  if (!program || program.status !== 'active') {
    return { allocated: false, allocation: null, reason: 'program_closed' };
  }
  if (program.capacity != null && program.claimed >= program.capacity) {
    return { allocated: false, allocation: null, reason: 'capacity_exhausted' };
  }

  const locked = await PricingProgram.findOneAndUpdate(
    {
      code: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
      status: 'active',
      $expr: { $lt: ['$claimed', '$capacity'] },
    },
    { $inc: { claimed: 1 } },
    { new: true }
  );

  if (!locked) {
    return { allocated: false, allocation: null, reason: 'capacity_exhausted' };
  }

  try {
    const months = locked.priceProtectionMonths || FOUNDER_LAUNCH.priceProtectionMonths;
    const protection = new Date();
    protection.setMonth(protection.getMonth() + months);

    const allocation = await FounderAllocation.findOneAndUpdate(
      { organizationId: orgId },
      {
        $set: {
          pricingProgramCode: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH,
          billingSubscriptionId: billingSubscriptionId || null,
          status: 'reserved',
          reservedAt: new Date(),
          priceProtectionExpiresAt: protection,
          releasedAt: null,
        },
      },
      { upsert: true, new: true }
    );

    return { allocated: true, allocation, reason: null };
  } catch (err) {
    // Roll back capacity claim if allocation write fails
    await PricingProgram.updateOne(
      { code: PRICING_PROGRAM_CODES.FOUNDER_LAUNCH, claimed: { $gt: 0 } },
      { $inc: { claimed: -1 } }
    );
    throw err;
  }
}

/**
 * @param {{ organizationId: string|ObjectId, billingSubscriptionId: string|ObjectId }} params
 */
async function activateFounderAllocation({ organizationId, billingSubscriptionId }) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const allocation = await FounderAllocation.findOne({ organizationId: orgId });
  if (!allocation) {
    return { ok: false, reason: 'not_found' };
  }
  allocation.status = 'activated';
  allocation.activatedAt = new Date();
  allocation.billingSubscriptionId = billingSubscriptionId;
  await allocation.save();
  return { ok: true, allocation };
}

module.exports = {
  getFounderProgramStatus,
  reserveFounderAllocation,
  activateFounderAllocation,
};
