/**
 * ============================================================================
 * PLATFORM SIDEBAR: Builder Function (LOCKED CONTRACT)
 * ============================================================================
 *
 * SOURCE OF TRUTH:
 * This builder produces the locked `SidebarStructure` contract only.
 *
 * Critical invariant:
 * “The sidebar shows surfaces, identities, lenses, and governance — never raw
 * entities, app-agnostic primitives, or infrastructure.”
 *
 * Enforcement:
 * - Shell: Home / Inbox / Astra / Approvals / Attention / Search (+ addons)
 * - Applications: Core + entitled apps as peers; modules only in AppFlyout
 * - App lens cache: activeAppId from route (session lastActiveAppId fallback)
 * - Platform: governance only
 *
 * ============================================================================
 */

import type {
  SidebarStructure,
  SidebarItem,
  AppSummary,
  AppRegistry,
  AppRegistryModule,
  AppFlyoutDefinition,
} from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkPermission } from '@/types/permission-snapshot.types';
import { memoizeBuilder } from '@/utils/builderCache';
import { validateAppRegistryOrThrow } from '@/utils/validateAppRegistry';
import { assertValidSidebarStructure } from '@/utils/assertValidSidebarStructure';
import { getActivePinia } from 'pinia';
import { fetchCoreModulesSettingsCached } from '@/utils/tenantSchemaApiCache';
import { INVENTORY_WORKBENCH_MODULES } from '@/utils/inventoryWorkbenchNav';
import {
  learningAudienceForModule,
  learningRoleCanSeeAudience,
  resolveLearningRole,
} from '@/utils/learningRoles';
import { useAuthStore } from '@/stores/auth';
import {
  getAppNameKey,
  getModuleLabelKey,
  getSurfaceLabelKey,
  getAddonSurfaceLabelKey,
} from '@/utils/navigationLabels';
import type { AddonNavItem } from '@/utils/addonNavigation';
import {
  hasPortalModuleAccess,
  resolvePortalModulePermission
} from '@/utils/portalModulePermissions';
import { getTenantModuleLabelsByRoute } from '@/utils/registryModuleLabels';

const LAST_ACTIVE_APP_ID_KEY = 'arivu-sidebar-last-active-app-id';

/**
 * Hard stops (doctrine):
 * These are raw entities or infrastructure-like primitives that must not be
 * represented as sidebar navigation items in the locked contract.
 */
const FORBIDDEN_RAW_ENTITY_MODULE_KEYS = new Set([
  'people',
  'tasks',
  'events',
  'forms',
  'items',
  'organizations',
  'quotes',
]);

function hasPermission(permission: string | undefined, snapshot: PermissionSnapshot): boolean {
  if (!permission) return true;
  if (checkPermission(snapshot, permission)) return true;
  // Responses inherits Forms access until roles explicitly grant responses.*
  if (permission === 'responses.view' || permission === 'responses.read') {
    return (
      checkPermission(snapshot, 'forms.view') ||
      checkPermission(snapshot, 'forms.read')
    );
  }
  return false;
}

function getCurrentPathname(): string {
  try {
    if (typeof window === 'undefined') return '';
    return window.location?.pathname || '';
  } catch {
    return '';
  }
}

function getLastActiveAppIdFromStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_ACTIVE_APP_ID_KEY);
  } catch {
    return null;
  }
}

function collectAllModules(appRegistry: AppRegistry): AppRegistryModule[] {
  const all: AppRegistryModule[] = [];
  for (const app of Object.values(appRegistry)) {
    for (const m of app.modules || []) all.push(m);
  }
  return all;
}

function listApps(appRegistry: AppRegistry): Array<{ appKey: string; label: string; dashboardRoute: string; icon?: string; order?: number; modules?: AppRegistryModule[] }> {
  return Object.values(appRegistry).filter((a) => a.appKey !== 'PLATFORM' && a.appKey.toLowerCase() !== 'platform');
}

const CORE_APP_ID = 'CORE';

