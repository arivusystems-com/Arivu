/**
 * ============================================================================
 * PLATFORM CORE: UI Composition Service (Phase 0D)
 * ============================================================================
 * 
 * This service composes UI metadata for a tenant based on:
 * - Platform AppDefinition and ModuleDefinition metadata
 * - Tenant enablement (Organization.enabledApps)
 * - Tenant module configurations (TenantModuleConfiguration)
 * - User entitlements (User.allowedApps)
 * 
 * Rules:
 * - Only enabled apps/modules returned
 * - Apply tenant overrides on top of platform metadata
 * - Sort using sidebarOrder
 * - Never throw — return empty arrays on failure
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const Organization = require('../models/Organization');
const { resolveAppAccess } = require('./accessResolutionService');
const { validateUserTypeForApp } = require('../utils/appAccessUtils');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');
const { ADDON_KEYS } = require('../constants/addonKeys');

const ADDON_GATED_MODULE_KEYS = {
  articles: ADDON_KEYS.ARTICLES,
  blog: ADDON_KEYS.BLOG,
};

/** Core entities store tenant label overrides under SALES, but render via /ui/entities (platform). */
const PLATFORM_TENANT_CONFIG_APP_KEYS = ['SALES', 'PLATFORM'];

class UICompositionService {
  filterAppsByUserType(apps, user) {
    if (!Array.isArray(apps) || apps.length === 0) {
      return [];
    }

    const userType = user?.userType || 'INTERNAL';

    return apps.filter((app) => {
      const appKey = String(app?.appKey || '').toUpperCase();
      if (!appKey || appKey === 'CONTROL_PLANE') {
        return false;
      }
      return validateUserTypeForApp(userType, appKey);
    });
  }

