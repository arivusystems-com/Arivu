'use strict';

/** Country-specific postal / PIN patterns (keep in sync with client billingGeo.js). */
const POSTAL_RULES = Object.freeze({
  IN: /^[1-9][0-9]{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  AU: /^\d{4}$/,
  NZ: /^\d{4}$/,
  SG: /^\d{6}$/,
  AE: /^\d{5}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  SE: /^\d{3}\s?\d{2}$/,
  CH: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
  KR: /^\d{5}$/,
  CN: /^\d{6}$/,
  BR: /^\d{5}-?\d{3}$/,
  MX: /^\d{5}$/,
  ZA: /^\d{4}$/,
  NG: /^\d{6}$/,
  KE: /^\d{5}$/,
  SA: /^\d{5}(-\d{4})?$/,
  PK: /^\d{5}$/,
  BD: /^\d{4}$/,
});

const FALLBACK = /^[A-Za-z0-9][A-Za-z0-9 \-]{1,11}$/;

/**
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} value
 */
function isValidBillingPostalCode(countryIso2, value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const iso = String(countryIso2 || '').trim().toUpperCase();
  const pattern = POSTAL_RULES[iso] || FALLBACK;
  return pattern.test(raw);
}

/**
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} value
 */
function normalizeBillingPostalCode(countryIso2, value) {
  const iso = String(countryIso2 || '').trim().toUpperCase();
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (iso === 'CA' || iso === 'GB' || iso === 'NL') {
    raw = raw.toUpperCase().replace(/\s+/g, ' ');
  }
  if (iso === 'IN' || iso === 'AU' || iso === 'NZ' || iso === 'SG') {
    raw = raw.replace(/\s+/g, '');
  }
  return raw;
}

module.exports = {
  isValidBillingPostalCode,
  normalizeBillingPostalCode,
};
