/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Item
 * ============================================================================
 * 
 * Canonical field metadata for Item entity.
 * 
 * This file encodes the authoritative field classification for Item records.
 * Items are supporting/secondary entities used across apps (primarily SALES).
 * 
 * ⚠️ IMPORTANT:
 * - Field ownership, intent, and scope are FINALIZED
 * - Do NOT infer, reinterpret, or reclassify any field
 * - This is DATA-MEANING encoding, not UI or schema redesign
 * 
 * ============================================================================
 * 
 * ARCHITECTURAL NOTES:
 * 
 * 1. Items are supporting/secondary catalog entities
 *    - Items are shared across apps (primarily SALES) but are flat records, not participations
 *    - All user-facing business fields are core Item fields (owner: 'core', fieldScope: 'CORE')
 * 
 * 2. Core fields include identity and catalog attributes
 *    - Identity: `item_name` (primary); `item_code` is system-generated (Module Numbering)
 *    - Catalog: `item_type`, `category`, `description`, `price`, `inventory`, etc.
 *    - fieldScope: 'CORE' indicates platform-level Item ownership
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, `item_id`, `item_code`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 5. Quick Create eligibility
 *    - Essential fields: item_name (required), item_type, categoryId, selling_price, unit_of_measure, lifecycle_state, assignedTo (required)
 *    - Excluded: inventory fields, tax details, relationships, system fields (including item_code)
 * 
 * ============================================================================
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldScope,
  BaseFilterType,
} from './BaseFieldModel';
import {
  validateBaseFieldMetadata,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';
import {
  isInventoryEnabled,
  isInventoryGatedField,
  shouldHideFieldWhenInventoryDisabled,
  type OrgCapabilities,
} from '@/utils/inventoryCapability';

// =============================================================================
// ITEM-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Items.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type ItemFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Items.
 * Items module uses 'primary' for item_name, 'identity' for user identity attrs, 'tracking' for pricing/inventory.
 */
export type ItemFieldIntent = 'primary' | 'identity' | 'state' | 'detail' | 'tracking' | 'system';

/**
 * Field scope classification for Items.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type ItemFieldScope = BaseFieldScope;

/**
 * Filter type classification for Items.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type ItemFilterType = BaseFilterType;

// =============================================================================
// ITEM FIELD METADATA INTERFACE
// =============================================================================

/**
 * Item-specific field metadata interface.
 * Extends BaseFieldMetadata with Item-specific intent types.
 */
export interface ItemFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Items uses 'primary' for item_name, 'tracking' for pricing/inventory; item_code is system.
   */
  intent: ItemFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Canonical field metadata for Item entity.
 * This is the single source of truth for Item field classification.
 */
export const ITEM_FIELD_METADATA: Record<string, ItemFieldMetadata> = {
  // ===========================================================================
  // SYSTEM FIELDS (Infrastructure, never user-editable)
  // Type A: Infrastructure (never visible): _id, __v, organizationId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy, modifiedBy
  // item_id / item_code: visible (identity), read-only, system-allocated
  // ===========================================================================
  
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    filterType: 'entity',
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  item_id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    isSystem: true,
    isVisibleInConfig: true,
  },

  item_code: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'text',
    filterPriority: 2,
  },
  
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'user',
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  createdAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 2,
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  modifiedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  _id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  __v: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  // ===========================================================================
  // CORE FIELDS (Platform-level identity)
  // ===========================================================================
  
  item_name: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  
  // ===========================================================================
  // CORE CATALOG FIELDS (business attributes)
  // ===========================================================================
  
  item_type: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 1,
  },
  
  /** @deprecated Denormalized label — use categoryId. Kept for list/filter compat. */
  category: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 2,
    isVisibleInConfig: false,
  },

  categoryId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 2,
  },

  attributeValues: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
    isVisibleInConfig: false,
  },
  
  /** @deprecated Denormalized sub-label when category has a parent — synced from categoryId. */
  subcategory: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    isVisibleInConfig: false,
  },
  
  tags: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'multi-select',
  },
  
  description: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  product_image: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  unit_of_measure: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  /** @deprecated Dual-write alias of lifecycle_state — excluded from module field config. */
  status: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    filterType: 'select',
    filterPriority: 2,
  },

  lifecycle_state: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 1,
  },
  
  cost_price: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'number',
  },
  
  selling_price: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 2,
  },
  
  currency: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  tax_type: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  tax_percentage: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  commission_rate: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  stock_quantity: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
    filterType: 'number',
    isVisibleInConfig: false,
  },

  reorder_level: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isProtected: false,
    filterable: false,
    isVisibleInConfig: false,
  },
  
  serial_numbers: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  warranty_period_months: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  vendor: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'entity',
  },
  
  linked_deals: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_invoices: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_forms: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_contacts: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    isProtected: false,
    filterable: false,
  },

  assignedTo: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 3,
  },
  
  // Storage bucket for tenant-defined custom field values — not a configurable field.
  customFields: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates Item-specific field metadata constraints.
 */
