'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Organization = require('../models/Organization');
const People = require('../models/People');
const Role = require('../models/Role');
const UserDirectory = require('../models/UserDirectory');
const InstanceRegistry = require('../models/InstanceRegistry');
const { generateUniqueSlug } = require('./provisioning/utils/slugGenerator');
const { seedTenantDatabase } = require('./provisioning/tenantSeeder');
const { buildTenantFrontendUrl, buildTenantApiUrl } = require('../utils/tenantDomain');
const { resolveVerticalTemplate } = require('./onboardingVerticalTemplates');
const {
  applyVerticalPresets,
  buildEnabledAppsArray,
  mirrorModuleDefinitionsToConnection,
  resolveEnabledModulesFromTemplate,
} = require('./verticalPresetService');
const { ensureDefaultCommunicationSettingsForOrganization } = require('./communicationDefaultsSeeder');
const { ensureOrgEmailPolicy } = require('./orgEmailPolicyService');
const updateOrganizationsModuleFields = require('../scripts/updateOrganizationsModuleFields');
const updateDealsModuleFields = require('../scripts/updateDealsModuleFields');
const { buildInviteUrl } = require('../utils/userAuthTokens');

const USER_APP_KEYS = new Set(['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS', 'INVENTORY', 'MARKETING']);

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
  if (originalSchema._indexes && originalSchema._indexes.length > 0) {
    originalSchema._indexes.forEach((index) => {
      clonedSchema.index(index[0], index[1]);
    });
  }
  return connection.model(modelName, clonedSchema);
}

async function upsertMasterLeadFromDemo({
  demoRequest,
  masterOrganizationId,
  actorUserId,
}) {
  if (!demoRequest?.email || !masterOrganizationId || !actorUserId) return null;

  const normalizedEmail = String(demoRequest.email).toLowerCase().trim();
  const firstName = String(demoRequest.contactName || '').split(' ')[0] || normalizedEmail.split('@')[0] || 'Lead';
  const lastName = String(demoRequest.contactName || '').split(' ').slice(1).join(' ') || '';

  const existing = await People.findOne({
    organizationId: masterOrganizationId,
    email: normalizedEmail,
  });

  const leadFields = {
    first_name: firstName,
    last_name: lastName,
    phone: demoRequest.phone || '',
    source: 'Web Form',
    organization: demoRequest.organizationId || null,
    assignedTo: actorUserId,
    lead_owner: actorUserId,
    participations: {
      SALES: {
        role: 'Lead',
        lead_status: 'New',
      },
    },
  };

  if (existing) {
    await People.findByIdAndUpdate(existing._id, {
      $set: leadFields,
      $addToSet: {
        tags: { $each: ['demo-request', 'converted-demo'] },
      },
    });
    return existing._id;
  }

  const created = await People.create({
    organizationId: masterOrganizationId,
    createdBy: actorUserId,
    email: normalizedEmail,
    ...leadFields,
    tags: ['demo-request', 'converted-demo'],
  });

  return created._id;
}

