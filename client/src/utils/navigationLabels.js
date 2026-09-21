/**
 * Stable i18n keys for sidebar items and tab titles (navigation.* namespace).
 */

import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';
import { getTenantModulePluralLabel } from '@/utils/registryModuleLabels';

/** @type {Record<string, string>} */
export const SURFACE_LABEL_KEYS = {
  home: 'navigation.home',
  inbox: 'navigation.inbox',
  astra: 'navigation.astra',
  'astra-studio': 'navigation.astraStudio',
  'live-chat': 'navigation.liveChat',
  telephony: 'navigation.telephony',
  announcements: 'navigation.announcements',
  'internal-chat': 'navigation.internalChat',
  approvals: 'navigation.approvals',
  attention: 'navigation.attention',
  search: 'navigation.search',
  trash: 'navigation.trash',
};

/** Core / platform module keys → navigation.* */
/** @type {Record<string, string>} */
export const MODULE_LABEL_KEYS = {
  people: 'navigation.modulePeople',
  contacts: 'navigation.moduleContacts',
  organizations: 'navigation.moduleOrganizations',
  tasks: 'navigation.moduleTasks',
  events: 'navigation.moduleEvents',
  forms: 'navigation.moduleForms',
  items: 'navigation.moduleItems',
  deals: 'navigation.moduleDeals',
  quotes: 'navigation.moduleQuotes',
  sales_orders: 'navigation.moduleSalesOrders',
  purchase_orders: 'navigation.inventoryPurchaseOrders',
  invoices: 'navigation.moduleInvoices',
  payments: 'navigation.modulePayments',
  responses: 'navigation.moduleResponses',
  imports: 'navigation.moduleImports',
  analytics: 'navigation.moduleAnalytics',
  reports: 'navigation.moduleReports',
  widgets: 'navigation.moduleWidgets',
  dashboards: 'navigation.moduleDashboards',
  documents: 'navigation.moduleDocuments',
  portal_documents: 'navigation.portalDocuments',
  portal_knowledge: 'navigation.portalKnowledge',
  templates: 'navigation.moduleTemplates',
  import: 'navigation.moduleImports',
  cases: 'navigation.moduleCases',
  findings: 'navigation.moduleFindings',
  audits: 'navigation.moduleAudits',
  dashboard: 'navigation.dashboard',
  campaigns: 'navigation.moduleCampaigns',
  audiences: 'navigation.moduleAudiences',
  segments: 'navigation.moduleSegments',
  articles: 'navigation.moduleArticles',
  blog: 'navigation.moduleBlog',
  sales_returns: 'navigation.inventorySalesReturns',
  purchase_returns: 'navigation.inventoryPurchaseReturns',
  receipt_notes: 'navigation.inventoryReceiptNotes',
  delivery_notes: 'navigation.inventoryDeliveryNotes',
  delivery_returns: 'navigation.inventoryDeliveryReturns',
  stockrooms: 'navigation.inventoryStockrooms',
  stock_adjustments: 'navigation.inventoryAdjustments',
  stock_transfers: 'navigation.inventoryTransfers',
  learning_my: 'learning.myLearning',
  learning_explore: 'learning.explore',
  learning_courses: 'learning.courses',
  learning_paths: 'learning.paths',
  learning_programs: 'learning.programs',
  learning_live: 'learning.liveSessions',
  learning_assessments: 'learning.assessments',
  learning_certificates: 'learning.certificates',
  learning_skills: 'learning.skillsBadges',
  learning_content: 'learning.contentLibrary',
  learning_analytics: 'learning.analytics',
  learning_compliance: 'learning.compliance',
  learning_settings: 'learning.settings',
};

/** Core drawer section order (subtle categorization in AppModuleDrawer / AppFlyout). */
export const CORE_DRAWER_CATEGORY_ORDER = [
  'directory',
  'work',
  'data',
  'financials',
  'analytics',
  'utilities',
];

/** @type {Record<string, string>} */
export const CORE_DRAWER_CATEGORY_LABEL_KEYS = {
  directory: 'navigation.coreCategoryDirectory',
  work: 'navigation.coreCategoryWork',
  data: 'navigation.coreCategoryData',
  financials: 'navigation.coreCategoryFinancials',
  analytics: 'navigation.coreCategoryAnalytics',
  utilities: 'navigation.coreCategoryUtilities',
};

