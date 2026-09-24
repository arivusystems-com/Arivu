/**
 * Custom Fields Extractor
 *
 * Extracts custom field values from update payloads and routes them into the
 * model's customFields bucket. Used when saving records so user-defined custom
 * fields (from Settings → Modules & Fields) are persisted correctly.
 *
 * Mongoose ignores keys not in the schema by default. Custom field values
 * must be placed in the customFields Mixed field to be stored.
 */

/**
 * Keys that should never be treated as custom fields (system/metadata)
 */
const RESERVED_KEYS = new Set([
  '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy',
  'modifiedBy', 'createdTime', 'modifiedTime',
  'deletedAt', 'deletedBy', 'deletionReason',
  'lifecycleState', 'closedAt', 'reopenedAt',
  'mergedInto', 'mergedAt', 'mergedBy',
  'calendarSync',
  'source', // System-managed creation channel; set only via sourceResolver on the server
  'sendInvites', // request-scoped calendar invite preference (not a field)
  'notifyParticipants',
  'playbookState',
  'portalAccess',
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
  // Connector sync metadata — set by integrations only
  'externalReferenceId',
  'syncStatus',
  'lastSyncAt',
  // API response-only computed fields — never persist back into customFields
  'lastActivity',
  'lastActivityDate',
  'lastActivityAction'
]);

/**
 * Extract custom fields from an update payload and build a $set object that
 * routes them into customFields while leaving standard fields at top level.
 *
 * @param {Object} payload - The update payload (e.g. req.body)
 * @param {Object} model - Mongoose model (e.g. People, Task) - used to get schema paths
 * @returns {{ standardPayload: Object, customFieldsSet: Object }}
 *   - standardPayload: payload with custom field keys removed (for top-level $set)
 *   - customFieldsSet: object of custom field key-value pairs to merge into customFields
 */
function extractCustomFields(payload, model) {
  if (!payload || typeof payload !== 'object') {
    return { standardPayload: {}, customFieldsSet: {} };
  }

  const schemaPaths = new Set(Object.keys(model.schema.paths || {}));
  const standardPayload = {};
  const customFieldsSet = {};

  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_KEYS.has(key)) continue;

    const isSchemaPath = schemaPaths.has(key);
    if (isSchemaPath) {
      // Never assign the whole customFields object alongside customFields.* dots
      if (key === 'customFields' && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [cfKey, cfVal] of Object.entries(value)) {
          if (RESERVED_KEYS.has(cfKey)) continue;
          customFieldsSet[cfKey] = cfVal;
        }
        continue;
      }
      standardPayload[key] = value;
    } else {
      customFieldsSet[key] = value;
    }
  }

  return { standardPayload, customFieldsSet };
}

/**
 * Build the full $set object for findOneAndUpdate, merging custom fields
 * into customFields using dot notation. Dot notation merges without
 * overwriting other custom fields, so no need to fetch existing record.
 *
 * @param {Object} payload - The update payload
 * @param {Object} model - Mongoose model
 * @returns {Object} - The $set object for the update
 */
function buildUpdateWithCustomFields(payload, model) {
  const { standardPayload, customFieldsSet } = extractCustomFields(payload, model);

  const $set = { ...standardPayload };
  // Guard: never leave a whole `customFields` key in $set (conflicts with dots)
  if (Object.prototype.hasOwnProperty.call($set, 'customFields')) {
    delete $set.customFields;
  }

  for (const [key, value] of Object.entries(customFieldsSet)) {
    $set[`customFields.${key}`] = value;
  }

  return $set;
}

/**
 * Flatten customFields into the record for API responses, so the frontend
 * can access custom field values via record[fieldKey] like standard fields.
 *
 * @param {Object} record - Mongoose document or plain object
 * @returns {Object} - Record with customFields merged at top level
 */
function flattenCustomFieldsForResponse(record) {
  if (!record) return record;
  const obj = record.toObject ? record.toObject() : { ...record };
  // Merge custom fields first so schema-backed top-level fields always win.
  // This prevents stale customFields keys (e.g. customFields.tags) from
  // overriding canonical fields like `tags` in API responses.
  return { ...(obj.customFields || {}), ...obj };
}

module.exports = {
  extractCustomFields,
  buildUpdateWithCustomFields,
  flattenCustomFieldsForResponse,
  RESERVED_KEYS
};
