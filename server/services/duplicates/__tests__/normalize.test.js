'use strict';

/**
 * Unit tests for duplicate normalize + config sanitize (no DB).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEmail,
  normalizePhone,
  normalizeDomain,
  normalizeText,
  valuesExactMatch,
  valuesSimilarMatch,
  getFieldRawValue,
  normalizeFieldValue,
} = require('../normalize');
const { sanitizeConfig, DEFAULT_CONFIGS } = require('../configService');
const { isMergeableModule, MERGEABLE_MODULES, SUPPORTED_MODULES } = require('../constants');

describe('duplicates/normalize', () => {
  test('normalizeEmail lowercases', () => {
    assert.equal(normalizeEmail('John@ABC.com'), 'john@abc.com');
  });

  test('normalizePhone strips to last 10', () => {
    assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
  });

  test('normalizeDomain strips protocol/www', () => {
    assert.equal(normalizeDomain('https://www.Example.com/path'), 'example.com');
  });

  test('normalizeText strips org suffixes', () => {
    assert.ok(normalizeText('ABC Technologies Pvt. Ltd.').includes('abc technologies'));
  });

  test('similar match via equality / tokens, not substring', () => {
    assert.equal(valuesSimilarMatch(normalizeText('qwerty.'), normalizeText('qwerty')), true);
    assert.equal(valuesSimilarMatch(normalizeText('John Smith'), normalizeText('Jon Smith')), true);
    assert.equal(valuesSimilarMatch(normalizeText('Acme'), normalizeText('Acme Global Holdings')), true);
    assert.equal(valuesSimilarMatch(normalizeText('tech'), normalizeText('techcorp industries')), false);
    assert.equal(valuesSimilarMatch(normalizeText('soft'), normalizeText('microsoft')), false);
    assert.equal(valuesExactMatch('a', 'b'), false);
  });
});

describe('duplicates/configService.sanitizeConfig', () => {
  test('enforces max 3 conditions', () => {
    const cfg = sanitizeConfig('people', {
      conditions: [
        { field: 'email', matchType: 'exact' },
        { field: 'phone', matchType: 'exact' },
        { field: 'name', matchType: 'similar' },
        { field: 'email', matchType: 'exact' },
      ],
    });
    assert.ok(cfg.conditions.length <= 3);
  });

  test('defaults people', () => {
    const cfg = sanitizeConfig('people', {});
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.matchLogic, DEFAULT_CONFIGS.people.matchLogic);
  });

  test('defaults deals/tasks/cases', () => {
    assert.equal(sanitizeConfig('deals', {}).conditions[0].field, 'name');
    assert.equal(sanitizeConfig('tasks', {}).conditions[0].field, 'title');
    assert.equal(sanitizeConfig('cases', {}).conditions[0].field, 'caseId');
    assert.equal(sanitizeConfig('cases', {}).apiMatchPolicy, 'reject');
  });

  test('rejects unsupported module', () => {
    assert.throws(() => sanitizeConfig('events', {}), /Unsupported/);
  });
});

describe('duplicates/normalize deals tasks cases', () => {
  test('deal name + contactId', () => {
    assert.equal(getFieldRawValue('deals', 'name', { name: 'Acme Expansion' }), 'Acme Expansion');
    assert.ok(String(normalizeFieldValue('deals', 'name', 'Acme Expansion')).includes('acme'));
    assert.equal(normalizeFieldValue('deals', 'contactId', '507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
  });

  test('task title', () => {
    assert.equal(getFieldRawValue('tasks', 'title', { title: 'Follow up' }), 'Follow up');
    assert.equal(normalizeFieldValue('tasks', 'title', 'Follow up'), 'follow up');
  });

  test('case fields', () => {
    assert.equal(getFieldRawValue('cases', 'caseId', { caseId: 'CASE-1' }), 'CASE-1');
    assert.equal(normalizeFieldValue('cases', 'caseId', 'CASE-1'), 'case-1');
    assert.equal(normalizeFieldValue('cases', 'requesterEmail', 'A@B.com'), 'a@b.com');
  });
});

describe('duplicates/MERGEABLE_MODULES', () => {
  test('merge only for master records', () => {
    assert.deepEqual([...MERGEABLE_MODULES], ['people', 'organizations', 'items']);
    assert.equal(isMergeableModule('people'), true);
    assert.equal(isMergeableModule('deals'), false);
    assert.equal(isMergeableModule('tasks'), false);
    assert.equal(isMergeableModule('cases'), false);
    assert.ok(SUPPORTED_MODULES.includes('deals'));
    assert.ok(SUPPORTED_MODULES.includes('tasks'));
    assert.ok(SUPPORTED_MODULES.includes('cases'));
  });
});
