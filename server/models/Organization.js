/**
 * ============================================================================
 * PLATFORM CORE: Organization Model (Dual-Purpose)
 * ============================================================================
 * 
 * This model serves TWO purposes:
 * 
 * 1. PLATFORM CORE (Tenant Organization):
 *    - Tenant/workspace management (isTenant: true)
 *    - Subscription and billing
 *    - App enablement (enabledApps)
 *    - Usage limits
 *    - Organization settings
 * 
 * 2. SALES APP (SALES Organization Entity):
 *    - Customer/Partner/Vendor records (isTenant: false)
 *    - SALES-specific fields (types, status, tiers, etc.)
 * 
 * ⚠️ ARCHITECTURAL NOTE: Single model for both tenant and SALES entity
 *    This is intentional for now - use isTenant flag to distinguish
 *    Future: Could be split into TenantOrganization (Platform Core) and
 *            SalesOrganization (SALES App) if needed for clearer separation.
 * 
 * ✅ FIXED: enabledModules default changed to empty array (app-agnostic)
 *    - Legacy field kept for backward compatibility
 *    - Use enabledApps for app-level enablement
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');

const OrganizationSchema = new mongoose.Schema({
    // ===== TENANT/SUBSCRIPTION FIELDS (PLATFORM CORE) =====
    // Basic Information
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    /** Human-readable Record ID for CRM organizations (isTenant: false). */
    organizationNumber: {
        type: String,
        trim: true,
    },
    slug: { 
        type: String, 
        unique: true,
        sparse: true, // Allow null/undefined for SALES organizations
        lowercase: true
    },
    industry: { 
        type: String,
        trim: true
    },
    
    // Subscription Management (only for tenant organizations)
    subscription: {
        status: { 
            type: String, 
            enum: ['trial', 'active', 'expired', 'cancelled'],
            default: 'trial'
        },
        tier: { 
            type: String, 
            enum: ['trial', 'paid'],
            default: 'trial'
        },
        trialStartDate: { 
            type: Date, 
            default: Date.now 
        },
        trialEndDate: { 
            type: Date,
            default: function() {
                const date = new Date();
                date.setDate(date.getDate() + 15);
                return date;
            }
        },
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        autoRenew: { 
            type: Boolean, 
            default: true 
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        trialExtensionUsed: {
            type: Boolean,
            default: false
        },
        trialExtendedAt: Date,
        trialExtensionReason: {
            type: String,
            trim: true
        }
    },
    
    // Limits & Features based on subscription tier (only for tenant organizations)
    limits: {
        maxUsers: { 
            type: Number, 
            default: 3
        },
        maxContacts: { 
            type: Number, 
            default: 100 
        },
        maxDeals: { 
            type: Number, 
            default: 50 
        },
        maxStorageGB: { 
            type: Number, 
            default: 1 
        }
    },

    // Usage counters (V1 external users — collect only; seat enforcement in V1.5)
    usage: {
        externalUsers: {
            active: { type: Number, default: 0 },
            lastUpdatedAt: { type: Date, default: null }
        }
    },
    
    // Enabled Apps (app-level enablement for tenant organizations)
    // Controls which applications are available to the organization
    // This is the single source of truth for organization app subscriptions
    // Note: 'CRM' is not an app - it's legacy terminology. Use SALES instead.
    // - 'SALES': Sales application (replaces legacy CRM)
    // - 'HELPDESK': Helpdesk application
    // - 'PROJECTS': Projects application
    // - 'PORTAL': Customer/Partner portal application
    // - 'AUDIT': Audit management application
    // - 'LMS': Learning Management System application
    // - 'INVENTORY': Stock ledger, locations, reservations, fulfillment
    // - 'MARKETING': Email campaigns, audiences, templates, marketing analytics
    enabledApps: [
        {
            appKey: { 
                type: String, 
                required: true,
                enum: ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING']
            },
            status: { 
                type: String, 
                enum: ['ACTIVE', 'SUSPENDED'], 
                default: 'ACTIVE' 
            },
            enabledAt: { 
                type: Date, 
                default: Date.now 
            }
        }
    ],
    
    // Legacy: Enabled Modules (CRM-specific, deprecated)
    // ⚠️ PLATFORM CORE VIOLATION: Default contains CRM-specific module names
    //    Kept for backward compatibility - will be migrated to enabledApps
    //    Changed default to empty array to be app-agnostic
    // @deprecated Use enabledApps instead
    enabledModules: {
        type: [String],
        default: [] // Changed from ['contacts', 'deals', 'tasks', 'events'] to be app-agnostic
    },
    
    // Module Participation Overrides (organization-level)
    // Tracks which applications use which core modules
    // Format: { moduleKey: { appKey: enabled } }
    // Example: { 'people': { 'SALES': true, 'HELPDESK': false } }
    moduleOverrides: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    aiSettings: {
        enabled: {
            type: Boolean,
            default: false
        },
        llmProvider: {
            type: String,
            enum: ['arivu', 'openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter', 'nvidia', 'bedrock'],
            default: 'arivu'
        },
        llmModel: {
            type: String,
            trim: true,
            default: null
        },
        embeddingProvider: {
            type: String,
            enum: ['openai', 'azure_openai', 'openrouter', 'voyage'],
            default: 'openai'
        },
        keyMode: {
            type: String,
            enum: ['platform', 'byok'],
            default: 'platform'
        },
        apiKeyEncrypted: {
            type: String,
            default: null,
            select: false
        },
        apiKeyLast4: {
            type: String,
            default: null
        },
        azureResourceName: {
            type: String,
            trim: true,
            default: null
        },
        azureDeploymentName: {
            type: String,
            trim: true,
            default: null
        },
        region: {
            type: String,
            trim: true,
            default: null
        },
        modelOverrides: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        credits: {
            /** Available token balance (platform metering). */
            balance: { type: Number, default: 0, min: 0 },
            /** Lifetime tokens granted (starter + purchases). consumed = grantedTotal - balance. */
            grantedTotal: { type: Number, default: 0, min: 0 },
            /** 'tokens' after migrateAiCreditsBalanceToTokens; absent/credits = pre-migration. */
            ledgerUnit: { type: String, enum: ['tokens', 'credits'], default: 'tokens' },
            softLimitNotifiedAt: { type: Date, default: null },
            /** Set once when fresh-tenant 1M token starter grant is applied. */
            starterGrantAt: { type: Date, default: null },
            starterGrantTokens: { type: Number, default: null, min: 0 },
        },
        dataUseConsent: {
            accepted: { type: Boolean, default: false },
            acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            acceptedAt: { type: Date, default: null }
        },
        platformHomeAiFocus: {
            type: Boolean,
            default: false
        },
        piiCustomRules: {
            type: [{
                id: { type: String, trim: true, maxlength: 64 },
                label: { type: String, trim: true, maxlength: 80 },
                pattern: { type: String, trim: true, maxlength: 200 },
                replacement: { type: String, trim: true, maxlength: 40, default: '[CUSTOM]' },
                matchType: { type: String, enum: ['regex', 'literal'], default: 'literal' },
                enabled: { type: Boolean, default: true },
            }],
            default: []
        }
    },
    
    // CRM Initialization Status (multi-pod safe)
    // Tracks whether CRM modules have been initialized for this organization
    // Used as source of truth for lazy CRM initialization across multiple pods
    crmInitialized: {
        type: Boolean,
        default: false,
        index: true // Index for fast lookups
    },
    
    // Organization Settings (only for tenant organizations)
    settings: {
        dateFormat: { 
            type: String, 
            default: 'MM/DD/YYYY' 
        },
        timeZone: { 
            type: String, 
            default: 'UTC' 
        },
        currency: { 
            type: String, 
            default: 'USD' 
        },
        /** Enabled non-base currencies with manual conversion rates vs settings.currency */
        currencies: [{
            code: { type: String, required: true, uppercase: true, trim: true },
            enabled: { type: Boolean, default: false },
            conversionRate: { type: Number, default: 1, min: 0 }
        }],
        locale: { 
            type: String, 
            default: 'en-US' 
        },
        language: { 
            type: String, 
            default: 'en' 
        },
        /** ISO 3166-1 alpha-2 default for phone inputs; empty = derive from locale at runtime */
        defaultPhoneCountry: {
            type: String,
            trim: true,
            uppercase: true,
            default: ''
        },
        logoUrl: String,
        primaryColor: { 
            type: String, 
            default: '#3a1f8a' 
        },
        /**
         * Canonical financial-year start month (1–12).
         * Mirrored to settings.analytics.fiscalYearStartMonth for Analytics UI compatibility.
         */
        fiscalYearStartMonth: {
            type: Number,
            default: 1,
            min: 1,
            max: 12
        },
        /** Operating / company address for Company Details (not SaaS bill-to). */
        companyAddress: {
            line1: { type: String, trim: true, default: '' },
            city: { type: String, trim: true, default: '' },
            postalCode: { type: String, trim: true, default: '' },
            country: { type: String, trim: true, uppercase: true, default: '' }
        },
        /** Public social profile URLs for templates / company profile. */
        social: {
            facebook: { type: String, trim: true, default: '' },
            twitter: { type: String, trim: true, default: '' },
            linkedin: { type: String, trim: true, default: '' }
        },
        rbacV2Enabled: {
            type: Boolean,
            default: false
        },
        sharingV1Enabled: {
            type: Boolean,
            default: false
        },
        /** External User / Portal Framework v1 — staged per-tenant rollout */
        portalFrameworkV1Enabled: {
            type: Boolean,
            default: false
        },
        /**
         * Learning Academy (EXTERNAL /academy) — owned by Learning, not CRM Portal.
         * @see docs/LEARNING_PORTAL_ACADEMY_V2.md
         */
        learningAcademy: {
            enabled: { type: Boolean, default: false },
            name: { type: String, trim: true, default: '' },
            logoUrl: { type: String, default: null },
            faviconUrl: { type: String, default: null },
            primaryColor: { type: String, default: '#3a1f8a' },
            secondaryColor: { type: String, default: null },
            customDomain: { type: String, trim: true, lowercase: true, default: null },
            catalogVisibility: {
                type: String,
                enum: ['assigned', 'audience', 'invite_only'],
                default: 'assigned',
            },
            allowedAudiences: {
                type: [{ type: String, enum: ['customer', 'partner', 'external'] }],
                default: () => ['customer', 'partner', 'external'],
            },
        },
        /** Platform quotes module policies (tenant-wide) */
        quotes: {
            requireApprovalBeforeSend: {
                type: Boolean,
                default: false
            },
            requireCustomerAgreement: {
                type: Boolean,
                default: false
            },
            requireTypedSignature: {
                type: Boolean,
                default: false
            },
            customerAgreementText: {
                type: String,
                trim: true,
                maxlength: 2000,
                default: ''
            },
            pdfFooterText: {
                type: String,
                trim: true,
                maxlength: 500,
                default: ''
            },
            emailSignature: {
                type: String,
                trim: true,
                maxlength: 2000,
                default: ''
            },
            brandColor: {
                type: String,
                trim: true,
                maxlength: 7,
                default: ''
            },
            documentTitle: {
                type: String,
                trim: true,
                maxlength: 80,
                default: ''
            }
        },
        analytics: {
            cacheTtlSeconds: { type: Number, default: 300, min: 0 },
            exportRowLimit: { type: Number, default: 10000, min: 1 },
            fiscalYearStartMonth: { type: Number, default: 1, min: 1, max: 12 },
            defaultDatePreset: { type: String, default: 'last30days', trim: true },
        },
        platformHomeDefaultLayout: {
            items: {
                type: [require('../constants/platformHomeLayout').PlatformHomeLayoutItemSchema],
                default: []
            },
            widthMode: {
                type: String,
                enum: ['compact', 'wide'],
                default: 'wide'
            }
        }
    },

    // Founder org setup progress (website signup track)
    onboarding: {
        setupCompletedAt: Date,
        sampleDataAccepted: { type: Boolean, default: false },
        sampleDataDeclinedAt: Date,
        settingsVisitedAt: Date,
        trialNudgesSent: [{
            day: { type: Number, required: true },
            sentAt: { type: Date, required: true }
        }],
        steps: [{
            key: { type: String, required: true },
            status: {
                type: String,
                enum: ['pending', 'completed', 'skipped'],
                default: 'pending'
            },
            completedAt: Date,
            skippedAt: Date
        }]
    },

    // Public embed keys (Option B) — safe identifiers for widgets.
    // Stored on master Organization so public requests can resolve tenant context.
    embed: {
        chat: {
            enabled: { type: Boolean, default: false },
            publicKey: { type: String, default: null, index: true },
            config: {
                captureFields: {
                    type: [String],
                    default: ['name', 'email']
                },
                welcomeMessage: {
                    type: String,
                    default: "Hey! Let’s discuss how we can help you. Fill out the form to start chatting."
                },
                brandColor: {
                    type: String,
                    default: '#4f46e5'
                }
            }
        },
        articles: {
            publicKey: { type: String, default: null, index: true },
        },
        blog: {
            publicKey: { type: String, default: null, index: true },
        }
    },

    contentPublishing: {
        publishWebhookUrl: { type: String, default: '' },
        headlessApiEnabled: { type: Boolean, default: true },
    },
    
    // Data Region (read-only if fixed, set during organization creation)
    dataRegion: {
        type: String,
        default: 'us-east-1' // Default region, can be set during org creation
    },
    
    // Security Configuration (platform-wide security policies)
    security: {
        // Password Policy
        passwordPolicy: {
            minLength: { type: Number, default: 8 },
            requireUppercase: { type: Boolean, default: true },
            requireLowercase: { type: Boolean, default: true },
            requireNumbers: { type: Boolean, default: true },
            requireSpecialChars: { type: Boolean, default: false },
            expirationDays: { type: Number, default: 90 }, // 0 = no expiration
            preventReuse: { type: Number, default: 5 } // Number of previous passwords to prevent reuse
        },
        // Session Rules
        sessionRules: {
            durationHours: { type: Number, default: 24 }, // Session duration in hours
            idleTimeoutMinutes: { type: Number, default: 30 }, // Idle timeout in minutes
            maxConcurrentSessions: { type: Number, default: 5 } // Max concurrent sessions per user
        },
        // Login Restrictions
        loginRestrictions: {
            ipWhitelist: [{ type: String }], // Allowed IP addresses (empty = no restriction)
            ipBlacklist: [{ type: String }], // Blocked IP addresses
            allowedRegions: [{ type: String }], // Allowed regions (empty = no restriction)
            blockFailedAttempts: { type: Boolean, default: true },
            maxFailedAttempts: { type: Number, default: 5 },
            lockoutDurationMinutes: { type: Number, default: 15 }
        },
        // Two-Factor Authentication
        twoFactorAuth: {
            enabled: { type: Boolean, default: false },
            required: { type: Boolean, default: false }, // Require 2FA for all users
            methods: [{ type: String, enum: ['totp', 'sms', 'email'], default: ['totp'] }] // Allowed 2FA methods
        }
    },

    // Integrations (organization-level integration state)
    // Format: { [integrationKey]: { enabled, status, connectedAt, disconnectedAt } }
    integrations: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Status
    isActive: { 
        type: Boolean, 
        default: true 
    },
    
    // Database Configuration (for dedicated database per organization)
    database: {
        name: {
            type: String,
            // Format: arivu_{slug} or arivu_{organizationId}
        },
        connectionString: {
            type: String,
            // Full MongoDB connection string to organization's database
        },
        createdAt: Date,
        initialized: {
            type: Boolean,
            default: false
        }
    },
    
    // ===== CRM FIELDS (from OrganizationV2) =====
    // CRM Core
    // types[] = denormalized union of participation roles (field visibility / filters / BC)
    // participations[APP] = { role } — app-scoped source of truth (mirrors People)
    types: {
        type: [String],
        default: []
    },
    participations: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    tags: [{ type: String, trim: true }],

    /** System-managed creation channel (set server-side only) */
    source: {
        type: String,
        enum: RECORD_SOURCE_VALUES,
        default: DEFAULT_RECORD_SOURCE
    },
    
    // Ownership/links (SALES)
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        index: true 
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // CRM company records only — tenant workspaces must not require assignedTo
        required: function requiredAssignedToForCrmOrg() {
            return this.isTenant === false;
        },
        index: true
    },
    primaryContact: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'People' 
    },
    
    // Customer-specific
    customerStatus: {
        type: String,
        trim: true
    },
    customerTier: {
        type: String,
        trim: true
    },
    slaLevel: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    creditLimit: { type: Number, min: 0 },
    accountManager: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    annualRevenue: { type: Number, min: 0 },
    numberOfEmployees: { type: Number, min: 0 },
    
    // Partner-specific
    partnerStatus: {
        type: String,
        trim: true
    },
    partnerTier: {
        type: String,
        trim: true
    },
    partnerType: {
        type: String,
        trim: true
    },
    partnerSince: { type: Date },
    partnerOnboardingSteps: mongoose.Schema.Types.Mixed,
    territory: [{ type: String, trim: true }],
    discountRate: { type: Number, min: 0, max: 100 },
    
    // Vendor-specific
    vendorStatus: {
        type: String,
        trim: true
    },
    vendorRating: { type: Number, min: 0 },
    vendorContract: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Contract' 
    },
    preferredPaymentMethod: { type: String, trim: true },
    taxId: { type: String, trim: true },

    // India GST (GTM-1) — optional, CRM parties / tenant bill-to
    gstin: { type: String, trim: true, uppercase: true },
    gstRegistrationType: {
        type: String,
        trim: true,
        enum: [
            'regular',
            'composition',
            'unregistered',
            'sez',
            'casual',
            'isd',
            'tax_deductor',
            'tax_collector'
        ]
    },
    /** Tenant commercial bill-to: legal name on SaaS invoices (falls back to name). */
    companyName: { type: String, trim: true },
    /** True when business is GST-registered — GSTIN then required for subscribe. */
    gstRegistered: { type: Boolean, default: false },
    /** Optional uploaded GST registration certificate (URL under /api/uploads). */
    gstCertificateUrl: { type: String, trim: true, default: null },
    /** Original filename for the GST certificate upload. */
    gstCertificateFileName: { type: String, trim: true, default: null },
    /** Invoice / subscription communication email. */
    billingEmail: { type: String, trim: true, lowercase: true },
    /** Optional billing contact phone. */
    billingPhone: { type: String, trim: true },
    stateCode: { type: String, trim: true },
    /** { line1, city, state, pincode, country } */
    billingAddressStructured: { type: mongoose.Schema.Types.Mixed },

    // External sync triad (Tally / accounting connectors) — CRM parties
    externalReferenceId: { type: String, trim: true, default: null, index: true },
    syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
    lastSyncAt: { type: Date, default: null },
    
    // Distributor/Dealer-specific
    channelRegion: { type: String, trim: true },
    distributionTerritory: [{ type: String, trim: true }],
    distributionCapacityMonthly: { type: Number, min: 0 },
    dealerLevel: {
        type: String,
        trim: true
    },
    terms: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    logisticsPartner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization' 
    },
    
    // Activity Logs (Generic audit trail - app-agnostic structure)
    // ⚠️ NOTE: Used by CRM app for organization entity changes
    //    The action field is a generic string, but action values may be app-specific
    //    SALES app may use values like "customer_status_changed", "partner_tier_updated", etc.
    //    Other apps can use their own action types. The structure itself is app-agnostic.
    activityLogs: [{
        user: { type: String, required: true },
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        action: { type: String, required: true }, // Generic action type (values are app-specific)
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { 
            type: Date, 
            default: Date.now, 
            required: true 
        }
    }],

    // Description version history (native, task/deal parity)
    descriptionVersions: [{
        content: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Legacy support (for migration)
    legacyOrganizationId: { 
        type: mongoose.Schema.Types.ObjectId
    },
    
    // Distinguish tenant vs CRM organization
    isTenant: {
        type: Boolean,
        default: false // CRM organizations by default
    },
    
    // Derived Status (computed from Configuration Registry)
    // This field is computed from lifecycle mappings and is nullable
    // If no config exists or computation fails, this remains null
    derivedStatus: {
        type: String,
        trim: true,
        default: null,
        index: true
    },

    // Custom fields (user-defined via Settings → Modules & Fields)
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    /** Org-level HTML import merge tag memory (Templates email builder). */
    emailMergeTagMappings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    /** Hostnames allowed for external CSS fetch during email HTML import. */
    emailExternalCssAllowlist: {
        type: [String],
        default: []
    },

    // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 },
    importHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportHistory', default: null, index: true },

    // Duplicate merge (CRM orgs)
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    mergedAt: { type: Date, default: null },
    mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { 
    timestamps: true 
});

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ types: 1 });
OrganizationSchema.index({ industry: 1 });
OrganizationSchema.index({ customerStatus: 1 });
OrganizationSchema.index({ partnerStatus: 1 });
OrganizationSchema.index({ vendorStatus: 1 });
OrganizationSchema.index({ isTenant: 1 });
OrganizationSchema.index({ organizationNumber: 1 }, { unique: true, sparse: true });
OrganizationSchema.index({ legacyOrganizationId: 1 }, { unique: true, sparse: true });

