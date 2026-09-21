/**
 * Resolve module list UI strings (titles, views, stats, columns, filters).
 */

import { MODULE_LABEL_KEYS } from '@/utils/navigationLabels';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { formatKeyToLabel } from '@/utils/fieldDisplay';
import { getTenantModuleLabelsByRoute, applyTenantModuleTermsToLabel } from '@/utils/registryModuleLabels';

/** @type {Record<string, string>} */
const MODULE_I18N_NS = {
  people: 'people',
  organizations: 'organizations',
  tasks: 'tasks',
  events: 'events',
  deals: 'deals',
  quotes: 'quotes',
  items: 'platform',
  documents: 'documents',
  campaigns: 'marketing',
  reports: 'analytics',
  widgets: 'analytics',
  dashboards: 'analytics',
};

/** @type {Record<string, Record<string, string>>} */
const SYSTEM_VIEW_KEYS = {
  people: {
    all: 'people.listViewAll',
    'assigned-to-me': 'people.listViewMy',
    sales: 'people.listViewSales',
    helpdesk: 'people.listViewHelpdesk',
  },
  organizations: {
    all: 'organizations.listViewAll',
    'assigned-to-me': 'organizations.listViewMy',
    unassigned: 'common.listStatUnassigned',
    active: 'organizations.listViewActive',
    trial: 'organizations.listViewTrial',
  },
  tasks: {
    all: 'tasks.listViewAll',
    'assigned-to-me': 'tasks.listViewMy',
  },
  events: {
    all: 'events.listViewAll',
    upcoming: 'events.listViewUpcoming',
    past: 'events.listViewPast',
    'my-events': 'events.listViewMy',
    appointments: 'events.listViewAppointments',
    'upcoming-appointments': 'events.listViewUpcomingAppointments',
  },
  deals: {
    all: 'deals.listViewAll',
    'my-deals': 'deals.listViewMy',
    open: 'deals.listViewOpen',
    won: 'deals.listViewWon',
    lost: 'deals.listViewLost',
  },
  quotes: {
    all: 'quotes.listViewAll',
    'my-quotes': 'quotes.listViewMy',
    draft: 'quotes.listViewDraft',
    'pending-approval': 'quotes.listViewPendingApproval',
    approved: 'quotes.listViewApproved',
    sent: 'quotes.listViewSent',
    accepted: 'quotes.listViewAccepted',
    converted: 'quotes.listViewConverted',
  },
  items: {
    all: 'platform.listViewAllItems',
    active: 'platform.listViewActiveItems',
    draft: 'platform.listViewDraftItems',
    discontinued: 'platform.listViewDiscontinuedItems',
    products: 'platform.listViewProducts',
    services: 'platform.listViewServices',
  },
  documents: {
    all: 'documents.listViewAll',
    'assigned-to-me': 'documents.listViewMy',
  },
  campaigns: {
    all: 'marketing.campaignsFilterAll',
    draft: 'marketing.campaignsStatusDraft',
    scheduled: 'marketing.campaignsStatusScheduled',
    running: 'marketing.campaignsStatusRunning',
    completed: 'marketing.campaignsStatusCompleted',
    failed: 'marketing.campaignsStatusFailed',
    archived: 'marketing.campaignsStatusArchived',
  },
  reports: {
    all: 'analytics.tabAll',
    mine: 'analytics.tabMine',
    shared: 'analytics.tabShared',
    scheduled: 'analytics.tabScheduled',
    draft: 'analytics.tabDrafts',
    published: 'analytics.tabPublished',
    archived: 'analytics.tabArchived',
  },
  widgets: {
    all: 'analytics.tabAll',
    draft: 'analytics.tabDrafts',
    published: 'analytics.tabPublished',
    archived: 'analytics.tabArchived',
  },
  dashboards: {
    all: 'analytics.tabAll',
    draft: 'analytics.tabDrafts',
    published: 'analytics.tabPublished',
    archived: 'analytics.tabArchived',
  },
};

