/**
 * ============================================================================
 * People Resolver Controller
 * ============================================================================
 * 
 * API endpoints for People runtime contract resolvers.
 * Exposes resolver utilities to frontend for app context and type resolution.
 * 
 * ============================================================================
 */

const { resolvePeopleAppContext } = require('../utils/peopleAppContextResolver');
const { resolvePeopleTypes } = require('../utils/peopleTypeResolver');
const { resolveQuickCreateContext } = require('../utils/peopleQuickCreateContextResolver');
const { composePersonProfile, CORE_FIELD_KEYS, APP_FIELD_KEYS_BY_APP, hasAppParticipation, getAppDisplayName } = require('../utils/personProfileComposer');
const { setSalesParticipationIn, syncSalesParticipation } = require('../utils/syncSalesParticipation');
const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
const { getSalesParticipationFields, flattenPeopleForResponse } = require('./peopleController');
const { validatePeopleType } = require('../utils/tenantMetadata');
const appRegistry = require('../constants/appRegistry');
const People = require('../models/People');
const User = require('../models/User');
const {
  helpdeskTypeAliasViolation,
  peopleLegacyTopLevelTypeViolation,
} = require('../utils/warnDeprecatedPeopleTypeAlias');
const { isOptionalEmailWellFormed } = require('../utils/defaultFieldValidations');

/**
 * Resolve app context for People flows
 * POST /api/people/resolve-context
 */
exports.resolveContext = async (req, res) => {
  try {
    const { routeInfo, navigationIntent } = req.body;
    
    // Get enabled apps from organization
    // organizationId is an ObjectId, need to fetch the organization
    const Organization = require('../models/Organization');
    let enabledApps = [];
    
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        // Handle both array of strings and array of objects {appKey, status}
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }
    
    // If no enabledApps found, fall back to user's allowedApps
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }
    
    // Get user app access
    const userAppAccess = req.user?.allowedApps || 
                         req.user?.appAccess?.map(entry => entry.appKey) || 
                         [];
    
    // Resolve app context
    const result = resolvePeopleAppContext({
      routeInfo: routeInfo || {},
      navigationIntent: navigationIntent || null,
      enabledApps: Array.isArray(enabledApps) ? enabledApps : [],
      userAppAccess: Array.isArray(userAppAccess) ? userAppAccess : []
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resolving People app context:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving app context',
      error: error.message
    });
  }
};

/**
 * Resolve visible People types
 * POST /api/people/resolve-types
 */
exports.resolveTypes = async (req, res) => {
  try {
    // Get enabled apps from organization
    // organizationId is an ObjectId, need to fetch the organization
    const Organization = require('../models/Organization');
    let enabledApps = [];
    
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        // Handle both array of strings and array of objects {appKey, status}
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }
    
    // If no enabledApps found, fall back to user's allowedApps
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }
    
    // Build user permissions snapshot
    // Check if user has people.view permission in each app
    const userPermissions = {};
    const normalizedEnabledApps = Array.isArray(enabledApps) 
      ? enabledApps.map(k => k.toUpperCase()) 
      : [];
    
    // For each enabled app, check if user has people.view permission
    for (const appKey of normalizedEnabledApps) {
      const canViewPeople = req.user?.isOwner || 
                           req.user?.permissions?.people?.view ||
                           req.user?.permissions?.contacts?.view ||
                           false;
      
      userPermissions[appKey] = {
        canViewPeople: canViewPeople
      };
    }
    
    // If user is owner and no enabledApps, allow all apps from registry
    // This is a fallback for organizations that haven't set enabledApps yet
    if (req.user?.isOwner && normalizedEnabledApps.length === 0) {
      const allAppKeys = Object.keys(appRegistry);
      for (const appKey of allAppKeys) {
        userPermissions[appKey.toUpperCase()] = {
          canViewPeople: true
        };
      }
    }
    
    // Resolve types
    const result = resolvePeopleTypes({
      enabledApps: normalizedEnabledApps.length > 0 ? normalizedEnabledApps : Object.keys(appRegistry).map(k => k.toUpperCase()),
      appRegistry: appRegistry,
      userPermissions: userPermissions
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resolving People types:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving types',
      error: error.message
    });
  }
};

/**
 * Resolve Quick Create context
 * POST /api/people/resolve-quick-create
 */
exports.resolveQuickCreate = async (req, res) => {
  try {
    const { selectedType, owningApps, resolvedAppContext } = req.body;

    // Get enabled apps from organization
    const enabledApps = req.user?.organizationId?.enabledApps || 
                       req.user?.organization?.enabledApps || 
                       [];
    
    // Get user app access
    const userAppAccess = req.user?.allowedApps || 
                         req.user?.appAccess?.map(entry => entry.appKey) || 
                         [];

    // If resolvedAppContext is not provided, resolve it first
    let appContext = resolvedAppContext;
    if (!appContext) {
      const routeInfo = req.body.routeInfo || {};
      const navigationIntent = req.body.navigationIntent || null;
      
      appContext = resolvePeopleAppContext({
        routeInfo,
        navigationIntent,
        enabledApps: Array.isArray(enabledApps) ? enabledApps : [],
        userAppAccess: Array.isArray(userAppAccess) ? userAppAccess : []
      });
    }

    // Resolve quick create context
    const result = resolveQuickCreateContext({
      selectedType: selectedType || null,
      owningApps: owningApps || [],
      resolvedAppContext: appContext
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resolving Quick Create context:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving Quick Create context',
      error: error.message
    });
  }
};

/**
 * Compose Person profile with structured sections
 * GET /api/people/:id/profile
 */
