/**
 * ============================================================================
 * PLATFORM CORE: Settings Controller
 * ============================================================================
 * 
 * This controller handles Settings API endpoints:
 * - Core Modules (read-only)
 * - Applications (read-only)
 * - Subscriptions (read-only)
 * - Users & Access
 * - Security
 * - Integrations
 * 
 * All data comes from registries (ModuleDefinition, AppDefinition, etc.)
 * No business logic inference - all metadata from backend
 * ============================================================================
 */

const mongoose = require('mongoose');
const dns = require('node:dns').promises;
const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const User = require('../models/User');
const People = require('../models/People');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const integrationRegistry = require('../constants/integrationRegistry');
const emailService = require('../services/emailService');
const {
    buildOciSmtpHost,
    applyOciEmailDeliveryDefaults
} = require('../services/emailProviders/ociEmailDelivery');
const { applyResendDefaults, RESEND_PROVIDER } = require('../constants/resendDefaults');
const amdsEmailDelivery = require('../services/emailProviders/amdsEmailDelivery');
const communicationPlatformService = require('../platform/communication/api/communicationPlatformService');
const {
    getCommunicationConfigForOrganization,
    getEmailIntegrationPolicyBundleForOrganization,
    upsertCommunicationConfigForOrganization,
    getGmailOAuthAppCredentialsForServer
} = require('../platform/communication/config/communicationConfigService');
const {
    INITIAL_QUOTE_QUICK_CREATE,
    applyQuoteModuleFieldDefaults
} = require('../constants/quoteModuleDefaults');
const {
    INITIAL_SALES_ORDER_QUICK_CREATE,
    applySalesOrderModuleFieldDefaults
} = require('../constants/salesOrderModuleDefaults');
const { SALES_ORDER_STATUSES } = require('../constants/salesOrderLifecycle');
const {
    INITIAL_INVOICE_QUICK_CREATE,
    applyInvoiceModuleFieldDefaults
} = require('../constants/invoiceModuleDefaults');
const { INVOICE_STATUSES } = require('../constants/invoiceLifecycle');
const {
    INITIAL_PAYMENT_QUICK_CREATE,
    applyPaymentModuleFieldDefaults,
    INITIAL_PAYMENT_FIELDS
} = require('../constants/paymentModuleDefaults');
const { PAYMENT_STATUSES } = require('../constants/paymentLifecycle');
const {
    cloneQuoteDefaultRelationships,
    ensureQuoteRelationshipDefinitions
} = require('../constants/defaultQuoteRelationships');
const {
    commercialModuleIconId,
    shouldNormalizeCommercialIcon
} = require('../constants/commercialModuleIcons');
const {
    INITIAL_DOCUMENT_QUICK_CREATE,
    INITIAL_DOCUMENT_FIELDS,
    cloneDocumentDefaultRelationships,
    applyDocumentModuleFieldDefaults
} = require('../constants/documentModuleDefaults');
const {
    INITIAL_TEMPLATE_MODULE_FIELDS,
    INITIAL_TEMPLATE_QUICK_CREATE,
    applyTemplateModuleFieldDefaults
} = require('../constants/contentTemplateModuleDefaults');
const { buildAddonSubscriptionLineItems } = require('../services/subscriptionAddonLineItemsService');
const { normalizeAddonKey } = require('../constants/addonKeys');
const { normalizeSubscriptionLimit } = require('../utils/subscriptionLimits');

function applyCommercialUiIconPatch(existing, moduleKey, patch) {
    if (existing && shouldNormalizeCommercialIcon(existing.ui?.icon, moduleKey)) {
        patch['ui.icon'] = commercialModuleIconId(moduleKey);
    }
}

function maskSecret(value) {
    if (!value) return '';
    const raw = String(value);
    if (raw.length <= 8) return '********';
    return `${raw.slice(0, 4)}****${raw.slice(-2)}`;
}

function resolveEmailProviderKey(config = {}) {
    const normalized = String(config.provider || '').trim().toLowerCase();
    if (normalized) return normalized;
    if (amdsEmailDelivery.isAmdsEnvConfigured()) return amdsEmailDelivery.PROVIDER_KEY;
    const envProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    if (envProvider) return envProvider;
    return RESEND_PROVIDER;
}

function normalizeEmailIntegrationConfig(config = {}) {
    if (amdsEmailDelivery.isAmdsProvider(config)) {
        return amdsEmailDelivery.applyAmdsDefaults(config);
    }
    return applyResendDefaults(applyOciEmailDeliveryDefaults(config));
}

function sanitizeEmailConfigForResponse(config = {}) {
    const normalized = normalizeEmailIntegrationConfig(config);
    return {
        provider: resolveEmailProviderKey(normalized),
        fromEmail: normalized.fromEmail || '',
        fromName: normalized.fromName || '',
        replyTo: normalized.replyTo || '',
        ociRegion: normalized.ociRegion || '',
        smtpHost: normalized.smtpHost || '',
        smtpPort: normalized.smtpPort || '',
        smtpUser: normalized.smtpUser || '',
        smtpSecure: normalized.smtpSecure === true,
        smtpPassMasked: normalized.smtpPass ? maskSecret(normalized.smtpPass) : '',
        hasSmtpPass: !!normalized.smtpPass,
        awsRegion: normalized.awsRegion || '',
        awsAccessKeyId: normalized.awsAccessKeyId || '',
        awsSecretAccessKeyMasked: normalized.awsSecretAccessKey
            ? maskSecret(normalized.awsSecretAccessKey)
            : '',
        hasAwsSecretAccessKey: !!normalized.awsSecretAccessKey
    };
}

function getEnvEmailConfigFallback() {
    const { applyResendDefaults } = require('../constants/resendDefaults');
    const smtpPortRaw = process.env.SMTP_PORT;
    const smtpPort = smtpPortRaw ? Number(smtpPortRaw) || 587 : 587;
    const base = {
        provider: process.env.EMAIL_PROVIDER || amdsEmailDelivery.defaultProviderWhenUnset() || 'resend',
        fromEmail: process.env.EMAIL_FROM || '',
        fromName: process.env.EMAIL_FROM_NAME || '',
        replyTo: process.env.EMAIL_REPLY_TO || '',
        ociRegion: process.env.OCI_EMAIL_REGION || process.env.OCI_REGION || '',
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort,
        smtpUser: process.env.SMTP_USER || '',
        smtpSecure: String(smtpPort) === '465',
        smtpPass: process.env.SMTP_PASS || process.env.RESEND_API_KEY || ''
    };
    if (amdsEmailDelivery.isAmdsProvider(base) && amdsEmailDelivery.isAmdsEnvConfigured()) {
        return amdsEmailDelivery.applyAmdsDefaults(base);
    }
    return applyResendDefaults(applyOciEmailDeliveryDefaults(base));
}

