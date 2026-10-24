/**
 * Centralized Intl formatters — components must not call toLocaleString directly.
 * Dates are stored as UTC; display/parse use the active user (or org) time zone + dateFormat.
 * @see client/docs/I18N_GUIDELINES.md
 */

import { DEFAULT_LOCALE } from '@/i18n/constants';

export type DisplayPreferences = {
  preferredCurrency?: string | null;
  showAmountsInPreferredCurrency?: boolean;
  digitGroupingPattern?: 'international' | 'indian';
  decimalSeparator?: '.' | ',';
  digitGroupingSeparator?: ',' | '.' | ' ' | "'";
  currencyDecimalPlaces?: number;
  truncateTrailingZeros?: boolean;
  aggregatedNumberFormat?: 'none' | 'thousands' | 'millions' | 'billions';
};

export type OrgCurrencyRateRow = {
  code: string;
  enabled: boolean;
  conversionRate: number;
};

export type LocaleFormatContext = {
  locale?: string;
  timeZone?: string;
  currency?: string;
  /** Org base currency (settings.currency), independent of preferred display currency */
  baseCurrency?: string;
  /** Org enabled currency rows with rates vs base (excludes base row) */
  orgCurrencies?: OrgCurrencyRateRow[] | null;
  /** User/org date pattern, e.g. DD/MM/YYYY */
  dateFormat?: string;
  /** User time preference: '12h' (default) | '24h' */
  timeFormat?: '12h' | '24h';
  displayPreferences?: DisplayPreferences | null;
};

export const DEFAULT_DISPLAY_PREFERENCES: Required<
  Omit<DisplayPreferences, 'preferredCurrency'>
> & { preferredCurrency: string | null } = {
  preferredCurrency: null,
  showAmountsInPreferredCurrency: false,
  digitGroupingPattern: 'international',
  decimalSeparator: '.',
  digitGroupingSeparator: ',',
  currencyDecimalPlaces: 2,
  truncateTrailingZeros: false,
  aggregatedNumberFormat: 'none',
};

let context: LocaleFormatContext = {
  locale: DEFAULT_LOCALE,
  timeZone: 'UTC',
  currency: 'USD',
  baseCurrency: 'USD',
  orgCurrencies: [],
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  displayPreferences: { ...DEFAULT_DISPLAY_PREFERENCES },
};

/** Normalize stored preference; unset → 12h. */
export function resolveTimeFormat(
  value: string | null | undefined
): '12h' | '24h' {
  return value === '24h' ? '24h' : '12h';
}

/** Time token pattern for the active preference. */
export function getUserTimePattern(timeFormat?: string | null): string {
  return resolveTimeFormat(timeFormat) === '24h' ? 'HH:mm' : 'h:mm A';
}

export function resolveDisplayPreferences(
  ctx: LocaleFormatContext = context
): typeof DEFAULT_DISPLAY_PREFERENCES {
  const raw = ctx.displayPreferences || {};
  return {
    preferredCurrency: raw.preferredCurrency ?? DEFAULT_DISPLAY_PREFERENCES.preferredCurrency,
    showAmountsInPreferredCurrency:
      raw.showAmountsInPreferredCurrency
      ?? DEFAULT_DISPLAY_PREFERENCES.showAmountsInPreferredCurrency,
    digitGroupingPattern:
      raw.digitGroupingPattern === 'indian' ? 'indian' : 'international',
    decimalSeparator: raw.decimalSeparator === ',' ? ',' : '.',
    digitGroupingSeparator:
      raw.digitGroupingSeparator === '.'
      || raw.digitGroupingSeparator === ' '
      || raw.digitGroupingSeparator === "'"
        ? raw.digitGroupingSeparator
        : ',',
    currencyDecimalPlaces: Number.isInteger(raw.currencyDecimalPlaces)
      && Number(raw.currencyDecimalPlaces) >= 0
      && Number(raw.currencyDecimalPlaces) <= 6
      ? Number(raw.currencyDecimalPlaces)
      : DEFAULT_DISPLAY_PREFERENCES.currencyDecimalPlaces,
    truncateTrailingZeros:
      raw.truncateTrailingZeros ?? DEFAULT_DISPLAY_PREFERENCES.truncateTrailingZeros,
    aggregatedNumberFormat:
      raw.aggregatedNumberFormat === 'thousands'
      || raw.aggregatedNumberFormat === 'millions'
      || raw.aggregatedNumberFormat === 'billions'
        ? raw.aggregatedNumberFormat
        : 'none',
  };
}

