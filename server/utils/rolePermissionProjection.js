/**
 * =============================================================================
 * Effective CRM permissions — architecture
 * =============================================================================
 *
 * Source of truth:
 *   • Role.permissions + Role flags (canViewAllData, etc.) — SALES/CRM module matrix
 *   • user.appAccess — which apps the user is entitled to (HELPDESK cases*, seat roles)
 *
 * user.permissions (persisted on User) is a denormalized cache for exports/listing;
 * authoritative values for a session are always rebuilt via materializeEffectiveCRMEnvelopeOnUser().
 *
 * There is no supported per-user arbitrary permission override API; changes go through Role
 * or appAccess. (Legacy body.permissions on PUT /users/:id is ignored.)
 * =============================================================================
 */

const mongoose = require('mongoose');
const {
  isPrivilegedSystemRole,
  isTenantPrivilegedUser
} = require('./tenantPrivilegedAccess');
const { APP_KEYS } = require('../constants/appKeys');
const { COMMERCIAL_PLATFORM_MODULE_KEYS } = require('../constants/commercialPlatformParticipation');

/** Platform core quote-to-cash modules — same sidebar/RBAC surface as deals/items. */
const COMMERCIAL_CORE_MODULE_KEYS = COMMERCIAL_PLATFORM_MODULE_KEYS;

const COMMERCIAL_CRUD_DEFAULTS = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  viewAll: false,
  exportData: false
};

function toPlain(permsOrSub) {
  if (!permsOrSub) return {};
  if (typeof permsOrSub.toObject === 'function') return permsOrSub.toObject();
  return permsOrSub;
}

function userPermissionsEnvelopeToPlain(user) {
  const runtimeEnvelope = user?._permissionRuntime?.envelope;
  if (runtimeEnvelope && typeof runtimeEnvelope === 'object') {
    const plain =
      typeof runtimeEnvelope.toObject === 'function'
        ? runtimeEnvelope.toObject()
        : { ...runtimeEnvelope };
    ensurePermissionEnvelopeDefaults(plain);
    return plain;
  }

  const p = user?.permissions;
  if (!p || typeof p !== 'object') return {};
  const plain = typeof p.toObject === 'function' ? p.toObject() : { ...p };
  ensurePermissionEnvelopeDefaults(plain);
  return plain;
}

function finalizeUserPermissionEnvelope(user) {
  const plain = userPermissionsEnvelopeToPlain(user);
  ensurePermissionEnvelopeDefaults(plain);
  user.permissions = plain;
}

/** viewAll semantics: explicit module flag / scope=all, or role-level "Can view all data". */
function viewAllForModule(mod, rolePlain) {
  const m = toPlain(mod);
  if (rolePlain.canViewAllData === true) return true;
  return m.scope === 'all' || m.viewAll === true;
}

/**
 * Project legacy Role.permissions CRUD matrix into envelope shape.
 * Commercial core modules inherit from `deals` when not explicitly configured on the role.
 */
function projectCrudFromLegacyRole(rolePerms, rolePlain, moduleKey, inheritFromKey = 'deals') {
  const src = rolePerms[moduleKey] || rolePerms[inheritFromKey] || {};
  return {
    view: src.read === true,
    create: src.create === true,
    edit: src.update === true,
    delete: src.delete === true,
    viewAll: viewAllForModule(src, rolePlain),
    exportData: src.export === true
  };
}

/** Mirror deals envelope onto platform quote-to-cash core modules (setPermissionsByRole path). */
function attachCommercialCoreModulesFromDeals(permissions) {
  if (!permissions || typeof permissions !== 'object' || !permissions.deals) {
    return permissions;
  }
  const deals = permissions.deals;
  const commercial = {};
  for (const moduleKey of COMMERCIAL_CORE_MODULE_KEYS) {
    commercial[moduleKey] = { ...deals };
  }
  return { ...permissions, ...commercial };
}

/**
 * Helpdesk/cases matrix from app seat assignments (not Role.permissions).
 * @param {object[]} appAccess
 */
function buildCasesEnvelopeFromAppAccess(appAccess = []) {
  const access = Array.isArray(appAccess) ? appAccess : [];
  return {
    view: access.some((entry) => entry.appKey === APP_KEYS.HELPDESK),
    create: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey !== 'VIEWER'
    ),
    edit: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey !== 'VIEWER'
    ),
    delete: access.some(
      (entry) => entry.appKey === APP_KEYS.HELPDESK && entry.status === 'ACTIVE' && entry.roleKey === 'ADMIN'
    ),
    viewAll: access.some(
      (entry) =>
        entry.appKey === APP_KEYS.HELPDESK &&
        entry.status === 'ACTIVE' &&
        ['ADMIN', 'MANAGER', 'AGENT'].includes(entry.roleKey)
    )
  };
}

