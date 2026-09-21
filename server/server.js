// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { validateEnv } = require('./config/validateEnv');
const { getAllowedOrigins, isAllowedCorsOrigin } = require('./config/corsConfig');
const { getMongoUris, connectMasterWithRetry, MASTER_DB } = require('./lib/mongoConnect');
const { initSentryNode, installExpressSentryErrorHandler, flushSentry } = require('./lib/sentryNode');

validateEnv();
const { logEmailFeatureFlagsAtStartup } = require('./config/emailFeatureFlags');
logEmailFeatureFlagsAtStartup();
initSentryNode();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const trust = process.env.EXPRESS_TRUST_PROXY;
if (trust === 'false') {
  console.warn('⚠️  Express trust proxy disabled by EXPRESS_TRUST_PROXY=false');
} else {
  const n = trust !== undefined && trust !== 'true' ? Number(trust) : 1;
  const trustProxyValue = Number.isNaN(n) ? 1 : n;
  app.set('trust proxy', trustProxyValue);
  console.log(`🌐 Express trust proxy: ${trustProxyValue}`);
}

// Server instance (will be set when server starts)
let server = null;

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;

let MONGO_URI;
let masterUri;
let mongoQueryString;
let baseUri;
try {
  const uriCfg = getMongoUris();
  MONGO_URI = uriCfg.MONGO_URI;
  masterUri = uriCfg.masterUri;
  mongoQueryString = uriCfg.mongoQueryString;
  baseUri = uriCfg.baseUri;
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}

const allowedOrigins = getAllowedOrigins();

console.log(
  `🚀 Starting Arivu API in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`,
);
console.log(`📊 Port: ${PORT}`);
console.log(
  `🗄️  Database: ${MONGO_URI ? MONGO_URI.substring(0, 30) + '...' : 'NOT SET'}`,
);
console.log(`🌐 Allowed CORS Origins: ${allowedOrigins.join(', ')}`);

// 🚨 CRUCIAL: Configure Express to serve static files (like your CSS)
// Assuming your final CSS is in a folder named 'public'
app.use(express.static(path.join(__dirname, 'public')));
// Also serve public assets under /api so Vite proxy can fetch them.
app.use('/api', express.static(path.join(__dirname, 'public')));

// ============================================
// SECURITY MIDDLEWARE (Applied First)
// ============================================

// 🔓 SECURITY DISABLED FOR DEVELOPMENT
// Set DISABLE_SECURITY=true in .env to bypass all security checks
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true' || process.env.NODE_ENV !== 'production';

// Security Headers - Apply to all responses (skip if security disabled)
if (!SECURITY_DISABLED) {
    const securityHeaders = require('./middleware/securityHeadersMiddleware');
    app.use(securityHeaders);
} else {
    console.warn('⚠️  [DEV] Security headers middleware disabled');
}

if (isProduction) {
  try {
    const compression = require('compression');
    app.use(compression({
      threshold: 1024,
      filter: (req, res) => {
        // SSE must not be gzip-buffered or events arrive in bursts after toast.
        const url = String(req.originalUrl || req.url || '');
        if (url.includes('/stream')) return false;
        const type = String(res.getHeader('Content-Type') || '');
        if (type.includes('text/event-stream')) return false;
        return compression.filter(req, res);
      },
    }));
  } catch (e) {
    console.warn('⚠️  compression not installed, skipping');
  }
}

// CORS Configuration
// NOTE: embed chat is public and must work on arbitrary customer websites.
const defaultCors = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (isAllowedCorsOrigin(origin, {
      allowLocalhost: !isProduction,
      allowTenantSubdomains: isProduction
    })) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
});

const publicEmbedCors = cors({
  origin: true,
  credentials: false,
});

const publicContentCorsMiddleware = require('./middleware/publicContentCorsMiddleware');

app.use((req, res, next) => {
  const url = String(req.originalUrl || '').split('?')[0];
  if (url.startsWith('/api/public/v1/content') || url.startsWith('/api/public/content')) {
    return publicContentCorsMiddleware(req, res, next);
  }
  if (
    url === '/embed/chat'
    || url.startsWith('/embed/chat/')
    || url === '/api/embed/chat'
    || url.startsWith('/api/embed/chat/')
    || url === '/embed/content.js'
    || url.startsWith('/embed/content/')
  ) {
    return publicEmbedCors(req, res, next);
  }
  return defaultCors(req, res, next);
});

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (allowedOrigins.includes('*')) {
    res.setHeader('Timing-Allow-Origin', '*');
  } else if (origin && isAllowedCorsOrigin(origin, {
    allowLocalhost: !isProduction,
    allowTenantSubdomains: isProduction
  })) {
    res.setHeader('Timing-Allow-Origin', origin);
  }
  next();
});

