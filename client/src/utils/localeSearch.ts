/**
 * Locale-aware search, sort, and transliteration helpers for CRM datasets.
 */

export type LocaleSearchOptions = {
  locale?: string;
  sensitivity?: 'base' | 'accent' | 'case' | 'variant';
  ignorePunctuation?: boolean;
};

const DEFAULT_SEARCH_LOCALE = 'en';

/**
 * Unicode normalization for accent-insensitive comparison (José ≈ Jose).
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Basic Latin transliteration for common European characters (Müller ≈ Muller).
 */
export function transliterateForSearch(input: string): string {
  const map: Record<string, string> = {
    ä: 'a',
    Ä: 'A',
    ö: 'o',
    Ö: 'O',
    ü: 'u',
    Ü: 'U',
    ß: 'ss',
    æ: 'ae',
    ø: 'o',
    å: 'a',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    á: 'a',
    à: 'a',
    â: 'a',
    ã: 'a',
    ç: 'c',
    ñ: 'n',
    í: 'i',
    ì: 'i',
    î: 'i',
    ï: 'i',
    ó: 'o',
    ò: 'o',
    ô: 'o',
    ú: 'u',
    ù: 'u',
    û: 'u',
  };

  return [...input].map((ch) => map[ch] ?? ch).join('');
}

export function normalizeSearchKey(input: string): string {
  return normalizeForSearch(transliterateForSearch(input));
}

export function localeIncludes(haystack: string, needle: string, _options: LocaleSearchOptions = {}): boolean {
  if (!needle) return true;
  const h = normalizeSearchKey(haystack);
  const n = normalizeSearchKey(needle);
  return h.includes(n);
}

export function localeCompare(
  a: string,
  b: string,
  options: LocaleSearchOptions & { numeric?: boolean } = {}
): number {
  const locale = options.locale ?? DEFAULT_SEARCH_LOCALE;
  return a.localeCompare(b, locale, {
    sensitivity: options.sensitivity ?? 'base',
    ignorePunctuation: options.ignorePunctuation ?? true,
    numeric: options.numeric ?? true,
  });
}

export function localeSort<T>(
  items: T[],
  accessor: (item: T) => string,
  options: LocaleSearchOptions = {}
): T[] {
  return [...items].sort((a, b) => localeCompare(accessor(a), accessor(b), options));
}

export function filterByLocaleSearch<T>(
  items: T[],
  query: string,
  accessor: (item: T) => string
): T[] {
  const q = query.trim();
  if (!q) return items;
  return items.filter((item) => localeIncludes(accessor(item), q));
}
