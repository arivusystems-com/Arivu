import { fetchModulesListCached } from '@/utils/tenantSchemaApiCache';

const EXCLUDED_FIELD_KEYS = new Set([
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid',
  'organizationid',
  'publicsharetoken',
  'customfields',
  '_id',
  '__v',
  'deletedat',
  'deletedby',
  'deletionreason'
]);

const LINE_ITEM_FIELDS = [
  { key: 'description', label: 'description' },
  { key: 'name', label: 'name' },
  { key: 'quantity', label: 'quantity' },
  { key: 'unitPrice', label: 'unitPrice' },
  { key: 'lineTotal', label: 'lineTotal' },
  { key: 'lineSubtotal', label: 'lineSubtotal' }
];

const LINE_COLLECTION_MODULES = new Set(['quotes', 'invoices', 'billing_invoices', 'sales_orders']);

/** Runtime scope aliases — keep aligned with dataProviderEngine. */
const MODULE_MERGE_ALIASES = {
  quotes: 'Quote',
  invoices: 'Invoice',
  billing_invoices: 'Invoice',
  sales_orders: 'SalesOrder',
  people: 'People',
  organizations: 'Organization',
  deals: 'Deal',
  cases: 'Case',
  tasks: 'Task',
  items: 'Item'
};

const COMMERCIAL_MODULE_KEYS = new Set(['quotes', 'invoices', 'billing_invoices', 'sales_orders']);

const CURRENT_USER_FIELDS = [
  { key: 'email', label: 'email' },
  { key: 'firstName', label: 'firstName' },
  { key: 'lastName', label: 'lastName' },
  { key: 'username', label: 'username' }
];

const YOUR_COMPANY_FIELDS = [
  { key: 'name', label: 'name' },
  { key: 'logoUrl', label: 'logoUrl' },
  { key: 'address', label: 'address' },
  { key: 'city', label: 'city' },
  { key: 'state', label: 'state' },
  { key: 'phone', label: 'phone' },
  { key: 'email', label: 'email' },
  { key: 'website', label: 'website' }
];

/** Platform SaaS BillingInvoice merge fields (not a tenant module definition). */
const BILLING_INVOICE_FIELDS = [
  { key: 'invoiceNumber', label: 'invoiceNumber' },
  { key: 'status', label: 'status' },
  { key: 'customerName', label: 'customerName' },
  { key: 'customerGstin', label: 'customerGstin' },
  { key: 'customerAttn', label: 'customerAttn' },
  { key: 'customerAddress', label: 'customerAddress' },
  { key: 'invoiceDateLabel', label: 'invoiceDateLabel' },
  { key: 'dueDateLabel', label: 'dueDateLabel' },
  { key: 'dueDate', label: 'dueDate' },
  { key: 'periodLabel', label: 'periodLabel' },
  { key: 'subtotal', label: 'subtotal' },
  { key: 'taxTotal', label: 'taxTotal' },
  { key: 'taxLabel', label: 'taxLabel' },
  { key: 'cgstLabel', label: 'cgstLabel' },
  { key: 'sgstLabel', label: 'sgstLabel' },
  { key: 'cgstAmount', label: 'cgstAmount' },
  { key: 'sgstAmount', label: 'sgstAmount' },
  { key: 'grandTotal', label: 'grandTotal' },
  { key: 'amountDue', label: 'amountDue' },
  { key: 'amountInWords', label: 'amountInWords' },
  { key: 'currency', label: 'currency' }
];

