const Role = require('../models/Role');
const Organization = require('../models/Organization');
const { legacyRoleCapabilitiesForPersistence } = require('../utils/rbacFeatureFlags');
const {
    getRolePermissionCatalog,
    expandRolePermissionsForUI,
    normalizeRolePermissions,
    mergeIncomingRolePermissions,
    invalidateTenantPermissionCaches
} = require('../services/rolePermissionCatalogService');
const {
    wouldCreateRoleHierarchyCycle,
    recalculateOrganizationRoleLevels,
    ensureSiblingSortOrders,
    reorderSiblingRoles,
    normalizeParentRoleId,
    syncRoleUserCounts
} = require('../services/roleHierarchyService');
const { validateExternalRolePayload } = require('../utils/externalRoleValidation');
const {
    listExternalRolesForOrganization,
    ensureExternalPortalRolesForOrganization
} = require('../services/portalExternalRoleSeedService');
const Profile = require('../models/Profile');
const { pickModulePermissionOverrides } = require('../services/roleProfileResolver');

const upgradedPrivilegedRolesOrgs = new Set();

async function normalizeProfileModePermissions(profileId, incomingPermissions) {
    if (!profileId || incomingPermissions == null) {
        return { permissions: {}, appPermissions: undefined };
    }
    const profile = await Profile.findById(profileId).select('permissions').lean();
    const overrides = pickModulePermissionOverrides(
        profile?.permissions,
        incomingPermissions
    );
    return normalizeRolePermissions(overrides);
}

function attachUIPermissionAliases(roleObj) {
    if (!roleObj) return roleObj;
    roleObj.permissions = expandRolePermissionsForUI(roleObj);
    return roleObj;
}

async function ensurePrivilegedSystemRolesUpgraded(organizationId) {
    const orgKey = String(organizationId || '');
    if (!orgKey || upgradedPrivilegedRolesOrgs.has(orgKey)) return;
    await Role.upgradePrivilegedSystemRoles(organizationId);
    upgradedPrivilegedRolesOrgs.add(orgKey);
}

// Get external portal roles for assignment UI
exports.getExternalRoles = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('enabledApps settings')
            .lean();
        const roles = await listExternalRolesForOrganization(req.user.organizationId, organization);
        res.json({
            success: true,
            data: roles,
            total: roles.length
        });
    } catch (error) {
        console.error('Get external roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching external roles',
            error: error.message
        });
    }
};

// Ensure external portal role templates exist (admin action)
exports.seedExternalRoles = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('enabledApps settings')
            .lean();
        const result = await ensureExternalPortalRolesForOrganization(
            req.user.organizationId,
            organization
        );
        res.json({
            success: true,
            data: result.roles,
            created: result.created,
            skipped: result.skipped
        });
    } catch (error) {
        console.error('Seed external roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Error seeding external roles',
            error: error.message
        });
    }
};

// Get all roles for organization
exports.getRoles = async (req, res) => {
    try {
        await ensurePrivilegedSystemRolesUpgraded(req.user.organizationId);
        const organization = await Organization.findById(req.user.organizationId)
            .select('enabledApps settings')
            .lean();
        await ensureExternalPortalRolesForOrganization(req.user.organizationId, organization);
        await syncRoleUserCounts(req.user.organizationId);
        let roles = await Role.find({
            organizationId: req.user.organizationId 
        })
        .populate('parentRole', 'name')
        .populate('profileId', 'name')
        .sort({ level: 1, name: 1 });
        roles = roles.map((r) => attachUIPermissionAliases(r.toObject()));
        res.json({
            success: true,
            data: roles,
            total: roles.length
        });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
};

// Get role hierarchy tree
exports.getRoleHierarchy = async (req, res) => {
    try {
        await syncRoleUserCounts(req.user.organizationId);
        await ensureSiblingSortOrders(req.user.organizationId);
        const hierarchy = await Role.getHierarchy(req.user.organizationId);

        res.json({
            success: true,
            data: hierarchy
        });
    } catch (error) {
        console.error('Get role hierarchy error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching role hierarchy',
            error: error.message
        });
    }
};

