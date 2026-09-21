'use strict';

/**
 * External user portal session — active role resolution and in-memory permission hydration.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §4
 */

const mongoose = require('mongoose');
const People = require('../models/People');
const Role = require('../models/Role');
const { isPortalFrameworkV1Enabled } = require('../utils/portalFeatureFlags');
const { resolvePortalEligibility } = require('./organizationPortalEligibilityService');
const { loadTenantModuleSettings } = require('./portalAccessService');
const { applyProjectionToUser } = require('../utils/rolePermissionProjection');
const { deriveAppAccessFromRole } = require('./roleEntitlementService');
const { recordPortalEvent } = require('./securityAuditService');

function normalizeUserType(user) {
  return String(user?.userType || 'INTERNAL').toUpperCase();
}

function isExternalUser(user) {
  return normalizeUserType(user) === 'EXTERNAL';
}

/**
 * @param {object} user
 * @returns {Promise<object[]>} Active assignments with populated role summary
 */
async function getActiveExternalPortalRoles(user) {
  const organizationId = user.organizationId?._id || user.organizationId;
  const assignments = (user.externalRoleAssignments || []).filter(
    (a) => String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  if (!assignments.length) {
    return [];
  }

  const roleIds = assignments.map((a) => a.roleId).filter(Boolean);
  const roles = await Role.find({
    _id: { $in: roleIds },
    organizationId,
    userType: 'EXTERNAL'
  })
    .select('_id name description color icon userType appEntitlements')
    .lean();

  const roleById = new Map(roles.map((r) => [String(r._id), r]));
  return assignments
    .map((assignment) => {
      const role = roleById.get(String(assignment.roleId));
      if (!role) return null;
      return {
        roleId: role._id,
        name: role.name,
        description: role.description,
        color: role.color,
        icon: role.icon,
        assignedAt: assignment.assignedAt
      };
    })
    .filter(Boolean);
}

async function validateExternalPortalAccess(user, organization) {
  if (!isExternalUser(user)) {
    return { ok: false, code: 'NOT_EXTERNAL_USER', message: 'User is not an external user' };
  }

  if (!user.peopleId) {
    return { ok: false, code: 'PORTAL_IDENTITY_MISSING', message: 'External user is not linked to a person record' };
  }

  const organizationId = organization?._id || user.organizationId;
  const person = await People.findOne({
    _id: user.peopleId,
    organizationId
  })
    .select('portalAccess organization email')
    .lean();

  if (!person?.portalAccess?.enabled) {
    return { ok: false, code: 'PORTAL_ACCESS_DISABLED', message: 'Portal access is disabled for this user' };
  }

  if (!person.organization) {
    return { ok: false, code: 'PORTAL_ORG_REQUIRED', message: 'Person is not linked to a business organization' };
  }

  const businessOrg = await require('../models/Organization')
    .findOne({ _id: person.organization, isTenant: { $ne: true }, deletedAt: null })
    .lean();

  if (!businessOrg) {
    return { ok: false, code: 'PORTAL_ORG_NOT_FOUND', message: 'Business organization not found' };
  }

  const tenantSettings = await loadTenantModuleSettings(organizationId);
  const eligibility = resolvePortalEligibility(businessOrg, tenantSettings);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: eligibility.reason || 'PORTAL_ORG_INELIGIBLE',
      message: 'Business organization is not eligible for portal access'
    };
  }

  return { ok: true, person, businessOrg, eligibility };
}

/**
 * Resolve which portal role to activate at login.
 */
async function resolveExternalLoginSession(user, organization) {
  if (!isPortalFrameworkV1Enabled(organization)) {
    return {
      ok: false,
      code: 'PORTAL_FRAMEWORK_DISABLED',
      message: 'Portal framework is not enabled',
      status: 403
    };
  }

  const access = await validateExternalPortalAccess(user, organization);
  if (!access.ok) {
    return { ...access, status: 403 };
  }

  const portals = await getActiveExternalPortalRoles(user);
  if (!portals.length) {
    return {
      ok: false,
      code: 'NO_PORTAL_ROLES',
      message: 'No active portal roles assigned',
      status: 403
    };
  }

  if (portals.length === 1) {
    return {
      ok: true,
      activeExternalRoleId: portals[0].roleId,
      requiresPortalSelection: false,
      portals,
      defaultUsed: false
    };
  }

  const defaultId = user.defaultExternalRoleId
    ? String(user.defaultExternalRoleId)
    : null;
  if (defaultId && portals.some((p) => String(p.roleId) === defaultId)) {
    return {
      ok: true,
      activeExternalRoleId: defaultId,
      requiresPortalSelection: false,
      portals,
      defaultUsed: true
    };
  }

  return {
    ok: true,
    activeExternalRoleId: null,
    requiresPortalSelection: true,
    portals,
    defaultUsed: false
  };
}

