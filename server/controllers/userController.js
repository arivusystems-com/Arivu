/**
 * ============================================================================
 * PLATFORM CORE: User Management Controller
 * ============================================================================
 * 
 * This controller handles app-agnostic user management:
 * - User CRUD operations
 * - User profile management
 * - Password management
 * - User assignment queries
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const User = require('../models/User');
const Role = require('../models/Role');
const Organization = require('../models/Organization');
const UserDirectory = require('../models/UserDirectory');
const bcrypt = require('bcrypt');
const userInviteService = require('../services/userInviteService');
const { hashToken, buildInviteUrl } = require('../utils/userAuthTokens');
const { generateSecurePassword } = require('../services/provisioning/utils/passwordGenerator');
const mongoose = require('mongoose');
const { APP_KEYS } = require('../constants/appKeys');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const {
    materializeEffectiveCRMEnvelopeOnUser,
    enrichLeanUsersWithEffectiveCRMPermissions,
    sanitizeUserResponsePayload
} = require('../utils/rolePermissionProjection');
const { mapLegacyRoleToCRM } = require('../constants/appRoles');
const { 
    getDefaultRoleForApp, 
    validateAppRole, 
    getAppConfig, 
    getRolesForApp, 
    validateUserTypeForApp,
    isAppEnabledForOrg
} = require('../utils/appAccessUtils');
const { 
    canAddUserToApp, 
    incrementSeat,
    decrementSeat,
    getSeatLimit,
    getSeatsUsed,
    getOrgSubscription,
    isSubscriptionUsable,
    ensureOrgSubscriptionForEnabledApps
} = require('../utils/subscriptionUtils');
const userRecordTransferService = require('../services/userRecordTransferService');
const {
    applyEmployeeContactFields,
    applyStatusTimestamps,
    seedDisplayPreferencesFromOrg,
    effectiveMobilePhone
} = require('../utils/userProfileFields');
const Group = require('../models/Group');

/**
 * @param {object} user
 * @param {unknown} primaryGroupId
 * @param {unknown} organizationId
 * @returns {Promise<{ ok: true } | { ok: false, message: string, code: string }>}
 */
async function applyPrimaryGroupId(user, primaryGroupId, organizationId) {
    if (primaryGroupId == null || primaryGroupId === '') {
        user.primaryGroupId = null;
        return { ok: true };
    }
    if (!mongoose.Types.ObjectId.isValid(primaryGroupId)) {
        return { ok: false, message: 'Invalid primary group id', code: 'INVALID_PRIMARY_GROUP' };
    }
    const group = await Group.findOne({
        _id: primaryGroupId,
        organizationId,
        isActive: { $ne: false }
    }).select('_id members').lean();
    if (!group) {
        return { ok: false, message: 'Primary group not found', code: 'PRIMARY_GROUP_NOT_FOUND' };
    }
    user.primaryGroupId = primaryGroupId;
    const memberIds = (group.members || []).map((id) => String(id));
    if (!memberIds.includes(String(user._id))) {
        await Group.updateOne(
            { _id: primaryGroupId, organizationId },
            { $addToSet: { members: user._id } }
        );
    }
    return { ok: true };
}

async function mirrorUserStatusToMaster(ScopedUser, user, organization, status) {
    if (ScopedUser === User) return;
    const mirrorSet = {
        status,
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null
    };
    try {
        let mirrorResult = await User.updateOne(
            { _id: user._id },
            { $set: mirrorSet, $inc: { authSessionVersion: 1 } }
        );
        if (mirrorResult.matchedCount === 0 && user.email) {
            mirrorResult = await User.updateOne(
                {
                    email: String(user.email).toLowerCase().trim(),
                    organizationId: organization._id
                },
                { $set: mirrorSet, $inc: { authSessionVersion: 1 } }
            );
        }
        if (mirrorResult.matchedCount === 0) {
            console.warn('[userLifecycle] Master user mirror matched 0 docs', {
                userId: String(user._id),
                organizationId: String(organization._id),
                status
            });
        }
    } catch (mirrorError) {
        console.warn('[userLifecycle] Master user mirror failed:', mirrorError.message);
    }
}

/**
 * Deactivate: inactive status, revoke sessions, release seats, disable app access.
 * Does not transfer records or set deleted.
 */
async function applyUserDeactivation(user, organization, ScopedUser, initiatedByUserId = null) {
    const activeAppKeys = (user.appAccess || [])
        .filter((appAccessEntry) => appAccessEntry.status === 'ACTIVE')
        .map((appAccessEntry) => appAccessEntry.appKey);

    for (const appAccessEntry of user.appAccess || []) {
        if (appAccessEntry.status === 'ACTIVE') {
            await decrementSeat(organization._id, appAccessEntry.appKey);
        }
    }

    user.status = 'inactive';
    user.inviteTokenHash = null;
    user.inviteTokenExpiresAt = null;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    user.authSessionVersion = Number(user.authSessionVersion || 0) + 1;
    if (Array.isArray(user.appAccess) && user.appAccess.length > 0) {
        user.appAccess.forEach((entry) => {
            if (entry && String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
                entry.status = 'DISABLED';
            }
        });
        user.markModified('appAccess');
    }
    await user.save();
    await mirrorUserStatusToMaster(ScopedUser, user, organization, 'inactive');
    await userInviteService.syncDirectoryEntry(user.email, {
        inviteTokenHash: null,
        emailVerificationTokenHash: null,
        status: 'inactive'
    });

    try {
        const {
            syncCommercialBillingAfterDeactivation,
        } = require('../services/commercial/userLifecycleBillingSync');
        await syncCommercialBillingAfterDeactivation({
            organizationId: organization._id,
            userId: user._id,
            userType: user.userType,
            activeAppKeys,
            initiatedByUserId,
        });
    } catch (commercialErr) {
        console.warn('[userLifecycle] commercial deactivation sync failed:', commercialErr.message);
    }

    try {
        const {
            reconcileCommercialBillingAfterMutation,
        } = require('../services/commercial/reconcileCommercialSubscription');
        await reconcileCommercialBillingAfterMutation({
            organizationId: organization._id,
            initiatedByUserId,
        });
    } catch (reconcileErr) {
        console.warn('[userLifecycle] commercial reconcile after deactivation failed:', reconcileErr.message);
    }
}

function getTenantModel(connection, modelName, sourceModel) {
    if (connection.models[modelName]) {
        return connection.models[modelName];
    }
    const originalSchema = sourceModel.schema;
    const clonedSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);
    if (originalSchema.methods) {
        Object.keys(originalSchema.methods).forEach((methodName) => {
            clonedSchema.methods[methodName] = originalSchema.methods[methodName];
        });
    }
    if (originalSchema.statics) {
        Object.keys(originalSchema.statics).forEach((staticName) => {
            clonedSchema.statics[staticName] = originalSchema.statics[staticName];
        });
    }
    return connection.model(modelName, clonedSchema);
}

async function getScopedUserModel(organization) {
    if (organization?.database?.name && organization.database.initialized) {
        const dbConnectionManager = require('../utils/databaseConnectionManager');
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
        return getTenantModel(orgDbConnection, 'User', User);
    }
    return User;
}

async function getScopedRoleModel(organization) {
    if (organization?.database?.name && organization.database.initialized) {
        const dbConnectionManager = require('../utils/databaseConnectionManager');
        const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
        return getTenantModel(orgDbConnection, 'Role', Role);
    }
    return Role;
}

async function findOrganizationRoleById(organization, roleId) {
    if (!roleId || !mongoose.Types.ObjectId.isValid(String(roleId))) {
        return null;
    }

    const ScopedRole = await getScopedRoleModel(organization);
    const orgId = organization._id;
    let roleDoc = await ScopedRole.findOne({ _id: roleId, organizationId: orgId });
    if (!roleDoc && organization?.database?.name && organization.database.initialized) {
        // Older tenant records may omit organizationId; the DB itself is org-scoped.
        roleDoc = await ScopedRole.findById(roleId);
    }
    return roleDoc;
}

function buildUserScopeQuery(req, organization) {
    // In dedicated tenant DB mode, the DB itself is already organization-scoped.
    // Do not require organizationId match because older converted records may miss it.
    if (organization?.database?.name && organization.database.initialized) {
        return {};
    }
    return { organizationId: req.user.organizationId };
}

const PRESENCE_TYPES = new Set(['active', 'busy', 'away', 'offline']);

function serializePresence(user) {
    const presence = user?.presence || {};
    const expiresAt = presence.expiresAt ? new Date(presence.expiresAt) : null;
    const customExpired = expiresAt && expiresAt.getTime() <= Date.now();
    const customText = customExpired ? '' : String(presence.custom?.text || '').trim();
    const customEmoji = customExpired ? '' : String(presence.custom?.emoji || '').trim();

    return {
        type: PRESENCE_TYPES.has(presence.type) ? presence.type : 'active',
        custom: customText ? { emoji: customEmoji || '💬', text: customText } : null,
        expiresAt: customExpired ? null : expiresAt,
        updatedAt: presence.updatedAt || null
    };
}

function validatePresencePayload(body) {
    const type = String(body?.type || '').trim().toLowerCase();
    if (!PRESENCE_TYPES.has(type)) {
        return { ok: false, message: 'Invalid presence type', code: 'INVALID_PRESENCE_TYPE' };
    }

    let custom = null;
    if (body?.custom != null) {
        if (typeof body.custom !== 'object' || Array.isArray(body.custom)) {
            return { ok: false, message: 'Custom status must be an object or null', code: 'INVALID_CUSTOM_STATUS' };
        }
        const text = String(body.custom.text || '').trim();
        const emoji = String(body.custom.emoji || '').trim();
        if (!text) {
            return { ok: false, message: 'Custom status text is required', code: 'INVALID_CUSTOM_STATUS' };
        }
        if (text.length > 80 || emoji.length > 16) {
            return { ok: false, message: 'Custom status is too long', code: 'CUSTOM_STATUS_TOO_LONG' };
        }
        custom = { emoji: emoji || '💬', text };
    }

    let expiresAt = null;
    if (body?.expiresAt != null && body.expiresAt !== '') {
        expiresAt = new Date(body.expiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            return { ok: false, message: 'Presence expiry must be in the future', code: 'INVALID_PRESENCE_EXPIRY' };
        }
        if (!custom) {
            return { ok: false, message: 'Presence expiry requires a custom status', code: 'INVALID_PRESENCE_EXPIRY' };
        }
    }

    return { ok: true, value: { type, custom, expiresAt } };
}

function buildMasterUserListQuery(organizationId, scopedQuery) {
    const masterQuery = { organizationId };
    if (scopedQuery.roleId) {
        masterQuery.roleId = scopedQuery.roleId;
    }
    if (scopedQuery.$and) {
        masterQuery.$and = scopedQuery.$and;
    }
    return masterQuery;
}

