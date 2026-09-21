'use strict';

const { CURRENCY_INR } = require('../../constants/commercialBilling');

/**
 * Commercial tax calculation (catalog prices stay tax-exclusive).
 *
 * Env:
 * - COMMERCIAL_TAX_RATE_BPS: basis points (1800 = 18%)
 * - COMMERCIAL_TAX_NAME: label (default GST)
 * - COMMERCIAL_TAX_ENABLED: 'false' to force zero tax
 */

function getCommercialTaxConfig() {
  const enabled = String(process.env.COMMERCIAL_TAX_ENABLED || 'true').toLowerCase() !== 'false';
  const rateBps = Math.max(0, Number(process.env.COMMERCIAL_TAX_RATE_BPS || 1800));
  const name = String(process.env.COMMERCIAL_TAX_NAME || 'GST').trim() || 'GST';
  return {
    enabled,
    rateBps,
    ratePercent: rateBps / 100,
    name,
    currency: CURRENCY_INR,
  };
}

/**
 * @param {number} taxableMinor — amount after credits/discounts, before tax
 * @param {{ rateBps?: number, enabled?: boolean, name?: string } | null} [override]
 */
function calculateCommercialTax(taxableMinor, override = null) {
  const config = getCommercialTaxConfig();
  const enabled = override?.enabled != null ? Boolean(override.enabled) : config.enabled;
  const rateBps = override?.rateBps != null ? Math.max(0, Number(override.rateBps)) : config.rateBps;
  const name = override?.name || config.name;
  const base = Math.max(0, Math.round(Number(taxableMinor) || 0));

  if (!enabled || rateBps <= 0 || base <= 0) {
    return {
      taxMinor: 0,
      taxableMinor: base,
      rateBps: enabled ? rateBps : 0,
      name,
      taxDetails: {
        name,
        rateBps: enabled ? rateBps : 0,
        ratePercent: enabled ? rateBps / 100 : 0,
        taxableMinor: base,
        taxMinor: 0,
        inclusive: false,
      },
    };
  }

  const taxMinor = Math.round((base * rateBps) / 10000);
  return {
    taxMinor,
    taxableMinor: base,
    rateBps,
    name,
    taxDetails: {
      name,
      rateBps,
      ratePercent: rateBps / 100,
      taxableMinor: base,
      taxMinor,
      inclusive: false,
    },
  };
}

module.exports = {
  getCommercialTaxConfig,
  calculateCommercialTax,
};
