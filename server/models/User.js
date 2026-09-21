/**
 * ============================================================================
 * PLATFORM CORE: User Identity Model
 * ============================================================================
 * 
 * This model represents user identity and profile (app-agnostic):
 * - User profile (firstName, lastName, email, phoneNumber, avatar)
 * - User status (active, inactive, suspended)
 * - Organization reference (multi-tenancy)
 * - Role and permissions
 * 
 * ✅ FIXED: Permissions structure marked as legacy/SALES-specific
 *    - User.permissions field is kept for backward compatibility
 *    - Permissions should be managed via Role.appPermissions (app-aware)
 *    - Login flow syncs permissions from role to user for backward compatibility
 *    - For new apps, use Role.appPermissions instead
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const UserPresenceSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['active', 'busy', 'away', 'offline'],
        default: 'active'
    },
    custom: {
        emoji: { type: String, maxlength: 16, default: null },
        text: { type: String, maxlength: 80, default: null }
    },
    expiresAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    // Organization Reference (Multi-tenancy)
    organizationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization',
        required: true
        // index: true removed - using compound index below instead
    },
    
    // Basic Information
    username: { 
        type: String, 
        required: true
    },
    email: { 
        type: String, 
        required: true,
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true 
    },
    
    // Profile Information
    firstName: String,
    lastName: String,
    phoneNumber: String,
    avatar: String,

    // Cross-device availability shown on user avatars.
    presence: { type: UserPresenceSchema, default: () => ({}) },

    // Employee / org chart
    reportsTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    /** @deprecated Prefer primaryGroupId — kept for existing data */
    department: { type: String, default: '' },
    primaryGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    secondaryEmail: {
        type: String,
        lowercase: true,
        trim: true,
        default: ''
    },
    officePhone: { type: String, default: '' },
    homePhone: { type: String, default: '' },
    mobilePhone: { type: String, default: '' },
    fax: { type: String, default: '' },

    /** Standing UI language preference (overrides org settings.language when set) */
    language: { type: String, default: null },
    /** Standing time zone preference (IANA; overrides org settings.timeZone when set) */
    timeZone: { type: String, default: null },
    /** Standing date format preference (overrides org settings.dateFormat when set) */
    dateFormat: { type: String, default: null },
    /** Standing time format preference: '12h' | '24h' (default 12h when unset) */
    timeFormat: { type: String, default: null },

    /** Currency & number display preferences (self-service + admin) */
    displayPreferences: {
        preferredCurrency: { type: String, default: null },
        showAmountsInPreferredCurrency: { type: Boolean, default: false },
        digitGroupingPattern: {
            type: String,
            enum: ['international', 'indian'],
            default: 'international'
        },
        decimalSeparator: {
            type: String,
            enum: ['.', ','],
            default: '.'
        },
        digitGroupingSeparator: {
            type: String,
            enum: [',', '.', ' ', "'"],
            default: ','
        },
        currencyDecimalPlaces: {
            type: Number,
            min: 0,
            max: 6,
            default: 2
        },
        truncateTrailingZeros: { type: Boolean, default: false },
        aggregatedNumberFormat: {
            type: String,
            enum: ['none', 'thousands', 'millions', 'billions'],
            default: 'none'
        }
    },

    /** Optional personal business hours override (BusinessHourSet) */
    businessHourSetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessHourSet',
        default: null
    },

    /**
     * Default mailbox for outbound agent/workspace email (From identity).
     * User-scoped; independent of owner-only Integrations From.
     */
    defaultOutboundMailboxId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mailbox',
        default: null
    },
    
    // Role & Permissions (RBAC)
    // NEW: Dynamic Role System
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null
    },
    // OLD: Legacy string-based role (keeping for backward compatibility)
    role: { 
        type: String, 
        enum: ['owner', 'admin', 'manager', 'user', 'viewer'],
        default: 'user'
    },
    
    // Granular Permissions (can be customized per user)
    // ⚠️ LEGACY/CRM-SPECIFIC: This structure is CRM-module-specific
    //    Permissions should be managed via Role.appPermissions (app-aware)
    //    This field is kept for backward compatibility and synced from role on login
    //    @deprecated Use Role.appPermissions instead for app-agnostic permissions
    permissions: {
        contacts: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        people: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        deals: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        quotes: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        sales_orders: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        invoices: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        payments: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        organizations: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: false },
            exportData: { type: Boolean, default: false }
        },
        projects: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true }
        },
        tasks: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: true },
            viewAll: { type: Boolean, default: true }
        },
        events: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true }
        },
        forms: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        items: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: true },
            edit: { type: Boolean, default: true },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: true },
            exportData: { type: Boolean, default: false }
        },
        cases: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: false }
        },
        imports: {
            view: { type: Boolean, default: true },
            create: { type: Boolean, default: false },
            delete: { type: Boolean, default: false }
        },
        documents: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: false },
            exportData: { type: Boolean, default: false }
        },
        templates: {
            view: { type: Boolean, default: false },
            create: { type: Boolean, default: false },
            edit: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
            publish: { type: Boolean, default: false },
            archive: { type: Boolean, default: false },
            render: { type: Boolean, default: false },
            viewAll: { type: Boolean, default: false }
        },
        settings: {
            manageUsers: { type: Boolean, default: false },
            manageBilling: { type: Boolean, default: false },
            manageIntegrations: { type: Boolean, default: false },
            customizeFields: { type: Boolean, default: false }
        },
        liveChat: {
            view: { type: Boolean, default: false },
            reply: { type: Boolean, default: false },
            admin: { type: Boolean, default: false }
        },
        announcements: {
            view: { type: Boolean, default: false },
            manage: { type: Boolean, default: false },
            publish: { type: Boolean, default: false },
            analytics: { type: Boolean, default: false }
        },
        reports: {
            viewStandard: { type: Boolean, default: true },
            viewCustom: { type: Boolean, default: false },
            createCustom: { type: Boolean, default: false },
            exportReports: { type: Boolean, default: false }
        }
    },
    
    // Special Flags
    isOwner: { 
        type: Boolean, 
        default: false 
    },  // First user who created the organization

    /** Platform operator (Control Plane, inbound parser config). Not tenant-facing. */
    isPlatformAdmin: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // Platform User Type — STANDARD | ADMIN | EXTERNAL
    // Legacy INTERNAL/SYSTEM accepted via normalize on write paths.
    userType: {
        type: String,
        enum: ['STANDARD', 'ADMIN', 'EXTERNAL', 'INTERNAL', 'SYSTEM'],
        default: 'STANDARD'
    },
    
    // App-Based Access (Core Change)
    // A user has access to an app only if an entry exists in this array
    // No implicit app access - this is the single source of truth
    // Roles are scoped to appKey - no global roles
    // Phase 2D: Added SALES, HELPDESK, PROJECTS
    appAccess: [{
        appKey: {
            type: String,
            // Keep in sync with Organization.enabledApps / TenantAppConfiguration
            enum: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL', 'LMS', 'INVENTORY', 'MARKETING'],
            required: true
        },
        roleKey: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'DISABLED'],
            default: 'ACTIVE'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Legacy App Entitlements (kept for backward compatibility during migration)
    // Defines which applications this user can access
    // - ['SALES']: SALES-only users (default for existing users)
    // - ['PORTAL']: Portal-only users
    // - ['SALES', 'PORTAL']: Multi-app users
    // Phase 2D: Added SALES, HELPDESK, PROJECTS
    allowedApps: {
        type: [String],
        enum: ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING'],
        default: ['SALES'] // Default existing users to SALES access
    },
    
    // Status
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended', 'invited', 'deleted'],
        default: 'active'
    },
    suspendedAt: { type: Date, default: null },
    reactivatedAt: { type: Date, default: null },

    // Invitation & email verification
    emailVerifiedAt: Date,
    invitedAt: Date,
    stalledInviteNotifiedAt: Date,
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    inviteAcceptedAt: Date,
    inviteTokenHash: {
        type: String,
        default: null
    },
    inviteTokenExpiresAt: Date,
    emailVerificationTokenHash: {
        type: String,
        default: null
    },
    emailVerificationSentAt: Date,
    emailVerificationExpiresAt: Date,
    passwordResetTokenHash: {
        type: String,
        default: null
    },
    passwordResetExpiresAt: Date,
    mustChangePassword: {
        type: Boolean,
        default: false
    },
    
    // Activity Tracking
    lastLogin: Date,

    /** Bumped on global session revocation; JWT sv must match. */
    authSessionVersion: {
        type: Number,
        default: 0
    },

    // --- External User / Portal (userType=EXTERNAL) ---
    peopleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'People',
        default: null
    },
    externalRoleAssignments: [{
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
            required: true
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE'],
            default: 'ACTIVE'
        },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        removedAt: { type: Date, default: null },
        removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    }],
    defaultExternalRoleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null
    },
    portalInvite: {
        inviteVersion: { type: Number, default: 0 },
        tempPasswordIssuedAt: { type: Date, default: null },
        tempPasswordUsedAt: { type: Date, default: null }
    },
    authProvider: {
        type: {
            type: String,
            enum: ['local', 'oidc', 'saml'],
            default: 'local'
        },
        externalSubjectId: { type: String, default: null },
        idpConnectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
        lastSsoLoginAt: { type: Date, default: null }
    },

    // User onboarding (invited member + founder wizard state)
    onboarding: {
        version: { type: Number, default: 1 },
        origin: {
            type: String,
            enum: ['invited', 'self_serve', 'demo_converted', null],
            default: null
        },
        persona: {
            type: String,
            enum: ['founder', 'member', null],
            default: null
        },
        context: {
            primaryAppKey: String,
            roleKey: String,
            roleName: String,
            entitledAppKeys: [String]
        },
        goalKey: {
            type: String,
            enum: ['sales', 'support', 'audit', 'explore', null],
            default: null
        },
        startedAt: Date,
        completedAt: Date,
        dismissedAt: Date,
    welcomeNote: String,
    suggestedTask: String,
    profile: {
      timeZone: String,
      language: String,
      completedAt: Date
    },
    steps: [{
            key: { type: String, required: true },
            status: {
                type: String,
                enum: ['pending', 'completed', 'skipped'],
                default: 'pending'
            },
            completedAt: Date,
            skippedAt: Date
        }],
        coachmarks: [{
            key: String,
            seenAt: Date
        }],
        moduleVisits: [{
            moduleKey: String,
            appKey: String,
            visitedAt: Date
        }]
    },
    
    // Legacy field (keeping for backward compatibility, but not required anymore)
    vertical: String
}, { 
    timestamps: true 
});

