#!/usr/bin/env node

/**
 * Create Default Admin Account
 * 
 * This script creates a default admin user and organization for the platform owner.
 * Run this once when setting up your Arivu instance.
 * 
 * Usage: node scripts/createDefaultAdmin.js
 *
 * Optional: DEFAULT_ADMIN_RESET_ONBOARDING=true re-opens the founder wizard
 * for an existing default admin (local testing).
 */

// Load environment variables from parent directory
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const Instance = require('../models/Instance');
const { INSTANCE_STATUS } = require('../constants/instanceLifecycle');
const { ensureDefaultCommunicationSettingsForOrganization } = require('../services/communicationDefaultsSeeder');
const { ensureOrgEmailPolicy } = require('../services/orgEmailPolicyService');
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const { resolveAdminSeedPassword } = require('../config/validateEnv');
const {
    initializeOnboardingForUser,
    ONBOARDING_ORIGINS
} = require('../services/onboardingService');
const appRegistry = require('../constants/appRegistry');
const { validateAppRole } = require('../utils/appAccessUtils');

function getRegistryAppKeys() {
    return Object.keys(appRegistry);
}

function buildDevEnabledApps() {
    const now = new Date();
    return getRegistryAppKeys().map((appKey) => ({
        appKey,
        status: 'ACTIVE',
        enabledAt: now
    }));
}

function getEnabledAppKeys(organization) {
    return (organization.enabledApps || [])
        .map((app) => (typeof app === 'string' ? app : app?.appKey))
        .filter(Boolean)
        .map((key) => String(key).toUpperCase());
}

function resolveOwnerRoleKey(appKey) {
    const config = appRegistry[appKey];
    if (!config) return 'USER';
    if (config.roles.includes('ADMIN')) return 'ADMIN';
    return config.defaultRole || 'USER';
}

async function ensureDevEnabledApps(organization) {
    const existing = new Set(getEnabledAppKeys(organization));
    let changed = false;

    for (const appKey of getRegistryAppKeys()) {
        if (existing.has(appKey)) continue;
        organization.enabledApps = Array.isArray(organization.enabledApps) ? organization.enabledApps : [];
        organization.enabledApps.push({
            appKey,
            status: 'ACTIVE',
            enabledAt: new Date()
        });
        existing.add(appKey);
        changed = true;
    }

    if (changed) {
        await organization.save();
    }

    return changed;
}

async function ensureOwnerAppAccess(adminUser, organization) {
    const enabledKeys = getEnabledAppKeys(organization);
    const existing = new Set(
        (adminUser.appAccess || [])
            .filter((entry) => entry?.status === 'ACTIVE' && entry?.appKey)
            .map((entry) => String(entry.appKey).toUpperCase())
    );

    let changed = false;
    for (const appKey of enabledKeys) {
        const config = appRegistry[appKey];
        if (config && !config.userTypesAllowed.includes('INTERNAL')) continue;
        if (existing.has(appKey)) continue;

        const roleKey = resolveOwnerRoleKey(appKey);
        if (!validateAppRole(appKey, roleKey)) continue;

        adminUser.appAccess = Array.isArray(adminUser.appAccess) ? adminUser.appAccess : [];
        adminUser.appAccess.push({
            appKey,
            roleKey,
            status: 'ACTIVE',
            addedAt: new Date()
        });
        existing.add(appKey);
        changed = true;
    }

    if (changed) {
        const internalApps = [...existing].filter((appKey) => {
            const config = appRegistry[appKey];
            return !config || config.userTypesAllowed.includes('INTERNAL');
        });
        adminUser.allowedApps = internalApps;
        await adminUser.save();
    }

    return changed;
}