function toComparable(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function buildEmailProviderListExtras(state = {}) {
    const tenantConfig = state.config && typeof state.config === 'object' ? state.config : null;
    const resolvedConfig = tenantConfig && Object.keys(tenantConfig).length > 0
        ? tenantConfig
        : getEnvEmailConfigFallback();
    const amdsServerConfigured = amdsEmailDelivery.isAmdsEnvConfigured();
    return {
        configStatus: emailService.isConfiguredFromResolvedConfig(resolvedConfig)
            ? 'configured'
            : 'not_configured',
        emailConfig: sanitizeEmailConfigForResponse(resolvedConfig),
        amdsServerConfigured,
        emailDomainVerification: buildEmailDomainVerificationStub(resolvedConfig),
        emailPlatformDefaults: {
            crmOutboundProvider: amdsServerConfigured ? 'amds' : RESEND_PROVIDER,
            notificationProvider: amdsServerConfigured ? 'amds' : 'oci-email-delivery'
        }
    };
}

function canManageGmailOAuthRead(req) {
    const isOwnerLikeRead = req.user?.isOwner === true || String(req.user?.role || '').toLowerCase() === 'owner';
    const emailLowerRead = String(req.user?.email || '').toLowerCase();
    const internalStaffRead =
        emailLowerRead.endsWith('@arivusystems.com') ||
        emailLowerRead.endsWith('@arivu.com') ||
        emailLowerRead.endsWith('@arivu.io');
    return isOwnerLikeRead || req.user?.isPlatformAdmin === true || internalStaffRead;
}

function buildEmailCommunicationPolicyPayload(req, communicationConfig = {}) {
    const rawGmailPolicy = communicationConfig.gmailInboxSync || {
        clientId: '',
        redirectUri: '',
        hasClientSecret: false
    };
    return {
        outboundEmail: communicationConfig.outboundEmail,
        supportedModuleKeys: communicationPlatformService.getSupportedModules(),
        gmailInboxSync: canManageGmailOAuthRead(req)
            ? rawGmailPolicy
            : { clientId: '', redirectUri: '', hasClientSecret: false }
    };
}

async function attachEmailIntegrationPolicy(req, payload) {
    const { communicationConfig, gmailOAuthAppConfigured } =
        await getEmailIntegrationPolicyBundleForOrganization(req.user.organizationId);
    payload.gmailOAuthAppConfigured = gmailOAuthAppConfigured;
    payload.communicationPolicy = buildEmailCommunicationPolicyPayload(req, communicationConfig);
}

function classifyDnsError(error) {
    const code = String(error?.code || '');
    if (code === 'ENOTFOUND' || code === 'ENODATA') return 'no_record';
    if (code === 'ETIMEOUT' || code === 'ESERVFAIL' || code === 'EAI_AGAIN') return 'dns_unreachable';
    return 'lookup_error';
}

async function resolveTxtRecords(hostname) {
    try {
        const records = await dns.resolveTxt(hostname);
        const flattened = (records || []).map((parts) => parts.join('')).filter(Boolean);
        return { ok: true, records: flattened };
    } catch (error) {
        return { ok: false, error };
    }
}

function buildEmailDomainVerificationStub(config = {}) {
    const email = String(config.fromEmail || '').trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : '';
    if (!domain) {
        return {
            domain: '',
            checkedAt: null,
            senderIdentity: {
                status: 'missing_sender',
                note: 'Set a valid From Email to evaluate sender domain.'
            },
            spf: { status: 'missing_sender', note: 'No sender domain available.' },
            dkim: { status: 'missing_sender', note: 'No sender domain available.' },
            dmarc: { status: 'missing_sender', note: 'No sender domain available.' }
        };
    }

    return {
        domain,
        checkedAt: null,
        senderIdentity: {
            status: 'not_checked',
            note: 'Open the Domain tab or click Check Status to verify DNS records.'
        },
        spf: { status: 'not_checked', note: 'Not verified yet.' },
        dkim: { status: 'not_checked', note: 'Not verified yet.' },
        dmarc: { status: 'not_checked', note: 'Not verified yet.' }
    };
}

async function deriveEmailDomainVerification(config = {}) {
    const email = String(config.fromEmail || '').trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : '';
    if (!domain) {
        return buildEmailDomainVerificationStub(config);
    }

    const [rootTxt, dmarcTxt, selector1Txt, selector2Txt, resendDkimTxt] = await Promise.all([
        resolveTxtRecords(domain),
        resolveTxtRecords(`_dmarc.${domain}`),
        resolveTxtRecords(`selector1._domainkey.${domain}`),
        resolveTxtRecords(`selector2._domainkey.${domain}`),
        resolveTxtRecords(`resend._domainkey.${domain}`)
    ]);

    const rootRecords = rootTxt.ok ? rootTxt.records : [];
    const hasSpf = rootRecords.some((line) => /^v=spf1\b/i.test(line));
    const dmarcRecords = dmarcTxt.ok ? dmarcTxt.records : [];
    const hasDmarc = dmarcRecords.some((line) => /^v=dmarc1\b/i.test(line));

    const dkimSources = [selector1Txt, selector2Txt, resendDkimTxt];
    const dkimRecords = dkimSources
        .filter((result) => result.ok)
        .flatMap((result) => result.records);
    const hasDkim = dkimRecords.some((line) => /v=dkim1|k=rsa|p=/i.test(line));

    const senderIdentityStatus = hasSpf || hasDmarc || hasDkim ? 'configured' : 'unverified';

    return {
        domain,
        checkedAt: new Date().toISOString(),
        senderIdentity: {
            status: senderIdentityStatus,
            note: senderIdentityStatus === 'configured'
                ? 'At least one sender-auth DNS signal is present.'
                : 'No SPF, DKIM, or DMARC records detected yet.'
        },
        spf: {
            status: hasSpf ? 'configured' : (rootTxt.ok ? 'missing' : classifyDnsError(rootTxt.error)),
            note: hasSpf
                ? 'SPF TXT record found on root domain.'
                : (rootTxt.ok ? 'No SPF TXT record found on root domain.' : `DNS lookup failed: ${rootTxt.error?.code || 'unknown'}`)
        },
        dkim: {
            status: hasDkim
                ? 'configured'
                : (dkimSources.some((result) => result.ok)
                    ? 'missing'
                    : classifyDnsError(dkimSources.find((result) => !result.ok)?.error)),
            note: hasDkim
                ? 'DKIM TXT record found for common selectors.'
                : 'No DKIM TXT record found for selector1/selector2/resend selectors.'
        },
        dmarc: {
            status: hasDmarc ? 'configured' : (dmarcTxt.ok ? 'missing' : classifyDnsError(dmarcTxt.error)),
            note: hasDmarc
                ? 'DMARC TXT record found at _dmarc subdomain.'
                : (dmarcTxt.ok ? 'No DMARC TXT record found at _dmarc subdomain.' : `DNS lookup failed: ${dmarcTxt.error?.code || 'unknown'}`)
        }
    };
}

function buildIntegrationAuditEntry(req, event, details) {
    const userLabel = req.user?.username || req.user?.email || 'Unknown';
    return {
        user: userLabel,
        userId: req.user?._id || null,
        action: event,
        details,
        timestamp: new Date()
    };
}

/**
 * Persist a single integration key without full Organization.save() validation.
 * Tenant org records may predate required CRM fields (e.g. assignedTo); partial
 * $set avoids blocking integration settings updates on unrelated schema paths.
 */
async function persistOrganizationIntegrationUpdate(organizationId, integrationKey, nextState, auditEntries = []) {
    const update = {
        $set: {
            [`integrations.${integrationKey}`]: nextState
        }
    };
    if (auditEntries.length > 0) {
        update.$push = {
            activityLogs: { $each: auditEntries }
        };
    }
    await Organization.findByIdAndUpdate(organizationId, update, { runValidators: false });
}

/**
 * Get all core modules with their application usage
 * GET /api/settings/core-modules
 */
exports.getCoreModules = async (req, res) => {
    try {
        await ensurePlatformQuotesModuleDefinition();
        await ensurePlatformSalesOrdersModuleDefinition();
        await ensurePlatformInvoicesModuleDefinition();
        await ensurePlatformPaymentsModuleDefinition();
        await ensurePlatformDocumentsModuleDefinition();
        await ensurePlatformTemplatesModuleDefinition();
        await ensurePlatformReportsModuleDefinition();
        await ensurePlatformDashboardsModuleDefinition();
        await ensurePlatformAnalyticsModuleDefinition();
        try {
            const { ensureInventoryAppModuleDefinitions } = require('../services/inventoryModuleBootstrapService');
            await ensureInventoryAppModuleDefinitions();
        } catch (invErr) {
            console.warn('[settings] ensureInventoryAppModuleDefinitions failed:', invErr.message);
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Get enabled apps for this organization (defensive: handle null/undefined entries and legacy shapes)
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        const rawApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
        const enabledAppKeys = rawApps
            .filter(app => app != null && (typeof app === 'object' ? app.status === 'ACTIVE' : typeof app === 'string' && app.length > 0))
            .map(app => typeof app === 'string' ? app : (app && app.appKey))
            .filter(Boolean)
            .map(key => String(key).toUpperCase())
            .filter(appKey => VALID_APPS.includes(appKey));

        // Core platform modules with explicit ordering
        // Order: People, Organization, Task, Event, Item, Form (new modules added at the bottom)
        const coreModuleOrder = ['people', 'organizations', 'tasks', 'events', 'items', 'forms', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents', 'templates', 'reports'];
        const coreModuleKeys = [...coreModuleOrder];

        // Get all platform-owned modules (appKey: 'platform')
        const platformModulesRaw = await ModuleDefinition.find({
            appKey: 'platform',
            moduleKey: { $in: coreModuleKeys }
        }).lean();

        // Defensive dedupe: data migrations/legacy docs can leave duplicate moduleKey rows.
        // Keep one document per moduleKey so Settings and Sidebar don't render duplicates.
        const platformModulesByKey = new Map();
        for (const module of platformModulesRaw) {
            const key = String(module?.moduleKey || '').toLowerCase();
            if (!key) continue;

            const existing = platformModulesByKey.get(key);
            if (!existing) {
                platformModulesByKey.set(key, module);
                continue;
            }

            // Prefer the richer definition when duplicates exist.
            const existingScore = Number(!!existing.label) + Number(!!existing.description);
            const nextScore = Number(!!module.label) + Number(!!module.description);
            if (nextScore > existingScore) {
                platformModulesByKey.set(key, module);
            }
        }

        // Get org-specific display name overrides (saved via Settings → Module details)
        // Query by both key and moduleKey (tenant overrides use key; some docs may have moduleKey)
        const orgOverrides = await ModuleDefinition.find({
            organizationId: req.user.organizationId,
            $or: [
                { key: { $in: coreModuleKeys } },
                { moduleKey: { $in: coreModuleKeys } }
            ]
        })
        .select('key moduleKey name')
        .lean();
        const nameOverridesByKey = {};
        for (const o of orgOverrides) {
            const name = typeof o.name === 'string' ? o.name.trim() : '';
            if (!name) continue;
            const key = (o.moduleKey || o.key || '').toLowerCase();
            if (key) nameOverridesByKey[key] = name;
            const keyAlt = (o.key || o.moduleKey || '').toLowerCase();
            if (keyAlt && keyAlt !== key) nameOverridesByKey[keyAlt] = name;
        }
        
        // Sort modules according to the defined order (modules not in coreModuleOrder go to the end)
        const platformModules = Array.from(platformModulesByKey.values()).sort((a, b) => {
            const orderA = coreModuleOrder.indexOf(a.moduleKey);
            const orderB = coreModuleOrder.indexOf(b.moduleKey);
            // If not in coreModuleOrder, place at end (use a high number)
            const effectiveOrderA = orderA === -1 ? 999 : orderA;
            const effectiveOrderB = orderB === -1 ? 999 : orderB;
            return effectiveOrderA - effectiveOrderB;
        });

        // Check organization-level overrides for module participation
        const moduleOverrides = organization.moduleOverrides || {};

        // Build modules response with application usage
        const modules = platformModules.map((module) => {
            const appsUsingModule = [];
            const moduleOverride = moduleOverrides[module.moduleKey] || {};

            // Determine which apps use this module
            // For core modules, all enabled apps can potentially use them
            // Required relationships come from app definitions (simplified for now)
            for (const appKey of enabledAppKeys) {
                const appKeyLower = appKey.toLowerCase();
                
                // Check if this app uses this module
                // Core modules are generally available to all apps
                // Some apps require specific modules (e.g., Sales requires People and Organizations)
                const requiredModules = getRequiredModulesForApp(appKeyLower);
                const isRequired = requiredModules.includes(module.moduleKey);
                
                // Check if there's an override for this app, otherwise default to enabled
                const overrideValue = moduleOverride[appKey];
                const enabled = overrideValue !== undefined ? overrideValue : true;
                
                appsUsingModule.push({
                    appKey: appKey,
                    appName: getAppName(appKeyLower),
                    required: isRequired,
                    enabled: enabled, // Use override if exists, otherwise default to enabled
                    canToggle: !isRequired, // Can toggle if not required
                    usage: getModuleUsage(module.moduleKey, appKeyLower)
                });
            }

            // Calculate order: modules in coreModuleOrder get their index, others go to the end
            const orderIndex = coreModuleOrder.indexOf(module.moduleKey);
            const order = orderIndex === -1 ? 999 : orderIndex;

            const displayName = nameOverridesByKey[module.moduleKey] || module.label || capitalizeFirst(module.moduleKey);
            return {
                moduleKey: module.moduleKey,
                name: displayName,
                description: module.description || `${displayName} - Shared platform capability`,
                icon: 'module',
                platformOwned: true,
                order: order,
                applications: appsUsingModule
            };
        });

        res.json({
            success: true,
            modules: modules
        });
    } catch (error) {
        console.error('Get core modules error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch core modules',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get detailed information about a specific core module
 * GET /api/settings/core-modules/:moduleKey
 */
exports.getCoreModule = async (req, res) => {
    try {
        const { moduleKey } = req.params;
        if (String(moduleKey || '').toLowerCase() === 'quotes') {
            await ensurePlatformQuotesModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'sales_orders') {
            await ensurePlatformSalesOrdersModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'invoices') {
            await ensurePlatformInvoicesModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'payments') {
            await ensurePlatformPaymentsModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'documents') {
            await ensurePlatformDocumentsModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'templates') {
            await ensurePlatformTemplatesModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'reports') {
            await ensurePlatformReportsModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'dashboards') {
            await ensurePlatformDashboardsModuleDefinition();
        }
        if (String(moduleKey || '').toLowerCase() === 'analytics') {
            await ensurePlatformAnalyticsModuleDefinition();
        }

        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Get the platform module
        const module = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: moduleKey.toLowerCase()
        }).lean();

        if (!module) {
            return res.status(404).json({
                success: false,
                message: 'Core module not found'
            });
        }

        // Get org-specific display name override (saved via Settings → Module details)
        const keyLower = moduleKey.toLowerCase();
        const orgOverride = await ModuleDefinition.findOne({
            organizationId: req.user.organizationId,
            $or: [{ key: keyLower }, { moduleKey: keyLower }]
        })
        .select('name')
        .lean();
        const displayName = (orgOverride?.name && typeof orgOverride.name === 'string' && orgOverride.name.trim())
            ? orgOverride.name.trim()
            : (module.label || capitalizeFirst(module.moduleKey));

        // Get enabled apps (defensive: handle null/undefined entries and legacy shapes)
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        const rawApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
        const enabledAppKeys = rawApps
            .filter(app => app != null && (typeof app === 'object' ? app.status === 'ACTIVE' : typeof app === 'string' && app.length > 0))
            .map(app => typeof app === 'string' ? app : (app && app.appKey))
            .filter(Boolean)
            .map(key => String(key).toUpperCase())
            .filter(appKey => VALID_APPS.includes(appKey));

        // Check organization-level overrides for module participation
        const moduleOverrides = organization.moduleOverrides || {};
        const moduleOverride = moduleOverrides[module.moduleKey] || {};

        // Build applications list
        const applications = [];
        for (const appKey of enabledAppKeys) {
            const appKeyLower = appKey.toLowerCase();
            const requiredModules = getRequiredModulesForApp(appKeyLower);
            const isRequired = requiredModules.includes(module.moduleKey);

            // Check if there's an override for this app, otherwise default to enabled
            const overrideValue = moduleOverride[appKey];
            const enabled = overrideValue !== undefined ? overrideValue : true;

            applications.push({
                appKey: appKey,
                appName: getAppName(appKeyLower),
                required: isRequired,
                enabled: enabled,
                canToggle: !isRequired,
                usage: getModuleUsage(module.moduleKey, appKeyLower),
                reason: isRequired ? 'This application requires this module' : null
            });
        }

        // Core module order: People, Organization, Task, Event, Item, Form (new modules at the end)
        const coreModuleOrder = ['people', 'organizations', 'tasks', 'events', 'items', 'forms', 'quotes', 'sales_orders', 'invoices', 'payments', 'documents'];
        const orderIndex = coreModuleOrder.indexOf(module.moduleKey);
        const order = orderIndex === -1 ? 999 : orderIndex;

        res.json({
            success: true,
            moduleKey: module.moduleKey,
            name: displayName,
            description: module.description || `${displayName} - Shared platform capability`,
            icon: 'module',
            platformOwned: true,
            order: order,
            applications: applications
        });
    } catch (error) {
        console.error('Get core module error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch core module',
            error: error.message
        });
    }
};

// Helper function to get app name
// Note: CRM is not an app - it's legacy terminology. Actual apps are: SALES, HELPDESK, PROJECTS, PORTAL, AUDIT, LMS
function getAppName(appKey) {
    const appNames = {
        'sales': 'Sales',
        'helpdesk': 'Helpdesk',
        'projects': 'Projects',
        'audit': 'Audit',
        'portal': 'Portal',
        'lms': 'LMS'
    };
    return appNames[appKey.toLowerCase()] || appKey.toUpperCase();
}

// Helper function to get required modules for an app
// In a full implementation, this would come from AppDefinition model
// Note: These are the actual apps in the system
function getRequiredModulesForApp(appKey) {
    const appKeyLower = appKey.toLowerCase();
    const requiredModulesMap = {
        'sales': ['people', 'organizations'], // Sales requires People and Organizations
        'helpdesk': ['people'], // Helpdesk requires People
        'projects': ['people'], // Projects requires People
        'audit': ['people'], // Audit requires People
        'portal': ['people'], // Portal requires People
        'lms': [], // LMS might not require any
        'inventory': ['people', 'items'],
        'marketing': ['people']
    };
    return requiredModulesMap[appKeyLower] || [];
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Ensures platform.quotes exists after promoting Quotes from Sales to core module. */
async function ensurePlatformQuotesModuleDefinition() {
    await ensureQuoteRelationshipDefinitions();

    const existing = await ModuleDefinition.findOne({
        appKey: 'platform',
        moduleKey: 'quotes',
        organizationId: null
    })
        .select('relationships quickCreate')
        .lean();

    if (existing) {
        const patch = {};
        if (!Array.isArray(existing.relationships) || existing.relationships.length === 0) {
            patch.relationships = cloneQuoteDefaultRelationships();
        }
        if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
            patch.quickCreate = [...INITIAL_QUOTE_QUICK_CREATE];
            patch.quickCreateLayout = { version: 1, rows: [] };
        }
        applyCommercialUiIconPatch(existing, 'quotes', patch);
        if (Object.keys(patch).length) {
            await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
        }
        return;
    }

    await ModuleDefinition.create({
        appKey: 'platform',
        moduleKey: 'quotes',
        organizationId: null,
        label: 'Quote',
        pluralLabel: 'Quotes',
        entityType: 'TRANSACTION',
        primaryField: 'quoteTitle',
        type: 'system',
        enabled: true,
        quickCreate: [...INITIAL_QUOTE_QUICK_CREATE],
        quickCreateLayout: { version: 1, rows: [] },
        relationships: cloneQuoteDefaultRelationships(),
        ui: {
            routeBase: '/quotes',
            icon: commercialModuleIconId('quotes'),
            showInSidebar: true,
            sidebarOrder: 8,
            createLabel: 'Create Quote',
            listLabel: 'All Quotes',
            navigationEntity: true,
            excludeFromApps: true
        }
    });
}

const INITIAL_SALES_ORDER_MODULE_FIELDS = [
    { key: 'orderTitle', label: 'Order Title', type: 'text', required: true },
    { key: 'salesOrderNumber', label: 'Order Number', type: 'text', system: true },
    { key: 'status', label: 'Status', type: 'select', options: SALES_ORDER_STATUSES },
    { key: 'fulfillmentMode', label: 'Fulfillment Mode', type: 'select', options: ['product', 'service', 'hybrid'] },
    { key: 'fulfillmentStatus', label: 'Fulfillment Status', type: 'text', system: true },
    { key: 'orderDate', label: 'Order Date', type: 'date' },
    { key: 'requestedDeliveryDate', label: 'Requested Delivery', type: 'date' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'grandTotal', label: 'Grand Total', type: 'currency', system: true },
    { key: 'contactId', label: 'Contact', type: 'lookup', lookupModule: 'people' },
    { key: 'organizationRefId', label: 'Account', type: 'lookup', lookupModule: 'organizations' },
    { key: 'dealId', label: 'Deal', type: 'lookup', lookupModule: 'deals' },
    { key: 'assignedTo', label: 'Assigned To', type: 'lookup', lookupModule: 'users' },
    { key: 'sourceQuoteNumber', label: 'Source Quote', type: 'text', system: true }
];

/** Ensures platform.sales_orders exists as a core module (mirrors Quotes bootstrap). */
async function ensurePlatformSalesOrdersModuleDefinition() {
    const existing = await ModuleDefinition.findOne({
        appKey: 'platform',
        moduleKey: 'sales_orders',
        organizationId: null
    })
        .select('fields quickCreate lifecycle')
        .lean();

    if (existing) {
        const patch = {};
        if (!Array.isArray(existing.fields) || existing.fields.length === 0) {
            patch.fields = applySalesOrderModuleFieldDefaults(INITIAL_SALES_ORDER_MODULE_FIELDS);
        }
        if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
            patch.quickCreate = [...INITIAL_SALES_ORDER_QUICK_CREATE];
            patch.quickCreateLayout = { version: 1, rows: [] };
        }
        if (!existing.lifecycle?.allowedStatuses?.length) {
            patch.lifecycle = {
                statusField: 'status',
                allowedStatuses: [...SALES_ORDER_STATUSES]
            };
        }
        applyCommercialUiIconPatch(existing, 'sales_orders', patch);
        if (Object.keys(patch).length) {
            await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
        }
        return;
    }

    await ModuleDefinition.create({
        appKey: 'platform',
        moduleKey: 'sales_orders',
        organizationId: null,
        label: 'Sales Order',
        pluralLabel: 'Sales Orders',
        entityType: 'TRANSACTION',
        primaryField: 'orderTitle',
        type: 'system',
        enabled: true,
        quickCreate: [...INITIAL_SALES_ORDER_QUICK_CREATE],
        quickCreateLayout: { version: 1, rows: [] },
        fields: applySalesOrderModuleFieldDefaults(INITIAL_SALES_ORDER_MODULE_FIELDS),
        relationships: [],
        lifecycle: {
            statusField: 'status',
            allowedStatuses: [...SALES_ORDER_STATUSES]
        },
        ui: {
            routeBase: '/sales-orders',
            icon: commercialModuleIconId('sales_orders'),
            showInSidebar: true,
            sidebarOrder: 9,
            createLabel: 'Create Sales Order',
            listLabel: 'All Sales Orders',
            navigationEntity: true,
            excludeFromApps: true
        }
    });
}

const INITIAL_INVOICE_MODULE_FIELDS = [
    { key: 'invoiceTitle', label: 'Invoice Title', type: 'text', required: true },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'text', system: true },
    { key: 'status', label: 'Status', type: 'select', options: INVOICE_STATUSES },
    { key: 'invoiceType', label: 'Invoice Type', type: 'select', options: ['standard', 'credit_note', 'debit_note', 'proforma'] },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'grandTotal', label: 'Grand Total', type: 'currency', system: true },
    { key: 'amountDue', label: 'Amount Due', type: 'currency', system: true },
    { key: 'contactId', label: 'Contact', type: 'lookup', lookupModule: 'people' },
    { key: 'organizationRefId', label: 'Account', type: 'lookup', lookupModule: 'organizations' },
    { key: 'dealId', label: 'Deal', type: 'lookup', lookupModule: 'deals' },
    { key: 'assignedTo', label: 'Assigned To', type: 'lookup', lookupModule: 'users' },
    { key: 'sourceContext', label: 'Source Context', type: 'text', system: true }
];

/** Ensures platform.invoices exists as a core module (mirrors Sales Orders bootstrap). */
async function ensurePlatformInvoicesModuleDefinition() {
    const existing = await ModuleDefinition.findOne({
        appKey: 'platform',
        moduleKey: 'invoices',
        organizationId: null
    })
        .select('fields quickCreate lifecycle')
        .lean();

    if (existing) {
        const patch = {};
        if (!Array.isArray(existing.fields) || existing.fields.length === 0) {
            patch.fields = applyInvoiceModuleFieldDefaults(INITIAL_INVOICE_MODULE_FIELDS);
        }
        if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
            patch.quickCreate = [...INITIAL_INVOICE_QUICK_CREATE];
            patch.quickCreateLayout = { version: 1, rows: [] };
        }
        if (!existing.lifecycle?.allowedStatuses?.length) {
            patch.lifecycle = {
                statusField: 'status',
                allowedStatuses: [...INVOICE_STATUSES]
            };
        }
        applyCommercialUiIconPatch(existing, 'invoices', patch);
        if (Object.keys(patch).length) {
            await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
        }
        return;
    }

    await ModuleDefinition.create({
        appKey: 'platform',
        moduleKey: 'invoices',
        organizationId: null,
        label: 'Invoice',
        pluralLabel: 'Invoices',
        entityType: 'TRANSACTION',
        primaryField: 'invoiceTitle',
        type: 'system',
        enabled: true,
        quickCreate: [...INITIAL_INVOICE_QUICK_CREATE],
        quickCreateLayout: { version: 1, rows: [] },
        fields: applyInvoiceModuleFieldDefaults(INITIAL_INVOICE_MODULE_FIELDS),
        relationships: [],
        lifecycle: {
            statusField: 'status',
            allowedStatuses: [...INVOICE_STATUSES]
        },
        ui: {
            routeBase: '/invoices',
            icon: commercialModuleIconId('invoices'),
            showInSidebar: true,
            sidebarOrder: 10,
            createLabel: 'Create Invoice',
            listLabel: 'All Invoices',
            navigationEntity: true,
            excludeFromApps: true
        }
    });
}

/** Ensures platform.payments exists as a core module (mirrors Invoices bootstrap). */
async function ensurePlatformPaymentsModuleDefinition() {
    const existing = await ModuleDefinition.findOne({
        appKey: 'platform',
        moduleKey: 'payments',
        organizationId: null
    })
        .select('fields quickCreate lifecycle ui key name')
        .lean();

    if (existing) {
        const patch = {
            key: 'payments',
            name: 'Payments'
        };
        if (!Array.isArray(existing.fields) || existing.fields.length === 0) {
            patch.fields = applyPaymentModuleFieldDefaults(INITIAL_PAYMENT_FIELDS);
        }
        if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
            patch.quickCreate = [...INITIAL_PAYMENT_QUICK_CREATE];
            patch.quickCreateLayout = { version: 1, rows: [] };
        }
        if (!existing.lifecycle?.allowedStatuses?.length) {
            patch.lifecycle = {
                statusField: 'status',
                allowedStatuses: [...PAYMENT_STATUSES]
            };
        }
        applyCommercialUiIconPatch(existing, 'payments', patch);
        if (Object.keys(patch).length) {
            await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
        }
        return;
    }

    await ModuleDefinition.create({
        appKey: 'platform',
        moduleKey: 'payments',
        key: 'payments',
        name: 'Payments',
        organizationId: null,
        label: 'Payment',
        pluralLabel: 'Payments',
        entityType: 'TRANSACTION',
        primaryField: 'paymentNumber',
        type: 'system',
        enabled: true,
        quickCreate: [...INITIAL_PAYMENT_QUICK_CREATE],
        quickCreateLayout: { version: 1, rows: [] },
        fields: applyPaymentModuleFieldDefaults(INITIAL_PAYMENT_FIELDS),
        relationships: [],
        lifecycle: {
            statusField: 'status',
            allowedStatuses: [...PAYMENT_STATUSES]
        },
        ui: {
            routeBase: '/payments',
            icon: commercialModuleIconId('payments'),
            showInSidebar: true,
            sidebarOrder: 11,
            createLabel: 'Record Payment',
            listLabel: 'All Payments',
            navigationEntity: true,
            excludeFromApps: true
        }
    });
}