/**
 * @param {object} rolePlain - lean Role doc (must include permissions, name, flags)
 * @param {object[]} appAccess - user.appAccess (for HELPDESK cases*)
 * @returns {object} Full User.permissions-compatible object (+ people mirror)
 */
function projectRoleToUserPermissions(rolePlain, appAccess = []) {
  const p = toPlain(rolePlain.permissions);
  const access = Array.isArray(appAccess) ? appAccess : [];

  const contacts = {
    view: p.contacts?.read === true,
    create: p.contacts?.create === true,
    edit: p.contacts?.update === true,
    delete: p.contacts?.delete === true,
    viewAll: viewAllForModule(p.contacts, rolePlain),
    exportData: p.contacts?.export === true
  };

  const organizations = {
    view: p.organizations?.read === true,
    create: p.organizations?.create === true,
    edit: p.organizations?.update === true,
    delete: p.organizations?.delete === true,
    viewAll: viewAllForModule(p.organizations, rolePlain),
    exportData: p.organizations?.export === true
  };

  const deals = {
    view: p.deals?.read === true,
    create: p.deals?.create === true,
    edit: p.deals?.update === true,
    delete: p.deals?.delete === true,
    viewAll: viewAllForModule(p.deals, rolePlain),
    exportData: p.deals?.export === true
  };

  const projects = {
    view: deals.view,
    create: deals.create,
    edit: deals.edit,
    delete: deals.delete,
    viewAll: deals.viewAll
  };

  const tasks = {
    view: p.tasks?.read === true,
    create: p.tasks?.create === true,
    edit: p.tasks?.update === true,
    delete: p.tasks?.delete === true,
    viewAll: viewAllForModule(p.tasks, rolePlain),
    exportData: p.tasks?.export === true
  };

  const events = {
    view: p.events?.read === true,
    create: p.events?.create === true,
    edit: p.events?.update === true,
    delete: p.events?.delete === true,
    viewAll: viewAllForModule(p.events, rolePlain)
  };

  const forms = {
    view: p.forms?.read === true,
    create: p.forms?.create === true,
    edit: p.forms?.update === true,
    delete: p.forms?.delete === true,
    viewAll: viewAllForModule(p.forms, rolePlain),
    exportData: p.forms?.export === true
  };

  const webforms = {
    view: p.webforms?.read === true,
    create: p.webforms?.create === true,
    edit: p.webforms?.update === true,
    delete: p.webforms?.delete === true,
    viewAll: viewAllForModule(p.webforms, rolePlain),
    exportData: p.webforms?.export === true
  };

  const items = {
    view: p.items?.read === true,
    create: p.items?.create === true,
    edit: p.items?.update === true,
    delete: p.items?.delete === true,
    viewAll: viewAllForModule(p.items, rolePlain),
    exportData: p.items?.export === true
  };

  const imports = {
    view:
      p.contacts?.import === true ||
      p.deals?.import === true ||
      p.organizations?.import === true ||
      p.forms?.import === true ||
      p.items?.import === true ||
      false,
    create: p.contacts?.import === true || p.deals?.import === true || false,
    delete: false
  };

  const documents = {
    view: p.documents?.read === true || p.documents?.view === true,
    create: p.documents?.create === true,
    edit: p.documents?.update === true || p.documents?.edit === true,
    delete: p.documents?.delete === true,
    viewAll: viewAllForModule(p.documents, rolePlain),
    exportData: p.documents?.export === true || p.documents?.exportData === true
  };

  const templates = {
    view: p.templates?.read === true,
    create: p.templates?.create === true,
    edit: p.templates?.update === true,
    delete: p.templates?.delete === true,
    publish: p.templates?.publish === true,
    archive: p.templates?.archive === true,
    render: p.templates?.render === true,
    viewAll: viewAllForModule(p.templates, rolePlain)
  };

  const settings = {
    view: p.settings?.view === true,
    manageUsers:
      (p.users?.create === true) ||
      (p.users?.update === true) ||
      (p.users?.manageRoles === true) ||
      (p.settings?.manageRoles === true) ||
      false,
    manageBilling: p.settings?.manageBilling === true,
    manageIntegrations: false,
    customizeFields: p.settings?.edit === true,
    edit: p.settings?.edit === true
  };

  const perfTargets = p.performance?.targets || {};
  const performance = {
    targets: {
      view: perfTargets.view === true,
      create: perfTargets.create === true,
      edit: perfTargets.edit === true,
      activate: perfTargets.activate === true,
      manageTypes: perfTargets.manageTypes === true,
      manageOrgSettings: perfTargets.manageOrgSettings === true
    }
  };

  const reports = {
    viewStandard: p.reports?.read === true,
    viewCustom: p.reports?.read === true,
    createCustom: p.reports?.create === true,
    exportReports: p.reports?.export === true
  };

  const lc = p.liveChat || {};
  const liveChat = {
    view: lc.view === true,
    reply: lc.reply === true,
    admin: lc.admin === true
  };

  const roleCases = p.cases;
  const hasRoleCasesMatrix =
    roleCases &&
    (roleCases.read === true ||
      roleCases.create === true ||
      roleCases.update === true ||
      roleCases.delete === true);

  const casesModule = hasRoleCasesMatrix
    ? {
        view: roleCases.read === true,
        create: roleCases.create === true,
        edit: roleCases.update === true,
        delete: roleCases.delete === true,
        viewAll: viewAllForModule(roleCases, rolePlain)
      }
    : buildCasesEnvelopeFromAppAccess(access);

  const commercialCore = {};
  for (const moduleKey of COMMERCIAL_CORE_MODULE_KEYS) {
    commercialCore[moduleKey] = projectCrudFromLegacyRole(p, rolePlain, moduleKey);
  }

  const projected = {
    contacts,
    people: { ...contacts },
    organizations,
    deals,
    projects,
    tasks,
    events,
    forms,
    webforms,
    items,
    imports,
    documents,
    templates,
    settings,
    performance,
    reports,
    cases: casesModule,
    liveChat,
    ...commercialCore
  };

  return projected;
}

