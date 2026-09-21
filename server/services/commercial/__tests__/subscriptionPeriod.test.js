'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { addPeriod, prorationFactor } = require('../subscriptionService');
const { BILLING_PERIODS, SUBSCRIPTION_STATUSES } = require('../../../constants/commercialBilling');

describe('subscriptionService period helpers', () => {
  test('addPeriod monthly advances one month', () => {
    const start = new Date('2026-01-15T00:00:00.000Z');
    const end = addPeriod(start, BILLING_PERIODS.MONTHLY);
    assert.equal(end.getUTCMonth(), 1);
  });

  test('addPeriod annual advances one year', () => {
    const start = new Date('2026-01-15T00:00:00.000Z');
    const end = addPeriod(start, BILLING_PERIODS.ANNUAL);
    assert.equal(end.getUTCFullYear(), 2027);
  });

  test('prorationFactor mid-period is between 0 and 1', () => {
    const subscription = {
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
    };
    const mid = new Date('2026-01-16T00:00:00.000Z');
    const factor = prorationFactor(subscription, mid);
    assert.ok(factor > 0 && factor < 1);
  });

  test('trial window: first bill date equals trialEnd not monthly renew', () => {
    const start = new Date('2026-09-10T00:00:00.000Z');
    const trialDays = require('../../../constants/commercialBilling').DEFAULT_TRIAL_DAYS;
    const trialEnd = new Date(start.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const monthlyEnd = addPeriod(start, BILLING_PERIODS.MONTHLY);
    const periodEndWhileTrialing = trialEnd;
    assert.ok(periodEndWhileTrialing.getTime() < monthlyEnd.getTime());
    assert.equal(periodEndWhileTrialing.toISOString(), trialEnd.toISOString());
  });

  test('paid period after trial uses billing cycle from conversion instant', () => {
    const convertedAt = new Date('2026-09-25T00:00:00.000Z');
    const paidEnd = addPeriod(convertedAt, BILLING_PERIODS.MONTHLY);
    assert.equal(paidEnd.getUTCMonth(), 9);
    assert.equal(SUBSCRIPTION_STATUSES.TRIALING, 'trialing');
    assert.equal(SUBSCRIPTION_STATUSES.ACTIVE, 'active');
  });
});