// Compound index for organization + email (unique within organization)
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });
UserSchema.index(
  { organizationId: 1, peopleId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { peopleId: { $type: 'objectId' } } }
);
UserSchema.index({ organizationId: 1, userType: 1, status: 1 });

// Helper method to set default permissions based on role
UserSchema.methods.setPermissionsByRole = function(role) {
    const rolePermissions = {
        owner: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            organizations: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            projects: { view: true, create: true, edit: true, delete: true, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            events: { view: true, create: true, edit: true, delete: true, viewAll: true },
            forms: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            webforms: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            items: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            cases: { view: true, create: true, edit: true, delete: true, viewAll: true },
            imports: { view: true, create: true, delete: true },
            documents: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            settings: { manageUsers: true, manageBilling: true, manageIntegrations: true, customizeFields: true },
            liveChat: { view: true, reply: true, admin: true },
            announcements: { view: true, manage: true, publish: true, analytics: true },
            reports: { viewStandard: true, viewCustom: true, createCustom: true, exportReports: true }
        },
        admin: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            organizations: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            projects: { view: true, create: true, edit: true, delete: true, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            events: { view: true, create: true, edit: true, delete: true, viewAll: true },
            forms: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            webforms: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            items: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            cases: { view: true, create: true, edit: true, delete: true, viewAll: true },
            imports: { view: true, create: true, delete: true },
            documents: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            settings: { manageUsers: true, manageBilling: true, manageIntegrations: true, customizeFields: true },
            liveChat: { view: true, reply: true, admin: true },
            announcements: { view: true, manage: true, publish: true, analytics: true },
            reports: { viewStandard: true, viewCustom: true, createCustom: true, exportReports: true }
        },
        manager: {
            contacts: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: false },
            deals: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: false },
            organizations: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: true, edit: true, delete: false, viewAll: true },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: true },
            events: { view: true, create: true, edit: true, delete: false, viewAll: true },
            forms: { view: true, create: true, edit: true, delete: false, viewAll: true, exportData: true },
            webforms: { view: true, create: true, edit: true, delete: false, viewAll: true, exportData: true },
            items: { view: true, create: true, edit: true, delete: false, viewAll: true, exportData: true },
            cases: { view: true, create: true, edit: true, delete: false, viewAll: true },
            imports: { view: true, create: true, delete: false },
            documents: { view: true, create: true, edit: true, delete: true, viewAll: true, exportData: true },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            liveChat: { view: true, reply: true, admin: false },
            announcements: { view: true, manage: false, publish: false, analytics: false },
            reports: { viewStandard: true, viewCustom: true, createCustom: false, exportReports: false }
        },
        user: {
            contacts: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            deals: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            organizations: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: true, edit: true, delete: false, viewAll: false },
            tasks: { view: true, create: true, edit: true, delete: true, viewAll: false },
            events: { view: true, create: true, edit: true, delete: false, viewAll: false },
            forms: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            webforms: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            items: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            cases: { view: true, create: true, edit: true, delete: false, viewAll: false },
            imports: { view: true, create: false, delete: false },
            documents: { view: true, create: true, edit: true, delete: false, viewAll: false, exportData: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            liveChat: { view: true, reply: true, admin: false },
            reports: { viewStandard: true, viewCustom: false, createCustom: false, exportReports: false }
        },
        viewer: {
            contacts: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            deals: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            organizations: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            projects: { view: true, create: false, edit: false, delete: false, viewAll: false },
            tasks: { view: true, create: false, edit: false, delete: false, viewAll: false },
            events: { view: true, create: false, edit: false, delete: false, viewAll: false },
            forms: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            webforms: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            items: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            cases: { view: true, create: false, edit: false, delete: false, viewAll: false },
            imports: { view: true, create: false, delete: false },
            documents: { view: true, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            reports: { viewStandard: false, viewCustom: false, createCustom: false, exportReports: false }
        }
    };
    
    const { attachCommercialCoreModulesFromDeals } = require('../utils/rolePermissionProjection');
    this.permissions = attachCommercialCoreModulesFromDeals(
        rolePermissions[role] || rolePermissions.user
    );
    if (this.permissions.contacts) {
        const contactsPermissions = this.permissions.contacts.toObject
            ? this.permissions.contacts.toObject()
            : { ...this.permissions.contacts };
        this.set('permissions.people', contactsPermissions);
    }
    return this.permissions;
};

