const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/settingsController');
const settingsAuditController = require('../controllers/settingsAuditController');
const helpdeskSettingsController = require('../controllers/helpdeskSettingsController');
const assignmentRulesController = require('../controllers/assignmentRulesController');
const slaPolicyController = require('../controllers/slaPolicyController');
const mailroomSettingsController = require('../controllers/mailroomSettingsController');
const quoteSettingsController = require('../controllers/quoteSettingsController');
const moduleNumberingController = require('../controllers/moduleNumberingController');
const webformController = require('../controllers/webformController');
const addonSettingsController = require('../controllers/addonSettingsController');
const amdsDomainsController = require('../controllers/amdsDomainsController');
const emailPolicyController = require('../controllers/emailPolicyController');
const { organizationSettingsLimiter, sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccessfulMutation,
} = require('../middleware/responseCacheMiddleware');
const {
    createSettingsAuditMiddleware,
    resolveSettingsApiSurface,
} = require('../middleware/settingsAuditMiddleware');

// All routes require authentication and organization context
router.use(protect);
router.use(organizationIsolation);
router.use(
    createSettingsAuditMiddleware({
        surfaceResolver: (req) => resolveSettingsApiSurface(req.originalUrl || req.path),
    })
);

// Admin-only settings change history
router.get('/audit-log', requireAdmin(), settingsAuditController.listSettingsAuditLogs);

// Core Modules endpoints
router.get('/core-modules', sessionBootstrapLimiter, controller.getCoreModules);
router.get('/core-modules/:moduleKey', sessionBootstrapLimiter, controller.getCoreModule);
router.patch('/core-modules/:moduleKey/applications/:appKey', controller.toggleAppParticipation);

// Organization Status-Types endpoints (specific to organizations module)
router.get('/core-modules/organizations/status-types', sessionBootstrapLimiter, controller.getOrganizationStatusTypes);
router.patch('/core-modules/organizations/status-types', controller.updateOrganizationStatusTypes);

// Events status lifecycle (category system-owned; values tenant-configurable for non-audit types)
const eventStatusLifecycleController = require('../controllers/eventStatusLifecycleController');
router.get(
  '/core-modules/events/status-lifecycle',
  sessionBootstrapLimiter,
  eventStatusLifecycleController.getEventStatusLifecycle
);
router.put(
  '/core-modules/events/status-lifecycle/:eventTypeKey',
  requireAdmin(),
  eventStatusLifecycleController.updateEventStatusLifecycle
);

// Closed Records (Core Platform lifecycle configuration)
const closedRecordsController = require('../controllers/closedRecordsController');
router.get('/closed-records/modules', sessionBootstrapLimiter, closedRecordsController.listModules);
router.get(
  '/closed-records/:moduleKey',
  sessionBootstrapLimiter,
  closedRecordsController.getConfig
);
router.get(
  '/closed-records/:moduleKey/picklist',
  sessionBootstrapLimiter,
  closedRecordsController.getPicklist
);
router.put(
  '/closed-records/:moduleKey',
  requireAdmin(),
  closedRecordsController.saveConfig
);
router.post(
  '/closed-records/:moduleKey/:id/reopen',
  closedRecordsController.reopenRecord
);
router.get('/core-modules/organizations/participation-types/usage', sessionBootstrapLimiter, controller.getOrganizationParticipationTypesUsage);
router.get('/core-modules/organizations/participation-types', sessionBootstrapLimiter, controller.getOrganizationParticipationTypes);
router.put('/core-modules/organizations/participation-types', controller.updateOrganizationParticipationTypes);

// People types endpoint (tenant-configurable, e.g. Lead, Contact)
router.get('/core-modules/people/people-types/usage', sessionBootstrapLimiter, controller.getPeopleTypesUsage);
router.get('/core-modules/people/people-types', sessionBootstrapLimiter, controller.getPeopleTypes);
router.put('/core-modules/people/people-types', controller.updatePeopleTypes);

// Applications endpoints
router.get('/applications', cacheJsonResponse({ namespace: 'settings:applications:v2' }), controller.getApplications);
router.get('/applications/helpdesk/execution-settings', helpdeskSettingsController.getHelpdeskExecutionSettings);
router.put('/applications/helpdesk/execution-settings', helpdeskSettingsController.updateHelpdeskExecutionSettings);
router.post('/applications/helpdesk/recalculate-slas', helpdeskSettingsController.recalculateOpenCaseSlas);
router.get('/quotes', quoteSettingsController.getQuoteSettings);
router.put('/quotes', quoteSettingsController.updateQuoteSettings);

