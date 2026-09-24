/**
 * Client mirror of server closed-records module groups (for settings UI filtering).
 */
export const APP_MODULE_GROUPS_CLIENT = {
  all: null,
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
};

/** Flat set of module keys that support Closed Records / Closed States tab. */
export const CLOSED_RECORDS_ELIGIBLE_MODULE_KEYS = new Set([
  ...APP_MODULE_GROUPS_CLIENT.sales,
  ...APP_MODULE_GROUPS_CLIENT.helpdesk,
  ...APP_MODULE_GROUPS_CLIENT.core,
  ...APP_MODULE_GROUPS_CLIENT.inventory
]);

export function isClosedRecordsEligibleModule(moduleKey) {
  return CLOSED_RECORDS_ELIGIBLE_MODULE_KEYS.has(
    String(moduleKey || '')
      .trim()
      .toLowerCase()
  );
}
