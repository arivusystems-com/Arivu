import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldIntent,
  BaseFieldScope,
  BaseFilterType,
} from './BaseFieldModel';
import {
  validateBaseFieldMetadata,
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

export type CaseFieldOwner = BaseFieldOwner;
export type CaseFieldIntent = BaseFieldIntent;
export type CaseFieldScope = BaseFieldScope;
export type CaseFilterType = BaseFilterType;

export type CaseFieldMetadata = BaseFieldMetadata;

export const CASE_FIELD_METADATA: Record<string, CaseFieldMetadata> = {
  // System and audit fields
  organizationId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isProtected: true, isSystem: true, isVisibleInConfig: false },
  createdBy: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: true },
  updatedBy: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: true },
  createdAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: true },
  updatedAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: true },
  _id: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  __v: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  deletedAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  deletedBy: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  deletionReason: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  currentSlaCycle: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  slaCycles: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  activities: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  assignmentControl: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  source: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  caseId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isProtected: true, isSystem: true, isVisibleInConfig: true, filterable: true, filterType: 'text' },

  // Core case fields
  title: { owner: 'core', intent: 'primary', fieldScope: 'CORE', editable: true, allowOnCreate: true, isProtected: true, filterable: true, filterType: 'text' },
  description: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true },
  caseType: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, isProtected: true, filterable: true, filterType: 'select' },
  priority: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, isProtected: true, filterable: true, filterType: 'select' },
  status: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, isProtected: true, filterable: true, filterType: 'select' },
  severity: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  impact: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  tags: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'text' },
  contactId: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'entity' },
  organizationRefId: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'entity' },
  requesterEmail: { owner: 'core', intent: 'identity', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'text' },
  requesterPhone: { owner: 'core', intent: 'identity', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'text' },
  preferredLanguage: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  customerTier: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  vipCustomer: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'boolean' },
  assignedTo: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, isProtected: true, filterable: true, filterType: 'user' },
  team: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'text' },
  queue: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'text' },
  escalationLevel: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  watchers: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'user' },
  channel: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: true, filterable: true, filterType: 'select' },
  relatedItemIds: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'entity' },
  serialNumber: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'text' },
  warrantyStatus: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  amcStatus: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  productVersion: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false },
  environment: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  caseNotes: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false },
  resolutionSummary: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false },
  rootCause: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  resolutionCode: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  closureNotes: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false },
  customerConfirmation: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'boolean' },
  preferredReplyChannel: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  ccEmails: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false },
  siteVisitRequired: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'boolean' },
  technicianId: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'user' },
  visitDate: { owner: 'core', intent: 'scheduling', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'date' },
  visitStatus: { owner: 'core', intent: 'state', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'select' },
  replacementRequired: { owner: 'core', intent: 'detail', fieldScope: 'CORE', editable: true, allowOnCreate: false, filterable: true, filterType: 'boolean' },

  // Server-managed / AI / portal — never show in create or edit drawers
  customFields: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  conversationCount: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'number' },
  mergeParentCaseId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  duplicateFlag: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'boolean' },
  sourceMessageId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  threadId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  sentiment: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  aiSummary: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  suggestedResolution: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  categoryConfidenceScore: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'number' },
  autoClassification: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'boolean' },
  portalReadReceipts: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  portalCsat: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  slaPolicyKey: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  firstResponseDueAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: true, filterable: false, filterType: 'date' },
  resolutionDueAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'date' },
  slaStatus: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  slaBreached: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'boolean' },
  businessHoursCalendarId: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  lastSlaEventAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'date' },
  lastCustomerReplyAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'date' },
  lastAgentReplyAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'date' },
  resolvedBy: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false },
  resolvedAt: { owner: 'system', intent: 'system', fieldScope: 'CORE', editable: false, isSystem: true, isVisibleInConfig: false, filterable: false, filterType: 'date' },
  reopenCount: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    filterable: false,
    filterType: 'number',
  },
  reopenReason: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    filterable: true,
    filterType: 'text',
  },
  responseMetAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    filterable: false,
  },
};

function validateAllCaseMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(CASE_FIELD_METADATA)) {
    validateBaseFieldMetadata(fieldName, metadata);
  }
}

validateAllCaseMetadata();

export function getCaseFieldMetadata(fieldName: string): CaseFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  if (CASE_FIELD_METADATA[fieldName]) return CASE_FIELD_METADATA[fieldName];

  for (const [key, metadata] of Object.entries(CASE_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) return metadata;
  }
  return undefined;
}

export function isCaseCoreField(fieldName: string): boolean {
  return getCaseFieldMetadata(fieldName)?.owner === 'core';
}

export function isCaseProtectedField(fieldName: string): boolean {
  return getCaseFieldMetadata(fieldName)?.isProtected === true;
}

