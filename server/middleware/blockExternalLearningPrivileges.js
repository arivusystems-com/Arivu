'use strict';

/**
 * Server-side security boundary for Learning Academy / EXTERNAL learners.
 * UI hiding is not a security boundary.
 */

const { resolveLearningRole, canAuthorLearning, canAdminLearning } = require('./requireLearningRole');
const learningAcademyAccessService = require('../services/learning/learningAcademyAccessService');
const { getAcademyConfig, isAcademyEnabled } = require('../services/learning/learningAcademyConfigService');

function isExternalUser(user) {
  return String(user?.userType || '').toUpperCase() === 'EXTERNAL';
}

/**
 * Deny EXTERNAL on authoring / admin / compliance / content-library / settings-style LMS routes.
 * Attach after protect + requireAppEntitlement on /api/lms.
 */
function blockExternalLearningPrivileges(req, res, next) {
  if (!isExternalUser(req.user)) return next();

  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '');

  // Always deny author/admin middleware targets — belt and suspenders for guessed URLs
  const role = resolveLearningRole(req.user);
  if (canAuthorLearning(role) || canAdminLearning(role)) {
    // EXTERNAL must never hold AUTHOR/ADMIN even if roleKey was projected incorrectly
    const lms = (req.user.appAccess || []).find(
      (e) => String(e?.appKey || '').toUpperCase() === 'LMS'
    );
    if (lms && String(lms.roleKey || '').toUpperCase() !== 'LEARNER') {
      return res.status(403).json({
        success: false,
        code: 'ACADEMY_LEARNER_ONLY',
        message: 'External Academy learners cannot use Learning author or admin APIs.',
      });
    }
  }

  const denyPrefixes = [
    '/upload',
    '/seats',
    '/analytics',
    '/compliance',
    '/content-library',
    '/jobs',
    '/academy/config',
    '/academy/learners',
  ];

  // Mutating course/path/program/authoring endpoints
  const authoringPostPatterns = [
    /^\/courses\/?$/,
    /^\/courses\/[^/]+\/modules/,
    /^\/courses\/[^/]+\/publish/,
    /^\/courses\/[^/]+\/context/,
    /^\/courses\/[^/]+\/assign/,
    /^\/paths\/?$/,
    /^\/paths\/[^/]+\/publish/,
    /^\/paths\/[^/]+\/assign/,
    /^\/programs/,
    /^\/cohorts/,
    /^\/live-sessions\/?$/,
    /^\/live-sessions\/[^/]+\/cancel/,
    /^\/skills\/?$/,
    /^\/badges/,
    /^\/assessments\/?$/,
    /^\/certificates\/?$/,
  ];

  if (denyPrefixes.some((p) => path === p || path.startsWith(`${p}/`))) {
    return res.status(403).json({
      success: false,
      code: 'ACADEMY_FORBIDDEN',
      message: 'This Learning API is not available to Academy learners.',
    });
  }

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (authoringPostPatterns.some((re) => re.test(path))) {
      // Allow learner self-serve: enroll, complete-lesson, submit assessment, register live, unenroll, launch
      const learnerAllowed = [
        /^\/courses\/[^/]+\/enroll/,
        /^\/courses\/[^/]+\/unenroll/,
        /^\/courses\/[^/]+\/complete-lesson/,
        /^\/courses\/[^/]+\/objects\/[^/]+\/launch/,
        /^\/paths\/[^/]+\/enroll/,
        /^\/live-sessions\/[^/]+\/register/,
        /^\/assessments\/[^/]+\/submit/,
        /^\/academy\/accept/,
      ];
      if (!learnerAllowed.some((re) => re.test(path))) {
        return res.status(403).json({
          success: false,
          code: 'ACADEMY_FORBIDDEN',
          message: 'This Learning API is not available to Academy learners.',
        });
      }
    }
  }

  // GET /courses list is author-only in routes — still block if somehow reached
  if (method === 'GET' && (path === '/courses' || path === '/courses/')) {
    return res.status(403).json({
      success: false,
      code: 'ACADEMY_FORBIDDEN',
      message: 'Use Academy catalog APIs instead of the author course list.',
    });
  }

  return next();
}

/**
 * Require EXTERNAL + ACTIVE Academy access for /api/lms/academy/* learner routes.
 */
async function requireAcademyLearner(req, res, next) {
  try {
    if (!isExternalUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'ACADEMY_EXTERNAL_ONLY',
        message: 'Academy learner APIs are for external users only.',
      });
    }
    const orgId = req.user.organizationId;
    const config = await getAcademyConfig(orgId);
    if (!isAcademyEnabled(config)) {
      return res.status(403).json({
        success: false,
        code: 'ACADEMY_DISABLED',
        message: 'Learning Academy is not enabled for this organization.',
      });
    }
    const active = await learningAcademyAccessService.userHasActiveAcademyAccess(
      orgId,
      req.user._id
    );
    if (!active) {
      return res.status(403).json({
        success: false,
        code: 'ACADEMY_ACCESS_REQUIRED',
        message: 'Active Academy access is required.',
      });
    }
    // Ensure LEARNER effective role
    await learningAcademyAccessService.applyAcademyAccessToSession(req.user, orgId);
    return next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  blockExternalLearningPrivileges,
  requireAcademyLearner,
  isExternalUser,
};