exports.composeProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get person record
    const person = await People.findOne({ 
      _id: id, 
      organizationId: req.user.organizationId 
    })
    .populate('organization', 'name')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found'
      });
    }
    
    // Get enabled apps from organization
    // organizationId is an ObjectId, need to fetch the organization
    const Organization = require('../models/Organization');
    let enabledApps = [];
    
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        // Handle both array of strings and array of objects {appKey, status}
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }
    
    // If no enabledApps found, fall back to user's allowedApps
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }
    
    // Build route info from request
    // Use originalUrl to get full path, or fall back to path + query params
    const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    const routePath = req.query.routePath || fullPath;
    
    // Build query object - include appKey if provided explicitly
    const query = { ...req.query };
    if (req.query.appKey) {
      query.appKey = req.query.appKey;
    }
    
    const routeInfo = {
      path: routePath,
      name: req.query.routeName || null,
      params: { id: id },
      query: query,
      meta: {}
    };
    
    // Resolve app context
    const userAppAccess = req.user?.allowedApps || 
                         req.user?.appAccess?.map(entry => entry.appKey) || 
                         [];
    
    // Build navigationIntent from appKey query param if available
    // If no appKey in query, check person's actual participation as fallback
    let navigationIntent = null;
    if (req.query.appKey) {
      navigationIntent = {
        sourceAppKey: req.query.appKey
      };
    } else {
      // Check person's actual participation - prioritize apps where they actually participate
      // This ensures we show the correct app context even when no query param is provided
      //
      // Use participations.SALES.role (source of truth); never top-level type/lead_status/contact_status
      const { role: personType, lead_status, contact_status } = getSalesParticipationValues(person);
      const hasSalesParticipation = !!personType;
      
      console.log('[People Profile] Person participation check:', {
        personId: id,
        personType: personType,
        hasSalesParticipation,
        personRaw: {
          type: personType,
          lead_status,
          contact_status
        },
        enabledApps: enabledApps,
        userAppAccess: userAppAccess
      });
      
      if (hasSalesParticipation) {
        navigationIntent = {
          sourceAppKey: 'SALES'
        };
        console.log('[People Profile] Setting navigationIntent to SALES based on participations.SALES.role:', personType);
      }
    }
    
    const appContextResult = resolvePeopleAppContext({
      routeInfo,
      navigationIntent: navigationIntent,
      enabledApps: Array.isArray(enabledApps) ? enabledApps : [],
      userAppAccess: Array.isArray(userAppAccess) ? userAppAccess : []
    });
    
    // Override: If person participates in SALES (has role in participations), always use SALES
    const { role: resolvedPersonType } = getSalesParticipationValues(person);
    const hasSalesType = !!resolvedPersonType;
    
    if (hasSalesType) {
      const normalizedEnabledApps = enabledApps.map(k => 
        typeof k === 'string' ? k.toUpperCase() : (k?.appKey || k).toUpperCase()
      );
      if (normalizedEnabledApps.includes('SALES')) {
        appContextResult.appKey = 'SALES';
        appContextResult.confidence = 'HIGH';
        appContextResult.reason = `Person participates in SALES app (role: ${resolvedPersonType}) - using SALES context`;
        console.log('[People Profile] Overriding app context to SALES based on participations.SALES.role:', resolvedPersonType);
      } else {
        console.log('[People Profile] Person has SALES type but SALES is not enabled. Enabled apps:', normalizedEnabledApps);
      }
    }
    
    console.log('[People Profile] App context resolution result:', {
      appKey: appContextResult.appKey,
      confidence: appContextResult.confidence,
      reason: appContextResult.reason,
      candidates: appContextResult.candidates,
      signals: appContextResult.signals,
      navigationIntent: navigationIntent
    });
    
    // Build permissions snapshot
    const permissions = {
      core: {
        canView: req.user?.isOwner || 
                req.user?.permissions?.people?.view ||
                req.user?.permissions?.contacts?.view ||
                false,
        canEdit: req.user?.isOwner || 
                req.user?.permissions?.people?.edit ||
                req.user?.permissions?.contacts?.edit ||
                false
      },
      apps: {}
    };
    
    // Build app permissions
    const normalizedEnabledApps = Array.isArray(enabledApps) 
      ? enabledApps.map(k => k.toUpperCase()) 
      : [];
    
    for (const appKey of normalizedEnabledApps) {
      permissions.apps[appKey] = {
        canView: req.user?.isOwner || 
                req.user?.permissions?.people?.view ||
                req.user?.permissions?.contacts?.view ||
                false,
        canEdit: req.user?.isOwner || 
                req.user?.permissions?.people?.edit ||
                req.user?.permissions?.contacts?.edit ||
                false
      };
    }
    
    // Compose profile
    const profile = composePersonProfile({
      person,
      resolvedAppContext: appContextResult,
      enabledApps: normalizedEnabledApps,
      permissions
    });
    
    res.json({
      success: true,
      data: {
        profile,
        appContext: appContextResult
      }
    });
  } catch (error) {
    console.error('Error composing Person profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error composing profile',
      error: error.message
    });
  }
};

/**
 * Create or attach a Person with app context
 * POST /api/people/create
 * 
 * This endpoint:
 * - Creates a new Person if no duplicate exists (by email)
 * - Attaches app context to existing Person if duplicate found
 * - Only initializes fields for the selected app context
 * - Never merges app configurations
 * - Handles validation errors
 */