const { buildDateFieldQuery } = require('../utils/listQueryBuilders/tasksListQuery');

function appendDateFieldCondition(andConditions, fieldName, queryParams, fieldPrefix) {
    const condition = buildDateFieldQuery(fieldPrefix, queryParams);
    if (condition === 'EMPTY') {
        andConditions.push({
            $or: [
                { [fieldName]: { $exists: false } },
                { [fieldName]: null }
            ]
        });
        return;
    }
    if (condition) {
        andConditions.push({ [fieldName]: condition });
    }
}

function isExternalUserType(userType) {
    return String(userType || '').toUpperCase() === 'EXTERNAL';
}

async function attachRoleSummaries(users = []) {
    const list = Array.isArray(users) ? users : [];
    if (list.length === 0) return list;

    const roleIds = Array.from(new Set(
        list
            .filter((u) => !isExternalUserType(u?.userType))
            .map((u) => u?.roleId?._id || u?.roleId)
            .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
            .map((id) => String(id))
    ));

    if (roleIds.length === 0) return list;

    const roles = await Role.find({ _id: { $in: roleIds } })
        .select('_id name description color icon level permissions userType')
        .lean();
    const roleMap = new Map(roles.map((r) => [String(r._id), r]));

    return list.map((u) => {
        if (isExternalUserType(u?.userType)) {
            return u;
        }
        const rid = u?.roleId?._id || u?.roleId;
        if (!rid) return u;
        const role = roleMap.get(String(rid));
        if (!role) return u;
        return { ...u, roleId: role };
    });
}