/** @type {Record<string, string>} */
const SHARED_STAT_KEYS = {
  assignedToMe: 'common.listStatAssignedToMe',
  unassigned: 'common.listStatUnassigned',
  completed: 'common.listStatCompleted',
  overdue: 'common.listStatOverdue',
};

/** @type {Record<string, Record<string, string>>} */
const MODULE_STAT_KEYS = {
  people: {
    totalPeople: 'people.listStatTotal',
    myPeople: 'people.listViewMy',
    withOrganization: 'people.listStatWithOrganization',
    withoutOrganization: 'people.listStatWithoutOrganization',
  },
  organizations: {
    totalOrganizations: 'organizations.listStatTotal',
    myOrganizations: 'organizations.listViewMy',
    activeOrganizations: 'organizations.listStatActive',
    trialOrganizations: 'organizations.listStatTrial',
  },
  tasks: {
    totalTasks: 'tasks.listStatTotal',
    myTasks: 'tasks.listViewMy',
    open: 'tasks.listStatOpen',
    dueToday: 'tasks.listStatDueToday',
    overdue: 'common.listStatOverdue',
  },
  events: {
    totalEvents: 'events.listStatTotal',
    upcoming: 'events.listStatUpcoming',
    past: 'events.listStatPast',
    myEvents: 'events.listStatMy',
    today: 'events.listStatToday',
    thisWeek: 'events.listStatThisWeek',
  },
  deals: {
    pipelineValue: 'deals.listStatPipelineValue',
    activeDeals: 'deals.listStatOpenDeals',
    wonValue: 'deals.listStatWonThisMonth',
    winRate: 'deals.listStatWinRate',
  },
  quotes: {
    totalQuotes: 'quotes.listStatTotalQuotes',
    openValue: 'quotes.listStatOpenValue',
    openQuotes: 'quotes.listStatOpenQuotes',
    acceptedValue: 'quotes.listStatAcceptedValue',
    myQuotes: 'quotes.listStatMyQuotes',
  },
  sales_orders: {
    totalSalesOrders: 'quotes.listStatTotalOrders',
    mySalesOrders: 'quotes.listViewMyOrders',
    open: 'tasks.listStatOpen',
    inFulfillment: 'quotes.listStatInFulfillment',
    completed: 'common.listStatCompleted',
  },
  cases: {
    totalCases: 'cases.listStatTotal',
    myCases: 'cases.listStatMy',
    open: 'cases.listStatOpen',
    unassigned: 'common.listStatUnassigned',
    slaBreached: 'cases.listStatSlaBreached',
  },
  invoices: {
    totalInvoices: 'quotes.listStatTotalInvoices',
    myInvoices: 'quotes.listViewMyInvoices',
    draft: 'quotes.listViewDraft',
    pendingApproval: 'quotes.listViewPendingApproval',
    posted: 'quotes.listViewPosted',
  },
  items: {
    totalItems: 'platform.listStatTotalItems',
    activeItems: 'platform.listStatActiveItems',
    draftItems: 'platform.listStatDraftItems',
    discontinuedItems: 'platform.listStatDiscontinuedItems',
    products: 'platform.listStatProducts',
    services: 'platform.listStatServices',
  },
  campaigns: {
    totalCampaigns: 'marketing.campaignsListStatTotal',
    draft: 'marketing.campaignsStatusDraft',
    scheduled: 'marketing.campaignsStatusScheduled',
    running: 'marketing.campaignsStatusRunning',
    completed: 'marketing.campaignsStatusCompleted',
  },
  reports: {
    totalReports: 'analytics.listStatTotal',
    draft: 'analytics.statusDraft',
    published: 'analytics.statusPublished',
    archived: 'analytics.statusArchived',
  },
  widgets: {
    totalWidgets: 'analytics.widgetsListStatTotal',
    draft: 'analytics.statusDraft',
    published: 'analytics.statusPublished',
    archived: 'analytics.statusArchived',
  },
  dashboards: {
    totalDashboards: 'analytics.dashboardsListStatTotal',
    draft: 'analytics.statusDraft',
    published: 'analytics.statusPublished',
    archived: 'analytics.statusArchived',
  },
};

