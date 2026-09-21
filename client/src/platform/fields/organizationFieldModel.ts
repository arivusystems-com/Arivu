/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Organization
 * ============================================================================
 * 
 * Canonical field metadata for Organization entity.
 * 
 * This file encodes the authoritative field classification for CRM Organizations
 * (isTenant: false). Tenant organization fields (subscription, limits, settings)
 * are excluded as they are platform infrastructure, not CRM entity fields.
 * 
 * ⚠️ IMPORTANT:
 * - Field ownership, intent, and scope are FINALIZED for this module
 * - App participation mirrors People: virtual role fields + app-scoped type attributes
 * - `participations[APP].role` is source of truth; `types[]` is the denormalized union
 * 
 * ============================================================================
 * 
 * ARCHITECTURAL NOTES:
 * 
 * 1. Organization model serves dual purpose
 *    - Tenant organizations (isTenant: true) - platform infrastructure
 *    - CRM organizations (isTenant: false) - business entities
 *    - This field model covers CRM organization fields only
 * 
 * 2. Core business fields are platform-scoped
 *    - Identity: `name`, `industry`, `website`, `phone`, `address`, `tags`
 *    - Relationships: `assignedTo`, `accountManager`, `primaryContact`
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 3. App participation fields (People-parallel)
 *    - Virtual roles: `sales_type`, `helpdesk_role`, `inventory_role`, `marketing_role`, `portal_role`
 *    - Type attributes live under primary owning app (SALES / INVENTORY / PORTAL)
 *    - `types[]` is system-derived union of participation roles (not admin-edited)
 *    - Record visibility still gated by `types` / participation roles
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, `participations`, etc.
 *    - Managed by the platform, never user-editable
 * 
 * 5. Quick Create eligibility
 *    - Core + non-virtual participation fields are configurable in Quick Create settings
 *    - Virtual participation roles are configured via App Participation UI, not QC field list
 *    - See: docs/architecture/organization-settings.md
 * 
 * ============================================================================
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldIntent,
  BaseFieldScope,
  BaseFilterType,
} from './BaseFieldModel';
import {
  validateBaseFieldMetadata,
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

// =============================================================================
// ORGANIZATION-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Organizations.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type OrganizationFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Organizations.
 * Organizations module uses 'identity' for core fields (similar to People).
 */
export type OrganizationFieldIntent = 'identity' | 'state' | 'detail' | 'system';

/**
 * Field scope classification for Organizations.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type OrganizationFieldScope = BaseFieldScope;

/**
 * Filter type classification for Organizations.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type OrganizationFilterType = BaseFilterType;

// =============================================================================
// ORGANIZATION FIELD METADATA INTERFACE
// =============================================================================

/**
 * Organization-specific field metadata interface.
 * Extends BaseFieldMetadata with Organization-specific intent types.
 */
export interface OrganizationFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Organizations uses 'identity' for core fields (vs 'primary' in Tasks).
   */
  intent: OrganizationFieldIntent;

  /**
   * When true, stored under participations[appKey] (e.g. role), not a top-level document key.
   */
  isVirtual?: boolean;

  /**
   * App participation bucket (e.g. SALES, HELPDESK). Used with isVirtual.
   */
  appKey?: string;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Field metadata map - single source of truth for Organization fields
 * 
 * Every Organization field MUST be classified here.
 * Missing fields will cause runtime errors.
 * 
 * Note: This covers CRM organization fields only (isTenant: false).
 * Tenant organization fields (subscription, limits, settings) are excluded.
 */
export const ORGANIZATION_FIELD_METADATA: Record<string, OrganizationFieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible): _id, __v, organizationId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy
  // Type C: Computed: derivedStatus; legacyOrganizationId: infrastructure
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
  legacyOrganizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  isActive: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'boolean',
    filterPriority: 10,
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
  lastActivity: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: true,
  },
  participations: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false, // App participation map; virtual role fields are flattened for config
  },

  // ==========================================================================
  // CORE BUSINESS FIELDS (platform-scoped, app-agnostic)
  // ==========================================================================
  
  // Primary field - required, cannot be hidden or deleted
  name: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  
  // Core identity fields
  industry: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 2,
  },
  website: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  phone: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  address: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  
  // Denormalized union of participations[APP].role — system-derived, not admin-edited.
  // Hidden from Field Configurations; list/filters/key fields may still use it.
  types: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 3,
  },
  tags: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 4,
  },

  // Core relationship fields
  assignedTo: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 4,
  },
  accountManager: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 5,
  },
  primaryContact: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 6,
  },

  partnerOnboardingSteps: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },

  // Retired type attributes (Distributor / Dealer) — remain platform-core
  dealerLevel: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 18,
  },
  channelRegion: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  distributionTerritory: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  distributionCapacityMonthly: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  terms: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  shippingAddress: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  logisticsPartner: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 19,
  },

  // ==========================================================================
  // SALES PARTICIPATION — STATE (virtual role + customer/lead pool)
  // Canonical SALES role → participations.SALES.role (virtual sales_type)
  // ==========================================================================
  sales_type: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    isVirtual: true,
    appKey: 'SALES',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  },
  customerStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 7,
  },
  customerTier: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 8,
  },

  // ==========================================================================
  // SALES PARTICIPATION — DETAIL
  // ==========================================================================
  slaLevel: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
  },
  paymentTerms: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
  },
  creditLimit: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
  },
  annualRevenue: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 9,
  },
  numberOfEmployees: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 10,
  },

  // ==========================================================================
  // HELPDESK PARTICIPATION — STATE
  // ==========================================================================
  helpdesk_role: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'HELPDESK',
    editable: true,
    isVirtual: true,
    appKey: 'HELPDESK',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  },

  // ==========================================================================
  // INVENTORY PARTICIPATION — STATE + DETAIL (Vendor)
  // ==========================================================================
  inventory_role: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'INVENTORY',
    editable: true,
    requiredFor: ['INVENTORY'],
    isVirtual: true,
    appKey: 'INVENTORY',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  },
  vendorStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'INVENTORY',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 15,
  },
  vendorRating: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'INVENTORY',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 16,
  },
  vendorContract: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'INVENTORY',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 17,
  },
  preferredPaymentMethod: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'INVENTORY',
    editable: true,
    allowOnCreate: false,
  },
  taxId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'INVENTORY',
    editable: true,
    allowOnCreate: false,
  },

  // ==========================================================================
  // MARKETING PARTICIPATION — STATE
  // ==========================================================================
  marketing_role: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'MARKETING',
    editable: true,
    isVirtual: true,
    appKey: 'MARKETING',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  },

  // ==========================================================================
  // PORTAL PARTICIPATION — STATE + DETAIL (Partner)
  // ==========================================================================
  portal_role: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'PORTAL',
    editable: true,
    requiredFor: ['PORTAL'],
    isVirtual: true,
    appKey: 'PORTAL',
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  },
  partnerStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 11,
  },
  partnerTier: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 12,
  },
  partnerType: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 13,
  },
  partnerSince: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'date',
    filterPriority: 14,
  },
  territory: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
  },
  discountRate: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'PORTAL',
    editable: true,
    allowOnCreate: false,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates Organization-specific field metadata for correctness.
 * Extends base validation with Organization-specific rules.
 * Throws if invalid combinations are detected.
 */