/** moduleKey → category id */
const CORE_DRAWER_CATEGORY_BY_MODULE = {
  people: 'directory',
  organizations: 'directory',
  tasks: 'work',
  events: 'work',
  items: 'data',
  forms: 'data',
  responses: 'data',
  documents: 'data',
  templates: 'data',
  quotes: 'financials',
  salesorders: 'financials',
  sales_orders: 'financials',
  orders: 'financials',
  invoices: 'financials',
  payments: 'financials',
  reports: 'analytics',
  analytics: 'analytics',
  dashboards: 'analytics',
  imports: 'utilities',
  import: 'utilities',
};

/**
 * Group Core modules into subtle drawer sections. Non-Core apps stay flat.
 * Unknown moduleKeys append in an unlabeled trailing group (preserves order).
 * @param {Array<{ id?: string, moduleKey?: string }>} items
 * @param {string} [appId]
 * @returns {Array<{ id: string, labelKey?: string, items: typeof items }>}
 */
export function groupCoreDrawerItems(items, appId) {
  const list = Array.isArray(items) ? items : [];
  if (String(appId || '').toUpperCase() !== 'CORE' || list.length === 0) {
    return [{ id: 'all', items: list }];
  }

  /** @type {Map<string, typeof list>} */
  const buckets = new Map();
  for (const id of CORE_DRAWER_CATEGORY_ORDER) buckets.set(id, []);
  const other = [];

  for (const item of list) {
    const raw = String(item?.moduleKey || item?.id || '')
      .toLowerCase()
      .replace(/-/g, '_');
    const category =
      CORE_DRAWER_CATEGORY_BY_MODULE[raw] ||
      CORE_DRAWER_CATEGORY_BY_MODULE[raw.replace(/_/g, '')];
    if (category && buckets.has(category)) {
      buckets.get(category).push(item);
    } else {
      other.push(item);
    }
  }

  const groups = [];
  for (const id of CORE_DRAWER_CATEGORY_ORDER) {
    const groupItems = buckets.get(id) || [];
    if (groupItems.length === 0) continue;
    groups.push({
      id,
      labelKey: CORE_DRAWER_CATEGORY_LABEL_KEYS[id],
      items: groupItems,
    });
  }
  if (other.length > 0) {
    groups.push({ id: 'other', items: other });
  }
  return groups.length > 0 ? groups : [{ id: 'all', items: list }];
}

/** App registry appKey → navigation.* */
/** @type {Record<string, string>} */
export const APP_NAME_KEYS = {
  CORE: 'navigation.appCore',
  SALES: 'navigation.appSales',
  AUDIT: 'navigation.appAudit',
  HELPDESK: 'navigation.appHelpdesk',
  PROJECTS: 'navigation.appProjects',
  PORTAL: 'navigation.appPortal',
  INVENTORY: 'navigation.appInventory',
  MARKETING: 'navigation.appMarketing',
  LMS: 'navigation.appLearning',
};

