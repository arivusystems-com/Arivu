'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  LEARNING_PLANS,
  LEARNING_PRIMARY_PLAN_KEY,
  PRICING_MODELS,
  CAPACITY_UNITS,
  PRODUCT_CODES,
} = require('../../../constants/commercialBilling');

describe('Learning commercial constants', () => {
  test('TIERED_CAPACITY and LEARNER_SEAT exist', () => {
    assert.equal(PRICING_MODELS.TIERED_CAPACITY, 'tiered_capacity');
    assert.equal(CAPACITY_UNITS.LEARNER_SEAT, 'LEARNER_SEAT');
    assert.equal(PRODUCT_CODES.LEARNING, 'learning_app');
  });

  test('Growth is primary plan with 200 seats / ₹5999', () => {
    assert.equal(LEARNING_PRIMARY_PLAN_KEY, 'growth');
    assert.equal(LEARNING_PLANS.growth.capacity, 200);
    assert.equal(LEARNING_PLANS.growth.monthlyPaise, 599900);
    assert.equal(LEARNING_PLANS.starter.capacity, 50);
    assert.equal(LEARNING_PLANS.business.capacity, 500);
  });
});
