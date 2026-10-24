/**
 * Which Settings sidebar / landing cards a user may see.
 * STANDARD: profile + personal notifications only.
 * ADMIN / Owner: full access subject to settings.* flags (Owner/Admin role bypass).
 */

type SettingsAccessCtx = {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: unknown;
  entitledAddons?: { ai?: boolean } | null;
  inventoryEnabled?: boolean;
  userType?: string | null;
};

const STANDARD_ALLOWED_TABS = new Set(['profile', 'notifications']);

function normalizeUserType(raw: string | null | undefined, hints: { isOwner?: boolean; role?: string | null }): string {
  if (hints.isOwner) return 'ADMIN';
  const t = String(raw || '').trim().toUpperCase();
  if (t === 'EXTERNAL' || t === 'PORTAL') return 'EXTERNAL';
  if (t === 'ADMIN' || t === 'SYSTEM') return 'ADMIN';
  if (t === 'STANDARD') {
    const role = String(hints.role || '').toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'administrator') return 'ADMIN';
    return 'STANDARD';
  }
  if (t === 'INTERNAL' || !t) {
    const role = String(hints.role || '').toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'administrator') return 'ADMIN';
    return 'STANDARD';
  }
  return 'STANDARD';
}

function isPrivilegedSettingsRole(role: string | null | undefined): boolean {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'owner' || normalized === 'administrator';
}

function readPermission(permissions: unknown, path: readonly string[]): unknown {
  let current = permissions;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function hasWorkspaceSettingsAdminAccess(permissions: unknown): boolean {
  return Boolean(
    readPermission(permissions, ['settings', 'edit'])
    || readPermission(permissions, ['settings', 'customizeFields'])
    || readPermission(permissions, ['settings', 'manageUsers'])
    || readPermission(permissions, ['settings', 'manageIntegrations'])
  );
}

function isAdminLikeCtx(ctx: SettingsAccessCtx): boolean {
  return normalizeUserType(ctx.userType, { isOwner: ctx.isOwner, role: ctx.role }) === 'ADMIN';
}

/** Webforms admin: settings workspace admins + explicit webforms.* grants. */
export function canManageWebforms(
  ctx: SettingsAccessCtx,
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean {
  if (!isAdminLikeCtx(ctx)) return false;
  if (ctx.isOwner || isPrivilegedSettingsRole(ctx.role)) return true;
  if (hasWorkspaceSettingsAdminAccess(ctx.permissions)) return true;

  if (action === 'view') return Boolean(readPermission(ctx.permissions, ['webforms', 'view']));
  if (action === 'create') return Boolean(readPermission(ctx.permissions, ['webforms', 'create']));
  if (action === 'edit') return Boolean(readPermission(ctx.permissions, ['webforms', 'edit']));
  if (action === 'delete') return Boolean(readPermission(ctx.permissions, ['webforms', 'delete']));
  return false;
}

/**
 * Which Settings sidebar / landing cards a user may see, based on role permissions.
 * STANDARD users: profile + notifications only (type wins over settings.*).
 */
export function canAccessSettingsTab(
  tabId: string,
  ctx: SettingsAccessCtx
): boolean {
  const userType = normalizeUserType(ctx.userType, { isOwner: ctx.isOwner, role: ctx.role });

  if (userType === 'EXTERNAL') {
    return tabId === 'profile' || tabId === 'notifications';
  }

  if (userType === 'STANDARD') {
    return STANDARD_ALLOWED_TABS.has(tabId);
  }

  // Personal profile is always accessible to authenticated users; do not require
  // owner/admin or any settings.* flag to manage your own identity.
  if (tabId === 'profile') return true;

  // Personal notification preferences (Mentions email, etc.) — all users; admin-only
  // sub-pages (health) stay gated inside NotificationSettings via adminOnly.
  if (tabId === 'notifications') return true;

  // AI settings only when Arivu AI addon is entitled (not disabled/uninstalled).
  if (tabId === 'ai' && ctx.entitledAddons != null && ctx.entitledAddons.ai !== true) {
    return false;
  }
  // Inventory Settings only when Inventory capability is enabled for the org.
  if (tabId === 'inventory' && ctx.inventoryEnabled !== true) return false;

  if (ctx.isOwner) return true;
  if (isPrivilegedSettingsRole(ctx.role)) return true;

  const settingsFlag = (key: string) => readPermission(ctx.permissions, ['settings', key]);

  switch (tabId) {
    case 'organization':
      return Boolean(settingsFlag('edit') || settingsFlag('view'));
    case 'currency':
      return Boolean(settingsFlag('edit') || settingsFlag('view'));
    case 'users-access':
      return Boolean(settingsFlag('manageUsers'));
    case 'core-modules':
      return Boolean(settingsFlag('customizeFields') || settingsFlag('edit'));
    case 'applications':
      return Boolean(settingsFlag('edit'));
    case 'addons':
      return Boolean(settingsFlag('edit') || settingsFlag('manageBilling'));
    case 'catalog':
      return Boolean(settingsFlag('edit'));
    case 'inventory':
      return Boolean(settingsFlag('edit'));
    case 'subscriptions':
      return Boolean(settingsFlag('manageBilling'));
    case 'security':
      return Boolean(settingsFlag('edit'));
    case 'integrations':
      return Boolean(settingsFlag('manageIntegrations') || settingsFlag('edit'));
    case 'ai':
      return Boolean(settingsFlag('manageIntegrations') || settingsFlag('edit'));
    case 'automation':
      return Boolean(settingsFlag('edit'));
    case 'webforms':
      return canManageWebforms(ctx, 'view');
    case 'performance':
      return Boolean(
        settingsFlag('edit') ||
        readPermission(ctx.permissions, ['performance', 'targets', 'view']) ||
        readPermission(ctx.permissions, ['performance', 'targets', 'create'])
      );
    case 'business-hours':
      return true;
    case 'audit-log':
      return false;
    default:
      return false;
  }
}

const SETTINGS_TAB_IDS = [
  'profile',
  'organization',
  'currency',
  'users-access',
  'core-modules',
  'applications',
  'addons',
  'catalog',
  'inventory',
  'automation',
  'webforms',
  'performance',
  'subscriptions',
  'notifications',
  'security',
  'integrations',
  'ai',
  'business-hours',
  'audit-log',
] as const;

/** True if the user should see the Settings entry or any settings section (not only Overview). */
export function hasAnySettingsAccess(ctx: SettingsAccessCtx): boolean {
  return SETTINGS_TAB_IDS.some((id) => canAccessSettingsTab(id, ctx));
}
