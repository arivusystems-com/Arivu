/**
 * RBAC v2 — seed system profiles + SALES-first role hierarchy for a tenant.
 */

const Profile = require('../models/Profile');
const Role = require('../models/Role');
const { SYSTEM_PROFILE_DEFINITIONS } = require('./profileMatrixBuilders');
const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');
const { buildAppEntitlementsForOrg } = require('./roleEntitlementService');
const {
  isAppEnabledForOrg,
  validateAppRole,
  getDefaultRoleForApp
} = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');

const PRIVILEGED_FLAGS = {
  canViewAllData: false,
  canManageTeam: false,
  canExportData: false
};

async function seedSystemProfiles(organizationId, ProfileModel = Profile) {
  const created = [];
  const existing = await ProfileModel.find({ organizationId }).select('profileKey name').lean();
  const existingKeys = new Set(existing.map((p) => p.profileKey).filter(Boolean));

  for (const def of SYSTEM_PROFILE_DEFINITIONS) {
    if (existingKeys.has(def.profileKey)) continue;
    const payload = typeof def.permissions === 'function' ? def.permissions() : def.permissions;
    const permissions = payload?.permissions ?? payload;
    const appPermissions = payload?.appPermissions;
    const doc = await ProfileModel.create({
      organizationId,
      profileKey: def.profileKey,
      name: def.name,
      description: def.description,
      isSystemProfile: def.isSystemProfile,
      permissions,
      ...(appPermissions ? { appPermissions } : {})
    });
    created.push(doc);
  }

  return { created, skipped: existing.length };
}

async function syncSystemProfilePermissions(organizationId, ProfileModel = Profile) {
  let updated = 0;
  for (const def of SYSTEM_PROFILE_DEFINITIONS) {
    if (!def.isSystemProfile || !def.profileKey) continue;
    const payload = typeof def.permissions === 'function' ? def.permissions() : def.permissions;
    const permissions = payload?.permissions ?? payload;
    const appPermissions = payload?.appPermissions;
    const result = await ProfileModel.updateOne(
      {
        organizationId,
        profileKey: def.profileKey,
        updatedBy: { $in: [null, undefined] }
      },
      {
        $set: {
          permissions,
          ...(appPermissions ? { appPermissions } : {})
        }
      }
    );
    if (result.modifiedCount) updated += 1;
  }
  return { updated };
}

/**
 * Portal system profiles always track code defaults (Support/Help/Documents).
 * Bypasses updatedBy so existing tenants pick up matrix changes.
 */
async function forceSyncPortalSystemProfiles(organizationId, ProfileModel = Profile) {
  const portalKeys = new Set([
    SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER,
    SYSTEM_PROFILE_KEYS.PORTAL_VIEWER
  ]);
  let updated = 0;
  for (const def of SYSTEM_PROFILE_DEFINITIONS) {
    if (!portalKeys.has(def.profileKey)) continue;
    const payload = typeof def.permissions === 'function' ? def.permissions() : def.permissions;
    const permissions = payload?.permissions ?? payload;
    const appPermissions = payload?.appPermissions;
    const result = await ProfileModel.updateOne(
      {
        organizationId,
        profileKey: def.profileKey,
        isSystemProfile: true
      },
      {
        $set: {
          description: def.description,
          permissions,
          ...(appPermissions ? { appPermissions } : {}),
          updatedBy: null
        }
      }
    );
    if (result.modifiedCount || result.matchedCount) updated += 1;
  }
  return { updated };
}

async function getProfileIdByKey(organizationId, profileKey, ProfileModel = Profile) {
  const p = await ProfileModel.findOne({ organizationId, profileKey }).select('_id').lean();
  return p?._id || null;
}

function resolveAppRoleKeyForEntitlement(appKey, preferredRoleKey) {
  const normalizedAppKey = String(appKey || '').toUpperCase();
  const preferred = String(preferredRoleKey || '').toUpperCase();
  if (preferred && validateAppRole(normalizedAppKey, preferred)) {
    return preferred;
  }
  return getDefaultRoleForApp(normalizedAppKey) || preferred || 'USER';
}

