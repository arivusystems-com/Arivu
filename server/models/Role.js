/**
 * ============================================================================
 * PLATFORM CORE: Role & Permissions Model (App-Aware)
 * ============================================================================
 * 
 * This model provides app-aware role-based access control:
 * - Role definition and hierarchy
 * - App-scoped permission management
 * - User-role assignment
 * 
 * App-Aware Structure:
 * - appPermissions: App-scoped permissions (new, for multi-app support) ✅
 * - permissions: Legacy CRM-scoped permissions (backward compatibility) ⚠️
 * 
 * ✅ FIXED: Permissions are now app-aware
 *    - appPermissions field supports multi-app permissions
 *    - Legacy permissions field marked as deprecated/CRM-specific
 *    - Platform core uses appPermissions for app-agnostic permissions
 * 
 * See PLATFORM_CORE_ANALYSIS.md and APP_AWARE_PERMISSIONS.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const roleSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isSystemRole: {
        type: Boolean,
        default: false // System roles (Owner, Admin) cannot be deleted
    },
    level: {
        type: Number,
        default: 0 // For hierarchy: 0 = top level, higher number = lower in hierarchy
    },
    parentRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null // For organizational hierarchy
    },
    sortOrder: {
        type: Number,
        default: 0 // Sibling order within the same parent
    },
    
    // App-Scoped Permissions (new structure for multi-app support)
    // Format: { appKey: { module: { action: boolean } } }
    // Example: { SALES: { contacts: { create: true, read: true } }, PORTAL: { profile: { read: true } } }
    appPermissions: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    },
    
    // Legacy: Module Permissions - CRUD for each module (CRM-specific)
    // ⚠️ PLATFORM CORE VIOLATION: This structure is CRM-module-specific
    //    Kept for backward compatibility - treated as CRM-app scoped
    //    New apps should use appPermissions instead
    // @deprecated Use appPermissions instead for app-agnostic permissions
    // Module permission grants (legacy flat envelope + portal/core keys).
    // Mixed — must accept any catalog module key (documents, campaign, etc.).
    // Strict subdocs previously stripped unknown keys on save.
    // App-scoped grants also live in appPermissions.
    permissions: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Additional Settings
    canViewAllData: {
        type: Boolean,
        default: false
    },
    canManageTeam: {
        type: Boolean,
        default: false
    },
    canExportData: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    color: {
        type: String,
        default: '#6366f1' // For visual hierarchy display
    },
    icon: {
        type: String,
        default: 'user' // Icon identifier for UI
    },
    userCount: {
        type: Number,
        default: 0 // Track how many users have this role
    },

    // --- RBAC v2 ---
    userType: {
        type: String,
        enum: ['STANDARD', 'ADMIN', 'EXTERNAL', 'INTERNAL', 'SYSTEM'],
        default: 'STANDARD'
    },
    privilegeMode: {
        type: String,
        enum: ['inline', 'profile'],
        default: 'inline'
    },
    profileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        default: null
    },
    isTemplateSeed: {
        type: Boolean,
        default: false
    },
    appEntitlements: [{
        appKey: {
            type: String,
            required: true
        },
        enabled: {
            type: Boolean,
            default: true
        },
        seatConsuming: {
            type: Boolean,
            default: true
        },
        appRoleKey: {
            type: String,
            required: true
        }
    }],
    recordAssignment: {
        users: {
            type: String,
            enum: ['all', 'same_role_or_hierarchy', 'subordinates_only'],
            default: 'same_role_or_hierarchy'
        },
        groups: {
            type: String,
            enum: ['all', 'member_groups', 'selected', 'none'],
            default: 'member_groups'
        },
        selectedGroupIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group'
        }]
    },
    fieldPermissions: {
        type: Map,
        of: String,
        default: () => new Map()
    }
}, {
    timestamps: true
});

// Compound index for uniqueness within organization
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Pre-save middleware to set level based on parent
roleSchema.pre('save', async function(next) {
    if (this.parentRole && this.isModified('parentRole')) {
        const parent = await this.constructor.findById(this.parentRole);
        if (parent) {
            this.level = parent.level + 1;
        }
    }
    next();
});

// Instance method to check if role has specific permission (app-aware)
// @param {string} module - Module name (e.g., 'contacts', 'deals')
// @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
// @param {string} appKey - Optional app key (e.g., 'CRM', 'PORTAL'). If not provided, checks legacy permissions (CRM-scoped)
roleSchema.methods.hasPermission = function(module, action, appKey = null) {
    // If appKey is provided, check app-scoped permissions
    if (appKey && this.appPermissions && this.appPermissions.has(appKey)) {
        const appPerms = this.appPermissions.get(appKey);
        if (appPerms[module] && appPerms[module][action] === true) {
            return true;
        }
    }
    
    // Fallback to legacy permissions (treated as SALES-scoped)
    // This ensures backward compatibility with existing roles
    if (this.permissions && this.permissions[module]) {
        return this.permissions[module][action] === true;
    }
    
    return false;
};

// Instance method to check if role has permission for a specific app
// @param {string} appKey - App key (e.g., 'SALES', 'PORTAL')
// @param {string} module - Module name
// @param {string} action - Action name
roleSchema.methods.hasAppPermission = function(appKey, module, action) {
    return this.hasPermission(module, action, appKey);
};

// Static method to get role hierarchy
roleSchema.statics.getHierarchy = async function(organizationId) {
    const roles = await this.find({ organizationId }).sort({ level: 1, name: 1 });
    
    // Build tree structure
    const roleMap = {};
    const rootRoles = [];
    
    roles.forEach(role => {
        roleMap[role._id] = { ...role.toObject(), children: [] };
    });
    
    roles.forEach(role => {
        if (role.parentRole && roleMap[role.parentRole]) {
            roleMap[role.parentRole].children.push(roleMap[role._id]);
        } else {
            rootRoles.push(roleMap[role._id]);
        }
    });

    const { sortHierarchyChildren } = require('../services/roleHierarchyService');
    for (const root of rootRoles) {
        if (root.children?.length) sortHierarchyChildren(root.children);
    }

    return rootRoles;
};

function buildFullPrivilegedRolePermissions() {
    const fullCrudAll = {
        create: true,
        read: true,
        update: true,
        delete: true,
        export: true,
        import: true,
        scope: 'all'
    };
    const fullCrudNoImport = {
        create: true,
        read: true,
        update: true,
        delete: true,
        export: true,
        scope: 'all'
    };
    const fullEvents = {
        create: true,
        read: true,
        update: true,
        delete: true,
        scope: 'all'
    };

    return {
        contacts: { ...fullCrudAll },
        organizations: { ...fullCrudAll },
        deals: { ...fullCrudAll },
        tasks: { ...fullCrudNoImport },
        events: { ...fullEvents },
        forms: { ...fullCrudAll },
        webforms: { ...fullCrudNoImport },
        items: { ...fullCrudAll },
        cases: { create: true, read: true, update: true, delete: true, scope: 'all' },
        reports: { create: true, read: true, update: true, delete: true, export: true },
        users: { create: true, read: true, update: true, delete: true, manageRoles: true },
        settings: { view: true, edit: true, manageRoles: true, manageBilling: true },
        performance: {
            targets: {
                view: true,
                create: true,
                edit: true,
                activate: true,
                manageTypes: true,
                manageOrgSettings: true
            }
        },
        liveChat: { view: true, reply: true, admin: true },
        announcements: { view: true, manage: true, publish: true, analytics: true },
        telephony: {
          view: true,
          call: true,
          listen: true,
          download: true,
          manage: true,
          admin: true,
          ai: true,
        },
    };
}

const PRIVILEGED_SYSTEM_ROLE_FLAGS = {
    canViewAllData: true,
    canManageTeam: true,
    canExportData: true
};

// Static method to create default roles for new organization
roleSchema.statics.createDefaultRoles = async function(organizationId) {
    const fullPermissions = buildFullPrivilegedRolePermissions();
    const defaultRoles = [
        {
            organizationId,
            name: 'Owner',
            description: 'Full system access with all permissions',
            isSystemRole: true,
            level: 0,
            color: '#9333ea',
            icon: 'crown',
            permissions: fullPermissions,
            ...PRIVILEGED_SYSTEM_ROLE_FLAGS
        },
        {
            organizationId,
            name: 'Admin',
            description: 'Full administrative access with all permissions',
            isSystemRole: true,
            level: 1,
            color: '#ef4444',
            icon: 'shield',
            permissions: fullPermissions,
            ...PRIVILEGED_SYSTEM_ROLE_FLAGS
        },
        {
            organizationId,
            name: 'Manager',
            description: 'Team management with team-level access',
            isSystemRole: false,
            level: 2,
            color: '#3b82f6',
            icon: 'users',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
                organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'team' },
                deals: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
                tasks: { create: true, read: true, update: true, delete: false, export: true, scope: 'team' },
                events: { create: true, read: true, update: true, delete: false, scope: 'team' },
                forms: { create: true, read: true, update: true, delete: false, export: true, import: false, scope: 'team' },
                webforms: { create: true, read: true, update: true, delete: false, export: true, scope: 'team' },
                items: { create: true, read: true, update: true, delete: false, export: true, import: true, scope: 'team' },
                reports: { create: false, read: true, update: false, delete: false, export: true },
                users: { create: false, read: true, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false },
                performance: {
                    targets: {
                        view: true,
                        create: true,
                        edit: true,
                        activate: true,
                        manageTypes: false,
                        manageOrgSettings: false
                    }
                }
            },
            canViewAllData: false,
            canManageTeam: true,
            canExportData: true
        },
        {
            organizationId,
            name: 'User',
            description: 'Standard user with own record access',
            isSystemRole: false,
            level: 3,
            color: '#10b981',
            icon: 'user',
            permissions: {
                contacts: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                organizations: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                deals: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                tasks: { create: true, read: true, update: true, delete: false, export: false, scope: 'own' },
                events: { create: true, read: true, update: true, delete: false, scope: 'own' },
                forms: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                items: { create: true, read: true, update: true, delete: false, export: false, import: false, scope: 'own' },
                reports: { create: false, read: true, update: false, delete: false, export: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false },
                performance: {
                    targets: {
                        view: true,
                        create: false,
                        edit: false,
                        activate: false,
                        manageTypes: false,
                        manageOrgSettings: false
                    }
                }
            },
            canViewAllData: false,
            canManageTeam: false,
            canExportData: false
        },
        {
            organizationId,
            name: 'Viewer',
            description: 'Read-only access to assigned records',
            isSystemRole: false,
            level: 4,
            color: '#6b7280',
            icon: 'eye',
            permissions: {
                contacts: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                organizations: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                deals: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                tasks: { create: false, read: true, update: false, delete: false, export: false, scope: 'own' },
                events: { create: false, read: true, update: false, delete: false, scope: 'own' },
                forms: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                webforms: { create: false, read: true, update: false, delete: false, export: false, scope: 'own' },
                items: { create: false, read: true, update: false, delete: false, export: false, import: false, scope: 'own' },
                reports: { create: false, read: true, update: false, delete: false, export: false },
                users: { create: false, read: false, update: false, delete: false, manageRoles: false },
                settings: { view: false, edit: false, manageRoles: false, manageBilling: false }
            },
            canViewAllData: false,
            canManageTeam: false,
            canExportData: false
        }
    ];
    
    const inserted = await this.insertMany(defaultRoles);

    const ownerRole = inserted.find((r) => r.name === 'Owner');
    const adminRole = inserted.find((r) => r.name === 'Admin');
    const managerRole = inserted.find((r) => r.name === 'Manager');
    const userRole = inserted.find((r) => r.name === 'User');
    const viewerRole = inserted.find((r) => r.name === 'Viewer');

    if (adminRole && ownerRole) {
        adminRole.parentRole = ownerRole._id;
        adminRole.level = 1;
        await adminRole.save();
    }
    if (managerRole && adminRole) {
        managerRole.parentRole = adminRole._id;
        managerRole.level = 2;
        managerRole.sortOrder = 0;
        await managerRole.save();
    }
    if (userRole && managerRole) {
        userRole.parentRole = managerRole._id;
        userRole.level = 3;
        userRole.sortOrder = 0;
        await userRole.save();
    }
    if (viewerRole && adminRole) {
        viewerRole.parentRole = adminRole._id;
        viewerRole.level = 2;
        viewerRole.sortOrder = 1;
        await viewerRole.save();
    }
    if (ownerRole) {
        ownerRole.sortOrder = 0;
        await ownerRole.save();
    }

    return inserted;
};

roleSchema.statics.upgradePrivilegedSystemRoles = async function(organizationId) {
    const fullPermissions = buildFullPrivilegedRolePermissions();
    await this.updateMany(
        { organizationId, isSystemRole: true, name: 'Owner' },
        {
            $set: {
                permissions: fullPermissions,
                description: 'Full system access with all permissions',
                ...PRIVILEGED_SYSTEM_ROLE_FLAGS
            }
        }
    );
    await this.updateMany(
        { organizationId, isSystemRole: true, name: 'Admin' },
        {
            $set: {
                permissions: fullPermissions,
                description: 'Full administrative access with all permissions',
                ...PRIVILEGED_SYSTEM_ROLE_FLAGS
            }
        }
    );
};

async function assertExternalRoleParentIsValid(roleDoc) {
    if (String(roleDoc.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL') {
        return;
    }
    const parentId = roleDoc.parentRole;
    if (!parentId) {
        return;
    }
    const RoleModel = roleDoc.constructor;
    const parent = await RoleModel.findById(parentId).select('userType organizationId').lean();
    if (!parent) {
        return;
    }
    if (String(parent.organizationId) !== String(roleDoc.organizationId)) {
        const err = new Error('External role parent must belong to the same organization');
        err.name = 'ValidationError';
        throw err;
    }
    if (String(parent.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL') {
        const err = new Error('External roles cannot report to internal roles');
        err.name = 'ValidationError';
        throw err;
    }
}

roleSchema.pre('save', async function externalRoleParentGuard() {
    await assertExternalRoleParentIsValid(this);
});

roleSchema.pre('findOneAndUpdate', async function externalRoleParentGuardUpdate() {
    const update = this.getUpdate() || {};
    const set = update.$set || update;
    const nextUserType = set.userType;
    const nextParentRole = set.parentRole;
    if (nextUserType === undefined && nextParentRole === undefined) {
        return;
    }
    const existing = await this.model.findOne(this.getQuery()).select('userType parentRole organizationId').lean();
    if (!existing) {
        return;
    }
    await assertExternalRoleParentIsValid({
        constructor: this.model,
        userType: nextUserType !== undefined ? nextUserType : existing.userType,
        parentRole: nextParentRole !== undefined ? nextParentRole : existing.parentRole,
        organizationId: existing.organizationId
    });
});

const Role = mongoose.model('Role', roleSchema);

module.exports = wrapTenantModel(Role);