// Arivu Inbound Parser webhook (raw body for HMAC — must be before express.json)
app.use('/api/webhooks/arivu', require('./routes/arivuInboundWebhookRoutes'));
app.use('/api/internal/webhooks/amds', require('./routes/internal/amdsWebhookRoutes'));
app.use('/api/payment-gateways/webhooks', require('./routes/paymentGatewayWebhookRoutes'));
app.use('/api/billing/webhooks', require('./routes/commercialBillingWebhookRoutes'));
app.use('/api/public/pay', require('./routes/publicPaymentLinkRoutes'));

// Body Parsing
app.use(express.json({ limit: '26mb' })); // Align with content asset upload limit (25MB + overhead)
app.use(express.urlencoded({ extended: true, limit: '26mb' }));

if (!SECURITY_DISABLED && process.env.RATE_LIMIT_IP_DEBUG === 'true') {
    app.use('/api', (req, res, next) => {
        console.log('RATE LIMIT IP DEBUG:', req.ip, req.originalUrl, {
            xForwardedFor: req.headers['x-forwarded-for'] || null,
            forwarded: req.headers.forwarded || null,
            remoteAddress: req.socket?.remoteAddress || null
        });
        next();
    });
}

// General API Rate Limiting (skip if security disabled)
if (!SECURITY_DISABLED) {
    const { apiLimiter, routeRateLimitMiddleware } = require('./middleware/rateLimitMiddleware');
    app.use('/api', apiLimiter);
    app.use('/api', routeRateLimitMiddleware);
} else {
    console.warn('⚠️  [DEV] API rate limiting disabled');
}

// CSRF Protection (for state-changing operations)
// DISABLED in development for API testing
const csrfProtection = require('./middleware/csrfMiddleware');
if (process.env.NODE_ENV === 'production') {
    app.use(csrfProtection);
}

