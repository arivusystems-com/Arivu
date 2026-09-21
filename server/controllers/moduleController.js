const ModuleDefinition = require('../models/ModuleDefinition');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const relationshipRegistry = require('../utils/relationshipRegistry');
const { getOutgoingRelationships, getIncomingRelationships } = require('../utils/relationshipRegistry');
const { filterFieldsByReadAccess, filterFieldsByWriteAccess, validateFieldWrite } = require('../utils/fieldAccessControl');
const { mergeFieldsForMergeTags } = require('../utils/mergeTagModuleFields');
const {
    normalizePeopleModuleFields,
    migratePeopleQuickCreateKeys,
    migratePeopleQuickCreateLayoutKeys,
} = require('../utils/normalizePeopleModuleConfig');
const { INITIAL_PEOPLE_QUICK_CREATE } = require('../constants/peopleModuleDefaults');
const {
    INITIAL_ORGANIZATION_QUICK_CREATE,
    INITIAL_ORGANIZATION_KEY_FIELDS,
} = require('../constants/organizationModuleDefaults');
const { INITIAL_DEALS_QUICK_CREATE } = require('../constants/dealsModuleDefaults');
const {
    INITIAL_CASES_QUICK_CREATE,
    isInitialCaseRequiredField,
    isCasesFormExcludedField,
} = require('../constants/casesModuleDefaults');
const {
    INITIAL_INVENTORY_FIELDS,
    INITIAL_INVENTORY_QUICK_CREATE,
    applyInventoryModuleFieldDefaults,
} = require('../constants/inventoryModuleDefaults');
const {
    INVENTORY_WORKBENCH_MODULES,
    INVENTORY_WORKBENCH_KEYS,
    resolveInventoryModuleModel,
    isInventorySchemaModuleKey,
} = require('../constants/inventoryWorkbenchModules');

const {
    getDefaultEmailValidations,
    ensurePhoneFieldDefaultValidations,
} = require('../utils/defaultFieldValidations');
const {
    INITIAL_QUOTE_QUICK_CREATE,
    isInitialQuoteRequiredField,
} = require('../constants/quoteModuleDefaults');
const {
    INITIAL_SALES_ORDER_QUICK_CREATE,
    isInitialSalesOrderRequiredField,
} = require('../constants/salesOrderModuleDefaults');
const {
    INITIAL_PURCHASE_ORDER_QUICK_CREATE,
    isInitialPurchaseOrderRequiredField,
    applyPurchaseOrderModuleFieldDefaults,
} = require('../constants/purchaseOrderModuleDefaults');
const {
    INITIAL_PURCHASE_RETURN_QUICK_CREATE,
    isInitialPurchaseReturnRequiredField,
    applyPurchaseReturnModuleFieldDefaults,
} = require('../constants/purchaseReturnModuleDefaults');
const {
    INITIAL_DELIVERY_RETURN_QUICK_CREATE,
    isInitialDeliveryReturnRequiredField,
    applyDeliveryReturnModuleFieldDefaults,
} = require('../constants/deliveryReturnModuleDefaults');
const {
    INITIAL_SALES_RETURN_QUICK_CREATE,
    isInitialSalesReturnRequiredField,
    applySalesReturnModuleFieldDefaults,
} = require('../constants/salesReturnModuleDefaults');
const {
    INITIAL_DELIVERY_NOTE_QUICK_CREATE,
    isInitialDeliveryNoteRequiredField,
    applyDeliveryNoteModuleFieldDefaults,
} = require('../constants/deliveryNoteModuleDefaults');
const {
    INITIAL_RECEIPT_NOTE_QUICK_CREATE,
    isInitialReceiptNoteRequiredField,
    applyReceiptNoteModuleFieldDefaults,
} = require('../constants/receiptNoteModuleDefaults');
const {
    INITIAL_STOCKROOM_QUICK_CREATE,
    isInitialStockroomRequiredField,
    applyStockroomModuleFieldDefaults,
} = require('../constants/stockroomModuleDefaults');
const {
    INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE,
    applyStockAdjustmentModuleFieldDefaults,
} = require('../constants/stockAdjustmentModuleDefaults');
const {
    INITIAL_STOCK_TRANSFER_QUICK_CREATE,
    applyStockTransferModuleFieldDefaults,
} = require('../constants/stockTransferModuleDefaults');
const {
    INITIAL_INVOICE_QUICK_CREATE,
    isInitialInvoiceRequiredField,
} = require('../constants/invoiceModuleDefaults');
const {
    INITIAL_PAYMENT_QUICK_CREATE,
    isInitialPaymentRequiredField,
} = require('../constants/paymentModuleDefaults');
const { cloneQuoteDefaultRelationships } = require('../constants/defaultQuoteRelationships');
const {
    INITIAL_DOCUMENT_QUICK_CREATE,
    cloneDocumentDefaultRelationships,
    applyDocumentModuleFieldDefaults
} = require('../constants/documentModuleDefaults');
const {
    ensureDocumentRelationshipDefinitions,
    isDocumentRelationshipKey,
    cloneDocumentInverseRelationship,
    DOCUMENT_ATTACHMENT_MODULES
} = require('../constants/defaultDocumentRelationships');
const { DEFAULT_TASK_TYPE_OPTIONS } = require('../constants/taskTypes');
const { filterFieldsByContext } = require('../utils/fieldContextFilter');
const {
    isModuleOwnerField,
    applyOwnerFieldRequiredToModuleFields
} = require('../utils/recordCreateOwnerDefaults');

/** Core event create fields that are always required (schema + UX asterisk). */
function isInitialEventRequiredField(name) {
    const k = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return k === 'eventname'
        || k === 'eventtype'
        || k === 'status'
        || k === 'startdatetime'
        || k === 'enddatetime'
        || k === 'assignedto';
}

const MODULE_APP_KEY_BY_KEY = Object.freeze({
    people: 'sales',
    organizations: 'sales',
    deals: 'sales',
    quotes: 'platform',
    sales_orders: 'platform',
    invoices: 'platform',
    payments: 'platform',
    documents: 'platform',
    tasks: 'platform',
    events: 'platform',
    forms: 'platform',
    items: 'platform',
    projects: 'projects',
    cases: 'helpdesk'
});

function resolveModuleAppKey(moduleKey, fallback = 'platform') {
    const key = String(moduleKey || '').toLowerCase().trim();
    if (!key) return String(fallback || 'platform').toLowerCase();
    return MODULE_APP_KEY_BY_KEY[key] || String(fallback || 'platform').toLowerCase();
}

function normalizeRelationshipCardinality(rawType) {
    const normalized = String(rawType || '').toLowerCase().trim();
    if (normalized === 'one_to_one') return 'ONE_TO_ONE';
    if (normalized === 'one_to_many') return 'ONE_TO_MANY';
    if (normalized === 'many_to_one' || normalized === 'lookup') return 'MANY_TO_ONE';
    return 'MANY_TO_MANY';
}

async function ensureDocumentRelationshipsIfReferenced(relationships, sourceModuleKey = '') {
    const moduleKey = String(sourceModuleKey || '').toLowerCase();
    const keys = (Array.isArray(relationships) ? relationships : [])
        .map((row) => String(row?.relationshipKey || '').trim().toLowerCase())
        .filter(Boolean);
    const targetsDocuments = (Array.isArray(relationships) ? relationships : []).some((row) => {
        const raw = row?.targetModuleKey ?? row?.targetModule;
        const target = typeof raw === 'object'
            ? String(raw.key ?? raw.moduleKey ?? '').toLowerCase().trim()
            : String(raw || '').toLowerCase().trim();
        return target === 'documents';
    });
    const needsEnsure = DOCUMENT_ATTACHMENT_MODULES.includes(moduleKey)
        || targetsDocuments
        || keys.some((key) => isDocumentRelationshipKey(key));
    if (!needsEnsure) return;
    await ensureDocumentRelationshipDefinitions();
    await relationshipRegistry.refreshRelationshipKeyCache();
}

async function ensurePlatformRelationshipDefinition({
    relationshipKey,
    sourceAppKey,
    sourceModuleKey,
    targetModuleKey,
    relationshipType
}) {
    const cardinality = normalizeRelationshipCardinality(relationshipType);
    const ownership = cardinality === 'MANY_TO_ONE' ? 'TARGET' : 'SOURCE';
    const normalizedKey = String(relationshipKey || '').trim().toLowerCase();
    const normalizedSourceAppKey = resolveModuleAppKey(sourceModuleKey, sourceAppKey);
    const normalizedSourceModuleKey = String(sourceModuleKey || '').toLowerCase().trim();
    const normalizedTargetModuleKey = String(targetModuleKey || '').toLowerCase().trim();
    const normalizedTargetAppKey = resolveModuleAppKey(targetModuleKey, 'platform');

    if (!normalizedKey || !normalizedSourceModuleKey || !normalizedTargetModuleKey) return false;

    await RelationshipDefinition.updateOne(
        { relationshipKey: normalizedKey },
        {
            $setOnInsert: {
                relationshipKey: normalizedKey,
                source: {
                    appKey: normalizedSourceAppKey,
                    moduleKey: normalizedSourceModuleKey
                },
                target: {
                    appKey: normalizedTargetAppKey,
                    moduleKey: normalizedTargetModuleKey
                },
                cardinality,
                relationshipType: cardinality,
                ownership,
                required: false,
                userLinkable: true,
                display: {
                    coreFields: false,
                    relatedSummary: true,
                    relatedExplorer: true,
                    linkRecord: true
                },
                cascade: { onDelete: 'DETACH' },
                automation: { allowed: true },
                enabled: true
            }
        },
        { upsert: true }
    );

    return true;
}

function relationshipMatchesModule(def, sourceAppKey, sourceModuleKey, targetModuleKey) {
    if (!def) return false;
    const outgoingMatch =
        def.source.appKey === sourceAppKey &&
        def.source.moduleKey === sourceModuleKey &&
        def.target.moduleKey === targetModuleKey;
    const incomingMatch =
        def.target.appKey === sourceAppKey &&
        def.target.moduleKey === sourceModuleKey &&
        def.source.moduleKey === targetModuleKey;
    return outgoingMatch || incomingMatch;
}

/** Canonical key for field dedup: lowercase, trim, strip spaces and hyphens (so "deleted-by", "deletedBy", "Deleted By" all match) */
function fieldKeyCanonical(k) {
  return String(k || '').toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
}

/** Dedupe fields by canonical key, preferring programmatic keys (no spaces) */
function dedupeFieldsByKey(fields) {
  if (!Array.isArray(fields)) return fields;
  const byCanonical = new Map();
  for (const f of fields) {
    const k = fieldKeyCanonical(f?.key);
    if (!k) continue;
    const existing = byCanonical.get(k);
    if (!existing || ((f.key || '').indexOf(' ') === -1 && (existing.key || '').indexOf(' ') !== -1)) {
      byCanonical.set(k, f);
    }
  }
  return Array.from(byCanonical.values());
}

/** Picklists whose option catalog is tenant-managed in ModuleDefinition (not fixed by schema enum). */
const TENANT_PICKLIST_OPTION_SOURCE_FIELDS = {
    tasks: new Set(['status', 'priority', 'taskType']),
    organizations: new Set([
        'types',
        'industry',
        'customerStatus',
        'customerTier',
        'partnerStatus',
        'partnerTier',
        'partnerType',
        'vendorStatus',
        'dealerLevel',
        // Virtual participation roles — options SoT is organizationParticipationTypes;
        // Field Config edits must survive merge until enrich overlays the policy.
        'sales_type',
        'helpdesk_role',
        'inventory_role',
        'marketing_role',
        'portal_role',
    ]),
};

function usesSavedPicklistOptionsAsSourceOfTruth(moduleKey, fieldKey) {
    const mod = String(moduleKey || '').toLowerCase();
    const fields = TENANT_PICKLIST_OPTION_SOURCE_FIELDS[mod];
    if (!fields) return false;
    return fields.has(String(fieldKey || ''));
}

function mergeSavedPicklistOptionsWithBase(savedOptions, baseOptions) {
    const baseOptionByValue = new Map(
        (Array.isArray(baseOptions) ? baseOptions : [])
            .map((opt) => {
                const v = opt && typeof opt === 'object'
                    ? String(opt.value ?? opt.key ?? '').trim()
                    : String(opt || '').trim();
                return v ? [v, opt] : null;
            })
            .filter(Boolean)
    );
    return (Array.isArray(savedOptions) ? savedOptions : [])
        .map((opt) => {
            const value = opt && typeof opt === 'object'
                ? String(opt.value ?? opt.key ?? '').trim()
                : String(opt || '').trim();
            if (!value) return null;
            const baseMeta = baseOptionByValue.get(value) || null;
            const merged = baseMeta && typeof baseMeta === 'object'
                ? { ...baseMeta, ...(opt && typeof opt === 'object' ? opt : {}), value }
                : (opt && typeof opt === 'object' ? { ...opt, value } : { value });
            return merged;
        })
        .filter(Boolean);
}

function normalizeMeetingEventTypeLabel(value) {
  return String(value || '').trim() === 'Meeting / Appointment' ? 'Meeting' : value;
}

function normalizeEventTypeOptions(options) {
  if (!Array.isArray(options)) return options;

  const normalized = [];
  const seen = new Set();

  for (const option of options) {
    const rawValue =
      option && typeof option === 'object'
        ? String(option.value ?? option.key ?? '').trim()
        : String(option || '').trim();
    const value = normalizeMeetingEventTypeLabel(rawValue);
    if (!value) continue;

    const dedupeKey = value.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (option && typeof option === 'object') {
      normalized.push({ ...option, value });
    } else {
      normalized.push(value);
    }
  }

  return normalized;
}

function normalizeEventTypeDependencies(dependencies) {
  if (!Array.isArray(dependencies)) return dependencies;
  return dependencies.map((dep) => {
    if (!dep || dep.fieldKey !== 'eventType') return dep;
    const next = { ...dep };
    if (Array.isArray(next.value)) {
      next.value = Array.from(
        new Set(
          next.value
            .map((v) => normalizeMeetingEventTypeLabel(v))
            .filter((v) => String(v || '').trim() !== '')
            .map((v) => String(v).trim())
        )
      );
    } else {
      next.value = normalizeMeetingEventTypeLabel(next.value);
    }
    return next;
  });
}

function normalizeEventFieldConfig(field) {
  if (!field || typeof field !== 'object') return field;
  const next = { ...field };
  if (String(next.key || '').toLowerCase() === 'eventtype') {
    next.options = normalizeEventTypeOptions(next.options);
    next.defaultValue = normalizeMeetingEventTypeLabel(next.defaultValue);
  }
  // Status is always present (lifecycle vocabulary); type default seeded on create
  if (String(next.key || '').toLowerCase() === 'status') {
    next.required = true;
    next.dataType = next.dataType || 'Picklist';
  }
  next.dependencies = normalizeEventTypeDependencies(next.dependencies);
  return next;
}

/**
 * Validate field mutations based on ownership rules
 * 
 * For complete ownership rules, see: /docs/field-governance.md
 * 
 * Rules:
 * - owner = 'platform': Cannot be deleted, renamed, type-changed, or hidden globally
 * - owner = 'app': Cannot be deleted via UI, cannot be renamed by org users
 * - owner = 'org': Can be deleted/renamed by org admin only
 * 
 * @param {Array} oldFields - Existing fields from database
 * @param {Array} newFields - New fields from request
 * @param {Object} user - User making the request (for org admin check)
 * @returns {Object} { valid: boolean, error: string|null, violations: Array }
 */
function validateFieldMutations(oldFields, newFields, user) {
  if (!Array.isArray(oldFields) || !Array.isArray(newFields)) {
    return { valid: true, error: null, violations: [] }; // Skip validation if arrays invalid
  }

  const violations = [];
  const oldFieldsMap = new Map();
  const newFieldsMap = new Map();

  // Build maps for efficient lookup
  oldFields.forEach(f => {
    if (f && f.key) {
      oldFieldsMap.set(f.key.toLowerCase(), f);
    }
  });

  newFields.forEach(f => {
    if (f && f.key) {
      newFieldsMap.set(f.key.toLowerCase(), f);
    }
  });

  // Check for deletions and mutations
  for (const [keyLower, oldField] of oldFieldsMap) {
    const newField = newFieldsMap.get(keyLower);
    const owner = oldField.owner || 'platform'; // Default to platform if not set

    // Field was deleted
    if (!newField) {
      if (owner === 'platform') {
        violations.push({
          field: oldField.key,
          operation: 'delete',
          reason: 'Platform fields cannot be deleted.'
        });
      } else if (owner === 'app') {
        violations.push({
          field: oldField.key,
          operation: 'delete',
          reason: 'App-managed fields cannot be deleted by organization users.'
        });
      }
      // owner === 'org' is allowed (checked below)
      continue;
    }

    // Field exists in both - check for mutations
    // Check for rename (key changed but same position/identity - this is tricky, so we'll check if key changed)
    // Actually, if key changed, it's a delete + add, which we handle above
    // So here we check for type changes and other mutations

    // Immutable structural properties for platform/app-managed fields:
    // Preserve canonical type server-side so dependency-only edits are not blocked by
    // incidental client normalization drift (e.g. hidden tenant infra fields).
    if ((owner === 'platform' || owner === 'app') && oldField.dataType && newField.dataType && oldField.dataType !== newField.dataType) {
      newField.dataType = oldField.dataType;
    }

    // Check for type change
    if (oldField.dataType && newField.dataType && oldField.dataType !== newField.dataType) {
      if (owner === 'platform') {
        violations.push({
          field: oldField.key,
          operation: 'type-change',
          reason: 'Platform fields cannot have their type changed.'
        });
      }
      // app and org fields can have type changed (with existing constraints)
    }

    // Check for rename (key changed)
    // Note: This is detected as a delete + add, handled above
    // But we also need to check if the field key itself was modified
        if (
            String(oldField.key || '').toLowerCase() !==
            String(newField.key || '').toLowerCase()
        ) {
      if (owner === 'platform') {
        violations.push({
          field: oldField.key,
          operation: 'rename',
          reason: 'Platform fields cannot be renamed.'
        });
      } else if (owner === 'app') {
        violations.push({
          field: oldField.key,
          operation: 'rename',
          reason: 'App-managed fields cannot be renamed by organization users.'
        });
      }
      // owner === 'org' is allowed
    }
  }

  // Check for org-owned field deletions (require org admin)
  // This is handled by checking if user is org admin - but we don't have that info here
  // We'll let it through and check permissions at a higher level if needed

  if (violations.length > 0) {
    const firstViolation = violations[0];
    return {
      valid: false,
      error: firstViolation.reason,
      violations: violations
    };
  }

  return { valid: true, error: null, violations: [] };
}

/**
 * When saving module field config, "removed" platform/app fields are re-added as hidden
 * so validation passes and the UI no longer shows them. This avoids 403 on save.
 *
 * @param {Array} oldFields - Existing fields from database
 * @param {Array} newFields - New fields from request (may omit some fields)
 * @returns {Array} - newFields with any missing platform/app fields re-added as hidden
 */
function mergeRemovedPlatformOrAppFieldsAsHidden(oldFields, newFields) {
  if (!Array.isArray(oldFields) || !Array.isArray(newFields)) return newFields;
  const newKeys = new Set(newFields.filter(f => f && f.key).map(f => f.key.toLowerCase()));
  const merged = [...newFields];
  for (const oldField of oldFields) {
    if (!oldField || !oldField.key) continue;
    const owner = (oldField.owner || 'platform').toLowerCase();
    if (owner !== 'platform' && owner !== 'app') continue;
    if (newKeys.has(oldField.key.toLowerCase())) continue;
    merged.push({
      ...oldField,
      visibility: { list: false, detail: false }
    });
  }
  return merged;
}

/**
 * Get default notification metadata for system modules.
 * Phase 17: Notification Rules - Default configuration for rule-eligible modules.
 */
function getDefaultNotificationMetadata(moduleKey) {
  const defaults = {
    tasks: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo', 'priority', 'status']
    },
    deals: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo', 'status']
    },
    people: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo']
    },
    organizations: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo']
    },
    events: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo', 'status']
    },
    cases: {
      ruleEligible: true,
      supportedEvents: ['ASSIGNED', 'STATUS_CHANGED'],
      supportedConditions: ['assignedTo', 'priority', 'status']
    }
    // Other modules (forms, items, imports, reports, users) are not rule-eligible by default
  };
  
  return defaults[moduleKey] || {
    ruleEligible: false,
    supportedEvents: [],
    supportedConditions: []
  };
}

 

// Utility to count fields from a Mongoose model schema (excluding system fields)
function getSchemaFieldCount(model) {
    if (!model || !model.schema) return 0;
    const paths = Object.keys(model.schema.paths || {});
    const excluded = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
    return paths.filter(p => !excluded.has(p)).length;
}

function inferDataType(path) {
    const instance = path.instance || (path.options && path.options.type && path.options.type.name);
    switch ((instance || '').toLowerCase()) {
        case 'string': return 'Text';
        case 'number': return 'Decimal';
        case 'boolean': return 'Checkbox';
        case 'date': return 'Date';
        case 'objectid': return 'Lookup (Relationship)';
        default: return 'Text';
    }
}

// Field-specific data type mappings for People module
function getFieldDataType(key, fieldName, path) {
    const peopleFieldMappings = {
        'createdBy': 'Lookup (Relationship)',
        'assignedTo': 'Lookup (Relationship)',
        'source': 'Picklist',
        'sales_type': 'Picklist',
        'salutation': 'Picklist',
        'first_name': 'Text',
        'last_name': 'Text',
        'email': 'Email',
        'phone': 'Phone',
        'mobile': 'Phone',
        'organization': 'Lookup (Relationship)',
        'tags': 'Multi-Picklist',
        'do_not_contact': 'Checkbox',
        'lead_status': 'Picklist',
        'lead_owner': 'Lookup (Relationship)',
        'lead_score': 'Integer',
        'interest_products': 'Multi-Picklist',
        'qualification_date': 'Date',
        'qualification_notes': 'Text-Area',
        'estimated_value': 'Currency',
        'contact_status': 'Picklist',
        'role': 'Picklist',
        'birthday': 'Date',
        'preferred_contact_method': 'Radio Button'
    };
    
    const organizationFieldMappings = {
        'name': 'Text',
        'types': 'Multi-Picklist',
        'website': 'URL',
        'phone': 'Phone',
        'address': 'Text-Area',
        'industry': 'Picklist',
        'assignedTo': 'Lookup (Relationship)',
        'primaryContact': 'Lookup (Relationship)',
        'customerStatus': 'Picklist',
        'customerTier': 'Picklist',
        'slaLevel': 'Picklist',
        'paymentTerms': 'Text',
        'creditLimit': 'Currency',
        'accountManager': 'Lookup (Relationship)',
        'annualRevenue': 'Currency',
        'numberOfEmployees': 'Integer',
        'partnerStatus': 'Picklist',
        'partnerTier': 'Picklist',
        'partnerType': 'Picklist',
        'partnerSince': 'Date',
        'partnerOnboardingSteps': 'Multi-Picklist',
        'territory': 'Picklist',
        'discountRate': 'Decimal',
        'vendorStatus': 'Picklist',
        'vendorRating': 'Integer',
        'vendorContract': 'URL',
        'preferredPaymentMethod': 'Picklist',
        'taxId': 'Text',
        'channelRegion': 'Picklist',
        'distributionTerritory': 'Multi-Picklist',
        'distributionCapacityMonthly': 'Integer',
        'dealerLevel': 'Picklist',
        'terms': 'Rich Text',
        'shippingAddress': 'Text-Area',
        'logisticsPartner': 'Lookup (Relationship)'
    };
    
    const dealFieldMappings = {
        'name': 'Text',
        'amount': 'Currency',
        'amountMode': 'Picklist',
        'currency': 'Picklist',
        'pipeline': 'Picklist',
        'stage': 'Picklist',
        'type': 'Picklist',
        'assignedTo': 'Lookup (Relationship)',
        'accountId': 'Lookup (Relationship)',
        'contactId': 'Lookup (Relationship)',
        'probability': 'Decimal',
        'expectedCloseDate': 'Date',
        'actualCloseDate': 'Date',
        'source': 'Picklist',
        'nextStep': 'Text-Area',
        'status': 'Picklist',
        'lostReason': 'Text-Area',
        'tags': 'Multi-Picklist',
        'priority': 'Picklist',
        'description': 'Rich Text',
        'createdBy': 'Lookup (Relationship)',
        'modifiedBy': 'Lookup (Relationship)',
        'createdAt': 'Date-Time',
        'updatedAt': 'Date-Time'
    };
    
    const eventFieldMappings = {
        'eventId': 'Auto-Number',
        'eventName': 'Text',
        'eventType': 'Picklist',
        'status': 'Picklist',
        'relatedToId': 'Lookup (Relationship)',
        'relatedToType': 'Picklist',
        'assignedTo': 'Lookup (Relationship)', // Label: "Event Owner"
        'startDateTime': 'Date-Time',
        'endDateTime': 'Date-Time',
        'location': 'Text-Area',
        'meetingMode': 'Picklist',
        'meetingLink': 'Text',
        'conferenceProvider': 'Picklist',
        'reminderAt': 'Date-Time',
        'recurrence': 'Picklist',
        'attendees': 'Multi-Picklist',
        'agendaNotes': 'Text-Area',
        'linkedTaskId': 'Lookup (Relationship)',
        'linkedFormId': 'Lookup (Relationship)',
        'tags': 'Multi-Picklist',
        'auditHistory': 'Rich Text',
        'notes': 'Text-Area',
        'organizationId': 'Lookup (Relationship)',
        'createdBy': 'Lookup (Relationship)',
        'createdTime': 'Date-Time',
        'modifiedBy': 'Lookup (Relationship)',
        'modifiedTime': 'Date-Time'
    };
    
    const formFieldMappings = {
        'organizationId': 'Lookup (Relationship)',
        'formId': 'Auto-Number',
        'name': 'Text',
        'description': 'Text-Area',
        'formType': 'Picklist',
        'visibility': 'Picklist',
        'status': 'Picklist',
        'assignedTo': 'Lookup (Relationship)',
        'expiryDate': 'Date',
        'tags': 'Multi-Picklist',
        'approvalRequired': 'Checkbox',
        'scoringFormula': 'Text',
        'formVersion': 'Integer',
        'totalResponses': 'Integer',
        'avgRating': 'Decimal',
        'avgCompliance': 'Decimal',
        'responseRate': 'Decimal',
        'lastSubmission': 'Date-Time',
        'createdBy': 'Lookup (Relationship)',
        'modifiedBy': 'Lookup (Relationship)'
    };
    
    // Check if this is a People module field with specific mapping
    if (key === 'people' && peopleFieldMappings[fieldName]) {
        return peopleFieldMappings[fieldName];
    }
    
    // Check if this is an Organizations module field with specific mapping
    if (key === 'organizations' && organizationFieldMappings[fieldName]) {
        return organizationFieldMappings[fieldName];
    }
    
    if (key === 'deals' && dealFieldMappings[fieldName]) {
        return dealFieldMappings[fieldName];
    }
    
    if (key === 'events' && eventFieldMappings[fieldName]) {
        return eventFieldMappings[fieldName];
    }
    
    if (key === 'forms' && formFieldMappings[fieldName]) {
        return formFieldMappings[fieldName];
    }

    const caseFieldMappings = {
        caseId: 'Auto-Number',
        title: 'Text',
        description: 'Text-Area',
        caseType: 'Picklist',
        priority: 'Picklist',
        status: 'Picklist',
        assignedTo: 'Lookup (Relationship)',
        contactId: 'Lookup (Relationship)',
        organizationRefId: 'Lookup (Relationship)',
        resolutionSummary: 'Text-Area',
        closureNotes: 'Text-Area',
        reopenReason: 'Text-Area',
        caseNotes: 'Text-Area',
        tags: 'Multi-Picklist'
    };
    if (key === 'cases' && caseFieldMappings[fieldName]) {
        return caseFieldMappings[fieldName];
    }
    
    // Items module field mappings
    const itemFieldMappings = {
        'product_image': 'Image',
        'item_id': 'Auto-Number',
        'item_name': 'Text',
        'item_code': 'Text',
        'item_type': 'Picklist',
        'category': 'Picklist',
        'categoryId': 'Lookup (Relationship)',
        'subcategory': 'Picklist',
        'unit_of_measure': 'Picklist',
        'status': 'Picklist',
        'lifecycle_state': 'Picklist',
        'description': 'Text-Area',
        'cost_price': 'Currency',
        'selling_price': 'Currency',
        'tax_type': 'Picklist',
        'tax_percentage': 'Decimal',
        'commission_rate': 'Decimal',
        'warranty_period_months': 'Integer',
        'serial_numbers': 'Multi-Picklist',
        'stock_quantity': 'Integer',
        'reorder_level': 'Integer',
        'vendor': 'Lookup (Relationship)',
        'linked_deals': 'Multi-Picklist',
        'linked_invoices': 'Multi-Picklist',
        'linked_forms': 'Multi-Picklist',
        'linked_contacts': 'Multi-Picklist',
        'tags': 'Multi-Picklist',
        'assignedTo': 'Lookup (Relationship)'
    };
    
    if (key === 'items' && itemFieldMappings[fieldName]) {
        return itemFieldMappings[fieldName];
    }
    // Tasks: status/priority are Picklists (options from module config); relatedTo is Lookup
    // tags: string[] must be Multi-Picklist — otherwise inferDataType treats Array as Text and create/edit uses wrong control
    const taskFieldMappings = {
        'status': 'Picklist',
        'priority': 'Picklist',
        'taskType': 'Picklist',
        'relatedTo': 'Lookup (Relationship)',
        'tags': 'Multi-Picklist'
    };
    if (key === 'tasks' && taskFieldMappings[fieldName]) {
        return taskFieldMappings[fieldName];
    }

    const quoteFieldMappings = {
        quoteTitle: 'Text',
        quoteDate: 'Date',
        validUntil: 'Date',
        status: 'Picklist',
        currency: 'Picklist',
        assignedTo: 'Lookup (Relationship)',
        contactId: 'Lookup (Relationship)',
        organizationRefId: 'Lookup (Relationship)',
        dealId: 'Lookup (Relationship)',
    };
    if (key === 'quotes' && quoteFieldMappings[fieldName]) {
        return quoteFieldMappings[fieldName];
    }

    const purchaseOrderFieldMappings = {
        currency: 'Picklist',
        deliveryMethod: 'Picklist',
        overallDiscountType: 'Picklist',
        status: 'Picklist'
    };
    if (key === 'purchase_orders' && purchaseOrderFieldMappings[fieldName]) {
        return purchaseOrderFieldMappings[fieldName];
    }

    // Fall back to inference based on schema type
    return inferDataType(path);
}

const {
    getPeopleParticipationStatusModuleFields,
} = require('../utils/peopleModuleFieldDefaults');

/** People virtual fields: participation roles exposed as configurable fields (no extra DB columns). */
function getPeopleVirtualBaseFields() {
    return [
        {
            key: 'sales_type',
            label: 'Sales Type',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0
        },
        {
            key: 'helpdesk_role',
            label: 'Helpdesk Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Customer', 'Agent'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'helpdesk',
            isVirtual: true,
            appKey: 'HELPDESK',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0
        }
    ];
}

/** Organizations virtual fields: per-app participation roles (mirrors People). */
function getOrganizationVirtualBaseFields() {
    return [
        {
            key: 'sales_type',
            label: 'Sales Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Lead', 'Customer'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'sales',
            isVirtual: true,
            appKey: 'SALES',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0,
        },
        {
            key: 'helpdesk_role',
            label: 'Helpdesk Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Customer'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'helpdesk',
            isVirtual: true,
            appKey: 'HELPDESK',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0,
        },
        {
            key: 'inventory_role',
            label: 'Inventory Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Vendor'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'inventory',
            isVirtual: true,
            appKey: 'INVENTORY',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0,
        },
        {
            key: 'marketing_role',
            label: 'Marketing Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Marketing Lead', 'Customer'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'marketing',
            isVirtual: true,
            appKey: 'MARKETING',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0,
        },
        {
            key: 'portal_role',
            label: 'Portal Type',
            dataType: 'Picklist',
            keyField: false,
            required: false,
            options: ['Partner'],
            defaultValue: null,
            visibility: { list: true, detail: true },
            owner: 'platform',
            context: 'portal',
            isVirtual: true,
            appKey: 'PORTAL',
            filterable: true,
            filterType: 'multi-select',
            filterPriority: 2,
            dependencies: [],
            validations: [],
            lookupSettings: null,
            index: false,
            placeholder: '',
            order: 0,
        },
    ];
}

