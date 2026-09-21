import { INDIA_STATE_BY_CODE } from '@/utils/billingGeo';

/** GSTIN: 2-digit state + PAN(10) + entity + 'Z' + checksum */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Extra GST jurisdiction codes accepted by the server (not in billing dropdowns). */
const EXTRA_GST_STATE_CODES = new Set(['28', '97', '99']);

/**
 * GSTIN check-digit (MOD-36 weighted sum over first 14 chars).
 * @param {string} gstin14
 * @returns {string}
 */
function computeGstinChecksum(gstin14) {
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const codePoint = GSTIN_CHARSET.indexOf(gstin14[i]);
    if (codePoint < 0) return '';
    let product = factor * codePoint;
    factor = factor === 1 ? 2 : 1;
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checkCodePoint];
}

/**
 * @param {string|null|undefined} gstin
 * @returns {{ ok: boolean, normalized: string|null, error: string|null }}
 */
export function validateGstin(gstin) {
  if (gstin == null || String(gstin).trim() === '') {
    return { ok: false, normalized: null, error: 'required' };
  }

  const normalized = String(gstin).trim().toUpperCase().replace(/\s+/g, '');

  if (normalized.length !== 15) {
    return { ok: false, normalized: null, error: 'length' };
  }

  if (!GSTIN_REGEX.test(normalized)) {
    return { ok: false, normalized: null, error: 'format' };
  }

  const stateCode = normalized.slice(0, 2);
  if (!Object.prototype.hasOwnProperty.call(INDIA_STATE_BY_CODE, stateCode)
    && !EXTRA_GST_STATE_CODES.has(stateCode)) {
    return { ok: false, normalized: null, error: 'state' };
  }

  const expected = computeGstinChecksum(normalized.slice(0, 14));
  if (!expected || expected !== normalized[14]) {
    return { ok: false, normalized: null, error: 'checksum' };
  }

  return { ok: true, normalized, error: null };
}

/**
 * @param {string|null|undefined} gstin
 * @returns {boolean}
 */
export function isValidGstin(gstin) {
  return validateGstin(gstin).ok;
}
