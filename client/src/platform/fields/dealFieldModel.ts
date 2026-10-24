/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Deal
 * ============================================================================
 * 
 * Canonical field metadata for Deal entity.
 * 
 * This file encodes the authoritative field classification for Deal records.
 * Deals are SALES app entities, so most business fields are SALES-scoped.
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
 * 1. Deals are SALES app entities
 *    - Core deal fields are the main business attributes (name, amount, stage, etc.)
 *    - fieldScope: 'CORE' for core fields indicates platform-level ownership
 * 
 * 2. Core deal fields are platform-scoped (same pattern as Tasks, People)
 *    - `name`, `amount`, `stage`, `pipeline`, `expectedCloseDate`, `assignedTo`, etc.
 *    - These are the primary deal identity and workflow fields
 *    - owner: 'core', fieldScope: 'CORE'
 * 
 * 3. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 *
 * 4. Deal Status is platform-owned execution state (not a business field)
 *    - Canonical values: Open | Won | Lost (derived from Stage / stage outcome)
 *    - owner: 'system', editable: false — no create/edit/mass-edit
 *    - Tenant-configurable workflow stays on Stage; loss nuance on lostReason
 *    - Direct writes blocked server-side; only stage derivation or maintenance scripts set Status
 *
 * 5. Quick Create eligibility
 *    - Default: name, accountId, pipeline, stage, expectedCloseDate, amount, assignedTo
 *    - Excluded: status, description, notes, tracking fields, system fields
 *    - DealLines are a dedicated section (not a form field); amountMode owned by DealPricingService
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
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

// =============================================================================
// DEAL-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Deals.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type DealFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Deals.
 * Deals module uses 'primary' for name, 'tracking' for value/probability, 'scheduling' for dates.
 */
export type DealFieldIntent = 'primary' | 'state' | 'tracking' | 'scheduling' | 'detail' | 'system';

/**
 * Field scope classification for Deals.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type DealFieldScope = BaseFieldScope;

/**
 * Filter type classification for Deals.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type DealFilterType = BaseFilterType;

// =============================================================================
// DEAL FIELD METADATA INTERFACE
// =============================================================================

/**
 * Deal-specific field metadata interface.
 * Extends BaseFieldMetadata with Deal-specific intent types.
 */
export interface DealFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Deals uses additional intents: 'primary', 'tracking', 'scheduling'.
   */
  intent: DealFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Field metadata map - single source of truth for Deal fields
 * 
 * Every Deal field MUST be classified here.
 * Missing fields will cause runtime errors.
 */
export const DEAL_FIELD_METADATA: Record<string, DealFieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible): _id, __v, organizationId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy, modifiedBy
  // Type C: Computed: derivedStatus
  // ==========================================================================
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: false,
  },
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
  },
  createdAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  modifiedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  _id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  __v: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  derivedStatus: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: true,
  },

  // ==========================================================================
  // CORE DEAL FIELDS (platform-scoped, main business attributes)
  // Same classification pattern as Tasks and People: core vs system.
  // ==========================================================================

  // Primary field - required, cannot be hidden or deleted
  name: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },

  // Value tracking fields
  amount: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'number',
    filterPriority: 2,
  },
  /**
   * AUTO | MANUAL — owned by DealPricingService; not a DynamicForm field.
   * UI: DealLinesSection amount-mode control.
   */
  amountMode: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    isVisibleInConfig: false,
  },
  linesGrandTotal: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    allowOnCreate: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  currency: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  probability: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 3,
  },

  // Pipeline and stage fields
  pipeline: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 4,
  },
  stage: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 5,
  },
  /**
   * Platform-owned execution state derived from Stage (Open|Won|Lost).
   * Not a tenant business field — hide from create/edit; reporting/APIs use Status.
   */
  status: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    allowOnCreate: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 6,
    isVisibleInConfig: true,
  },

  // Scheduling fields
  expectedCloseDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 7,
  },
  actualCloseDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'date',
    filterPriority: 8,
  },

  // Detail fields
  description: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  type: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 9,
  },
  source: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 10,
  },
  nextStep: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  tags: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 11,
  },
  priority: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 12,
  },
  /** Business nuance for Lost deals (e.g. former Abandoned). Not a lifecycle Status. */
  lostReason: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },

  // Assignment
  assignedTo: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 13,
  },

  // Relationship fields
  contactId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 14,
  },
  accountId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity',
    filterPriority: 15,
  },
  dealPeople: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  dealOrganizations: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },

  // Tracking fields
  lastActivityDate: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    filterable: true,
    filterType: 'date',
    filterPriority: 16,
  },
  nextFollowUpDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 17,
  },
  stageHistory: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  playbookState: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },

  // Notes (DealLines are a separate entity — not a Deal field)
  notes: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },

  // Custom fields
  customFields: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates Deal-specific field metadata for correctness.
 * Extends base validation with Deal-specific rules.
 * Throws if invalid combinations are detected.
 */
