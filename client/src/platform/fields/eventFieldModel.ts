/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Event
 * ============================================================================
 * 
 * Canonical field metadata for Event entity.
 * 
 * This file encodes the authoritative field classification for Event records.
 * Events are platform-level entities (like Tasks) used across multiple apps.
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
 * 1. Events are platform-level entities
 *    - Core event fields are platform-scoped (CORE)
 *    - Events are used across multiple apps (SALES, AUDIT, etc.)
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 2. Core event fields are platform-scoped
 *    - `eventName`, `eventType`, `startDateTime`, `endDateTime`, `location`, etc.
 *    - These exist independently of any app participation
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 3. App participation fields are app-scoped
 *    - `auditState`, `auditorId`, `reviewerId` (AUDIT app)
 *    - `kpiTargets`, `allowedActions` (SALES app for Field Sales Beat)
 *    - These fields exist only because of specific app participation
 *    - fieldScope: 'AUDIT' | 'SALES' indicates app-level ownership
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdTime`, `modifiedTime`, `organizationId`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 5. Quick Create eligibility
 *    - Meeting-focused: eventName, eventType, assignedTo, attendees, meetingMode,
 *      startDateTime, endDateTime, meetingLink, location, agendaNotes, geoRequired
 *    - Audit roles / forms remain dependency-gated (not Meeting primary path)
 *    - See: docs/architecture/event-settings.md Section 7
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
// EVENT-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Events.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type EventFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Events.
 * Events module uses 'primary' for eventName, 'scheduling' for dates.
 */
export type EventFieldIntent = 'primary' | 'state' | 'scheduling' | 'detail' | 'system';

/**
 * Field scope classification for Events.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type EventFieldScope = BaseFieldScope;

/**
 * Filter type classification for Events.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type EventFilterType = BaseFilterType;

// =============================================================================
// EVENT FIELD METADATA INTERFACE
// =============================================================================

/**
 * Event-specific field metadata interface.
 * Extends BaseFieldMetadata with Event-specific intent types.
 */
export interface EventFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Events uses 'primary' for eventName, 'scheduling' for dates.
   */
  intent: EventFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Field metadata map - single source of truth for Event fields
 * 
 * Every Event field MUST be classified here.
 * Missing fields will cause runtime errors.
 */
export const EVENT_FIELD_METADATA: Record<string, EventFieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible): _id, __v, organizationId, eventId
  // Type B: Audit (visible, read-only): createdBy, createdTime, modifiedBy, modifiedTime
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
  eventId: {
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
  createdTime: {
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
  modifiedTime: {
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
  descriptionVersions: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  // Status: tenant label vocabulary under system categories (lifecycle API).
  // owner 'core' so create/detail can set editable:true (system owner forbids that).
  // Audit hide/edit still gated in DynamicForm + genericRecordAdapter.
  status: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    isSystem: false,
    editable: true,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 1,
  },
  statusCategory: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  completedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
  },
  cancelledAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
  },
  cancelledBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
  },
  cancellationReason: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
  },
  
  // ==========================================================================
  // CORE EVENT FIELDS (platform-scoped, app-agnostic)
  // ==========================================================================
  
  // Primary field - required, cannot be hidden or deleted
  eventName: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 2,
  },
  
  // Type and scheduling fields
  eventType: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    // Schema-required; create form always defaults to Meeting
    filterable: true,
    filterType: 'select',
    filterPriority: 3,
  },
  startDateTime: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 4,
  },
  endDateTime: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 5,
  },
  location: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  meetingMode: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  meetingLink: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  conferenceProvider: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  attendees: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  agendaNotes: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  
  // Detail fields
  notes: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  relatedToId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 6,
  },
  recurrence: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  
  // Assignment field
  assignedTo: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 7,
  },
  
  // ==========================================================================
  // AUDIT APP PARTICIPATION FIELDS
  // ==========================================================================
  
  // Audit workflow state
  auditState: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
    filterable: true,
    filterType: 'select',
    filterPriority: 8,
  },
  
  // Audit roles
  auditorId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 9,
  },
  reviewerId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 10,
  },
  correctiveOwnerId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
    filterable: true,
    filterType: 'user',
    filterPriority: 11,
  },
  
  // Audit configuration
  allowSelfReview: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  minVisitDuration: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  backgroundTracking: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  partnerVisibility: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  
  // Form linking
  linkedFormId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 12,
  },
  formAssignment: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  
  // GEO fields (execution-related, but configurable in settings)
  geoRequired: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  geoLocation: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  
  // Multi-org routing (for audit beats)
  isMultiOrg: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  orgList: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  routeSequence: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  currentOrgIndex: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  
  // Execution tracking (system-managed)
  checkIn: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  checkOut: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  executionStartTime: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  executionEndTime: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  timeSpent: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  isPaused: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  pauseReasons: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  minTimePerStop: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
  
  // Audit history
  auditHistory: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'AUDIT',
    editable: false,
    requiredFor: ['AUDIT'],
  },
  
  // ==========================================================================
  // SALES APP PARTICIPATION FIELDS (for Field Sales Beat)
  // ==========================================================================
  
  allowedActions: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    allowOnCreate: false,
  },
  kpiTargets: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    allowOnCreate: false,
  },
  kpiActuals: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    requiredFor: ['SALES'],
  },
  
  // ==========================================================================
  // PLATFORM FIELDS (visibility/permissions)
  // ==========================================================================
  
  visibility: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 13,
  },
  attachments: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  metadata: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates Event-specific field metadata for correctness.
 * Extends base validation with Event-specific rules.
 * Throws if invalid combinations are detected.
 */
function validateEventFieldMetadata(fieldName: string, metadata: EventFieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;

  // Event-specific: Core fields can have various intents (primary, state, scheduling, detail)
  const validCoreIntents = ['primary', 'state', 'scheduling', 'detail'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Event core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }

  // Event-specific: Participation fields must have intent: 'state' or 'detail'
  if (owner === 'participation' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": Event participation fields must have intent: 'state' or 'detail'. Found: ${intent}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllEventMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(EVENT_FIELD_METADATA)) {
    validateEventFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllEventMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for an event field
 * Returns undefined if field is not found (allows graceful handling of unknown fields)
 */
export function getEventFieldMetadata(fieldName: string): EventFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  
  if (EVENT_FIELD_METADATA[fieldName]) {
    return EVENT_FIELD_METADATA[fieldName];
  }
  
  for (const [key, metadata] of Object.entries(EVENT_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is a system field
 */
export function isEventSystemField(fieldName: string): boolean {
  const metadata = getEventFieldMetadata(fieldName);
  return metadata?.owner === 'system';
}

/**
 * Check if a field is a core event field
 */
export function isEventCoreField(fieldName: string): boolean {
  const metadata = getEventFieldMetadata(fieldName);
  return metadata?.owner === 'core';
}

/**
 * Check if a field is a protected field (cannot be deleted)
 */
export function isEventProtectedField(fieldName: string): boolean {
  const metadata = getEventFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

/**
 * Get all core event fields (platform-owned)
 */
export function getCoreEventFields(): string[] {
  return Object.entries(EVENT_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all system fields
 */
export function getEventSystemFields(): string[] {
  return Object.entries(EVENT_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all participation fields for a specific app
 */
export function getEventParticipationFields(appKey: string): string[] {
  return Object.entries(EVENT_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all fields eligible for Quick Create
 * Meeting-oriented: eventName, eventType, assignedTo, attendees, meetingMode,
 * start/end, meetingLink, location, agendaNotes (+ geo optional)
 */
export function getEventQuickCreateFields(): string[] {
  return Object.entries(EVENT_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.allowOnCreate === true || 
      (metadata.owner === 'core' && metadata.intent === 'primary')
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all protected fields (cannot be deleted)
 */
export function getEventProtectedFields(): string[] {
  return Object.entries(EVENT_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.isProtected === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field into its group for UI display
 * Returns: 'core' | 'system' | app scope (e.g., 'AUDIT', 'SALES')
 * 
 * Uses base classification utility for consistency.
 */
export function classifyEventField(fieldName: string): string {
  const metadata = getEventFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

/**
 * Group event fields by their classification
 * Used for UI rendering in ModulesAndFields.vue
 */
export function groupEventFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const fieldKey of fieldKeys) {
    const classification = classifyEventField(fieldKey);
    
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
 * Based on architecture: only minimal scheduling-safe fields are eligible
 */
export function isExcludedFromEventQuickCreate(fieldName: string): boolean {
  const metadata = getEventFieldMetadata(fieldName);
  
  if (!metadata) {
    // Unknown fields are excluded
    return true;
  }
  
  // System fields are always excluded
  if (metadata.owner === 'system') {
    return true;
  }
  
  // Participation fields are excluded (audit roles, geo, forms, etc.)
  if (metadata.owner === 'participation') {
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
 * Array of all event field metadata objects.
 * @deprecated Use EVENT_FIELD_METADATA directly or FieldRegistry functions
 */
export const EVENT_FIELDS: EventFieldMetadata[] = Object.entries(EVENT_FIELD_METADATA)
  .map(([fieldName, metadata]) => ({
    ...metadata,
    fieldKey: fieldName,
  } as EventFieldMetadata & { fieldKey: string }))
  .map(({ fieldKey: _fieldKey, ...metadata }) => metadata as EventFieldMetadata);