exports.createOrAttach = async (req, res) => {
  try {
    const { 
      appKey,           // Final resolved app key (required)
      role,             // Role for participation (e.g., 'Lead', 'Contact') - preferred
      selectedType,     // Legacy: Selected People type (e.g., 'LEAD', 'CONTACT')
      formData          // Form data with core + app-specific fields
    } = req.body;

    // Validate required inputs
    if (!appKey || typeof appKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'appKey is required',
        code: 'MISSING_APP_KEY'
      });
    }

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'formData is required',
        code: 'MISSING_FORM_DATA'
      });
    }

    const normalizedAppKey = appKey.trim().toUpperCase();
    const helpdeskViolCreate = helpdeskTypeAliasViolation(normalizedAppKey, formData);
    if (helpdeskViolCreate) {
      return res.status(helpdeskViolCreate.status).json(helpdeskViolCreate.body);
    }
    const legacyTypeCreate = peopleLegacyTopLevelTypeViolation(formData);
    if (legacyTypeCreate) {
      return res.status(legacyTypeCreate.status).json(legacyTypeCreate.body);
    }

    // SALES: sales_type; HELPDESK: helpdesk_role only (or role / selectedType on body)
    const typeInput =
      normalizedAppKey === 'HELPDESK'
        ? role ?? selectedType ?? formData?.helpdesk_role
        : role ?? selectedType ?? formData?.sales_type;
    const normalizedType = typeInput && String(typeInput).trim() ? String(typeInput).trim() : null;
    
    // Debug: Log what we received
    console.log('[createOrAttach] 📥 Request received:', {
      appKey: normalizedAppKey,
      role,
      selectedType,
      normalizedType: normalizedType,
      formDataKeys: Object.keys(formData || {})
    });

    // Get enabled apps from organization
    // Need to fetch organization to get enabledApps (req.user.organization may not be populated)
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    // Use the utility function to check if app is enabled (handles both object and string formats)
    const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
    if (!isAppEnabledForOrg(organization, normalizedAppKey)) {
      return res.status(403).json({
        success: false,
        message: `App ${normalizedAppKey} is not enabled for this organization`,
        code: 'APP_NOT_ENABLED'
      });
    }

    // Separate core fields from app-specific fields
    const coreFields = {};
    const appFields = {};

    // ObjectId fields that should not accept empty strings
    const objectIdFields = ['organization', 'organizationId', 'createdBy', 'assignedTo'];

    // Extract core fields
    CORE_FIELD_KEYS.forEach(key => {
      if (key === 'source') return;
      if (formData.hasOwnProperty(key)) {
        const value = formData[key];
        // Filter out empty strings for ObjectId fields to prevent BSON casting errors
        if (objectIdFields.includes(key)) {
          // Only include if value is not empty string, null, or undefined
          if (value !== null && value !== undefined && value !== '') {
            coreFields[key] = value;
          }
        } else {
          // For non-ObjectId fields, include all values (including empty strings for text fields)
          coreFields[key] = value;
        }
      }
    });

    if (coreFields.email !== undefined && !isOptionalEmailWellFormed(coreFields.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.',
        code: 'INVALID_EMAIL'
      });
    }

    // Extract app-specific fields for the selected app
    // ⚠️ IMPORTANT: These will only be used when ATTACHING to existing person
    // For NEW person creation, we create identity-only (no participation fields)
    const appFieldKeys = APP_FIELD_KEYS_BY_APP[normalizedAppKey] || [];
    
    // GUARDRAIL: Only extract app fields that have non-empty values
    // Empty strings, null, undefined are ignored to prevent accidental participation
    appFieldKeys.forEach(key => {
      if (formData.hasOwnProperty(key)) {
        const value = formData[key];
        // Only include non-empty values (empty strings, null, undefined are ignored)
        if (value !== null && value !== undefined && value !== '') {
          appFields[key] = value;
        }
      }
    });

    // Validate type/role if provided (SALES + HELPDESK → participations.*.role)
    // Do NOT set appFields.type - type is deprecated, use participations.SALES.role
    let validatedRole = null;
    if (normalizedType && normalizedAppKey === 'SALES') {
      const typeValidation = await validatePeopleType(req.user.organizationId, normalizedAppKey, normalizedType);
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      validatedRole = typeValidation.canonicalValue;
    } else if (normalizedType && normalizedAppKey === 'HELPDESK') {
      const typeValidation = await validatePeopleType(req.user.organizationId, normalizedAppKey, normalizedType);
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      validatedRole = typeValidation.canonicalValue;
    }
    
    // Debug: Log extracted fields
    console.log('[createOrAttach] 📋 Extracted fields:', {
      coreFieldsKeys: Object.keys(coreFields),
      appFieldsKeys: Object.keys(appFields),
      appFields: appFields,
      normalizedType: normalizedType,
      validatedRole
    });

    // Check for duplicate via Core Duplicate Engine (email Exact → attach by default)
    let existingPerson = null;
    try {
      const { evaluateDuplicates, getConfig } = require('../services/duplicates');
      const config = await getConfig(req.user.organizationId, 'people');
      if (config.enabled) {
        const result = await evaluateDuplicates({
          organizationId: req.user.organizationId,
          moduleKey: 'people',
          candidate: coreFields,
          config,
          emitEvent: true,
          triggeredBy: req.user._id,
          limit: 1,
        });
        if (result.hasMatch && result.matches[0]?.record?._id) {
          const policy = result.policy || config.apiMatchPolicy || 'attach';
          if (policy === 'reject') {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_REJECTED',
              message: 'A matching People record already exists.',
              data: { matches: result.matches },
            });
          }
          if (policy === 'warn') {
            // Still attach for createOrAttach identity flow when exact email matched;
            // warn is for generic create endpoints. Prefer attach when email exact.
            const emailExact = result.matches[0].matchedFields?.some(
              (f) => f.field === 'email' && f.matchType === 'exact'
            );
            if (!emailExact) {
              return res.status(409).json({
                success: false,
                code: 'DUPLICATE_WARNING',
                message: 'Possible duplicate People record found.',
                data: { matches: result.matches },
              });
            }
          }
          existingPerson = await People.findOne({
            _id: result.matches[0].record._id,
            organizationId: req.user.organizationId,
          });
        }
      } else if (coreFields.email) {
        existingPerson = await People.findOne({
          organizationId: req.user.organizationId,
          email: coreFields.email.toLowerCase().trim(),
        });
      }
    } catch (dupErr) {
      console.warn('[createOrAttach] duplicate engine error, falling back to email:', dupErr.message);
      if (coreFields.email) {
        existingPerson = await People.findOne({
          organizationId: req.user.organizationId,
          email: coreFields.email.toLowerCase().trim(),
        });
      }
    }

    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';

    let result;
    let wasAttached = false;

    if (existingPerson) {
      // Enforce uniqueness: Check if person already has participation in this app
      if (hasAppParticipation(existingPerson, normalizedAppKey)) {
        const appName = getAppDisplayName(normalizedAppKey);
        let currentType = null;
        if (normalizedAppKey === 'SALES') {
          currentType = getSalesParticipationValues(existingPerson).role;
        }
        
        const errorMessage = currentType 
          ? `Person already participates in ${appName} as ${currentType}. Use conversion instead.`
          : `Person already participates in ${appName}. Use conversion instead.`;
        
        return res.status(400).json({
          success: false,
          message: errorMessage,
          code: 'PARTICIPATION_EXISTS'
        });
      }
      
      // Attach app context to existing person
      const updateData = {};

      // SALES: strip role aliases + lifecycle fields from top-level $set (canonical: participations.SALES)
      const salesKeys = ['sales_type', 'lead_status', 'contact_status'];
      const appFieldsForUpdate = { ...appFields };
      let salesParticipation = null;
      if (normalizedAppKey === 'SALES') {
        salesParticipation = {
          role: validatedRole ?? getSalesParticipationValues(existingPerson).role ?? null,
          lead_status: appFields.lead_status ?? getSalesParticipationValues(existingPerson).lead_status ?? null,
          contact_status: appFields.contact_status ?? getSalesParticipationValues(existingPerson).contact_status ?? null
        };
        salesKeys.forEach(k => delete appFieldsForUpdate[k]);
      }

      // Only set app fields (excluding type/lead_status/contact_status for SALES) that are not already set
      Object.entries(appFieldsForUpdate).forEach(([key, value]) => {
        if (existingPerson[key] === undefined || existingPerson[key] === null || existingPerson[key] === '') {
          updateData[key] = value;
        }
      });

      if (normalizedAppKey === 'SALES' && salesParticipation && (salesParticipation.role ?? salesParticipation.lead_status ?? salesParticipation.contact_status)) {
        updateData.participations = setSalesParticipationIn(existingPerson.participations || {}, salesParticipation);
      }

      if (normalizedAppKey === 'HELPDESK' && validatedRole) {
        const base =
          existingPerson.participations && typeof existingPerson.participations === 'object'
            ? { ...existingPerson.participations }
            : {};
        base.HELPDESK = { role: validatedRole };
        updateData.participations = base;
      }

      // Update core fields if provided (but don't overwrite existing non-empty values)
      Object.entries(coreFields).forEach(([key, value]) => {
        if (key === 'source') return;
        if (['organizationId', 'createdBy', 'assignedTo'].includes(key)) return;
        if (objectIdFields.includes(key) && (value === '' || value === null || value === undefined)) return;
        if (!existingPerson[key] || existingPerson[key] === '') {
          updateData[key] = value;
        }
      });

      if (Object.keys(updateData).length > 0) {
        const attachedFieldKeys = Object.keys(updateData);
        const appDisplay = getAppDisplayName(normalizedAppKey);
        const roleForMsg = validatedRole || normalizedType || null;
        const activityEntry = {
          user: userName,
          userId: req.user._id,
          action: 'participation_attached',
          message: roleForMsg
            ? `Joined ${appDisplay} as ${roleForMsg}`
            : `Joined ${appDisplay}`,
          details: {
            appKey: normalizedAppKey,
            type: 'attach',
            participationType: roleForMsg,
            attachedFields: attachedFieldKeys
          },
          appContext: normalizedAppKey,
          timestamp: new Date()
        };

        result = await People.findOneAndUpdate(
          { _id: existingPerson._id, organizationId: req.user.organizationId },
          { $set: updateData, $push: { activityLogs: activityEntry } },
          { new: true, runValidators: true }
        );
      } else {
        result = existingPerson;
      }

      wasAttached = true;
    } else {
      // Create new person - IDENTITY ONLY (no participation fields)
      // ⚠️ IMPORTANT: Person creation is identity-only and app-agnostic.
      //    Participation fields (type, lead_status, etc.) are NOT set here.
      //    They will be set via Attach-to-App flow after creation.
      
      // GUARDRAIL: Explicitly exclude any participation fields that might have leaked into coreFields
      // This is a defensive measure to ensure identity-only creation
      const participationFields = getSalesParticipationFields();
      const sanitizedCoreFields = { ...coreFields };
      participationFields.forEach(field => {
        if (sanitizedCoreFields.hasOwnProperty(field)) {
          console.warn(`[createOrAttach] ⚠️ Participation field "${field}" detected in coreFields and stripped`);
          delete sanitizedCoreFields[field];
        }
      });
      
      delete sanitizedCoreFields.source;

      const { assignResolvedSource } = require('../services/sourceResolver');
      const newPersonData = {
        ...sanitizedCoreFields,
        // Do NOT include appFields here - identity-only creation
        // appFields will be set via Attach-to-App after creation
        organizationId: req.user.organizationId,
        createdBy: req.user._id,
        assignedTo: req.user._id, // Default to creator
        activityLogs: [{
          user: userName,
          userId: req.user._id,
          action: 'record_created',
          message: 'Created this person',
          details: {
            type: 'create',
            appKey: normalizedAppKey,
            peopleType: normalizedType
          },
          appContext: normalizedAppKey,
          timestamp: new Date()
        }]
      };

      assignResolvedSource(newPersonData, 'ui');
      result = await People.create(newPersonData);
      
      // Debug: Log what was created
      console.log('[createOrAttach] ✅ Created identity-only person:', {
        personId: result._id,
        hasType: !!result.type,
        type: result.type,
        appFieldsKeys: Object.keys(appFields),
        normalizedType: normalizedType
      });
      
      // After creating identity-only person, attach app participation if type was provided
      // This makes Quick Create work: create identity + attach in one operation
      // ⚠️ IMPORTANT: Only attach if normalizedType is explicitly provided
      //    If no type selected, create identity-only (can attach later via Attach-to-App)
      if (normalizedType) {
        // Attach app participation to the newly created person
        const attachUpdateData = {};
        const salesKeys = ['sales_type', 'lead_status', 'contact_status'];

        if (normalizedAppKey === 'SALES') {
          const salesParticipation = {
            role: validatedRole ?? null,
            lead_status: appFields.lead_status ?? null,
            contact_status: appFields.contact_status ?? null
          };
          attachUpdateData.participations = setSalesParticipationIn(result.participations || {}, salesParticipation);
          Object.entries(appFields).forEach(([key, value]) => {
            if (!salesKeys.includes(key)) attachUpdateData[key] = value;
          });
        } else if (normalizedAppKey === 'HELPDESK' && validatedRole) {
          const base = result.participations && typeof result.participations === 'object' ? { ...result.participations } : {};
          base.HELPDESK = { role: validatedRole };
          attachUpdateData.participations = base;
        } else {
          Object.entries(appFields).forEach(([key, value]) => { attachUpdateData[key] = value; });
        }

        if (Object.keys(attachUpdateData).length > 0) {
          console.log('[createOrAttach] 🔗 Attaching participation fields:', Object.keys(attachUpdateData));
          const appDisplay = getAppDisplayName(normalizedAppKey);
          const roleForMsg = validatedRole || normalizedType || null;
          result = await People.findOneAndUpdate(
            { _id: result._id, organizationId: req.user.organizationId },
            {
              $set: attachUpdateData,
              $push: {
                activityLogs: {
                  user: userName,
                  userId: req.user._id,
                  action: 'participation_attached',
                  message: roleForMsg
                    ? `Joined ${appDisplay} as ${roleForMsg}`
                    : `Joined ${appDisplay}`,
                  details: {
                    type: 'attach',
                    appKey: normalizedAppKey,
                    participationType: roleForMsg,
                    attachedFields: Object.keys(attachUpdateData)
                  },
                  appContext: normalizedAppKey,
                  timestamp: new Date()
                }
              }
            },
            { new: true, runValidators: true }
          );
          
          wasAttached = true; // Mark as attached since we set participation fields
          
          // Debug: Verify attachment
          console.log('[createOrAttach] ✅ Attached participation:', {
            personId: result._id,
            type: result.type,
            hasAppParticipation: hasAppParticipation(result, normalizedAppKey)
          });
        }
      } else {
        // Debug: No type provided, person should have no participation
        console.log('[createOrAttach] ℹ️ No type provided, person created identity-only:', {
          personId: result._id,
          hasType: !!result.type,
          hasAppParticipation: hasAppParticipation(result, normalizedAppKey)
        });
      }
    }

    // Populate references
    const populated = await People.findById(result._id)
      .populate('organization', 'name')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    res.status(wasAttached ? 200 : 201).json({
      success: true,
      data: flattenPeopleForResponse(populated),
      meta: {
        wasAttached,
        appKey: normalizedAppKey,
        peopleType: normalizedType
      }
    });
  } catch (error) {
    console.error('Error creating/attaching Person:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed. Please check the fields below.',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating/attaching Person',
      error: error.message
    });
  }
};

