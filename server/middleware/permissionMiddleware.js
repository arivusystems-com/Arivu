/**
 * ============================================================================
 * PLATFORM CORE: Permission-based Access Control Middleware (App-Aware)
 * ============================================================================
 * 
 * This middleware provides app-aware permission checking:
 * - Permission verification scoped by appKey
 * - Role-based access control
 * - Ownership filtering
 * - Prevents Sales module access from non-Sales apps
 * 
 * App-Aware Behavior:
 * - Sales modules (contacts, deals, tasks, etc.) are only accessible from Sales app
 * - Non-Sales apps should use app-specific permissions (future)
 * - Existing permissions are treated as Sales-scoped for backward compatibility
 * 
 * ✅ FIXED: Permission checks are now app-aware
 *    Sales modules are blocked from non-Sales apps
 *    Platform core does not assume Sales modules
 * 
 * See PLATFORM_CORE_ANALYSIS.md and APP_AWARE_PERMISSIONS.md for details.
 * ============================================================================
 */

// 🔓 SECURITY DISABLED: Bypass all permission checks
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true' || process.env.NODE_ENV !== 'production';

const securityLogger = require('./securityLoggingMiddleware');
const { APP_KEYS } = require('../constants/appKeys');
const {
    resolveRuntimePermission,
    getOrgPermissionContextForUser,
    normalizeStorageModuleKey,
    buildOrgPermissionContext,
    resolveEffectiveAppKey,
    passesOrgAuthorizationGuards
} = require('../services/runtimePermissionResolver');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');

// Sales-specific modules that should only be accessible from Sales app
const SALES_MODULES = [
    'contacts', 'people', 'deals', 'tasks', 'events', 'forms', 'items',
    'organizations', 'projects', 'reports', 'settings'
];

/**
 * Parse internal platform email domains from environment.
 * Supports comma-separated values in:
 * - INTERNAL_EMAIL_DOMAINS
 * - PLATFORM_INTERNAL_EMAIL_DOMAINS
 */
function getInternalEmailDomains() {
    const raw = process.env.INTERNAL_EMAIL_DOMAINS || process.env.PLATFORM_INTERNAL_EMAIL_DOMAINS || '';
    const fromEnv = String(raw)
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

    if (fromEnv.length > 0) return fromEnv;

    // Backward-compatible defaults (can be overridden via env).
    return ['arivusystems.com', 'arivu.com', 'arivu.io'];
}

function isInternalEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return false;
    const domain = normalized.split('@')[1];
    if (!domain) return false;
    return getInternalEmailDomains().includes(domain);
}

/**
 * Check if a module is Sales-specific
 */
function isSalesModule(module) {
    const normalizedModule = module === 'people' ? 'contacts' : module;
    return SALES_MODULES.includes(normalizedModule);
}

/**
 * Check if user has permission to perform an action on a module (app-aware)
 * Usage: checkPermission('contacts', 'create')
 * 
 * App-Aware Behavior:
 * - CRM modules are only accessible from CRM app
 * - Non-CRM apps cannot access CRM modules
 * - Existing permissions are treated as CRM-scoped
 */
