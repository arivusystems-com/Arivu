const People = require('../../models/People');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const Organization = require('../../models/Organization');
const {
  DUPLICATE_CHECK_OR_CHUNK,
  DUPLICATE_CHECK_IN_CHUNK,
  DUPLICATE_CHECK_MAX_SAMPLES,
} = require('./importConstants');

const DUPLICATE_CHECK_UI_SAMPLES = Math.min(DUPLICATE_CHECK_MAX_SAMPLES, 10);

const COMPOSITE_CHECK_FIELDS = new Set([
  'full_name',
  'email_company',
  'phone_company',
  'name_amount',
  'name_stage',
]);

function mapCsvField(row, fieldMapping, targetField) {
  for (const [csvField, mappedField] of Object.entries(fieldMapping)) {
    if (mappedField === targetField && row[csvField] != null && String(row[csvField]).trim() !== '') {
      return String(row[csvField]).trim();
    }
  }
  return null;
}

function normalizeQueryValue(module, fieldKey, rawValue) {
  if (rawValue == null || rawValue === '') return null;

  if (module === 'deals' && fieldKey === 'amount') {
    const amount = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, ''));
    return Number.isNaN(amount) ? null : amount;
  }

  if ((module === 'deals' && fieldKey === 'expectedCloseDate')
    || (module === 'tasks' && fieldKey === 'dueDate')) {
    const date = new Date(rawValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (module === 'contacts' && fieldKey === 'email') {
    return String(rawValue).toLowerCase();
  }

  return String(rawValue).trim();
}

function applyQueryField(query, module, fieldKey, rawValue, matchedFields) {
  const value = normalizeQueryValue(module, fieldKey, rawValue);
  if (value == null || value === '') return false;
  query[fieldKey] = value;
  matchedFields.push({ field: fieldKey, value: String(value) });
  return true;
}

function buildContactsDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'full_name') {
      const firstName = mapCsvField(row, fieldMapping, 'first_name');
      const lastName = mapCsvField(row, fieldMapping, 'last_name');
      if (firstName && lastName) {
        query.first_name = firstName;
        query.last_name = lastName;
        matchedFields.push({ field: 'full_name', value: `${firstName} ${lastName}` });
      } else {
        canCheck = false;
      }
    } else if (checkField === 'email_company') {
      const email = mapCsvField(row, fieldMapping, 'email');
      const company = mapCsvField(row, fieldMapping, 'company');
      if (email && company) {
        query.email = email.toLowerCase();
        query.company = company;
        matchedFields.push({ field: 'email + company', value: `${email} @ ${company}` });
      } else {
        canCheck = false;
      }
    } else if (checkField === 'phone_company') {
      const phone = mapCsvField(row, fieldMapping, 'phone');
      const company = mapCsvField(row, fieldMapping, 'company');
      if (phone && company) {
        query.phone = phone;
        query.company = company;
        matchedFields.push({ field: 'phone + company', value: `${phone} @ ${company}` });
      } else {
        canCheck = false;
      }
    } else {
      const raw = mapCsvField(row, fieldMapping, checkField);
      if (!applyQueryField(query, 'contacts', checkField, raw, matchedFields)) {
        canCheck = false;
      }
    }
  }

  return { query, matchedFields, canCheck };
}

function buildDealsDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'name_amount') {
      const name = mapCsvField(row, fieldMapping, 'name');
      const amountRaw = mapCsvField(row, fieldMapping, 'amount');
      const amount = normalizeQueryValue('deals', 'amount', amountRaw);
      if (name && amount != null) {
        query.name = name;
        query.amount = amount;
        matchedFields.push({ field: 'name + amount', value: `${name} ($${amount})` });
      } else {
        canCheck = false;
      }
    } else if (checkField === 'name_stage') {
      const name = mapCsvField(row, fieldMapping, 'name');
      const stage = mapCsvField(row, fieldMapping, 'stage');
      if (name && stage) {
        query.name = name;
        query.stage = stage;
        matchedFields.push({ field: 'name + stage', value: `${name} (${stage})` });
      } else {
        canCheck = false;
      }
    } else {
      const raw = mapCsvField(row, fieldMapping, checkField);
      if (!applyQueryField(query, 'deals', checkField, raw, matchedFields)) {
        canCheck = false;
      }
    }
  }

  return { query, matchedFields, canCheck };
}

function buildTasksDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    const raw = mapCsvField(row, fieldMapping, checkField);
    if (!applyQueryField(query, 'tasks', checkField, raw, matchedFields)) {
      canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

function buildOrganizationsDuplicateQuery(row, fieldMapping, checkFields, organizationId, crmBaseQuery) {
  const query = { ...crmBaseQuery };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    const raw = mapCsvField(row, fieldMapping, checkField);
    if (!applyQueryField(query, 'organizations', checkField, raw, matchedFields)) {
      canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

const MODULE_HANDLERS = {
  contacts: {
    Model: People,
    defaultCheckFields: ['email'],
    buildQuery: buildContactsDuplicateQuery,
  },
  deals: {
    Model: Deal,
    defaultCheckFields: ['name'],
    buildQuery: buildDealsDuplicateQuery,
  },
  tasks: {
    Model: Task,
    defaultCheckFields: ['title'],
    buildQuery: buildTasksDuplicateQuery,
  },
  organizations: {
    Model: Organization,
    defaultCheckFields: ['name'],
    buildQuery: buildOrganizationsDuplicateQuery,
  },
};

function resolveCheckFields(handler, checkFields) {
  return Array.isArray(checkFields) && checkFields.length > 0
    ? checkFields
    : handler.defaultCheckFields;
}

function buildImportDuplicateLookup({
  module,
  row,
  fieldMapping,
  checkFields,
  organizationId,
  crmBaseQuery = null,
}) {
  const handler = MODULE_HANDLERS[module];
  if (!handler) return { canCheck: false };

  const fields = resolveCheckFields(handler, checkFields);
  const buildArgs = module === 'organizations'
    ? [row, fieldMapping, fields, organizationId, crmBaseQuery]
    : [row, fieldMapping, fields, organizationId];

  const { query, matchedFields, canCheck } = handler.buildQuery(...buildArgs);
  if (!canCheck || matchedFields.length === 0) {
    return { canCheck: false };
  }

  return {
    canCheck: true,
    query,
    key: serializeDuplicateKey(query),
    matchedFields,
  };
}

function formatMatchedFields(matchedFields) {
  return {
    matchedField: matchedFields.map((f) => f.field).join(' AND '),
    matchedValue: matchedFields.map((f) => f.value).join(', '),
  };
}

function serializeDuplicateKey(query) {
  const keys = Object.keys(query)
    .filter((k) => k !== 'organizationId')
    .sort();
  return keys.map((k) => {
    const value = query[k];
    if (value instanceof Date) return `${k}:${value.getTime()}`;
    return `${k}:${JSON.stringify(value)}`;
  }).join('|');
}

function documentMatchesQuery(doc, query, module) {
  for (const [fieldKey, expected] of Object.entries(query)) {
    if (fieldKey === 'organizationId') continue;
    if (expected != null && typeof expected === 'object' && !(expected instanceof Date)) {
      if (fieldKey === 'createdBy' && Array.isArray(expected.$in)) {
        const docId = doc.createdBy != null ? String(doc.createdBy) : null;
        if (!docId || !expected.$in.some((id) => String(id) === docId)) return false;
        continue;
      }
      return false;
    }
    const docVal = normalizeQueryValue(module, fieldKey, doc[fieldKey]);
    if (docVal == null) return false;
    if (expected instanceof Date && docVal instanceof Date) {
      if (expected.getTime() !== docVal.getTime()) return false;
    } else if (docVal !== expected) {
      return false;
    }
  }
  return true;
}

function isSingleFieldBatchEligible(checkFields) {
  return checkFields.length === 1 && !COMPOSITE_CHECK_FIELDS.has(checkFields[0]);
}

function lookupFlagValue(module, fieldKey, queryValue) {
  if (queryValue instanceof Date) return `${fieldKey}:${queryValue.getTime()}`;
  return `${fieldKey}:${JSON.stringify(queryValue)}`;
}

async function loadExistingSingleFieldValues({
  module,
  Model,
  organizationId,
  crmBaseQuery,
  fieldKey,
  values,
}) {
  const existing = new Set();
  const list = [...values];
  for (let i = 0; i < list.length; i += DUPLICATE_CHECK_IN_CHUNK) {
    const slice = list.slice(i, i + DUPLICATE_CHECK_IN_CHUNK);
    const filter = module === 'organizations'
      ? { ...crmBaseQuery, [fieldKey]: { $in: slice } }
      : { organizationId, [fieldKey]: { $in: slice } };
    const docs = await Model.find(filter).select({ [fieldKey]: 1 }).lean();
    for (const doc of docs) {
      const normalized = normalizeQueryValue(module, fieldKey, doc[fieldKey]);
      if (normalized != null) {
        existing.add(lookupFlagValue(module, fieldKey, normalized));
      }
    }
  }
  return existing;
}

async function loadExistingCompositeKeys({ Model, module, uniqueQueries }) {
  const existingKeys = new Set();
  const queries = [...uniqueQueries.values()];
  for (let i = 0; i < queries.length; i += DUPLICATE_CHECK_OR_CHUNK) {
    const chunk = queries.slice(i, i + DUPLICATE_CHECK_OR_CHUNK);
    const docs = await Model.find({ $or: chunk }).lean();
    for (const doc of docs) {
      for (const query of chunk) {
        if (documentMatchesQuery(doc, query, module)) {
          existingKeys.add(serializeDuplicateKey(query));
        }
      }
    }
  }
  return existingKeys;
}

async function countImportDuplicates({
  module,
  rows,
  fieldMapping,
  checkFields,
  organizationId,
  crmBaseQuery = null,
}) {
  const handler = MODULE_HANDLERS[module];
  if (!handler) {
    return {
      duplicates: 0,
      unique: 0,
      existingDuplicates: 0,
      inFileDuplicates: 0,
      uncheckable: 0,
      existingDuplicateSamples: [],
      inFileDuplicateSamples: [],
      samplesTruncated: false,
    };
  }

  const fields = resolveCheckFields(handler, checkFields);
  const useSingleFieldBatch = isSingleFieldBatchEligible(fields);
  const fieldKey = useSingleFieldBatch ? fields[0] : null;
  const rowEntries = [];
  const valuesForIn = new Set();
  const uniqueQueries = new Map();

  for await (const { rowNumber, row } of rows) {
    const lookup = buildImportDuplicateLookup({
      module,
      row,
      fieldMapping,
      checkFields: fields,
      organizationId,
      crmBaseQuery,
    });

    if (!lookup.canCheck) {
      rowEntries.push({ rowNumber, canCheck: false });
      continue;
    }

    const { matchedField, matchedValue } = formatMatchedFields(lookup.matchedFields);
    let flag;
    if (useSingleFieldBatch) {
      const queryValue = lookup.query[fieldKey];
      flag = lookupFlagValue(module, fieldKey, queryValue);
      valuesForIn.add(queryValue);
    } else {
      flag = lookup.key;
      if (!uniqueQueries.has(lookup.key)) {
        uniqueQueries.set(lookup.key, lookup.query);
      }
    }

    rowEntries.push({
      rowNumber,
      canCheck: true,
      flag,
      matchedField,
      matchedValue,
    });
  }

  let existingFlags;
  if (useSingleFieldBatch) {
    existingFlags = await loadExistingSingleFieldValues({
      module,
      Model: handler.Model,
      organizationId,
      crmBaseQuery,
      fieldKey,
      values: valuesForIn,
    });
  } else {
    existingFlags = await loadExistingCompositeKeys({
      Model: handler.Model,
      module,
      uniqueQueries,
    });
  }

  const seenInFile = new Map();
  let duplicateCount = 0;
  let uniqueCount = 0;
  let existingDuplicates = 0;
  let inFileDuplicates = 0;
  let uncheckable = 0;
  const existingDuplicateSamples = [];
  const inFileDuplicateSamples = [];

  for (const entry of rowEntries) {
    if (!entry.canCheck) {
      uncheckable += 1;
      uniqueCount += 1;
      continue;
    }

    const { flag, rowNumber, matchedField, matchedValue } = entry;

    if (existingFlags.has(flag)) {
      duplicateCount += 1;
      existingDuplicates += 1;
      if (existingDuplicateSamples.length < DUPLICATE_CHECK_UI_SAMPLES) {
        existingDuplicateSamples.push({ rowNumber, matchedField, matchedValue });
      }
      continue;
    }

    if (seenInFile.has(flag)) {
      duplicateCount += 1;
      inFileDuplicates += 1;
      if (inFileDuplicateSamples.length < DUPLICATE_CHECK_UI_SAMPLES) {
        inFileDuplicateSamples.push({
          rowNumber,
          matchedField,
          matchedValue,
          firstSeenRow: seenInFile.get(flag),
        });
      }
      continue;
    }

    seenInFile.set(flag, rowNumber);
    uniqueCount += 1;
  }

  const samplesTruncated = (
    existingDuplicates > existingDuplicateSamples.length
    || inFileDuplicates > inFileDuplicateSamples.length
  );

  return {
    duplicates: duplicateCount,
    unique: uniqueCount,
    existingDuplicates,
    inFileDuplicates,
    uncheckable,
    existingDuplicateSamples,
    inFileDuplicateSamples,
    samplesTruncated,
  };
}

async function findImportDuplicate({
  module,
  row,
  fieldMapping,
  checkFields,
  organizationId,
  crmBaseQuery = null,
}) {
  const engineModule = module === 'contacts' ? 'people' : module;
  if (
    engineModule === 'people'
    || engineModule === 'organizations'
    || engineModule === 'items'
    || engineModule === 'deals'
    || engineModule === 'tasks'
  ) {
    try {
      const { getConfig, evaluateDuplicates } = require('../duplicates');
      const { MODULE_MODELS: models } = require('../duplicates/evaluate');
      const config = await getConfig(organizationId, engineModule);
      if (config.enabled) {
        const candidate = {};
        for (const cond of config.conditions || []) {
          if (engineModule === 'people' && cond.field === 'name') {
            const firstName = mapCsvField(row, fieldMapping, 'first_name');
            const lastName = mapCsvField(row, fieldMapping, 'last_name');
            candidate.first_name = firstName;
            candidate.last_name = lastName;
            candidate.name = [firstName, lastName].filter(Boolean).join(' ');
          } else if (engineModule === 'items' && cond.field === 'item_name') {
            candidate.item_name = mapCsvField(row, fieldMapping, 'item_name')
              || mapCsvField(row, fieldMapping, 'name');
          } else if (engineModule === 'organizations' && cond.field === 'taxId') {
            candidate.taxId = mapCsvField(row, fieldMapping, 'taxId')
              || mapCsvField(row, fieldMapping, 'tax_id');
          } else if (engineModule === 'organizations' && cond.field === 'domain') {
            candidate.domain = mapCsvField(row, fieldMapping, 'domain')
              || mapCsvField(row, fieldMapping, 'website');
          } else if (engineModule === 'deals' && cond.field === 'name') {
            candidate.name = mapCsvField(row, fieldMapping, 'name');
          } else if (engineModule === 'deals' && cond.field === 'contactId') {
            candidate.contactId = mapCsvField(row, fieldMapping, 'contactId')
              || mapCsvField(row, fieldMapping, 'contact');
          } else if (engineModule === 'tasks' && cond.field === 'title') {
            candidate.title = mapCsvField(row, fieldMapping, 'title')
              || mapCsvField(row, fieldMapping, 'name');
          } else {
            candidate[cond.field] = mapCsvField(row, fieldMapping, cond.field);
          }
        }
        // Also map common import check fields onto candidate for better coverage
        if (engineModule === 'people') {
          candidate.email = candidate.email || mapCsvField(row, fieldMapping, 'email');
          candidate.phone = candidate.phone || mapCsvField(row, fieldMapping, 'phone');
        }
        if (engineModule === 'deals') {
          candidate.name = candidate.name || mapCsvField(row, fieldMapping, 'name');
        }
        if (engineModule === 'tasks') {
          candidate.title = candidate.title || mapCsvField(row, fieldMapping, 'title');
        }
        const result = await evaluateDuplicates({
          organizationId,
          moduleKey: engineModule,
          candidate,
          config,
          limit: 1,
        });
        if (result.hasMatch && result.matches[0]?.record?._id) {
          const Model = models[engineModule];
          const existing = await Model.findById(result.matches[0].record._id).lean();
          if (existing) {
            const mf = result.matches[0].matchedFields || [];
            return {
              existing,
              matchedField: mf.map((f) => f.field).join(` ${config.matchLogic} `) || 'duplicate',
              matchedValue: mf.map((f) => f.value).join(', '),
            };
          }
        }
        return null;
      }
    } catch (err) {
      console.warn('[findImportDuplicate] engine fallback:', err.message);
    }
  }

  const handler = MODULE_HANDLERS[module];
  if (!handler) return null;

  const lookup = buildImportDuplicateLookup({
    module,
    row,
    fieldMapping,
    checkFields,
    organizationId,
    crmBaseQuery,
  });
  if (!lookup.canCheck) return null;

  const existing = await handler.Model.findOne(lookup.query).lean();
  if (!existing) return null;

  const buildArgs = module === 'organizations'
    ? [row, fieldMapping, resolveCheckFields(handler, checkFields), organizationId, crmBaseQuery]
    : [row, fieldMapping, resolveCheckFields(handler, checkFields), organizationId];
  const { matchedFields } = handler.buildQuery(...buildArgs);

  return {
    existing,
    matchedField: matchedFields.map((f) => f.field).join(' AND '),
    matchedValue: matchedFields.map((f) => f.value).join(', '),
  };
}

module.exports = {
  mapCsvField,
  MODULE_HANDLERS,
  findImportDuplicate,
  countImportDuplicates,
};