// Module Numbering (Settings → Automation → Module Numbering)
router.get('/module-numbering', moduleNumberingController.listModuleNumbering);
router.get('/module-numbering/:moduleKey', moduleNumberingController.getModuleNumbering);
router.put('/module-numbering/:moduleKey', moduleNumberingController.updateModuleNumbering);
router.post('/module-numbering/:moduleKey/preview', moduleNumberingController.previewModuleNumbering);
router.post(
  '/module-numbering/:moduleKey/resync-sequence',
  moduleNumberingController.resyncModuleNumbering
);
router.get('/applications/:appKey', controller.getApplication);

// Addons (tenant-scoped installable capabilities)
router.get('/addons', addonSettingsController.listAddons);
router.get('/addons/articles/settings', addonSettingsController.getArticlesAddonSettings);
router.put('/addons/articles/settings', addonSettingsController.updateArticlesAddonSettings);
router.post('/addons/articles/settings/test-webhook', addonSettingsController.sendArticlesPublishWebhookTest);
router.post('/addons/articles/settings/generate-webhook-secret', addonSettingsController.generateArticlesPublishWebhookSecret);
router.get('/addons/blog/settings', addonSettingsController.getBlogAddonSettings);
router.put('/addons/blog/settings', addonSettingsController.updateBlogAddonSettings);
router.post('/addons/blog/settings/test-webhook', addonSettingsController.sendBlogPublishWebhookTest);
router.post('/addons/blog/settings/generate-webhook-secret', addonSettingsController.generateBlogPublishWebhookSecret);
router.use('/addons/tally/settings', require('./tallyAddonSettingsRoutes'));
router.get('/addons/live_chat/widget', addonSettingsController.getLiveChatWidgetSettings);
router.put('/addons/live_chat/widget', addonSettingsController.updateLiveChatWidgetSettings);
router.get('/addons/live_chat/outcomes', addonSettingsController.getLiveChatOutcomeSettings);
router.put('/addons/live_chat/outcomes', addonSettingsController.updateLiveChatOutcomeSettings);
router.get('/addons/live_chat/session-fields', addonSettingsController.getLiveChatSessionFieldSettings);
router.put('/addons/live_chat/session-fields', addonSettingsController.updateLiveChatSessionFieldSettings);
router.post('/addons/email_credits/purchase', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.purchaseEmailCreditPack);
router.post('/addons/ai_credits/purchase', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.purchaseAiCreditPack);
router.get('/addons/:addonKey', addonSettingsController.getAddon);
router.post('/addons/:addonKey/install', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.installAddon);
router.post('/addons/:addonKey/enable', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.enableAddon);
router.post('/addons/:addonKey/disable', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.disableAddon);
router.post('/addons/:addonKey/archive', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.archiveAddon);
router.post('/addons/:addonKey/uninstall', invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }), addonSettingsController.uninstallAddon);

// Webforms (Settings metadata — separate from Audit forms)
router.get('/webforms/modules', webformController.getWebformModules);
router.get('/webforms/field-types', webformController.getWebformFieldTypes);

// Assignment Rules (metadata-driven, module-scoped)
router.get('/automation/assignment-rules/metadata', assignmentRulesController.getAssignmentRulesMetadata);
router.get('/automation/assignment-rules/list', assignmentRulesController.listAssignmentRuleSets);
router.get('/automation/assignment-rules', assignmentRulesController.getAssignmentRuleSet);
router.put('/automation/assignment-rules', assignmentRulesController.upsertAssignmentRuleSet);
router.post('/automation/assignment-rules/simulate', assignmentRulesController.simulateAssignmentRules);

// Generic SLA Policy Engine
router.get('/automation/sla-policies/metadata', slaPolicyController.getSlaPolicyMetadata);
router.get('/automation/sla-policies', slaPolicyController.listSlaPolicies);
router.get('/automation/sla-policies/:policyKey', slaPolicyController.getSlaPolicy);
router.put('/automation/sla-policies/:policyKey', slaPolicyController.upsertSlaPolicy);
router.delete('/automation/sla-policies/:policyKey', slaPolicyController.deleteSlaPolicy);
router.post('/automation/sla-policies/simulate', slaPolicyController.simulateSlaPolicy);
router.post('/automation/sla-policies/migrate-helpdesk', slaPolicyController.migrateHelpdeskSlaPolicies);
router.post('/automation/sla-policies/:policyKey/set-default', slaPolicyController.setDefaultSlaPolicy);