async function attachExternalRoleSummaries(users = [], organization = null) {
    let list = Array.isArray(users) ? users : [];
    const externalUsers = list.filter((u) => isExternalUserType(u?.userType));
    if (externalUsers.length === 0) return list;

    const externalsMissingAssignments = externalUsers.filter((user) =>
        !(user.externalRoleAssignments || []).some(
            (assignment) => String(assignment?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
        )
    );

    if (organization && externalsMissingAssignments.length > 0) {
        const ScopedUser = await getScopedUserModel(organization);
        const freshRows = await ScopedUser.find({
            _id: { $in: externalsMissingAssignments.map((user) => user._id) }
        })
            .select('externalRoleAssignments')
            .lean();
        const freshById = new Map(freshRows.map((row) => [String(row._id), row]));
        list = list.map((user) => {
            if (!isExternalUserType(user?.userType)) return user;
            const fresh = freshById.get(String(user._id));
            if (!fresh?.externalRoleAssignments?.length) return user;
            return { ...user, externalRoleAssignments: fresh.externalRoleAssignments };
        });
    }

    const organizationId = organization?._id || organization;
    const roleIdSet = new Set();
    for (const user of list.filter((u) => isExternalUserType(u?.userType))) {
        for (const assignment of user.externalRoleAssignments || []) {
            if (String(assignment?.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') continue;
            const roleId = assignment?.roleId?._id || assignment?.roleId;
            if (roleId && mongoose.Types.ObjectId.isValid(String(roleId))) {
                roleIdSet.add(String(roleId));
            }
        }
    }

    /** @type {Map<string, object>} */
    const roleMap = new Map();
    if (roleIdSet.size > 0) {
        const roleQuery = { _id: { $in: [...roleIdSet] } };
        if (organizationId) {
            roleQuery.organizationId = organizationId;
        }
        const roles = await Role.find(roleQuery)
            .select('_id name description color icon userType appEntitlements profileId')
            .populate('profileId', 'name')
            .lean();
        for (const role of roles) {
            roleMap.set(String(role._id), role);
        }
    }

    return list.map((user) => {
        if (!isExternalUserType(user?.userType)) return user;

        const externalRoles = (user.externalRoleAssignments || [])
            .filter((assignment) => String(assignment?.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
            .map((assignment) => {
                const roleId = assignment?.roleId?._id || assignment?.roleId;
                return roleMap.get(String(roleId));
            })
            .filter(Boolean);

        return {
            ...user,
            externalRoles,
            roleId: null
        };
    });
}

// --- Get all users in the organization ---
exports.getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            roleId = '',
            status = '',
            userType = '',
            adminOnly = ''
        } = req.query;

        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);

        // Build query
        const query = buildUserScopeQuery(req, organization);
        const andConditions = [];

        // Add roleId filter if provided
        if (roleId) {
            query.roleId = roleId;
        }

        // Add search filter
        if (search) {
            andConditions.push({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            });
        }

        if (status) {
            if (status === 'active') {
                andConditions.push({
                    $or: [
                        { status: 'active' },
                        { status: { $exists: false } },
                        { status: null }
                    ]
                });
            } else {
                andConditions.push({ status });
            }
        }

        if (userType) {
            const normalizedType = String(userType).toUpperCase();
            if (normalizedType === 'INTERNAL' || normalizedType === 'STANDARD') {
                andConditions.push({
                    $or: [
                        { userType: 'STANDARD' },
                        { userType: 'INTERNAL' },
                        { userType: { $exists: false } },
                        { userType: null }
                    ]
                });
            } else if (normalizedType === 'ADMIN') {
                andConditions.push({
                    $or: [
                        { userType: 'ADMIN' },
                        { userType: 'SYSTEM' },
                        { isOwner: true }
                    ]
                });
            } else {
                andConditions.push({ userType: normalizedType });
            }
        }

        appendDateFieldCondition(andConditions, 'lastLogin', req.query, 'lastLogin');
        appendDateFieldCondition(andConditions, 'createdAt', req.query, 'createdAt');

        if (adminOnly === 'true') {
            andConditions.push({
                $or: [
                    { isOwner: true },
                    { role: { $in: ['admin', 'owner'] } }
                ]
            });
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // Build sort object
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const usingDedicatedTenantDb = ScopedUser !== User;
        const listLimit = Math.max(200, Number(limit) * 5);

        const [scopedUsersRaw, masterUsersRaw] = await Promise.all([
            ScopedUser.find(query)
                .select('-password')
                .sort(sortOptions)
                .limit(listLimit)
                .lean(),
            usingDedicatedTenantDb
                ? User.find(buildMasterUserListQuery(req.user.organizationId, query))
                    .select('-password')
                    .sort(sortOptions)
                    .limit(listLimit)
                    .lean()
                : Promise.resolve([])
        ]);

        // Dedicated tenant DB: never resurrect a master copy when the tenant already
        // has that user (e.g. soft-deleted/inactive in tenant, still active on master).
        let masterUsersForMerge = masterUsersRaw;
        if (usingDedicatedTenantDb && masterUsersRaw.length > 0) {
            const masterIds = masterUsersRaw.map((row) => row._id).filter(Boolean);
            const existingInTenant = masterIds.length
                ? await ScopedUser.find({ _id: { $in: masterIds } }).select('_id').lean()
                : [];
            const tenantOwnedIds = new Set(existingInTenant.map((row) => String(row._id)));
            masterUsersForMerge = masterUsersRaw.filter(
                (row) => !tenantOwnedIds.has(String(row._id))
            );
        }

        const dedupedUsers = [];
        const seenIds = new Set();
        [...scopedUsersRaw, ...masterUsersForMerge].forEach((row) => {
            const key = String(row?._id || '');
            if (!key || seenIds.has(key)) return;
            seenIds.add(key);
            dedupedUsers.push(row);
        });

        const skipEmptyListFallback = Boolean(
            roleId || search || status || userType || adminOnly
            || req.query.lastLoginPreset || req.query.lastLoginOp || req.query.lastLogin
            || req.query.createdAtPreset || req.query.createdAtOp || req.query.createdAt
        );

        // Safety fallback: ensure currently-authenticated user is visible in Users list.
        // Skip for filtered queries (e.g. roleId) — empty results are valid.
        if (dedupedUsers.length === 0 && !skipEmptyListFallback) {
            const currentUserById = await ScopedUser.findById(req.user._id)
                .select('-password')
                .lean();
            const currentUserByEmail = !currentUserById && req.user?.email
                ? await ScopedUser.findOne({ email: String(req.user.email).toLowerCase().trim() })
                    .select('-password')
                    .lean()
                : null;
            const currentUserFallback = currentUserById || currentUserByEmail;

            if (currentUserFallback?._id) {
                seenIds.add(String(currentUserFallback._id));
                dedupedUsers.push(currentUserFallback);
            }
        }

        const total = dedupedUsers.length;
        const start = (Number(page) - 1) * Number(limit);
        const end = start + Number(limit);
        const pagedUsers = dedupedUsers.slice(start, end);
        const usersWithRoles = await attachRoleSummaries(pagedUsers);
        const usersWithExternalRoles = await attachExternalRoleSummaries(usersWithRoles, organization);
        let usersWithEffectivePermissions = usersWithExternalRoles;
        try {
            usersWithEffectivePermissions = await enrichLeanUsersWithEffectiveCRMPermissions(usersWithExternalRoles);
        } catch (permissionProjectionError) {
            console.warn('[getUsers] Permission enrichment failed, returning raw users:', permissionProjectionError.message);
        }

        {
          const {
            normalizePlatformUserType,
            PLATFORM_USER_TYPES,
          } = require('../constants/platformUserTypes');
          const { isPrivilegedSystemRoleName } = require('../utils/tenantPrivilegedAccess');
          const healOps = [];
          usersWithEffectivePermissions = usersWithEffectivePermissions.map((u) => {
            const roleName = u?.roleId?.name || u?.role;
            const next = (() => {
              if (u?.isOwner || isPrivilegedSystemRoleName(roleName)) {
                return PLATFORM_USER_TYPES.ADMIN;
              }
              return normalizePlatformUserType(u?.userType, {
                isOwner: u?.isOwner,
                roleName,
              });
            })();
            if (String(u?.userType || '') !== next) {
              healOps.push({ id: u._id, userType: next });
              return { ...u, userType: next };
            }
            return u;
          });
          if (healOps.length > 0) {
            Promise.all(
              healOps.map((op) =>
                ScopedUser.updateOne({ _id: op.id }, { $set: { userType: op.userType } }).catch(() => null)
              )
            ).catch(() => null);
          }
        }

        res.json({
            success: true,
            data: usersWithEffectivePermissions,
            total,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users' 
        });
    }
};

// --- Get add user capabilities (what apps & roles can be assigned) ---
exports.getAddCapabilities = async (req, res) => {
    try {
        // Requester must be Sales ADMIN (owner or admin)
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is owner or Admin userType (tenant privileged)
        const isCRMAdmin = isTenantPrivilegedUser(user);
        if (!isCRMAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can add users',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        // Get organization with enabledApps
        const organization = req.organization || await Organization.findById(user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Ensure billing/seat entitlements exist for enabled apps.
        // Keeps Invite User capabilities aligned with enabledApps (especially for paid orgs).
        await ensureOrgSubscriptionForEnabledApps(organization);

        // Build capabilities from enabledApps and appRegistry
        const capabilities = [];
        const enabledApps = organization.enabledApps || [];

        for (const enabledApp of enabledApps) {
            // Handle both object format {appKey, status} and legacy string format
            const appKey = typeof enabledApp === 'object' ? enabledApp.appKey : enabledApp;
            const status = typeof enabledApp === 'object' ? enabledApp.status : 'ACTIVE';

            // Only include ACTIVE apps
            if (status !== 'ACTIVE') {
                continue;
            }

            // Get app config from registry
            const appConfig = getAppConfig(appKey);
            if (!appConfig) {
                // App not in registry - skip it
                continue;
            }

            // Get roles for this app
            const roles = getRolesForApp(appKey);
            const defaultRole = getDefaultRoleForApp(appKey);

            // Get seat usage info for PER_USER apps
            const seatLimit = await getSeatLimit(organization._id, appKey);
            const seatsUsed = await getSeatsUsed(organization._id, appKey);
            const canAdd = await canAddUserToApp(organization._id, appKey);

            // Build capability entry
            capabilities.push({
                appKey: appKey,
                roles: roles,
                defaultRole: defaultRole,
                userTypesAllowed: appConfig.userTypesAllowed || [],
                seatInfo: {
                    limit: seatLimit,
                    used: seatsUsed,
                    available: seatLimit === null ? null : Math.max(0, seatLimit - seatsUsed),
                    canAdd: canAdd.allowed,
                    reason: canAdd.reason || null
                }
            });
        }

        res.json({
            success: true,
            data: {
                apps: capabilities
            }
        });
    } catch (error) {
        console.error('Get add capabilities error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching add capabilities',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get users list for assignment (no permission required, any authenticated user can see org users) ---
exports.getUsersForAssignment = async (req, res) => {
    try {
        // Ensure organizationId is available
        if (!req.user || !req.user.organizationId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - organization context missing'
            });
        }

        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);

        const { scope = 'internal', orgId = null } = req.query;

        // Supported scopes:
        // - internal: users in req.user.organizationId
        // - org: users in orgId
        // - internal_or_org: users in either req.user.organizationId or orgId
        const isValidScope = ['internal', 'org', 'internal_or_org'].includes(String(scope));
        if (!isValidScope) {
            return res.status(400).json({
                success: false,
                message: `Invalid scope. Must be one of: internal, org, internal_or_org`,
                code: 'INVALID_SCOPE'
            });
        }

        const orgIdStr = orgId ? String(orgId) : null;
        const orgIdIsValid = !orgIdStr || /^[0-9a-fA-F]{24}$/.test(orgIdStr);
        if (!orgIdIsValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid orgId format',
                code: 'INVALID_ORG_ID'
            });
        }

        const ids = new Set();
        const allUsers = [];

        const fetchByOrg = async (organizationId) => {
            const scopeQuery = buildUserScopeQuery({ user: { organizationId } }, organization);
            const list = await ScopedUser.find({
                ...scopeQuery,
                status: 'active'
            })
                .select('_id firstName lastName email username avatar organizationId')
                .sort({ firstName: 1, lastName: 1 })
                .lean();
            for (const u of list) {
                const key = String(u._id);
                if (!ids.has(key)) {
                    ids.add(key);
                    allUsers.push(u);
                }
            }
        };

        if (scope === 'internal') {
            await fetchByOrg(req.user.organizationId);
        } else if (scope === 'org') {
            // If orgId isn't selected yet (common during form entry), return an empty list (not an error)
            if (orgIdStr) await fetchByOrg(orgIdStr);
        } else if (scope === 'internal_or_org') {
            await fetchByOrg(req.user.organizationId);
            if (orgIdStr) await fetchByOrg(orgIdStr);
        }

        // Keep deterministic ordering (firstName/lastName) even when merging two org lists
        allUsers.sort((a, b) => {
            const aFirst = (a.firstName || '').toLowerCase();
            const bFirst = (b.firstName || '').toLowerCase();
            if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
            const aLast = (a.lastName || '').toLowerCase();
            const bLast = (b.lastName || '').toLowerCase();
            if (aLast !== bLast) return aLast.localeCompare(bLast);
            return String(a._id).localeCompare(String(b._id));
        });

        res.json({
            success: true,
            data: allUsers
        });
    } catch (error) {
        console.error('Get users for assignment error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Get single user ---
exports.getUser = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        })
        .select('-password')
        .lean();

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const [userWithRole] = await attachExternalRoleSummaries(
            await attachRoleSummaries([user]),
            organization
        );
        const hydratedUser = new User(userWithRole);
        hydratedUser.isNew = false;
        await materializeEffectiveCRMEnvelopeOnUser(hydratedUser);

        res.json({
            success: true,
            data: sanitizeUserResponsePayload(hydratedUser)
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching user' 
        });
    }
};

// --- Invite/Create new user (Unified Add User Flow) ---
async function runInviteUser(req, res) {
    const { 
        email, 
        firstName, 
        lastName, 
        roleId, // Legacy: backward compatibility
        role, // Legacy: backward compatibility
        phoneNumber, 
        password, 
        sendEmail,
        welcomeNote,
        suggestedTask,
        // New unified format
        userType,
        appAccess,
        name, // Alternative to firstName/lastName
        businessHourSetId
    } = req.body;

    try {
        // Requester must be Sales ADMIN (enforced by middleware, but check here for clarity)
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const isCRMAdmin = isTenantPrivilegedUser(user);
        if (!isCRMAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can add users',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        // Validate required fields
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: 'Email is required' 
            });
        }

        if (!businessHourSetId || !mongoose.Types.ObjectId.isValid(businessHourSetId)) {
            return res.status(400).json({
                success: false,
                message: 'Business hours is required',
                code: 'BUSINESS_HOURS_REQUIRED'
            });
        }

        // Get organization for validation (required before RBAC v2 format checks)
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const BusinessHourSet = require('../models/BusinessHourSet');
        const businessHourSet = await BusinessHourSet.findOne({
            _id: businessHourSetId,
            organizationId: organization._id
        }).select('_id').lean();
        if (!businessHourSet) {
            return res.status(400).json({
                success: false,
                message: 'Selected business hours not found',
                code: 'BUSINESS_HOURS_NOT_FOUND'
            });
        }

        // Determine if using new unified format or legacy format
        const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
        const rbacV2 = isRbacV2Enabled(organization);

        if (rbacV2 && appAccess && Array.isArray(appAccess) && appAccess.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'appAccess cannot be set directly when RBAC v2 is enabled. Assign a role instead.',
                code: 'RBAC_V2_APP_ACCESS_NOT_ALLOWED'
            });
        }

        const isUnifiedFormat = !rbacV2 && appAccess && Array.isArray(appAccess) && appAccess.length > 0;
        const isLegacyFormat = Boolean(roleId) && (rbacV2 || !isUnifiedFormat);

        if (!isUnifiedFormat && !isLegacyFormat) {
            return res.status(400).json({
                success: false,
                message: rbacV2
                    ? 'roleId is required when RBAC v2 is enabled'
                    : 'Either appAccess array (unified format) or roleId (legacy format) is required',
                code: rbacV2 ? 'RBAC_V2_ROLE_REQUIRED' : 'MISSING_APP_ACCESS_OR_ROLE'
            });
        }

        // Ensure billing/seat entitlements exist for enabled apps before enforcing seats.
        // Without this, paid-by-default orgs can show "not subscribed/suspended" in Invite flows.
        await ensureOrgSubscriptionForEnabledApps(organization);

        const ScopedUser = await getScopedUserModel(organization);

        // Check if organization has reached user limit
        const currentUserCount = await ScopedUser.countDocuments({
            organizationId: organization._id,
            status: 'active'
        });

        if (organization.limits.maxUsers !== -1 && currentUserCount >= organization.limits.maxUsers) {
            return res.status(403).json({ 
                success: false,
                message: `User limit reached (${organization.limits.maxUsers}). Please upgrade your plan.`,
                code: 'USER_LIMIT_REACHED'
            });
        }

        // Check if user already exists in this organization.
        // Tenant DBs are org-scoped by database; do not require organizationId on the document.
        const inviteScopeQuery = buildUserScopeQuery(req, organization);
        const existingUser = await ScopedUser.findOne({
            email: email.toLowerCase(),
            ...inviteScopeQuery
        }).sort({ updatedAt: -1 });

        let reinviteUser = null;
        if (existingUser) {
            if (existingUser.status === 'active') {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists in your organization'
                });
            }
            if (!['inactive', 'invited', 'deleted'].includes(existingUser.status)) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists in your organization'
                });
            }
            reinviteUser = existingUser;
        }

        // Email is globally unique in UserDirectory (login routing). Refuse invites that
        // would overwrite another tenant's directory claim.
        const normalizedInviteEmail = String(email).toLowerCase().trim();
        const directoryClaim = await UserDirectory.findOne({ email: normalizedInviteEmail })
            .select('organizationId')
            .lean();
        if (
            directoryClaim?.organizationId
            && String(directoryClaim.organizationId) !== String(organization._id)
        ) {
            return res.status(409).json({
                success: false,
                message: 'This email already belongs to another workspace. Use a different email, or ask them to sign in to their existing workspace.',
                code: 'EMAIL_IN_OTHER_TENANT'
            });
        }

        const wasInactive = reinviteUser?.status === 'inactive' || reinviteUser?.status === 'deleted';

        let finalAppAccess = [];
        let finalUserType = userType || 'STANDARD';
        let roleDoc = null;
        let legacyRole = null;
        let isOwner = false;
        let crmRoleKey = null;

        // ============================================
        // NEW UNIFIED FORMAT PROCESSING
        // ============================================
        if (isUnifiedFormat) {
            // Validate unified format
            const validationErrors = [];

            // Validate at least one appAccess entry
            if (appAccess.length === 0) {
                validationErrors.push('At least one appAccess entry is required');
            }

            // Check for duplicate appKeys
            const appKeys = appAccess.map(a => a.appKey);
            const uniqueAppKeys = new Set(appKeys);
            if (appKeys.length !== uniqueAppKeys.size) {
                validationErrors.push('Duplicate appKey entries are not allowed');
            }

            // Validate each appAccess entry
            for (let i = 0; i < appAccess.length; i++) {
                const entry = appAccess[i];
                const entryErrors = [];

                // Validate appKey exists
                if (!entry.appKey) {
                    entryErrors.push('appKey is required');
                } else {
                    const appConfig = getAppConfig(entry.appKey);
                    if (!appConfig) {
                        entryErrors.push(`App ${entry.appKey} is not registered in the system`);
                    } else {
                        // Validate app is enabled for organization
                        if (!isAppEnabledForOrg(organization, entry.appKey)) {
                            entryErrors.push(`App ${entry.appKey} is not enabled for this organization`);
                        }

                        // Validate userType is allowed for this app
                        if (finalUserType && !validateUserTypeForApp(finalUserType, entry.appKey)) {
                            entryErrors.push(`UserType ${finalUserType} is not allowed for app ${entry.appKey}`);
                        }

                        // Validate roleKey
                        let roleKey = entry.roleKey;
                        if (!roleKey) {
                            // Resolve default role if missing
                            roleKey = getDefaultRoleForApp(entry.appKey);
                            if (!roleKey) {
                                entryErrors.push(`No roleKey provided and no default role found for app ${entry.appKey}`);
                            }
                        } else {
                            // Validate roleKey is valid for app
                            if (!validateAppRole(entry.appKey, roleKey)) {
                                entryErrors.push(`Role ${roleKey} is not valid for app ${entry.appKey}`);
                            }
                        }

                        // Build final appAccess entry
                        if (entryErrors.length === 0) {
                            finalAppAccess.push({
                                appKey: entry.appKey,
                                roleKey: roleKey,
                                status: 'ACTIVE',
                                addedAt: new Date()
                            });
                        } else {
                            validationErrors.push(`appAccess[${i}]: ${entryErrors.join(', ')}`);
                        }
                    }
                }
            }

            // Validate userType is provided
            if (!finalUserType) {
                validationErrors.push('userType is required');
            }

            // Reject if any validation errors
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors,
                    code: 'VALIDATION_ERROR'
                });
            }

            // For backward compatibility, try to find Sales role for legacy roleId/role fields
            // This allows UI to still send roleId for Sales while using unified format
            if (roleId) {
                roleDoc = await findOrganizationRoleById(organization, roleId);
                if (roleDoc) {
                    legacyRole = roleDoc.name.toLowerCase();
                    isOwner = roleDoc.name === 'Owner';
                    crmRoleKey = isOwner ? 'ADMIN' : mapLegacyRoleToCRM(legacyRole);
                    
                    // Update Sales appAccess entry if it exists
                    const crmIndex = finalAppAccess.findIndex(a => a.appKey === APP_KEYS.SALES);
                    if (crmIndex >= 0) {
                        finalAppAccess[crmIndex].roleKey = crmRoleKey;
                    }
                }
            }
        }
        // ============================================
        // LEGACY FORMAT PROCESSING (Backward Compatibility)
        // ============================================
        else if (isLegacyFormat) {
            // Fetch the Role document to get role details (tenant DB when org has dedicated DB)
            roleDoc = await findOrganizationRoleById(organization, roleId);
            
            if (!roleDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            const {
                deriveAppAccessFromRole,
                mapRoleNameToLegacyEnum
            } = require('../services/roleEntitlementService');

            if (rbacV2) {
                const derived = deriveAppAccessFromRole(roleDoc, organization);
                finalAppAccess = derived.appAccess;
                finalUserType = roleDoc.userType || 'STANDARD';
                legacyRole = mapRoleNameToLegacyEnum(roleDoc.name);
                isOwner = roleDoc.name === 'Owner';
                {
                  const { normalizePlatformUserType, PLATFORM_USER_TYPES } = require('../constants/platformUserTypes');
                  const { isPrivilegedSystemRoleName } = require('../utils/tenantPrivilegedAccess');
                  finalUserType = normalizePlatformUserType(finalUserType, {
                    isOwner,
                    roleName: roleDoc.name,
                  });
                  if (isPrivilegedSystemRoleName(roleDoc.name)) {
                    finalUserType = PLATFORM_USER_TYPES.ADMIN;
                  }
                }
            } else {
                // Map role name to legacy role enum for backward compatibility
                legacyRole = roleDoc.name.toLowerCase();
                isOwner = roleDoc.name === 'Owner';
                
                // Map legacy role to Sales roleKey
                crmRoleKey = isOwner ? 'ADMIN' : mapLegacyRoleToCRM(legacyRole);

                // Validate Sales roleKey
                if (!validateAppRole(APP_KEYS.SALES, crmRoleKey)) {
                    console.warn(`Invalid Sales roleKey ${crmRoleKey}, using default`);
                    const defaultRole = getDefaultRoleForApp(APP_KEYS.SALES);
                    crmRoleKey = defaultRole || 'USER';
                }

                // Validate Sales is enabled for organization
                if (!isAppEnabledForOrg(organization, APP_KEYS.SALES)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Sales app is not enabled for this organization',
                        code: 'APP_NOT_ENABLED'
                    });
                }

                // Create appAccess from legacy format (Sales only)
                finalAppAccess = [{
                    appKey: APP_KEYS.SALES,
                    roleKey: crmRoleKey,
                    status: 'ACTIVE',
                    addedAt: new Date()
                }];

                // Default to STANDARD for legacy format
                finalUserType = 'STANDARD';
            }
        }

        {
          const { normalizePlatformUserType, PLATFORM_USER_TYPES } = require('../constants/platformUserTypes');
          finalUserType = normalizePlatformUserType(finalUserType, {
            isOwner,
            roleName: legacyRole || roleDoc?.name,
          });
          if (isOwner) finalUserType = PLATFORM_USER_TYPES.ADMIN;
        }

        // ============================================
        // SEAT ENFORCEMENT (CRITICAL - BEFORE USER CREATION)
        // ============================================
        // Validation Order (Strict):
        // 1. App exists in appRegistry
        // 2. App enabled for organization
        // 3. App subscribed in OrganizationSubscription
        // 4. Subscription status = ACTIVE or TRIAL
        // 5. If billingType = PER_USER: seatsUsed < seatLimit
        for (const appAccessEntry of finalAppAccess) {
            const appKey = appAccessEntry.appKey;
            
            // Validate app exists in appRegistry (already validated above, but double-check)
            const appConfig = getAppConfig(appKey);
            if (!appConfig) {
                return res.status(400).json({
                    success: false,
                    message: `App ${appKey} is not registered in the system`,
                    code: 'APP_NOT_REGISTERED'
                });
            }

            // Validate app is enabled for organization (already validated above, but double-check)
            if (!isAppEnabledForOrg(organization, appKey)) {
                return res.status(400).json({
                    success: false,
                    message: `App ${appKey} is not enabled for this organization`,
                    code: 'APP_NOT_ENABLED'
                });
            }

            // Check if user can be added to this app (includes subscription and seat checks)
            // SUBSCRIPTION RULE: ACTIVE and TRIAL are usable, SUSPENDED/CANCELLED are blocked
            const canAdd = await canAddUserToApp(organization._id, appKey);
            if (!canAdd.allowed) {
                // Determine error code and HTTP status based on reason
                let errorCode = 'SEAT_LIMIT_EXCEEDED';
                let httpStatus = 403;
                
                if (canAdd.reason && (canAdd.reason.includes('suspended') || canAdd.reason.includes('not active'))) {
                    errorCode = 'SUBSCRIPTION_INACTIVE';
                    httpStatus = 402; // Payment Required
                } else if (canAdd.reason && canAdd.reason.includes('trial')) {
                    errorCode = 'TRIAL_EXPIRED';
                    httpStatus = 402; // Payment Required
                } else if (canAdd.reason && canAdd.reason.includes('not subscribed')) {
                    errorCode = 'SUBSCRIPTION_INACTIVE';
                    httpStatus = 402; // Payment Required
                }

                return res.status(httpStatus).json({
                    success: false,
                    code: errorCode,
                    message: canAdd.reason || `Cannot add user to ${appKey} app`,
                    appKey: appKey
                });
            }
        }

        // Use provided password or generate temporary password
        const wantsEmail = sendEmail === true || sendEmail === 'true' || sendEmail === 1 || sendEmail === '1';
        const manualPassword = password ? String(password) : null;
        if (manualPassword && manualPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
                code: 'PASSWORD_TOO_SHORT'
            });
        }
        const inviteCredentials = userInviteService.buildInviteCredentials({
            wantsEmail,
            manualPassword
        });
        const tempPassword = inviteCredentials.password;
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const inviteTokenHash = inviteCredentials.inviteTokenRaw
            ? hashToken(inviteCredentials.inviteTokenRaw)
            : null;

        // Create username from email
        const username = email.split('@')[0];

        // Handle name field (alternative to firstName/lastName)
        let finalFirstName = firstName || '';
        let finalLastName = lastName || '';
        if (!finalFirstName && !finalLastName && name) {
            const nameParts = name.trim().split(/\s+/);
            finalFirstName = nameParts[0] || '';
            finalLastName = nameParts.slice(1).join(' ') || '';
        }

        const finalWelcomeNote = welcomeNote !== undefined && welcomeNote !== null
            ? String(welcomeNote).trim().slice(0, 500)
            : '';
        const finalSuggestedTask = suggestedTask !== undefined && suggestedTask !== null
            ? String(suggestedTask).trim().slice(0, 200)
            : '';

        const onboardingPayload = (finalWelcomeNote || finalSuggestedTask)
            ? {
                welcomeNote: finalWelcomeNote || undefined,
                suggestedTask: finalSuggestedTask || undefined
            }
            : undefined;

        let newUser;
        if (reinviteUser) {
            if (!reinviteUser.organizationId) {
                reinviteUser.organizationId = organization._id;
            }
            reinviteUser.username = reinviteUser.username || username;
            reinviteUser.password = hashedPassword;
            reinviteUser.firstName = finalFirstName;
            reinviteUser.lastName = finalLastName;
            if (phoneNumber !== undefined) {
                reinviteUser.phoneNumber = phoneNumber;
            }
            reinviteUser.roleId = roleId || null;
            reinviteUser.role = legacyRole || null;
            reinviteUser.isOwner = isOwner;
            reinviteUser.businessHourSetId = businessHourSetId;
            reinviteUser.status = inviteCredentials.initialStatus;
            reinviteUser.userType = finalUserType;
            reinviteUser.appAccess = finalAppAccess;
            reinviteUser.allowedApps = finalAppAccess.map((a) => a.appKey);
            reinviteUser.invitedAt = new Date();
            reinviteUser.invitedBy = req.user._id;
            reinviteUser.mustChangePassword = inviteCredentials.mustChangePassword;
            reinviteUser.emailVerifiedAt = null;
            reinviteUser.inviteAcceptedAt = null;
            reinviteUser.inviteTokenHash = inviteTokenHash;
            reinviteUser.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
            reinviteUser.emailVerificationTokenHash = null;
            reinviteUser.emailVerificationExpiresAt = null;
            reinviteUser.emailVerificationSentAt = null;
            if (onboardingPayload) {
                reinviteUser.onboarding = onboardingPayload;
            }
            newUser = reinviteUser;
        } else {
            newUser = await ScopedUser.create({
                organizationId: req.user.organizationId,
                username,
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName: finalFirstName,
                lastName: finalLastName,
                phoneNumber,
                roleId: roleId || null, // May be null for unified format
                role: legacyRole || null, // Store legacy role for backward compatibility
                isOwner: isOwner,
                businessHourSetId,
                status: inviteCredentials.initialStatus,
                userType: finalUserType,
                appAccess: finalAppAccess,
                allowedApps: finalAppAccess.map(a => a.appKey), // Legacy field for backward compatibility
                invitedAt: new Date(),
                invitedBy: req.user._id,
                mustChangePassword: inviteCredentials.mustChangePassword,
                emailVerifiedAt: null,
                inviteTokenHash,
                inviteTokenExpiresAt: inviteCredentials.inviteTokenExpiresAt,
                onboarding: onboardingPayload
            });
        }

        await materializeEffectiveCRMEnvelopeOnUser(newUser);
        await newUser.save();

        if (inviteCredentials.inviteTokenRaw) {
            const persistedInvite = await ScopedUser.findById(newUser._id)
                .select('status inviteTokenHash inviteTokenExpiresAt')
                .lean();
            if (
                !persistedInvite
                || persistedInvite.status !== 'invited'
                || persistedInvite.inviteTokenHash !== inviteTokenHash
            ) {
                console.error('[inviteUser] Invite token not persisted after save:', {
                    email: newUser.email,
                    organizationId: organization._id,
                    expectedStatus: 'invited',
                    actualStatus: persistedInvite?.status || null,
                    hasTokenHash: Boolean(persistedInvite?.inviteTokenHash)
                });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to persist invitation. Please try again.',
                    code: 'INVITE_TOKEN_PERSIST_FAILED'
                });
            }
        }

        await UserDirectory.findOneAndUpdate(
            { email: newUser.email.toLowerCase() },
            {
                $set: {
                    organizationId: organization._id,
                    tenantDatabaseName: organization.database?.name || null,
                    tenantUserId: newUser._id,
                    status: 'active',
                    inviteTokenHash: inviteTokenHash || null,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            const { markOrgInviteSent } = require('../services/onboardingService');
            await markOrgInviteSent(organization);
        } catch (onboardingErr) {
            console.warn('[inviteUser] org invite step update failed:', onboardingErr.message);
        }
        
        // Increment seat usage for each app (atomic operations)
        if (!reinviteUser || wasInactive) {
            for (const appAccessEntry of finalAppAccess) {
                await incrementSeat(organization._id, appAccessEntry.appKey);
            }
        }

        try {
            const { syncCommercialBillingAfterInvite } = require('../services/commercial/inviteBillingSync');
            await syncCommercialBillingAfterInvite({
                organizationId: organization._id,
                userId: newUser._id,
                userType: finalUserType,
                appAccess: finalAppAccess,
                initiatedByUserId: req.user._id,
                isNewBillableSeat: !reinviteUser || wasInactive,
            });
        } catch (commercialErr) {
            console.warn('[inviteUser] commercial billing sync failed:', commercialErr.message);
        }

        try {
            const {
                reconcileCommercialBillingAfterMutation,
            } = require('../services/commercial/reconcileCommercialSubscription');
            await reconcileCommercialBillingAfterMutation({
                organizationId: organization._id,
                initiatedByUserId: req.user._id,
            });
        } catch (reconcileErr) {
            console.warn('[inviteUser] commercial reconcile failed:', reconcileErr.message);
        }
        
        // Increment the role's user count (if roleId provided)
        if (roleId && (!reinviteUser || wasInactive)) {
            const ScopedRole = await getScopedRoleModel(organization);
            await ScopedRole.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });
        }

        let emailSent = false;
        let emailError = null;
        let verificationEmailSent = false;

        if (wantsEmail && inviteCredentials.inviteTokenRaw) {
            // Invite-link email (user sets password on accept)
            const inviteEmailResult = await userInviteService.sendInviteForUser({
                user: newUser,
                organization,
                inviter: req.user,
                inviteToken: inviteCredentials.inviteTokenRaw,
                welcomeNote: finalWelcomeNote || null
            });
            emailSent = inviteEmailResult.sent === true;
            if (!emailSent) {
                emailError = inviteEmailResult.reason || 'Failed to send invitation email';
                console.warn('[inviteUser] Invitation email failed:', {
                    invitedEmail: newUser.email,
                    organizationId: organization._id,
                    reason: emailError,
                    channel: inviteEmailResult.channel || null
                });
            } else {
                console.log('[inviteUser] Invitation email sent:', {
                    invitedEmail: newUser.email,
                    organizationId: organization._id,
                    channel: inviteEmailResult.channel || null,
                    messageId: inviteEmailResult.messageId || null
                });
            }
        } else if (manualPassword && wantsEmail) {
            // API-only temporary password path: notification / verification email (no secret).
            const verificationResult = await userInviteService.issueVerificationForUser({
                user: newUser,
                organization,
                forceNewToken: true
            });
            await newUser.save();
            verificationEmailSent = verificationResult.sent === true;
            if (verificationResult.sent) {
                await userInviteService.syncDirectoryEntry(newUser.email, {
                    emailVerificationTokenHash: newUser.emailVerificationTokenHash
                });
            } else {
                emailError = verificationResult.reason || 'Failed to send verification email';
            }
        }

        // Populate the role details
        if (newUser.roleId) {
            try {
                await newUser.populate('roleId');
            } catch (_e) {
                // Role model may not be registered on tenant connection; response still succeeds.
            }
        }

        const responseData = {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            userType: newUser.userType,
            appAccess: newUser.appAccess,
            role: newUser.role,
            roleId: newUser.roleId,
            status: newUser.status,
            emailVerifiedAt: newUser.emailVerifiedAt,
            emailSent,
            verificationEmailSent
        };

        if (emailError) {
            responseData.emailError = emailError;
        }

        // When invite email was not delivered, return the link so admin can share it.
        if (inviteCredentials.inviteTokenRaw && !emailSent) {
            responseData.inviteUrl = buildInviteUrl(inviteCredentials.inviteTokenRaw);
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            {},
            cloneForAudit({
                email: responseData.email,
                firstName: responseData.firstName,
                lastName: responseData.lastName,
                role: responseData.role,
                roleId: responseData.roleId,
                status: responseData.status
            }),
            { keys: ['email', 'firstName', 'lastName', 'role', 'roleId', 'status'] }
        );

        res.status(201).json({
            success: true,
            data: responseData,
            message: emailSent
                ? 'User invited successfully. Invitation email sent.'
                : wantsEmail
                    ? 'User invited successfully, but the invitation email could not be sent.'
                    : 'User invited successfully'
        });

    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error inviting user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

