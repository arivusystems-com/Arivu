'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

describe('commercialAccessGate', () => {
  test('feature flag defaults to off', () => {
    const prev = process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT;
    delete process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT;
    // Re-require fresh
    delete require.cache[require.resolve('../commercialAccessGate')];
    const { isCommercialBillingEnforcementEnabled, evaluateCommercialAppAccess } = require('../commercialAccessGate');
    assert.equal(isCommercialBillingEnforcementEnabled(), false);

    return evaluateCommercialAppAccess({
      organizationId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      appKey: 'SALES',
    }).then((result) => {
      assert.equal(result.enforced, false);
      assert.equal(result.allowed, true);
      assert.equal(result.reason, 'FEATURE_DISABLED');
      if (prev === undefined) delete process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT;
      else process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT = prev;
      delete require.cache[require.resolve('../commercialAccessGate')];
    });
  });

  test('unmapped app keys soft-allow when enforcement on', async () => {
    const prev = process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT;
    process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT = 'true';
    delete require.cache[require.resolve('../commercialAccessGate')];
    const { evaluateCommercialAppAccess } = require('../commercialAccessGate');

    // Mock BillingSubscription to avoid DB — PROJECTS has no commercial product
    const result = await evaluateCommercialAppAccess({
      organizationId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      appKey: 'PROJECTS',
    });
    assert.equal(result.enforced, false);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'APP_NOT_IN_COMMERCIAL_CATALOG');

    if (prev === undefined) delete process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT;
    else process.env.FEATURE_COMMERCIAL_BILLING_ENFORCEMENT = prev;
    delete require.cache[require.resolve('../commercialAccessGate')];
  });
});
