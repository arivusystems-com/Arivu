/**
 * ============================================================================
 * Tenant Database Seeder
 * ============================================================================
 *
 * Seeds a freshly-provisioned tenant database with the same baseline that
 * `arivu_master` is given on first setup:
 *
 *   - AppDefinition           (platform app catalog)
 *   - ModuleDefinition        (platform-level + system module definitions)
 *   - RelationshipDefinition  (platform relationships)
 *   - Role                    (default Owner / Admin / Manager / User / Viewer)
 *   - TenantAppConfiguration       (per-tenant app config rows)
 *   - TenantModuleConfiguration    (per-tenant module config rows)
 *
 * The seeder is idempotent: running it again only fills in what is missing.
 *
 * Source of truth for the seed data is the master MongoDB connection. Anything
 * already in master with `organizationId == null` (platform-level metadata) is
 * mirrored into the tenant DB so each tenant can read/write that metadata
 * without crossing the master boundary.
 *
 * Usage (from code):
 *   const { seedTenantDatabase } = require('./tenantSeeder');
 *   await seedTenantDatabase(orgConnection, organization);
 *
 * Usage (CLI):
 *   See server/scripts/seedTenantDatabases.js
 * ============================================================================
 */

const mongoose = require('mongoose');

// Master-side models (compiled against the default mongoose connection)
const MasterAppDefinition = require('../../models/AppDefinition');
const MasterModuleDefinition = require('../../models/ModuleDefinition');
const MasterRelationshipDefinition = require('../../models/RelationshipDefinition');
const MasterRoleModel = require('../../models/Role');
const MasterTenantAppConfiguration = require('../../models/TenantAppConfiguration');
const MasterTenantModuleConfiguration = require('../../models/TenantModuleConfiguration');

/**
 * Build a model on the given connection using the same schema as the master
 * model. Caches per-connection so we don't recompile on every call.
 */
function getTenantModel(connection, modelName, sourceModel) {
    if (!connection) {
        throw new Error('getTenantModel: connection is required');
    }
    if (!sourceModel || !sourceModel.schema) {
        throw new Error(`getTenantModel: missing source model for ${modelName}`);
    }
    if (connection.models[modelName]) {
        return connection.models[modelName];
    }

    const originalSchema = sourceModel.schema;
    const clonedSchema = new mongoose.Schema(originalSchema.obj, originalSchema.options);

    if (originalSchema.methods) {
        for (const methodName of Object.keys(originalSchema.methods)) {
            clonedSchema.methods[methodName] = originalSchema.methods[methodName];
        }
    }
    if (originalSchema.statics) {
        for (const staticName of Object.keys(originalSchema.statics)) {
            clonedSchema.statics[staticName] = originalSchema.statics[staticName];
        }
    }

    return connection.model(modelName, clonedSchema);
}

/**
 * Strip mongoose-internal fields before re-inserting a document into a
 * different database. We deliberately drop _id so the tenant DB gets fresh
 * ObjectIds and doesn't conflict on re-seed.
 */
function snapshotDoc(doc) {
    const obj = (doc && typeof doc.toObject === 'function')
        ? doc.toObject({ depopulate: true })
        : { ...(doc || {}) };

    delete obj._id;
    delete obj.__v;
    delete obj.createdAt;
    delete obj.updatedAt;
    return obj;
}

async function copyAppDefinitions(orgConnection) {
    const TenantAppDefinition = getTenantModel(orgConnection, 'AppDefinition', MasterAppDefinition);
    const masterApps = await MasterAppDefinition.find({}).lean();
    let created = 0;
    let skipped = 0;

    for (const app of masterApps) {
        const exists = await TenantAppDefinition.findOne({ appKey: app.appKey }).lean();
        if (exists) {
            skipped += 1;
            continue;
        }
        await TenantAppDefinition.create(snapshotDoc(app));
        created += 1;
    }

    return { created, skipped, total: masterApps.length };
}

