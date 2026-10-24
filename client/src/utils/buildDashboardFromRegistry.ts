/**
 * ============================================================================
 * PLATFORM DASHBOARD: Builder Function
 * ============================================================================
 * 
 * Builds dashboard structure from app registry and user permissions.
 * 
 * Rules:
 * - Registry-driven: All structure comes from appRegistry
 * - Permission-aware: Filters items based on userPermissions
 * - Standard structure: Header, KPIs, Modules, Widgets
 * - Deep links align with sidebar structure
 * 
 * ============================================================================
 */

import type {
  DashboardDefinition,
  DashboardAction,
  DashboardKPI,
  DashboardModuleLink,
  DashboardWidget,
  AppRegistry,
  AppRegistryDashboardEntry,
} from '@/types/dashboard.types';
import { PermissionOutcome } from '@/types/permission-visibility.types';
import type { EmptyStateDefinition } from '@/types/empty-state.types';
import { EmptyStateType } from '@/types/empty-state.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkPermission } from '@/types/permission-snapshot.types';
import { memoizeBuilder } from '@/utils/builderCache';

/**
 * Check if user has a specific permission (using snapshot)
 */
function hasPermission(
  permission: string | undefined,
  snapshot: PermissionSnapshot
): boolean {
  return checkPermission(snapshot, permission);
}

/**
 * Build dashboard actions from registry
 */
