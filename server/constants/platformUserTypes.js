/**
 * Platform identity user types (User.userType / Role.userType).
 * STANDARD | ADMIN | EXTERNAL — legacy INTERNAL → STANDARD, SYSTEM → ADMIN.
 */

'use strict';

const PLATFORM_USER_TYPES = Object.freeze({
  STANDARD: 'STANDARD',
  ADMIN: 'ADMIN',
  EXTERNAL: 'EXTERNAL',
});

const PLATFORM_USER_TYPE_VALUES = Object.freeze([
  PLATFORM_USER_TYPES.STANDARD,
  PLATFORM_USER_TYPES.ADMIN,
  PLATFORM_USER_TYPES.EXTERNAL,
]);

/** Legacy values still accepted on read / migration. */
const LEGACY_USER_TYPES = Object.freeze({
  INTERNAL: 'INTERNAL',
  SYSTEM: 'SYSTEM',
  PORTAL: 'PORTAL',
});

function normalizeRoleName(name) {
  return String(name || '').trim().toLowerCase();
}

function isPrivilegedLegacyRoleName(roleName) {
  const n = normalizeRoleName(roleName);
  return n === 'owner' || n === 'admin' || n === 'administrator';
}

/**
 * Canonical platform user type.
 * @param {string|null|undefined} raw
 * @param {{ isOwner?: boolean, roleName?: string|null }} [hints]
 * @returns {'STANDARD'|'ADMIN'|'EXTERNAL'}
 */
function normalizePlatformUserType(raw, hints = {}) {
  if (hints.isOwner === true) return PLATFORM_USER_TYPES.ADMIN;

  const t = String(raw || '').trim().toUpperCase();
  if (t === PLATFORM_USER_TYPES.EXTERNAL || t === LEGACY_USER_TYPES.PORTAL) {
    return PLATFORM_USER_TYPES.EXTERNAL;
  }
  if (t === PLATFORM_USER_TYPES.ADMIN || t === LEGACY_USER_TYPES.SYSTEM) {
    return PLATFORM_USER_TYPES.ADMIN;
  }
  if (t === PLATFORM_USER_TYPES.STANDARD) {
    if (isPrivilegedLegacyRoleName(hints.roleName)) return PLATFORM_USER_TYPES.ADMIN;
    return PLATFORM_USER_TYPES.STANDARD;
  }
  if (t === LEGACY_USER_TYPES.INTERNAL || !t) {
    if (isPrivilegedLegacyRoleName(hints.roleName)) return PLATFORM_USER_TYPES.ADMIN;
    return PLATFORM_USER_TYPES.STANDARD;
  }
  return PLATFORM_USER_TYPES.STANDARD;
}

function isExternalUserType(raw) {
  return normalizePlatformUserType(raw) === PLATFORM_USER_TYPES.EXTERNAL;
}

function isStaffUserType(raw) {
  const n = normalizePlatformUserType(raw);
  return n === PLATFORM_USER_TYPES.STANDARD || n === PLATFORM_USER_TYPES.ADMIN;
}

function isAdminPlatformUserType(raw, hints = {}) {
  return normalizePlatformUserType(raw, hints) === PLATFORM_USER_TYPES.ADMIN;
}

/**
 * Org Settings (beyond profile + personal notifications) require Admin type.
 */
function canAccessOrgSettingsByUserType(user) {
  if (!user) return false;
  if (user.isOwner === true) return true;
  return isAdminPlatformUserType(user.userType, {
    isOwner: user.isOwner,
    roleName: user.role,
  });
}

/** Personal Settings tabs always allowed for authenticated non-external (and portal prefs separately). */
const STANDARD_ALLOWED_SETTINGS_TABS = Object.freeze(['profile', 'notifications']);

function isStandardAllowedSettingsTab(tabId) {
  return STANDARD_ALLOWED_SETTINGS_TABS.includes(String(tabId || ''));
}

/**
 * Expand appRegistry userTypesAllowed for staff apps that listed INTERNAL.
 * @param {string[]} allowed
 * @returns {Set<string>}
 */
function expandUserTypesAllowed(allowed) {
  const set = new Set(
    (Array.isArray(allowed) ? allowed : []).map((v) => String(v || '').toUpperCase())
  );
  if (set.has(LEGACY_USER_TYPES.INTERNAL)) {
    set.add(PLATFORM_USER_TYPES.STANDARD);
    set.add(PLATFORM_USER_TYPES.ADMIN);
  }
  if (set.has(PLATFORM_USER_TYPES.STANDARD) || set.has(PLATFORM_USER_TYPES.ADMIN)) {
    set.add(LEGACY_USER_TYPES.INTERNAL);
  }
  return set;
}

function userTypeAllowedForApp(userType, allowedList) {
  const normalized = normalizePlatformUserType(userType);
  const expanded = expandUserTypesAllowed(allowedList);
  return expanded.has(normalized) || expanded.has(String(userType || '').toUpperCase());
}

function stripSettingsPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return permissions;
  const next = { ...permissions };
  if (next.settings && typeof next.settings === 'object') {
    next.settings = Object.fromEntries(
      Object.keys(next.settings).map((k) => [k, false])
    );
  }
  return next;
}

/**
 * Enforce Standard roles never carry settings privileges on the role document; normalize type.
 * Profiles remain allowed for CRM modules — settings are stripped at user projection for STANDARD.
 */
function applyRoleUserTypeRules({ userType, permissions, privilegeMode, profileId }) {
  const normalizedType = normalizePlatformUserType(userType);
  let nextPermissions = permissions;
  if (normalizedType === PLATFORM_USER_TYPES.STANDARD) {
    nextPermissions = stripSettingsPermissions(permissions);
  }
  return {
    userType: normalizedType,
    permissions: nextPermissions,
    privilegeMode,
    profileId,
  };
}

module.exports = {
  PLATFORM_USER_TYPES,
  PLATFORM_USER_TYPE_VALUES,
  LEGACY_USER_TYPES,
  STANDARD_ALLOWED_SETTINGS_TABS,
  normalizePlatformUserType,
  isExternalUserType,
  isStaffUserType,
  isAdminPlatformUserType,
  canAccessOrgSettingsByUserType,
  isStandardAllowedSettingsTab,
  expandUserTypesAllowed,
  userTypeAllowedForApp,
  isPrivilegedLegacyRoleName,
  stripSettingsPermissions,
  applyRoleUserTypeRules,
};