/** Exact path → titleKey (optional titleParams in resolver) */
/** @type {Record<string, string>} */
export const ROUTE_TITLE_KEYS = {
  '/platform/home': 'navigation.home',
  '/sales/dashboard': 'navigation.salesDashboard',
  '/dashboard': 'navigation.dashboard',
  '/inbox': 'navigation.inbox',
  '/astra': 'navigation.astra',
  '/astra/canvas': 'navigation.arivuCanvas',
  '/live-chat/sessions': 'navigation.liveChat',
  '/live-chat/closed': 'liveChat.navClosed',
  '/live-chat/reports': 'liveChat.navReports',
  '/telephony/calls': 'navigation.telephony',
  '/telephony/phone-numbers': 'telephony.navPhoneNumbers',
  '/telephony/queues': 'telephony.navQueues',
  '/telephony/agents': 'telephony.navAgents',
  '/telephony/ivr': 'telephony.navIvr',
  '/telephony/campaigns': 'telephony.navCampaigns',
  '/telephony/analytics': 'telephony.navAnalytics',
  '/telephony/recordings': 'telephony.navRecordings',
  '/telephony/settings': 'telephony.navSettings',
  '/announcements': 'navigation.announcements',
  '/announcements/analytics': 'navigation.announcements',
  '/internal-chat': 'navigation.internalChat',
  '/approvals': 'navigation.approvals',
  '/contacts': 'navigation.moduleContacts',
  '/people': 'navigation.modulePeople',
  '/organizations': 'navigation.moduleOrganizations',
  '/deals': 'navigation.moduleDeals',
  '/quotes': 'navigation.moduleQuotes',
  '/sales-orders': 'navigation.moduleSalesOrders',
  '/invoices': 'navigation.moduleInvoices',
  '/tasks': 'navigation.moduleTasks',
  '/events': 'navigation.moduleEvents',
  '/forms': 'navigation.moduleForms',
  '/responses': 'navigation.moduleResponses',
  '/calendar': 'navigation.moduleEvents',
  '/imports': 'navigation.moduleImports',
  '/documents': 'navigation.moduleDocuments',
  '/templates': 'navigation.moduleTemplates',
  '/content-themes': 'templates.navThemes',
  '/content-assets': 'templates.navAssets',
  '/templates/email-merge-mappings': 'templates.navMergeMappings',
  '/items': 'navigation.moduleItems',
  '/helpdesk/cases': 'navigation.moduleCases',
  '/helpdesk/cases/': 'navigation.moduleCases',
  '/helpdesk/articles': 'navigation.moduleArticles',
  '/helpdesk/articles/': 'navigation.moduleArticles',
  '/trash': 'navigation.userTrash',
  '/demo-requests': 'navigation.tabDemoRequests',
  '/instances': 'navigation.tabInstances',
  '/settings': 'navigation.settings',
  '/appointments/pages': 'navigation.tabBookingPages',
  '/appointments/configure': 'navigation.tabPersonalBooking',
  '/control': 'navigation.userControlPanel',
  '/control/demo-requests': 'navigation.tabDemoRequests',
  '/control/instances': 'navigation.tabInstances',
  '/control/billing': 'platform.commercialAdminTitle',
  '/settings/automation/automation-rules': 'navigation.tabAutomationRules',
  '/settings/automation/processes': 'navigation.tabProcesses',
  '/settings/automation/flows': 'navigation.tabBusinessFlows',
  '/audit/dashboard': 'navigation.auditDashboard',
  '/audit/audits': 'navigation.tabMyAudits',
  '/audit/responses': 'navigation.moduleResponses',
  '/platform/attention': 'navigation.attention',
  '/platform/apps': 'navigation.apps',
  '/portal/dashboard': 'navigation.home',
  '/portal/cases': 'cases.portalCasesTitle',
  '/portal/invoices': 'navigation.portalInvoices',
  '/portal/documents': 'navigation.portalDocuments',
  '/portal/knowledge': 'navigation.portalKnowledge',
  '/portal/audits': 'navigation.portalAudits',
  '/portal/actions': 'navigation.portalActions',
  '/portal/organization': 'navigation.portalOrganization',
  '/portal/people': 'navigation.portalPeople',
  '/portal/deals': 'navigation.portalDeals',
  '/portal/forms': 'navigation.portalForms',
  '/portal/responses': 'navigation.portalResponses',
  '/dashboard/marketing': 'navigation.appMarketing',
  '/marketing/campaigns': 'navigation.moduleCampaigns',
  '/learning': 'navigation.appLearning',
  '/learning/my': 'learning.myLearning',
  '/learning/explore': 'learning.explore',
  '/learning/courses': 'learning.courses',
  '/learning/paths': 'learning.paths',
  '/learning/programs': 'learning.programs',
  '/learning/live': 'learning.liveSessions',
  '/learning/assessments': 'learning.assessments',
  '/learning/certificates': 'learning.certificates',
  '/learning/skills': 'learning.skillsBadges',
  '/learning/content': 'learning.contentLibrary',
  '/learning/compliance': 'learning.compliance',
  '/learning/analytics': 'learning.analytics',
  '/learning/settings': 'learning.settings',
  '/marketing/blog': 'navigation.moduleBlog',
  '/marketing/audiences': 'navigation.moduleAudiences',
  '/marketing/segments': 'navigation.moduleSegments',
  '/analytics/reports': 'navigation.moduleReports',
};

/**
 * @param {string} moduleKey
 * @returns {string|undefined}
 */
export function getModuleLabelKey(moduleKey) {
  const k = String(moduleKey || '')
    .toLowerCase()
    .replace(/-/g, '_');
  return MODULE_LABEL_KEYS[k];
}

/**
 * @param {string} surfaceId
 * @returns {string|undefined}
 */
export function getSurfaceLabelKey(surfaceId) {
  return SURFACE_LABEL_KEYS[surfaceId];
}

/**
 * @param {string} surfaceId
 * @returns {string|undefined}
 */
