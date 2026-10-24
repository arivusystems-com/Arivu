/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Tasks
 * ============================================================================
 * 
 * Canonical field metadata for Task entity.
 * 
 * This file encodes the authoritative field classification as defined in:
 * docs/architecture/task-settings.md
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
 * 1. Tasks is a platform core module
 *    - Tasks are shared across all apps (Sales, Helpdesk, Audit, Projects)
 *    - Core task fields are platform-scoped
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 2. Core task fields are platform-scoped
 *    - `title`, `description`, `status`, `priority`, `taskType`, `dueDate`, etc.
 *    - These exist independently of any app participation
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 3. App participation fields are app-scoped
 *    - `salesStageTaskType`, `helpdeskSLA`, `auditCorrectiveFlag`, etc.
 *    - These fields exist only because of specific app participation
 *    - fieldScope: 'SALES' | 'HELPDESK' | 'AUDIT' indicates app-level ownership
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 5. Quick Create eligibility
 *    - Default: title (required), dueDate, taskType, status, priority, relatedTo, description, assignedTo (required)
 *    - Excluded: app fields, system fields, time tracking, subtasks, tags, startDate
 *    - See: docs/architecture/task-settings.md Section 3.5
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
// TASK-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Tasks.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type TaskFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Tasks.
 * Tasks module uses additional intents: 'primary', 'scheduling', 'tracking'.
 */
export type TaskFieldIntent = 'primary' | 'scheduling' | 'state' | 'detail' | 'tracking' | 'system';

/**
 * Field scope classification for Tasks.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type TaskFieldScope = BaseFieldScope;

/**
 * Filter type classification for Tasks.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type TaskFilterType = BaseFilterType;

// =============================================================================
// TASK FIELD METADATA INTERFACE
// =============================================================================

/**
 * Task-specific field metadata interface.
 * Extends BaseFieldMetadata with Task-specific intent types.
 */
export interface TaskFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Tasks uses additional intents: 'primary', 'scheduling', 'tracking'.
   */
  intent: TaskFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Field metadata map - single source of truth for Task fields
 * 
 * Every Task field MUST be classified here.
 * Missing fields will cause runtime errors.
 */
export const TASK_FIELD_METADATA: Record<string, TaskFieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible in config): _id, __v, organizationId
  // Type B: Audit/Ownership (visible, read-only): createdAt, updatedAt, createdBy, assignedBy
  // Type C: Computed: activityLogs, reminderSent, descriptionVersions
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
  assignedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  completedDate: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  completedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  reminderDate: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  reminderSent: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
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
  activityLogs: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false, // Managed internally, too verbose for config
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
  relatedToType: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  relatedToId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },

  // ==========================================================================
  // CORE TASK FIELDS (platform-scoped, app-agnostic)
  // ==========================================================================
  
  // Primary field - required, cannot be hidden or deleted
  title: {
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
  
  // Description - core detail field
  description: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  
  // Status - core state field
  status: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 2,
  },
  
  // Priority - core state field
  priority: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 3,
  },

  // Task Type - core classification field
  taskType: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 6,
  },
  
  // Assignment - core field with special handling
  assignedTo: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 4,
  },
  
  // Scheduling fields
  dueDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 5,
  },
  startDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false, // Not essential for Quick Create
  },
  
  // Relationship field (core – single combined type + record)
  relatedTo: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity',
    filterPriority: 6,
  },
  
  // Project reference
  projectId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 7,
  },
  
  // Tags - classification field
  tags: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false, // Can be added in full task edit
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 8,
  },
  
  // ==========================================================================
  // TIME TRACKING FIELDS (core but not Quick Create eligible)
  // ==========================================================================
  estimatedHours: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false, // Task management feature, not Quick Create
  },
  actualHours: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false, // Task management feature, not Quick Create
  },
  
  // Subtasks - complex nested field
  subtasks: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false, // Task management complexity, not Quick Create
  },

  // ==========================================================================
  // SALES APP PARTICIPATION FIELDS
  // ==========================================================================
  salesStageTaskType: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    allowOnCreate: false,
  },

  // ==========================================================================
  // HELPDESK APP PARTICIPATION FIELDS
  // ==========================================================================
  helpdeskSLA: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'HELPDESK',
    editable: true,
    requiredFor: ['HELPDESK'],
    allowOnCreate: false,
  },

  // ==========================================================================
  // AUDIT APP PARTICIPATION FIELDS
  // ==========================================================================
  auditCorrectiveFlag: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'AUDIT',
    editable: true,
    requiredFor: ['AUDIT'],
    allowOnCreate: false,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates Task-specific field metadata for correctness.
 * Extends base validation with Task-specific rules.
 * Throws if invalid combinations are detected.
 */