function validateOrganizationFieldMetadata(fieldName: string, metadata: OrganizationFieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;

  // Organization-specific: Core fields must have intent: 'identity', 'state', or 'detail'
  if (owner === 'core' && intent !== 'identity' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": Organization core fields must have intent: 'identity', 'state', or 'detail'. Found: ${intent}`
    );
  }

  // Organization-specific: Participation fields must have intent: 'state' or 'detail'
  if (owner === 'participation' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": Organization participation fields must have intent: 'state' or 'detail'. Found: ${intent}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllOrganizationMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(ORGANIZATION_FIELD_METADATA)) {
    validateOrganizationFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllOrganizationMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for an organization field
 * Returns undefined if field is not found (allows graceful handling of unknown fields)
 */
export function getOrganizationFieldMetadata(fieldName: string): OrganizationFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  
  if (ORGANIZATION_FIELD_METADATA[fieldName]) {
    return ORGANIZATION_FIELD_METADATA[fieldName];
  }
  
  for (const [key, metadata] of Object.entries(ORGANIZATION_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is a system field
 */
export function isOrganizationSystemField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.owner === 'system';
}

/**
 * Check if a field is a core organization field
 */
export function isOrganizationCoreField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.owner === 'core';
}

/**
 * Check if a field is a protected field (cannot be deleted)
 */
export function isOrganizationProtectedField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

/**
 * Get all core organization fields (platform-owned)
 */
export function getCoreOrganizationFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all system fields
 */
export function getOrganizationSystemFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

// =============================================================================
// ORGANIZATION TYPE → FIELD VISIBILITY (platform defaults + tenant overrides)
// =============================================================================

/** Fields always visible regardless of selected organization types. */
export const ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS = new Set([
  'name',
  'industry',
  'website',
  'phone',
  'address',
  'tags',
  'assignedTo',
  'accountManager',
  'primaryContact',
  'isActive',
]);

/**
 * Platform default fields shown when each organization type is selected.
 * Tenant overrides via Settings → Organizations → Status & Types (`fields` per type).
 */
export const ORGANIZATION_TYPE_FIELDS: Record<string, readonly string[]> = {
  Customer: [
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees',
  ],
  Lead: [
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees',
  ],
  'Marketing Lead': [
    'customerStatus',
    'customerTier',
    'slaLevel',
    'paymentTerms',
    'creditLimit',
    'accountManager',
    'annualRevenue',
    'numberOfEmployees',
  ],
  Partner: [
    'partnerStatus',
    'partnerTier',
    'partnerType',
    'partnerSince',
    'territory',
    'discountRate',
  ],
  Vendor: [
    'vendorStatus',
    'vendorRating',
    'vendorContract',
    'preferredPaymentMethod',
    'taxId',
  ],
  Distributor: ['channelRegion', 'distributionTerritory', 'distributionCapacityMonthly'],
  Dealer: ['dealerLevel', 'terms', 'shippingAddress', 'logisticsPartner'],
};

export type OrganizationTypeFieldDef = { value: string; fields?: string[] };

function normalizeOrgTypeLabel(type: string): string {
  return String(type ?? '').trim();
}

function findOrganizationTypeDef(
  type: string,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): OrganizationTypeFieldDef | undefined {
  const want = normalizeOrgTypeLabel(type).toLowerCase();
  if (!want || !typeDefs?.length) return undefined;
  return typeDefs.find((d) => normalizeOrgTypeLabel(d?.value ?? '').toLowerCase() === want);
}

function platformDefaultFieldsForType(type: string): string[] {
  const normalized = normalizeOrgTypeLabel(type);
  if (!normalized) return [];
  const direct = ORGANIZATION_TYPE_FIELDS[normalized];
  if (direct) return [...direct];
  const key = Object.keys(ORGANIZATION_TYPE_FIELDS).find(
    (k) => k.toLowerCase() === normalized.toLowerCase()
  );
  const fields = key ? ORGANIZATION_TYPE_FIELDS[key] : undefined;
  return fields ? [...fields] : [];
}

/**
 * Field keys eligible for per-type configuration (platform type-scoped + other core fields).
 */
export function getOrganizationTypeScopedFieldPool(): string[] {
  const pool = new Set<string>();
  for (const fields of Object.values(ORGANIZATION_TYPE_FIELDS)) {
    for (const f of fields) pool.add(f);
  }
  for (const [fieldName, metadata] of Object.entries(ORGANIZATION_FIELD_METADATA)) {
    if (metadata.owner !== 'core') continue;
    if (ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS.has(fieldName)) continue;
    pool.add(fieldName);
  }
  return [...pool].sort((a, b) => a.localeCompare(b));
}

export function isOrganizationAlwaysVisibleField(fieldKey: string): boolean {
  const k = normalizeFieldKeyForMetadataLookup(fieldKey);
  for (const always of ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS) {
    if (normalizeFieldKeyForMetadataLookup(always) === k) return true;
  }
  return false;
}

export function isOrganizationTypeScopedFieldKey(fieldKey: string): boolean {
  if (isOrganizationAlwaysVisibleField(fieldKey)) return false;
  const k = normalizeFieldKeyForMetadataLookup(fieldKey);
  const pool = getOrganizationTypeScopedFieldPool();
  return pool.some((p) => normalizeFieldKeyForMetadataLookup(p) === k);
}

/**
 * Resolved field keys for one organization type (tenant override or platform default).
 */
export function getOrganizationFieldsForType(
  type: string,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): string[] {
  const match = findOrganizationTypeDef(type, typeDefs);
  if (match && match.fields !== undefined) {
    return Array.isArray(match.fields) ? [...match.fields] : [];
  }
  return platformDefaultFieldsForType(type);
}

/**
 * Union of type-scoped fields for all selected types (multi-select `types` array).
 */
export function getOrganizationFieldsForTypes(
  selectedTypes: ReadonlyArray<string> | null | undefined,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): string[] {
  const types = (selectedTypes ?? []).map((t) => normalizeOrgTypeLabel(t)).filter(Boolean);
  if (types.length === 0) return [];
  const out = new Set<string>();
  for (const type of types) {
    for (const f of getOrganizationFieldsForType(type, typeDefs)) {
      out.add(f);
    }
  }
  return [...out];
}

/**
 * Whether a field should show for the current organization type selection.
 * Always-visible and non-type-scoped fields return true.
 */
export function shouldShowOrganizationFieldForTypes(
  fieldKey: string,
  selectedTypes: ReadonlyArray<string> | null | undefined,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): boolean {
  const key = String(fieldKey ?? '').trim();
  if (!key) return false;
  if (isOrganizationAlwaysVisibleField(key)) return true;
  if (!isOrganizationTypeScopedFieldKey(key)) return true;
  const allowed = getOrganizationFieldsForTypes(selectedTypes, typeDefs);
  const nk = normalizeFieldKeyForMetadataLookup(key);
  return allowed.some((f) => normalizeFieldKeyForMetadataLookup(f) === nk);
}

/**
 * Filter field keys to those visible for the selected organization types.
 */
export function filterOrganizationFieldKeysByTypes(
  fieldKeys: ReadonlyArray<string>,
  selectedTypes: ReadonlyArray<string> | null | undefined,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): string[] {
  return fieldKeys.filter((key) =>
    shouldShowOrganizationFieldForTypes(key, selectedTypes, typeDefs)
  );
}

/** Omit type-scoped fields that are not visible for the selected organization types. */
export function filterOrganizationSubmitPayloadByTypes(
  payload: Record<string, unknown> | null | undefined,
  selectedTypes: ReadonlyArray<string> | null | undefined,
  typeDefs?: ReadonlyArray<OrganizationTypeFieldDef> | null
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!shouldShowOrganizationFieldForTypes(key, selectedTypes, typeDefs)) continue;
    out[key] = value;
  }
  return out;
}