export function getAddonSurfaceLabelKey(surfaceId) {
  return SURFACE_LABEL_KEYS[surfaceId];
}

/**
 * @param {string} appKey
 * @returns {string|undefined}
 */
export function getAppNameKey(appKey) {
  return APP_NAME_KEYS[String(appKey || '').toUpperCase()];
}

/**
 * @param {{ labelKey?: string, label?: string, tenantLabel?: boolean }} item
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} [te]
 */
export function resolveSidebarItemLabel(item, t) {
  if (item?.tenantLabel && item?.label) {
    return item.label;
  }
  if (item?.labelKey) {
    return t(item.labelKey);
  }
  return item?.label || '';
}

/**
 * Tab title metadata for a route. Dynamic record names keep plain `title`.
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @returns {{ titleKey?: string, titleParams?: Record<string, unknown>, title?: string }}
 */
export function getTabTitleMetaForPath(path, params = {}) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const segments = pathOnly.split('/').filter(Boolean);

  if (ROUTE_TITLE_KEYS[pathOnly]) {
    return { titleKey: ROUTE_TITLE_KEYS[pathOnly] };
  }

  if (pathOnly.startsWith('/learning/')) {
    const root = `/learning/${segments[1] || ''}`;
    if (ROUTE_TITLE_KEYS[root] && segments.length > 2) {
      if (params?.name) {
        return {
          titleKey: 'navigation.tabRecordNamed',
          titleParams: { moduleRoute: segments[1], name: params.name },
        };
      }
      return {
        titleKey: 'navigation.tabRecordDetail',
        titleParams: { moduleRoute: segments[1] },
      };
    }
    if (ROUTE_TITLE_KEYS[root]) {
      return { titleKey: ROUTE_TITLE_KEYS[root] };
    }
    return { titleKey: 'navigation.appLearning' };
  }

  if (pathOnly.startsWith('/sales/dashboard')) {
    return { titleKey: 'navigation.salesDashboard' };
  }

  if (pathOnly.startsWith('/control/')) {
    const sub = segments[1];
    if (sub && ROUTE_TITLE_KEYS[`/control/${sub}`]) {
      return { titleKey: ROUTE_TITLE_KEYS[`/control/${sub}`] };
    }
    return { titleKey: 'navigation.userControlPanel' };
  }

  if (pathOnly.startsWith('/settings/automation/')) {
    if (isProcessDesignerTabPath(pathOnly)) {
      return { titleKey: 'process.setupTitle' };
    }
    const sub = segments[2];
    if (sub === 'flows' && segments[3]) {
      if (segments[4] === 'health') return { titleKey: 'navigation.tabFlowHealth' };
      if (segments[4] === 'edit') return { titleKey: 'navigation.tabEditBusinessFlow' };
      if (segments[3] === 'create') return { titleKey: 'navigation.tabCreateBusinessFlow' };
      return { titleKey: 'navigation.tabBusinessFlow' };
    }
    const key = ROUTE_TITLE_KEYS[`/settings/automation/${sub}`];
    if (key) return { titleKey: key };
    return { titleKey: 'navigation.tabAutomation' };
  }

  if (pathOnly.startsWith('/audit/')) {
    if (pathOnly.startsWith('/audit/dashboard')) return { titleKey: 'navigation.auditDashboard' };
    if (pathOnly.startsWith('/audit/audits')) {
      if (segments.length > 2) return { titleKey: 'navigation.tabAuditDetail' };
      return { titleKey: 'navigation.tabMyAudits' };
    }
    return { titleKey: 'navigation.appAudit' };
  }

  if (pathOnly.startsWith('/appointments/')) {
    if (pathOnly.includes('/team/configure')) {
      return segments[2] ? { titleKey: 'navigation.tabTeamBooking' } : { titleKey: 'navigation.tabNewTeamPage' };
    }
    if (pathOnly.startsWith('/appointments/configure/user/')) {
      return { titleKey: 'navigation.tabBookingPage' };
    }
    return { titleKey: 'navigation.tabBookingPages' };
  }

  if (pathOnly.startsWith('/helpdesk/cases')) {
    if (segments[2] === 'new' || segments.length <= 2) {
      return { titleKey: 'navigation.moduleCases' };
    }
    return { titleKey: 'navigation.tabCaseDetail' };
  }

  if (pathOnly.startsWith('/helpdesk/articles')) {
    if (segments[2] === 'new') {
      return { titleKey: 'contentStudio.tabNewArticle' };
    }
    if (segments[3] === 'edit' && isRecordIdSegment(segments[2])) {
      if (params?.name) {
        return {
          titleKey: 'navigation.tabRecordNamed',
          titleParams: { moduleRoute: 'articles', name: params.name },
        };
      }
      return { titleKey: 'contentStudio.tabEditArticle' };
    }
    return { titleKey: 'navigation.moduleArticles' };
  }

  if (pathOnly.startsWith('/marketing/blog')) {
    if (segments[2] === 'new') {
      return { titleKey: 'contentStudio.tabNewPost' };
    }
    if (segments[3] === 'edit' && isRecordIdSegment(segments[2])) {
      if (params?.name) {
        return {
          titleKey: 'navigation.tabRecordNamed',
          titleParams: { moduleRoute: 'blog', name: params.name },
        };
      }
      return { titleKey: 'contentStudio.tabEditPost' };
    }
    return { titleKey: 'navigation.moduleBlog' };
  }

  if (pathOnly.startsWith('/portal/')) {
    if (pathOnly.startsWith('/portal/dashboard')) {
      return { titleKey: 'navigation.home' };
    }
    if (pathOnly.startsWith('/portal/cases')) {
      if (segments.length > 2) {
        return { titleKey: 'navigation.tabCaseDetail' };
      }
      return { titleKey: 'cases.portalCasesTitle' };
    }
    if (pathOnly.startsWith('/portal/invoices')) {
      return { titleKey: 'navigation.portalInvoices' };
    }
    if (pathOnly.startsWith('/portal/documents')) {
      if (segments.length > 2) {
        return { titleKey: 'navigation.tabPortalDocument' };
      }
      return { titleKey: 'navigation.portalDocuments' };
    }
    if (pathOnly.startsWith('/portal/knowledge')) {
      if (segments.length > 2) {
        return { titleKey: 'navigation.tabPortalArticle' };
      }
      return { titleKey: 'navigation.portalKnowledge' };
    }
    if (pathOnly.startsWith('/portal/audits')) {
      if (segments.length > 2) {
        return { titleKey: 'navigation.tabAuditDetail' };
      }
      return { titleKey: 'navigation.portalAudits' };
    }
    if (pathOnly.startsWith('/portal/actions')) {
      return { titleKey: 'navigation.portalActions' };
    }
    return { titleKey: 'navigation.appPortal' };
  }

  if (pathOnly.startsWith('/live-chat/')) {
    return { titleKey: 'navigation.liveChat' };
  }

  if (pathOnly.startsWith('/telephony/')) {
    return { titleKey: 'navigation.telephony' };
  }

  if (pathOnly === '/analytics' || pathOnly === '/analytics/') {
    return { titleKey: 'analytics.homeTitle' };
  }

  if (pathOnly.startsWith('/analytics/trash')) {
    return { titleKey: 'analytics.trashTitle' };
  }

  if (pathOnly.startsWith('/analytics/folders')) {
    return { titleKey: 'analytics.foldersTitle' };
  }

  if (pathOnly.startsWith('/analytics/settings')) {
    return { titleKey: 'analytics.settingsTitle' };
  }

  if (pathOnly.startsWith('/analytics/schedules')) {
    return { titleKey: 'analytics.schedulesTitle' };
  }

  if (pathOnly.startsWith('/analytics/snapshots')) {
    return { titleKey: 'analytics.snapshotsTitle' };
  }

  if (pathOnly.startsWith('/analytics/reports')) {
    if (pathOnly.endsWith('/new')) {
      return { titleKey: 'analytics.builderTitle' };
    }
    if (pathOnly.includes('/edit')) {
      return { titleKey: 'analytics.builderEditTitle' };
    }
    if (segments.length >= 3) {
      return { titleKey: 'analytics.detailTitle' };
    }
    return { titleKey: 'navigation.moduleReports' };
  }

  if (pathOnly.startsWith('/analytics/widgets')) {
    if (pathOnly.endsWith('/new')) {
      return { titleKey: 'analytics.widgetBuilderTitle' };
    }
    if (pathOnly.includes('/edit')) {
      return { titleKey: 'analytics.widgetBuilderEditTitle' };
    }
    if (segments.length >= 3 && isRecordIdSegment(segments[2])) {
      return { titleKey: 'navigation.tabRecordDetail', titleParams: { moduleRoute: 'widgets' } };
    }
    return { titleKey: 'analytics.widgetsListTitle' };
  }

  if (pathOnly.startsWith('/analytics/dashboards')) {
    if (pathOnly.endsWith('/new')) {
      return { titleKey: 'analytics.dashboardDesignerTitle' };
    }
    if (pathOnly.includes('/edit')) {
      return { titleKey: 'analytics.dashboardDesignerEditTitle' };
    }
    if (segments.length >= 3 && isRecordIdSegment(segments[2])) {
      return { titleKey: 'navigation.tabRecordDetail', titleParams: { moduleRoute: 'dashboards' } };
    }
    return { titleKey: 'analytics.dashboardsListTitle' };
  }

  if (segments[0] === 'dashboard' && segments[1]) {
    const appKey = segments[1];
    const appKeyUpper = appKey.toUpperCase();
    const appNameKey = getAppNameKey(appKeyUpper);
    if (appNameKey) {
      return { titleKey: 'navigation.appDashboard', titleParams: { app: appKey } };
    }
    return { titleKey: 'navigation.dashboard' };
  }

  if (segments[0] === 'forms' && segments[2] === 'responses' && segments[3]) {
    return { titleKey: 'navigation.tabFormResponseDetail', titleParams: { id: segments[3] } };
  }

  if (segments[0] === 'templates' && segments[1] !== 'email-merge-mappings') {
    if (segments[2] === 'builder' && isRecordIdSegment(segments[1])) {
      if (params?.name) {
        return {
          titleKey: 'navigation.tabRecordNamed',
          titleParams: { moduleRoute: 'templates', name: params.name }
        };
      }
      return { titleKey: 'templates.detailTitle' };
    }
    if (segments.length === 2 && isRecordIdSegment(segments[1])) {
      if (params?.name) {
        return {
          titleKey: 'navigation.tabRecordNamed',
          titleParams: { moduleRoute: 'templates', name: params.name }
        };
      }
      return { titleKey: 'templates.detailTitle' };
    }
  }

  const recordMetaForModule = (moduleKey) => {
    const moduleLabelKey = getModuleLabelKey(moduleKey);
    if (params?.name) {
      return {
        titleKey: 'navigation.tabRecordNamed',
        titleParams: { moduleRoute: moduleKey, name: params.name }
      };
    }
    if (moduleLabelKey) {
      return { titleKey: 'navigation.tabRecordDetail', titleParams: { moduleRoute: moduleKey } };
    }
    return null;
  };

  // Standard CRM record: `/people/:id`, `/deals/:id`, `/quotes/:id`, …
  if (segments.length === 2 && isRecordIdSegment(segments[1])) {
    const meta = recordMetaForModule(segments[0]);
    if (meta) return meta;
  }

  // Nested record paths (e.g. multi-segment module routes)
  if (segments.length > 2 && !pathOnly.startsWith('/audit/') && segments[0] !== 'dashboard') {
    const meta = recordMetaForModule(segments[0]);
    if (meta) return meta;
  }

  const basePath = `/${segments[0] || ''}`;
  if (ROUTE_TITLE_KEYS[basePath]) {
    return { titleKey: ROUTE_TITLE_KEYS[basePath] };
  }

  return { titleKey: 'navigation.tabPage' };
}