// Prevent createdBy from being modified after creation (for CRM organizations)
OrganizationSchema.pre('findOneAndUpdate', function() {
    const update = this.getUpdate();
    if (update && update.createdBy !== undefined) {
        delete update.createdBy;
    }
    if (update && update.$set && update.$set.createdBy !== undefined) {
        delete update.$set.createdBy;
    }
});

OrganizationSchema.pre('validate', async function assignOrganizationNumber(next) {
    if (this.isTenant || this.organizationNumber || !this.isNew) return next();
    try {
        let tenantOrgId = this._tenantOrganizationId || null;
        if (!tenantOrgId && this.createdBy) {
            const User = require('./User');
            const user = await User.findById(this.createdBy).select('organizationId').lean();
            tenantOrgId = user?.organizationId || null;
        }
        if (!tenantOrgId) return next();
        const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
        await assignModuleRecordNumber(this, {
            moduleKey: 'organizations',
            fieldKey: 'organizationNumber',
            organizationId: tenantOrgId,
        });
        return next();
    } catch (err) {
        return next(err);
    }
});

OrganizationSchema.pre('save', async function(next) {
    // Prevent createdBy modification for CRM organizations
    if (!this.isTenant && !this.isNew && this.isModified('createdBy')) {
        try {
            const original = await this.constructor.findById(this._id).select('createdBy').lean();
            if (original && original.createdBy) {
                this.createdBy = original.createdBy;
                this.unmarkModified('createdBy');
            }
            next();
        } catch (error) {
            next(new Error('createdBy field cannot be modified after creation'));
        }
    } else {
        next();
    }
});

