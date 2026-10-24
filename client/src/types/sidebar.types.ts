/**
 * ============================================================================
 * PLATFORM SIDEBAR: Pure Data Contract
 * ============================================================================
 * 
 * This file defines the sidebar schema as a pure data contract:
 * - No UI logic
 * - No Vue/React specifics
 * - Registry-driven and permission-aware
 *
 * The authoritative contract is `SidebarStructure` below.
 * 
 * ============================================================================
 */

/**
 * ============================================================================
 * SIDEBAR ARCHITECTURE (LOCKED CONTRACT)
 * ============================================================================
 *
 * Critical invariant:
 * “The sidebar shows surfaces, identities, lenses, and governance — never raw
 * entities, app-agnostic primitives, or infrastructure.”
 *
 * This contract is intentionally strict. Callers must encode navigation intent
 * via `SidebarItem.kind` instead of passing "raw entities" or arbitrary objects.
 * ============================================================================
 */

import type { AppRegistryDashboardEntry } from './dashboard.types';
import type { AppRegistryModuleEntry } from './module-list.types';
import type { AppRegistryDetailEntry } from './record-detail.types';

export type AppSummary = {
  /** Stable app identifier (not a domain grouping key). */
  id: string;
  /** Human-friendly app name. */
  name: string;
  /** Optional i18n key (navigation.app*) when registry name should not be shown verbatim. */
  nameKey?: string;
  /**
   * Dashboard route for this app lens.
   * Required so the App Switcher can change context explicitly without guessing routes.
   */
  dashboardRoute: string;
  /** Optional icon identifier for UI mapping. */
  icon?: string;
  /** Optional ordering for display. */
  order?: number;
};

/** Optional vue-i18n key (navigation.*); `label` is English fallback for tests and registry names. */
type SidebarLabelFields = {
  label: string;
  labelKey?: string;
  /** When true, render `label` from tenant registry instead of i18n `labelKey`. */
  tenantLabel?: boolean;
};

export type SidebarItem =
  | ({
      kind: 'surface';
      id: 'home' | 'inbox' | 'live-chat' | 'announcements' | 'telephony' | 'internal-chat' | 'attention' | 'search' | 'trash' | 'approvals' | 'astra';
      route: string;
      icon?: string;
    } & SidebarLabelFields)
  | ({
      kind: 'coreModule';
      id: string; // moduleKey (e.g., 'people', 'organizations', 'tasks', etc.)
      route: string;
      icon?: string;
      moduleKey: string;
      order?: number;
    } & SidebarLabelFields)
  | ({
      kind: 'app';
      id: string;
      route: string;
      icon?: string;
      /**
       * Optional module key for app navigation items.
       * Present for modules; omitted for an app dashboard link.
       */
      moduleKey?: string;
    } & SidebarLabelFields)
  | ({
      kind: 'platform';
      id: string;
      route: string;
      icon?: string;
    } & SidebarLabelFields);

/**
 * Top-level application entry for the app-centric sidebar.
 * Modules render in AppFlyout / AppModuleDrawer — never inline in the rail.
 * `CORE` is a synthetic peer for platform modules (People, Tasks, …).
 */
export type AppFlyoutDefinition = {
  id: string;
  name: string;
  nameKey?: string;
  icon?: string;
  /** Dashboard route when the app has one; omitted for Core. */
  dashboardRoute?: string;
  order?: number;
  /** Flyout rows: optional dashboard + modules (registry-driven). */
  items: SidebarItem[];
};

export interface SidebarStructure {
  /**
   * Shell surfaces — global, cross-app, task-oriented.
   * Examples: Home, Inbox, Search.
   * Never app-specific.
   */
  shell: SidebarItem[];

  /**
   * Core Modules — platform-owned modules (People, Organizations, …).
   * Kept for command palette / builders; rail renders these via `applications` (CORE flyout).
   */
  coreModules: SidebarItem[];

  /**
   * Top-level apps shown in the rail (Core + entitled commercial apps).
   * Modules live in AppModuleDrawer (docked) / AppFlyout (hover peek), not in the rail.
   */
  applications: AppFlyoutDefinition[];

  /**
   * App lens selector — active app derived from route (session fallback).
   * Used for route sync / command palette; rail no longer uses a dropdown.
   */
  appSwitcher: {
    activeAppId: string;
    apps: AppSummary[];
  };

  /**
   * Navigation for the currently active app only (lens cache for palette / sync).
   */
  appNav: {
    appId: string;
    dashboard?: SidebarItem;
    modules: SidebarItem[];
  };

  /**
   * Platform governance — configuration and administration.
   * Not daily work surfaces.
   */
  platform: SidebarItem[];
}

/**
 * App Registry Module Definition
 * 
 * Module definition with navigation intent flags.
 */
export interface AppRegistryModule {
  /** Unique module identifier */
  moduleKey: string;
  
  /** Display label */
  label: string;

  /** Singular display label (tenant override or platform default). */
  singularLabel?: string;

  /** Plural display label (tenant override or platform default). */
  pluralLabel?: string;

  /** List view title, e.g. "All Opportunities". */
  listLabel?: string;

  /** Primary create action label, e.g. "New Opportunity". */
  createLabel?: string;

  /** When true, UI should prefer registry labels over i18n defaults. */
  tenantLabel?: boolean;
  
  /** Route path for navigation */
  route: string;
  
  /** Optional permission key required to view this module */
  permission?: string;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional display order */
  order?: number;

  /** When false, omit from app sidebar (module metadata may still exist for API/routes). */
  showInSidebar?: boolean;
  
  /** Optional app key (if module belongs to an app) */
  appKey?: string;
  
  /** Optional system flag (legacy, for backward compatibility) */
  system?: boolean;
  
  /** Optional core entity flag (legacy, for backward compatibility) */
  coreEntity?: boolean;
  
  /** Navigation intent: Place in Core section (personal/attention layer) */
  navigationCore?: boolean;
  
  /** Navigation intent: Place in Entities section (shared system primitives) */
  navigationEntity?: boolean;
  
  /** Hard stop: Exclude from Apps section (prevents core entities from appearing under apps) */
  excludeFromApps?: boolean;

  /**
   * Optional list view configuration for the module.
   * Used by registry validators and list builders.
   */
  list?: AppRegistryModuleEntry['list'];

  /** Optional record-detail configuration consumed by the detail builder. */
  detail?: AppRegistryDetailEntry;
}

/**
 * App Registry Entry
 * 
 * Expected structure from the app registry for building sidebar.
 */
export interface AppRegistryEntry {
  /** Application key */
  appKey: string;
  
  /** Display label */
  label: string;
  
  /** Dashboard route */
  dashboardRoute: string;
  
  /** Modules available in this app */
  modules?: AppRegistryModule[];
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional display order */
  order?: number;

  /**
   * Optional dashboard composition for this app (KPIs, widgets, actions).
   * Not currently required for the legacy sidebar renderer, but validated if present.
   */
  dashboard?: Partial<AppRegistryDashboardEntry>;
}

/**
 * User Permissions
 * 
 * Structure for user permissions used to filter sidebar items.
 */
export interface UserPermissions {
  /** Map of permission keys to boolean values (e.g., { 'contacts.view': true }) */
  [permissionKey: string]: boolean;
}

/**
 * App Registry
 * 
 * Complete app registry structure.
 */
export interface AppRegistry {
  [appKey: string]: AppRegistryEntry;
}