/**
 * Attach app participation to an existing Person
 * POST /api/people/:id/attach
 * 
 * Explicitly adds app participation to an existing person without creating duplicates.
 * Only app-specific fields are set, core fields remain unchanged.
 */
exports.attachAppParticipation = async (req, res) => {
  try {
    const personId = req.params.id;
    const { appKey, role, participationType, formData } = req.body;

    // Validate required fields
    if (!appKey) {
      return res.status(400).json({
        success: false,
        message: 'appKey is required',
        code: 'MISSING_APP_KEY'
      });
    }

    const normalizedAppKey = appKey.trim().toUpperCase();

    if (formData && typeof formData === 'object') {
      const helpdeskViolAttach = helpdeskTypeAliasViolation(normalizedAppKey, formData);
      if (helpdeskViolAttach) {
        return res.status(helpdeskViolAttach.status).json(helpdeskViolAttach.body);
      }
      const legacyAttach = peopleLegacyTopLevelTypeViolation(formData);
      if (legacyAttach) {
        return res.status(legacyAttach.status).json(legacyAttach.body);
      }
    }

    // HELPDESK: helpdesk_role only (not legacy type)
    const typeValue =
      role ??
      participationType ??
      (normalizedAppKey === 'HELPDESK'
        ? formData?.helpdesk_role
        : formData?.sales_type);
    if (!typeValue || (typeof typeValue === 'string' && !typeValue.trim())) {
      return res.status(400).json({
        success: false,
        message: 'role or participationType is required',
        code: 'MISSING_ROLE_OR_PARTICIPATION_TYPE'
      });
    }
    const typeInput = typeof typeValue === 'string' ? typeValue.trim() : String(typeValue);

    // Verify app is enabled for organization
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
    if (!isAppEnabledForOrg(organization, normalizedAppKey)) {
      return res.status(403).json({
        success: false,
        message: `App ${normalizedAppKey} is not enabled for this organization`,
        code: 'APP_NOT_ENABLED'
      });
    }

    // Find the person
    const person = await People.findOne({
      _id: personId,
      organizationId: req.user.organizationId
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found',
        code: 'PERSON_NOT_FOUND'
      });
    }

    // Extract app-specific fields (needed for both participation check and field extraction)
    const { APP_FIELD_KEYS_BY_APP } = require('../utils/personProfileComposer');
    const appFieldKeys = APP_FIELD_KEYS_BY_APP[normalizedAppKey] || [];
    
    // Enforce uniqueness: Check if person already has participation in this app
    // Debug: Log person's current state
    const personAppFields = {};
    appFieldKeys.forEach(key => {
      if (person[key] !== undefined && person[key] !== null && person[key] !== '') {
        personAppFields[key] = person[key];
      }
    });
    
    const salesValues = normalizedAppKey === 'SALES' ? getSalesParticipationValues(person) : null;
    console.log('[attachAppParticipation] 🔍 Checking participation:', {
      personId: personId,
      appKey: normalizedAppKey,
      hasAppParticipation: hasAppParticipation(person, normalizedAppKey),
      personAppFields: personAppFields,
      type: salesValues?.role,
      lead_status: salesValues?.lead_status,
      contact_status: salesValues?.contact_status
    });
    
    if (hasAppParticipation(person, normalizedAppKey)) {
      const appName = getAppDisplayName(normalizedAppKey);
      // Get current participation type for better error message
      let currentType = null;
      if (normalizedAppKey === 'SALES' && salesValues?.role) {
        currentType = salesValues.role;
      } else if (normalizedAppKey === 'HELPDESK' && person.participations?.HELPDESK?.role) {
        currentType = person.participations.HELPDESK.role;
      }
      
      const errorMessage = currentType 
        ? `Person already participates in ${appName} as ${currentType}. Use conversion instead.`
        : `Person already participates in ${appName}. Use conversion instead.`;
      
      console.log('[attachAppParticipation] ❌ Participation exists:', {
        errorMessage,
        personAppFields
      });
      
      return res.status(400).json({
        success: false,
        message: errorMessage,
        code: 'PARTICIPATION_EXISTS'
      });
    }

    // Extract app-specific fields from formData
    const appFields = {};

    // Extract app-specific fields from formData if provided
    if (formData && typeof formData === 'object') {
      appFieldKeys.forEach(key => {
        if (formData.hasOwnProperty(key) && formData[key] !== null && formData[key] !== '') {
          appFields[key] = formData[key];
        }
      });
    }

    // Validate type/role for participations only (type is deprecated, never persist directly)
    let validatedRole = null;
    if (typeInput && normalizedAppKey === 'SALES') {
      const typeValidation = await validatePeopleType(req.user.organizationId, normalizedAppKey, typeInput);
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      validatedRole = typeValidation.canonicalValue;
    } else if (typeInput && normalizedAppKey === 'HELPDESK') {
      const typeValidation = await validatePeopleType(req.user.organizationId, normalizedAppKey, typeInput);
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      validatedRole = typeValidation.canonicalValue;
    }
    const normalizedType = validatedRole ?? typeInput;

    // Clean enum fields: convert empty strings to null
    const enumFields = ['lead_status', 'contact_status', 'role'];
    enumFields.forEach(field => {
      if (appFields[field] === '') {
        appFields[field] = null;
      }
    });

    // Prepare update data - SALES: role/lead_status/contact_status go to participations only (type deprecated)
    const fieldsToSet = {};
    const salesKeys = ['lead_status', 'contact_status'];
    const appFieldsForSet = normalizedAppKey === 'SALES'
      ? Object.fromEntries(Object.entries(appFields).filter(([k]) => !salesKeys.includes(k)))
      : appFields;

    Object.entries(appFieldsForSet).forEach(([key, value]) => {
      if (person[key] === undefined || person[key] === null || person[key] === '') {
        fieldsToSet[key] = value;
      }
    });

    if (normalizedAppKey === 'SALES') {
      const prevSales = getSalesParticipationValues(person);
      const salesParticipation = {
        role: validatedRole ?? prevSales.role ?? null,
        lead_status: appFields.lead_status ?? prevSales.lead_status ?? null,
        contact_status: appFields.contact_status ?? prevSales.contact_status ?? null
      };
      if (salesParticipation.role ?? salesParticipation.lead_status ?? salesParticipation.contact_status) {
        fieldsToSet.participations = setSalesParticipationIn(person.participations || {}, salesParticipation);
      }
    } else if (normalizedAppKey === 'HELPDESK' && validatedRole) {
      const base = person.participations && typeof person.participations === 'object' ? { ...person.participations } : {};
      base.HELPDESK = { role: validatedRole };
      fieldsToSet.participations = base;
    }

    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';

    const appDisplay = getAppDisplayName(normalizedAppKey);
    const attachMessage = normalizedType
      ? `Joined ${appDisplay} as ${normalizedType}`
      : `Joined ${appDisplay}`;

    const updateObject = {
      $set: fieldsToSet,
      $push: {
        activityLogs: {
          user: userName,
          userId: req.user._id,
          action: 'participation_attached',
          message: attachMessage,
          details: {
            type: 'attach',
            appKey: normalizedAppKey,
            participationType: normalizedType || null,
            attachedFields: Object.keys(fieldsToSet)
          },
          appContext: normalizedAppKey,
          timestamp: new Date()
        }
      }
    };

    // Update person with app-specific fields
    const updatedPerson = await People.findOneAndUpdate(
      { _id: personId, organizationId: req.user.organizationId },
      updateObject,
      { new: true, runValidators: true }
    );

    // Populate references
    const populated = await People.findById(updatedPerson._id)
      .populate('organization', 'name')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: flattenPeopleForResponse(populated),
      message: `Successfully added ${normalizedAppKey} participation`,
      meta: {
        appKey: normalizedAppKey,
        participationType: normalizedType
      }
    });
  } catch (error) {
    console.error('Error attaching app participation:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed. Please check the fields below.',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error attaching app participation',
      error: error.message
    });
  }
};

