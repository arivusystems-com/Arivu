'use strict';

/**
 * Academy learner lifecycle: Invite → Accept → Active → Suspend/Revoke → Restore.
 * Does not delete People on revoke.
 */

const mongoose = require('mongoose');
const User = require('../../models/User');
const LearningAcademyAccess = require('../../models/learning/LearningAcademyAccess');
const {
  ACADEMY_ACCESS_STATUSES,
} = require('../../constants/learningConstants');

function toOrgId(organizationId) {
  return new mongoose.Types.ObjectId(String(organizationId));
}

function toUserId(userId) {
  return new mongoose.Types.ObjectId(String(userId));
}

function serviceError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

async function getAccessRecord(organizationId, userId) {
  return LearningAcademyAccess.findOne({
    organizationId: toOrgId(organizationId),
    userId: toUserId(userId),
  }).lean();
}

function hasActiveAcademyAccess(record) {
  return record && record.status === ACADEMY_ACCESS_STATUSES.ACTIVE;
}

/**
 * Effective Learning access for EXTERNAL: ACTIVE Academy access.
 * Internals use appAccess.LMS (handled by LearningSeatService).
 */
async function userHasActiveAcademyAccess(organizationId, userId) {
  const record = await getAccessRecord(organizationId, userId);
  return hasActiveAcademyAccess(record);
}

async function ensureLmsLearnerOnUser(userDoc) {
  if (!userDoc) return;
  const access = Array.isArray(userDoc.appAccess) ? [...userDoc.appAccess] : [];
  const idx = access.findIndex((e) => String(e.appKey || '').toUpperCase() === 'LMS');
  if (idx >= 0) {
    access[idx] = {
      ...access[idx],
      appKey: 'LMS',
      roleKey: 'LEARNER',
      status: 'ACTIVE',
    };
  } else {
    access.push({
      appKey: 'LMS',
      roleKey: 'LEARNER',
      status: 'ACTIVE',
      addedAt: new Date(),
    });
  }
  userDoc.appAccess = access;
  const allowed = new Set(
    (userDoc.allowedApps || []).map((a) => String(a || '').toUpperCase())
  );
  allowed.add('LMS');
  userDoc.allowedApps = [...allowed];
  userDoc.markModified?.('appAccess');
  userDoc.markModified?.('allowedApps');
}

async function disableLmsOnUser(userDoc) {
  if (!userDoc || !Array.isArray(userDoc.appAccess)) return;
  userDoc.appAccess = userDoc.appAccess.map((e) => {
    if (String(e.appKey || '').toUpperCase() !== 'LMS') return e;
    return { ...e, status: 'DISABLED' };
  });
  userDoc.markModified?.('appAccess');
}

/**
 * Invite (or re-invite) an external user to Academy.
 * Requires existing EXTERNAL user linked to People.
 */
