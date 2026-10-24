/**
 * Build Record Detail Definition from App Registry
 * 
 * Constructs a RecordDetailDefinition from the app registry and user permissions.
 * This ensures consistent, permission-aware record detail pages.
 */

import type {
  RecordDetailDefinition,
  DetailField,
  DetailSection,
  DetailTab,
  DetailAction,
  RelatedRecordWidget,
  AppRegistryDetailEntry,
} from '@/types/record-detail.types';
import { PermissionOutcome } from '@/types/permission-visibility.types';
import type { EmptyStateDefinition } from '@/types/empty-state.types';
import { EmptyStateType } from '@/types/empty-state.types';
import type { AppRegistry } from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkPermission } from '@/types/permission-snapshot.types';
import { memoizeBuilder } from '@/utils/builderCache';

/**
 * Get permission outcome for a field/action/tab
 */
function getPermissionOutcome(
  snapshot: PermissionSnapshot,
  permission?: string
): PermissionOutcome {
  if (!permission) {
    return PermissionOutcome.ENABLED;
  }
  return checkPermission(snapshot, permission)
    ? PermissionOutcome.ENABLED
    : PermissionOutcome.HIDDEN;
}

/**
 * Build fields from registry configuration
 */
function buildFields(
  fieldsConfig: AppRegistryDetailEntry['fields'],
  snapshot: PermissionSnapshot
): DetailField[] {
  if (!fieldsConfig || fieldsConfig.length === 0) {
    return [];
  }

  return fieldsConfig
    .map((field) => ({
      key: field.key,
      label: field.label,
      dataType: field.dataType,
      fieldPath: field.fieldPath || field.key,
      permission: field.permission,
      visibility: getPermissionOutcome(snapshot, field.permission),
      order: field.order || 0,
      format: field.format,
      options: field.options,
      readonly: field.readonly || false,
    }))
    .filter((field) => field.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Build sections from registry configuration
 */
function buildSections(
  sectionsConfig: AppRegistryDetailEntry['sections'],
  fields: DetailField[]
): DetailSection[] {
  if (!sectionsConfig || sectionsConfig.length === 0) {
    // If no sections defined, create a single default section with all fields
    if (fields.length > 0) {
      return [
        {
          key: 'overview',
          label: 'Overview',
          fields,
          order: 0,
        },
      ];
    }
    return [];
  }

  // Create a map of fields by key for quick lookup
  const fieldsMap = new Map(fields.map((f) => [f.key, f]));

  return sectionsConfig
    .map((section) => ({
      key: section.key,
      label: section.label,
      fields: section.fields
        .map((fieldKey) => fieldsMap.get(fieldKey))
        .filter((field): field is DetailField => field !== undefined),
      order: section.order || 0,
      collapsible: section.collapsible || false,
      defaultCollapsed: section.defaultCollapsed || false,
    }))
    .filter((section) => section.fields.length > 0) // Only include sections with visible fields
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Build tabs from registry configuration
 */
function buildTabs(
  tabsConfig: AppRegistryDetailEntry['tabs'],
  sections: DetailSection[],
  snapshot: PermissionSnapshot
): DetailTab[] {
  if (!tabsConfig || tabsConfig.length === 0) {
    // If no tabs defined, create a single default tab with all sections
    if (sections.length > 0) {
      return [
        {
          key: 'overview',
          label: 'Overview',
          sections,
          order: 0,
          visibility: PermissionOutcome.ENABLED,
        },
      ];
    }
    return [];
  }

  // Create a map of sections by key for quick lookup
  const sectionsMap = new Map(sections.map((s) => [s.key, s]));

  return tabsConfig
    .map((tab) => ({
      key: tab.key,
      label: tab.label,
      sections: tab.sections
        .map((sectionKey) => sectionsMap.get(sectionKey))
        .filter((section): section is DetailSection => section !== undefined),
      order: tab.order || 0,
      permission: tab.permission,
      visibility: getPermissionOutcome(snapshot, tab.permission),
    }))
    .filter((tab) => tab.visibility !== PermissionOutcome.HIDDEN && tab.sections.length > 0)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Build actions from registry configuration
 */
function buildActions(
  actionsConfig: AppRegistryDetailEntry['actions'],
  snapshot: PermissionSnapshot,
  moduleKey: string,
  editRoute?: string,
  deletePermission?: string
): DetailAction[] {
  const actions: DetailAction[] = [];

  // Add default actions if not explicitly configured
  if (!actionsConfig || actionsConfig.length === 0) {
    // Default edit action
    if (editRoute) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        type: 'edit',
        route: editRoute,
        permission: `${moduleKey}.edit`,
        visibility: getPermissionOutcome(snapshot, `${moduleKey}.edit`),
        variant: 'secondary',
        icon: 'pencil',
        order: 1,
      });
    }

    // Default delete action
    if (deletePermission) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        type: 'delete',
        permission: deletePermission,
        visibility: getPermissionOutcome(snapshot, deletePermission),
        variant: 'danger',
        icon: 'trash',
        order: 2,
      });
    }
  } else {
    // Use configured actions
    actions.push(
      ...actionsConfig.map((action) => ({
        key: action.key,
        label: action.label,
        type: action.type,
        route: action.route,
        permission: action.permission,
        visibility: getPermissionOutcome(snapshot, action.permission),
        variant: action.variant || 'secondary',
        icon: action.icon,
        order: action.order || 0,
      }))
    );
  }

  return actions
    .filter((action) => action.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Build related record widgets from registry configuration
 */
function buildRelatedRecords(
  relatedRecordsConfig: AppRegistryDetailEntry['relatedRecords'],
  snapshot: PermissionSnapshot
): RelatedRecordWidget[] {
  if (!relatedRecordsConfig || relatedRecordsConfig.length === 0) {
    return [];
  }

  return relatedRecordsConfig
    .map((widget) => ({
      key: widget.key,
      label: widget.label,
      moduleKey: widget.moduleKey,
      relationshipType: widget.relationshipType,
      route: widget.route,
      permission: widget.permission,
      visibility: getPermissionOutcome(snapshot, widget.permission),
      order: widget.order || 0,
      limit: widget.limit || 10,
    }))
    .filter((widget) => widget.visibility !== PermissionOutcome.HIDDEN)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Determine empty state for record detail
 */
function determineRecordDetailEmptyState(
  moduleKey: string,
  appKey: string,
  hasFields: boolean,
  _snapshot: PermissionSnapshot,
  _modulePermission?: string
): EmptyStateDefinition | undefined {
  // If no fields are visible, show NO_ACCESS
  if (!hasFields) {
    return {
      type: EmptyStateType.NO_ACCESS,
      title: "You don't have access to this record",
      description:
        "Your current role doesn't allow you to view this record. Contact your administrator if you believe this is a mistake.",
    };
  }

  // Other empty states are handled at the field/section level
  return undefined;
}

/**
 * Get fallback fields for common modules when detail config is missing
 */
function getFallbackFields(moduleKey: string): Array<{
  key: string;
  label: string;
  dataType: DetailField['dataType'];
  fieldPath?: string;
  order?: number;
}> {
  switch (moduleKey) {
    case 'people':
      return [
        { key: 'name', label: 'Name', dataType: 'text', fieldPath: 'name', order: 1 },
        { key: 'email', label: 'Email', dataType: 'email', order: 2 },
        { key: 'phone', label: 'Phone', dataType: 'phone', order: 3 },
        { key: 'organization', label: 'Organization', dataType: 'organization', fieldPath: 'organization.name', order: 4 },
        { key: 'lifecycle_stage', label: 'Stage', dataType: 'status', order: 5 },
        { key: 'owner_id', label: 'Owner', dataType: 'user', fieldPath: 'owner_id.firstName', order: 6 },
        { key: 'createdAt', label: 'Created At', dataType: 'datetime', order: 7 },
      ];
    case 'deals':
      return [
        { key: 'name', label: 'Deal Name', dataType: 'text', order: 1 },
        { key: 'amount', label: 'Amount', dataType: 'currency', order: 2 },
        { key: 'stage', label: 'Stage', dataType: 'status', order: 3 },
        { key: 'close_date', label: 'Close Date', dataType: 'date', order: 4 },
        { key: 'owner_id', label: 'Owner', dataType: 'user', fieldPath: 'owner_id.firstName', order: 5 },
        { key: 'createdAt', label: 'Created At', dataType: 'datetime', order: 6 },
      ];
    default:
      return [
        { key: 'name', label: 'Name', dataType: 'text', order: 1 },
        { key: 'createdAt', label: 'Created At', dataType: 'datetime', order: 2 },
      ];
  }
}

/**
 * Build complete record detail definition from registry and permissions
 *
 * @param moduleKey - The module key (e.g., 'people', 'deals', 'tickets')
 * @param appKey - The application key (e.g., 'SALES', 'HELPDESK')
 * @param appRegistry - The app registry containing all apps and their modules
 * @param snapshot - Permission snapshot (use createPermissionSnapshot to create)
 * @returns Complete record detail definition
 */
export function buildRecordDetailFromRegistry(
  moduleKey: string,
  appKey: string,
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot
): RecordDetailDefinition | null {
  // Find app in registry
  const app = appRegistry[appKey];

  if (!app) {
    console.warn(`[buildRecordDetailFromRegistry] App ${appKey} not found in registry`);
    return null;
  }

  // Find module in app
  const module = app.modules?.find((m) => m.moduleKey === moduleKey);

  if (!module) {
    console.warn(`[buildRecordDetailFromRegistry] Module ${moduleKey} not found in app ${appKey}`);
    return null;
  }

  // Use memoization for performance
  return memoizeBuilder(
    'buildRecordDetailFromRegistry',
    appRegistry,
    snapshot,
    appKey,
    moduleKey,
    () => {
      const detailConfig: AppRegistryDetailEntry | undefined = module.detail;

      let fields: DetailField[];
      let sections: DetailSection[];
      let tabs: DetailTab[];
      let actions: DetailAction[];
      let relatedRecords: RelatedRecordWidget[];

      if (!detailConfig) {
        // Module exists but has no detail configuration
        // Use fallback fields
        console.warn(`[buildRecordDetailFromRegistry] No detail config found for ${moduleKey}. Using fallbacks.`);
        const fallbackFields = getFallbackFields(moduleKey);
        fields = buildFields(
          fallbackFields.map((f) => ({
            key: f.key,
            label: f.label,
            dataType: f.dataType,
            fieldPath: f.fieldPath,
            order: f.order,
          })),
          snapshot
        );
        sections = buildSections(undefined, fields);
        tabs = buildTabs(undefined, sections, snapshot);
        actions = buildActions(undefined, snapshot, moduleKey, undefined, `${moduleKey}.delete`);
        relatedRecords = [];
      } else {
        // Build detail definition from config
        fields = buildFields(detailConfig.fields, snapshot);
        sections = buildSections(detailConfig.sections, fields);
        tabs = buildTabs(detailConfig.tabs, sections, snapshot);
        actions = buildActions(
          detailConfig.actions,
          snapshot,
          moduleKey,
          detailConfig.editRoute,
          detailConfig.deletePermission || `${moduleKey}.delete`
        );
        relatedRecords = buildRelatedRecords(detailConfig.relatedRecords, snapshot);
      }

      // Determine empty state
      const emptyState = determineRecordDetailEmptyState(
        moduleKey,
        appKey,
        fields.length > 0,
        snapshot,
        module.permission
      );

      const detailDefinition: RecordDetailDefinition = {
        version: 1,
        moduleKey,
        appKey,
        title: module.label,
        description: undefined, // Can be added to registry if needed
        header: {
          titleField: detailConfig?.header?.titleField || 'name',
          subtitleField: detailConfig?.header?.subtitleField,
          avatarField: detailConfig?.header?.avatarField,
          statusField: detailConfig?.header?.statusField,
        },
        tabs: tabs.length > 0 ? tabs : [],
        defaultTab: tabs[0]?.key,
        actions,
        relatedRecords: relatedRecords.length > 0 ? relatedRecords : undefined,
        emptyState,
        editRoute: detailConfig?.editRoute || `/${moduleKey}/:id/edit`,
        deletePermission: detailConfig?.deletePermission || `${moduleKey}.delete`,
      };

      return detailDefinition;
    }
  );
}