/** Path segments without query/hash (e.g. `/people/abc` → `['people','abc']`). */
export function pathSegments(path) {
  return String(path || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);
}

/** Second path segment looks like a record id (not `new` / `create`). */
export function isRecordIdSegment(segment) {
  const s = String(segment || '').trim();
  if (!s || s === 'new' || s === 'create' || s === 'edit') return false;
  if (/^[a-fA-F0-9]{24}$/.test(s)) return true;
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(s)) return true;
  if (/^\d+$/.test(s)) return true;
  return s.length >= 8;
}

/**
 * Record detail URL (e.g. `/people/:id`, `/quotes/:id`, `/forms/:id/responses/:rid`).
 * List routes (`/people`) are excluded.
 */
export function isRecordDetailTabPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const segments = pathSegments(path);
  if (segments.length < 2) return false;
  if (ROUTE_TITLE_KEYS[pathOnly]) return false;
  if (pathOnly.startsWith('/audit/')) return false;
  if (segments[0] === 'dashboard') return false;
  if (pathOnly.startsWith('/control/')) return false;
  if (pathOnly.startsWith('/settings/automation/')) return false;
  if (pathOnly.startsWith('/portal/')) return false;

  if (segments[0] === 'forms' && segments[2] === 'responses' && segments[3]) {
    return isRecordIdSegment(segments[3]);
  }

  if (pathOnly.startsWith('/helpdesk/cases/')) {
    return segments.length >= 3 && segments[2] !== 'new' && isRecordIdSegment(segments[2]);
  }

  if (pathOnly.startsWith('/helpdesk/articles/')) {
    return segments.length >= 4 && segments[3] === 'edit' && isRecordIdSegment(segments[2]);
  }

  if (pathOnly.startsWith('/marketing/blog/')) {
    return segments.length >= 4 && segments[3] === 'edit' && isRecordIdSegment(segments[2]);
  }

  if (pathOnly.startsWith('/learning/')) {
    return segments.length >= 3 && isRecordIdSegment(segments[2]);
  }

  // Standard CRM modules: `/module/:recordId` (two segments — was incorrectly treated as list)
  if (segments.length === 2) {
    return isRecordIdSegment(segments[1]) && Boolean(getModuleLabelKey(segments[0]) || segments[0]);
  }

  if (segments.length > 2) {
    if (segments[0] === 'forms' && segments[2] === 'responses') return false;
    return true;
  }

  return false;
}