/** Bootstrap platform templates core module when missing (Settings + sidebar registry path). */
async function ensurePlatformTemplatesModuleDefinition() {
    try {
        const templatesUi = {
            routeBase: '/templates',
            icon: 'rectangle-stack',
            showInSidebar: true,
            sidebarOrder: 10,
            createLabel: 'New Template',
            listLabel: 'Templates',
            navigationEntity: true,
            excludeFromApps: true
        };

        let existing = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: 'templates',
            organizationId: null
        })
            .select('_id ui label pluralLabel fields quickCreate quickCreateLayout')
            .lean();

        if (!existing) {
            existing = await ModuleDefinition.findOne({
                appKey: 'platform',
                moduleKey: 'templates',
                organizationId: { $exists: false }
            })
                .select('_id ui label pluralLabel fields quickCreate quickCreateLayout')
                .lean();
        }

        if (existing) {
            const patch = {};
            if (!existing.label) patch.label = 'Template';
            if (!existing.pluralLabel) patch.pluralLabel = 'Templates';
            patch.ui = { ...(existing.ui || {}), ...templatesUi };
            if (!Array.isArray(existing.fields) || existing.fields.length === 0) {
                patch.fields = applyTemplateModuleFieldDefaults(INITIAL_TEMPLATE_MODULE_FIELDS);
            }
            if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
                patch.quickCreate = [...INITIAL_TEMPLATE_QUICK_CREATE];
                patch.quickCreateLayout = { version: 1, rows: [] };
            }
            if (Object.keys(patch).length) {
                await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
            }
            return;
        }

        await ModuleDefinition.create({
            appKey: 'platform',
            moduleKey: 'templates',
            key: 'templates',
            name: 'Templates',
            organizationId: null,
            label: 'Template',
            pluralLabel: 'Templates',
            entityType: 'CORE',
            primaryField: 'name',
            type: 'system',
            enabled: true,
            fields: applyTemplateModuleFieldDefaults(INITIAL_TEMPLATE_MODULE_FIELDS),
            quickCreate: [...INITIAL_TEMPLATE_QUICK_CREATE],
            quickCreateLayout: { version: 1, rows: [] },
            peopleConstraints: {
                allowedTypes: [],
                required: false
            },
            organizationConstraints: {
                required: false
            },
            lifecycle: {
                statusField: 'status',
                allowedStatuses: ['draft', 'published', 'archived']
            },
            supports: {
                ownership: true,
                assignment: false,
                comments: false,
                attachments: false,
                automation: false
            },
            permissions: {
                create: true,
                edit: true,
                delete: true,
                view: true,
                publish: true,
                archive: true,
                render: true
            },
            ui: templatesUi
        });
    } catch (error) {
        console.warn('[settings] ensurePlatformTemplatesModuleDefinition failed:', error.message);
    }
}

/** Bootstrap platform analytics reports nav module when missing (Settings + sidebar registry path). */
async function ensurePlatformReportsModuleDefinition() {
    try {
        const reportsUi = {
            routeBase: '/analytics/reports',
            icon: 'chart-bar',
            showInSidebar: true,
            sidebarOrder: 210,
            createLabel: 'New Report',
            listLabel: 'Reports',
            navigationEntity: true,
            excludeFromApps: true
        };

        let existing = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: 'reports',
            organizationId: null
        })
            .select('_id ui label pluralLabel')
            .lean();

        if (!existing) {
            existing = await ModuleDefinition.findOne({
                appKey: 'platform',
                moduleKey: 'reports',
                organizationId: { $exists: false }
            })
                .select('_id ui label pluralLabel')
                .lean();
        }

        if (existing) {
            const patch = {};
            if (!existing.label) patch.label = 'Report';
            if (!existing.pluralLabel) patch.pluralLabel = 'Reports';
            patch.ui = { ...(existing.ui || {}), ...reportsUi, showInSidebar: true };
            if (Object.keys(patch).length) {
                await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
            }
            return;
        }

        await ModuleDefinition.create({
            appKey: 'platform',
            moduleKey: 'reports',
            key: 'reports',
            name: 'Reports',
            organizationId: null,
            label: 'Report',
            pluralLabel: 'Reports',
            entityType: 'ACTIVITY',
            primaryField: 'name',
            type: 'system',
            enabled: true,
            peopleConstraints: {
                allowedTypes: [],
                required: false
            },
            organizationConstraints: {
                required: false
            },
            lifecycle: {
                statusField: 'status',
                allowedStatuses: ['draft', 'published', 'archived']
            },
            supports: {
                ownership: true,
                assignment: false,
                comments: false,
                attachments: false,
                automation: false
            },
            permissions: {
                create: true,
                edit: true,
                delete: true,
                view: true
            },
            fields: [],
            ui: reportsUi
        });
    } catch (error) {
        console.warn('[settings] ensurePlatformReportsModuleDefinition failed:', error.message);
    }
}

/** Bootstrap platform analytics dashboards nav module when missing (Settings + sidebar registry path). */
async function ensurePlatformDashboardsModuleDefinition() {
    try {
        const dashboardsUi = {
            routeBase: '/analytics/dashboards',
            icon: 'squares-2x2',
            showInSidebar: false,
            sidebarOrder: 211,
            createLabel: 'New Dashboard',
            listLabel: 'Dashboards',
            navigationEntity: true,
            excludeFromApps: true
        };

        let existing = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: 'dashboards',
            organizationId: null
        })
            .select('_id ui label pluralLabel')
            .lean();

        if (!existing) {
            existing = await ModuleDefinition.findOne({
                appKey: 'platform',
                moduleKey: 'dashboards',
                organizationId: { $exists: false }
            })
                .select('_id ui label pluralLabel')
                .lean();
        }

        if (existing) {
            const patch = {};
            if (!existing.label) patch.label = 'Dashboard';
            if (!existing.pluralLabel) patch.pluralLabel = 'Dashboards';
            patch.ui = { ...(existing.ui || {}), ...dashboardsUi, showInSidebar: false };
            if (Object.keys(patch).length) {
                await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
            }
            return;
        }

        await ModuleDefinition.create({
            appKey: 'platform',
            moduleKey: 'dashboards',
            key: 'dashboards',
            name: 'Dashboards',
            organizationId: null,
            label: 'Dashboard',
            pluralLabel: 'Dashboards',
            entityType: 'ACTIVITY',
            primaryField: 'name',
            type: 'system',
            enabled: true,
            peopleConstraints: {
                allowedTypes: [],
                required: false
            },
            organizationConstraints: {
                required: false
            },
            lifecycle: {
                statusField: 'status',
                allowedStatuses: ['draft', 'published', 'archived']
            },
            supports: {
                ownership: true,
                assignment: false,
                comments: false,
                attachments: false,
                automation: false
            },
            permissions: {
                create: true,
                edit: true,
                delete: true,
                view: true
            },
            fields: [],
            ui: dashboardsUi
        });
    } catch (error) {
        console.warn('[settings] ensurePlatformDashboardsModuleDefinition failed:', error.message);
    }
}

/** Bootstrap platform analytics home nav module when missing. */
async function ensurePlatformAnalyticsModuleDefinition() {
    try {
        const analyticsUi = {
            routeBase: '/analytics',
            icon: 'chart-pie',
            showInSidebar: false,
            sidebarOrder: 209,
            createLabel: 'New Report',
            listLabel: 'Analytics',
            navigationEntity: true,
            excludeFromApps: true
        };

        let existing = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: 'analytics',
            organizationId: null
        })
            .select('_id ui label pluralLabel')
            .lean();

        if (!existing) {
            existing = await ModuleDefinition.findOne({
                appKey: 'platform',
                moduleKey: 'analytics',
                organizationId: { $exists: false }
            })
                .select('_id ui label pluralLabel')
                .lean();
        }

        if (existing) {
            const patch = {};
            if (!existing.label) patch.label = 'Analytics';
            if (!existing.pluralLabel) patch.pluralLabel = 'Analytics';
            patch.ui = { ...(existing.ui || {}), ...analyticsUi, showInSidebar: false };
            if (Object.keys(patch).length) {
                await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
            }
            return;
        }

        await ModuleDefinition.create({
            appKey: 'platform',
            moduleKey: 'analytics',
            key: 'analytics',
            name: 'Analytics',
            organizationId: null,
            label: 'Analytics',
            pluralLabel: 'Analytics',
            entityType: 'ACTIVITY',
            primaryField: 'name',
            type: 'system',
            enabled: true,
            peopleConstraints: { allowedTypes: [], required: false },
            organizationConstraints: { required: false },
            lifecycle: {
                statusField: 'status',
                allowedStatuses: ['draft', 'published', 'archived']
            },
            supports: {
                ownership: true,
                assignment: false,
                comments: false,
                attachments: false,
                automation: false
            },
            permissions: { create: true, edit: true, delete: true, view: true },
            fields: [],
            ui: analyticsUi
        });
    } catch (error) {
        console.warn('[settings] ensurePlatformAnalyticsModuleDefinition failed:', error.message);
    }
}

/** Bootstrap platform documents core module when missing (Settings + sidebar registry path). */
async function ensurePlatformDocumentsModuleDefinition() {
    try {
        const documentsUi = {
            routeBase: '/documents',
            icon: 'document-duplicate',
            showInSidebar: true,
            sidebarOrder: 9,
            createLabel: 'New Document',
            listLabel: 'Documents',
            navigationEntity: true,
            excludeFromApps: true
        };

        let existing = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: 'documents',
            organizationId: null
        })
            .select('_id ui label pluralLabel fields relationships quickCreate quickCreateLayout')
            .lean();

        if (!existing) {
            existing = await ModuleDefinition.findOne({
                appKey: 'platform',
                moduleKey: 'documents',
                organizationId: { $exists: false }
            })
                .select('_id ui label pluralLabel fields relationships quickCreate quickCreateLayout')
                .lean();
        }

        if (existing) {
            const patch = {};
            if (!existing.label) patch.label = 'Document';
            if (!existing.pluralLabel) patch.pluralLabel = 'Documents';
            patch.ui = { ...(existing.ui || {}), ...documentsUi };
            if (!Array.isArray(existing.fields) || existing.fields.length === 0) {
                patch.fields = applyDocumentModuleFieldDefaults(INITIAL_DOCUMENT_FIELDS);
            }
            if (!Array.isArray(existing.relationships) || existing.relationships.length === 0) {
                patch.relationships = cloneDocumentDefaultRelationships();
            }
            if (!Array.isArray(existing.quickCreate) || existing.quickCreate.length === 0) {
                patch.quickCreate = [...INITIAL_DOCUMENT_QUICK_CREATE];
                patch.quickCreateLayout = { version: 1, rows: [] };
            }
            if (Object.keys(patch).length) {
                await ModuleDefinition.updateOne({ _id: existing._id }, { $set: patch });
            }
            const { ensureDocumentRelationshipDefinitions } = require('../constants/defaultDocumentRelationships');
            await ensureDocumentRelationshipDefinitions();
            return;
        }

        await ModuleDefinition.create({
            appKey: 'platform',
            moduleKey: 'documents',
            key: 'documents',
            name: 'Documents',
            organizationId: null,
            label: 'Document',
            pluralLabel: 'Documents',
            entityType: 'CORE',
            primaryField: 'title',
            type: 'system',
            enabled: true,
            fields: applyDocumentModuleFieldDefaults(INITIAL_DOCUMENT_FIELDS),
            relationships: cloneDocumentDefaultRelationships(),
            quickCreate: [...INITIAL_DOCUMENT_QUICK_CREATE],
            quickCreateLayout: { version: 1, rows: [] },
            peopleConstraints: {
                allowedTypes: ['Contact'],
                required: false
            },
            organizationConstraints: {
                required: false
            },
            lifecycle: {
                statusField: 'status',
                allowedStatuses: ['draft', 'pending_review', 'approved', 'published', 'archived']
            },
            supports: {
                ownership: true,
                assignment: false,
                comments: true,
                attachments: true,
                automation: true
            },
            permissions: {
                create: true,
                edit: true,
                delete: true,
                view: true
            },
            ui: documentsUi
        });
        const { ensureDocumentRelationshipDefinitions } = require('../constants/defaultDocumentRelationships');
        await ensureDocumentRelationshipDefinitions();
    } catch (error) {
        console.warn('[settings] ensurePlatformDocumentsModuleDefinition failed:', error.message);
    }
}

/** Bootstrap platform quote-to-cash core modules when missing (sidebar registry path). */
exports.ensurePlatformDocumentsModuleDefinition = ensurePlatformDocumentsModuleDefinition;
exports.ensurePlatformReportsModuleDefinition = ensurePlatformReportsModuleDefinition;
exports.ensurePlatformDashboardsModuleDefinition = ensurePlatformDashboardsModuleDefinition;
exports.ensurePlatformAnalyticsModuleDefinition = ensurePlatformAnalyticsModuleDefinition;
exports.ensurePlatformTemplatesModuleDefinition = ensurePlatformTemplatesModuleDefinition;
exports.ensurePlatformCommercialCoreModules = async () => {
    await ensurePlatformQuotesModuleDefinition();
    await ensurePlatformSalesOrdersModuleDefinition();
    await ensurePlatformInvoicesModuleDefinition();
    await ensurePlatformPaymentsModuleDefinition();
    await ensurePlatformDocumentsModuleDefinition();
    await ensurePlatformTemplatesModuleDefinition();
    await ensurePlatformReportsModuleDefinition();
    await ensurePlatformDashboardsModuleDefinition();
    await ensurePlatformAnalyticsModuleDefinition();
    try {
        const { ensureInventoryAppModuleDefinitions } = require('../services/inventoryModuleBootstrapService');
        await ensureInventoryAppModuleDefinitions();
    } catch (error) {
        console.warn('[settings] ensureInventoryAppModuleDefinitions failed:', error.message);
    }
};

// Helper function to get module usage description
function getModuleUsage(moduleKey, appKey) {
    const usageMap = {
        'people': {
            'sales': 'Used for contact management and leads',
            'helpdesk': 'Used for customer contact information',
            'projects': 'Used for team member management',
            'audit': 'Used for auditor contact information',
            'portal': 'Used for customer profile management'
        },
        'organizations': {
            'sales': 'Used for company and account management',
            'helpdesk': 'Used for customer company information',
            'projects': 'Used for client organization management'
        },
        'events': {
            'sales': 'Used for meetings and customer interactions',
            'helpdesk': 'Used for support appointments',
            'projects': 'Used for project milestones and deadlines'
        },
        'tasks': {
            'sales': 'Used for sales activities and follow-ups',
            'helpdesk': 'Used for support task management',
            'projects': 'Used for project task tracking'
        },
        'forms': {
            'sales': 'Used for lead capture forms',
            'helpdesk': 'Used for support request forms',
            'projects': 'Used for project intake forms'
        },
        'items': {
            'sales': 'Used for product catalog',
            'projects': 'Used for project resources'
        },
        'quotes': {
            'sales': 'Used for proposals and price quotes',
            'helpdesk': 'Used for service quotes',
            'projects': 'Used for project estimates',
            'portal': 'Used for customer-facing quotes'
        },
        'sales_orders': {
            'sales': 'Used for order execution and fulfillment',
            'helpdesk': 'Used for service order fulfillment',
            'projects': 'Used for project delivery tracking',
            'portal': 'Used for customer order visibility'
        },
        'invoices': {
            'sales': 'Used for billing and receivables',
            'helpdesk': 'Used for service billing',
            'projects': 'Used for project invoicing',
            'portal': 'Used for customer invoice visibility'
        },
        'payments': {
            'sales': 'Used for cash collection against invoices',
            'helpdesk': 'Used for service payment recording',
            'projects': 'Used for project payment tracking',
            'portal': 'Used for customer payment visibility'
        },
        'documents': {
            'sales': 'Used for contracts, proposals, and deal attachments',
            'helpdesk': 'Used for support documentation and case files',
            'projects': 'Used for project deliverables and shared files',
            'audit': 'Used for compliance and audit documentation',
            'portal': 'Used for customer-facing document sharing'
        },
        'reports': {
            'sales': 'Used for sales analytics',
            'helpdesk': 'Used for support metrics',
            'projects': 'Used for project reporting'
        }
    };

    return usageMap[moduleKey]?.[appKey.toLowerCase()] || `Used by ${getAppName(appKey)}`;
}

/**
 * Toggle application participation in a core module
 * PATCH /api/settings/core-modules/:moduleKey/applications/:appKey
 */