UserSchema.methods.setPermissionsByAppAccess = function(appAccess = []) {
    const activeAccess = Array.isArray(appAccess)
        ? appAccess.filter((access) => String(access?.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
        : [];

    const salesAccess = activeAccess.find((access) => String(access?.appKey || '').toUpperCase() === 'SALES');
    const salesRoleMap = {
        ADMIN: 'admin',
        MANAGER: 'manager',
        USER: 'user',
        VIEWER: 'viewer'
    };
    const baseRole = salesRoleMap[String(salesAccess?.roleKey || '').toUpperCase()] || 'user';
    const permissions = salesAccess
        ? this.setPermissionsByRole(baseRole)
        : {
            contacts: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            deals: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            organizations: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            projects: { view: false, create: false, edit: false, delete: false, viewAll: false },
            tasks: { view: false, create: false, edit: false, delete: false, viewAll: false },
            events: { view: false, create: false, edit: false, delete: false, viewAll: false },
            forms: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            items: { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false },
            cases: { view: false, create: false, edit: false, delete: false, viewAll: false },
            imports: { view: false, create: false, delete: false },
            settings: { manageUsers: false, manageBilling: false, manageIntegrations: false, customizeFields: false },
            reports: { viewStandard: false, viewCustom: false, createCustom: false, exportReports: false }
        };

    for (const access of activeAccess) {
        const appKey = String(access?.appKey || '').toUpperCase();
        const roleKey = String(access?.roleKey || '').toUpperCase();

        if (appKey === 'HELPDESK') {
            const canWrite = ['ADMIN', 'MANAGER', 'AGENT', 'USER'].includes(roleKey);
            permissions.cases = {
                view: true,
                create: canWrite,
                edit: canWrite,
                delete: roleKey === 'ADMIN',
                viewAll: ['ADMIN', 'MANAGER', 'AGENT'].includes(roleKey)
            };
        }
    }

    this.permissions = permissions;
    if (this.permissions.contacts) {
        const contactsPermissions = this.permissions.contacts.toObject
            ? this.permissions.contacts.toObject()
            : { ...this.permissions.contacts };
        this.set('permissions.people', contactsPermissions);
    }
    return this.permissions;
};

// Helper method to check if user has a specific permission
UserSchema.methods.hasPermission = function(module, action) {
    return this.permissions?.[module]?.[action] || false;
};

// Helper method to get full name
UserSchema.methods.getFullName = function() {
    if (this.firstName && this.lastName) {
        return `${this.firstName} ${this.lastName}`;
    }
    return this.username;
};

UserSchema.pre('save', function enforceExternalUserRoleInvariant(next) {
    if (String(this.userType || '').toUpperCase() === 'EXTERNAL') {
        this.roleId = null;
    }
    next();
});

module.exports = wrapTenantModel(mongoose.model('User', UserSchema));