/** Module list path for a record detail URL (e.g. `/people/:id` → `/people`). */
export function getRecordModuleListPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  if (!isRecordDetailTabPath(pathOnly)) return null;

  const segments = pathSegments(pathOnly);

  if (segments[0] === 'forms' && segments[2] === 'responses' && segments[3]) {
    return `/forms/${segments[1]}/responses`;
  }
  if (pathOnly.startsWith('/helpdesk/cases/')) return '/helpdesk/cases';
  if (pathOnly.startsWith('/helpdesk/articles/')) return '/helpdesk/articles';
  if (pathOnly.startsWith('/marketing/blog/')) return '/marketing/blog';
  if (pathOnly.startsWith('/learning/') && segments.length >= 3) {
    return `/learning/${segments[1]}`;
  }
  if (segments.length >= 2) return `/${segments[0]}`;
  return null;
}

export function isGenericRecordTabTitleKey(titleKey) {
  return titleKey === 'navigation.tabRecordDetail';
}

/** Portal customer document detail (`/portal/documents/:id`). */
export function isPortalDocumentDetailTabPath(path) {
  const segments = pathSegments(path);
  return segments[0] === 'portal' && segments[1] === 'documents' && Boolean(segments[2]);
}

/** Best available display name for a record tab (survives refresh). */
export function getPersistedRecordTabName(tab) {
  if (!tab) return '';
  return (
    String(tab.recordTitle || '').trim() ||
    String(tab.title || '').trim() ||
    String(tab.titleParams?.name || '').trim() ||
    String(tab.params?.name || '').trim() ||
    ''
  );
}