exports.toggleAppParticipation = async (req, res) => {
    try {
        const { moduleKey, appKey } = req.params;
        const { enabled } = req.body;
        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Validate module exists
        const module = await ModuleDefinition.findOne({
            appKey: 'platform',
            moduleKey: moduleKey.toLowerCase()
        }).lean();

        if (!module) {
            return res.status(404).json({
                success: false,
                message: 'Core module not found'
            });
        }

        // Validate app key
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        const appKeyUpper = appKey.toUpperCase();
        if (!VALID_APPS.includes(appKeyUpper)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application key'
            });
        }

        // Check if app is enabled for organization
        const appEntry = organization.enabledApps?.find(
            app => (typeof app === 'string' ? app : app.appKey).toUpperCase() === appKeyUpper
        );

        if (!appEntry || (typeof appEntry === 'object' && appEntry.status !== 'ACTIVE')) {
            return res.status(400).json({
                success: false,
                message: 'Application is not enabled for this organization'
            });
        }

        // Check if app is required for this module
        const requiredModules = getRequiredModulesForApp(appKeyUpper.toLowerCase());
        const isRequired = requiredModules.includes(module.moduleKey);

        if (isRequired) {
            return res.status(403).json({
                success: false,
                message: 'Cannot disable required module for this application',
                code: 'REQUIRED_MODULE'
            });
        }

        // Store module participation override in organization
        // This is stored at organization level to track which apps use which core modules
        // Format: organization.moduleOverrides[moduleKey][appKey] = enabled
        // For Mixed type fields, we need to create a new object to ensure Mongoose tracks changes
        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const currentOverrides = organization.moduleOverrides || {};
        const beforeEnabled = !!(currentOverrides[module.moduleKey]?.[appKeyUpper]);
        const before = cloneForAudit({ enabled: beforeEnabled });
        const moduleOverrides = { ...currentOverrides };
        
        if (!moduleOverrides[module.moduleKey]) {
            moduleOverrides[module.moduleKey] = {};
        }
        
        // Create a new object for the module's overrides to ensure change tracking
        const moduleOverride = { ...moduleOverrides[module.moduleKey] };
        moduleOverride[appKeyUpper] = enabled === true;
        moduleOverrides[module.moduleKey] = moduleOverride;
        
        // Set the entire object to ensure Mongoose tracks the change
        organization.moduleOverrides = moduleOverrides;
        
        // Mark the field as modified for Mongoose to detect changes in Mixed type
        organization.markModified('moduleOverrides');
        
        // Clean up enabledApps to remove invalid app keys (like 'CRM') before saving
        // This prevents validation errors when saving the organization
        if (organization.enabledApps && Array.isArray(organization.enabledApps)) {
            organization.enabledApps = organization.enabledApps.filter(app => {
                const appKey = typeof app === 'string' ? app : app.appKey;
                return VALID_APPS.includes(appKey.toUpperCase());
            });
        }
        
        await organization.save();

        try {
            const { invalidateTenantPermissionCaches } = require('../services/rolePermissionCatalogService');
            invalidateTenantPermissionCaches(req.user.organizationId);
        } catch (_cacheErr) {
            console.warn('[toggleAppParticipation] cache invalidation failed:', _cacheErr.message);
        }

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({ enabled: enabled === true }),
            { keys: ['enabled'] }
        );

        res.json({
            success: true,
            message: `Application participation ${enabled ? 'enabled' : 'disabled'} successfully`,
            moduleKey: module.moduleKey,
            appKey: appKeyUpper,
            enabled: enabled
        });
    } catch (error) {
        console.error('Toggle app participation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to toggle application participation',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Get all applications with their status and dependencies
 * GET /api/settings/applications
 */
exports.getApplications = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Valid apps registry (platform apps currently supported for tenants)
        // NOTE: Helpdesk, Projects, and LMS have been removed from the platform
        // for this deployment. Keep this list in sync with AppDefinition seeds.
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];

        const AppDefinition = require('../models/AppDefinition');
        const platformApps = await AppDefinition.find({
            category: 'BUSINESS',
            enabled: true,
            appKey: { $ne: 'control_plane' }
        })
            .select('appKey name description icon ui marketplace')
            .lean();
        const platformAppByKey = new Map(
            platformApps.map((app) => [String(app.appKey).toUpperCase(), app])
        );
        
        // App metadata fallback when AppDefinition row is missing
        const appMetadata = {
            'SALES': {
                name: 'Sales',
                description: 'Manage your sales pipeline, deals, and customer relationships',
                icon: 'sales'
            },
            'HELPDESK': {
                name: 'Helpdesk',
                description: 'Manage cases, support workflows, and customer issues',
                icon: 'helpdesk'
            },
            'PROJECTS': {
                name: 'Projects',
                description: 'Plan and track projects, tasks, and deliverables',
                icon: 'projects'
            },
            'PORTAL': {
                name: 'Portal',
                description: 'Customer and partner self-service portal',
                icon: 'portal'
            },
            'AUDIT': {
                name: 'Audit',
                description: 'Audit and compliance tracking',
                icon: 'audit'
            },
            'LMS': {
                name: 'Learning',
                description: 'An intelligent learning platform for your people, customers, and partners',
                icon: 'lms'
            },
            'INVENTORY': {
                name: 'Inventory',
                description: 'Stock ledger, locations, reservations, and fulfillment',
                icon: 'cube'
            },
            'MARKETING': {
                name: 'Marketing',
                description: 'Email campaigns, audiences, templates, and marketing analytics',
                icon: 'megaphone'
            }
        };

        const { isAppEnabledForOrg, findEnabledAppEntryForOrg } = require('../utils/appAccessUtils');

        // Build applications list with status and dependencies
        const applications = VALID_APPS.map(appKey => {
            const appEntry = findEnabledAppEntryForOrg(organization, appKey);
            const platformApp = platformAppByKey.get(appKey);
            const metadata = platformApp
                ? {
                    name: platformApp.name,
                    description:
                        platformApp.marketplace?.shortDescription ||
                        platformApp.description ||
                        `${platformApp.name} application`,
                    icon: platformApp.ui?.icon || platformApp.icon || 'app'
                }
                : appMetadata[appKey];

            let status = 'DISABLED';
            if (appEntry) {
                const entryStatus = String(appEntry.status || '').toUpperCase();
                if (entryStatus === 'SUSPENDED') {
                    status = 'SUSPENDED';
                } else if (isAppEnabledForOrg(organization, appKey)) {
                    const isTrial = organization.subscription?.tier === 'trial';
                    status = isTrial ? 'TRIAL' : 'ENABLED';
                }
            }

            // Get dependencies (required core modules for this app)
            const requiredModules = getRequiredModulesForApp(appKey.toLowerCase());
            const dependencies = requiredModules.map(moduleKey => {
                // Get module name from ModuleDefinition or use default
                const moduleNames = {
                    'people': 'People',
                    'organizations': 'Organizations',
                    'events': 'Events',
                    'tasks': 'Tasks',
                    'forms': 'Forms',
                    'items': 'Items',
                    'quotes': 'Quotes',
                    'sales_orders': 'Sales Orders',
                    'invoices': 'Invoices',
                    'payments': 'Payments',
                    'reports': 'Reports'
                };
                return {
                    moduleKey: moduleKey,
                    moduleName: moduleNames[moduleKey] || capitalizeFirst(moduleKey),
                    required: true
                };
            });

            return {
                appKey: appKey,
                name: metadata?.name || appKey,
                description: metadata?.description || `${metadata?.name || appKey} application`,
                icon: metadata?.icon || 'app',
                status: status,
                dependencies: dependencies
            };
        });

        res.json({
            success: true,
            applications: applications
        });
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error.message
        });
    }
};

/**
 * Get detailed information about a specific application
 * GET /api/settings/applications/:appKey
 */
exports.getApplication = async (req, res) => {
    try {
        const { appKey } = req.params;
        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Validate app key
        // Keep in sync with getApplications VALID_APPS
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        const appKeyUpper = appKey.toUpperCase();
        if (!VALID_APPS.includes(appKeyUpper)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application key'
            });
        }

        if (appKeyUpper === 'INVENTORY') {
            try {
                const { ensureInventoryAppModuleDefinitions } = require('../services/inventoryModuleBootstrapService');
                await ensureInventoryAppModuleDefinitions();
            } catch (err) {
                console.warn('[settings] ensureInventoryAppModuleDefinitions failed:', err.message);
            }
        }

        // App metadata
        const appMetadata = {
            'SALES': {
                name: 'Sales',
                description: 'Manage your sales pipeline, deals, and customer relationships',
                icon: 'sales'
            },
            'HELPDESK': {
                name: 'Helpdesk',
                description: 'Manage cases, support workflows, and customer issues',
                icon: 'helpdesk'
            },
            'PROJECTS': {
                name: 'Projects',
                description: 'Plan and track projects, tasks, and deliverables',
                icon: 'projects'
            },
            'PORTAL': {
                name: 'Portal',
                description: 'Customer and partner self-service portal',
                icon: 'portal'
            },
            'AUDIT': {
                name: 'Audit',
                description: 'Audit and compliance tracking',
                icon: 'audit'
            },
            'LMS': {
                name: 'Learning',
                description: 'An intelligent learning platform for your people, customers, and partners',
                icon: 'lms'
            },
            'INVENTORY': {
                name: 'Inventory',
                description: 'Stock ledger, locations, reservations, and fulfillment',
                icon: 'cube'
            },
            'MARKETING': {
                name: 'Marketing',
                description: 'Email campaigns, audiences, templates, and marketing analytics',
                icon: 'megaphone'
            }
        };

        // Get app entry from organization
        const appEntry = organization.enabledApps?.find(
            app => (typeof app === 'string' ? app : app.appKey).toUpperCase() === appKeyUpper
        );

        // Determine status
        let status = 'DISABLED';
        if (appEntry) {
            if (appEntry.status === 'ACTIVE') {
                const isTrial = organization.subscription?.tier === 'trial';
                status = isTrial ? 'TRIAL' : 'ENABLED';
            } else {
                status = 'SUSPENDED';
            }
        }

        // Get dependencies
        const requiredModules = getRequiredModulesForApp(appKeyUpper.toLowerCase());
        const dependencies = requiredModules.map(moduleKey => {
            const moduleNames = {
                'people': 'People',
                'organizations': 'Organizations',
                'events': 'Events',
                'tasks': 'Tasks',
                'forms': 'Forms',
                'items': 'Items',
                'quotes': 'Quotes',
                'sales_orders': 'Sales Orders',
                'invoices': 'Invoices',
                'payments': 'Payments',
                'reports': 'Reports'
            };
            return {
                moduleKey: moduleKey,
                moduleName: moduleNames[moduleKey] || capitalizeFirst(moduleKey),
                required: true,
                description: getModuleUsage(moduleKey, appKeyUpper.toLowerCase())
            };
        });

        // Get optional modules (modules that this app can use but doesn't require)
        const allCoreModules = ['people', 'organizations', 'events', 'tasks', 'forms', 'items', 'quotes', 'sales_orders', 'invoices', 'payments', 'reports'];
        const optionalModules = allCoreModules
            .filter(moduleKey => !requiredModules.includes(moduleKey))
            .map(moduleKey => {
                // Check if this module is enabled for this app via moduleOverrides
                const isEnabled = organization.moduleOverrides?.[moduleKey]?.[appKeyUpper] !== false;
                
                const moduleNames = {
                    'people': 'People',
                    'organizations': 'Organizations',
                    'events': 'Events',
                    'tasks': 'Tasks',
                    'forms': 'Forms',
                    'items': 'Items',
                    'quotes': 'Quotes',
                    'sales_orders': 'Sales Orders',
                    'invoices': 'Invoices',
                    'payments': 'Payments',
                    'reports': 'Reports'
                };
                return {
                    moduleKey: moduleKey,
                    moduleName: moduleNames[moduleKey] || capitalizeFirst(moduleKey),
                    required: false,
                    enabled: isEnabled,
                    description: getModuleUsage(moduleKey, appKeyUpper.toLowerCase())
                };
            });

        const metadata = appMetadata[appKeyUpper] || {};

        res.json({
            success: true,
            appKey: appKeyUpper,
            name: metadata.name || appKeyUpper,
            description: metadata.description || `${metadata.name || appKeyUpper} application`,
            icon: metadata.icon || 'app',
            status: status,
            enabledAt: appEntry && typeof appEntry === 'object' ? appEntry.enabledAt : null,
            dependencies: {
                required: dependencies,
                optional: optionalModules
            }
        });
    } catch (error) {
        console.error('Get application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application',
            error: error.message
        });
    }
};


/**
 * Get all subscriptions (one per application)
 * GET /api/settings/subscriptions
 */
exports.getSubscriptions = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        
        // App metadata
        const appMetadata = {
            'SALES': {
                name: 'Sales',
                description: 'Sales pipeline and customer relationship management',
                usageMetrics: ['contacts', 'deals', 'users']
            },
            'HELPDESK': {
                name: 'Helpdesk',
                description: 'Customer support and ticket management',
                usageMetrics: ['tickets', 'agents', 'users']
            },
            'PROJECTS': {
                name: 'Projects',
                description: 'Project management and task tracking',
                usageMetrics: ['projects', 'tasks', 'users']
            },
            'PORTAL': {
                name: 'Portal',
                description: 'Customer self-service portal',
                usageMetrics: ['users', 'portal_visits']
            },
            'AUDIT': {
                name: 'Audit',
                description: 'Audit management and compliance tracking',
                usageMetrics: ['audits', 'users']
            },
            'LMS': {
                name: 'Learning',
                description: 'An intelligent learning platform for your people, customers, and partners',
                usageMetrics: ['courses', 'learners', 'users']
            }
        };

        // Get enabled apps
        const enabledAppEntries = (organization.enabledApps || [])
            .filter(app => {
                const appKey = typeof app === 'string' ? app : app.appKey;
                return VALID_APPS.includes(appKey.toUpperCase());
            })
            .map(app => {
                const appKey = typeof app === 'string' ? app : app.appKey;
                return {
                    appKey: appKey.toUpperCase(),
                    status: typeof app === 'string' ? 'ACTIVE' : app.status,
                    enabledAt: typeof app === 'object' ? app.enabledAt : new Date()
                };
            });

        // Get actual usage counts
        const userCount = await User.countDocuments({ 
            organizationId: organization._id,
            status: 'active'
        });

        // Get contact and deal counts (if Contact and Deal models exist)
        let contactCount = 0;
        let dealCount = 0;
        try {
            const Contact = require('../models/Contact');
            contactCount = await Contact.countDocuments({ organizationId: organization._id });
        } catch (err) {
            // Contact model might not exist, use 0
        }
        try {
            const Deal = require('../models/Deal');
            dealCount = await Deal.countDocuments({ organizationId: organization._id });
        } catch (err) {
            // Deal model might not exist, use 0
        }

        // Build subscriptions list (one per app)
        const subscriptions = VALID_APPS.map(appKey => {
            const appEntry = enabledAppEntries.find(e => e.appKey === appKey);
            const metadata = appMetadata[appKey];
            
            // Determine plan/status
            let plan = 'DISABLED';
            let canUpgrade = false;
            
            if (appEntry && appEntry.status === 'ACTIVE') {
                if (organization.subscription?.tier === 'trial') {
                    plan = 'Trial';
                    canUpgrade = true;
                } else if (organization.subscription?.tier === 'paid') {
                    plan = 'Paid';
                    canUpgrade = false;
                } else {
                    plan = 'Active';
                    canUpgrade = true;
                }
            } else if (appEntry && appEntry.status === 'SUSPENDED') {
                plan = 'Suspended';
                canUpgrade = true;
            } else {
                plan = 'Not Subscribed';
                canUpgrade = true;
            }

            // Get usage (app-scoped, using organization-level metrics)
            const usage = {
                users: {
                    current: userCount,
                    limit: normalizeSubscriptionLimit(organization.limits?.maxUsers)
                },
                contacts: {
                    current: contactCount,
                    limit: normalizeSubscriptionLimit(organization.limits?.maxContacts)
                },
                deals: {
                    current: dealCount,
                    limit: normalizeSubscriptionLimit(organization.limits?.maxDeals)
                }
            };

            // App-specific limits
            const limits = {
                users: normalizeSubscriptionLimit(organization.limits?.maxUsers),
                storage: normalizeSubscriptionLimit(organization.limits?.maxStorageGB)
            };

            return {
                appKey: appKey,
                appName: metadata?.name || appKey,
                description: metadata?.description || `${metadata?.name || appKey} application`,
                plan: plan,
                canUpgrade: canUpgrade,
                usage: usage,
                limits: limits,
                status: appEntry ? appEntry.status : 'DISABLED'
            };
        }).filter(sub => sub.status === 'ACTIVE' || sub.canUpgrade);

        let addonSubscriptions = [];
        try {
            addonSubscriptions = await buildAddonSubscriptionLineItems(organization._id);
        } catch (addonErr) {
            console.error('[getSubscriptions] addon line items failed', addonErr);
        }
        const allSubscriptions = [...subscriptions, ...addonSubscriptions];

        res.json({
            success: true,
            subscriptions: allSubscriptions,
            addonSubscriptions,
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions',
            error: error.message
        });
    }
};

/**
 * Get detailed subscription information for a specific application
 * GET /api/settings/subscriptions/:appKey
 */
