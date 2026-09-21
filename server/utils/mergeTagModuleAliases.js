'use strict';

/** Keep aligned with client/src/utils/templateMergeTagSchema.js MODULE_MERGE_ALIASES */
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

function capitalizeModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return 'Record';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolveMergeTagModuleAlias(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (MODULE_MERGE_ALIASES[key]) return MODULE_MERGE_ALIASES[key];
  return capitalizeModuleAlias(key);
}

module.exports = {
  MODULE_MERGE_ALIASES,
  capitalizeModuleAlias,
  resolveMergeTagModuleAlias
};
