'use strict';

const MAX_CONDITIONS = 3;

const SUPPORTED_MODULES = Object.freeze([
  'people',
  'organizations',
  'items',
  'deals',
  'tasks',
  'cases',
]);

/** Master records only — deals/tasks/cases are detect/warn/block, not mergeable. */
const MERGEABLE_MODULES = Object.freeze(['people', 'organizations', 'items']);

const MATCH_TYPES = Object.freeze(['exact', 'similar']);
const MATCH_LOGIC = Object.freeze(['AND', 'OR']);
const API_MATCH_POLICIES = Object.freeze(['attach', 'warn', 'reject']);

const MODULE_FIELD_OPTIONS = Object.freeze({
  people: [
    { field: 'email', label: 'Email', defaultMatchType: 'exact' },
    { field: 'phone', label: 'Phone', defaultMatchType: 'exact' },
    { field: 'name', label: 'Name', defaultMatchType: 'similar' },
  ],
  organizations: [
    { field: 'domain', label: 'Domain', defaultMatchType: 'exact' },
    { field: 'taxId', label: 'Tax ID', defaultMatchType: 'exact' },
    { field: 'name', label: 'Organization Name', defaultMatchType: 'exact' },
  ],
  items: [
    { field: 'item_code', label: 'Item Code', defaultMatchType: 'exact' },
    { field: 'sku', label: 'SKU', defaultMatchType: 'exact' },
    { field: 'item_name', label: 'Item Name', defaultMatchType: 'similar' },
  ],
  deals: [
    { field: 'name', label: 'Deal Name', defaultMatchType: 'exact' },
    { field: 'contactId', label: 'Contact', defaultMatchType: 'exact' },
  ],
  tasks: [
    { field: 'title', label: 'Title', defaultMatchType: 'exact' },
  ],
  cases: [
    { field: 'caseId', label: 'Case ID', defaultMatchType: 'exact' },
    { field: 'title', label: 'Title', defaultMatchType: 'exact' },
    { field: 'contactId', label: 'Contact', defaultMatchType: 'exact' },
    { field: 'requesterEmail', label: 'Requester Email', defaultMatchType: 'exact' },
  ],
});

const DEFAULT_CONFIGS = Object.freeze({
  people: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'email', matchType: 'exact' },
      { field: 'phone', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'attach',
  },
  organizations: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'domain', matchType: 'exact' },
      { field: 'taxId', matchType: 'exact' },
      { field: 'name', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'warn',
  },
  items: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'item_code', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'reject',
  },
  deals: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'name', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'warn',
  },
  tasks: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'title', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'warn',
  },
  cases: {
    enabled: true,
    matchLogic: 'OR',
    conditions: [
      { field: 'caseId', matchType: 'exact' },
    ],
    ignoreBlankValues: true,
    checkInactiveRecords: true,
    apiMatchPolicy: 'reject',
  },
});

function isMergeableModule(moduleKey) {
  return MERGEABLE_MODULES.includes(String(moduleKey || '').toLowerCase());
}

module.exports = {
  MAX_CONDITIONS,
  SUPPORTED_MODULES,
  MERGEABLE_MODULES,
  isMergeableModule,
  MATCH_TYPES,
  MATCH_LOGIC,
  API_MATCH_POLICIES,
  MODULE_FIELD_OPTIONS,
  DEFAULT_CONFIGS,
};
