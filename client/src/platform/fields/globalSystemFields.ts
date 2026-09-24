/**
 * Global system field keys (trash, audit helpers, etc.) that are not always present in
 * per-module field metadata. Kept separate from fieldCapabilityEngine so field models
 * can import these helpers without creating FieldRegistry ↔ fieldCapabilityEngine cycles.
 */
import { normalizeFieldKeyForMetadataLookup } from './BaseFieldModel';

const GLOBAL_SYSTEM_FIELD_KEYS = new Set([
  'deletedat',
  'deletedby',
  'deletionreason',
  'lifecyclestate',
  'closedat',
  'reopenedat',
  // Duplicate merge — set by mergeService only; never create/edit UI
  'mergedinto',
  'mergedat',
  'mergedby',
  'source',
  'appointment',
  'calendarsync',
  'playbookstate',
  'portalaccess',
  'portalreadreceipts',
  'portalcsat',
  'personnumber',
  'organizationnumber',
  'dealnumber',
  'tasknumber',
  'eventnumber',
  'formnumber',
  'responsenumber',
  'recordnumber',
  'articlenumber',
  'blognumber',
  'segmentnumber',
  'templatenumber',
  // Connector sync metadata — set by integrations only; never create/edit UI
  'externalreferenceid',
  'syncstatus',
  'lastsyncat',
]);

/** @internal Used by fieldCapabilityEngine with pre-normalized keys. */
export function globalSystemFieldKeySetHas(normalizedKey: string): boolean {
  return GLOBAL_SYSTEM_FIELD_KEYS.has(normalizedKey);
}

export function getGlobalSystemFieldKeys(): string[] {
  return Array.from(GLOBAL_SYSTEM_FIELD_KEYS);
}

export function normalizeFieldKeyForSystemMatch(fieldKey: string): string {
  return normalizeFieldKeyForMetadataLookup(fieldKey);
}

export function isGlobalSystemFieldKey(fieldKey: string): boolean {
  return GLOBAL_SYSTEM_FIELD_KEYS.has(normalizeFieldKeyForMetadataLookup(fieldKey));
}
