/**
 * ============================================================================
 * FIELD MERGE UTILITY
 * ============================================================================
 *
 * Merges metadata-defined fields with backend-stored fields for Field Configuration.
 * Metadata is source of truth for system fields; backend overrides order, visibility,
 * and custom fields only.
 *
 * Rules:
 * - Metadata defines which system fields exist
 * - Backend provides: order, visibility, custom fields
 * - If backend is missing a metadata system field → inject from metadata
 * - Use field key (case-insensitive) as unique identifier
 * - No duplicates
 *
 * ============================================================================
 */

import type { BaseFieldMetadata } from './BaseFieldModel';
import { getIsVisibleInConfigBase, getIsEditableBase } from './BaseFieldModel';
import { getFieldMetadataFromRegistry, getFieldMetadataMap, isModuleRegistered } from './FieldRegistry';
import { CATALOG_LIFECYCLE_STATES } from '@/constants/catalogLifecycle';

/**
 * Minimal field shape expected from backend or metadata.
 * Matches the structure used in module.fields.
 */
export interface MergeableField {
  key: string;
  label?: string;
  dataType?: string;
  order?: number;
  visibility?: { list?: boolean; detail?: boolean };
  [key: string]: unknown;
}

/**
 * Options for mergeFields.
 */
export interface MergeFieldsOptions {
  /** Module key for metadata lookup (e.g. 'tasks', 'deals') */
  moduleKey: string;
  /** Function to get metadata for a field key */
  getMetadata: (fieldKey: string) => BaseFieldMetadata | undefined;
  /** Function to build a field object from metadata (for injecting missing system fields) */
  buildFieldFromMetadata?: (fieldKey: string, metadata: BaseFieldMetadata) => MergeableField;
}

const FILTER_TYPE_TO_DATA_TYPE: Record<string, string> = {
  text: 'Text',
  select: 'Picklist',
  'multi-select': 'Multi-Picklist',
  user: 'Lookup (Relationship)',
  date: 'Date-Time',
  entity: 'Lookup (Relationship)',
  boolean: 'Checkbox',
  number: 'Decimal',
};

const FIELD_KEY_DATA_TYPE: Record<string, string> = {
  createdat: 'Date-Time',
  updatedat: 'Date-Time',
  createdby: 'Lookup (Relationship)',
  modifiedby: 'Lookup (Relationship)',
  assignedby: 'Lookup (Relationship)',
  organizationid: 'Lookup (Relationship)',
  derivedstatus: 'Text',
  reminderdate: 'Date',
  remindersent: 'Checkbox',
  completeddate: 'Date',
  completedat: 'Date-Time',
  activitylogs: 'Text-Area',
  item_id: 'Text',
  selling_price: 'Currency',
  cost_price: 'Currency',
  stock_quantity: 'Integer',
  reorder_level: 'Integer',
  tax_percentage: 'Decimal',
  commission_rate: 'Decimal',
  description: 'Text-Area',
  product_image: 'Image',
};