export function getOrganizationTypesForField(fieldKey: string): string[] {
  const nk = normalizeFieldKeyForMetadataLookup(fieldKey);
  const out: string[] = [];
  for (const [type, fields] of Object.entries(ORGANIZATION_TYPE_FIELDS)) {
    if (fields.some((f) => normalizeFieldKeyForMetadataLookup(f) === nk)) {
      out.push(type);
    }
  }
  return out;
}

/** Status fields with organization intent config (allowed/default status options). */
export const ORGANIZATION_INTENT_STATUS_FIELD_KEYS = new Set([
  'customerStatus',
  'partnerStatus',
  'vendorStatus',
]);

const ORGANIZATION_TYPE_PRIMARY_STATUS_FIELD: Record<string, string> = {
  Customer: 'customerStatus',
  Lead: 'customerStatus',
  'Marketing Lead': 'customerStatus',
  Partner: 'partnerStatus',
  Vendor: 'vendorStatus',
};

/** Primary type-scoped status field for Key Fields / derivedStatus (first selected type). */
export function getPrimaryOrganizationStatusFieldKey(
  types: ReadonlyArray<string> | null | undefined
): string | null {
  const first = Array.isArray(types)
    ? types.map((t) => String(t ?? '').trim()).find(Boolean)
    : null;
  if (!first) return null;
  const direct = ORGANIZATION_TYPE_PRIMARY_STATUS_FIELD[first];
  if (direct) return direct;
  const match = Object.keys(ORGANIZATION_TYPE_PRIMARY_STATUS_FIELD).find(
    (k) => k.toLowerCase() === first.toLowerCase()
  );
  return match ? (ORGANIZATION_TYPE_PRIMARY_STATUS_FIELD[match] ?? null) : null;
}

