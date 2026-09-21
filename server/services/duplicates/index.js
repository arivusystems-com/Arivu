'use strict';

const { evaluateDuplicates } = require('./evaluate');
const {
  getConfig,
  upsertConfig,
  seedDefaultsForOrg,
  isSupportedModule,
  isMergeableModule,
  SUPPORTED_MODULES,
  MERGEABLE_MODULES,
  MODULE_FIELD_OPTIONS,
} = require('./configService');
const { mergeRecords, markNotDuplicate, getComparePayload } = require('./mergeService');
const { normalizeEmail, normalizePhone, normalizeFieldValue, getFieldRawValue } = require('./normalize');

module.exports = {
  evaluateDuplicates,
  getConfig,
  upsertConfig,
  seedDefaultsForOrg,
  isSupportedModule,
  isMergeableModule,
  SUPPORTED_MODULES,
  MERGEABLE_MODULES,
  MODULE_FIELD_OPTIONS,
  mergeRecords,
  markNotDuplicate,
  getComparePayload,
  normalizeEmail,
  normalizePhone,
  normalizeFieldValue,
  getFieldRawValue,
};
