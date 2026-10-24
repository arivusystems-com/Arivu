import { createI18n } from 'vue-i18n';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  I18N_DEV_PSEUDO_STORAGE_KEY,
  PSEUDO_LANGUAGES,
  type I18nLanguage,
} from './constants';
import {
  loadCoreLocaleMessages,
  loadFullLocaleMessages,
  loadPublicAuthLocaleMessages,
} from './loadLocale';
import { trackI18nEvent } from './telemetry';

export type { I18nLanguage };

export type I18nLoadScope = 'public' | 'core' | 'full';

function readDevPseudoLanguage(): I18nLanguage | null {
  try {
    const stored = localStorage.getItem(I18N_DEV_PSEUDO_STORAGE_KEY);
    if (stored && PSEUDO_LANGUAGES.includes(stored as (typeof PSEUDO_LANGUAGES)[number])) {
      return stored as I18nLanguage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveInitialLanguage(orgLanguage?: string | null, userLanguage?: string | null): I18nLanguage {
  const pseudo = import.meta.env.DEV ? readDevPseudoLanguage() : null;
  if (pseudo) return pseudo;

  const candidate = (userLanguage || orgLanguage || DEFAULT_LANGUAGE).toLowerCase();
  if (PSEUDO_LANGUAGES.includes(candidate as (typeof PSEUDO_LANGUAGES)[number])) {
    return candidate as I18nLanguage;
  }
  return (candidate.split('-')[0] || DEFAULT_LANGUAGE) as I18nLanguage;
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LANGUAGE,
  fallbackLocale: FALLBACK_LANGUAGE,
  messages: {},
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
  missing: (locale, key) => {
    trackI18nEvent({
      type: 'missing_key',
      key,
      locale,
      fallbackLocale: FALLBACK_LANGUAGE,
    });
    if (import.meta.env.DEV) {
      return `[missing:${key}]`;
    }
    return undefined;
  },
});

let activeLoad: Promise<void> | null = null;
let loadedScope: I18nLoadScope | null = null;

const scopeRank: Record<I18nLoadScope, number> = {
  public: 1,
  core: 2,
  full: 3,
};

export type SetI18nLanguageOptions = {
  /** When false, load core messages first and merge the full bundle in the background. */
  waitForFull?: boolean;
  scope?: I18nLoadScope;
};

export async function setI18nLanguage(
  language: I18nLanguage,
  options: SetI18nLanguageOptions = {}
): Promise<void> {
  const waitForFull = options.waitForFull ?? true;
  const scope = options.scope ?? 'core';

  if (scope === 'public') {
    const messages = await loadPublicAuthLocaleMessages(language);
    i18n.global.setLocaleMessage(language, messages);
    i18n.global.locale.value = language;
    loadedScope = 'public';
    return;
  }

  const core = await loadCoreLocaleMessages(language);
  i18n.global.setLocaleMessage(language, core);
  i18n.global.locale.value = language;
  loadedScope = 'core';

  if (waitForFull) {
    const full = await loadFullLocaleMessages(language);
    i18n.global.setLocaleMessage(language, full);
    loadedScope = 'full';
    return;
  }

  void loadFullLocaleMessages(language).then((full) => {
    if (i18n.global.locale.value === language) {
      i18n.global.setLocaleMessage(language, full);
      loadedScope = 'full';
    }
  });
}

/** After sign-in: load shell namespaces without blocking navigation. */
export async function upgradeI18nAfterLogin(options: {
  orgLanguage?: string | null;
  userLanguage?: string | null;
} = {}): Promise<void> {
  const language = resolveInitialLanguage(options.orgLanguage, options.userLanguage);
  if (loadedScope && scopeRank[loadedScope] >= scopeRank.core && i18n.global.locale.value === language) {
    return;
  }
  if (activeLoad) {
    await activeLoad;
    if (loadedScope && scopeRank[loadedScope] >= scopeRank.core && i18n.global.locale.value === language) {
      return;
    }
  }
  activeLoad = setI18nLanguage(language, { scope: 'core', waitForFull: false }).finally(() => {
    activeLoad = null;
  });
  await activeLoad;
}

export async function initI18n(options: {
  orgLanguage?: string | null;
  userLanguage?: string | null;
  scope?: I18nLoadScope;
} = {}): Promise<void> {
  const scope = options.scope ?? 'core';
  const language = resolveInitialLanguage(options.orgLanguage, options.userLanguage);
  if (activeLoad) {
    await activeLoad;
    if (loadedScope && scopeRank[loadedScope] >= scopeRank[scope] && i18n.global.locale.value === language) {
      return;
    }
  } else if (loadedScope && scopeRank[loadedScope] >= scopeRank[scope] && i18n.global.locale.value === language) {
    return;
  }
  activeLoad = setI18nLanguage(language, {
    scope,
    waitForFull: scope === 'full',
  }).finally(() => {
    activeLoad = null;
  });
  await activeLoad;
}

export function useI18nGlobal() {
  return i18n.global;
}

export {
  loadLocaleMessages,
  loadCoreLocaleMessages,
  loadFullLocaleMessages,
  loadPublicAuthLocaleMessages,
  ensureFullLocaleLoaded,
  ensureWebformsNamespaceLoaded,
  prefetchLocale,
  clearLocaleCache,
} from './loadLocale';
export { resolveApiErrorMessage, errorCodeToKey, ERROR_CODES } from './errors';
export { trackI18nEvent, isI18nTelemetryEnabled, setI18nTelemetryEnabled } from './telemetry';
