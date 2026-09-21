/**
 * ============================================================================
 * PLATFORM CORE: Authentication & Session Handling
 * ============================================================================
 * 
 * This controller handles app-agnostic authentication:
 * - User registration (creates organization + owner)
 * - User login with JWT tokens
 * - Password hashing and verification
 * - Token generation
 * 
 * ✅ FIXED: Registration no longer initializes Sales-specific modules.
 *    Sales initialization has been moved to salesAppInitializer service.
 *    Registration is now app-agnostic.
 * 
 * See PLATFORM_CORE_ANALYSIS.md and REGISTRATION_REFACTORING.md for details.
 * ============================================================================
 */

const User = require('../models/User');
const Organization = require('../models/Organization');
const { buildOrgCapabilities } = require('../utils/orgCapabilities');
const { buildClientSessionEntitlements } = require('../utils/clientSessionEntitlements');
const Role = require('../models/Role');
const UserDirectory = require('../models/UserDirectory');
const DemoRequest = require('../models/DemoRequest');
const InstanceRegistry = require('../models/InstanceRegistry');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { APP_KEYS } = require('../constants/appKeys');
const {
    materializeEffectiveCRMEnvelopeOnUser,
    userPermissionsEnvelopeToPlain
} = require('../utils/rolePermissionProjection');
const {
    buildAuthenticatedSessionResponse
} = require('../services/authSessionService');
const {
    admitOrBlockAuthSession,
    createLoginChallenge,
    verifyLoginChallenge,
    listActiveSessions,
    listSessionsForLimitChallenge,
    revokeSessionById,
    DEVICE_CLASS_LIMITS
} = require('../services/sessionService');
const { isPortalFrameworkV1Enabled } = require('../utils/portalFeatureFlags');
const {
    resolveExternalLoginSession,
    isExternalUser
} = require('../services/externalRoleSessionService');
const { recordPortalEvent } = require('../services/securityAuditService');
const securityLogger = require('../middleware/securityLoggingMiddleware');
const { getDefaultRoleForApp } = require('../utils/appAccessUtils');
const { ensureDefaultCommunicationSettingsForOrganization } = require('../services/communicationDefaultsSeeder');
const { ensureOrgEmailPolicy } = require('../services/orgEmailPolicyService');

function sessionMetaFromRequest(req) {
    return {
        ip: req.ip || null,
        userAgent: req.get('user-agent') || null
    };
}

function buildSessionLimitResponse(orgUser, organization, admission) {
    const challengeId = createLoginChallenge({
        userId: orgUser._id,
        organizationId: organization._id,
        deviceClass: admission.deviceClass,
        email: orgUser.email
    });
    return {
        code: 'SESSION_LIMIT',
        message: 'Password verified. Free a session slot to continue on this device.',
        challengeId,
        deviceClass: admission.deviceClass,
        limits: admission.limits || { ...DEVICE_CLASS_LIMITS },
        usage: admission.usage || null,
        sessions: admission.sessions || []
    };
}

async function resolveOrgUserForSessionChallenge(challenge) {
    const organization = await Organization.findById(challenge.organizationId)
        .select('name industry subscription limits enabledApps enabledModules settings isActive database security');
    if (!organization) {
        return { ok: false, status: 401, message: 'Invalid or expired login challenge.' };
    }

    let orgUser = null;
    if (organization.database?.name && organization.database.initialized) {
        try {
            const dbConnectionManager = require('../utils/databaseConnectionManager');
            const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
            const OrgUser = getOrgUserModel(orgDbConnection);
            orgUser = await OrgUser.findById(challenge.userId);
            if (!orgUser && challenge.email) {
                orgUser = await OrgUser.findOne({ email: String(challenge.email).toLowerCase().trim() });
            }
        } catch (_err) {
            orgUser = null;
        }
    }
    if (!orgUser) {
        orgUser = await User.findById(challenge.userId);
        if (!orgUser && challenge.email) {
            orgUser = await User.findOne({ email: String(challenge.email).toLowerCase().trim() });
        }
    }
    if (!orgUser || orgUser.status !== 'active') {
        return { ok: false, status: 401, message: 'Invalid or expired login challenge.' };
    }

    return { ok: true, orgUser, organization };
}