/** Display value for Organizations Key Fields `derivedStatus` (system value or type-scoped fallback). */
export function resolveOrganizationKeyFieldStatus(
  record: Record<string, unknown> | null | undefined
): string | null {
  if (!record) return null;
  const derived = record.derivedStatus;
  if (derived != null && String(derived).trim() !== '') {
    return String(derived).trim();
  }
  const statusFieldKey = getPrimaryOrganizationStatusFieldKey(
    Array.isArray(record.types) ? record.types : []
  );
  if (!statusFieldKey) return null;
  const raw = record[statusFieldKey];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim();
}

/** True when config registry has computed a system-owned derived status on the record. */
export function isOrganizationDerivedStatusSystemOwned(
  record: Record<string, unknown> | null | undefined
): boolean {
  const derived = record?.derivedStatus;
  return derived != null && String(derived).trim() !== '';
}

/** Backing status field to persist Key Fields status edits (null when read-only). */
export function resolveOrganizationDerivedStatusSaveFieldKey(
  record: Record<string, unknown> | null | undefined
): string | null {
  if (isOrganizationDerivedStatusSystemOwned(record)) return null;
  return getPrimaryOrganizationStatusFieldKey(
    Array.isArray(record?.types) ? record.types : []
  );
}

/**
 * Get all participation fields for a specific app
 */
