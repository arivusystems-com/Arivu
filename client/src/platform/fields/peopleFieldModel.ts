/**
 * ============================================================================
 * PLATFORM FIELD MODEL: People
 * ============================================================================
 * 
 * Canonical field metadata for People entity.
 * 
 * This file encodes the authoritative field classification as defined in:
 * docs/architecture/field-model.md
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
 * 1. People has NO global type
 *    - SALES role (Lead/Contact) is virtual field `sales_type` → participations.SALES.role
 *    - Other apps may define their own `type` fields independently
 *    - Shared labels do NOT imply shared semantics
 * 
 * 2. Classification fields are participation-scoped
 *    - `sales_type`, `lead_status`, `contact_status` are SALES-specific
 *    - These fields exist only because of SALES app participation
 *    - They are NOT core identity attributes
 * 
 * 3. Core identity fields are platform-scoped
 *    - `first_name`, `last_name`, `email`, `phone`, etc.
 *    - These exist independently of any app participation
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `assignedTo`, `createdAt`, `updatedAt`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
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
import { validateBaseFieldMetadata } from './BaseFieldModel';
import { isGlobalSystemFieldKey } from './globalSystemFields';

export { mergePeopleVirtualFieldDefinitions } from './peopleFieldRegistry';

// =============================================================================
// PEOPLE-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for People.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type FieldOwner = BaseFieldOwner;

/**
 * Field intent classification for People.
 * People module uses 'identity' for core fields instead of 'primary'.
 */
export type FieldIntent = 'identity' | 'state' | 'detail' | 'system';

/**
 * Field scope classification for People.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type FieldScope = BaseFieldScope;

/**
 * Filter type classification for People.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type FilterType = BaseFilterType;

// =============================================================================
// PEOPLE FIELD METADATA INTERFACE
// =============================================================================

/**
 * People-specific field metadata interface.
 * Extends BaseFieldMetadata with People-specific intent types.
 */
export interface FieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * People uses 'identity' for core fields (vs 'primary' in base model).
   */
  intent: FieldIntent;

  /**
   * When true, the field is stored under participations[appKey] (e.g. role), not as a top-level document key.
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
 * Field metadata map - single source of truth
 * 
 * Every People field MUST be classified here.
 * Missing fields will cause runtime errors.
 */
export const PEOPLE_FIELD_METADATA: Record<string, FieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible): organizationId, legacyContactId, importHistoryId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy
  // assignedTo belongs to core identity (editable owner assignment)
  // Type C: Computed: activityLogs, derivedStatus, descriptionVersions
  // ==========================================================================
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  assignedTo: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 1,
    isSystem: false,
    isVisibleInConfig: true,
  },
  legacyContactId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  importHistoryId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  // Duplicate merge — set by mergeService only (Type A infrastructure)
  mergedInto: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  mergedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  mergedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
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
  activityLogs: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false, // Managed internally, too verbose for config
  },
  participations: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false, // App participation data; type/lead_status/contact_status are flattened for config
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
  descriptionVersions: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: true,
  },

  // External User / Portal access — platform-managed via portalAccessService
  'portalAccess.enabled': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.userId': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.enabledAt': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.enabledBy': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.disabledAt': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.disabledBy': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  'portalAccess.lastSyncedAt': {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },

  // ==========================================================================
  // CORE IDENTITY FIELDS (platform-scoped, app-agnostic)
  // ==========================================================================
  salutation: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    isVisibleInConfig: false,
  },
  first_name: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  last_name: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  email: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  phone: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  mobile: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  tags: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
  },
  do_not_contact: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'boolean',
    filterPriority: 3,
  },
  source: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    filterable: true,
    filterType: 'select',
  },
  organization: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'entity',
    filterPriority: 4,
  },

  // ==========================================================================
  // SALES PARTICIPATION — STATE FIELDS
  // Canonical SALES role (Lead/Contact) is virtual field sales_type → participations.SALES.role
  // ==========================================================================
  // ⚠️ Do NOT use person.type directly in UI. Use getParticipation(person, 'SALES') or sales_type.
  lead_status: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'], // Declarative: SALES app requires this field
  },
  contact_status: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'], // Declarative: SALES app requires this field
  },

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
  // Virtual: HELPDESK participation role
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
  // SALES PARTICIPATION — DETAIL FIELDS
  // These fields provide contextual information and can be hidden.
  // ==========================================================================
  lead_owner: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  lead_score: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  interest_products: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  qualification_date: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  qualification_notes: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  estimated_value: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  role: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  birthday: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
  preferred_contact_method: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates People-specific field metadata for correctness.
 * Extends base validation with People-specific rules.
 * Throws if invalid combinations are detected.
 */