/**
 * Update core Person fields only
 * PUT /api/people/:id/update-core
 * 
 * Updates only core (shared) Person fields, not app-specific fields.
 * This endpoint does not require Sales app access since core fields
 * are platform-level and shared across all apps.
 */
exports.updateCore = async (req, res) => {
  try {
    const personId = req.params.id;
    const { formData } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Form data is required.'
      });
    }

    const legacyCore = peopleLegacyTopLevelTypeViolation(formData);
    if (legacyCore) {
      return res.status(legacyCore.status).json(legacyCore.body);
    }

    // Import CORE_FIELD_KEYS to filter allowed fields
    const { CORE_FIELD_KEYS } = require('../utils/personProfileComposer');

    // Find the person
    const person = await People.findOne({
      _id: personId,
      organizationId: req.user.organizationId
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found.'
      });
    }

    // Filter to only core fields (exclude system/audit fields that shouldn't be updated)
    const updatableCoreFields = CORE_FIELD_KEYS.filter(key => 
      !['organizationId', 'createdBy', 'assignedTo', 'legacyContactId', 'activityLogs', 'createdAt', 'updatedAt', 'source'].includes(key)
    );

    // Build update object with only allowed core fields
    const updateData = {};
    let hasUpdates = false;

    for (const key of updatableCoreFields) {
      if (formData.hasOwnProperty(key)) {
        // Allow null/empty values for optional fields
        updateData[key] = formData[key];
        hasUpdates = true;
      }
    }

    if (!hasUpdates) {
      return res.status(400).json({
        success: false,
        message: 'No valid core fields to update.'
      });
    }

    // Validate required fields if they're being updated
    const finalFirstName = updateData.first_name !== undefined ? updateData.first_name : person.first_name;
    const finalLastName = updateData.last_name !== undefined ? updateData.last_name : person.last_name;
    const finalEmail = updateData.email !== undefined ? updateData.email : person.email;
    
    if (!finalFirstName && !finalLastName && !finalEmail) {
      return res.status(400).json({
        success: false,
        message: 'At least one of First Name, Last Name, or Email is required.'
      });
    }

    if (updateData.email !== undefined && !isOptionalEmailWellFormed(updateData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.'
      });
    }

    // findOneAndUpdate validators resolve first_name via Query#get; merge stored first_name
    // when only last_name is sent so cross-field validation matches the DB state.
    if (
      Object.prototype.hasOwnProperty.call(updateData, 'last_name') &&
      !Object.prototype.hasOwnProperty.call(updateData, 'first_name')
    ) {
      updateData.first_name = person.first_name;
    }

    // Update the person record
    const updatedPerson = await People.findOneAndUpdate(
      { _id: personId, organizationId: req.user.organizationId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedPerson) {
      return res.status(404).json({
        success: false,
        message: 'Person not found after update.'
      });
    }

    // Add activity log entry with app context
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' : 'System';

    // Resolve app context for activity log
    const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    const routePath = req.query.routePath || fullPath;
    const routeInfo = {
      path: routePath,
      name: req.query.routeName || null,
      params: { id: personId },
      query: req.query,
      meta: {}
    };
    
    // Get enabled apps
    const Organization = require('../models/Organization');
    let enabledApps = [];
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }
    
    const userAppAccess = req.user?.allowedApps || [];
    const appContextResult = resolvePeopleAppContext({
      routeInfo,
      navigationIntent: req.query.appKey ? { sourceAppKey: req.query.appKey } : null,
      enabledApps: enabledApps,
      userAppAccess: userAppAccess
    });

    updatedPerson.activityLogs.push({
      user: userName,
      userId: req.user._id,
      action: 'updated core information',
      details: { updatedFields: Object.keys(updateData) },
      appContext: appContextResult.appKey, // Include app context
      timestamp: new Date()
    });

    await updatedPerson.save({ runValidators: true });

    res.json({
      success: true,
      message: 'Core information updated successfully.',
      data: flattenPeopleForResponse(updatedPerson)
    });
  } catch (error) {
    console.error('Error updating core Person fields:', error);
    if (error.name === 'ValidationError') {
      const errors = {};
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating core information',
      error: error.message
    });
  }
};