const checkPermission = (module, action) => {
    return async (req, res, next) => {
        // 🔓 BYPASS: Skip all permission checks if security is disabled
        if (SECURITY_DISABLED) {
            console.warn(`⚠️  [DEV] Permission check bypassed: ${module}.${action}`);
            return next();
        }
        
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const normalizedModule = normalizeStorageModuleKey(module);
            const orgContext = req.organization
                ? buildOrgPermissionContext(req.organization)
                : await getOrgPermissionContextForUser(user);

            if (!user._orgPermissionContext) {
                user._orgPermissionContext = orgContext;
            }

            const effectiveAppKey = resolveEffectiveAppKey(normalizedModule, req.appKey);
            if (!passesOrgAuthorizationGuards(orgContext, normalizedModule, effectiveAppKey)) {
                if (isSalesModule(normalizedModule) && req.appKey && req.appKey !== APP_KEYS.SALES) {
                    securityLogger.logPermissionDenial(req, normalizedModule, action);
                    return res.status(403).json({
                        message: `Sales modules are only accessible from the Sales application`,
                        code: 'SALES_MODULE_NOT_ACCESSIBLE',
                        module: normalizedModule,
                        action: action,
                        currentApp: req.appKey,
                        requiredApp: APP_KEYS.SALES
                    });
                }

                securityLogger.logPermissionDenial(req, normalizedModule, action);
                return res.status(403).json({
                    message: 'This application or module is not enabled for your organization',
                    code: 'ORG_MODULE_NOT_ENABLED',
                    module: normalizedModule,
                    action: action,
                    appKey: effectiveAppKey || req.appKey
                });
            }

            if (
              normalizedModule === 'settings' &&
              !user.isOwner
            ) {
              const {
                normalizePlatformUserType,
                PLATFORM_USER_TYPES,
              } = require('../constants/platformUserTypes');
              const ut = normalizePlatformUserType(user.userType, {
                isOwner: user.isOwner,
                roleName: user.role,
              });
              if (ut === PLATFORM_USER_TYPES.STANDARD) {
                securityLogger.logPermissionDenial(req, normalizedModule, action);
                return res.status(403).json({
                  message: 'Standard users cannot access organization Settings',
                  code: 'STANDARD_USER_SETTINGS_DENIED',
                  module: normalizedModule,
                  action,
                });
              }
            }

            if (user.isOwner || isTenantPrivilegedUser(user)) {
                return next();
            }

            const runtimeAllowed = resolveRuntimePermission(user, module, action, {
                appKey: req.appKey,
                orgContext
            });

            const hasPermission = runtimeAllowed;

            if (!hasPermission) {
                // Log permission denial
                securityLogger.logPermissionDenial(req, normalizedModule, action);
                
                return res.status(403).json({ 
                    message: `You don't have permission to ${action} ${module}`,
                    code: 'INSUFFICIENT_PERMISSIONS',
                    requiredPermission: { module: normalizedModule, action },
                    appKey: req.appKey || APP_KEYS.SALES // Include app context
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Server error during permission verification' });
        }
    };
};

/**
 * Check if user has a specific role (or higher in hierarchy)
 * Role hierarchy: owner > admin > manager > user > viewer
 * Usage: requireRole('admin') // allows owner and admin
 */
const requireRole = (requiredRole) => {
    const roleHierarchy = {
        'owner': 5,
        'admin': 4,
        'manager': 3,
        'user': 2,
        'viewer': 1
    };
    
    return async (req, res, next) => {
        // 🔓 BYPASS: Skip role checks if security is disabled
        if (SECURITY_DISABLED) {
            console.warn(`⚠️  [DEV] Role check bypassed: ${requiredRole}`);
            return next();
        }
        
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const userRoleLevel = roleHierarchy[user.role] || 0;
            const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
            
            if (userRoleLevel < requiredRoleLevel) {
                return res.status(403).json({ 
                    message: `This action requires ${requiredRole} role or higher`,
                    code: 'INSUFFICIENT_ROLE',
                    userRole: user.role,
                    requiredRole: requiredRole
                });
            }

            next();
        } catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({ message: 'Server error during role verification' });
        }
    };
};

/**
 * Check if user is owner or admin
 * Shorthand for common permission check
 */
const requireAdmin = () => {
    return requireRole('admin');
};

/**
 * Check if user is from the master organization (application owner)
 * Only master organization users can access platform management features
 * like demo requests, instances, etc.
 */
const requireMasterOrganization = () => {
    return async (req, res, next) => {
        // 🔓 BYPASS: Skip master organization check if security is disabled
        if (SECURITY_DISABLED) {
            console.warn('⚠️  [DEV] Master organization check bypassed');
            return next();
        }
        
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            // Get organization details
            const Organization = require('../models/Organization');
            const organization = await Organization.findById(user.organizationId);
            
            if (!organization) {
                return res.status(404).json({ message: 'Organization not found' });
            }

            // Platform-owner access policy (no org-name hardcoding):
            // 1) explicit platform admin flag on user
            // 2) internal staff email domain (configurable via env)
            // 3) explicit internal marker on organization if present
            const isMasterOrg =
                user.isPlatformAdmin === true ||
                isInternalEmail(user.email) ||
                organization.isInternal === true;
            
            if (!isMasterOrg) {
                return res.status(403).json({ 
                    message: 'This feature is only available to the application owner',
                    code: 'MASTER_ORGANIZATION_REQUIRED'
                });
            }

            next();
        } catch (error) {
            console.error('Master organization check error:', error);
            res.status(500).json({ message: 'Server error during organization verification' });
        }
    };
};

/**
 * Check if user is the owner
 */
const requireOwner = () => {
    return requireRole('owner');
};

/**
 * Check if user can manage other users
 */
const canManageUsers = () => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ message: 'Authentication required' });
            if (user.isOwner || isTenantPrivilegedUser(user)) {
                return next();
            }
            const mw = checkPermission('settings', 'manageUsers');
            return mw(req, res, next);
        } catch (e) {
            console.error('canManageUsers error:', e);
            return res.status(500).json({ message: 'Server error during permission verification' });
        }
    };
};

/**
 * Check if user can manage billing
 */
const canManageBilling = () => {
    return checkPermission('settings', 'manageBilling');
};

/**
 * Check if user can manage roles and permissions
 * For now, requires admin or owner role
 */
const canManageRoles = () => {
    return checkPermission('settings', 'manageRoles');
};

/**
 * Middleware to filter data based on viewAll permission (app-aware)
 * If user doesn't have viewAll, they can only see their own data
 * 
 * App-Aware Behavior:
 * - Sales modules only filter from Sales app
 * - Non-Sales apps should use app-specific filtering (future)
 */