/**
 * Ensure legacy UI consumers always see every module key present (safe false defaults).
 * @param {object} merged mutable envelope
 */
function ensurePermissionEnvelopeDefaults(merged) {
  if (!merged || typeof merged !== 'object') return;

  if (merged.contacts && !merged.people) merged.people = { ...merged.contacts };

  const ensureModule = (key, template) => {
    if (!merged[key]) merged[key] = { ...template };
  };

  ensureModule('contacts', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('people', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('organizations', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('deals', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  for (const moduleKey of COMMERCIAL_CORE_MODULE_KEYS) {
    ensureModule(moduleKey, { ...COMMERCIAL_CRUD_DEFAULTS });
  }
  ensureModule('tasks', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('events', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('forms', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('webforms', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('items', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('cases', { view: false, create: false, edit: false, delete: false, viewAll: false });
  ensureModule('imports', { view: false, create: false, delete: false });
  ensureModule('documents', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    viewAll: false,
    exportData: false
  });
  ensureModule('templates', {
    view: false,
    create: false,
    edit: false,
    delete: false,
    publish: false,
    archive: false,
    render: false,
    viewAll: false
  });
  ensureModule('settings', {
    view: false,
    edit: false,
    manageUsers: false,
    manageBilling: false,
    manageIntegrations: false,
    customizeFields: false
  });
  ensureModule('reports', {
    viewStandard: false,
    viewCustom: false,
    createCustom: false,
    exportReports: false
  });
  ensureModule('liveChat', { view: false, reply: false, admin: false });
  ensureModule('articles', { view: false, create: false, edit: false, delete: false, publish: false });
  ensureModule('blog', { view: false, create: false, edit: false, delete: false, publish: false });
  ensureModule('projects', { view: false, create: false, edit: false, delete: false, viewAll: false });
}

/** CRM roles that may edit platform-owned fields (elevated tenancy operations). */
function roleAllowsPlatformOwnedFieldEdits(rolePlain) {
  if (!rolePlain) return false;
  const name = String(rolePlain.name || '').trim();
  return name === 'Owner' || name === 'Admin' || name === 'Administrator';
}

/**
 * Derive execution appAccess for Owner / Administrator users under RBAC v2.
 * Merges role entitlements with any enabled org apps missing from the role (e.g. Audit enabled later).
 * @private
 */
function resolvePrivilegedAppAccess(user, organization, roleLean = null) {
  const { deriveAppAccessFromRole } = require('../services/roleEntitlementService');
  const { buildEntitlementsAllApps } = require('../services/roleSeedService');

  if (!organization) {
    return {
      appAccess: Array.isArray(user?.appAccess) ? user.appAccess : [],
      allowedApps: Array.isArray(user?.allowedApps) ? user.allowedApps : []
    };
  }

  const isOwnerRole = user?.isOwner === true || roleLean?.name === 'Owner';
  const seatConsuming = !isOwnerRole;
  const baselineEntitlements = buildEntitlementsAllApps(organization, 'ADMIN', seatConsuming);
  const roleEntitlements = Array.isArray(roleLean?.appEntitlements) ? roleLean.appEntitlements : [];

  if (roleEntitlements.length === 0) {
    return deriveAppAccessFromRole({ appEntitlements: baselineEntitlements }, organization);
  }

  const mergedEntitlements = [...roleEntitlements];
  for (const baseline of baselineEntitlements) {
    const appKey = String(baseline?.appKey || '').toUpperCase();
    const hasActive = mergedEntitlements.some(
      (entry) => String(entry?.appKey || '').toUpperCase() === appKey && entry?.enabled !== false
    );
    if (!hasActive) {
      mergedEntitlements.push(baseline);
    }
  }

  return deriveAppAccessFromRole({ appEntitlements: mergedEntitlements }, organization);
}

/**
 * Materialize full tenant-admin envelope (Owner / Admin system roles and isOwner users).
 * @param {import('mongoose').Document|object} user
 * @param {object|null} [organization]
 * @param {{ roleLean?: object|null }} [options]
 */
async function applyFullPrivilegedEnvelopeToUser(user, organization = null, options = {}) {
  if (!user) return;

  const { materializeRuntimePermissionsOnUser } = require('../services/runtimePermissionResolver');

  if (typeof user.setPermissionsByRole === 'function') {
    user.setPermissionsByRole('owner');
  }
  user._roleAllowsPlatformOwnedFieldEdit = true;
  user._isTenantPrivileged = true;

  let appAccess = user.appAccess;
  const derived = resolvePrivilegedAppAccess(user, organization, options.roleLean || null);
  appAccess = derived.appAccess;
  user.appAccess = derived.appAccess;
  user.allowedApps = derived.allowedApps;

  const plain = userPermissionsEnvelopeToPlain(user);
  plain.cases = { view: true, create: true, edit: true, delete: true, viewAll: true };
  plain.webforms = {
    view: true,
    create: true,
    edit: true,
    delete: true,
    viewAll: true,
    exportData: true
  };
  ensurePermissionEnvelopeDefaults(plain);

  await materializeRuntimePermissionsOnUser(user, {
    roleLean: options.roleLean || null,
    organization,
    appAccess
  });

  user.permissions = plain;
  if (user._permissionRuntime) {
    user._permissionRuntime.envelope = plain;
  }
  delete user.fieldPermissions;
  delete user._fieldPermissionAppKey;
}

/**
 * Applies projection + runtime grants + org guards to req.user / User document.
 * @param {import('mongoose').Document|object} user
 * @param {object|null} roleLean
 * @param {object|null} [organization]
 */
async function applyProjectionToUser(user, roleLean, organization = null) {
  if (!user || !roleLean) return;

  const { resolveRoleLeanWithProfile } = require('../services/roleProfileResolver');
  const effectiveRole = await resolveRoleLeanWithProfile(roleLean, organization);

  if (isPrivilegedSystemRole(effectiveRole)) {
    await applyFullPrivilegedEnvelopeToUser(user, organization, { roleLean: effectiveRole });
    return;
  }

  const { materializeRuntimePermissionsOnUser } = require('../services/runtimePermissionResolver');
  const {
    isRbacV2Enabled,
    withoutLegacyCapabilitiesWhenRbacV2
  } = require('../utils/rbacFeatureFlags');
  const { deriveAppAccessFromRole } = require('../services/roleEntitlementService');

  let appAccess = user.appAccess;
  if (isRbacV2Enabled(organization) && effectiveRole.appEntitlements?.length) {
    const derived = deriveAppAccessFromRole(effectiveRole, organization);
    appAccess = derived.appAccess;
    user.appAccess = derived.appAccess;
    user.allowedApps = derived.allowedApps;
  }

  await materializeRuntimePermissionsOnUser(user, {
    roleLean: effectiveRole,
    organization,
    appAccess
  });

  const { toPlainFieldPermissions } = require('../services/fieldPermissionResolver');
  user.fieldPermissions = toPlainFieldPermissions(
    effectiveRole._fieldPermissions || effectiveRole.fieldPermissions
  );

  const enabledApps = Array.isArray(organization?.enabledApps) ? organization.enabledApps : [];
  const primary =
    enabledApps.find((a) => String(a.appKey || '').toUpperCase() === 'SALES') ||
    enabledApps[0];
  user._fieldPermissionAppKey = primary?.appKey
    ? String(primary.appKey).toUpperCase()
    : 'SALES';

  user._roleAllowsPlatformOwnedFieldEdit = roleAllowsPlatformOwnedFieldEdits(effectiveRole);
  const runtimeRole = withoutLegacyCapabilitiesWhenRbacV2(effectiveRole, organization);
  user._canViewAllData = runtimeRole?.canViewAllData === true;
  user._isTenantPrivileged = false;
}

function resolveExternalRoleIdForSession(user, explicitRoleId) {
  if (explicitRoleId && mongoose.Types.ObjectId.isValid(String(explicitRoleId))) {
    return explicitRoleId;
  }
  const defaultId = user?.defaultExternalRoleId;
  if (defaultId && mongoose.Types.ObjectId.isValid(String(defaultId))) {
    return defaultId;
  }
  const activeAssignments = (user?.externalRoleAssignments || []).filter(
    (assignment) => String(assignment?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  if (activeAssignments.length === 1 && activeAssignments[0]?.roleId) {
    return activeAssignments[0].roleId;
  }
  return null;
}

function clearExternalUserStaleEnvelope(user) {
  delete user._roleAllowsPlatformOwnedFieldEdit;
  user.roleId = null;
  if (typeof user.set === 'function') {
    user.set('permissions', {});
    user.set('appAccess', []);
    user.set('allowedApps', []);
    return;
  }
  user.permissions = {};
  user.appAccess = [];
  user.allowedApps = [];
}

/**
 * Single entry: assign user.permissions + elevation flags from Role, appAccess, or owner defaults.
 * Mutates Mongoose User docs in place (JWT user, profile, login cache, etc.).
 *
 * @param {import('mongoose').Document|object} user
 * @param {{ prefetchedRoleLeanById?: Map<string, object> }} [options]
 */
async function materializeEffectiveCRMEnvelopeOnUser(user, options = {}) {
  if (!user) return;

  const Organization = require('../models/Organization');
  const { materializeRuntimePermissionsOnUser } = require('../services/runtimePermissionResolver');

  try {
    let organization = options.organization || null;
    if (!organization && user.organizationId) {
      organization = await Organization.findById(user.organizationId)
        .select('enabledApps moduleOverrides settings subscription')
        .lean();
    }

    const {
      normalizePlatformUserType,
      PLATFORM_USER_TYPES,
      isExternalUserType,
      stripSettingsPermissions,
    } = require('../constants/platformUserTypes');

    const userType = normalizePlatformUserType(user.userType, {
      isOwner: user.isOwner,
      roleName: user.role,
    });
    const activeExternalRoleId =
      options.activeExternalRoleId ||
      user.activeExternalRoleId ||
      user._activeExternalRoleId ||
      null;

    if (isExternalUserType(user.userType) || userType === PLATFORM_USER_TYPES.EXTERNAL) {
      const resolvedExternalRoleId = resolveExternalRoleIdForSession(user, activeExternalRoleId);
      if (resolvedExternalRoleId) {
        const { hydrateExternalUserSession } = require('../services/externalRoleSessionService');
        await hydrateExternalUserSession(user, resolvedExternalRoleId, organization);
        return;
      }
      clearExternalUserStaleEnvelope(user);
      return;
    }

    if (user.isOwner === true || isTenantPrivilegedUser(user)) {
      let roleLean = null;
      const rid = user.roleId?._id || user.roleId;
      if (rid && mongoose.Types.ObjectId.isValid(rid)) {
        const Role = require('../models/Role');
        const map = options.prefetchedRoleLeanById;
        roleLean = map instanceof Map ? map.get(String(rid)) : undefined;
        if (!roleLean) {
          roleLean = await Role.findById(rid).lean();
        }
      }
      await applyFullPrivilegedEnvelopeToUser(user, organization, { roleLean });
      return;
    }

    const rid = user.roleId;
    const id = rid && typeof rid === 'object' && rid._id ? rid._id : rid;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const Role = require('../models/Role');
      const map = options.prefetchedRoleLeanById;
      let roleLean =
        map instanceof Map ? map.get(String(id)) : undefined;
      if (!roleLean) {
        roleLean = await Role.findById(id).lean();
      }
      if (roleLean) {
        await applyProjectionToUser(user, roleLean, organization);
        if (userType === PLATFORM_USER_TYPES.STANDARD) {
          user.permissions = stripSettingsPermissions(user.permissions);
        }
        return;
      }
    }

    const access = Array.isArray(user.appAccess) ? user.appAccess : [];
    if (access.length > 0 && typeof user.setPermissionsByAppAccess === 'function') {
      user.setPermissionsByAppAccess(access);
      user._roleAllowsPlatformOwnedFieldEdit = false;
      await materializeRuntimePermissionsOnUser(user, { organization, appAccess: access });
      return;
    }

    delete user._roleAllowsPlatformOwnedFieldEdit;
  } catch (e) {
    console.error('[materializeEffectiveCRMEnvelopeOnUser]', e.message);
  }
}

async function hydrateUserPermissionsFromRole(user) {
  return materializeEffectiveCRMEnvelopeOnUser(user);
}

/**
 * Attach effective CRM `permissions` to plain user rows from User.find().lean() (pagination, admin lists).
 * One batched Role query + parallel materialization without persisting.
 *
 * @param {object[]} leanUsers
 * @returns {Promise<object[]>}
 */
async function enrichLeanUsersWithEffectiveCRMPermissions(leanUsers) {
  const list = Array.isArray(leanUsers) ? leanUsers : [];
  if (list.length === 0) return list;

  const User = require('../models/User');
  const Role = require('../models/Role');

  const roleIdSet = new Set();
  for (const row of list) {
    if (row?.isOwner === true) continue;
    const rid = row?.roleId;
    if (!rid) continue;
    const id = rid._id || rid;
    if (mongoose.Types.ObjectId.isValid(id)) {
      roleIdSet.add(String(id));
    }
  }

  /** @type {Map<string, object>} */
  const prefetchedRoleLeanById = new Map();
  if (roleIdSet.size > 0) {
    const docs = await Role.find({ _id: { $in: [...roleIdSet] } }).lean();
    for (const r of docs) {
      prefetchedRoleLeanById.set(String(r._id), r);
    }
  }

  return Promise.all(
    list.map(async (lean) => {
      const temp = new User(lean);
      temp.isNew = false;
      await materializeEffectiveCRMEnvelopeOnUser(temp, { prefetchedRoleLeanById });
      return {
        ...lean,
        permissions: userPermissionsEnvelopeToPlain(temp)
      };
    })
  );
}

/**
 * Strip password and internal authz flags before sending a user document to the client.
 * @param {import('mongoose').Document|object|null|undefined} userDocOrPlain
 */
function sanitizeUserResponsePayload(userDocOrPlain) {
  if (userDocOrPlain == null) return userDocOrPlain;
  const permissions = userPermissionsEnvelopeToPlain(userDocOrPlain);
  const o =
    typeof userDocOrPlain.toObject === 'function'
      ? userDocOrPlain.toObject({ flattenMaps: false })
      : { ...userDocOrPlain };
  o.permissions = permissions;
  delete o.password;
  if (userDocOrPlain._fieldPermissionAppKey) {
    o.fieldPermissionAppKey = userDocOrPlain._fieldPermissionAppKey;
  }
  delete o._roleAllowsPlatformOwnedFieldEdit;
  delete o._fieldPermissionAppKey;
  delete o._isTenantPrivileged;
  delete o.inviteTokenHash;
  delete o.inviteTokenExpiresAt;
  delete o.emailVerificationTokenHash;
  delete o.emailVerificationExpiresAt;
  delete o.passwordResetTokenHash;
  delete o.passwordResetExpiresAt;
  return o;
}

module.exports = {
  projectRoleToUserPermissions,
  attachCommercialCoreModulesFromDeals,
  roleAllowsPlatformOwnedFieldEdits,
  applyProjectionToUser,
  applyFullPrivilegedEnvelopeToUser,
  materializeEffectiveCRMEnvelopeOnUser,
  resolveExternalRoleIdForSession,
  clearExternalUserStaleEnvelope,
  isTenantPrivilegedUser,
  ensurePermissionEnvelopeDefaults,
  buildCasesEnvelopeFromAppAccess,
  enrichLeanUsersWithEffectiveCRMPermissions,
  sanitizeUserResponsePayload,
  userPermissionsEnvelopeToPlain,
  hydrateUserPermissionsFromRole
};
