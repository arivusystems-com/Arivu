import { getApiUrlForFetch } from '@/config/apiBase';

/**
 * Public commercial pricing API (no auth).
 * Prices come from BillingPrice catalog — never hardcode invoice amounts in UI.
 */

async function parseJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body.data ?? body;
}

export async function fetchBillingCatalog() {
  const res = await fetch(getApiUrlForFetch('/api/billing/catalog'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJson(res);
}

export async function fetchFounderStatus() {
  const res = await fetch(getApiUrlForFetch('/api/billing/founder-status'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJson(res);
}

/**
 * @param {{
 *   billingPeriod?: 'monthly'|'annual',
 *   adminUsers?: number,
 *   standardUsers?: number,
 *   internalUsers?: number,
 *   portalUsers?: number,
 *   applications?: Array<{ productCode: string, users: number }>,
 * }} input
 */
export async function estimateCommercialQuote(input) {
  const res = await fetch(getApiUrlForFetch('/api/billing/estimate'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input || {}),
  });
  return parseJson(res);
}

/** Display helper: paise → ₹ string (en-IN). */
export function formatInrFromPaise(amountMinor) {
  const rupees = Math.round(Number(amountMinor || 0) / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/** Must match server `ANNUAL_MONTH_MULTIPLIER` (annual = 10× monthly). */
export const ANNUAL_MONTH_MULTIPLIER = 10;
