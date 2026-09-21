'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateCommercialTax, getCommercialTaxConfig } = require('../taxService');

describe('taxService', () => {
  test('18% GST on taxable amount (default config when enabled)', () => {
    const prevEnabled = process.env.COMMERCIAL_TAX_ENABLED;
    const prevRate = process.env.COMMERCIAL_TAX_RATE_BPS;
    process.env.COMMERCIAL_TAX_ENABLED = 'true';
    process.env.COMMERCIAL_TAX_RATE_BPS = '1800';

    const result = calculateCommercialTax(100000); // ₹1000
    assert.equal(result.taxMinor, 18000);
    assert.equal(result.taxDetails.ratePercent, 18);
    assert.equal(result.taxDetails.name, 'GST');

    if (prevEnabled === undefined) delete process.env.COMMERCIAL_TAX_ENABLED;
    else process.env.COMMERCIAL_TAX_ENABLED = prevEnabled;
    if (prevRate === undefined) delete process.env.COMMERCIAL_TAX_RATE_BPS;
    else process.env.COMMERCIAL_TAX_RATE_BPS = prevRate;
  });

  test('disabled tax returns zero', () => {
    const result = calculateCommercialTax(100000, { enabled: false });
    assert.equal(result.taxMinor, 0);
  });

  test('getCommercialTaxConfig exposes ratePercent', () => {
    const cfg = getCommercialTaxConfig();
    assert.equal(typeof cfg.ratePercent, 'number');
    assert.equal(typeof cfg.enabled, 'boolean');
  });
});
