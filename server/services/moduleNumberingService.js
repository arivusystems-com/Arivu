'use strict';

const ModuleNumberingConfig = require('../models/ModuleNumberingConfig');
const ModuleSequence = require('../models/ModuleSequence');
const {
  ALLOWED_FORMAT_TOKENS,
  STANDARD_MODULE_KEYS,
  resolveRegistryEntry,
  getRegistryEntry,
} = require('../constants/moduleNumberingRegistry');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');

const TOKEN_PATTERN = /\{([A-Z]+)\}/g;
const FORMAT_LITERAL_PATTERN = /^[A-Za-z0-9\/\-_. {}]+$/;

class ModuleNumberingError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status]
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ModuleNumberingError';
    this.code = code;
    this.status = status;
  }
}

/**
 * @param {string} format
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateFormat(format) {
  const value = String(format || '').trim();
  if (!value) {
    return { ok: false, message: 'Format is required' };
  }
  if (value.length > 120) {
    return { ok: false, message: 'Format must be at most 120 characters' };
  }
  if (!FORMAT_LITERAL_PATTERN.test(value)) {
    return { ok: false, message: 'Format contains invalid characters' };
  }

  const tokens = [];
  let match;
  const re = new RegExp(TOKEN_PATTERN.source, 'g');
  while ((match = re.exec(value)) !== null) {
    tokens.push(match[1]);
  }

  const unsupported = tokens.filter((t) => !ALLOWED_FORMAT_TOKENS.includes(t));
  if (unsupported.length) {
    return {
      ok: false,
      message: `Unsupported variables: ${unsupported.map((t) => `{${t}}`).join(', ')}`,
    };
  }

  const seqCount = tokens.filter((t) => t === 'SEQ').length;
  if (seqCount !== 1) {
    return { ok: false, message: 'Format must contain exactly one {SEQ}' };
  }

  return { ok: true };
}

/**
 * @param {string} resetRule
 * @param {Date} at
 */
function computePeriodKey(resetRule, at = new Date()) {
  const d = at instanceof Date ? at : new Date(at);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  switch (String(resetRule || 'never')) {
    case 'daily':
      return `${yyyy}-${mm}-${dd}`;
    case 'monthly':
      return `${yyyy}-${mm}`;
    case 'yearly':
      return String(yyyy);
    case 'never':
    default:
      return '';
  }
}

/**
 * @param {object} params
 * @param {string} params.format
 * @param {string} [params.prefix]
 * @param {string} [params.suffix]
 * @param {number} params.sequence
 * @param {number} params.sequenceLength
 * @param {Date} [params.at]
 */
function renderNumber({ format, prefix = '', suffix = '', sequence, sequenceLength, at = new Date() }) {
  const d = at instanceof Date ? at : new Date(at);
  const yyyy = d.getUTCFullYear();
  const yy = String(yyyy).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const padded = String(sequence).padStart(Math.max(1, Number(sequenceLength) || 1), '0');

  return String(format)
    .replace(/\{PREFIX\}/g, String(prefix || ''))
    .replace(/\{SUFFIX\}/g, String(suffix || ''))
    .replace(/\{YYYY\}/g, String(yyyy))
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{SEQ\}/g, padded);
}

function maxSequenceForLength(sequenceLength) {
  const len = Math.max(1, Math.min(15, Number(sequenceLength) || 1));
  return 10 ** len - 1;
}

/**
 * Escape a string for safe inclusion in a RegExp.
 * @param {string} value
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a matcher for Record IDs produced by the given format.
 * Only digits in the {SEQ} slot are accepted (avoids ObjectId/UUID/demo tails).
 *
 * @param {object} [options]
 * @param {string} [options.format]
 * @param {string} [options.prefix]
 * @param {string} [options.suffix]
 * @returns {RegExp | null}
 */
