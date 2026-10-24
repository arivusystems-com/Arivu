/**
 * ============================================================================
 * PLATFORM FIELD EDITABILITY POLICY
 * ============================================================================
 * 
 * Role-aware policy for determining field editability based on user roles.
 * 
 * ⚠️ ARCHITECTURAL CONTRACT:
 * 
 * 1. This policy SUGGESTS editability only
 *    - Does NOT enforce permissions
 *    - Does NOT block UI interactions
 *    - Does NOT modify field metadata
 *    - UI and services must explicitly opt-in to use these rules
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
 * 4. Enforcement will come later (if needed)
 *    - This policy provides the rules
 *    - Permission enforcement is a separate concern
 *    - UI components can use this to guide behavior
 * 
 * ============================================================================
 * 
 * EDITABILITY RULES:
 * 
 * BASE RULES (always applied, regardless of role):
 * - If field.editable === false → return false
 * - If field.isProtected === true → return false
 * 
 * ROLE RULES (applied after base rules):
 * 
 * admin:
 *   - Can edit all non-protected fields
 *   - Can edit system-owned fields (unless overridden)
 * 
 * manager:
 *   - Can edit core and participation fields
 *   - Cannot edit system-owned fields
 * 
 * member:
 *   - Can only edit:
 *     - owner === 'participation' (app-specific fields)
 *     - owner === 'core' AND intent !== 'system' (core non-system fields)
 *   - Cannot edit system-owned fields
 * 
 * viewer:
 *   - Cannot edit any fields
 * 
 * ============================================================================
 * 
 * USAGE EXAMPLES:
 * 
 * ```typescript
 * // Check if a field can be edited by a role
 * const canEdit = canEditField('people', 'email', 'member');
 * // Returns: true (core field, not system)
 * 
 * // Get all editable fields for a role
 * const editableFields = getEditableFieldsForRole('tasks', 'manager');
 * // Returns: ['title', 'description', 'priority', ...]
 * 
 * // Check with custom options
 * const canEditSystem = canEditField('people', 'createdBy', 'admin', {
 *   allowSystemEditsForAdmins: true
 * });
 * // Returns: false (protected field)
 * ```
 * 
 * ============================================================================
 */

import {
  MODULE_KEYS,
  getFieldMetadataMap,
  getFieldsForModule,
  type ModuleKey,
} from './FieldRegistry';
import type { BaseFieldOwner } from './BaseFieldModel';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported user roles for editability checks.
 */
export type UserRole = 'admin' | 'manager' | 'member' | 'viewer';

/**
 * Options for editability checks.
 */
export interface EditabilityOptions {
  /**
   * Whether admins can edit system-owned fields.
   * Default: true (admins can edit system fields)
   */
  allowSystemEditsForAdmins?: boolean;
  
  /**
   * Whether to include protected fields in results.
   * Default: false (protected fields are excluded)
   */
  includeProtected?: boolean;
}

// =============================================================================
// CORE POLICY FUNCTION
// =============================================================================

/**
 * Check if a field can be edited by a given user role.
 * 
 * This function implements conservative, role-aware editability rules
 * based on field metadata. It does NOT enforce permissions - it only
 * provides the policy decision.
 * 
 * BASE RULES (always applied):
 * - If field.editable === false → return false
 * - If field.isProtected === true → return false
 * 
 * ROLE RULES:
 * - admin: Can edit all non-protected fields
 * - manager: Cannot edit system-owned fields
 * - member: Can only edit participation and core (non-system) fields
 * - viewer: Cannot edit any fields
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key to check
 * @param role - The user role
 * @param options - Optional configuration
 * @returns true if the field can be edited by this role, false otherwise
 * 
 * @example
 * ```typescript
 * // Check if member can edit email field
 * const canEdit = canEditField('people', 'email', 'member');
 * // Returns: true
 * 
 * // Check if viewer can edit any field
 * const canEdit = canEditField('people', 'email', 'viewer');
 * // Returns: false
 * ```
 */