const AGGREGATION_SCALE: Record<'thousands' | 'millions' | 'billions', { divisor: number; suffix: string }> = {
  thousands: { divisor: 1_000, suffix: 'K' },
  millions: { divisor: 1_000_000, suffix: 'M' },
  billions: { divisor: 1_000_000_000, suffix: 'B' },
};

/**
 * Format a number using the active user's Currency & number preferences.
 * Explicit Intl options (fraction digits, style, currency) still win when provided.
 */
export function formatNumberWithDisplayPrefs(
  value: number,
  options: Intl.NumberFormatOptions & {
    currencyCode?: string | null;
    applyAggregation?: boolean;
  } = {},
  ctx: LocaleFormatContext = context
): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';

  const prefs = resolveDisplayPreferences(ctx);
  const style = options.style || 'decimal';
  // Aggregation is for currency/money display — not plain counts (recipients, credits, etc.).
  const applyAggregation =
    options.applyAggregation === true
    || (options.applyAggregation !== false && style === 'currency');
  let amount = numeric;
  let suffix = '';
  if (applyAggregation && prefs.aggregatedNumberFormat !== 'none') {
    const scale = AGGREGATION_SCALE[prefs.aggregatedNumberFormat];
    amount = numeric / scale.divisor;
    suffix = scale.suffix;
  }

  const places = prefs.currencyDecimalPlaces;
  const hasMin = Object.prototype.hasOwnProperty.call(options, 'minimumFractionDigits');
  const hasMax = Object.prototype.hasOwnProperty.call(options, 'maximumFractionDigits');
  let maximumFractionDigits: number | undefined;
  let minimumFractionDigits: number | undefined;
  if (hasMax) {
    maximumFractionDigits = Number(options.maximumFractionDigits);
  } else if (style === 'currency') {
    maximumFractionDigits = places;
  }
  if (hasMin) {
    minimumFractionDigits = Number(options.minimumFractionDigits);
  } else if (style === 'currency') {
    minimumFractionDigits = prefs.truncateTrailingZeros ? 0 : places;
  }

  const groupingLocale = prefs.digitGroupingPattern === 'indian' ? 'en-IN' : 'en-US';
  const currency =
    style === 'currency'
      ? (options.currency
        || options.currencyCode
        || ctx.currency
        || 'USD')
      : undefined;

  let groupSep = prefs.digitGroupingSeparator;
  const decimalSep = prefs.decimalSeparator;
  if (groupSep === decimalSep) {
    groupSep = decimalSep === '.' ? ',' : '.';
  }

  try {
    const parts = new Intl.NumberFormat(groupingLocale, {
      style,
      currency: currency as string | undefined,
      currencyDisplay: options.currencyDisplay,
      ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {}),
      ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
      notation: options.notation,
      compactDisplay: options.compactDisplay,
    }).formatToParts(amount);

    const body = parts
      .map((part) => {
        if (part.type === 'group') return groupSep;
        if (part.type === 'decimal') return decimalSep;
        return part.value;
      })
      .join('');
    return suffix ? `${body}${suffix}` : body;
  } catch {
    const fixed = amount.toFixed(maximumFractionDigits ?? 2);
    return suffix ? `${fixed}${suffix}` : fixed;
  }
}

export function setLocaleFormatContext(next: Partial<LocaleFormatContext>): void {
  const mergedPrefs = next.displayPreferences
    ? {
        ...DEFAULT_DISPLAY_PREFERENCES,
        ...(context.displayPreferences || {}),
        ...next.displayPreferences,
      }
    : context.displayPreferences;
  const nextTimeFormat =
    next.timeFormat !== undefined
      ? resolveTimeFormat(next.timeFormat)
      : context.timeFormat;
  context = {
    ...context,
    ...next,
    timeFormat: nextTimeFormat,
    displayPreferences: mergedPrefs,
  };
}

export function getLocaleFormatContext(): Readonly<LocaleFormatContext> {
  return context;
}

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Extract calendar/clock parts of an instant as seen in `timeZone`.
 */
