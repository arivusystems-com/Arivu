'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mergePdfConfig,
} = require('../commercialInvoicePdfSettingsService');
const { DEFAULT_PAYMENT_INSTRUCTIONS } = require('../commercialInvoicePdfService');

describe('commercialInvoicePdfSettingsService mergePdfConfig', () => {
  test('uses env when stored empty', () => {
    const envCfg = {
      legalName: 'Env Co',
      gstin: 'ENVGSTIN',
      address: 'Env Addr',
      email: 'env@x.com',
      phone: '1',
      paymentInstructions: 'Pay env',
      bankDetails: 'Bank env',
    };
    const merged = mergePdfConfig({ legalName: '', gstin: '' }, envCfg);
    assert.equal(merged.legalName, 'Env Co');
    assert.equal(merged.gstin, 'ENVGSTIN');
    assert.equal(merged.paymentInstructions, 'Pay env');
  });

  test('DB non-empty fields override env', () => {
    const envCfg = {
      legalName: 'Env Co',
      gstin: 'ENVGSTIN',
      address: '',
      email: '',
      phone: '',
      paymentInstructions: DEFAULT_PAYMENT_INSTRUCTIONS,
      bankDetails: '',
    };
    const merged = mergePdfConfig({
      legalName: 'DB Legal',
      gstin: '29AAAAA0000A1Z5',
      paymentInstructions: 'Pay DB',
      bankDetails: 'UPI: db@upi',
    }, envCfg);
    assert.equal(merged.legalName, 'DB Legal');
    assert.equal(merged.gstin, '29AAAAA0000A1Z5');
    assert.equal(merged.paymentInstructions, 'Pay DB');
    assert.equal(merged.bankDetails, 'UPI: db@upi');
  });

  test('null stored returns env baseline', () => {
    const envCfg = {
      legalName: 'Arivu',
      gstin: '',
      address: '',
      email: '',
      phone: '',
      paymentInstructions: DEFAULT_PAYMENT_INSTRUCTIONS,
      bankDetails: '',
    };
    assert.deepEqual(mergePdfConfig(null, envCfg), envCfg);
  });
});
