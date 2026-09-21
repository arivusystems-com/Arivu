/**
 * Canonical fiscal-year helpers for tenant organizations.
 * Prefer settings.fiscalYearStartMonth; fall back to settings.analytics.fiscalYearStartMonth.
 */

function clampMonth(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 12) return fallback;
  return Math.trunc(n);
}

/**
 * @param {object|null|undefined} org — Organization document or lean object
 * @returns {number} 1–12
 */
function resolveFiscalYearStartMonth(org) {
  const settings = org?.settings || {};
  if (settings.fiscalYearStartMonth != null) {
    return clampMonth(settings.fiscalYearStartMonth, 1);
  }
  const analytics = settings.analytics && typeof settings.analytics === 'object'
    ? settings.analytics
    : {};
  return clampMonth(analytics.fiscalYearStartMonth, 1);
}

/**
 * Dual-write FY start onto settings root and settings.analytics.
 * @param {object} org — mongoose Organization document
 * @param {number} month — 1–12
 * @returns {number} normalized month
 */
function applyFiscalYearStartMonth(org, month) {
  const normalized = clampMonth(month, 1);
  if (!org.settings) org.settings = {};
  org.settings.fiscalYearStartMonth = normalized;
  if (!org.settings.analytics || typeof org.settings.analytics !== 'object') {
    org.settings.analytics = {};
  }
  org.settings.analytics.fiscalYearStartMonth = normalized;
  return normalized;
}

/**
 * @param {number} fyYear — calendar year in which the FY begins
 * @param {number} quarter — 1–4
 * @param {number} startMonth — 1–12
 * @returns {{ start: Date, end: Date }}
 */
function getFiscalQuarterRange(fyYear, quarter, startMonth = 1) {
  const q = Math.min(4, Math.max(1, Math.trunc(Number(quarter) || 1)));
  const sm = clampMonth(startMonth, 1);
  const year = Number.isFinite(Number(fyYear)) ? Math.trunc(Number(fyYear)) : new Date().getFullYear();
  const offsetMonths = sm - 1 + (q - 1) * 3;
  const startMonthIndex = offsetMonths % 12;
  const yearOffset = Math.floor(offsetMonths / 12);
  const start = new Date(year + yearOffset, startMonthIndex, 1);
  const end = new Date(year + yearOffset, startMonthIndex + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * @param {Date} [date]
 * @param {number} [startMonth]
 * @returns {number} 1–4
 */
function currentFiscalQuarter(date = new Date(), startMonth = 1) {
  const sm = clampMonth(startMonth, 1) - 1;
  const month = date instanceof Date ? date.getMonth() : new Date(date).getMonth();
  const monthsIntoFy = (month - sm + 12) % 12;
  return Math.floor(monthsIntoFy / 3) + 1;
}

/**
 * Calendar year in which the current fiscal year started.
 * @param {Date} [date]
 * @param {number} [startMonth]
 * @returns {number}
 */
function currentFiscalYear(date = new Date(), startMonth = 1) {
  const sm = clampMonth(startMonth, 1);
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return month < sm ? year - 1 : year;
}

module.exports = {
  resolveFiscalYearStartMonth,
  applyFiscalYearStartMonth,
  getFiscalQuarterRange,
  currentFiscalQuarter,
  currentFiscalYear,
  clampMonth,
};
