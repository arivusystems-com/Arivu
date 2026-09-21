'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

function shouldIssueProration({ status, notBillable, amountMinor }) {
  if (amountMinor <= 0) return { ok: false, reason: 'zero_amount' };
  if (notBillable) return { ok: false, reason: 'not_billable' };
  if (status === 'trialing') return { ok: false, reason: 'trialing' };
  if (status !== 'active' && status !== 'past_due') return { ok: false, reason: 'status' };
  return { ok: true };
}

function proratedAmount(listMinor, factor) {
  return Math.round(Number(listMinor) * Math.min(1, Math.max(0, Number(factor) || 0)));
}

describe('mid-cycle proration invoice rules', () => {
  test('charges remaining fraction of list price', () => {
    assert.equal(proratedAmount(99900, 0.5), 49950);
    assert.equal(proratedAmount(69900, 1), 69900);
    assert.equal(proratedAmount(19900, 0), 0);
  });

  test('skips trial and zero amounts', () => {
    assert.equal(
      shouldIssueProration({ status: 'trialing', notBillable: false, amountMinor: 100 }).ok,
      false
    );
    assert.equal(
      shouldIssueProration({ status: 'active', notBillable: false, amountMinor: 0 }).ok,
      false
    );
    assert.equal(
      shouldIssueProration({ status: 'active', notBillable: false, amountMinor: 100 }).ok,
      true
    );
  });
});