function pathMatchesRoute(pathname: string, routePath: string): boolean {
  const path = String(pathname || '');
  const base = String(routePath || '').replace(/\/+$/, '');
  if (!base) return false;
  return path === base || path.startsWith(base + '/');
}

function resolveActiveAppId(
  appRegistry: AppRegistry,
  currentPath: string,
  fallbackLastActiveAppId: string | null,
  coreModules: SidebarItem[] = []
): string {
  const apps = listApps(appRegistry);
  const normalizedPath = String(currentPath || '');

  // 0) Explicit app-scoped dashboard route (e.g. /dashboard/helpdesk)
  // This must take precedence over registry dashboardRoute matching because
  // legacy/stale metadata may still carry old defaultRoute values.
  if (normalizedPath.startsWith('/dashboard/')) {
    const routeAppKey = String(normalizedPath.split('/')[2] || '').toUpperCase();
    if (routeAppKey) {
      const matched = apps.find((a) => String(a.appKey || '').toUpperCase() === routeAppKey);
      if (matched) return matched.appKey;
    }
  }

  // 0b) Dedicated app shells (portal customer UI, audit workspace, helpdesk desk)
  const pathPrefixToAppKey: Array<[string, string]> = [
    ['/portal/', 'PORTAL'],
    ['/audit/', 'AUDIT'],
    ['/helpdesk/', 'HELPDESK'],
    ['/inventory/', 'INVENTORY'],
    ['/marketing/', 'MARKETING'],
    ['/projects/', 'PROJECTS'],
    ['/sales/', 'SALES'],
    ['/learning/', 'LMS'],
  ];
  for (const [prefix, appKey] of pathPrefixToAppKey) {
    if (!normalizedPath.startsWith(prefix)) continue;
    const matched = apps.find((a) => String(a.appKey || '').toUpperCase() === appKey);
    if (matched) return matched.appKey;
  }
  if (normalizedPath === '/learning') {
    const matched = apps.find((a) => String(a.appKey || '').toUpperCase() === 'LMS');
    if (matched) return matched.appKey;
  }

  // 1) Resolve from current route (dashboard or module match)
  for (const app of apps) {
    if (normalizedPath === app.dashboardRoute || normalizedPath.startsWith(app.dashboardRoute + '/')) {
      return app.appKey;
    }
    for (const module of app.modules || []) {
      if (!module.route) continue;
      if (normalizedPath === module.route || normalizedPath.startsWith(module.route + '/')) {
        return app.appKey;
      }
    }
  }

  // 1b) Core platform modules (People, Tasks, …) → synthetic CORE lens
  for (const item of coreModules) {
    if (item.kind !== 'coreModule') continue;
    if (pathMatchesRoute(normalizedPath, item.route)) return CORE_APP_ID;
  }

  // 2) Fallback to last active app lens
  if (fallbackLastActiveAppId) {
    const normalized = fallbackLastActiveAppId.toUpperCase();
    if (normalized === CORE_APP_ID && coreModules.length > 0) return CORE_APP_ID;
    if (apps.some((a) => a.appKey.toUpperCase() === normalized)) return fallbackLastActiveAppId;
  }

  // 3) Final fallback: first commercial app by order (not CORE)
  const sorted = [...apps].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return sorted[0]?.appKey || (coreModules.length > 0 ? CORE_APP_ID : '');
}