exports.getSubscription = async (req, res) => {
    try {
        const { appKey } = req.params;
        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const rawAppKey = String(appKey || '').trim();
        if (rawAppKey.toLowerCase().startsWith('addon:')) {
            const addonKey = normalizeAddonKey(rawAppKey.slice('addon:'.length));
            const items = await buildAddonSubscriptionLineItems(organization._id);
            const item = items.find((row) => row.addonKey === addonKey);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Addon subscription not found'
                });
            }

            let planDetails = null;
            const sub = item.subscriptionDetails;
            if (item.plan === 'Trial' && sub?.trialEndsAt) {
                const daysRemaining = Math.max(
                    0,
                    Math.ceil((new Date(sub.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)),
                );
                planDetails = {
                    name: 'Trial',
                    period: {
                        start: sub.startedAt || null,
                        end: sub.trialEndsAt,
                    },
                    daysRemaining,
                };
            } else if (sub?.startedAt) {
                planDetails = {
                    name: item.plan,
                    period: {
                        start: sub.startedAt,
                        end: sub.trialEndsAt || null,
                    },
                };
            }

            return res.json({
                success: true,
                ...item,
                planDetails,
                limits: item.limits || {},
            });
        }

        // Validate app key
        const VALID_APPS = ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'];
        const appKeyUpper = appKey.toUpperCase();
        if (!VALID_APPS.includes(appKeyUpper)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application key'
            });
        }

        // App metadata
        const appMetadata = {
            'SALES': {
                name: 'Sales',
                description: 'Sales pipeline and customer relationship management',
                usageMetrics: ['contacts', 'deals', 'users']
            },
            'HELPDESK': {
                name: 'Helpdesk',
                description: 'Customer support and ticket management',
                usageMetrics: ['tickets', 'agents', 'users']
            },
            'PROJECTS': {
                name: 'Projects',
                description: 'Project management and task tracking',
                usageMetrics: ['projects', 'tasks', 'users']
            },
            'PORTAL': {
                name: 'Portal',
                description: 'Customer self-service portal',
                usageMetrics: ['users', 'portal_visits']
            },
            'AUDIT': {
                name: 'Audit',
                description: 'Audit management and compliance tracking',
                usageMetrics: ['audits', 'users']
            },
            'LMS': {
                name: 'Learning',
                description: 'An intelligent learning platform for your people, customers, and partners',
                usageMetrics: ['courses', 'learners', 'users']
            }
        };

        // Get app entry
        const appEntry = organization.enabledApps?.find(
            app => (typeof app === 'string' ? app : app.appKey).toUpperCase() === appKeyUpper
        );

        // Determine plan
        let plan = 'DISABLED';
        let canUpgrade = false;
        let planDetails = null;

        if (appEntry && appEntry.status === 'ACTIVE') {
            if (organization.subscription?.tier === 'trial') {
                plan = 'Trial';
                canUpgrade = true;
                const trialEndDate = organization.subscription?.trialEndDate;
                const daysRemaining = trialEndDate 
                    ? Math.max(0, Math.ceil((new Date(trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
                    : 0;
                planDetails = {
                    name: 'Trial',
                    period: {
                        start: organization.subscription?.trialStartDate,
                        end: trialEndDate
                    },
                    daysRemaining: daysRemaining
                };
            } else if (organization.subscription?.tier === 'paid') {
                plan = 'Paid';
                canUpgrade = false;
                planDetails = {
                    name: 'Paid Plan',
                    period: {
                        start: organization.subscription?.currentPeriodStart,
                        end: organization.subscription?.currentPeriodEnd
                    },
                    autoRenew: organization.subscription?.autoRenew || false
                };
            } else {
                plan = 'Active';
                canUpgrade = true;
            }
        } else if (appEntry && appEntry.status === 'SUSPENDED') {
            plan = 'Suspended';
            canUpgrade = true;
        } else {
            plan = 'Not Subscribed';
            canUpgrade = true;
        }

        // Get actual usage counts
        const userCount = await User.countDocuments({ 
            organizationId: organization._id,
            status: 'active'
        });

        let contactCount = 0;
        let dealCount = 0;
        try {
            const Contact = require('../models/Contact');
            contactCount = await Contact.countDocuments({ organizationId: organization._id });
        } catch (err) {
            // Contact model might not exist
        }
        try {
            const Deal = require('../models/Deal');
            dealCount = await Deal.countDocuments({ organizationId: organization._id });
        } catch (err) {
            // Deal model might not exist
        }

        // Get usage
        const usage = {
            users: {
                current: userCount,
                limit: normalizeSubscriptionLimit(organization.limits?.maxUsers),
                unit: 'users'
            },
            contacts: {
                current: contactCount,
                limit: normalizeSubscriptionLimit(organization.limits?.maxContacts),
                unit: 'contacts'
            },
            deals: {
                current: dealCount,
                limit: normalizeSubscriptionLimit(organization.limits?.maxDeals),
                unit: 'deals'
            },
            storage: {
                current: 0, // Would come from actual storage tracking
                limit: normalizeSubscriptionLimit(organization.limits?.maxStorageGB),
                unit: 'GB'
            }
        };

        // Limits
        const limits = {
            users: normalizeSubscriptionLimit(organization.limits?.maxUsers),
            contacts: normalizeSubscriptionLimit(organization.limits?.maxContacts),
            deals: normalizeSubscriptionLimit(organization.limits?.maxDeals),
            storage: normalizeSubscriptionLimit(organization.limits?.maxStorageGB)
        };

        const metadata = appMetadata[appKeyUpper] || {};

        res.json({
            success: true,
            appKey: appKeyUpper,
            appName: metadata.name || appKeyUpper,
            description: metadata.description || `${metadata.name || appKeyUpper} application`,
            plan: plan,
            planDetails: planDetails,
            canUpgrade: canUpgrade,
            usage: usage,
            limits: limits,
            enabledAt: appEntry && typeof appEntry === 'object' ? appEntry.enabledAt : null
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription',
            error: error.message
        });
    }
};

/**
 * Get organization settings
 * GET /api/settings/organization
 */
exports.getOrganizationSettings = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { normalizeCurrenciesForResponse } = require('../utils/orgCurrencies');
        const { resolveFiscalYearStartMonth } = require('../utils/fiscalYear');
        const currency = organization.settings?.currency || 'USD';
        const companyAddress = organization.settings?.companyAddress || {};
        const social = organization.settings?.social || {};

        // Return only organization identity and settings fields
        // Exclude subscription, billing, app enablement, etc.
        res.json({
            success: true,
            data: {
                name: organization.name,
                logoUrl: organization.settings?.logoUrl || null,
                primaryColor: organization.settings?.primaryColor || '#3a1f8a',
                timeZone: organization.settings?.timeZone || 'UTC',
                currency,
                currencies: normalizeCurrenciesForResponse(organization.settings?.currencies, currency),
                locale: organization.settings?.locale || 'en-US',
                language: organization.settings?.language || 'en',
                defaultPhoneCountry: organization.settings?.defaultPhoneCountry || '',
                dataRegion: organization.dataRegion || 'us-east-1',
                industry: organization.industry || null,
                phone: organization.phone || '',
                website: organization.website || '',
                taxId: organization.taxId || '',
                gstin: organization.gstin || '',
                companyAddress: {
                    line1: companyAddress.line1 || '',
                    city: companyAddress.city || '',
                    postalCode: companyAddress.postalCode || '',
                    country: companyAddress.country || ''
                },
                social: {
                    facebook: social.facebook || '',
                    twitter: social.twitter || '',
                    linkedin: social.linkedin || ''
                },
                fiscalYearStartMonth: resolveFiscalYearStartMonth(organization)
            }
        });
    } catch (error) {
        console.error('Get organization settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organization settings',
            error: error.message
        });
    }
};

/**
 * Update organization settings
 * PUT /api/settings/organization
 */
exports.updateOrganizationSettings = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { normalizeCurrenciesForResponse, validateAndNormalizeCurrenciesInput } = require('../utils/orgCurrencies');

        // Snapshot raw stored values (no display defaults) for accurate change detection.
        const { resolveFiscalYearStartMonth, applyFiscalYearStartMonth, clampMonth } = require('../utils/fiscalYear');
        const snapshotOrganizationSettings = (org) => ({
            name: org.name ?? null,
            logoUrl: org.settings?.logoUrl ?? null,
            primaryColor: org.settings?.primaryColor ?? null,
            timeZone: org.settings?.timeZone ?? null,
            currency: org.settings?.currency ?? null,
            currencies: normalizeCurrenciesForResponse(
                org.settings?.currencies,
                org.settings?.currency || 'USD'
            ),
            locale: org.settings?.locale ?? null,
            language: org.settings?.language ?? null,
            defaultPhoneCountry: org.settings?.defaultPhoneCountry ?? null,
            phone: org.phone ?? null,
            website: org.website ?? null,
            taxId: org.taxId ?? null,
            gstin: org.gstin ?? null,
            companyAddress: {
                line1: org.settings?.companyAddress?.line1 ?? '',
                city: org.settings?.companyAddress?.city ?? '',
                postalCode: org.settings?.companyAddress?.postalCode ?? '',
                country: org.settings?.companyAddress?.country ?? ''
            },
            social: {
                facebook: org.settings?.social?.facebook ?? '',
                twitter: org.settings?.social?.twitter ?? '',
                linkedin: org.settings?.social?.linkedin ?? ''
            },
            fiscalYearStartMonth: resolveFiscalYearStartMonth(org)
        });

        const beforeSnapshot = snapshotOrganizationSettings(organization);
        res.locals.settingsAuditBefore = beforeSnapshot;

        const {
            name,
            logoUrl,
            primaryColor,
            timeZone,
            currency,
            currencies,
            locale,
            language,
            defaultPhoneCountry,
            phone,
            website,
            taxId,
            gstin,
            companyAddress,
            social,
            fiscalYearStartMonth
        } = req.body;
        const { sanitizeBrandColor } = require('../services/quoteOrgSettingsService');
        const { isValidPhoneCountryIso2 } = require('../constants/phoneCountries');
        const { validateGstin } = require('../utils/gstinValidator');

        // Validate and update only allowed fields
        if (name !== undefined) {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization name is required'
                });
            }
            organization.name = name.trim();
        }

        // Update settings object
        if (!organization.settings) {
            organization.settings = {};
        }

        if (logoUrl !== undefined) {
            organization.settings.logoUrl = logoUrl || null;
        }

        if (primaryColor !== undefined) {
            const sanitized = sanitizeBrandColor(primaryColor);
            organization.settings.primaryColor = sanitized || '#3a1f8a';
        }

        if (timeZone !== undefined) {
            // Validate timezone (basic validation)
            if (timeZone && typeof timeZone === 'string') {
                organization.settings.timeZone = timeZone;
            }
        }

        if (currency !== undefined) {
            // Validate currency code (basic validation - 3 uppercase letters)
            if (currency && /^[A-Z]{3}$/.test(currency)) {
                organization.settings.currency = currency;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid currency code. Must be a 3-letter ISO code (e.g., USD, EUR)'
                });
            }
        }

        if (locale !== undefined) {
            // Validate locale (basic validation - format like en-US)
            if (locale && typeof locale === 'string') {
                organization.settings.locale = locale;
            }
        }

        if (language !== undefined) {
            // Validate language code (basic validation - 2-3 letter code)
            if (language && /^[a-z]{2,3}$/i.test(language)) {
                organization.settings.language = language.toLowerCase();
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid language code. Must be a 2-3 letter ISO code (e.g., en, es, fr)'
                });
            }
        }

        if (defaultPhoneCountry !== undefined) {
            const trimmed = String(defaultPhoneCountry || '').trim().toUpperCase();
            if (!trimmed) {
                organization.settings.defaultPhoneCountry = '';
            } else if (isValidPhoneCountryIso2(trimmed)) {
                organization.settings.defaultPhoneCountry = trimmed;
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid default phone country. Must be a supported ISO 3166-1 alpha-2 code (e.g., US, IN, GB)'
                });
            }
        }

        if (phone !== undefined) {
            organization.phone = phone != null ? String(phone).trim() : '';
        }

        if (website !== undefined) {
            organization.website = website != null ? String(website).trim() : '';
        }

        if (taxId !== undefined) {
            organization.taxId = taxId != null ? String(taxId).trim() : '';
        }

        if (gstin !== undefined) {
            const raw = gstin != null ? String(gstin).trim() : '';
            if (!raw) {
                organization.gstin = '';
            } else {
                const gst = validateGstin(raw);
                if (!gst.ok) {
                    return res.status(400).json({
                        success: false,
                        message: gst.error || 'Invalid GSTIN'
                    });
                }
                organization.gstin = gst.normalized;
            }
        }

        if (companyAddress !== undefined && companyAddress && typeof companyAddress === 'object') {
            if (!organization.settings.companyAddress) {
                organization.settings.companyAddress = {};
            }
            if (Object.prototype.hasOwnProperty.call(companyAddress, 'line1')) {
                organization.settings.companyAddress.line1 = String(companyAddress.line1 || '').trim();
            }
            if (Object.prototype.hasOwnProperty.call(companyAddress, 'city')) {
                organization.settings.companyAddress.city = String(companyAddress.city || '').trim();
            }
            if (Object.prototype.hasOwnProperty.call(companyAddress, 'postalCode')) {
                organization.settings.companyAddress.postalCode = String(companyAddress.postalCode || '').trim();
            }
            if (Object.prototype.hasOwnProperty.call(companyAddress, 'country')) {
                const c = String(companyAddress.country || '').trim().toUpperCase();
                if (c && !isValidPhoneCountryIso2(c)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid country. Must be a supported ISO 3166-1 alpha-2 code'
                    });
                }
                organization.settings.companyAddress.country = c;
            }
            organization.markModified('settings.companyAddress');
        }

        if (social !== undefined && social && typeof social === 'object') {
            if (!organization.settings.social) {
                organization.settings.social = {};
            }
            for (const key of ['facebook', 'twitter', 'linkedin']) {
                if (Object.prototype.hasOwnProperty.call(social, key)) {
                    organization.settings.social[key] = String(social[key] || '').trim();
                }
            }
            organization.markModified('settings.social');
        }

        if (fiscalYearStartMonth !== undefined) {
            const month = clampMonth(fiscalYearStartMonth, NaN);
            if (!Number.isFinite(month)) {
                return res.status(400).json({
                    success: false,
                    message: 'Financial year start month must be between 1 and 12'
                });
            }
            applyFiscalYearStartMonth(organization, month);
            organization.markModified('settings');
        }

        if (currencies !== undefined) {
            const baseForCurrencies = organization.settings.currency || 'USD';
            const validated = validateAndNormalizeCurrenciesInput(currencies, baseForCurrencies);
            if (!validated.ok) {
                return res.status(400).json({
                    success: false,
                    message: validated.message
                });
            }
            organization.settings.currencies = validated.currencies;
        }

        await organization.save();

        const afterSnapshot = snapshotOrganizationSettings(organization);
        // Only audit fields the client actually sent (avoids false positives from full-form resubmits).
        const sentKeys = [
            'name',
            'logoUrl',
            'primaryColor',
            'timeZone',
            'currency',
            'currencies',
            'locale',
            'language',
            'defaultPhoneCountry',
            'phone',
            'website',
            'taxId',
            'gstin',
            'companyAddress',
            'social',
            'fiscalYearStartMonth'
        ].filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));

        const pickKeys = (source, keys) => {
            const out = {};
            for (const key of keys) out[key] = source[key] ?? null;
            return out;
        };

        res.locals.settingsAuditBefore = pickKeys(beforeSnapshot, sentKeys);
        res.locals.settingsAuditAfter = pickKeys(afterSnapshot, sentKeys);

        const resolvedCurrency = organization.settings?.currency || 'USD';
        const afterCompanyAddress = organization.settings?.companyAddress || {};
        const afterSocial = organization.settings?.social || {};
        const afterPayload = {
            name: organization.name,
            logoUrl: organization.settings?.logoUrl || null,
            primaryColor: organization.settings?.primaryColor || '#3a1f8a',
            timeZone: organization.settings?.timeZone || 'UTC',
            currency: resolvedCurrency,
            currencies: normalizeCurrenciesForResponse(organization.settings?.currencies, resolvedCurrency),
            locale: organization.settings?.locale || 'en-US',
            language: organization.settings?.language || 'en',
            defaultPhoneCountry: organization.settings?.defaultPhoneCountry || '',
            phone: organization.phone || '',
            website: organization.website || '',
            taxId: organization.taxId || '',
            gstin: organization.gstin || '',
            companyAddress: {
                line1: afterCompanyAddress.line1 || '',
                city: afterCompanyAddress.city || '',
                postalCode: afterCompanyAddress.postalCode || '',
                country: afterCompanyAddress.country || ''
            },
            social: {
                facebook: afterSocial.facebook || '',
                twitter: afterSocial.twitter || '',
                linkedin: afterSocial.linkedin || ''
            },
            fiscalYearStartMonth: resolveFiscalYearStartMonth(organization)
        };

        // Return updated settings
        res.json({
            success: true,
            message: 'Organization settings updated successfully',
            data: {
                ...afterPayload,
                dataRegion: organization.dataRegion || 'us-east-1',
                industry: organization.industry || null
            }
        });
    } catch (error) {
        console.error('Update organization settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update organization settings',
            error: error.message
        });
    }
};

/**
 * Upload organization logo
 * POST /api/settings/organization/logo
 *
 * Accepts a multipart/form-data request with field name `logo`.
 * Persists the file via the shared upload middleware and writes the
 * resulting URL to `organization.settings.logoUrl`.
 */
exports.uploadOrganizationLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Only allow image types for logos (the shared middleware allows docs too).
        const allowedImageMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ];
        if (!allowedImageMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Please upload an image (PNG, JPG, GIF, WEBP, or SVG).'
            });
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({ logoUrl: organization.settings?.logoUrl || null });

        const { persistMulterUpload } = require('../middleware/uploadMiddleware');
        const uploadResult = await persistMulterUpload(req, 'logos');

        if (!organization.settings) {
            organization.settings = {};
        }
        organization.settings.logoUrl = uploadResult.url;
        await organization.save();

        try {
            const { ensureCompanyLogoAsset } = require('../services/contentPlatform/organizationLogoAssetService');
            await ensureCompanyLogoAsset({
                organizationId: req.user.organizationId,
                userId: req.user._id
            });
        } catch (syncError) {
            console.warn('[settings] Company logo asset sync failed:', syncError.message);
        }

        attachSettingsAuditDiff(res, before, cloneForAudit({ logoUrl: uploadResult.url }), { keys: ['logoUrl'] });

        return res.json({
            success: true,
            message: 'Logo uploaded successfully',
            data: {
                logoUrl: uploadResult.url,
                filename: uploadResult.storedFileName,
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Upload organization logo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload logo',
            error: error.message
        });
    }
};

