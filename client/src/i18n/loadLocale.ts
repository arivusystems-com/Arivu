import {
  CORE_LOCALE_NAMESPACES,
  DEFAULT_LANGUAGE,
  DEFERRED_LOCALE_NAMESPACES,
  FALLBACK_LANGUAGE,
  LOCALE_CORE_BUDGET_BYTES,
  LOCALE_FULL_BUDGET_BYTES,
  LOCALE_NAMESPACE_BUDGET_BYTES,
  PUBLIC_AUTH_LOCALE_NAMESPACES,
  PSEUDO_BASE_LANGUAGE,
  PSEUDO_LANGUAGES,
  SHARED_NAMESPACES,
  type DeferredLocaleNamespace,
  type I18nLanguage,
  type SharedNamespace,
} from './constants';
import { flattenCatalog, type CatalogFile, type FlatMessages } from './catalog';
import { pseudoTransformMessages } from './pseudo';
import { trackI18nEvent } from './telemetry';

/** Catalogs ship as static assets: bundling them as modules exhausts build memory. */
const catalogUrls = import.meta.glob<string>('../locales/*/*.json', {
  query: '?url',
  import: 'default',
  eager: true,
});

const localeCache = new Map<string, FlatMessages>();
const loadedLocales = new Set<string>();
const fullLoadPromises = new Map<string, Promise<FlatMessages>>();

function catalogPath(language: string, namespace: SharedNamespace): string {
  return `../locales/${language}/${namespace}.json`;
}

function resolveBaseLanguage(language: I18nLanguage): string {
  if (PSEUDO_LANGUAGES.includes(language as (typeof PSEUDO_LANGUAGES)[number])) {
    return PSEUDO_BASE_LANGUAGE[language as keyof typeof PSEUDO_BASE_LANGUAGE];
  }
  return language;
}

async function loadNamespace(language: string, namespace: SharedNamespace): Promise<FlatMessages> {
  const baseLang = resolveBaseLanguage(language as I18nLanguage);
  const primaryPath = catalogPath(baseLang, namespace);
  const fallbackPath = catalogPath(FALLBACK_LANGUAGE, namespace);

  const url = catalogUrls[primaryPath] ?? catalogUrls[fallbackPath];
  if (!url) {
    throw new Error(`Missing locale catalog: ${primaryPath}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load locale catalog ${primaryPath}: HTTP ${response.status}`);
  }
  const file = (await response.json()) as CatalogFile;
  const messages = flattenCatalog(file, namespace).messages;

  if (
    import.meta.env.DEV
    && !(DEFERRED_LOCALE_NAMESPACES as readonly string[]).includes(namespace)
  ) {
    const bytes = estimatePayloadBytes(messages);
    if (bytes > LOCALE_NAMESPACE_BUDGET_BYTES) {
      console.warn(
        `[i18n] Namespace "${namespace}" (${language}) ~${bytes} bytes exceeds per-namespace budget ${LOCALE_NAMESPACE_BUDGET_BYTES}`
      );
    }
  }

  return messages;
}

function estimatePayloadBytes(messages: FlatMessages): number {
  return new TextEncoder().encode(JSON.stringify(messages)).length;
}

function warnBudget(label: string, language: string, bytes: number, budget: number): void {
  if (!import.meta.env.DEV || bytes <= budget) return;
  console.warn(`[i18n] Locale "${language}" ${label} ~${bytes} bytes exceeds budget ${budget}`);
}

function applyPseudo(language: I18nLanguage, messages: FlatMessages): FlatMessages {
  if (language === 'en-XA' || language === 'ar-XB') {
    return pseudoTransformMessages(messages);
  }
  return messages;
}

async function loadNamespaceGroup(
  language: I18nLanguage,
  namespaces: readonly SharedNamespace[]
): Promise<FlatMessages> {
  const parts = await Promise.all(
    namespaces.map((namespace) => loadNamespace(language, namespace))
  );
  return Object.assign({}, ...parts);
}

/**
 * Auth lifecycle routes only (/login, forgot-password, etc.).
 */