const filterByOwnership = (module) => {
    return async (req, res, next) => {
        // 🔓 BYPASS: Skip ownership filtering if security is disabled
        if (SECURITY_DISABLED) {
            console.warn(`⚠️  [DEV] Ownership filter bypassed: ${module}`);
            req.viewAll = true; // Allow viewing all data
            return next();
        }
        
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const normalizedModule = normalizeStorageModuleKey(module);
            const orgContext = req.organization
                ? buildOrgPermissionContext(req.organization)
                : await getOrgPermissionContextForUser(user);

            if (isSalesModule(normalizedModule) && req.appKey && req.appKey !== APP_KEYS.SALES) {
                return res.status(403).json({
                    message: `Sales modules are only accessible from the Sales application`,
                    code: 'SALES_MODULE_NOT_ACCESSIBLE',
                    module: normalizedModule,
                    currentApp: req.appKey,
                    requiredApp: APP_KEYS.SALES
                });
            }

            const canViewAll =
                isTenantPrivilegedUser(user) ||
                (user.isOwner && orgContext.isAppEnabled(req.appKey || APP_KEYS.SALES)) ||
                resolveRuntimePermission(user, module, 'viewAll', {
                    appKey: req.appKey,
                    orgContext
                }) ||
                user.permissions?.[normalizedModule]?.viewAll;

            if (canViewAll) {
                req.viewAll = true;
                return next();
            }

            // Others can only see data assigned to them
            req.viewAll = false;
            req.filterByUser = user._id;
            req.sharingOwnerField = require('../services/sharingResolver').getOwnerFieldForModule(module);
            
            next();
        } catch (error) {
            console.error('Ownership filter error:', error);
            res.status(500).json({ message: 'Server error during ownership filtering' });
        }
    };
};

/**
 * Permission check using module key from route params (e.g. for /:moduleKey/records/:recordId).
 * Usage: checkPermissionFromParam('moduleKey', 'view')
 */
const checkPermissionFromParam = (paramName, action) => {
    return (req, res, next) => {
        const moduleKey = req.params[paramName];
        if (!moduleKey) {
            return res.status(400).json({ message: 'Module key is required', code: 'MISSING_MODULE_KEY' });
        }
        return checkPermission(moduleKey, action)(req, res, next);
    };
};

/**
 * Platform administrator only (isPlatformAdmin flag).
 * Use for Control Plane settings tenants must not access (e.g. inbound parser URLs).
 */
const requirePlatformAdmin = () => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        const allowed =
            req.user.isPlatformAdmin === true || isInternalEmail(req.user.email);
        if (!allowed) {
            return res.status(403).json({
                message: 'Platform administrator access required',
                code: 'PLATFORM_ADMIN_REQUIRED'
            });
        }
        next();
    };
};

/**
 * Sharing v1 list filter — replaces filterByOwnership when SHARING_V1 enabled.
 * Falls back to legacy ownership filter when flag is off.
 */
const applySharingFilter = (module) => {
    return async (req, res, next) => {
        if (SECURITY_DISABLED) {
            console.warn(`⚠️  [DEV] Sharing filter bypassed: ${module}`);
            req.viewAll = true;
            return next();
        }

        try {
            const { isSharingV1Enabled } = require('../utils/rbacFeatureFlags');
            const { buildRecordVisibilityFilter, getOwnerFieldForModule } = require('../services/sharingResolver');
            const Organization = require('../models/Organization');

            const organization = req.organization
                || (req.user?.organizationId
                    ? await Organization.findById(req.user.organizationId).select('settings enabledApps').lean()
                    : null);

            if (!isSharingV1Enabled(organization)) {
                return filterByOwnership(module)(req, res, next);
            }

            const user = req.user;
            if (!user) {
                return res.status(401).json({ message: 'Authentication required' });
            }

            const normalizedModule = normalizeStorageModuleKey(module);
            const orgContext = organization
                ? buildOrgPermissionContext(organization)
                : await getOrgPermissionContextForUser(user);

            if (isSalesModule(normalizedModule) && req.appKey && req.appKey !== APP_KEYS.SALES) {
                return res.status(403).json({
                    message: 'Sales modules are only accessible from the Sales application',
                    code: 'SALES_MODULE_NOT_ACCESSIBLE',
                    module: normalizedModule,
                    currentApp: req.appKey,
                    requiredApp: APP_KEYS.SALES
                });
            }

            const appKey = req.appKey || APP_KEYS.SALES;
            const roleLean = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;

            const sharingFilter = await buildRecordVisibilityFilter(user, {
                appKey,
                moduleKey: module,
                organization,
                roleLean
            });

            req.sharingOwnerField = getOwnerFieldForModule(module);

            if (sharingFilter === null) {
                req.viewAll = true;
                req.sharingFilter = null;
            } else {
                req.viewAll = false;
                req.sharingFilter = sharingFilter;
            }

            next();
        } catch (error) {
            console.error('Sharing filter error:', error);
            res.status(500).json({ message: 'Server error during sharing filter' });
        }
    };
};

module.exports = {
    checkPermission,
    checkPermissionFromParam,
    requireRole,
    requireAdmin,
    requireOwner,
    requireMasterOrganization,
    requirePlatformAdmin,
    canManageUsers,
    canManageBilling,
    canManageRoles,
    filterByOwnership,
    applySharingFilter
};

