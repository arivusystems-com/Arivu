export function normalizeLearningPath(path) {
  return String(path || '').split('?')[0].split('#')[0];
}

/** Learning app home (dashboard) path. */
export const LEARNING_MAIN_TAB_PATH = '/learning';

/** Module list roots that each get their own TabBar tab. */
const LEARNING_MODULE_ROOTS = [
  '/learning',
  '/learning/my',
  '/learning/explore',
  '/learning/courses',
  '/learning/paths',
  '/learning/programs',
  '/learning/live',
  '/learning/assessments',
  '/learning/certificates',
  '/learning/skills',
  '/learning/content',
  '/learning/compliance',
  '/learning/analytics',
  '/learning/settings',
];

export function isLearningRoute(pathOnly) {
  const p = normalizeLearningPath(pathOnly);
  return p === LEARNING_MAIN_TAB_PATH || p.startsWith(`${LEARNING_MAIN_TAB_PATH}/`);
}

/**
 * True when `tab` is the tab for this exact learning route (or its query/hash variant).
 * Detail pages (`/learning/courses/:id`) are separate from list roots.
 */
export function learningTabOwnsRoute(routePath, tab) {
  const route = normalizeLearningPath(routePath);
  if (!isLearningRoute(route)) return false;
  if (!tab) return false;
  return normalizeLearningPath(tab.path) === route;
}

/** Icon id for a learning path (list root or nested detail). */
export function getLearningIconForPath(pathOnly) {
  const p = normalizeLearningPath(pathOnly);
  if (p === '/learning' || p === '/learning/') return 'academic-cap';
  if (p.startsWith('/learning/my')) return 'bookmark';
  if (p.startsWith('/learning/explore')) return 'magnifying-glass';
  if (p.startsWith('/learning/courses')) return 'book-open';
  if (p.startsWith('/learning/paths')) return 'map';
  if (p.startsWith('/learning/programs')) return 'rectangle-stack';
  if (p.startsWith('/learning/live')) return 'video-camera';
  if (p.startsWith('/learning/assessments')) return 'clipboard-document-check';
  if (p.startsWith('/learning/certificates')) return 'trophy';
  if (p.startsWith('/learning/skills')) return 'sparkles';
  if (p.startsWith('/learning/content')) return 'folder';
  if (p.startsWith('/learning/compliance')) return 'shield-check';
  if (p.startsWith('/learning/analytics')) return 'chart-bar';
  if (p.startsWith('/learning/settings')) return 'cog-6-tooth';
  return 'academic-cap';
}

export function isLearningModuleRootPath(pathOnly) {
  const p = normalizeLearningPath(pathOnly).replace(/\/+$/, '') || '/learning';
  return LEARNING_MODULE_ROOTS.includes(p);
}
