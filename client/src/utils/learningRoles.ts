/**
 * Learning (LMS) role resolution — ADMIN | AUTHOR | LEARNER
 * Source: User.appAccess entry for LMS (appRegistry defaultRole = LEARNER).
 */

export type LearningRoleKey = 'ADMIN' | 'AUTHOR' | 'LEARNER';

export type LearningAudience = 'learner' | 'author' | 'admin';

const AUTHOR_ROLES = new Set<LearningRoleKey>(['ADMIN', 'AUTHOR']);

export function normalizeLearningRoleKey(raw: unknown): LearningRoleKey | null {
  const key = String(raw || '').trim().toUpperCase();
  if (key === 'ADMIN' || key === 'AUTHOR' || key === 'LEARNER') return key;
  return null;
}

/**
 * Resolve LMS role from user session shape (auth store / API user).
 * Owners without an explicit LMS roleKey are treated as ADMIN.
 */
export function resolveLearningRole(user: {
  isOwner?: boolean;
  role?: string;
  appAccess?: Array<{ appKey?: string; roleKey?: string; status?: string } | null>;
  allowedApps?: unknown[];
} | null | undefined): LearningRoleKey | null {
  if (!user) return null;

  const access = Array.isArray(user.appAccess) ? user.appAccess : [];
  const lms = access.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (String(entry.appKey || '').toUpperCase() !== 'LMS') return false;
    return String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  });

  if (lms) {
    return normalizeLearningRoleKey(lms.roleKey) || 'LEARNER';
  }

  const isOwnerLike =
    user.isOwner === true || String(user.role || '').toLowerCase() === 'owner';
  if (isOwnerLike) return 'ADMIN';

  const allowed = Array.isArray(user.allowedApps)
    ? user.allowedApps.map((a) => String(a || '').toUpperCase())
    : [];
  if (allowed.includes('LMS')) return 'LEARNER';

  return null;
}

export function canAuthorLearning(role: LearningRoleKey | null | undefined): boolean {
  return Boolean(role && AUTHOR_ROLES.has(role));
}

export function canAdminLearning(role: LearningRoleKey | null | undefined): boolean {
  return role === 'ADMIN';
}

/** Sidebar / route audience for a Learning module. */
export function learningAudienceForModule(moduleKey: string): LearningAudience {
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'learning_analytics' || key === 'learning_settings') return 'admin';
  if (
    key === 'learning_courses'
    || key === 'learning_content'
    || key === 'learning_compliance'
    || key === 'learning_programs'
  ) {
    return 'author';
  }
  return 'learner';
}

export function learningRoleCanSeeAudience(
  role: LearningRoleKey | null | undefined,
  audience: LearningAudience
): boolean {
  if (!role) return false;
  if (audience === 'learner') return true;
  if (audience === 'author') return canAuthorLearning(role);
  return canAdminLearning(role);
}

/** Author-only Learning paths (learners redirected to home). */
export function isLearningAuthorRoute(pathOnly: string): boolean {
  const p = String(pathOnly || '').split(/[?#]/)[0] || '';
  if (p === '/learning/courses' || p.startsWith('/learning/courses/')) {
    // Course player is shared; only the list/create surface is author-primary.
    // Detail stays open for learners to Learn.
    return p === '/learning/courses';
  }
  if (p === '/learning/content' || p.startsWith('/learning/content/')) return true;
  if (p === '/learning/compliance' || p.startsWith('/learning/compliance/')) return true;
  if (p === '/learning/programs' || p.startsWith('/learning/programs/')) return true;
  return false;
}

export function isLearningAdminRoute(pathOnly: string): boolean {
  const p = String(pathOnly || '').split(/[?#]/)[0] || '';
  return (
    p === '/learning/analytics'
    || p.startsWith('/learning/analytics/')
    || p === '/learning/settings'
    || p.startsWith('/learning/settings/')
  );
}
