/**
 * Supported BCP 47 language tags and shared namespace registry.
 * @see client/docs/I18N_GUIDELINES.md
 */

/** UI message bundle languages (ISO 639-1 or pseudo tags). */
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
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Pseudo locales for QA (not production). */
export const PSEUDO_LANGUAGES = ['en-XA', 'ar-XB'] as const;

export type PseudoLanguage = (typeof PSEUDO_LANGUAGES)[number];

export type I18nLanguage = SupportedLanguage | PseudoLanguage;

/** Shared reusable namespaces — max key depth is enforced relative to namespace root. */
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
  'cases',
  'liveChat',
  'telephony',
  'people',
  'organizations',
  'inbox',
  'dashboard',
  'import',
  'documents',
  'templates',
  'contentStudio',
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
] as const;

export type SharedNamespace = (typeof SHARED_NAMESPACES)[number];

/**
 * Large catalogs loaded after core shell messages (settings ~400KB, forms ~160KB, process ~110KB per locale).
 * Routes under /settings and /forms await the full bundle via ensureFullLocaleLoaded().
 */
export const DEFERRED_LOCALE_NAMESPACES = ['settings', 'forms', 'webforms', 'process', 'templates'] as const satisfies readonly SharedNamespace[];

export type DeferredLocaleNamespace = (typeof DEFERRED_LOCALE_NAMESPACES)[number];

/** Namespaces needed for shell, CRM lists, inbox, and most record pages. */
export const CORE_LOCALE_NAMESPACES = SHARED_NAMESPACES.filter(
  (ns): ns is SharedNamespace => !(DEFERRED_LOCALE_NAMESPACES as readonly string[]).includes(ns)
);

/** Minimal catalogs for /login and other auth lifecycle routes (avoid loading full core on sign-in). */
export const PUBLIC_AUTH_LOCALE_NAMESPACES = [
  'auth',
  'errors',
  'onboarding',
] as const satisfies readonly SharedNamespace[];

/** Maximum dot-separated segments for any full message key (e.g. actions.save.confirm). */
export const MAX_KEY_DEPTH = 3;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const DEFAULT_LOCALE = 'en-US';

export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

/** Dev warning threshold for initial (core) locale payload after flattening. */
/** Soft cap on eager core locale payload (warn in DEV if exceeded). */
export const LOCALE_CORE_BUDGET_BYTES = 576 * 1024;

/** Dev warning threshold for full locale payload (core + deferred). */
export const LOCALE_FULL_BUDGET_BYTES = 1536 * 1024;

/** Dev warning threshold for a single namespace JSON file. */
export const LOCALE_NAMESPACE_BUDGET_BYTES = 96 * 1024;

/** @deprecated Use LOCALE_CORE_BUDGET_BYTES / LOCALE_FULL_BUDGET_BYTES */
export const LOCALE_CHUNK_BUDGET_BYTES = LOCALE_CORE_BUDGET_BYTES;

/** Map language → default BCP 47 locale for Intl formatters. */
export const LANGUAGE_TO_DEFAULT_LOCALE: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
};

export const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar']);

export const PSEUDO_BASE_LANGUAGE: Record<PseudoLanguage, SupportedLanguage> = {
  'en-XA': 'en',
  'ar-XB': 'ar',
};

export const I18N_DEV_PSEUDO_STORAGE_KEY = 'arivu:i18n:pseudoLocale';
export const I18N_DEV_TELEMETRY_STORAGE_KEY = 'arivu:i18n:telemetry';