function buildSequenceExtractRegex(options = {}) {
  const format = String(options.format || '').trim();
  if (!format || !format.includes('{SEQ}')) return null;

  let pattern = '';
  const re = /\{([A-Z]+)\}|([^{]+)/g;
  let match;
  while ((match = re.exec(format)) !== null) {
    if (match[1]) {
      const token = match[1];
      if (token === 'SEQ') {
        pattern += '(\\d+)';
      } else if (token === 'PREFIX') {
        pattern += escapeRegExp(String(options.prefix || ''));
      } else if (token === 'SUFFIX') {
        pattern += escapeRegExp(String(options.suffix || ''));
      } else if (token === 'YYYY') {
        pattern += '\\d{4}';
      } else if (token === 'YY') {
        pattern += '\\d{2}';
      } else if (token === 'MM' || token === 'DD') {
        pattern += '\\d{2}';
      } else {
        return null;
      }
    } else {
      pattern += escapeRegExp(match[2]);
    }
  }
  return new RegExp(`^${pattern}$`, 'i');
}

/**
 * Extract sequence from a Record ID.
 * Prefer format-aware matching; fall back to trailing digits only for simple PREFIX-SEQ shapes.
 *
 * @param {string} value
 * @param {number|object} [sequenceLengthOrOptions]
 * @param {object} [maybeOptions]
 */
function extractSequenceFromValue(value, sequenceLengthOrOptions, maybeOptions) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const options =
    sequenceLengthOrOptions && typeof sequenceLengthOrOptions === 'object'
      ? sequenceLengthOrOptions
      : { sequenceLength: sequenceLengthOrOptions, ...(maybeOptions || {}) };

  const formatRegex = buildSequenceExtractRegex(options);
  if (formatRegex) {
    const match = formatRegex.exec(raw);
    if (!match) return null;
    const n = Number.parseInt(match[1], 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  // Legacy fallback: trailing digits only when no format provided
  const match = raw.match(/(\d+)\s*$/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} moduleKey
 * @param {object} [options]
 * @param {string} [options.label]
 * @param {import('mongoose').Types.ObjectId|string} [options.updatedBy]
 */
async function seedDefaultForModule(organizationId, moduleKey, options = {}) {
  const entry = resolveRegistryEntry(moduleKey, options.label);
  const key = String(moduleKey || '').trim().toLowerCase();
  const existing = await ModuleNumberingConfig.findOne({ organizationId, moduleKey: key }).lean();
  if (existing) return existing;

  const doc = await ModuleNumberingConfig.create({
    organizationId,
    moduleKey: key,
    enabled: true,
    format: entry.defaultFormat,
    prefix: entry.defaultPrefix,
    suffix: '',
    sequenceLength: entry.defaultSequenceLength || 6,
    startingSequence: 1,
    currentSequence: 0,
    resetRule: 'never',
    allowManualEdit: false,
    numberFieldKey: entry.numberFieldKey,
    updatedBy: options.updatedBy || null,
  });
  return doc.toObject ? doc.toObject() : doc;
}

/**
 * Standard registry keys eligible for this org (app-gated entries require the app enabled).
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<string[]>}
 */
async function standardModuleKeysForOrg(organizationId) {
  const Organization = require('../models/Organization');
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  return STANDARD_MODULE_KEYS.filter((moduleKey) => {
    const entry = getRegistryEntry(moduleKey);
    if (!entry?.requireAppKey) return true;
    return isAppEnabledForOrg(org, entry.requireAppKey);
  });
}

/**
 * Whether a registry moduleKey should appear in Settings for this org.
 * @param {string} moduleKey
 * @param {object|null} organization
 */
function isModuleNumberingVisibleForOrg(moduleKey, organization) {
  const entry = getRegistryEntry(moduleKey);
  if (!entry) return true; // custom / unknown configs stay listable
  if (!entry.requireAppKey) return true;
  return isAppEnabledForOrg(organization, entry.requireAppKey);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object} [options]
 */
async function seedDefaultsForOrg(organizationId, options = {}) {
  let created = 0;
  let skipped = 0;
  const keys = await standardModuleKeysForOrg(organizationId);
  for (const moduleKey of keys) {
    const before = await ModuleNumberingConfig.findOne({ organizationId, moduleKey }).lean();
    if (before) {
      skipped += 1;
      continue;
    }
    await seedDefaultForModule(organizationId, moduleKey, options);
    created += 1;
  }
  return { created, skipped };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} moduleKey
 */
async function getOrCreateConfig(organizationId, moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  let config = await ModuleNumberingConfig.findOne({ organizationId, moduleKey: key });
  if (!config) {
    await seedDefaultForModule(organizationId, key);
    config = await ModuleNumberingConfig.findOne({ organizationId, moduleKey: key });
  }
  if (!config) {
    throw new ModuleNumberingError('CONFIG_MISSING', `Numbering config missing for ${key}`, 500);
  }
  return config;
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} params.moduleKey
 * @param {Date} [params.at]
 * @returns {Promise<{ recordId: string, sequence: number, config: object } | null>}
 *   null when auto-numbering disabled
 */
async function allocate({ organizationId, moduleKey, at = new Date() }) {
  if (!organizationId) {
    throw new ModuleNumberingError('ORG_REQUIRED', 'organizationId is required', 400);
  }
  const key = String(moduleKey || '').trim().toLowerCase();
  const config = await getOrCreateConfig(organizationId, key);

  if (!config.enabled) {
    return null;
  }

  const formatCheck = validateFormat(config.format);
  if (!formatCheck.ok) {
    throw new ModuleNumberingError('INVALID_FORMAT', formatCheck.message, 400);
  }

  const periodKey = computePeriodKey(config.resetRule, at);
  const starting = Math.max(1, Number(config.startingSequence) || 1);
  const sequenceLength = Math.max(1, Math.min(15, Number(config.sequenceLength) || 6));
  const maxSeq = maxSequenceForLength(sequenceLength);

  const seqDoc = await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey: key, periodKey },
    { $inc: { nextValue: 1 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: {
        organizationId,
        moduleKey: key,
        periodKey,
        nextValue: starting - 1,
      },
    }
  );

  const sequence = Number(seqDoc.nextValue);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new ModuleNumberingError('SEQUENCE_ERROR', 'Failed to allocate sequence', 500);
  }
  if (sequence > maxSeq) {
    // Roll back the increment so we do not burn the overflowed value permanently as usable
    await ModuleSequence.updateOne(
      { _id: seqDoc._id, nextValue: sequence },
      { $inc: { nextValue: -1 } }
    );
    throw new ModuleNumberingError(
      'SEQUENCE_OVERFLOW',
      `Sequence overflow: maximum ${maxSeq} for length ${sequenceLength}`,
      400
    );
  }

  const recordId = renderNumber({
    format: config.format,
    prefix: config.prefix,
    suffix: config.suffix,
    sequence,
    sequenceLength,
    at,
  });

  await ModuleNumberingConfig.updateOne(
    { _id: config._id },
    { $set: { currentSequence: sequence } }
  );

  return {
    recordId,
    sequence,
    config: {
      moduleKey: key,
      numberFieldKey: config.numberFieldKey,
      format: config.format,
      enabled: config.enabled,
    },
  };
}

/**
 * Allocate or return null; callers that require a number should fall back.
 * Never throws for disabled; throws on generation failure.
 */
async function allocateOrNull(params) {
  return allocate(params);
}

/**
 * Allocate a record ID; throws when auto-numbering is disabled.
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} params.moduleKey
 * @param {Date} [params.at]
 * @returns {Promise<string>}
 */
async function allocateRequired(params) {
  const result = await allocate(params);
  if (!result?.recordId) {
    const key = String(params.moduleKey || '').trim().toLowerCase() || 'module';
    const entry = getRegistryEntry(key);
    const label = entry?.label || key;
    throw new ModuleNumberingError(
      'NUMBERING_DISABLED',
      `${label} numbering is disabled; enable Module Numbering for ${label}`,
      400
    );
  }
  return result.recordId;
}

/**
 * @param {object} params
 */
function preview(params) {
  const format = String(params.format || '').trim();
  const formatCheck = validateFormat(format);
  if (!formatCheck.ok) {
    throw new ModuleNumberingError('INVALID_FORMAT', formatCheck.message, 400);
  }
  const sequenceLength = Math.max(1, Math.min(15, Number(params.sequenceLength) || 6));
  const currentSequence = Math.max(0, Number(params.currentSequence) || 0);
  const startingSequence = Math.max(1, Number(params.startingSequence) || 1);
  const next = Math.max(currentSequence + 1, startingSequence);
  return renderNumber({
    format,
    prefix: params.prefix || '',
    suffix: params.suffix || '',
    sequence: next,
    sequenceLength,
    at: params.at || new Date(),
  });
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} moduleKey
 * @param {object} patch
 * @param {object} [options]
 */
async function updateConfig(organizationId, moduleKey, patch, options = {}) {
  const key = String(moduleKey || '').trim().toLowerCase();
  const config = await getOrCreateConfig(organizationId, key);
  const before = config.toObject ? config.toObject() : { ...config };

  if (patch.format !== undefined) {
    const formatCheck = validateFormat(patch.format);
    if (!formatCheck.ok) {
      throw new ModuleNumberingError('INVALID_FORMAT', formatCheck.message, 400);
    }
    config.format = String(patch.format).trim();
  }
  if (patch.prefix !== undefined) config.prefix = String(patch.prefix || '').trim();
  if (patch.suffix !== undefined) config.suffix = String(patch.suffix || '').trim();
  if (patch.enabled !== undefined) config.enabled = Boolean(patch.enabled);
  // Manual Record IDs are not supported — Record IDs / Item Codes are always system-allocated.
  config.allowManualEdit = false;
  if (patch.resetRule !== undefined) {
    const rule = String(patch.resetRule || 'never');
    if (!['never', 'daily', 'monthly', 'yearly'].includes(rule)) {
      throw new ModuleNumberingError('INVALID_RESET_RULE', 'Invalid reset rule', 400);
    }
    config.resetRule = rule;
  }
  if (patch.sequenceLength !== undefined) {
    const len = Number(patch.sequenceLength);
    if (!Number.isInteger(len) || len < 1 || len > 15) {
      throw new ModuleNumberingError('INVALID_SEQUENCE_LENGTH', 'Sequence length must be 1–15', 400);
    }
    config.sequenceLength = len;
  }
  if (patch.startingSequence !== undefined) {
    const start = Number(patch.startingSequence);
    if (!Number.isInteger(start) || start < 1) {
      throw new ModuleNumberingError('INVALID_STARTING_SEQUENCE', 'Starting sequence must be > 0', 400);
    }
    if (start < (config.currentSequence || 0) && !options.confirmLowerStarting) {
      throw new ModuleNumberingError(
        'STARTING_BELOW_CURRENT',
        'Starting sequence is lower than current sequence; confirm to proceed',
        409
      );
    }
    config.startingSequence = start;
  }
  if (options.updatedBy) config.updatedBy = options.updatedBy;

  await config.save();
  return { before, after: config.toObject() };
}

/**
 * Lazy model map for resync — avoid hard circular requires at module load.
 */
function resolveRecordModel(moduleKey) {
  const baseKey = String(moduleKey || '').split(':')[0];
  const map = {
    quotes: () => require('../models/Quote'),
    sales_orders: () => require('../models/SalesOrder'),
    invoices: () => require('../models/Invoice'),
    payments: () => require('../models/Payment'),
    documents: () => require('../models/Document'),
    cases: () => require('../models/Case'),
    items: () => require('../models/Item'),
    people: () => require('../models/People'),
    organizations: () => require('../models/Organization'),
    deals: () => require('../models/Deal'),
    tasks: () => require('../models/Task'),
    events: () => require('../models/Event'),
    forms: () => require('../models/Form'),
    responses: () => require('../models/FormResponse'),
    campaigns: () => require('../models/Campaign'),
    audiences: () => require('../models/MarketingAudience'),
    assets: () => require('../models/MarketingAsset'),
    imports: () => require('../models/ImportHistory'),
    segments: () => require('../models/MarketingSegment'),
    templates: () => require('../models/ContentTemplate'),
    articles: () => require('../models/ContentDocument'),
    blog: () => require('../models/ContentDocument'),
    purchase_orders: () => require('../models/PurchaseOrder').PurchaseOrder,
    receipt_notes: () => require('../models/ReceiptNote').ReceiptNote,
    purchase_returns: () => require('../models/PurchaseReturn').PurchaseReturn,
    delivery_notes: () => require('../models/DeliveryNote').DeliveryNote,
    delivery_returns: () => require('../models/DeliveryReturn').DeliveryReturn,
    sales_returns: () => require('./fulfillmentDocsService').SalesReturn,
  };
  const loader = map[baseKey];
  return loader ? loader() : null;
}

/**
 * Recalculate next sequence from highest existing Record ID.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} moduleKey
 */
async function resyncFromExistingRecords(organizationId, moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  const config = await getOrCreateConfig(organizationId, key);
  const field = config.numberFieldKey;
  const Model = resolveRecordModel(key);
  if (!Model) {
    // Config is seeded; sequence stays at current until first allocate / later model wiring.
    return {
      moduleKey: key,
      skipped: true,
      reason: 'no_record_model',
      currentSequence: config.currentSequence || 0,
      nextSequence: (config.currentSequence || 0) + 1,
      scanned: 0,
    };
  }

  let rows;
  if (key === 'organizations') {
    const { buildTenantAccessibleCrmOrganizationQuery } = require('../utils/crmOrganizationAccess');
    const query = await buildTenantAccessibleCrmOrganizationQuery(organizationId);
    rows = await Model.find(query).select(field).lean();
  } else {
    const filter = { organizationId };
    if (key === 'invoices:credit_note') {
      filter.invoiceType = 'credit_note';
    } else if (key === 'invoices') {
      filter.invoiceType = { $ne: 'credit_note' };
    } else if (key === 'articles') {
      filter.addonKey = 'articles';
    } else if (key === 'blog') {
      filter.addonKey = 'blog';
    }
    // Prefer raw collection for commercial docs so soft-deleted numbers still count
    // (unique indexes retain those values).
    if (key === 'quotes' || key === 'sales_orders' || key === 'invoices' || key === 'invoices:credit_note') {
      rows = await Model.collection.find(filter, { projection: { [field]: 1 } }).toArray();
    } else {
      rows = await Model.find(filter).select(field).lean();
    }
  }
  let max = 0;
  const extractOpts = {
    format: config.format,
    prefix: config.prefix,
    suffix: config.suffix,
    sequenceLength: config.sequenceLength,
  };
  for (const row of rows) {
    const n = extractSequenceFromValue(row?.[field], extractOpts);
    if (n != null) max = Math.max(max, n);
  }

  const nextValue = max;
  const periodKey = computePeriodKey(config.resetRule, new Date());
  await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey: key, periodKey },
    { $set: { nextValue } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: {
        organizationId,
        moduleKey: key,
        periodKey,
        nextValue,
      },
    }
  );

  config.currentSequence = max;
  await config.save();

  return {
    moduleKey: key,
    currentSequence: max,
    nextSequence: max + 1,
    scanned: rows.length,
  };
}