/** @type {Record<string, string>} */
const CREATE_LABEL_KEYS = {
  people: 'people.listCreate',
  organizations: 'organizations.listCreate',
  tasks: 'tasks.listCreate',
  events: 'events.listCreate',
  deals: 'deals.listCreate',
  quotes: 'quotes.listCreate',
  items: 'platform.listCreateItem',
  purchase_orders: 'platform.listCreatePurchaseOrder',
  receipt_notes: 'platform.listCreateReceiptNote',
  purchase_returns: 'platform.listCreatePurchaseReturn',
  delivery_returns: 'platform.listCreateDeliveryReturn',
  delivery_notes: 'platform.listCreateDeliveryNote',
  sales_returns: 'platform.listCreateSalesReturn',
  stockrooms: 'platform.listCreateStockroom',
  stock_adjustments: 'platform.listCreateStockAdjustment',
  stock_transfers: 'platform.listCreateStockTransfer',
  campaigns: 'marketing.campaignsNew',
  reports: 'analytics.newReport',
  widgets: 'analytics.newWidget',
  dashboards: 'analytics.newDashboard',
};

/** @type {Record<string, string>} */
const MODULE_SEARCH_KEYS = {
  reports: 'analytics.listSearchPlaceholder',
  widgets: 'analytics.widgetsSearchPlaceholder',
  dashboards: 'analytics.dashboardsSearchPlaceholder',
};