export function getZonedParts(
  value: Date | string | number,
  timeZone: string = context.timeZone ?? 'UTC'
): ZonedDateTimeParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(date)) {
      if (part.type !== 'literal') map[part.type] = part.value;
    }
    let hour = Number(map.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour,
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    return null;
  }
}

function getOffsetMs(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone);
  if (!parts) return 0;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - instant.getTime();
}

/**
 * Interpret a wall-clock date/time in `timeZone` and return the UTC Date.
 */
export function wallTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string = context.timeZone ?? 'UTC'
): Date {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second);
  const offset1 = getOffsetMs(new Date(utcMs), timeZone);
  utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second) - offset1;
  const offset2 = getOffsetMs(new Date(utcMs), timeZone);
  if (offset2 !== offset1) {
    utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second) - offset2;
  }
  return new Date(utcMs);
}

/** Convert UTC instant → `YYYY-MM-DDTHH:mm` wall string in the given zone. */
export function utcToWallDateTimeLocal(
  value: Date | string | number,
  timeZone: string = context.timeZone ?? 'UTC'
): string {
  const parts = getZonedParts(value, timeZone);
  if (!parts) return '';
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/** Convert wall `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` in user TZ → UTC ISO string. */
export function wallDateTimeLocalToUtcIso(
  value: string | null | undefined,
  timeZone: string = context.timeZone ?? 'UTC'
): string | null {
  if (!value) return null;
  const cleaned = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (dateOnly) {
    const utc = wallTimeToUtc(
      {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3]),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone
    );
    return utc.toISOString();
  }
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(cleaned);
  if (dateTime) {
    const utc = wallTimeToUtc(
      {
        year: Number(dateTime[1]),
        month: Number(dateTime[2]),
        day: Number(dateTime[3]),
        hour: Number(dateTime[4]),
        minute: Number(dateTime[5]),
        second: Number(dateTime[6] || 0),
      },
      timeZone
    );
    return utc.toISOString();
  }
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Format a UTC instant using a token pattern in the given time zone.
 * Tokens: YYYY MM MMM MMMM DD D HH hh h mm ss A a
 */
export function formatWithPattern(
  value: Date | string | number,
  pattern: string,
  timeZone: string = context.timeZone ?? 'UTC'
): string {
  const parts = getZonedParts(value, timeZone);
  if (!parts) return '';

  const hour12 = parts.hour % 12 || 12;
  const replacements: Record<string, string> = {
    YYYY: String(parts.year),
    MMMM: MONTHS_LONG[parts.month - 1] || '',
    MMM: MONTHS_SHORT[parts.month - 1] || '',
    MM: String(parts.month).padStart(2, '0'),
    DD: String(parts.day).padStart(2, '0'),
    D: String(parts.day),
    HH: String(parts.hour).padStart(2, '0'),
    hh: String(hour12).padStart(2, '0'),
    h: String(hour12),
    mm: String(parts.minute).padStart(2, '0'),
    ss: String(parts.second).padStart(2, '0'),
    A: parts.hour >= 12 ? 'PM' : 'AM',
    a: parts.hour >= 12 ? 'pm' : 'am',
  };

  const tokens = Object.keys(replacements).sort((a, b) => b.length - a.length);
  const tokenRegex = new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return String(pattern).replace(tokenRegex, (match) => replacements[match] ?? match);
}

/** Date-only display using the user's selected dateFormat in their time zone. */
export function formatUserDate(
  value: Date | string | number,
  ctx: LocaleFormatContext = context
): string {
  const pattern = ctx.dateFormat || 'MM/DD/YYYY';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.trim().split('-').map(Number);
    const replacements: Record<string, string> = {
      YYYY: String(y),
      MMMM: MONTHS_LONG[(m || 1) - 1] || '',
      MMM: MONTHS_SHORT[(m || 1) - 1] || '',
      MM: String(m).padStart(2, '0'),
      DD: String(d).padStart(2, '0'),
      D: String(d),
      HH: '00',
      hh: '12',
      h: '12',
      mm: '00',
      ss: '00',
      A: 'AM',
      a: 'am',
    };
    const tokens = Object.keys(replacements).sort((a, b) => b.length - a.length);
    const tokenRegex = new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    return String(pattern).replace(tokenRegex, (match) => replacements[match] ?? match);
  }
  return formatWithPattern(value, pattern, ctx.timeZone ?? 'UTC');
}