/**
 * Update app-specific Person fields only
 * PUT /api/people/:id/update-app-fields
 * 
 * Updates only app-specific fields for a given app context.
 * This endpoint requires the app to be enabled and user to have edit permissions.
 */
exports.updateAppFields = async (req, res) => {
  try {
    const personId = req.params.id;
    const { appKey, formData } = req.body;

    if (!appKey || !formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'App key and form data are required.'
      });
    }

    // Normalize app key
    const normalizedAppKey = appKey.toUpperCase();

    const helpdeskViolApp = helpdeskTypeAliasViolation(normalizedAppKey, formData);
    if (helpdeskViolApp) {
      return res.status(helpdeskViolApp.status).json(helpdeskViolApp.body);
    }
    const legacyAppFields = peopleLegacyTopLevelTypeViolation(formData);
    if (legacyAppFields) {
      return res.status(legacyAppFields.status).json(legacyAppFields.body);
    }

    // Import APP_FIELD_KEYS_BY_APP to filter allowed fields
    const { APP_FIELD_KEYS_BY_APP } = require('../utils/personProfileComposer');

    const allowedFields = APP_FIELD_KEYS_BY_APP[normalizedAppKey] || [];
    const isRoleOnlyParticipationApp = normalizedAppKey === 'HELPDESK';
    if (!isRoleOnlyParticipationApp && (!Array.isArray(allowedFields) || allowedFields.length === 0)) {
      return res.status(400).json({
        success: false,
        message: `No app-specific fields defined for app: ${normalizedAppKey}`
      });
    }

    // Find the person
    const person = await People.findOne({
      _id: personId,
      organizationId: req.user.organizationId
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found.'
      });
    }

    // Verify app is enabled for organization
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
    if (!organization?.enabledApps) {
      return res.status(403).json({
        success: false,
        message: 'Organization apps not configured.'
      });
    }

    const enabledApps = organization.enabledApps.map(app => {
      return typeof app === 'object' && app.appKey ? app.appKey.toUpperCase() : app.toUpperCase();
    });

    if (!enabledApps.includes(normalizedAppKey)) {
      return res.status(403).json({
        success: false,
        message: `App ${normalizedAppKey} is not enabled for this organization.`
      });
    }

    // Build update object - SALES: role/lead_status/contact_status go to participations only
    const updateData = {};
    const salesKeys = ['lead_status', 'contact_status'];
    let hasUpdates = false;

    // Map sales_type / helpdesk_role → participations.*.role; never persist top-level aliases
    let roleFromType = null;
    const roleCandidate =
      normalizedAppKey === 'SALES'
        ? formData.sales_type
        : normalizedAppKey === 'HELPDESK'
          ? formData.helpdesk_role
          : null;
    if (roleCandidate !== undefined && roleCandidate !== null && String(roleCandidate).trim()) {
      const typeValidation = await validatePeopleType(
        req.user.organizationId,
        normalizedAppKey,
        String(roleCandidate).trim()
      );
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      roleFromType = typeValidation.canonicalValue;
      hasUpdates = true;
    }

    for (const key of allowedFields) {
      if (!formData.hasOwnProperty(key)) continue;
      updateData[key] = formData[key];
      hasUpdates = true;
    }

    if (normalizedAppKey === 'HELPDESK') {
      if (!roleFromType) {
        return res.status(400).json({
          success: false,
          message: 'Role is required (send as helpdesk_role).',
          code: 'MISSING_ROLE'
        });
      }
      const base =
        person.participations && typeof person.participations === 'object'
          ? { ...person.participations }
          : {};
      base.HELPDESK = { role: roleFromType };
      updateData.participations = base;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return res.status(400).json({
        success: false,
        message: 'No valid app-specific fields to update.'
      });
    }

    if (normalizedAppKey === 'SALES') {
      const prevSales = getSalesParticipationValues(person);
      const salesParticipation = {
        role: roleFromType ?? prevSales.role ?? null,
        lead_status: updateData.lead_status ?? prevSales.lead_status ?? null,
        contact_status: updateData.contact_status ?? prevSales.contact_status ?? null
      };
      updateData.participations = setSalesParticipationIn(person.participations || {}, salesParticipation);
      salesKeys.forEach(k => delete updateData[k]);
    }

    // Update the person record
    const updatedPerson = await People.findOneAndUpdate(
      { _id: personId, organizationId: req.user.organizationId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedPerson) {
      return res.status(404).json({
        success: false,
        message: 'Person not found after update.'
      });
    }

    // Add activity log entry with app context
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' : 'System';

    updatedPerson.activityLogs.push({
      user: userName,
      userId: req.user._id,
      action: `updated ${normalizedAppKey} app-specific fields`,
      details: { appKey: normalizedAppKey, updatedFields: Object.keys(updateData) },
      appContext: normalizedAppKey, // Include app context (already normalized)
      timestamp: new Date()
    });

    await updatedPerson.save({ runValidators: true });

    res.json({
      success: true,
      message: `${normalizedAppKey} app fields updated successfully.`,
      data: flattenPeopleForResponse(updatedPerson)
    });
  } catch (error) {
    console.error('Error updating app-specific Person fields:', error);
    if (error.name === 'ValidationError') {
      const errors = {};
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating app-specific fields',
      error: error.message
    });
  }
};