function getBaseFieldsForKey(key) {
    try {
        if (isInventorySchemaModuleKey(key) && key !== 'inventory') {
            // Prefer dedicated inventory catalog (master schema, no full model map).
            try {
                const {
                    getInventoryModuleFieldCatalog
                } = require('../services/inventoryModuleFieldCatalogService');
                const invFields = getInventoryModuleFieldCatalog(key);
                if (Array.isArray(invFields) && invFields.length > 0) {
                    return invFields;
                }
            } catch (invCatalogErr) {
                console.warn(
                    `[getBaseFieldsForKey] inventory catalog for ${key}:`,
                    invCatalogErr?.message || invCatalogErr
                );
            }
        }
        const taskDefaultFieldOrder = [
            'title',
            'status',
            'priority',
            'taskType',
            'startDate',
            'dueDate',
            'assignedTo',
            'relatedTo',
            'estimatedHours'
        ];
        const peopleDefaultFieldOrder = [
            'salutation',
            'first_name',
            'last_name',
            'email',
            'phone',
            'mobile',
            'organization',
            'assignedTo',
            'tags',
            'do_not_contact',
            'source'
        ];
        const casesDefaultFieldOrder = [
            'caseId',
            'title',
            'status',
            'priority',
            'caseType',
            'assignedTo',
            'contactId',
            'organizationRefId',
            'channel',
            'severity',
            'impact',
            'description',
            'caseNotes',
            'resolutionSummary',
            'rootCause',
            'resolutionCode',
            'closureNotes',
            'reopenReason',
            'resolvedAt',
            'resolvedBy'
        ];
        const modelByKey = {
            people: require('../models/People'),
            organizations: require('../models/Organization'),
            deals: require('../models/Deal'),
            quotes: require('../models/Quote'),
            sales_orders: require('../models/SalesOrder'),
            invoices: require('../models/Invoice'),
            payments: require('../models/Payment'),
            tasks: require('../models/Task'),
            cases: require('../models/Case'),
            events: require('../models/Event'),
            imports: require('../models/ImportHistory'),
            forms: require('../models/Form'),
            items: require('../models/Item'),
            responses: require('../models/FormResponse'),
            documents: require('../models/Document'),
            purchase_orders: resolveInventoryModuleModel('purchase_orders'),
            receipt_notes: resolveInventoryModuleModel('receipt_notes'),
            purchase_returns: resolveInventoryModuleModel('purchase_returns'),
            delivery_notes: resolveInventoryModuleModel('delivery_notes'),
            delivery_returns: resolveInventoryModuleModel('delivery_returns'),
            sales_returns: resolveInventoryModuleModel('sales_returns'),
            stockrooms: resolveInventoryModuleModel('stockrooms'),
            stock_adjustments: resolveInventoryModuleModel('stock_adjustments'),
            stock_transfers: resolveInventoryModuleModel('stock_transfers'),
        };
        const model = modelByKey[key];
        if (!model) return [];
        // System fields that should be excluded from forms (auto-generated or system-managed)
        // RULE: New system fields (e.g. trash: deletedAt, deletedBy, deletionReason) MUST be added here
        // so they never appear in create/edit flows. See .cursor/rules/system-field-exclusion.mdc
        const excluded = new Set([
            '_id', 
            '__v', 
            'createdAt', 
            'updatedAt',
            'source', // System-managed creation channel; never user-editable in forms
            'customFields',   // Storage bucket for user-defined custom field values; not a configurable field
            'eventId',        // Auto-generated UUID
            'organizationId', // Auto-filled from user context (but keep for forms module)
            'createdBy',      // Keep for forms module (it's a valid field)
            'createdTime',    // Auto-filled timestamp
            'modifiedBy',      // Keep for forms module (it's a valid field)
            'modifiedTime',   // Auto-filled on update
            'auditHistory',   // System-managed audit trail
            // Trash (soft delete) - never show in create/edit
            'deletedAt',
            'deletedBy',
            'deletionReason',
            'calendarSync',
            'playbookState',
            // Connector sync metadata — set by integrations only; never create/edit UI
            'externalReferenceId',
            'syncStatus',
            'lastSyncAt',
            // Import job linkage - set by import pipeline only
            'importHistoryId',
            // Auto-number fields (system-generated Record IDs)
            'personNumber',
            'organizationNumber',
            'dealNumber',
            'taskNumber',
            'eventNumber',
            'formNumber',
            'responseNumber',
            'recordNumber',
            'articleNumber',
            'blogNumber',
            'segmentNumber',
            'templateNumber',
            // People portal access — system-managed
            'portalAccess',
            // Form-specific nested objects that shouldn't be fields
            'sections',       // Nested structure
            'kpiMetrics',    // Nested object
            'thresholds',    // Nested object
            'autoAssignment', // Nested object
            'workflowOnSubmit', // Nested object
            'approvalWorkflow', // Nested object
            'publicLink',    // Nested object
            'outcomesAndRules', // Nested object
            'responseTemplate' // Nested object
        ]);
        
        // For forms module, don't exclude organizationId, createdBy, modifiedBy
        if (key === 'forms') {
            excluded.delete('organizationId');
            excluded.delete('createdBy');
            excluded.delete('modifiedBy');
        }
        // Access both paths and tree to get enum values reliably
        const schemaTree = model.schema.tree || {};
        const taskDefaultKeyFields = new Set([
            'status',
            'assignedTo',
            'startDate',
            'dueDate',
            'priority',
            'estimatedHours'
        ]);
        const peopleDefaultKeyFields = new Set([
            'organization',
            'email',
            'phone',
            'assignedTo'  // owner (assigned user)
        ]);
        const organizationDefaultKeyFields = new Set(INITIAL_ORGANIZATION_KEY_FIELDS);
        const itemsDefaultKeyFields = new Set([
            'item_type',
            'item_code',
            'categoryId',
            'selling_price',
            'lifecycle_state',
            'assignedTo',
        ]);
        let baseFields = Object.entries(model.schema.paths)
            .filter(([name]) => {
                // Exclude if the field name is in the excluded set
                if (excluded.has(name)) return false;
                // Tasks: expose only the single "relatedTo" field, not nested relatedTo.type / relatedTo.id
                if (key === 'tasks' && (name === 'relatedTo.type' || name === 'relatedTo.id')) return false;
                // People: portalAccess is system-managed — exclude nested mongoose paths
                if (key === 'people' && name.startsWith('portalAccess.')) return false;
                if (key === 'cases') {
                    if (isCasesFormExcludedField(name)) return false;
                    const topLevel = String(name || '').split('.')[0];
                    if (topLevel && isCasesFormExcludedField(topLevel)) return false;
                }
                // Items: legacy status (Active/Inactive) is dual-written from lifecycle_state — hide from field config
                if (key === 'items' && name === 'status') return false;
                if (key === 'organizations') {
                    const { isTenantPlatformOrganizationFieldPath } = require('../constants/organizationTenantPlatformFields');
                    if (isTenantPlatformOrganizationFieldPath(name)) return false;
                    // Mixed internal CRM field — not exposed in module config or create/edit
                    if (name === 'partnerOnboardingSteps') return false;
                    // App participation map — virtual role fields are flattened for config
                    if (name === 'participations') return false;
                }
                if (key === 'quotes') {
                    const quotesSchemaExcluded = new Set([
                        'revisionNumber',
                        'activeRevision',
                        'sourceQuoteId',
                        'quoteNumber',
                        'sourceContext',
                        'sourceRef',
                        'exchangeRateSnapshot',
                        'globalDiscountType',
                        'globalDiscountValue',
                        'globalDiscountAmount',
                        'subtotal',
                        'lineDiscountTotal',
                        'globalDiscountTotal',
                        'taxTotal',
                        'chargesTotal',
                        'transactionTaxSnapshot',
                        'chargeDocumentSnapshot',
                        'taxDocumentSnapshot',
                        'adjustmentTotal',
                        'grandTotal',
                        'approvalRequired',
                        'approvalStatus',
                        'approvalLocked',
                        'sentToCustomer',
                        'sentAt',
                        'publicShareToken',
                        'portalAccessEnabled',
                        'customerShareMode',
                        'draftSharedAt',
                        'customerResponse',
                        'converted',
                        'conversionStatus',
                        'customerId',
                        'caseId',
                        'customRecordId'
                    ]);
                    if (quotesSchemaExcluded.has(name)) return false;
                    if (name.startsWith('customerResponse.')) return false;
                }
                if (key === 'sales_orders') {
                    const salesOrdersSchemaExcluded = new Set([
                        'salesOrderId',
                        'subtotal',
                        'lineDiscountTotal',
                        'sectionDiscountTotal',
                        'globalDiscountType',
                        'globalDiscountValue',
                        'globalDiscountAmount',
                        'globalDiscountTotal',
                        'taxTotal',
                        'chargesTotal',
                        'transactionTaxSnapshot',
                        'chargeDocumentSnapshot',
                        'taxDocumentSnapshot',
                        'adjustmentTotal',
                        'exchangeRateSnapshot',
                        'customerId',
                        'caseId',
                        'billToAddressSnapshot',
                        'shipToAddressSnapshot',
                        'paymentTermsSnapshot',
                        'incotermsSnapshot',
                        'termsConditionsSnapshot',
                        'internalNotes',
                        'customerNotes',
                        'sourceQuoteId',
                        'sourceRevisionNumber',
                        'quoteConversionLinkId',
                        'conversionType',
                        'lineageType',
                        'parentSalesOrderId',
                        'rootSalesOrderId',
                        'mergedFromSalesOrderIds',
                        'mergedIntoSalesOrderId',
                        'invoicedAmount',
                        'remainingBillableAmount',
                        'promisedDeliveryDate',
                        'modifiedBy'
                    ]);
                    if (salesOrdersSchemaExcluded.has(name)) return false;
                }
                if (key === 'purchase_orders') {
                    const purchaseOrdersSchemaExcluded = new Set([
                        'poNumber',
                        'subtotal',
                        'overallDiscountType',
                        'overallDiscountValue',
                        'overallDiscountTotal',
                        'preTaxTotal',
                        'taxTotal',
                        'chargesTotal',
                        'adjustmentTotal',
                        'grandTotal',
                        'transactionTaxSnapshot',
                        'taxDocumentSnapshot',
                        'chargeDocumentSnapshot',
                        'modifiedBy'
                    ]);
                    if (purchaseOrdersSchemaExcluded.has(name)) return false;
                }
                if (key === 'invoices') {
                    const invoicesSchemaExcluded = new Set([
                        'invoiceId',
                        'subtotal',
                        'lineDiscountTotal',
                        'sectionDiscountTotal',
                        'globalDiscountType',
                        'globalDiscountValue',
                        'globalDiscountAmount',
                        'globalDiscountTotal',
                        'taxTotal',
                        'chargesTotal',
                        'transactionTaxSnapshot',
                        'chargeDocumentSnapshot',
                        'taxDocumentSnapshot',
                        'adjustmentTotal',
                        'exchangeRateSnapshot',
                        'customerId',
                        'caseId',
                        'billToAddressSnapshot',
                        'shipToAddressSnapshot',
                        'paymentTermsSnapshot',
                        'incotermsSnapshot',
                        'termsConditionsSnapshot',
                        'internalNotes',
                        'customerNotes',
                        'sourceSalesOrderIds',
                        'sourceContext',
                        'sourceRef',
                        'postedAt',
                        'postedBy',
                        'voidedAt',
                        'voidedBy',
                        'voidReason',
                        'approvedAt',
                        'approvedBy',
                        'rejectedAt',
                        'rejectedBy',
                        'rejectionReason',
                        'submittedAt',
                        'submittedBy',
                        'amountDue',
                        'amountPaid',
                        'modifiedBy'
                    ]);
                    if (invoicesSchemaExcluded.has(name)) return false;
                }
                if (key === 'payments') {
                    const paymentsSchemaExcluded = new Set([
                        'paymentId',
                        'paymentNumber',
                        'amountAllocated',
                        'amountUnallocated',
                        'amountRefunded',
                        'status',
                        'recordedAt',
                        'recordedBy',
                        'externalReference',
                        'paymentInstrumentSnapshot',
                        'exchangeRateSnapshot',
                        'sourceContext',
                        'sourceRef',
                        'valueDate',
                        'modifiedBy'
                    ]);
                    if (paymentsSchemaExcluded.has(name)) return false;
                    if (name.startsWith('paymentInstrumentSnapshot.')) return false;
                }
                if (key === 'documents') {
                    const documentsSchemaExcluded = new Set([
                        'organizationId',
                        'documentNumber',
                        'storageProvider',
                        'storagePath',
                        'checksum',
                        'mimeType',
                        'fileSizeBytes',
                        'currentVersionId',
                        'richContent',
                        'externalUrl',
                        'sourceProvider',
                        'sourceType',
                        'reservedBy',
                        'reservedAt',
                        'reservationExpiresAt',
                        'reservationReason',
                        'reservationStatus',
                        'deletedAt',
                        'deletedBy',
                        'deletionReason',
                        'visibility'
                    ]);
                    if (documentsSchemaExcluded.has(name)) return false;
                    if (name.startsWith('visibility.')) return false;
                }
                if (key === 'responses') {
                    const responsesSchemaExcluded = new Set([
                        'responseId',
                        'responseDetails',
                        'sectionScores',
                        'correctiveActions',
                        'finalReport',
                        'kpis'
                    ]);
                    if (responsesSchemaExcluded.has(name)) return false;
                    if (name === 'linkedTo.type' || name === 'linkedTo.id') return false;
                    for (const prefix of ['kpis.', 'finalReport.']) {
                        if (name.startsWith(prefix)) return false;
                    }
                }
                // Exclude nested paths (e.g., "kpiMetrics.compliancePercentage" should be excluded if "kpiMetrics" is excluded)
                for (const excludedField of excluded) {
                    if (name.startsWith(excludedField + '.')) {
                        return false;
                    }
                }
                return true;
            })
            .map(([name, path]) => {
                // Extract enum values from Mongoose path and schema tree FIRST
                let options = [];
                // Check schema tree first (original definition)
                const treeDef = schemaTree[name];
                if (treeDef && treeDef.enum && Array.isArray(treeDef.enum)) {
                    options = [...treeDef.enum];
                } else {
                    // Fallback to path properties
                    const enumValues = path.enumValues || (path.options && path.options.enum) || (path.caster && path.caster.enumValues) || null;
                    if (Array.isArray(enumValues) && enumValues.length > 0) {
                        options = [...enumValues];
                    }
                }
                
                // Get data type - if options exist and no explicit mapping, infer Picklist
                let dataType = getFieldDataType(key, name, path);
                
                // Special handling for array fields with ObjectId refs
                // Check if this is an array of ObjectIds with a ref before auto-detecting Picklist
                if (path.instance === 'Array' && path.schema && path.schema.paths) {
                    const arrayItemPath = path.schema.paths[0] || path.schema.paths['0'];
                    if (arrayItemPath && arrayItemPath.instance === 'ObjectID' && arrayItemPath.options && arrayItemPath.options.ref) {
                        dataType = 'Lookup (Relationship)';
                    }
                }
                
                // Auto-detect Picklist if enum options exist and dataType is still Text
                // Note: getFieldDataType already handles field-specific mappings, so we just check if it's still Text
                if (options.length > 0 && dataType === 'Text') {
                    dataType = 'Picklist';
                }
                
                // Tasks status/priority/taskType: provide default options when schema has no enum (allows custom values)
                if (key === 'tasks' && (name === 'status' || name === 'priority' || name === 'taskType') && options.length === 0) {
                    if (name === 'status') {
                        options = [{ value: 'todo', label: 'To Do', enabled: true, color: '#6B7280' }, { value: 'in_progress', label: 'In Progress', enabled: true, color: '#2563EB' }, { value: 'waiting', label: 'Waiting', enabled: true, color: '#D97706' }, { value: 'completed', label: 'Completed', enabled: true, color: '#16A34A' }, { value: 'cancelled', label: 'Cancelled', enabled: true, color: '#DC2626' }];
                    } else if (name === 'priority') {
                        options = [{ value: 'low', label: 'Low', enabled: true, color: '#6B7280' }, { value: 'medium', label: 'Medium', enabled: true, color: '#2563EB' }, { value: 'high', label: 'High', enabled: true, color: '#D97706' }, { value: 'urgent', label: 'Urgent', enabled: true, color: '#DC2626' }];
                    } else {
                        options = DEFAULT_TASK_TYPE_OPTIONS.map((opt) => ({ ...opt }));
                    }
                }

                // Organizations industry: provide standard options when schema has no enum.
                if (key === 'organizations' && name === 'industry' && options.length === 0) {
                    options = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];
                }

                if (key === 'organizations') {
                    const { getDefaultOrganizationStatusFieldOptions } = require('../constants/organizationStatusDefaults');
                    if (
                        (name === 'customerStatus' || name === 'partnerStatus' || name === 'vendorStatus') &&
                        options.length === 0
                    ) {
                        options = getDefaultOrganizationStatusFieldOptions(name);
                    }
                }
                
                // Special handling for array fields (like tags, interest_products)
                if (path.schema && path.schema.paths) {
                    // This is an array field, check if the array items have enum
                    const arrayItemPath = path.schema.paths[0] || path.schema.paths['0'];
                    if (arrayItemPath) {
                        const arrayEnum = arrayItemPath.enumValues || (arrayItemPath.options && arrayItemPath.options.enum);
                        if (Array.isArray(arrayEnum) && arrayEnum.length > 0) {
                            options = [...arrayEnum];
                        }
                    }
                    // Also check schema tree for array type
                    if (treeDef && treeDef[0] && treeDef[0].enum && Array.isArray(treeDef[0].enum)) {
                        options = [...treeDef[0].enum];
                    }
                }
                // Generate human-readable label from field key (supports snake_case + camelCase)
                let fieldLabel = String(name || '')
                    .replace(/_/g, ' ')
                    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\b\w/g, c => c.toUpperCase());
                if (name === 'assignedTo') fieldLabel = 'Assigned To';
                if (name === 'contactId') fieldLabel = 'Contact';
                if (name === 'organizationRefId') fieldLabel = 'Organization';
                if (name === 'dealId') fieldLabel = 'Deal';
                if (name === 'vendorId') fieldLabel = 'Vendor';
                if (name === 'vendorContactId') fieldLabel = 'Vendor Contact';
                if (name === 'buyerId') fieldLabel = 'Purchase Owner';
                // Purchase Order–specific labels (must not leak to other modules with shared field names)
                if (key === 'purchase_orders') {
                    if (name === 'subject') fieldLabel = 'Purchase Order Subject';
                    if (name === 'poNumber') fieldLabel = 'Purchase Order Number';
                    if (name === 'poDate') fieldLabel = 'Order Date';
                    if (name === 'expectedDeliveryDate') fieldLabel = 'Expected Receipt Date';
                    if (name === 'notes') fieldLabel = 'Vendor Notes';
                    if (name === 'internalNotes') fieldLabel = 'Internal Notes';
                    if (name === 'deliveryWarehouseId') fieldLabel = 'Delivery Warehouse';
                    if (name === 'deliveryMethod') fieldLabel = 'Delivery Method';
                    if (name === 'shippingTerms') fieldLabel = 'Shipping Terms';
                    if (name === 'deliveryInstructions') fieldLabel = 'Delivery Instructions';
                    if (name === 'overallDiscountType') fieldLabel = 'Overall Discount Type';
                    if (name === 'overallDiscountValue') fieldLabel = 'Overall Discount';
                    if (name === 'overallDiscountTotal') fieldLabel = 'Overall Discount Total';
                    if (name === 'preTaxTotal') fieldLabel = 'Pre-Tax Total';
                    if (name === 'adjustmentTotal') fieldLabel = 'Adjustments';
                    if (name === 'grandTotal') fieldLabel = 'Grand Total';
                    if (name === 'subtotal') fieldLabel = 'Sub Total';
                    if (name === 'taxTotal') fieldLabel = 'Taxes';
                    if (name === 'chargesTotal') fieldLabel = 'Charges';
                }
                if (key === 'purchase_returns') {
                    if (name === 'subject') fieldLabel = 'Purchase Return Subject';
                    if (name === 'purchaseReturnNumber') fieldLabel = 'Purchase Return Number';
                    if (name === 'returnDate') fieldLabel = 'Return Date';
                    if (name === 'ownerId') fieldLabel = 'Purchase Return Owner';
                    if (name === 'returnType') fieldLabel = 'Return Type';
                    if (name === 'returnReason') fieldLabel = 'Reason';
                    if (name === 'supplierReference') fieldLabel = 'Supplier Reference Number';
                    if (name === 'returnWarehouseId') fieldLabel = 'Return Warehouse';
                    if (name === 'vendorNotes') fieldLabel = 'Vendor Notes';
                    if (name === 'internalNotes') fieldLabel = 'Internal Notes';
                    if (name === 'notes') fieldLabel = 'Vendor Notes';
                    if (name === 'receiptNoteId') fieldLabel = 'Receipt Note';
                    if (name === 'purchaseOrderId') fieldLabel = 'Purchase Order';
                    if (name === 'grandTotal') fieldLabel = 'Grand Total';
                    if (name === 'subtotal') fieldLabel = 'Sub Total';
                    if (name === 'taxTotal') fieldLabel = 'Taxes';
                    if (name === 'chargesTotal') fieldLabel = 'Charges';
                }
                if (key === 'delivery_returns') {
                    if (name === 'subject') fieldLabel = 'Delivery Return Subject';
                    if (name === 'deliveryReturnNumber') fieldLabel = 'Delivery Return Number';
                    if (name === 'returnDate') fieldLabel = 'Return Date';
                    if (name === 'ownerId') fieldLabel = 'Delivery Return Owner';
                    if (name === 'customerId') fieldLabel = 'Customer';
                    if (name === 'contactPersonId') fieldLabel = 'Contact Person';
                    if (name === 'sourceType') fieldLabel = 'Source Type';
                    if (name === 'returnType') fieldLabel = 'Return Type';
                    if (name === 'returnReason') fieldLabel = 'Return Reason';
                    if (name === 'customerReference') fieldLabel = 'Customer Reference Number';
                    if (name === 'returnWarehouseId') fieldLabel = 'Return Warehouse';
                    if (name === 'customerNotes') fieldLabel = 'Customer Notes';
                    if (name === 'internalNotes') fieldLabel = 'Internal Notes';
                    if (name === 'notes') fieldLabel = 'Customer Notes';
                    if (name === 'deliveryNoteId') fieldLabel = 'Delivery Note';
                    if (name === 'invoiceId') fieldLabel = 'Invoice';
                    if (name === 'inventoryPostStatus') fieldLabel = 'Inventory Post Status';
                    if (name === 'grandTotal') fieldLabel = 'Grand Total';
                    if (name === 'subtotal') fieldLabel = 'Sub Total';
                    if (name === 'taxTotal') fieldLabel = 'Taxes';
                    if (name === 'chargesTotal') fieldLabel = 'Charges';
                }
                if (key === 'sales_returns') {
                    if (name === 'salesReturnNumber') fieldLabel = 'Sales Return Number';
                    if (name === 'returnDate') fieldLabel = 'Return Date';
                    if (name === 'customerId') fieldLabel = 'Customer';
                    if (name === 'invoiceId') fieldLabel = 'Invoice';
                    if (name === 'deliveryNoteId') fieldLabel = 'Delivery Note';
                    if (name === 'salesOrderId') fieldLabel = 'Sales Order';
                    if (name === 'returnLocationId') fieldLabel = 'Return Location';
                    if (name === 'overallReturnReason') fieldLabel = 'Return Reason';
                    if (name === 'returnType') fieldLabel = 'Return Type';
                    if (name === 'status') fieldLabel = 'Status';
                    if (name === 'notes') fieldLabel = 'Notes';
                    if (name === 'grandTotal') fieldLabel = 'Grand Total';
                    if (name === 'subtotal') fieldLabel = 'Sub Total';
                    if (name === 'taxTotal') fieldLabel = 'Taxes';
                    if (name === 'chargesTotal') fieldLabel = 'Charges';
                }
                if (key === 'delivery_notes') {
                    if (name === 'subject') fieldLabel = 'Delivery Note Subject';
                    if (name === 'deliveryNoteNumber') fieldLabel = 'Delivery Note Number';
                    if (name === 'deliveryDate') fieldLabel = 'Delivery Date';
                    if (name === 'ownerId') fieldLabel = 'Delivery Owner';
                    if (name === 'customerId') fieldLabel = 'Customer';
                    if (name === 'contactPersonId') fieldLabel = 'Contact Person';
                    if (name === 'sourceType') fieldLabel = 'Source Type';
                    if (name === 'salesOrderId') fieldLabel = 'Sales Order';
                    if (name === 'warehouseId') fieldLabel = 'Warehouse';
                    if (name === 'deliveryMethod') fieldLabel = 'Delivery Method';
                    if (name === 'carrier') fieldLabel = 'Carrier';
                    if (name === 'trackingNumber') fieldLabel = 'Tracking Number';
                    if (name === 'vehicleNumber') fieldLabel = 'Vehicle Number';
                    if (name === 'driverDetails') fieldLabel = 'Driver Details';
                    if (name === 'dispatchDate') fieldLabel = 'Dispatch Date';
                    if (name === 'expectedDeliveryDate') fieldLabel = 'Expected Delivery Date';
                    if (name === 'deliveryInstructions') fieldLabel = 'Delivery Instructions';
                    if (name === 'customerNotes') fieldLabel = 'Customer Notes';
                    if (name === 'internalNotes') fieldLabel = 'Internal Notes';
                    if (name === 'notes') fieldLabel = 'Customer Notes';
                    if (name === 'inventoryPostStatus') fieldLabel = 'Inventory Post Status';
                    if (name === 'grandTotal') fieldLabel = 'Grand Total';
                    if (name === 'subtotal') fieldLabel = 'Sub Total';
                    if (name === 'taxTotal') fieldLabel = 'Taxes';
                    if (name === 'chargesTotal') fieldLabel = 'Charges';
                }
                if (key === 'receipt_notes') {
                    if (name === 'receiptNoteNumber') fieldLabel = 'Receipt Note Number';
                    if (name === 'receiptDate') fieldLabel = 'Receipt Date';
                    if (name === 'vendorId') fieldLabel = 'Vendor';
                    if (name === 'purchaseOrderId') fieldLabel = 'Purchase Order';
                    if (name === 'receiptLocationId') fieldLabel = 'Receipt Location';
                    if (name === 'receivedBy') fieldLabel = 'Received By';
                    if (name === 'vendorDeliveryChallanNo') fieldLabel = 'Vendor Delivery Challan No';
                    if (name === 'transportDetails') fieldLabel = 'Transport Details';
                    if (name === 'status') fieldLabel = 'Status';
                    if (name === 'notes') fieldLabel = 'Notes';
                }
                if (name === 'lifecycle_state') fieldLabel = 'Status';
                if (name === 'categoryId') fieldLabel = 'Category';
                // UX normalization: hide technical relationship naming in Events module UI
                if (key === 'events' && name === 'relatedToId') fieldLabel = 'Organization';
                if (key === 'events' && name === 'linkedFormId') fieldLabel = 'Form';
                if (key === 'events' && name === 'reviewerId') fieldLabel = 'Reviewer';
                if (key === 'events' && name === 'auditorId') fieldLabel = 'Auditor';
                if (key === 'events' && name === 'correctiveOwnerId') fieldLabel = 'Corrective Owner';
                if (key === 'events' && name === 'meetingMode') fieldLabel = 'Meeting Mode';
                if (key === 'events' && name === 'meetingLink') fieldLabel = 'Join Link';
                if (key === 'events' && name === 'conferenceProvider') fieldLabel = 'Conference';
                if (key === 'events' && name === 'attendees') fieldLabel = 'Participants';
                if (key === 'events' && name === 'agendaNotes') fieldLabel = 'Agenda';
                if (key === 'cases' && name === 'reopenReason') fieldLabel = 'Reopen reason';

                // Add lookupSettings for User lookup fields
                let lookupSettings = null;
                
                if (dataType === 'Lookup (Relationship)') {
                    // Check if this is a User lookup field
                    if (name === 'assignedTo' || name === 'createdBy' || name === 'modifiedBy' || 
                        (path.options && path.options.ref === 'User') ||
                        (path.caster && path.caster.options && path.caster.options.ref === 'User')) {
                        lookupSettings = {
                            targetModule: 'users'
                        };
                    } else if (path.options && path.options.ref) {
                        // For other lookup fields, infer targetModule from ref
                        const ref = path.options.ref;
                        const moduleMap = {
                            'User': 'users',
                            'People': 'people',
                            'Contact': 'people',
                            'Organization': 'organizations',
                            'Deal': 'deals',
                            'Quote': 'quotes',
                            'SalesOrder': 'sales_orders',
                            'PurchaseOrder': 'purchase_orders',
                            'ReceiptNote': 'receipt_notes',
                            'DeliveryNote': 'delivery_notes',
                            'DeliveryReturn': 'delivery_returns',
                            'PurchaseReturn': 'purchase_returns',
                            'Invoice': 'invoices',
                            'Payment': 'payments',
                            'Case': 'cases',
                            'Task': 'tasks',
                            'Event': 'events',
                            'Form': 'forms',
                            'Report': 'reports',
                            'InventoryLocation': 'inventory_locations'
                        };
                        if (moduleMap[ref]) {
                            lookupSettings = {
                                targetModule: moduleMap[ref]
                            };
                        }
                    }
                }
                
                // Also check for array fields with ObjectId refs
                if (!lookupSettings && path.instance === 'Array' && path.schema && path.schema.paths) {
                    // Check if array items are ObjectIds with ref
                    const arrayItemPath = path.schema.paths[0] || path.schema.paths['0'];
                    if (arrayItemPath && arrayItemPath.options && arrayItemPath.options.ref) {
                        const ref = arrayItemPath.options.ref;
                        const moduleMap = {
                            'User': 'users',
                            'People': 'people',
                            'Contact': 'people',
                            'Organization': 'organizations',
                            'Deal': 'deals',
                            'Quote': 'quotes',
                            'SalesOrder': 'sales_orders',
                            'PurchaseOrder': 'purchase_orders',
                            'ReceiptNote': 'receipt_notes',
                            'DeliveryNote': 'delivery_notes',
                            'DeliveryReturn': 'delivery_returns',
                            'PurchaseReturn': 'purchase_returns',
                            'Invoice': 'invoices',
                            'Payment': 'payments',
                            'Case': 'cases',
                            'Task': 'tasks',
                            'Event': 'events',
                            'Form': 'forms',
                            'Report': 'reports',
                            'InventoryLocation': 'inventory_locations'
                        };
                        if (moduleMap[ref]) {
                            dataType = 'Lookup (Relationship)';
                            lookupSettings = {
                                targetModule: moduleMap[ref]
                            };
                        }
                    }
                }
                
                // Special handling for linkedFormId in events module - add visibility dependency
                let dependencies = [];
                let fieldVisibility = { list: true, detail: true };
                if (key === 'events' && name === 'linkedFormId') {
                    dependencies = [{
                        name: 'Show for audit event types',
                        type: 'visibility',
                        fieldKey: 'eventType',
                        operator: 'in',
                        value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                        logic: 'AND'
                    }];
                }

                // Events: relatedToId is the "Organization" field for single-org audits.
                if (key === 'events' && name === 'relatedToId') {
                    dependencies = [
                        ...(dependencies || []),
                        {
                            name: 'Show for single-org audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org'],
                            logic: 'AND'
                        },
                        {
                            name: 'Required for single-org audit event types',
                            type: 'required',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org'],
                            logic: 'AND'
                        },
                        {
                            name: 'Internal Audit: lock organization to current org',
                            type: 'readonly',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Internal Audit',
                            logic: 'AND'
                        },
                        {
                            name: 'Internal Audit: force relatedToId = current org',
                            type: 'setValue',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Internal Audit',
                            logic: 'AND',
                            setValue: '$currentUser.organizationId'
                        }
                    ];
                }

                // Events: audit UX uses explicit audit role field `auditorId`.
                // Hide `assignedTo` for audit event types to prevent duplicate "Event Owner" vs "Auditor" confusion.
                if (key === 'events' && name === 'assignedTo') {
                    dependencies = [
                        ...(dependencies || []),
                        {
                            name: 'Show only for non-audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'not_in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        }
                    ];
                }

                // Special handling for reviewerId in events module - audit-only visibility + required
                // Default dependency: only show/require for audit event types. Admins can override in Settings → Modules & Fields.
                if (key === 'events' && name === 'reviewerId') {
                    dependencies = [
                        {
                            name: 'Show for audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Required for External Audit — Single Org',
                            type: 'required',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'External Audit — Single Org',
                            logic: 'AND'
                        },
                        {
                            name: 'Reviewer pool: internal users only',
                            type: 'lookup',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND',
                            lookupQuery: { scope: 'internal' }
                        },
                        {
                            name: 'Internal Audit: reviewer pool -> users in relatedToId (current org)',
                            type: 'lookup',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Internal Audit',
                            logic: 'AND',
                            lookupQuery: { scope: 'org', orgId: '$field:relatedToId' }
                        }
                    ];
                }

                // Special handling for auditorId in events module - audit-only visibility + required
                if (key === 'events' && name === 'auditorId') {
                    dependencies = [
                        {
                            name: 'Show for audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Required for audit event types',
                            type: 'required',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        // User pool scoping (UI picker)
                        {
                            name: 'Auditor pool: Internal Audit -> users in relatedToId (current org)',
                            type: 'lookup',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Internal Audit',
                            logic: 'AND',
                            lookupQuery: { scope: 'org', orgId: '$field:relatedToId' }
                        },
                        {
                            name: 'Auditor pool: External Audit — Single Org -> internal + org users',
                            type: 'lookup',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'equals', value: 'External Audit — Single Org' }
                            ],
                            lookupQuery: { scope: 'internal_or_org', orgId: '$field:relatedToId' }
                        },
                        {
                            name: 'Auditor pool: External Audit Beat -> internal users only',
                            type: 'lookup',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'External Audit Beat',
                            logic: 'AND',
                            lookupQuery: { scope: 'internal' }
                        }
                    ];
                }

                // Special handling for correctiveOwnerId in events module - audit-only visibility + required
                if (key === 'events' && name === 'correctiveOwnerId') {
                    dependencies = [
                        {
                            name: 'Show for audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Required for audit event types',
                            type: 'required',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Corrective owner pool: users from selected Organization',
                            type: 'lookup',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'in', value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'] }
                            ],
                            lookupQuery: { scope: 'org', orgId: '$field:relatedToId' }
                        }
                    ];
                }

                // Special handling for allowSelfReview in events module - audit-only visibility
                // Default dependency: only show for audit event types. Admins can override in Settings → Modules & Fields.
                if (key === 'events' && name === 'allowSelfReview') {
                    dependencies = [{
                        name: 'Show for audit event types',
                        type: 'visibility',
                        fieldKey: 'eventType',
                        operator: 'in',
                        value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                        logic: 'AND'
                    }];
                }

                // GEO Required: visible only when physical presence matters (not pure Virtual meetings).
                // Visibility deps are OR'd — any matching rule shows the field.
                if (key === 'events' && name === 'geoRequired') {
                    dependencies = [
                        {
                            name: 'Show for audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Show for Field Sales Beat',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Field Sales Beat',
                            logic: 'AND'
                        },
                        {
                            name: 'Show for in-person or hybrid meetings',
                            type: 'visibility',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                { fieldKey: 'meetingMode', operator: 'in', value: ['In-person', 'Hybrid'] }
                            ]
                        },
                        {
                            name: 'Read-only for audit event types',
                            type: 'readonly',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        },
                        {
                            name: 'Required for audit event types',
                            type: 'required',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        }
                    ];
                }

                // Location: physical address — hide for pure Virtual meetings
                if (key === 'events' && name === 'location') {
                    dependencies = [
                        {
                            name: 'Show for audit and field sales event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'in',
                            value: [
                                'Internal Audit',
                                'External Audit — Single Org',
                                'External Audit Beat',
                                'Field Sales Beat'
                            ],
                            logic: 'AND'
                        },
                        {
                            name: 'Show for in-person or hybrid meetings',
                            type: 'visibility',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                { fieldKey: 'meetingMode', operator: 'in', value: ['In-person', 'Hybrid'] }
                            ]
                        }
                    ];
                }

                // Min Visit Duration: show whenever geoRequired = true (no eventType branching)
                if (key === 'events' && name === 'minVisitDuration') {
                    dependencies = [
                        {
                            name: 'Show when GEO is required',
                            type: 'visibility',
                            fieldKey: 'geoRequired',
                            operator: 'equals',
                            value: true,
                            logic: 'AND'
                        }
                    ];
                }

                // Partner Visibility: only for External Audit — Single Org
                if (key === 'events' && name === 'partnerVisibility') {
                    dependencies = [
                        {
                            name: 'Show only for External Audit — Single Org',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'External Audit — Single Org',
                            logic: 'AND'
                        }
                    ];
                }

                // Meeting create surface: meetingMode / join link / participants / agenda
                if (key === 'events' && name === 'meetingMode') {
                    dependencies = [
                        {
                            name: 'Show for Meeting events',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Meeting',
                            logic: 'AND'
                        }
                    ];
                    // Default Virtual for new meetings (tenant can clear)
                    if (options && options.length === 0) {
                        options = ['In-person', 'Virtual', 'Hybrid'];
                    }
                }
                if (key === 'events' && name === 'conferenceProvider') {
                    const { MEETING_CONFERENCE_PROVIDERS } = require('../constants/meetingConferenceProviders');
                    dataType = 'Picklist';
                    options = MEETING_CONFERENCE_PROVIDERS.map((p) => ({
                        value: p.value,
                        label: p.label
                    }));
                    dependencies = [
                        {
                            name: 'Show when Virtual or Hybrid meeting',
                            type: 'visibility',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                { fieldKey: 'meetingMode', operator: 'in', value: ['Virtual', 'Hybrid'] }
                            ]
                        }
                    ];
                }
                if (key === 'events' && name === 'meetingLink') {
                    dependencies = [
                        {
                            name: 'Show for Virtual or Hybrid meetings with a provider',
                            type: 'visibility',
                            logic: 'AND',
                            conditions: [
                                { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                { fieldKey: 'meetingMode', operator: 'in', value: ['Virtual', 'Hybrid'] },
                                {
                                    fieldKey: 'conferenceProvider',
                                    operator: 'in',
                                    value: ['google_meet', 'ms_teams', 'zoom']
                                }
                            ]
                        }
                    ];
                }
                if (key === 'events' && name === 'attendees') {
                    dataType = 'Multi-Picklist';
                    dependencies = [
                        {
                            name: 'Show for non-audit event types',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'not_in',
                            value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                            logic: 'AND'
                        }
                    ];
                }
                if (key === 'events' && name === 'agendaNotes') {
                    dataType = 'Text-Area';
                    dependencies = [
                        {
                            name: 'Show for Meeting events',
                            type: 'visibility',
                            fieldKey: 'eventType',
                            operator: 'equals',
                            value: 'Meeting',
                            logic: 'AND'
                        }
                    ];
                }
                
                // NOTE: legacy plural corrective owners have been deprecated and removed.
                
                // Special handling for Items module - add dependencies based on item_type
                if (key === 'items') {
                    // Stock fields: legacy placeholders — hidden from catalog UI (C0)
                    if (name === 'stock_quantity' || name === 'reorder_level') {
                        fieldVisibility = { list: false, detail: false };
                        dependencies = [{
                            name: 'Legacy inventory placeholder (deprecated)',
                            type: 'visibility',
                            fieldKey: 'item_type',
                            operator: 'equals',
                            value: '__never__',
                            logic: 'AND'
                        }];
                    }
                    // Commission rate: Show for Service
                    if (name === 'commission_rate') {
                        dependencies = [{
                            name: 'Show for services',
                            type: 'visibility',
                            fieldKey: 'item_type',
                            operator: 'equals',
                            value: 'Service',
                            logic: 'AND'
                        }];
                    }
                    // Serial number fields: Show only for Serialized Product
                    if (name === 'serial_numbers' || name === 'warranty_period_months') {
                        dependencies = [{
                            name: 'Show for serialized products',
                            type: 'visibility',
                            fieldKey: 'item_type',
                            operator: 'equals',
                            value: 'Serialized Product',
                            logic: 'AND'
                        }];
                    }
                }
                
                const eventTypeOptions = (key === 'events' && String(name).toLowerCase() === 'eventtype')
                    ? normalizeEventTypeOptions(options)
                    : options;
                const eventTypeDefaultValue = (key === 'events' && String(name).toLowerCase() === 'eventtype')
                    ? normalizeMeetingEventTypeLabel(path.defaultValue ?? null)
                    : (path.defaultValue ?? null);

                if (key === 'cases' && name === 'reopenReason') {
                    dataType = 'Text-Area';
                    fieldVisibility = { list: false, detail: true };
                }

                return {
                    key: name,
                    label: fieldLabel,
                    dataType: dataType,
                    keyField: (key === 'tasks' && taskDefaultKeyFields.has(name))
                        || (key === 'people' && peopleDefaultKeyFields.has(name))
                        || (key === 'organizations' && organizationDefaultKeyFields.has(name))
                        || (key === 'items' && itemsDefaultKeyFields.has(name)),
                    // IMPORTANT: Some schema fields are conditionally required (function-based required).
                    // For dependency-driven required fields (like events.reviewerId), the module definition must NOT mark them required globally.
                    required: (key === 'events' && name === 'reviewerId')
                        ? false
                        : (key === 'events' && isInitialEventRequiredField(name))
                            ? true
                        : isModuleOwnerField(key, name)
                            ? true
                            : (key === 'quotes' && isInitialQuoteRequiredField(name))
                                ? true
                                : (key === 'sales_orders' && isInitialSalesOrderRequiredField(name))
                                    ? true
                                    : (key === 'purchase_orders' && isInitialPurchaseOrderRequiredField(name))
                                        ? true
                                        : (key === 'purchase_returns' && isInitialPurchaseReturnRequiredField(name))
                                            ? true
                                            : (key === 'delivery_returns' && isInitialDeliveryReturnRequiredField(name))
                                                ? true
                                            : (key === 'sales_returns' && isInitialSalesReturnRequiredField(name))
                                                ? true
                                            : (key === 'delivery_notes' && isInitialDeliveryNoteRequiredField(name))
                                                ? true
                                            : (key === 'receipt_notes' && isInitialReceiptNoteRequiredField(name))
                                            ? true
                                        : (key === 'stockrooms' && isInitialStockroomRequiredField(name))
                                            ? true
                                        : (key === 'invoices' && isInitialInvoiceRequiredField(name))
                                            ? true
                                            : (key === 'payments' && isInitialPaymentRequiredField(name))
                                                ? true
                                                : (key === 'cases' && isInitialCaseRequiredField(name))
                                                    ? true
                                                    : !!path.isRequired,
                    options: eventTypeOptions,
                    defaultValue: eventTypeDefaultValue,
                    // Use placeholder as helper text for Lookup fields (shown under label in UI); never show technical IDs.
                    placeholder:
                        (key === 'events' && name === 'reviewerId') ? 'User responsible for reviewing and approving this audit.' :
                        (key === 'events' && name === 'relatedToId') ? 'The organization this event is associated with.' :
                        (key === 'events' && name === 'linkedFormId') ? 'The form that will be executed as part of this event.' :
                        '',
                    index: !!path._index,
                    visibility: fieldVisibility,
                    order: 0,
                    validations:
                        dataType === 'Email'
                              ? getDefaultEmailValidations()
                              : [],
                    dependencies: dependencies,
                    lookupSettings: lookupSettings,
                    // Field ownership and context classification
                    owner: 'platform',  // Default: platform-shipped fields
                    context: 'global'   // Default: global context (not app-specific)
                };
            });

        if (key === 'people') {
            const extraPeopleFields = [
                ...getPeopleVirtualBaseFields(),
                ...getPeopleParticipationStatusModuleFields(),
            ];
            const have = new Set(baseFields.map((f) => String(f.key || '').toLowerCase()));
            for (const v of extraPeopleFields) {
                if (!have.has(String(v.key || '').toLowerCase())) {
                    baseFields.push(v);
                    have.add(String(v.key || '').toLowerCase());
                }
            }
        }

        if (key === 'organizations') {
            const have = new Set(baseFields.map((f) => String(f.key || '').toLowerCase()));
            for (const v of getOrganizationVirtualBaseFields()) {
                if (!have.has(String(v.key || '').toLowerCase())) {
                    baseFields.push(v);
                    have.add(String(v.key || '').toLowerCase());
                }
            }
        }

        if (key !== 'tasks' && key !== 'people' && key !== 'cases') {
            return baseFields;
        }

        const sortOrder =
            key === 'tasks'
                ? taskDefaultFieldOrder
                : key === 'people'
                  ? peopleDefaultFieldOrder
                  : casesDefaultFieldOrder;
        const sortedFields = [...baseFields].sort((a, b) => {
            const aKey = String(a?.key || '');
            const bKey = String(b?.key || '');
            const aPinnedIndex = sortOrder.indexOf(aKey);
            const bPinnedIndex = sortOrder.indexOf(bKey);
            const aPinned = aPinnedIndex !== -1;
            const bPinned = bPinnedIndex !== -1;

            if (aPinned && bPinned) return aPinnedIndex - bPinnedIndex;
            if (aPinned) return -1;
            if (bPinned) return 1;
            return 0;
        });

        const ordered = sortedFields.map((field, index) => ({
            ...field,
            order: index
        }));
        if (key === 'cases') {
            return enrichCasesModuleFields(ordered);
        }
        return ordered;
    } catch (e) {
        console.warn(`[getBaseFieldsForKey] failed for key=${key}:`, e?.message || e);
        if (isInventorySchemaModuleKey(key)) {
            try {
                const {
                    getInventoryModuleFieldCatalog
                } = require('../services/inventoryModuleFieldCatalogService');
                return getInventoryModuleFieldCatalog(key) || [];
            } catch (_e) {
                return [];
            }
        }
        return [];
    }
}

