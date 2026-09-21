/**
 * ============================================================================
 * ORGANIZATION CREATE CONTROLLER
 * ============================================================================
 * 
 * Dedicated controller for CreateOrganizationSurface.
 * 
 * ARCHITECTURAL INTENT:
 * This controller handles creation of Business Organizations ONLY.
 * 
 * MUST:
 * - Force isTenant = false
 * - Accept business fields visible for selected organization types
 * - Strip tenant/system/infrastructure fields
 * - Reject tenant-only fields if provided
 * - Return minimal organization identity (id, name, types)
 * 
 * MUST NOT:
 * - Create tenant organizations
 * - Accept subscription, billing, limits, enabledApps, or security fields
 * - Accept app-specific fields
 * - Accept system fields (createdBy, assignedTo, etc. - set by backend)
 * - Accept ownership fields
 * 
 * Reference: docs/architecture/organization-surface-invariants.md
 * ============================================================================
 */

const Organization = require('../models/Organization');
const { getOrganizationTypesConfig } = require('../utils/tenantMetadata');
const {
  filterOrganizationSubmitPayloadByTypes,
  stripBlockedOrganizationSubmitFields,
} = require('../utils/organizationTypeFieldVisibility');

const websiteHostnamePattern = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function isValidWebsite(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return true;

  const value = rawValue.trim();
  if (!value) return true;

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return websiteHostnamePattern.test(parsed.hostname);
  } catch (error) {
    return false;
  }
}

/**
 * Create Business Organization
 * POST /api/organizations
 * 
 * Payload includes business fields visible for selected organization types
 * (name required; types, status fields, and type-scoped detail fields optional).
 */