function resolveChallengeFromRequest(req) {
    return (
        req.body?.challengeId
        || req.query?.challengeId
        || req.get('x-login-challenge')
        || null
    );
}

function getOrgUserModel(orgDbConnection) {
    if (orgDbConnection.models.User) {
        return orgDbConnection.models.User;
    }
    const originalSchema = User.schema;
    const UserSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);

    if (originalSchema.methods) {
        Object.keys(originalSchema.methods).forEach((methodName) => {
            UserSchema.methods[methodName] = originalSchema.methods[methodName];
        });
    }
    if (originalSchema.statics) {
        Object.keys(originalSchema.statics).forEach((staticName) => {
            UserSchema.statics[staticName] = originalSchema.statics[staticName];
        });
    }

    return orgDbConnection.model('User', UserSchema);
}

async function resolveInstanceForLogin(organizationId, email) {
    if (!organizationId && !email) return null;

    try {
        if (organizationId) {
            const convertedDemo = await DemoRequest.findOne({
                organizationId,
                status: 'converted',
                convertedToInstanceId: { $exists: true, $ne: null }
            })
                .sort({ convertedAt: -1, updatedAt: -1 })
                .select('convertedToInstanceId')
                .populate('convertedToInstanceId', 'subdomain urls status');

            if (convertedDemo?.convertedToInstanceId) {
                const instance = convertedDemo.convertedToInstanceId;
                return {
                    subdomain: instance.subdomain || null,
                    frontendUrl: instance.urls?.frontend || null,
                    apiUrl: instance.urls?.api || null,
                    status: instance.status || null
                };
            }

            const organization = await Organization.findById(organizationId)
                .select('database')
                .lean();
            const dbName = organization?.database?.name;
            if (dbName) {
                const fallbackByDatabase = await InstanceRegistry.findOne({
                    'databaseConnection.database': dbName
                })
                    .sort({ updatedAt: -1 })
                    .select('subdomain urls status')
                    .lean();

                if (fallbackByDatabase) {
                    return {
                        subdomain: fallbackByDatabase.subdomain || null,
                        frontendUrl: fallbackByDatabase.urls?.frontend || null,
                        apiUrl: fallbackByDatabase.urls?.api || null,
                        status: fallbackByDatabase.status || null
                    };
                }
            }
        }

        if (email) {
            const fallbackByOwnerEmail = await InstanceRegistry.findOne({
                ownerEmail: String(email).toLowerCase().trim()
            })
                .sort({ updatedAt: -1 })
                .select('subdomain urls status')
                .lean();

            if (fallbackByOwnerEmail) {
                return {
                    subdomain: fallbackByOwnerEmail.subdomain || null,
                    frontendUrl: fallbackByOwnerEmail.urls?.frontend || null,
                    apiUrl: fallbackByOwnerEmail.urls?.api || null,
                    status: fallbackByOwnerEmail.status || null
                };
            }
        }
    } catch (instanceLookupError) {
        console.warn('[Auth] Instance resolution failed during login:', instanceLookupError.message);
    }

    return null;
}

