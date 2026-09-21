'use strict';

const { GST_STATE_CODES, isKnownGstStateCode } = require('../../constants/indiaGstConstants');
const { validateGstin } = require('../../utils/gstinValidator');
const {
  isValidBillingPostalCode,
  normalizeBillingPostalCode,
} = require('../../constants/billingPostal');

/** Billing-eligible India states/UTs (excludes centre / other-territory / legacy AP). */
const EXCLUDED_GST_CODES = new Set(['28', '97', '99']);

const INDIA_BILLING_STATE_NAMES = Object.freeze(
  Object.entries(GST_STATE_CODES)
    .filter(([code]) => !EXCLUDED_GST_CODES.has(code))
    .map(([, name]) => name)
);

/**
 * @param {string} stateName
 * @returns {string|null} GST state code
 */
function indiaStateCodeFromName(stateName) {
  const needle = String(stateName || '').trim().toLowerCase();
  if (!needle) return null;
  for (const [code, name] of Object.entries(GST_STATE_CODES)) {
    if (EXCLUDED_GST_CODES.has(code)) continue;
    if (String(name).toLowerCase() === needle) return code;
  }
  return null;
}

/**
 * Validate commercial bill-to for subscribe / invoice party.
 * GSTIN required only when gstRegistered is true.
 *
 * @param {object} party
 * @returns {{ ok: true, normalized: object } | { ok: false, message: string, code: string }}
 */
function validateCommercialBillingParty(party = {}) {
  const companyName = String(party.companyName || '').trim();
  const billingEmail = String(party.billingEmail || '').trim().toLowerCase();
  const billingPhone = String(party.billingPhone || '').trim();
  const gstRegistered = Boolean(party.gstRegistered);
  const gstin = String(party.gstin || '').trim().toUpperCase();
  const addr = party.billingAddressStructured || party;
  const line1 = String(addr.line1 || '').trim();
  const city = String(addr.city || '').trim();
  let state = String(addr.state || '').trim();
  const country = String(addr.country || party.country || '').trim().toUpperCase();
  const pincode = normalizeBillingPostalCode(country, addr.pincode);
  let stateCode = addr.stateCode ? String(addr.stateCode).trim() : null;

  if (!companyName) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'Business name is required.' };
  }
  if (!line1) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'Billing address is required.' };
  }
  if (!country || country.length !== 2) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'Country is required (ISO 2-letter code).' };
  }
  if (!state) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'State / province is required.' };
  }
  if (!city) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'City is required.' };
  }
  if (!pincode) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'Postal code is required.' };
  }
  if (!isValidBillingPostalCode(country, pincode)) {
    return {
      ok: false,
      code: 'BILLING_POSTAL_INVALID',
      message: 'Enter a valid postal / PIN code for the selected country.',
    };
  }
  if (!billingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
    return { ok: false, code: 'BILLING_DETAILS_REQUIRED', message: 'A valid billing email is required.' };
  }

  if (country === 'IN') {
    const fromName = indiaStateCodeFromName(state);
    if (fromName) {
      stateCode = fromName;
      state = GST_STATE_CODES[fromName];
    } else if (stateCode && isKnownGstStateCode(stateCode) && !EXCLUDED_GST_CODES.has(String(stateCode).padStart(2, '0'))) {
      const normalizedCode = String(stateCode).padStart(2, '0');
      stateCode = normalizedCode;
      state = GST_STATE_CODES[normalizedCode];
    } else {
      return {
        ok: false,
        code: 'BILLING_DETAILS_REQUIRED',
        message: 'Select a valid Indian state or union territory.',
      };
    }
  }

  if (gstRegistered) {
    const gst = validateGstin(gstin);
    if (!gst.ok) {
      return {
        ok: false,
        code: gstin ? 'GSTIN_INVALID' : 'GSTIN_REQUIRED',
        message: gstin
          ? (gst.error || 'Enter a valid 15-character GSTIN.')
          : 'GSTIN is required when the business is GST-registered.',
      };
    }
    // Prefer checksum-normalized GSTIN for persistence.
    return finalize(gst.normalized);
  }

  if (gstin) {
    const gst = validateGstin(gstin);
    if (!gst.ok) {
      return {
        ok: false,
        code: 'GSTIN_INVALID',
        message: gst.error || 'Enter a valid 15-character GSTIN.',
      };
    }
    return finalize(gst.normalized);
  }

  return finalize(null);

  function finalize(normalizedGstin) {
    const structured = {
      line1,
      city,
      state,
      pincode,
      country,
    };
    if (country === 'IN' && stateCode) {
      structured.stateCode = String(stateCode).padStart(2, '0');
    }

    return {
      ok: true,
      normalized: {
        companyName,
        gstRegistered,
        gstin: normalizedGstin,
        billingEmail,
        billingPhone: billingPhone || null,
        billingAddressStructured: structured,
      },
    };
  }
}

/**
 * Default ISO country from org settings (phone country or locale region).
 */
function defaultBillingCountryFromOrg(org) {
  const phone = String(org?.settings?.defaultPhoneCountry || '').trim().toUpperCase();
  if (phone.length === 2) return phone;
  const locale = String(org?.settings?.locale || '').trim();
  const region = locale.includes('-') ? locale.split('-').pop() : '';
  if (region && region.length === 2) return region.toUpperCase();
  if (String(org?.settings?.currency || '').toUpperCase() === 'INR') return 'IN';
  return 'IN';
}

module.exports = {
  validateCommercialBillingParty,
  defaultBillingCountryFromOrg,
  INDIA_BILLING_STATE_NAMES,
  indiaStateCodeFromName,
};