exports.create = async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get user name for activity log (if user is authenticated)
    let userName = 'System';
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id).select('firstName lastName username');
      if (user) {
        userName = (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
      }
    }
    
    const tenantOnlyFields = [
      'subscription', 'limits', 'enabledApps', 'enabledModules',
      'slug', 'settings', 'security', 'billing'
    ];

    const providedTenantFields = tenantOnlyFields.filter(field => req.body[field] !== undefined);
    if (providedTenantFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tenant-only fields are not allowed: ${providedTenantFields.join(', ')}`,
        errors: { _general: 'Tenant-only fields cannot be set when creating business organizations' }
      });
    }

    const { typeDefs } = await getOrganizationTypesConfig(req.user.organizationId);
    const {
      resolveAvailableOrganizationRoles,
    } = require('../constants/organizationParticipation');
    const {
      applyTypesWrite,
      validateOrganizationTypesForEnabledApps,
      validateOrganizationParticipations,
      resolveTenantParticipationAppKeys,
      deriveTypesFromParticipations,
    } = require('../utils/syncOrganizationParticipation');

    const enabledAppKeys = await resolveTenantParticipationAppKeys(req.user.organizationId);
    const allowedRoles = resolveAvailableOrganizationRoles(enabledAppKeys);

    const bodyParticipations =
      req.body.participations && typeof req.body.participations === 'object'
        ? req.body.participations
        : null;
    if (bodyParticipations) {
      const partGate = validateOrganizationParticipations(bodyParticipations, enabledAppKeys);
      if (!partGate.valid) {
        return res.status(400).json({
          success: false,
          message: partGate.message,
          errors: { types: partGate.message },
        });
      }
    }

    const selectedTypes = Array.isArray(req.body.types)
      ? req.body.types
      : bodyParticipations
        ? deriveTypesFromParticipations(bodyParticipations)
        : [];
    const typeGate = validateOrganizationTypesForEnabledApps(selectedTypes, allowedRoles);
    if (!typeGate.valid) {
      return res.status(400).json({
        success: false,
        message: typeGate.message,
        errors: { types: typeGate.message },
      });
    }

    const payload = filterOrganizationSubmitPayloadByTypes(
      stripBlockedOrganizationSubmitFields(req.body),
      selectedTypes,
      typeDefs
    );
    
    // Validate required field
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
        errors: { name: 'Name is required' }
      });
    }
    
    // Validate types (must be array if provided)
    if (payload.types !== undefined && !Array.isArray(payload.types)) {
      return res.status(400).json({
        success: false,
        message: 'Types must be an array',
        errors: { types: 'Types must be an array' }
      });
    }

    if (bodyParticipations && Object.keys(bodyParticipations).length > 0) {
      const types = deriveTypesFromParticipations(bodyParticipations);
      payload.types = types.length ? types : selectedTypes;
      payload.participations = bodyParticipations;
    } else if (Array.isArray(payload.types)) {
      const synced = applyTypesWrite({
        types: payload.types,
        enabledAppKeys,
        existingParticipations: {},
      });
      payload.types = synced.types;
      payload.participations = synced.participations;
    } else if (selectedTypes.length === 0) {
      // Default: Sales Customer when Sales enabled, else first allowed role
      const defaultRole = allowedRoles.includes('Customer')
        ? 'Customer'
        : allowedRoles[0] || 'Customer';
      const synced = applyTypesWrite({
        types: [defaultRole],
        enabledAppKeys,
        existingParticipations: {},
      });
      payload.types = synced.types;
      payload.participations = synced.participations;
    }

    if (payload.website !== undefined) {
      if (typeof payload.website !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Website must be a string',
          errors: { website: 'Website must be a string' }
        });
      }

      payload.website = payload.website.trim();
      if (payload.website && !isValidWebsite(payload.website)) {
        return res.status(400).json({
          success: false,
          message: 'Website must be a valid URL',
          errors: { website: 'Enter a valid website URL (e.g., example.com or https://example.org)' }
        });
      }
    }
    
    const { assignResolvedSource } = require('../services/sourceResolver');

    // Build organization body with enforced business organization settings
    const body = {
      ...payload,
      name: payload.name.trim(),
      // Force isTenant = false (business organization)
      isTenant: false,
      // Set createdBy from authenticated user
      createdBy: req.user?._id || null,
      // Default assignedTo to creator if not provided
      assignedTo: req.user?._id || null,
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user?._id || null,
        action: 'created this record',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };

    assignResolvedSource(body, 'ui');

    try {
      const { evaluateDuplicates } = require('../services/duplicates');
      const dupResult = await evaluateDuplicates({
        organizationId: req.user.organizationId,
        moduleKey: 'organizations',
        candidate: body,
        emitEvent: true,
        triggeredBy: req.user?._id,
        limit: 5,
      });
      if (dupResult.enabled && dupResult.hasMatch) {
        const policy = dupResult.policy || 'warn';
        if (policy === 'reject' || policy === 'warn') {
          return res.status(409).json({
            success: false,
            code: policy === 'reject' ? 'DUPLICATE_REJECTED' : 'DUPLICATE_WARNING',
            message: 'A matching Organization already exists.',
            errors: { name: 'An organization with this name already exists.' },
            data: { matches: dupResult.matches, policy },
          });
        }
      }
    } catch (dupErr) {
      console.warn('[organizationCreateController] duplicate check failed:', dupErr.message);
    }
    
    // Create organization
    const org = await Organization.create(body);

    // Vendor Catalog: optional payload when creating an Inventory Vendor
    if (Array.isArray(req.body.vendorCatalog) && req.body.vendorCatalog.length > 0) {
      try {
        const vendorCatalogService = require('../services/vendorCatalogService');
        const saved = await vendorCatalogService.replaceEntries({
          organizationId: req.user.organizationId,
          vendorId: org._id,
          entries: req.body.vendorCatalog,
          userId: req.user?._id || null
        });
        console.log(
          '[organizationCreateController] vendor catalog saved',
          { vendorId: String(org._id), count: Array.isArray(saved) ? saved.length : 0 }
        );
      } catch (catalogErr) {
        console.error(
          '[organizationCreateController] vendor catalog save failed',
          catalogErr?.message,
          catalogErr?.stack
        );
        // Org is created; surface warning so client can retry catalog-only save
        org._vendorCatalogError = catalogErr.message || 'Failed to save vendor catalog';
      }
    }

    try {
      if (req.user?.organizationId) {
        const { enqueueAfterPartySave } = require('../services/connectors/tally/tallyOutboxHooks');
        await enqueueAfterPartySave({
          organizationId: req.user.organizationId,
          party: org,
        });
      }
    } catch (tallyErr) {
      console.warn('[organizationCreateController] tally outbox hook failed', tallyErr?.message);
    }

    try {
      if (req.user?.organizationId) {
        const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
        const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
        const fresh = await Organization.findById(org._id);
        if (fresh) {
          await runImmediateAssignmentForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            triggerSource: 'immediate',
            changedFields: [],
            tenantOrganizationId: req.user.organizationId
          });
          await enqueueAssignmentJobsForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            changedFields: [],
            tenantOrganizationId: req.user.organizationId
          });
        }
      }
    } catch (assignErr) {
      console.error('[organizationCreateController] assignment failed:', assignErr?.message || assignErr);
    }
    
    // Return minimal organization identity (id, name, types)
    const response = {
      _id: org._id,
      id: org._id.toString(),
      name: org.name,
      types: org.types || []
    };
    if (org._vendorCatalogError) {
      response.vendorCatalogError = org._vendorCatalogError;
    }
    
    res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors || {}).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Error creating organization',
      error: error.message
    });
  }
};