function validateTaskFieldMetadata(fieldName: string, metadata: TaskFieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;

  // Task-specific: Core fields can have various intents (primary, scheduling, state, detail, tracking)
  const validCoreIntents = ['primary', 'scheduling', 'state', 'detail', 'tracking'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Task core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }

  // Task-specific: Participation fields must have intent: 'state' or 'detail'
  if (owner === 'participation' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": Task participation fields must have intent: 'state' or 'detail'. Found: ${intent}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllTaskMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(TASK_FIELD_METADATA)) {
    validateTaskFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllTaskMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for a task field
 * Returns undefined if field is not found (allows graceful handling of unknown fields)
 */
export function getTaskFieldMetadata(fieldName: string): TaskFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  
  // Try exact match first
  if (TASK_FIELD_METADATA[fieldName]) {
    return TASK_FIELD_METADATA[fieldName];
  }
  
  // Try normalized match (handles Status vs status, related-to vs relatedTo)
  for (const [key, metadata] of Object.entries(TASK_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is a system field
 */
export function isTaskSystemField(fieldName: string): boolean {
  const metadata = getTaskFieldMetadata(fieldName);
  return metadata?.owner === 'system';
}

/**
 * Check if a field is a core task field
 */
export function isTaskCoreField(fieldName: string): boolean {
  const metadata = getTaskFieldMetadata(fieldName);
  return metadata?.owner === 'core';
}

/**
 * Check if a field is a protected field (cannot be deleted)
 */
export function isTaskProtectedField(fieldName: string): boolean {
  const metadata = getTaskFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

/**
 * Get all core task fields (platform-owned)
 */
export function getCoreTaskFields(): string[] {
  return Object.entries(TASK_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all system fields
 */
export function getTaskSystemFields(): string[] {
  return Object.entries(TASK_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all participation fields for a specific app
 */
export function getTaskParticipationFields(appKey: string): string[] {
  return Object.entries(TASK_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all fields eligible for Quick Create
 * Default: title*, dueDate, taskType, status, priority, relatedTo, description, assignedTo*
 */
export function getTaskQuickCreateFields(): string[] {
  return Object.entries(TASK_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.allowOnCreate === true || 
      (metadata.owner === 'core' && metadata.intent === 'primary')
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all protected fields (cannot be deleted)
 */
export function getTaskProtectedFields(): string[] {
  return Object.entries(TASK_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.isProtected === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field into its group for UI display
 * Returns: 'core' | 'system' | app scope (e.g., 'SALES', 'HELPDESK', 'AUDIT')
 * 
 * Uses base classification utility for consistency.
 */
export function classifyTaskField(fieldName: string): string {
  const metadata = getTaskFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

/**
 * Group task fields by their classification
 * Used for UI rendering in ModulesAndFields.vue
 */
export function groupTaskFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const fieldKey of fieldKeys) {
    const classification = classifyTaskField(fieldKey);
    
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
 * Based on architecture: app fields, system fields, time tracking, subtasks, tags (allowOnCreate: false)
 */
export function isExcludedFromQuickCreate(fieldName: string): boolean {
  const metadata = getTaskFieldMetadata(fieldName);
  
  if (!metadata) {
    // Unknown fields are excluded
    return true;
  }
  
  // System fields are always excluded
  if (metadata.owner === 'system') {
    return true;
  }
  
  // Participation fields are excluded
  if (metadata.owner === 'participation') {
    return true;
  }
  
  // Core fields with allowOnCreate: false are excluded
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) {
    return true;
  }
  
  return false;
}
