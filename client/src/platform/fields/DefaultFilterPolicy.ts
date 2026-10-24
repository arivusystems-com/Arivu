/**
 * ============================================================================
 * PLATFORM DEFAULT FILTER POLICY
 * ============================================================================
 * 
 * Metadata-driven policy for suggesting default filters in list views.
 * 
 * ⚠️ ARCHITECTURAL CONTRACT:
 * 
 * 1. This policy SUGGESTS defaults only
 *    - UI must explicitly opt-in to use these suggestions
 *    - User-customized filters ALWAYS take precedence
 *    - Saved filter configurations are never overwritten
 * 
 * 2. Policy is PURE and DETERMINISTIC
 *    - No side effects
 *    - No mutations to field metadata
 *    - No persistence or caching
 *    - Same input always produces same output
 * 
 * 3. Policy uses FieldRegistry exclusively
 *    - No direct imports of field models
 *    - No module-specific logic hardcoded
 *    - Relies entirely on field metadata properties
 * 
 * ============================================================================
 * 
 * FILTER ELIGIBILITY RULES:
 * 
 * A field is eligible for default filters if:
 * - field.filterable === true (required)
 * - field.isProtected !== true (protected fields excluded)
 * 
 * ============================================================================
 * 
 * RANKING ALGORITHM:
 * 
 * Fields are ranked by the following criteria (in order):
 * 
 * 1. filterPriority (ascending, lower = higher priority)
 *    - Fields with explicit filterPriority are ranked first
 *    - Fields without filterPriority get a default of 999
 * 
 * 2. intent order (if filterPriority is equal):
 *    - primary     (1) - Core identifying fields
 *    - identity    (2) - Identity attributes
 *    - state       (3) - Workflow/lifecycle state
 *    - scheduling  (4) - Time-related fields
 *    - tracking    (5) - Metrics/progress fields
 *    - detail      (6) - Contextual information
 *    - system      (7) - Infrastructure fields
 * 
 * 3. owner order (if intent is equal):
 *    - core          (1) - Platform-owned fields
 *    - participation (2) - App-specific fields
 *    - system        (3) - Infrastructure fields
 * 
 * ============================================================================
 * 
 * USAGE EXAMPLES:
 * 
 * ```typescript
 * // Get default filters for a module
 * const defaultFilters = getDefaultFiltersForModule('people');
 * // Returns: ['assignedTo', 'sales_type', 'do_not_contact', 'organization']
 * 
 * // Get with custom limit
 * const topFilters = getDefaultFiltersForModule('tasks', { maxFilters: 3 });
 * // Returns: ['title', 'status', 'priority']
 * 
 * // Check if a field would be a default filter
 * const isDefault = isDefaultFilter('people', 'assignedTo');
 * // Returns: true
 * ```
 * 
 * ============================================================================
 */

import {
  MODULE_KEYS,
  getFieldMetadataMap,
  getFilterableFieldsForModule,
  type ModuleKey,
} from './FieldRegistry';
import type { BaseFieldIntent, BaseFieldOwner } from './BaseFieldModel';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default maximum number of filters to suggest.
 * Can be overridden per-call via options.
 */
const DEFAULT_MAX_FILTERS = 5;

/**
 * Intent priority order (lower = higher priority).
 * Used when filterPriority is not defined or equal.
 */
const INTENT_PRIORITY: Record<BaseFieldIntent, number> = {
  primary: 1,
  identity: 2,
  state: 3,
  scheduling: 4,
  tracking: 5,
  detail: 6,
  system: 7,
};

/**
 * Owner priority order (lower = higher priority).
 * Used when intent priority is equal.
 */
const OWNER_PRIORITY: Record<BaseFieldOwner, number> = {
  core: 1,
  participation: 2,
  system: 3,
};

/**
 * Default filterPriority for fields without explicit priority.
 */
const DEFAULT_FILTER_PRIORITY = 999;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for getDefaultFiltersForModule.
 */
export interface DefaultFilterOptions {
  /**
   * Maximum number of filters to return.
   * Default: 5
   */
  maxFilters?: number;
  
  /**
   * Whether to include protected fields.
   * Default: false
   */
  includeProtected?: boolean;
}

/**
 * Internal type for field ranking.
 */
interface RankedField {
  fieldKey: string;
  filterPriority: number;
  intentPriority: number;
  ownerPriority: number;
}

// =============================================================================
// CORE POLICY FUNCTIONS
// =============================================================================

/**
 * Get default filters for a module based on field metadata.
 * 
 * This function suggests which fields should appear as default filters
 * in list views. It uses field metadata to determine eligibility and ranking.
 * 
 * ⚠️ IMPORTANT:
 * - This is a SUGGESTION only
 * - UI must explicitly opt-in to use these defaults
 * - User-customized filters always take precedence
 * 
 * @param moduleKey - The module to get default filters for
 * @param options - Optional configuration
 * @returns Ordered array of field keys (most important first)
 */