exports.inviteUser = runInviteUser;
exports.runInviteUser = runInviteUser;

/**
 * Preview CSV bulk invite (no users created, no emails sent).
 */
exports.previewBulkInvite = async (req, res) => {
    try {
        const userBulkInviteService = require('../services/userBulkInviteService');
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        let rows = req.body?.rows;
        if ((!rows || !Array.isArray(rows)) && typeof req.body?.csvText === 'string') {
            const parsed = userBulkInviteService.parseInviteCsv(req.body.csvText);
            if (!parsed.ok) {
                return res.status(400).json({
                    success: false,
                    message: parsed.message,
                    code: parsed.code,
                    maxRows: parsed.maxRows
                });
            }
            rows = parsed.rows;
        }

        const result = await userBulkInviteService.previewBulkInvite({
            actor: req.user,
            organization,
            rows,
            businessHourSetId: req.body?.businessHourSetId,
            defaultRoleId: req.body?.defaultRoleId
        });

        if (!result.ok) {
            return res.status(result.statusCode || 400).json({
                success: false,
                message: result.message,
                code: result.code
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });
    } catch (error) {
        console.error('Preview bulk invite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error previewing bulk invite',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Commit CSV bulk invite via the shared inviteUser path (per-row results).
 */
exports.commitBulkInvite = async (req, res) => {
    try {
        const userBulkInviteService = require('../services/userBulkInviteService');
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        if (!isTenantPrivilegedUser(req.user)) {
            return res.status(403).json({
                success: false,
                message: 'Only Sales administrators can add users',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        const businessHourSetId = req.body?.businessHourSetId;
        const defaultRoleId = req.body?.defaultRoleId;
        const sendEmail = req.body?.sendEmail !== false;

        let rows = req.body?.rows;
        if ((!rows || !Array.isArray(rows)) && typeof req.body?.csvText === 'string') {
            const parsed = userBulkInviteService.parseInviteCsv(req.body.csvText);
            if (!parsed.ok) {
                return res.status(400).json({
                    success: false,
                    message: parsed.message,
                    code: parsed.code,
                    maxRows: parsed.maxRows
                });
            }
            rows = parsed.rows;
        }

        const preview = await userBulkInviteService.previewBulkInvite({
            actor: req.user,
            organization,
            rows,
            businessHourSetId,
            defaultRoleId
        });

        if (!preview.ok) {
            return res.status(preview.statusCode || 400).json({
                success: false,
                message: preview.message,
                code: preview.code
            });
        }

        if (preview.data.seatWarnings?.length) {
            const blocking = preview.data.seatWarnings.filter((w) =>
                ['USER_LIMIT_REACHED', 'USER_LIMIT_SHORTFALL', 'SEAT_BLOCKED', 'SEAT_SHORTFALL'].includes(w.code)
            );
            if (blocking.length && req.body?.allowSeatOverage !== true) {
                return res.status(403).json({
                    success: false,
                    message: 'Seat or user-limit shortfall — resolve capacity before inviting',
                    code: 'SEAT_SHORTFALL',
                    data: preview.data
                });
            }
        }

        const invitable = preview.data.rows.filter(
            (r) => r.status === 'valid' || r.status === 'reinvite'
        );

        const results = [];
        let invited = 0;
        let failed = 0;
        let skipped = preview.data.rows.length - invitable.length;

        for (const previewRow of preview.data.rows) {
            if (previewRow.status !== 'valid' && previewRow.status !== 'reinvite') {
                results.push({
                    rowNumber: previewRow.rowNumber,
                    email: previewRow.email,
                    status: 'skipped',
                    code: previewRow.code,
                    message: previewRow.message
                });
                continue;
            }

            const body = userBulkInviteService.buildInviteBodyFromRow(previewRow, {
                businessHourSetId,
                defaultRoleId: previewRow.roleId || defaultRoleId,
                sendEmail
            });

            const { res: captureRes, getResult } = userBulkInviteService.createCaptureRes();
            const inviteReq = {
                user: req.user,
                organization,
                body
            };

            await runInviteUser(inviteReq, captureRes);
            const inviteResult = getResult();
            const ok = inviteResult.statusCode >= 200 && inviteResult.statusCode < 300
                && inviteResult.body?.success === true;

            if (ok) {
                invited += 1;
                results.push({
                    rowNumber: previewRow.rowNumber,
                    email: previewRow.email,
                    status: 'invited',
                    userId: inviteResult.body?.data?._id || null,
                    emailSent: inviteResult.body?.data?.emailSent === true,
                    message: inviteResult.body?.message || 'Invited'
                });
            } else {
                failed += 1;
                results.push({
                    rowNumber: previewRow.rowNumber,
                    email: previewRow.email,
                    status: 'failed',
                    code: inviteResult.body?.code || 'INVITE_FAILED',
                    message: inviteResult.body?.message || 'Invite failed'
                });
            }
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        attachSettingsAuditDiff(
            res,
            {},
            cloneForAudit({
                invited,
                failed,
                skipped,
                total: results.length
            }),
            { keys: ['invited', 'failed', 'skipped', 'total'] }
        );

        return res.status(200).json({
            success: true,
            data: {
                results,
                summary: {
                    total: results.length,
                    invited,
                    failed,
                    skipped
                }
            },
            message: `Invited ${invited} of ${results.length} users`
        });
    } catch (error) {
        console.error('Commit bulk invite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error committing bulk invite',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- Update user role and permissions ---
exports.updateUser = async (req, res) => {
    const { role, roleId, status, firstName, lastName, phoneNumber, appAccess, businessHourSetId } = req.body;

    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            roleId: user.roleId,
            status: user.status
        });

        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'permissions') && req.body.permissions !== undefined) {
            console.warn(
                '[DEPRECATED] PUT /users/:id ignores body.permissions. Edit Roles or assign appAccess.',
                { actor: req.user?._id, target: req.params.id }
            );
        }

        const requestKeys = Object.keys(req.body || {});
        const isOwnerAllowedUpdate = user.isOwner &&
            requestKeys.length > 0 &&
            requestKeys.every((key) => key === 'appAccess' || key === 'businessHourSetId');

        // Prevent changing owner profile/role/status, but allow app seat + business hours updates.
        if (user.isOwner && !isOwnerAllowedUpdate) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot modify the organization owner',
                code: 'CANNOT_MODIFY_OWNER'
            });
        }

        async function applyBusinessHourSetId() {
            if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'businessHourSetId')) {
                return null;
            }
            if (!businessHourSetId || !mongoose.Types.ObjectId.isValid(businessHourSetId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Business hours is required',
                    code: 'BUSINESS_HOURS_REQUIRED'
                });
            }
            const BusinessHourSet = require('../models/BusinessHourSet');
            const businessHourSet = await BusinessHourSet.findOne({
                _id: businessHourSetId,
                organizationId: organization._id
            }).select('_id').lean();
            if (!businessHourSet) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected business hours not found',
                    code: 'BUSINESS_HOURS_NOT_FOUND'
                });
            }
            user.businessHourSetId = businessHourSetId;
            return null;
        }

        // Update fields (owner profile remains immutable from this endpoint)
        if (!user.isOwner) {
            const employeePatch = {};
            for (const key of [
                'firstName', 'lastName', 'phoneNumber', 'secondaryEmail',
                'officePhone', 'homePhone', 'mobilePhone', 'fax', 'language', 'timeZone', 'dateFormat', 'timeFormat', 'displayPreferences'
            ]) {
                if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
                    employeePatch[key] = req.body[key];
                }
            }
            if (Object.keys(employeePatch).length > 0) {
                const contactResult = applyEmployeeContactFields(user, employeePatch, organization);
                if (!contactResult.ok) {
                    return res.status(400).json({
                        success: false,
                        message: contactResult.message,
                        code: contactResult.code
                    });
                }
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'primaryGroupId')) {
                const groupResult = await applyPrimaryGroupId(user, req.body.primaryGroupId, organization._id);
                if (!groupResult.ok) {
                    return res.status(400).json({
                        success: false,
                        message: groupResult.message,
                        code: groupResult.code
                    });
                }
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'reportsTo')) {
                const reportsToRaw = req.body.reportsTo;
                if (reportsToRaw == null || reportsToRaw === '') {
                    user.reportsTo = null;
                } else {
                    if (!mongoose.Types.ObjectId.isValid(reportsToRaw)) {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid reportsTo user id',
                            code: 'INVALID_REPORTS_TO'
                        });
                    }
                    if (String(reportsToRaw) === String(user._id)) {
                        return res.status(400).json({
                            success: false,
                            message: 'User cannot report to themselves',
                            code: 'REPORTS_TO_SELF'
                        });
                    }
                    const manager = await ScopedUser.findOne({
                        _id: reportsToRaw,
                        organizationId: organization._id,
                        status: { $nin: ['deleted'] }
                    }).select('_id').lean();
                    if (!manager) {
                        return res.status(400).json({
                            success: false,
                            message: 'Reports-to user not found in this organization',
                            code: 'REPORTS_TO_NOT_FOUND'
                        });
                    }
                    user.reportsTo = reportsToRaw;
                }
            }

            if (status !== undefined) {
                const nextStatus = String(status);
                if (nextStatus === 'deleted') {
                    return res.status(400).json({
                        success: false,
                        message: 'Use DELETE /users/:id after deactivate and transfer to delete a user',
                        code: 'USE_DELETE_ENDPOINT'
                    });
                }
                if (nextStatus === 'inactive' && user.status !== 'inactive') {
                    await applyUserDeactivation(user, organization, ScopedUser, req.user?._id);
                    const ownership = await userRecordTransferService.getOwnershipSummary(
                        organization._id,
                        user._id
                    );
                    attachSettingsAuditDiff(
                        res,
                        before,
                        cloneForAudit({
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            role: user.role,
                            roleId: user.roleId,
                            status: 'inactive'
                        }),
                        { keys: ['email', 'firstName', 'lastName', 'role', 'roleId', 'status'] }
                    );
                    return res.json({
                        success: true,
                        message: 'User deactivated successfully',
                        data: {
                            _id: user._id,
                            status: 'inactive',
                            openTotal: ownership.openTotal,
                            closedTotal: ownership.closedTotal,
                            modules: ownership.modules
                        }
                    });
                }
                applyStatusTimestamps(user, nextStatus, user.status);
                user.status = nextStatus;
            }
        }

        {
            const bhError = await applyBusinessHourSetId();
            if (bhError) return bhError;
        }
        
        const externalUser = isExternalUserType(user.userType);
        if (externalUser && roleId !== undefined && roleId !== null && String(roleId).trim() !== '') {
            return res.status(400).json({
                success: false,
                message: 'External portal users use portal roles managed from the linked People record',
                code: 'EXTERNAL_USER_ROLE_READONLY'
            });
        }
        if (externalUser && appAccess !== undefined) {
            return res.status(400).json({
                success: false,
                message: 'External portal app access is derived from portal roles',
                code: 'EXTERNAL_USER_APP_ACCESS_READONLY'
            });
        }

        // Update role if roleId is provided (new dynamic role system)
        if (!user.isOwner && !externalUser && roleId !== undefined && roleId !== user.roleId?.toString()) {
            const roleDoc = await findOrganizationRoleById(organization, roleId);
            
            if (!roleDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            const ScopedRole = await getScopedRoleModel(organization);

            // Decrement old role's user count
            if (user.roleId) {
                await ScopedRole.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
            }

            // Update user's role (permission snapshot rebuilt from Role below, after appAccess)
            user.roleId = roleId;
            user.role = roleDoc.name.toLowerCase(); // Update legacy role field
            user.isOwner = roleDoc.name === 'Owner';
            {
              const { normalizePlatformUserType, PLATFORM_USER_TYPES } = require('../constants/platformUserTypes');
              const { isPrivilegedSystemRoleName } = require('../utils/tenantPrivilegedAccess');
              const roleType = normalizePlatformUserType(roleDoc.userType, {
                isOwner: user.isOwner,
                roleName: roleDoc.name,
              });
              if (
                roleType === PLATFORM_USER_TYPES.ADMIN ||
                isPrivilegedSystemRoleName(roleDoc.name)
              ) {
                user.userType = PLATFORM_USER_TYPES.ADMIN;
              } else if (roleType === PLATFORM_USER_TYPES.EXTERNAL) {
                user.userType = PLATFORM_USER_TYPES.EXTERNAL;
              } else {
                user.userType = PLATFORM_USER_TYPES.STANDARD;
              }
            }
            
            // Increment new role's user count
            await ScopedRole.findByIdAndUpdate(roleId, { $inc: { userCount: 1 } });
        }
        // Fallback to legacy role update (for backward compatibility)
        else if (!user.isOwner && role !== undefined && role !== user.role) {
            user.role = role;
            user.setPermissionsByRole(role);
        }

        // Update app access (seat-gated execution entitlement)
        if (appAccess !== undefined) {
            if (!Array.isArray(appAccess) || appAccess.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one app access entry is required'
                });
            }

            const currentAccessByApp = new Map((user.appAccess || []).map((entry) => [entry.appKey, entry]));
            const seenAppKeys = new Set();
            const normalizedAppAccess = [];

            for (let i = 0; i < appAccess.length; i++) {
                const raw = appAccess[i] || {};
                const appKey = String(raw.appKey || '').trim().toUpperCase();
                const roleKey = String(raw.roleKey || '').trim().toUpperCase();
                const entryStatus = String(raw.status || 'ACTIVE').trim().toUpperCase();

                if (!appKey) {
                    return res.status(400).json({
                        success: false,
                        message: `appAccess[${i}]: appKey is required`
                    });
                }

                if (!roleKey) {
                    return res.status(400).json({
                        success: false,
                        message: `appAccess[${i}]: roleKey is required`
                    });
                }

                if (seenAppKeys.has(appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate appAccess entry for ${appKey}`
                    });
                }
                seenAppKeys.add(appKey);

                const appConfig = getAppConfig(appKey);
                if (!appConfig) {
                    return res.status(400).json({
                        success: false,
                        message: `App ${appKey} is not registered in the system`
                    });
                }

                if (!isAppEnabledForOrg(organization, appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `App ${appKey} is not enabled for this organization`
                    });
                }

                if (!validateAppRole(appKey, roleKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Role ${roleKey} is not valid for app ${appKey}`
                    });
                }

                if (!validateUserTypeForApp(user.userType || 'INTERNAL', appKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `${appKey} does not support ${user.userType || 'INTERNAL'} users`
                    });
                }

                const previous = currentAccessByApp.get(appKey);
                normalizedAppAccess.push({
                    appKey,
                    roleKey,
                    status: entryStatus === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
                    addedAt: previous?.addedAt || new Date()
                });
            }

            const previousActiveApps = new Set(
                (user.appAccess || [])
                    .filter((entry) => entry.status === 'ACTIVE')
                    .map((entry) => entry.appKey)
            );
            const nextActiveApps = new Set(
                normalizedAppAccess
                    .filter((entry) => entry.status === 'ACTIVE')
                    .map((entry) => entry.appKey)
            );

            // Validate seat availability only for newly activated app memberships.
            for (const appKey of nextActiveApps) {
                if (!previousActiveApps.has(appKey)) {
                    const canAdd = await canAddUserToApp(organization._id, appKey);
                    if (!canAdd.allowed) {
                        return res.status(403).json({
                            success: false,
                            code: 'SEAT_LIMIT_EXCEEDED',
                            message: canAdd.reason || `Cannot add user to ${appKey}`,
                            appKey
                        });
                    }
                }
            }

            user.appAccess = normalizedAppAccess;
            user.allowedApps = normalizedAppAccess
                .filter((entry) => entry.status === 'ACTIVE')
                .map((entry) => entry.appKey);

            // Keep seat counters in sync.
            for (const appKey of previousActiveApps) {
                if (!nextActiveApps.has(appKey)) {
                    await decrementSeat(organization._id, appKey);
                }
            }
            for (const appKey of nextActiveApps) {
                if (!previousActiveApps.has(appKey)) {
                    await incrementSeat(organization._id, appKey);
                }
            }

            try {
                const {
                    syncCommercialBillingAfterAppAccessChange,
                } = require('../services/commercial/userLifecycleBillingSync');
                await syncCommercialBillingAfterAppAccessChange({
                    organizationId: organization._id,
                    userId: user._id,
                    previousActiveAppKeys: [...previousActiveApps],
                    nextActiveAppKeys: [...nextActiveApps],
                    initiatedByUserId: req.user._id,
                });
            } catch (commercialErr) {
                console.warn('[updateUser] commercial appAccess sync failed:', commercialErr.message);
            }
        }

        await materializeEffectiveCRMEnvelopeOnUser(user);

        await user.save();

        try {
            const {
                reconcileCommercialBillingAfterMutation,
            } = require('../services/commercial/reconcileCommercialSubscription');
            await reconcileCommercialBillingAfterMutation({
                organizationId: organization._id,
                initiatedByUserId: req.user._id,
            });
        } catch (reconcileErr) {
            console.warn('[updateUser] commercial reconcile failed:', reconcileErr.message);
        }

        // Populate role details (Role model may not be registered on tenant connection)
        try {
            await user.populate('roleId', 'name description color icon level');
        } catch (_e) {
            // Tenant DB connection may not have Role registered; response still succeeds.
        }

        const updated = sanitizeUserResponsePayload(user);
        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({
                email: updated.email,
                firstName: updated.firstName,
                lastName: updated.lastName,
                role: updated.role,
                roleId: updated.roleId,
                status: updated.status
            }),
            { keys: ['email', 'firstName', 'lastName', 'role', 'roleId', 'status'] }
        );
        res.json({
            success: true,
            data: {
                _id: updated._id,
                username: updated.username,
                email: updated.email,
                firstName: updated.firstName,
                lastName: updated.lastName,
                phoneNumber: updated.phoneNumber,
                mobilePhone: effectiveMobilePhone(updated),
                department: updated.department,
                primaryGroupId: updated.primaryGroupId,
                secondaryEmail: updated.secondaryEmail,
                officePhone: updated.officePhone,
                homePhone: updated.homePhone,
                fax: updated.fax,
                language: updated.language,
                timeZone: updated.timeZone,
                dateFormat: updated.dateFormat,
                timeFormat: updated.timeFormat,
                displayPreferences: updated.displayPreferences,
                reportsTo: updated.reportsTo,
                suspendedAt: updated.suspendedAt,
                reactivatedAt: updated.reactivatedAt,
                role: updated.role,
                roleId: updated.roleId,
                status: updated.status,
                permissions: updated.permissions,
                appAccess: updated.appAccess,
                allowedApps: updated.allowedApps
            },
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating user' 
        });
    }
};

