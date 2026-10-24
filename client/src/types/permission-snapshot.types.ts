/**
 * ============================================================================
 * PLATFORM PERMISSION SNAPSHOT: Stable Permission State
 * ============================================================================
 * 
 * Provides a stable, immutable snapshot of user permissions for builders.
 * 
 * Rules:
 * - Snapshot created once per session/request
 * - All builders consume snapshots, not raw user objects
 * - Improves determinism and debuggability
 * - Prevents permission drift during builder execution
 * 
 * ============================================================================
 */

/**
 * Permission Snapshot
 * 
 * Immutable snapshot of user permissions at a point in time.
 * Used by all builders to ensure deterministic output.
 */
export interface PermissionSnapshot {
  /** User ID */
  userId: string;
  
  /** User roles (sorted array) */
  roles: string[];
  
  /** Permission map (permission key → boolean) */
  permissions: Record<string, boolean>;
  
  /** Timestamp when snapshot was generated */
  generatedAt: number;
}

/**
 * Create a permission snapshot from a user object
 * 
 * @param user - User object with permissions
 * @returns Permission snapshot
 */
export function createPermissionSnapshot(user: {
  _id?: string;
  id?: string;
  role?: string;
  roleId?: string;
  roles?: string[];
  permissions?: Record<string, boolean | Record<string, boolean | Record<string, boolean>>>;
  isOwner?: boolean;
}): PermissionSnapshot {
  const userId = user._id || user.id || 'unknown';
  
  // Extract roles
  const roles: string[] = [];
  if (user.roles && Array.isArray(user.roles)) {
    roles.push(...user.roles);
  } else if (user.role) {
    roles.push(user.role);
  }
  
  // Normalize permissions to flat map
  const permissions: Record<string, boolean> = {};
  
  // Handle nested permissions structure (e.g., { contacts: { view: true } })
  if (user.permissions && typeof user.permissions === 'object') {
    for (const [module, modulePerms] of Object.entries(user.permissions)) {
      if (typeof modulePerms === 'object' && modulePerms !== null) {
        // Nested structure: { contacts: { view: true, create: false } }
        for (const [action, value] of Object.entries(modulePerms)) {
          if (typeof value === 'boolean') {
            permissions[`${module}.${action}`] = value;
          }
        }
      } else if (typeof modulePerms === 'boolean') {
        // Flat structure: { 'contacts.view': true }
        permissions[module] = modulePerms;
      }
    }
  }
  
  // If user is owner or admin, grant all permissions in builders
  const roleLower = String(user.role || '').toLowerCase();
  if (user.isOwner || roleLower === 'owner' || roleLower === 'admin') {
    permissions['*'] = true;
  }
  
  return {
    userId,
    roles: [...new Set(roles)].sort(), // Deduplicate and sort
    permissions,
    generatedAt: Date.now(),
  };
}

/**
 * Check if a permission snapshot has a specific permission
 * 
 * @param snapshot - Permission snapshot
 * @param permission - Permission key (e.g., 'contacts.view')
 * @returns True if user has permission
 */
export function hasPermission(
  snapshot: PermissionSnapshot,
  permission: string | undefined
): boolean {
  if (!permission) {
    return true; // No permission required
  }
  
  // Check wildcard permission
  if (snapshot.permissions['*'] === true) {
    return true;
  }
  
  // Check specific permission
  if (snapshot.permissions[permission] === true) {
    return true;
  }

  const [moduleKey, action] = permission.split('.');
  if (moduleKey && action) {
    if (moduleKey === 'people') {
      if (snapshot.permissions[`contacts.${action}`] === true) return true;
    } else if (moduleKey === 'contacts') {
      if (snapshot.permissions[`people.${action}`] === true) return true;
    }
  }

  // RBAC v2 uses read; legacy nav metadata uses view
  if (permission.endsWith('.read')) {
    const viewKey = permission.replace(/\.read$/, '.view');
    if (snapshot.permissions[viewKey] === true) {
      return true;
    }
  } else if (permission.endsWith('.view')) {
    const readKey = permission.replace(/\.view$/, '.read');
    if (snapshot.permissions[readKey] === true) {
      return true;
    }
  }

  // Responses inherits Forms access until roles explicitly grant responses.*
  if (permission === 'responses.view' || permission === 'responses.read') {
    return (
      snapshot.permissions['forms.view'] === true ||
      snapshot.permissions['forms.read'] === true
    );
  }

  return false;
}

/**
 * Convert permission snapshot to UserPermissions format (for backward compatibility)
 * 
 * @param snapshot - Permission snapshot
 * @returns UserPermissions map
 */
export function snapshotToUserPermissions(snapshot: PermissionSnapshot): Record<string, boolean> {
  return { ...snapshot.permissions };
}

/**
 * Create permission snapshot from UserPermissions (for backward compatibility)
 * 
 * @param userId - User ID
 * @param userPermissions - User permissions map (legacy format)
 * @param roles - Optional roles array
 * @returns Permission snapshot
 */
export function createSnapshotFromPermissions(
  userId: string,
  userPermissions: Record<string, boolean>,
  roles: string[] = []
): PermissionSnapshot {
  return {
    userId,
    roles: [...new Set(roles)].sort(),
    permissions: { ...userPermissions },
    generatedAt: Date.now(),
  };
}