/**
 * Convert Sales Lead to Sales Contact
 * POST /api/people/:id/convert-lead-to-contact
 * 
 * Converts an existing Sales Lead participation to Sales Contact.
 * This is a same-app lifecycle change, not an attach operation.
 */
exports.convertLeadToContact = async (req, res) => {
  try {
    const personId = req.params.id;

    // Find the person
    const person = await People.findOne({
      _id: personId,
      organizationId: req.user.organizationId
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found',
        code: 'PERSON_NOT_FOUND'
      });
    }

    // Validate: Person must have Sales participation as Lead
    const { role } = getSalesParticipationValues(person);
    if (!role || role !== 'Lead') {
      return res.status(400).json({
        success: false,
        message: 'Person is not a Sales Lead. Conversion is only available for Leads.',
        code: 'INVALID_CONVERSION'
      });
    }

    // Verify Sales app is enabled for organization
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
    if (!isAppEnabledForOrg(organization, 'SALES')) {
      return res.status(403).json({
        success: false,
        message: 'Sales app is not enabled for this organization',
        code: 'APP_NOT_ENABLED'
      });
    }

    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';

    // Get formData from request body (if provided)
    const { formData } = req.body || {};
    if (formData && typeof formData === 'object') {
      const legacyConvert = peopleLegacyTopLevelTypeViolation(formData);
      if (legacyConvert) {
        return res.status(legacyConvert.status).json(legacyConvert.body);
      }
    }

    // Convert Lead to Contact - participations only for type/lead_status/contact_status
    const updateData = {
      lead_owner: null,
      lead_score: null,
      interest_products: [],
      qualification_date: null,
      qualification_notes: null,
      estimated_value: null
    };

    if (formData && typeof formData === 'object') {
      const contactFields = ['contact_status', 'role', 'birthday', 'preferred_contact_method'];
      contactFields.forEach(field => {
        if (formData.hasOwnProperty(field)) {
          const value = formData[field];
          if (value !== null && value !== undefined && value !== '') {
            updateData[field] = value;
          }
        }
      });
    }

    const { contact_status: resolvedContactStatus } = getSalesParticipationValues(person);
    const contactStatusValue = updateData.contact_status ?? resolvedContactStatus ?? 'Active';
    delete updateData.contact_status;

    updateData.participations = setSalesParticipationIn(person.participations || {}, {
      role: 'Contact',
      lead_status: null,
      contact_status: contactStatusValue
    });

    // Build activity log entry
    const activityLogEntry = {
      user: userName,
      userId: req.user._id,
      action: 'converted_sales_lead_to_contact',
      details: { 
        appKey: 'SALES',
        from: 'Lead',
        to: 'Contact',
        convertedAt: new Date()
      },
      appContext: 'SALES',
      timestamp: new Date()
    };

    // Use findOneAndUpdate with $set and $push to ensure both updates happen atomically
    const updatedPerson = await People.findOneAndUpdate(
      { _id: personId, organizationId: req.user.organizationId },
      {
        $set: updateData,
        $push: {
          activityLogs: activityLogEntry
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedPerson) {
      return res.status(404).json({
        success: false,
        message: 'Person not found after conversion',
        code: 'PERSON_NOT_FOUND'
      });
    }

    // Verify activity log was saved
    const verifyPerson = await People.findById(personId).select('activityLogs').lean();
    if (verifyPerson && verifyPerson.activityLogs) {
      const lastLog = verifyPerson.activityLogs[verifyPerson.activityLogs.length - 1];
      console.log('[Convert Lead to Contact] Activity log verification:', {
        totalLogs: verifyPerson.activityLogs.length,
        lastLogAction: lastLog?.action,
        lastLogAppContext: lastLog?.appContext,
        lastLogUser: lastLog?.user,
        lastLogTimestamp: lastLog?.timestamp
      });
    } else {
      console.error('[Convert Lead to Contact] Activity log was not saved! Person ID:', personId);
    }

    // Populate references
    const populated = await People.findById(updatedPerson._id)
      .populate('organization', 'name')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: flattenPeopleForResponse(populated),
      message: 'Successfully converted Sales Lead to Contact',
      meta: {
        appKey: 'SALES',
        from: 'Lead',
        to: 'Contact'
      }
    });
  } catch (error) {
    console.error('Error converting Lead to Contact:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed. Please check the fields below.',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error converting Lead to Contact',
      error: error.message
    });
  }
};

/**
 * Check for active child records that would block detachment
 * 
 * @param {string} personId - Person ID
 * @param {string} appKey - App key (e.g., 'SALES', 'MARKETING')
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} - Array of active child records found
 */