// ============================================
// APP CONTEXT RESOLUTION (After Auth, Before Permissions)
// ============================================
// Note: This middleware is applied at the router level in each route file
// after protect() but before permission checks to ensure req.user exists.
// See APP_CONTEXT_IMPLEMENTATION.md for details.

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const profileRoutes = require('./routes/profileRoutes');
const sharingRoutes = require('./routes/sharingRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const dealRoutes = require('./routes/dealRoutes');
const taskRoutes = require('./routes/taskRoutes');
const eventRoutes = require('./routes/eventRoutes');
const schedulingRoutes = require('./routes/schedulingRoutes');
const csvRoutes = require('./routes/csvRoutes');
const demoRoutes = require('./routes/demoRoutes');
const instanceRoutes = require('./routes/instanceRoutes');
const healthRoutes = require('./routes/healthRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userPreferencesRoutes = require('./routes/userPreferencesRoutes');
const notificationPreferenceRoutes = require('./routes/notificationPreferenceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const notificationRuleRoutes = require('./routes/notificationRuleRoutes');
const notificationHealthRoutes = require('./routes/notificationHealthRoutes');
const notificationAnalyticsRoutes = require('./routes/notificationAnalyticsRoutes');
const pushRoutes = require('./routes/pushRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const activityRoutes = require('./routes/activityRoutes');
const notesRoutes = require('./routes/notesRoutes');
const filesRoutes = require('./routes/filesRoutes');
const organizationV2Routes = require('./routes/organizationV2Routes');
const moduleRoutes = require('./routes/moduleRoutes');
const groupRoutes = require('./routes/groupRoutes');
const formRoutes = require('./routes/formRoutes');
const reportRoutes = require('./routes/reportRoutes');
const itemRoutes = require('./routes/itemRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const portalRoutes = require('./routes/portalRoutes');
const auditRoutes = require('./routes/auditRoutes');
const auditExecutionRoutes = require('./routes/auditExecutionRoutes');
const auditReadRoutes = require('./routes/auditReadRoutes');
const digestRoutes = require('./routes/digestRoutes');
const uiCompositionRoutes = require('./routes/uiCompositionRoutes');
const configRegistryRoutes = require('./routes/configRegistryRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const responseRoutes = require('./routes/responseRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const mailroomRoutes = require('./routes/mailroomRoutes');
const embedChatRoutes = require('./routes/embedChatRoutes');
const automationRuleRoutes = require('./routes/automationRuleRoutes');
const processRoutes = require('./routes/processRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const businessFlowRoutes = require('./routes/businessFlowRoutes');
const businessFlowTemplateRoutes = require('./routes/businessFlowTemplateRoutes');
const automationContextRoutes = require('./routes/automationContextRoutes');
const trashRoutes = require('./routes/trashRoutes');
const moduleRecordRoutes = require('./routes/moduleRecordRoutes');
const caseRoutes = require('./routes/caseRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const refundRoutes = require('./routes/refundRoutes');
const customerStatementRoutes = require('./routes/customerStatementRoutes');
const paymentLinkRoutes = require('./routes/paymentLinkRoutes');
const paymentGatewayRoutes = require('./routes/paymentGatewayRoutes');
const webformRoutes = require('./routes/webformRoutes');
const liveChatRoutes = require('./routes/liveChatRoutes');
const telephonyRoutes = require('./routes/telephonyRoutes');
const telephonyWebhookRoutes = require('./routes/telephonyWebhookRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const marketingCampaignRoutes = require('./routes/marketingCampaignRoutes');
const marketingAudienceRoutes = require('./routes/marketingAudienceRoutes');
const marketingSegmentRoutes = require('./routes/marketingSegmentRoutes');
const marketingDashboardRoutes = require('./routes/marketingDashboardRoutes');
const marketingReportsRoutes = require('./routes/marketingReportsRoutes');
const marketingSubscriptionRoutes = require('./routes/marketingSubscriptionRoutes');
const marketingAssetRoutes = require('./routes/marketingAssetRoutes');
const marketingBlogRoutes = require('./routes/marketingBlogRoutes');
const helpdeskArticlesRoutes = require('./routes/helpdeskArticlesRoutes');
const contentStudioRoutes = require('./routes/contentStudioRoutes');
const publicMarketingRoutes = require('./routes/publicMarketingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const astraV2Routes = require('./routes/astraV2Routes');
const astraStudioRoutes = require('./routes/astraStudioRoutes');
const tallyConnectorRoutes = require('./routes/tallyConnectorRoutes');
const tallyAgentRoutes = require('./routes/tallyAgentRoutes');

// Route Linking
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/billing', require('./routes/commercialBillingRoutes'));
app.use('/api/deals', dealRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/imports', require('./routes/importHistoryRoutes'));
app.use('/api/execution', require('./routes/executionRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/geocode', require('./routes/geocodeRoutes'));
app.use('/api/demo', demoRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes); // Admin-only cross-organization endpoints
app.use('/api/admin/automation-rules', automationRuleRoutes); // Admin automation rule management
app.use('/api/admin/processes', processRoutes); // Admin process management
app.use('/api/admin/approvals', approvalRoutes); // Approval decision API (Phase 3)
app.use('/api/approvals', approvalRoutes); // User-facing approval inbox (Phase 4C)
app.use('/api/admin/business-flows', businessFlowRoutes); // Business Flow UI (Phase 4D)
app.use('/api/admin/business-flow-templates', businessFlowTemplateRoutes); // Business Flow Templates (Default Templates)
app.use('/api/automation', automationContextRoutes); // Automation context visibility (read-only)
app.use('/api/admin/notifications', notificationAnalyticsRoutes); // Admin notification analytics
app.use('/api/admin/addon-pricing', require('./routes/addonPricingAdminRoutes')); // Master org addon pricing
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/notification-preferences', notificationPreferenceRoutes);
app.use('/api/notification-rules', notificationRuleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/data-changes', require('./routes/dataChangeStreamRoutes'));
app.use('/api/ai', aiRoutes);
app.use('/api/ai/v2', astraV2Routes);
app.use('/api/astra/studio', astraStudioRoutes);
app.use('/api/connectors/tally/agent', tallyAgentRoutes);
app.use('/api/connectors/tally', tallyConnectorRoutes);
app.use('/api/helpdesk/cases', caseRoutes);
app.use('/api/helpdesk/articles', helpdeskArticlesRoutes);
app.use('/api/marketing/campaigns', marketingCampaignRoutes);
app.use('/api/marketing/audiences', marketingAudienceRoutes);
app.use('/api/marketing/segments', marketingSegmentRoutes);
app.use('/api/marketing/dashboard', marketingDashboardRoutes);
app.use('/api/marketing/reports', marketingReportsRoutes);
app.use('/api/marketing/subscriptions', marketingSubscriptionRoutes);
app.use('/api/marketing/assets', marketingAssetRoutes);
app.use('/api/marketing/blog', marketingBlogRoutes);
app.use('/api/lms', require('./routes/learningRoutes'));
app.use('/api/quotes', quoteRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/customer-statements', customerStatementRoutes);
app.use('/api/payment-links', paymentLinkRoutes);
app.use('/api/bank-transfer-instructions', require('./routes/bankTransferInstructionRoutes'));
const { srRouter } = require('./routes/fulfillmentDocRoutes');
const {
  itemGroupRouter,
  productConfigurationRouter,
  pricingRouter,
  stockroomAddonRouter
} = require('./routes/cpqAndStockroomRoutes');
// Mount specific /api/inventory/* commercial paths BEFORE the ledger router.
app.use('/api/inventory/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/inventory/receipt-notes', require('./routes/receiptNoteRoutes'));
app.use('/api/inventory/purchase-returns', require('./routes/purchaseReturnRoutes'));
app.use('/api/inventory/purchase-bills', require('./routes/purchaseBillRoutes'));
app.use('/api/inventory/vendor-payments', require('./routes/vendorPaymentRoutes'));
app.use('/api/inventory/vendor-catalog', require('./routes/vendorCatalogRoutes'));
app.use('/api/inventory/journals', require('./routes/journalRoutes'));
app.use('/api/inventory/delivery-notes', require('./routes/deliveryNoteRoutes'));
app.use('/api/inventory/delivery-returns', require('./routes/deliveryReturnRoutes'));
app.use('/api/inventory/sales-returns', srRouter);
app.use('/api/inventory/stockrooms', stockroomAddonRouter);
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/payment-gateways', paymentGatewayRoutes);
app.use('/api/push', pushRoutes);
app.use('/internal/notifications', notificationHealthRoutes); // Internal notification health endpoint
app.use('/health', healthRoutes); // Public health check endpoint
// New versioned endpoints (non-breaking)
app.use('/api/people', peopleRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/communications', require('./routes/communicationsRoutes'));
app.use('/api/mailboxes', require('./routes/mailboxRoutes'));
app.use('/api/webhooks/email', require('./routes/inboundEmailWebhookRoutes'));
app.use('/api/hooks/process', require('./routes/processWebhookRoutes'));
app.use('/api/notes', notesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/v2/organization', organizationV2Routes);
const organizationSurfaceRoutes = require('./routes/organizationSurfaceRoutes');
app.use('/api/organizations', organizationSurfaceRoutes);
app.use('/api/modules', moduleRecordRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/business-hours', require('./routes/businessHoursRoutes'));
app.use('/api/public/forms', formRoutes); // Public form routes (Audit / Survey — do not use for Webforms)
app.use('/api/public/webforms', webformRoutes); // Public webform routes
app.use('/api/public/book', require('./routes/publicBookingRoutes'));
app.use('/api/public/appointments/manage', require('./routes/publicAppointmentManageRoutes'));
app.use('/api/public/quotes', require('./routes/publicQuoteRoutes'));
app.use('/api/public/mailroom', require('./routes/publicMailroomRoutes'));
app.use('/api/public/marketing', publicMarketingRoutes);
app.use('/api/public/content', require('./routes/publicContentRoutes'));
app.use('/api/public/v1/content', require('./routes/publicContentRoutes'));
// Public embeddable live chat widget APIs (M6)
app.use('/embed/chat', embedChatRoutes);
// Some deployments only proxy /api/* to the Node server (frontend serves all other paths).
// Mount the embed chat APIs under /api as well so the widget can work in those setups.
app.use('/api/embed/chat', embedChatRoutes);
app.get(
  '/api/appointments/calendar/google/callback',
  require('./controllers/appointmentCalendarController').googleOAuthCallback
);
app.get(
  '/api/appointments/calendar/microsoft/callback',
  require('./controllers/appointmentCalendarController').microsoftOAuthCallback
);
app.get(
  '/api/user/calendar-connections/google/callback',
  require('./controllers/userCalendarConnectionController').googleOAuthCallback
);
app.get(
  '/api/user/calendar-connections/microsoft/callback',
  require('./controllers/userCalendarConnectionController').microsoftOAuthCallback
);
// Google Calendar push (events.watch) — must stay public; verified via channel token
app.post(
  '/api/user/calendar-connections/google/push',
  require('./controllers/userCalendarConnectionController').googlePushNotification
);
app.use('/api/user/calendar-connections', require('./routes/userCalendarConnectionRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/forms', formRoutes.protected); // Protected form routes (Audit / Survey)
app.use('/api/webforms', webformRoutes.protected); // Protected webform routes
app.use('/api/reports', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/analytics/reports>; rel="successor-version"');
  res.set('X-Analytics-Migration', 'Use /api/analytics/reports for new integrations');
  next();
}, reportRoutes);
app.use('/api/analytics/reports', require('./routes/analyticsReportRoutes'));
app.use('/api/analytics/widgets', require('./routes/analyticsWidgetRoutes'));
app.use('/api/analytics/dashboards', require('./routes/analyticsDashboardRoutes'));
app.use('/api/analytics/schedules', require('./routes/analyticsScheduleRoutes'));
app.use('/api/analytics/snapshots', require('./routes/analyticsSnapshotRoutes'));
app.use('/api/analytics/alerts', require('./routes/analyticsAlertRoutes'));
app.use('/api/analytics/api-tokens', require('./routes/analyticsApiTokenRoutes'));
app.use('/api/analytics/v1', require('./routes/analyticsV1Routes'));
app.use('/api/analytics/embed', require('./routes/analyticsEmbedRoutes'));
app.use('/api/analytics', require('./routes/analyticsMetaRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/document-folders', require('./routes/documentFolderRoutes'));
app.use('/api/templates', require('./routes/contentTemplateRoutes'));
app.use('/api/content-themes', require('./routes/contentThemeRoutes'));
app.use('/api/content-assets', require('./routes/contentAssetRoutes'));
app.use('/api/content-fonts', require('./routes/contentFontRoutes'));
app.use('/api/content-studio', contentStudioRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/catalog', require('./routes/catalogRoutes'));
app.use('/api/taxes', require('./routes/taxRoutes'));
app.use('/api/charges', require('./routes/chargeRoutes'));
app.use('/api/item-groups', itemGroupRouter);
app.use('/api/product-configurations', productConfigurationRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/trash', trashRoutes);
app.use('/api/upload', uploadRoutes);

// Inbox Routes (Cross-app attention surface)
app.use('/api/inbox', inboxRoutes);
app.use('/api/live-chat', liveChatRoutes);
app.use('/api/internal-chat', require('./routes/internalChatRoutes'));
app.use('/api/telephony/webhooks', telephonyWebhookRoutes);
app.use('/api/telephony', telephonyRoutes);
app.use('/api/announcements', announcementRoutes);

// Platform home snapshot (landing page)
app.use('/api/platform', require('./routes/platformHomeRoutes'));
app.use('/api/onboarding', require('./routes/onboardingRoutes'));
app.use('/api/platform/inbound-parser', require('./routes/platformInboundParserRoutes'));
app.use('/api/platform/ai-settings', require('./routes/platformAiSettingsRoutes'));
app.use('/api/platform/amds', require('./routes/platformAmdsRoutes'));
app.use('/api/platform/release-notes', require('./routes/platformReleaseNoteRoutes'));
app.use('/api/platform/announcements', require('./routes/platformAnnouncementRoutes'));
app.use('/api/release-notes', require('./routes/releaseNoteRoutes'));

// Portal Application Routes (App #2)
app.use('/portal', portalRoutes);

// Audit Application Routes (App #3)
app.use('/api/audit', auditRoutes);
app.use('/api/audit/execute', auditExecutionRoutes);
app.use('/api/audit/assignments', auditReadRoutes);

// Digest Routes (for manual triggering/testing)
app.use('/api/digest', digestRoutes);

// UI Composition Routes (Phase 0D)
app.use('/api/ui', uiCompositionRoutes);

// Configuration Registry Routes
app.use('/api/config-registry', configRegistryRoutes);

// Relationship Routes (Phase 0E)
app.use('/api/relationships', relationshipRoutes);

// Response Detail Routes (Phase 0I.2 - Read-Only)
app.use('/api/responses', responseRoutes);

// Settings Routes
app.use('/api/settings', settingsRoutes);
app.use('/api/duplicates', require('./routes/duplicatePreventionRoutes'));
app.use('/api/mailroom', mailroomRoutes);

// Targets & Quotas (platform performance)
app.use('/api/targets', require('./routes/targetRoutes'));

// Serve uploaded files (including reports)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
        // Set appropriate content type for PDFs
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
        }
        // Set appropriate content type for SVGs (required for inline display)
        if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
        }
        // Set appropriate content type for Excel files
        if (filePath.endsWith('.xlsx')) {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        }
    }
}));

// 1. Database Connection
console.log('🔄 Connecting to MongoDB...');

// Feature flags (defaults can be overridden via environment)
process.env.FEATURE_READ_THROUGH_PEOPLE = typeof process.env.FEATURE_READ_THROUGH_PEOPLE === 'undefined' ? 'true' : process.env.FEATURE_READ_THROUGH_PEOPLE;
process.env.FEATURE_CONTACTS_USE_PEOPLE = typeof process.env.FEATURE_CONTACTS_USE_PEOPLE === 'undefined' ? 'true' : process.env.FEATURE_CONTACTS_USE_PEOPLE;
process.env.FEATURE_READ_THROUGH_ORG = typeof process.env.FEATURE_READ_THROUGH_ORG === 'undefined' ? 'true' : process.env.FEATURE_READ_THROUGH_ORG;
process.env.FEATURE_ORG_USE_V2 = typeof process.env.FEATURE_ORG_USE_V2 === 'undefined' ? 'true' : process.env.FEATURE_ORG_USE_V2;
process.env.FEATURE_DUAL_WRITE_PEOPLE = typeof process.env.FEATURE_DUAL_WRITE_PEOPLE === 'undefined' ? 'false' : process.env.FEATURE_DUAL_WRITE_PEOPLE;
process.env.FEATURE_DUAL_WRITE_ORG = typeof process.env.FEATURE_DUAL_WRITE_ORG === 'undefined' ? 'false' : process.env.FEATURE_DUAL_WRITE_ORG;

console.log('🧪 Feature Flags:', {
  FEATURE_READ_THROUGH_PEOPLE: process.env.FEATURE_READ_THROUGH_PEOPLE,
  FEATURE_CONTACTS_USE_PEOPLE: process.env.FEATURE_CONTACTS_USE_PEOPLE,
  FEATURE_READ_THROUGH_ORG: process.env.FEATURE_READ_THROUGH_ORG,
  FEATURE_ORG_USE_V2: process.env.FEATURE_ORG_USE_V2,
  FEATURE_DUAL_WRITE_PEOPLE: process.env.FEATURE_DUAL_WRITE_PEOPLE,
  FEATURE_DUAL_WRITE_ORG: process.env.FEATURE_DUAL_WRITE_ORG
});

// Connect to master database (for Organizations, Users, DemoRequests)
connectMasterWithRetry(masterUri)
  .then(async () => {
    console.log('✅ Master database connected successfully.');
    console.log(`📊 Database: ${MASTER_DB}`);
    console.log(`📊 Connection: ${MONGO_URI.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas'}`);
    
    // Initialize database connection manager
    const dbConnectionManager = require('./utils/databaseConnectionManager');
    // Set base URI for organization database connections
    dbConnectionManager.baseMongoUri = baseUri;
    dbConnectionManager.connectionQuery = mongoQueryString;
    await dbConnectionManager.initializeMasterConnection();
    console.log('✅ Database connection manager initialized');
    
    // 1.5. Check and seed platform definitions if needed
    try {
      const AppDefinition = require('./models/AppDefinition');
      const ModuleDefinition = require('./models/ModuleDefinition');
      
      // Check if platform definitions exist
      const salesApp = await AppDefinition.findOne({ appKey: 'sales' });
      const platformModule = await ModuleDefinition.findOne({ 
        appKey: 'platform', 
        organizationId: null,
        moduleKey: 'people' // Check for a specific platform module
      });
      
      if (!salesApp || !platformModule) {
        console.log('📦 Platform definitions not found, seeding...');
        const seedPlatformDefinitionsWithUI = require('./scripts/seedPlatformDefinitionsWithUI');
        // Pass true to use existing connection (don't connect/disconnect)
        await seedPlatformDefinitionsWithUI(true);
        console.log('✅ Platform definitions seeded successfully');
      } else {
        console.log('✅ Platform definitions already exist, skipping seed');
      }
    } catch (seedError) {
      console.warn('⚠️  Failed to check/seed platform definitions:', seedError.message);
      // Don't block server startup if seeding fails
    }

    // 1.55. Ensure addon catalog is complete in master DB (AddonDefinition lives in arivu_master)
    try {
      const AddonDefinition = require('./models/AddonDefinition');
      const { VALID_ADDON_KEYS } = require('./constants/addonKeys');
      const registeredAddonKeys = await AddonDefinition.find({
        addonKey: { $in: VALID_ADDON_KEYS },
      }).distinct('addonKey');
      if (registeredAddonKeys.length < VALID_ADDON_KEYS.length) {
        const missingAddonKeys = VALID_ADDON_KEYS.filter((key) => !registeredAddonKeys.includes(key));
        console.log(`📦 Addon catalog incomplete (missing: ${missingAddonKeys.join(', ')}), seeding...`);
        const { ensureAddonCatalogSeeded } = require('./scripts/seedAddonDefinitions');
        const result = await ensureAddonCatalogSeeded({ useExistingConnection: true });
        console.log(
          `✅ Addon catalog seeded (live_chat: ${result.defResultLiveChat}, email_credits: ${result.defResultEmailCredits}, articles: ${result.defResultArticles}, blog: ${result.defResultBlog}, ai: ${result.defResultAi}, ai_credits: ${result.defResultAiCredits})`
        );
      } else {
        console.log(`✅ Addon catalog present (${registeredAddonKeys.length} registered addon(s))`);
      }
    } catch (addonSeedError) {
      console.warn('⚠️  Failed to check/seed addon catalog:', addonSeedError.message);
    }

    // 1.56. Ensure Content Studio sidebar modules exist (helpdesk.articles, marketing.blog)
    try {
      const ModuleDefinition = require('./models/ModuleDefinition');
      const articlesModule = await ModuleDefinition.findOne({
        appKey: 'helpdesk',
        moduleKey: 'articles',
        organizationId: null,
      }).select('_id');
      const blogModule = await ModuleDefinition.findOne({
        appKey: 'marketing',
        moduleKey: 'blog',
        organizationId: null,
      }).select('_id');
      if (!articlesModule || !blogModule) {
        console.log('📦 Content Studio modules incomplete, seeding...');
        const { ensureContentStudioModulesSeeded } = require('./scripts/migrateContentStudioModules');
        const result = await ensureContentStudioModulesSeeded({ useExistingConnection: true });
        console.log(
          `✅ Content Studio modules seeded (articles: ${result.articlesResult}, blog: ${result.blogResult})`
        );
      }
    } catch (contentStudioSeedError) {
      console.warn('⚠️  Failed to check/seed Content Studio modules:', contentStudioSeedError.message);
    }

    // 1.6. Register default Task relationships + seed settings defaults (safe to run repeatedly)
    try {
      const { registerDefaultTaskRelationships } = require('./services/taskRelationshipInitializer');
      await registerDefaultTaskRelationships();
      console.log('✅ Task relationship defaults registered');
    } catch (relError) {
      console.warn('⚠️  Failed to register default Task relationships:', relError.message);
    }

    // 1.65. Ensure platform quote relationship definitions exist (idempotent)
    try {
      const { ensureQuoteRelationshipDefinitions } = require('./constants/defaultQuoteRelationships');
      await ensureQuoteRelationshipDefinitions();
      console.log('✅ Quote relationship defaults ensured');
    } catch (quoteRelError) {
      console.warn('⚠️  Failed to ensure quote relationship defaults:', quoteRelError.message);
    }

    // 1.66. Register default document attachment relationships (idempotent)
    try {
      const { ensureDocumentRelationshipDefinitions } = require('./constants/defaultDocumentRelationships');
      await ensureDocumentRelationshipDefinitions();
      console.log('✅ Document attachment relationship defaults registered');
    } catch (docRelError) {
      console.warn('⚠️  Failed to register document attachment relationships:', docRelError.message);
    }

    // 1.7. Refresh relationship key cache (registry.has) for validation without DB hits
    try {
      const relationshipRegistry = require('./utils/relationshipRegistry');
      await relationshipRegistry.refreshRelationshipKeyCache();
      console.log('✅ Relationship key cache refreshed');
    } catch (cacheErr) {
      console.warn('⚠️  Failed to refresh relationship key cache:', cacheErr.message);
    }

    // 2. Start Monitoring Services (if enabled)
    if (process.env.ENABLE_HEALTH_CHECKER !== 'false') {
      const healthChecker = require('./services/monitoring/healthChecker');
      healthChecker.start();
      console.log('✅ Health checker started');
    }
    
    if (process.env.ENABLE_METRICS_COLLECTOR !== 'false') {
      const metricsCollector = require('./services/monitoring/metricsCollector');
      metricsCollector.start();
      console.log('✅ Metrics collector started');
    }
    
    // 3. Start scheduled jobs (digests, escalations, trash retention, Gmail inbox sync, …)
    //    Master switch: ENABLE_SCHEDULED_JOBS=false disables all cron registered here.
    //    Individual toggles (e.g. ENABLE_DIGEST_SCHEDULER) still apply inside scheduledJobs.
    if (process.env.ENABLE_SCHEDULED_JOBS !== 'false') {
      const scheduledJobs = require('./services/scheduledJobs');
      scheduledJobs.startScheduledJobs();
      console.log('✅ Scheduled jobs started');
    } else {
      console.log('⏭️  Scheduled jobs disabled (ENABLE_SCHEDULED_JOBS=false)');
    }

    // 3b. Initialize automation engine (domain events → rule resolution → dry-run planning)
    const automationEngine = require('./services/automationEngine');
    automationEngine.init();
    console.log('✅ Automation engine initialized');

    // 3c. Initialize process executor (domain events → process execution)
    const processExecutor = require('./services/processExecutor');
    processExecutor.init();
    console.log('✅ Process executor initialized');

    // 3c2. Initialize target contribution engine (domain events → target ledger)
    const targetContributionEngine = require('./services/targets/targetContributionEngine');
    targetContributionEngine.init();
    console.log('✅ Target contribution engine initialized');

    // 3d. Start email queue worker in this process (unless a dedicated worker runs — set ENABLE_BULL_IN_WEB=false on API)
    if (process.env.ENABLE_BULL_IN_WEB !== 'false') {
      try {
        const emailQueueService = require('./services/emailQueueService');
        emailQueueService.startWorker();
        const inboundEmailQueueService = require('./services/inboundEmailQueueService');
        inboundEmailQueueService.startWorker();
        const importQueueService = require('./services/import/importQueueService');
        importQueueService.startWorker();
        const campaignSendQueueService = require('./services/marketing/campaignSendQueueService');
        campaignSendQueueService.startWorker();
        const analyticsScheduleQueueService = require('./services/analytics/analyticsScheduleQueueService');
        analyticsScheduleQueueService.startWorker();
        const { startAnalyticsAlertScheduler } = require('./services/analytics/analyticsAlertScheduler');
        startAnalyticsAlertScheduler();
        const { startTallySyncScheduler } = require('./services/connectors/tally/tallySyncScheduler');
        startTallySyncScheduler();
        const {
          startMailroomFailureRetryWorker
        } = require('./platform/mailroom/workers/processingFailureRetryWorker');
        startMailroomFailureRetryWorker();
        console.log('✅ Email + inbound + import queue consumers running in web process (set ENABLE_BULL_IN_WEB=false if using a dedicated worker)');
      } catch (eqErr) {
        console.warn('⚠️  Email queue worker not started:', eqErr.message);
      }
    } else {
      console.log('⏭️  Email queue consumer disabled in web (ENABLE_BULL_IN_WEB=false); use worker process for Bull.');
    }

    try {
      const { startNotificationSSESubscriber } = require('./services/notificationSSEPubSub');
      await startNotificationSSESubscriber();
    } catch (sseSubErr) {
      console.warn('⚠️  Notification SSE cluster subscriber not started:', sseSubErr.message);
    }
    
    // 4. Start Server after successful DB connection
    server = app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  ✅ Arivu API is running.                             ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`🔧 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      console.log(`💚 Health: http://localhost:${PORT}/health/ready (readiness) | /health/live (liveness)`);
      console.log('');
    });

    try {
      const { attachStudioWebSocket } = require('./realtime/studioWsGateway');
      attachStudioWebSocket(server);
    } catch (wsErr) {
      console.warn('⚠️  Astra Studio WebSocket gateway not started:', wsErr.message);
    }

    try {
      const { registerAutomation } = require('./services/astraStudio/automationService');
      registerAutomation();
    } catch (autoErr) {
      console.warn('⚠️  Astra Studio automation not started:', autoErr.message);
    }
  })
  .catch(err => {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║  ❌ DATABASE CONNECTION FAILED!                       ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('🔍 Error Details:', err.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check if MongoDB is running (local) or accessible (Atlas)');
    console.error('   2. Verify MONGO_URI in .env file');
    console.error('   3. Check network connectivity for MongoDB Atlas');
    console.error('   4. Verify database credentials');
    console.error('');
    process.exit(1);
  });

// 3. Basic Test Route
app.get('/', (req, res) => {
  res.send('Arivu API is operational.');
});

// Unmatched API routes must return JSON (never Express HTML), so clients never toast
// "Server returned non-JSON response (404): <!DOCTYPE html>...".
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Not found: ${req.method} ${req.originalUrl}`
  });
});

// Sentry Express error handler: must be after all routes
installExpressSentryErrorHandler(app);

// Graceful shutdown handler
let isGracefulShutdown = false;

function isRedisOrphanReplyError(err) {
  if (!err || err.name !== 'TypeError') return false;
  const message = String(err.message || '');
  return message.includes("'resolve'") && message.includes('shift');
}

process.on('uncaughtException', (err) => {
  if (isGracefulShutdown && isRedisOrphanReplyError(err)) {
    console.warn('[server] Ignoring node-redis orphan reply during shutdown');
    return;
  }
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

const gracefulShutdown = async (signal) => {
  if (isGracefulShutdown) return;
  isGracefulShutdown = true;
  console.log(`\n[server] Received ${signal}, starting graceful shutdown...`);
  
  // Shutdown SSE hub
  try {
    try {
      const { stopNotificationSSESubscriber } = require('./services/notificationSSEPubSub');
      await stopNotificationSSESubscriber();
    } catch (_err) {
      // ignore
    }
    const notificationSSEHub = require('./services/notificationSSEHub');
    console.log('[server] Shutting down notification SSE hub...');
    notificationSSEHub.shutdown();
    const inboxSSEHub = require('./services/inboxSSEHub');
    console.log('[server] Shutting down inbox SSE hub...');
    inboxSSEHub.shutdown();
  } catch (err) {
    console.error('[server] Error shutting down SSE hub:', err.message);
  }
  
  // Stop scheduled jobs
  try {
    const scheduledJobs = require('./services/scheduledJobs');
    console.log('[server] Stopping scheduled jobs...');
    scheduledJobs.stopScheduledJobs();
  } catch (err) {
    console.error('[server] Error stopping scheduled jobs:', err.message);
  }

  try {
    const emailQueueService = require('./services/emailQueueService');
    await emailQueueService.closeQueue();
    console.log('[server] Email queue closed');
  } catch (err) {
    console.error('[server] Error closing email queue:', err.message);
  }

  try {
    const { closeAllRedisConnections } = require('./lib/redisClient');
    await closeAllRedisConnections();
    console.log('[server] Redis client closed');
  } catch (err) {
    console.error('[server] Error closing Redis client:', err.message);
  }
  
  // Close server
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(async () => {
      console.log('[server] HTTP server closed');
      
      // Close MongoDB connection (Mongoose 7+ returns a Promise, no callback)
      try {
        await mongoose.connection.close();
        console.log('[server] MongoDB connection closed');
        try {
          await flushSentry(2000);
        } catch (e) {
          /* optional */
        }
        console.log('[server] Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        console.error('[server] Error closing MongoDB connection:', err.message);
        process.exit(1);
      }
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    try {
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('[server] Error closing MongoDB connection:', err.message);
      process.exit(1);
    }
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