// Get single role
exports.getRole = async (req, res) => {
    try {
        await ensurePrivilegedSystemRolesUpgraded(req.user.organizationId);
        let role = await Role.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId 
        }).populate('parentRole', 'name');

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        res.json({
            success: true,
            data: attachUIPermissionAliases(role.toObject())
        });
    } catch (error) {
        console.error('Get role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching role',
            error: error.message
        });
    }
};

// Create new role
exports.createRole = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            parentRole, 
            permissions,
            color,
            icon,
            canViewAllData,
            canManageTeam,
            canExportData,
            userType,
            privilegeMode,
            profileId,
            appEntitlements,
            recordAssignment,
            fieldPermissions
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ 
                success: false,
                message: 'Role name is required' 
            });
        }

        // Check if role with same name already exists
        const existingRole = await Role.findOne({ 
            organizationId: req.user.organizationId,
            name: name.trim()
        });

        if (existingRole) {
            return res.status(409).json({ 
                success: false,
                message: 'A role with this name already exists' 
            });
        }

        const externalValidationError = await validateExternalRolePayload(
            { userType, parentRole, appEntitlements },
            req.user.organizationId
        );
        if (externalValidationError) {
            return res.status(400).json({
                success: false,
                message: externalValidationError,
                code: 'INVALID_EXTERNAL_ROLE'
            });
        }

        const usesProfilePrivileges =
            String(privilegeMode || 'inline').toLowerCase() === 'profile' && profileId;
        let { permissions: normalizedPermissions, appPermissions } = usesProfilePrivileges
            ? await normalizeProfileModePermissions(profileId, permissions || {})
            : normalizeRolePermissions(permissions);

        const { applyRoleUserTypeRules, PLATFORM_USER_TYPES } = require('../constants/platformUserTypes');
        const typed = applyRoleUserTypeRules({
            userType: userType || PLATFORM_USER_TYPES.STANDARD,
            permissions: normalizedPermissions,
            privilegeMode: privilegeMode || 'inline',
            profileId: profileId || null,
        });
        normalizedPermissions = typed.permissions;

        const organization = await Organization.findById(req.user.organizationId).select('settings').lean();
        const legacyCaps = legacyRoleCapabilitiesForPersistence(organization);
        const capabilityFields = legacyCaps ?? {
            canViewAllData: canViewAllData || false,
            canManageTeam: canManageTeam || false,
            canExportData: canExportData || false
        };

        const createPayload = {
            organizationId: req.user.organizationId,
            name: name.trim(),
            description,
            parentRole: parentRole || null,
            permissions: normalizedPermissions,
            color: color || '#6366f1',
            icon: icon || 'user',
            ...capabilityFields,
            isSystemRole: false,
            userType: typed.userType,
            privilegeMode: typed.privilegeMode,
            profileId: typed.profileId
        };
        if (appEntitlements) createPayload.appEntitlements = appEntitlements;
        if (recordAssignment) createPayload.recordAssignment = recordAssignment;
        if (fieldPermissions) createPayload.fieldPermissions = fieldPermissions;
        if (appPermissions) {
            createPayload.appPermissions = appPermissions;
        }

        const newRole = await Role.create(createPayload);

        await newRole.populate('parentRole', 'name');
        invalidateTenantPermissionCaches(req.user.organizationId);

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(res, {}, cloneForAudit(newRole.toObject()), { body: req.body });

        res.status(201).json({
            success: true,
            data: attachUIPermissionAliases(newRole.toObject()),
            message: 'Role created successfully'
        });

    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
};