function buildActions(
  actions: AppRegistryDashboardEntry['actions'] = [],
  snapshot: PermissionSnapshot
): DashboardAction[] {
  return actions
    .map((action) => {
      const allowed = hasPermission(action.permission, snapshot);
      const visibility = allowed ? PermissionOutcome.ENABLED : PermissionOutcome.HIDDEN;

      return {
        key: action.key,
        label: action.label,
        type: action.type,
        route: action.route,
        permission: action.permission,
        icon: action.icon,
        variant: action.variant || 'primary',
        order: action.order ?? 999,
        visibility,
      };
    })
    .filter((action) => action.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build dashboard KPIs from registry
 * 
 * Note: KPI values must be fetched from API based on the KPI definition.
 * This function only builds the structure, not the actual values.
 */
function buildKPIs(
  kpis: AppRegistryDashboardEntry['kpis'] = [],
  snapshot: PermissionSnapshot
): DashboardKPI[] {
  return kpis
    .map((kpi) => {
      const allowed = hasPermission(kpi.permission, snapshot);
      const visibility = allowed ? PermissionOutcome.ENABLED : PermissionOutcome.HIDDEN;

      return {
        key: kpi.key,
        label: kpi.label,
        value: 0, // Placeholder - must be fetched from API
        timeScope: kpi.timeScope,
        permission: kpi.permission,
        icon: kpi.icon,
        variant: kpi.variant || 'default',
        linkTo: kpi.linkTo,
        order: kpi.order ?? 999,
        visibility,
      };
    })
    .filter((kpi) => kpi.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build dashboard module links from registry
 * 
 * Modules align with sidebar structure - same moduleKey and route.
 */
function buildModuleLinks(
  modules: Array<{
    moduleKey: string;
    label: string;
    route: string;
    permission?: string;
    icon?: string;
    order?: number;
  }> = [],
  snapshot: PermissionSnapshot
): DashboardModuleLink[] {
  return modules
    .map((module) => {
      const allowed = hasPermission(module.permission, snapshot);
      const visibility = allowed ? PermissionOutcome.ENABLED : PermissionOutcome.HIDDEN;

      return {
        moduleKey: module.moduleKey,
        label: module.label,
        route: module.route,
        permission: module.permission,
        icon: module.icon,
        order: module.order ?? 999,
        visibility,
      };
    })
    .filter((module) => module.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Build dashboard widgets from registry
 * 
 * Note: Widget data must be fetched from API based on widget type.
 * This function only builds the structure, not the actual data.
 */
function buildWidgets(
  widgets: AppRegistryDashboardEntry['widgets'] = [],
  snapshot: PermissionSnapshot
): DashboardWidget[] {
  return widgets
    .map((widget) => {
      const allowed = hasPermission(widget.permission, snapshot);
      const visibility = allowed ? PermissionOutcome.ENABLED : PermissionOutcome.HIDDEN;

      return {
        key: widget.key,
        type: widget.type,
        title: widget.title,
        data: null, // Placeholder - must be fetched from API
        permission: widget.permission,
        order: widget.order ?? 999,
        visibility,
      };
    })
    .filter((widget) => widget.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Determine dashboard-level empty state based on:
 * - Permission outcomes
 * - Presence of modules/actions/KPIs/widgets
 * - Optional registry-provided empty state overrides
 *
 * Rules:
 * - App visible, no modules enabled        → NOT_CONFIGURED
 * - User can see app but has no access    → NO_ACCESS
 * - FIRST_TIME, NO_DATA, DISABLED handled by API/module-level builders
 */
function determineDashboardEmptyState(
  appKey: string,
  dashboardConfig: Partial<AppRegistryDashboardEntry>,
  dashboard: DashboardDefinition
): EmptyStateDefinition | undefined {
  const overrides = dashboardConfig.emptyStates || {};

  const anyEnabledModule = dashboard.modules.some(
    (m) => m.visibility === PermissionOutcome.ENABLED
  );

  // Case 1: App visible but no enabled modules → NOT_CONFIGURED
  if (!anyEnabledModule) {
    return (
      overrides[EmptyStateType.NOT_CONFIGURED] || {
        type: EmptyStateType.NOT_CONFIGURED,
        title: 'This app is not set up yet',
        description:
          'Enable at least one module to start using this app. Modules are the lists and features that make the app useful.',
        primaryAction: {
          label: 'Enable modules',
          route: `/settings/apps?app=${encodeURIComponent(appKey)}`,
        },
      }
    );
  }

  // Case 2: User has modules but no actions/KPIs/widgets → Show dashboard with modules only
  // Modules are sufficient to show the dashboard, so we don't need an empty state here.
  // The dashboard will show module links even if actions/KPIs/widgets are empty.
  
  // Only show NO_ACCESS if user truly has no access to anything (no modules, no actions, no KPIs, no widgets)
  // This case is already handled by Case 1 (no modules), so we can skip this check.

  // Other empty states (FIRST_TIME, NO_DATA, DISABLED) are handled at API/module level.
  return undefined;
}

/**
 * Build complete dashboard definition from registry and permissions
 * 
 * @param appKey - The application key (e.g., 'SALES', 'HELPDESK')
 * @param appRegistry - The app registry containing all apps and their dashboards
 * @param snapshot - Permission snapshot (use createPermissionSnapshot to create)
 * @returns Complete dashboard definition
 */
export function buildDashboardFromRegistry(
  appKey: string,
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot
): DashboardDefinition | null {
  // Find app in registry
  const app = appRegistry[appKey];
  
  if (!app) {
    console.warn(`App ${appKey} not found in registry`);
    return null;
  }
  
  // Use memoization for performance
  return memoizeBuilder(
    'buildDashboardFromRegistry',
    appRegistry,
    snapshot,
    appKey,
    undefined,
    () => {
      // Get dashboard configuration from registry
      const dashboardConfig: Partial<AppRegistryDashboardEntry> = app.dashboard || {};
      
      // Build dashboard definition
      const dashboard: DashboardDefinition = {
        version: 1,
        appKey: app.appKey,
        title: dashboardConfig.title || app.label,
        description: dashboardConfig.description,
        actions: buildActions(dashboardConfig.actions, snapshot),
        kpis: buildKPIs(dashboardConfig.kpis, snapshot),
        modules: buildModuleLinks(app.modules, snapshot),
        widgets: buildWidgets(dashboardConfig.widgets, snapshot),
        emptyState: undefined,
      };

      // Decide dashboard-level empty state (builders, not UI, make this decision)
      dashboard.emptyState = determineDashboardEmptyState(appKey, dashboardConfig, dashboard);
      
      // Validate KPI count (3-6 recommended)
      if (dashboard.kpis.length > 0 && (dashboard.kpis.length < 3 || dashboard.kpis.length > 6)) {
        console.warn(
          `Dashboard for ${appKey} has ${dashboard.kpis.length} KPIs. Recommended: 3-6 KPIs.`
        );
      }
      
      return dashboard;
    }
  );
}