export function getDefaultFiltersForModule(
  moduleKey: ModuleKey,
  options: DefaultFilterOptions = {}
): string[] {
  const {
    maxFilters = DEFAULT_MAX_FILTERS,
    includeProtected = false,
  } = options;
  
  // Get all filterable fields for the module
  const filterableFields = getFilterableFieldsForModule(moduleKey);
  
  if (filterableFields.length === 0) {
    return [];
  }
  
  // Get the metadata map for ranking
  const metadataMap = getFieldMetadataMap(moduleKey);
  
  if (!metadataMap) {
    return [];
  }
  
  // Filter eligible fields and rank them
  const rankedFields: RankedField[] = [];
  
  for (const fieldKey of filterableFields) {
    const metadata = metadataMap[fieldKey];
    
    if (!metadata) {
      continue;
    }
    
    // Skip protected fields unless explicitly included
    if (!includeProtected && metadata.isProtected === true) {
      continue;
    }
    
    // Calculate ranking scores
    const filterPriority = metadata.filterPriority ?? DEFAULT_FILTER_PRIORITY;
    const intentPriority = getIntentPriority(metadata.intent);
    const ownerPriority = getOwnerPriority(metadata.owner);
    
    rankedFields.push({
      fieldKey,
      filterPriority,
      intentPriority,
      ownerPriority,
    });
  }
  
  // Sort by ranking criteria
  rankedFields.sort(compareRankedFields);
  
  // Apply cap and return field keys only
  return rankedFields
    .slice(0, maxFilters)
    .map(rf => rf.fieldKey);
}

/**
 * Check if a field would be included in default filters for a module.
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key to check
 * @param options - Optional configuration (uses same maxFilters as getDefaultFiltersForModule)
 * @returns true if the field would be a default filter
 */
export function isDefaultFilter(
  moduleKey: ModuleKey,
  fieldKey: string,
  options: DefaultFilterOptions = {}
): boolean {
  const defaultFilters = getDefaultFiltersForModule(moduleKey, options);
  return defaultFilters.includes(fieldKey);
}

/**
 * Get the ranking position of a field in default filters.
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key to check
 * @param options - Optional configuration
 * @returns The 0-based position, or -1 if not a default filter
 */
export function getDefaultFilterPosition(
  moduleKey: ModuleKey,
  fieldKey: string,
  options: DefaultFilterOptions = {}
): number {
  const defaultFilters = getDefaultFiltersForModule(moduleKey, options);
  return defaultFilters.indexOf(fieldKey);
}

/**
 * Get all eligible filter fields for a module (before cap is applied).
 * Useful for understanding the full filter landscape.
 * 
 * @param moduleKey - The module key
 * @param options - Optional configuration
 * @returns Ordered array of all eligible field keys
 */
export function getAllEligibleFilters(
  moduleKey: ModuleKey,
  options: Omit<DefaultFilterOptions, 'maxFilters'> = {}
): string[] {
  return getDefaultFiltersForModule(moduleKey, {
    ...options,
    maxFilters: Infinity,
  });
}

/**
 * Get filter eligibility details for a field.
 * Useful for debugging and understanding why a field is/isn't a default filter.
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key
 * @returns Eligibility details, or null if field not found
 */
export function getFilterEligibilityDetails(
  moduleKey: ModuleKey,
  fieldKey: string
): {
  isFilterable: boolean;
  isProtected: boolean;
  filterPriority: number | undefined;
  intentPriority: number;
  ownerPriority: number;
  wouldBeDefault: boolean;
  defaultPosition: number;
} | null {
  const metadataMap = getFieldMetadataMap(moduleKey);
  
  if (!metadataMap || !metadataMap[fieldKey]) {
    return null;
  }
  
  const metadata = metadataMap[fieldKey];
  
  return {
    isFilterable: metadata.filterable === true,
    isProtected: metadata.isProtected === true,
    filterPriority: metadata.filterPriority,
    intentPriority: getIntentPriority(metadata.intent),
    ownerPriority: getOwnerPriority(metadata.owner),
    wouldBeDefault: isDefaultFilter(moduleKey, fieldKey),
    defaultPosition: getDefaultFilterPosition(moduleKey, fieldKey),
  };
}

// =============================================================================
// CROSS-MODULE FUNCTIONS
// =============================================================================

/**
 * Get default filters for all registered modules.
 * 
 * @param options - Optional configuration (applied to all modules)
 * @returns Map of module key to default filter arrays
 */
export function getDefaultFiltersForAllModules(
  options: DefaultFilterOptions = {}
): Record<ModuleKey, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const moduleKey of MODULE_KEYS) {
    result[moduleKey] = getDefaultFiltersForModule(moduleKey as ModuleKey, options);
  }
  
  return result as Record<ModuleKey, string[]>;
}

// =============================================================================
// INTERNAL HELPER FUNCTIONS
// =============================================================================

/**
 * Get intent priority for ranking.
 * Handles unknown intents gracefully.
 */
function getIntentPriority(intent: string): number {
  return INTENT_PRIORITY[intent as BaseFieldIntent] ?? INTENT_PRIORITY.detail;
}

/**
 * Get owner priority for ranking.
 * Handles unknown owners gracefully.
 */
function getOwnerPriority(owner: string): number {
  return OWNER_PRIORITY[owner as BaseFieldOwner] ?? OWNER_PRIORITY.system;
}

/**
 * Compare two ranked fields for sorting.
 * Returns negative if a should come before b.
 */
function compareRankedFields(a: RankedField, b: RankedField): number {
  // 1. Compare by filterPriority (ascending)
  if (a.filterPriority !== b.filterPriority) {
    return a.filterPriority - b.filterPriority;
  }
  
  // 2. Compare by intent priority (ascending)
  if (a.intentPriority !== b.intentPriority) {
    return a.intentPriority - b.intentPriority;
  }
  
  // 3. Compare by owner priority (ascending)
  if (a.ownerPriority !== b.ownerPriority) {
    return a.ownerPriority - b.ownerPriority;
  }
  
  // 4. Stable sort by field key (alphabetical)
  return a.fieldKey.localeCompare(b.fieldKey);
}