export function getOrganizationParticipationFields(appKey: string): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all fields eligible for Quick Create configuration.
 * Core + non-virtual participation fields (virtual roles use App Participation UI).
 */
export function getOrganizationQuickCreateFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) =>
      metadata.owner === 'core' ||
      (metadata.owner === 'participation' && !metadata.isVirtual)
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Fields shown in New Organization quick create on a fresh instance.
 * Keep aligned with INITIAL_ORGANIZATION_QUICK_CREATE in server/constants/organizationModuleDefaults.js.
 */
export const ORGANIZATION_QUICK_CREATE_DEFAULT = [
  'name',
  'industry',
  'phone',
  'website',
  'assignedTo',
] as const;

/**
 * Default key fields for Organizations on a fresh instance.
 * `types` = derived participation union (read-only summary on record).
 * Keep aligned with INITIAL_ORGANIZATION_KEY_FIELDS in server/constants/organizationModuleDefaults.js.
 */
export const ORGANIZATION_DEFAULT_KEY_FIELDS = [
  'types',
  'derivedStatus',
  'industry',
  'phone',
  'annualRevenue',
  'assignedTo',
] as const;

/**
 * Get all protected fields (cannot be deleted)
 */
export function getOrganizationProtectedFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.isProtected === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field into its group for UI display
 * Returns: 'core' | 'system' | app scope (e.g., 'SALES')
 * 
 * Uses base classification utility for consistency.
 */
export function classifyOrganizationField(fieldName: string): string {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

/**
 * Group organization fields by their classification
 * Used for UI rendering in ModulesAndFields.vue
 */
export function groupOrganizationFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const fieldKey of fieldKeys) {
    const classification = classifyOrganizationField(fieldKey);
    
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

/** ObjectId reference fields on CRM organizations — empty values must be null, not "". */
export const ORGANIZATION_REFERENCE_FIELD_KEYS = [
  'assignedTo',
  'primaryContact',
  'accountManager',
  'vendorContract',
  'logisticsPartner',
] as const;

/** System / audit fields that must never be sent on organization create/update. */
export const ORGANIZATION_SYSTEM_NON_EDITABLE_FIELD_KEYS = [
  'importHistoryId',
  'derivedStatus',
  'createdBy',
  'modifiedBy',
  'createdAt',
  'updatedAt',
  '_id',
  '__v',
  'organizationId',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'activityLogs',
  'source',
  'partnerOnboardingSteps',
] as const;

/**
 * Tenant/workspace infrastructure fields on Organization documents.
 * CRM business org create/update must never send these (aligned with mapOrganizationToSurface).
 */
export const ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS = [
  'isTenant',
  'slug',
  'subscription',
  'limits',
  'usage',
  'enabledApps',
  'enabledModules',
  'moduleOverrides',
  'aiSettings',
  'crmInitialized',
  'settings',
  'onboarding',
  'embed',
  'contentPublishing',
  'dataRegion',
  'security',
  'integrations',
  'database',
  'billing',
  'activityLogs',
  'legacyOrganizationId',
  'descriptionVersions',
  'emailMergeTagMappings',
  'emailExternalCssAllowlist',
  // Deferred CRM party fields (GST / external sync) — hide until product ships them on org forms
  'gstin',
  'gstRegistrationType',
  'gstRegistered',
  'gstCertificateUrl',
  'gstCertificateFileName',
  'companyName',
  'billingEmail',
  'billingPhone',
  'stateCode',
  'billingAddressStructured',
  'externalReferenceId',
  'syncStatus',
  'lastSyncAt',
] as const;

const ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM = ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS.map((key) =>
  normalizeFieldKeyForMetadataLookup(key)
);

/** Tenant/workspace fields and nested paths under them (e.g. subscription.stripeCustomerId). */
export function isTenantPlatformOrganizationFieldKey(fieldKey: string): boolean {
  const normalized = normalizeFieldKeyForMetadataLookup(String(fieldKey || ''));
  for (const root of ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM) {
    if (normalized === root) return true;
    if (normalized.startsWith(`${root}.`)) return true;
    if (normalized.startsWith(`${root}[`)) return true;
  }
  return false;
}

/** Remove tenant/platform fields from organization create/update payloads. */
export function stripOrganizationTenantPlatformFields(
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!isTenantPlatformOrganizationFieldKey(key)) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeOrganizationReferenceValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const id = obj._id ?? obj.id;
    if (id == null || id === '') return null;
    return String(id);
  }
  return String(value);
}