// --- Delete/Deactivate user ---
// --- Deactivate user (status → inactive; seats released; login blocked) ---
exports.deactivateUser = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isOwner) {
            return res.status(403).json({
                success: false,
                message: 'Cannot deactivate the organization owner',
                code: 'CANNOT_DEACTIVATE_OWNER'
            });
        }

        if (user.status === 'deleted') {
            return res.status(400).json({
                success: false,
                message: 'User is already deleted',
                code: 'USER_ALREADY_DELETED'
            });
        }

        if (user.status === 'inactive') {
            return res.json({
                success: true,
                message: 'User is already inactive',
                data: { status: 'inactive', alreadyInactive: true }
            });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status
        });

        await applyUserDeactivation(user, organization, ScopedUser, req.user?._id);

        const ownership = await userRecordTransferService.getOwnershipSummary(
            organization._id,
            user._id
        );

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: 'inactive'
            }),
            { keys: ['email', 'firstName', 'lastName', 'role', 'status'] }
        );

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: {
                status: 'inactive',
                openTotal: ownership.openTotal,
                closedTotal: ownership.closedTotal,
                modules: ownership.modules
            }
        });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deactivating user'
        });
    }
};

// --- Ownership summary for transfer step ---
exports.getUserOwnershipSummary = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);
        const user = await ScopedUser.findOne({ _id: req.params.id, ...scopeQuery }).select('_id status isOwner');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const ownership = await userRecordTransferService.getOwnershipSummary(
            organization._id,
            user._id
        );

        res.json({
            success: true,
            data: {
                userId: user._id,
                status: user.status,
                ...ownership
            }
        });
    } catch (error) {
        console.error('Ownership summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error loading ownership summary'
        });
    }
};

