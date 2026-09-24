/**
 * Closed Records — per-module adapters (picklist source + defaults).
 * Status values always come from tenant field / pipeline / event-status configuration.
 * Platform lifecycle constants are last-resort only when field config has no options.
 */

const { CASE_STATUSES } = require('./caseLifecycle');
const { QUOTE_STATUSES, QUOTE_RECORD_READ_ONLY_STATUSES } = require('./quoteLifecycle');
const { SALES_ORDER_STATUSES } = require('./salesOrderLifecycle');
const { INVOICE_STATUSES, INVOICE_RECORD_READ_ONLY_STATUSES } = require('./invoiceLifecycle');
const { PAYMENT_STATUSES } = require('./paymentLifecycle');
const { PO_STATUSES, RN_STATUSES, PR_STATUSES } = require('./procurementLifecycle');
const { DN_STATUSES } = require('./deliveryNoteLifecycle');
const { DR_STATUSES, DR_STATUS_VALUES } = require('./deliveryReturnLifecycle');

const CLOSED_RECORDS_MODULE_KEYS = Object.freeze([
  'deals',
  'cases',
  'tasks',
  'events',
  'quotes',
  'sales_orders',
  'invoices',
  'payments',
  'purchase_orders',
  'receipt_notes',
  'purchase_returns',
  'delivery_notes',
  'delivery_returns',
  'sales_returns'
]);

const APP_MODULE_GROUPS = Object.freeze({
  sales: ['deals', 'quotes', 'sales_orders', 'invoices', 'payments'],
  helpdesk: ['cases'],
  core: ['tasks', 'events'],
  inventory: [
    'purchase_orders',
    'receipt_notes',
    'purchase_returns',
    'delivery_notes',
    'delivery_returns',
    'sales_returns'
  ]
});

const SR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

/**
 * Normalize picklist options from a ModuleDefinition field.
 * @param {unknown} opts
 * @returns {string[]}
 */
function normalizePicklistOptions(opts) {
  if (!Array.isArray(opts)) return [];
  const values = [];
  const seen = new Set();
  for (const o of opts) {
    let v = '';
    if (typeof o === 'string' || typeof o === 'number') {
      v = String(o).trim();
    } else if (o && typeof o === 'object') {
      v = String(o.value ?? o.label ?? o.name ?? '').trim();
    }
    if (!v) continue;
    const norm = v.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    values.push(v);
  }
  return values;
}

/**
 * Prefer org ModuleDefinition override, then platform (organizationId null).
 * @param {string} moduleKey
 * @param {string|null} [organizationId]
 * @param {string} [select]
 */