function validateItemFieldMetadata(fieldName: string, metadata: ItemFieldMetadata): void {
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);
  
  const { owner, intent } = metadata;
  
  // Core fields must have valid intents
  const validCoreIntents = ['primary', 'identity', 'state', 'detail', 'tracking'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Item core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }
  
  // Participation fields must have valid intents (Items do not use participation fields)
  const validParticipationIntents = ['state', 'detail', 'tracking'];
  if (owner === 'participation' && !validParticipationIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Item participation fields must have intent: ${validParticipationIntents.join(' | ')}. Found: ${intent}`
    );
  }
}

/**
 * Validates all Item field metadata on module load.
 * Throws if any field is invalid.
 */
function validateAllItemMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    try {
      validateItemFieldMetadata(fieldName, metadata);
    } catch (error) {
      console.error(`[itemFieldModel] Validation error for field "${fieldName}":`, error);
      throw error;
    }
  }
}

// Run validation on module load
validateAllItemMetadata();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get metadata for a specific Item field.
 * Uses case-insensitive lookup and handles field key variations (kebab-case, snake_case, camelCase).
 */
export function getItemFieldMetadata(fieldKey: string): ItemFieldMetadata | undefined {
  if (!fieldKey) return undefined;
  
  // Try exact match first
  if (ITEM_FIELD_METADATA[fieldKey]) {
    return ITEM_FIELD_METADATA[fieldKey];
  }
  
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldKey);
  
  for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  // Try kebab-case to snake_case conversion (item-name -> item_name)
  if (fieldKey.includes('-')) {
    const snakeCaseKey = fieldKey.replace(/-/g, '_');
    if (ITEM_FIELD_METADATA[snakeCaseKey]) {
      return ITEM_FIELD_METADATA[snakeCaseKey];
    }
    // Try case-insensitive match with snake_case
    const normalizedSnake = snakeCaseKey.toLowerCase();
    for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
      if (key.toLowerCase() === normalizedSnake) {
        return metadata;
      }
    }
  }
  
  // Try camelCase to snake_case conversion (itemName -> item_name)
  if (/[A-Z]/.test(fieldKey)) {
    const snakeCaseKey = fieldKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (ITEM_FIELD_METADATA[snakeCaseKey]) {
      return ITEM_FIELD_METADATA[snakeCaseKey];
    }
    // Try case-insensitive match
    const normalizedSnake = snakeCaseKey.toLowerCase();
    for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
      if (key.toLowerCase() === normalizedSnake) {
        return metadata;
      }
    }
  }
  
  return undefined;
}

/**
 * Get all Item field metadata as an array.
 */
export function getItemFields(): ItemFieldMetadata[] {
  return Object.entries(ITEM_FIELD_METADATA).map(([fieldKey, metadata]) => ({
    ...metadata,
    fieldKey,
  }));
}

/**
 * Classify an Item field by owner.
 * Returns 'core' | 'participation' | 'system' | null
 */
export function classifyItemField(fieldKey: string): BaseFieldOwner | null {
  const metadata = getItemFieldMetadata(fieldKey);
  return metadata ? metadata.owner : null;
}

/**
 * Check if a field is a system field.
 */
export function isItemSystemField(fieldKey: string): boolean {
  return classifyItemField(fieldKey) === 'system';
}

/**
 * Check if a field is a core field.
 */
export function isItemCoreField(fieldKey: string): boolean {
  return classifyItemField(fieldKey) === 'core';
}

/**
 * Check if a field is a protected field (system or core).
 */
export function isItemProtectedField(fieldKey: string): boolean {
  const metadata = getItemFieldMetadata(fieldKey);
  return metadata?.isProtected === true;
}

/**
 * Get fields eligible for quick create.
 * Returns field keys for essential fields only.
 */
export function getItemQuickCreateFields(): string[] {
  return [
    'item_name',
    'item_type',
    'categoryId',
    'selling_price',
    'unit_of_measure',
    'lifecycle_state',
    'assignedTo',
  ];
}

/**
 * Default key fields for Items on a fresh instance.
 * Keep aligned with itemsDefaultKeyFields in server/controllers/moduleController.js.
 */
export const ITEM_DEFAULT_KEY_FIELDS = [
  'item_type',
  'item_code',
  'categoryId',
  'selling_price',
  'lifecycle_state',
  'assignedTo',
] as const;

/** Catalog scaffold fields — not shown on flat item create/edit drawer (catalog section on record). */
export function getItemCatalogScaffoldFieldKeys(): string[] {
  return [
    'hasVariants',
    'defaultVariantId',
    'variants',
    'media',
    'catalogVariantId',
    'attributeValues',
    'attributeTemplates',
    'defaultVariant'
  ];
}

/** Legacy flat category labels — hidden from settings/create; use categoryId. */
export function getItemLegacyCategoryFieldKeys(): string[] {
  return ['category', 'subcategory'];
}

/** @deprecated Use INVENTORY_GATED_FIELD_KEYS.items from inventoryCapability.ts */
export const ITEM_INVENTORY_ENGINE_FIELD_KEYS = new Set([
  'stock_quantity',
  'reorder_level',
  'serial_numbers',
]);

export function isItemInventoryEngineFieldKey(fieldKey: string): boolean {
  return isInventoryGatedField('items', fieldKey);
}

export function shouldShowItemFieldForCapabilities(
  fieldKey: string,
  capabilities: OrgCapabilities
): boolean {
  return !shouldHideFieldWhenInventoryDisabled('items', fieldKey, isInventoryEnabled({ capabilities }));
}

/**
 * Get all core Item fields.
 */
export function getCoreItemFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    isItemCoreField(key)
  );
}

/**
 * Get all system Item fields.
 */
export function getItemSystemFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    isItemSystemField(key)
  );
}

/**
 * Get all participation Item fields.
 */
export function getItemParticipationFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    classifyItemField(key) === 'participation'
  );
}

/**
 * Group Item fields by owner and scope.
 */
export function groupItemFields(): {
  core: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const core: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const [fieldKey, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    if (metadata.owner === 'core') {
      core.push(fieldKey);
    } else if (metadata.owner === 'participation') {
      const scope = metadata.fieldScope;
      if (!participation[scope]) {
        participation[scope] = [];
      }
      participation[scope].push(fieldKey);
    } else if (metadata.owner === 'system') {
      system.push(fieldKey);
    }
  }
  
  return { core, participation, system };
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * @deprecated Use ITEM_FIELD_METADATA instead
 */
export const ITEM_FIELDS = getItemFields();