/** True when a record tab already has a stored entity name — do not replace with module labels. */
export function shouldPreserveRecordTabTitle(tab, path) {
  if (isRecordDetailTabPath(path)) {
    return getPersistedRecordTabName(tab).length > 0;
  }
  if (isPortalDocumentDetailTabPath(path)) {
    return Boolean(String(tab?.recordTitle || tab?.params?.name || '').trim());
  }
  return false;
}

/**
 * @param {string} titleKey
 * @param {Record<string, unknown>} [params]
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {(key: string) => boolean} te
 */
function localizedTabTitleParams(titleKey, params, t, te) {
  if (titleKey === 'navigation.appDashboard' && params?.app) {
    const appNameKey = getAppNameKey(String(params.app));
    if (appNameKey && te(appNameKey)) {
      return { ...params, app: t(appNameKey) };
    }
  }

  if (
    params &&
    (titleKey === 'navigation.tabRecordNamed' || titleKey === 'navigation.tabRecordDetail')
  ) {
    const moduleRoute = params.moduleRoute || params.module;
    if (moduleRoute && getModuleLabelKey(String(moduleRoute))) {
      return {
        ...params,
        module: resolveModuleDisplayName(String(moduleRoute), t, te),
      };
    }
  }
  return params || {};
}

/**
 * Display title for a tab object.
 * @param {{ titleKey?: string, titleParams?: Record<string, unknown>, title?: string, path?: string }} tab
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {(key: string) => boolean} [te]
 */
/** Process setup (`/new`) or designer (`/:id/design`) — dynamic tab title. */
export function isProcessDesignerTabPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  if (!pathOnly.startsWith('/settings/automation/processes/')) return false;
  return pathOnly !== '/settings/automation/processes';
}