// --- Helper Function: Generate Token ---
const generateToken = (id, organizationId = null) => {
    // SECURITY: JWT_SECRET must be set - fail hard if not configured
    if (!process.env.JWT_SECRET) {
        throw new Error('CRITICAL: JWT_SECRET environment variable is not set! Server cannot generate tokens.');
    }
    
    const payload = { id };
    if (organizationId) {
        payload.organizationId = organizationId.toString();
    }
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// --- 1. Registration Logic (Multi-tenant: Creates Organization + Owner) ---
exports.registerUser = async (req, res) => {
    console.log('\n\n========================================');
    console.log('🚀 REGISTRATION FUNCTION CALLED - NEW CODE VERSION');
    console.log('========================================');
    
    const { username, email, password, vertical, organizationName } = req.body;
    
    // DEBUG LOGGING
    console.log('📝 Registration Request Received:');
    console.log('  - Username:', username);
    console.log('  - Email:', email);
    console.log('  - Vertical:', vertical);
    console.log('  - Organization Name:', organizationName);
    console.log('  - Full body:', JSON.stringify(req.body, null, 2));
    
    try {
        console.log('\n🔍 Step 1: Validating fields...');
        // Validate required fields
        if (!username || !email || !password || !vertical) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({ 
                message: 'Please provide all required fields: username, email, password, vertical' 
            });
        }

        console.log('✅ Validation passed\n');
        
        console.log('🔍 Step 2: Checking for existing user...');
        // Check if user with this email already exists (across all organizations)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({ 
                message: 'A user with this email already exists.' 
            });
        }
        console.log('✅ No existing user found\n');

        // 1. Create Organization (Tenant)
        console.log('🔍 Step 3: Creating organization...');
        console.log('   Organization Name:', organizationName || `${username}'s Organization`);
        console.log('   Industry:', vertical);
        const {
            shouldSeedRbacV2ForNewOrganization,
            getNewOrganizationRbacSettings
        } = require('../utils/rbacFeatureFlags');
        const useRbacV2Seed = shouldSeedRbacV2ForNewOrganization();
        const rbacSettings = getNewOrganizationRbacSettings();
        const { resolveVerticalTemplate } = require('../services/onboardingVerticalTemplates');
        const {
            buildEnabledAppsArray,
            resolveEnabledModulesFromTemplate,
            applyVerticalPresets,
            resolveEnabledAppsForTemplate,
        } = require('../services/verticalPresetService');
        const registrationTemplate = resolveVerticalTemplate({ industry: vertical });

        const organization = await Organization.create({
            name: organizationName || `${username}'s Organization`,
            industry: vertical,
            isTenant: true,
            subscription: {
                status: 'trial',
                tier: 'trial',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
            },
            limits: {
                maxUsers: 3,
                maxContacts: 100,
                maxDeals: 50,
                maxStorageGB: 1
            },
            enabledModules: resolveEnabledModulesFromTemplate(registrationTemplate.key),
            enabledApps: buildEnabledAppsArray(registrationTemplate.key),
            settings: {
                ...rbacSettings
            }
        });
        await ensureDefaultCommunicationSettingsForOrganization(organization._id);
        try {
            await ensureOrgEmailPolicy(organization._id, 'TRIAL');
        } catch (policyErr) {
            console.warn('[authController] OrgEmailPolicy seed failed:', policyErr?.message || policyErr);
        }
        try {
            const { provisionFreshTenantAstra } = require('../services/ai/astraDefaultEntitlementService');
            const astraGrant = await provisionFreshTenantAstra({
                organizationId: organization._id,
                initiatedByUserId: null,
            });
            if (astraGrant?.granted) {
                console.log(`✅ Astra starter tokens granted: ${astraGrant.tokens}`);
            } else if (astraGrant?.reason) {
                console.warn('[authController] Astra starter grant skipped:', astraGrant.reason);
            }
        } catch (astraErr) {
            console.warn('[authController] Astra starter grant failed:', astraErr?.message || astraErr);
        }
        console.log('✅ ✅ ✅ ORGANIZATION CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', organization._id);
        console.log('   Name:', organization.name);
        console.log('   Subscription Status:', organization.subscription.status);
        console.log('   Trial End Date:', organization.subscription.trialEndDate);
        console.log('\n');

        // 1.5. Create Default Roles for Organization
        console.log('🔍 Step 3.5: Creating default roles...');
        let ownerRoleId = null;
        try {
            if (useRbacV2Seed) {
                const { seedRolesAndProfilesForOrganization } = require('../services/roleSeedService');
                const seedResult = await seedRolesAndProfilesForOrganization(organization._id, organization);
                ownerRoleId = seedResult.roleIds?.owner || null;
                console.log('✅ RBAC v2 roles seeded:', seedResult.roles.created.length, 'roles');
                seedResult.roles.created.forEach((role) => {
                    console.log(`   - ${role.name} (Level ${role.level})`);
                });
            } else {
                const roles = await Role.createDefaultRoles(organization._id);
                ownerRoleId = roles.find((r) => r.name === 'Owner')?._id || null;
                console.log('✅ Default roles created:', roles.length, 'roles');
                roles.forEach(role => {
                    console.log(`   - ${role.name} (Level ${role.level})`);
                });
            }
        } catch (roleError) {
            console.warn('⚠️  Failed to create default roles:', roleError.message);
        }
        console.log('\n');

        try {
            const presetResult = await applyVerticalPresets(organization._id, registrationTemplate.key);
            if (presetResult.applied) {
                console.log(`✅ Vertical presets applied: ${registrationTemplate.key}`);
            }
        } catch (presetError) {
            console.warn('⚠️  Failed to apply vertical presets:', presetError.message);
        }
        console.log('\n');

        // 2. Hash Password
        console.log('🔍 Step 4: Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('✅ Password hashed\n');

        // 3. Create Owner User
        console.log('🔍 Step 5: Creating owner user...');
        console.log('   Linking to Organization ID:', organization._id);
        const registrationAppKeys = resolveEnabledAppsForTemplate(registrationTemplate.key);
        const user = await User.create({
            organizationId: organization._id,
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            vertical,
            role: 'owner',
            roleId: ownerRoleId,
            isOwner: true,
            status: 'active',
            userType: 'INTERNAL',
            appAccess: registrationAppKeys.map((appKey) => ({
                appKey,
                roleKey: 'ADMIN',
                status: 'ACTIVE',
                addedAt: new Date()
            })),
            allowedApps: registrationAppKeys
        });
        console.log('✅ ✅ ✅ USER CREATED SUCCESSFULLY! ✅ ✅ ✅');
        console.log('   ID:', user._id);
        console.log('   Email:', user.email);
        console.log('   Role:', user.role);
        console.log('   IsOwner:', user.isOwner);
        console.log('   UserType:', user.userType);
        console.log('   AppAccess:', JSON.stringify(user.appAccess));
        console.log('   Organization ID:', user.organizationId);
        console.log('\n');

        // 4. Set owner permissions
        console.log('🔍 Step 6: Setting owner permissions...');
        user.setPermissionsByRole('owner');
        user.emailVerifiedAt = new Date();
        const {
          initializeOnboardingForUser,
          ONBOARDING_ORIGINS
        } = require('../services/onboardingService');
        await initializeOnboardingForUser(user, { origin: ONBOARDING_ORIGINS.SELF_SERVE });
        await user.save();
        console.log('✅ Permissions set and user saved\n');

        try {
            const {
                bootstrapCommercialBillingForOrganization,
            } = require('../services/commercial/orgCommercialBootstrap');
            await bootstrapCommercialBillingForOrganization({
                organizationId: organization._id,
                ownerUserId: user._id,
                appAccess: user.appAccess,
                initiatedByUserId: user._id,
                claimFounder: true,
                billingCycle: 'monthly',
                trialDays: require('../constants/commercialBilling').DEFAULT_TRIAL_DAYS,
            });
            console.log('✅ Commercial Founder billing provisioned\n');
        } catch (commercialErr) {
            console.warn('[authController] Commercial billing bootstrap failed:', commercialErr?.message || commercialErr);
        }

        if (ownerRoleId) {
            await Role.findByIdAndUpdate(ownerRoleId, { $inc: { userCount: 1 } });
        }

        await UserDirectory.findOneAndUpdate(
            { email: user.email.toLowerCase() },
            {
                $set: {
                    organizationId: organization._id,
                    tenantDatabaseName: organization.database?.name || null,
                    tenantUserId: user._id,
                    status: 'active'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // 5. Respond with Token and Organization Info
        console.log('🔍 Step 7: Preparing response...');
        const response = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isOwner: user.isOwner,
            organization: {
                _id: organization._id,
                name: organization.name,
                industry: organization.industry,
                subscription: organization.subscription,
                limits: organization.limits,
                enabledApps: organization.enabledApps || [APP_KEYS.SALES], // App-level enablement
                enabledModules: organization.enabledModules, // Legacy: kept for backward compatibility
                capabilities: buildOrgCapabilities(organization)
            },
            token: generateToken(user._id, organization._id),
            onboarding: require('../services/onboardingService').buildLoginOnboardingSummary(user)
        };
        
        console.log('✅ Response prepared');
        console.log('📤 SENDING RESPONSE:');
        console.log('   - User ID:', response._id);
        console.log('   - Email:', response.email);
        console.log('   - Role:', response.role);
        console.log('   - IsOwner:', response.isOwner);
        console.log('   - Organization Name:', response.organization.name);
        console.log('   - Organization ID:', response.organization._id);
        console.log('========================================\n\n');
        
        res.status(201).json(response);
        
    } catch (error) {
        console.error('\n\n❌❌❌ REGISTRATION ERROR ❌❌❌');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        console.error('========================================\n\n');
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({ 
                message: 'User already exists with this email or username.' 
            });
        }
        
        res.status(500).json({ 
            message: 'Server error during registration.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --- 2. Login Logic ---
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const normalizedEmail = String(email || '').toLowerCase().trim();
        console.log('\n🔐 Login attempt for:', email);
        
        // 1. Find User by Email (check master database first)
        const orgLoginSelect = 'name industry subscription limits enabledApps enabledModules settings isActive database security';
        let user = await User.findOne({ email: normalizedEmail })
            .populate('organizationId', orgLoginSelect)
            .populate(
                'roleId',
                'name description color icon level permissions canViewAllData canManageTeam canExportData isSystemRole'
            );

        let organizationFromDirectory = null;
        // Fallback: resolve organization from master user directory when user is tenant-only
        if (!user) {
            const directoryEntry = await UserDirectory.findOne({ email: normalizedEmail, status: 'active' })
                .populate('organizationId', orgLoginSelect);
            if (directoryEntry?.organizationId) {
                organizationFromDirectory = directoryEntry.organizationId;
            }
        }

        // Legacy fallback for tenants converted before directory support:
        // search tenant databases by email and auto-heal directory entry.
        if (!user && !organizationFromDirectory) {
            const dbConnectionManager = require('../utils/databaseConnectionManager');
            const tenantOrgs = await Organization.find({
                'database.initialized': true,
                'database.name': { $exists: true, $ne: null }
            }).select('_id name industry subscription limits enabledApps enabledModules settings isActive database security');

            for (const tenantOrg of tenantOrgs) {
                try {
                    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(tenantOrg.database.name);
                    const OrgUser = getOrgUserModel(orgDbConnection);
                    const discoveredUser = await OrgUser.findOne({ email: normalizedEmail }).select('_id');
                    if (discoveredUser) {
                        organizationFromDirectory = tenantOrg;
                        await UserDirectory.findOneAndUpdate(
                            { email: normalizedEmail },
                            {
                                $set: {
                                    organizationId: tenantOrg._id,
                                    tenantDatabaseName: tenantOrg.database.name,
                                    tenantUserId: discoveredUser._id,
                                    status: 'active'
                                }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                        console.log('✅ Auto-healed user directory from tenant discovery:', normalizedEmail);
                        break;
                    }
                } catch (discoveryError) {
                    console.warn(`[Auth] Tenant discovery skipped for ${tenantOrg.database?.name}:`, discoveryError.message);
                }
            }
        }

        if (!user) {
            if (!organizationFromDirectory) {
                console.log('❌ User not found');
                // Log failed login attempt
                securityLogger.logAuthEvent('LOGIN_FAILED', {
                    email: normalizedEmail,
                    reason: 'USER_NOT_FOUND',
                    ip: req.ip,
                    userAgent: req.get('user-agent')
                });
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
        }

        if (user) {
            console.log('✅ User found:', user.email);
            console.log('   Organization populated?', !!user.organizationId);
            console.log('   Organization ID:', user.organizationId?._id || 'NOT POPULATED');
            console.log('   Organization has dedicated DB?', !!(user.organizationId?.database?.name));
        } else {
            console.log('✅ User resolved via directory:', normalizedEmail);
            console.log('   Organization ID:', organizationFromDirectory?._id || 'NOT POPULATED');
        }
        
        // If organization has dedicated database, get user from there
        let orgUser = user;
        const organizationForLogin = user?.organizationId || organizationFromDirectory;
        if (organizationForLogin?.database?.name && organizationForLogin.database.initialized) {
            try {
                console.log('📊 Attempting to get user from organization database:', organizationForLogin.database.name);
                const dbConnectionManager = require('../utils/databaseConnectionManager');
                const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organizationForLogin.database.name);
                
                // Get or create User model for organization database
                const OrgUser = getOrgUserModel(orgDbConnection);
                
                const orgDbUser = await OrgUser.findOne({ email: normalizedEmail });
                
                if (orgDbUser) {
                    orgUser = orgDbUser;
                    console.log('✅ User found in organization database');
                } else {
                    console.log('⚠️  User not found in organization database, using master DB user');
                }
            } catch (orgDbError) {
                console.error('❌ Error accessing organization database:', orgDbError.message);
                console.error('❌ Falling back to master database user');
                // Continue with master database user
                orgUser = user;
            }
        }

        if (!orgUser) {
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: normalizedEmail,
                reason: 'USER_NOT_FOUND_IN_TENANT_DB',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        console.log('   Role populated?', !!orgUser.roleId);
        console.log('   Role:', orgUser.roleId?.name || orgUser.role);

        // 2. Check password (use orgUser if available, otherwise master user)
        const passwordToCheck = orgUser?.password || user?.password;
        const isPasswordMatch = await bcrypt.compare(password, passwordToCheck);
        
        if (!isPasswordMatch) {
            // Log failed login attempt (wrong password)
            securityLogger.logAuthEvent('LOGIN_FAILED', {
                email: normalizedEmail,
                userId: orgUser?._id || user?._id,
                reason: 'INVALID_PASSWORD',
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 3. Check if user is active (invited users must accept invitation first)
        if (orgUser.status === 'invited') {
            console.log('❌ User has pending invitation:', orgUser.status);
            return res.status(403).json({
                message: 'Please accept your invitation email before signing in.',
                code: 'INVITE_PENDING'
            });
        }

        if (orgUser.status !== 'active') {
            console.log('❌ User status not active:', orgUser.status);
            return res.status(403).json({ 
                message: 'Your account has been suspended. Please contact your administrator.',
                code: 'ACCOUNT_SUSPENDED'
            });
        }
        console.log('✅ User status: active');

        // Grandfather legacy users; keep manual-invite users unverified until they confirm email
        if (!orgUser.emailVerifiedAt && orgUser.status === 'active') {
            const pendingManualInvite = orgUser.invitedAt && !orgUser.inviteAcceptedAt && !orgUser.inviteTokenHash;
            const legacyUser = !orgUser.invitedAt;
            const acceptedViaInvite = Boolean(orgUser.inviteAcceptedAt);

            if (legacyUser || acceptedViaInvite) {
                orgUser.emailVerifiedAt = orgUser.lastLogin || orgUser.createdAt || new Date();
            }
        }

        // 4. Check if organization exists and is populated
        if (!organizationForLogin) {
            console.log('❌ Organization not found for user');
            return res.status(500).json({ 
                message: 'Organization data not found. Please contact support.',
                code: 'ORG_NOT_FOUND'
            });
        }
        console.log('✅ Organization found:', organizationForLogin.name);
        
        // 5. Check if organization is active
        if (!organizationForLogin.isActive) {
            console.log('❌ Organization not active:', organizationForLogin.isActive);
            return res.status(403).json({ 
                message: 'Your organization account is inactive. Please contact support.',
                code: 'ORG_INACTIVE'
            });
        }
        console.log('✅ Organization is active');

        // 6. Last login + session payload
        orgUser.lastLogin = new Date();

        const userType = String(orgUser.userType || 'INTERNAL').toUpperCase();
        let portalSession = null;

        if (isExternalUser(orgUser) && isPortalFrameworkV1Enabled(organizationForLogin)) {
            portalSession = await resolveExternalLoginSession(orgUser, organizationForLogin);
            if (!portalSession.ok) {
                securityLogger.logAuthEvent('LOGIN_FAILED', {
                    email: normalizedEmail,
                    userId: orgUser._id,
                    organizationId: organizationForLogin._id,
                    reason: portalSession.code,
                    ip: req.ip,
                    userAgent: req.get('user-agent')
                });
                return res.status(portalSession.status || 403).json({
                    message: portalSession.message,
                    code: portalSession.code
                });
            }
        } else {
            await materializeEffectiveCRMEnvelopeOnUser(orgUser);
        }

        const {
          ensureOnboardingStarted,
          syncAutomaticCompletions
        } = require('../services/onboardingService');
        await ensureOnboardingStarted(orgUser);
        await syncAutomaticCompletions(orgUser, organizationForLogin);
        await orgUser.save();

        if (user && orgUser !== user) {
            user.lastLogin = new Date();
            await user.save();
        }

        const activePortal = portalSession?.portals?.find(
            (p) => portalSession.activeExternalRoleId
                && String(p.roleId) === String(portalSession.activeExternalRoleId)
        ) || null;

        const admission = await admitOrBlockAuthSession(
            orgUser,
            organizationForLogin,
            sessionMetaFromRequest(req)
        );
        if (!admission.ok) {
            securityLogger.logAuthEvent('LOGIN_SESSION_LIMIT', {
                email: normalizedEmail,
                userId: orgUser._id,
                organizationId: organizationForLogin._id,
                deviceClass: admission.deviceClass,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(409).json(buildSessionLimitResponse(orgUser, organizationForLogin, admission));
        }

        console.log('✅ Login successful for:', email);

        securityLogger.logAuthEvent('LOGIN_SUCCESS', {
            email: normalizedEmail,
            userId: orgUser._id,
            organizationId: organizationForLogin._id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: true
        });

        if (isExternalUser(orgUser) && portalSession?.ok) {
            await recordPortalEvent({
                organizationId: organizationForLogin._id,
                type: 'portal_login',
                description: 'External user login',
                userId: orgUser._id,
                peopleId: orgUser.peopleId || null,
                actorUserId: orgUser._id,
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                metadata: {
                    requiresPortalSelection: portalSession.requiresPortalSelection,
                    activeExternalRoleId: portalSession.activeExternalRoleId
                }
            });
        }

        const { buildTrialStatusSnapshot } = require('../services/trialExtensionService');
        const sessionPayload = await buildAuthenticatedSessionResponse(orgUser, organizationForLogin, {
            activeExternalRoleId: portalSession?.activeExternalRoleId || null,
            requiresPortalSelection: portalSession?.requiresPortalSelection === true,
            portals: portalSession?.portals || [],
            activePortal,
            markLogin: false,
            issueSession: false,
            sessionIds: {
                jti: admission.jti,
                sessionVersion: admission.sessionVersion
            }
        });
        sessionPayload.trial = buildTrialStatusSnapshot(organizationForLogin);

        res.json(sessionPayload);
        
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Return detailed error in development
        res.status(500).json({ 
            message: 'Server error during login.',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            name: error.name
        });
    }
};

exports.continueLogin = async (req, res) => {
    try {
        const challenge = verifyLoginChallenge(resolveChallengeFromRequest(req));
        if (!challenge) {
            return res.status(401).json({
                code: 'CHALLENGE_INVALID',
                message: 'Invalid or expired login challenge. Please sign in again.'
            });
        }

        const resolved = await resolveOrgUserForSessionChallenge(challenge);
        if (!resolved.ok) {
            return res.status(resolved.status).json({ message: resolved.message, code: 'CHALLENGE_INVALID' });
        }

        const { orgUser, organization } = resolved;
        let portalSession = null;
        if (isExternalUser(orgUser) && isPortalFrameworkV1Enabled(organization)) {
            portalSession = await resolveExternalLoginSession(orgUser, organization);
            if (!portalSession.ok) {
                return res.status(portalSession.status || 403).json({
                    message: portalSession.message,
                    code: portalSession.code
                });
            }
        }

        const admission = await admitOrBlockAuthSession(
            orgUser,
            organization,
            sessionMetaFromRequest(req)
        );
        if (!admission.ok) {
            return res.status(409).json(buildSessionLimitResponse(orgUser, organization, admission));
        }

        const activePortal = portalSession?.portals?.find(
            (p) => portalSession.activeExternalRoleId
                && String(p.roleId) === String(portalSession.activeExternalRoleId)
        ) || null;

        const { buildTrialStatusSnapshot } = require('../services/trialExtensionService');
        const sessionPayload = await buildAuthenticatedSessionResponse(orgUser, organization, {
            activeExternalRoleId: portalSession?.activeExternalRoleId || null,
            requiresPortalSelection: portalSession?.requiresPortalSelection === true,
            portals: portalSession?.portals || [],
            activePortal,
            markLogin: false,
            issueSession: false,
            sessionIds: {
                jti: admission.jti,
                sessionVersion: admission.sessionVersion
            }
        });
        sessionPayload.trial = buildTrialStatusSnapshot(organization);

        securityLogger.logAuthEvent('LOGIN_CONTINUE_SUCCESS', {
            email: orgUser.email,
            userId: orgUser._id,
            organizationId: organization._id,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            success: true
        });

        return res.json(sessionPayload);
    } catch (error) {
        console.error('❌ Login continue error:', error);
        return res.status(500).json({ message: 'Server error during login continue.' });
    }
};

function resolveSessionActor(req) {
    if (req.user?._id) {
        return {
            userId: req.user._id,
            organizationId: req.user.organizationId?._id || req.user.organizationId
        };
    }
    const challenge = verifyLoginChallenge(resolveChallengeFromRequest(req));
    if (!challenge) {
        return null;
    }
    return {
        userId: challenge.userId,
        organizationId: challenge.organizationId
    };
}

exports.listAuthSessions = async (req, res) => {
    try {
        const actor = resolveSessionActor(req);
        if (!actor?.userId || !actor?.organizationId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const sessions = await listActiveSessions(actor.userId, actor.organizationId);
        return res.json({
            sessions,
            limits: { ...DEVICE_CLASS_LIMITS }
        });
    } catch (error) {
        console.error('❌ List sessions error:', error);
        return res.status(500).json({ message: 'Failed to list sessions.' });
    }
};

exports.revokeAuthSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        if (!sessionId) {
            return res.status(400).json({ message: 'Session id is required.' });
        }

        const actor = resolveSessionActor(req);
        if (!actor?.userId || !actor?.organizationId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const { userId, organizationId } = actor;
        const result = await revokeSessionById(userId, organizationId, sessionId);
        if (!result.revoked) {
            return res.status(404).json({ message: 'Session not found or already signed out.' });
        }

        securityLogger.logAuthEvent('SESSION_REVOKED', {
            userId,
            organizationId,
            sessionId,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        const challenge = !req.user?._id
            ? verifyLoginChallenge(resolveChallengeFromRequest(req))
            : null;
        const deviceClass = challenge?.deviceClass
            || (req.body?.deviceClass === 'mobile' ? 'mobile' : null)
            || req.user?._sessionDeviceClass
            || 'desktop';
        const limitPayload = await listSessionsForLimitChallenge(userId, organizationId, deviceClass);
        return res.json({
            success: true,
            ...limitPayload
        });
    } catch (error) {
        console.error('❌ Revoke session error:', error);
        return res.status(500).json({ message: 'Failed to revoke session.' });
    }
};

exports.logoutUser = async (req, res) => {
    try {
        const jti = req.user?._sessionJti || null;
        const userId = req.user?._id;
        const organizationId = req.user?.organizationId?._id || req.user?.organizationId;
        if (jti && userId && organizationId) {
            await revokeSessionById(userId, organizationId, jti);
        }
        return res.json({ success: true });
    } catch (error) {
        console.error('❌ Logout error:', error);
        return res.status(500).json({ message: 'Failed to logout.' });
    }
};
