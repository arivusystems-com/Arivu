const TENANT_PICKLIST_OPTION_SOURCE_FIELDS: Record<string, Set<string>> = {
  tasks: new Set(['status', 'priority']),
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
  ]),
};

const BLOCKED_INLINE_PICKLIST_KEYS: Record<string, Set<string>> = {
  deals: new Set(['stage', 'pipeline']),
  people: new Set(['salestype', 'sales_type', 'helpdeskrole', 'helpdesk_role']),
  events: new Set(['status', 'eventtype']),
};

type PicklistFieldShape = {
  key?: string;
  dataType?: string;
  owner?: string;
};

type PermissionUserShape = {
  isOwner?: boolean;
  role?: string | null;
  permissions?: {
    settings?: {
      customizeFields?: boolean;
      edit?: boolean;
    };
  };
};

function normalizeFieldKeyForMatch(key: string | null | undefined): string {
  return String(key || '').trim().toLowerCase().replace(/[-_]/g, '');
}

function isTenantManagedPicklist(moduleKey: string, fieldKey: string | null | undefined): boolean {
  const mod = String(moduleKey || '').toLowerCase();
  const fields = TENANT_PICKLIST_OPTION_SOURCE_FIELDS[mod];
  if (!fields) return false;
  const normalized = normalizeFieldKeyForMatch(fieldKey);
  for (const candidate of fields) {
    if (normalizeFieldKeyForMatch(candidate) === normalized) return true;
  }
  return false;
}

function isBlockedInlinePicklist(moduleKey: string, fieldKey: string | null | undefined): boolean {
  const mod = String(moduleKey || '').toLowerCase();
  const blocked = BLOCKED_INLINE_PICKLIST_KEYS[mod];
  if (!blocked) return false;
  const normalized = normalizeFieldKeyForMatch(fieldKey);
  for (const candidate of blocked) {
    if (normalizeFieldKeyForMatch(candidate) === normalized) return true;
  }
  return false;
}

export function isPicklistFieldEligibleForInlineOptionCreate(
  moduleKey: string,
  field: PicklistFieldShape | null | undefined
): boolean {
  if (!field) return false;
  const dataType = String(field.dataType || '');
  if (dataType !== 'Picklist' && dataType !== 'Multi-Picklist') return false;
  if (isBlockedInlinePicklist(moduleKey, field.key)) return false;
  if (String(field.owner || '').toLowerCase() === 'org') return true;
  return isTenantManagedPicklist(moduleKey, field.key);
}

export function canCustomizePicklistOptions(user: PermissionUserShape | null | undefined): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  const settings = user.permissions?.settings || {};
  return Boolean(settings.customizeFields || settings.edit);
}

export function canCreatePicklistOptionInline(
  moduleKey: string,
  field: PicklistFieldShape | null | undefined,
  user: PermissionUserShape | null | undefined
): boolean {
  if (!canCustomizePicklistOptions(user)) return false;
  return isPicklistFieldEligibleForInlineOptionCreate(moduleKey, field);
}

export function normalizeNewPicklistOptionValue(
  rawValue: string,
  fieldKey: string,
  moduleKey: string
): string | null {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return null;

  const mod = String(moduleKey || '').toLowerCase();
  const keyNorm = normalizeFieldKeyForMatch(fieldKey);
  const isTaskLifecycle = mod === 'tasks' && (keyNorm === 'status' || keyNorm === 'priority');

  if (isTaskLifecycle) {
    const slug = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return slug || null;
  }

  return trimmed;
}

export function getPicklistOptionComparableValue(option: unknown): string {
  if (option == null) return '';
  if (typeof option === 'string') return option.trim();
  if (typeof option === 'object') {
    const record = option as { value?: string; key?: string; label?: string };
    return String(record.value ?? record.key ?? record.label ?? '').trim();
  }
  return String(option).trim();
}

export function appendCreatedPicklistOption(
  field: { options?: unknown } | null | undefined,
  option: { value?: string } | null | undefined
): void {
  if (!field || !option?.value) return;
  const options = field.options;
  if (Array.isArray(options)) {
    if (!picklistOptionExists(options, option.value)) options.push(option);
    return;
  }
  field.options = [option];
}

export function picklistOptionExists(options: unknown[] | null | undefined, value: string): boolean {
  const target = String(value || '').trim().toLowerCase();
  if (!target) return false;
  return (Array.isArray(options) ? options : []).some((opt) => {
    return getPicklistOptionComparableValue(opt).toLowerCase() === target;
  });
}
