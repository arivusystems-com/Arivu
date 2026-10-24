// CONTRACT-LOCKED:
// See docs/architecture/platform-permission-contract.md
// This file MUST remain explanatory-only.

/*
============================================================================
PLATFORM PERMISSIONS — CANONICAL EXPLANATION VOCABULARY
============================================================================
This file defines the canonical permission vocabulary for the platform.

This model:
- Is UI-facing and explanatory only
- Defines WHAT actions exist, not whether they are allowed
- Does NOT enforce permissions
- Does NOT check roles
- Does NOT perform API calls
- Does NOT mutate state

It answers: "What actions exist in the platform, and what do they mean?"

Enforcement happens elsewhere.
Role evaluation happens elsewhere.

This file is safe to import anywhere.
============================================================================
*/

/**
 * Permission primitives - the fundamental actions available in the platform.
 * 
 * NOTE: This is a shared vocabulary, not an exhaustive rule list.
 */
export type PermissionAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'COMPLETE'
  | 'CANCEL'
  | 'ASSIGN'
  | 'LINK'
  | 'UNLINK'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REOPEN'

/**
 * The scope at which a permission applies.
 */
export type PermissionScope =
  | 'RECORD'
  | 'MODULE'
  | 'APP'
  | 'PLATFORM'

/**
 * Canonical permission descriptor.
 * 
 * This interface describes what a permission means, not whether it is granted.
 */
export interface PlatformPermission {
  action: PermissionAction
  scope: PermissionScope
  resource: string      // e.g. 'event', 'people', 'organization'
  description: string   // human-readable explanation of the permission
}

/**
 * DEV-only runtime assertions to validate permission integrity.
 * 
 * Validates that every permission defines:
 * - action
 * - scope
 * - resource
 * - description (must be a non-empty string)
 */
if (process.env.NODE_ENV === 'development') {
  /**
   * Validates a PlatformPermission object for integrity.
   */
  const validatePermission = (permission: PlatformPermission): void => {
    console.assert(
      permission.action !== undefined && permission.action !== null,
      'PlatformPermission must define an action'
    )
    console.assert(
      permission.scope !== undefined && permission.scope !== null,
      'PlatformPermission must define a scope'
    )
    console.assert(
      typeof permission.resource === 'string' && permission.resource.length > 0,
      'PlatformPermission must define a non-empty resource string'
    )
    console.assert(
      typeof permission.description === 'string' && permission.description.length > 0,
      'PlatformPermission must define a non-empty description string'
    )
  }

  // Export validation function for use in development
  // This allows other code to validate permissions if needed
  if (typeof window !== 'undefined') {
    (window as Window & { __validatePlatformPermission?: typeof validatePermission }).__validatePlatformPermission =
      validatePermission
  }
}