// Helper method to check if trial is expired (tenant only)
OrganizationSchema.methods.isTrialExpired = function() {
    if (!this.isTenant || this.subscription.status !== 'trial') {
        return false;
    }
    return new Date() > this.subscription.trialEndDate;
};

// Helper method to get days remaining in trial (tenant only)
OrganizationSchema.methods.getTrialDaysRemaining = function() {
    if (!this.isTenant || this.subscription.status !== 'trial') {
        return 0;
    }
    const now = new Date();
    const diff = this.subscription.trialEndDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Helper method to check if an app is enabled (tenant only)
// Supports both new object structure and legacy string array for backward compatibility
OrganizationSchema.methods.hasApp = function(appKey) {
    if (!this.isTenant) return false;
    if (!this.enabledApps || this.enabledApps.length === 0) return false;
    
    // Check if enabledApps is array of objects (new structure)
    if (typeof this.enabledApps[0] === 'object' && this.enabledApps[0] !== null) {
        return this.enabledApps.some(
            app => app.appKey === appKey && app.status === 'ACTIVE'
        );
    }
    
    // Legacy: array of strings
    return this.enabledApps.includes(appKey);
};

// Helper method to check if a feature is enabled (tenant only)
// Backward compatibility: For legacy CRM module names, checks if SALES app is enabled
// @deprecated For legacy CRM module names, use hasApp('SALES') instead
// Note: CRM is not an app - it's legacy terminology. SALES app replaces it.
OrganizationSchema.methods.hasFeature = function(featureName) {
    if (!this.isTenant) return false;
    
    // If enabledApps exists and is populated, use app-aware logic
    if (this.enabledApps && this.enabledApps.length > 0) {
        // Map legacy module names to SALES app
        const salesModules = ['contacts', 'deals', 'tasks', 'events', 'people', 'organizations', 'projects', 'items', 'documents', 'transactions', 'forms', 'processes', 'reports'];
        if (salesModules.includes(featureName)) {
            return this.hasApp('SALES');
        }
        // For non-SALES features, fall back to enabledModules for backward compatibility
        return this.enabledModules && this.enabledModules.includes(featureName);
    }
    
    // Fallback to legacy enabledModules
    return this.enabledModules && this.enabledModules.includes(featureName);
};

// Helper method to update limits based on tier (tenant only)
OrganizationSchema.methods.updateLimitsForTier = function(tier) {
    if (!this.isTenant) return this;
    
    const tierLimits = {
        trial: {
            maxUsers: -1, // Unlimited - let users explore the product
            maxContacts: -1, // Unlimited
            maxDeals: -1, // Unlimited
            maxStorageGB: -1 // Unlimited
        },
        paid: {
            maxUsers: -1, // Unlimited
            maxContacts: -1, // Unlimited
            maxDeals: -1, // Unlimited
            maxStorageGB: 1000
        }
    };
    
    this.limits = tierLimits[tier] || tierLimits.trial;
    return this.limits;
};

// Helper method to get enabled modules based on tier (tenant only)
OrganizationSchema.methods.getModulesForTier = function(tier) {
    if (!this.isTenant) return [];
    
    const tierModules = {
        trial: ['contacts', 'deals', 'tasks', 'events'],
        paid: ['contacts', 'organizations', 'deals', 'projects', 'tasks', 'events', 'items', 'documents', 'transactions', 'forms', 'processes', 'reports']
    };
    
    return tierModules[tier] || tierModules.trial;
};

// Pre-save hook to generate slug from name if not provided (tenant only)
OrganizationSchema.pre('save', function(next) {
    if (this.isTenant && !this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    next();
});

module.exports = mongoose.model('Organization', OrganizationSchema);
