/**
 * ============================================================================
 * PEOPLE PERMISSION HELPER
 * ============================================================================
 *
 * Central helper for checking People-related permissions.
 * All CTA gating must go through this helper.
 *
 * ============================================================================
 */

import type { PeoplePermission } from './peoplePermissions';

type PeoplePermissionNode = boolean | Record<string, boolean>;
type PeoplePermissionMap = Record<string, Record<string, PeoplePermissionNode>>;

/**
 * Check if user has a specific People permission
 * 
 * @param permissionKey - Canonical permission key from PEOPLE_PERMISSIONS
 * @param authStore - Auth store instance with user and hasPermission getter
 * @returns true if user has permission, false otherwise
 */
export function hasPeoplePermission(
  permissionKey: PeoplePermission,
  authStore: { 
    user: { isOwner?: boolean; role?: string; permissions?: PeoplePermissionMap } | null;
    hasPermission: (module: string, action: string) => boolean;
  }
): boolean {
  // Owners and admins have all permissions
  if (authStore.user?.isOwner || authStore.user?.role?.toLowerCase() === 'admin') {
    return true;
  }
  
  // Parse permission key (format: 'people.module.action' or 'people.module.action.app')
  const parts = permissionKey.split('.');
  
  if (parts.length < 2) {
    console.warn(`[hasPeoplePermission] Invalid permission key format: ${permissionKey}`);
    return false;
  }
  
  // Extract module and action
  // Format: 'people.attach.sales' -> module: 'people', action: 'attach.sales'
  // Format: 'people.view' -> module: 'people', action: 'view'
  const module = parts[0]; // Should be 'people'
  if (!module) {
    console.warn(`[hasPeoplePermission] Invalid permission key format: ${permissionKey}`);
    return false;
  }
  const action = parts.slice(1).join('.'); // Everything after 'people.'
  
  // Check permission using auth store's hasPermission method
  // The auth store normalizes 'people' to 'contacts' for legacy compatibility
  const normalizedModule = module === 'people' ? 'contacts' : module;
  
  // For app-specific permissions like 'people.attach.sales', check if the nested path exists
  // Try checking the full path first (for new permission structure)
  if (authStore.user?.permissions) {
    const permissions = authStore.user.permissions;
    
    // Check if permissions.contacts exists
    const contactsPerms = permissions[normalizedModule] || permissions['people'];
    if (contactsPerms) {
      // For app-specific permissions like 'attach.sales', check nested structure
      if (action.includes('.')) {
        // Split action into parts: 'attach.sales' -> ['attach', 'sales']
        const actionParts = action.split('.');
        const baseAction = actionParts[0]; // 'attach'
        const appKey = actionParts[1]; // 'sales'
        
        // Check if permissions.contacts.attach exists and has the app key
        if (!baseAction) return false;

        const baseValue = contactsPerms[baseAction];
        if (!baseValue) return false;

        // If it's an object, check for the app key
        if (typeof baseValue === 'object') {
          if (!appKey) return false;
          return baseValue[appKey] === true;
        }

        // If it's a boolean, return it (for base permissions like 'people.attach')
        if (typeof baseValue === 'boolean') {
          return baseValue === true;
        }
      } else {
        // Simple action like 'view' or 'edit'
        return contactsPerms[action] === true;
      }
    }
  }
  
  // Fallback: use authStore.hasPermission (for legacy permission structure)
  return authStore.hasPermission(normalizedModule, action);
}

/**
 * Convenience wrapper that uses the auth store from the current context
 * This can be used in components that have access to useAuthStore()
 */
export function createPeoplePermissionChecker(authStore: { 
  user: { isOwner?: boolean; role?: string; permissions?: PeoplePermissionMap } | null;
  hasPermission: (module: string, action: string) => boolean;
}) {
  return (permissionKey: PeoplePermission): boolean => {
    return hasPeoplePermission(permissionKey, authStore);
  };
}