/**
 * Remove organization logo
 * DELETE /api/settings/organization/logo
 */
exports.deleteOrganizationLogo = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({ logoUrl: organization.settings?.logoUrl || null });

        if (organization.settings?.logoUrl) {
            organization.settings.logoUrl = null;
            await organization.save();
        }

        attachSettingsAuditDiff(res, before, cloneForAudit({ logoUrl: null }), { keys: ['logoUrl'] });

        return res.json({
            success: true,
            message: 'Logo removed',
            data: { logoUrl: null }
        });
    } catch (error) {
        console.error('Delete organization logo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove logo',
            error: error.message
        });
    }
};

/**
 * Get security settings
 * GET /api/settings/security
 */
exports.getSecuritySettings = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Return security configuration with defaults
        const security = organization.security || {};
        
        res.json({
            success: true,
            data: {
                passwordPolicy: {
                    minLength: security.passwordPolicy?.minLength || 8,
                    requireUppercase: security.passwordPolicy?.requireUppercase !== false,
                    requireLowercase: security.passwordPolicy?.requireLowercase !== false,
                    requireNumbers: security.passwordPolicy?.requireNumbers !== false,
                    requireSpecialChars: security.passwordPolicy?.requireSpecialChars || false,
                    expirationDays: security.passwordPolicy?.expirationDays || 90,
                    preventReuse: security.passwordPolicy?.preventReuse || 5
                },
                sessionRules: {
                    durationHours: security.sessionRules?.durationHours || 24,
                    idleTimeoutMinutes: security.sessionRules?.idleTimeoutMinutes || 30,
                    maxConcurrentSessions: security.sessionRules?.maxConcurrentSessions || 5
                },
                loginRestrictions: {
                    ipWhitelist: security.loginRestrictions?.ipWhitelist || [],
                    ipBlacklist: security.loginRestrictions?.ipBlacklist || [],
                    allowedRegions: security.loginRestrictions?.allowedRegions || [],
                    blockFailedAttempts: security.loginRestrictions?.blockFailedAttempts !== false,
                    maxFailedAttempts: security.loginRestrictions?.maxFailedAttempts || 5,
                    lockoutDurationMinutes: security.loginRestrictions?.lockoutDurationMinutes || 15
                },
                twoFactorAuth: {
                    enabled: security.twoFactorAuth?.enabled || false,
                    required: security.twoFactorAuth?.required || false,
                    methods: security.twoFactorAuth?.methods || ['totp']
                }
            }
        });
    } catch (error) {
        console.error('Get security settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch security settings',
            error: error.message
        });
    }
};

/**
 * Update security settings
 * PUT /api/settings/security
 */