function validatePeopleFieldMetadata(fieldName: string, metadata: FieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent, allowOnCreate } = metadata;

  // People-specific: Core fields must have intent: 'identity'
  if (owner === 'core' && intent !== 'identity') {
    throw new Error(
      `Field "${fieldName}": People core fields must have intent: 'identity'. Found: ${intent}`
    );
  }

  // People-specific: Participation fields must have intent: 'state' or 'detail'
  if (owner === 'participation' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": People participation fields must have intent: 'state' or 'detail'. Found: ${intent}`
    );
  }

  // People-specific: allowOnCreate is only allowed on system fields
  if (allowOnCreate !== undefined && owner !== 'system') {
    throw new Error(
      `Field "${fieldName}": allowOnCreate is only allowed on system fields. Found on: ${owner}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(PEOPLE_FIELD_METADATA)) {
    validatePeopleFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for a field
 * Throws if field is not found (fail-fast)
 */
export function getFieldMetadata(fieldName: string): FieldMetadata {
  const key = fieldName === 'type' ? 'sales_type' : fieldName;
  const metadata = PEOPLE_FIELD_METADATA[key];
  if (!metadata) {
    throw new Error(
      `Field "${fieldName}" is missing from PEOPLE_FIELD_METADATA. ` +
      `All People fields must be classified in peopleFieldModel.ts`
    );
  }
  return metadata;
}

/**
 * Check if a field is a system field
 */
export function isSystemField(fieldName: string): boolean {
  const metadata = getFieldMetadata(fieldName);
  return metadata.owner === 'system';
}

/**
 * Canonical People Quick Create default. Kept in sync with server/constants/peopleModuleDefaults.js.
 * Used by Settings → People → Quick Create and Create people drawer when no config saved.
 * App Participation is always shown as a separate drawer section — not listed here.
 */
export const PEOPLE_QUICK_CREATE_DEFAULT = [
  'first_name',
  'last_name',
  'email',
  'mobile',
  'organization',
  'assignedTo',
];

/**
 * Get quick create fields from people module config.
 * Source of truth: Settings → People → Quick Create.
 *
 * @param module - People module definition (from /modules/people/quick-create)
 * @returns Field keys for quick create (identity creation)
 */
export function getPeopleQuickCreateFields(module: { quickCreate?: string[] } | null | undefined): string[] {
  const qc = module?.quickCreate;
  const keys =
    Array.isArray(qc) && qc.length > 0
      ? qc.map((f) => (typeof f === 'string' ? f : (f as any)?.key ?? f)).filter(Boolean)
      : [...PEOPLE_QUICK_CREATE_DEFAULT];
  // Never show platform-managed fields (e.g. source) even if still saved in Settings quickCreate
  return keys.filter((k) => k && !isGlobalSystemFieldKey(String(k)));
}

/**
 * Get all core identity fields
 */
export function getCoreIdentityFields(): string[] {
  return Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'core' && metadata.intent === 'identity'
    )
    .map(([fieldName]) => fieldName);
}

/** SALES: prefer virtual `sales_type`; legacy `type` is API-only, not listed in UI field enumerations. */
function excludeLegacySalesTypeKey(appKey: string, fieldNames: string[]): string[] {
  if (appKey !== 'SALES') return fieldNames;
  return fieldNames.filter((n) => n !== 'type');
}

/**
 * HELPDESK: virtual `helpdesk_role` is the same storage as AppSection "Type" (participations.HELPDESK.role).
 * Never list it as an extra dependent field — including for tenant-defined types not in APP_ROLE_FIELDS.
 */
function excludeHelpdeskRoleDuplicate(appKey: string, fieldKeys: string[]): string[] {
  if (appKey !== 'HELPDESK') return fieldKeys;
  return fieldKeys.filter((k) => k !== 'helpdesk_role');
}

/**
 * Get all participation fields for a specific app
 */
export function getParticipationFields(appKey: string): string[] {
  const names = Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
  return excludeLegacySalesTypeKey(appKey, names);
}

/**
 * Get all state fields for a specific app
 */
export function getStateFields(appKey: string): string[] {
  const names = Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' &&
      metadata.fieldScope === appKey &&
      metadata.intent === 'state'
    )
    .map(([fieldName]) => fieldName);
  return excludeLegacySalesTypeKey(appKey, names);
}

/**
 * Get all detail fields for a specific app
 */
export function getDetailFields(appKey: string): string[] {
  return Object.entries(PEOPLE_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' &&
      metadata.fieldScope === appKey &&
      metadata.intent === 'detail'
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Role → fields mapping per app. Used by getAppFields() for dynamic field resolution.
 * Extensible: add new apps/roles as they are introduced.
 */
const APP_ROLE_FIELDS: Record<string, Record<string, string[]>> = {
  SALES: {
    Lead: ['lead_status', 'lead_score', 'lead_owner', 'interest_products', 'qualification_date', 'qualification_notes', 'estimated_value'],
    Contact: ['contact_status', 'role', 'birthday', 'preferred_contact_method'],
  },
  HELPDESK: {
    Customer: [], // Type is chosen in AppSection; no extra participation fields yet
    Agent: [],
  },
};

/** Optional tenant type rows from Settings → People → Types (`fields` per type overrides defaults). */
export type PeopleTypeFieldDef = { value: string; fields?: string[] };

/**
 * Get app-specific participation fields for a given role/type.
 * Used when creating a person in app context (e.g. SALES + Lead → lead_status, etc.).
 *
 * @param appKey - App key (e.g. 'SALES', 'HELPDESK')
 * @param role - Selected type/role (e.g. 'Lead', 'Contact', 'Customer')
 * @param typeDefs - When the matching type has `fields` defined (including `[]`), that list is used; otherwise platform defaults apply.
 * @returns Field keys to show for this app + role combo
 */
export function getAppFields(
  appKey: string,
  role: string,
  typeDefs?: ReadonlyArray<PeopleTypeFieldDef> | null
): string[] {
  const normalizedApp = appKey?.trim().toUpperCase();
  const normalizedRole = role?.trim();
  if (!normalizedApp || !normalizedRole) return [];

  let out: string[] | undefined;

  if (typeDefs?.length) {
    const match = typeDefs.find(
      (d) => String(d?.value ?? '').trim().toLowerCase() === normalizedRole.toLowerCase()
    );
    if (match && match.fields !== undefined) {
      out = Array.isArray(match.fields) ? [...match.fields] : [];
    }
  }

  if (out === undefined) {
    const appMapping = APP_ROLE_FIELDS[normalizedApp];
    if (!appMapping) {
      out = getParticipationFields(normalizedApp);
    } else {
      let fields = appMapping[normalizedRole];
      if (!Array.isArray(fields)) {
        const key = Object.keys(appMapping).find(
          (k) => k.toLowerCase() === normalizedRole.toLowerCase()
        );
        if (key !== undefined) fields = appMapping[key];
      }
      if (Array.isArray(fields)) {
        out = [...fields];
      } else {
        out = getParticipationFields(normalizedApp);
      }
    }
  }

  return excludeHelpdeskRoleDuplicate(normalizedApp, out);
}
