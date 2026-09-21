'use strict';

/**
 * Portal access lifecycle — enable/disable, role assignment, invite, sync.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md
 */

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const People = require('../models/People');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const UserDirectory = require('../models/UserDirectory');
const SecurityEvent = require('../models/SecurityEvent');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const { isPortalFrameworkV1Enabled } = require('../utils/portalFeatureFlags');
const { resolvePortalEligibility } = require('./organizationPortalEligibilityService');
const { recordPortalEvent } = require('./securityAuditService');
const { getScopedUserModel } = require('./userInviteService');
const { sendPortalInviteEmail } = require('./userAccountEmailService');
const { generateSecurePassword } = require('./provisioning/utils/passwordGenerator');
const { buildPortalLoginUrl } = require('../utils/userAuthTokens');
const {
  listExternalRolesForOrganization,
  ensureExternalPortalRolesForOrganization
} = require('./portalExternalRoleSeedService');
const {
  revokeAllUserSessions,
  revokeUserSessionsByUserId
} = require('./sessionService');
const {
  incrementActiveExternalUsers,
  decrementActiveExternalUsers,
  getExternalUserUsage
} = require('./externalUserUsageService');

const APP_KEYS_FOR_ORG_SETTINGS = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL'];

function serviceError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function inviterDisplayName(inviter) {
  const full = `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim();
  return full || inviter?.username || inviter?.email || 'Your administrator';
}

async function loadTenantModuleSettings(tenantOrganizationId) {
  for (const appKey of APP_KEYS_FOR_ORG_SETTINGS) {
    const cfg = await TenantModuleConfiguration.findOne({
      organizationId: tenantOrganizationId,
      moduleKey: 'organizations',
      appKey
    })
      .select('settings')
      .lean();
    if (cfg?.settings) {
      return cfg.settings;
    }
  }
  return {};
}

async function loadTenantOrganization(tenantOrganizationId) {
  return Organization.findById(tenantOrganizationId)
    .select('name database settings enabledApps')
    .lean();
}

async function assertPortalFrameworkEnabled(tenantOrganization) {
  if (!isPortalFrameworkV1Enabled(tenantOrganization)) {
    throw serviceError('PORTAL_FRAMEWORK_DISABLED', 'Portal framework is not enabled for this organization', 403);
  }
}

async function loadPersonForPortal(peopleId, tenantOrganizationId) {
  const person = await People.findOne({
    _id: peopleId,
    organizationId: tenantOrganizationId,
    deletedAt: null
  }).lean();
  if (!person) {
    throw serviceError('PEOPLE_NOT_FOUND', 'Person not found', 404);
  }
  return person;
}

async function loadBusinessOrganization(businessOrgId) {
  if (!businessOrgId) {
    return null;
  }
  return Organization.findOne({
    _id: businessOrgId,
    isTenant: { $ne: true },
    deletedAt: null
  }).lean();
}

async function validateExternalRoleIds(roleIds, tenantOrganizationId) {
  const ids = [...new Set((roleIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) {
    throw serviceError('PORTAL_ROLES_REQUIRED', 'At least one external portal role is required');
  }

  const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (objectIds.length !== ids.length) {
    throw serviceError('PORTAL_ROLE_INVALID', 'One or more role IDs are invalid');
  }

  const roles = await Role.find({
    _id: { $in: objectIds },
    organizationId: tenantOrganizationId,
    userType: 'EXTERNAL'
  })
    .select('_id name userType')
    .lean();

  if (roles.length !== ids.length) {
    throw serviceError('PORTAL_ROLE_INVALID', 'One or more roles are not valid external portal roles', 400);
  }

  return roles;
}

function buildRoleAssignments(roleIds, adminId, existingAssignments = []) {
  const now = new Date();
  const adminObjectId = adminId || null;
  const requested = new Set(roleIds.map((id) => String(id)));

  const preserved = (existingAssignments || [])
    .filter((a) => a.status === 'ACTIVE' && requested.has(String(a.roleId)))
    .map((a) => ({
      roleId: a.roleId,
      status: 'ACTIVE',
      assignedAt: a.assignedAt || now,
      assignedBy: a.assignedBy || adminObjectId,
      removedAt: null,
      removedBy: null
    }));

  const preservedIds = new Set(preserved.map((a) => String(a.roleId)));
  for (const roleId of requested) {
    if (!preservedIds.has(roleId)) {
      preserved.push({
        roleId,
        status: 'ACTIVE',
        assignedAt: now,
        assignedBy: adminObjectId,
        removedAt: null,
        removedBy: null
      });
    }
  }

  return preserved;
}

async function assertEmailAvailableForPortal({
  tenantOrganizationId,
  email,
  excludeUserId
}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw serviceError('PORTAL_EMAIL_REQUIRED', 'Email is required to enable portal access');
  }

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  const ScopedUser = await getScopedUserModel(tenantOrg);

  const query = {
    organizationId: tenantOrganizationId,
    email: normalized
  };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const conflict = await ScopedUser.findOne(query).select('_id peopleId userType status').lean();
  if (conflict) {
    throw serviceError('PORTAL_EMAIL_DUPLICATE', 'A user with this email already exists in your organization', 409);
  }
}

async function syncUserDirectoryEntry({ user, tenantOrganization }) {
  const normalizedEmail = normalizeEmail(user.email);
  if (!normalizedEmail) {
    return;
  }

  await UserDirectory.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        organizationId: tenantOrganization._id,
        tenantDatabaseName: tenantOrganization.database?.name || null,
        tenantUserId: user._id,
        status: user.status === 'inactive' ? 'inactive' : 'active'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function issuePortalCredentials(user, { incrementInviteVersion = true } = {}) {
  const tempPassword = generateSecurePassword(16);
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const now = new Date();

  user.password = hashedPassword;
  user.mustChangePassword = true;
  user.status = 'active';
  user.inviteTokenHash = null;
  user.inviteTokenExpiresAt = null;
  user.portalInvite = user.portalInvite || {};
  if (incrementInviteVersion) {
    user.portalInvite.inviteVersion = (user.portalInvite.inviteVersion || 0) + 1;
  }
  user.portalInvite.tempPasswordIssuedAt = now;
  user.portalInvite.tempPasswordUsedAt = null;

  return { tempPassword, issuedAt: now };
}

async function sendPortalInviteForUser({
  user,
  tenantOrganization,
  inviter,
  tempPassword
}) {
  const portalUrl = buildPortalLoginUrl();
  const result = await sendPortalInviteEmail({
    to: user.email,
    invitee: user,
    organizationId: tenantOrganization._id,
    organizationName: tenantOrganization.name,
    inviterName: inviterDisplayName(inviter),
    portalUrl,
    username: user.email,
    temporaryPassword: tempPassword
  });

  return {
    sent: result.success === true,
    skipped: result.skipped === true,
    reason: result.reason || result.error || null
  };
}

/**
 * @returns {Promise<object>}
 */
async function getPortalState(peopleId, tenantOrganizationId) {
  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const availableExternalRoles = await listExternalRolesForOrganization(
    tenantOrganizationId,
    tenantOrg
  );

  let user = null;
  let roles = [];

  if (person.portalAccess?.userId) {
    const ScopedUser = await getScopedUserModel(tenantOrg);
    user = await ScopedUser.findById(person.portalAccess.userId)
      .select('-password')
      .lean();

    if (user?.externalRoleAssignments?.length) {
      const roleIds = user.externalRoleAssignments
        .filter((a) => a.status === 'ACTIVE')
        .map((a) => a.roleId);
      roles = await Role.find({ _id: { $in: roleIds } }).select('name userType').lean();
    }
  }

  let businessOrg = null;
  let eligibility = null;
  if (person.organization) {
    businessOrg = await loadBusinessOrganization(person.organization);
    if (businessOrg) {
      const tenantSettings = await loadTenantModuleSettings(tenantOrganizationId);
      eligibility = resolvePortalEligibility(businessOrg, tenantSettings);
    }
  }

  return {
    peopleId: person._id,
    portalAccess: person.portalAccess || { enabled: false },
    usage: await getExternalUserUsage(tenantOrganizationId),
    person: {
      email: person.email,
      first_name: person.first_name,
      last_name: person.last_name,
      organization: person.organization
    },
    user: user
      ? {
          _id: user._id,
          email: user.email,
          status: user.status,
          lastLogin: user.lastLogin,
          defaultExternalRoleId: user.defaultExternalRoleId,
          externalRoleAssignments: user.externalRoleAssignments
        }
      : null,
    roles,
    availableExternalRoles,
    eligibility,
    businessOrganization: businessOrg
      ? { _id: businessOrg._id, name: businessOrg.name, types: businessOrg.types }
      : null
  };
}

/**
 * @param {object} params
 * @param {string} params.peopleId
 * @param {string} params.tenantOrganizationId
 * @param {string[]} params.roleIds
 * @param {object} params.adminUser
 * @param {object} [params.reqMeta] - ip, userAgent
 */
async function enablePortalAccess(params) {
  const { peopleId, tenantOrganizationId, roleIds, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);
  await ensureExternalPortalRolesForOrganization(tenantOrganizationId, tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  const wasEnabled = person.portalAccess?.enabled === true;
  const email = normalizeEmail(person.email);
  if (!email) {
    throw serviceError('PORTAL_EMAIL_REQUIRED', 'Person must have an email before portal access can be enabled');
  }

  if (!person.organization) {
    throw serviceError('PORTAL_ORG_REQUIRED', 'Person must be linked to a business organization');
  }

  const businessOrg = await loadBusinessOrganization(person.organization);
  if (!businessOrg) {
    throw serviceError('PORTAL_ORG_NOT_FOUND', 'Linked business organization not found', 404);
  }

  const tenantSettings = await loadTenantModuleSettings(tenantOrganizationId);
  const eligibility = resolvePortalEligibility(businessOrg, tenantSettings);
  if (!eligibility.eligible) {
    throw serviceError(
      eligibility.reason || 'PORTAL_ORG_INELIGIBLE',
      'Business organization is not eligible for portal access',
      400
    );
  }

  const roles = await validateExternalRoleIds(roleIds, tenantOrganizationId);
  const ScopedUser = await getScopedUserModel(tenantOrg);

  let user = null;
  const existingUserId = person.portalAccess?.userId;
  if (existingUserId) {
    user = await ScopedUser.findById(existingUserId);
  }
  if (!user) {
    user = await ScopedUser.findOne({ organizationId: tenantOrganizationId, peopleId: person._id });
  }

  await assertEmailAvailableForPortal({
    tenantOrganizationId,
    email,
    excludeUserId: user?._id
  });

  const username = email.split('@')[0];
  const assignments = buildRoleAssignments(
    roles.map((r) => r._id),
    adminUser._id,
    user?.externalRoleAssignments || []
  );

  if (!user) {
    const placeholderPassword = await bcrypt.hash(generateSecurePassword(32), 10);
    user = await ScopedUser.create({
      organizationId: tenantOrganizationId,
      peopleId: person._id,
      username,
      email,
      password: placeholderPassword,
      firstName: person.first_name || '',
      lastName: person.last_name || '',
      userType: 'EXTERNAL',
      status: 'active',
      roleId: null,
      externalRoleAssignments: assignments,
      invitedBy: adminUser._id,
      invitedAt: new Date()
    });
  } else {
    user.peopleId = person._id;
    user.username = username;
    user.email = email;
    user.firstName = person.first_name || user.firstName || '';
    user.lastName = person.last_name || user.lastName || '';
    user.userType = 'EXTERNAL';
    user.roleId = null;
    user.externalRoleAssignments = assignments;
    user.status = 'active';
    user.set('permissions', {});
    user.appAccess = [];
    user.allowedApps = [];
  }

  const { tempPassword } = await issuePortalCredentials(user, { incrementInviteVersion: true });
  await user.save();
  await syncUserDirectoryEntry({ user, tenantOrganization: tenantOrg });

  const now = new Date();
  await People.updateOne(
    { _id: person._id, organizationId: tenantOrganizationId },
    {
      $set: {
        'portalAccess.enabled': true,
        'portalAccess.userId': user._id,
        'portalAccess.enabledAt': person.portalAccess?.enabledAt || now,
        'portalAccess.enabledBy': person.portalAccess?.enabledBy || adminUser._id,
        'portalAccess.disabledAt': null,
        'portalAccess.disabledBy': null,
        'portalAccess.lastSyncedAt': now
      }
    }
  );

  const inviteResult = await sendPortalInviteForUser({
    user,
    tenantOrganization: tenantOrg,
    inviter: adminUser,
    tempPassword
  });

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_enabled',
    description: 'Portal access enabled',
    userId: user._id,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    userAgent: reqMeta.userAgent || null,
    metadata: { roleIds: roles.map((r) => String(r._id)) }
  });

  if (inviteResult.sent) {
    await recordPortalEvent({
      organizationId: tenantOrganizationId,
      type: 'portal_invite_sent',
      description: 'Portal invitation email sent',
      userId: user._id,
      peopleId: person._id,
      actorUserId: adminUser._id,
      ipAddress: reqMeta.ip || null,
      metadata: { inviteVersion: user.portalInvite?.inviteVersion }
    });
  }

  if (!wasEnabled) {
    await incrementActiveExternalUsers(tenantOrganizationId);
  }

  try {
    const {
      reconcileCommercialBillingAfterMutation,
    } = require('./commercial/reconcileCommercialSubscription');
    await reconcileCommercialBillingAfterMutation({
      organizationId: tenantOrganizationId,
      initiatedByUserId: adminUser?._id || null,
    });
  } catch (reconcileErr) {
    console.warn('[portalAccess] commercial reconcile after enable failed:', reconcileErr.message);
  }

  return {
    ok: true,
    peopleId: person._id,
    userId: user._id,
    invite: inviteResult,
    roles: roles.map((r) => ({ _id: r._id, name: r.name }))
  };
}

async function disablePortalAccess(params) {
  const { peopleId, tenantOrganizationId, adminUser, reqMeta = {}, reason = 'admin_disabled' } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.enabled) {
    return { ok: true, alreadyDisabled: true };
  }

  const now = new Date();
  if (person.portalAccess?.userId) {
    const ScopedUser = await getScopedUserModel(tenantOrg);
    const user = await ScopedUser.findById(person.portalAccess.userId);
    if (user) {
      user.status = 'inactive';
      await revokeAllUserSessions(user, tenantOrganizationId);
      await user.save();
    } else {
      await ScopedUser.updateOne(
        { _id: person.portalAccess.userId, organizationId: tenantOrganizationId },
        { $set: { status: 'inactive' } }
      );
    }
  }

  await People.updateOne(
    { _id: person._id, organizationId: tenantOrganizationId },
    {
      $set: {
        'portalAccess.enabled': false,
        'portalAccess.disabledAt': now,
        'portalAccess.disabledBy': adminUser._id,
        'portalAccess.lastSyncedAt': now
      }
    }
  );

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_disabled',
    description: 'Portal access disabled',
    userId: person.portalAccess?.userId || null,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    metadata: { reason }
  });

  await decrementActiveExternalUsers(tenantOrganizationId);

  try {
    const {
      reconcileCommercialBillingAfterMutation,
    } = require('./commercial/reconcileCommercialSubscription');
    await reconcileCommercialBillingAfterMutation({
      organizationId: tenantOrganizationId,
      initiatedByUserId: adminUser?._id || null,
    });
  } catch (reconcileErr) {
    console.warn('[portalAccess] commercial reconcile after disable failed:', reconcileErr.message);
  }

  return { ok: true, peopleId: person._id };
}

async function assignPortalRoles(params) {
  const { peopleId, tenantOrganizationId, roleIds, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.enabled || !person.portalAccess?.userId) {
    throw serviceError('PORTAL_NOT_ENABLED', 'Portal access is not enabled for this person', 400);
  }

  const roles = await validateExternalRoleIds(roleIds, tenantOrganizationId);
  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(person.portalAccess.userId);
  if (!user) {
    throw serviceError('PORTAL_USER_NOT_FOUND', 'Linked portal user not found', 404);
  }

  user.externalRoleAssignments = buildRoleAssignments(
    roles.map((r) => r._id),
    adminUser._id,
    user.externalRoleAssignments || []
  );
  await user.save();

  for (const role of roles) {
    await recordPortalEvent({
      organizationId: tenantOrganizationId,
      type: 'portal_role_assigned',
      description: `Portal role assigned: ${role.name}`,
      userId: user._id,
      peopleId: person._id,
      actorUserId: adminUser._id,
      ipAddress: reqMeta.ip || null,
      metadata: { roleId: String(role._id), roleName: role.name }
    });
  }

  return { ok: true, roles: roles.map((r) => ({ _id: r._id, name: r.name })) };
}

async function removePortalRole(params) {
  const { peopleId, tenantOrganizationId, roleId, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.enabled || !person.portalAccess?.userId) {
    throw serviceError('PORTAL_NOT_ENABLED', 'Portal access is not enabled for this person', 400);
  }

  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(person.portalAccess.userId);
  if (!user) {
    throw serviceError('PORTAL_USER_NOT_FOUND', 'Linked portal user not found', 404);
  }

  const now = new Date();
  let removed = false;
  user.externalRoleAssignments = (user.externalRoleAssignments || []).map((assignment) => {
    const plain = assignment?.toObject ? assignment.toObject() : { ...assignment };
    if (String(plain.roleId) !== String(roleId) || plain.status !== 'ACTIVE') {
      return plain;
    }
    removed = true;
    return {
      ...plain,
      status: 'INACTIVE',
      removedAt: now,
      removedBy: adminUser._id
    };
  });

  if (!removed) {
    throw serviceError('PORTAL_ROLE_NOT_ASSIGNED', 'Role is not assigned to this portal user', 404);
  }

  const activeRoles = user.externalRoleAssignments.filter((a) => a.status === 'ACTIVE');
  if (activeRoles.length === 0) {
    user.status = 'inactive';
    await revokeAllUserSessions(user, tenantOrganizationId);
    await People.updateOne(
      { _id: person._id, organizationId: tenantOrganizationId },
      {
        $set: {
          'portalAccess.enabled': false,
          'portalAccess.disabledAt': now,
          'portalAccess.disabledBy': adminUser._id,
          'portalAccess.lastSyncedAt': now
        }
      }
    );
    await decrementActiveExternalUsers(tenantOrganizationId);
  }

  await user.save();

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_role_removed',
    description: 'Portal role removed',
    userId: user._id,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    metadata: { roleId: String(roleId), lastRoleRemoved: activeRoles.length === 0 }
  });

  return { ok: true, activeRoleCount: activeRoles.length };
}

async function resendPortalInvite(params) {
  const { peopleId, tenantOrganizationId, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.enabled || !person.portalAccess?.userId) {
    throw serviceError('PORTAL_NOT_ENABLED', 'Portal access is not enabled for this person', 400);
  }

  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(person.portalAccess.userId);
  if (!user) {
    throw serviceError('PORTAL_USER_NOT_FOUND', 'Linked portal user not found', 404);
  }

  const { tempPassword } = await issuePortalCredentials(user, { incrementInviteVersion: true });
  await revokeAllUserSessions(user, tenantOrganizationId);
  await user.save();

  const inviteResult = await sendPortalInviteForUser({
    user,
    tenantOrganization: tenantOrg,
    inviter: adminUser,
    tempPassword
  });

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_invite_sent',
    description: 'Portal invitation resent',
    userId: user._id,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    metadata: { inviteVersion: user.portalInvite?.inviteVersion, resent: true }
  });

  return { ok: true, invite: inviteResult };
}

async function resetPortalPassword(params) {
  const { peopleId, tenantOrganizationId, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.enabled || !person.portalAccess?.userId) {
    throw serviceError('PORTAL_NOT_ENABLED', 'Portal access is not enabled for this person', 400);
  }

  const ScopedUser = await getScopedUserModel(tenantOrg);
  const user = await ScopedUser.findById(person.portalAccess.userId);
  if (!user) {
    throw serviceError('PORTAL_USER_NOT_FOUND', 'Linked portal user not found', 404);
  }

  const { tempPassword } = await issuePortalCredentials(user, { incrementInviteVersion: true });
  await revokeAllUserSessions(user, tenantOrganizationId);
  await user.save();

  const inviteResult = await sendPortalInviteForUser({
    user,
    tenantOrganization: tenantOrg,
    inviter: adminUser,
    tempPassword
  });

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_password_reset',
    description: 'Portal password reset by administrator',
    userId: user._id,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    metadata: { inviteVersion: user.portalInvite?.inviteVersion }
  });

  return { ok: true, invite: inviteResult };
}

async function terminatePortalSessions(params) {
  const { peopleId, tenantOrganizationId, adminUser, reqMeta = {} } = params;

  const tenantOrg = await loadTenantOrganization(tenantOrganizationId);
  await assertPortalFrameworkEnabled(tenantOrg);

  const person = await loadPersonForPortal(peopleId, tenantOrganizationId);
  if (!person.portalAccess?.userId) {
    throw serviceError('PORTAL_NOT_ENABLED', 'Portal access is not enabled for this person', 400);
  }

  const revokeResult = await revokeUserSessionsByUserId(
    person.portalAccess.userId,
    tenantOrganizationId,
    tenantOrg
  );

  await recordPortalEvent({
    organizationId: tenantOrganizationId,
    type: 'portal_sessions_terminated',
    description: 'Portal sessions terminated by administrator',
    userId: person.portalAccess.userId,
    peopleId: person._id,
    actorUserId: adminUser._id,
    ipAddress: reqMeta.ip || null,
    metadata: {
      revoked: revokeResult.revoked === true,
      authSessionVersion: revokeResult.authSessionVersion ?? null
    }
  });

  return {
    ok: true,
    revoked: revokeResult.revoked === true,
    authSessionVersion: revokeResult.authSessionVersion ?? null
  };
}

async function listPortalAuditEvents(params) {
  const { peopleId, tenantOrganizationId, eventType, limit = 50 } = params;

  await loadPersonForPortal(peopleId, tenantOrganizationId);

  const query = {
    organizationId: tenantOrganizationId,
    peopleId
  };
  if (eventType) {
    query.type = eventType;
  }

  const events = await SecurityEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();

  return { ok: true, events };
}

/**
 * Re-evaluate portal access for all People linked to a business organization.
 */
async function syncFromOrganizationChange(businessOrganizationId, options = {}) {
  const businessOrg = await loadBusinessOrganization(businessOrganizationId);
  if (!businessOrg) {
    return { ok: false, reason: 'ORG_NOT_FOUND' };
  }

  const people = await People.find({
    organization: businessOrganizationId,
    'portalAccess.enabled': true,
    deletedAt: null
  })
    .select('_id organizationId portalAccess organization')
    .lean();

  if (!people.length) {
    return { ok: true, synced: 0, disabled: 0 };
  }

  const tenantOrganizationId = people[0].organizationId;
  const tenantSettings = await loadTenantModuleSettings(tenantOrganizationId);
  const eligibility = resolvePortalEligibility(businessOrg, tenantSettings);
  const now = new Date();

  let disabled = 0;
  if (!eligibility.eligible) {
    for (const person of people) {
      await disablePortalAccess({
        peopleId: person._id,
        tenantOrganizationId: person.organizationId,
        adminUser: options.adminUser || { _id: null },
        reqMeta: options.reqMeta || {},
        reason: eligibility.reason || 'org_ineligible'
      });
      disabled += 1;
    }
  } else {
    await People.updateMany(
      { organization: businessOrganizationId, 'portalAccess.enabled': true },
      { $set: { 'portalAccess.lastSyncedAt': now } }
    );
  }

  return { ok: true, synced: people.length, disabled, eligibility };
}

module.exports = {
  getPortalState,
  enablePortalAccess,
  disablePortalAccess,
  assignPortalRoles,
  removePortalRole,
  resendPortalInvite,
  resetPortalPassword,
  terminatePortalSessions,
  listPortalAuditEvents,
  syncFromOrganizationChange,
  loadTenantModuleSettings,
  validateExternalRoleIds
};
