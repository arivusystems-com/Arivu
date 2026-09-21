'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  getCommercialInvoicePdfConfig,
  formatInr,
  formatDateIn,
  statusLabel,
  resolveTaxLabel,
  DEFAULT_PAYMENT_INSTRUCTIONS,
} = require('../commercialInvoicePdfService');

describe('commercialInvoicePdfService helpers', () => {
  const envKeys = [
    'COMMERCIAL_SELLER_LEGAL_NAME',
    'COMMERCIAL_SELLER_GSTIN',
    'COMMERCIAL_SELLER_ADDRESS',
    'COMMERCIAL_SELLER_EMAIL',
    'COMMERCIAL_SELLER_PHONE',
    'COMMERCIAL_INVOICE_PAYMENT_INSTRUCTIONS',
    'COMMERCIAL_SELLER_BANK_DETAILS',
  ];
  const prev = {};

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  test('formatInr formats paise as INR', () => {
    assert.match(formatInr(400492), /4,004\.92/);
    assert.match(formatInr(0), /0\.00/);
  });

  test('formatDateIn returns en-IN date or null', () => {
    assert.equal(formatDateIn(null), null);
    assert.equal(formatDateIn('not-a-date'), null);
    assert.ok(formatDateIn(new Date('2026-09-19T12:00:00Z')));
  });

  test('statusLabel maps known statuses', () => {
    assert.equal(statusLabel('paid'), 'PAID');
    assert.equal(statusLabel('void'), 'VOID');
    assert.equal(statusLabel('past_due'), 'PAST DUE');
    assert.equal(statusLabel('finalized'), 'FINALIZED');
  });

  test('resolveTaxLabel uses taxDetails name and percent', () => {
    assert.equal(resolveTaxLabel({ taxDetails: null }), 'Tax');
    assert.equal(resolveTaxLabel({
      taxDetails: { name: 'GST', ratePercent: 18 },
    }), 'GST (18%)');
    assert.equal(resolveTaxLabel({
      taxDetails: { name: 'GST', rateBps: 1800 },
    }), 'GST (18%)');
  });

  test('getCommercialInvoicePdfConfig defaults and env overrides', () => {
    const defaults = getCommercialInvoicePdfConfig();
    assert.equal(defaults.legalName, 'Arivu');
    assert.equal(defaults.gstin, '');
    assert.equal(defaults.paymentInstructions, DEFAULT_PAYMENT_INSTRUCTIONS);

    process.env.COMMERCIAL_SELLER_LEGAL_NAME = 'Arivu Technologies Pvt Ltd';
    process.env.COMMERCIAL_SELLER_GSTIN = '29AAAAA0000A1Z5';
    process.env.COMMERCIAL_SELLER_ADDRESS = 'Bengaluru, IN';
    process.env.COMMERCIAL_SELLER_EMAIL = 'billing@arivu.example';
    process.env.COMMERCIAL_SELLER_PHONE = '+91 99999 99999';
    process.env.COMMERCIAL_INVOICE_PAYMENT_INSTRUCTIONS = 'Pay via Razorpay.';
    process.env.COMMERCIAL_SELLER_BANK_DETAILS = 'UPI: arivu@upi';

    const cfg = getCommercialInvoicePdfConfig();
    assert.equal(cfg.legalName, 'Arivu Technologies Pvt Ltd');
    assert.equal(cfg.gstin, '29AAAAA0000A1Z5');
    assert.equal(cfg.address, 'Bengaluru, IN');
    assert.equal(cfg.email, 'billing@arivu.example');
    assert.equal(cfg.phone, '+91 99999 99999');
    assert.equal(cfg.paymentInstructions, 'Pay via Razorpay.');
    assert.equal(cfg.bankDetails, 'UPI: arivu@upi');
  });
});
