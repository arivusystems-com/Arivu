'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

describe('dunning overdue selection', () => {
  function isOverdue({ status, dueAt, amountPaidMinor, totalMinor }, at, graceDays = 0) {
    if (status !== 'finalized') return false;
    if (!dueAt) return false;
    const paid = Math.max(0, Number(amountPaidMinor) || 0);
    if (paid >= totalMinor) return false;
    const cutoff = new Date(at);
    if (graceDays > 0) cutoff.setDate(cutoff.getDate() - graceDays);
    return new Date(dueAt) <= cutoff;
  }

  test('marks finalized unpaid after dueAt', () => {
    const at = new Date('2026-10-11T00:00:00.000Z');
    assert.equal(
      isOverdue({
        status: 'finalized',
        dueAt: new Date('2026-10-10T00:00:00.000Z'),
        amountPaidMinor: 0,
        totalMinor: 1000,
      }, at),
      true
    );
  });

  test('respects grace days', () => {
    const at = new Date('2026-10-11T00:00:00.000Z');
    assert.equal(
      isOverdue({
        status: 'finalized',
        dueAt: new Date('2026-10-10T00:00:00.000Z'),
        amountPaidMinor: 0,
        totalMinor: 1000,
      }, at, 3),
      false
    );
  });

  test('skips fully paid', () => {
    const at = new Date('2026-10-11T00:00:00.000Z');
    assert.equal(
      isOverdue({
        status: 'finalized',
        dueAt: new Date('2026-10-10T00:00:00.000Z'),
        amountPaidMinor: 1000,
        totalMinor: 1000,
      }, at),
      false
    );
  });
});