/**
 * Normalize tasks module fields: expose only the single "Related To" field.
 * Removes legacy relatedToType / relatedToId and nested relatedTo.* from the list; ensures "relatedTo" exists.
 */
function normalizeTasksModuleFields(fields) {
    if (!Array.isArray(fields)) return fields;
    const keyLower = (f) => String((f && f.key) || '').toLowerCase().trim();
    const filtered = fields.filter((f) => {
        const k = keyLower(f);
        if (k === 'relatedtotype' || k === 'relatedtoid') return false;
        if (k.startsWith('relatedto.')) return false;
        return true;
    });
    const hasRelatedTo = filtered.some((f) => keyLower(f) === 'relatedto');
    if (!hasRelatedTo) {
        const insertOrder = 6; // after assignedTo in taskDefaultFieldOrder
        filtered.push({
            key: 'relatedTo',
            label: 'Related To',
            dataType: 'Lookup (Relationship)',
            required: false,
            order: insertOrder
        });
    }
    return filtered;
}

const PLAYBOOK_ACTION_TYPES = new Set(['task', 'event', 'alert', 'document', 'call', 'meeting', 'email', 'approval', 'other']);
const PLAYBOOK_TRIGGER_TYPES = new Set(['stage_entry', 'after_action', 'time_delay', 'custom']);
const PLAYBOOK_ALERT_TYPES = new Set(['in_app', 'email', 'sms']);
const PLAYBOOK_RESOURCE_TYPES = new Set(['document', 'link', 'form', 'template', 'other']);
const PLAYBOOK_DELAY_UNITS = new Set(['minutes', 'hours', 'days']);

