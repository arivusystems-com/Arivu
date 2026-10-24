/**
 * ============================================================================
 * FORM SETTINGS PERMISSION DERIVATION (EXPLANATORY ONLY)
 * ============================================================================
 * 
 * This file derives explanatory permissions for Form Settings.
 * It does NOT enforce access.
 * It does NOT check roles.
 * It does NOT mutate state.
 * It exists only to explain configuration authority.
 * 
 * PURPOSE:
 * - Explain who can configure what in Form Settings
 * - Provide read-only permission matrix for UI display
 * - Mirror Event and Platform permission patterns
 * 
 * ARCHITECTURAL RATIONALE:
 * - Form Builder owns structure & content (sections, questions, scoring)
 * - Form Execution owns execution & submission (workflows, state mutations)
 * - Form Settings owns configuration only (behavior, lifecycle, access, outcomes)
 * 
 * Actual enforcement happens at:
 * - API level (server-side permission checks)
 * - Surface level (Form Builder, Event Execution surfaces)
 * 
 * This file is explanatory-only and mirrors Event Execution permission design.
 * 
 * See: docs/architecture/form-settings-doctrine.md
 * See: client/src/platform/events/eventPermissions.utils.ts (mirror pattern)
 * ============================================================================
 */

import type { PermissionScope } from '@/platform/permissions/platformPermissionVocabulary.types';

/**
 * Form Settings Configuration Actions
 * 
 * These actions represent what can be configured in Form Settings.
 * They use Platform Permission vocabulary for consistency.
 */
export type FormSettingsAction =
  | 'CONFIGURE_METADATA'
  | 'CONFIGURE_LIFECYCLE'
  | 'CONFIGURE_ACCESS'
  | 'CONFIGURE_BEHAVIOR_RULES'
  | 'CONFIGURE_OUTCOMES'
  | 'EDIT_FORM_STRUCTURE'
  | 'EDIT_SCORING'
  | 'EDIT_EXECUTION';

/**
 * Form Settings Permission Descriptor
 * 
 * This interface describes a configuration permission for Form Settings.
 * It explains what can be configured and why, without enforcing access.
 */
export interface FormSettingsPermission {
  /** The configuration action */
  action: FormSettingsAction;
  
  /** The scope at which this permission applies (always MODULE for Form Settings) */
  scope: PermissionScope;
  
  /** The resource type (always 'form' for Form Settings) */
  resource: string;
  
  /** Whether this action is allowed in Form Settings */
  allowed: boolean;
  
  /** Human-readable explanation of why this is allowed or not allowed */
  reason?: string;
}

/**
 * Derive Form Settings permissions
 * 
 * This function explains which configuration actions are allowed in Form Settings and why.
 * It does NOT enforce permissions or block actions.
 * 
 * Rules:
 * - Metadata, lifecycle, access, behavior rules, outcomes → allowed = true
 * - Structure, scoring, execution → allowed = false
 * - All disallowed permissions MUST include a human-readable reason
 * 
 * This is a pure, deterministic function with no side effects.
 * 
 * @param context - Optional context (not used for Form Settings, but kept for API consistency)
 * @returns Array of FormSettingsPermission objects
 */