function buildEntitlementsAllApps(organization, appRoleKey, seatConsuming = true) {
  const entitlements = [];
  const apps = organization?.enabledApps || [];
  for (const entry of apps) {
    const appKey = typeof entry === 'string' ? entry : entry?.appKey;
    const status = typeof entry === 'object' ? String(entry.status || 'ACTIVE') : 'ACTIVE';
    if (!appKey || status.toUpperCase() !== 'ACTIVE') continue;
    if (!isAppEnabledForOrg(organization, appKey)) continue;
    entitlements.push({
      appKey: String(appKey).toUpperCase(),
      enabled: true,
      seatConsuming,
      appRoleKey: resolveAppRoleKeyForEntitlement(appKey, appRoleKey)
    });
  }
  if (entitlements.length === 0 && isAppEnabledForOrg(organization, APP_KEYS.SALES)) {
    entitlements.push({
      appKey: APP_KEYS.SALES,
      enabled: true,
      seatConsuming,
      appRoleKey: resolveAppRoleKeyForEntitlement(APP_KEYS.SALES, appRoleKey)
    });
  }
  return entitlements;
}

/**
 * Ensure Owner / Administrator system roles include entitlement for a newly enabled app.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} appKey
 */
async function syncPrivilegedRoleEntitlementsForApp(organizationId, appKey, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const normalizedAppKey = String(appKey || '').trim().toUpperCase();
  if (!organizationId || !normalizedAppKey) return { updated: 0 };

  const privilegedRoles = await RoleModel.find({
    organizationId,
    isSystemRole: true,
    name: { $in: ['Owner', 'Administrator'] }
  });

  let updated = 0;
  for (const role of privilegedRoles) {
    const entitlements = Array.isArray(role.appEntitlements) ? [...role.appEntitlements] : [];
    const alreadyPresent = entitlements.some(
      (entry) => String(entry?.appKey || '').toUpperCase() === normalizedAppKey && entry?.enabled !== false
    );
    if (alreadyPresent) continue;

    entitlements.push({
      appKey: normalizedAppKey,
      enabled: true,
      seatConsuming: role.name !== 'Owner',
      appRoleKey: resolveAppRoleKeyForEntitlement(normalizedAppKey, 'ADMIN')
    });
    role.appEntitlements = entitlements;
    await role.save();
    updated += 1;
  }

  return { updated };
}

/**
 * Persist ACTIVE appAccess for Owner / Administrator users when an INTERNAL app is enabled.
 * Runtime privileged envelope already allows access; seats + commercial billing use appAccess.
 *
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} appKey
 * @param {{ organization?: object, UserModel?: object, RoleModel?: object, initiatedByUserId?: string|null }} [options]
 */