const SELLER_FIELDS = [
  { key: 'legalName', label: 'legalName' },
  { key: 'gstin', label: 'gstin' },
  { key: 'pan', label: 'pan' },
  { key: 'address', label: 'address' },
  { key: 'email', label: 'email' },
  { key: 'phone', label: 'phone' },
  { key: 'tagline', label: 'tagline' },
  { key: 'website', label: 'website' },
  { key: 'paymentTerms', label: 'paymentTerms' },
  { key: 'paymentInstructions', label: 'paymentInstructions' },
  { key: 'bankName', label: 'bankName' },
  { key: 'accountName', label: 'accountName' },
  { key: 'accountNumber', label: 'accountNumber' },
  { key: 'ifsc', label: 'ifsc' },
  { key: 'upiId', label: 'upiId' },
  { key: 'bankDetails', label: 'bankDetails' }
];

/**
 * @param {string} moduleKey
 * @returns {string}
 */
export function resolveMergeTagModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (MODULE_MERGE_ALIASES[key]) return MODULE_MERGE_ALIASES[key];
  return capitalizeModuleAlias(moduleKey);
}

/**
 * @param {string} moduleKey
 * @returns {string}
 */
export function capitalizeModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return 'Record';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Resolve module key (e.g. people) from a merge path alias (e.g. People.firstName).
 * @param {string} path
 * @returns {string}
 */
export function resolveMergeTagModuleKeyFromPath(path) {
  const alias = String(path || '').split('.')[0]?.trim();
  if (!alias) return '';

  for (const [moduleKey, moduleAlias] of Object.entries(MODULE_MERGE_ALIASES)) {
    if (moduleAlias === alias) return moduleKey;
  }

  return alias
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * @param {import('vue-i18n').Composer['t']} t
 * @param {import('vue-i18n').Composer['te']} te
 * @param {(moduleKey: string) => string | undefined} getModuleLabelKey
 */
export function resolveModuleOptionLabel(t, te, getModuleLabelKey, module) {
  const key = String(module?.key || module?.moduleKey || '').toLowerCase();
  const labelKey = getModuleLabelKey(key);
  if (labelKey && te(labelKey)) return t(labelKey);
  return module?.name || module?.label || key;
}

/**
 * @param {string} key
 * @returns {string}
 */
export function humanizeFieldKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {object} field
 * @param {string} moduleKey
 */
export function isMergeTagEligibleField(field, moduleKey) {
  const key = String(field?.key || '').trim();
  if (!key) return false;
  if (EXCLUDED_FIELD_KEYS.has(key.toLowerCase())) return false;
  if (field?.type === 'participation') return false;
  if (moduleKey === 'users' && !key) return false;
  return true;
}

/**
 * @param {object} moduleDef
 * @param {string} moduleKey
 */
function collectRelatedModuleKeys(moduleDef, moduleKey) {
  const keys = new Set();
  const normalizedScope = String(moduleKey || '').toLowerCase();

  for (const rel of moduleDef?.relationships || []) {
    const target = String(rel?.targetModuleKey || rel?.targetModule || '').toLowerCase();
    if (target && target !== normalizedScope) keys.add(target);
  }

  for (const field of moduleDef?.fields || []) {
    const lookupTarget = field?.lookupModule || field?.targetModule || field?.ref;
    const target = String(lookupTarget || '').toLowerCase();
    if (target && target !== normalizedScope) keys.add(target);
  }

  return [...keys];
}

/**
 * @param {string} moduleKey
 * @returns {Promise<object|null>}
 */
export async function fetchModuleDefinition(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key) return null;

  const response = await fetchModulesListCached(
    { key, context: 'all', purpose: 'merge-tags' },
    { cache: 'no-store' }
  );

  const rows = Array.isArray(response?.data) ? response.data : [];
  return rows.find((row) => String(row?.key || row?.moduleKey || '').toLowerCase() === key) || rows[0] || null;
}

/**
 * @returns {Promise<Array<{ key: string, name: string, label: string, enabled: boolean }>>}
 */
