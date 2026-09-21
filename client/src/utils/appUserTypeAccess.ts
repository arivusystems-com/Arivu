/**
 * Mirrors server/constants/appRegistry.js userTypesAllowed and
 * platformUserTypes.userTypeAllowedForApp (INTERNAL ↔ STANDARD/ADMIN).
 */
const APP_USER_TYPES_ALLOWED: Record<string, readonly string[]> = {
  SALES: ['STANDARD', 'ADMIN'],
  HELPDESK: ['STANDARD', 'ADMIN'],
  PROJECTS: ['STANDARD', 'ADMIN'],
  AUDIT: ['STANDARD', 'ADMIN', 'EXTERNAL'],
  PORTAL: ['EXTERNAL'],
  INVENTORY: ['STANDARD', 'ADMIN'],
  MARKETING: ['STANDARD', 'ADMIN'],
  LMS: ['STANDARD', 'ADMIN', 'EXTERNAL'],
};

function normalizeAppKey(appKey: string): string {
  return String(appKey || '').trim().toUpperCase();
}

function normalizeUserType(userType: string | undefined): string {
  const t = String(userType || 'STANDARD').trim().toUpperCase();
  if (t === 'SYSTEM') return 'ADMIN';
  if (t === 'PORTAL') return 'EXTERNAL';
  if (t === 'INTERNAL') return 'STANDARD';
  return t;
}

function expandUserTypesAllowed(allowed: readonly string[]): Set<string> {
  const set = new Set(
    (Array.isArray(allowed) ? allowed : []).map((v) => String(v || '').toUpperCase())
  );
  if (set.has('INTERNAL')) {
    set.add('STANDARD');
    set.add('ADMIN');
  }
  if (set.has('STANDARD') || set.has('ADMIN')) {
    set.add('INTERNAL');
  }
  return set;
}

export function validateUserTypeForApp(userType: string | undefined, appKey: string): boolean {
  const normalizedAppKey = normalizeAppKey(appKey);
  const allowed = APP_USER_TYPES_ALLOWED[normalizedAppKey];
  if (!allowed) return false;
  const expanded = expandUserTypesAllowed(allowed);
  const normalized = normalizeUserType(userType);
  return expanded.has(normalized) || expanded.has(String(userType || '').trim().toUpperCase());
}
