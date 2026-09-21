import { formatCurrencyValue } from '@/utils/currencyOptions';
import { formatUserDate, formatNumberWithDisplayPrefs } from '@/utils/localeFormat';
/**
 * Shared display helpers for Targets & Quotas UI.
 */

export const LIFECYCLE_STYLES = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  locked: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export const STATUS_STYLES = {
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  on_track: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  at_risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  achieved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  overachieved: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
};

export const APP_LABELS = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  PLATFORM: 'Platform',
  MARKETING: 'Marketing',
  INVENTORY: 'Inventory',
};

export const MODULE_LABELS = {
  deals: 'Deals',
  cases: 'Cases',
  tasks: 'Tasks',
  forms: 'Forms',
  orders: 'Orders',
  items: 'Items',
};

export function targetProgressPercent(target) {
  const goal = Number(target?.targetValue) || 0;
  const achieved = Number(target?.achievedValue) || 0;
  if (goal <= 0) return 0;
  return Math.min(150, Math.round((achieved / goal) * 100));
}

export function progressBarWidth(pct) {
  return `${Math.min(100, Math.max(0, pct))}%`;
}

export function formatTargetValue(value, metricKind = 'count') {
  const n = Number(value) || 0;
  if (metricKind === 'currency') {
    return formatCurrencyValue(n, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) || '—';
  }
  return formatNumberWithDisplayPrefs(n, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPeriodRange(start, end) {
  if (!start || !end) return '—';
  const s = formatUserDate(start);
  const e = formatUserDate(end);
  return `${s} – ${e}`;
}

/** YYYY-MM-DD in local timezone (avoids UTC shift from toISOString). */
export function toLocalDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

function clampFyStartMonth(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 12) return 1;
  return Math.trunc(n);
}

/**
 * @param {number} year — calendar year in which the fiscal year begins
 * @param {number} quarter — 1–4
 * @param {number} [fiscalYearStartMonth=1] — 1–12
 */
export function getQuarterRange(year, quarter, fiscalYearStartMonth = 1) {
  const q = Math.min(4, Math.max(1, quarter));
  const sm = clampFyStartMonth(fiscalYearStartMonth);
  const y = Number.isFinite(Number(year)) ? Math.trunc(Number(year)) : new Date().getFullYear();
  const offsetMonths = sm - 1 + (q - 1) * 3;
  const startMonthIndex = offsetMonths % 12;
  const yearOffset = Math.floor(offsetMonths / 12);
  const start = new Date(y + yearOffset, startMonthIndex, 1);
  const end = new Date(y + yearOffset, startMonthIndex + 3, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

/** @deprecated Prefer currentFiscalQuarter — kept for callers expecting calendar Q. */
export function currentCalendarQuarter() {
  return currentFiscalQuarter(new Date(), 1);
}

/**
 * @param {Date} [date]
 * @param {number} [fiscalYearStartMonth=1]
 * @returns {number} 1–4
 */
export function currentFiscalQuarter(date = new Date(), fiscalYearStartMonth = 1) {
  const sm = clampFyStartMonth(fiscalYearStartMonth) - 1;
  const d = date instanceof Date ? date : new Date(date);
  const monthsIntoFy = (d.getMonth() - sm + 12) % 12;
  return Math.floor(monthsIntoFy / 3) + 1;
}

/**
 * Calendar year in which the current fiscal year started.
 * @param {Date} [date]
 * @param {number} [fiscalYearStartMonth=1]
 */
export function currentFiscalYear(date = new Date(), fiscalYearStartMonth = 1) {
  const sm = clampFyStartMonth(fiscalYearStartMonth);
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return month < sm ? year - 1 : year;
}

/**
 * Short month-range label for a fiscal quarter, e.g. "Apr–Jun".
 * @param {number} quarter — 1–4
 * @param {number} [fiscalYearStartMonth=1]
 * @param {string} [locale]
 */
export function getQuarterMonthLabels(quarter, fiscalYearStartMonth = 1, locale) {
  const q = Math.min(4, Math.max(1, Number(quarter) || 1));
  const sm = clampFyStartMonth(fiscalYearStartMonth);
  const offsetMonths = sm - 1 + (q - 1) * 3;
  const startMonthIndex = offsetMonths % 12;
  const endMonthIndex = (startMonthIndex + 2) % 12;
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const startLabel = fmt.format(new Date(2000, startMonthIndex, 1));
  const endLabel = fmt.format(new Date(2000, endMonthIndex, 1));
  return `${startLabel}–${endLabel}`;
}

export function typeIconKey(key) {
  if (key === 'revenue') return 'currency';
  if (key === 'deal_count') return 'deals';
  if (key === 'case_resolution') return 'cases';
  if (key === 'task_completion') return 'tasks';
  return 'default';
}