async function findModuleDefinitionDoc(moduleKey, organizationId = null, select = 'fields') {
  const ModuleDefinition = require('../models/ModuleDefinition');
  const key = String(moduleKey || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (organizationId) {
    const orgDoc = await ModuleDefinition.findOne({ key, organizationId }).select(select).lean();
    if (orgDoc) return orgDoc;
  }
  const platform = await ModuleDefinition.findOne({
    key,
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
  })
    .select(select)
    .lean();
  if (platform) return platform;
  return ModuleDefinition.findOne({ key }).select(select).lean();
}

/**
 * Load picklist option values from the tenant ModuleDefinition field config.
 * @param {string} moduleKey
 * @param {string} fieldKey
 * @param {{ organizationId?: string|null }} [opts]
 * @returns {Promise<string[]>}
 */
async function loadModulePicklistValues(moduleKey, fieldKey, opts = {}) {
  try {
    const field = String(fieldKey || '')
      .trim()
      .toLowerCase();
    const mod = await findModuleDefinitionDoc(moduleKey, opts.organizationId || null, 'fields');
    const fields = Array.isArray(mod?.fields) ? mod.fields : [];
    const fieldDef = fields.find(
      (f) =>
        String(f?.key || '')
          .trim()
          .toLowerCase() === field
    );
    if (!fieldDef) return [];
    const optsList = Array.isArray(fieldDef.options)
      ? fieldDef.options
      : Array.isArray(fieldDef.enum)
        ? fieldDef.enum
        : Array.isArray(fieldDef.picklistOptions)
          ? fieldDef.picklistOptions
          : [];
    return normalizePicklistOptions(optsList);
  } catch {
    return [];
  }
}

/** Mirror moduleController.isLegacyDefaultPipelineSettings (avoid circular require). */
function isLegacyDefaultPipelineSettings(pipelineSettings) {
  if (!Array.isArray(pipelineSettings) || pipelineSettings.length !== 1) return false;
  const p = pipelineSettings[0];
  const key = (p && p.key ? String(p.key) : '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  const name = (p && p.name ? String(p.name) : '').trim();
  const isLegacyKey = key === 'default_pipeline';
  const isLegacyName = name === 'Default Pipeline';
  if (!isLegacyKey && !isLegacyName) return false;
  const stages = Array.isArray(p.stages) ? p.stages : [];
  const firstStageName = (stages[0] && stages[0].name ? String(stages[0].name) : '').trim();
  return firstStageName !== 'New';
}

/**
 * Deal stages from ModuleDefinition.pipelineSettings (same SoT as Pipelines & Stages UI).
 * Legacy Default Pipeline without "New" is expanded via getDefaultPipelineSettings — matching module GET.
 * @param {string|null} [organizationId]
 */
async function loadDealStagesFromPipelineSettings(organizationId = null) {
  try {
    const mod = await findModuleDefinitionDoc('deals', organizationId, 'pipelineSettings');
    let pipelines = Array.isArray(mod?.pipelineSettings) ? mod.pipelineSettings : [];
    if (!pipelines.length || isLegacyDefaultPipelineSettings(pipelines)) {
      const { getDefaultPipelineSettings } = require('../controllers/moduleController');
      pipelines = typeof getDefaultPipelineSettings === 'function' ? getDefaultPipelineSettings() : [];
    }
    const labels = [];
    const seen = new Set();
    const ordered = [
      ...pipelines.filter((p) => p?.isDefault),
      ...pipelines.filter((p) => !p?.isDefault)
    ];
    for (const p of ordered) {
      const stages = Array.isArray(p?.stages) ? p.stages : [];
      const sorted = [...stages].sort(
        (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
      );
      for (const s of sorted) {
        const v = String(s?.name || s?.label || s?.value || '').trim();
        if (!v) continue;
        const norm = v.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        labels.push(v);
      }
    }
    return labels;
  } catch {
    return [];
  }
}

/** @deprecated Prefer loadDealStagesFromPipelineSettings — Config Registry is not the Pipelines UI SoT. */
async function loadDealStagesFromRegistry(organizationId = null) {
  return loadDealStagesFromPipelineSettings(organizationId);
}

/** Event status labels from Event Status Lifecycle settings. */
async function loadEventStatusLabels() {
  try {
    const EventTypeStatusConfig = require('../models/EventTypeStatusConfig');
    const configs = await EventTypeStatusConfig.find({}).lean();
    const labels = new Set();
    for (const c of configs || []) {
      for (const v of c.values || []) {
        const label = String(v.label || v.value || '').trim();
        if (label) labels.add(label);
      }
    }
    return [...labels];
  } catch {
    return [];
  }
}

/**
 * Prefer ModuleDefinition field options; optional secondary loaders; platform fallback last.
 * When `mergeSecondary` is true, union field + secondary (deals: Field Config + pipeline stages).
 * @param {string} moduleKey
 * @param {string} statusField
 * @param {object} [opts]
 * @param {string|null} [opts.organizationId]
 * @param {(organizationId?: string|null) => Promise<string[]>} [opts.secondary]
 * @param {boolean} [opts.mergeSecondary]
 * @param {string[]} [opts.platformFallback]
 */
async function resolveStatusValues(moduleKey, statusField, opts = {}) {
  const organizationId = opts.organizationId || null;
  const fromField = await loadModulePicklistValues(moduleKey, statusField, { organizationId });
  let secondary = [];
  if (typeof opts.secondary === 'function') {
    const loaded = await opts.secondary(organizationId);
    if (Array.isArray(loaded)) secondary = loaded;
  }

  if (opts.mergeSecondary) {
    const seen = new Set();
    const merged = [];
    // Prefer secondary order (e.g. pipeline stage order, includes New), then Field Config extras
    for (const v of [...secondary, ...fromField]) {
      const s = String(v || '').trim();
      if (!s) continue;
      const norm = s.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      merged.push(s);
    }
    if (merged.length > 0) return merged;
  } else if (fromField.length > 0) {
    return fromField;
  } else if (secondary.length > 0) {
    return secondary;
  }

  return Array.isArray(opts.platformFallback) ? [...opts.platformFallback] : [];
}

function matchValues(values, predicates) {
  return values.filter((v) => predicates.some((p) => p.test(String(v))));
}

function firstActiveReopen(values) {
  return (
    [...values].find((v) => !/closed|won|lost|cancel|complet|done|void|settled|delivered|refund|revers/i.test(v)) ||
    values[0] ||
    null
  );
}

/**
 * @typedef {object} ClosedRecordsModuleDef
 * @property {string} moduleKey
 * @property {string} statusField
 * @property {string} [statusPicklistKey]
 * @property {string} [displayLabel]
 * @property {boolean} reopenEnabledDefault
 * @property {boolean} allowLinkingDefault
 * @property {() => Promise<string[]>|string[]} listStatusValues
 * @property {(values: string[]) => { statusValue: string, reopenStatusValue: string|null }[]} buildDefaults
 * @property {string} [modelPath]
 * @property {string} [entityTypeAlias]
 */

/** @type {Record<string, ClosedRecordsModuleDef>} */
const MODULE_DEFS = {
  deals: {
    moduleKey: 'deals',
    statusField: 'stage',
    statusPicklistKey: 'sales_stage',
    displayLabel: 'Deal',
    reopenEnabledDefault: true,
    allowLinkingDefault: true,
    modelPath: '../models/Deal',
    entityTypeAlias: 'deal',
    async listStatusValues(ctx = {}) {
      // Pipelines & Stages (pipelineSettings) is the SoT for deal stages — includes New.
      // Field Config stage options alone can be stale (pre-enrichment snapshot without New).
      return resolveStatusValues('deals', 'stage', {
        organizationId: ctx.organizationId || null,
        secondary: loadDealStagesFromPipelineSettings,
        mergeSecondary: true
      });
    },
    buildDefaults(values) {
      const won = values.find((v) => /won/i.test(v) || /closed\s*won/i.test(v));
      const lost = values.find((v) => /lost/i.test(v) || /closed\s*lost/i.test(v));
      const reopen =
        values.find((v) => /negotiation/i.test(v)) || firstActiveReopen(values);
      const defaults = [];
      if (won) defaults.push({ statusValue: won, reopenStatusValue: reopen });
      if (lost) defaults.push({ statusValue: lost, reopenStatusValue: reopen });
      return defaults;
    }
  },

  cases: {
    moduleKey: 'cases',
    statusField: 'status',
    statusPicklistKey: 'case_status',
    displayLabel: 'Case',
    reopenEnabledDefault: true,
    allowLinkingDefault: true,
    modelPath: '../models/Case',
    entityTypeAlias: 'case',
    async listStatusValues() {
      return resolveStatusValues('cases', 'status', {
        platformFallback: CASE_STATUSES
      });
    },
    buildDefaults(values) {
      const reopen =
        values.find((v) => /in\s*progress/i.test(v)) || firstActiveReopen(values);
      return matchValues(values, [/^resolved$/i, /^closed$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: reopen
      }));
    }
  },

  tasks: {
    moduleKey: 'tasks',
    statusField: 'status',
    statusPicklistKey: 'task_status',
    displayLabel: 'Task',
    reopenEnabledDefault: true,
    allowLinkingDefault: true,
    modelPath: '../models/Task',
    entityTypeAlias: 'task',
    async listStatusValues() {
      return resolveStatusValues('tasks', 'status');
    },
    buildDefaults(values) {
      const reopen =
        values.find((v) => /todo|open|new|pending/i.test(v)) || firstActiveReopen(values);
      return matchValues(values, [/completed/i, /done/i, /cancelled/i, /canceled/i]).map(
        (statusValue) => ({ statusValue, reopenStatusValue: reopen })
      );
    }
  },

  events: {
    moduleKey: 'events',
    statusField: 'status',
    statusPicklistKey: 'event_status',
    displayLabel: 'Event',
    reopenEnabledDefault: true,
    allowLinkingDefault: true,
    modelPath: '../models/Event',
    entityTypeAlias: 'event',
    async listStatusValues() {
      return resolveStatusValues('events', 'status', {
        secondary: loadEventStatusLabels
      });
    },
    buildDefaults(values) {
      const open =
        values.find((v) => /schedul|open|planned|confirm/i.test(v)) || firstActiveReopen(values);
      return matchValues(values, [/complet/i, /done/i, /cancel/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: open
      }));
    }
  },

  quotes: {
    moduleKey: 'quotes',
    statusField: 'status',
    statusPicklistKey: 'quote_status',
    displayLabel: 'Quote',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/Quote',
    entityTypeAlias: 'quote',
    async listStatusValues() {
      return resolveStatusValues('quotes', 'status', {
        platformFallback: QUOTE_STATUSES
      });
    },
    buildDefaults(values) {
      const closed = new Set(QUOTE_RECORD_READ_ONLY_STATUSES.map((s) => s.toLowerCase()));
      return values
        .filter((v) => closed.has(String(v).toLowerCase()))
        .map((statusValue) => ({ statusValue, reopenStatusValue: null }));
    }
  },

  sales_orders: {
    moduleKey: 'sales_orders',
    statusField: 'status',
    statusPicklistKey: 'sales_order_status',
    displayLabel: 'Sales Order',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/SalesOrder',
    entityTypeAlias: 'sales_order',
    async listStatusValues() {
      return resolveStatusValues('sales_orders', 'status', {
        platformFallback: SALES_ORDER_STATUSES
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^cancelled$/i, /^closed$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: null
      }));
    }
  },

  invoices: {
    moduleKey: 'invoices',
    statusField: 'status',
    statusPicklistKey: 'invoice_status',
    displayLabel: 'Invoice',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/Invoice',
    entityTypeAlias: 'invoice',
    async listStatusValues() {
      return resolveStatusValues('invoices', 'status', {
        platformFallback: INVOICE_STATUSES
      });
    },
    buildDefaults(values) {
      const closed = new Set(INVOICE_RECORD_READ_ONLY_STATUSES.map((s) => s.toLowerCase()));
      return values
        .filter((v) => closed.has(String(v).toLowerCase()))
        .map((statusValue) => ({ statusValue, reopenStatusValue: null }));
    }
  },

  payments: {
    moduleKey: 'payments',
    statusField: 'status',
    statusPicklistKey: 'payment_status',
    displayLabel: 'Payment',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/Payment',
    entityTypeAlias: 'payment',
    async listStatusValues() {
      return resolveStatusValues('payments', 'status', {
        platformFallback: PAYMENT_STATUSES
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/fully_refunded/i, /^reversed$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: null
      }));
    }
  },

  purchase_orders: {
    moduleKey: 'purchase_orders',
    statusField: 'status',
    statusPicklistKey: 'po_status',
    displayLabel: 'Purchase Order',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/PurchaseOrder',
    entityTypeAlias: 'purchase_order',
    async listStatusValues() {
      return resolveStatusValues('purchase_orders', 'status', {
        platformFallback: Object.values(PO_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^closed$/i, /^cancelled$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: null
      }));
    }
  },

  receipt_notes: {
    moduleKey: 'receipt_notes',
    statusField: 'status',
    statusPicklistKey: 'rn_status',
    displayLabel: 'Receipt Note',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/ReceiptNote',
    entityTypeAlias: 'receipt_note',
    async listStatusValues() {
      return resolveStatusValues('receipt_notes', 'status', {
        platformFallback: Object.values(RN_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^closed$/i, /^cancelled$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: null
      }));
    }
  },

  purchase_returns: {
    moduleKey: 'purchase_returns',
    statusField: 'status',
    statusPicklistKey: 'pr_status',
    displayLabel: 'Purchase Return',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/PurchaseReturn',
    entityTypeAlias: 'purchase_return',
    async listStatusValues() {
      return resolveStatusValues('purchase_returns', 'status', {
        platformFallback: Object.values(PR_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^settled$/i, /^closed$/i, /^cancelled$/i]).map(
        (statusValue) => ({ statusValue, reopenStatusValue: null })
      );
    }
  },

  delivery_notes: {
    moduleKey: 'delivery_notes',
    statusField: 'status',
    statusPicklistKey: 'dn_status',
    displayLabel: 'Delivery Note',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/DeliveryNote',
    entityTypeAlias: 'delivery_note',
    async listStatusValues() {
      return resolveStatusValues('delivery_notes', 'status', {
        platformFallback: Object.values(DN_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^delivered$/i, /^cancelled$/i, /^closed$/i]).map(
        (statusValue) => ({ statusValue, reopenStatusValue: null })
      );
    }
  },

  delivery_returns: {
    moduleKey: 'delivery_returns',
    statusField: 'status',
    statusPicklistKey: 'dr_status',
    displayLabel: 'Delivery Return',
    reopenEnabledDefault: false,
    allowLinkingDefault: true,
    modelPath: '../models/DeliveryReturn',
    entityTypeAlias: 'delivery_return',
    async listStatusValues() {
      return resolveStatusValues('delivery_returns', 'status', {
        platformFallback: Array.isArray(DR_STATUS_VALUES)
          ? DR_STATUS_VALUES
          : Object.values(DR_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^restocked$/i, /^cancelled$/i, /^closed$/i]).map(
        (statusValue) => ({ statusValue, reopenStatusValue: null })
      );
    }
  },

  sales_returns: {
    moduleKey: 'sales_returns',
    statusField: 'status',
    statusPicklistKey: 'sr_status',
    displayLabel: 'Sales Return',
    reopenEnabledDefault: false,
    allowLinkingDefault: false,
    modelPath: null,
    entityTypeAlias: 'sales_return',
    async listStatusValues() {
      return resolveStatusValues('sales_returns', 'status', {
        platformFallback: Object.values(SR_STATUSES)
      });
    },
    buildDefaults(values) {
      return matchValues(values, [/^closed$/i, /^cancelled$/i]).map((statusValue) => ({
        statusValue,
        reopenStatusValue: null
      }));
    }
  }
};

function getModuleDef(moduleKey) {
  const key = String(moduleKey || '')
    .trim()
    .toLowerCase();
  return MODULE_DEFS[key] || null;
}

function isEligibleModule(moduleKey) {
  return Boolean(getModuleDef(moduleKey));
}

function listEligibleModules() {
  return CLOSED_RECORDS_MODULE_KEYS.map((k) => {
    const def = MODULE_DEFS[k];
    return {
      moduleKey: k,
      statusField: def.statusField,
      statusPicklistKey: def.statusPicklistKey,
      displayLabel: def.displayLabel,
      reopenEnabledDefault: def.reopenEnabledDefault,
      allowLinkingDefault: def.allowLinkingDefault
    };
  });
}

function resolveModuleKeyFromEntityType(entityType) {
  const t = String(entityType || '')
    .trim()
    .toLowerCase();
  if (MODULE_DEFS[t]) return t;
  for (const [key, def] of Object.entries(MODULE_DEFS)) {
    if (def.entityTypeAlias === t) return key;
    if (`${def.entityTypeAlias}s` === t) return key;
  }
  if (t === 'salesorder' || t === 'salesorders') return 'sales_orders';
  if (t === 'purchaseorder' || t === 'purchaseorders') return 'purchase_orders';
  return null;
}

module.exports = {
  CLOSED_RECORDS_MODULE_KEYS,
  APP_MODULE_GROUPS,
  MODULE_DEFS,
  getModuleDef,
  isEligibleModule,
  listEligibleModules,
  resolveModuleKeyFromEntityType,
  loadModulePicklistValues,
  resolveStatusValues
};
