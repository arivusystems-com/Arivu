'use strict';

/**
 * LearningSeatService — sole authority for learner seat capacity.
 * Enrollment must ask this service; never bury seat rules in Enrollment or Academy login.
 *
 * Invariant: 1 learner = 1 seat regardless of enrollment count.
 * Consume when: Learning access AND ≥1 seat-consuming enrollment.
 * Login to Academy alone does not consume a seat.
 */

const mongoose = require('mongoose');
const User = require('../../models/User');
const BillingEntitlement = require('../../models/commercial/BillingEntitlement');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const BillingPrice = require('../../models/commercial/BillingPrice');
const LearningEnrollment = require('../../models/learning/LearningEnrollment');
const LearningAcademyAccess = require('../../models/learning/LearningAcademyAccess');
const {
  PRODUCT_CODES,
  ENTITLEMENT_TYPES,
  ENTITLEMENT_SCOPES,
  LEARNING_PLANS,
  LEARNING_PRIMARY_PLAN_KEY,
  CAPACITY_UNITS,
  ITEM_STATUSES,
} = require('../../constants/commercialBilling');
const {
  SEAT_CONSUMING_ENROLLMENT_STATUSES,
  LEARNING_AUDIENCES,
  ACADEMY_ACCESS_STATUSES,
} = require('../../constants/learningConstants');
const { deriveLearnerAudiencesBatch } = require('./learningAudienceService');

function toOrgId(organizationId) {
  return new mongoose.Types.ObjectId(String(organizationId));
}

function toUserId(userId) {
  return new mongoose.Types.ObjectId(String(userId));
}

function userHasLearningAccessFromAppAccess(user) {
  if (!user || String(user.status || '').toLowerCase() === 'archived') return false;
  if (String(user.status || '').toLowerCase() === 'inactive') return false;
  if (String(user.status || '').toLowerCase() === 'deactivated') return false;
  const access = Array.isArray(user.appAccess) ? user.appAccess : [];
  return access.some(
    (e) =>
      String(e.appKey || '').toUpperCase() === 'LMS'
      && String(e.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
}

/**
 * Learning access for seat purposes:
 * - ACTIVE LMS appAccess, or
 * - EXTERNAL with ACTIVE Academy access (LMS may be session-projected)
 */
async function userHasLearningAccessAsync(organizationId, user) {
  if (!user) return false;
  if (userHasLearningAccessFromAppAccess(user)) return true;
  if (String(user.userType || '').toUpperCase() !== 'EXTERNAL') return false;
  const record = await LearningAcademyAccess.exists({
    organizationId: toOrgId(organizationId),
    userId: user._id,
    status: ACADEMY_ACCESS_STATUSES.ACTIVE,
  });
  return Boolean(record);
}

/** Sync helper used by tests / callers with persisted appAccess. */
function userHasLearningAccess(user) {
  return userHasLearningAccessFromAppAccess(user);
}

async function getCapacity(organizationId) {
  const orgId = toOrgId(organizationId);
  const entitlement = await BillingEntitlement.findOne({
    organizationId: orgId,
    type: ENTITLEMENT_TYPES.APPLICATION,
    productCode: PRODUCT_CODES.LEARNING,
    scope: ENTITLEMENT_SCOPES.ORGANIZATION,
    status: 'active',
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: new Date() } }],
  }).lean();

  if (entitlement && Number(entitlement.quantity) > 0) {
    return Number(entitlement.quantity);
  }

  const item = await BillingSubscriptionItem.findOne({
    organizationId: orgId,
    productCode: PRODUCT_CODES.LEARNING,
    status: ITEM_STATUSES.ACTIVE,
  }).lean();

  if (item?.priceId) {
    const price = await BillingPrice.findById(item.priceId).lean();
    if (price?.includedQuantity) return Number(price.includedQuantity);
  }

  return LEARNING_PLANS[LEARNING_PRIMARY_PLAN_KEY].capacity;
}

async function loadSeatEligibleUsers(organizationId, userIds) {
  const orgId = toOrgId(organizationId);
  const users = await User.find({
    _id: { $in: userIds },
    organizationId: orgId,
    status: { $in: ['active', 'invited'] },
  })
    .select('_id appAccess status userType peopleId externalRoleAssignments activeExternalRoleId')
    .lean();

  const academyActiveIds = new Set();
  const externalIds = users
    .filter((u) => String(u.userType || '').toUpperCase() === 'EXTERNAL')
    .map((u) => u._id);
  if (externalIds.length) {
    const rows = await LearningAcademyAccess.find({
      organizationId: orgId,
      userId: { $in: externalIds },
      status: ACADEMY_ACCESS_STATUSES.ACTIVE,
    })
      .select('userId')
      .lean();
    for (const r of rows) academyActiveIds.add(String(r.userId));
  }

  return users.filter((u) => {
    if (userHasLearningAccessFromAppAccess(u)) return true;
    return academyActiveIds.has(String(u._id));
  });
}

