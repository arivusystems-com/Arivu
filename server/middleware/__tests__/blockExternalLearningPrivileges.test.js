'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  blockExternalLearningPrivileges,
} = require('../blockExternalLearningPrivileges');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('blockExternalLearningPrivileges', () => {
  test('allows internal authors through', () => {
    const req = {
      user: { userType: 'STANDARD', appAccess: [{ appKey: 'LMS', roleKey: 'AUTHOR', status: 'ACTIVE' }] },
      method: 'POST',
      path: '/courses',
    };
    const res = mockRes();
    let nextCalled = false;
    blockExternalLearningPrivileges(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  test('blocks EXTERNAL from analytics', () => {
    const req = {
      user: { userType: 'EXTERNAL', appAccess: [{ appKey: 'LMS', roleKey: 'LEARNER', status: 'ACTIVE' }] },
      method: 'GET',
      path: '/analytics',
    };
    const res = mockRes();
    blockExternalLearningPrivileges(req, res, () => {
      assert.fail('should not next');
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'ACADEMY_FORBIDDEN');
  });

  test('blocks EXTERNAL from creating courses', () => {
    const req = {
      user: { userType: 'EXTERNAL', appAccess: [{ appKey: 'LMS', roleKey: 'LEARNER', status: 'ACTIVE' }] },
      method: 'POST',
      path: '/courses',
    };
    const res = mockRes();
    blockExternalLearningPrivileges(req, res, () => {
      assert.fail('should not next');
    });
    assert.equal(res.statusCode, 403);
  });

  test('allows EXTERNAL enroll', () => {
    const req = {
      user: { userType: 'EXTERNAL', appAccess: [{ appKey: 'LMS', roleKey: 'LEARNER', status: 'ACTIVE' }] },
      method: 'POST',
      path: '/courses/507f1f77bcf86cd799439011/enroll',
    };
    const res = mockRes();
    let nextCalled = false;
    blockExternalLearningPrivileges(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});
