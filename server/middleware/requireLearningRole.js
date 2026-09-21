'use strict';

/**
 * Learning (LMS) role helpers — ADMIN | AUTHOR | LEARNER
 * Mirrors client/src/utils/learningRoles.ts
 */

const { getDefaultRoleForApp } = require('../utils/appAccessUtils');

function normalizeRole(raw) {
  const key = String(raw || '').trim().toUpperCase();
  if (key === 'ADMIN' || key === 'AUTHOR' || key === 'LEARNER') return key;
  return null;
}

function resolveLearningRole(user) {
  if (!user) return null;
  const access = Array.isArray(user.appAccess) ? user.appAccess : [];
  const lms = access.find(
    (e) =>
      e
      && String(e.appKey || '').toUpperCase() === 'LMS'
      && String(e.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  if (lms) {
    return normalizeRole(lms.roleKey) || getDefaultRoleForApp('LMS') || 'LEARNER';
  }
  if (user.isOwner === true || String(user.role || '').toLowerCase() === 'owner') {
    return 'ADMIN';
  }
  const allowed = Array.isArray(user.allowedApps)
    ? user.allowedApps.map((a) => String(a || '').toUpperCase())
    : [];
  if (allowed.includes('LMS')) return 'LEARNER';
  return null;
}

function canAuthorLearning(role) {
  return role === 'ADMIN' || role === 'AUTHOR';
}

function canAdminLearning(role) {
  return role === 'ADMIN';
}

/**
 * Express middleware: require LMS AUTHOR or ADMIN.
 * Must run after protect + requireAppEntitlement.
 */
function requireLearningAuthor(req, res, next) {
  const role = resolveLearningRole(req.user);
  if (!canAuthorLearning(role)) {
    return res.status(403).json({
      success: false,
      message: 'Learning author access is required for this action.',
      code: 'LEARNING_AUTHOR_REQUIRED',
      role: role || 'NONE',
    });
  }
  req.learningRole = role;
  return next();
}

function requireLearningAdmin(req, res, next) {
  const role = resolveLearningRole(req.user);
  if (!canAdminLearning(role)) {
    return res.status(403).json({
      success: false,
      message: 'Learning admin access is required for this action.',
      code: 'LEARNING_ADMIN_REQUIRED',
      role: role || 'NONE',
    });
  }
  req.learningRole = role;
  return next();
}

module.exports = {
  resolveLearningRole,
  canAuthorLearning,
  canAdminLearning,
  requireLearningAuthor,
  requireLearningAdmin,
};