/**
 * @param {string} moduleKey
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveModuleDisplayLabel(moduleKey, t, te) {
  const tenant = getTenantModuleLabelsByRoute(moduleKey);
  if (tenant?.tenantLabel) return tenant.plural;

  const navKey = MODULE_LABEL_KEYS[moduleKey];
  if (navKey && te(navKey)) return t(navKey);
  const fallback = moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  return fallback;
}

/**
 * @param {string} moduleKey
 * @param {string} viewId
 * @param {string} fallback
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListViewLabel(moduleKey, viewId, fallback, t, te) {
  const tenant = getTenantModuleLabelsByRoute(moduleKey);
  if (tenant?.tenantLabel) {
    if (viewId === 'all') return tenant.listLabel;
    if (viewId === 'my-deals' || viewId === 'assigned-to-me') {
      return `My ${tenant.plural}`;
    }
    if (viewId === 'my-quotes') return `My ${tenant.plural}`;
    if (viewId === 'my-orders') return `My ${tenant.plural}`;
    if (viewId === 'my-events') return `My ${tenant.plural}`;
  }

  const explicit = SYSTEM_VIEW_KEYS[moduleKey]?.[viewId];
  if (explicit && te(explicit)) {
    return applyTenantModuleTermsToLabel(moduleKey, t(explicit));
  }

  const ns = MODULE_I18N_NS[moduleKey];
  if (viewId === 'all' && ns) {
    const key = `${ns}.listViewAll`;
    if (te(key)) return applyTenantModuleTermsToLabel(moduleKey, t(key));
    return t('common.listViewAllModule', { module: resolveModuleDisplayLabel(moduleKey, t, te) });
  }
  if (viewId === 'assigned-to-me' && ns) {
    const key = `${ns}.listViewMy`;
    if (te(key)) return applyTenantModuleTermsToLabel(moduleKey, t(key));
    return t('common.listViewMyModule', { module: resolveModuleDisplayLabel(moduleKey, t, te) });
  }

  const shared = SHARED_STAT_KEYS[viewId];
  if (shared && te(shared)) return t(shared);

  return applyTenantModuleTermsToLabel(moduleKey, fallback);
}

/**
 * @param {string} moduleKey
 * @param {string} statKey
 * @param {string} fallback
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListStatLabel(moduleKey, statKey, fallback, t, te) {
  const modKey = MODULE_STAT_KEYS[moduleKey]?.[statKey];
  if (modKey && te(modKey)) {
    return applyTenantModuleTermsToLabel(moduleKey, t(modKey));
  }
  const shared = SHARED_STAT_KEYS[statKey];
  if (shared && te(shared)) return t(shared);
  return applyTenantModuleTermsToLabel(moduleKey, fallback);
}

/**
 * @param {string} moduleKey
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListSearchPlaceholder(moduleKey, t, te) {
  const tenant = getTenantModuleLabelsByRoute(moduleKey);
  if (tenant?.tenantLabel) {
    return `Search ${tenant.plural.toLowerCase()}...`;
  }

  const explicit = MODULE_SEARCH_KEYS[moduleKey];
  if (explicit && te(explicit)) return t(explicit);

  const ns = MODULE_I18N_NS[moduleKey];
  if (ns) {
    const key = `${ns}.listSearchPlaceholder`;
    if (te(key)) return t(key);
  }
  return t('common.listSearchModule', {
    module: resolveModuleDisplayLabel(moduleKey, t, te).toLowerCase(),
  });
}

/**
 * @param {string} moduleKey
 * @param {string} fallback
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListCreateLabel(moduleKey, fallback, t, te) {
  const tenant = getTenantModuleLabelsByRoute(moduleKey);
  if (tenant?.tenantLabel) return tenant.createLabel;

  const key = CREATE_LABEL_KEYS[moduleKey];
  if (key && te(key)) return applyTenantModuleTermsToLabel(moduleKey, t(key));
  if (te('common.listCreateModule')) {
    return t('common.listCreateModule', { module: resolveModuleDisplayLabel(moduleKey, t, te) });
  }
  return applyTenantModuleTermsToLabel(moduleKey, fallback);
}

/**
 * @param {string} moduleKey
 * @param {string} columnKey
 * @param {string} fallback
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListColumnLabel(moduleKey, columnKey, fallback, t, te) {
  const resolved = resolveFieldLabel(moduleKey, { key: columnKey, label: fallback }, t, te);
  const key = String(columnKey || '').trim();
  let label = String(resolved || fallback || '').trim();
  if (!label || label === key) label = formatKeyToLabel(key);
  const keyNorm = key.replace(/[\s_-]+/g, '').toLowerCase();
  const labelNorm = label.replace(/[\s_-]+/g, '').toLowerCase();
  if (keyNorm && labelNorm === keyNorm && !/\s/.test(label)) label = formatKeyToLabel(key);
  return applyTenantModuleTermsToLabel(moduleKey, label);
}

/**
 * @param {string} moduleKey
 * @param {string} filterKey
 * @param {string} fallback
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListFilterLabel(moduleKey, filterKey, fallback, t, te) {
  return resolveListColumnLabel(moduleKey, filterKey, fallback, t, te);
}

/**
 * @param {string} moduleKey
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveListPageTitle(moduleKey, t, te) {
  return resolveListViewLabel(moduleKey, 'all', resolveModuleDisplayLabel(moduleKey, t, te), t, te);
}

/**
 * @param {string} moduleKey
 * @param {string} viewId
 */
export function isRegistrySystemView(moduleKey, viewId) {
  const views = SYSTEM_VIEW_KEYS[moduleKey];
  if (views && viewId in views) return true;
  if (moduleKey === 'people') {
    return ['all', 'assigned-to-me', 'sales', 'helpdesk'].includes(viewId);
  }
  if (moduleKey === 'documents') {
    return ['all', 'assigned-to-me'].includes(viewId);
  }
  if (moduleKey === 'campaigns') {
    return ['all', 'draft', 'scheduled', 'running', 'completed', 'failed', 'archived'].includes(viewId);
  }
  if (moduleKey === 'reports') {
    return ['all', 'mine', 'shared', 'scheduled', 'draft', 'published', 'archived'].includes(viewId);
  }
  if (moduleKey === 'widgets' || moduleKey === 'dashboards') {
    return ['all', 'draft', 'published', 'archived'].includes(viewId);
  }
  return ['all', 'assigned-to-me', 'unassigned'].includes(viewId);
}