async function checkActiveChildRecords(personId, appKey, organizationId) {
  const activeRecords = [];
  
  try {
    // SALES app: Check for active deals
    if (appKey === 'SALES') {
      const Deal = require('../models/Deal');
      // Active deals are those not closed (not 'Won' or 'Lost' or 'Closed Won' or 'Closed Lost')
      const activeDeals = await Deal.find({
        contactId: personId,
        organizationId: organizationId,
        status: { $nin: ['Won', 'Lost'] }
      }).select('_id name status stage').limit(10).lean();
      
      if (activeDeals.length > 0) {
        activeRecords.push({
          type: 'Deal',
          count: activeDeals.length,
          records: activeDeals.map(d => ({ id: d._id, name: d.name, status: d.status }))
        });
      }
    }
    
    // MARKETING app: Check for active campaigns/activities (if applicable)
    // Future: Add marketing-specific child record checks here
    // Example:
    // if (appKey === 'MARKETING') {
    //   const Campaign = require('../models/Campaign');
    //   const activeCampaigns = await Campaign.find({
    //     contactId: personId,
    //     organizationId: organizationId,
    //     status: 'Active'
    //   }).select('_id name').limit(10).lean();
    //   if (activeCampaigns.length > 0) {
    //     activeRecords.push({
    //       type: 'Campaign',
    //       count: activeCampaigns.length,
    //       records: activeCampaigns
    //     });
    //   }
    // }
    
    // HELPDESK app: Check for open tickets (if applicable)
    // Future: Add helpdesk-specific child record checks here
    
    // PROJECTS app: Check for active project assignments (if applicable)
    // Future: Add projects-specific child record checks here
    
  } catch (error) {
    console.error('[checkActiveChildRecords] Error checking child records:', error);
    // Don't block detachment if check fails - log and continue
    // This is a guardrail, not a hard requirement
  }
  
  return activeRecords;
}

/**
 * Detach Person from App
 * POST /api/people/:id/detach
 * 
 * Removes a person's participation in a specific app.
 * This is a guarded, explicit lifecycle action.
 * 
 * ⚠️ IMPORTANT:
 * - Only allowed for apps with DETACH_POLICY.allowed === true
 * - Blocked if active child records exist
 * - Does NOT delete identity or historical records
 * - Preserves activity logs and audit history
 * - Soft detach (clears participation fields, preserves history)
 */
exports.detachFromApp = async (req, res) => {
  try {
    const personId = req.params.id;
    const { appKey } = req.body;

    if (!appKey) {
      return res.status(400).json({
        success: false,
        message: 'App key is required',
        code: 'APP_KEY_REQUIRED'
      });
    }

    const normalizedAppKey = appKey.trim().toUpperCase();

    // Validate detachment policy
    const { isDetachAllowed, getDetachReason } = require('../utils/detachPolicy');
    if (!isDetachAllowed(normalizedAppKey)) {
      const reason = getDetachReason(normalizedAppKey);
      return res.status(403).json({
        success: false,
        message: reason || `Detachment is not allowed for ${normalizedAppKey} app.`,
        code: 'DETACH_NOT_ALLOWED'
      });
    }

    // Find the person
    const person = await People.findOne({
      _id: personId,
      organizationId: req.user.organizationId
    });

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found',
        code: 'PERSON_NOT_FOUND'
      });
    }

    // Verify person has participation in this app
    const { hasAppParticipation } = require('../utils/personProfileComposer');
    if (!hasAppParticipation(person, normalizedAppKey)) {
      return res.status(400).json({
        success: false,
        message: `Person does not participate in ${normalizedAppKey} app.`,
        code: 'NO_PARTICIPATION'
      });
    }

    // GUARDRAIL: Check for active child records before allowing detachment
    // This prevents detachment when there are active dependencies
    // Backend is the final authority - even if UI hides the action
    const activeChildRecords = await checkActiveChildRecords(personId, normalizedAppKey, req.user.organizationId);
    if (activeChildRecords.length > 0) {
      const recordTypes = activeChildRecords.map(r => r.type).join(', ');
      const totalCount = activeChildRecords.reduce((sum, r) => sum + r.count, 0);
      return res.status(400).json({
        success: false,
        message: `Cannot detach: This person has ${totalCount} active ${recordTypes} record(s). Please close or reassign them first.`,
        code: 'ACTIVE_CHILD_RECORDS',
        activeRecords: activeChildRecords
      });
    }

    // Get app-specific fields to clear
    const { APP_FIELD_KEYS_BY_APP } = require('../utils/personProfileComposer');
    const appFieldKeys = APP_FIELD_KEYS_BY_APP[normalizedAppKey] || [];

    if (appFieldKeys.length === 0) {
      // No app-specific fields to clear, but still log the detachment
      console.log(`[DetachFromApp] No app-specific fields found for ${normalizedAppKey}`);
    }

    // Build update data: clear app fields; SALES: role aliases + lifecycle via participations only
    const updateData = {};
    const salesKeys = ['sales_type', 'lead_status', 'contact_status'];

    appFieldKeys.forEach(fieldKey => {
      if (normalizedAppKey === 'SALES' && salesKeys.includes(fieldKey)) return;
      updateData[fieldKey] = null;
    });

    if (normalizedAppKey === 'SALES') {
      if (appFieldKeys.includes('interest_products')) {
        updateData.interest_products = [];
      }
      updateData.participations = setSalesParticipationIn(person.participations || {}, {
        role: null,
        lead_status: null,
        contact_status: null
      });
    }

    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';

    // Build activity log entry
    const activityLogEntry = {
      user: userName,
      userId: req.user._id,
      action: 'detached_from_app',
      details: { 
        appKey: normalizedAppKey,
        detachedAt: new Date(),
        clearedFields: appFieldKeys
      },
      appContext: normalizedAppKey,
      timestamp: new Date()
    };

    // Perform soft detach: clear participation fields, preserve history
    const updatedPerson = await People.findOneAndUpdate(
      { _id: personId, organizationId: req.user.organizationId },
      {
        $set: updateData,
        $push: {
          activityLogs: activityLogEntry
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedPerson) {
      return res.status(404).json({
        success: false,
        message: 'Person not found after detachment',
        code: 'PERSON_NOT_FOUND'
      });
    }

    // Populate references
    const populated = await People.findById(updatedPerson._id)
      .populate('organization', 'name')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    console.log(`[DetachFromApp] Successfully detached person ${personId} from ${normalizedAppKey}`);

    res.status(200).json({
      success: true,
      data: flattenPeopleForResponse(populated),
      message: `Successfully detached from ${normalizedAppKey}`,
      meta: {
        appKey: normalizedAppKey,
        clearedFields: appFieldKeys
      }
    });
  } catch (error) {
    console.error('Error detaching from app:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed. Please check the fields below.',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error detaching from app',
      error: error.message
    });
  }
};