// --- Transfer records from one user to another ---
exports.transferUserRecords = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        const { toUserId, includeClosed = false, moduleKeys = null } = req.body || {};
        if (!toUserId) {
            return res.status(400).json({
                success: false,
                message: 'toUserId is required',
                code: 'TO_USER_REQUIRED'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const fromUser = await ScopedUser.findOne({ _id: req.params.id, ...scopeQuery });
        if (!fromUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const toUser = await ScopedUser.findOne({
            _id: toUserId,
            ...scopeQuery,
            status: 'active'
        });
        if (!toUser) {
            return res.status(400).json({
                success: false,
                message: 'Destination must be an active user in this organization',
                code: 'INVALID_DESTINATION_USER'
            });
        }

        const result = await userRecordTransferService.transferOwnership({
            organizationId: organization._id,
            fromUserId: fromUser._id,
            toUserId: toUser._id,
            includeClosed: Boolean(includeClosed),
            moduleKeys: Array.isArray(moduleKeys) ? moduleKeys : null,
            actorUserId: req.user._id
        });

        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: result.message,
                code: result.code
            });
        }

        res.json({
            success: true,
            message: 'Records transferred successfully',
            data: result
        });
    } catch (error) {
        console.error('Transfer user records error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error transferring records'
        });
    }
};