async function syncPrivilegedUsersAppAccessForApp(organizationId, appKey, options = {}) {
  const normalizedAppKey = String(appKey || '').trim().toUpperCase();
  if (!organizationId || !normalizedAppKey) return { updated: 0, userIds: [] };

  const { getAppConfig } = require('../utils/appAccessUtils');
  const appConfig = getAppConfig(normalizedAppKey);
  if (!appConfig) return { updated: 0, userIds: [], reason: 'unknown_app' };
  if (!Array.isArray(appConfig.userTypesAllowed) || !appConfig.userTypesAllowed.some((t) => {
    const u = String(t || '').toUpperCase();
    return u === 'INTERNAL' || u === 'STANDARD' || u === 'ADMIN';
  })) {
    return { updated: 0, userIds: [], reason: 'not_internal_app' };
  }

  const Organization = require('../models/Organization');
  const organization =
    options.organization
    || (await Organization.findById(organizationId).lean())
    || null;
  if (!organization || !isAppEnabledForOrg(organization, normalizedAppKey)) {
    return { updated: 0, userIds: [], reason: 'app_not_enabled' };
  }

  let UserModel = options.UserModel;
  if (!UserModel) {
    try {
      const { getScopedUserModel } = require('./userInviteService');
      UserModel = await getScopedUserModel(organization);
    } catch {
      UserModel = require('../models/User');
    }
  }
  const RoleModel = options.RoleModel || Role;

  const privilegedRoles = await RoleModel.find({
    organizationId,
    isSystemRole: true,
    name: { $in: ['Owner', 'Administrator'] },
  })
    .select('_id')
    .lean();
  const privilegedRoleIds = privilegedRoles.map((r) => r._id);

  const users = await UserModel.find({
    organizationId,
    status: { $in: ['active', 'invited'] },
    $or: [
      { isOwner: true },
      ...(privilegedRoleIds.length ? [{ roleId: { $in: privilegedRoleIds } }] : []),
    ],
  });

  const roleKey = resolveAppRoleKeyForEntitlement(normalizedAppKey, 'ADMIN');
  const { incrementSeat } = require('../utils/subscriptionUtils');
  const {
    syncCommercialBillingAfterAppAccessChange,
  } = require('./commercial/userLifecycleBillingSync');

  const userIds = [];
  let updated = 0;

  for (const user of users) {
    const userType = String(user.userType || 'INTERNAL').toUpperCase();
    if (userType === 'EXTERNAL' || userType === 'PORTAL') continue;

    // Plain-clone mongoose subdocs — object spread drops appKey/status and corrupts seats.
    const access = (Array.isArray(user.appAccess) ? user.appAccess : []).map((entry) => {
      const plain = entry && typeof entry.toObject === 'function'
        ? entry.toObject()
        : { ...(entry || {}) };
      return {
        appKey: String(plain.appKey || '').toUpperCase(),
        roleKey: plain.roleKey || undefined,
        status: String(plain.status || 'ACTIVE').toUpperCase(),
        addedAt: plain.addedAt || undefined,
      };
    });
    const previousActiveAppKeys = access
      .filter((entry) => entry.status === 'ACTIVE' && entry.appKey)
      .map((entry) => entry.appKey);

    const idx = access.findIndex((entry) => entry.appKey === normalizedAppKey);
    let changed = false;
    if (idx >= 0) {
      const entry = { ...access[idx], appKey: normalizedAppKey };
      if (entry.status !== 'ACTIVE') {
        entry.status = 'ACTIVE';
        changed = true;
      }
      if (!entry.roleKey) {
        entry.roleKey = roleKey;
        changed = true;
      }
      access[idx] = entry;
    } else {
      access.push({
        appKey: normalizedAppKey,
        roleKey,
        status: 'ACTIVE',
        addedAt: new Date(),
      });
      changed = true;
    }

    if (!changed) continue;

    user.appAccess = access;
    const allowed = new Set(
      (Array.isArray(user.allowedApps) ? user.allowedApps : []).map((k) => String(k).toUpperCase())
    );
    allowed.add(normalizedAppKey);
    user.allowedApps = [...allowed];
    await user.save();

    try {
      await incrementSeat(organizationId, normalizedAppKey);
    } catch (seatErr) {
      console.warn('[syncPrivilegedUsersAppAccessForApp] seat increment failed:', seatErr.message);
    }

    const nextActiveAppKeys = access
      .filter((entry) => entry.status === 'ACTIVE' && entry.appKey)
      .map((entry) => entry.appKey);

    try {
      await syncCommercialBillingAfterAppAccessChange({
        organizationId,
        userId: user._id,
        previousActiveAppKeys,
        nextActiveAppKeys,
        initiatedByUserId: options.initiatedByUserId || null,
      });
    } catch (billingErr) {
      console.warn('[syncPrivilegedUsersAppAccessForApp] commercial sync failed:', billingErr.message);
    }

    updated += 1;
    userIds.push(String(user._id));
  }

  return { updated, userIds };
}

/**
 * Seed Owner, Administrator, Sales Manager, Sales Executive for organization.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object} organization — full or partial org with enabledApps
 */
