/**
 * ============================================================================
 * PLATFORM MODULE LIST: Pure Data Contract
 * ============================================================================
 * 
 * This file defines the module list schema as a pure data contract:
 * - No UI logic
 * - No Vue/React specifics
 * - Registry-driven and permission-aware
 * - Standard structure for all modules
 * 
 * Core Principle: Lists are data contracts, not components.
 * 
 * Every list must explain itself, even when empty.
 * 
 * ============================================================================
 */

import type { PermissionOutcome } from './permission-visibility.types';
import type { EmptyStateDefinition } from './empty-state.types';

/**
 * List Layout Type
 * 
 * Defines how the list is displayed.
 */
export type ListLayout = 'TABLE' | 'BOARD' | 'QUEUE' | 'CARD';

/**
 * Column Data Type
 * 
 * Defines the type of data in a column.
 */
export type ColumnDataType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'status'
  | 'user'
  | 'currency'
  | 'percentage'
  | 'boolean'
  | 'link'
  | 'custom';

/**
 * List Column
 * 
 * Defines a column in the list.
 * Columns must be permission-aware and stable across users.
 */
export interface ListColumn {
  /** Unique column identifier */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Data type */
  dataType: ColumnDataType;
  
  /** Whether column is sortable */
  sortable?: boolean;
  
  /** Whether column is filterable */
  filterable?: boolean;
  
  /** Permission required to view this column */
  permission?: string;
  
  /** Permission outcome (HIDDEN, VISIBLE, ENABLED) */
  visibility: PermissionOutcome;
  
  /** Optional display order */
  order?: number;
  
  /** Optional field path (for data access) */
  fieldPath?: string;
  
  /** Optional default sort order */
  defaultSort?: 'asc' | 'desc';
}

/**
 * Action Type
 * 
 * Defines the type of action.
 */
export type ActionType =
  | 'create'
  | 'view'
  | 'edit'
  | 'delete'
  | 'duplicate'
  | 'export'
  | 'import'
  | 'assign'
  | 'archive'
  | 'restore'
  | 'custom';

/**
 * List Action
 * 
 * Defines an action available in the list.
 * Actions are permission-aware and never checked in UI.
 */
export interface ListAction {
  /** Unique action identifier */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Action type */
  type: ActionType;
  
  /** Route or URL for the action */
  route?: string;
  
  /** Permission required to show this action */
  permission?: string;
  
  /** Permission outcome (HIDDEN, VISIBLE, ENABLED) */
  visibility: PermissionOutcome;
  
  /** Optional icon identifier */
  icon?: string;
  
  /** Optional variant (primary, secondary, danger, etc.) */
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  
  /** Optional display order */
  order?: number;
  
  /** Whether this is a bulk action (applies to multiple items) */
  bulk?: boolean;
}

/**
 * Filter Type
 * 
 * Defines the type of filter.
 */
export type FilterType =
  | 'text'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'daterange'
  | 'number'
  | 'boolean'
  | 'user'
  | 'status';

/**
 * List Filter
 * 
 * Defines a filter available in the list.
 */
export interface ListFilter {
  /** Unique filter identifier */
  key: string;
  
  /** Display label */
  label: string;
  
  /** Filter type */
  type: FilterType;
  
  /** Field path to filter on */
  fieldPath: string;
  
  /** Permission required to use this filter */
  permission?: string;
  
  /** Permission outcome (HIDDEN, VISIBLE, ENABLED) */
  visibility: PermissionOutcome;
  
  /** Optional options (for select/multiselect) */
  options?: Array<{
    value: string | number;
    label: string;
  }>;
  
  /** Optional default value */
  defaultValue?: unknown;
  
  /** Optional display order */
  order?: number;
}

/**
 * Module List Definition
 * 
 * Complete list definition for a module.
 * This is the contract every module list must conform to.
 */
export interface ModuleListDefinition {
  /** Contract version (incremented on breaking changes) */
  version: number;
  
  /** Module key (matches sidebar moduleKey) */
  moduleKey: string;
  
  /** App key */
  appKey: string;
  
  /** List title */
  title: string;
  
  /** Optional description */
  description?: string;
  
  /** List layout */
  layout: ListLayout;
  
  /** Available columns */
  columns: ListColumn[];
  
  /** Primary actions (Create, Import, etc.) */
  primaryActions: ListAction[];
  
  /** Optional bulk actions */
  bulkActions?: ListAction[];
  
  /** Optional row actions */
  rowActions?: ListAction[];
  
  /** Optional filters */
  filters?: ListFilter[];
  
  /** Empty state definition */
  emptyState?: EmptyStateDefinition;
  
  /** Optional default sort */
  defaultSort?: {
    column: string;
    order: 'asc' | 'desc';
  };
  
  /** Optional pagination config */
  pagination?: {
    pageSize: number;
    pageSizeOptions?: number[];
  };
}

/**
 * App Registry Module Entry
 * 
 * Module definition in the app registry.
 */
export interface AppRegistryModuleEntry {
  /** Module key */
  moduleKey: string;
  
  /** Module label */
  label: string;
  
  /** Module route */
  route: string;
  
  /** Permission required */
  permission?: string;
  
  /** Optional icon */
  icon?: string;
  
  /** Optional order */
  order?: number;
  
  /** Optional list configuration */
  list?: {
    layout?: ListLayout;
    columns?: Array<{
      key: string;
      label: string;
      dataType: ColumnDataType;
      sortable?: boolean;
      filterable?: boolean;
      permission?: string;
      fieldPath?: string;
      order?: number;
    }>;
    primaryActions?: Array<{
      key: string;
      label: string;
      type: ActionType;
      route?: string;
      permission?: string;
      icon?: string;
      variant?: 'primary' | 'secondary' | 'danger' | 'outline';
      order?: number;
    }>;
    bulkActions?: Array<{
      key: string;
      label: string;
      type: ActionType;
      permission?: string;
      icon?: string;
      order?: number;
    }>;
    rowActions?: Array<{
      key: string;
      label: string;
      type: ActionType;
      route?: string;
      permission?: string;
      icon?: string;
      order?: number;
    }>;
    filters?: Array<{
      key: string;
      label: string;
      type: FilterType;
      fieldPath: string;
      permission?: string;
      options?: Array<{ value: string | number; label: string }>;
      order?: number;
    }>;
    defaultSort?: {
      column: string;
      order: 'asc' | 'desc';
    };
    pagination?: {
      pageSize: number;
      pageSizeOptions?: number[];
    };
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