async function provisionDemoTenant({
  demoRequest,
  industry,
  workspaceName,
  ownerPassword = null,
  actorUserId = null,
  masterOrganizationId = null,
  subscriptionTier = 'trial',
  sendActivationEmail = null,
}) {
  if (!demoRequest) {
    throw new Error('Demo request is required');
  }
  if (demoRequest.status === 'converted') {
    throw new Error('Demo request already converted');
  }

  const resolvedIndustry = String(industry || demoRequest.industry || '').trim();
  if (!resolvedIndustry) {
    throw new Error('Industry is required to provision workspace');
  }

  const companyLabel = String(workspaceName || demoRequest.companyName || 'workspace').trim();
  demoRequest.industry = resolvedIndustry;
  demoRequest.companyName = companyLabel;

  const directActivation = typeof ownerPassword === 'string' && ownerPassword.length >= 8;
  const shouldSendActivationEmail = sendActivationEmail ?? !directActivation;

  const verticalTemplate = resolveVerticalTemplate({ industry: resolvedIndustry });
  const templateEnabledApps = buildEnabledAppsArray(verticalTemplate.key, { includeOptional: true });
  const templateEnabledModules = resolveEnabledModulesFromTemplate(verticalTemplate.key);
  const isSelfServeTrial = !actorUserId && !masterOrganizationId;

  let organization = demoRequest.organizationId
    ? await Organization.findById(demoRequest.organizationId)
    : null;

  if (organization?.isTenant === true) {
    organization = organization.legacyOrganizationId
      ? await Organization.findById(organization.legacyOrganizationId)
      : null;
  }

  async function initializeCrmOrganizationShell(orgId) {
    try {
      await Role.createDefaultRoles(orgId);
    } catch (roleError) {
      console.warn('[demoProvision] Failed to create default roles:', roleError.message);
    }

    try {
      const salesInitializer = require('./salesAppInitializer');
      await salesInitializer.initializeSales(orgId);
    } catch (moduleError) {
      console.warn('[demoProvision] Failed to initialize Sales modules:', moduleError.message);
    }

    try {
      await updateOrganizationsModuleFields(orgId);
    } catch (moduleError) {
      console.warn('[demoProvision] Failed to initialize Organizations module:', moduleError.message);
    }
  }

  // CRM company shell (isTenant: false) — admin-led convert only; requires assignedTo.
  if (!organization && !isSelfServeTrial) {
    if (!actorUserId) {
      throw new Error('Actor user is required to provision demo workspace');
    }

    const slug = await generateUniqueSlug(companyLabel);
    organization = await Organization.create({
      name: companyLabel,
      slug,
      industry: resolvedIndustry,
      isActive: true,
      createdBy: actorUserId,
      assignedTo: actorUserId,
      subscription: {
        tier: 'trial',
        status: 'trial',
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      limits: {
        maxUsers: -1,
        maxContacts: -1,
        maxDeals: -1,
        maxStorageGB: -1,
      },
      settings: {
        timeZone: 'UTC',
        currency: 'USD',
      },
      enabledModules: templateEnabledModules,
      enabledApps: templateEnabledApps,
      types: [],
      customerStatus: 'Prospect',
      isTenant: false,
    });

    demoRequest.organizationId = organization._id;
    await demoRequest.save();
    await initializeCrmOrganizationShell(organization._id);
  }

  let tenantOrganization = null;
  if (organization?._id) {
    tenantOrganization = await Organization.findOne({
      legacyOrganizationId: organization._id,
      isTenant: true,
    });
  } else if (demoRequest.organizationId) {
    tenantOrganization = await Organization.findOne({
      _id: demoRequest.organizationId,
      isTenant: true,
    });
  }

  if (!tenantOrganization) {
    const tenantSlug = await generateUniqueSlug(organization?.name || companyLabel);
    const tenantPayload = {
      name: organization?.name || companyLabel,
      slug: tenantSlug,
      industry: organization?.industry || resolvedIndustry,
      isActive: true,
      isTenant: true,
      createdBy: actorUserId || null,
      assignedTo: actorUserId || null,
      subscription: {
        tier: 'trial',
        status: 'trial',
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      limits: {
        maxUsers: -1,
        maxContacts: -1,
        maxDeals: -1,
        maxStorageGB: -1,
      },
      settings: {
        timeZone: 'UTC',
        currency: 'USD',
      },
      enabledModules: templateEnabledModules,
      enabledApps: templateEnabledApps,
      types: [],
    };

    if (organization?._id) {
      tenantPayload.legacyOrganizationId = organization._id;
    }

    tenantOrganization = await Organization.create(tenantPayload);

    if (isSelfServeTrial) {
      demoRequest.organizationId = tenantOrganization._id;
      await demoRequest.save();
    }

    try {
      const { provisionFreshTenantAstra } = require('./ai/astraDefaultEntitlementService');
      await provisionFreshTenantAstra({
        organizationId: tenantOrganization._id,
        initiatedByUserId: actorUserId || null,
      });
    } catch (astraErr) {
      console.warn('[demoProvision] Astra starter grant failed:', astraErr?.message || astraErr);
    }
  }

  try {
    await ensureDefaultCommunicationSettingsForOrganization(tenantOrganization._id);
  } catch (commErr) {
    console.warn('[demoProvision] Communication defaults seed failed:', commErr?.message || commErr);
  }

  const validTiers = ['trial', 'paid'];
  const tier = validTiers.includes(subscriptionTier) ? subscriptionTier : 'trial';

  try {
    await ensureOrgEmailPolicy(tenantOrganization._id, tier === 'trial' ? 'TRIAL' : 'PRO');
  } catch (policyErr) {
    console.warn('[demoProvision] OrgEmailPolicy seed failed:', policyErr?.message || policyErr);
  }

  const activeOrgAppKeys = Array.isArray(tenantOrganization.enabledApps)
    ? tenantOrganization.enabledApps
      .map((app) => {
        if (typeof app === 'string') return app.toUpperCase();
        if (app && typeof app === 'object') {
          const status = String(app.status || 'ACTIVE').toUpperCase();
          if (status !== 'ACTIVE') return null;
          return typeof app.appKey === 'string' ? app.appKey.toUpperCase() : null;
        }
        return null;
      })
      .filter((appKey) => appKey && USER_APP_KEYS.has(appKey))
    : [];
  if (activeOrgAppKeys.length === 0) {
    activeOrgAppKeys.push('SALES');
  }

  const dbName = tenantOrganization.slug
    ? `arivu_${tenantOrganization.slug.replace(/-/g, '_')}`
    : `arivu_${tenantOrganization._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;

  const dbConnectionManager = require('../utils/databaseConnectionManager');

  try {
    await dbConnectionManager.createOrganizationDatabase(dbName);
  } catch (dbError) {
    console.warn('[demoProvision] Database creation warning:', dbError.message);
  }

  const orgDbConnection = await dbConnectionManager.getOrganizationConnection(dbName);

  if (!dbConnectionManager.baseMongoUri) {
    await dbConnectionManager.initializeMasterConnection();
  }
  const baseUri = dbConnectionManager.baseMongoUri;
  if (!baseUri) {
    throw new Error('Failed to get base MongoDB URI. Please ensure MONGO_URI is set in .env');
  }
  const connectionString = `${baseUri}/${dbName}`;

  const tierModules = tenantOrganization.getModulesForTier(tier);
  const adminModules = ['demo_requests', 'instances', 'users', 'settings'];
  const allowedModules = tierModules.filter((module) => !adminModules.includes(module));

  await Organization.findByIdAndUpdate(tenantOrganization._id, {
    'subscription.tier': tier,
    'subscription.status': tier === 'trial' ? 'trial' : 'active',
    'database.name': dbName,
    'database.connectionString': connectionString,
    'database.createdAt': new Date(),
    'database.initialized': true,
    enabledModules: allowedModules,
  });

  try {
    const moduleOrgId = organization?._id || tenantOrganization._id;
    await updateDealsModuleFields(moduleOrgId);
  } catch (moduleError) {
    console.warn('[demoProvision] Failed to refresh Deals module:', moduleError.message);
  }

  try {
    const updatedOrg = await Organization.findById(tenantOrganization._id).lean();
    await seedTenantDatabase(orgDbConnection, updatedOrg || tenantOrganization);
  } catch (seedError) {
    console.warn('[demoProvision] Failed to seed tenant DB baseline:', seedError.message);
  }

  try {
    const MasterModuleDefinition = require('../models/ModuleDefinition');
    const TenantModuleDefinition = getTenantModel(orgDbConnection, 'ModuleDefinition', MasterModuleDefinition);
    const seededDefinitions = await MasterModuleDefinition.find({ organizationId: tenantOrganization._id }).lean();
    if (seededDefinitions.length > 0) {
      for (const definition of seededDefinitions) {
        const payload = { ...definition };
        delete payload._id;
        await TenantModuleDefinition.findOneAndUpdate(
          { organizationId: tenantOrganization._id, moduleKey: definition.moduleKey || definition.key },
          { $set: payload },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  } catch (mirrorError) {
    console.warn('[demoProvision] Failed to mirror module definitions to tenant DB:', mirrorError.message);
  }

  try {
    await applyVerticalPresets(tenantOrganization._id, verticalTemplate.key);
    await mirrorModuleDefinitionsToConnection(orgDbConnection, tenantOrganization._id, getTenantModel);
  } catch (presetError) {
    console.warn('[demoProvision] Failed to apply vertical presets:', presetError.message);
  }

  tenantOrganization = await Organization.findById(tenantOrganization._id);

  let OrgUser;
  if (orgDbConnection.models.User) {
    OrgUser = orgDbConnection.models.User;
  } else {
    const UserModel = require('../models/User');
    const originalSchema = UserModel.schema;
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
    if (originalSchema._indexes && originalSchema._indexes.length > 0) {
      originalSchema._indexes.forEach((index) => {
        UserSchema.index(index[0], index[1]);
      });
    }
    OrgUser = orgDbConnection.model('User', UserSchema);
  }

  const nameParts = demoRequest.contactName ? demoRequest.contactName.split(' ') : [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const ownerEmail = demoRequest.email.toLowerCase();

  const userInviteService = require('./userInviteService');
  const {
    initializeOnboardingForUser,
    ONBOARDING_ORIGINS,
  } = require('./onboardingService');

  const inviteCredentials = directActivation ? null : userInviteService.buildInviteCredentials({});
  const inviteTokenRaw = inviteCredentials?.inviteTokenRaw || null;
  const inviteTokenHash = inviteTokenRaw ? userInviteService.hashToken(inviteTokenRaw) : null;
  const hashedPassword = directActivation
    ? await bcrypt.hash(ownerPassword, 10)
    : await bcrypt.hash(inviteCredentials.password, 10);

  const existingUser = await OrgUser.findOne({ email: ownerEmail });
  let ownerUser;

  const ownerBaseFields = {
    organizationId: tenantOrganization._id,
    role: 'owner',
    isOwner: true,
    userType: 'INTERNAL',
    mustChangePassword: false,
    allowedApps: activeOrgAppKeys,
    appAccess: activeOrgAppKeys.map((appKey) => ({
      appKey,
      roleKey: 'ADMIN',
      status: 'ACTIVE',
      addedAt: new Date(),
    })),
    invitedAt: new Date(),
    invitedBy: actorUserId || null,
  };

  if (directActivation) {
    Object.assign(ownerBaseFields, {
      status: 'active',
      password: hashedPassword,
      inviteAcceptedAt: new Date(),
      emailVerifiedAt: demoRequest.emailVerifiedAt || new Date(),
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
    });
  } else {
    Object.assign(ownerBaseFields, {
      status: inviteCredentials.initialStatus,
      password: hashedPassword,
      inviteAcceptedAt: null,
      emailVerifiedAt: null,
      inviteTokenHash,
      inviteTokenExpiresAt: inviteCredentials.inviteTokenExpiresAt,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
    });
  }

  if (existingUser) {
    Object.assign(existingUser, ownerBaseFields);
    existingUser.setPermissionsByRole('owner');
    await initializeOnboardingForUser(existingUser, {
      origin: ONBOARDING_ORIGINS.DEMO_CONVERTED,
    });
    await existingUser.save();
    ownerUser = existingUser;
  } else {
    ownerUser = await OrgUser.create({
      ...ownerBaseFields,
      username: demoRequest.email.split('@')[0] || demoRequest.contactName?.toLowerCase().replace(/\s+/g, '') || 'user',
      email: ownerEmail,
      firstName,
      lastName,
      phoneNumber: demoRequest.phone || '',
    });
    ownerUser.setPermissionsByRole('owner');
    await initializeOnboardingForUser(ownerUser, {
      origin: ONBOARDING_ORIGINS.DEMO_CONVERTED,
    });
    await ownerUser.save();
  }

  try {
    const {
      bootstrapCommercialBillingForOrganization,
    } = require('./commercial/orgCommercialBootstrap');
    await bootstrapCommercialBillingForOrganization({
      organizationId: tenantOrganization._id,
      ownerUserId: ownerUser._id,
      appAccess: ownerUser.appAccess,
      initiatedByUserId: actorUserId || ownerUser._id,
      claimFounder: true,
      billingCycle: 'monthly',
      trialDays: tier === 'trial' ? require('../constants/commercialBilling').DEFAULT_TRIAL_DAYS : 0,
    });
  } catch (commercialErr) {
    console.warn('[demoProvision] Commercial billing bootstrap failed:', commercialErr.message);
  }

  try {
    const tenantOrgDoc = await Organization.findById(tenantOrganization._id);
    const { seedSampleDataForOrganization } = require('./onboardingSampleDataService');
    await seedSampleDataForOrganization(tenantOrgDoc, ownerUser, { force: true });
  } catch (sampleError) {
    console.warn('[demoProvision] Demo sample data seed skipped:', sampleError.message);
  }

  await UserDirectory.findOneAndUpdate(
    { email: ownerEmail },
    {
      $set: {
        organizationId: tenantOrganization._id,
        tenantDatabaseName: dbName,
        tenantUserId: ownerUser._id,
        status: 'active',
        inviteTokenHash: directActivation ? null : inviteTokenHash,
        emailVerificationTokenHash: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let activationEmailSent = false;
  let activationEmailReason = null;
  if (shouldSendActivationEmail && inviteTokenRaw) {
    const activationEmailResult = await userInviteService.sendDemoWorkspaceActivationForUser({
      user: ownerUser,
      organization: tenantOrganization,
      inviteToken: inviteTokenRaw,
    });
    activationEmailSent = activationEmailResult.sent === true;
    activationEmailReason = activationEmailResult.reason || null;
  }

  let instance = await InstanceRegistry.findOne({ demoRequestId: demoRequest._id });
  if (!instance) {
    let retries = 0;
    while (!instance && retries < 5) {
      const subdomain = await generateUniqueSlug(tenantOrganization.name || companyLabel);
      try {
        instance = await InstanceRegistry.create({
          instanceName: tenantOrganization.name || companyLabel,
          subdomain,
          ownerEmail,
          ownerName: demoRequest.contactName,
          status: 'active',
          provisioningStage: 'complete',
          healthStatus: 'healthy',
          subscription: {
            tier,
            status: tier === 'trial' ? 'trial' : 'active',
            trialStartDate: tier === 'trial' ? new Date() : undefined,
            trialEndDate: tier === 'trial' ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined,
          },
          databaseConnection: {
            database: dbName,
          },
          urls: {
            frontend: buildTenantFrontendUrl(subdomain),
            api: buildTenantApiUrl(subdomain),
          },
          demoRequestId: demoRequest._id,
        });
      } catch (instanceError) {
        const duplicateSubdomainError = instanceError?.code === 11000
          && instanceError?.keyPattern
          && instanceError.keyPattern.subdomain;
        if (!duplicateSubdomainError) {
          throw instanceError;
        }
        retries += 1;
      }
    }
    if (!instance) {
      throw new Error('Failed to allocate a unique subdomain for demo request');
    }
  }

  demoRequest.status = 'converted';
  demoRequest.convertedAt = new Date();
  demoRequest.convertedToInstanceId = instance._id;

  if (masterOrganizationId && actorUserId) {
    try {
      const masterLeadId = await upsertMasterLeadFromDemo({
        demoRequest,
        masterOrganizationId,
        actorUserId,
      });
      if (masterLeadId) {
        demoRequest.contactId = masterLeadId;
      }
    } catch (leadErr) {
      console.warn('[demoProvision] Master lead upsert failed:', leadErr?.message || leadErr);
    }
  }

  await demoRequest.save();

  return {
    demoRequest,
    organization,
    tenantOrganization,
    ownerUser,
    dbName,
    instance,
    verticalTemplate,
    activationEmailSent,
    activationEmailReason,
    inviteTokenRaw,
    activationUrl: inviteTokenRaw ? buildInviteUrl(inviteTokenRaw) : null,
  };
}

module.exports = {
  provisionDemoTenant,
  upsertMasterLeadFromDemo,
  getTenantModel,
};