function validateDealFieldMetadata(fieldName: string, metadata: DealFieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;

  // Deal-specific: Core fields can have intents: primary, state, detail, tracking, scheduling
  const validCoreIntents = ['primary', 'state', 'detail', 'tracking', 'scheduling'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Deal core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }

  // Deal-specific: Participation fields (if any in future) must have valid intent
  const validParticipationIntents = ['primary', 'state', 'detail', 'tracking', 'scheduling'];
  if (owner === 'participation' && !validParticipationIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Deal participation fields must have intent: ${validParticipationIntents.join(' | ')}. Found: ${intent}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllDealMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(DEAL_FIELD_METADATA)) {
    validateDealFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllDealMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for a deal field
 * Returns undefined if field is not found (allows graceful handling of unknown fields)
 */
export function getDealFieldMetadata(fieldName: string): DealFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  
  if (DEAL_FIELD_METADATA[fieldName]) {
    return DEAL_FIELD_METADATA[fieldName];
  }
  
  for (const [key, metadata] of Object.entries(DEAL_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is a system field
 */
export function isDealSystemField(fieldName: string): boolean {
  const metadata = getDealFieldMetadata(fieldName);
  return metadata?.owner === 'system';
}

/**
 * Check if a field is a core deal field (main business attributes, same pattern as Tasks/People).
 */
export function isDealCoreField(fieldName: string): boolean {
  const metadata = getDealFieldMetadata(fieldName);
  return metadata?.owner === 'core';
}

/**
 * Check if a field is a protected field (cannot be deleted)
 */
export function isDealProtectedField(fieldName: string): boolean {
  const metadata = getDealFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

/**
 * Get all core deal fields (platform-scoped business attributes).
 */
export function getCoreDealFields(): string[] {
  return Object.entries(DEAL_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all system fields
 */
export function getDealSystemFields(): string[] {
  return Object.entries(DEAL_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all participation fields for a specific app
 */
export function getDealParticipationFields(appKey: string): string[] {
  return Object.entries(DEAL_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Fields shown in New Deal quick create on a fresh instance.
 * Keep aligned with INITIAL_DEALS_QUICK_CREATE in server/constants/dealsModuleDefaults.js.
 */
export const DEAL_QUICK_CREATE_DEFAULT = [
  'name',
  'accountId',
  'pipeline',
  'stage',
  'expectedCloseDate',
  'amount',
  'assignedTo',
] as const;

/**
 * Get all fields eligible for Quick Create
 * Essential fields: name (required), accountId, pipeline, stage, expectedCloseDate, amount, assignedTo
 */
export function getDealQuickCreateFields(): string[] {
  return Object.entries(DEAL_FIELD_METADATA)
    .filter(([_, metadata]) =>
      metadata.allowOnCreate === true ||
      (metadata.owner === 'core' && metadata.intent === 'primary')
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all protected fields (cannot be deleted)
 */
export function getDealProtectedFields(): string[] {
  return Object.entries(DEAL_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.isProtected === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field into its group for UI display
 * Returns: 'core' | 'system' | app scope (e.g., 'SALES')
 * 
 * Uses base classification utility for consistency.
 */
export function classifyDealField(fieldName: string): string {
  const metadata = getDealFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

/**
 * Group deal fields by their classification (core, system, participation).
 * Used for UI rendering in ModulesAndFields.vue (same pattern as Tasks, People).
 */
export function groupDealFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const fieldKey of fieldKeys) {
    const classification = classifyDealField(fieldKey);
    
    if (classification === 'core') {
      coreIdentity.push(fieldKey);
    } else if (classification === 'system') {
      system.push(fieldKey);
    } else {
      // Participation field - group by app scope
      if (!participation[classification]) {
        participation[classification] = [];
      }
      participation[classification].push(fieldKey);
    }
  }
  
  return { coreIdentity, participation, system };
}

/**
 * Check if a field should be excluded from Quick Create
 * Based on architecture: only essential fields are eligible
 */
export function isExcludedFromDealQuickCreate(fieldName: string): boolean {
  const metadata = getDealFieldMetadata(fieldName);
  
  if (!metadata) {
    // Unknown fields are excluded
    return true;
  }
  
  // System fields are always excluded
  if (metadata.owner === 'system') {
    return true;
  }

  // Core fields with allowOnCreate: false are excluded
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) {
    return true;
  }
  
  return false;
}

// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

/**
 * Array of all deal field metadata objects.
 * @deprecated Use DEAL_FIELD_METADATA directly or FieldRegistry functions
 */
export const DEAL_FIELDS: DealFieldMetadata[] = Object.entries(DEAL_FIELD_METADATA)
  .map(([fieldName, metadata]) => ({
    ...metadata,
    fieldKey: fieldName,
  } as DealFieldMetadata & { fieldKey: string }))
  .map(({ fieldKey: _fieldKey, ...metadata }) => metadata as DealFieldMetadata);