function slugFromOrganizationName(name) {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function ensureDefaultAdminOnboarding(user) {
    if (!user) return false;

    const shouldReset = process.env.DEFAULT_ADMIN_RESET_ONBOARDING === 'true';
    const needsInit = !user.onboarding?.origin;

    if (!needsInit && !shouldReset) {
        return false;
    }

    if (shouldReset && user.onboarding?.origin) {
        user.onboarding.completedAt = null;
        user.onboarding.startedAt = null;
        user.onboarding.goalKey = null;
        user.onboarding.dismissedAt = null;
    }

    await initializeOnboardingForUser(user, { origin: ONBOARDING_ORIGINS.SELF_SERVE });
    await user.save();
    return true;
}

// Default Admin Credentials (use environment variables or defaults)
const DEFAULT_ADMIN = {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'hello@arivusystems.com',
    password: null,
    username: 'Arivu Admin',
    firstName: 'Arivu',
    lastName: 'Admin',
    organizationName: 'Arivu Systems',
    industry: 'Technology'
};

async function createDefaultAdmin() {
    try {
        console.log('🚀 Creating Default Admin Account...\n');
        DEFAULT_ADMIN.password = resolveAdminSeedPassword(undefined);

        console.log('🔗 Connecting to MongoDB...');
        const { masterUri, masterDbName } = getMongoUris();
        await connectMasterWithRetry(masterUri);
        console.log(`✅ Connected to MongoDB master database: ${masterDbName}`);

        const expectedSlug = slugFromOrganizationName(DEFAULT_ADMIN.organizationName);
        const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
        let organization = await Organization.findOne({
            isTenant: true,
            $or: [{ slug: expectedSlug }, { name: DEFAULT_ADMIN.organizationName }]
        });

        if (existingAdmin && organization) {
            let upgraded = false;
            if (!existingAdmin.isPlatformAdmin) {
                existingAdmin.isPlatformAdmin = true;
                await existingAdmin.save();
                upgraded = true;
            }
            const onboardingInitialized = await ensureDefaultAdminOnboarding(existingAdmin);
            const appsUpdated = await ensureDevEnabledApps(organization);
            const accessUpdated = await ensureOwnerAppAccess(existingAdmin, organization);
            console.log('⚠️  Default admin and organization already exist — nothing to create.');
            console.log(`   Email: ${DEFAULT_ADMIN.email}`);
            console.log(`   Organization: ${organization.name} (${organization._id})`);
            if (upgraded) {
                console.log('✅ Set isPlatformAdmin=true on existing default admin');
            }
            if (onboardingInitialized) {
                console.log('✅ Founder onboarding initialized — log in again to see /onboarding');
            }
            if (appsUpdated || accessUpdated) {
                console.log('✅ Ensured all dev apps are enabled for default admin');
            }
            await ensureDefaultCommunicationSettingsForOrganization(organization._id);
            try {
                await ensureOrgEmailPolicy(organization._id, 'ENTERPRISE');
            } catch (policyErr) {
                console.warn('[createDefaultAdmin] OrgEmailPolicy seed failed:', policyErr?.message || policyErr);
            }
            await mongoose.connection.close();
            return;
        }

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists but tenant organization was not found.');
            console.log(`   Email: ${DEFAULT_ADMIN.email}`);
            await mongoose.connection.close();
            return;
        }

        const adminUserId = new mongoose.Types.ObjectId();

        if (organization) {
            console.log('\n📋 Reusing existing tenant organization...');
            console.log(`   Name: ${organization.name}`);
            console.log(`   ID: ${organization._id}`);
            console.log(`   Slug: ${organization.slug || expectedSlug}`);
            if (!organization.assignedTo) {
                organization.assignedTo = adminUserId;
            }
            if (!organization.createdBy) {
                organization.createdBy = adminUserId;
            }
        } else {
            console.log('\n📋 Creating tenant organization...');
            organization = new Organization({
            name: DEFAULT_ADMIN.organizationName,
            industry: DEFAULT_ADMIN.industry,
            isActive: true,
            isTenant: true, // Mark as tenant organization (required for feature checks)
            createdBy: adminUserId,
            assignedTo: adminUserId,
            subscription: {
                status: 'active',
                tier: 'paid', // Updated to match new subscription tiers
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            },
            limits: {
                maxUsers: 999999,
                maxContacts: 999999,
                maxDeals: 999999,
                maxStorage: 999999
            },
            enabledModules: [
                'contacts',
                'deals',
                'tasks',
                'calendar',
                'reports',
                'settings',
                'users',
                'demo_requests',
                'instances'
            ],
            // Local dev master tenant: enable every registry app for full product testing.
            enabledApps: buildDevEnabledApps()
            });

            await organization.save();
            console.log('✅ Tenant organization created');
            console.log(`   Name: ${organization.name}`);
            console.log(`   ID: ${organization._id}`);
        }

        await ensureDefaultCommunicationSettingsForOrganization(organization._id);
        try {
            await ensureOrgEmailPolicy(organization._id, 'ENTERPRISE');
        } catch (policyErr) {
            console.warn('[createDefaultAdmin] OrgEmailPolicy seed failed:', policyErr?.message || policyErr);
        }

        // Create Default Roles
        console.log('\n🔐 Creating default roles...');
        try {
            const roles = await Role.createDefaultRoles(organization._id);
            console.log('✅ Default roles created:', roles.length, 'roles');
            roles.forEach(role => {
                console.log(`   - ${role.name} (Level ${role.level})`);
            });
        } catch (roleError) {
            console.warn('⚠️  Failed to create default roles:', roleError.message);
        }

        // Hash password
        console.log('\n🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

        // Create Admin User
        console.log('\n👤 Creating Admin User...');
        const { APP_KEYS } = require('../constants/appKeys');
        
        if (organization.isModified('assignedTo') || organization.isModified('createdBy')) {
            await organization.save();
        }

        await ensureDevEnabledApps(organization);
        
        // Ensure owner has Sales: ADMIN access
        const salesRoleKey = resolveOwnerRoleKey(APP_KEYS.SALES);
        if (!validateAppRole(APP_KEYS.SALES, salesRoleKey)) {
            throw new Error(`Invalid Sales roleKey: ${salesRoleKey}`);
        }

        const adminUser = new User({
            _id: adminUserId,
            username: DEFAULT_ADMIN.username,
            email: DEFAULT_ADMIN.email,
            password: hashedPassword,
            firstName: DEFAULT_ADMIN.firstName,
            lastName: DEFAULT_ADMIN.lastName,
            organizationId: organization._id,
            role: 'owner',
            isOwner: true,
            isPlatformAdmin: true,
            status: 'active',
            userType: 'INTERNAL',
            appAccess: [{
                appKey: APP_KEYS.SALES,
                roleKey: salesRoleKey, // Owner must have Sales: ADMIN
                status: 'ACTIVE',
                addedAt: new Date()
            }],
            allowedApps: [APP_KEYS.SALES] // Legacy field for backward compatibility
        });

        // Set all permissions to true for owner
        adminUser.setPermissionsByRole('owner');

        const ownerRole = await Role.findOne({ organizationId: organization._id, name: 'Owner' }).select('_id');
        if (ownerRole) {
            adminUser.roleId = ownerRole._id;
        }

        await adminUser.save();
        await ensureOwnerAppAccess(adminUser, organization);
        await ensureDefaultAdminOnboarding(adminUser);

        if (!organization.assignedTo) {
            organization.assignedTo = adminUser._id;
        }
        if (!organization.createdBy) {
            organization.createdBy = adminUser._id;
        }

        console.log('✅ Admin User created');
        console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Role: ${adminUser.role}`);

        if (ownerRole) {
            await Role.findByIdAndUpdate(ownerRole._id, { $inc: { userCount: 1 } });
        }

        // Mark this org's Instance as internal so subscriptionBootstrapService and
        // ensureOrgSubscriptionForEnabledApps permanently treat it as ENTERPRISE /
        // unlimited / ACTIVE — including for any apps enabled later. Idempotent.
        console.log('\n🏢 Marking Instance as internal (Arivu master tenant)...');
        let instance = await Instance.findOne({ organizationId: organization._id });
        if (!instance) {
            instance = await Instance.create({
                organizationId: organization._id,
                status: INSTANCE_STATUS.ACTIVE,
                isInternal: true,
                source: 'MANUAL'
            });
            console.log(`   ✅ Instance created with isInternal=true, status=${instance.status}`);
        } else if (!instance.isInternal) {
            instance.isInternal = true;
            await instance.save();
            console.log('   ✅ Instance updated with isInternal=true');
        } else {
            console.log('   ✅ Instance already marked as internal');
        }

        // Success summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 DEFAULT ADMIN ACCOUNT CREATED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n📝 LOGIN CREDENTIALS:\n');
        console.log(`   Email:    ${DEFAULT_ADMIN.email}`);
        console.log(
            process.env.NODE_ENV === 'production'
                ? '   Password: (value of DEFAULT_ADMIN_PASSWORD)'
                : `   Password: ${DEFAULT_ADMIN.password}`
        );
        console.log('\n⚠️  SECURITY WARNING:');
        console.log('   Please change this password immediately after first login!');
        console.log('   Go to Settings → Update Password\n');
        console.log('='.repeat(60));
        console.log('\n✅ You can now login at: http://localhost:5173');
        console.log('   Click "Admin Login" and use the credentials above.');
        console.log('   Founder onboarding will run on first login (/onboarding).\n');

        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');

    } catch (error) {
        console.error('\n❌ Error creating default admin:', error.message);
        console.error(error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the script
createDefaultAdmin();