export function canEditField(
  moduleKey: ModuleKey,
  fieldKey: string,
  role: UserRole,
  options: EditabilityOptions = {}
): boolean {
  const {
    allowSystemEditsForAdmins = true,
    includeProtected = false,
  } = options;
  
  // Get field metadata
  const metadataMap = getFieldMetadataMap(moduleKey);
  
  if (!metadataMap) {
    // Invalid module key
    return false;
  }
  
  const metadata = metadataMap[fieldKey];
  
  if (!metadata) {
    // Field not found
    return false;
  }
  
  // ========================================================================
  // BASE RULES (always applied)
  // ========================================================================
  
  // If field is explicitly marked as not editable, deny
  if (metadata.editable === false) {
    return false;
  }
  
  // If field is protected, deny (unless explicitly included)
  if (metadata.isProtected === true && !includeProtected) {
    return false;
  }
  
  // ========================================================================
  // ROLE RULES
  // ========================================================================
  
  // Viewer role: Cannot edit any fields
  if (role === 'viewer') {
    return false;
  }
  
  // Admin role: Can edit all non-protected fields
  if (role === 'admin') {
    // System fields are allowed if allowSystemEditsForAdmins is true
    if (metadata.owner === 'system' && !allowSystemEditsForAdmins) {
      return false;
    }
    return true;
  }
  
  // Manager role: Cannot edit system-owned fields
  if (role === 'manager') {
    if (metadata.owner === 'system') {
      return false;
    }
    return true;
  }
  
  // Member role: Can only edit participation and core (non-system) fields
  if (role === 'member') {
    // Cannot edit system-owned fields
    if (metadata.owner === 'system') {
      return false;
    }
    
    // Can edit participation fields (app-specific)
    if (metadata.owner === 'participation') {
      return true;
    }
    
    // Can edit core fields, but not if intent is 'system'
    if (metadata.owner === 'core') {
      return metadata.intent !== 'system';
    }
    
    // Unknown owner type - deny by default
    return false;
  }
  
  // Unknown role - deny by default
  return false;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all editable fields for a given role in a module.
 * 
 * @param moduleKey - The module key
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Array of field keys that can be edited by this role
 * 
 * @example
 * ```typescript
 * const editableFields = getEditableFieldsForRole('people', 'member');
 * // Returns: ['first_name', 'last_name', 'email', 'type', ...]
 * ```
 */
export function getEditableFieldsForRole(
  moduleKey: ModuleKey,
  role: UserRole,
  options: EditabilityOptions = {}
): string[] {
  const allFields = getFieldsForModule(moduleKey);
  
  return allFields.filter(fieldKey => 
    canEditField(moduleKey, fieldKey, role, options)
  );
}

/**
 * Get all non-editable fields for a given role in a module.
 * 
 * @param moduleKey - The module key
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Array of field keys that cannot be edited by this role
 * 
 * @example
 * ```typescript
 * const nonEditableFields = getNonEditableFieldsForRole('people', 'member');
 * // Returns: ['createdBy', 'createdAt', 'organizationId', ...]
 * ```
 */
export function getNonEditableFieldsForRole(
  moduleKey: ModuleKey,
  role: UserRole,
  options: EditabilityOptions = {}
): string[] {
  const allFields = getFieldsForModule(moduleKey);
  
  return allFields.filter(fieldKey => 
    !canEditField(moduleKey, fieldKey, role, options)
  );
}

/**
 * Get editability details for a field.
 * Useful for debugging and understanding why a field is/isn't editable.
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Editability details, or null if field not found
 */
export function getEditabilityDetails(
  moduleKey: ModuleKey,
  fieldKey: string,
  role: UserRole,
  options: EditabilityOptions = {}
): {
  canEdit: boolean;
  reason: string;
  fieldEditable: boolean;
  fieldProtected: boolean;
  fieldOwner: BaseFieldOwner;
  role: UserRole;
} | null {
  const metadataMap = getFieldMetadataMap(moduleKey);
  
  if (!metadataMap || !metadataMap[fieldKey]) {
    return null;
  }
  
  const metadata = metadataMap[fieldKey];
  const canEdit = canEditField(moduleKey, fieldKey, role, options);
  
  // Determine reason
  let reason = '';
  
  if (metadata.editable === false) {
    reason = 'Field is marked as not editable';
  } else if (metadata.isProtected === true && !options.includeProtected) {
    reason = 'Field is protected';
  } else if (role === 'viewer') {
    reason = 'Viewer role cannot edit any fields';
  } else if (role === 'member' && metadata.owner === 'system') {
    reason = 'Member role cannot edit system-owned fields';
  } else if (role === 'manager' && metadata.owner === 'system') {
    reason = 'Manager role cannot edit system-owned fields';
  } else if (role === 'member' && metadata.owner === 'core' && metadata.intent === 'system') {
    reason = 'Member role cannot edit core system fields';
  } else if (canEdit) {
    reason = 'Field is editable for this role';
  } else {
    reason = 'Field is not editable for this role';
  }
  
  return {
    canEdit,
    reason,
    fieldEditable: metadata.editable === true,
    fieldProtected: metadata.isProtected === true,
    fieldOwner: metadata.owner,
    role,
  };
}

/**
 * Check if a role can edit any fields in a module.
 * 
 * @param moduleKey - The module key
 * @param role - The user role
 * @param options - Optional configuration
 * @returns true if the role can edit at least one field
 */
export function canRoleEditAnyFields(
  moduleKey: ModuleKey,
  role: UserRole,
  options: EditabilityOptions = {}
): boolean {
  const editableFields = getEditableFieldsForRole(moduleKey, role, options);
  return editableFields.length > 0;
}

/**
 * Get editability summary for a module and role.
 * 
 * @param moduleKey - The module key
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Summary statistics
 */
export function getEditabilitySummary(
  moduleKey: ModuleKey,
  role: UserRole,
  options: EditabilityOptions = {}
): {
  totalFields: number;
  editableFields: number;
  nonEditableFields: number;
  editablePercentage: number;
} {
  const allFields = getFieldsForModule(moduleKey);
  const editableFields = getEditableFieldsForRole(moduleKey, role, options);
  
  return {
    totalFields: allFields.length,
    editableFields: editableFields.length,
    nonEditableFields: allFields.length - editableFields.length,
    editablePercentage: allFields.length > 0
      ? Math.round((editableFields.length / allFields.length) * 100)
      : 0,
  };
}

// =============================================================================
// CROSS-MODULE FUNCTIONS
// =============================================================================

/**
 * Get editable fields for a role across all registered modules.
 * 
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Map of module key to editable field arrays
 */
export function getEditableFieldsForRoleAcrossModules(
  role: UserRole,
  options: EditabilityOptions = {}
): Record<ModuleKey, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const moduleKey of MODULE_KEYS) {
    result[moduleKey] = getEditableFieldsForRole(moduleKey as ModuleKey, role, options);
  }
  
  return result as Record<ModuleKey, string[]>;
}

/**
 * Check if a role can edit a field across any module.
 * 
 * @param fieldKey - The field key to check
 * @param role - The user role
 * @param options - Optional configuration
 * @returns Array of module keys where this field is editable
 */
export function findModulesWhereFieldIsEditable(
  fieldKey: string,
  role: UserRole,
  options: EditabilityOptions = {}
): ModuleKey[] {
  return MODULE_KEYS.filter((moduleKey: ModuleKey) => 
    canEditField(moduleKey as ModuleKey, fieldKey, role, options)
  ) as ModuleKey[];
}
