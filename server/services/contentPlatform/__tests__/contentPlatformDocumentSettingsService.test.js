'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  assertSupportedModuleKey,
  formatTemplateOption,
  SUPPORTED_MODULE_KEYS
} = require('../contentPlatformDocumentSettingsService');
const { ContentPlatformError } = require('../../../utils/contentPlatformErrors');

describe('contentPlatformDocumentSettingsService', () => {
  it('supports tenant document modules (excludes platform billing_invoices)', () => {
    assert.ok(SUPPORTED_MODULE_KEYS.has('invoices'));
    assert.ok(SUPPORTED_MODULE_KEYS.has('quotes'));
    assert.equal(SUPPORTED_MODULE_KEYS.has('billing_invoices'), false);
  });

  it('normalizes supported module keys', () => {
    assert.equal(assertSupportedModuleKey('QUOTES'), 'quotes');
    assert.equal(assertSupportedModuleKey('invoices'), 'invoices');
  });

  it('rejects unsupported module keys', () => {
    assert.throws(
      () => assertSupportedModuleKey('deals'),
      (error) => error instanceof ContentPlatformError && error.statusCode === 400
    );
  });

  it('formats template options for settings UI', () => {
    const option = formatTemplateOption({
      _id: '507f1f77bcf86cd799439011',
      name: 'Quote Default',
      status: 'published',
      latestPublishedVersion: 2,
      isDefault: true
    });
    assert.equal(option.id, '507f1f77bcf86cd799439011');
    assert.equal(option.name, 'Quote Default');
    assert.equal(option.latestPublishedVersion, 2);
    assert.equal(option.isDefault, true);
  });
});