async function seedRolesAndProfilesForOrganization(organizationId, organization, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const ProfileModel = options.ProfileModel || Profile;
  const orgId = organizationId;
  const hasStaffHierarchy = await RoleModel.exists({
    organizationId: orgId,
    name: { $in: ['Owner', 'Administrator'] },
  });
  if (hasStaffHierarchy) {
    return { profiles: { created: [], skipped: 0 }, roles: { created: [], skipped: 1 } };
  }

  const profileResult = await seedSystemProfiles(orgId, ProfileModel);
  const platformProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.PLATFORM_FULL, ProfileModel);
  const managerProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.SALES_MANAGER, ProfileModel);
  const standardProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.SALES_STANDARD, ProfileModel);

  const rolesToCreate = [
    {
      organizationId: orgId,
      name: 'Owner',
      description: 'Full system access with all permissions',
      isSystemRole: true,
      isTemplateSeed: false,
      level: 0,
      parentRole: null,
      userType: 'ADMIN',
      privilegeMode: 'profile',
      profileId: platformProfileId,
      appEntitlements: buildEntitlementsAllApps(organization, 'ADMIN', false),
      color: '#9333ea',
      icon: 'crown',
      ...PRIVILEGED_FLAGS
    },
    {
      organizationId: orgId,
      name: 'Administrator',
      description: 'Full administrative access with all permissions',
      isSystemRole: true,
      isTemplateSeed: false,
      level: 1,
      parentRole: null,
      userType: 'ADMIN',
      privilegeMode: 'profile',
      profileId: platformProfileId,
      appEntitlements: buildEntitlementsAllApps(organization, 'ADMIN', true),
      color: '#ef4444',
      icon: 'shield',
      ...PRIVILEGED_FLAGS
    },
    {
      organizationId: orgId,
      name: 'Sales Manager',
      description: 'Sales team lead with team-level access',
      isSystemRole: false,
      isTemplateSeed: true,
      level: 2,
      parentRole: null,
      userType: 'STANDARD',
      privilegeMode: 'profile',
      profileId: managerProfileId,
      appEntitlements: buildAppEntitlementsForOrg(organization, { salesRoleKey: 'MANAGER' }),
      color: '#3b82f6',
      icon: 'users',
      canViewAllData: false,
      canManageTeam: false,
      canExportData: false
    },
    {
      organizationId: orgId,
      name: 'Sales Executive',
      description: 'Sales representative with own record access',
      isSystemRole: false,
      isTemplateSeed: true,
      level: 3,
      parentRole: null,
      userType: 'STANDARD',
      privilegeMode: 'profile',
      profileId: standardProfileId,
      appEntitlements: buildAppEntitlementsForOrg(organization, { salesRoleKey: 'USER' }),
      color: '#10b981',
      icon: 'user',
      canViewAllData: false,
      canManageTeam: false,
      canExportData: false
    }
  ];

  const inserted = await RoleModel.insertMany(rolesToCreate);

  const ownerRole = inserted.find((r) => r.name === 'Owner');
  const adminRole = inserted.find((r) => r.name === 'Administrator');
  const managerRole = inserted.find((r) => r.name === 'Sales Manager');
  const executiveRole = inserted.find((r) => r.name === 'Sales Executive');

  if (adminRole && ownerRole) {
    adminRole.parentRole = ownerRole._id;
    adminRole.level = 1;
    await adminRole.save();
  }
  if (managerRole && adminRole) {
    managerRole.parentRole = adminRole._id;
    managerRole.level = 2;
    await managerRole.save();
  }
  if (executiveRole && managerRole) {
    executiveRole.parentRole = managerRole._id;
    executiveRole.level = 3;
    await executiveRole.save();
  }

  let sharingResult = null;
  const { isSharingV1Enabled } = require('../utils/rbacFeatureFlags');
  if (isSharingV1Enabled(organization)) {
    const { seedSharingDefaultsForOrganization } = require('./sharingSeedService');
    sharingResult = await seedSharingDefaultsForOrganization(orgId, organization);
  }

  return {
    profiles: profileResult,
    roles: { created: inserted, skipped: 0 },
    roleIds: {
      owner: ownerRole?._id,
      administrator: adminRole?._id,
      salesManager: managerRole?._id,
      salesExecutive: executiveRole?._id
    },
    sharing: sharingResult
  };
}

module.exports = {
  seedSystemProfiles,
  syncSystemProfilePermissions,
  forceSyncPortalSystemProfiles,
  seedRolesAndProfilesForOrganization,
  getProfileIdByKey,
  buildEntitlementsAllApps,
  resolveAppRoleKeyForEntitlement,
  syncPrivilegedRoleEntitlementsForApp,
  syncPrivilegedUsersAppAccessForApp,
};