// Update role
exports.updateRole = async (req, res) => {
    try {
        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const role = await Role.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        const before = cloneForAudit(role.toObject());

        // For system roles: block ONLY if attempting to change the name; ignore isSystemRole field from payload
        if (role.isSystemRole) {
            const incomingName = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
            if (incomingName && incomingName !== role.name) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Cannot modify system role name or status',
                    code: 'CANNOT_MODIFY_SYSTEM_ROLE'
                });
            }
            if (Object.prototype.hasOwnProperty.call(req.body, 'isSystemRole')) {
                delete req.body.isSystemRole;
            }
        }

        // Update fields
        const allowedUpdates = [
            'description',
            'parentRole',
            'permissions',
            'appPermissions',
            'color',
            'icon',
            'canViewAllData',
            'canManageTeam',
            'canExportData',
            'userType',
            'privilegeMode',
            'profileId',
            'appEntitlements',
            'recordAssignment',
            'fieldPermissions'
        ];

        if (!role.isSystemRole) {
            allowedUpdates.push('name');
        }

        const effectivePrivilegeMode =
            req.body.privilegeMode !== undefined ? req.body.privilegeMode : role.privilegeMode;
        const usesProfilePrivileges =
            String(effectivePrivilegeMode || 'inline').toLowerCase() === 'profile'
            && (req.body.profileId !== undefined ? req.body.profileId : role.profileId);

        if (usesProfilePrivileges) {
            if (req.body.permissions !== undefined) {
                const profileIdForNorm =
                    req.body.profileId !== undefined ? req.body.profileId : role.profileId;
                const normalized = await normalizeProfileModePermissions(
                    profileIdForNorm,
                    req.body.permissions
                );
                req.body.permissions = normalized.permissions;
                req.body.appPermissions = normalized.appPermissions || {};
            }
        } else if (req.body.permissions) {
            const merged = mergeIncomingRolePermissions(role, req.body.permissions);
            req.body.permissions = merged.permissions;
            if (merged.appPermissions) {
                req.body.appPermissions = merged.appPermissions;
            }
        }

        const externalValidationError = await validateExternalRolePayload(
            {
                userType: req.body.userType !== undefined ? req.body.userType : role.userType,
                parentRole: req.body.parentRole !== undefined ? req.body.parentRole : role.parentRole,
                appEntitlements: req.body.appEntitlements !== undefined
                    ? req.body.appEntitlements
                    : role.appEntitlements
            },
            req.user.organizationId
        );
        if (externalValidationError) {
            return res.status(400).json({
                success: false,
                message: externalValidationError,
                code: 'INVALID_EXTERNAL_ROLE'
            });
        }

        const { applyRoleUserTypeRules } = require('../constants/platformUserTypes');
        const typed = applyRoleUserTypeRules({
            userType: req.body.userType !== undefined ? req.body.userType : role.userType,
            permissions: req.body.permissions !== undefined ? req.body.permissions : role.permissions,
            privilegeMode: req.body.privilegeMode !== undefined ? req.body.privilegeMode : role.privilegeMode,
            profileId: req.body.profileId !== undefined ? req.body.profileId : role.profileId,
        });
        req.body.userType = typed.userType;
        if (req.body.permissions !== undefined || typed.userType === 'STANDARD') {
            req.body.permissions = typed.permissions;
        }

        const organization = await Organization.findById(req.user.organizationId).select('settings').lean();
        const legacyCaps = legacyRoleCapabilitiesForPersistence(organization);

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                role[field] = req.body[field];
                if (field === 'permissions' || field === 'appPermissions' || field === 'fieldPermissions') {
                    role.markModified(field);
                }
            }
        });

        if (legacyCaps) {
            Object.assign(role, legacyCaps);
        }

        await role.save();
        await role.populate('parentRole', 'name');
        invalidateTenantPermissionCaches(req.user.organizationId);

        const after = cloneForAudit(role.toObject());
        attachSettingsAuditDiff(res, before, after, { body: req.body });

        res.json({
            success: true,
            data: attachUIPermissionAliases(role.toObject()),
            message: 'Role updated successfully'
        });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating role',
            error: error.message
        });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findOne({ 
            _id: req.params.id,
            organizationId: req.user.organizationId 
        });

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // Prevent deleting system roles
        if (role.isSystemRole) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot delete system roles',
                code: 'CANNOT_DELETE_SYSTEM_ROLE'
            });
        }

        // Check if any users have this role
        const User = require('../models/User');
        const usersWithRole = await User.countDocuments({ 
            organizationId: req.user.organizationId,
            roleId: role._id
        });

        if (usersWithRole > 0) {
            return res.status(409).json({ 
                success: false,
                message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role`,
                code: 'ROLE_IN_USE',
                userCount: usersWithRole
            });
        }

        // Check if any roles have this as parent
        const childRoles = await Role.countDocuments({
            organizationId: req.user.organizationId,
            parentRole: role._id
        });

        if (childRoles > 0) {
            return res.status(409).json({ 
                success: false,
                message: `Cannot delete role. ${childRoles} child role(s) depend on this role`,
                code: 'HAS_CHILD_ROLES',
                childCount: childRoles
            });
        }

        await role.deleteOne();

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            cloneForAudit({ name: role.name, description: role.description }),
            {},
            { keys: ['name', 'description'] }
        );

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });

    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
};

// Get available permission modules (tenant-aware catalog)
exports.getPermissionModules = async (req, res) => {
    try {
        let catalog = await getRolePermissionCatalog(req.user.organizationId);
        const profileKey = req.query.profileKey ? String(req.query.profileKey).trim() : null;
        const userType = req.query.userType ? String(req.query.userType).trim().toUpperCase() : null;
        const {
            isExternalSystemProfileKey,
            filterCatalogForExternalAccess
        } = require('../constants/externalProfileCatalog');

        if (profileKey && isExternalSystemProfileKey(profileKey)) {
            catalog = filterCatalogForExternalAccess(catalog, { profileKey });
        } else if (userType === 'EXTERNAL') {
            catalog = filterCatalogForExternalAccess(catalog);
        }

        res.json({
            success: true,
            data: catalog.modules,
            sections: catalog.sections,
            enabledApps: catalog.enabledApps,
            profileScoped: catalog.profileScoped === true,
            externalProfile: catalog.externalProfile === true,
            profileKey: catalog.profileKey || null
        });
    } catch (error) {
        console.error('Get permission modules error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching permission modules',
            error: error.message
        });
    }
};

// Initialize default roles for organization (admin only)
exports.initializeDefaultRoles = async (req, res) => {
    try {
        // Check if roles already exist
        const existingRoles = await Role.countDocuments({ 
            organizationId: req.user.organizationId 
        });

        if (existingRoles > 0) {
            return res.status(409).json({ 
                success: false,
                message: 'Roles already initialized for this organization' 
            });
        }

        const roles = await Role.createDefaultRoles(req.user.organizationId);

        res.status(201).json({
            success: true,
            data: roles,
            message: 'Default roles created successfully'
        });

    } catch (error) {
        console.error('Initialize roles error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error initializing default roles',
            error: error.message
        });
    }
};

// Reparent or reorder role in hierarchy (cycle-safe, recalculates levels)
exports.moveRole = async (req, res) => {
    try {
        const parentRoleId = Object.prototype.hasOwnProperty.call(req.body, 'parentRoleId')
            ? req.body.parentRoleId
            : req.body.parentRole;
        const insertBeforeRoleId = req.body.insertBeforeRoleId || null;
        const insertAfterRoleId = req.body.insertAfterRoleId || null;

        const role = await Role.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        if (role.isSystemRole && role.name === 'Owner') {
            return res.status(403).json({
                success: false,
                message: 'Cannot move the Owner role',
                code: 'CANNOT_MOVE_OWNER'
            });
        }

        const isReorderOnly = Boolean(insertBeforeRoleId || insertAfterRoleId);
        const normalizedParent = Object.prototype.hasOwnProperty.call(req.body, 'parentRoleId') || Object.prototype.hasOwnProperty.call(req.body, 'parentRole')
            ? normalizeParentRoleId(parentRoleId)
            : normalizeParentRoleId(role.parentRole);

        if (normalizedParent) {
            const parentRole = await Role.findOne({
                _id: normalizedParent,
                organizationId: req.user.organizationId
            });
            if (!parentRole) {
                return res.status(400).json({
                    success: false,
                    message: 'Parent role not found in your organization',
                    code: 'PARENT_ROLE_NOT_FOUND'
                });
            }
        }

        const rolesLean = await Role.find({ organizationId: req.user.organizationId })
            .select('_id parentRole name isSystemRole')
            .lean();

        if (!isReorderOnly && wouldCreateRoleHierarchyCycle(rolesLean, role._id, normalizedParent)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot move a role under itself or one of its subordinate roles',
                code: 'ROLE_HIERARCHY_CYCLE'
            });
        }

        if (isReorderOnly) {
            if (insertBeforeRoleId && insertAfterRoleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Specify either insertBeforeRoleId or insertAfterRoleId, not both',
                    code: 'INVALID_REORDER'
                });
            }

            const anchorId = insertBeforeRoleId || insertAfterRoleId;
            const anchorRole = await Role.findOne({
                _id: anchorId,
                organizationId: req.user.organizationId
            });
            if (!anchorRole) {
                return res.status(400).json({
                    success: false,
                    message: 'Reorder anchor role not found',
                    code: 'ANCHOR_ROLE_NOT_FOUND'
                });
            }

            const anchorParent = normalizeParentRoleId(anchorRole.parentRole);
            if (anchorParent !== normalizedParent) {
                return res.status(400).json({
                    success: false,
                    message: 'Reorder anchor must belong to the target sibling group',
                    code: 'INVALID_REORDER_ANCHOR'
                });
            }

            if (wouldCreateRoleHierarchyCycle(rolesLean, role._id, normalizedParent)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot move a role under itself or one of its subordinate roles',
                    code: 'ROLE_HIERARCHY_CYCLE'
                });
            }

            await reorderSiblingRoles(req.user.organizationId, role._id, {
                parentRoleId: normalizedParent,
                insertBeforeRoleId,
                insertAfterRoleId
            });
        } else {
            const siblings = await Role.find({
                organizationId: req.user.organizationId,
                ...(normalizedParent
                    ? { parentRole: normalizedParent }
                    : { $or: [{ parentRole: null }, { parentRole: { $exists: false } }] })
            }).sort({ sortOrder: -1 }).limit(1);

            role.parentRole = normalizedParent;
            role.sortOrder = (siblings[0]?.sortOrder ?? -1) + 1;
            await role.save();
            await ensureSiblingSortOrders(req.user.organizationId);
        }

        await recalculateOrganizationRoleLevels(req.user.organizationId);
        const updatedRole = await Role.findById(role._id).populate('parentRole', 'name');
        invalidateTenantPermissionCaches(req.user.organizationId);

        res.json({
            success: true,
            data: attachUIPermissionAliases(updatedRole.toObject()),
            message: isReorderOnly ? 'Role reordered successfully' : 'Role moved successfully'
        });
    } catch (error) {
        console.error('Move role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error moving role',
            error: error.message
        });
    }
};

// RBAC v2: seed profiles + Sales Manager / Sales Executive hierarchy
exports.seedRolesForOrganization = async (req, res) => {
    try {
        const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
        const { seedRolesAndProfilesForOrganization } = require('../services/roleSeedService');

        const organization = req.organization || await require('../models/Organization').findById(req.user.organizationId);
        if (!isRbacV2Enabled(organization)) {
            return res.status(400).json({
                success: false,
                message: 'RBAC v2 is not enabled for this organization',
                code: 'RBAC_V2_DISABLED'
            });
        }

        const hasStaffHierarchy = await Role.exists({
            organizationId: req.user.organizationId,
            name: { $in: ['Owner', 'Administrator'] },
        });
        if (hasStaffHierarchy) {
            return res.status(409).json({
                success: false,
                message: 'Staff roles already exist for this organization. Use migration script for existing tenants.',
                code: 'ROLES_ALREADY_EXIST'
            });
        }

        const result = await seedRolesAndProfilesForOrganization(req.user.organizationId, organization);

        res.status(201).json({
            success: true,
            data: result,
            message: 'RBAC v2 roles and profiles seeded successfully'
        });
    } catch (error) {
        console.error('Seed roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Error seeding roles',
            error: error.message
        });
    }
};