async function copyPlatformModuleDefinitions(orgConnection) {
    const TenantModuleDefinition = getTenantModel(orgConnection, 'ModuleDefinition', MasterModuleDefinition);

    // Older tenant DBs were initialized with a unique index on
    // `{ organizationId: 1, key: 1 }` which conflicts with the canonical
    // `{ appKey: 1, moduleKey: 1 }` (platform) and
    // `{ organizationId: 1, appKey: 1, moduleKey: 1 }` (tenant overrides)
    // indexes used by the schema. Platform-level docs do not carry `key`
    // (only `moduleKey`), so the legacy index would refuse multiple platform
    // rows with `key: null`. Drop the legacy index before seeding.
    try {
        const indexes = await orgConnection.db.collection('moduledefinitions').indexes();
        const legacy = indexes.find((idx) => idx.name === 'organizationId_1_key_1');
        if (legacy) {
            await orgConnection.db.collection('moduledefinitions').dropIndex('organizationId_1_key_1');
        }
    } catch (_e) {
        /* index may not exist; ignore */
    }

    // Ensure schema-aligned indexes are present.
    try {
        await orgConnection.db.collection('moduledefinitions').createIndex(
            { appKey: 1, moduleKey: 1 },
            { unique: true, partialFilterExpression: { organizationId: null } }
        );
        await orgConnection.db.collection('moduledefinitions').createIndex(
            { organizationId: 1, appKey: 1, moduleKey: 1 },
            { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } }
        );
    } catch (_e) {
        /* indexes may already exist with same spec; ignore */
    }

    // Only copy platform-level definitions (no organizationId). Tenant-specific
    // overrides are seeded fresh against this tenant org id below.
    const platformDocs = await MasterModuleDefinition.find({
        $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    }).lean();

    let created = 0;
    let skipped = 0;

    for (const doc of platformDocs) {
        const exists = await TenantModuleDefinition.findOne({
            appKey: doc.appKey,
            moduleKey: doc.moduleKey,
            $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
        }).lean();

        if (exists) {
            skipped += 1;
            continue;
        }
        const payload = snapshotDoc(doc);
        payload.organizationId = null;
        await TenantModuleDefinition.create(payload);
        created += 1;
    }

    return { created, skipped, total: platformDocs.length };
}

async function copyRelationshipDefinitions(orgConnection) {
    const TenantRelationshipDefinition = getTenantModel(
        orgConnection,
        'RelationshipDefinition',
        MasterRelationshipDefinition
    );
    const masterRels = await MasterRelationshipDefinition.find({}).lean();
    let created = 0;
    let skipped = 0;

    for (const rel of masterRels) {
        const exists = await TenantRelationshipDefinition.findOne({
            relationshipKey: rel.relationshipKey
        }).lean();
        if (exists) {
            skipped += 1;
            continue;
        }
        await TenantRelationshipDefinition.create(snapshotDoc(rel));
        created += 1;
    }

    return { created, skipped, total: masterRels.length };
}

async function seedDefaultRoles(orgConnection, organization) {
    const TenantRole = getTenantModel(orgConnection, 'Role', MasterRoleModel);
    const orgId = organization._id;

    const hasStaffHierarchy = await TenantRole.exists({
        organizationId: orgId,
        name: { $in: ['Owner', 'Administrator', 'Admin'] },
    });
    if (hasStaffHierarchy) {
        return { created: 0, skipped: 1, total: 1 };
    }

        const { shouldSeedRbacV2ForNewOrganization } = require('../../utils/rbacFeatureFlags');
    if (shouldSeedRbacV2ForNewOrganization()) {
        const MasterProfileModel = require('../../models/Profile');
        const TenantProfile = getTenantModel(orgConnection, 'Profile', MasterProfileModel);
        const { seedRolesAndProfilesForOrganization } = require('../roleSeedService');
        const result = await seedRolesAndProfilesForOrganization(orgId, organization, {
            RoleModel: TenantRole,
            ProfileModel: TenantProfile
        });
        return {
            created: result.roles.created.length,
            skipped: 0,
            total: result.roles.created.length,
            rbacV2: true,
            roleIds: result.roleIds
        };
    }

    const created = await TenantRole.createDefaultRoles(orgId);
    return { created: created.length, skipped: 0, total: created.length };
}