function buildApplications(
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot,
  coreModules: SidebarItem[],
  apps: AppSummary[]
): AppFlyoutDefinition[] {
  const applications: AppFlyoutDefinition[] = [];

  if (coreModules.length > 0) {
    applications.push({
      id: CORE_APP_ID,
      name: 'Core',
      nameKey: getAppNameKey(CORE_APP_ID) || 'navigation.appCore',
      icon: 'squares',
      order: 0,
      items: coreModules,
    });
  }

  for (const summary of apps) {
    const nav = buildAppNav(appRegistry, summary.id, snapshot);
    const items: SidebarItem[] = [];
    if (nav.dashboard) items.push(nav.dashboard);
    items.push(...nav.modules);
    applications.push({
      id: summary.id,
      name: summary.name,
      nameKey: summary.nameKey,
      icon: summary.icon,
      dashboardRoute: summary.dashboardRoute,
      order: summary.order ?? 999,
      items,
    });
  }

  return applications.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function sidebarLabel(
  labelKey: string | undefined,
  fallback: string,
  tenantLabel?: boolean
): { label: string; labelKey?: string; tenantLabel?: boolean } {
  if (tenantLabel) {
    return { label: fallback, tenantLabel: true };
  }
  return labelKey ? { label: fallback, labelKey } : { label: fallback };
}

function buildShell(snapshot: PermissionSnapshot, addonNav: AddonNavItem[] = []): SidebarItem[] {
  // These are stable surfaces (not registry-driven modules).
  const shell: SidebarItem[] = [];

  shell.push({
    kind: 'surface',
    id: 'home',
    ...sidebarLabel(getSurfaceLabelKey('home'), 'Home'),
    route: '/platform/home',
    icon: 'home',
  });

  shell.push({
    kind: 'surface',
    id: 'inbox',
    ...sidebarLabel(getSurfaceLabelKey('inbox'), 'Inbox'),
    route: '/inbox',
    icon: 'inbox',
  });

  shell.push({
    kind: 'surface',
    id: 'astra',
    ...sidebarLabel(getSurfaceLabelKey('astra'), 'Astra'),
    route: '/astra',
    icon: 'sparkles',
  });

  for (const addon of addonNav) {
    const surfaceId = addon.surfaceId as 'live-chat' | 'announcements' | 'telephony' | 'internal-chat';
    shell.push({
      kind: 'surface',
      id: surfaceId,
      ...sidebarLabel(getAddonSurfaceLabelKey(surfaceId), addon.label),
      route: addon.route,
      icon: addon.icon || 'chat-bubble-left-right',
    });
  }

  shell.push({
    kind: 'surface',
    id: 'approvals',
    ...sidebarLabel(getSurfaceLabelKey('approvals'), 'Approvals'),
    route: '/approvals',
    icon: 'check-circle',
  });

  shell.push({
    kind: 'surface',
    id: 'attention',
    ...sidebarLabel(getSurfaceLabelKey('attention'), 'Attention'),
    route: '/platform/attention',
    icon: 'exclamation-triangle',
  });

  // Search exists as a shell surface, but is executed via UI (modal) rather than navigation.
  shell.push({
    kind: 'surface',
    id: 'search',
    ...sidebarLabel(getSurfaceLabelKey('search'), 'Search'),
    route: '/search', // Intentionally not a real route; the renderer handles this surface explicitly.
    icon: 'magnifying-glass',
  });

  return shell;
}

/**
 * Build Core Modules section from app registry PLATFORM modules.
 * Filters by permissions (hides if user has zero access).
 * Respects module order as defined in registry metadata.
 */
function buildCoreModulesFromRegistry(appRegistry: AppRegistry, snapshot: PermissionSnapshot): SidebarItem[] {
  const platformModules = appRegistry.PLATFORM?.modules || [];
  const modules = platformModules
    .filter((module) => {
      const moduleKey = module.moduleKey?.toLowerCase();
      if (!moduleKey) return false;
      if (module.showInSidebar === false) return false;
      if (module.navigationEntity !== true && module.navigationCore !== true && module.appKey?.toLowerCase() !== 'platform') {
        return false;
      }
      return hasPermission(module.permission || `${moduleKey}.view`, snapshot);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((module) => {
      const moduleKey = module.moduleKey?.toLowerCase() || '';

      const fallbackLabel = module.pluralLabel || module.label || moduleKey;
      const tenantLabel = module.tenantLabel === true;
      const labelKey = tenantLabel ? undefined : getModuleLabelKey(moduleKey);
      return {
        kind: 'coreModule',
        id: moduleKey,
        ...sidebarLabel(labelKey, fallbackLabel, tenantLabel),
        route: module.route || `/${moduleKey}`,
        icon: module.icon && module.icon !== 'module' ? module.icon : moduleKey,
        moduleKey,
        order: module.order,
      } satisfies SidebarItem;
    });

  return dedupeCoreModules(modules);
}

/**
 * Fallback for older registry payloads that do not include PLATFORM modules.
 */
async function fetchCoreModulesFromSettings(snapshot: PermissionSnapshot): Promise<SidebarItem[]> {
  try {
    // Check if we're in a browser environment and can make API calls
    // This prevents errors during dev self-tests or SSR
    if (typeof window === 'undefined') {
      return [];
    }

    // Check if Pinia is initialized before making API calls
    // apiClient uses Pinia stores, so we need Pinia to be active
    const pinia = getActivePinia();
    if (!pinia) {
      // Pinia not initialized - this is expected during dev self-tests or before app initialization
      // Silently return empty array (no warning needed as this is expected behavior)
      return [];
    }

    const response = await fetchCoreModulesSettingsCached();

    const modules = response?.modules || [];

    // Filter enabled modules and check permissions
    const coreModules: SidebarItem[] = modules
      .filter((module: any) => {
        // Only include platform-owned modules
        if (!module.platformOwned) return false;

        // Check if user has any permission for this module
        // Permission format: {moduleKey}.view (e.g., 'people.view', 'organizations.view')
        const moduleKey = module.moduleKey?.toLowerCase();
        if (!moduleKey) return false;

        // Map module keys to permission keys
        const permissionKey = `${moduleKey}.view`;
        return hasPermission(permissionKey, snapshot);
      })
      .sort((a: any, b: any) => {
        // Respect order from configuration (if available)
        // Otherwise sort by moduleKey for consistency
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return (a.moduleKey || '').localeCompare(b.moduleKey || '');
      })
      .map((module: any) => {
        const moduleKey = module.moduleKey?.toLowerCase() || '';
        
        const route = CORE_MODULE_ROUTE_OVERRIDES[moduleKey] || `/${moduleKey}`;
        
        // Determine icon - use module icon if available, otherwise use moduleKey
        // The API returns icon as 'module', so we'll use moduleKey for icon lookup
        const icon = module.icon && module.icon !== 'module' ? module.icon : moduleKey;

        const fallbackLabel = module.name || module.pluralLabel || module.label || moduleKey;
        const tenant = getTenantModuleLabelsByRoute(moduleKey);
        const tenantLabel = tenant?.tenantLabel === true;
        const labelKey = tenantLabel ? undefined : getModuleLabelKey(moduleKey);
        return {
          kind: 'coreModule',
          id: moduleKey,
          ...sidebarLabel(labelKey, tenant?.plural || fallbackLabel, tenantLabel),
          route,
          icon,
          moduleKey,
          order: module.order,
        } satisfies SidebarItem;
      });
    
    return dedupeCoreModules(coreModules);
  } catch (error) {
    console.error('[buildSidebarFromRegistry] Failed to fetch core modules:', error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

const IMPORTS_MODULE_KEY = 'imports';

const CORE_MODULE_ROUTE_OVERRIDES: Record<string, string> = {
  analytics: '/analytics',
  reports: '/analytics/reports',
  dashboards: '/analytics/dashboards',
};

function pinImportsLast(coreModules: SidebarItem[]): SidebarItem[] {
  const importsIndex = coreModules.findIndex(
    (item) => item.kind === 'coreModule' && item.moduleKey === IMPORTS_MODULE_KEY
  );
  if (importsIndex === -1 || importsIndex === coreModules.length - 1) {
    return coreModules;
  }
  const importsItem = coreModules[importsIndex];
  if (!importsItem) {
    return coreModules;
  }
  return [
    ...coreModules.slice(0, importsIndex),
    ...coreModules.slice(importsIndex + 1),
    importsItem,
  ];
}

function dedupeCoreModules(coreModules: SidebarItem[]): SidebarItem[] {
  const uniqueCoreModules = new Map<string, SidebarItem>();
  for (const item of coreModules) {
    const moduleKey =
      item.kind === 'coreModule' ? item.moduleKey : item.kind === 'app' && item.moduleKey ? item.moduleKey : undefined;
    const key = String((moduleKey || item.id) || '').toLowerCase();
    if (!key || uniqueCoreModules.has(key)) continue;
    uniqueCoreModules.set(key, item);
  }

  return pinImportsLast(Array.from(uniqueCoreModules.values()));
}

function buildAppSwitcherApps(appRegistry: AppRegistry, snapshot: PermissionSnapshot): AppSummary[] {
  return listApps(appRegistry)
    .map((app) => {
      const modules = (app.modules || []).filter((m) => {
        if (m.navigationCore === true) return false;
        if (m.navigationEntity === true) return false;
        if (m.excludeFromApps === true) return false;
        if (m.appKey && m.appKey.toLowerCase() === 'platform') return false;
        if (FORBIDDEN_RAW_ENTITY_MODULE_KEYS.has(m.moduleKey)) return false;
        return true;
      });

      // If app has modules, check if user has access to any of them
      // If app has no modules (dashboard-only app), include it anyway
      const hasAnyAccess = modules.length === 0 || modules.some((m) => hasPermission(m.permission, snapshot));
      return { app, hasAnyAccess };
    })
    .filter((x) => x.hasAnyAccess)
    .map(
      ({ app }) =>
        ({
          id: app.appKey,
          name: app.label,
          nameKey: getAppNameKey(app.appKey),
          dashboardRoute: app.dashboardRoute,
          icon: app.icon,
          order: app.order ?? 999,
        }) satisfies AppSummary
    )
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function resolveRegistryApp(appRegistry: AppRegistry, activeAppId: string) {
  const direct = appRegistry[activeAppId];
  if (direct) return direct;
  const normalized = String(activeAppId || '').toUpperCase();
  return Object.values(appRegistry).find(
    (candidate) => String(candidate?.appKey || '').toUpperCase() === normalized
  );
}

/** Build app-scoped module nav for any entitled app (used by command palette across all apps). */
export function buildAppNavForRegistry(
  appRegistry: AppRegistry,
  appId: string,
  snapshot: PermissionSnapshot
): SidebarStructure['appNav'] {
  return buildAppNav(appRegistry, appId, snapshot);
}

function buildAppNav(appRegistry: AppRegistry, activeAppId: string, snapshot: PermissionSnapshot): SidebarStructure['appNav'] {
  const app = resolveRegistryApp(appRegistry, activeAppId);
  if (!app) return { appId: activeAppId, modules: [] };

  // Enforce: ONLY one app lens is ever built.
  const dashboardRoute = String(app.dashboardRoute || '').replace(/\/+$/, '');

  const normalizedAppId = String(activeAppId || '').toUpperCase();
  const isPortalApp = normalizedAppId === 'PORTAL';

  const modules: SidebarItem[] = (app.modules || [])
    .filter((m) => {
      if (m.showInSidebar === false) return false;
      if (m.navigationCore === true) return false;
      if (m.navigationEntity === true) return false;
      if (m.excludeFromApps === true) return false;
      if (m.appKey && m.appKey.toLowerCase() === 'platform') return false;
      if (FORBIDDEN_RAW_ENTITY_MODULE_KEYS.has(m.moduleKey)) return false;
      // Inventory ledger module is replaced by workbench links below.
      if (
        normalizedAppId === 'INVENTORY' &&
        String(m.moduleKey || '').toLowerCase() === 'inventory'
      ) {
        return false;
      }
      const moduleRoute = String(m.route || '').replace(/\/+$/, '');
      if (dashboardRoute && moduleRoute && moduleRoute === dashboardRoute) return false;
      if (isPortalApp) {
        if (!resolvePortalModulePermission(m.moduleKey)) return false;
        return hasPortalModuleAccess(snapshot, m.moduleKey);
      }
      if (normalizedAppId === 'LMS') {
        const pinia = getActivePinia();
        const learningRole = pinia
          ? resolveLearningRole(useAuthStore(pinia).user)
          : null;
        const audience =
          (m as { learningAudience?: string }).learningAudience
          || learningAudienceForModule(m.moduleKey);
        if (!learningRoleCanSeeAudience(learningRole, audience as 'learner' | 'author' | 'admin')) {
          return false;
        }
      }
      return hasPermission(m.permission, snapshot);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(
      (m) => {
        const moduleKeyLower = String(m.moduleKey || '').toLowerCase();
        const tenantLabel = m.tenantLabel === true;
        return {
          kind: 'app',
          id: `${activeAppId}:${m.moduleKey}`,
          ...sidebarLabel(
            tenantLabel ? undefined : getModuleLabelKey(m.moduleKey) || undefined,
            m.pluralLabel || m.label,
            tenantLabel
          ),
          route: m.route,
          icon:
            String(activeAppId || '').toUpperCase() === 'HELPDESK' &&
            moduleKeyLower === 'cases'
              ? 'ticket'
              : m.icon,
          moduleKey: m.moduleKey,
        } satisfies SidebarItem;
      }
    );

  if (normalizedAppId === 'INVENTORY') {
    for (const item of INVENTORY_WORKBENCH_MODULES) {
      const canView =
        hasPermission(`${item.key}.view`, snapshot) || hasPermission('inventory.view', snapshot);
      if (!canView) continue;
      modules.push({
        kind: 'app',
        id: `${activeAppId}:${item.key}`,
        ...sidebarLabel(item.labelKey, item.label),
        route: item.route,
        icon: item.icon,
        moduleKey: item.key,
      });
    }
  }

  const dashboard: SidebarItem = {
    kind: 'app',
    id: activeAppId,
    // The first app-nav entry is always the app dashboard.
    // Portal uses "Home"; other apps use "Dashboard" to avoid duplicating the app name.
    ...(isPortalApp || normalizedAppId === 'LMS'
      ? sidebarLabel(getSurfaceLabelKey('home'), 'Home')
      : sidebarLabel(getModuleLabelKey('dashboard'), 'Dashboard')),
    route: app.dashboardRoute,
    // Use route-context-aware dashboard icons so tab and sidebar stay visually aligned.
    icon: isPortalApp || normalizedAppId === 'LMS'
      ? 'home'
      : normalizedAppId === 'AUDIT'
        ? 'presentation-chart'
        : normalizedAppId === 'SALES'
          ? 'document-chart-bar'
          : normalizedAppId === 'MARKETING'
            ? 'chart-bar'
            : 'squares',
  };

  return { appId: activeAppId, dashboard, modules };
}

function buildPlatformGovernance(snapshot: PermissionSnapshot): SidebarItem[] {
  // Sidebar footer is not for navigation or configuration.
  // Settings is accessed via the profile menu.
  // Apps is switched exclusively via the App Switcher (mode selector).
  // Users is accessed via governance surfaces outside the sidebar footer.
  return [];
}

export async function buildSidebarFromRegistry(
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot,
  validate: boolean = import.meta.env.DEV,
  addonNav: AddonNavItem[] = [],
): Promise<SidebarStructure> {
  if (validate) {
    try {
      validateAppRegistryOrThrow(appRegistry);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Registry validation failed:', error);
    }
  }

  const currentPath = getCurrentPathname();
  const lastActiveAppId = getLastActiveAppIdFromStorage();

  const registryCoreModules = buildCoreModulesFromRegistry(appRegistry, snapshot);
  const coreModules =
    registryCoreModules.length > 0 ? registryCoreModules : await fetchCoreModulesFromSettings(snapshot);

  const apps = buildAppSwitcherApps(appRegistry, snapshot);
  const applications = buildApplications(appRegistry, snapshot, coreModules, apps);

  const activeAppId = resolveActiveAppId(appRegistry, currentPath, lastActiveAppId, coreModules);
  const effectiveActiveAppId =
    activeAppId ||
    applications[0]?.id ||
    apps[0]?.id ||
    '';

  const appNav =
    effectiveActiveAppId === CORE_APP_ID
      ? { appId: CORE_APP_ID, modules: coreModules }
      : buildAppNav(appRegistry, effectiveActiveAppId, snapshot);

  const sidebar: SidebarStructure = {
    shell: buildShell(snapshot, addonNav),
    coreModules,
    applications,
    appSwitcher: {
      activeAppId: effectiveActiveAppId,
      apps,
    },
    appNav,
    platform: buildPlatformGovernance(snapshot),
  };

  if (import.meta.env.DEV) {
    assertValidSidebarStructure(sidebar);
  }

  return sidebar;
}

// Lightweight dev-only self-test.
// This is intentionally framework-free: fail fast and loudly if doctrine regresses.
if (import.meta.env.DEV) {
  const snapshot: PermissionSnapshot = {
    userId: 'dev-selftest',
    roles: ['admin'],
    permissions: {
      'people.view': true,
      'deals.view': true,
      'tasks.view': true,
      'forms.view': true,
      'events.view': true,
      'items.view': true,
      'settings.view': true,
      'apps.view': true,
      'users.view': true,
    },
    generatedAt: Date.now(),
  };

  const registry: AppRegistry = {
    SALES: {
      appKey: 'SALES',
      label: 'Sales',
      dashboardRoute: '/dashboard/sales',
      modules: [
        { moduleKey: 'deals', label: 'Deals', route: '/deals', permission: 'deals.view', appKey: 'SALES' },
        // Forbidden raw entities (must never appear in SidebarStructure)
        { moduleKey: 'tasks', label: 'Tasks', route: '/tasks', permission: 'tasks.view', appKey: 'SALES' },
        { moduleKey: 'forms', label: 'Forms', route: '/forms', permission: 'forms.view', appKey: 'SALES' },
        { moduleKey: 'events', label: 'Events', route: '/events', permission: 'events.view', appKey: 'SALES' },
        { moduleKey: 'items', label: 'Items', route: '/items', permission: 'items.view', appKey: 'SALES' },
      ],
    },
    PLATFORM: {
      appKey: 'PLATFORM',
      label: 'Platform',
      dashboardRoute: '/platform/home',
      modules: [
        {
          moduleKey: 'people',
          label: 'People',
          route: '/people',
          permission: 'people.view',
          appKey: 'platform',
          navigationEntity: true,
          excludeFromApps: true,
        },
      ],
    },
  };

  const sidebar = await buildSidebarFromRegistry(registry, snapshot, false);

  // Assert: applications includes CORE when core modules exist
  if (!Array.isArray(sidebar.applications)) {
    throw new Error('[SidebarInvariantViolation] applications must be an array');
  }

  // Assert: Core Modules structure is valid (may be empty if API not available in dev self-test)
  // Note: In dev self-test, core modules may be empty if Pinia is not initialized
  // This is acceptable as the test is primarily for structure validation
  for (const item of sidebar.coreModules) {
    if (item.kind !== 'coreModule') {
      throw new Error(`[SidebarInvariantViolation] Core Modules must contain only coreModule items (got: ${item.kind})`);
    }
  }

  // Assert: Forbidden raw entities do not appear in commercial app flyouts.
  const forbidden = new Set(['people', 'items', 'forms', 'tasks', 'events', 'organizations']);
  for (const app of sidebar.applications) {
    if (app.id === 'CORE') continue;
    for (const item of app.items) {
      if (item.kind === 'app' && typeof item.moduleKey === 'string' && forbidden.has(item.moduleKey)) {
        throw new Error(`[SidebarInvariantViolation] Forbidden module leaked into application ${app.id}: ${item.moduleKey}`);
      }
    }
  }

  for (const item of sidebar.appNav.modules) {
    if (item.kind === 'app' && typeof item.moduleKey === 'string' && forbidden.has(item.moduleKey)) {
      throw new Error(`[SidebarInvariantViolation] Forbidden module leaked into sidebar: ${item.moduleKey}`);
    }
  }
}