function metadataLabelFromKey(fieldKey: string): string {
  const keyLower = (fieldKey || '').toLowerCase().replace(/[\s_-]+/g, '');
  const labelMap: Record<string, string> = {
    createdat: 'Created At',
    updatedat: 'Updated At',
    createdby: 'Created By',
    modifiedby: 'Modified By',
    assignedby: 'Assigned By',
    derivedstatus: 'Derived Status',
    reminderdate: 'Reminder Date',
    remindersent: 'Reminder Sent',
    completeddate: 'Completed Date',
    completedat: 'Completed At',
    activitylogs: 'Activity Logs',
    item_id: 'Item ID',
    itemid: 'Item ID',
    item_name: 'Item Name',
    itemname: 'Item Name',
    item_code: 'Item Code',
    itemcode: 'Item Code',
    item_type: 'Item Type',
    itemtype: 'Item Type',
    lifecycle_state: 'Status',
    lifecyclestate: 'Status',
    category: 'Category (legacy)',
    categoryid: 'Category',
    subcategory: 'Subcategory (legacy)',
    selling_price: 'Selling Price',
    sellingprice: 'Selling Price',
    cost_price: 'Cost Price',
    costprice: 'Cost Price',
    unit_of_measure: 'Unit of Measure',
    unitofmeasure: 'Unit of Measure',
    tax_type: 'Tax Type',
    taxtype: 'Tax Type',
    tax_percentage: 'Tax Percentage',
    taxpercentage: 'Tax Percentage',
    commission_rate: 'Commission Rate',
    commissionrate: 'Commission Rate',
    stock_quantity: 'Stock Quantity',
    stockquantity: 'Stock Quantity',
    reorder_level: 'Reorder Level',
    reorderlevel: 'Reorder Level',
    contactid: 'Contact',
    organizationrefid: 'Organization',
  };
  if (labelMap[keyLower]) return labelMap[keyLower];
  return fieldKey
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

function dataTypeFromMetadata(fieldKey: string, metadata: BaseFieldMetadata): string {
  const keyLower = (fieldKey || '').toLowerCase();
  if (FIELD_KEY_DATA_TYPE[keyLower]) return FIELD_KEY_DATA_TYPE[keyLower];
  const filterType = String(metadata.filterType || '').toLowerCase();
  if (filterType && FILTER_TYPE_TO_DATA_TYPE[filterType]) {
    return FILTER_TYPE_TO_DATA_TYPE[filterType];
  }
  return 'Text';
}

/**
 * Default field builder from metadata.
 * Creates a minimal field object for platform fields not present in backend storage.
 */
function defaultBuildFieldFromMetadata(
  fieldKey: string,
  metadata: BaseFieldMetadata
): MergeableField {
  const isSystem = metadata.owner === 'system';
  const listVisible = metadata.owner === 'core' || fieldKey === 'lifecycle_state';
  return {
    key: fieldKey,
    label: metadataLabelFromKey(fieldKey),
    dataType: dataTypeFromMetadata(fieldKey, metadata),
    order: 9999,
    visibility: { list: listVisible, detail: true },
    isSystem,
    editable: getIsEditableBase(metadata),
    owner: metadata.owner === 'participation' ? 'platform' : metadata.owner,
    context: 'global',
  };
}

/**
 * Merge metadata-defined fields with backend-stored fields.
 *
 * @param metadata - Metadata map (fieldKey -> metadata)
 * @param backendFields - Fields from backend (module.fields)
 * @param options - Merge options
 * @returns Merged, deduplicated fields array
 */
/** Canonical key for dedup: lowercase, trim, strip spaces and hyphens (so "deleted-by", "deletedBy", "Deleted By" all match) */
function canonicalKey(k: string): string {
  return String(k || '').toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
}

export function mergeFields(
  metadata: Record<string, BaseFieldMetadata>,
  backendFields: MergeableField[],
  options: MergeFieldsOptions
): MergeableField[] {
  const { getMetadata, buildFieldFromMetadata = defaultBuildFieldFromMetadata } = options;

  // Pre-dedupe backend fields by canonical key, preferring programmatic keys (no spaces), preserving order
  const dedupedBackend: MergeableField[] = [];
  const seenCanonical = new Map<string, number>();
  for (const f of backendFields || []) {
    if (!f?.key) continue;
    const k = canonicalKey(f.key);
    const idx = seenCanonical.get(k);
    if (idx !== undefined) {
      const existing = dedupedBackend[idx];
      if (!existing) {
        continue;
      }
      if ((f.key || '').indexOf(' ') === -1 && (existing.key || '').indexOf(' ') !== -1) {
        dedupedBackend[idx] = f;
      }
      continue;
    }
    seenCanonical.set(k, dedupedBackend.length);
    dedupedBackend.push(f);
  }

  const seenKeys = new Set<string>();
  const result: MergeableField[] = [];

  // 1. All backend fields first (preserves order), dedupe by canonical key
  for (const f of dedupedBackend) {
    if (!f?.key) continue;
    const k = canonicalKey(f.key);
    if (seenKeys.has(k)) continue;
    const meta = getMetadata(f.key);
    const visibleInConfig = meta !== undefined
      ? getIsVisibleInConfigBase(meta, f.key)
      : true;
    if (!visibleInConfig) continue; // Skip infrastructure fields
    seenKeys.add(k);
    const merged = { ...f };
    if (meta !== undefined) {
      merged.editable = getIsEditableBase(meta);
    }
    // Canonical human labels for technical keys (overrides stored API labels)
    const friendlyLabel = metadataLabelFromKey(f.key);
    if (
      (k === 'contactid' || k === 'organizationrefid' || k === 'lifecycle_state' || k === 'categoryid') &&
      friendlyLabel &&
      friendlyLabel !== f.label
    ) {
      merged.label = friendlyLabel;
    }
    result.push(merged);
  }

  // 2. Inject platform fields (system, core, participation) missing from backend
  const injectableOwners = new Set(['system', 'core', 'participation']);
  for (const [fieldKey, meta] of Object.entries(metadata)) {
    if (!meta || !injectableOwners.has(meta.owner)) continue;
    const k = canonicalKey(fieldKey);
    if (seenKeys.has(k)) continue;
    const visibleInConfig = getIsVisibleInConfigBase(meta, fieldKey);
    if (!visibleInConfig) continue;
    const built = buildFieldFromMetadata(fieldKey, meta);
    seenKeys.add(k);
    result.push(built);
  }

  return result;
}

/**
 * Filter fields to only those visible in Field Configuration.
 * Metadata-driven; no hardcoded key lists.
 */
export function filterToVisibleInConfig<T extends Record<string, unknown> & { key?: string }>(
  fields: T[],
  getMetadata: (fieldKey: string) => BaseFieldMetadata | undefined
): T[] {
  if (!Array.isArray(fields)) return fields;
  return fields.filter((f) => {
    if (!f?.key) return true;
    const meta = getMetadata(f.key);
    return getIsVisibleInConfigBase(meta, f.key);
  });
}

/** Infrastructure field keys that should never appear in config (Forms/fallback). */
const INFRASTRUCTURE_KEYS = new Set([
  '_id', '__v', 'organizationid', 'formid', 'formversion', 'eventid',
  'createdtime', 'modifiedtime', 'audithistory', 'legacycontactid', 'legacyorganizationid'
]);

/**
 * Fallback getMetadata for modules without full metadata (e.g. Forms).
 * Returns minimal metadata for known infrastructure keys.
 */
export function getFallbackMetadataForVisibleInConfig(fieldKey: string): BaseFieldMetadata | undefined {
  const k = (fieldKey || '').toLowerCase();
  if (INFRASTRUCTURE_KEYS.has(k) || k.startsWith('_')) {
    return {
      owner: 'system',
      intent: 'system',
      fieldScope: 'CORE',
      editable: false,
      isVisibleInConfig: false,
    };
  }
  return undefined;
}

/**
 * Merge stored module.fields with platform metadata (Settings + create/edit drawers).
 * Ensures core/participation fields exist when tenant config only persisted system fields.
 */
export function normalizeModuleFieldsFromMetadata(
  moduleKey: string,
  fields: MergeableField[] | undefined | null
): MergeableField[] {
  if (!Array.isArray(fields)) return [];
  const backendFields = fields.filter((f) => f?.key);

  if (isModuleRegistered(moduleKey)) {
    const metadataMap = getFieldMetadataMap(moduleKey);
    if (metadataMap) {
      const merged = mergeFields(metadataMap, backendFields, {
        moduleKey,
        getMetadata: (key) => getFieldMetadataFromRegistry(moduleKey, key)
      });
      return hydrateRuntimeFieldConfig(moduleKey, merged);
    }
  }

  return hydrateRuntimeFieldConfig(
    moduleKey,
    filterToVisibleInConfig(backendFields, (key) => getFallbackMetadataForVisibleInConfig(key))
  );
}

const QUOTE_LOOKUP_TARGET_BY_KEY: Record<string, string> = {
  ownerid: 'users',
  contactid: 'people',
  organizationrefid: 'organizations',
  dealid: 'deals',
};

function hydrateRuntimeFieldConfig(moduleKey: string, fields: MergeableField[]): MergeableField[] {
  const mk = String(moduleKey || '').toLowerCase().trim();
  if (mk === 'quotes') {
    return (fields || []).map((f) => {
      const keyLower = String(f?.key || '').toLowerCase().trim();
      const targetModule = QUOTE_LOOKUP_TARGET_BY_KEY[keyLower];
      if (!targetModule) return f;
      const dataType = String(f.dataType || '').toLowerCase();
      const isLookup =
        dataType.includes('lookup') ||
        dataType.includes('relationship') ||
        dataType.includes('reference') ||
        dataType.includes('entity');
      if (!isLookup) return f;
      const ls =
        f.lookupSettings && typeof f.lookupSettings === 'object'
          ? (f.lookupSettings as Record<string, unknown>)
          : null;
      if (ls?.targetModule) return f;
      return { ...f, lookupSettings: { targetModule } };
    });
  }
  if (mk !== 'items') return fields;

  return (fields || []).map((f) => {
    const keyLower = String(f?.key || '').toLowerCase().trim();
    if (!keyLower) return f;

    // Items: ensure critical picklists have options even if tenant config wiped them.
    if (keyLower === 'item_type') {
      const existing = Array.isArray(f.options) ? f.options : [];
      if (!existing.length) {
        return {
          ...f,
          dataType: f.dataType || 'Picklist',
          options: ['Product', 'Service', 'Serialized Product', 'Non-Stock Product', 'Bundle']
        };
      }
    }

    if (keyLower === 'lifecycle_state') {
      const existing = Array.isArray(f.options) ? f.options : [];
      if (!existing.length) {
        return {
          ...f,
          dataType: f.dataType || 'Picklist',
          options: [...CATALOG_LIFECYCLE_STATES]
        };
      }
    }

    // Items: categoryId is a CatalogCategory lookup under /catalog/categories/tree (not a normal module list).
    if (keyLower === 'categoryid') {
      const ls =
        f.lookupSettings && typeof f.lookupSettings === 'object'
          ? (f.lookupSettings as Record<string, unknown>)
          : null;
      const targetModule = String(ls?.targetModule || '').trim();
      if (!targetModule) {
        return {
          ...f,
          lookupSettings: { targetModule: 'catalog/categories' }
        };
      }
    }

    return f;
  });
}