// --- Delete user (requires inactive + no open records → status deleted) ---
exports.deleteUser = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        if (user.isOwner) {
            return res.status(403).json({ 
                success: false,
                message: 'Cannot delete the organization owner',
                code: 'CANNOT_DELETE_OWNER'
            });
        }

        if (user.status === 'deleted') {
            return res.json({
                success: true,
                message: 'User already deleted'
            });
        }

        if (user.status !== 'inactive') {
            return res.status(400).json({
                success: false,
                message: 'Deactivate the user and transfer open records before deleting',
                code: 'MUST_DEACTIVATE_BEFORE_DELETE'
            });
        }

        const ownership = await userRecordTransferService.getOwnershipSummary(
            organization._id,
            user._id
        );
        if (ownership.openTotal > 0) {
            return res.status(400).json({
                success: false,
                message: 'Transfer open records before deleting this user',
                code: 'OPEN_RECORDS_REMAIN',
                data: ownership
            });
        }

        // Decrement role's user count if roleId exists (seats already released on deactivate)
        if (user.roleId) {
            const ScopedRole = await getScopedRoleModel(organization);
            await ScopedRole.findByIdAndUpdate(user.roleId, { $inc: { userCount: -1 } });
        }

        const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
        const before = cloneForAudit({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status
        });

        user.status = 'deleted';
        user.inviteTokenHash = null;
        user.inviteTokenExpiresAt = null;
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;
        user.authSessionVersion = Number(user.authSessionVersion || 0) + 1;
        await user.save();

        await mirrorUserStatusToMaster(ScopedUser, user, organization, 'deleted');

        await userInviteService.syncDirectoryEntry(user.email, {
          inviteTokenHash: null,
          emailVerificationTokenHash: null,
          status: 'inactive'
        });

        attachSettingsAuditDiff(
            res,
            before,
            cloneForAudit({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: 'deleted'
            }),
            { keys: ['email', 'firstName', 'lastName', 'role', 'status'] }
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error deleting user' 
        });
    }
};

// --- Cross-device user presence ---
exports.getMyPresence = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findOne({
            ...buildUserScopeQuery(req, organization),
            _id: req.user._id
        }).select('_id presence').lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({ success: true, data: serializePresence(user) });
    } catch (error) {
        console.error('Get presence error:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching presence' });
    }
};

exports.updateMyPresence = async (req, res) => {
    const validation = validatePresencePayload(req.body);
    if (!validation.ok) {
        return res.status(400).json({
            success: false,
            message: validation.message,
            code: validation.code
        });
    }

    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);
        const updatedAt = new Date();
        const user = await ScopedUser.findOneAndUpdate(
            {
                ...buildUserScopeQuery(req, organization),
                _id: req.user._id,
                status: 'active'
            },
            {
                $set: {
                    presence: {
                        ...validation.value,
                        updatedAt
                    }
                }
            },
            { new: true, runValidators: true }
        ).select('_id presence').lean();

        if (!user) {
            return res.status(404).json({ success: false, message: 'Active user not found' });
        }

        return res.json({
            success: true,
            data: serializePresence(user),
            message: 'Presence updated successfully'
        });
    } catch (error) {
        console.error('Update presence error:', error);
        return res.status(500).json({ success: false, message: 'Server error updating presence' });
    }
};

exports.getOrganizationPresence = async (req, res) => {
    const rawIds = Array.isArray(req.query.userIds)
        ? req.query.userIds
        : String(req.query.userIds || '').split(',');
    const userIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))];

    if (!userIds.length || userIds.length > 100 || userIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({
            success: false,
            message: 'Provide between 1 and 100 valid userIds',
            code: 'INVALID_USER_IDS'
        });
    }

    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId)
            .select('database name');
        const ScopedUser = await getScopedUserModel(organization);
        const users = await ScopedUser.find({
            ...buildUserScopeQuery(req, organization),
            _id: { $in: userIds },
            status: 'active'
        }).select('_id presence').lean();

        return res.json({
            success: true,
            data: users.map((user) => ({
                userId: user._id,
                ...serializePresence(user)
            }))
        });
    } catch (error) {
        console.error('Get organization presence error:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching presence' });
    }
};