async function countActiveLearnerSeats(organizationId) {
  const orgId = toOrgId(organizationId);
  const rows = await LearningEnrollment.aggregate([
    {
      $match: {
        organizationId: orgId,
        status: { $in: [...SEAT_CONSUMING_ENROLLMENT_STATUSES] },
      },
    },
    { $group: { _id: '$userId' } },
  ]);

  if (!rows.length) return 0;

  const userIds = rows.map((r) => r._id);
  const eligible = await loadSeatEligibleUsers(organizationId, userIds);
  return eligible.length;
}

async function userConsumesSeat(organizationId, userId) {
  const orgId = toOrgId(organizationId);
  const uid = toUserId(userId);
  const user = await User.findOne({ _id: uid, organizationId: orgId })
    .select('_id appAccess status userType')
    .lean();
  if (!(await userHasLearningAccessAsync(organizationId, user))) return false;

  const active = await LearningEnrollment.exists({
    organizationId: orgId,
    userId: uid,
    status: { $in: [...SEAT_CONSUMING_ENROLLMENT_STATUSES] },
  });
  return Boolean(active);
}

async function getUsage(organizationId) {
  const [learnerSeatCapacity, learnerSeatsUsed] = await Promise.all([
    getCapacity(organizationId),
    countActiveLearnerSeats(organizationId),
  ]);
  let planKey = null;
  for (const [key, plan] of Object.entries(LEARNING_PLANS)) {
    if (plan.capacity === learnerSeatCapacity) {
      planKey = key;
      break;
    }
  }
  return {
    learnerSeatCapacity,
    learnerSeatsUsed,
    learnerSeatsRemaining: Math.max(0, learnerSeatCapacity - learnerSeatsUsed),
    capacityUnit: CAPACITY_UNITS.LEARNER_SEAT,
    planKey,
    plans: Object.values(LEARNING_PLANS).map((p) => ({
      planKey: p.planKey,
      capacity: p.capacity,
      monthlyPaise: p.monthlyPaise,
    })),
  };
}

async function canConsumeSeat(organizationId, userId) {
  const orgId = toOrgId(organizationId);
  const uid = toUserId(userId);
  const user = await User.findOne({ _id: uid, organizationId: orgId })
    .select('_id appAccess status userType')
    .lean();

  if (!(await userHasLearningAccessAsync(organizationId, user))) {
    return {
      ok: false,
      code: 'LEARNING_ACCESS_REQUIRED',
      message: 'User must have Learning access before consuming a learner seat.',
    };
  }

  const already = await userConsumesSeat(organizationId, userId);
  if (already) {
    return { ok: true, alreadyConsuming: true };
  }

  const usage = await getUsage(organizationId);
  if (usage.learnerSeatsUsed >= usage.learnerSeatCapacity) {
    return {
      ok: false,
      code: 'LEARNER_CAPACITY_REACHED',
      message: 'Learner capacity reached. Upgrade your Learning plan to add more learners.',
      usage,
    };
  }

  return { ok: true, alreadyConsuming: false, usage };
}

async function consumeSeat(organizationId, userId) {
  const check = await canConsumeSeat(organizationId, userId);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = check.code;
    err.usage = check.usage;
    throw err;
  }
  return check;
}

async function releaseSeat(organizationId, userId) {
  const still = await userConsumesSeat(organizationId, userId);
  return {
    released: !still,
    stillConsuming: still,
  };
}

async function getUsageBreakdown(organizationId) {
  const usage = await getUsage(organizationId);
  const orgId = toOrgId(organizationId);
  const rows = await LearningEnrollment.aggregate([
    {
      $match: {
        organizationId: orgId,
        status: { $in: [...SEAT_CONSUMING_ENROLLMENT_STATUSES] },
      },
    },
    {
      $group: {
        _id: '$userId',
        enrollmentCount: { $sum: 1 },
        statuses: { $addToSet: '$status' },
      },
    },
  ]);

  const userIds = rows.map((r) => r._id);
  const eligible = await loadSeatEligibleUsers(organizationId, userIds);
  const audienceByUser = await deriveLearnerAudiencesBatch(eligible);
  const byId = new Map(eligible.map((u) => [String(u._id), u]));

  const byAudience = {
    [LEARNING_AUDIENCES.INTERNAL]: 0,
    [LEARNING_AUDIENCES.CUSTOMER]: 0,
    [LEARNING_AUDIENCES.PARTNER]: 0,
    [LEARNING_AUDIENCES.EXTERNAL]: 0,
  };

  const learners = rows
    .map((r) => {
      const u = byId.get(String(r._id));
      if (!u) return null;
      const audience = audienceByUser.get(String(r._id)) || LEARNING_AUDIENCES.EXTERNAL;
      byAudience[audience] = (byAudience[audience] || 0) + 1;
      return {
        userId: r._id,
        enrollmentCount: r.enrollmentCount,
        email: u?.email,
        name: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email,
        audience,
      };
    })
    .filter(Boolean);

  return {
    ...usage,
    byAudience,
    learners,
  };
}

module.exports = {
  getCapacity,
  getUsage,
  canConsumeSeat,
  consumeSeat,
  releaseSeat,
  getUsageBreakdown,
  userHasLearningAccess,
  userHasLearningAccessAsync,
  userConsumesSeat,
};