async function seedTenantAppConfigurations(orgConnection, organization) {
    const TenantAppConfig = getTenantModel(
        orgConnection,
        'TenantAppConfiguration',
        MasterTenantAppConfiguration
    );
    const TenantAppDefinition = getTenantModel(orgConnection, 'AppDefinition', MasterAppDefinition);

    // System apps that the schema's enum accepts. Pulled from existing seed
    // script (server/scripts/seedTenantDefaults.js).
    const APP_KEY_MAP = {
        SALES: 'sales',
        AUDIT: 'audit',
        PORTAL: 'portal',
        LMS: 'lms'
    };

    const platformApps = await TenantAppDefinition.find({}).lean();
    const platformAppByKey = new Map(platformApps.map((a) => [String(a.appKey).toLowerCase(), a]));

    let created = 0;
    let skipped = 0;

    for (const [systemAppKey, platformAppKey] of Object.entries(APP_KEY_MAP)) {
        const platformApp = platformAppByKey.get(platformAppKey);
        if (!platformApp) {
            skipped += 1;
            continue;
        }

        const existing = await TenantAppConfig.findOne({
            organizationId: organization._id,
            appKey: systemAppKey
        }).lean();

        if (existing) {
            skipped += 1;
            continue;
        }

        await TenantAppConfig.create({
            organizationId: organization._id,
            appKey: systemAppKey,
            enabled: true,
            settings: {
                labelOverrides: null,
                featureToggles: null
            }
        });
        created += 1;
    }

    return { created, skipped };
}

async function seedTenantModuleConfigurations(orgConnection, organization) {
    const TenantModuleConfig = getTenantModel(
        orgConnection,
        'TenantModuleConfiguration',
        MasterTenantModuleConfiguration
    );
    const TenantModuleDefinition = getTenantModel(orgConnection, 'ModuleDefinition', MasterModuleDefinition);

    const APP_KEY_MAP = {
        SALES: 'sales',
        AUDIT: 'audit',
        PORTAL: 'portal',
        LMS: 'lms'
    };

    const platformModules = await TenantModuleDefinition.find({
        $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    }).lean();

    const modulesByAppKey = new Map();
    for (const mod of platformModules) {
        const key = String(mod.appKey || '').toLowerCase();
        if (!modulesByAppKey.has(key)) modulesByAppKey.set(key, []);
        modulesByAppKey.get(key).push(mod);
    }

    let created = 0;
    let skipped = 0;

    for (const [systemAppKey, platformAppKey] of Object.entries(APP_KEY_MAP)) {
        const appModules = modulesByAppKey.get(platformAppKey) || [];
        for (const mod of appModules) {
            const existing = await TenantModuleConfig.findOne({
                organizationId: organization._id,
                appKey: systemAppKey,
                moduleKey: mod.moduleKey
            }).lean();

            if (existing) {
                skipped += 1;
                continue;
            }

            const baseConfig = {
                organizationId: organization._id,
                appKey: systemAppKey,
                moduleKey: mod.moduleKey,
                enabled: true,
                labelOverride: null,
                peopleMode: null,
                requiredRelationships: [],
                ui: {
                    showInSidebar: true,
                    order: null
                }
            };

            if (mod.moduleKey === 'people' && platformAppKey === 'sales') {
                baseConfig.settings = {
                    peopleTypes: {
                        SALES: ['Lead', 'Contact'],
                        HELPDESK: ['Customer', 'Agent']
                    }
                };
            }

            await TenantModuleConfig.create(baseConfig);
            created += 1;
        }
    }

    return { created, skipped };
}

