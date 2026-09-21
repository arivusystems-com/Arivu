/**
 * Tenant-scoped privileged users (Owner / Admin userType) receive full module access
 * within their organization. Org-level guards (enabled apps, trial, etc.) still apply.
 */

const {
  normalizePlatformUserType,
  PLATFORM_USER_TYPES,
  isPrivilegedLegacyRoleName,
} = require('../constants/platformUserTypes');

function normalizeRoleName(user) {
  return String(user?.role || '').trim().toLowerCase();
}

function isPrivilegedSystemRoleName(roleName) {
  const name = String(roleName || '').trim().toLowerCase();
  return name === 'owner' || name === 'admin' || name === 'administrator';
}

function isPrivilegedSystemRole(roleLean) {
  if (!roleLean?.isSystemRole) return false;
  const type = normalizePlatformUserType(roleLean.userType, { roleName: roleLean.name });
  if (type === PLATFORM_USER_TYPES.ADMIN) return true;
  return isPrivilegedSystemRoleName(roleLean.name);
}

function isTenantPrivilegedUser(user) {
  if (!user) return false;
  if (user.isOwner === true) return true;
  if (user._isTenantPrivileged === true) return true;
  return normalizePlatformUserType(user.userType, {
    isOwner: user.isOwner,
    roleName: user.role,
  }) === PLATFORM_USER_TYPES.ADMIN;
}

module.exports = {
  isPrivilegedSystemRole,
  isPrivilegedSystemRoleName,
  isTenantPrivilegedUser
};
