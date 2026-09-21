'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  FOUNDER_MONTHLY_PAISE,
  ANNUAL_MONTH_MULTIPLIER,
  PRODUCT_CODES,
  PLATFORM_INCLUDED_INTERNAL_USERS,
} = require('../../../constants/commercialBilling');
const {
  normalizePlatformUserType,
  PLATFORM_USER_TYPES,
  canAccessOrgSettingsByUserType,
} = require('../../../constants/platformUserTypes');

describe('commercialBilling constants', () => {
  test('Founder Admin and Standard seat prices (paise)', () => {
    assert.equal(FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.ADMIN_USER], 99900);
    assert.equal(FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.STANDARD_USER], 69900);
    assert.equal(FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.SALES], 19900);
    assert.equal(FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.HELPDESK], 14900);
    assert.equal(FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.PORTAL_USER], 19900);
  });

  test('annual is 10× monthly for Admin seat', () => {
    assert.equal(ANNUAL_MONTH_MULTIPLIER, 10);
    assert.equal(
      FOUNDER_MONTHLY_PAISE[PRODUCT_CODES.ADMIN_USER] * ANNUAL_MONTH_MULTIPLIER,
      999000
    );
  });

  test('no free included Admin seat', () => {
    assert.equal(PLATFORM_INCLUDED_INTERNAL_USERS, 0);
  });
});

describe('platformUserTypes', () => {
  test('legacy INTERNAL maps to STANDARD', () => {
    assert.equal(normalizePlatformUserType('INTERNAL'), PLATFORM_USER_TYPES.STANDARD);
  });

  test('Owner hint maps to ADMIN', () => {
    assert.equal(
      normalizePlatformUserType('INTERNAL', { isOwner: true }),
      PLATFORM_USER_TYPES.ADMIN
    );
  });

  test('Standard cannot access org settings', () => {
    assert.equal(
      canAccessOrgSettingsByUserType({ userType: 'STANDARD', isOwner: false }),
      false
    );
    assert.equal(
      canAccessOrgSettingsByUserType({ userType: 'ADMIN', isOwner: false }),
      true
    );
  });
});