/**
 * Resolve numbering module key for invoice types.
 * @param {string} [invoiceType]
 */
function resolveInvoiceModuleKey(invoiceType) {
  return String(invoiceType || '') === 'credit_note' ? 'invoices:credit_note' : 'invoices';
}

/**
 * List configs for org (seed missing standard entries lazily).
 * App-gated modules (e.g. Inventory workbench) only appear when the app is enabled.
 */
async function listConfigs(organizationId) {
  await seedDefaultsForOrg(organizationId);
  const Organization = require('../models/Organization');
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  const configs = await ModuleNumberingConfig.find({ organizationId }).sort({ moduleKey: 1 }).lean();
  return configs
    .filter((c) => isModuleNumberingVisibleForOrg(c.moduleKey, org))
    .map((c) => {
      const entry = resolveRegistryEntry(c.moduleKey);
      return {
        ...c,
        label: entry.label || c.moduleKey,
        numberFieldKey: c.numberFieldKey || entry.numberFieldKey,
        numberFieldLabel: entry.numberFieldLabel || entry.numberFieldKey || c.numberFieldKey,
        currentFormatPreview: (() => {
          try {
            return preview({
              format: c.format,
              prefix: c.prefix,
              suffix: c.suffix,
              sequenceLength: c.sequenceLength,
              currentSequence: c.currentSequence,
              startingSequence: c.startingSequence,
            });
          } catch {
            return c.format;
          }
        })(),
      };
    });
}