/** Sanitize organization edit/create payloads before API submission. */
export function normalizeOrganizationEditSubmitPayload(
  payload: Record<string, unknown> | null | undefined,
  moduleFields?: Array<{ key?: string; dataType?: string }>
): Record<string, unknown> {
  const out = stripOrganizationTenantPlatformFields(payload);

  for (const key of ORGANIZATION_SYSTEM_NON_EDITABLE_FIELD_KEYS) {
    delete out[key];
  }

  const referenceKeys = new Set<string>(ORGANIZATION_REFERENCE_FIELD_KEYS);
  for (const field of moduleFields || []) {
    const key = field?.key;
    if (!key) continue;
    const dataType = field.dataType || '';
    if (dataType === 'Lookup (Relationship)' || dataType === 'Lookup' || dataType === 'User') {
      referenceKeys.add(key);
    }
  }

  for (const key of referenceKeys) {
    if (!(key in out)) continue;
    out[key] = normalizeOrganizationReferenceValue(out[key]);
  }

  return out;
}

export type OrganizationSubmitPayloadMode = 'create' | 'edit';

/** Build create/edit API payload: type visibility filter + tenant/system strip + shape normalization. */
export function buildOrganizationSubmitPayload(
  formData: Record<string, unknown> | null | undefined,
  typeDefs: ReadonlyArray<OrganizationTypeFieldDef> | null | undefined,
  mode: OrganizationSubmitPayloadMode,
  moduleFields?: Array<{ key?: string; dataType?: string }>
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formData || {})) {
    if (key === 'derivedStatus') continue;
    raw[key] = value;
  }

  const selectedTypes = Array.isArray(raw.types) ? (raw.types as string[]) : [];
  let payload = filterOrganizationSubmitPayloadByTypes(raw, selectedTypes, typeDefs);
  payload = normalizeOrganizationEditSubmitPayload(payload, moduleFields);

  if (mode === 'create') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') continue;
        cleaned[key] = trimmed;
        continue;
      }
      if (Array.isArray(value)) {
        if (value.length === 0 && key !== 'types') continue;
        cleaned[key] = value;
        continue;
      }
      cleaned[key] = value;
    }
    if (Array.isArray(cleaned.types) && cleaned.types.length === 0) {
      delete cleaned.types;
    }
    return cleaned;
  }

  const out: Record<string, unknown> = { ...payload };
  if (typeof out.name === 'string') {
    out.name = out.name.trim();
  }
  out.types = selectedTypes;
  for (const [key, value] of Object.entries(out)) {
    if (key === 'name' || key === 'types') continue;
    if (typeof value === 'string' && value.trim() === '') {
      out[key] = null;
    }
  }
  return out;
}

/** Seed edit forms without tenant/system/reference noise from loaded records. */
export function stripOrganizationRecordForEditForm(
  record: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return normalizeOrganizationEditSubmitPayload(record);
}

/**
 * Check if a field should be excluded from Quick Create
 * Based on architecture: only core business fields are eligible
 */
export function isExcludedFromOrganizationQuickCreate(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  
  if (!metadata) {
    return true;
  }
  
  return metadata.owner === 'system';
}

// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

/**
 * Array of all organization field metadata objects.
 * @deprecated Use ORGANIZATION_FIELD_METADATA directly or FieldRegistry functions
 */
export const ORGANIZATION_FIELDS: OrganizationFieldMetadata[] = Object.entries(ORGANIZATION_FIELD_METADATA)
  .map(([fieldName, metadata]) => ({
    ...metadata,
    fieldKey: fieldName,
  } as OrganizationFieldMetadata & { fieldKey: string }))
  .map(({ fieldKey, ...metadata }) => metadata as OrganizationFieldMetadata);
