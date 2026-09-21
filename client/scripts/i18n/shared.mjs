import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLIENT_ROOT = path.resolve(__dirname, '../..');
export const LOCALES_DIR = path.join(CLIENT_ROOT, 'src/locales');
export const SRC_DIR = path.join(CLIENT_ROOT, 'src');

export const SHARED_NAMESPACES = [
  'actions',
  'states',
  'validation',
  'errors',
  'navigation',
  'common',
  'notifications',
  'auth',
  'settings',
  'performance',
  'records',
  'forms',
  'webforms',
  'process',
  'appointments',
  'tasks',
  'events',
  'deals',
  'quotes',
  'cases',
  'liveChat',
  'telephony',
  'people',
  'organizations',
  'inbox',
  'dashboard',
  'import',
  'documents',
  'contentStudio',
  'templates',
  'marketing',
  'learning',
  'analytics',
  'audit',
  'platform',
  'onboarding',
  'releaseNotes',
  'announcements',
  'astra',
  'astraStudio',
  'internalChat',
  'duplicates',
];

export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'ru',
  'ar',
  'hi',
  'ja',
  'zh',
  'ko',
];

export const FORBIDDEN_LEAF_SEGMENTS = new Set([
  'title',
  'label',
  'message',
  'text',
  'name',
  'description',
  'error',
  'hint',
  'placeholder',
]);

export const MAX_KEY_DEPTH = 3;

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function listLocaleFiles(language) {
  const dir = path.join(LOCALES_DIR, language);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f));
}

export function flattenCatalogFile(entries, namespace) {
  const messages = {};
  const keys = [];

  for (const [key, value] of Object.entries(entries)) {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    keys.push(fullKey);
    const message = typeof value === 'string' ? value : value?.message;
    if (message) messages[fullKey] = message;
  }
  return { messages, keys };
}

export function loadAllKeysForLanguage(language) {
  const allMessages = {};
  const allKeys = [];

  for (const ns of SHARED_NAMESPACES) {
    const filePath = path.join(LOCALES_DIR, language, `${ns}.json`);
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    const { messages, keys } = flattenCatalogFile(data, ns);
    Object.assign(allMessages, messages);
    allKeys.push(...keys);
  }

  return { messages: allMessages, keys: allKeys };
}

export function validateIcuSyntaxSync(message) {
  const placeholders = (message.match(/\{[^{}]+\}/g) || []).length;
  const open = (message.match(/\{/g) || []).length;
  const close = (message.match(/\}/g) || []).length;
  if (open !== close) {
    return [`Unbalanced ICU braces in: ${message}`];
  }
  if (message.includes('{') && placeholders === 0 && open > 0) {
    return [`Invalid ICU fragment in: ${message}`];
  }
  return [];
}

export function validateKeyNaming(fullKey) {
  const issues = [];
  const segments = fullKey.split('.');
  const leaf = segments[segments.length - 1];

  if (FORBIDDEN_LEAF_SEGMENTS.has(leaf)) {
    issues.push(`Forbidden generic leaf "${leaf}" in key "${fullKey}"`);
  }
  if (segments.length > MAX_KEY_DEPTH) {
    issues.push(`Key "${fullKey}" exceeds max depth ${MAX_KEY_DEPTH}`);
  }
  const segment = '[a-z][a-zA-Z0-9]*';
  const snakeLeaf = '[a-z][a-z0-9]*(?:_[a-z0-9]+)*';
  let pattern;
  if (fullKey.startsWith('errors.')) {
    pattern = new RegExp(`^errors(\\.${snakeLeaf}){1,2}$`);
  } else if (fullKey.startsWith('validation.')) {
    pattern = new RegExp(`^validation(\\.${segment}){1,2}$`);
  } else {
    pattern = new RegExp(`^${segment}(\\.${segment}){0,2}$`);
  }
  if (!pattern.test(fullKey)) {
    issues.push(`Key "${fullKey}" must follow namespace naming rules`);
  }
  return issues;
}

export function scanSourceFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'locales', '__tests__'].includes(entry.name)) continue;
        walk(full);
      } else if (/\.(vue|ts|js)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(SRC_DIR);
  return results;
}

export const ENFORCEMENT_GLOBS = [
  'src/components/ui',
  'src/layouts',
  'src/components/common',
  'src/components/modals',
  'src/components/AppSidebar.vue',
  'src/components/AppSidebarSkeleton.vue',
  'src/components/TabBar.vue',
  'src/components/notifications',
  'src/components/Nav.vue',
  'src/views/Login.vue',
  'src/components/LoginForm.vue',
];

export function isEnforcementPath(filePath) {
  const rel = path.relative(CLIENT_ROOT, filePath);
  return ENFORCEMENT_GLOBS.some((g) => rel.startsWith(g));
}