/**
 * Hydrate permissions in memory from activeExternalRoleId — never persist User.roleId.
 */
async function hydrateExternalUserSession(user, activeExternalRoleId, organization) {
  if (!isExternalUser(user)) {
    return { ok: false, code: 'NOT_EXTERNAL_USER', message: 'Not an external user' };
  }

  const roleId = activeExternalRoleId || user.activeExternalRoleId;
  if (!roleId || !mongoose.Types.ObjectId.isValid(String(roleId))) {
    return { ok: false, code: 'PORTAL_ROLE_REQUIRED', message: 'Active portal role is required' };
  }

  const assigned = (user.externalRoleAssignments || []).some(
    (a) =>
      String(a.roleId) === String(roleId) &&
      String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  if (!assigned) {
    return { ok: false, code: 'PORTAL_ROLE_NOT_ASSIGNED', message: 'Portal role is not assigned to this user' };
  }

  const organizationId = organization?._id || user.organizationId;
  const roleLean = await Role.findOne({
    _id: roleId,
    organizationId,
    userType: 'EXTERNAL'
  }).lean();

  if (!roleLean) {
    return { ok: false, code: 'PORTAL_ROLE_INVALID', message: 'Invalid external portal role' };
  }

  user.activeExternalRoleId = roleLean._id;
  user._activeExternalRoleId = roleLean._id;
  user._sessionExternalRoleName = roleLean.name;

  let { appAccess, allowedApps } = deriveAppAccessFromRole(roleLean, organization);
  if (normalizeUserType(user) === 'EXTERNAL') {
    appAccess = appAccess.filter((a) => String(a.appKey).toUpperCase() !== 'SALES');

    // Portal role selection must attach PORTAL when the org app is ACTIVE —
    // even if the role also carries LMS (Academy). Do not treat a non-empty
    // LMS-only appAccess as "done" and skip PORTAL.
    const portalActive = (organization?.enabledApps || []).some((entry) => {
      if (typeof entry === 'string') {
        return String(entry).toUpperCase() === 'PORTAL';
      }
      const key = String(entry?.appKey || '').toUpperCase();
      const status = String(entry?.status || 'ACTIVE').toUpperCase();
      return key === 'PORTAL' && status === 'ACTIVE';
    });
    const hasPortalRow = appAccess.some(
      (a) => String(a.appKey || '').toUpperCase() === 'PORTAL'
    );
    if (portalActive && !hasPortalRow) {
      appAccess = [
        ...appAccess,
        {
          appKey: 'PORTAL',
          roleKey: 'CUSTOMER',
          status: 'ACTIVE',
          addedAt: new Date()
        }
      ];
    }

    allowedApps = appAccess.map((a) => a.appKey);
  }

  user.appAccess = appAccess;
  user.allowedApps = allowedApps;

  await applyProjectionToUser(user, roleLean, organization);

  // Learning Academy: inject LMS LEARNER when Academy access is ACTIVE
  try {
    const { applyAcademyAccessToSession } = require('./learning/learningAcademyAccessService');
    await applyAcademyAccessToSession(user, organizationId);
  } catch (_err) {
    // non-fatal — Academy optional
  }

  return {
    ok: true,
    role: {
      _id: roleLean._id,
      name: roleLean.name
    },
    allowedApps: user.allowedApps
  };
}

async function assertExternalRoleSelectable(user, roleId, organization) {
  const loginSession = await resolveExternalLoginSession(user, organization);
  if (!loginSession.ok) {
    return loginSession;
  }

  const allowed = loginSession.portals.some((p) => String(p.roleId) === String(roleId));
  if (!allowed) {
    return {
      ok: false,
      code: 'PORTAL_ROLE_NOT_ASSIGNED',
      message: 'Portal role is not assigned to this user',
      status: 403
    };
  }

  return { ok: true, portals: loginSession.portals };
}

function serializePortalsForClient(portals) {
  return (portals || []).map((p) => ({
    roleId: p.roleId,
    name: p.name,
    description: p.description || '',
    color: p.color || null,
    icon: p.icon || null
  }));
}

async function recordPortalSessionEvent({
  type,
  user,
  organizationId,
  roleId,
  reqMeta = {},
  description = ''
}) {
  await recordPortalEvent({
    organizationId,
    type,
    description,
    userId: user._id,
    peopleId: user.peopleId || null,
    actorUserId: user._id,
    ipAddress: reqMeta.ip || null,
    userAgent: reqMeta.userAgent || null,
    metadata: { roleId: roleId ? String(roleId) : null }
  });
}

module.exports = {
  isExternalUser,
  getActiveExternalPortalRoles,
  validateExternalPortalAccess,
  resolveExternalLoginSession,
  hydrateExternalUserSession,
  assertExternalRoleSelectable,
  serializePortalsForClient,
  recordPortalSessionEvent
};
