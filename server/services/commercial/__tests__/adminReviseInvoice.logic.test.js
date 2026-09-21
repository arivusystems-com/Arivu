'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeRevisedInvoiceTotals,
} = require('../adminInvoiceAdjustmentService');
const { BILLING_EVENT_TYPES } = require('../../../constants/commercialBilling');

describe('adminReviseUnpaidInvoice math', () => {
  test('applies line then invoice discount before tax', () => {
    const result = computeRevisedInvoiceTotals({
      lines: [
        { _id: 'a', quantity: 2, unitAmountMinor: 10000, discountMinor: 1000 },
        { _id: 'b', quantity: 1, unitAmountMinor: 5000, discountMinor: 0 },
      ],
      invoiceDiscountMinor: 2000,
      creditAppliedMinor: 0,
      taxOverride: { enabled: true, rateBps: 1800 },
    });
    // line a: 20000-1000=19000; line b: 5000; subtotal 24000; header -2000 → 22000
    assert.equal(result.subtotalMinor, 24000);
    assert.equal(result.discountMinor, 2000);
    assert.equal(result.lines[0].amountMinor, 19000);
    assert.equal(result.taxMinor, Math.round((22000 * 1800) / 10000));
    assert.equal(result.totalMinor, 22000 + result.taxMinor);
  });

  test('caps line discount at gross and header discount at subtotal', () => {
    const result = computeRevisedInvoiceTotals({
      lines: [{ _id: 'a', quantity: 1, unitAmountMinor: 1000, discountMinor: 99999 }],
      invoiceDiscountMinor: 99999,
      creditAppliedMinor: 0,
      taxOverride: { enabled: false },
    });
    assert.equal(result.lines[0].discountMinor, 1000);
    assert.equal(result.lines[0].amountMinor, 0);
    assert.equal(result.subtotalMinor, 0);
    assert.equal(result.discountMinor, 0);
    assert.equal(result.totalMinor, 0);
  });

  test('caps existing credit to remaining after discounts', () => {
    const result = computeRevisedInvoiceTotals({
      lines: [{ _id: 'a', quantity: 1, unitAmountMinor: 10000, discountMinor: 2000 }],
      invoiceDiscountMinor: 3000,
      creditAppliedMinor: 9000,
      taxOverride: { enabled: false },
    });
    // subtotal 8000 − header 3000 = 5000 taxable base before credit → credit capped at 5000
    assert.equal(result.subtotalMinor, 8000);
    assert.equal(result.discountMinor, 3000);
    assert.equal(result.creditAppliedMinor, 5000);
    assert.equal(result.totalMinor, 0);
  });
});

describe('OPS_INVOICE_REVISED event type', () => {
  test('is defined', () => {
    assert.equal(BILLING_EVENT_TYPES.OPS_INVOICE_REVISED, 'OPS_INVOICE_REVISED');
  });
});
