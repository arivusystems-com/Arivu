'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pure decision helpers mirroring renewDueBillingPeriod guards
 * (kept local so unit tests do not need Mongo).
 */
function shouldAttemptRenewal(subscription, now = new Date()) {
  if (!subscription) return { ok: false, reason: 'missing' };
  if (subscription.metadata?.notBillable || subscription.metadata?.sandboxInternal) {
    return { ok: false, reason: 'not_billable' };
  }
  if (subscription.status !== 'active' && subscription.status !== 'past_due') {
    return { ok: false, reason: 'status' };
  }
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  if (!periodEnd || periodEnd > now) {
    return { ok: false, reason: 'period_not_ended' };
  }
  return { ok: true };
}

function shouldInvoiceNextPeriod(endingPeriodStart, advancedPeriodStart) {
  const a = endingPeriodStart ? new Date(endingPeriodStart).getTime() : null;
  const b = advancedPeriodStart ? new Date(advancedPeriodStart).getTime() : null;
  return a != null && b != null && a !== b;
}

describe('period renewal guards', () => {
  test('skips trialing and not-billable', () => {
    assert.equal(
      shouldAttemptRenewal({ status: 'trialing', currentPeriodEnd: new Date(0) }).ok,
      false
    );
    assert.equal(
      shouldAttemptRenewal({
        status: 'active',
        currentPeriodEnd: new Date(0),
        metadata: { notBillable: true },
      }).ok,
      false
    );
  });

  test('renews when active and period ended', () => {
    const now = new Date('2026-10-11T00:00:00.000Z');
    const result = shouldAttemptRenewal(
      {
        status: 'active',
        currentPeriodEnd: new Date('2026-10-10T00:00:00.000Z'),
      },
      now
    );
    assert.equal(result.ok, true);
  });

  test('does not double-bill next period if window did not move', () => {
    const start = new Date('2026-09-10T00:00:00.000Z');
    assert.equal(shouldInvoiceNextPeriod(start, start), false);
    assert.equal(
      shouldInvoiceNextPeriod(start, new Date('2026-10-10T00:00:00.000Z')),
      true
    );
  });
});