// --- Get current user profile ---
exports.getProfile = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('database name subscription limits enabledApps enabledModules settings')
            .lean();
        const ScopedUser = await getScopedUserModel(organization);

        const user = await ScopedUser.findById(req.user._id)
            .select('-password')
            .populate('reportsTo', 'firstName lastName email username')
            .populate('primaryGroupId', 'name type color');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        seedDisplayPreferencesFromOrg(user, organization);

        await materializeEffectiveCRMEnvelopeOnUser(user, {
            organization,
            activeExternalRoleId: req.user.activeExternalRoleId || req.user._activeExternalRoleId || null
        });
        const sanitizedUser = sanitizeUserResponsePayload(user);
        sanitizedUser.mobilePhone = effectiveMobilePhone(sanitizedUser);
        const [userWithRole] = await attachRoleSummaries([sanitizedUser]);

        const ScopedRole = await getScopedRoleModel(organization);
        const { resolveEffectiveReportsTo } = require('../services/roleHierarchyService');
        const reportsResolution = await resolveEffectiveReportsTo(userWithRole, {
            organizationId: organization?._id || req.user.organizationId,
            UserModel: ScopedUser,
            RoleModel: ScopedRole
        });
        userWithRole.reportsTo = reportsResolution.user;
        userWithRole.reportsToSource = reportsResolution.source;

        if (organization) {
            const { buildOrgCapabilities } = require('../utils/orgCapabilities');
            const { buildClientSessionEntitlements } = require('../utils/clientSessionEntitlements');
            const { projectEffectiveClientSettings } = require('../utils/rbacFeatureFlags');
            userWithRole.entitledAddons = await buildClientSessionEntitlements(userWithRole, organization._id);
            userWithRole.organizationId = {
                _id: organization._id,
                name: organization.name,
                subscription: organization.subscription,
                limits: organization.limits,
                enabledApps: organization.enabledApps,
                enabledModules: organization.enabledModules,
                settings: projectEffectiveClientSettings(organization),
                capabilities: buildOrgCapabilities(organization)
            };
        }

        // Groups the current user belongs to (tenant-scoped membership only).
        const membershipGroups = await Group.find({
            organizationId: organization?._id || req.user.organizationId,
            members: req.user._id,
            isActive: { $ne: false }
        })
            .select('_id name description type color')
            .sort({ name: 1 })
            .lean();
        userWithRole.groups = membershipGroups.map((g) => ({
            _id: g._id,
            name: g.name,
            description: g.description || '',
            type: g.type || null,
            color: g.color || null
        }));

        res.json({
            success: true,
            data: userWithRole
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error fetching profile' 
        });
    }
};

// --- Update current user profile ---
exports.updateProfile = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const employeePatch = {};
        for (const key of [
            'firstName', 'lastName', 'phoneNumber', 'secondaryEmail',
            'officePhone', 'homePhone', 'mobilePhone', 'fax', 'language', 'timeZone', 'dateFormat', 'timeFormat', 'displayPreferences', 'avatar'
        ]) {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
                employeePatch[key] = req.body[key];
            }
        }

        if (Object.prototype.hasOwnProperty.call(employeePatch, 'avatar')) {
            user.avatar = employeePatch.avatar;
            delete employeePatch.avatar;
        }

        if (Object.keys(employeePatch).length > 0) {
            const contactResult = applyEmployeeContactFields(user, employeePatch, organization);
            if (!contactResult.ok) {
                return res.status(400).json({
                    success: false,
                    message: contactResult.message,
                    code: contactResult.code
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'primaryGroupId')) {
            return res.status(403).json({
                success: false,
                message: 'Primary group can only be assigned by an admin',
                code: 'PRIMARY_GROUP_ADMIN_ONLY'
            });
        }

        seedDisplayPreferencesFromOrg(user, organization);
        await user.save();

        const mobile = effectiveMobilePhone(user);

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                mobilePhone: mobile,
                primaryGroupId: user.primaryGroupId,
                secondaryEmail: user.secondaryEmail,
                officePhone: user.officePhone,
                homePhone: user.homePhone,
                fax: user.fax,
                language: user.language,
                timeZone: user.timeZone,
                dateFormat: user.dateFormat,
                timeFormat: user.timeFormat,
                displayPreferences: user.displayPreferences,
                avatar: user.avatar,
                reportsTo: user.reportsTo,
                suspendedAt: user.suspendedAt,
                reactivatedAt: user.reactivatedAt,
                createdAt: user.createdAt
            },
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error updating profile' 
        });
    }
};

// --- Change password ---
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Current password and new password are required' 
            });
        }

        const organization = req.organization || await Organization.findById(req.user.organizationId);
        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.mustChangePassword = false;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error changing password' 
        });
    }
};

// --- Reset user password (Admin only) ---
exports.resendUserInvite = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isOwner) {
            return res.status(403).json({
                success: false,
                message: 'Cannot resend invite for the organization owner',
                code: 'CANNOT_RESEND_OWNER_INVITE'
            });
        }

        if (!['invited', 'inactive', 'deleted'].includes(user.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only invited, inactive, or deleted users can be reinvited',
                code: 'INVALID_STATUS_FOR_RESEND_INVITE'
            });
        }

        const wasInactive = user.status === 'inactive' || user.status === 'deleted';
        const inviteCredentials = userInviteService.buildInviteCredentials({ wantsEmail: true });
        const inviteTokenHash = hashToken(inviteCredentials.inviteTokenRaw);
        const hashedPassword = await bcrypt.hash(inviteCredentials.password, 10);

        user.password = hashedPassword;
        user.status = inviteCredentials.initialStatus;
        user.mustChangePassword = inviteCredentials.mustChangePassword;
        user.invitedAt = new Date();
        user.invitedBy = req.user._id;
        user.emailVerifiedAt = null;
        user.inviteAcceptedAt = null;
        user.inviteTokenHash = inviteTokenHash;
        user.inviteTokenExpiresAt = inviteCredentials.inviteTokenExpiresAt;
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;
        user.emailVerificationSentAt = null;

        await user.save();

        const persistedInvite = await ScopedUser.findById(user._id)
            .select('status inviteTokenHash inviteTokenExpiresAt')
            .lean();
        if (
            !persistedInvite
            || persistedInvite.status !== 'invited'
            || persistedInvite.inviteTokenHash !== inviteTokenHash
        ) {
            return res.status(500).json({
                success: false,
                message: 'Failed to persist invitation. Please try again.',
                code: 'INVITE_TOKEN_PERSIST_FAILED'
            });
        }

        await UserDirectory.findOneAndUpdate(
            { email: user.email.toLowerCase() },
            {
                $set: {
                    organizationId: organization._id,
                    tenantDatabaseName: organization.database?.name || null,
                    tenantUserId: user._id,
                    status: 'active',
                    inviteTokenHash,
                    emailVerificationTokenHash: null
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (wasInactive && Array.isArray(user.appAccess)) {
            for (const appAccessEntry of user.appAccess) {
                if (appAccessEntry?.appKey) {
                    await incrementSeat(organization._id, appAccessEntry.appKey);
                }
            }
        }

        try {
            const { syncCommercialBillingAfterInvite } = require('../services/commercial/inviteBillingSync');
            await syncCommercialBillingAfterInvite({
                organizationId: organization._id,
                userId: user._id,
                userType: user.userType,
                appAccess: Array.isArray(user.appAccess) ? user.appAccess : [],
                initiatedByUserId: req.user._id,
                isNewBillableSeat: wasInactive,
            });
        } catch (commercialErr) {
            console.warn('[resendUserInvite] commercial billing sync failed:', commercialErr.message);
        }

        try {
            const {
                reconcileCommercialBillingAfterMutation,
            } = require('../services/commercial/reconcileCommercialSubscription');
            await reconcileCommercialBillingAfterMutation({
                organizationId: organization._id,
                initiatedByUserId: req.user._id,
            });
        } catch (reconcileErr) {
            console.warn('[resendUserInvite] commercial reconcile failed:', reconcileErr.message);
        }

        const inviteEmailResult = await userInviteService.sendInviteForUser({
            user,
            organization,
            inviter: req.user,
            inviteToken: inviteCredentials.inviteTokenRaw,
            welcomeNote: null
        });

        const emailSent = inviteEmailResult.sent === true;
        if (!emailSent) {
            console.warn('[resendUserInvite] Invitation email failed:', {
                invitedEmail: user.email,
                organizationId: organization._id,
                reason: inviteEmailResult.reason || null,
                channel: inviteEmailResult.channel || null
            });
        }

        return res.json({
            success: true,
            message: emailSent
                ? 'Invitation resent successfully. Invitation email sent.'
                : 'Invitation updated, but the invitation email could not be sent.',
            data: {
                _id: user._id,
                email: user.email,
                status: user.status,
                invitedAt: user.invitedAt,
                emailSent,
                emailError: emailSent ? undefined : (inviteEmailResult.reason || 'Failed to send invitation email')
            }
        });
    } catch (error) {
        console.error('Resend invite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error resending invitation'
        });
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const scopeQuery = buildUserScopeQuery(req, organization);

        const user = await ScopedUser.findOne({
            _id: req.params.id,
            ...scopeQuery
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent resetting owner password
        if (user.isOwner) {
            return res.status(403).json({
                success: false,
                message: 'Cannot reset the organization owner password',
                code: 'CANNOT_RESET_OWNER_PASSWORD'
            });
        }

        // Generate temporary password
        const tempPassword = generateSecurePassword(16);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        user.password = hashedPassword;
        user.mustChangePassword = true;
        await user.save();

        const verificationResult = await userInviteService.issueVerificationForUser({
            user,
            organization,
            forceNewToken: true
        });
        await user.save();
        if (verificationResult.sent) {
            await userInviteService.syncDirectoryEntry(user.email, {
                emailVerificationTokenHash: user.emailVerificationTokenHash
            });
        }

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined,
                verificationEmailSent: verificationResult.sent === true
            }
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error resetting password' 
        });
    }
};

// --- Upload current user's avatar ---
// POST /api/users/profile/avatar (multipart: avatar)
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

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

        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { persistMulterUpload } = require('../middleware/uploadMiddleware');
        const uploadResult = await persistMulterUpload(req, 'avatars');
        user.avatar = uploadResult.url;
        await user.save();

        return res.json({
            success: true,
            message: 'Avatar updated',
            data: { avatar: uploadResult.url }
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload avatar',
            error: error.message
        });
    }
};

// --- Remove current user's avatar ---
// DELETE /api/users/profile/avatar
exports.deleteAvatar = async (req, res) => {
    try {
        const organization = req.organization || await Organization.findById(req.user.organizationId);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const ScopedUser = await getScopedUserModel(organization);
        const user = await ScopedUser.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.avatar = '';
        await user.save();

        return res.json({
            success: true,
            message: 'Avatar removed',
            data: { avatar: '' }
        });
    } catch (error) {
        console.error('Delete avatar error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove avatar',
            error: error.message
        });
    }
};