async function inviteAcademyLearner({
  organizationId,
  userId,
  invitedBy,
  peopleId = null,
}) {
  const orgId = toOrgId(organizationId);
  const uid = toUserId(userId);
  const user = await User.findOne({ _id: uid, organizationId: orgId });
  if (!user) throw serviceError('USER_NOT_FOUND', 'User not found', 404);
  if (String(user.userType || '').toUpperCase() !== 'EXTERNAL') {
    throw serviceError('ACADEMY_EXTERNAL_ONLY', 'Academy access is for EXTERNAL users only');
  }

  const now = new Date();
  const existing = await LearningAcademyAccess.findOne({ organizationId: orgId, userId: uid });
  if (existing && existing.status === ACADEMY_ACCESS_STATUSES.ACTIVE) {
    return existing.toObject ? existing.toObject() : existing;
  }

  const payload = {
    organizationId: orgId,
    userId: uid,
    peopleId: peopleId || user.peopleId || null,
    status: ACADEMY_ACCESS_STATUSES.INVITED,
    invitedAt: now,
    invitedBy: invitedBy ? toUserId(invitedBy) : null,
    statusChangedBy: invitedBy ? toUserId(invitedBy) : null,
    acceptedAt: null,
    suspendedAt: null,
    revokedAt: null,
  };

  const record = await LearningAcademyAccess.findOneAndUpdate(
    { organizationId: orgId, userId: uid },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Persist LMS LEARNER as DISABLED until accept (seat not granted via access alone)
  const access = Array.isArray(user.appAccess) ? [...user.appAccess] : [];
  const idx = access.findIndex((e) => String(e.appKey || '').toUpperCase() === 'LMS');
  const entry = {
    appKey: 'LMS',
    roleKey: 'LEARNER',
    status: 'DISABLED',
    addedAt: now,
  };
  if (idx >= 0) access[idx] = { ...access[idx], ...entry };
  else access.push(entry);
  user.appAccess = access;
  user.markModified('appAccess');
  await user.save();

  return record;
}

async function acceptAcademyInvite({ organizationId, userId }) {
  const orgId = toOrgId(organizationId);
  const uid = toUserId(userId);
  const record = await LearningAcademyAccess.findOne({ organizationId: orgId, userId: uid });
  if (!record) {
    throw serviceError('ACADEMY_INVITE_NOT_FOUND', 'No Academy invitation found', 404);
  }
  if (record.status === ACADEMY_ACCESS_STATUSES.REVOKED) {
    throw serviceError('ACADEMY_REVOKED', 'Academy access was revoked. Contact your administrator.');
  }
  if (record.status === ACADEMY_ACCESS_STATUSES.SUSPENDED) {
    throw serviceError('ACADEMY_SUSPENDED', 'Academy access is suspended.');
  }

  const now = new Date();
  record.status = ACADEMY_ACCESS_STATUSES.ACTIVE;
  record.acceptedAt = record.acceptedAt || now;
  record.restoredAt = null;
  await record.save();

  const user = await User.findOne({ _id: uid, organizationId: orgId });
  if (user) {
    await ensureLmsLearnerOnUser(user);
    if (String(user.status || '').toLowerCase() === 'invited') {
      user.status = 'active';
    }
    await user.save();
  }

  return record.toObject();
}

async function suspendAcademyAccess({ organizationId, userId, actorUserId }) {
  return setAcademyStatus({
    organizationId,
    userId,
    actorUserId,
    status: ACADEMY_ACCESS_STATUSES.SUSPENDED,
  });
}

async function revokeAcademyAccess({ organizationId, userId, actorUserId }) {
  return setAcademyStatus({
    organizationId,
    userId,
    actorUserId,
    status: ACADEMY_ACCESS_STATUSES.REVOKED,
  });
}

async function restoreAcademyAccess({ organizationId, userId, actorUserId }) {
  return setAcademyStatus({
    organizationId,
    userId,
    actorUserId,
    status: ACADEMY_ACCESS_STATUSES.ACTIVE,
  });
}

async function setAcademyStatus({ organizationId, userId, actorUserId, status }) {
  const orgId = toOrgId(organizationId);
  const uid = toUserId(userId);
  const record = await LearningAcademyAccess.findOne({ organizationId: orgId, userId: uid });
  if (!record) {
    throw serviceError('ACADEMY_ACCESS_NOT_FOUND', 'Academy access record not found', 404);
  }

  const now = new Date();
  record.status = status;
  record.statusChangedBy = actorUserId ? toUserId(actorUserId) : null;
  if (status === ACADEMY_ACCESS_STATUSES.SUSPENDED) record.suspendedAt = now;
  if (status === ACADEMY_ACCESS_STATUSES.REVOKED) record.revokedAt = now;
  if (status === ACADEMY_ACCESS_STATUSES.ACTIVE) {
    record.restoredAt = now;
    record.suspendedAt = null;
    record.revokedAt = null;
    if (!record.acceptedAt) record.acceptedAt = now;
  }
  await record.save();

  const user = await User.findOne({ _id: uid, organizationId: orgId });
  if (user) {
    if (status === ACADEMY_ACCESS_STATUSES.ACTIVE) {
      await ensureLmsLearnerOnUser(user);
    } else {
      await disableLmsOnUser(user);
    }
    await user.save();
  }

  return record.toObject();
}

async function listAcademyLearners(organizationId, { status } = {}) {
  const filter = { organizationId: toOrgId(organizationId) };
  if (status) filter.status = status;
  const rows = await LearningAcademyAccess.find(filter).sort({ updatedAt: -1 }).lean();
  const userIds = rows.map((r) => r.userId);
  const users = await User.find({ _id: { $in: userIds }, organizationId: toOrgId(organizationId) })
    .select('_id firstName lastName email status userType peopleId')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => ({
    ...r,
    user: byId.get(String(r.userId)) || null,
  }));
}

/**
 * Inject LMS LEARNER into EXTERNAL session when Academy access is ACTIVE.
 */
async function applyAcademyAccessToSession(user, organizationId) {
  if (!user || String(user.userType || '').toUpperCase() !== 'EXTERNAL') {
    return user;
  }
  const active = await userHasActiveAcademyAccess(organizationId || user.organizationId, user._id);
  if (!active) return user;

  const access = Array.isArray(user.appAccess) ? [...user.appAccess] : [];
  const idx = access.findIndex((e) => String(e.appKey || '').toUpperCase() === 'LMS');
  const entry = { appKey: 'LMS', roleKey: 'LEARNER', status: 'ACTIVE', addedAt: new Date() };
  if (idx >= 0) access[idx] = { ...access[idx], ...entry };
  else access.push(entry);
  user.appAccess = access;
  const allowed = new Set((user.allowedApps || []).map((a) => String(a || '').toUpperCase()));
  allowed.add('LMS');
  user.allowedApps = [...allowed];
  return user;
}

module.exports = {
  getAccessRecord,
  hasActiveAcademyAccess,
  userHasActiveAcademyAccess,
  inviteAcademyLearner,
  acceptAcademyInvite,
  suspendAcademyAccess,
  revokeAcademyAccess,
  restoreAcademyAccess,
  listAcademyLearners,
  applyAcademyAccessToSession,
  ACADEMY_ACCESS_STATUSES,
};