exports.updateSecuritySettings = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const securitySnapshot = organization.security || {};
        res.locals.settingsAuditBefore = {
            passwordPolicy: { ...(securitySnapshot.passwordPolicy || {}) },
            sessionRules: { ...(securitySnapshot.sessionRules || {}) },
            loginRestrictions: {
                ...(securitySnapshot.loginRestrictions || {}),
                ipWhitelist: [...(securitySnapshot.loginRestrictions?.ipWhitelist || [])],
                ipBlacklist: [...(securitySnapshot.loginRestrictions?.ipBlacklist || [])],
                allowedRegions: [...(securitySnapshot.loginRestrictions?.allowedRegions || [])]
            },
            twoFactorAuth: {
                ...(securitySnapshot.twoFactorAuth || {}),
                methods: [...(securitySnapshot.twoFactorAuth?.methods || [])]
            }
        };

        const { passwordPolicy, sessionRules, loginRestrictions, twoFactorAuth } = req.body;

        // Initialize security object if it doesn't exist
        if (!organization.security) {
            organization.security = {};
        }

        // Update password policy
        if (passwordPolicy) {
            if (!organization.security.passwordPolicy) {
                organization.security.passwordPolicy = {};
            }
            if (passwordPolicy.minLength !== undefined) {
                if (passwordPolicy.minLength < 6 || passwordPolicy.minLength > 128) {
                    return res.status(400).json({
                        success: false,
                        message: 'Password minimum length must be between 6 and 128 characters'
                    });
                }
                organization.security.passwordPolicy.minLength = passwordPolicy.minLength;
            }
            if (passwordPolicy.requireUppercase !== undefined) {
                organization.security.passwordPolicy.requireUppercase = passwordPolicy.requireUppercase;
            }
            if (passwordPolicy.requireLowercase !== undefined) {
                organization.security.passwordPolicy.requireLowercase = passwordPolicy.requireLowercase;
            }
            if (passwordPolicy.requireNumbers !== undefined) {
                organization.security.passwordPolicy.requireNumbers = passwordPolicy.requireNumbers;
            }
            if (passwordPolicy.requireSpecialChars !== undefined) {
                organization.security.passwordPolicy.requireSpecialChars = passwordPolicy.requireSpecialChars;
            }
            if (passwordPolicy.expirationDays !== undefined) {
                if (passwordPolicy.expirationDays < 0 || passwordPolicy.expirationDays > 365) {
                    return res.status(400).json({
                        success: false,
                        message: 'Password expiration days must be between 0 (no expiration) and 365'
                    });
                }
                organization.security.passwordPolicy.expirationDays = passwordPolicy.expirationDays;
            }
            if (passwordPolicy.preventReuse !== undefined) {
                if (passwordPolicy.preventReuse < 0 || passwordPolicy.preventReuse > 24) {
                    return res.status(400).json({
                        success: false,
                        message: 'Password reuse prevention must be between 0 and 24 previous passwords'
                    });
                }
                organization.security.passwordPolicy.preventReuse = passwordPolicy.preventReuse;
            }
        }

        // Update session rules
        if (sessionRules) {
            if (!organization.security.sessionRules) {
                organization.security.sessionRules = {};
            }
            if (sessionRules.durationHours !== undefined) {
                if (sessionRules.durationHours < 1 || sessionRules.durationHours > 168) {
                    return res.status(400).json({
                        success: false,
                        message: 'Session duration must be between 1 and 168 hours (7 days)'
                    });
                }
                organization.security.sessionRules.durationHours = sessionRules.durationHours;
            }
            if (sessionRules.idleTimeoutMinutes !== undefined) {
                if (sessionRules.idleTimeoutMinutes < 5 || sessionRules.idleTimeoutMinutes > 480) {
                    return res.status(400).json({
                        success: false,
                        message: 'Idle timeout must be between 5 and 480 minutes (8 hours)'
                    });
                }
                organization.security.sessionRules.idleTimeoutMinutes = sessionRules.idleTimeoutMinutes;
            }
            if (sessionRules.maxConcurrentSessions !== undefined) {
                if (sessionRules.maxConcurrentSessions < 1 || sessionRules.maxConcurrentSessions > 20) {
                    return res.status(400).json({
                        success: false,
                        message: 'Max concurrent sessions must be between 1 and 20'
                    });
                }
                organization.security.sessionRules.maxConcurrentSessions = sessionRules.maxConcurrentSessions;
            }
        }

        // Update login restrictions
        if (loginRestrictions) {
            if (!organization.security.loginRestrictions) {
                organization.security.loginRestrictions = {};
            }
            if (loginRestrictions.ipWhitelist !== undefined) {
                // Validate IP addresses (basic validation)
                if (Array.isArray(loginRestrictions.ipWhitelist)) {
                    organization.security.loginRestrictions.ipWhitelist = loginRestrictions.ipWhitelist;
                }
            }
            if (loginRestrictions.ipBlacklist !== undefined) {
                if (Array.isArray(loginRestrictions.ipBlacklist)) {
                    organization.security.loginRestrictions.ipBlacklist = loginRestrictions.ipBlacklist;
                }
            }
            if (loginRestrictions.allowedRegions !== undefined) {
                if (Array.isArray(loginRestrictions.allowedRegions)) {
                    organization.security.loginRestrictions.allowedRegions = loginRestrictions.allowedRegions;
                }
            }
            if (loginRestrictions.blockFailedAttempts !== undefined) {
                organization.security.loginRestrictions.blockFailedAttempts = loginRestrictions.blockFailedAttempts;
            }
            if (loginRestrictions.maxFailedAttempts !== undefined) {
                if (loginRestrictions.maxFailedAttempts < 1 || loginRestrictions.maxFailedAttempts > 10) {
                    return res.status(400).json({
                        success: false,
                        message: 'Max failed attempts must be between 1 and 10'
                    });
                }
                organization.security.loginRestrictions.maxFailedAttempts = loginRestrictions.maxFailedAttempts;
            }
            if (loginRestrictions.lockoutDurationMinutes !== undefined) {
                if (loginRestrictions.lockoutDurationMinutes < 1 || loginRestrictions.lockoutDurationMinutes > 1440) {
                    return res.status(400).json({
                        success: false,
                        message: 'Lockout duration must be between 1 and 1440 minutes (24 hours)'
                    });
                }
                organization.security.loginRestrictions.lockoutDurationMinutes = loginRestrictions.lockoutDurationMinutes;
            }
        }

        // Update two-factor authentication
        if (twoFactorAuth) {
            if (!organization.security.twoFactorAuth) {
                organization.security.twoFactorAuth = {};
            }
            if (twoFactorAuth.enabled !== undefined) {
                organization.security.twoFactorAuth.enabled = twoFactorAuth.enabled;
            }
            if (twoFactorAuth.required !== undefined) {
                // If requiring 2FA, it must be enabled first
                if (twoFactorAuth.required && !organization.security.twoFactorAuth.enabled) {
                    return res.status(400).json({
                        success: false,
                        message: 'Two-factor authentication must be enabled before it can be required'
                    });
                }
                organization.security.twoFactorAuth.required = twoFactorAuth.required;
            }
            if (twoFactorAuth.methods !== undefined) {
                if (Array.isArray(twoFactorAuth.methods)) {
                    const validMethods = ['totp', 'sms', 'email'];
                    const invalidMethods = twoFactorAuth.methods.filter(m => !validMethods.includes(m));
                    if (invalidMethods.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid 2FA methods: ${invalidMethods.join(', ')}. Valid methods are: ${validMethods.join(', ')}`
                        });
                    }
                    organization.security.twoFactorAuth.methods = twoFactorAuth.methods;
                }
            }
        }

        await organization.save();

        const { attachSettingsAuditDiff } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            res.locals.settingsAuditBefore,
            {
                passwordPolicy: organization.security.passwordPolicy,
                sessionRules: organization.security.sessionRules,
                loginRestrictions: organization.security.loginRestrictions,
                twoFactorAuth: organization.security.twoFactorAuth
            },
            { body: req.body }
        );

        // Return updated settings
        res.json({
            success: true,
            message: 'Security settings updated successfully',
            data: {
                passwordPolicy: organization.security.passwordPolicy,
                sessionRules: organization.security.sessionRules,
                loginRestrictions: organization.security.loginRestrictions,
                twoFactorAuth: organization.security.twoFactorAuth
            }
        });
    } catch (error) {
        console.error('Update security settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update security settings',
            error: error.message
        });
    }
};

/**
 * Get security activity (login activity, failed attempts, audit events)
 * GET /api/settings/security/activity
 */
exports.getSecurityActivity = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // For now, return mock data since we don't have a dedicated security events collection
        // In production, this would query a SecurityEvent or AuditLog collection
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.page) || 1;
        
        // Mock security activity data
        // In a real implementation, this would query from a security events collection
        const activity = [
            {
                id: '1',
                type: 'LOGIN_SUCCESS',
                userEmail: 'user@example.com',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                ip: '192.168.1.1',
                userAgent: 'Mozilla/5.0...',
                status: 'success'
            },
            {
                id: '2',
                type: 'LOGIN_FAILED',
                userEmail: 'user@example.com',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                ip: '192.168.1.1',
                userAgent: 'Mozilla/5.0...',
                status: 'failed',
                reason: 'Invalid password'
            }
        ];

        res.json({
            success: true,
            data: {
                activity: activity.slice((page - 1) * limit, page * limit),
                total: activity.length,
                page: page,
                limit: limit
            }
        });
    } catch (error) {
        console.error('Get security activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch security activity',
            error: error.message
        });
    }
};


/**
 * Get all integrations with organization state
 * GET /api/settings/integrations
 */
exports.getIntegrations = async (req, res) => {
    try {
        const orgIntegrations = req.organization?.integrations || {};

        const integrations = integrationRegistry.map((integration) => {
            const state = orgIntegrations[integration.key] || {};
            const enabled = state.enabled === true;
            const status = enabled ? (state.status || 'connected') : 'disconnected';
            const scopeLabel = integration.scope === 'platform' ? 'Platform-wide' : 'App-specific';

            const base = {
                key: integration.key,
                name: integration.name,
                description: integration.description,
                scope: integration.scope,
                scopeLabel,
                apps: integration.apps || [],
                category: integration.category,
                dataSharedSummary: integration.dataSharedSummary,
                recommended: integration.recommended === true,
                enabled,
                status,
                connectedAt: state.connectedAt || null,
                disconnectedAt: state.disconnectedAt || null
            };
            if (integration.key === emailService.EMAIL_PROVIDER_KEY) {
                return { ...base, ...buildEmailProviderListExtras(state) };
            }
            return base;
        });

        const emailIntegration = integrations.find((item) => item.key === emailService.EMAIL_PROVIDER_KEY);
        if (emailIntegration) {
            await attachEmailIntegrationPolicy(req, emailIntegration);
        }

        res.json({
            success: true,
            integrations
        });
    } catch (error) {
        console.error('Get integrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch integrations',
            error: error.message
        });
    }
};

/**
 * Get integration detail
 * GET /api/settings/integrations/:key
 */
exports.getIntegration = async (req, res) => {
    try {
        const { key } = req.params;
        const integration = integrationRegistry.find((i) => i.key === key);
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'Integration not found'
            });
        }

        const orgIntegrations = req.organization?.integrations || {};
        const state = orgIntegrations[integration.key] || {};
        const enabled = state.enabled === true;
        const status = enabled ? (state.status || 'connected') : 'disconnected';

        const payload = {
            key: integration.key,
            name: integration.name,
            description: integration.description,
            scope: integration.scope,
            apps: integration.apps || [],
            category: integration.category,
            dataSharedSummary: integration.dataSharedSummary,
            dataSharedDetails: integration.dataSharedDetails,
            recommended: integration.recommended === true,
            enabled,
            status,
            connectedAt: state.connectedAt || null,
            disconnectedAt: state.disconnectedAt || null
        };

        if (integration.key === emailService.EMAIL_PROVIDER_KEY) {
            Object.assign(payload, buildEmailProviderListExtras(state));
            const verifyDomain = req.query.verifyDomain === '1' || req.query.verifyDomain === 'true';
            if (verifyDomain) {
                const tenantConfig = state.config && typeof state.config === 'object' ? state.config : null;
                const resolvedConfig = tenantConfig && Object.keys(tenantConfig).length > 0
                    ? tenantConfig
                    : getEnvEmailConfigFallback();
                payload.emailDomainVerification = await deriveEmailDomainVerification(resolvedConfig);
            }
            payload.emailPlatformDefaults = {
                crmOutboundProvider: amdsEmailDelivery.isAmdsEnvConfigured() ? 'amds' : 'resend',
                notificationProvider: amdsEmailDelivery.isAmdsEnvConfigured() ? 'amds' : 'oci-email-delivery',
                notificationChannelNote:
                    'In-app notification emails use the platform system mailer. CRM sends use the provider configured below unless a user connects their own Gmail mailbox.'
            };

            const scope = String(req.query.scope || 'full').toLowerCase();
            if (scope === 'full' || scope === 'policy') {
                await attachEmailIntegrationPolicy(req, payload);
            }
        }

        res.json({
            success: true,
            integration: payload
        });
    } catch (error) {
        console.error('Get integration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch integration',
            error: error.message
        });
    }
};

exports.updateIntegrationConfig = async (req, res) => {
    try {
        const { key } = req.params;
        if (key !== emailService.EMAIL_PROVIDER_KEY) {
            return res.status(400).json({
                success: false,
                message: 'Config update not supported for this integration'
            });
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const {
            provider,
            fromEmail,
            fromName,
            replyTo,
            ociRegion,
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass,
            smtpSecure,
            awsRegion,
            awsAccessKeyId,
            awsSecretAccessKey,
            communicationPolicy
        } = req.body || {};
        const isOwnerLike = req.user?.isOwner === true || String(req.user?.role || '').toLowerCase() === 'owner';
        const isPlatformAdmin = req.user?.isPlatformAdmin === true;
        const emailLower = String(req.user?.email || '').toLowerCase();
        const internalStaffEmail =
            emailLower.endsWith('@arivusystems.com') ||
            emailLower.endsWith('@arivu.com') ||
            emailLower.endsWith('@arivu.io');
        /** Gmail OAuth app in DB: workspace owner, explicit platform admin, or internal staff (matches SPA). */
        const canManageGmailOAuthApp = isOwnerLike || isPlatformAdmin || internalStaffEmail;

        if (!fromEmail || !String(fromEmail).includes('@')) {
            return res.status(400).json({
                success: false,
                message: 'Valid fromEmail is required'
            });
        }

        const current = organization.integrations || {};
        const prev = current[key] || {};
        const prevConfig = prev.config || {};

        const providerKey = String(
            provider || prevConfig.provider || resolveEmailProviderKey(prevConfig) || amdsEmailDelivery.PROVIDER_KEY
        ).trim().toLowerCase();
        const resolvedOciRegion = String(
            ociRegion || prevConfig.ociRegion || process.env.OCI_EMAIL_REGION || ''
        ).trim().toLowerCase();
        let resolvedSmtpHost = String(smtpHost || prevConfig.smtpHost || '').trim();
        const resolvedSmtpPort = Number(smtpPort) || Number(prevConfig.smtpPort) || 587;
        const resolvedSmtpUser = String(smtpUser || prevConfig.smtpUser || '').trim();
        if (providerKey === 'oci-email-delivery' && !resolvedSmtpHost && resolvedOciRegion) {
            resolvedSmtpHost = buildOciSmtpHost(resolvedOciRegion);
        }

        if (providerKey === 'oci-email-delivery') {
            if (!resolvedSmtpHost && !resolvedOciRegion) {
                return res.status(400).json({
                    success: false,
                    message: 'OCI Email Delivery requires smtpHost or ociRegion (e.g. us-phoenix-1)'
                });
            }
        } else if (providerKey === 'gmail-smtp') {
            if (!resolvedSmtpHost) {
                resolvedSmtpHost = 'smtp.gmail.com';
            }
        } else if (providerKey === 'resend') {
            if (!resolvedSmtpHost) {
                resolvedSmtpHost = 'smtp.resend.com';
            }
        } else if (providerKey === 'aws-ses') {
            resolvedSmtpHost = resolvedSmtpHost || '';
        } else if (providerKey === 'amds') {
            if (!amdsEmailDelivery.isAmdsEnvConfigured()) {
                return res.status(400).json({
                    success: false,
                    message:
                        'AMDS requires AMDS_BASE_URL and AMDS_API_KEY on the API server. Set them in server .env and restart the API.'
                });
            }
            resolvedSmtpHost = '';
        } else if (!resolvedSmtpHost || !resolvedSmtpPort || !resolvedSmtpUser) {
            return res.status(400).json({
                success: false,
                message: 'smtpHost, smtpPort, and smtpUser are required'
            });
        }

        if (
            providerKey !== 'gmail-smtp'
            && providerKey !== 'aws-ses'
            && providerKey !== 'amds'
            && (!resolvedSmtpPort || !resolvedSmtpUser)
        ) {
            return res.status(400).json({
                success: false,
                message: 'smtpPort and smtpUser are required'
            });
        }

        if (providerKey === 'aws-ses') {
            const region = String(awsRegion || prevConfig.awsRegion || '').trim();
            const keyId = String(awsAccessKeyId || prevConfig.awsAccessKeyId || '').trim();
            const secretProvided =
                awsSecretAccessKey !== undefined && String(awsSecretAccessKey).trim() !== '';
            const hasSecret = secretProvided || Boolean(prevConfig.awsSecretAccessKey);
            if (!region || !keyId || !hasSecret) {
                return res.status(400).json({
                    success: false,
                    message: 'AWS SES requires awsRegion, awsAccessKeyId, and awsSecretAccessKey'
                });
            }
        }

        const baselineConfig = Object.keys(prevConfig).length > 0
            ? prevConfig
            : getEnvEmailConfigFallback();
        const prevProvider = String(prevConfig.provider || '').trim().toLowerCase();
        const switchedToOci =
            providerKey === 'oci-email-delivery' && prevProvider && prevProvider !== 'oci-email-delivery';
        const passProvided = smtpPass !== undefined && String(smtpPass).trim() !== '';
        let resolvedSmtpPass = passProvided
            ? String(smtpPass)
            : (prevConfig.smtpPass || '');
        if (switchedToOci && !passProvided) {
            resolvedSmtpPass = '';
        }

        if (
            providerKey === 'resend'
            && !resolvedSmtpPass
            && !String(process.env.RESEND_API_KEY || '').trim()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Resend requires an API key. Enter your Resend API key in the SMTP password field.'
            });
        }

        const awsSecretProvided =
            awsSecretAccessKey !== undefined && String(awsSecretAccessKey).trim() !== '';
        let resolvedAwsSecret = awsSecretProvided
            ? String(awsSecretAccessKey).trim()
            : (prevConfig.awsSecretAccessKey || '');

        const { applyGmailSmtpDefaults } = require('../constants/gmailSmtpDefaults');
        let nextConfig = normalizeEmailIntegrationConfig({
            provider: providerKey,
            fromEmail: String(fromEmail || '').trim(),
            fromName: String(fromName || '').trim(),
            replyTo: String(replyTo || '').trim(),
            ociRegion: resolvedOciRegion,
            smtpHost: resolvedSmtpHost,
            smtpPort: resolvedSmtpPort,
            smtpUser: resolvedSmtpUser,
            smtpSecure: smtpSecure === true || String(smtpSecure).toLowerCase() === 'true',
            smtpPass: resolvedSmtpPass,
            awsRegion: String(awsRegion || prevConfig.awsRegion || '').trim(),
            awsAccessKeyId: String(awsAccessKeyId || prevConfig.awsAccessKeyId || '').trim(),
            awsSecretAccessKey: resolvedAwsSecret
        });
        nextConfig = applyGmailSmtpDefaults(nextConfig);

        const criticalFields = [
            'provider',
            'fromEmail',
            'ociRegion',
            'smtpHost',
            'smtpPort',
            'smtpUser',
            'smtpPass',
            'awsRegion',
            'awsAccessKeyId',
            'awsSecretAccessKey'
        ];
        const changedCriticalFields = criticalFields.filter((fieldKey) => {
            if (fieldKey === 'smtpPass') {
                if (smtpPass === undefined || String(smtpPass).trim() === '') return false;
                return true;
            }
            if (fieldKey === 'awsSecretAccessKey') {
                if (awsSecretAccessKey === undefined || String(awsSecretAccessKey).trim() === '') {
                    return false;
                }
                return true;
            }
            return toComparable(nextConfig[fieldKey]) !== toComparable(baselineConfig[fieldKey]);
        });
        if (!isOwnerLike && changedCriticalFields.length > 0) {
            return res.status(403).json({
                success: false,
                message: `Only workspace owner can modify critical email fields: ${changedCriticalFields.join(', ')}`,
                code: 'EMAIL_CONFIG_OWNER_ONLY'
            });
        }
        const hasOutboundPolicyUpdate =
            communicationPolicy &&
            typeof communicationPolicy === 'object' &&
            communicationPolicy.outboundEmail &&
            typeof communicationPolicy.outboundEmail === 'object';
        const hasGmailOAuthPolicyUpdate =
            communicationPolicy &&
            typeof communicationPolicy === 'object' &&
            communicationPolicy.gmailInboxSync &&
            typeof communicationPolicy.gmailInboxSync === 'object';
        const hasPolicyUpdate = hasOutboundPolicyUpdate || hasGmailOAuthPolicyUpdate;
        if (hasOutboundPolicyUpdate && !isOwnerLike) {
            return res.status(403).json({
                success: false,
                message: 'Only workspace owner can modify communication policy',
                code: 'COMMUNICATION_POLICY_OWNER_ONLY'
            });
        }
        // Gmail OAuth client credentials: allow workspace owner (self-hosted) and
        // platform operators (explicit flag or same internal-email rule as the SPA).
        if (hasGmailOAuthPolicyUpdate && !canManageGmailOAuthApp) {
            return res.status(403).json({
                success: false,
                message:
                    'Only the workspace owner (or a Arivu platform administrator) can change the Gmail OAuth client configuration here. You can also set GOOGLE_GMAIL_* on the API server instead.',
                code: 'GMAIL_OAUTH_PLATFORM_ADMIN_ONLY'
            });
        }

        const nextState = {
            ...prev,
            config: nextConfig,
            updatedAt: new Date()
        };

        await persistOrganizationIntegrationUpdate(
            req.user.organizationId,
            key,
            nextState,
            [
                buildIntegrationAuditEntry(req, 'integration_email_config_updated', {
                    integrationKey: key,
                    changedCriticalFields,
                    changedNonCriticalFields: ['fromName', 'replyTo', 'smtpSecure'].filter(
                        (fieldKey) => toComparable(nextConfig[fieldKey]) !== toComparable(baselineConfig[fieldKey])
                    )
                })
            ]
        );
        if (hasPolicyUpdate) {
            await upsertCommunicationConfigForOrganization(req.user.organizationId, communicationPolicy);
            await Organization.findByIdAndUpdate(
                req.user.organizationId,
                {
                    $push: {
                        activityLogs: buildIntegrationAuditEntry(req, 'integration_communication_policy_updated', {
                            integrationKey: key,
                            outboundEmail: communicationPolicy.outboundEmail || {}
                        })
                    }
                },
                { runValidators: false }
            );
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            cloneForAudit(prevConfig),
            cloneForAudit(nextConfig),
            { body: req.body || {} }
        );

        return res.json({
            success: true,
            message: 'Email provider settings saved successfully',
            data: sanitizeEmailConfigForResponse(nextConfig)
        });
    } catch (error) {
        console.error('Update integration config error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update integration config',
            error: error.message
        });
    }
};

/**
 * Enable integration (org-level)
 * POST /api/settings/integrations/:key/enable
 */
exports.enableIntegration = async (req, res) => {
    try {
        const { key } = req.params;
        const integration = integrationRegistry.find((i) => i.key === key);
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'Integration not found'
            });
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const current = organization.integrations || {};
        const state = current[key] || {};
        const now = new Date();
        const before = cloneForAudit({
            enabled: !!state.enabled,
            status: state.status || 'disconnected'
        });

        const nextState = {
            ...state,
            enabled: true,
            status: 'connected',
            connectedAt: now,
            disconnectedAt: state.disconnectedAt || null
        };

        await persistOrganizationIntegrationUpdate(req.user.organizationId, key, nextState);

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({ enabled: true, status: 'connected' }),
            { keys: ['enabled', 'status'] }
        );

        res.json({
            success: true,
            message: 'Integration enabled successfully',
            integration: {
                key,
                enabled: true,
                status: 'connected',
                connectedAt: nextState.connectedAt
            }
        });
    } catch (error) {
        console.error('Enable integration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable integration',
            error: error.message
        });
    }
};

/**
 * Test integration (e.g. send test email for email-provider)
 * POST /api/settings/integrations/:key/test
 */
exports.testIntegration = async (req, res) => {
    try {
        const { key } = req.params;
        if (key !== emailService.EMAIL_PROVIDER_KEY) {
            return res.status(400).json({
                success: false,
                message: 'Test not supported for this integration'
            });
        }

        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Your account has no email address. Add an email to your profile to receive test emails.'
            });
        }

        if (!(await emailService.isConfiguredForOrganization(req.user.organizationId))) {
            return res.status(400).json({
                success: false,
                message: 'Email service is not configured. Save SMTP credentials in Settings > Integrations > Email Provider.'
            });
        }

        const result = await emailService.sendEmail({
            organizationId: req.user.organizationId,
            to: userEmail,
            subject: 'Arivu – Test Email',
            text: 'This is a test email from Arivu. If you received this, your email integration is working.',
            html: '<p>This is a test email from Arivu.</p><p>If you received this, your email integration is working.</p>'
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send test email',
                error: result.error
            });
        }

        const providerLabel = result.provider || 'unknown';
        res.json({
            success: true,
            message: `Test email sent via ${providerLabel} to ${userEmail}. Check your inbox (or Mailpit if using local SMTP).`,
            provider: providerLabel
        });
    } catch (error) {
        console.error('Test integration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: error.message
        });
    }
};

/**
 * Disable integration (org-level)
 * POST /api/settings/integrations/:key/disable
 */
exports.disableIntegration = async (req, res) => {
    try {
        const { key } = req.params;
        const integration = integrationRegistry.find((i) => i.key === key);
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'Integration not found'
            });
        }

        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const current = organization.integrations || {};
        const state = current[key] || {};
        const now = new Date();
        const before = cloneForAudit({
            enabled: !!state.enabled,
            status: state.status || 'disconnected'
        });

        const nextState = {
            ...state,
            enabled: false,
            status: 'disconnected',
            disconnectedAt: now
        };

        await persistOrganizationIntegrationUpdate(req.user.organizationId, key, nextState);

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({ enabled: false, status: 'disconnected' }),
            { keys: ['enabled', 'status'] }
        );

        res.json({
            success: true,
            message: 'Integration disabled successfully',
            integration: {
                key,
                enabled: false,
                status: 'disconnected',
                disconnectedAt: nextState.disconnectedAt
            }
        });
    } catch (error) {
        console.error('Disable integration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable integration',
            error: error.message
        });
    }
};

/**
 * Get organization status-types configuration
 * GET /api/settings/core-modules/organizations/status-types
 * 
 * Returns tenant-specific configuration for organization types and status picklists.
 * If no tenant override exists, returns null (frontend will use module defaults).
 */
exports.getOrganizationStatusTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Find tenant module configuration for organizations module
        // Status-types configuration is module-level (not app-specific), so we check for any app key
        // Priority: SALES > HELPDESK > other apps (since organizations are primarily used in Sales context)
        const appPriority = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'LMS'];
        let tenantConfig = null;
        
        for (const appKey of appPriority) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                appKey,
                moduleKey: 'organizations'
            }).lean();
            if (tenantConfig) break;
        }

        // Extract status-types configuration from settings
        const statusTypesConfig = tenantConfig?.settings?.statusTypes || null;

        console.log('[Backend] GET status-types - tenantConfig found:', !!tenantConfig);
        console.log('[Backend] GET status-types - Raw tenantConfig.settings:', JSON.stringify(tenantConfig?.settings, null, 2));
        console.log('[Backend] GET status-types - statusTypesConfig:', JSON.stringify(statusTypesConfig, null, 2));
        if (statusTypesConfig?.organizationTypes) {
            console.log('[Backend] GET status-types - Dealer enabled state:', statusTypesConfig.organizationTypes.find(t => t.value === 'Dealer')?.enabled);
            console.log('[Backend] GET status-types - Distributor enabled state:', statusTypesConfig.organizationTypes.find(t => t.value === 'Distributor')?.enabled);
        }

        if (!statusTypesConfig) {
            // No tenant override exists - return null to indicate use defaults
            console.log('[Backend] GET status-types - No config found, returning null');
            return res.json({
                success: true,
                data: null
            });
        }

        const { maybeCleanupRetiredOrganizationTypesForTenant, normalizeOrganizationTypesFromConfig, mergeOrganizationStatusPicklistsWithDefaults } =
            require('../utils/tenantMetadata');
        await maybeCleanupRetiredOrganizationTypesForTenant(organizationId);

        const responseData = {
            ...statusTypesConfig,
            organizationTypes: normalizeOrganizationTypesFromConfig(
                statusTypesConfig.organizationTypes
            ),
            statusPicklists: mergeOrganizationStatusPicklistsWithDefaults(
                statusTypesConfig.statusPicklists
            ),
        };

        console.log('[Backend] GET status-types - Returning config:', {
            organizationTypes: responseData.organizationTypes?.length || 0,
            customerStatus: responseData.statusPicklists?.customerStatus?.length || 0,
            partnerStatus: responseData.statusPicklists?.partnerStatus?.length || 0,
            vendorStatus: responseData.statusPicklists?.vendorStatus?.length || 0
        });

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get organization status-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get organization status-types',
            error: error.message
        });
    }
};

/**
 * Update organization status-types configuration
 * PATCH /api/settings/core-modules/organizations/status-types
 * 
 * Saves tenant-specific configuration for organization types and status picklists.
 * Stores in TenantModuleConfiguration.settings.statusTypes
 */
exports.updateOrganizationStatusTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { organizationTypes, statusPicklists } = req.body;
        
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Validate payload
        if (!organizationTypes || !statusPicklists) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payload: organizationTypes and statusPicklists are required'
            });
        }

        const {
            sanitizeOrganizationTypeDefsForSave,
            collectAllowedOrganizationTypeScopedFieldKeys
        } = require('../utils/tenantMetadata');
        const allowedFieldKeys = await collectAllowedOrganizationTypeScopedFieldKeys(organizationId);
        const parsedOrgTypes = sanitizeOrganizationTypeDefsForSave(organizationTypes, { allowedFieldKeys });
        if (!parsedOrgTypes.ok) {
            return res.status(400).json({
                success: false,
                message: parsedOrgTypes.message
            });
        }
        const normalizedOrganizationTypes = parsedOrgTypes.typeDefs;

        // Find or create tenant module configuration
        // Status-types configuration is module-level, so we store it in the first available config
        // Priority: SALES > HELPDESK > other apps
        const appPriority = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'LMS'];
        let tenantConfig = null;
        
        for (const appKey of appPriority) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                appKey,
                moduleKey: 'organizations'
            });
            if (tenantConfig) break;
        }
        
        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

        // If no config exists, create one with SALES as default appKey
        if (!tenantConfig) {
            tenantConfig = new TenantModuleConfiguration({
                organizationId,
                appKey: 'SALES',
                moduleKey: 'organizations',
                enabled: true
            });
        }

        const before = cloneForAudit(tenantConfig.settings?.statusTypes || {
            organizationTypes: [],
            statusPicklists: {}
        });

        if (!tenantConfig) {
            // Create new configuration
            tenantConfig = new TenantModuleConfiguration({
                organizationId,
                appKey: 'SALES', // Default app key for organizations module
                moduleKey: 'organizations',
                enabled: true,
                settings: {
                    statusTypes: {
                        organizationTypes: normalizedOrganizationTypes,
                        statusPicklists
                    }
                }
            });
        } else {
            // Update existing configuration
            if (!tenantConfig.settings) {
                tenantConfig.settings = {};
            }
            console.log('[Backend] PATCH status-types - BEFORE update:', {
                hasSettings: !!tenantConfig.settings,
                hasStatusTypes: !!tenantConfig.settings.statusTypes,
                currentOrgTypes: tenantConfig.settings.statusTypes?.organizationTypes?.length || 0
            });
            
            // CRITICAL: For Mongoose Mixed types, we must markModified to ensure nested changes are saved
            tenantConfig.settings.statusTypes = {
                organizationTypes: normalizedOrganizationTypes,
                statusPicklists
            };
            tenantConfig.markModified('settings'); // Mark the entire settings object as modified
            tenantConfig.markModified('settings.statusTypes'); // Also mark the nested statusTypes
            
            console.log('[Backend] PATCH status-types - AFTER update (before save):', {
                organizationTypes: tenantConfig.settings.statusTypes.organizationTypes?.length || 0,
                customerStatus: tenantConfig.settings.statusTypes.statusPicklists?.customerStatus?.length || 0,
                dealerEnabled: tenantConfig.settings.statusTypes.organizationTypes?.find(t => t.value === 'Dealer')?.enabled
            });
        }

        const saveResult = await tenantConfig.save();
        
        // CRITICAL: Reload from database to verify what was actually saved
        const savedConfig = await TenantModuleConfiguration.findById(tenantConfig._id).lean();
        console.log('[Backend] PATCH status-types - AFTER save (from DB - reloaded):', {
            organizationTypes: savedConfig?.settings?.statusTypes?.organizationTypes?.length || 0,
            dealerEnabled: savedConfig?.settings?.statusTypes?.organizationTypes?.find(t => t.value === 'Dealer')?.enabled,
            distributorEnabled: savedConfig?.settings?.statusTypes?.organizationTypes?.find(t => t.value === 'Distributor')?.enabled,
            fullDealerObject: savedConfig?.settings?.statusTypes?.organizationTypes?.find(t => t.value === 'Dealer')
        });
        console.log('[Backend] PATCH status-types - Full saved organizationTypes:', JSON.stringify(savedConfig?.settings?.statusTypes?.organizationTypes, null, 2));

        console.log('[Backend] PATCH status-types - Saved successfully:', {
            organizationTypes: organizationTypes?.length || 0,
            customerStatus: statusPicklists?.customerStatus?.length || 0,
            partnerStatus: statusPicklists?.partnerStatus?.length || 0,
            vendorStatus: statusPicklists?.vendorStatus?.length || 0
        });
        console.log('[Backend] PATCH status-types - Full saved data:', JSON.stringify({
            organizationTypes,
            statusPicklists
        }, null, 2));

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({
                organizationTypes: normalizedOrganizationTypes,
                statusPicklists
            }),
            { body: req.body || {} }
        );

        res.json({
            success: true,
            message: 'Organization status-types updated successfully',
            data: {
                organizationTypes: normalizedOrganizationTypes,
                statusPicklists
            }
        });
    } catch (error) {
        console.error('Update organization status-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update organization status-types',
            error: error.message
        });
    }
};

/**
 * Per-role usage counts for participations.{appKey}.role (non-deleted people).
 * GET /api/settings/core-modules/people/people-types/usage?appKey=SALES|HELPDESK
 */
exports.getPeopleTypesUsage = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const appKey = (req.query.appKey || 'SALES').toUpperCase();

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const allowedApps = new Set(['SALES', 'HELPDESK']);
        if (!allowedApps.has(appKey)) {
            return res.status(400).json({
                success: false,
                message: 'appKey must be SALES or HELPDESK'
            });
        }

        const orgOid = mongoose.Types.ObjectId.isValid(String(organizationId))
            ? new mongoose.Types.ObjectId(String(organizationId))
            : organizationId;

        const rows = await People.aggregate([
            {
                $match: {
                    organizationId: orgOid,
                    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
                }
            },
            {
                $project: {
                    role: `$participations.${appKey}.role`
                }
            },
            {
                $match: {
                    role: { $type: 'string', $nin: [null, ''] }
                }
            },
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        const byRole = {};
        for (const row of rows) {
            if (row._id != null) {
                byRole[String(row._id)] = row.count;
            }
        }

        res.json({
            success: true,
            data: byRole,
            appKey
        });
    } catch (error) {
        console.error('Get people-types usage error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get people type usage',
            error: error.message
        });
    }
};

/**
 * Get people types (e.g. Lead, Contact) from TenantModuleConfiguration.settings.peopleTypes
 * GET /api/settings/core-modules/people/people-types?appKey=SALES|HELPDESK
 * Returns { types, defaultRole, typeDefs } where each typeDef may include optional `fields: string[]` for per-type participation fields in quick create / attach.
 */
exports.getPeopleTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const appKey = (req.query.appKey || 'SALES').toUpperCase();

        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
        const { types, defaultRole, typeDefs } = await getPeopleTypesConfig(organizationId, appKey);

        res.json({
            success: true,
            data: {
                types,
                defaultRole,
                typeDefs
            },
            appKey
        });
    } catch (error) {
        console.error('Get people-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get people types',
            error: error.message
        });
    }
};

/**
 * Update people types for one app (SALES / HELPDESK) on TenantModuleConfiguration.settings.peopleTypes
 * PUT /api/settings/core-modules/people/people-types
 * Body: { appKey, types: (string | { value, color, fields?: string[] })[], defaultRole?: string }
 * Stored shape per app: { types: { value, color, fields?: string[] }[], default: string }
 */
exports.updatePeopleTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const appKey = String(req.body?.appKey || '').toUpperCase().trim();
        const typesIn = req.body?.types;
        const defaultIn = req.body?.defaultRole != null ? req.body.defaultRole : req.body?.default;
        const allowedApps = new Set(['SALES', 'HELPDESK']);

        if (!allowedApps.has(appKey)) {
            return res.status(400).json({
                success: false,
                message: 'appKey must be SALES or HELPDESK'
            });
        }

        const {
            sanitizePeopleTypeDefsForSave,
            collectAllowedPeopleParticipationFieldKeys
        } = require('../utils/tenantMetadata');
        const allowedFieldKeys = await collectAllowedPeopleParticipationFieldKeys(organizationId, appKey);
        const parsed = sanitizePeopleTypeDefsForSave(typesIn, { allowedFieldKeys });
        if (!parsed.ok) {
            return res.status(400).json({
                success: false,
                message: parsed.message
            });
        }

        const normalizedDefs = parsed.typeDefs;
        const normalized = normalizedDefs.map((d) => d.value);

        // Default must always be a member of types (e.g. if client removed the old default role)
        let defaultCanonical = normalized[0];
        if (defaultIn != null && String(defaultIn).trim()) {
            const want = String(defaultIn).trim();
            const match = normalized.find((t) => t.toLowerCase() === want.toLowerCase());
            defaultCanonical = match || normalized[0];
        }

        let tenantConfig = await TenantModuleConfiguration.findOne({
            organizationId,
            moduleKey: 'people',
            'settings.peopleTypes': { $exists: true, $ne: null }
        });

        if (!tenantConfig) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                appKey: 'SALES',
                moduleKey: 'people'
            });
        }

        if (!tenantConfig) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                moduleKey: 'people'
            });
        }

        if (!tenantConfig) {
            tenantConfig = new TenantModuleConfiguration({
                organizationId,
                appKey: 'SALES',
                moduleKey: 'people',
                enabled: true
            });
        }

        if (!tenantConfig.settings) {
            tenantConfig.settings = {};
        }
        if (!tenantConfig.settings.peopleTypes || typeof tenantConfig.settings.peopleTypes !== 'object') {
            tenantConfig.settings.peopleTypes = {};
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit(tenantConfig.settings.peopleTypes[appKey] || null);

        tenantConfig.settings.peopleTypes[appKey] = {
            types: normalizedDefs,
            default: defaultCanonical
        };
        tenantConfig.markModified('settings');
        tenantConfig.markModified('settings.peopleTypes');
        await tenantConfig.save();

        const after = cloneForAudit({
            types: normalizedDefs,
            default: defaultCanonical
        });
        attachSettingsAuditDiff(res, before, after, {
            keys: ['types', 'default']
        });

        console.log(
            JSON.stringify({
                type: 'SETTINGS_AUDIT',
                event: 'people_types_updated',
                organizationId: String(organizationId),
                userId: req.user?._id != null ? String(req.user._id) : null,
                appKey,
                types: normalized,
                typeDefs: normalizedDefs,
                default: defaultCanonical,
                at: new Date().toISOString()
            })
        );

        res.json({
            success: true,
            message: 'People types updated',
            data: {
                types: normalized,
                defaultRole: defaultCanonical,
                typeDefs: normalizedDefs
            },
            appKey
        });
    } catch (error) {
        console.error('Update people-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update people types',
            error: error.message
        });
    }
};

/**
 * GET /api/settings/core-modules/organizations/participation-types/usage?appKey=
 * Counts CRM orgs with participations[APP].role === role (or types[] fallback).
 */
exports.getOrganizationParticipationTypesUsage = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const appKey = String(req.query.appKey || 'SALES').toUpperCase().trim();
        const {
            ORGANIZATION_PARTICIPATION_APP_KEYS,
        } = require('../constants/organizationParticipation');
        if (!ORGANIZATION_PARTICIPATION_APP_KEYS.includes(appKey)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appKey',
            });
        }
        if (!organizationId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const Organization = require('../models/Organization');
        const { getOrganizationParticipationTypesConfig } = require('../utils/tenantMetadata');
        const { types } = await getOrganizationParticipationTypesConfig(organizationId, appKey);
        const usage = {};
        for (const role of types) {
            usage[role] = 0;
        }

        const path = `participations.${appKey}.role`;
        const rows = await Organization.aggregate([
            { $match: { isTenant: false, [path]: { $exists: true, $ne: null } } },
            { $group: { _id: `$${path}`, count: { $sum: 1 } } },
        ]);
        for (const row of rows) {
            const role = String(row._id || '').trim();
            if (!role) continue;
            const match = types.find((t) => t.toLowerCase() === role.toLowerCase());
            const key = match || role;
            usage[key] = (usage[key] || 0) + row.count;
        }

        res.json({ success: true, appKey, data: { usage } });
    } catch (error) {
        console.error('getOrganizationParticipationTypesUsage error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get organization participation type usage',
            error: error.message,
        });
    }
};

/**
 * GET /api/settings/core-modules/organizations/participation-types?appKey=
 */
exports.getOrganizationParticipationTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const appKey = (req.query.appKey || 'SALES').toUpperCase();
        if (!organizationId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const {
            ORGANIZATION_PARTICIPATION_APP_KEYS,
        } = require('../constants/organizationParticipation');
        if (!ORGANIZATION_PARTICIPATION_APP_KEYS.includes(appKey)) {
            return res.status(400).json({
                success: false,
                message: 'appKey must be one of SALES, HELPDESK, INVENTORY, MARKETING, PORTAL',
            });
        }
        const { getOrganizationParticipationTypesConfig } = require('../utils/tenantMetadata');
        const { types, defaultRole, typeDefs } =
            await getOrganizationParticipationTypesConfig(organizationId, appKey);
        res.json({
            success: true,
            data: { types, defaultRole, typeDefs },
            appKey,
        });
    } catch (error) {
        console.error('Get organization participation-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get organization participation types',
            error: error.message,
        });
    }
};

/**
 * PUT /api/settings/core-modules/organizations/participation-types
 * Body: { appKey, types: (string | { value, color, fields? })[], defaultRole? }
 */
exports.updateOrganizationParticipationTypes = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        if (!organizationId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const appKey = String(req.body?.appKey || '').toUpperCase().trim();
        const typesIn = req.body?.types;
        const defaultIn = req.body?.defaultRole != null ? req.body.defaultRole : req.body?.default;
        const {
            ORGANIZATION_PARTICIPATION_APP_KEYS,
        } = require('../constants/organizationParticipation');
        if (!ORGANIZATION_PARTICIPATION_APP_KEYS.includes(appKey)) {
            return res.status(400).json({
                success: false,
                message: 'appKey must be one of SALES, HELPDESK, INVENTORY, MARKETING, PORTAL',
            });
        }

        const {
            sanitizePeopleTypeDefsForSave,
            collectAllowedOrganizationParticipationFieldKeys,
        } = require('../utils/tenantMetadata');
        const allowedFieldKeys = await collectAllowedOrganizationParticipationFieldKeys(
            organizationId,
            appKey
        );
        const parsed = sanitizePeopleTypeDefsForSave(typesIn, { allowedFieldKeys });
        if (!parsed.ok) {
            return res.status(400).json({
                success: false,
                message: parsed.message,
            });
        }

        const normalizedDefs = parsed.typeDefs;
        const normalized = normalizedDefs.map((d) => d.value);
        let defaultCanonical = normalized[0];
        if (defaultIn != null && String(defaultIn).trim()) {
            const want = String(defaultIn).trim();
            const match = normalized.find((t) => t.toLowerCase() === want.toLowerCase());
            defaultCanonical = match || normalized[0];
        }

        let tenantConfig = await TenantModuleConfiguration.findOne({
            organizationId,
            moduleKey: 'organizations',
            'settings.organizationParticipationTypes': { $exists: true, $ne: null },
        });
        if (!tenantConfig) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                appKey: 'SALES',
                moduleKey: 'organizations',
            });
        }
        if (!tenantConfig) {
            tenantConfig = await TenantModuleConfiguration.findOne({
                organizationId,
                moduleKey: 'organizations',
            });
        }
        if (!tenantConfig) {
            tenantConfig = new TenantModuleConfiguration({
                organizationId,
                appKey: 'SALES',
                moduleKey: 'organizations',
                enabled: true,
            });
        }

        if (!tenantConfig.settings) tenantConfig.settings = {};
        if (
            !tenantConfig.settings.organizationParticipationTypes ||
            typeof tenantConfig.settings.organizationParticipationTypes !== 'object'
        ) {
            tenantConfig.settings.organizationParticipationTypes = {};
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit(
            tenantConfig.settings.organizationParticipationTypes[appKey] || null
        );

        tenantConfig.settings.organizationParticipationTypes[appKey] = {
            types: normalizedDefs,
            default: defaultCanonical,
        };
        tenantConfig.markModified('settings');
        tenantConfig.markModified('settings.organizationParticipationTypes');
        await tenantConfig.save();

        const after = cloneForAudit({
            types: normalizedDefs,
            default: defaultCanonical,
        });
        attachSettingsAuditDiff(res, before, after, { keys: ['types', 'default'] });

        res.json({
            success: true,
            message: 'Organization participation types updated',
            data: {
                types: normalized,
                defaultRole: defaultCanonical,
                typeDefs: normalizedDefs,
            },
            appKey,
        });
    } catch (error) {
        console.error('Update organization participation-types error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update organization participation types',
            error: error.message,
        });
    }
};

/**
 * GET /api/settings/billing/external-user-usage
 * V1 usage collection — no seat blocking.
 */
exports.getExternalUserUsage = async (req, res) => {
    try {
        const { getExternalUserUsage } = require('../services/externalUserUsageService');
        const data = await getExternalUserUsage(req.user.organizationId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('getExternalUserUsage error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load external user usage'
        });
    }
};

function canManageTrialExtension(user) {
    if (!user) return false;
    if (user.isOwner) return true;
    const role = String(user.role || '').toLowerCase();
    if (role === 'admin' || role === 'owner') return true;
    return Boolean(user.permissions?.settings?.manageBilling);
}

exports.getTrialStatus = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const {
            buildTrialStatusSnapshot,
            reconcileOrgSubscriptionWithOrganizationTrial,
            TRIAL_EXTENSION_DAYS
        } = require('../services/trialExtensionService');

        const orgSubscription = await OrganizationSubscription.findOne({
            organizationId: organization._id
        });
        if (orgSubscription && reconcileOrgSubscriptionWithOrganizationTrial(organization, orgSubscription)) {
            await orgSubscription.save();
        }

        const snapshot = buildTrialStatusSnapshot(organization);

        res.json({
            success: true,
            data: {
                ...snapshot,
                extensionDays: TRIAL_EXTENSION_DAYS,
                canExtend: canManageTrialExtension(req.user)
                    && snapshot.expired === true
                    && snapshot.extensionUsed !== true
            }
        });
    } catch (error) {
        console.error('[getTrialStatus] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load trial status'
        });
    }
};

exports.extendTrial = async (req, res) => {
    try {
        if (!canManageTrialExtension(req.user)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to extend the trial.'
            });
        }

        const { extendOrganizationTrial } = require('../services/trialExtensionService');
        const Organization = require('../models/Organization');
        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const orgBefore = await Organization.findById(req.user.organizationId).select('subscription').lean();
        const before = cloneForAudit({
            trialEndDate: orgBefore?.subscription?.trialEndDate || null,
            trialExtensionUsed: !!orgBefore?.subscription?.trialExtensionUsed
        });

        const result = await extendOrganizationTrial({
            organizationId: req.user.organizationId,
            userId: req.user._id,
            reason: req.body?.reason
        });

        if (!result.ok) {
            const statusByCode = {
                REASON_REQUIRED: 400,
                NOT_ON_TRIAL: 400,
                TRIAL_NOT_EXPIRED: 400,
                EXTENSION_ALREADY_USED: 409
            };
            return res.status(statusByCode[result.code] || 400).json({
                success: false,
                code: result.code,
                message: result.message
            });
        }

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({
                trialEndDate: result.trialEndDate ?? null,
                trialExtensionUsed: true
            }),
            { keys: ['trialEndDate', 'trialExtensionUsed'] }
        );

        res.json({
            success: true,
            data: {
                subscription: result.subscription,
                trialDaysRemaining: result.trialDaysRemaining,
                trialEndDate: result.trialEndDate
            },
            message: 'Trial extended successfully.'
        });
    } catch (error) {
        console.error('[extendTrial] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to extend trial'
        });
    }
};
