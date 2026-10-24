/**
 * ============================================================================
 * PLATFORM DASHBOARD: Pure Data Contract
 * ============================================================================
 * 
 * This file defines the dashboard schema as a pure data contract:
 * - No UI logic
 * - No Vue/React specifics
 * - Registry-driven and permission-aware
 * - Standard structure for all apps
 * 
 * Every app dashboard must conform to this contract.
 * 
 * ============================================================================
 */

import type { EmptyStateDefinition } from './empty-state.types';
import { EmptyStateType } from './empty-state.types';
import { PermissionOutcome } from './permission-visibility.types';

/**
 * Dashboard Action
 * 
 * Primary actions available in the dashboard header.
 * Examples: Create Contact, Import Data, Configure Settings
 */
export interface DashboardAction {
  /** Unique action identifier */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Action type */
  type: 'create' | 'import' | 'configure' | 'export' | 'custom';
  
  /** Route or URL for the action */
  route?: string;
  
  /** Optional permission required to show this action */
  permission?: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional variant (primary, secondary, etc.) */
  variant?: 'primary' | 'secondary' | 'outline';
  
  /** Optional display order */
  order?: number;

  /** Permission outcome for this action */
  visibility: PermissionOutcome;
}

/**
 * Dashboard KPI (Key Performance Indicator)
 * 
 * Summary metrics displayed on the dashboard.
 * Must be time-scoped and permission-aware.
 */
export interface DashboardKPI {
  /** Unique KPI identifier */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Current value (can be number, string, or formatted) */
  value: number | string;
  
  /** Optional previous value for comparison */
  previousValue?: number | string;
  
  /** Optional change indicator (percentage or absolute) */
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string; // e.g., "vs last week", "vs last month"
  };
  
  /** Time scope for this KPI */
  timeScope: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom';
  
  /** Optional custom date range */
  dateRange?: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  
  /** Permission required to view this KPI */
  permission?: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional color/variant for display */
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  
  /** Optional link to detailed view */
  linkTo?: string;
  
  /** Optional display order */
  order?: number;

  /** Permission outcome for this KPI */
  visibility: PermissionOutcome;
}

/**
 * Dashboard Module Link
 * 
 * Link to a primary module within the app.
 * Deep links align with sidebar structure.
 */
export interface DashboardModuleLink {
  /** Module key (matches sidebar moduleKey) */
  moduleKey: string;
  
  /** Display label */
  label: string;
  
  /** Route path (matches sidebar route) */
  route: string;
  
  /** Optional description */
  description?: string;
  
  /** Permission required to view this module link */
  permission?: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional count/badge value */
  count?: number;
  
  /** Optional display order */
  order?: number;

  /** Permission outcome for this module link */
  visibility: PermissionOutcome;
}

/**
 * Dashboard Widget
 * 
 * Optional widget for activity, insights, recommendations, etc.
 */
export interface DashboardWidget {
  /** Unique widget identifier */
  key: string;
  
  /** Widget type */
  type: 'activity' | 'insights' | 'alerts' | 'recommendations' | 'chart' | 'custom';
  
  /** Display title */
  title: string;
  
  /** Widget data (structure depends on type; builders leave this empty until the API fills it) */
  data: unknown;
  
  /** Permission required to view this widget */
  permission?: string;
  
  /** Optional display order */
  order?: number;

  /** Permission outcome for this widget */
  visibility: PermissionOutcome;
}

/**
 * Activity Item
 * 
 * Represents a recent activity entry.
 */
export interface ActivityItem {
  /** Unique identifier */
  id: string;
  
  /** Activity type */
  type: string; // e.g., 'contact_created', 'deal_updated'
  
  /** Display message */
  message: string;
  
  /** Timestamp */
  timestamp: string; // ISO date string
  
  /** Optional entity reference */
  entity?: {
    type: string;
    id: string;
    name: string;
    route?: string;
  };
  
  /** Optional user who performed the action */
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

/**
 * Alert Item
 * 
 * Represents an alert or notification.
 */
export interface AlertItem {
  /** Unique identifier */
  id: string;
  
  /** Alert type */
  type: 'info' | 'warning' | 'error' | 'success';
  
  /** Display title */
  title: string;
  
  /** Display message */
  message: string;
  
  /** Optional action link */
  actionLink?: string;
  
  /** Optional action label */
  actionLabel?: string;
  
  /** Timestamp */
  timestamp: string; // ISO date string
}

/**
 * Recommendation Item
 * 
 * Represents a recommendation or suggestion.
 */
export interface RecommendationItem {
  /** Unique identifier */
  id: string;
  
  /** Recommendation type */
  type: 'tip' | 'action' | 'optimization' | 'feature';
  
  /** Display title */
  title: string;
  
  /** Display message */
  message: string;
  
  /** Optional action link */
  actionLink?: string;
  
  /** Optional action label */
  actionLabel?: string;
}

/**
 * Dashboard Definition
 * 
 * Complete dashboard structure for an app.
 * This is the contract every app dashboard must conform to.
 */
export interface DashboardDefinition {
  /** Contract version (incremented on breaking changes) */
  version: number;
  
  /** Application key (e.g., 'SALES', 'HELPDESK') */
  appKey: string;
  
  /** Dashboard title (typically app name) */
  title: string;
  
  /** Optional description */
  description?: string;
  
  /** Primary actions in header */
  actions: DashboardAction[];
  
  /** Summary KPIs (3-6 metrics) */
  kpis: DashboardKPI[];
  
  /** Primary module links */
  modules: DashboardModuleLink[];
  
  /** Optional widgets (activity, insights, etc.) */
  widgets?: DashboardWidget[];

  /** Optional dashboard-level empty state (e.g., NO_ACCESS, NOT_CONFIGURED, FIRST_TIME) */
  emptyState?: EmptyStateDefinition;
}

/**
 * App Registry Dashboard Entry
 * 
 * Dashboard definition in the app registry.
 */
export interface AppRegistryDashboardEntry {
  /** Application key */
  appKey: string;
  
  /** Dashboard title */
  title: string;
  
  /** Optional description */
  description?: string;
  
  /** Available actions */
  actions?: Array<{
    key: string;
    label: string;
    type: 'create' | 'import' | 'configure' | 'export' | 'custom';
    route?: string;
    permission?: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    order?: number;
  }>;
  
  /** Available KPIs */
  kpis?: Array<{
    key: string;
    label: string;
    timeScope: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom';
    permission?: string;
    icon?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    linkTo?: string;
    order?: number;
  }>;
  
  /** Widgets configuration */
  widgets?: Array<{
    key: string;
    type: 'activity' | 'insights' | 'alerts' | 'recommendations' | 'chart' | 'custom';
    title: string;
    permission?: string;
    order?: number;
  }>;

  /**
   * Optional registry-defined empty states.
   * If not provided, platform defaults are used.
   */
  emptyStates?: {
    [key in EmptyStateType]?: EmptyStateDefinition;
  };
}

/**
 * User Permissions
 * 
 * Map of permission keys to boolean values.
 */
export interface UserPermissions {
  [permissionKey: string]: boolean;
}

/**
 * App Registry
 * 
 * Complete app registry structure with dashboard definitions.
 */
export interface AppRegistry {
  [appKey: string]: {
    appKey: string;
    label: string;
    dashboardRoute: string;
    dashboard?: AppRegistryDashboardEntry;
    modules?: Array<{
      moduleKey: string;
      label: string;
      route: string;
      permission?: string;
      icon?: string;
      order?: number;
    }>;
  };
}
