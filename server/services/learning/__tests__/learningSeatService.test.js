'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyAudienceFromHints,
  mapOrgTypeToAudience,
  mapRoleKeyToAudience,
} = require('../learningAudienceService');
const {
  userHasLearningAccess,
} = require('../learningSeatService');
const {
  normalizeAcademyConfig,
  defaultAcademyConfig,
} = require('../learningAcademyConfigService');
const {
  LEARNING_AUDIENCES,
} = require('../../../constants/learningConstants');

describe('LearningAudienceService', () => {
  test('internal users map to internal', () => {
    assert.equal(
      classifyAudienceFromHints({ userType: 'STANDARD' }),
      LEARNING_AUDIENCES.INTERNAL
    );
  });

  test('role name Customer → customer', () => {
    assert.equal(mapRoleKeyToAudience('Customer Portal'), LEARNING_AUDIENCES.CUSTOMER);
    assert.equal(mapOrgTypeToAudience('PARTNER'), LEARNING_AUDIENCES.PARTNER);
  });

  test('unknown external → external', () => {
    assert.equal(
      classifyAudienceFromHints({ userType: 'EXTERNAL' }),
      LEARNING_AUDIENCES.EXTERNAL
    );
  });
});

describe('LearningSeatService helpers', () => {
  test('userHasLearningAccess requires ACTIVE LMS appAccess', () => {
    assert.equal(
      userHasLearningAccess({
        status: 'active',
        appAccess: [{ appKey: 'LMS', status: 'ACTIVE' }],
      }),
      true
    );
    assert.equal(
      userHasLearningAccess({
        status: 'active',
        appAccess: [{ appKey: 'SALES', status: 'ACTIVE' }],
      }),
      false
    );
    assert.equal(
      userHasLearningAccess({
        status: 'archived',
        appAccess: [{ appKey: 'LMS', status: 'ACTIVE' }],
      }),
      false
    );
  });
});

describe('LearningAcademyConfigService', () => {
  test('normalize fills defaults', () => {
    const cfg = normalizeAcademyConfig({});
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.catalogVisibility, 'assigned');
    assert.deepEqual(cfg.allowedAudiences, defaultAcademyConfig().allowedAudiences);
  });
});
