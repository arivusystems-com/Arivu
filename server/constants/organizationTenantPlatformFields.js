/**
 * Tenant/workspace infrastructure fields on Organization documents.
 * CRM business org module definitions and create/edit flows must exclude these.
 *
 * Keep aligned with ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS in
 * client/src/platform/fields/organizationFieldModel.ts
 */

const ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS = Object.freeze([
  'isTenant',
  'slug',
  'subscription',
  'limits',
  'usage',
  'enabledApps',
  'enabledModules',
  'moduleOverrides',
  'aiSettings',
  'crmInitialized',
  'settings',
  'onboarding',
  'embed',
  'contentPublishing',
  'dataRegion',
  'security',
  'integrations',
  'database',
  'billing',
  'activityLogs',
  'legacyOrganizationId',
  'descriptionVersions',
  'emailMergeTagMappings',
  'emailExternalCssAllowlist',
  // Deferred CRM party fields (GST / external sync) — hide until product ships them on org forms
  'gstin',
  'gstRegistrationType',
  'gstRegistered',
  'gstCertificateUrl',
  'gstCertificateFileName',
  'companyName',
  'billingEmail',
  'billingPhone',
  'stateCode',
  'billingAddressStructured',
  'externalReferenceId',
  'syncStatus',
  'lastSyncAt',
]);

function normalizeFieldKeyForMetadataLookup(key) {
  return String(key || '').toLowerCase().replace(/[\s_-]/g, '');
}

const ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM = ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS.map((key) =>
  normalizeFieldKeyForMetadataLookup(key)
);

function isTenantPlatformOrganizationFieldPath(fieldPath) {
  const normalized = normalizeFieldKeyForMetadataLookup(fieldPath);
  for (const root of ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM) {
    if (normalized === root) return true;
    if (normalized.startsWith(`${root}.`)) return true;
    if (normalized.startsWith(`${root}[`)) return true;
  }
  return false;
}

module.exports = {
  ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS,
  isTenantPlatformOrganizationFieldPath,
};
