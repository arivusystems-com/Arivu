/**
 * Billing country / subdivision catalogs for commercial bill-to forms.
 * Country list reuses phone-supported markets; India states from GST codes.
 */

import { PHONE_COUNTRIES } from '@/utils/phoneInput';

/** Exclude legacy/non-selectable GST jurisdictions from billing dropdowns. */
const EXCLUDED_GST_CODES = new Set(['28', '97', '99']);

/** GST state/UT codes → display name (billing-selectable). */
export const INDIA_STATE_BY_CODE = Object.freeze({
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
});

export const BILLING_COUNTRY_OPTIONS = Object.freeze(
  [...PHONE_COUNTRIES]
    .map((c) => ({ value: c.iso2, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

export const INDIA_STATE_OPTIONS = Object.freeze(
  Object.entries(INDIA_STATE_BY_CODE)
    .filter(([code]) => !EXCLUDED_GST_CODES.has(code))
    .map(([code, name]) => ({ value: name, label: name, stateCode: code }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

/**
 * @param {string|null|undefined} countryIso2
 * @returns {{ value: string, label: string, stateCode?: string }[]}
 */
export function getBillingStateOptions(countryIso2) {
  const iso = String(countryIso2 || '').trim().toUpperCase();
  if (iso === 'IN') return [...INDIA_STATE_OPTIONS];
  return [];
}

/**
 * @param {string|null|undefined} countryIso2
 */
export function billingStateUsesCatalog(countryIso2) {
  return getBillingStateOptions(countryIso2).length > 0;
}

/**
 * Resolve GST state code from a stored state name (India).
 * @param {string|null|undefined} stateName
 * @returns {string|null}
 */
export function indiaStateCodeFromName(stateName) {
  const needle = String(stateName || '').trim().toLowerCase();
  if (!needle) return null;
  for (const [code, name] of Object.entries(INDIA_STATE_BY_CODE)) {
    if (name.toLowerCase() === needle) return code;
  }
  return null;
}

/**
 * Major cities by Indian state/UT (billing suggestions; free text still allowed).
 * Keys match INDIA_STATE_BY_CODE display names.
 */
const INDIA_CITIES_BY_STATE = Object.freeze({
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada', 'Rajahmundry', 'Kurnool'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Tawang'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur'],
  Bihar: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia'],
  Chandigarh: ['Chandigarh'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Korba'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  Delhi: ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Jamnagar'],
  Haryana: ['Gurugram', 'Faridabad', 'Chandigarh', 'Panipat', 'Ambala', 'Hisar'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar'],
  Karnataka: [
    'Bengaluru',
    'Bangalore',
    'Mysuru',
    'Mysore',
    'Mangaluru',
    'Mangalore',
    'Hubballi',
    'Belagavi',
    'Kalaburagi',
    'Ballari',
    'Udupi',
    'Shivamogga',
  ],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Navi Mumbai', 'Kolhapur'],
  Manipur: ['Imphal'],
  Meghalaya: ['Shillong', 'Tura'],
  Mizoram: ['Aizawl'],
  Nagaland: ['Kohima', 'Dimapur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur'],
  Puducherry: ['Puducherry', 'Pondicherry', 'Karaikal', 'Mahe', 'Yanam'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala', 'Bathinda'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
  Sikkim: ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  Tripura: ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Noida', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Rishikesh', 'Haldwani', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
});

/**
 * City suggestions for billing (country + state scoped). Empty → free text only.
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} stateName
 * @returns {string[]}
 */
export function getBillingCitySuggestions(countryIso2, stateName) {
  const iso = String(countryIso2 || '').trim().toUpperCase();
  if (iso !== 'IN') return [];
  const state = String(stateName || '').trim();
  if (!state) return [];
  const list = INDIA_CITIES_BY_STATE[state];
  return list ? [...list] : [];
}

/**
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} stateName
 */
export function billingCityHasSuggestions(countryIso2, stateName) {
  return getBillingCitySuggestions(countryIso2, stateName).length > 0;
}

/** Country-specific postal / PIN patterns (billing markets). */
const POSTAL_RULES = Object.freeze({
  IN: { pattern: /^[1-9][0-9]{5}$/, example: '560001', inputMode: 'numeric' },
  US: { pattern: /^\d{5}(-\d{4})?$/, example: '94107', inputMode: 'text' },
  CA: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, example: 'M5V 2T6', inputMode: 'text' },
  GB: { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, example: 'SW1A 1AA', inputMode: 'text' },
  AU: { pattern: /^\d{4}$/, example: '2000', inputMode: 'numeric' },
  NZ: { pattern: /^\d{4}$/, example: '6011', inputMode: 'numeric' },
  SG: { pattern: /^\d{6}$/, example: '018956', inputMode: 'numeric' },
  AE: { pattern: /^\d{5}$/, example: '00000', inputMode: 'numeric' },
  DE: { pattern: /^\d{5}$/, example: '10115', inputMode: 'numeric' },
  FR: { pattern: /^\d{5}$/, example: '75001', inputMode: 'numeric' },
  IT: { pattern: /^\d{5}$/, example: '00118', inputMode: 'numeric' },
  ES: { pattern: /^\d{5}$/, example: '28001', inputMode: 'numeric' },
  NL: { pattern: /^\d{4}\s?[A-Za-z]{2}$/, example: '1012 AB', inputMode: 'text' },
  SE: { pattern: /^\d{3}\s?\d{2}$/, example: '111 22', inputMode: 'text' },
  CH: { pattern: /^\d{4}$/, example: '8001', inputMode: 'numeric' },
  JP: { pattern: /^\d{3}-?\d{4}$/, example: '100-0001', inputMode: 'text' },
  KR: { pattern: /^\d{5}$/, example: '06236', inputMode: 'numeric' },
  CN: { pattern: /^\d{6}$/, example: '100000', inputMode: 'numeric' },
  BR: { pattern: /^\d{5}-?\d{3}$/, example: '01310-100', inputMode: 'text' },
  MX: { pattern: /^\d{5}$/, example: '01000', inputMode: 'numeric' },
  ZA: { pattern: /^\d{4}$/, example: '8001', inputMode: 'numeric' },
  NG: { pattern: /^\d{6}$/, example: '100001', inputMode: 'numeric' },
  KE: { pattern: /^\d{5}$/, example: '00100', inputMode: 'numeric' },
  SA: { pattern: /^\d{5}(-\d{4})?$/, example: '11564', inputMode: 'text' },
  PK: { pattern: /^\d{5}$/, example: '44000', inputMode: 'numeric' },
  BD: { pattern: /^\d{4}$/, example: '1000', inputMode: 'numeric' },
});

const FALLBACK_POSTAL = Object.freeze({
  pattern: /^[A-Za-z0-9][A-Za-z0-9 \-]{1,11}$/,
  example: '',
  inputMode: 'text',
});

/**
 * @param {string|null|undefined} countryIso2
 */
export function getBillingPostalRule(countryIso2) {
  const iso = String(countryIso2 || '').trim().toUpperCase();
  return POSTAL_RULES[iso] || FALLBACK_POSTAL;
}

/**
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} value
 */
export function isValidBillingPostalCode(countryIso2, value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return getBillingPostalRule(countryIso2).pattern.test(raw);
}

/**
 * Light normalize for storage (trim; uppercase alphanumeric postcodes where usual).
 * @param {string|null|undefined} countryIso2
 * @param {string|null|undefined} value
 */
export function normalizeBillingPostalCode(countryIso2, value) {
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
