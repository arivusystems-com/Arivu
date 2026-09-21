/**
 * ============================================================================
 * App Access Utilities
 * ============================================================================
 * 
 * Helper functions for app access validation and management.
 * All functions read from appRegistry.js - no hardcoded role validation.
 * 
 * ============================================================================
 */

const appRegistry = require('../constants/appRegistry');
const { userTypeAllowedForApp, normalizePlatformUserType } = require('../constants/platformUserTypes');

/**
 * Get app configuration from registry
 * @param {string} appKey - The app key (CRM, AUDIT, PORTAL)
 * @returns {object|null} - App configuration or null if not found
 */
function normalizeAppKey(appKey) {
  return String(appKey || '').trim().toUpperCase();
}

function getAppConfig(appKey) {
  return appRegistry[normalizeAppKey(appKey)] || null;
}

function getEquivalentAppKeys(appKey) {
  const normalized = normalizeAppKey(appKey);
  if (normalized === 'SALES' || normalized === 'CRM') {
    return new Set(['SALES', 'CRM']);
  }
  return new Set([normalized]);
}

/**
 * Validate if a role is valid for an app
 * @param {string} appKey - The app key
 * @param {string} roleKey - The role key to validate
 * @returns {boolean} - True if role is valid for the app
 */
function validateAppRole(appKey, roleKey) {
  const config = getAppConfig(appKey);
  if (!config) {
    return false;
  }
  return config.roles.includes(roleKey);
}

/**
 * Validate if a userType can access an app
 * @param {string} userType - STANDARD | ADMIN | EXTERNAL (legacy INTERNAL accepted)
 * @param {string} appKey - The app key
 * @returns {boolean} - True if userType is allowed for the app
 */
function validateUserTypeForApp(userType, appKey) {
  const config = getAppConfig(appKey);
  if (!config) {
    return false;
  }
  return userTypeAllowedForApp(userType, config.userTypesAllowed);
}

/**
 * Get default role for an app
 * @param {string} appKey - The app key
 * @returns {string|null} - Default role key or null if app not found
 */
function getDefaultRoleForApp(appKey) {
  const config = getAppConfig(appKey);
  if (!config) {
    return null;
  }
  return config.defaultRole;
}

/**
 * Get all valid roles for an app
 * @param {string} appKey - The app key
 * @returns {string[]} - Array of valid role keys
 */
function getRolesForApp(appKey) {
  const config = getAppConfig(appKey);
  if (!config) {
    return [];
  }
  return config.roles;
}

/**
 * Get all apps that a userType can access
 * @param {string} userType - The user type
 * @returns {string[]} - Array of app keys
 */
function getAppsForUserType(userType) {
  const apps = [];
  for (const [appKey, config] of Object.entries(appRegistry)) {
    if (userTypeAllowedForApp(userType, config.userTypesAllowed)) {
      apps.push(appKey);
    }
  }
  return apps;
}

/**
 * Check if an app is enabled for an organization
 * Supports both new object structure and legacy string array
 * @param {object} organization - The organization object
 * @param {string} appKey - The app key to check
 * @returns {boolean} - True if app is enabled and active
 */
function isAppEnabledForOrg(organization, appKey) {
  if (!organization || !organization.enabledApps?.length) {
    return false;
  }

  if (!getAppConfig(appKey)) {
    return false;
  }

  const equivalents = getEquivalentAppKeys(appKey);

  return organization.enabledApps.some((entry) => {
    if (typeof entry === 'string') {
      return equivalents.has(normalizeAppKey(entry));
    }
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    if (!equivalents.has(normalizeAppKey(entry.appKey))) {
      return false;
    }
    const status = String(entry.status || 'ACTIVE').toUpperCase();
    return status === 'ACTIVE';
  });
}

/**
 * Find normalized enabledApps entry for catalog/status (not limited to ACTIVE).
 */
function findEnabledAppEntryForOrg(organization, appKey) {
  if (!organization?.enabledApps?.length) return null;
  const equivalents = getEquivalentAppKeys(appKey);
  for (const entry of organization.enabledApps) {
    if (typeof entry === 'string' && equivalents.has(normalizeAppKey(entry))) {
      return { appKey: normalizeAppKey(entry), status: 'ACTIVE' };
    }
    if (entry && typeof entry === 'object' && equivalents.has(normalizeAppKey(entry.appKey))) {
      return {
        appKey: normalizeAppKey(entry.appKey),
        status: String(entry.status || 'ACTIVE').toUpperCase()
      };
    }
  }
  return null;
}

/**
 * Validate that an app is enabled for an organization
 * Throws error if validation fails
 * @param {object} organization - The organization object
 * @param {string} appKey - The app key to validate
 * @throws {Error} - If app is not enabled or doesn't exist
 */
function validateOrgAppEnabled(organization, appKey) {
  // Validate app exists in registry
  const appConfig = getAppConfig(appKey);
  if (!appConfig) {
    throw new Error(`App ${appKey} is not registered in the system`);
  }
  
  // Check if enabled
  if (!isAppEnabledForOrg(organization, appKey)) {
    throw new Error(`App ${appKey} is not enabled for this organization`);
  }
  
  return true;
}

module.exports = {
  normalizeAppKey,
  getAppConfig,
  validateAppRole,
  validateUserTypeForApp,
  getDefaultRoleForApp,
  getRolesForApp,
  getAppsForUserType,
  isAppEnabledForOrg,
  findEnabledAppEntryForOrg,
  validateOrgAppEnabled
};