const DEFAULT_STAGE_PLAYBOOKS = {
    qualification: (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Ensure the opportunity is a good fit before investing more time.',
        actions: [
            {
                key: `${stageKey}-research-account`,
                title: 'Research account background',
                description: 'Review company profile, industry insights and existing SALES notes.',
                actionType: 'task',
                dueInDays: 0,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-discovery-call`,
                title: 'Schedule discovery call',
                description: 'Coordinate a call to validate goals, pain points, budget and timeline.',
                actionType: 'event',
                dueInDays: 2,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [`${stageKey}-research-account`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'all_actions_completed',
            customDescription: '',
            nextStageKey: '',
            conditions: []
        }
    }),
    proposal: (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Tailor the proposal to the agreed requirements and highlight the value proposition.',
        actions: [
            {
                key: `${stageKey}-draft-solution`,
                title: 'Draft solution outline',
                description: 'Align internally on scope, deliverables, pricing and implementation approach.',
                actionType: 'task',
                dueInDays: 1,
                assignment: { type: 'team', targetId: null, targetType: '', targetName: 'Solutions' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-create-proposal`,
                title: 'Create proposal deck',
                description: 'Prepare proposal with executive summary, solution details, pricing and ROI.',
                actionType: 'document',
                dueInDays: 3,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [`${stageKey}-draft-solution`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'all_actions_completed',
            customDescription: '',
            nextStageKey: '',
            conditions: []
        }
    }),
    negotiation: (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Stay aligned with the prospect and stakeholders on final terms.',
        actions: [
            {
                key: `${stageKey}-review-feedback`,
                title: 'Review prospect feedback',
                description: 'Document requested changes and loop in stakeholders as needed.',
                actionType: 'task',
                dueInDays: 1,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-schedule-alignment`,
                title: 'Schedule alignment call',
                description: 'Set up meeting to finalize terms, pricing adjustments and contract language.',
                actionType: 'event',
                dueInDays: 2,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [`${stageKey}-review-feedback`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'all_actions_completed',
            customDescription: '',
            nextStageKey: '',
            conditions: []
        }
    }),
    'contract sent': (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Ensure the buyer has everything required to sign quickly.',
        actions: [
            {
                key: `${stageKey}-prep-signature`,
                title: 'Prepare contract for signature',
                description: 'Populate contract in e-sign platform and confirm legal terms and pricing.',
                actionType: 'document',
                dueInDays: 0,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-confirm-timeline`,
                title: 'Confirm signing timeline',
                description: 'Touch base with the buyer to confirm target signing date and blockers.',
                actionType: 'alert',
                dueInDays: 1,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: false,
                dependencies: [`${stageKey}-prep-signature`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'all_actions_completed',
            customDescription: '',
            nextStageKey: '',
            conditions: []
        }
    }),
    'closed won': (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Capture handoff details to ensure a smooth implementation.',
        actions: [
            {
                key: `${stageKey}-handoff`,
                title: 'Schedule handoff meeting',
                description: 'Introduce customer success, review goals and timeline.',
                actionType: 'event',
                dueInDays: 1,
                assignment: { type: 'team', targetId: null, targetType: '', targetName: 'Customer Success' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-celebrate`,
                title: 'Announce win internally',
                description: 'Update internal channels with win announcement and key insights.',
                actionType: 'alert',
                dueInDays: 0,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: false,
                dependencies: [`${stageKey}-handoff`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'manual',
            customDescription: 'Implementation team confirms onboarding is complete.',
            nextStageKey: '',
            conditions: []
        }
    }),
    'closed lost': (stageKey) => ({
        enabled: true,
        mode: 'sequential',
        autoAdvance: false,
        notes: 'Capture lost reason for future analysis and re-engagement.',
        actions: [
            {
                key: `${stageKey}-log-reason`,
                title: 'Log loss reason',
                description: 'Document reason codes and supporting notes in CRM.',
                actionType: 'task',
                dueInDays: 0,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: true,
                dependencies: [],
                autoCreate: true,
                metadata: {}
            },
            {
                key: `${stageKey}-nurture-plan`,
                title: 'Plan nurture follow-up',
                description: 'Identify future check-in date or nurture sequence to stay in touch.',
                actionType: 'task',
                dueInDays: 7,
                assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
                required: false,
                dependencies: [`${stageKey}-log-reason`],
                autoCreate: true,
                metadata: {}
            }
        ],
        exitCriteria: {
            type: 'manual',
            customDescription: 'Sales manager reviews and acknowledges learnings.',
            nextStageKey: '',
            conditions: []
        }
    })
};

function slugify(value = '', fallback = '') {
    const slug = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function buildStagePlaybook(stageKey, stageName, status = 'open', source = null) {
    const templateBuilder = DEFAULT_STAGE_PLAYBOOKS[(stageName || '').toLowerCase()];
    const resolvedSource = (source && typeof source === 'object')
        ? source
        : (templateBuilder ? templateBuilder(stageKey) : null);
    const baseExitType = (status === 'won' || status === 'lost') ? 'manual' : 'all_actions_completed';
    const exitCriteria = resolvedSource?.exitCriteria || {};
    const exitType = ['manual', 'all_actions_completed', 'any_action_completed', 'custom'].includes(exitCriteria.type)
        ? exitCriteria.type
        : baseExitType;

    const actionsSource = Array.isArray(resolvedSource?.actions) ? resolvedSource.actions : [];
    const seenKeys = new Set();
    const actions = actionsSource.map((action, index) => {
        const title = action.title ? String(action.title).trim() : `Action ${index + 1}`;
        let key = slugify(action.key || `${stageKey}-${title}-${index}`, `${stageKey}-action-${index + 1}`);
        while (seenKeys.has(key)) {
            key = `${key}-${index}`;
        }
        seenKeys.add(key);
        return {
            key,
            title,
            description: action.description || '',
            actionType: PLAYBOOK_ACTION_TYPES.has(action.actionType) ? action.actionType : 'task',
            dueInDays: Math.max(0, Number(action.dueInDays) || 0),
            assignment: {
                type: ['deal_owner', 'stage_owner', 'specific_user', 'role', 'team'].includes(action?.assignment?.type)
                    ? action.assignment.type
                    : 'deal_owner',
                targetId: action?.assignment?.targetId || null,
                targetType: action?.assignment?.targetType || '',
                targetName: action?.assignment?.targetName || ''
            },
            required: action.required !== false,
            dependencies: Array.isArray(action.dependencies) ? action.dependencies.filter(Boolean) : [],
            autoCreate: action.autoCreate !== false,
            trigger: normalizeActionTrigger(action.trigger),
            alerts: normalizeActionAlerts(action.alerts),
            resources: normalizeActionResources(action.resources),
            metadata: (action.metadata && typeof action.metadata === 'object') ? action.metadata : {}
        };
    });

    const validKeys = new Set(actions.map(action => action.key));
    actions.forEach(action => {
        action.dependencies = action.dependencies.filter(dep => dep !== action.key && validKeys.has(dep));
    });

    return {
        enabled: resolvedSource?.enabled === true,
        mode: ['sequential', 'non_sequential'].includes(resolvedSource?.mode) ? resolvedSource.mode : 'sequential',
        autoAdvance: resolvedSource?.autoAdvance === true,
        notes: resolvedSource?.notes || '',
        actions,
        exitCriteria: {
            type: exitType,
            customDescription: exitCriteria.customDescription || '',
            nextStageKey: exitCriteria.nextStageKey ? slugify(exitCriteria.nextStageKey) : '',
            conditions: Array.isArray(exitCriteria.conditions) ? exitCriteria.conditions.map(condition => ({
                field: condition.field || '',
                operator: condition.operator || 'equals',
                value: condition.value
            })) : []
        }
    };
}

function normalizeActionTrigger(trigger) {
    const type = PLAYBOOK_TRIGGER_TYPES.has(trigger?.type) ? trigger.type : 'stage_entry';
    const sourceActionKey = trigger?.sourceActionKey ? slugify(trigger.sourceActionKey) : '';
    let delay = null;
    if (trigger?.delay && typeof trigger.delay === 'object') {
        const amount = Math.max(0, Number(trigger.delay.amount) || 0);
        const unit = PLAYBOOK_DELAY_UNITS.has(trigger.delay.unit) ? trigger.delay.unit : 'days';
        delay = { amount, unit };
    }
    const conditions = Array.isArray(trigger?.conditions)
        ? trigger.conditions.map(condition => ({
            field: condition.field || '',
            operator: condition.operator || 'equals',
            value: condition.value
        }))
        : [];
    return {
        type,
        sourceActionKey,
        delay,
        conditions,
        description: trigger?.description || ''
    };
}

function normalizeActionAlerts(alerts) {
    if (!Array.isArray(alerts)) return [];
    return alerts.map(alert => {
        const type = PLAYBOOK_ALERT_TYPES.has(alert?.type) ? alert.type : 'in_app';
        let offset = null;
        if (alert?.offset && typeof alert.offset === 'object') {
            const amount = Math.max(0, Number(alert.offset.amount) || 0);
            const unit = PLAYBOOK_DELAY_UNITS.has(alert.offset.unit) ? alert.offset.unit : 'hours';
            offset = { amount, unit };
        }
        const recipients = Array.isArray(alert?.recipients)
            ? alert.recipients.map(r => String(r || '').trim()).filter(Boolean)
            : [];
        return {
            type,
            offset,
            recipients,
            message: alert?.message || ''
        };
    });
}

function normalizeActionResources(resources) {
    if (!Array.isArray(resources)) return [];
    return resources.map(resource => ({
        name: resource?.name || '',
        type: PLAYBOOK_RESOURCE_TYPES.has(resource?.type) ? resource.type : 'document',
        url: resource?.url || '',
        description: resource?.description || ''
    }));
}

function buildPipelineStage(name, { order = 0, probability = 0, status = 'open', playbook = null } = {}) {
    const normalizedStatus = ['open', 'won', 'lost'].includes(status) ? status : 'open';
    const normalizedProbability = typeof probability === 'number'
        ? Math.min(100, Math.max(0, probability))
        : (normalizedStatus === 'won' ? 100 : normalizedStatus === 'lost' ? 0 : 0);
    const key = slugify(name || `stage-${order + 1}`, `stage-${order + 1}`);
    return {
        key,
        name: name || `Stage ${order + 1}`,
        description: '',
        probability: normalizedStatus === 'won' ? 100 : normalizedStatus === 'lost' ? 0 : normalizedProbability,
        status: normalizedStatus,
        order,
        isClosedWon: normalizedStatus === 'won',
        isClosedLost: normalizedStatus === 'lost',
        playbook: buildStagePlaybook(key, name || `Stage ${order + 1}`, normalizedStatus, playbook)
    };
}

/** True if pipelineSettings is the legacy default (one pipeline: default_pipeline / "Default Pipeline" without "New" stage). */
function isLegacyDefaultPipelineSettings(pipelineSettings) {
    if (!Array.isArray(pipelineSettings) || pipelineSettings.length !== 1) return false;
    const p = pipelineSettings[0];
    const key = (p && p.key || '').toString().trim().toLowerCase().replace(/-/g, '_');
    const name = (p && p.name || '').toString().trim();
    const isLegacyKey = key === 'default_pipeline';
    const isLegacyName = name === 'Default Pipeline';
    if (!isLegacyKey && !isLegacyName) return false;
    const stages = Array.isArray(p.stages) ? p.stages : [];
    const firstStageName = (stages[0] && stages[0].name || '').toString().trim();
    return firstStageName !== 'New';
}

function getDefaultPipelineSettings() {
    const now = new Date();
    return [{
        key: 'sales_pipeline',
        name: 'Sales Pipeline',
        description: 'Standard sales pipeline',
        color: '#2563EB',
        isDefault: true,
        order: 0,
        createdAt: now,
        updatedAt: now,
        stages: [
            buildPipelineStage('New', { order: 0, probability: 0, status: 'open' }),
            buildPipelineStage('Qualification', { order: 1, probability: 25, status: 'open' }),
            buildPipelineStage('Proposal', { order: 2, probability: 50, status: 'open' }),
            buildPipelineStage('Negotiation', { order: 3, probability: 70, status: 'open' }),
            buildPipelineStage('Contract Sent', { order: 4, probability: 85, status: 'open' }),
            buildPipelineStage('Closed Won', { order: 5, probability: 100, status: 'won' }),
            buildPipelineStage('Closed Lost', { order: 6, probability: 0, status: 'lost' })
        ]
    }];
}

/**
 * Enrich deals module fields so pipeline and stage options come only from pipelineSettings (Settings).
 * Used when returning the deals module so forms and lists use settings-driven options only.
 */
/**
 * Enrich People module `sales_type` options from TenantModuleConfiguration.settings.peopleTypes (Types tab).
 * @param {Array} fields
 * @param {Array<{ value: string, color?: string }>} typeDefs - from getPeopleTypesConfig().typeDefs
 */
function enrichPeopleFieldsWithPeopleTypes(fields, typeDefs) {
    if (!Array.isArray(fields)) return fields;
    const { typeDefsToPeopleTypePicklistOptions } = require('../utils/tenantMetadata');
    const options = typeDefsToPeopleTypePicklistOptions(Array.isArray(typeDefs) ? typeDefs : []);
    return fields.map((f) => {
        const key = (f.key || '').toString().trim().toLowerCase();
        if (key === 'sales_type') return { ...f, options };
        return f;
    });
}

/**
 * Enrich Organizations module picklists from Status & Types tenant policy.
 * @param {Array} fields
 * @param {{ typeDefs?: Array, statusPicklists?: object|null }} config
 */
function enrichOrganizationsFieldsWithStatusTypes(fields, config) {
    if (!Array.isArray(fields)) return fields;
    const {
        typeDefsToOrganizationTypePicklistOptions,
        statusPicklistPolicyToOptions,
    } = require('../utils/tenantMetadata');
    const { getDefaultOrganizationStatusFieldOptions } = require('../constants/organizationStatusDefaults');
    const typeDefs = Array.isArray(config?.typeDefs) ? config.typeDefs : [];
    const statusPicklists = config?.statusPicklists ?? null;
    const { normalizePicklistOptionValue } = require('../utils/tenantMetadata');
    const { backfillPicklistOptionColors } = require('../utils/picklistColorPalette');
    const typeOptions = typeDefsToOrganizationTypePicklistOptions(typeDefs);
    const statusFieldKeys = new Set(['customerstatus', 'partnerstatus', 'vendorstatus']);

    return fields.map((f) => {
        const key = (f.key || '').toString().trim().toLowerCase();
        if (key === 'types') {
            const catalog = Array.isArray(f.options) ? f.options : [];
            const mergedTypeOptions = typeOptions.map((opt) => {
                const value = String(opt.value ?? '').trim();
                const catalogMatch = catalog.find(
                    (c) => normalizePicklistOptionValue(c).toLowerCase() === value.toLowerCase()
                );
                const color =
                    opt.color ||
                    (catalogMatch && typeof catalogMatch === 'object' ? catalogMatch.color : null);
                return color ? { ...opt, color } : opt;
            });
            const optionsWithColors = backfillPicklistOptionColors(mergedTypeOptions, 'types', 'organizations');
            return { ...f, options: optionsWithColors, enum: optionsWithColors.map((o) => o.value) };
        }
        if (statusFieldKeys.has(key)) {
            const canonicalKey =
                key === 'customerstatus'
                    ? 'customerStatus'
                    : key === 'partnerstatus'
                      ? 'partnerStatus'
                      : 'vendorStatus';
            const policyRows = statusPicklists?.[canonicalKey];
            const options = statusPicklistPolicyToOptions(policyRows, f.options || f.enum);
            if (options !== null && options.length > 0) {
                return { ...f, options, enum: options.map((o) => o.value) };
            }
            const defaults = getDefaultOrganizationStatusFieldOptions(canonicalKey);
            if (defaults.length > 0) {
                return { ...f, options: defaults, enum: defaults.map((o) => o.value) };
            }
        }
        return f;
    });
}

async function enrichOrganizationsModuleFields(fields, organizationId) {
    if (!Array.isArray(fields) || !organizationId) return fields;
    const { isTenantPlatformOrganizationFieldPath } = require('../constants/organizationTenantPlatformFields');
    const { stripRetiredOrganizationTypesFromModuleFields } = require('../constants/organizationTypeDefaults');
    const withoutTenantPlatform = fields.filter(
        (field) => !isTenantPlatformOrganizationFieldPath(field?.key)
    );
    const { fields: strippedFields } = stripRetiredOrganizationTypesFromModuleFields(withoutTenantPlatform);
    const {
        getOrganizationTypesConfig,
        getOrganizationParticipationTypesConfig,
        typeDefsToPeopleTypePicklistOptions,
    } = require('../utils/tenantMetadata');
    const { ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP } = require('../constants/organizationParticipation');
    const config = await getOrganizationTypesConfig(organizationId);
    let next = enrichOrganizationsFieldsWithStatusTypes(strippedFields, config);

    const optionsByFieldKey = {};
    for (const [fieldKey, appKey] of Object.entries(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP)) {
        const participationCfg = await getOrganizationParticipationTypesConfig(organizationId, appKey);
        optionsByFieldKey[fieldKey] = typeDefsToPeopleTypePicklistOptions(
            Array.isArray(participationCfg?.typeDefs) ? participationCfg.typeDefs : []
        );
    }
    next = next.map((f) => {
        const key = String(f?.key || '').trim();
        const options = optionsByFieldKey[key];
        if (!options || options.length === 0) return f;
        return { ...f, options };
    });
    return next;
}

/** Enrich events status picklist with tenant lifecycle vocabulary (union across types). */
async function enrichEventsModuleFields(fields, organizationId) {
    if (!Array.isArray(fields) || !organizationId) return fields;
    try {
        const eventStatusService = require('../services/eventStatusService');
        const labels = await eventStatusService.getUnionStatusLabels(organizationId);
        if (!labels.length) return fields;
        return fields.map((f) => {
            const k = String(f?.key || '').toLowerCase();
            if (k !== 'status') return f;
            const options = labels.map((o) => ({
                value: o.value,
                label: o.label,
                color: o.color,
                enabled: true,
            }));
            return { ...f, options, enum: options.map((o) => o.value) };
        });
    } catch (err) {
        console.warn('[enrichEventsModuleFields]', err?.message || err);
        return fields;
    }
}

/** Canonical config for Cases system field labels / reopen reason. */
function enrichCasesModuleFields(fields) {
    if (!Array.isArray(fields)) return fields;
    const friendlyLabels = {
        contactid: 'Contact',
        organizationrefid: 'Organization',
    };
    const normalizeFieldKey = (value) =>
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, '');
    return fields.map((f) => {
        const key = normalizeFieldKey(f?.key);
        if (key === 'reopenreason') {
            return {
                ...f,
                label: f.label || 'Reopen reason',
                dataType: 'Text-Area',
                required: false,
                keyField: false,
                visibility: {
                    list: false,
                    detail: true,
                    ...(f.visibility && typeof f.visibility === 'object' ? f.visibility : {})
                }
            };
        }
        const friendly = friendlyLabels[key];
        if (!friendly) return f;
        return { ...f, label: friendly };
    });
}

function enrichDealFieldsWithPipelineSettings(fields, pipelineSettings) {
    if (!Array.isArray(fields) || !Array.isArray(pipelineSettings)) return fields;
    const pipelines = pipelineSettings;
    const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];
    const defaultStages = defaultPipeline && Array.isArray(defaultPipeline.stages) ? defaultPipeline.stages : [];

    const pipelineOptions = pipelines.map((p) => ({
        value: p.key,
        label: p.name || p.key
    }));
    const stageOptions = defaultStages.map((s) => ({
        value: s.name,
        label: s.name,
        color: s.color || null
    }));

    const defaultPipelineKey = defaultPipeline ? (defaultPipeline.key || pipelineOptions[0]?.value) : null;
    const defaultStageName = defaultStages.length ? (defaultStages[0].name || 'New') : 'New';

    return fields.map((f) => {
        const key = (f.key || '').toString().trim().toLowerCase();
        if (key === 'pipeline') {
            return { ...f, options: pipelineOptions, defaultValue: defaultPipelineKey, required: true };
        }
        if (key === 'stage') {
            return { ...f, options: stageOptions, defaultValue: defaultStageName };
        }
        return f;
    });
}

const DEFAULT_STAGE_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

function normalizePipelineSettings(pipelines = []) {
    const source = Array.isArray(pipelines) ? pipelines : [];
    return source.map((pipeline, index) => {
        const name = pipeline.name || `Pipeline ${index + 1}`;
        const key = slugify(pipeline.key || name, `pipeline-${index + 1}`);
        const stagesSource = Array.isArray(pipeline.stages) ? pipeline.stages : [];
        const stages = stagesSource.map((stage, stageIndex) => {
            const stageName = stage.name || `Stage ${stageIndex + 1}`;
            const status = ['open', 'won', 'lost'].includes(stage.status) ? stage.status : 'open';
            const keyCandidate = slugify(stage.key || `${key}-${stageName}`, `${key}-stage-${stageIndex + 1}`);
            const probability = status === 'won'
                ? 100
                : status === 'lost'
                    ? 0
                    : Math.min(100, Math.max(0, Number(stage.probability) || 0));
            const validColor = (stage.color && /^#[0-9A-Fa-f]{6}$/.test(String(stage.color).trim())) ? String(stage.color).trim() : null;
            const color = validColor || DEFAULT_STAGE_COLORS[stageIndex % DEFAULT_STAGE_COLORS.length] || '#6B7280';
            return {
                key: keyCandidate,
                name: stageName,
                description: stage.description || '',
                probability,
                status,
                order: stageIndex,
                isClosedWon: status === 'won',
                isClosedLost: status === 'lost',
                playbook: buildStagePlaybook(keyCandidate, stageName, status, stage.playbook),
                color
            };
        });

        return {
            key,
            name,
            description: pipeline.description || '',
            color: pipeline.color || '#2563EB',
            isDefault: pipeline.isDefault === true,
            order: index,
            createdAt: pipeline.createdAt || new Date(),
            updatedAt: pipeline.updatedAt || new Date(),
            stages
        };
    });
}

const DEAL_DEFAULT_RELATIONSHIPS = Object.freeze([
    { name: 'Related Projects', type: 'one_to_many', isLookup: false, targetModuleKey: 'projects', relationshipKey: 'deal_projects' },
    { name: 'Related Organizations', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'deal_organizations' },
    { name: 'Related Contacts', type: 'many_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'deal_contacts' },
    { name: 'Related Tasks', type: 'one_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'deal_tasks' },
    { name: 'Related Events', type: 'one_to_many', isLookup: false, targetModuleKey: 'events', relationshipKey: 'deal_events' },
    { name: 'Related Forms', type: 'one_to_many', isLookup: false, targetModuleKey: 'forms', relationshipKey: 'deal_forms' },
    { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_deals' },
    cloneDocumentInverseRelationship('deals')
].filter(Boolean));

const PEOPLE_DEFAULT_RELATIONSHIPS = Object.freeze([
    { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'people_organizations' },
    { name: 'Related Deals', type: 'many_to_many', isLookup: false, targetModuleKey: 'deals', relationshipKey: 'people_deals' },
    { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'people_tasks' },
    { name: 'Related Events', type: 'many_to_many', isLookup: false, targetModuleKey: 'events', relationshipKey: 'people_events' },
    { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_people' },
    cloneDocumentInverseRelationship('people')
].filter(Boolean));

const ORGANIZATIONS_DEFAULT_RELATIONSHIPS = Object.freeze([
    { name: 'Related Contacts', type: 'one_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'people_organizations' },
    { name: 'Related Deals', type: 'one_to_many', isLookup: false, targetModuleKey: 'deals', relationshipKey: 'deal_organizations' },
    { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_organizations' },
    cloneDocumentInverseRelationship('organizations')
].filter(Boolean));

const CASES_DEFAULT_RELATIONSHIPS = Object.freeze([
    { name: 'Related Contact', type: 'many_to_one', isLookup: true, targetModuleKey: 'people', relationshipKey: 'case_people' },
    { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'case_organizations' },
    { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'task_cases' },
    { name: 'Related Quotes', type: 'one_to_many', isLookup: false, targetModuleKey: 'quotes', relationshipKey: 'quote_cases' },
    cloneDocumentInverseRelationship('cases')
].filter(Boolean));

const EVENTS_DEFAULT_RELATIONSHIPS = Object.freeze([
    { name: 'Related Deal', type: 'many_to_one', isLookup: true, targetModuleKey: 'deals', relationshipKey: 'deal_events' },
    { name: 'Related Contacts', type: 'many_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'people_events' },
    { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'task_events' },
    {
        name: 'Linked Forms',
        type: 'lookup',
        targetModuleKey: 'forms',
        localField: 'linkedFormId',
        foreignField: '_id',
        inverseName: 'Linked Events',
        inverseField: '',
        required: false,
        unique: false,
        index: true,
        cascadeDelete: false,
        label: 'Linked Form',
        description: 'Link audit forms to events for audit event types'
    },
    cloneDocumentInverseRelationship('events')
].filter(Boolean));

function cloneDealDefaultRelationships() {
    return JSON.parse(JSON.stringify(DEAL_DEFAULT_RELATIONSHIPS));
}

function clonePeopleDefaultRelationships() {
    return JSON.parse(JSON.stringify(PEOPLE_DEFAULT_RELATIONSHIPS));
}

function cloneOrganizationsDefaultRelationships() {
    return JSON.parse(JSON.stringify(ORGANIZATIONS_DEFAULT_RELATIONSHIPS));
}

function cloneEventsDefaultRelationships() {
    return JSON.parse(JSON.stringify(EVENTS_DEFAULT_RELATIONSHIPS));
}

function cloneCasesDefaultRelationships() {
    return JSON.parse(JSON.stringify(CASES_DEFAULT_RELATIONSHIPS));
}

function shouldUseOverrideRelationships(override, sys) {
    if (override?.relationships === undefined) {
        return false;
    }

    const moduleKey = String(
        override?.key
        || override?.moduleKey
        || sys?.key
        || sys?.moduleKey
        || ''
    ).toLowerCase();

    // Events must always surface system defaults when config is empty.
    // Empty arrays in legacy org docs should not suppress seeded defaults.
    if (moduleKey === 'events' && Array.isArray(override.relationships) && override.relationships.length === 0) {
        return false;
    }

    if (moduleKey === 'cases' && Array.isArray(override.relationships) && override.relationships.length === 0) {
        return false;
    }

    if (moduleKey === 'quotes' && Array.isArray(override.relationships) && override.relationships.length === 0) {
        return false;
    }

    if (moduleKey === 'documents' && Array.isArray(override.relationships) && override.relationships.length === 0) {
        return false;
    }

    // Organization-level overrides intentionally control behavior, including explicit empty arrays.
    if (override?.organizationId) {
        return true;
    }

    // Platform-level docs with empty relationships should not erase in-code defaults.
    if (Array.isArray(override.relationships) && override.relationships.length === 0) {
        return false;
    }

    // Non-array values (legacy) and non-empty arrays should be honored.
    return true;
}

exports.listModules = async (req, res) => {
    try {
        // Get context from query parameter (default to 'platform')
        const currentContext = (req.query.context || 'platform').toLowerCase();

        // Early key filter: callers like Tasks/Deals pass ?key= — avoid building every system module.
        const keyParamEarly = req.query.key || req.query.keys;
        const requestedKeys = keyParamEarly
            ? new Set(
                String(keyParamEarly)
                    .split(',')
                    .map((k) => k.toLowerCase().trim())
                    .filter(Boolean)
              )
            : null;

        // Ensure inventory ledger + workbench ModuleDefinitions when Inventory is titled
        // (Settings fields schema, role permission catalog, module list merge).
        if (
            currentContext === 'inventory' ||
            !requestedKeys ||
            [...(requestedKeys || [])].some((k) => isInventorySchemaModuleKey(k))
        ) {
            try {
                const {
                    ensureInventoryAppModuleDefinitions
                } = require('../services/inventoryModuleBootstrapService');
                await ensureInventoryAppModuleDefinitions();
            } catch (invBootErr) {
                console.warn('[listModules] inventory bootstrap failed:', invBootErr.message);
            }
        }
        
        // Static system modules (always present)
        const SYSTEM_MODULE_CATALOG = [
            { key: 'people', name: 'People' },
            { key: 'organizations', name: 'Organizations' },
            { key: 'deals', name: 'Deals' },
            { key: 'quotes', name: 'Quotes' },
            { key: 'sales_orders', name: 'Sales Orders' },
            { key: 'invoices', name: 'Invoices' },
            { key: 'payments', name: 'Payments' },
            { key: 'documents', name: 'Documents' },
            { key: 'cases', name: 'Cases' },
            { key: 'tasks', name: 'Tasks' },
            { key: 'events', name: 'Events' },
            { key: 'forms', name: 'Forms' },
            { key: 'items', name: 'Items' },
            { key: 'inventory', name: 'Inventory' },
            ...INVENTORY_WORKBENCH_MODULES,
            { key: 'imports', name: 'Imports' },
            { key: 'reports', name: 'Reports' },
            { key: 'users', name: 'Users' } // For lookup targets (assignedTo, lead_owner, createdBy)
        ];
        const systemModuleDefs = requestedKeys
            ? SYSTEM_MODULE_CATALOG.filter((m) => requestedKeys.has(m.key))
            : SYSTEM_MODULE_CATALOG;
        const systemModules = systemModuleDefs.map(m => {
            let baseFields = m.key === 'users' ? [] : getBaseFieldsForKey(m.key);
            // Inventory: never leave empty schema fields on the system base (org empty MD merges can't recover).
            if (
                m.key !== 'users' &&
                isInventorySchemaModuleKey(m.key) &&
                (!Array.isArray(baseFields) || baseFields.length === 0)
            ) {
                try {
                    const {
                        getInventoryModuleFieldCatalog
                    } = require('../services/inventoryModuleFieldCatalogService');
                    baseFields = getInventoryModuleFieldCatalog(m.key) || [];
                } catch (catErr) {
                    console.warn(
                        `[listModules] inventory field catalog failed for ${m.key}:`,
                        catErr?.message || catErr
                    );
                }
            }
            const baseModule = {
                _id: `system:${m.key}`,
                organizationId: req.user.organizationId,
                key: m.key,
                name: m.name,
                type: 'system',
                enabled: true,
                fields: baseFields,
                fieldCount: 0,
                createdAt: null,
                updatedAt: null,
                pipelineSettings: m.key === 'deals' ? getDefaultPipelineSettings() : [],
            relationships: m.key === 'events' ? cloneEventsDefaultRelationships() : m.key === 'deals' ? cloneDealDefaultRelationships() : m.key === 'people' ? clonePeopleDefaultRelationships() : m.key === 'organizations' ? cloneOrganizationsDefaultRelationships() : m.key === 'cases' ? cloneCasesDefaultRelationships() : m.key === 'tasks' ? [] : m.key === 'items' ? [
                {
                    name: 'Vendor',
                    type: 'lookup',
                    targetModuleKey: 'organizations',
                    localField: 'vendor',
                    foreignField: '_id',
                    inverseName: 'Items',
                    inverseField: '',
                    required: false,
                    unique: false,
                    index: true,
                    cascadeDelete: false,
                    label: 'Vendor',
                    description: 'Link to vendor/supplier organization'
                },
                {
                    name: 'Linked Deals',
                    type: 'many_to_many',
                    targetModuleKey: 'deals',
                    localField: 'linked_deals',
                    foreignField: '_id',
                    inverseName: 'Linked Items',
                    inverseField: '',
                    required: false,
                    unique: false,
                    index: true,
                    cascadeDelete: false,
                    label: 'Linked Deals',
                    description: 'Deals where this item is quoted or sold'
                },
                {
                    name: 'Linked Forms',
                    type: 'many_to_many',
                    targetModuleKey: 'forms',
                    localField: 'linked_forms',
                    foreignField: '_id',
                    inverseName: 'Linked Items',
                    inverseField: '',
                    required: false,
                    unique: false,
                    index: true,
                    cascadeDelete: false,
                    label: 'Linked Forms',
                    description: 'Audit, feedback, or maintenance forms linked to this item'
                },
                {
                    name: 'Linked Contacts',
                    type: 'many_to_many',
                    targetModuleKey: 'people',
                    localField: 'linked_contacts',
                    foreignField: '_id',
                    inverseName: 'Linked Items',
                    inverseField: '',
                    required: false,
                    unique: false,
                    index: true,
                    cascadeDelete: false,
                    label: 'Linked Contacts',
                    description: 'Contacts linked to this item (end users, product testers, etc.)'
                },
                cloneDocumentInverseRelationship('items')
            ].filter(Boolean) : m.key === 'quotes' ? cloneQuoteDefaultRelationships() : m.key === 'documents' ? cloneDocumentDefaultRelationships() : [],
            // Phase 17: Add default notification metadata
            notifications: getDefaultNotificationMetadata(m.key)
        };
        
        return baseModule;
        });

        // Exclude 'groups' from modules list (it's a settings feature, not a module)
        // Query organization-specific modules (overrides)
        // Also query platform-level modules (appKey: 'platform', organizationId: null) for core entities
        // Note: Using .lean() returns plain objects, and .select('+quickCreate') only works if field has select: false
        const platformCoreKeys = ['people', 'organizations', 'tasks', 'events', 'items', 'forms', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents'];
        const platformKeysForQuery = requestedKeys
            ? platformCoreKeys.filter((k) => requestedKeys.has(k))
            : platformCoreKeys;
        const orgKeyFilter = requestedKeys
            ? { $in: [...requestedKeys].filter((k) => k !== 'groups') }
            : { $ne: 'groups' };
        const customQueryOr = [
            { organizationId: req.user.organizationId, key: orgKeyFilter },
        ];
        if (platformKeysForQuery.length > 0) {
            customQueryOr.push({
                appKey: 'platform',
                organizationId: null,
                moduleKey: { $in: platformKeysForQuery },
            });
        }
        // Inventory app modules (ledger + commercial workbench) live at appKey=inventory.
        const inventoryModuleKeysForQuery = (!requestedKeys
            ? ['inventory', ...INVENTORY_WORKBENCH_KEYS]
            : ['inventory', ...INVENTORY_WORKBENCH_KEYS].filter((k) => requestedKeys.has(k)));
        if (inventoryModuleKeysForQuery.length > 0) {
            customQueryOr.push({
                appKey: 'inventory',
                organizationId: null,
                moduleKey: { $in: inventoryModuleKeysForQuery },
            });
        }
        const custom = await ModuleDefinition.find({ $or: customQueryOr })
        .select('+quickCreate +quickCreateLayout')
        .lean();
        
        // Also query directly from MongoDB to verify data exists (bypass Mongoose schema)
        // Check both organization-specific and platform-level modules
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const collection = db.collection('moduledefinitions');
        const orgObjectId = new mongoose.Types.ObjectId(req.user.organizationId);
        
        // Check for organization-specific People module (same filter as updateSystemModule upsert)
        const needsPeopleRaw = !requestedKeys || requestedKeys.has('people');
        const peopleModuleRaw = needsPeopleRaw
            ? await collection.findOne({
                organizationId: orgObjectId,
                key: 'people'
            })
            : null;
        
        // Also check for platform-level People module
        const platformPeopleModuleRaw = needsPeopleRaw
            ? await collection.findOne({
                appKey: 'platform',
                moduleKey: 'people',
                organizationId: null
            })
            : null;
        
        // Merge quickCreate from raw MongoDB for people. Raw is source of truth (Settings saves via direct MongoDB).
        // Prefer org override > platform. Always use raw when it has non-empty quickCreate (overwrite Mongoose).
        for (const module of custom) {
            const moduleKey = module.key || module.moduleKey;
            if (moduleKey === 'people') {
                const fromOrg = peopleModuleRaw && Array.isArray(peopleModuleRaw.quickCreate) && peopleModuleRaw.quickCreate.length > 0;
                const fromPlatform = platformPeopleModuleRaw && Array.isArray(platformPeopleModuleRaw.quickCreate) && platformPeopleModuleRaw.quickCreate.length > 0;
                if (fromOrg) {
                    module.quickCreate = peopleModuleRaw.quickCreate;
                    module.quickCreateLayout = (peopleModuleRaw.quickCreateLayout && typeof peopleModuleRaw.quickCreateLayout === 'object')
                        ? peopleModuleRaw.quickCreateLayout
                        : { version: 1, rows: [] };
                } else if (fromPlatform) {
                    module.quickCreate = platformPeopleModuleRaw.quickCreate;
                    module.quickCreateLayout = platformPeopleModuleRaw.quickCreateLayout || { version: 1, rows: [] };
                }
            }
        }

        // Other tenant system modules: fields/quickCreate/fieldLayout are persisted via raw Mongo in
        // updateSystemModule. Dual mongoose+mongo upserts can leave stale lean docs without custom
        // fields — overlay from native driver (prefer the org doc with the richest fields array).
        const orgDocTimestamp = (value) => {
            if (!value) return 0;
            const ts = new Date(value).getTime();
            return Number.isFinite(ts) ? ts : 0;
        };
        const orgQuickCreateRawKeys = [
            'people', 'tasks', 'organizations', 'events', 'items', 'deals', 'quotes', 'sales_orders',
            'invoices', 'payments', 'documents', 'cases', 'forms'
        ];
        const orgKeysToOverlay = orgQuickCreateRawKeys.filter((k) => !requestedKeys || requestedKeys.has(k));
        if (orgKeysToOverlay.length > 0) {
            const orgIdVariants = [
                orgObjectId,
                String(req.user.organizationId),
                ...(mongoose.Types.ObjectId.isValid(req.user.organizationId)
                    ? [req.user.organizationId]
                    : [])
            ];
            const orgRawDocs = await collection.find({
                organizationId: { $in: orgIdVariants },
                $or: [
                    { key: { $in: orgKeysToOverlay } },
                    { moduleKey: { $in: orgKeysToOverlay } }
                ]
            }).toArray();
            const orgRawByKey = new Map();
            for (const doc of orgRawDocs) {
                const moduleKey = String(doc.key || doc.moduleKey || '').toLowerCase();
                if (!moduleKey) continue;
                const existing = orgRawByKey.get(moduleKey);
                if (!existing) {
                    orgRawByKey.set(moduleKey, doc);
                    continue;
                }
                const existingLen = Array.isArray(existing.fields) ? existing.fields.length : 0;
                const incomingLen = Array.isArray(doc.fields) ? doc.fields.length : 0;
                if (incomingLen > existingLen) {
                    orgRawByKey.set(moduleKey, doc);
                    continue;
                }
                if (incomingLen < existingLen) continue;
                const existingTs = orgDocTimestamp(existing.updatedAt) || orgDocTimestamp(existing.createdAt);
                const incomingTs = orgDocTimestamp(doc.updatedAt) || orgDocTimestamp(doc.createdAt);
                if (incomingTs >= existingTs) orgRawByKey.set(moduleKey, doc);
            }
            for (const module of custom) {
                if (!module.organizationId) continue;
                const moduleKey = String(module.key || module.moduleKey || '').toLowerCase();
                const raw = orgRawByKey.get(moduleKey);
                if (!raw) continue;
                if (Array.isArray(raw.fields) && raw.fields.length > 0) {
                    module.fields = raw.fields;
                }
                if (raw.fieldLayout && typeof raw.fieldLayout === 'object') {
                    module.fieldLayout = raw.fieldLayout;
                }
                if (Array.isArray(raw.quickCreate)) {
                    module.quickCreate = raw.quickCreate;
                }
                if (raw.quickCreateLayout && typeof raw.quickCreateLayout === 'object') {
                    module.quickCreateLayout = raw.quickCreateLayout;
                }
            }
        }

        // Platform core modules: overlay quickCreate from raw Mongo (Settings saves to platform doc for quotes, etc.)
        const platformQuickCreateRawKeys = ['tasks', 'organizations', 'events', 'items', 'forms', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents'];
        const platformKeysToOverlay = platformQuickCreateRawKeys.filter((k) => !requestedKeys || requestedKeys.has(k));
        if (platformKeysToOverlay.length > 0) {
            const platformRawDocs = await collection.find({
                appKey: 'platform',
                organizationId: null,
                moduleKey: { $in: platformKeysToOverlay },
            }).toArray();
            const platformRawByKey = new Map(
                platformRawDocs.map((doc) => [String(doc.moduleKey || '').toLowerCase(), doc])
            );
            for (const module of custom) {
                if (module.organizationId) continue;
                if (String(module.appKey || '').toLowerCase() !== 'platform') continue;
                const moduleKey = String(module.key || module.moduleKey || '').toLowerCase();
                const raw = platformRawByKey.get(moduleKey);
                if (!raw || !Array.isArray(raw.quickCreate)) continue;
                module.quickCreate = raw.quickCreate;
                if (raw.quickCreateLayout && typeof raw.quickCreateLayout === 'object') {
                    module.quickCreateLayout = raw.quickCreateLayout;
                }
            }
        }
        
        // Build map of modules by key
        // Priority: organization-specific overrides first, then platform-level modules
        // Use same object references as custom so quickCreate merge (above) applies to what we use in the main merge.
        const customByKey = new Map();
        
        // First add platform-level modules (base configuration) and Inventory app modules
        for (const m of custom) {
            const appKeyLower = String(m.appKey || '').toLowerCase();
            const isPlatformBase = appKeyLower === 'platform' && !m.organizationId;
            const isInventoryAppModule = appKeyLower === 'inventory' && !m.organizationId;
            if (isPlatformBase || isInventoryAppModule) {
                const moduleKey = m.moduleKey || m.key;
                if (moduleKey) {
                    if (!m.key) m.key = moduleKey;
                    if (!customByKey.has(moduleKey)) {
                        customByKey.set(moduleKey, m);
                    }
                }
            }
        }
        
        const hasCanonicalOrgKey = (doc, moduleKey) => {
            const key = String(doc?.key || '').toLowerCase().trim();
            const mk = String(moduleKey || '').toLowerCase().trim();
            return Boolean(key) && key === mk;
        };
        const hasCanonicalOrgModuleKey = (doc, moduleKey) => {
            const key = String(doc?.moduleKey || '').toLowerCase().trim();
            const mk = String(moduleKey || '').toLowerCase().trim();
            return Boolean(key) && key === mk;
        };
        const toTimestamp = (value) => {
            if (!value) return 0;
            const ts = new Date(value).getTime();
            return Number.isFinite(ts) ? ts : 0;
        };
        const choosePreferredOrgOverride = (current, incoming, moduleKey) => {
            if (!current) return incoming;
            const currentHasKey = hasCanonicalOrgKey(current, moduleKey);
            const incomingHasKey = hasCanonicalOrgKey(incoming, moduleKey);
            if (incomingHasKey !== currentHasKey) {
                return incomingHasKey ? incoming : current;
            }
            const currentHasModuleKey = hasCanonicalOrgModuleKey(current, moduleKey);
            const incomingHasModuleKey = hasCanonicalOrgModuleKey(incoming, moduleKey);
            if (incomingHasModuleKey !== currentHasModuleKey) {
                return incomingHasModuleKey ? incoming : current;
            }
            // Prefer the override that actually carries field config (avoids dual-doc stale shells).
            const currentFieldsLen = Array.isArray(current.fields) ? current.fields.length : 0;
            const incomingFieldsLen = Array.isArray(incoming.fields) ? incoming.fields.length : 0;
            if (incomingFieldsLen !== currentFieldsLen) {
                return incomingFieldsLen > currentFieldsLen ? incoming : current;
            }
            const currentUpdatedAt = toTimestamp(current.updatedAt) || toTimestamp(current.createdAt);
            const incomingUpdatedAt = toTimestamp(incoming.updatedAt) || toTimestamp(incoming.createdAt);
            if (incomingUpdatedAt !== currentUpdatedAt) {
                return incomingUpdatedAt > currentUpdatedAt ? incoming : current;
            }
            return incoming;
        };
        
        // Then add organization-specific overrides (these take precedence over platform)
        for (const m of custom) {
            if (m.organizationId) {
                const moduleKey = m.key || m.moduleKey;
                if (moduleKey) {
                    const existing = customByKey.get(moduleKey);
                    customByKey.set(moduleKey, choosePreferredOrgOverride(existing, m, moduleKey));
                }
            }
        }

        // Canonicalize/normalize known system field keys to avoid duplicates from legacy casing/kebab-case.
        // This prevents UI from rendering the same field twice (e.g., "linkedFormId" vs "Linked Form ID").
        const normalizeKebabToCamel = (s) => String(s || '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const normalizeEventFieldKey = (key) => {
            const raw = String(key || '').trim();
            const camel = normalizeKebabToCamel(raw);
            const normalized = camel.toLowerCase().replace(/[^a-z0-9]/g, ''); // remove dashes/underscores/spaces defensively
            // Map legacy variants to canonical schema keys
            const canonicalMap = {
                linkedformid: 'linkedFormId',
                relatedtoid: 'relatedToId',
                // Legacy aliases seen in older org configs / UI
                relatedorg: 'relatedToId',
                relatedorgid: 'relatedToId',
                relatedorganization: 'relatedToId',
                assignedto: 'assignedTo',
                startdatetime: 'startDateTime',
                enddatetime: 'endDateTime',
                allowselfreview: 'allowSelfReview',
                auditorid: 'auditorId',
                reviewerid: 'reviewerId',
                correctiveownerid: 'correctiveOwnerId',
                meetingmode: 'meetingMode',
                meetinglink: 'meetingLink',
                conferenceprovider: 'conferenceProvider',
                agendanotes: 'agendaNotes',
                attendees: 'attendees'
            };
            return canonicalMap[normalized] || camel || raw;
        };
        // Merge: system base + stored overrides for same key (both custom and system-typed docs are stored in ModuleDefinition)
        const merged = [];
        for (const sys of systemModules) {
            // Try to find override by key (organization-specific) first, then by moduleKey (platform)
            let override = customByKey.get(sys.key);
            if (!override) {
                // Also check if there's a platform module with moduleKey matching sys.key
                for (const [mapKey, mapValue] of customByKey.entries()) {
                    if ((mapValue.moduleKey || mapValue.key) === sys.key) {
                        override = mapValue;
                        break;
                    }
                }
            }
            
            if (override) {
                // Respect saved order from override; append any base fields not present, in base order
                // Remove legacy/deprecated fields from saved overrides to prevent "ghost" fields reappearing.
                // (Even if they exist in the DB config, we treat them as removed from the product.)
                const deprecatedEventAliasKeys = new Set(['relatedorg', 'relatedorgid', 'relatedorganization']);
                let saved = (Array.isArray(override.fields) ? [...override.fields] : [])
                    .filter(f => {
                        const k = String(f?.key || '').toLowerCase();
                        if (k === 'correctiveactionowners') return false;
                        if (k === 'customfields') return false; // Storage bucket, not a configurable field
                        if (sys.key === 'cases' && isCasesFormExcludedField(k)) return false;
                        // Remove legacy/alias event field keys that should not exist in UI config
                        if (sys.key === 'events' && deprecatedEventAliasKeys.has(k)) return false;
                        // Items: legacy Active/Inactive status — canonical UI field is lifecycle_state
                        if (sys.key === 'items' && k === 'status') return false;
                        return true;
                    });

                // Normalize + dedupe Event system fields so key variants don't create duplicate fields in UI
                if (sys.key === 'events') {
                    saved = saved.map(f => {
                        if (!f || !f.key) return f;
                        return { ...f, key: normalizeEventFieldKey(f.key) };
                    });
                    saved = dedupeFieldsByKey(saved);
                }
                // Dedupe Tasks fields (e.g. deletedBy can appear twice if Trash fields were added multiple times)
                if (sys.key === 'tasks') {
                    saved = dedupeFieldsByKey(saved);
                }
                saved.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const seen = new Set(saved.map(f => f.key));

                // Create a map of base fields by key for quick lookup (case-insensitive, space-insensitive)
                const baseFieldMap = new Map();
                const baseFieldMapCanonical = new Map();
                for (const f of sys.fields) {
                    if (f.key) {
                        baseFieldMap.set(f.key, f);
                        baseFieldMapCanonical.set(fieldKeyCanonical(f.key), f);
                    }
                }

                // Update saved fields with base field dataType and options (for system modules, schema is source of truth)
                // BUT preserve saved labels and lookupSettings
                for (const savedField of saved) {
                    if (!savedField.key) continue;

                    // Ensure owner and context are set (safe defaults for existing fields)
                    if (!savedField.owner) savedField.owner = 'platform';
                    if (!savedField.context) savedField.context = 'global';

                    // Try exact match first, then canonical match (handles "Deleted By" -> deletedBy)
                    let baseField = baseFieldMap.get(savedField.key);
                    if (!baseField) {
                        baseField = baseFieldMapCanonical.get(fieldKeyCanonical(savedField.key));
                    }
                    
                    if (baseField) {
                        // Normalize field key to match base field key (camelCase)
                        if (savedField.key.toLowerCase() === baseField.key.toLowerCase() && savedField.key !== baseField.key) {
                            savedField.key = baseField.key;
                        }
                        
                        // Update dataType from base (schema is source of truth for system modules)
                        savedField.dataType = baseField.dataType;
                        // Update options if base has them (for picklists), but preserve saved option metadata
                        // such as color/label/enabled when values still exist in base schema options.
                        // For tenant-managed picklists (tasks status/priority, organizations catalog fields),
                        // saved options are source of truth so org-configured values persist.
                        if (baseField.options && baseField.options.length > 0) {
                            const savedOptions = Array.isArray(savedField.options) ? savedField.options : [];
                            const useSavedOptionsSource = usesSavedPicklistOptionsAsSourceOfTruth(sys.key, savedField.key);

                            if (useSavedOptionsSource && savedOptions.length > 0) {
                                savedField.options = mergeSavedPicklistOptionsWithBase(savedOptions, baseField.options);
                            } else {
                                const baseOptionValues = baseField.options
                                    .map((opt) => {
                                        if (opt && typeof opt === 'object') {
                                            return String(opt.value ?? opt.key ?? '').trim();
                                        }
                                        return String(opt || '').trim();
                                    })
                                    .filter(Boolean);

                                const savedOptionMetaByValue = new Map(
                                    savedOptions
                                        .map((opt) => {
                                            if (opt && typeof opt === 'object') {
                                                const value = String(opt.value ?? opt.key ?? '').trim();
                                                return value ? [value, opt] : null;
                                            }
                                            const value = String(opt || '').trim();
                                            return value ? [value, { value }] : null;
                                        })
                                        .filter(Boolean)
                                );

                                savedField.options = baseOptionValues.map((value) => {
                                    const baseMeta = (Array.isArray(baseField.options)
                                        ? baseField.options.find((opt) => {
                                            if (opt && typeof opt === 'object') {
                                                return String(opt.value ?? opt.key ?? '').trim() === value;
                                            }
                                            return String(opt || '').trim() === value;
                                        })
                                        : null) || null;
                                    const savedMeta = savedOptionMetaByValue.get(value) || null;

                                    if (baseMeta && typeof baseMeta === 'object') {
                                        return {
                                            ...baseMeta,
                                            ...(savedMeta && typeof savedMeta === 'object' ? savedMeta : {}),
                                            value
                                        };
                                    }

                                    if (savedMeta && typeof savedMeta === 'object') {
                                        return {
                                            ...savedMeta,
                                            value
                                        };
                                    }

                                    return { value };
                                });
                            }
                        }
                        // Preserve saved "Required in Form" from Settings; only fall back to base when not set
                        if (savedField.required === undefined) {
                            savedField.required = baseField.required;
                        }
                        if (isModuleOwnerField(sys.key, savedField.key)) {
                            savedField.required = true;
                        }
                        if (sys.key === 'events' && isInitialEventRequiredField(savedField.key)) {
                            savedField.required = true;
                        }
                        if (sys.key === 'events' && String(savedField.key || '').toLowerCase() === 'eventtype') {
                            const rawDefault = savedField.defaultValue ?? baseField.defaultValue ?? 'Meeting';
                            savedField.defaultValue = normalizeMeetingEventTypeLabel(rawDefault) || 'Meeting';
                        }
                        // Default keyField from base so default key fields (e.g. people: organization, email, phone, assignedTo) show in field configuration
                        if (savedField.keyField === undefined) {
                            savedField.keyField = !!baseField.keyField;
                        }
                        // Use base label if saved label is empty, technical default, or same as key (e.g. camelCase key stored as label).
                        // Ensures UI always gets human-readable labels from field configuration.
                        if (baseField.label) {
                            const savedLabelLower = String(savedField.label || '').toLowerCase().trim();
                            const isTechnicalDefault = [
                                'event owner id',
                                'assignedto',
                                'linked form id',
                                'linkedformid',
                                'related to id',
                                'relatedtoid',
                                'form id',
                                'formid',
                                'organization id',
                                'organizationid'
                            ].includes(savedLabelLower);
                            const isLegacyAssignedToOwnerLabel =
                                String(savedField.key || '').toLowerCase() === 'assignedto' &&
                                [
                                    'owner',
                                    'deal owner',
                                    'event owner',
                                    'case owner',
                                    'case owner id',
                                    'assigned to (owner)'
                                ].includes(savedLabelLower);
                            const keyNorm = String(savedField.key || '').replace(/\s+/g, '').toLowerCase();
                            const labelNorm = String(savedField.label || '').replace(/\s+/g, '').toLowerCase();
                            const isLabelSameAsKey = keyNorm && labelNorm === keyNorm;
                            if (!savedField.label || isTechnicalDefault || isLabelSameAsKey || isLegacyAssignedToOwnerLabel) {
                                savedField.label = baseField.label;
                            }
                        }

                        // Carry base placeholder (used as helper text for Lookup fields) if none is configured.
                        if (baseField.placeholder && !savedField.placeholder) {
                            savedField.placeholder = baseField.placeholder;
                        }
                        // Always use base lookupSettings if available (base is source of truth for system modules)
                        if (baseField.lookupSettings) {
                            savedField.lookupSettings = baseField.lookupSettings;
                        }
                        // Always use base dependencies if available (base is source of truth for system modules)
                        if (baseField.dependencies && Array.isArray(baseField.dependencies) && baseField.dependencies.length > 0) {
                            // Respect saved dependency configuration if present (Settings → Modules & Fields → Field Dependencies).
                            // Only default to base dependencies when none are configured.
                            const hasSavedDeps = Array.isArray(savedField.dependencies) && savedField.dependencies.length > 0;
                            if (!hasSavedDeps) {
                                savedField.dependencies = JSON.parse(JSON.stringify(baseField.dependencies));
                            }
                        }

                        // Events: normalize assignedTo audit UX (even if org has older saved deps):
                        // - Hide assignedTo for audit event types (auditorId is used)
                        if (sys.key === 'events' && savedField.key === 'assignedTo') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];

                            // Remove any legacy label override that rebrands assignedTo as "Auditor"
                            const cleaned = deps.filter(d => !(d && d.type === 'label' && String(d.labelValue || '').toLowerCase() === 'auditor'));

                            const hasHideForAudits = cleaned.some(d =>
                                d.type === 'visibility' &&
                                d.fieldKey === 'eventType' &&
                                d.operator === 'not_in'
                            );

                            if (!hasHideForAudits) {
                                cleaned.push({
                                    name: 'Show only for non-audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'not_in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }

                            savedField.dependencies = cleaned;
                        }
                        // For linkedFormId in events module, ensure visibility dependency exists (backward compatibility check)
                        if (sys.key === 'events' && savedField.key === 'linkedFormId') {
                            const hasVisibilityDep = savedField.dependencies && savedField.dependencies.some(
                                dep => dep.type === 'visibility' && dep.fieldKey === 'eventType'
                            );
                            if (!hasVisibilityDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                        }

                        // For relatedToId in events module, ensure single-org audit visibility + required dependencies exist
                        if (sys.key === 'events' && savedField.key === 'relatedToId') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const hasVisibility = deps.some(d => d && d.type === 'visibility' && d.fieldKey === 'eventType');
                            const hasRequired = deps.some(d => d && d.type === 'required' && d.fieldKey === 'eventType');
                            const hasReadonly = deps.some(d => d && d.type === 'readonly' && d.fieldKey === 'eventType' && d.operator === 'equals' && d.value === 'Internal Audit');
                            const hasSetValue = deps.some(d => d && d.type === 'setValue' && d.fieldKey === 'eventType' && d.operator === 'equals' && d.value === 'Internal Audit');
                            if (!hasVisibility) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for single-org audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasRequired) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Required for single-org audit event types',
                                    type: 'required',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasReadonly) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Internal Audit: lock organization to current org',
                                    type: 'readonly',
                                    fieldKey: 'eventType',
                                    operator: 'equals',
                                    value: 'Internal Audit',
                                    logic: 'AND'
                                });
                            }
                            if (!hasSetValue) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Internal Audit: force relatedToId = current org',
                                    type: 'setValue',
                                    fieldKey: 'eventType',
                                    operator: 'equals',
                                    value: 'Internal Audit',
                                    logic: 'AND',
                                    setValue: '$currentUser.organizationId'
                                });
                            }
                        }

                        // For allowSelfReview in events module, ensure audit-only visibility dependency exists by default
                        if (sys.key === 'events' && savedField.key === 'allowSelfReview') {
                            const hasVisibilityDep = savedField.dependencies && savedField.dependencies.some(
                                dep => dep.type === 'visibility' && dep.fieldKey === 'eventType'
                            );
                            if (!hasVisibilityDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                        }

                        // For geoRequired in events: physical/check-in only — hide for Virtual meetings.
                        // Visibility rules OR together (audit | field sales | in-person/hybrid Meeting).
                        if (sys.key === 'events' && savedField.key === 'geoRequired') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const cleaned = deps.filter(d => !(d && String(d.type || '').toLowerCase() === 'visibility'));

                            const hasReadonlyAudit = cleaned.some(d =>
                                d && d.type === 'readonly' && d.fieldKey === 'eventType'
                            );
                            const hasRequiredAudit = cleaned.some(d =>
                                d && d.type === 'required' && d.fieldKey === 'eventType'
                            );

                            cleaned.push(
                                {
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                },
                                {
                                    name: 'Show for Field Sales Beat',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'equals',
                                    value: 'Field Sales Beat',
                                    logic: 'AND'
                                },
                                {
                                    name: 'Show for in-person or hybrid meetings',
                                    type: 'visibility',
                                    logic: 'AND',
                                    conditions: [
                                        { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                        { fieldKey: 'meetingMode', operator: 'in', value: ['In-person', 'Hybrid'] }
                                    ]
                                }
                            );

                            if (!hasReadonlyAudit) {
                                cleaned.push({
                                    name: 'Read-only for audit event types',
                                    type: 'readonly',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasRequiredAudit) {
                                cleaned.push({
                                    name: 'Required for audit event types',
                                    type: 'required',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }

                            savedField.dependencies = cleaned;
                        }

                        // Location: hide for pure Virtual meetings
                        if (sys.key === 'events' && String(savedField.key || '').toLowerCase() === 'location') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const cleaned = deps.filter(d => !(d && String(d.type || '').toLowerCase() === 'visibility'));
                            cleaned.push(
                                {
                                    name: 'Show for audit and field sales event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: [
                                        'Internal Audit',
                                        'External Audit — Single Org',
                                        'External Audit Beat',
                                        'Field Sales Beat'
                                    ],
                                    logic: 'AND'
                                },
                                {
                                    name: 'Show for in-person or hybrid meetings',
                                    type: 'visibility',
                                    logic: 'AND',
                                    conditions: [
                                        { fieldKey: 'eventType', operator: 'equals', value: 'Meeting' },
                                        { fieldKey: 'meetingMode', operator: 'in', value: ['In-person', 'Hybrid'] }
                                    ]
                                }
                            );
                            savedField.dependencies = cleaned;
                        }

                        // For minVisitDuration in events module: show whenever geoRequired = true
                        if (sys.key === 'events' && savedField.key === 'minVisitDuration') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            // Remove any legacy visibility dependencies (e.g., eventType-based)
                            const cleaned = deps.filter(d => !(d && d.type === 'visibility'));
                            cleaned.push({
                                name: 'Show when GEO is required',
                                type: 'visibility',
                                fieldKey: 'geoRequired',
                                operator: 'equals',
                                value: true,
                                logic: 'AND'
                            });
                            savedField.dependencies = cleaned;
                        }

                        // For partnerVisibility in events module: only External Audit — Single Org
                        if (sys.key === 'events' && savedField.key === 'partnerVisibility') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            // Normalize: keep non-visibility deps, replace visibility with the correct scope
                            const cleaned = deps.filter(d => !(d && d.type === 'visibility'));
                            cleaned.push({
                                name: 'Show only for External Audit — Single Org',
                                type: 'visibility',
                                fieldKey: 'eventType',
                                operator: 'equals',
                                value: 'External Audit — Single Org',
                                logic: 'AND'
                            });
                            savedField.dependencies = cleaned;
                        }

                        // For reviewerId in events module, ensure audit-only visibility + required dependencies exist by default
                        if (sys.key === 'events' && savedField.key === 'reviewerId') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const hasVisibilityDep = deps.some(dep => dep.type === 'visibility' && dep.fieldKey === 'eventType');
                            const hasRequiredDep = deps.some(dep => dep.type === 'required' && dep.fieldKey === 'eventType');
                            const hasLookupDep = deps.some(dep => dep.type === 'lookup');
                        if (!hasVisibilityDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasRequiredDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Required for External Audit — Single Org',
                                    type: 'required',
                                    fieldKey: 'eventType',
                                    operator: 'equals',
                                value: 'External Audit — Single Org',
                                    logic: 'AND'
                                });
                            }
                            if (!hasLookupDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Reviewer pool: internal users only',
                                    type: 'lookup',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND',
                                    lookupQuery: { scope: 'internal' }
                                });
                            }
                        }

                        // For auditorId in events module, ensure audit-only visibility + required dependencies + lookup scoping exist by default
                        if (sys.key === 'events' && savedField.key === 'auditorId') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const hasVisibilityDep = deps.some(dep => dep.type === 'visibility' && dep.fieldKey === 'eventType');
                            const hasRequiredDep = deps.some(dep => dep.type === 'required' && dep.fieldKey === 'eventType');
                            const hasLookupDep = deps.some(dep => dep.type === 'lookup');

                            if (!hasVisibilityDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasRequiredDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Required for audit event types',
                                    type: 'required',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasLookupDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push(
                                    {
                                        name: 'Auditor pool: Internal Audit -> internal users only',
                                        type: 'lookup',
                                        fieldKey: 'eventType',
                                        operator: 'equals',
                                        value: 'Internal Audit',
                                        logic: 'AND',
                                        lookupQuery: { scope: 'internal' }
                                    },
                                    {
                                        name: 'Auditor pool: External Audit — Single Org -> internal + org users',
                                        type: 'lookup',
                                        logic: 'AND',
                                        conditions: [
                                            { fieldKey: 'eventType', operator: 'equals', value: 'External Audit — Single Org' }
                                        ],
                                        lookupQuery: { scope: 'internal_or_org', orgId: '$field:relatedToId' }
                                    },
                                    {
                                        name: 'Auditor pool: External Audit Beat -> internal users only',
                                        type: 'lookup',
                                        fieldKey: 'eventType',
                                        operator: 'equals',
                                        value: 'External Audit Beat',
                                        logic: 'AND',
                                        lookupQuery: { scope: 'internal' }
                                    }
                                );
                            }
                        }

                        // For correctiveOwnerId in events module: ensure audit visibility/required and org-scoped picker
                        if (sys.key === 'events' && savedField.key === 'correctiveOwnerId') {
                            const deps = Array.isArray(savedField.dependencies) ? savedField.dependencies : [];
                            const hasVisibilityDep = deps.some(dep => dep.type === 'visibility' && dep.fieldKey === 'eventType');
                            const hasRequiredDep = deps.some(dep => dep.type === 'required' && dep.fieldKey === 'eventType');
                            const hasLookupDep = deps.some(dep => dep.type === 'lookup');

                            if (!hasVisibilityDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Show for audit event types',
                                    type: 'visibility',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasRequiredDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Required for audit event types',
                                    type: 'required',
                                    fieldKey: 'eventType',
                                    operator: 'in',
                                    value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                    logic: 'AND'
                                });
                            }
                            if (!hasLookupDep) {
                                if (!savedField.dependencies) savedField.dependencies = [];
                                savedField.dependencies.push({
                                    name: 'Corrective owner pool: users from selected Organization',
                                    type: 'lookup',
                                    logic: 'AND',
                                    conditions: [
                                        { fieldKey: 'eventType', operator: 'in', value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'] }
                                    ],
                                    lookupQuery: { scope: 'org', orgId: '$field:relatedToId' }
                                });
                            }
                        }
                    }
                }
                
                // Add any new base fields not in saved (canonical key: handles "Deleted By" vs "deletedBy")
                const savedCanonicalKeys = new Set(saved.map(f => fieldKeyCanonical(f.key)).filter(Boolean));
                for (const baseField of sys.fields) {
                    const alreadyExists = savedCanonicalKeys.has(fieldKeyCanonical(baseField.key));
                    if (!alreadyExists) {
                        // Ensure linkedFormId in events module has visibility dependency
                        let fieldToAdd = { ...baseField, order: saved.length };
                        if (sys.key === 'events' && baseField.key === 'linkedFormId' && (!fieldToAdd.dependencies || fieldToAdd.dependencies.length === 0)) {
                            fieldToAdd.dependencies = [{
                                name: 'Show for audit event types',
                                type: 'visibility',
                                fieldKey: 'eventType',
                                operator: 'in',
                                value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                logic: 'AND'
                            }];
                        }
                        if (sys.key === 'events' && baseField.key === 'allowSelfReview' && (!fieldToAdd.dependencies || fieldToAdd.dependencies.length === 0)) {
                            fieldToAdd.dependencies = [{
                                name: 'Show for audit event types',
                                type: 'visibility',
                                fieldKey: 'eventType',
                                operator: 'in',
                                value: ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
                                logic: 'AND'
                            }];
                        }
                        saved.push(fieldToAdd);
                    }
                }
                // Include quickCreate and quickCreateLayout from override if present
                let pipelineSettings = Array.isArray(override.pipelineSettings)
                    ? JSON.parse(JSON.stringify(override.pipelineSettings))
                    : JSON.parse(JSON.stringify(sys.pipelineSettings || []));
                if (sys.key === 'deals') {
                    if (pipelineSettings.length === 0 || isLegacyDefaultPipelineSettings(pipelineSettings)) {
                        pipelineSettings = getDefaultPipelineSettings();
                    }
                    pipelineSettings = normalizePipelineSettings(pipelineSettings);
                }
                // Use override quickCreate if it exists (even if empty array - that's a valid saved state)
                // For Events module, ensure quickCreate has at least the essential fields
                // Use override quickCreate if present (check for undefined/null, not falsy), otherwise use saved quickCreate, otherwise empty array
                // NO hardcoding - all configuration comes from the module definition saved in database
                console.log('🔍 Processing quickCreate for module:', sys.key, {
                    hasOverride: !!override,
                    overrideQuickCreate: override?.quickCreate,
                    overrideQuickCreateType: typeof override?.quickCreate,
                    overrideQuickCreateIsArray: Array.isArray(override?.quickCreate),
                    overrideQuickCreateLength: override?.quickCreate?.length || 0,
                    overrideHasQuickCreate: override ? 'quickCreate' in override : false,
                    overrideKeys: override ? Object.keys(override).slice(0, 20) : [],
                    sysQuickCreate: sys.quickCreate,
                    sysQuickCreateLength: sys.quickCreate?.length || 0
                });
                let finalQuickCreate = (override.quickCreate !== undefined && override.quickCreate !== null) 
                    ? override.quickCreate 
                    : (sys.quickCreate || []);
                let finalQuickCreateLayout = override.quickCreateLayout || { version: 1, rows: [] };
                
                // Apply canonical defaults for system modules when quickCreate is empty
                // This handles cases where platform modules have empty quickCreate arrays
                
                // ARCHITECTURE NOTE: Organizations Quick Create default
                // See: module-settings-doctrine.md, organization-settings.md
                if (sys.key === 'organizations' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_ORGANIZATION_QUICK_CREATE];
                    console.log('📋 Organizations: Applying canonical default Quick Create:', finalQuickCreate);
                }
                
                // ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
                // If Tasks quickCreate is empty, apply canonical default:
                // title*, dueDate, taskType, status, priority, relatedTo, description, assignedTo*
                // See: docs/architecture/task-settings.md Section 3.5
                if (sys.key === 'tasks' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = ['title', 'dueDate', 'taskType', 'status', 'priority', 'relatedTo', 'description', 'assignedTo'];
                    console.log('📋 Tasks: Applying canonical default Quick Create:', finalQuickCreate);
                }
                
                // ARCHITECTURE NOTE: Items Quick Create default
                // See: client/src/platform/fields/itemFieldModel.ts getItemQuickCreateFields()
                if (sys.key === 'items' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = ['item_name', 'item_type', 'categoryId', 'selling_price', 'unit_of_measure', 'lifecycle_state', 'assignedTo'];
                    console.log('📋 Items: Applying canonical default Quick Create:', finalQuickCreate);
                }
                // ARCHITECTURE NOTE: Deals Quick Create default
                // See: client/src/platform/fields/dealFieldModel.ts DEAL_QUICK_CREATE_DEFAULT
                if (sys.key === 'deals' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_DEALS_QUICK_CREATE];
                    console.log('📋 Deals: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'people' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_PEOPLE_QUICK_CREATE];
                    console.log('📋 People: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'cases' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_CASES_QUICK_CREATE];
                    console.log('📋 Cases: Applying canonical default Quick Create:', finalQuickCreate);
                }
                // Events: include status for Meeting / non-audit create UX
                if (sys.key === 'events') {
                    const eventsDefaultQc = [
                        'eventName',
                        'eventType',
                        'status',
                        'assignedTo',
                        'startDateTime',
                        'endDateTime',
                        'location',
                        'agendaNotes',
                    ];
                    if (!finalQuickCreate || finalQuickCreate.length === 0) {
                        finalQuickCreate = [...eventsDefaultQc];
                        console.log('📋 Events: Applying canonical default Quick Create:', finalQuickCreate);
                    } else if (
                        Array.isArray(finalQuickCreate) &&
                        !finalQuickCreate.some((k) => String(k).toLowerCase() === 'status')
                    ) {
                        const keys = finalQuickCreate.map((k) => String(k));
                        const typeIdx = keys.findIndex((k) => k.toLowerCase() === 'eventtype');
                        const insertAt = typeIdx >= 0 ? typeIdx + 1 : Math.min(2, keys.length);
                        keys.splice(insertAt, 0, 'status');
                        finalQuickCreate = keys;
                        console.log('📋 Events: Injected status into Quick Create:', finalQuickCreate);
                    }
                }
                if (sys.key === 'quotes' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_QUOTE_QUICK_CREATE];
                    console.log('📋 Quotes: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'sales_orders' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_SALES_ORDER_QUICK_CREATE];
                    console.log('📋 Sales Orders: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'purchase_orders' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_PURCHASE_ORDER_QUICK_CREATE];
                    console.log('📋 Purchase Orders: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'purchase_orders' && Array.isArray(finalQuickCreate) && finalQuickCreate.length) {
                    const keys = finalQuickCreate.map((k) => String(k));
                    const hasSubject = keys.some((k) => k.toLowerCase() === 'subject');
                    if (!hasSubject) {
                        finalQuickCreate = ['subject', ...keys];
                    }
                }
                if (sys.key === 'purchase_returns' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_PURCHASE_RETURN_QUICK_CREATE];
                    console.log('📋 Purchase Returns: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'purchase_returns' && Array.isArray(finalQuickCreate) && finalQuickCreate.length) {
                    const keys = finalQuickCreate.map((k) => String(k));
                    const hasSubject = keys.some((k) => k.toLowerCase() === 'subject');
                    if (!hasSubject) {
                        finalQuickCreate = ['subject', ...keys];
                    }
                }
                if (sys.key === 'delivery_returns' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_DELIVERY_RETURN_QUICK_CREATE];
                    console.log('📋 Delivery Returns: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'delivery_returns' && Array.isArray(finalQuickCreate) && finalQuickCreate.length) {
                    const keys = finalQuickCreate.map((k) => String(k));
                    const hasSubject = keys.some((k) => k.toLowerCase() === 'subject');
                    if (!hasSubject) {
                        finalQuickCreate = ['subject', ...keys];
                    }
                }
                if (sys.key === 'sales_returns' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_SALES_RETURN_QUICK_CREATE];
                    console.log('📋 Sales Returns: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'delivery_notes' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_DELIVERY_NOTE_QUICK_CREATE];
                    console.log('📋 Delivery Notes: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'delivery_notes' && Array.isArray(finalQuickCreate) && finalQuickCreate.length) {
                    const keys = finalQuickCreate.map((k) => String(k));
                    const hasSubject = keys.some((k) => k.toLowerCase() === 'subject');
                    if (!hasSubject) {
                        finalQuickCreate = ['subject', ...keys];
                    }
                }
                if (sys.key === 'receipt_notes' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_RECEIPT_NOTE_QUICK_CREATE];
                    console.log('📋 Receipt Notes: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'stockrooms' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_STOCKROOM_QUICK_CREATE];
                }
                if (sys.key === 'stock_adjustments' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE];
                }
                if (sys.key === 'stock_transfers' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_STOCK_TRANSFER_QUICK_CREATE];
                }
                if (sys.key === 'invoices' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_INVOICE_QUICK_CREATE];
                    console.log('📋 Invoices: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'payments' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_PAYMENT_QUICK_CREATE];
                    console.log('📋 Payments: Applying canonical default Quick Create:', finalQuickCreate);
                }
                if (sys.key === 'documents' && (!finalQuickCreate || finalQuickCreate.length === 0)) {
                    finalQuickCreate = [...INITIAL_DOCUMENT_QUICK_CREATE];
                    console.log('📋 Documents: Applying canonical default Quick Create:', finalQuickCreate);
                }

                // Organizations: trust persisted quickCreate when non-empty (see empty-array default above).
                // Previously we re-injected name/industry/website on every GET, which defeated Settings
                // (saved N fields, merged list showed N+M) and made Quick Create appear not to save.

                console.log('✅ Final quickCreate:', {
                    value: finalQuickCreate,
                    length: finalQuickCreate?.length || 0,
                    isArray: Array.isArray(finalQuickCreate)
                });

                if (sys.key === 'people') {
                    finalQuickCreate = migratePeopleQuickCreateKeys(finalQuickCreate);
                    finalQuickCreateLayout = migratePeopleQuickCreateLayoutKeys(finalQuickCreateLayout);
                }

                // Events Quick Create defaults:
                // If quickCreate is empty / underconfigured, the create drawer will not show optional-but-important audit controls
                // like allowSelfReview (even though it's dependency-gated to audit event types).
                // We treat very short quickCreate arrays as "not configured yet" and apply a sensible default.
                if (sys.key === 'events') {
                    // Normalize quickCreate keys so variants don't appear twice (e.g. linkedformid vs linked-form-id)
                    if (Array.isArray(finalQuickCreate)) {
                        const normalized = finalQuickCreate
                            .map(k => normalizeEventFieldKey(k))
                            .filter(Boolean);
                        // case-insensitive dedupe while preserving order
                        const seenQc = new Set();
                        finalQuickCreate = normalized.filter(k => {
                            const low = String(k).toLowerCase();
                            if (!low || seenQc.has(low)) return false;
                            seenQc.add(low);
                            return true;
                        });
                    }

                    // Normalize quickCreateLayout field keys
                    if (finalQuickCreateLayout && Array.isArray(finalQuickCreateLayout.rows)) {
                        const rows = finalQuickCreateLayout.rows.map(r => {
                            if (!r || !Array.isArray(r.cols)) return r;
                            return {
                                ...r,
                                cols: r.cols.map(c => ({
                                    ...c,
                                    fieldKey: normalizeEventFieldKey(c?.fieldKey)
                                }))
                            };
                        });
                        finalQuickCreateLayout = { ...(finalQuickCreateLayout || { version: 1 }), rows };
                    }

                    const eventsDefaultQuickCreate = [
                        'eventName',
                        'eventType',
                        'assignedTo',
                        'attendees',
                        'meetingMode',
                        'conferenceProvider',
                        'startDateTime',
                        'endDateTime',
                        'meetingLink',
                        'location',
                        'agendaNotes',
                        'geoRequired',
                        // Audit-related (dependency-gated)
                        'relatedToId',
                        'linkedFormId',
                        'auditorId',
                        'reviewerId',
                        'correctiveOwnerId',
                        'allowSelfReview',
                        // When GEO is enabled (dependency-gated by geoRequired = true)
                        'minVisitDuration',
                        // External audit only (dependency-gated)
                        'partnerVisibility'
                    ];

                    const qc = Array.isArray(finalQuickCreate) ? finalQuickCreate.filter(Boolean) : [];
                    const isUnderConfigured = qc.length < 5;
                    // Also upgrade known legacy defaults that predate meeting / audit quick-create fields.
                    // This keeps "default behavior" working (field shows up) without overriding truly customized configs.
                    const qcLower = qc.map(k => String(k).toLowerCase());
                    const hasCore =
                        qcLower.includes('eventname') &&
                        qcLower.includes('eventtype') &&
                        qcLower.includes('assignedto') &&
                        qcLower.includes('startdatetime') &&
                        qcLower.includes('enddatetime');
                    const looksLegacy =
                        hasCore &&
                        (qcLower.includes('status') || qcLower.includes('agendanotes')) &&
                        !qcLower.includes('linkedformid') &&
                        !qcLower.includes('relatedtoid') &&
                        !qcLower.includes('allowselfreview');
                    // Pre-meeting-create defaults: has core form but missing meeting scaffolding
                    const lacksMeetingScaffold =
                        hasCore &&
                        !qcLower.includes('meetingmode') &&
                        !qcLower.includes('attendees');
                    const lacksConferenceProvider =
                        hasCore &&
                        qcLower.includes('meetingmode') &&
                        !qcLower.includes('conferenceprovider');

                    if (isUnderConfigured || looksLegacy) {
                        finalQuickCreate = eventsDefaultQuickCreate;
                    } else if (lacksMeetingScaffold) {
                        // Upgrade-in-place: inject meeting fields without wiping a customized order.
                        // Place after assignedTo when present; otherwise append before geoRequired.
                        const inject = ['attendees', 'meetingMode', 'conferenceProvider', 'meetingLink', 'agendaNotes'];
                        const qc2 = Array.isArray(finalQuickCreate) ? [...finalQuickCreate] : [];
                        const has = (k) => qc2.some((x) => String(x).toLowerCase() === k);
                        const toAdd = inject.filter((k) => !has(k.toLowerCase()));
                        if (toAdd.length) {
                            const assignedIdx = qc2.findIndex((x) => String(x).toLowerCase() === 'assignedto');
                            const insertAt = assignedIdx >= 0 ? assignedIdx + 1 : Math.max(0, qc2.findIndex((x) => String(x).toLowerCase() === 'startdatetime'));
                            if (insertAt >= 0) {
                                qc2.splice(insertAt, 0, ...toAdd);
                            } else {
                                qc2.push(...toAdd);
                            }
                        }
                        finalQuickCreate = qc2;
                    } else if (lacksConferenceProvider) {
                        const qc2 = Array.isArray(finalQuickCreate) ? [...finalQuickCreate] : [];
                        const modeIdx = qc2.findIndex((x) => String(x).toLowerCase() === 'meetingmode');
                        if (modeIdx >= 0) {
                            qc2.splice(modeIdx + 1, 0, 'conferenceProvider');
                        } else {
                            qc2.push('conferenceProvider');
                        }
                        finalQuickCreate = qc2;
                    } else {
                        // If the org is using simple quickCreate mode (no advanced layout), we historically appended
                        // audit scaffolding keys so dependency-gated fields could render. Doing that after a tenant
                        // has saved explicit quickCreate breaks Settings ("saved N, loaded N+1").
                        const hasAdvancedLayout = !!(finalQuickCreateLayout && Array.isArray(finalQuickCreateLayout.rows) && finalQuickCreateLayout.rows.length > 0);
                        const eventsQuickCreateStoredOnTenant =
                            override &&
                            override.quickCreate !== undefined &&
                            override.quickCreate !== null &&
                            Array.isArray(override.quickCreate);
                        if (!hasAdvancedLayout && !eventsQuickCreateStoredOnTenant) {
                            const qc2 = Array.isArray(finalQuickCreate) ? [...finalQuickCreate] : [];
                            const hasGeo = qc2.some(k => String(k).toLowerCase() === 'georequired');
                            const hasAllow = qc2.some(k => String(k).toLowerCase() === 'allowselfreview');
                            const hasReviewer = qc2.some(k => String(k).toLowerCase() === 'reviewerid');
                            const hasCorrectiveOwner = qc2.some(k => String(k).toLowerCase() === 'correctiveownerid');
                            const hasMinVisit = qc2.some(k => String(k).toLowerCase() === 'minvisitduration');
                            const hasPartnerVis = qc2.some(k => String(k).toLowerCase() === 'partnervisibility');
                            const hasRelatedTo = qc2.some(k => String(k).toLowerCase() === 'relatedtoid');
                            const hasLinkedForm = qc2.some(k => String(k).toLowerCase() === 'linkedformid');
                            const hasMeetingMode = qc2.some(k => String(k).toLowerCase() === 'meetingmode');
                            const hasMeetingLink = qc2.some(k => String(k).toLowerCase() === 'meetinglink');
                            const hasConferenceProvider = qc2.some(k => String(k).toLowerCase() === 'conferenceprovider');
                            const hasAttendees = qc2.some(k => String(k).toLowerCase() === 'attendees');
                            const hasAgenda = qc2.some(k => String(k).toLowerCase() === 'agendanotes');
                            if (!hasGeo) qc2.push('geoRequired');
                            if (!hasAllow) qc2.push('allowSelfReview');
                            if (!hasReviewer) qc2.push('reviewerId');
                            if (!hasCorrectiveOwner) qc2.push('correctiveOwnerId');
                            // Single-org audits need Organization + Form (dependency-gated)
                            if (!hasRelatedTo) qc2.push('relatedToId');
                            if (!hasLinkedForm) qc2.push('linkedFormId');
                            if (!hasMinVisit) qc2.push('minVisitDuration');
                            if (!hasPartnerVis) qc2.push('partnerVisibility');
                            if (!hasMeetingMode) qc2.push('meetingMode');
                            if (!hasConferenceProvider) qc2.push('conferenceProvider');
                            if (!hasMeetingLink) qc2.push('meetingLink');
                            if (!hasAttendees) qc2.push('attendees');
                            if (!hasAgenda) qc2.push('agendaNotes');
                            finalQuickCreate = qc2;
                        }
                    }

                    // If org uses advanced quickCreateLayout mode, the create drawer renders ONLY the layout rows.
                    // Ensure audit-role fields are present in the layout so they can show when dependency-visible.
                    const hasAdvancedLayout = !!(finalQuickCreateLayout && Array.isArray(finalQuickCreateLayout.rows) && finalQuickCreateLayout.rows.length > 0);
                    if (hasAdvancedLayout) {
                        const rows = Array.isArray(finalQuickCreateLayout.rows) ? [...finalQuickCreateLayout.rows] : [];
                        const hasRelatedToInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'relatedtoid')
                        );
                        const hasLinkedFormInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'linkedformid')
                        );
                        const hasGeoInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'georequired')
                        );
                        const hasAllowInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'allowselfreview')
                        );
                        const hasReviewerInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'reviewerid')
                        );
                        const hasCorrectiveOwnerInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'correctiveownerid')
                        );
                        const hasMinVisitInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'minvisitduration')
                        );
                        const hasPartnerVisInLayout = rows.some(r =>
                            Array.isArray(r?.cols) && r.cols.some(c => String(c?.fieldKey || '').toLowerCase() === 'partnervisibility')
                        );
                        if (!hasRelatedToInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'relatedToId',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasLinkedFormInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'linkedFormId',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasGeoInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'geoRequired',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasAllowInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'allowSelfReview',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasReviewerInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'reviewerId',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasCorrectiveOwnerInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'correctiveOwnerId',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasMinVisitInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'minVisitDuration',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        if (!hasPartnerVisInLayout) {
                            rows.push({
                                cols: [{
                                    span: 12,
                                    fieldKey: 'partnerVisibility',
                                    widget: 'input',
                                    props: {}
                                }]
                            });
                        }
                        finalQuickCreateLayout = { ...(finalQuickCreateLayout || { version: 1 }), rows };
                    }
                }
                
                let finalFields = saved;
                if (sys.key === 'tasks') {
                    finalFields = normalizeTasksModuleFields(finalFields);
                    finalFields = dedupeFieldsByKey(finalFields);
                } else if (sys.key === 'people') {
                    finalFields = normalizePeopleModuleFields(finalFields);
                }
                if (sys.key === 'deals') {
                    finalFields = enrichDealFieldsWithPipelineSettings(finalFields, pipelineSettings);
                }
                if (sys.key === 'people') {
                    const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
                    const peopleCfg = await getPeopleTypesConfig(req.user.organizationId, 'SALES');
                    finalFields = enrichPeopleFieldsWithPeopleTypes(finalFields, peopleCfg.typeDefs);
                }
                if (sys.key === 'organizations') {
                    finalFields = await enrichOrganizationsModuleFields(finalFields, req.user.organizationId);
                }
                if (sys.key === 'events') {
                    finalFields = (Array.isArray(finalFields) ? finalFields : []).map(normalizeEventFieldConfig);
                    finalFields = await enrichEventsModuleFields(finalFields, req.user.organizationId);
                }
                if (sys.key === 'cases') {
                    finalFields = enrichCasesModuleFields(finalFields);
                }
                if (sys.key === 'purchase_orders' && Array.isArray(finalFields)) {
                    const { PO_STATUS_LABELS } = require('../constants/procurementLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'deliverymethod') {
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: [
                                    { value: 'supplier_delivery', label: 'Supplier Delivery' },
                                    { value: 'courier', label: 'Courier' },
                                    { value: 'transport', label: 'Transport' },
                                    { value: 'pickup', label: 'Pickup' }
                                ]
                            };
                        }
                        if (key === 'overalldiscounttype') {
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: [
                                    { value: 'percent', label: 'Percentage' },
                                    { value: 'amount', label: 'Flat amount' }
                                ]
                            };
                        }
                        return field;
                    });
                    finalFields = applyPurchaseOrderModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'purchase_returns' && Array.isArray(finalFields)) {
                    const {
                        PR_STATUS_LABELS
                    } = require('../constants/procurementLifecycle');
                    const { PR_RETURN_TYPES } = require('../models/PurchaseReturn');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(PR_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const typeLabels = {
                                goods_return: 'Goods Return',
                                replacement: 'Replacement',
                                warranty_return: 'Warranty Return',
                                quality_rejection: 'Quality Rejection',
                                supplier_recall: 'Supplier Recall'
                            };
                            const opts = PR_RETURN_TYPES.map((value) => ({
                                value,
                                label: typeLabels[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        return field;
                    });
                    finalFields = applyPurchaseReturnModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'delivery_returns' && Array.isArray(finalFields)) {
                    const {
                        DR_STATUS_LABELS,
                        DR_RETURN_TYPE_LABELS,
                        DR_SOURCE_TYPES
                    } = require('../constants/deliveryReturnLifecycle');
                    const { DR_RETURN_TYPES } = require('../models/DeliveryReturn');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(DR_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const opts = DR_RETURN_TYPES.map((value) => ({
                                value,
                                label: DR_RETURN_TYPE_LABELS[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'sourcetype') {
                            const opts = [
                                { value: DR_SOURCE_TYPES.DELIVERY_NOTE, label: 'Delivery Note' },
                                { value: DR_SOURCE_TYPES.INVOICE, label: 'Invoice' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorypoststatus') {
                            const opts = [
                                { value: 'received', label: 'Received' },
                                { value: 'inspected', label: 'Inspected' },
                                { value: 'restocked', label: 'Restocked' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'contactpersonid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'people',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'ownerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'users',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'deliverynoteid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'delivery_notes',
                                    displayField: 'deliveryNoteNumber'
                                }
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'salesorderid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'sales_orders',
                                    displayField: 'salesOrderNumber'
                                }
                            };
                        }
                        if (key === 'returnwarehouseid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applyDeliveryReturnModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'sales_returns' && Array.isArray(finalFields)) {
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = [
                                { value: 'draft', label: 'Draft' },
                                { value: 'pending_approval', label: 'Pending Approval' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'inventory_updated', label: 'Inventory Updated' },
                                { value: 'closed', label: 'Closed' },
                                { value: 'cancelled', label: 'Cancelled' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const opts = [
                                { value: 'refund', label: 'Refund' },
                                { value: 'replacement', label: 'Replacement' },
                                { value: 'credit', label: 'Credit' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'overallreturnreason') {
                            const opts = [
                                { value: 'Customer return', label: 'Customer return' },
                                { value: 'Damaged', label: 'Damaged' },
                                { value: 'Wrong item', label: 'Wrong item' },
                                { value: 'Warranty', label: 'Warranty' },
                                { value: 'Other', label: 'Other' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'returnlocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applySalesReturnModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'delivery_notes' && Array.isArray(finalFields)) {
                    const {
                        DN_STATUS_LABELS,
                        DN_SOURCE_TYPES,
                        DN_SOURCE_TYPE_LABELS,
                        DN_DELIVERY_METHOD_LABELS,
                        DN_INVENTORY_POST_STATUSES
                    } = require('../constants/deliveryNoteLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(DN_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'sourcetype') {
                            const opts = [
                                { value: DN_SOURCE_TYPES.DIRECT, label: DN_SOURCE_TYPE_LABELS.direct },
                                { value: DN_SOURCE_TYPES.SALES_ORDER, label: DN_SOURCE_TYPE_LABELS.sales_order }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'deliverymethod') {
                            const opts = Object.entries(DN_DELIVERY_METHOD_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorypoststatus') {
                            const opts = DN_INVENTORY_POST_STATUSES.map((value) => ({
                                value,
                                label: DN_STATUS_LABELS[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'contactpersonid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'people',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'ownerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'users',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'salesorderid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'sales_orders',
                                    displayField: 'salesOrderNumber'
                                }
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'warehouseid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applyDeliveryNoteModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'receipt_notes' && Array.isArray(finalFields)) {
                    const { RN_STATUSES } = require('../constants/procurementLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = Object.values(RN_STATUSES).map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'purchaseorderid' || key === 'receiptlocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule:
                                        key === 'purchaseorderid' ? 'purchase_orders' : 'inventory_locations',
                                    displayField: key === 'purchaseorderid' ? 'poNumber' : 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applyReceiptNoteModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'stockrooms' && Array.isArray(finalFields)) {
                    const {
                        INVENTORY_LOCATION_TYPES,
                        INVENTORY_LOCATION_STATUSES
                    } = require('../constants/inventoryLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'locationtype') {
                            const opts = INVENTORY_LOCATION_TYPES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'status') {
                            const opts = INVENTORY_LOCATION_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        return field;
                    });
                    finalFields = applyStockroomModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'stock_adjustments' && Array.isArray(finalFields)) {
                    const {
                        INVENTORY_ADJUSTMENT_REASONS,
                        INVENTORY_ADJUSTMENT_STATUSES
                    } = require('../constants/inventoryLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'reasoncode') {
                            const opts = INVENTORY_ADJUSTMENT_REASONS.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'status') {
                            const opts = INVENTORY_ADJUSTMENT_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorylocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applyStockAdjustmentModuleFieldDefaults(finalFields);
                }
                if (sys.key === 'stock_transfers' && Array.isArray(finalFields)) {
                    const { INVENTORY_TRANSFER_STATUSES } = require('../constants/inventoryLifecycle');
                    finalFields = finalFields.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = INVENTORY_TRANSFER_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'fromlocationid' || key === 'tolocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    finalFields = applyStockTransferModuleFieldDefaults(finalFields);
                }
                // Inventory: never serve empty field catalogs (Settings + create drawers)
                if (
                    isInventorySchemaModuleKey(sys.key) &&
                    (!Array.isArray(finalFields) || finalFields.length === 0)
                ) {
                    try {
                        const {
                            getInventoryModuleFieldCatalog
                        } = require('../services/inventoryModuleFieldCatalogService');
                        finalFields = getInventoryModuleFieldCatalog(sys.key) || [];
                    } catch (catErr) {
                        console.warn(
                            `[listModules] inventory field recover failed for ${sys.key}:`,
                            catErr?.message || catErr
                        );
                        let recovered = getBaseFieldsForKey(sys.key) || [];
                        if (sys.key === 'inventory' && !recovered.length) {
                            recovered = applyInventoryModuleFieldDefaults(INITIAL_INVENTORY_FIELDS).map((f, i) => ({
                                ...f,
                                order: i,
                                dataType: f.dataType || f.type || 'text'
                            }));
                        }
                        finalFields = Array.isArray(recovered) ? recovered : [];
                    }
                }
                finalFields = applyOwnerFieldRequiredToModuleFields(finalFields, sys.key);
                let resolvedRelationships = shouldUseOverrideRelationships(override, sys)
                    ? override.relationships
                    : (sys.relationships || []);
                if (sys.key === 'quotes' && (!Array.isArray(resolvedRelationships) || resolvedRelationships.length === 0)) {
                    resolvedRelationships = cloneQuoteDefaultRelationships();
                }
                if (sys.key === 'documents' && (!Array.isArray(resolvedRelationships) || resolvedRelationships.length === 0)) {
                    resolvedRelationships = cloneDocumentDefaultRelationships();
                }
                merged.push({ 
                    ...sys, 
                    fields: finalFields,
                    quickCreate: finalQuickCreate,
                    quickCreateLayout: finalQuickCreateLayout,
                    fieldLayout: override.fieldLayout || sys.fieldLayout || null,
                    relationships: resolvedRelationships,
                    // Phase 17: Preserve notification metadata (use override if exists, else default)
                    notifications: override.notifications || sys.notifications || getDefaultNotificationMetadata(sys.key),
                    name: override.name || override.label || sys.name,
                    enabled: override.enabled !== undefined ? override.enabled : sys.enabled,
                    pipelineSettings,
                    ...(isInventorySchemaModuleKey(sys.key)
                        ? {
                            appKey: override.appKey || 'inventory',
                            label: override.label || override.name || sys.name,
                            pluralLabel: override.pluralLabel || override.label || sys.name
                        }
                        : {})
                });
                customByKey.delete(sys.key);
            } else {
                // No overrides; ensure base fields have stable order by index
                const baseCaseFields = sys.key === 'cases' ? enrichCasesModuleFields(sys.fields) : sys.fields;
                const withOrder = baseCaseFields.map((f, i) => ({ ...f, order: i }));

                // Provide sensible defaults for system modules that rely on quick create UI.
                // For Events, include allowSelfReview so it shows up in the create drawer when dependency-visible.
                let defaultQuickCreate = [];
                if (sys.key === 'events') {
                    defaultQuickCreate = [
                        'eventName',
                        'eventType',
                        'assignedTo',
                        'attendees',
                        'meetingMode',
                        'conferenceProvider',
                        'startDateTime',
                        'endDateTime',
                        'meetingLink',
                        'location',
                        'agendaNotes',
                        'geoRequired',
                        'relatedToId',
                        'linkedFormId',
                        'reviewerId',
                        'correctiveOwnerId',
                        'allowSelfReview',
                        'minVisitDuration',
                        'partnerVisibility'
                    ];
                }
                
                // PLATFORM-LEVEL CANONICAL DEFAULT: Organizations Quick Create
                // Changes require updating: module-settings-doctrine.md, organization-settings.md
                if (sys.key === 'organizations') {
                    defaultQuickCreate = [...INITIAL_ORGANIZATION_QUICK_CREATE];
                }
                // ARCHITECTURE NOTE: Tasks Settings configure structure only, never work.
                // Tasks Quick Create default: title*, dueDate, taskType, status, priority, relatedTo, description, assignedTo*
                // See: docs/architecture/task-settings.md Section 3.5
                if (sys.key === 'tasks') {
                    defaultQuickCreate = ['title', 'dueDate', 'taskType', 'status', 'priority', 'relatedTo', 'description', 'assignedTo'];
                }
                
                // ARCHITECTURE NOTE: Items Quick Create default
                // See: client/src/platform/fields/itemFieldModel.ts getItemQuickCreateFields()
                if (sys.key === 'items') {
                    defaultQuickCreate = ['item_name', 'item_type', 'categoryId', 'selling_price', 'unit_of_measure', 'lifecycle_state', 'assignedTo'];
                }
                // ARCHITECTURE NOTE: Deals Quick Create default
                // See: client/src/platform/fields/dealFieldModel.ts DEAL_QUICK_CREATE_DEFAULT
                if (sys.key === 'deals') {
                    defaultQuickCreate = [...INITIAL_DEALS_QUICK_CREATE];
                }
                if (sys.key === 'people') {
                    defaultQuickCreate = [...INITIAL_PEOPLE_QUICK_CREATE];
                }
                if (sys.key === 'cases') {
                    defaultQuickCreate = [...INITIAL_CASES_QUICK_CREATE];
                }
                if (sys.key === 'quotes') {
                    defaultQuickCreate = [...INITIAL_QUOTE_QUICK_CREATE];
                }
                if (sys.key === 'sales_orders') {
                    defaultQuickCreate = [...INITIAL_SALES_ORDER_QUICK_CREATE];
                }
                if (sys.key === 'purchase_orders') {
                    defaultQuickCreate = [...INITIAL_PURCHASE_ORDER_QUICK_CREATE];
                }
                if (sys.key === 'purchase_returns') {
                    defaultQuickCreate = [...INITIAL_PURCHASE_RETURN_QUICK_CREATE];
                }
                if (sys.key === 'delivery_returns') {
                    defaultQuickCreate = [...INITIAL_DELIVERY_RETURN_QUICK_CREATE];
                }
                if (sys.key === 'sales_returns') {
                    defaultQuickCreate = [...INITIAL_SALES_RETURN_QUICK_CREATE];
                }
                if (sys.key === 'delivery_notes') {
                    defaultQuickCreate = [...INITIAL_DELIVERY_NOTE_QUICK_CREATE];
                }
                if (sys.key === 'receipt_notes') {
                    defaultQuickCreate = [...INITIAL_RECEIPT_NOTE_QUICK_CREATE];
                }
                if (sys.key === 'stockrooms') {
                    defaultQuickCreate = [...INITIAL_STOCKROOM_QUICK_CREATE];
                }
                if (sys.key === 'stock_adjustments') {
                    defaultQuickCreate = [...INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE];
                }
                if (sys.key === 'stock_transfers') {
                    defaultQuickCreate = [...INITIAL_STOCK_TRANSFER_QUICK_CREATE];
                }
                if (sys.key === 'invoices') {
                    defaultQuickCreate = [...INITIAL_INVOICE_QUICK_CREATE];
                }
                if (sys.key === 'payments') {
                    defaultQuickCreate = [...INITIAL_PAYMENT_QUICK_CREATE];
                }
                if (sys.key === 'documents') {
                    defaultQuickCreate = [...INITIAL_DOCUMENT_QUICK_CREATE];
                }
                if (sys.key === 'inventory') {
                    defaultQuickCreate = [...INITIAL_INVENTORY_QUICK_CREATE];
                }
                let taskFields = withOrder;
                if (sys.key === 'tasks') {
                    taskFields = normalizeTasksModuleFields(taskFields);
                    taskFields = dedupeFieldsByKey(taskFields);
                } else if (sys.key === 'people') {
                    taskFields = normalizePeopleModuleFields(taskFields);
                } else if (sys.key === 'inventory' && (!Array.isArray(taskFields) || taskFields.length === 0)) {
                    taskFields = applyInventoryModuleFieldDefaults(INITIAL_INVENTORY_FIELDS).map((f, i) => ({
                        ...f,
                        order: i,
                        dataType: f.dataType || f.type || 'text'
                    }));
                }
                let dealPipelineSettings = [];
                if (sys.key === 'deals') {
                    const raw = JSON.parse(JSON.stringify(sys.pipelineSettings || []));
                    const toNormalize = (raw.length === 0 || isLegacyDefaultPipelineSettings(raw))
                        ? getDefaultPipelineSettings()
                        : raw;
                    dealPipelineSettings = normalizePipelineSettings(toNormalize);
                }
                let fieldsToPush = sys.key === 'deals'
                    ? enrichDealFieldsWithPipelineSettings(taskFields, dealPipelineSettings)
                    : taskFields;
                if (sys.key === 'people') {
                    const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
                    const peopleCfg = await getPeopleTypesConfig(req.user.organizationId, 'SALES');
                    fieldsToPush = enrichPeopleFieldsWithPeopleTypes(fieldsToPush, peopleCfg.typeDefs);
                }
                if (sys.key === 'organizations') {
                    fieldsToPush = await enrichOrganizationsModuleFields(fieldsToPush, req.user.organizationId);
                }
                if (sys.key === 'events') {
                    fieldsToPush = (Array.isArray(fieldsToPush) ? fieldsToPush : []).map(normalizeEventFieldConfig);
                    fieldsToPush = await enrichEventsModuleFields(fieldsToPush, req.user.organizationId);
                }
                if (sys.key === 'purchase_orders' && Array.isArray(fieldsToPush)) {
                    const { PO_STATUS_LABELS } = require('../constants/procurementLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'deliverymethod') {
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: [
                                    { value: 'supplier_delivery', label: 'Supplier Delivery' },
                                    { value: 'courier', label: 'Courier' },
                                    { value: 'transport', label: 'Transport' },
                                    { value: 'pickup', label: 'Pickup' }
                                ]
                            };
                        }
                        if (key === 'overalldiscounttype') {
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: [
                                    { value: 'percent', label: 'Percentage' },
                                    { value: 'amount', label: 'Flat amount' }
                                ]
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyPurchaseOrderModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'purchase_returns' && Array.isArray(fieldsToPush)) {
                    const { PR_STATUS_LABELS } = require('../constants/procurementLifecycle');
                    const { PR_RETURN_TYPES } = require('../models/PurchaseReturn');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(PR_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const typeLabels = {
                                goods_return: 'Goods Return',
                                replacement: 'Replacement',
                                warranty_return: 'Warranty Return',
                                quality_rejection: 'Quality Rejection',
                                supplier_recall: 'Supplier Recall'
                            };
                            const opts = PR_RETURN_TYPES.map((value) => ({
                                value,
                                label: typeLabels[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyPurchaseReturnModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'delivery_returns' && Array.isArray(fieldsToPush)) {
                    const {
                        DR_STATUS_LABELS,
                        DR_RETURN_TYPE_LABELS,
                        DR_SOURCE_TYPES
                    } = require('../constants/deliveryReturnLifecycle');
                    const { DR_RETURN_TYPES } = require('../models/DeliveryReturn');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(DR_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const opts = DR_RETURN_TYPES.map((value) => ({
                                value,
                                label: DR_RETURN_TYPE_LABELS[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'sourcetype') {
                            const opts = [
                                { value: DR_SOURCE_TYPES.DELIVERY_NOTE, label: 'Delivery Note' },
                                { value: DR_SOURCE_TYPES.INVOICE, label: 'Invoice' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorypoststatus') {
                            const opts = [
                                { value: 'received', label: 'Received' },
                                { value: 'inspected', label: 'Inspected' },
                                { value: 'restocked', label: 'Restocked' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'contactpersonid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'people',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'ownerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'users',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'deliverynoteid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'delivery_notes',
                                    displayField: 'deliveryNoteNumber'
                                }
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'salesorderid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'sales_orders',
                                    displayField: 'salesOrderNumber'
                                }
                            };
                        }
                        if (key === 'returnwarehouseid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyDeliveryReturnModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'sales_returns' && Array.isArray(fieldsToPush)) {
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = [
                                { value: 'draft', label: 'Draft' },
                                { value: 'pending_approval', label: 'Pending Approval' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'inventory_updated', label: 'Inventory Updated' },
                                { value: 'closed', label: 'Closed' },
                                { value: 'cancelled', label: 'Cancelled' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'returntype') {
                            const opts = [
                                { value: 'refund', label: 'Refund' },
                                { value: 'replacement', label: 'Replacement' },
                                { value: 'credit', label: 'Credit' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'overallreturnreason') {
                            const opts = [
                                { value: 'Customer return', label: 'Customer return' },
                                { value: 'Damaged', label: 'Damaged' },
                                { value: 'Wrong item', label: 'Wrong item' },
                                { value: 'Warranty', label: 'Warranty' },
                                { value: 'Other', label: 'Other' }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'returnlocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applySalesReturnModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'delivery_notes' && Array.isArray(fieldsToPush)) {
                    const {
                        DN_STATUS_LABELS,
                        DN_SOURCE_TYPES,
                        DN_SOURCE_TYPE_LABELS,
                        DN_DELIVERY_METHOD_LABELS,
                        DN_INVENTORY_POST_STATUSES
                    } = require('../constants/deliveryNoteLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'currency' && field.dataType !== 'Picklist') {
                            return { ...field, dataType: 'Picklist' };
                        }
                        if (key === 'status') {
                            const opts = Object.entries(DN_STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'sourcetype') {
                            const opts = [
                                { value: DN_SOURCE_TYPES.DIRECT, label: DN_SOURCE_TYPE_LABELS.direct },
                                { value: DN_SOURCE_TYPES.SALES_ORDER, label: DN_SOURCE_TYPE_LABELS.sales_order }
                            ];
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'deliverymethod') {
                            const opts = Object.entries(DN_DELIVERY_METHOD_LABELS).map(([value, label]) => ({
                                value,
                                label
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorypoststatus') {
                            const opts = DN_INVENTORY_POST_STATUSES.map((value) => ({
                                value,
                                label: DN_STATUS_LABELS[value] || value
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'customerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'organizations',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'contactpersonid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'people',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'ownerid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'users',
                                    displayField: 'name'
                                }
                            };
                        }
                        if (key === 'salesorderid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'sales_orders',
                                    displayField: 'salesOrderNumber'
                                }
                            };
                        }
                        if (key === 'invoiceid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'invoices',
                                    displayField: 'invoiceNumber'
                                }
                            };
                        }
                        if (key === 'warehouseid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyDeliveryNoteModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'receipt_notes' && Array.isArray(fieldsToPush)) {
                    const { RN_STATUSES } = require('../constants/procurementLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = Object.values(RN_STATUSES).map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'purchaseorderid' || key === 'receiptlocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule:
                                        key === 'purchaseorderid' ? 'purchase_orders' : 'inventory_locations',
                                    displayField: key === 'purchaseorderid' ? 'poNumber' : 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyReceiptNoteModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'stockrooms' && Array.isArray(fieldsToPush)) {
                    const {
                        INVENTORY_LOCATION_TYPES,
                        INVENTORY_LOCATION_STATUSES
                    } = require('../constants/inventoryLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'locationtype') {
                            const opts = INVENTORY_LOCATION_TYPES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'status') {
                            const opts = INVENTORY_LOCATION_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyStockroomModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'stock_adjustments' && Array.isArray(fieldsToPush)) {
                    const {
                        INVENTORY_ADJUSTMENT_REASONS,
                        INVENTORY_ADJUSTMENT_STATUSES
                    } = require('../constants/inventoryLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'reasoncode') {
                            const opts = INVENTORY_ADJUSTMENT_REASONS.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'status') {
                            const opts = INVENTORY_ADJUSTMENT_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'inventorylocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyStockAdjustmentModuleFieldDefaults(fieldsToPush);
                }
                if (sys.key === 'stock_transfers' && Array.isArray(fieldsToPush)) {
                    const { INVENTORY_TRANSFER_STATUSES } = require('../constants/inventoryLifecycle');
                    fieldsToPush = fieldsToPush.map((field) => {
                        const key = String(field?.key || '').toLowerCase();
                        if (key === 'status') {
                            const opts = INVENTORY_TRANSFER_STATUSES.map((value) => ({
                                value,
                                label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            }));
                            return {
                                ...field,
                                dataType: 'Picklist',
                                options: opts,
                                enum: opts.map((o) => o.value)
                            };
                        }
                        if (key === 'fromlocationid' || key === 'tolocationid') {
                            return {
                                ...field,
                                dataType: 'Lookup (Relationship)',
                                lookupSettings: {
                                    targetModule: 'inventory_locations',
                                    displayField: 'name'
                                }
                            };
                        }
                        return field;
                    });
                    fieldsToPush = applyStockTransferModuleFieldDefaults(fieldsToPush);
                }
                fieldsToPush = applyOwnerFieldRequiredToModuleFields(fieldsToPush, sys.key);
                const defaultRelationships = sys.key === 'quotes'
                    ? cloneQuoteDefaultRelationships()
                    : sys.key === 'documents'
                        ? cloneDocumentDefaultRelationships()
                        : (sys.relationships || []);
                merged.push({ 
                    ...sys, 
                    fields: fieldsToPush,
                    quickCreate: defaultQuickCreate,
                    quickCreateLayout: { version: 1, rows: [] },
                    relationships: defaultRelationships,
                    // Phase 17: Include default notification metadata
                    notifications: sys.notifications || getDefaultNotificationMetadata(sys.key),
                    pipelineSettings: sys.key === 'deals'
                        ? dealPipelineSettings
                        : JSON.parse(JSON.stringify(sys.pipelineSettings || [])),
                    ...(isInventorySchemaModuleKey(sys.key)
                        ? { appKey: 'inventory', label: sys.name, pluralLabel: sys.name }
                        : {})
                });
            }
        }
        // Remaining custom modules (tenant-defined modules not merged above)
        for (const m of customByKey.values()) {
            const moduleKey = String(m.key || m.moduleKey || '').toLowerCase();
            const fields = Array.isArray(m.fields) ? [...m.fields] : [];
            fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            merged.push({ 
                ...m,
                key: moduleKey || m.key,
                name: m.name || m.label || moduleKey,
                fields,
                quickCreate: m.quickCreate || [],
                quickCreateLayout: m.quickCreateLayout || { version: 1, rows: [] },
                relationships: m.relationships || [],
                // Phase 17: Include notification metadata (use saved or default)
                notifications: m.notifications || getDefaultNotificationMetadata(moduleKey || m.key),
                pipelineSettings: Array.isArray(m.pipelineSettings) ? m.pipelineSettings : []
            });
        }

        // Attach field counts for system modules from actual schemas
        try {
            const People = require('../models/People');
            const Organization = require('../models/Organization');
            const Deal = require('../models/Deal');
            const Task = require('../models/Task');
            const Event = require('../models/Event');
            const Form = require('../models/Form');
            const ImportHistory = require('../models/ImportHistory');
            const modelByKey = {
                people: People,
                organizations: Organization,
                deals: Deal,
                quotes: require('../models/Quote'),
                sales_orders: require('../models/SalesOrder'),
                invoices: require('../models/Invoice'),
                payments: require('../models/Payment'),
                cases: require('../models/Case'),
                tasks: Task,
                events: Event,
                forms: Form,
                imports: ImportHistory,
                documents: require('../models/Document'),
                reports: null, // no direct model
                users: null // Users module is for lookup targets only, no fields needed
            };
            const uniqueCount = (fields) => {
                if (!Array.isArray(fields)) return 0;
                const seen = new Set();
                for (const f of fields) {
                    const k = String(f?.key || '').toLowerCase();
                    if (!k) continue;
                    // ignore fields without a valid dataType (incomplete entries)
                    if (!f?.dataType) continue;
                    // ignore explicitly hidden technical fields if any slipped through
                    if (k === '_id' || k === '__v' || k === 'createdat' || k === 'updatedat') continue;
                    if (!seen.has(k)) seen.add(k);
                }
                return seen.size;
            };
            for (const m of merged) {
                m.fieldCount = uniqueCount(m.fields);
            }
        } catch (e) {
            // If any model missing, skip counts gracefully
            for (const m of merged) {
                if (typeof m.fieldCount !== 'number') {
                    m.fieldCount = Array.isArray(m.fields) ? m.fields.length : 0;
                }
            }
        }

        // Sort: system first, then custom; within each, by name
        merged.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'system' ? -1 : 1;
            const nameA = String(a.name || a.label || a.key || '');
            const nameB = String(b.name || b.label || b.key || '');
            return nameA.localeCompare(nameB);
        });

        // Apply context filtering to all modules' fields
        // context=all skips filtering so Settings can configure both global and app-specific custom fields
        const skipContextFilter = currentContext === 'all';
        let filteredMerged = merged.map(module => ({
            ...module,
            fields: skipContextFilter ? (module.fields || []) : filterFieldsByContext(module.fields || [], currentContext)
        }));

        // Apply READ access filtering based on user permissions
        // Only show fields the user has permission to read
        filteredMerged = filteredMerged.map(module => ({
            ...module,
            fields: filterFieldsByReadAccess(module.fields || [], req.user, module.key)
        }));

        filteredMerged = filteredMerged.map(module => ({
            ...module,
            fields: ensurePhoneFieldDefaultValidations(module.fields || [])
        }));

        const forMergeTags = String(req.query.purpose || '').toLowerCase() === 'merge-tags';
        if (forMergeTags) {
            filteredMerged = filteredMerged.map((module) => ({
                ...module,
                fields: mergeFieldsForMergeTags(module.fields || [], module.key)
            }));
        }

        // Filter by key if provided in query parameter (supports single key or comma-separated list)
        if (req.query.key || req.query.keys) {
            const keyParam = req.query.key || req.query.keys;
            const requestedKeys = new Set(
                keyParam
                    .split(',')
                    .map(k => k.toLowerCase().trim())
                    .filter(k => k)
            );
            
            const filtered = filteredMerged.filter(module => 
                module.key && requestedKeys.has(module.key.toLowerCase())
            );
            // Tenant module definitions (fields, quickCreate, layouts) change in Settings — never allow
            // long-lived browser/CDN caching of GET /modules or reloads keep stale quickCreate for 24h.
            res.set('Cache-Control', 'private, no-store');
            return res.json({ success: true, data: filtered });
        }

        res.set('Cache-Control', 'private, no-store');
        res.json({ success: true, data: filteredMerged });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error listing modules', error: error.message });
    }
};

exports.createModule = async (req, res) => {
    try {
        const { key, name, fields } = req.body;
        if (!key || !name) {
            return res.status(400).json({ success: false, message: 'key and name are required' });
        }
        const keyStr = String(key).toLowerCase().trim();
        const nameStr = String(name).trim();
        const label = nameStr || keyStr.charAt(0).toUpperCase() + keyStr.slice(1);
        const pluralLabel = label + (label.endsWith('s') ? '' : 's');
        const fieldsArr = Array.isArray(fields) ? [...fields] : [];
        const hasRecordNumber = fieldsArr.some(
            (f) => String(f?.key || f?.name || '').toLowerCase() === 'recordnumber'
        );
        if (!hasRecordNumber) {
            fieldsArr.unshift({
                key: 'recordNumber',
                label: 'Record Number',
                type: 'Auto-Number',
                system: true,
                readonly: true,
            });
        }

        const doc = await ModuleDefinition.create({
            organizationId: req.user.organizationId,
            key: keyStr,
            name: nameStr,
            type: 'custom',
            fields: fieldsArr,
            // Required schema fields (tenant docs still need these for Mongoose validation)
            moduleKey: keyStr,
            appKey: 'platform',
            label,
            pluralLabel,
            entityType: 'TRANSACTION'
        });

        try {
            const moduleNumberingService = require('../services/moduleNumberingService');
            await moduleNumberingService.seedDefaultForModule(
                req.user.organizationId,
                keyStr,
                { label, updatedBy: req.user._id }
            );
        } catch (seedErr) {
            console.error('[createModule] module numbering seed failed:', seedErr?.message || seedErr);
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            {},
            cloneForAudit({
                key: doc.key,
                name: doc.name,
                fieldsCount: Array.isArray(doc.fields) ? doc.fields.length : 0
            }),
            { keys: ['key', 'name', 'fieldsCount'] }
        );
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Module key already exists' });
        }
        res.status(500).json({ success: false, message: 'Error creating module', error: error.message });
    }
};

exports.deleteModule = async (req, res) => {
    try {
        const { id } = req.params;
        const mod = await ModuleDefinition.findOne({ 
            _id: id, 
            organizationId: req.user.organizationId,
            key: { $ne: 'groups' } // Exclude groups
        });
        if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });
        if (mod.type === 'system') return res.status(403).json({ success: false, message: 'Cannot delete system module' });
        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({
            key: mod.key,
            name: mod.name,
            fieldsCount: Array.isArray(mod.fields) ? mod.fields.length : 0
        });
        await mod.deleteOne();
        attachSettingsAuditDiff(res, before, {}, { keys: ['key', 'name', 'fieldsCount'] });
        res.json({ success: true, message: 'Module deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting module', error: error.message });
    }
};

exports.updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const mod = await ModuleDefinition.findOne({ 
            _id: id, 
            organizationId: req.user.organizationId,
            key: { $ne: 'groups' } // Exclude groups
        });
        if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

        const { attachSettingsAuditDiff, buildModuleSettingsAuditPair, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const beforeDoc = cloneForAudit({
            key: mod.key,
            name: mod.name,
            enabled: mod.enabled,
            fields: mod.fields,
            fieldLayout: mod.fieldLayout,
            relationships: mod.relationships,
            quickCreate: mod.quickCreate,
            quickCreateLayout: mod.quickCreateLayout,
            pipelineSettings: mod.pipelineSettings
        });

        const { name, enabled, fields, relationships, quickCreate, quickCreateLayout, pipelineSettings, fieldLayout } = req.body;
        const deprecatedEventAliasKeys = new Set(['relatedorg', 'relatedorgid', 'relatedorganization']);
        
        console.log('🔵 updateModule called:', {
            moduleId: id,
            moduleKey: mod.key,
            bodyKeys: Object.keys(req.body),
            quickCreateProvided: quickCreate !== undefined,
            quickCreateValue: quickCreate,
            quickCreateType: typeof quickCreate,
            quickCreateIsArray: Array.isArray(quickCreate),
            quickCreateLayoutProvided: quickCreateLayout !== undefined,
            quickCreateLayoutValue: quickCreateLayout
        });
        
        // When user "removes" platform/app fields from config, re-add them as hidden so save succeeds (no 403)
        let fieldsToSave = fields;
        if (Array.isArray(fields)) {
            const oldFields = Array.isArray(mod.fields) ? mod.fields : [];
            fieldsToSave = mergeRemovedPlatformOrAppFieldsAsHidden(oldFields, fields);
        }
        // Validate field mutations based on ownership
        if (Array.isArray(fieldsToSave)) {
            const oldFields = Array.isArray(mod.fields) ? mod.fields : [];
            const validation = validateFieldMutations(oldFields, fieldsToSave, req.user);
            
            if (!validation.valid) {
                return res.status(403).json({
                    success: false,
                    message: validation.error,
                    code: 'FIELD_MUTATION_NOT_ALLOWED',
                    violations: validation.violations
                });
            }
        }
        
        if (name !== undefined) mod.name = String(name).trim();
        if (enabled !== undefined) mod.enabled = !!enabled;
        if (Array.isArray(fieldsToSave)) {
            // Events: strip deprecated/alias fields from saved config
            let sanitizedFields = (mod.key === 'events')
                ? fieldsToSave.filter(f => !deprecatedEventAliasKeys.has(String(f?.key || '').toLowerCase()))
                : fieldsToSave;
            if (mod.key === 'events') {
                sanitizedFields = sanitizedFields.map(normalizeEventFieldConfig);
            }
            // Tasks: expose only single "relatedTo" field; strip relatedToType/relatedToId from persisted config
            if (mod.key === 'tasks') sanitizedFields = normalizeTasksModuleFields(sanitizedFields);
            const { applyFieldLayoutOnSave, validateFieldLayoutPayload } = require('../utils/fieldLayout');
            const layoutValidation = validateFieldLayoutPayload(
                mod.key,
                fieldLayout !== undefined ? fieldLayout : mod.fieldLayout
            );
            if (!layoutValidation.ok) {
                return res.status(400).json({ success: false, message: layoutValidation.error, code: 'INVALID_FIELD_LAYOUT' });
            }
            const layoutApplied = applyFieldLayoutOnSave(mod.key, sanitizedFields, layoutValidation.fieldLayout);
            mod.fields = layoutApplied.fields;
            mod.fieldLayout = layoutApplied.fieldLayout;
        } else if (fieldLayout !== undefined) {
            const { applyFieldLayoutOnSave, validateFieldLayoutPayload } = require('../utils/fieldLayout');
            const layoutValidation = validateFieldLayoutPayload(mod.key, fieldLayout);
            if (!layoutValidation.ok) {
                return res.status(400).json({ success: false, message: layoutValidation.error, code: 'INVALID_FIELD_LAYOUT' });
            }
            const layoutApplied = applyFieldLayoutOnSave(
                mod.key,
                Array.isArray(mod.fields) ? mod.fields : [],
                layoutValidation.fieldLayout
            );
            mod.fields = layoutApplied.fields;
            mod.fieldLayout = layoutApplied.fieldLayout;
        }
        
        // Always update relationships if provided (even if empty array).
        // Implementation decision: tenant settings only update ModuleDefinition.relationships
        // (tenant config: enable/disable, labels, display options). We do NOT create or
        // update RelationshipDefinition here; that is platform canonical schema (seeds/migrations only).
        // Every entry must include relationshipKey that matches an existing RelationshipDefinition.
        // If an entry has targetModuleKey but no relationshipKey, resolve from platform (so Settings UI
        // relationships show in the Link Record drawer without requiring relationshipKey in the UI).
        if (relationships !== undefined) {
            const newRelationships = Array.isArray(relationships) ? [...relationships] : [];
            const sourceAppKey = resolveModuleAppKey((mod.moduleKey || mod.key || ''), mod.appKey || 'platform');
            const sourceModuleKey = (mod.moduleKey || mod.key || '').toString().toLowerCase();
            const toTargetKey = (r) => {
                const raw = r.targetModuleKey ?? r.targetModule;
                if (raw == null) return '';
                if (typeof raw === 'object') return String(raw.key ?? raw.moduleKey ?? '').toLowerCase().trim();
                return String(raw).toLowerCase().trim();
            };
            const outgoing = await getOutgoingRelationships(sourceAppKey, sourceModuleKey);
            const incoming = getIncomingRelationships(sourceAppKey, sourceModuleKey);
            let createdDefinitions = false;
            for (const r of newRelationships) {
                const targetKey = toTargetKey(r);
                const currentKey = r.relationshipKey && String(r.relationshipKey).trim().toLowerCase();
                if (targetKey && (!currentKey || !relationshipRegistry.has(currentKey))) {
                    const matches = outgoing.filter((def) => def.target && (String(def.target.moduleKey || '').toLowerCase() === targetKey));
                    if (matches.length === 1) {
                        r.relationshipKey = matches[0].relationshipKey;
                        continue;
                    }
                    const incomingMatches = (incoming || []).filter(
                        (def) => def.source && (String(def.source.moduleKey || '').toLowerCase() === targetKey)
                    );
                    if (incomingMatches.length === 1) {
                        r.relationshipKey = incomingMatches[0].relationshipKey;
                        continue;
                    }
                    const generatedKey = currentKey || `${sourceModuleKey}_${targetKey}`.replace(/[^a-z0-9_]/g, '_');
                    await ensurePlatformRelationshipDefinition({
                        relationshipKey: generatedKey,
                        sourceAppKey,
                        sourceModuleKey,
                        targetModuleKey: targetKey,
                        relationshipType: r.type
                    });
                    r.relationshipKey = generatedKey;
                    createdDefinitions = true;
                }
            }
            if (createdDefinitions) {
                await relationshipRegistry.refreshRelationshipKeyCache();
            }
            await ensureDocumentRelationshipsIfReferenced(newRelationships, sourceModuleKey);
            const invalid = newRelationships
                .map((r) => String(r.relationshipKey).trim())
                .filter((k) => !relationshipRegistry.has(k));
            const invalidUnique = [...new Set(invalid)];
            if (invalidUnique.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `The following relationshipKeys do not exist in the platform schema: ${invalidUnique.join(', ')}. Define them via seed/migration first.`,
                    code: 'RELATIONSHIP_KEY_NOT_FOUND',
                    invalidKeys: invalidUnique
                });
            }
            // Verify each relationship matches this module (outgoing or incoming perspective)
            const mismatch = newRelationships.findIndex((r) => {
                const def = relationshipRegistry.get(r.relationshipKey);
                const targetModuleKey = toTargetKey(r);
                return !relationshipMatchesModule(def, sourceAppKey, sourceModuleKey, targetModuleKey);
            });
            if (mismatch !== -1) {
                const r = newRelationships[mismatch];
                const def = relationshipRegistry.get(r.relationshipKey);
                const targetModuleKey = toTargetKey(r);
                return res.status(400).json({
                    success: false,
                    message: `Relationship "${r.relationshipKey}" does not match this module: expected source ${sourceAppKey}.${sourceModuleKey} and target module ${targetModuleKey}, but definition has source ${def?.source?.appKey}.${def?.source?.moduleKey} and target ${def?.target?.moduleKey}.`,
                    code: 'RELATIONSHIP_MODULE_MISMATCH',
                    invalidIndex: mismatch,
                    relationshipKey: r.relationshipKey,
                    expectedSource: { appKey: sourceAppKey, moduleKey: sourceModuleKey },
                    expectedTargetModuleKey: targetModuleKey,
                    definitionSource: def?.source,
                    definitionTarget: def?.target
                });
            }
            console.log('📝 Setting relationships:', {
                from: mod.relationships?.length || 0,
                to: newRelationships.length,
                relationships: newRelationships
            });
            mod.set('relationships', newRelationships);
            mod.markModified('relationships');
        }
        
        // Always update quickCreate if provided (even if empty array)
        if (quickCreate !== undefined) {
            let newQuickCreate = Array.isArray(quickCreate) ? quickCreate : [];
            if (mod.key === 'events') {
                newQuickCreate = newQuickCreate.filter(k => !deprecatedEventAliasKeys.has(String(k || '').toLowerCase()));
            }
            // Tasks: normalize quickCreate to use "relatedTo" instead of relatedToType/relatedToId
            if (mod.key === 'tasks') {
                const qcLower = newQuickCreate.map(k => String(k || '').toLowerCase().trim());
                if (qcLower.includes('relatedtotype') || qcLower.includes('relatedtoid')) {
                    newQuickCreate = newQuickCreate.filter(k => {
                        const kk = String(k || '').toLowerCase().trim();
                        return kk !== 'relatedtotype' && kk !== 'relatedtoid';
                    });
                    if (!newQuickCreate.some(k => String(k || '').toLowerCase().trim() === 'relatedto')) {
                        newQuickCreate.push('relatedTo');
                    }
                }
            }
            console.log('📝 Setting quickCreate:', {
                from: mod.quickCreate,
                to: newQuickCreate,
                length: newQuickCreate.length
            });
            mod.quickCreate = newQuickCreate;
            mod.markModified('quickCreate');
        }
        
        // Always update quickCreateLayout if provided
        if (quickCreateLayout !== undefined) {
            let newLayout = (quickCreateLayout && typeof quickCreateLayout === 'object') 
                ? quickCreateLayout 
                : { version: 1, rows: [] };
            if (mod.key === 'events' && newLayout && Array.isArray(newLayout.rows)) {
                // Remove deprecated/alias fields from layout cols and drop empty rows
                newLayout = {
                    ...newLayout,
                    rows: newLayout.rows
                        .map(r => ({
                            ...r,
                            cols: Array.isArray(r?.cols)
                                ? r.cols.filter(c => !deprecatedEventAliasKeys.has(String(c?.fieldKey || '').toLowerCase()))
                                : r?.cols
                        }))
                        .filter(r => Array.isArray(r?.cols) ? r.cols.length > 0 : true)
                };
            }
            console.log('📝 Setting quickCreateLayout:', {
                from: mod.quickCreateLayout,
                to: newLayout,
                rows: newLayout.rows?.length || 0
            });
            mod.set('quickCreateLayout', newLayout);
        }
        
        // Mark quickCreateLayout as modified (quickCreate already marked above)
        if (quickCreateLayout !== undefined) mod.markModified('quickCreateLayout');

        if (pipelineSettings !== undefined) {
            let newPipelineSettings = Array.isArray(pipelineSettings) ? pipelineSettings : [];
            if (mod.key === 'deals') {
                newPipelineSettings = normalizePipelineSettings(newPipelineSettings);
            }
            mod.set('pipelineSettings', newPipelineSettings);
            mod.markModified('pipelineSettings');
        }
        
        await mod.save();
        
        // Use raw MongoDB update to ensure quickCreate is saved (bypass Mongoose issues)
        if (quickCreate !== undefined) {
            const mongoose = require('mongoose');
            const newQuickCreate = Array.isArray(quickCreate) ? quickCreate : [];
            await mongoose.connection.db.collection('moduledefinitions').updateOne(
                { _id: mod._id },
                { $set: { quickCreate: newQuickCreate } }
            );
            console.log('✅ Explicitly saved quickCreate via raw MongoDB:', newQuickCreate);
        }
        
        // Reload from database to ensure we get the latest data - use lean() for plain object
        const saved = await ModuleDefinition.findById(mod._id).lean();
        
        console.log('✅ Module saved. Verification:', {
            key: saved.key,
            relationships: saved.relationships,
            relationshipsLength: saved.relationships?.length || 0,
            quickCreate: saved.quickCreate,
            quickCreateLength: saved.quickCreate?.length || 0,
            quickCreateType: Array.isArray(saved.quickCreate),
            quickCreateLayout: saved.quickCreateLayout,
            quickCreateLayoutRows: saved.quickCreateLayout?.rows?.length || 0,
            modQuickCreate: mod.quickCreate,
            modQuickCreateLayout: mod.quickCreateLayout
        });
        
        // saved is already a plain object from lean(), but ensure all fields are present
        const responseData = saved || {};
        
        // Always explicitly set these fields from the saved document
        responseData.relationships = saved?.relationships || [];
        responseData.quickCreate = saved?.quickCreate || [];
        responseData.quickCreateLayout = saved?.quickCreateLayout || { version: 1, rows: [] };
        responseData.pipelineSettings = saved?.pipelineSettings || [];
        responseData.fieldLayout = saved?.fieldLayout || mod.fieldLayout || null;
        if (mod.key === 'deals') {
            responseData.pipelineSettings = normalizePipelineSettings(responseData.pipelineSettings);
        }
        
        // Final check - ensure responseData has the fields before sending
        if (!('relationships' in responseData) || responseData.relationships === undefined) {
            console.warn('⚠️  relationships missing in responseData, forcing set from saved');
            responseData.relationships = saved?.relationships || [];
        }
        if (!('quickCreate' in responseData) || responseData.quickCreate === undefined) {
            console.warn('⚠️  quickCreate missing in responseData, forcing set from saved');
            responseData.quickCreate = saved?.quickCreate || [];
        }
        if (!('quickCreateLayout' in responseData) || responseData.quickCreateLayout === undefined) {
            console.warn('⚠️  quickCreateLayout missing in responseData, forcing set from saved');
            responseData.quickCreateLayout = saved?.quickCreateLayout || { version: 1, rows: [] };
        }
        
        console.log('📤 Sending response (FINAL):', {
            hasQuickCreate: 'quickCreate' in responseData,
            quickCreate: responseData.quickCreate,
            quickCreateLength: responseData.quickCreate?.length || 0,
            hasQuickCreateLayout: 'quickCreateLayout' in responseData,
            quickCreateLayout: responseData.quickCreateLayout,
            quickCreateLayoutRows: responseData.quickCreateLayout?.rows?.length || 0,
            savedQuickCreate: saved?.quickCreate,
            savedQuickCreateType: typeof saved?.quickCreate
        });

        const afterDoc = cloneForAudit({
            key: responseData.key || mod.key,
            name: responseData.name,
            enabled: responseData.enabled,
            fields: responseData.fields,
            fieldLayout: responseData.fieldLayout,
            relationships: responseData.relationships,
            quickCreate: responseData.quickCreate,
            quickCreateLayout: responseData.quickCreateLayout,
            pipelineSettings: responseData.pipelineSettings
        });
        const auditPair = buildModuleSettingsAuditPair({
            beforeDoc,
            afterDoc,
            body: req.body || {}
        });
        attachSettingsAuditDiff(res, auditPair.before, auditPair.after, {
            keys: [...new Set([...Object.keys(auditPair.before || {}), ...Object.keys(auditPair.after || {})])]
        });
        
        res.json({ 
            success: true, 
            data: responseData, 
            message: 'Module updated' 
        });
    } catch (error) {
        console.error('❌ Error updating module:', error);
        res.status(500).json({ success: false, message: 'Error updating module', error: error.message });
    }
};

/**
 * GET /modules/people/quick-create
 * Returns full people module for Create drawer: fields + quickCreate from org override (raw).
 * When org has none, use platform People quickCreate; when that too is empty, use canonical default
 * so the drawer always shows fields initially.
 */
exports.getPeopleQuickCreate = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        const collection = db.collection('moduledefinitions');
        const orgId = req.user.organizationId;
        const oid = mongoose.Types.ObjectId.isValid(orgId) ? new mongoose.Types.ObjectId(orgId) : orgId;

        let raw = await collection.findOne({
            organizationId: oid,
            key: 'people'
        });
        if (!raw) {
            raw = await collection.findOne({
                organizationId: oid,
                moduleKey: 'people'
            });
        }
        if (!raw) {
            const mongooseOverride = await ModuleDefinition.findOne({
                organizationId: oid,
                key: 'people'
            }).select('+quickCreate +quickCreateLayout').lean();
            if (mongooseOverride) raw = mongooseOverride;
        }

        let quickCreate = Array.isArray(raw?.quickCreate) ? [...raw.quickCreate] : [];
        let quickCreateLayout = (raw?.quickCreateLayout && typeof raw.quickCreateLayout === 'object')
            ? raw.quickCreateLayout
            : { version: 1, rows: [] };

        if (quickCreate.length === 0) {
            const platformRaw = await collection.findOne({
                appKey: 'platform',
                moduleKey: 'people',
                organizationId: null
            });
            const platformQc = Array.isArray(platformRaw?.quickCreate) ? platformRaw.quickCreate : [];
            if (platformQc.length > 0) {
                quickCreate = [...platformQc];
                quickCreateLayout = (platformRaw?.quickCreateLayout && typeof platformRaw.quickCreateLayout === 'object')
                    ? platformRaw.quickCreateLayout
                    : { version: 1, rows: [] };
            } else {
                quickCreate = [...INITIAL_PEOPLE_QUICK_CREATE];
            }
        }

        quickCreate = migratePeopleQuickCreateKeys(quickCreate);
        quickCreateLayout = migratePeopleQuickCreateLayoutKeys(quickCreateLayout);

        const baseFields = getBaseFieldsForKey('people');
        const withOrder = baseFields.map((f, i) => {
            const ff = { ...f, order: i };
            if (!ff.context) ff.context = 'global';
            if (!ff.owner) ff.owner = 'platform';
            return ff;
        });
        const overrideFields = Array.isArray(raw?.fields) && raw.fields.length > 0 ? raw.fields : null;
        let fields = withOrder;
        if (overrideFields) {
            const baseMap = new Map(baseFields.map(f => [f.key?.toLowerCase(), f]));
            fields = overrideFields.map((f, i) => {
                const b = baseMap.get((f.key || '').toLowerCase());
                const merged = { ...(b || f), ...f, order: i };
                if (!merged.context) merged.context = 'global';
                if (!merged.owner) merged.owner = 'platform';
                return merged;
            });
        }
        const quickCreateContext = String(req.query.context || 'all').toLowerCase();
        const filtered = filterFieldsByContext(fields, quickCreateContext);
        const normalizedFields = normalizePeopleModuleFields(filtered);
        const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
        const peopleCfg = await getPeopleTypesConfig(orgId, 'SALES');
        const enrichedFields = enrichPeopleFieldsWithPeopleTypes(normalizedFields, peopleCfg.typeDefs);
        const enrichedFieldsWithPhoneDefaults = ensurePhoneFieldDefaultValidations(enrichedFields);
        const readableFields = filterFieldsByReadAccess(
            enrichedFieldsWithPhoneDefaults,
            req.user,
            'people'
        );

        const out = {
            key: 'people',
            name: 'People',
            fields: readableFields,
            quickCreate,
            quickCreateLayout,
            fieldLayout: raw?.fieldLayout || null
        };
        res.json({ success: true, data: out });
    } catch (err) {
        console.error('getPeopleQuickCreate error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSystemModule = async (req, res) => {
    try {
        const { key } = req.params;
        const keyLower = String(key || '').toLowerCase();
        const mongoose = require('mongoose');
        const orgObjectId = new mongoose.Types.ObjectId(req.user.organizationId);
        const orgIdVariants = [
            orgObjectId,
            String(req.user.organizationId),
            ...(mongoose.Types.ObjectId.isValid(req.user.organizationId)
                ? [req.user.organizationId]
                : [])
        ];
        const orgFilterMongoose = {
            organizationId: { $in: orgIdVariants },
            $or: [{ key: keyLower }, { moduleKey: keyLower }]
        };
        const orgFilterRaw = {
            organizationId: { $in: orgIdVariants },
            $or: [{ key: keyLower }, { moduleKey: keyLower }]
        };
        const systemKeys = new Set([
            'people', 'organizations', 'deals', 'cases', 'tasks', 'events', 'forms', 'items', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents',
            'imports', 'reports'
        ]);
        if (!systemKeys.has(keyLower)) return res.status(400).json({ success: false, message: 'Invalid system module key' });
        const { attachSettingsAuditDiff, buildModuleSettingsAuditPair, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const { fields, enabled, name, relationships, quickCreate, quickCreateLayout, pipelineSettings, fieldLayout } = req.body;
        const deprecatedEventAliasKeys = new Set(['relatedorg', 'relatedorgid', 'relatedorganization']);
        
        console.log('🔵 updateSystemModule called:', {
            moduleKey: key,
            organizationId: req.user.organizationId,
            bodyKeys: Object.keys(req.body),
            quickCreateProvided: quickCreate !== undefined,
            quickCreateValue: quickCreate,
            quickCreateType: typeof quickCreate,
            quickCreateIsArray: Array.isArray(quickCreate),
            quickCreateLayoutProvided: quickCreateLayout !== undefined,
            quickCreateLayoutValue: quickCreateLayout
        });
        
        // Load existing module definition to validate field mutations
        // Use lowercase key for consistency
        const existingMod = await ModuleDefinition.findOne({
            ...orgFilterMongoose
        }).select('+quickCreate +quickCreateLayout +fields +relationships +pipelineSettings');

        const beforeDoc = cloneForAudit({
            key: keyLower,
            name: existingMod?.name || null,
            enabled: existingMod?.enabled,
            fields: existingMod?.fields,
            fieldLayout: existingMod?.fieldLayout,
            relationships: existingMod?.relationships,
            quickCreate: existingMod?.quickCreate,
            quickCreateLayout: existingMod?.quickCreateLayout,
            pipelineSettings: existingMod?.pipelineSettings
        });
        
        // When user "removes" platform/app fields from config, re-add them as hidden so save succeeds (no 403)
        let fieldsToSave = fields;
        if (Array.isArray(fields) && existingMod) {
            const oldFields = Array.isArray(existingMod.fields) ? existingMod.fields : [];
            fieldsToSave = mergeRemovedPlatformOrAppFieldsAsHidden(oldFields, fields);
        }
        // Validate field mutations based on ownership
        if (Array.isArray(fieldsToSave) && existingMod) {
            const oldFields = Array.isArray(existingMod.fields) ? existingMod.fields : [];
            const validation = validateFieldMutations(oldFields, fieldsToSave, req.user);
            
            if (!validation.valid) {
                return res.status(403).json({
                    success: false,
                    message: validation.error,
                    code: 'FIELD_MUTATION_NOT_ALLOWED',
                    violations: validation.violations
                });
            }
        }
        
        // Build update object - only include fields that are provided
        const updateObj = {
            type: 'system'
        };
        
        if (name !== undefined) updateObj.name = String(name).trim();
        if (enabled !== undefined) updateObj.enabled = !!enabled;
        if (Array.isArray(fieldsToSave)) {
            let fieldsOut = (keyLower === 'events')
                ? fieldsToSave.filter(f => !deprecatedEventAliasKeys.has(String(f?.key || '').toLowerCase()))
                : fieldsToSave;
            if (keyLower === 'events') {
                fieldsOut = fieldsOut.map(normalizeEventFieldConfig);
            }
            if (keyLower === 'tasks') {
                fieldsOut = dedupeFieldsByKey(fieldsOut);
                fieldsOut = normalizeTasksModuleFields(fieldsOut);
            }
            if (keyLower === 'people') {
                const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
                const peopleCfg = await getPeopleTypesConfig(req.user.organizationId, 'SALES');
                fieldsOut = normalizePeopleModuleFields(fieldsOut);
                fieldsOut = enrichPeopleFieldsWithPeopleTypes(fieldsOut, peopleCfg.typeDefs);
            }
            if (keyLower === 'organizations') {
                // Field Config picklist edits must land in tenant SoT before enrich,
                // otherwise enrichOrganizationsModuleFields discards the client's option edits.
                const {
                    syncOrganizationStatusPicklistsFromModuleFields,
                    syncOrganizationParticipationTypesFromModuleFields,
                } = require('../utils/tenantMetadata');
                await syncOrganizationStatusPicklistsFromModuleFields(fieldsOut, req.user.organizationId);
                await syncOrganizationParticipationTypesFromModuleFields(fieldsOut, req.user.organizationId);
                fieldsOut = await enrichOrganizationsModuleFields(fieldsOut, req.user.organizationId);
            }
            const { applyFieldLayoutOnSave, validateFieldLayoutPayload } = require('../utils/fieldLayout');
            const layoutValidation = validateFieldLayoutPayload(keyLower, fieldLayout !== undefined ? fieldLayout : existingMod?.fieldLayout);
            if (!layoutValidation.ok) {
                return res.status(400).json({ success: false, message: layoutValidation.error, code: 'INVALID_FIELD_LAYOUT' });
            }
            const layoutApplied = applyFieldLayoutOnSave(keyLower, fieldsOut, layoutValidation.fieldLayout);
            fieldsOut = layoutApplied.fields;
            updateObj.fieldLayout = layoutApplied.fieldLayout;
            updateObj.fields = fieldsOut;
        } else if (fieldLayout !== undefined) {
            const { applyFieldLayoutOnSave, validateFieldLayoutPayload } = require('../utils/fieldLayout');
            const layoutValidation = validateFieldLayoutPayload(keyLower, fieldLayout);
            if (!layoutValidation.ok) {
                return res.status(400).json({ success: false, message: layoutValidation.error, code: 'INVALID_FIELD_LAYOUT' });
            }
            const existingFields = Array.isArray(existingMod?.fields) ? existingMod.fields : [];
            const layoutApplied = applyFieldLayoutOnSave(keyLower, existingFields, layoutValidation.fieldLayout);
            updateObj.fieldLayout = layoutApplied.fieldLayout;
            updateObj.fields = layoutApplied.fields;
        }
        // Resolve and validate relationships (same as updateModule) so saved config works in Link Record drawer
        if (relationships !== undefined) {
            const newRelationships = Array.isArray(relationships) ? [...relationships] : [];
            const sourceAppKey = resolveModuleAppKey(keyLower, 'platform');
            const sourceModuleKey = keyLower;
            const toTargetKey = (r) => {
                const raw = r.targetModuleKey ?? r.targetModule;
                if (raw == null) return '';
                if (typeof raw === 'object') return String(raw.key ?? raw.moduleKey ?? '').toLowerCase().trim();
                return String(raw).toLowerCase().trim();
            };
            const outgoing = await getOutgoingRelationships(sourceAppKey, sourceModuleKey);
            const incoming = getIncomingRelationships(sourceAppKey, sourceModuleKey);
            let createdDefinitions = false;
            for (const r of newRelationships) {
                const targetKey = toTargetKey(r);
                const relKey = r.relationshipKey && String(r.relationshipKey).trim().toLowerCase();
                if (targetKey && (!relKey || !relationshipRegistry.has(relKey))) {
                    const matches = outgoing.filter((def) => def.target && (String(def.target.moduleKey || '').toLowerCase() === targetKey));
                    if (matches.length === 1) {
                        r.relationshipKey = matches[0].relationshipKey;
                        continue;
                    }
                    const incomingMatches = (incoming || []).filter(
                        (def) => def.source && (String(def.source.moduleKey || '').toLowerCase() === targetKey)
                    );
                    if (incomingMatches.length === 1) {
                        r.relationshipKey = incomingMatches[0].relationshipKey;
                        continue;
                    }
                    const generatedKey = relKey || `${sourceModuleKey}_${targetKey}`.replace(/[^a-z0-9_]/g, '_');
                    await ensurePlatformRelationshipDefinition({
                        relationshipKey: generatedKey,
                        sourceAppKey,
                        sourceModuleKey,
                        targetModuleKey: targetKey,
                        relationshipType: r.type
                    });
                    r.relationshipKey = generatedKey;
                    createdDefinitions = true;
                }
            }
            if (createdDefinitions) {
                await relationshipRegistry.refreshRelationshipKeyCache();
            }
            await ensureDocumentRelationshipsIfReferenced(newRelationships, sourceModuleKey);
            const invalid = newRelationships
                .map((r) => String(r.relationshipKey).trim())
                .filter((k) => !relationshipRegistry.has(k));
            const invalidUnique = [...new Set(invalid)];
            if (invalidUnique.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `The following relationshipKeys do not exist in the platform schema: ${invalidUnique.join(', ')}. Define them via seed/migration first.`,
                    code: 'RELATIONSHIP_KEY_NOT_FOUND',
                    invalidKeys: invalidUnique
                });
            }
            const mismatch = newRelationships.findIndex((r) => {
                const def = relationshipRegistry.get(r.relationshipKey);
                const targetModuleKey = toTargetKey(r);
                return !relationshipMatchesModule(def, sourceAppKey, sourceModuleKey, targetModuleKey);
            });
            if (mismatch !== -1) {
                const r = newRelationships[mismatch];
                const def = relationshipRegistry.get(r.relationshipKey);
                const targetModuleKey = toTargetKey(r);
                return res.status(400).json({
                    success: false,
                    message: `Relationship "${r.relationshipKey}" does not match this module: expected source ${sourceAppKey}.${sourceModuleKey} and target ${targetModuleKey}, but definition has source ${def?.source?.appKey}.${def?.source?.moduleKey} and target ${def?.target?.moduleKey}.`,
                    code: 'RELATIONSHIP_MODULE_MISMATCH',
                    invalidIndex: mismatch
                });
            }
            updateObj.relationships = newRelationships;
        }
        if (pipelineSettings !== undefined) {
            const pipelineValue = Array.isArray(pipelineSettings) ? pipelineSettings : [];
            updateObj.pipelineSettings = keyLower === 'deals'
                ? normalizePipelineSettings(pipelineValue)
                : pipelineValue;
        }
        
        // Always update quickCreate if provided (even if empty array)
        if (quickCreate !== undefined) {
            let qc = Array.isArray(quickCreate) ? quickCreate : [];
            if (keyLower === 'events') {
                qc = qc.filter(k => !deprecatedEventAliasKeys.has(String(k || '').toLowerCase()));
            }
            if (keyLower === 'people') {
                qc = migratePeopleQuickCreateKeys(qc);
            }
            updateObj.quickCreate = qc;
            console.log('📝 Setting quickCreate in updateObj:', {
                value: updateObj.quickCreate,
                length: updateObj.quickCreate.length,
                type: typeof updateObj.quickCreate,
                isArray: Array.isArray(updateObj.quickCreate)
            });
        }
        
        // Always update quickCreateLayout if provided
        if (quickCreateLayout !== undefined) {
            let layout = (quickCreateLayout && typeof quickCreateLayout === 'object') 
                ? quickCreateLayout 
                : { version: 1, rows: [] };
            if (keyLower === 'events' && layout && Array.isArray(layout.rows)) {
                layout = {
                    ...layout,
                    rows: layout.rows
                        .map(r => ({
                            ...r,
                            cols: Array.isArray(r?.cols)
                                ? r.cols.filter(c => !deprecatedEventAliasKeys.has(String(c?.fieldKey || '').toLowerCase()))
                                : r?.cols
                        }))
                        .filter(r => Array.isArray(r?.cols) ? r.cols.length > 0 : true)
                };
            }
            if (keyLower === 'people') {
                layout = migratePeopleQuickCreateLayoutKeys(layout);
            }
            updateObj.quickCreateLayout = layout;
            console.log('📝 Setting quickCreateLayout in updateObj:', {
                version: updateObj.quickCreateLayout?.version,
                rows: updateObj.quickCreateLayout?.rows?.length || 0,
                hasRows: 'rows' in updateObj.quickCreateLayout
            });
        }
        
        console.log('🔧 Update object keys:', Object.keys(updateObj));
        console.log('🔧 Update object quickCreate:', updateObj.quickCreate);
        console.log('🔧 Update object quickCreate type:', typeof updateObj.quickCreate, Array.isArray(updateObj.quickCreate));
        console.log('🔧 Update object quickCreateLayout:', JSON.stringify(updateObj.quickCreateLayout, null, 2));
        
        // Deep copy to ensure we're working with clean data
        const cleanUpdateObj = JSON.parse(JSON.stringify(updateObj));
        console.log('🔧 Clean update object quickCreate:', cleanUpdateObj.quickCreate);
        console.log('🔧 Clean update object quickCreate type:', typeof cleanUpdateObj.quickCreate, Array.isArray(cleanUpdateObj.quickCreate));
        
        // Log the exact update operation
        console.log('🔧 MongoDB Update Operation:', {
            filter: { organizationId: req.user.organizationId.toString(), key },
            update: { $set: cleanUpdateObj },
            updateObjKeys: Object.keys(cleanUpdateObj),
            updateObjHasQuickCreate: 'quickCreate' in cleanUpdateObj,
            updateObjQuickCreateLength: cleanUpdateObj.quickCreate?.length || 0,
            updateObjHasQuickCreateLayout: 'quickCreateLayout' in cleanUpdateObj
        });
        
        // Ensure quickCreate is definitely in the update if provided
        if (quickCreate !== undefined && updateObj.quickCreate) {
            console.log('✅ quickCreate will be saved:', {
                value: updateObj.quickCreate,
                length: updateObj.quickCreate.length,
                isArray: Array.isArray(updateObj.quickCreate),
                keys: updateObj.quickCreate.slice(0, 5) // First 5 keys
            });
        }
        
        // Mongoose updateOne seems to be filtering out quickCreate and fields
        // So we'll use direct MongoDB driver for these critical fields and Mongoose for others
        const db = mongoose.connection.db;
        const collection = db.collection('moduledefinitions');
        
        // Separate critical fields that Mongoose seems to ignore
        const criticalFields = {};
        const otherFields = {};
        
        Object.keys(cleanUpdateObj).forEach(objKey => {
            // fields + fieldLayout must write together (same Mongo upsert) so tenant
            // overrides never split across two docs / two drivers.
            if (
                objKey === 'quickCreate' ||
                objKey === 'quickCreateLayout' ||
                objKey === 'fields' ||
                objKey === 'fieldLayout' ||
                objKey === 'relationships' ||
                objKey === 'pipelineSettings'
            ) {
                criticalFields[objKey] = cleanUpdateObj[objKey];
            } else {
                otherFields[objKey] = cleanUpdateObj[objKey];
            }
        });
        
        // Prefer a single raw-Mongo write when fields/quickCreate/etc. are present so
        // name/enabled and fields never land on different tenant override documents.
        let updateResult = { matchedCount: 0, modifiedCount: 0 };
        if (Object.keys(criticalFields).length > 0) {
            console.log('🔧 Using direct MongoDB update for critical fields:', Object.keys(criticalFields));
            const directUpdateResult = await collection.updateOne(
                orgFilterRaw,
                {
                    $set: {
                        ...otherFields,
                        ...criticalFields,
                        organizationId: orgObjectId,
                        key: keyLower,
                        moduleKey: keyLower,
                        type: 'system',
                        label: key.charAt(0).toUpperCase() + key.slice(1),
                        pluralLabel: key.charAt(0).toUpperCase() + key.slice(1) + 's',
                        entityType: 'CORE',
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            updateResult = directUpdateResult;

            console.log('📊 Direct MongoDB update result:', {
                matchedCount: directUpdateResult.matchedCount,
                modifiedCount: directUpdateResult.modifiedCount,
                upsertedCount: directUpdateResult.upsertedCount || 0,
                upsertedId: directUpdateResult.upsertedId,
                acknowledged: directUpdateResult.acknowledged,
                fields: Object.keys(criticalFields),
                relationshipsCount: criticalFields.relationships?.length || 0,
                quickCreate: criticalFields.quickCreate?.length || 0,
                fieldsCount: criticalFields.fields?.length || 0,
                pipelineSettingsCount: criticalFields.pipelineSettings?.length || 0
            });

            if (directUpdateResult.matchedCount === 0 && directUpdateResult.upsertedCount === 0) {
                console.error('🚨 WARNING: Document not found and not created!', {
                    organizationId: req.user.organizationId.toString(),
                    key: keyLower,
                    updateResult: directUpdateResult
                });
            } else if (directUpdateResult.upsertedCount > 0) {
                console.log('✅ Document created via upsert:', {
                    upsertedId: directUpdateResult.upsertedId,
                    organizationId: req.user.organizationId.toString(),
                    key: keyLower
                });
            }
        } else if (Object.keys(otherFields).length > 0) {
            const upsertFields = {
                ...otherFields,
                organizationId: orgObjectId,
                key: keyLower,
                moduleKey: keyLower,
                label: key.charAt(0).toUpperCase() + key.slice(1),
                pluralLabel: key.charAt(0).toUpperCase() + key.slice(1) + 's',
                entityType: 'CORE',
                type: 'system'
            };
            updateResult = await ModuleDefinition.updateOne(
                orgFilterMongoose,
                { $set: upsertFields },
                { upsert: true, runValidators: false }
            );
            console.log('📊 Mongoose updateOne result (other fields):', {
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
                fields: Object.keys(otherFields)
            });
        }
        
        // Now fetch the document to verify what was saved
        // Explicitly select fields that have select: false in schema
        // Use lowercase key to match what was saved
        const doc = await ModuleDefinition.findOne({ 
            ...orgFilterMongoose
        }).select('+quickCreate +quickCreateLayout +fields +relationships +pipelineSettings');
        
        if (!doc) {
            throw new Error('Failed to retrieve document after save');
        }
        
        console.log('📄 Document after updateOne:', {
            docId: doc._id,
            docRelationships: doc.relationships,
            docRelationshipsLength: doc.relationships?.length || 0,
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateIsArray: Array.isArray(doc.quickCreate),
            docHasQuickCreate: 'quickCreate' in doc,
            docQuickCreateLayout: doc.quickCreateLayout,
            docQuickCreateLayoutRows: doc.quickCreateLayout?.rows?.length || 0
        });
        
        console.log('🔍 Immediately after save:', {
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docHasQuickCreate: 'quickCreate' in doc,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateLayout: doc.quickCreateLayout,
            docQuickCreateLayoutRows: doc.quickCreateLayout?.rows?.length || 0,
            docId: doc._id
        });
        
        // Wait a brief moment for write to complete, then verify
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify what was actually saved by querying directly from MongoDB (bypass Mongoose)
        const verifiedRaw = await collection.findOne({ 
            ...orgFilterRaw
        });
        
        console.log('🔍 Raw MongoDB document keys:', verifiedRaw ? Object.keys(verifiedRaw) : 'Document not found');
        console.log('🔍 Raw MongoDB relationships:', verifiedRaw?.relationships, 'length:', verifiedRaw?.relationships?.length || 0);
        console.log('🔍 Raw MongoDB quickCreate:', verifiedRaw?.quickCreate);
        console.log('🔍 Raw MongoDB fields count:', verifiedRaw?.fields?.length || 0);
        console.log('🔍 Raw MongoDB pipelineSettings count:', verifiedRaw?.pipelineSettings?.length || 0);
        
        // Also verify with Mongoose to compare
        // Explicitly select fields that have select: false in schema
        // Use lowercase key to match what was saved
        const verified = await ModuleDefinition.findOne({ 
            ...orgFilterMongoose
        }).select('+quickCreate +quickCreateLayout +fields +relationships +pipelineSettings').lean(); // Use lean() to get plain JavaScript object
        
        // Also get the Mongoose document to compare
        // Explicitly select fields that have select: false in schema
        // Use lowercase key to match what was saved
        const verifiedDoc = await ModuleDefinition.findOne({ 
            ...orgFilterMongoose
        }).select('+quickCreate +quickCreateLayout +fields +relationships +pipelineSettings');
        
        console.log('🔍 After lean query (from database):', {
            verifiedRelationships: verified?.relationships,
            verifiedRelationshipsLength: verified?.relationships?.length || 0,
            verifiedHasRelationships: verified && 'relationships' in verified,
            verifiedQuickCreate: verified?.quickCreate,
            verifiedQuickCreateLength: verified?.quickCreate?.length || 0,
            verifiedHasQuickCreate: verified && 'quickCreate' in verified,
            verifiedQuickCreateLayout: verified?.quickCreateLayout,
            verifiedQuickCreateLayoutRows: verified?.quickCreateLayout?.rows?.length || 0,
            verifiedId: verified?._id,
            verifiedKey: verified?.key,
            allVerifiedKeys: verified ? Object.keys(verified) : []
        });
        
        // Compare with Mongoose document version
        if (verifiedDoc) {
            console.log('🔍 Mongoose document (not lean):', {
                docRelationships: verifiedDoc.relationships,
                docRelationshipsLength: verifiedDoc.relationships?.length || 0,
                docHasRelationships: 'relationships' in verifiedDoc,
                docQuickCreate: verifiedDoc.quickCreate,
                docQuickCreateLength: verifiedDoc.quickCreate?.length || 0,
                docHasQuickCreate: 'quickCreate' in verifiedDoc,
                docQuickCreateLayout: verifiedDoc.quickCreateLayout,
                docQuickCreateLayoutRows: verifiedDoc.quickCreateLayout?.rows?.length || 0
            });
        }
        
        // Use raw MongoDB document if available (most reliable), otherwise fall back to Mongoose verified
        const sourceDoc = verifiedRaw || verified;
        // Ensure verified includes relationships from sourceDoc
        if (verified && sourceDoc?.relationships) {
            verified.relationships = sourceDoc.relationships;
        }
        if (verified && sourceDoc?.pipelineSettings) {
            verified.pipelineSettings = sourceDoc.pipelineSettings;
        }
        
        // Verify critical fields were saved correctly
        if (criticalFields.relationships) {
            const savedRelationships = sourceDoc?.relationships || [];
            const savedLength = Array.isArray(savedRelationships) ? savedRelationships.length : 0;
            const expectedLength = Array.isArray(criticalFields.relationships) ? criticalFields.relationships.length : 0;
            
            if (savedLength !== expectedLength) {
                console.error('🚨 CRITICAL: relationships still not saved correctly!', {
                    expected: expectedLength,
                    saved: savedLength,
                    relationships: criticalFields.relationships
                });
            } else {
                console.log('✅ Relationships saved correctly:', {
                    expected: expectedLength,
                    saved: savedLength
                });
            }
        }
        
        if (criticalFields.quickCreate) {
            const savedQuickCreate = sourceDoc?.quickCreate || [];
            const savedLength = Array.isArray(savedQuickCreate) ? savedQuickCreate.length : 0;
            const expectedLength = Array.isArray(criticalFields.quickCreate) ? criticalFields.quickCreate.length : 0;
            
            if (savedLength !== expectedLength) {
                console.error('🚨 CRITICAL: quickCreate still not saved correctly!', {
                    expected: expectedLength,
                    saved: savedLength,
                    expectedArray: criticalFields.quickCreate,
                    savedArray: savedQuickCreate,
                    rawDocHasIt: verifiedRaw && 'quickCreate' in verifiedRaw,
                    mongooseDocHasIt: verified && 'quickCreate' in verified
                });
            } else {
                console.log('✅ quickCreate verified successfully:', {
                    length: savedLength,
                    values: savedQuickCreate
                });
            }
        }
        
        if (criticalFields.fields) {
            const savedFields = sourceDoc?.fields || [];
            const savedCount = Array.isArray(savedFields) ? savedFields.length : 0;
            const expectedCount = Array.isArray(criticalFields.fields) ? criticalFields.fields.length : 0;
            
            if (savedCount !== expectedCount) {
                console.error('🚨 CRITICAL: fields still not saved correctly!', {
                    expected: expectedCount,
                    saved: savedCount
                });
            } else {
                console.log('✅ fields verified successfully:', {
                    count: savedCount
                });
            }
        }
        
        if (criticalFields.pipelineSettings) {
            const savedPipelines = sourceDoc?.pipelineSettings || [];
            const savedCount = Array.isArray(savedPipelines) ? savedPipelines.length : 0;
            const expectedCount = Array.isArray(criticalFields.pipelineSettings) ? criticalFields.pipelineSettings.length : 0;
            if (savedCount !== expectedCount) {
                console.error('🚨 CRITICAL: pipelineSettings still not saved correctly!', {
                    expected: expectedCount,
                    saved: savedCount
                });
            } else {
                console.log('✅ pipelineSettings verified successfully:', {
                    count: savedCount
                });
            }
        }
        
        // Update doc and verified from sourceDoc for response
        if (sourceDoc) {
            if (criticalFields.quickCreate) {
                doc.quickCreate = sourceDoc.quickCreate;
                verified.quickCreate = sourceDoc.quickCreate;
                if (criticalFields.quickCreateLayout) {
                    doc.quickCreateLayout = sourceDoc.quickCreateLayout;
                    verified.quickCreateLayout = sourceDoc.quickCreateLayout;
                }
            }
            if (criticalFields.fields) {
                doc.fields = sourceDoc.fields;
                verified.fields = sourceDoc.fields;
            }
            if (criticalFields.pipelineSettings) {
                doc.pipelineSettings = sourceDoc.pipelineSettings;
                verified.pipelineSettings = sourceDoc.pipelineSettings;
            }
        }
        
        console.log('✅ System module saved. Verification:', {
            key: doc.key,
            docQuickCreate: doc.quickCreate,
            docQuickCreateLength: doc.quickCreate?.length || 0,
            docQuickCreateType: typeof doc.quickCreate,
            docQuickCreateIsArray: Array.isArray(doc.quickCreate),
            docQuickCreateLayout: doc.quickCreateLayout,
            verifiedQuickCreate: verified?.quickCreate,
            verifiedQuickCreateLength: verified?.quickCreate?.length || 0,
            verifiedQuickCreateType: typeof verified?.quickCreate,
            verifiedQuickCreateIsArray: Array.isArray(verified?.quickCreate),
            verifiedQuickCreateLayout: verified?.quickCreateLayout,
            updateObjQuickCreate: updateObj.quickCreate,
            updateObjQuickCreateLength: updateObj.quickCreate?.length || 0,
            updateObjQuickCreateLayout: updateObj.quickCreateLayout
        });
        
        // Use verified document or doc - always use the one from database
        const responseDoc = verified || doc;
        
        // Convert to plain object - use JSON serialization to ensure all fields
        let responseData;
        if (responseDoc.toObject) {
            responseData = responseDoc.toObject({ getters: true, virtuals: false });
        } else {
            responseData = JSON.parse(JSON.stringify(responseDoc));
        }
        
        // Always explicitly set these fields - prioritize verified (from lean query)
        // verified is a plain object, so it should have all fields
        // Note: verified was already updated from sourceDoc earlier, so use it directly
        let relationshipsValue = verified?.relationships;
        let quickCreateValue = verified?.quickCreate;
        let quickCreateLayoutValue = verified?.quickCreateLayout;
        let pipelineSettingsValue = verified?.pipelineSettings;
        
        // If verified doesn't have it, check updateObj (what we tried to save)
        if (!relationshipsValue && updateObj.relationships) {
            console.warn('⚠️  relationships not found in saved doc, using updateObj value');
            relationshipsValue = updateObj.relationships;
        }
        if (!quickCreateValue && updateObj.quickCreate) {
            console.warn('⚠️  quickCreate not found in saved doc, using updateObj value');
            quickCreateValue = updateObj.quickCreate;
        }
        if (!quickCreateLayoutValue && updateObj.quickCreateLayout) {
            console.warn('⚠️  quickCreateLayout not found in saved doc, using updateObj value');
            quickCreateLayoutValue = updateObj.quickCreateLayout;
        }
        if (!pipelineSettingsValue && updateObj.pipelineSettings) {
            console.warn('⚠️  pipelineSettings not found in saved doc, using updateObj value');
            pipelineSettingsValue = updateObj.pipelineSettings;
        }
        
        console.log('🔍 Source document check:', {
            usingVerified: !!verified,
            sourceDocHasQuickCreate: 'quickCreate' in (sourceDoc || {}),
            quickCreateValue: quickCreateValue,
            quickCreateValueType: typeof quickCreateValue,
            quickCreateIsArray: Array.isArray(quickCreateValue),
            sourceDocHasQuickCreateLayout: 'quickCreateLayout' in (sourceDoc || {}),
            quickCreateLayoutValue: quickCreateLayoutValue,
            fallbackToUpdateObj: !sourceDoc?.quickCreate && !!updateObj.quickCreate
        });
        
        // Set the values - always use arrays/objects, never undefined
        responseData.relationships = Array.isArray(relationshipsValue) ? relationshipsValue : (relationshipsValue || []);
        responseData.quickCreate = Array.isArray(quickCreateValue) ? quickCreateValue : (quickCreateValue || []);
        responseData.quickCreateLayout = (quickCreateLayoutValue && typeof quickCreateLayoutValue === 'object') 
            ? quickCreateLayoutValue 
            : (quickCreateLayoutValue || { version: 1, rows: [] });
        
        // Final check - prioritize what was saved, but if empty or missing, use what was requested
        // This handles cases where the save might not have persisted but we still want to return what was requested
        let finalQuickCreate = [];
        if (quickCreateValue && Array.isArray(quickCreateValue)) {
            finalQuickCreate = quickCreateValue; // Use what's in the database
        } else if (updateObj.quickCreate && Array.isArray(updateObj.quickCreate)) {
            finalQuickCreate = updateObj.quickCreate; // Fallback to what was requested
        }
        
        let finalQuickCreateLayout = { version: 1, rows: [] };
        if (quickCreateLayoutValue && typeof quickCreateLayoutValue === 'object' && quickCreateLayoutValue.version) {
            finalQuickCreateLayout = quickCreateLayoutValue; // Use what's in the database
        } else if (updateObj.quickCreateLayout && typeof updateObj.quickCreateLayout === 'object') {
            finalQuickCreateLayout = updateObj.quickCreateLayout; // Fallback to what was requested
        }
        
        // Always set these in responseData
        responseData.quickCreate = finalQuickCreate;
        responseData.quickCreateLayout = finalQuickCreateLayout;
        responseData.pipelineSettings = Array.isArray(pipelineSettingsValue) ? pipelineSettingsValue : [];
        if (keyLower === 'deals') {
            responseData.pipelineSettings = normalizePipelineSettings(responseData.pipelineSettings);
        }
        
        console.log('📤 Sending response (FINAL):', {
            hasQuickCreate: 'quickCreate' in responseData,
            quickCreate: responseData.quickCreate,
            quickCreateLength: responseData.quickCreate?.length || 0,
            hasQuickCreateLayout: 'quickCreateLayout' in responseData,
            quickCreateLayout: responseData.quickCreateLayout,
            quickCreateLayoutRows: responseData.quickCreateLayout?.rows?.length || 0,
            usingUpdateObjValues: (finalQuickCreate === updateObj.quickCreate || finalQuickCreateLayout === updateObj.quickCreateLayout),
            responseDataKeys: Object.keys(responseData)
        });
        
        // Final relationships value - prioritize saved, fallback to updateObj
        let finalRelationships = [];
        if (relationshipsValue && Array.isArray(relationshipsValue)) {
            finalRelationships = relationshipsValue; // Use what's in the database
        } else if (updateObj.relationships && Array.isArray(updateObj.relationships)) {
            finalRelationships = updateObj.relationships; // Fallback to what was requested
        }
        
        // Create a fresh object to ensure no Mongoose document weirdness
        const finalResponse = {
            _id: responseData._id || doc._id,
            organizationId: responseData.organizationId || doc.organizationId,
            key: responseData.key || doc.key,
            name: responseData.name || doc.name,
            type: responseData.type || doc.type || 'system',
            enabled: responseData.enabled !== undefined ? responseData.enabled : doc.enabled,
            fields: responseData.fields || doc.fields || [],
            fieldLayout: (sourceDoc && sourceDoc.fieldLayout) || updateObj.fieldLayout || responseData.fieldLayout || null,
            relationships: finalRelationships,
            quickCreate: finalQuickCreate,
            quickCreateLayout: finalQuickCreateLayout,
            pipelineSettings: keyLower === 'deals'
                ? normalizePipelineSettings(responseData.pipelineSettings)
                : (Array.isArray(responseData.pipelineSettings) ? responseData.pipelineSettings : []),
            createdAt: responseData.createdAt || doc.createdAt,
            updatedAt: responseData.updatedAt || doc.updatedAt
        };

        const afterDoc = cloneForAudit({
            key: finalResponse.key || keyLower,
            name: finalResponse.name,
            enabled: finalResponse.enabled,
            fields: finalResponse.fields,
            fieldLayout: finalResponse.fieldLayout,
            relationships: finalResponse.relationships,
            quickCreate: finalResponse.quickCreate,
            quickCreateLayout: finalResponse.quickCreateLayout,
            pipelineSettings: finalResponse.pipelineSettings
        });
        const auditPair = buildModuleSettingsAuditPair({
            beforeDoc,
            afterDoc,
            body: req.body || {}
        });
        attachSettingsAuditDiff(res, auditPair.before, auditPair.after, {
            keys: [...new Set([...Object.keys(auditPair.before || {}), ...Object.keys(auditPair.after || {})])]
        });
        
        res.json({ 
            success: true, 
            data: finalResponse, 
            message: 'System module updated' 
        });
    } catch (error) {
        console.error('❌ Error updating system module:', error);
        res.status(500).json({ success: false, message: 'Error updating system module', error: error.message });
    }
};

exports.addModuleFieldPicklistOption = async (req, res) => {
    try {
        const keyLower = String(req.params.key || '').toLowerCase();
        const fieldKey = String(req.params.fieldKey || '').trim();
        const rawValue = String(req.body?.value || req.body?.label || '').trim();
        const {
            canAddPicklistOptionInline,
            optionExists,
            buildPicklistOptionEntry,
        } = require('../utils/picklistInlineOptionCreate');

        const systemKeys = new Set([
            'people', 'organizations', 'deals', 'cases', 'tasks', 'events', 'forms', 'items', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents',
            'imports', 'reports'
        ]);
        if (!systemKeys.has(keyLower)) {
            return res.status(400).json({ success: false, message: 'Invalid system module key' });
        }
        if (!fieldKey || !rawValue) {
            return res.status(400).json({ success: false, message: 'Field key and value are required' });
        }

        const mongoose = require('mongoose');
        const orgObjectId = new mongoose.Types.ObjectId(req.user.organizationId);
        const orgFilterMongoose = {
            organizationId: req.user.organizationId,
            $or: [{ key: keyLower }, { moduleKey: keyLower }]
        };

        const existingMod = await ModuleDefinition.findOne(orgFilterMongoose).select('+fields').lean();
        const baseFields = getBaseFieldsForKey(keyLower);
        let fields = Array.isArray(existingMod?.fields) && existingMod.fields.length > 0
            ? JSON.parse(JSON.stringify(existingMod.fields))
            : JSON.parse(JSON.stringify(baseFields));

        const fieldIdx = fields.findIndex((f) => String(f?.key || '').toLowerCase() === fieldKey.toLowerCase());
        if (fieldIdx < 0) {
            return res.status(404).json({ success: false, message: 'Field not found' });
        }

        const field = fields[fieldIdx];
        if (!canAddPicklistOptionInline(keyLower, field)) {
            return res.status(403).json({
                success: false,
                message: 'This picklist does not allow inline option creation',
                code: 'PICKLIST_OPTION_CREATE_NOT_ALLOWED',
            });
        }

        const optionEntry = buildPicklistOptionEntry(rawValue, fieldKey, keyLower, {
            label: req.body?.label,
            color: req.body?.color,
            existingOptions: field.options,
        });
        if (!optionEntry) {
            return res.status(400).json({ success: false, message: 'Invalid picklist option value' });
        }
        if (optionExists(field.options, optionEntry.value)) {
            return res.json({ success: true, data: optionEntry, message: 'Option already exists' });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const optionsBefore = cloneForAudit(Array.isArray(field.options) ? field.options : []);

        fields[fieldIdx] = {
            ...field,
            options: [...(Array.isArray(field.options) ? field.options : []), optionEntry],
        };

        const db = mongoose.connection.db;
        const collection = db.collection('moduledefinitions');
        await collection.updateOne(
            orgFilterMongoose,
            {
                $set: {
                    fields,
                    organizationId: orgObjectId,
                    key: keyLower,
                    moduleKey: keyLower,
                    type: 'system',
                    label: keyLower.charAt(0).toUpperCase() + keyLower.slice(1),
                    pluralLabel: `${keyLower.charAt(0).toUpperCase()}${keyLower.slice(1)}s`,
                    entityType: 'CORE',
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        attachSettingsAuditDiff(
            res,
            { fields: { [field.key || fieldKey]: { options: optionsBefore } } },
            {
                fields: {
                    [field.key || fieldKey]: {
                        options: fields[fieldIdx].options
                    }
                }
            },
            { keys: ['fields'] }
        );

        return res.status(201).json({ success: true, data: optionEntry });
    } catch (error) {
        console.error('addModuleFieldPicklistOption error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add picklist option',
            error: error.message,
        });
    }
};

/** Used by dealController to assign default pipeline/stage when creating a deal without them. */
exports.getDefaultPipelineSettings = getDefaultPipelineSettings;
exports.getBaseFieldsForKey = getBaseFieldsForKey;
exports.getPeopleVirtualBaseFields = getPeopleVirtualBaseFields;
exports.getOrganizationVirtualBaseFields = getOrganizationVirtualBaseFields;