/** Templates module list siblings (Templates / Themes / Assets / Merge mappings). */
export function isTemplatesModuleListPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  return pathOnly === '/templates'
    || pathOnly === '/content-themes'
    || pathOnly === '/content-assets'
    || pathOnly === '/templates/email-merge-mappings';
}

/** Any templates-module surface, including detail/builder under templates or themes. */
export function isTemplatesModuleFamilyPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  if (isTemplatesModuleListPath(pathOnly)) return true;
  if (pathOnly.startsWith('/content-themes/')) return true;
  if (pathOnly.startsWith('/content-assets')) return true;
  if (pathOnly.startsWith('/templates/')) return true;
  return false;
}

export function resolveTabTitle(tab, t, te = () => false) {
  const recordName = getPersistedRecordTabName(tab);
  if (
    recordName &&
    (isRecordDetailTabPath(tab?.path) || isProcessDesignerTabPath(tab?.path))
  ) {
    return recordName;
  }

  if (isPortalDocumentDetailTabPath(tab?.path)) {
    const portalDocName = String(tab?.recordTitle || tab?.params?.name || '').trim();
    if (portalDocName) return portalDocName;
  }

  const pathOnly = String(tab?.path || '').split('?')[0].split('#')[0];
  const pathSegments = pathOnly.split('/').filter(Boolean);
  if (pathSegments.length === 1) {
    const tenantModuleLabel = getTenantModulePluralLabel(pathSegments[0]);
    if (tenantModuleLabel) return tenantModuleLabel;
  }

  if (tab?.titleKey === 'navigation.tabRecordNamed' && tab.titleParams?.name) {
    const params = localizedTabTitleParams(tab.titleKey, tab.titleParams, t, te);
    return t(tab.titleKey, params);
  }

  if (tab?.titleKey) {
    const params = localizedTabTitleParams(tab.titleKey, tab.titleParams, t, te);
    return t(tab.titleKey, params);
  }
  if (tab?.title) return tab.title;
  if (tab?.path) {
    const meta = getTabTitleMetaForPath(tab.path, tab.params || {});
    if (meta.titleKey) {
      const params = localizedTabTitleParams(meta.titleKey, meta.titleParams, t, te);
      return t(meta.titleKey, params);
    }
  }
  return t('navigation.tabPage');
}

/**
 * Normalize a tab loaded from localStorage (record names + list titleKeys).
 * @param {{ path?: string, params?: Record<string, unknown>, title?: string, titleKey?: string, recordTitle?: string, titleParams?: Record<string, unknown> }} tab
 */
export function hydrateTabFromStorage(tab) {
  if (!tab?.path) return tab;

  const pathOnly = String(tab.path).split('?')[0];
  const segments = pathOnly.split('/').filter(Boolean);

  if (isRecordDetailTabPath(tab.path)) {
    const name = getPersistedRecordTabName(tab);
    if (name) {
      return {
        ...tab,
        recordTitle: name,
        title: name,
        titleKey: 'navigation.tabRecordNamed',
        titleParams: {
          ...tab.titleParams,
          moduleRoute: segments[0],
          name
        },
        params: { ...tab.params, name }
      };
    }

    // No stored name yet — drop generic detail key so refresh doesn't show "{module} Detail"
    if (isGenericRecordTabTitleKey(tab.titleKey)) {
      const next = { ...tab };
      delete next.titleKey;
      delete next.titleParams;
      return next;
    }

    return tab;
  }

  if (isPortalDocumentDetailTabPath(tab.path)) {
    const customName = String(tab.recordTitle || tab.params?.name || '').trim()
      || (!tab.titleKey ? String(tab.title || '').trim() : '');
    if (customName) {
      const next = {
        ...tab,
        recordTitle: customName,
        title: customName,
        params: { ...tab.params, name: customName }
      };
      delete next.titleKey;
      delete next.titleParams;
      return next;
    }
  }

  // List / settings / dashboard routes
  if (tab.titleKey) return tab;
  const meta = getTabTitleMetaForPath(tab.path, tab.params || {});
  if (!meta.titleKey) return tab;
  return { ...tab, titleKey: meta.titleKey, titleParams: meta.titleParams };
}

/** @deprecated Use hydrateTabFromStorage */
export function enrichTabWithTitleKey(tab) {
  return hydrateTabFromStorage(tab);
}