/**
 * Seed all baseline data into a tenant database.
 *
 * @param {mongoose.Connection} orgConnection - Mongoose connection to the tenant DB.
 * @param {object} organization - Organization document (must have _id).
 * @param {object} [options]
 * @param {boolean} [options.silent=false] - Suppress console output.
 * @returns {Promise<object>} Summary of what was seeded.
 */
async function seedTenantDatabase(orgConnection, organization, options = {}) {
    const { silent = false } = options;
    const log = (...args) => {
        if (!silent) console.log(...args);
    };

    if (!orgConnection) {
        throw new Error('seedTenantDatabase: a mongoose Connection is required');
    }
    if (!organization || !organization._id) {
        throw new Error('seedTenantDatabase: organization with _id is required');
    }
    // Mongoose 8 createConnection returns immediately; explicitly wait for it
    // to finish connecting if it's still pending.
    if (orgConnection.readyState !== 1 && typeof orgConnection.asPromise === 'function') {
        await orgConnection.asPromise();
    }
    if (orgConnection.readyState !== 1) {
        throw new Error(
            `seedTenantDatabase: tenant connection is not ready (readyState=${orgConnection.readyState})`
        );
    }

    const dbName = orgConnection.db?.databaseName || '(unknown)';
    log(`\n🌱 Seeding tenant database: ${dbName} (org=${organization._id})`);

    const summary = {
        database: dbName,
        organizationId: String(organization._id),
        appDefinitions: { created: 0, skipped: 0 },
        moduleDefinitions: { created: 0, skipped: 0 },
        relationshipDefinitions: { created: 0, skipped: 0 },
        roles: { created: 0, skipped: 0 },
        tenantAppConfigurations: { created: 0, skipped: 0 },
        tenantModuleConfigurations: { created: 0, skipped: 0 }
    };

    summary.appDefinitions = await copyAppDefinitions(orgConnection);
    log(`  ✅ AppDefinition: ${summary.appDefinitions.created} created, ${summary.appDefinitions.skipped} skipped`);

    summary.moduleDefinitions = await copyPlatformModuleDefinitions(orgConnection);
    log(`  ✅ ModuleDefinition (platform): ${summary.moduleDefinitions.created} created, ${summary.moduleDefinitions.skipped} skipped`);

    summary.relationshipDefinitions = await copyRelationshipDefinitions(orgConnection);
    log(`  ✅ RelationshipDefinition: ${summary.relationshipDefinitions.created} created, ${summary.relationshipDefinitions.skipped} skipped`);

    summary.roles = await seedDefaultRoles(orgConnection, organization);
    log(`  ✅ Role (defaults): ${summary.roles.created} created, ${summary.roles.skipped} skipped`);

    summary.tenantAppConfigurations = await seedTenantAppConfigurations(orgConnection, organization);
    log(`  ✅ TenantAppConfiguration: ${summary.tenantAppConfigurations.created} created, ${summary.tenantAppConfigurations.skipped} skipped`);

    summary.tenantModuleConfigurations = await seedTenantModuleConfigurations(orgConnection, organization);
    log(`  ✅ TenantModuleConfiguration: ${summary.tenantModuleConfigurations.created} created, ${summary.tenantModuleConfigurations.skipped} skipped`);

    try {
        const moduleNumberingService = require('../moduleNumberingService');
        summary.moduleNumbering = await moduleNumberingService.seedDefaultsForOrg(organization._id);
        log(`  ✅ ModuleNumbering: ${summary.moduleNumbering.created} created, ${summary.moduleNumbering.skipped} skipped`);
    } catch (err) {
        log(`  ⚠️ ModuleNumbering seed skipped: ${err.message}`);
        summary.moduleNumbering = { created: 0, skipped: 0, error: err.message };
    }

    log(`✅ Tenant DB seed complete: ${dbName}\n`);
    return summary;
}

module.exports = {
    seedTenantDatabase,
    // Exposed for testing / advanced callers
    copyAppDefinitions,
    copyPlatformModuleDefinitions,
    copyRelationshipDefinitions,
    seedDefaultRoles,
    seedTenantAppConfigurations,
    seedTenantModuleConfigurations
};