// Mailroom (conversation-first ingestion policies)
router.get('/automation/mailroom', mailroomSettingsController.getMailroomSettings);
router.put('/automation/mailroom', mailroomSettingsController.updateMailroomSettings);
router.get('/automation/mailroom/templates', mailroomSettingsController.listMailroomTemplates);
router.post('/automation/mailroom/evaluate', mailroomSettingsController.evaluateMailroomPolicies);
router.get('/automation/mailroom/conversations', mailroomSettingsController.listMailroomConversations);
router.get('/automation/mailroom/conversations/:id', mailroomSettingsController.getMailroomConversation);
router.get(
  '/automation/mailroom/conversations/:conversationId/attachments',
  mailroomSettingsController.listMailroomConversationAttachments
);
router.get(
  '/automation/mailroom/messages/:messageId/attachments',
  mailroomSettingsController.listMailroomMessageAttachments
);
router.get('/automation/mailroom/threading-logs', mailroomSettingsController.listMailroomThreadingLogs);
router.get('/automation/mailroom/failures', mailroomSettingsController.listMailroomProcessingFailures);
router.get('/automation/mailroom/metrics', mailroomSettingsController.getMailroomMetrics);
router.get('/automation/mailroom/routing-logs', mailroomSettingsController.listMailroomRoutingLogs);
router.get('/automation/mailroom/search', mailroomSettingsController.searchMailroom);
router.post('/automation/mailroom/failures/:rawPayloadId/replay', mailroomSettingsController.replayMailroomProcessingFailure);

// Subscriptions endpoints
router.get('/subscriptions/trial-status', controller.getTrialStatus);
router.post(
    '/subscriptions/extend-trial',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:subscriptions:v2' }),
    controller.extendTrial
);
router.get('/subscriptions', cacheJsonResponse({ namespace: 'settings:subscriptions:v2' }), controller.getSubscriptions);
router.get('/subscriptions/:appKey', controller.getSubscription);

// Organization settings endpoints
router.get(
    '/organization',
    organizationSettingsLimiter,
    cacheJsonResponse({ namespace: 'settings:organization' }),
    controller.getOrganizationSettings
);
router.put(
    '/organization',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    controller.updateOrganizationSettings
);
router.post(
    '/organization/logo',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    uploadSingle('logo'),
    controller.uploadOrganizationLogo
);
router.delete(
    '/organization/logo',
    invalidateCacheOnSuccessfulMutation({ namespace: 'settings:organization' }),
    controller.deleteOrganizationLogo
);

// Security settings endpoints
router.get('/security', controller.getSecuritySettings);
router.put('/security', controller.updateSecuritySettings);
router.get('/security/activity', controller.getSecurityActivity);

// Billing / usage (V1 external users — collect only)
router.get('/billing/external-user-usage', controller.getExternalUserUsage);

// Integrations settings endpoints
router.get('/integrations', controller.getIntegrations);
router.get('/integrations/:key', controller.getIntegration);
router.post('/integrations/:key/enable', controller.enableIntegration);
router.post('/integrations/:key/disable', controller.disableIntegration);
router.post('/integrations/:key/test', controller.testIntegration);
router.put('/integrations/:key/config', controller.updateIntegrationConfig);

// AMDS sending domains (proxy to AMDS API)
router.post('/email/domains', amdsDomainsController.registerEmailDomain);
router.get('/email/domains/:domain', amdsDomainsController.getEmailDomain);
router.post('/email/domains/:domain/verify', amdsDomainsController.verifyEmailDomain);

// Org email credits & limits (Track 6 Phase 1)
router.get('/email-policy', emailPolicyController.getEmailPolicy);
router.put('/email-policy/limits', emailPolicyController.updateEmailPolicyLimits);
router.get('/email-policy/sync', emailPolicyController.forceEmailPolicySync);
router.post('/email-policy/credits', emailPolicyController.allocateEmailCredits);
router.post('/email-policy/suspend', emailPolicyController.suspendEmailPolicy);
router.post('/email-policy/reactivate', emailPolicyController.reactivateEmailPolicy);
router.get('/email-policy/reputation/history', emailPolicyController.getEmailReputationHistory);
router.get('/email-policy/reputation/guidance', emailPolicyController.getEmailReputationGuidance);

module.exports = router;