/** Date + time display using dateFormat + user timeFormat in the user's time zone. */
export function formatUserDateTime(
  value: Date | string | number,
  ctx: LocaleFormatContext = context
): string {
  const pattern = `${ctx.dateFormat || 'MM/DD/YYYY'} ${getUserTimePattern(ctx.timeFormat)}`;
  return formatWithPattern(value, pattern, ctx.timeZone ?? 'UTC');
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  ctx: LocaleFormatContext = context
): string {
  return formatNumberWithDisplayPrefs(value, options, ctx);
}

function conversionRateVsBase(
  code: string,
  ctx: LocaleFormatContext
): number | null {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  const base = String(ctx.baseCurrency || ctx.currency || 'USD').trim().toUpperCase() || 'USD';
  if (normalized === base) return 1;
  const row = (ctx.orgCurrencies || []).find(
    (r) => String(r.code || '').toUpperCase() === normalized && r.enabled
  );
  const rate = Number(row?.conversionRate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function formatCurrency(
  value: number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
  ctx: LocaleFormatContext = context
): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const prefs = resolveDisplayPreferences(ctx);
  const base = String(ctx.baseCurrency || ctx.currency || 'USD').trim().toUpperCase() || 'USD';
  let amount = numeric;
  let currency = base;
  const preferredRaw = String(prefs.preferredCurrency || '').trim().toUpperCase() || null;
  const preferred =
    preferredRaw
    && (prefs.showAmountsInPreferredCurrency || preferredRaw !== base)
      ? preferredRaw
      : null;
  if (preferred && preferred !== base) {
    const fromRate = conversionRateVsBase(base, ctx);
    const toRate = conversionRateVsBase(preferred, ctx);
    if (fromRate != null && toRate != null) {
      amount = (numeric / fromRate) * toRate;
      currency = preferred;
    }
  } else if (preferred) {
    currency = preferred;
  }
  return formatNumberWithDisplayPrefs(
    amount,
    {
      style: 'currency',
      currency,
      ...options,
    },
    ctx
  );
}

function hasExplicitDateOptions(options: Intl.DateTimeFormatOptions): boolean {
  return Boolean(
    options.dateStyle
    || options.timeStyle
    || options.year
    || options.month
    || options.day
    || options.weekday
    || options.hour
    || options.minute
    || options.second
  );
}

/**
 * Format a UTC instant for display.
 * When no explicit Intl options are passed, uses the user's dateFormat + timeZone.
 */
export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  ctx: LocaleFormatContext = context
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (!hasExplicitDateOptions(options) && ctx.dateFormat) {
    return formatUserDate(date, ctx);
  }

  try {
    return new Intl.DateTimeFormat(ctx.locale ?? DEFAULT_LOCALE, {
      timeZone: ctx.timeZone ?? 'UTC',
      ...options,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  ctx: LocaleFormatContext = context
): string {
  const hour12 =
    Object.prototype.hasOwnProperty.call(options, 'hour12')
      ? Boolean(options.hour12)
      : resolveTimeFormat(ctx.timeFormat) === '12h';

  const hasClockOptions = Boolean(
    options.hour || options.minute || options.second || options.timeStyle
  );
  if (!hasClockOptions) {
    return formatWithPattern(value, getUserTimePattern(ctx.timeFormat), ctx.timeZone ?? 'UTC');
  }

  return formatDate(
    value,
    {
      hour: 'numeric',
      minute: '2-digit',
      ...options,
      hour12,
    },
    ctx
  );
}

export function formatRelativeTime(
  value: Date | string | number,
  base: Date = new Date(),
  ctx: LocaleFormatContext = context
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.round((date.getTime() - base.getTime()) / 1000);
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(ctx.locale ?? DEFAULT_LOCALE, { numeric: 'auto' });
    for (const [unit, secondsInUnit] of ranges) {
      if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
        const delta = Math.round(diffSeconds / secondsInUnit);
        return rtf.format(delta, unit);
      }
    }
  } catch {
    /* fall through */
  }

  return formatUserDateTime(date, ctx);
}