export async function loadPublicAuthLocaleMessages(language: I18nLanguage): Promise<FlatMessages> {
  const cacheKey = `${language}::public-auth`;
  const cached = localeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const merged = await loadNamespaceGroup(language, PUBLIC_AUTH_LOCALE_NAMESPACES);
    const finalMessages = applyPseudo(language, merged);
    localeCache.set(cacheKey, finalMessages);
    return finalMessages;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trackI18nEvent({ type: 'locale_load_failed', locale: language, error: message });
    if (language !== FALLBACK_LANGUAGE) {
      return loadPublicAuthLocaleMessages(DEFAULT_LANGUAGE);
    }
    throw error;
  }
}

function coreCacheKey(language: string): string {
  return `${language}::core`;
}

export function isLocaleLoaded(language: string): boolean {
  return loadedLocales.has(language);
}

export function isFullLocaleLoaded(language: string): boolean {
  return localeCache.has(language);
}

export function getCachedLocaleMessages(language: string): FlatMessages | undefined {
  return localeCache.get(language) ?? localeCache.get(coreCacheKey(language));
}

/**
 * Load shell namespaces only (~500KB per locale). Use loadFullLocaleMessages for settings/forms/process.
 */
export async function loadCoreLocaleMessages(language: I18nLanguage): Promise<FlatMessages> {
  const cacheKey = coreCacheKey(language);
  const cached = localeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const merged = await loadNamespaceGroup(language, CORE_LOCALE_NAMESPACES);
    const finalMessages = applyPseudo(language, merged);
    warnBudget('core bundle', language, estimatePayloadBytes(finalMessages), LOCALE_CORE_BUDGET_BYTES);
    localeCache.set(cacheKey, finalMessages);
    return finalMessages;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trackI18nEvent({ type: 'locale_load_failed', locale: language, error: message });
    if (language !== FALLBACK_LANGUAGE) {
      return loadCoreLocaleMessages(DEFAULT_LANGUAGE);
    }
    throw error;
  }
}

/**
 * Load all shared namespaces (core + deferred). Cached after first load.
 */
export async function loadFullLocaleMessages(language: I18nLanguage): Promise<FlatMessages> {
  const cached = localeCache.get(language);
  if (cached) return cached;

  const inFlight = fullLoadPromises.get(language);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const core = await loadCoreLocaleMessages(language);
      const deferred = await loadNamespaceGroup(language, DEFERRED_LOCALE_NAMESPACES);
      const merged = { ...core, ...deferred };
      const finalMessages = applyPseudo(language, merged);
      warnBudget('full bundle', language, estimatePayloadBytes(finalMessages), LOCALE_FULL_BUDGET_BYTES);
      localeCache.set(language, finalMessages);
      loadedLocales.add(language);
      return finalMessages;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trackI18nEvent({ type: 'locale_load_failed', locale: language, error: message });
      if (language !== FALLBACK_LANGUAGE) {
        return loadFullLocaleMessages(DEFAULT_LANGUAGE);
      }
      throw error;
    }
  })();

  fullLoadPromises.set(language, promise);
  try {
    return await promise;
  } finally {
    fullLoadPromises.delete(language);
  }
}

/** @alias loadFullLocaleMessages */
export async function loadLocaleMessages(language: I18nLanguage): Promise<FlatMessages> {
  return loadFullLocaleMessages(language);
}

/**
 * Await deferred namespaces and merge into vue-i18n (call before /settings or /forms routes).
 */
export async function ensureFullLocaleLoaded(language: I18nLanguage): Promise<FlatMessages> {
  return loadFullLocaleMessages(language);
}

/** Load only the webforms namespace (fast — avoids blocking on settings/forms bundles). */
export async function ensureWebformsNamespaceLoaded(language: I18nLanguage): Promise<FlatMessages> {
  const messages = await loadNamespaceGroup(language, ['webforms']);
  return applyPseudo(language, messages);
}

export function prefetchLocale(language: I18nLanguage): void {
  void loadFullLocaleMessages(language);
}

export function clearLocaleCache(): void {
  localeCache.clear();
  loadedLocales.clear();
  fullLoadPromises.clear();
}

export { DEFERRED_LOCALE_NAMESPACES, type DeferredLocaleNamespace };