export function getCoreCaseFields(): string[] {
  return Object.entries(CASE_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

export function getCaseSystemFields(): string[] {
  return Object.entries(CASE_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

/** Must match server `MUTABLE_CASE_FIELDS` in caseController.js */
export const MUTABLE_CASE_FIELD_KEYS = [
  'title',
  'description',
  'caseType',
  'priority',
  'severity',
  'impact',
  'tags',
  'contactId',
  'organizationRefId',
  'requesterEmail',
  'requesterPhone',
  'preferredLanguage',
  'customerTier',
  'vipCustomer',
  'assignedTo',
  'team',
  'queue',
  'escalationLevel',
  'watchers',
  'channel',
  'relatedItemIds',
  'serialNumber',
  'warrantyStatus',
  'amcStatus',
  'productVersion',
  'environment',
  'caseNotes',
  'resolutionSummary',
  'rootCause',
  'resolutionCode',
  'closureNotes',
  'customerConfirmation',
  'preferredReplyChannel',
  'ccEmails',
  'siteVisitRequired',
  'technicianId',
  'visitDate',
  'visitStatus',
  'replacementRequired'
] as const;

/** Top-level case keys that must not be sent on PUT (server-managed / SLA / audit). */
export const CASE_READONLY_RECORD_KEYS = [
  ...getCaseSystemFields(),
] as const;

const mutableCaseFieldSet = new Set<string>(MUTABLE_CASE_FIELD_KEYS);
const readonlyCaseRecordSet = new Set<string>(CASE_READONLY_RECORD_KEYS);

export function getMutableCaseFields(): readonly string[] {
  return MUTABLE_CASE_FIELD_KEYS;
}

/** Whether a PUT/PATCH body key is allowed when editing a case (mutable or custom field). */
export function isAllowedCaseEditPayloadKey(key: string): boolean {
  const k = String(key || '').trim();
  if (!k || k.includes('.')) return false;
  if (mutableCaseFieldSet.has(k)) return true;
  if (readonlyCaseRecordSet.has(k)) return false;
  if (k === 'status' || k === '_id' || k === '__v') return false;
  return true;
}

/** Normalize populated refs / dates for edit-form compare and API payloads. */
export function normalizeCaseFieldValue(value: unknown): unknown {
  if (value == null || value === '') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCaseFieldValue(item));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj._id != null && obj._id !== '') return obj._id;
  }
  return value;
}

/** Seed edit drawer / compare payloads without SLA blobs that cause 400 on save. */
export function stripCaseRecordForEditForm(record: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'customFields' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [ck, cv] of Object.entries(value as Record<string, unknown>)) {
        if (isAllowedCaseEditPayloadKey(ck)) out[ck] = normalizeCaseFieldValue(cv);
      }
      continue;
    }
    if (key === 'status' || isAllowedCaseEditPayloadKey(key)) {
      out[key] = normalizeCaseFieldValue(value);
    }
  }
  return out;
}

/** Keep only keys the helpdesk case update API accepts. */
export function filterCaseEditSubmitPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (isAllowedCaseEditPayloadKey(key)) out[key] = value;
  }
  return out;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Array.isArray(a) || Array.isArray(b) || (typeof a === 'object' && a) || (typeof b === 'object' && b)) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return String(a) === String(b);
}

/** PUT body for case edit: mutable/custom keys that differ from the loaded record. */
export function buildCaseEditSubmitPayload(
  formData: Record<string, unknown> | null | undefined,
  record: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const baseline = stripCaseRecordForEditForm(record);
  const allowed = filterCaseEditSubmitPayload(formData || {});
  const delta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(allowed)) {
    if (key === 'status') continue;
    const normalized = normalizeCaseFieldValue(value);
    if (!valuesEqual(baseline[key], normalized)) {
      delta[key] = normalized;
    }
  }
  return delta;
}

export function getCaseParticipationFields(appKey: string): string[] {
  return Object.entries(CASE_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'participation' && metadata.fieldScope === appKey)
    .map(([fieldName]) => fieldName);
}

/**
 * Fields shown in New Case quick create on a fresh instance.
 * Keep aligned with INITIAL_CASES_QUICK_CREATE in server/constants/casesModuleDefaults.js.
 */
export const CASE_QUICK_CREATE_DEFAULT = [
  'title',
  'contactId',
  'organizationRefId',
  'caseType',
  'priority',
  'status',
  'assignedTo',
] as const;

export function getCaseQuickCreateFields(): string[] {
  return Object.entries(CASE_FIELD_METADATA)
    .filter(([_, metadata]) =>
      metadata.allowOnCreate === true ||
      (metadata.owner === 'core' && metadata.intent === 'primary')
    )
    .map(([fieldName]) => fieldName);
}

export function classifyCaseField(fieldName: string): string {
  const metadata = getCaseFieldMetadata(fieldName);
  return classifyFieldBase(metadata as BaseFieldMetadata | undefined);
}

export function groupCaseFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];

  for (const fieldKey of fieldKeys) {
    const classification = classifyCaseField(fieldKey);
    if (classification === 'core') {
      coreIdentity.push(fieldKey);
      continue;
    }
    if (classification === 'system') {
      system.push(fieldKey);
      continue;
    }
    if (!participation[classification]) participation[classification] = [];
    participation[classification].push(fieldKey);
  }

  return { coreIdentity, participation, system };
}
