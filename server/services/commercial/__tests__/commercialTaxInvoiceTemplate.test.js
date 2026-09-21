'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { amountInWordsInr } = require('../../../utils/amountInWordsInr');
const {
  buildBillingInvoiceTemplateDefinition,
} = require('../../../constants/contentTemplateSeeds');
const {
  isGrapesTemplateDefinition,
  hasRenderableGrapesTemplateContent,
} = require('../../../constants/grapesTemplateDefinition');
const { assertValidTemplateDefinition } = require('../../contentPlatform/contentTemplateValidationService');

describe('amountInWordsInr', () => {
  test('formats sample tax invoice total', () => {
    assert.match(
      amountInWordsInr(42419.82),
      /Forty Two Thousand Four Hundred Nineteen and Eighty Two Paise Only/i
    );
  });

  test('handles zero', () => {
    assert.equal(amountInWordsInr(0), 'Indian Rupees Zero Only.');
  });
});

describe('commercial tax invoice seed', () => {
  test('is a renderable Grapes definition', () => {
    const def = buildBillingInvoiceTemplateDefinition();
    assertValidTemplateDefinition(def);
    assert.equal(isGrapesTemplateDefinition(def), true);
    assert.equal(hasRenderableGrapesTemplateContent(def), true);
    assert.match(def.html, /TAX INVOICE/);
    assert.match(def.html, /Payment Details/);
    assert.match(def.html, /data-line-item="true"/);
  });
});
