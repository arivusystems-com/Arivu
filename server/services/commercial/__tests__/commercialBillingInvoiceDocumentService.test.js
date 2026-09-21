'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  minorToMajor,
  shouldUseContentTemplate,
} = require('../commercialBillingInvoiceDocumentService');

describe('commercialBillingInvoiceDocumentService helpers', () => {
  test('minorToMajor converts paise', () => {
    assert.equal(minorToMajor(400492), 4004.92);
    assert.equal(minorToMajor(0), 0);
  });

  test('shouldUseContentTemplate respects explicit legacy env', () => {
    const prev = process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
    process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE = 'legacy';
    try {
      const decision = shouldUseContentTemplate({
        templateId: '507f1f77bcf86cd799439011',
        templateOrganizationId: '507f1f77bcf86cd799439012',
        useContentTemplate: true,
      });
      assert.equal(decision.use, false);
    } finally {
      if (prev === undefined) delete process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
      else process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE = prev;
    }
  });

  test('shouldUseContentTemplate uses linked template when mode unset', () => {
    const prev = process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
    delete process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
    try {
      const decision = shouldUseContentTemplate({
        templateId: '507f1f77bcf86cd799439011',
        templateOrganizationId: '507f1f77bcf86cd799439012',
      });
      assert.equal(decision.use, true);
    } finally {
      if (prev === undefined) delete process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
      else process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE = prev;
    }
  });

  test('shouldUseContentTemplate skips when useContentTemplate false', () => {
    const prev = process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
    delete process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
    try {
      const decision = shouldUseContentTemplate({
        templateId: '507f1f77bcf86cd799439011',
        templateOrganizationId: '507f1f77bcf86cd799439012',
        useContentTemplate: false,
      });
      assert.equal(decision.use, false);
    } finally {
      if (prev === undefined) delete process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE;
      else process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE = prev;
    }
  });
});