export function deriveFormSettingsPermissions(_context?: unknown): FormSettingsPermission[] {
  const permissions: FormSettingsPermission[] = [];
  
  // ============================================================================
  // ALLOWED CONFIGURATION ACTIONS
  // ============================================================================
  // These actions are allowed in Form Settings because they configure
  // form behavior, lifecycle, and access - not form structure or content.
  
  permissions.push({
    action: 'CONFIGURE_METADATA',
    scope: 'MODULE',
    resource: 'form',
    allowed: true,
    reason: undefined // No reason needed for allowed actions
  });
  
  permissions.push({
    action: 'CONFIGURE_LIFECYCLE',
    scope: 'MODULE',
    resource: 'form',
    allowed: true,
    reason: undefined
  });
  
  permissions.push({
    action: 'CONFIGURE_ACCESS',
    scope: 'MODULE',
    resource: 'form',
    allowed: true,
    reason: undefined
  });
  
  permissions.push({
    action: 'CONFIGURE_BEHAVIOR_RULES',
    scope: 'MODULE',
    resource: 'form',
    allowed: true,
    reason: undefined
  });
  
  permissions.push({
    action: 'CONFIGURE_OUTCOMES',
    scope: 'MODULE',
    resource: 'form',
    allowed: true,
    reason: undefined
  });
  
  // ============================================================================
  // EXPLICITLY DISALLOWED CONFIGURATION ACTIONS
  // ============================================================================
  // These actions are NOT allowed in Form Settings because they belong to
  // other domains (Form Builder, Execution, etc.).
  
  permissions.push({
    action: 'EDIT_FORM_STRUCTURE',
    scope: 'MODULE',
    resource: 'form',
    allowed: false,
    reason: 'Managed by Form Builder. Form structure (sections, questions) is edited in the Form Builder interface.'
  });
  
  permissions.push({
    action: 'EDIT_SCORING',
    scope: 'MODULE',
    resource: 'form',
    allowed: false,
    reason: 'Scoring is defined at form design time. Scoring weights and formulas are configured in the Form Builder.'
  });
  
  permissions.push({
    action: 'EDIT_EXECUTION',
    scope: 'MODULE',
    resource: 'form',
    allowed: false,
    reason: 'Execution is controlled by Events. Form execution and submission workflows are managed in Event Execution surfaces.'
  });
  
  // ============================================================================
  // DEV-ONLY ASSERTIONS
  // ============================================================================
  
  if (process.env.NODE_ENV === 'development') {
    // Assert: All permissions include action, scope, resource
    permissions.forEach((permission, index) => {
      console.assert(
        permission.action !== undefined && permission.action !== null,
        `[formSettingsPermissions] Permission at index ${index} must define an action`,
        { permission }
      );
      console.assert(
        permission.scope !== undefined && permission.scope !== null,
        `[formSettingsPermissions] Permission at index ${index} must define a scope`,
        { permission }
      );
      console.assert(
        typeof permission.resource === 'string' && permission.resource.length > 0,
        `[formSettingsPermissions] Permission at index ${index} must define a non-empty resource string`,
        { permission }
      );
    });
    
    // Assert: All disallowed permissions include a reason
    const disallowedPermissions = permissions.filter(p => !p.allowed);
    disallowedPermissions.forEach((permission) => {
      console.assert(
        typeof permission.reason === 'string' && permission.reason.length > 0,
        `[formSettingsPermissions] Disallowed permission must include a reason: ${permission.action}`,
        { permission }
      );
    });
    
    // Assert: No permission enables structure/scoring/execution edits
    const structureEditPermission = permissions.find(p => p.action === 'EDIT_FORM_STRUCTURE');
    const scoringEditPermission = permissions.find(p => p.action === 'EDIT_SCORING');
    const executionEditPermission = permissions.find(p => p.action === 'EDIT_EXECUTION');
    
    console.assert(
      !structureEditPermission?.allowed,
      '[formSettingsPermissions] EDIT_FORM_STRUCTURE must never be allowed. Form structure belongs to Form Builder.',
      { permission: structureEditPermission }
    );
    
    console.assert(
      !scoringEditPermission?.allowed,
      '[formSettingsPermissions] EDIT_SCORING must never be allowed. Scoring belongs to Form Builder.',
      { permission: scoringEditPermission }
    );
    
    console.assert(
      !executionEditPermission?.allowed,
      '[formSettingsPermissions] EDIT_EXECUTION must never be allowed. Execution belongs to Event Execution surfaces.',
      { permission: executionEditPermission }
    );
  }
  
  return permissions;
}

/**
 * Get action label for display
 * 
 * Converts action constants to human-readable labels for UI display.
 */
export function getFormSettingsActionLabel(action: FormSettingsAction): string {
  const labels: Record<FormSettingsAction, string> = {
    CONFIGURE_METADATA: 'Configure Metadata',
    CONFIGURE_LIFECYCLE: 'Configure Lifecycle',
    CONFIGURE_ACCESS: 'Configure Access',
    CONFIGURE_BEHAVIOR_RULES: 'Configure Behavior Rules',
    CONFIGURE_OUTCOMES: 'Configure Outcomes',
    EDIT_FORM_STRUCTURE: 'Edit Form Structure',
    EDIT_SCORING: 'Edit Scoring',
    EDIT_EXECUTION: 'Edit Execution',
  };
  
  return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
