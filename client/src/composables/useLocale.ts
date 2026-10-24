import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_LOCALE,
  I18N_DEV_PSEUDO_STORAGE_KEY,
  LANGUAGE_TO_DEFAULT_LOCALE,
  PSEUDO_LANGUAGES,
  RTL_LANGUAGES,
  type I18nLanguage,
  type SupportedLanguage,
} from '@/i18n/constants';
import { initI18n, setI18nLanguage } from '@/i18n';
import {
  setLocaleFormatContext,
  formatNumber,
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  formatUserDate,
  formatUserDateTime,
  wallDateTimeLocalToUtcIso,
  utcToWallDateTimeLocal,
  resolveTimeFormat,
} from '@/utils/localeFormat';
import { normalizeCurrencyCode, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { normalizeIanaTimezone } from '@/utils/orgRegionalOptions';
import type { DisplayPreferences } from '@/utils/localeFormat';

export type LocaleResolution = {
  language: I18nLanguage;
  locale: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  displayPreferences: DisplayPreferences;
  isRtl: boolean;
  isPseudo: boolean;
};

function resolveLocaleTag(language: I18nLanguage, orgLocale?: string | null): string {
  if (orgLocale && typeof orgLocale === 'string' && orgLocale.includes('-')) {
    return orgLocale;
  }
  const base = language.split('-')[0] as SupportedLanguage;
  if (base in LANGUAGE_TO_DEFAULT_LOCALE) {
    return LANGUAGE_TO_DEFAULT_LOCALE[base as SupportedLanguage];
  }
  return DEFAULT_LOCALE;
}

function applyDocumentDirection(isRtl: boolean): void {
  const html = document.documentElement;
  html.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  html.setAttribute('lang', isRtl ? 'ar' : html.lang || 'en');
  if (isRtl) {
    html.classList.add('rtl');
  } else {
    html.classList.remove('rtl');
  }
}

/**
 * Single source of truth for language, locale, timezone, RTL, and formatting context.
 */
export function useLocale() {
  const { locale: i18nLocale } = useI18n();

  const language = computed<I18nLanguage>(() => (i18nLocale.value as I18nLanguage) || DEFAULT_LANGUAGE);

  const authStore = useAuthStore();

  const orgSettings = computed(() => authStore.organization?.settings);
  const userPrefs = computed(() => authStore.user ?? {});

  const locale = computed(() =>
    resolveLocaleTag(language.value, orgSettings.value?.locale)
  );

  const timeZone = computed(() => {
    const userTz = (userPrefs.value as { timeZone?: string | null })?.timeZone;
    const orgTz = orgSettings.value?.timeZone;
    return normalizeIanaTimezone(userTz || orgTz || 'UTC') || 'UTC';
  });

  const dateFormat = computed(() => {
    const userFmt = (userPrefs.value as { dateFormat?: string | null })?.dateFormat;
    const orgFmt = orgSettings.value?.dateFormat;
    return String(userFmt || orgFmt || 'MM/DD/YYYY').trim() || 'MM/DD/YYYY';
  });

  const timeFormat = computed(() => {
    const userFmt = (userPrefs.value as { timeFormat?: string | null })?.timeFormat;
    return resolveTimeFormat(userFmt);
  });

  const displayPreferences = computed<DisplayPreferences>(() => {
    const raw = (userPrefs.value as { displayPreferences?: DisplayPreferences | null })
      ?.displayPreferences;
    const orgCurrency = resolveOrgCurrencyCode(orgSettings.value);
    return {
      ...(raw || {}),
      preferredCurrency:
        normalizeCurrencyCode(raw?.preferredCurrency) || orgCurrency,
    };
  });

  const baseCurrency = computed(() => resolveOrgCurrencyCode(orgSettings.value));

  const orgCurrencies = computed(() => {
    const raw = (orgSettings.value as { currencies?: unknown })?.currencies;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
      .map((row) => ({
        code: String(row.code || '').trim().toUpperCase(),
        enabled: Boolean(row.enabled),
        conversionRate: Number(row.conversionRate) > 0 ? Number(row.conversionRate) : 1,
      }))
      .filter((row) => Boolean(row.code));
  });

  const currency = computed(() => {
    const prefs = displayPreferences.value;
    const preferred = normalizeCurrencyCode(prefs.preferredCurrency);
    if (
      preferred
      && (prefs.showAmountsInPreferredCurrency || preferred !== baseCurrency.value)
    ) {
      return preferred;
    }
    return baseCurrency.value;
  });

  const isPseudo = computed(() =>
    PSEUDO_LANGUAGES.includes(language.value as (typeof PSEUDO_LANGUAGES)[number])
  );

  const isRtl = computed(() => {
    if (language.value === 'ar-XB') return true;
    const base = language.value.split('-')[0] as SupportedLanguage;
    return RTL_LANGUAGES.has(base);
  });

  const resolution = computed<LocaleResolution>(() => ({
    language: language.value,
    locale: locale.value,
    timeZone: timeZone.value,
    dateFormat: dateFormat.value,
    timeFormat: timeFormat.value,
    currency: currency.value,
    displayPreferences: displayPreferences.value,
    isRtl: isRtl.value,
    isPseudo: isPseudo.value,
  }));

  watch(
    [resolution, baseCurrency, orgCurrencies],
    ([r, base, currencies]) => {
      setLocaleFormatContext({
        locale: r.locale,
        timeZone: r.timeZone,
        dateFormat: r.dateFormat,
        timeFormat: r.timeFormat,
        currency: r.currency,
        baseCurrency: base,
        orgCurrencies: currencies,
        displayPreferences: r.displayPreferences,
      });
      applyDocumentDirection(r.isRtl);
    },
    { immediate: true, deep: true }
  );

  async function setLanguage(next: I18nLanguage, persistPseudo = false): Promise<void> {
    if (persistPseudo && PSEUDO_LANGUAGES.includes(next as (typeof PSEUDO_LANGUAGES)[number])) {
      try {
        localStorage.setItem(I18N_DEV_PSEUDO_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    }
    await setI18nLanguage(next);
  }

  async function clearPseudoLanguage(): Promise<void> {
    try {
      localStorage.removeItem(I18N_DEV_PSEUDO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const orgLang = orgSettings.value?.language || DEFAULT_LANGUAGE;
    await setI18nLanguage(orgLang as I18nLanguage);
  }

  return {
    language,
    locale,
    timeZone,
    dateFormat,
    timeFormat,
    currency,
    displayPreferences,
    isRtl,
    isPseudo,
    resolution,
    setLanguage,
    clearPseudoLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime,
    formatUserDate,
    formatUserDateTime,
    wallDateTimeLocalToUtcIso,
    utcToWallDateTimeLocal,
    initFromAuth: async (orgLanguage?: string | null, userLanguage?: string | null) => {
      await initI18n({ orgLanguage, userLanguage });
    },
  };
}