/**
 * Allocate a document number via Module Numbering config.
 * Falls back to PREFIX-#### when auto-numbering is disabled.
 *
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} moduleKey
 * @param {string} prefix - legacy fallback prefix
 * @param {number} [pad=4]
 */
async function allocateDocumentNumber(organizationId, moduleKey, prefix, pad = 4) {
  const result = await allocate({ organizationId, moduleKey });
  if (result?.recordId) return result.recordId;

  const key = String(moduleKey || '').trim().toLowerCase();
  const seq = await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey: key, periodKey: '' },
    { $inc: { nextValue: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const n = Number(seq.nextValue) || 1;
  const length = Math.max(1, Math.min(15, Number(pad) || 4));
  return `${prefix}-${String(n).padStart(length, '0')}`;
}

module.exports = {
  ModuleNumberingError,
  validateFormat,
  computePeriodKey,
  renderNumber,
  escapeRegExp,
  buildSequenceExtractRegex,
  extractSequenceFromValue,
  seedDefaultForModule,
  seedDefaultsForOrg,
  standardModuleKeysForOrg,
  isModuleNumberingVisibleForOrg,
  getOrCreateConfig,
  allocate,
  allocateOrNull,
  allocateRequired,
  allocateDocumentNumber,
  preview,
  updateConfig,
  resyncFromExistingRecords,
  resolveInvoiceModuleKey,
  listConfigs,
  getRegistryEntry,
  resolveRegistryEntry,
  STANDARD_MODULE_KEYS,
};