export async function fetchAllModuleOptions(t, te, getModuleLabelKey) {
  const response = await fetchModulesListCached({ context: 'all' });
  const rows = Array.isArray(response?.data) ? response.data : [];

  return rows
    .filter((row) => row?.key || row?.moduleKey)
    .map((row) => {
      const key = String(row.key || row.moduleKey).toLowerCase();
      return {
        key,
        name: row.name || key,
        label: resolveModuleOptionLabel(t, te, getModuleLabelKey, row),
        enabled: row.enabled !== false
      };
    })
    .filter((row) => row.enabled)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function resolveFieldLabel(field) {
  return field.label || field.displayName || field.name || humanizeFieldKey(field.key);
}

function buildFieldNodes(moduleKey, fields, pathPrefix = null) {
  const alias = pathPrefix || resolveMergeTagModuleAlias(moduleKey);
  return fields.map((field) => ({
    id: `${moduleKey}-${field.key}`,
    path: `${alias}.${field.key}`,
    label: resolveFieldLabel(field),
    moduleKey
  }));
}

function buildStaticFieldNodes(prefix, fields, moduleKey) {
  return fields.map((field) => ({
    id: `${moduleKey}-${field.key}`,
    path: `${prefix}.${field.key}`,
    label: field.label || field.key,
    moduleKey
  }));
}

async function buildOrganizationFieldNodes(pathPrefix, moduleKey = 'organizations') {
  const definition = await fetchModuleDefinition(moduleKey);
  const fields = (definition?.fields || []).filter((field) =>
    isMergeTagEligibleField(field, moduleKey)
  );
  return buildFieldNodes(moduleKey, fields, pathPrefix);
}

function resolveRelationshipLabel(primaryModule, relatedKey, fallbackDefinition) {
  const relationship = (primaryModule?.relationships || []).find((rel) => {
    const target = String(rel?.targetModuleKey || rel?.targetModule || '').toLowerCase();
    return target === relatedKey;
  });
  return relationship?.label || relationship?.name || fallbackDefinition?.name || capitalizeModuleAlias(relatedKey);
}

function buildLineItemsGroup(moduleKey) {
  return {
    id: `lines-${moduleKey}`,
    moduleKey: 'lines',
    labelKey: 'templates.builderMergeGroupLines',
    children: LINE_ITEM_FIELDS.map((field) => ({
      id: `line-${moduleKey}-${field.key}`,
      path: `line.${field.key}`,
      label: field.label
    }))
  };
}

/**
 * @param {string} moduleScope
 * @returns {Promise<Array<object>>}
 */
export async function buildMergeTagTreeGroups(moduleScope) {
  const systemGroup = {
    id: 'system',
    moduleKey: 'system',
    labelKey: 'templates.builderMergeGroupSystem',
    children: [
      { id: 'system-today', path: 'System.Today', label: 'Today' },
      { id: 'system-now', path: 'System.Now', label: 'Now' },
      { id: 'system-pages', path: 'System.PageCount', label: 'PageCount' }
    ]
  };

  const yourCompanyGroup = {
    id: 'your-company',
    moduleKey: 'your-company',
    labelKey: 'templates.builderMergeGroupYourCompany',
    children: [
      ...buildStaticFieldNodes('CurrentOrganization', YOUR_COMPANY_FIELDS, 'your-company'),
      ...(await buildOrganizationFieldNodes('CurrentOrganization')).filter(
        (node) => !YOUR_COMPANY_FIELDS.some((field) => node.path === `CurrentOrganization.${field.key}`)
      )
    ]
  };

  const currentUserGroup = {
    id: 'current-user',
    moduleKey: 'current-user',
    labelKey: 'templates.builderMergeGroupCurrentUser',
    children: buildStaticFieldNodes('CurrentUser', CURRENT_USER_FIELDS, 'current-user')
  };

  const groups = [systemGroup, yourCompanyGroup, currentUserGroup];
  const moduleKey = String(moduleScope || '').trim().toLowerCase();
  if (!moduleKey) return groups;

  if (moduleKey === 'billing_invoices') {
    groups.push({
      id: 'billing-invoice',
      moduleKey: 'billing_invoices',
      label: 'Invoice',
      children: buildStaticFieldNodes('Invoice', BILLING_INVOICE_FIELDS, 'billing-invoice')
    });
    groups.push({
      id: 'seller',
      moduleKey: 'seller',
      label: 'Seller',
      children: buildStaticFieldNodes('Seller', SELLER_FIELDS, 'seller')
    });
    groups.push(buildLineItemsGroup('billing_invoices'));
    return groups;
  }

  const primaryModule = await fetchModuleDefinition(moduleKey);
  if (!primaryModule) return groups;

  const primaryFields = (primaryModule.fields || []).filter((field) =>
    isMergeTagEligibleField(field, moduleKey)
  );

  if (primaryFields.length) {
    groups.push({
      id: `module-${moduleKey}`,
      moduleKey,
      label: primaryModule.name || capitalizeModuleAlias(moduleKey),
      children: buildFieldNodes(moduleKey, primaryFields)
    });
  }

  const relatedKeys = collectRelatedModuleKeys(primaryModule, moduleKey);
  const relatedDefinitions = await Promise.all(
    relatedKeys.map(async (relatedKey) => ({
      relatedKey,
      definition: await fetchModuleDefinition(relatedKey)
    }))
  );

  const includesCustomerOrganization =
    relatedKeys.includes('organizations') || COMMERCIAL_MODULE_KEYS.has(moduleKey);

  if (includesCustomerOrganization) {
    groups.push({
      id: 'customer-organization',
      moduleKey: 'customer-organization',
      labelKey: 'templates.builderMergeGroupCustomerOrganization',
      children: await buildOrganizationFieldNodes('Organization')
    });
  }

  for (const { relatedKey, definition } of relatedDefinitions) {
    if (!definition) continue;
    if (relatedKey === 'organizations' && includesCustomerOrganization) continue;

    const relatedFields = (definition.fields || []).filter((field) =>
      isMergeTagEligibleField(field, relatedKey)
    );
    if (!relatedFields.length) continue;

    const relationshipLabel = resolveRelationshipLabel(primaryModule, relatedKey, definition);
    const labelKey =
      relatedKey === 'people' ? 'templates.builderMergeGroupRelatedContact' : undefined;

    groups.push({
      id: `related-${moduleKey}-${relatedKey}`,
      moduleKey: relatedKey,
      label: labelKey ? undefined : relationshipLabel,
      labelKey,
      children: buildFieldNodes(relatedKey, relatedFields)
    });
  }

  if (LINE_COLLECTION_MODULES.has(moduleKey)) {
    groups.push(buildLineItemsGroup(moduleKey));
  }

  return groups;
}

/**
 * @param {Array<object>} nodes
 * @param {import('vue-i18n').Composer['t']} t
 * @returns {Array<{ id: string, label: string, moduleKey: string, fields: Array<object> }>}
 */
export function flattenMergeTagTreeGroups(nodes, t) {
  const groups = [];

  for (const node of nodes || []) {
    if (!Array.isArray(node.children) || !node.children.length) continue;

    const leafFields = node.children.filter((child) => child.path && !child.children?.length);
    const nestedGroups = node.children.filter((child) => child.children?.length);
    const groupLabel = node.labelKey ? t(node.labelKey) : (node.label || '');

    if (leafFields.length) {
      groups.push({
        id: node.id,
        label: groupLabel,
        moduleKey: String(node.moduleKey || '').toLowerCase(),
        fields: leafFields.map((field) => {
          const label = field.label || field.path;
          const path = field.path || '';
          const key = String(field.key || path.split('.').pop() || '');
          const searchText = `${groupLabel} ${label} ${path} ${humanizeFieldKey(key)}`.toLowerCase();
          return {
            ...field,
            groupId: node.id,
            groupLabel,
            searchText
          };
        })
      });
    }

    groups.push(...flattenMergeTagTreeGroups(nestedGroups, t));
  }

  return groups;
}