  /**
   * Get all enabled apps for a tenant with UI metadata
   * Phase 0F: Uses access resolution service to determine accessible apps
   * @param {String} organizationId - Organization ID
   * @param {Object} user - User object (for access resolution)
   * @returns {Promise<Array>} Array of app definitions with UI metadata
   */
  async getUIAppsForTenant(organizationId, user) {
    try {
      // Get organization to check enabledApps
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        console.warn(`[UIComposition] Organization ${organizationId} not found`);
        return [];
      }

      // Handle enabledApps as array of objects or strings (backward compatibility)
      let enabledAppKeys = [];
      if (organization.enabledApps && organization.enabledApps.length > 0) {
        // Check if enabledApps is array of objects (new structure)
        if (typeof organization.enabledApps[0] === 'object' && organization.enabledApps[0] !== null) {
          enabledAppKeys = organization.enabledApps
            .filter(app => app.status === 'ACTIVE')
            .map(app => app.appKey);
        } else {
          // Legacy: array of strings
          enabledAppKeys = organization.enabledApps;
        }
      } else {
        // Default to Sales for backward compatibility
        enabledAppKeys = ['SALES'];
      }
      
      const appKeysLower = enabledAppKeys.map(app => app.toLowerCase());
      
      // Get app definitions for enabled apps
      // EXCLUDE CONTROL_PLANE - it's platform-only, never shown to tenants
      const appDefinitions = await AppDefinition.find({
        appKey: { $in: appKeysLower, $ne: 'control_plane' }, // Explicitly exclude CONTROL_PLANE
        enabled: true
      }).sort({ 'ui.sidebarOrder': 1, order: 1 });

      // Map to UI format
      let uiApps = appDefinitions.map(app => {
        const appKeyLower = app.appKey.toLowerCase();
        // Avoid every app inheriting the same `/dashboard` (registry validation + deep links)
        const defaultHomeByApp = {
          sales: '/sales/dashboard',
          audit: '/audit/dashboard',
          portal: '/portal/dashboard',
          marketing: '/dashboard/marketing',
          inventory: '/dashboard/inventory',
          helpdesk: '/dashboard/helpdesk',
          lms: '/learning',
        };
        let defaultRoute = app.ui?.defaultRoute;
        if (!defaultRoute || defaultRoute === '/dashboard') {
          defaultRoute = defaultHomeByApp[appKeyLower] || `/dashboard/${appKeyLower}`;
        }

        // Normalize invalid routes (fix for old data)
        if (defaultRoute === '/portal/me') {
          // /portal/me is an API endpoint, not a frontend route
          defaultRoute = '/portal/dashboard';
        }
        
        return {
          appKey: app.appKey.toUpperCase(),
          name: app.name,
          description: app.description,
          icon: app.ui?.icon || app.icon,
          defaultRoute: defaultRoute,
          showInAppSwitcher: app.ui?.showInAppSwitcher !== false,
          sidebarOrder: app.ui?.sidebarOrder ?? app.order ?? 0
        };
      });

      // Phase 0F: Use access resolution service to filter apps
      // CONTROL_PLANE is explicitly excluded (platform-only, never shown to tenants)
      //
      // Organization owners see all org-enabled apps that match their userType.
      // INTERNAL users never get PORTAL in navigation; configure Portal via Settings.
      if (user && (user.isOwner === true || user.role === 'owner')) {
        const ownerApps = this.filterAppsByUserType(uiApps, user);
        console.log(
          `[UIComposition] Owner detected (isOwner: ${user.isOwner}, role: ${user.role}), returning ${ownerApps.length}/${uiApps.length} enabled apps after userType filter`
        );
        return ownerApps;
      }
      
      console.log(`[UIComposition] Non-owner user, checking access for ${uiApps.length} apps`);

      const accessChecks = await Promise.all(
        uiApps.map(async (app) => {
          if (app.appKey.toUpperCase() === 'CONTROL_PLANE') {
            return null;
          }
          try {
            const accessResult = await resolveAppAccess({
              user: user,
              organization: organization,
              appKey: app.appKey,
              intent: 'VIEW' // App switcher just needs VIEW access
            });
            return accessResult.allowed ? app : null;
          } catch (error) {
            console.warn(`[UIComposition] Error resolving access for app ${app.appKey}:`, error);
            // On error, fall back to legacy check for backward compatibility
            const userAllowedApps = user.allowedApps || [];
            if (userAllowedApps.includes(app.appKey)) {
              return app;
            }
            return null;
          }
        })
      );
      const accessibleApps = accessChecks.filter(Boolean);

      return this.filterAppsByUserType(accessibleApps, user);
    } catch (error) {
      console.error('[UIComposition] Error getting apps for tenant:', error);
      return [];
    }
  }

  /**
   * Get all enabled modules for an app with UI metadata
   * @param {String} organizationId - Organization ID
   * @param {String} appKey - App key (e.g., 'SALES', 'AUDIT')
   * @returns {Promise<Array>} Array of module definitions with UI metadata
   */
  async getUIModulesForApp(organizationId, appKey) {
    try {
      const appKeyLower = appKey.toLowerCase();

      // Do not seed platform modules on the registry/sidebar hot path.
      // Seeding belongs to Settings / getCoreModules (ensurePlatformCommercialCoreModules).

      // Get module definitions for this app
      // Priority: platform-level modules (organizationId: null) first, then organization-specific
      // Note: appKey filter already excludes platform modules (appKey: 'platform')
      const platformModules = await ModuleDefinition.find({
        appKey: appKeyLower,
        organizationId: null // Platform-level modules
      });
      
      const orgSpecificModules = await ModuleDefinition.find({
        appKey: appKeyLower,
        organizationId: organizationId // Organization-specific modules for this tenant
      });
      
      // Combine: prefer platform-level, but include org-specific if platform doesn't exist
      // Use a Map to deduplicate by moduleKey (platform takes precedence)
      const moduleMap = new Map();
      
      // First add organization-specific modules
      orgSpecificModules.forEach(module => {
        moduleMap.set(module.moduleKey, module);
      });
      
      // Then add platform modules (will overwrite org-specific if same moduleKey)
      platformModules.forEach(module => {
        moduleMap.set(module.moduleKey, module);
      });
      
      let moduleDefinitions = Array.from(moduleMap.values());

      // Exclude deprecated/removed modules from app nav (e.g. contacts was removed from Sales)
      const excludedModuleKeysByApp = {
        sales: ['contacts']
      };
      const excludedForApp = excludedModuleKeysByApp[appKeyLower];
      if (excludedForApp && excludedForApp.length > 0) {
        moduleDefinitions = moduleDefinitions.filter(
          (m) => !excludedForApp.includes((m.moduleKey || '').toLowerCase())
        );
      }

      // Get tenant module configurations
      const tenantConfigQuery = {
        organizationId,
        enabled: true,
      };
      if (appKeyLower === 'platform') {
        tenantConfigQuery.appKey = { $in: PLATFORM_TENANT_CONFIG_APP_KEYS };
      } else {
        tenantConfigQuery.appKey = appKey.toUpperCase();
      }
      const tenantConfigs = await TenantModuleConfiguration.find(tenantConfigQuery);

      // Create a map of tenant configs by moduleKey
      const tenantConfigMap = {};
      tenantConfigs.forEach((config) => {
        const key = config.moduleKey;
        const existing = tenantConfigMap[key];
        if (!existing) {
          tenantConfigMap[key] = config;
          return;
        }
        if (config.labelOverride && !existing.labelOverride) {
          tenantConfigMap[key] = config;
        }
      });

      // Display Name from Module details: org overrides use organizationId + key (no appKey), so query by key/moduleKey
      const moduleKeysForApp = moduleDefinitions.map((m) => (m.moduleKey || '').toLowerCase()).filter(Boolean);
      const orgDisplayNameByKey = {};
      if (moduleKeysForApp.length > 0) {
        const orgOverrides = await ModuleDefinition.find({
          organizationId,
          $or: [
            { key: { $in: moduleKeysForApp } },
            { moduleKey: { $in: moduleKeysForApp } }
          ]
        })
          .select('key moduleKey name')
          .lean();
        orgOverrides.forEach((orgMod) => {
          const key = (orgMod.moduleKey || orgMod.key || '').toLowerCase();
          const name = typeof orgMod.name === 'string' ? orgMod.name.trim() : '';
          if (key && name) orgDisplayNameByKey[key] = name;
        });
      }

      // Compose UI metadata for each enabled module
      const uiModules = [];
      const seenModuleKeys = new Set(); // Track seen moduleKeys to prevent duplicates

      for (const moduleDef of moduleDefinitions) {
        // Skip if we've already processed this moduleKey (deduplication)
        if (seenModuleKeys.has(moduleDef.moduleKey)) {
          console.warn(`[UIComposition] Duplicate moduleKey ${moduleDef.moduleKey} for app ${appKey}, skipping duplicate`);
          continue;
        }

        // If requesting platform modules (for /ui/entities endpoint), include them
        // Otherwise, skip platform modules - they belong in Core Modules section, not app navigation
        const isPlatformRequest = appKeyLower === 'platform';
        
        if (!isPlatformRequest) {
          // Skip platform modules - they belong in Core Modules section, not app navigation
          if (moduleDef.appKey && moduleDef.appKey.toLowerCase() === 'platform') {
            continue;
          }

          // Skip core platform entities - these should never appear in app navigation
          // Core entities: people, organizations, tasks, events, items, forms
          const coreEntityKeys = ['people', 'organizations', 'tasks', 'events', 'items', 'forms', 'responses', 'quotes', 'imports', 'documents', 'templates', 'reports'];
          if (coreEntityKeys.includes(moduleDef.moduleKey?.toLowerCase())) {
            console.warn(`[UIComposition] Skipping core entity ${moduleDef.moduleKey} from app ${appKey} - it belongs in Core Modules section`);
            continue;
          }

          // Skip modules explicitly marked to exclude from apps (navigation intent: Entities section only)
          if (moduleDef.ui && moduleDef.ui.excludeFromApps === true) {
            continue;
          }

          // Skip modules marked as navigation entities (they belong in Entities section, not Apps)
          if (moduleDef.ui && moduleDef.ui.navigationEntity === true) {
            continue;
          }
        }

        const tenantConfig = tenantConfigMap[moduleDef.moduleKey];

        const addonGateKey = ADDON_GATED_MODULE_KEYS[moduleDef.moduleKey];
        if (addonGateKey) {
          const entitled = await isAddonEntitledForOrg(organizationId, addonGateKey);
          if (!entitled) {
            continue;
          }
        }

        // Skip if tenant has explicitly disabled this module
        if (tenantConfig && !tenantConfig.enabled) {
          continue;
        }

        // Display name: Module details "Display Name" (org) > tenant labelOverride > moduleDef.name > moduleDef.label
        const displayName = orgDisplayNameByKey[moduleDef.moduleKey] ||
          tenantConfig?.labelOverride ||
          (typeof moduleDef.name === 'string' && moduleDef.name.trim()) ||
          moduleDef.label;

        // Normalize known legacy/bad route bases that break frontend navigation.
        // Helpdesk case surfaces must always route through /helpdesk/cases (not /cases),
        // regardless of legacy module key names (e.g. "ticket", "tickets", "cases").
        const computedRouteBase = moduleDef.ui?.routeBase || `/${moduleDef.moduleKey}`;
        const normalizedComputedRouteBase = String(computedRouteBase || '').trim().replace(/\/+$/, '');
        const moduleKeyLower = String(moduleDef.moduleKey || '').toLowerCase();
        const displayNameLower = String(displayName || '').toLowerCase();
        const isHelpdeskCaseSurface =
          appKeyLower === 'helpdesk' &&
          (
            moduleKeyLower === 'cases' ||
            moduleKeyLower === 'ticket' ||
            moduleKeyLower === 'tickets' ||
            moduleKeyLower === 'ticklets' ||
            normalizedComputedRouteBase === '/cases' ||
            normalizedComputedRouteBase === 'cases' ||
            normalizedComputedRouteBase === '/helpdesk/cases' ||
            displayNameLower.includes('ticket') ||
            displayNameLower.includes('ticklet')
          );
        const normalizedRouteBase =
          appKeyLower === 'helpdesk' &&
          (normalizedComputedRouteBase === '/cases' || normalizedComputedRouteBase === 'cases')
            ? '/helpdesk/cases'
            : computedRouteBase;
        const normalizedDisplayName = isHelpdeskCaseSurface ? 'Cases' : displayName;
        const normalizedPluralLabel = isHelpdeskCaseSurface
          ? 'Cases'
          : (tenantConfig?.labelOverride || orgDisplayNameByKey[moduleDef.moduleKey] || moduleDef.pluralLabel || normalizedDisplayName);
        const singularName =
          (typeof moduleDef.label === 'string' && moduleDef.label.trim()) ||
          normalizedDisplayName;
        const hasTenantLabelOverride = Boolean(
          tenantConfig?.labelOverride || orgDisplayNameByKey[moduleDef.moduleKey]
        );
        const normalizedCreateLabel = isHelpdeskCaseSurface
          ? 'Create Case'
          : (hasTenantLabelOverride
              ? `New ${singularName}`
              : (moduleDef.ui?.createLabel || `New ${singularName}`));
        const normalizedListLabel = isHelpdeskCaseSurface
          ? 'All Cases'
          : (hasTenantLabelOverride
              ? `All ${normalizedPluralLabel || normalizedDisplayName}`
              : (moduleDef.ui?.listLabel || `All ${normalizedPluralLabel || normalizedDisplayName}`));

        // Apply tenant overrides on top of platform metadata
        const uiModule = {
          moduleKey: moduleDef.moduleKey,
          appKey: moduleDef.appKey.toUpperCase(),
          label: normalizedDisplayName,
          singularLabel: singularName,
          pluralLabel: normalizedPluralLabel,
          routeBase: normalizedRouteBase,
          icon: moduleDef.ui?.icon,
          showInSidebar: tenantConfig?.ui?.showInSidebar !== false && 
                        (moduleDef.ui?.showInSidebar !== false),
          sidebarOrder: tenantConfig?.ui?.sidebarOrder ?? 
                       tenantConfig?.ui?.order ?? 
                       moduleDef.ui?.sidebarOrder ?? 
                       0,
          createLabel: normalizedCreateLabel,
          listLabel: normalizedListLabel,
          tenantLabel: hasTenantLabelOverride,
          // Navigation intent flags (for four-section sidebar)
          navigationCore: moduleDef.ui?.navigationCore || false,
          navigationEntity: moduleDef.ui?.navigationEntity || false,
          excludeFromApps: moduleDef.ui?.excludeFromApps || false,
          // Legacy flags for backward compatibility
          system: moduleDef.system || false,
          coreEntity: moduleDef.coreEntity || false
        };

        // Analytics IA: only Reports in platform core sidebar
        const platformNavKey = String(moduleDef.moduleKey || '').toLowerCase();
        if (platformNavKey === 'analytics' || platformNavKey === 'dashboards') {
          uiModule.showInSidebar = false;
        } else if (platformNavKey === 'reports') {
          uiModule.showInSidebar = true;
        }

        uiModules.push(uiModule);
        seenModuleKeys.add(moduleDef.moduleKey); // Mark as seen
      }

      // Audit: ensure core workspace surfaces appear even when platform module seeds are missing
      if (appKeyLower === 'audit') {
        const auditNavDefaults = [
          { moduleKey: 'audits', label: 'Audits', pluralLabel: 'Audits', routeBase: '/audit/audits', icon: 'document-text', sidebarOrder: 1 },
          { moduleKey: 'cases', label: 'Findings', pluralLabel: 'Findings', routeBase: '/audit/findings', icon: 'magnifying-glass', sidebarOrder: 2 },
          { moduleKey: 'responses', label: 'Responses', pluralLabel: 'Responses', routeBase: '/audit/responses', icon: 'responses', sidebarOrder: 3 },
          { moduleKey: 'schedule', label: 'Schedule', pluralLabel: 'Schedule', routeBase: '/audit/schedule', icon: 'calendar', sidebarOrder: 4 }
        ];
        for (const def of auditNavDefaults) {
          if (seenModuleKeys.has(def.moduleKey)) continue;
          uiModules.push({
            moduleKey: def.moduleKey,
            appKey: 'AUDIT',
            label: def.label,
            pluralLabel: def.pluralLabel,
            routeBase: def.routeBase,
            icon: def.icon,
            showInSidebar: true,
            sidebarOrder: def.sidebarOrder,
            createLabel: `Create ${def.label}`,
            listLabel: `All ${def.pluralLabel}`,
            navigationCore: false,
            navigationEntity: false,
            excludeFromApps: false,
            system: false,
            coreEntity: false
          });
          seenModuleKeys.add(def.moduleKey);
        }
        uiModules.sort((a, b) => (a.sidebarOrder ?? 999) - (b.sidebarOrder ?? 999));
      }

      // For Sales app: include custom modules (organization-scoped) in sidebar and app nav
      if (appKeyLower === 'sales') {
        const customModules = await ModuleDefinition.find({
          organizationId,
          type: 'custom',
          enabled: { $ne: false }
        })
          .select('key moduleKey name label pluralLabel')
          .lean();
        for (const custom of customModules) {
          const moduleKey = (custom.key || custom.moduleKey || '').toLowerCase();
          if (!moduleKey || seenModuleKeys.has(moduleKey)) continue;
          const displayName = (typeof custom.name === 'string' && custom.name.trim()) ||
            custom.label ||
            (moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1));
          uiModules.push({
            moduleKey,
            appKey: 'SALES',
            label: displayName,
            pluralLabel: custom.pluralLabel || displayName + 's',
            routeBase: `/${moduleKey}`,
            icon: 'cube',
            showInSidebar: true,
            sidebarOrder: 999,
            createLabel: `Create ${displayName}`,
            listLabel: `All ${custom.pluralLabel || displayName + 's'}`,
            navigationCore: false,
            navigationEntity: false,
            excludeFromApps: false,
            system: false,
            coreEntity: false,
            isCustom: true
          });
          seenModuleKeys.add(moduleKey);
        }
      }

      // Sort by sidebarOrder
      uiModules.sort((a, b) => a.sidebarOrder - b.sidebarOrder);

      return uiModules;
    } catch (error) {
      console.error('[UIComposition] Error getting modules for app:', error);
      return [];
    }
  }

  /**
   * Get app registry metadata in one HTTP request.
   * This keeps the browser from making one modules request per app during startup.
   * @param {String} organizationId - Organization ID
   * @param {Object} user - User object (for access resolution)
   * @returns {Promise<Object>} Apps, app modules, and platform/entity modules
   */
  async getAppRegistryDefinition(organizationId, user) {
    try {
      const apps = await this.getUIAppsForTenant(organizationId, user);
      const modulesByAppKey = {};

      await Promise.all(
        apps.map(async (app) => {
          modulesByAppKey[app.appKey] = await this.getUIModulesForApp(organizationId, app.appKey);
        })
      );

      const entityModules = await this.getUIModulesForApp(organizationId, 'platform');

      return {
        apps,
        modulesByAppKey,
        entityModules
      };
    } catch (error) {
      console.error('[UIComposition] Error getting app registry definition:', error);
      return {
        apps: [],
        modulesByAppKey: {},
        entityModules: []
      };
    }
  }

  /**
   * Get complete sidebar definition for a tenant
   * Phase 0F: Uses access resolution service
   * @param {String} organizationId - Organization ID
   * @param {Object} user - User object (for access resolution)
   * @returns {Promise<Object>} Sidebar definition with apps and modules
   */
  async getSidebarDefinition(organizationId, user) {
    try {
      const apps = await this.getUIAppsForTenant(organizationId, user);
      
      const sidebar = {
        apps: []
      };

      for (const app of apps) {
        const modules = await this.getUIModulesForApp(organizationId, app.appKey);
        
        sidebar.apps.push({
          ...app,
          modules: modules.filter(m => m.showInSidebar)
        });
      }

      return sidebar;
    } catch (error) {
      console.error('[UIComposition] Error getting sidebar definition:', error);
      return { apps: [] };
    }
  }

  /**
   * Get route definitions for dynamic route injection
   * Phase 0F: Uses access resolution service
   * @param {String} organizationId - Organization ID
   * @param {Object} user - User object (for access resolution)
   * @returns {Promise<Array>} Array of route definitions
   */
  async getRouteDefinitions(organizationId, user) {
    try {
      const apps = await this.getUIAppsForTenant(organizationId, user);
      const routes = [];
      /** Dedicated static routes in client router — skip duplicate dynamic injection. */
      const staticAnalyticsModuleKeys = new Set(['reports', 'dashboards', 'analytics']);

      const modulesByApp = await Promise.all(
        apps.map(async (app) => ({
          app,
          modules: await this.getUIModulesForApp(organizationId, app.appKey),
        }))
      );

      for (const { app, modules } of modulesByApp) {
        for (const module of modules) {
          const moduleKey = String(module.moduleKey || '').toLowerCase();
          if (staticAnalyticsModuleKeys.has(moduleKey)) {
            continue;
          }

          const appKeySlug = String(module.appKey || app.appKey || '')
            .toLowerCase()
            .trim();
          const routeNamePrefix = appKeySlug ? `${appKeySlug}-${module.moduleKey}` : module.moduleKey;

          // List route
          routes.push({
            path: module.routeBase,
            name: `${routeNamePrefix}-list`,
            appKey: module.appKey,
            moduleKey: module.moduleKey,
            type: 'list'
          });

          // Detail route (if module supports it)
          routes.push({
            path: `${module.routeBase}/:id`,
            name: `${routeNamePrefix}-detail`,
            appKey: module.appKey,
            moduleKey: module.moduleKey,
            type: 'detail'
          });

          // Create route (if module supports creation)
          routes.push({
            path: `${module.routeBase}/new`,
            name: `${routeNamePrefix}-create`,
            appKey: module.appKey,
            moduleKey: module.moduleKey,
            type: 'create'
          });
        }
      }

      return routes;
    } catch (error) {
      console.error('[UIComposition] Error getting route definitions:', error);
      return [];
    }
  }
}

// Singleton instance
const uiCompositionService = new UICompositionService();

module.exports = uiCompositionService;
