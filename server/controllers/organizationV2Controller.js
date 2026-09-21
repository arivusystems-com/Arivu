const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { buildOrganizationListMongoQuery } = require('../utils/organizationsListQuery');
const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
const { mapOrganizationToSurface } = require('../utils/mappers/mapOrganizationToSurface');
const { pickEditableOrganizationRecord } = require('../utils/organizationTypeFieldVisibility');

const websiteHostnamePattern = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

const { isMasterLikeRequest } = require('../utils/organizationsListQuery');

const ORGANIZATION_REFERENCE_FIELDS = new Set([
  'assignedTo',
  'primaryContact',
  'accountManager',
  'vendorContract',
  'logisticsPartner'
]);

function normalizeOrganizationReferenceValue(fieldValue) {
  if (fieldValue == null || fieldValue === '') return null;
  if (typeof fieldValue === 'object') {
    return fieldValue._id ?? fieldValue.id ?? null;
  }
  return fieldValue;
}

function organizationQueryAnd(baseQuery, clause) {
  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return clause;
  }
  return { $and: [baseQuery, clause] };
}

function resolveOrganizationLastActivity(record) {
  const logs = Array.isArray(record?.activityLogs) ? record.activityLogs : [];
  if (logs.length === 0) return null;

  let latest = null;
  for (const log of logs) {
    const ts = log?.timestamp ? new Date(log.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    if (latest == null || ts > latest) latest = ts;
  }

  return latest != null ? new Date(latest) : null;
}

async function resolveAccessibleCrmOrganizationQuery(req, recordId) {
  const tenantOrganizationId = req.user?.organizationId;
  if (!tenantOrganizationId) {
    return { error: { status: 400, message: 'Organization context required' } };
  }
  const { buildTenantAccessibleCrmOrganizationQuery } = require('../utils/crmOrganizationAccess');
  const query = await buildTenantAccessibleCrmOrganizationQuery(tenantOrganizationId, {
    recordIds: recordId ? [String(recordId)] : null,
    masterAccess: isMasterLikeRequest(req, req.organization)
  });
  return { query, tenantOrganizationId };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Matches client registry keys: totalOrganizations, assignedToMe, unassigned,
 * activeOrganizations, trialOrganizations.
 */
async function computeOrganizationsListStatistics(query, userId) {
  const uid =
    mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const [assignedToMe, unassigned, activeOrganizations, trialOrganizations] = await Promise.all([
    Organization.countDocuments(organizationQueryAnd(query, { assignedTo: uid })),
    Organization.countDocuments(
      organizationQueryAnd(query, {
        $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }]
      })
    ),
    Organization.countDocuments(organizationQueryAnd(query, { isActive: true })),
    Organization.countDocuments(
      organizationQueryAnd(query, {
        $or: [
          { 'subscription.tier': 'trial' },
          { 'subscription.status': 'trial' }
        ]
      })
    )
  ]);

  return {
    assignedToMe,
    unassigned,
    activeOrganizations,
    trialOrganizations
  };
}

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

// Create (Sales organization)
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
    
    const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const { applyCreateOwnerDefaults } = require('../utils/recordCreateOwnerDefaults');
    const {
      applyTypesWrite,
      validateOrganizationTypesForEnabledApps,
      resolveTenantParticipationAppKeys,
      deriveTypesFromParticipations,
      validateOrganizationParticipations,
    } = require('../utils/syncOrganizationParticipation');
    const { resolveAvailableOrganizationRoles } = require('../constants/organizationParticipation');
    const { standardPayload, customFieldsSet } = extractCustomFields(req.body, Organization);
    const payloadWithOwnerDefaults = applyCreateOwnerDefaults(standardPayload, 'organizations', req.user?._id);

    const enabledAppKeys = await resolveTenantParticipationAppKeys(req.user?.organizationId);
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
    const incomingTypes = Array.isArray(payloadWithOwnerDefaults.types)
      ? payloadWithOwnerDefaults.types
      : bodyParticipations
        ? deriveTypesFromParticipations(bodyParticipations)
        : [];
    const typeGate = validateOrganizationTypesForEnabledApps(incomingTypes, allowedRoles);
    if (!typeGate.valid) {
      return res.status(400).json({
        success: false,
        message: typeGate.message,
        errors: { types: typeGate.message },
      });
    }
    let synced;
    if (bodyParticipations && Object.keys(bodyParticipations).length > 0) {
      synced = {
        types: deriveTypesFromParticipations(bodyParticipations),
        participations: bodyParticipations,
      };
    } else {
      const typesForWrite =
        incomingTypes.length > 0
          ? incomingTypes
          : [allowedRoles.includes('Customer') ? 'Customer' : allowedRoles[0] || 'Customer'];
      synced = applyTypesWrite({
        types: typesForWrite,
        enabledAppKeys,
        existingParticipations: {},
      });
    }

    const body = {
      ...payloadWithOwnerDefaults,
      types: synced.types,
      participations: synced.participations,
      // Set createdBy from authenticated user
      createdBy: req.user?._id || null,
      // Default assignedTo to creator if not provided (similar to tasks)
      assignedTo: payloadWithOwnerDefaults.assignedTo || req.user?._id || null,
      // Mark as Sales organization (not tenant)
      isTenant: false,
      ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user?._id || null,
        action: 'created this record',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };

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
            data: { matches: dupResult.matches, policy },
          });
        }
      }
    } catch (dupErr) {
      console.warn('[organizationV2Controller.create] duplicate check failed:', dupErr.message);
    }
    
    const org = await Organization.create(body);
    
    // Compute derived status (non-blocking)
    const { computeAndSetDerivedStatus } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    await computeAndSetDerivedStatus('organization', org, appKey);
    
    // Save if derivedStatus was computed
    if (org.derivedStatus !== undefined) {
      await org.save();
    }

    try {
      const { emitOrganizationEvents } = require('../services/domainEventHelpers');
      emitOrganizationEvents({
        previous: null,
        current: org.toObject ? org.toObject() : org,
        appKey,
        triggeredBy: req.user?._id ?? null,
        organizationId: req.user?.organizationId ?? null
      });
    } catch (emitErr) {
      console.error('[organizationV2Controller] emitOrganizationEvents on create failed:', emitErr?.message || emitErr);
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const tenantOrganizationId = req.user?.organizationId;
      if (tenantOrganizationId) {
        const fresh = await Organization.findById(org._id);
        if (fresh) {
          await runImmediateAssignmentForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            triggerSource: 'immediate',
            changedFields: [],
            tenantOrganizationId
          });
          await enqueueAssignmentJobsForSalesRecord({
            record: fresh,
            moduleKey: 'organizations',
            actorId: req.user._id,
            changedFields: [],
            tenantOrganizationId
          });
        }
      }
    } catch (assignErr) {
      console.error('[organizationV2Controller] assignment on create failed:', assignErr?.message || assignErr);
    }
    
    const createdOrg = await Organization.findById(org._id);
    res.status(201).json({ success: true, data: flattenCustomFieldsForResponse(createdOrg || org) });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating organization', error: error.message });
  }
};

// List (Sales organizations only)
// CRITICAL: Filter by tenant organization context to prevent data leakage
// Sales organizations created by users from tenant org A should only be visible to users from tenant org A
exports.list = async (req, res) => {
  try {
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // Core/All Organizations lists send appKey=PLATFORM (not a registry app).
    // Prefer query so we do not fall back to SALES projection (which hides Vendor/Partner-only).
    const queryAppKey = String(req.query.appKey || '').toUpperCase();
    const appKey =
      queryAppKey === 'PLATFORM' || queryAppKey === 'ALL' || queryAppKey === 'CORE'
        ? 'PLATFORM'
        : (req.appKey || queryAppKey || 'SALES');
    const query = await buildOrganizationListMongoQuery({
      tenantOrganizationId,
      params: req.query,
      user: req.user,
      appKey
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Handle sort (multi: sortBy=a,b&sortOrder=asc,desc)
    const { parseListSort } = require('../utils/parseListSort');
    const { sortObject: sort } = parseListSort(req.query, {
      defaultField: 'createdAt',
      defaultOrder: 'desc',
      tieBreaker: '_id'
    });

    const { fetchRankedSearchPage, isSearchActive, resolveListSearchTerm, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
    const searchTerm = resolveListSearchTerm(req.query, 'organizations');
    const orgPopulate = [
      { path: 'createdBy', select: 'firstName lastName email avatar username' },
      { path: 'assignedTo', select: 'firstName lastName email avatar username' }
    ];
    const dataQuery = isSearchActive(searchTerm)
      ? fetchRankedSearchPage(Organization, {
          matchQuery: query,
          searchTerm,
          fieldSpecs: SEARCH_FIELD_PRESETS.organizations,
          skip,
          limit,
          fallbackSort: sort,
          populate: orgPopulate,
          lean: false
        })
      : Organization.find(query)
          .populate('createdBy', 'firstName lastName email avatar username')
          .populate('assignedTo', 'firstName lastName email avatar username')
          .sort(sort)
          .limit(limit)
          .skip(skip);

    const listStatisticsPromise = computeOrganizationsListStatistics(query, req.user._id);

    const [data, total, listCardBreakdown] = await Promise.all([
      dataQuery,
      Organization.countDocuments(query),
      listStatisticsPromise
    ]);
    
    // Debug logging
    const orgIds = data.map(org => ({
      _id: org._id.toString(),
      name: org.name,
      assignedTo: org.assignedTo ? (org.assignedTo._id ? org.assignedTo._id.toString() : org.assignedTo.toString()) : null
    }));
    
    console.log('[organizationV2Controller] Query result:', {
      dataLength: data.length,
      total,
      page,
      limit,
      assignedToFilter: req.query.assignedTo,
      query: JSON.stringify(query, null, 2),
      returnedOrgIds: orgIds
    });
    
    // Convert Mongoose documents to plain objects
    const plainData = data.map((doc) => {
      const flat = doc.toObject ? doc.toObject() : doc;
      return {
        ...flat,
        lastActivity: resolveOrganizationLastActivity(flat),
      };
    });
    
    const response = { 
      success: true, 
      data: plainData,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: limit
      },
      meta: { page, limit, total }, // Keep for backward compatibility
      listStatistics: {
        ...listCardBreakdown,
        totalOrganizations: total,
        myOrganizations: total
      }
    };
    
    // Debug logging - log the actual response object structure
    console.log('[organizationV2Controller] Response object:', JSON.stringify({
      success: response.success,
      dataLength: response.data.length,
      hasPagination: !!response.pagination,
      pagination: response.pagination,
      hasMeta: !!response.meta,
      meta: response.meta,
      responseKeys: Object.keys(response)
    }, null, 2));
    
    // Return response with pagination object (matching ModuleList expectations)
    res.json(response);
  } catch (error) {
    console.error('Error listing Sales organizations:', error);
    res.status(500).json({ success: false, message: 'Error fetching organizations', error: error.message });
  }
};

// Get by ID (Sales organization, filtered by tenant context)
exports.getById = async (req, res) => {
  try {
    const tenantOrganizationId = req.user?.organizationId;
    
    if (!tenantOrganizationId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }
    const org = await Organization.findOne(resolved.query);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });

    await org.populate([
      { path: 'createdBy', select: 'firstName lastName email avatar username' },
      { path: 'assignedTo', select: 'firstName lastName email avatar username' }
    ]);
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    res.json({ success: true, data: flattenCustomFieldsForResponse(org.toObject()) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organization', error: error.message });
  }
};

// Delete (Sales organization only - move to trash)
exports.remove = async (req, res) => {
  try {
    const tenantOrganizationId = req.user?.organizationId;
    if (!tenantOrganizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const User = require('../models/User');
    const currentTenantOrg = await Organization.findById(tenantOrganizationId).select('name').lean();
    const relaxOrganizationsCreatedBy = isMasterLikeRequest(req, currentTenantOrg);

    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'organizations',
      recordId: req.params.id,
      organizationId: tenantOrganizationId,
      userId: req.user._id,
      appKey: req.body?.appKey || 'SALES',
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed,
      relaxOrganizationsCreatedBy
    });

    if (!result.ok) {
      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          dependencies: result.dependencies,
          message: result.message
        });
      }
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to delete organization'
      });
    }
    res.json({ success: true, data: req.params.id, message: 'Moved to trash', retentionExpiresAt: result.retentionExpiresAt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting organization', error: error.message });
  }
};

// Get activity logs for an organization (filtered by tenant context)
exports.getActivityLogs = async (req, res) => {
  try {
    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }

    const org = await Organization.findOne(resolved.query).select('activityLogs');
    
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }
    
    // Sort by timestamp (newest first)
    const logs = (org.activityLogs || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
};

// Add activity log to an organization (filtered by tenant context)
exports.addActivityLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    
    if (!user || !action) {
      return res.status(400).json({
        success: false,
        message: 'User and action are required'
      });
    }
    
    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }
    
    const org = await Organization.findOneAndUpdate(
      resolved.query,
      {
        $push: {
          activityLogs: {
            user: user,
            userId: req.user?._id || null,
            action: action,
            details: details || null,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }
    
    // Return the newly added log
    const newLog = org.activityLogs[org.activityLogs.length - 1];
    
    res.status(200).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    console.error('Add activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding activity log',
      error: error.message
    });
  }
};

/**
 * Get Editable Organization Data
 * GET /api/organizations/:id/editable
 * 
 * ARCHITECTURAL INTENT:
 * Returns ONLY editable business fields for CreateOrganizationSurface edit mode.
 * 
 * MUST:
 * - Return ONLY: name, address, website, phone, industry, types
 * - Reject tenant organizations (isTenant: false only)
 * - Filter by tenant context (createdBy must be from tenant)
 * 
 * MUST NOT:
 * - Return tenant fields (subscription, limits, enabledApps, etc.)
 * - Return system fields (createdBy, assignedTo, etc.)
 * - Return app participation data
 * 
 * If API returns forbidden fields → show generic error (defensive UX)
 */
exports.getEditable = async (req, res) => {
  try {
    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }

    const org = await Organization.findOne(resolved.query).lean();
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be edited via this endpoint' 
      });
    }
    
    // Return editable business fields (type-scoped fields included when present on record)
    const editableData = pickEditableOrganizationRecord(org);
    
    res.json({
      success: true,
      data: editableData
    });
  } catch (error) {
    console.error('Error fetching editable organization:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching organization data',
      error: error.message 
    });
  }
};

/**
 * Update Business Organization
 * PATCH /api/organizations/:id
 * 
 * ARCHITECTURAL INTENT:
 * Updates ONLY editable business fields for CreateOrganizationSurface edit mode.
 * 
 * MUST:
 * - Accept business-editable fields (including custom fields) while blocking tenant/system fields
 * - Reject tenant organizations (isTenant: false only)
 * - Filter by tenant context (createdBy must be from tenant)
 * - Ignore any extra fields silently
 * - Reject tenant-only fields if provided
 * 
 * MUST NOT:
 * - Accept tenant fields (subscription, limits, enabledApps, etc.)
 * - Accept system fields (createdBy, assignedTo, etc.)
 * - Accept app participation data
 */
exports.update = async (req, res) => {
  try {
    const User = require('../models/User');
    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }
    const tenantOrganizationId = resolved.tenantOrganizationId;

    const org = await Organization.findOne(resolved.query);
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be edited via this endpoint' 
      });
    }
    
    // Block tenant/system/infrastructure fields from generic record-page updates.
    // All other business fields (including custom fields) are allowed.
    const blockedFields = new Set([
      '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy',
      'deletedAt', 'deletedBy', 'deletionReason', 'activityLogs', 'legacyOrganizationId',
      'subscription', 'limits', 'enabledApps', 'enabledModules', 'slug', 'settings', 'security',
      'billing', 'isTenant', 'database', 'integrations', 'moduleOverrides', 'crmInitialized', 'dataRegion',
      'importHistoryId'
    ]);

    let updatePayload = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (blockedFields.has(key)) continue;
      updatePayload[key] = value;
    }

    {
      const dupFields = ['name', 'domain', 'website', 'taxId', 'tax_id', 'email', 'phone'];
      if (dupFields.some((f) => Object.prototype.hasOwnProperty.call(updatePayload, f))) {
        try {
          const { evaluateDuplicates } = require('../services/duplicates');
          const candidate = { ...(org.toObject ? org.toObject() : org), ...updatePayload };
          const dupResult = await evaluateDuplicates({
            organizationId: tenantOrganizationId,
            moduleKey: 'organizations',
            candidate,
            excludeRecordId: org._id,
            emitEvent: true,
            triggeredBy: req.user?._id,
            limit: 5,
          });
          if (dupResult.enabled && dupResult.hasMatch) {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_WARNING',
              message: 'This update matches another Organization record.',
              data: { matches: dupResult.matches, policy: dupResult.policy },
            });
          }
        } catch (dupErr) {
          console.warn('[organizationV2Controller.update] duplicate check failed:', dupErr.message);
        }
      }
    }

    const { getOrganizationTypesConfig } = require('../utils/tenantMetadata');
    const { filterOrganizationSubmitPayloadByTypes } = require('../utils/organizationTypeFieldVisibility');
    const { typeDefs } = await getOrganizationTypesConfig(tenantOrganizationId);
    const effectiveTypes = Array.isArray(updatePayload.types)
      ? updatePayload.types
      : (org.types || []);
    updatePayload = filterOrganizationSubmitPayloadByTypes(updatePayload, effectiveTypes, typeDefs);

    if (updatePayload.website !== undefined) {
      if (typeof updatePayload.website !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Website must be a string',
          errors: { website: 'Website must be a string' }
        });
      }

      updatePayload.website = updatePayload.website.trim();
      if (updatePayload.website && !isValidWebsite(updatePayload.website)) {
        return res.status(400).json({
          success: false,
          message: 'Website must be a valid URL',
          errors: { website: 'Enter a valid website URL (e.g., example.com or https://example.org)' }
        });
      }
    }
    
    // REJECT tenant-only fields if provided
    const tenantOnlyFields = [
      'subscription', 'limits', 'enabledApps', 'enabledModules',
      'slug', 'settings', 'security', 'billing', 'isTenant'
    ];
    
    const providedTenantFields = tenantOnlyFields.filter(field => req.body[field] !== undefined);
    if (providedTenantFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tenant-only fields are not allowed: ${providedTenantFields.join(', ')}`,
        errors: { _general: 'Tenant-only fields cannot be updated' }
      });
    }
    
    // Validate status write protection (if config exists, block direct status writes)
    // Note: This endpoint only allows specific fields, but check for completeness
    const { validateStatusWriteProtection } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    const statusWriteProtectionResult = await validateStatusWriteProtection('organization', updatePayload, appKey);
    
    if (statusWriteProtectionResult && !statusWriteProtectionResult.valid) {
      return res.status(400).json({
        success: false,
        code: statusWriteProtectionResult.code,
        message: statusWriteProtectionResult.message,
        errors: statusWriteProtectionResult.errors
      });
    }
    
    // Validate status invariant (fail-closed: block if status !== derivedStatus when config exists)
    const { validateStatusInvariant } = require('../services/systemInvariants');
    const statusInvariantResult = await validateStatusInvariant({
      moduleKey: 'organizations',
      recordId: req.params.id,
      organizationId: tenantOrganizationId,
      updateData: updatePayload,
      appKey
    });
    
    if (!statusInvariantResult.valid) {
      return res.status(400).json({
        success: false,
        code: statusInvariantResult.code,
        message: statusInvariantResult.message,
        errors: statusInvariantResult.errors
      });
    }
    
    // Validate type mutation invariants if types are being updated
    if (updatePayload.types !== undefined && Array.isArray(updatePayload.types)) {
      const { validateTypeMutation, validateRoleInvariant } = require('../services/systemInvariants');
      const {
        applyTypesWrite,
        validateOrganizationTypesForEnabledApps,
        validateOrganizationParticipations,
        resolveTenantParticipationAppKeys,
        deriveTypesFromParticipations,
      } = require('../utils/syncOrganizationParticipation');
      const { resolveAvailableOrganizationRoles } = require('../constants/organizationParticipation');

      const enabledAppKeys = await resolveTenantParticipationAppKeys(tenantOrganizationId);
      const allowedRoles = resolveAvailableOrganizationRoles(enabledAppKeys);

      if (updatePayload.participations && typeof updatePayload.participations === 'object') {
        const partGate = validateOrganizationParticipations(
          updatePayload.participations,
          enabledAppKeys
        );
        if (!partGate.valid) {
          return res.status(400).json({
            success: false,
            message: partGate.message,
            errors: { types: partGate.message },
          });
        }
        updatePayload.types = deriveTypesFromParticipations(updatePayload.participations);
      } else {
        const typeGate = validateOrganizationTypesForEnabledApps(updatePayload.types, allowedRoles);
        if (!typeGate.valid) {
          return res.status(400).json({
            success: false,
            message: typeGate.message,
            errors: { types: typeGate.message },
          });
        }

        const synced = applyTypesWrite({
          types: updatePayload.types,
          enabledAppKeys,
          existingParticipations: org.participations || {},
        });
        updatePayload.types = synced.types;
        updatePayload.participations = synced.participations;
      }
      
      // Validate type mutation (additive only)
      const typeMutationResult = await validateTypeMutation({
        moduleKey: 'organizations',
        recordId: req.params.id,
        organizationId: tenantOrganizationId,
        updateData: { types: updatePayload.types }
      });
      
      if (!typeMutationResult.valid) {
        return res.status(400).json({
          success: false,
          code: typeMutationResult.code,
          message: typeMutationResult.message,
          errors: typeMutationResult.errors
        });
      }
      
      // Validate role invariant if primaryContact is also being updated
      if (updatePayload.primaryContact !== undefined) {
        const roleInvariantResult = await validateRoleInvariant({
          moduleKey: 'organizations',
          recordId: req.params.id,
          organizationId: tenantOrganizationId,
          updateData: { types: updatePayload.types, primaryContact: updatePayload.primaryContact }
        });
        
        if (!roleInvariantResult.valid) {
          return res.status(400).json({
            success: false,
            code: roleInvariantResult.code,
            message: roleInvariantResult.message,
            errors: roleInvariantResult.errors
          });
        }
      }
    }
    
    // Snapshot before mutation (for domain events)
    const previousSnapshot = org.toObject ? org.toObject() : { ...org };

    // Update only allowed fields
    let hasChanges = false;
    const updatedKeys = [];
    Object.entries(updatePayload).forEach(([field, fieldValue]) => {
      if (fieldValue !== undefined) {
        // Handle array fields specially
        if (field === 'types' || field === 'tags') {
          if (Array.isArray(fieldValue)) {
            const nextArray = field === 'tags'
              ? fieldValue.map((tag) => String(tag || '').trim()).filter(Boolean)
              : fieldValue;
            const currentArray = Array.isArray(org[field]) ? org[field] : [];
            if (JSON.stringify(currentArray) !== JSON.stringify(nextArray)) {
              org[field] = nextArray;
              hasChanges = true;
              updatedKeys.push(field);
            }
          }
        } else if (field === 'participations' && fieldValue && typeof fieldValue === 'object') {
          org.participations = fieldValue;
          org.markModified('participations');
          hasChanges = true;
          updatedKeys.push(field);
        } else if (Array.isArray(fieldValue)) {
          const currentArray = Array.isArray(org[field]) ? org[field] : [];
          if (JSON.stringify(currentArray) !== JSON.stringify(fieldValue)) {
            org[field] = fieldValue;
            hasChanges = true;
            updatedKeys.push(field);
          }
        } else if (field === 'description') {
          if (!org.customFields || typeof org.customFields !== 'object') {
            org.customFields = {};
          }
          const nextDescription = fieldValue == null ? '' : String(fieldValue);
          const currentDescription = org.customFields?.description == null ? '' : String(org.customFields.description);
          if (currentDescription !== nextDescription) {
            org.customFields.description = nextDescription;
            // customFields is Mixed; mark modified so Mongoose persists nested updates.
            org.markModified('customFields');
            hasChanges = true;
            updatedKeys.push(field);
          }
        } else if (ORGANIZATION_REFERENCE_FIELDS.has(field)) {
          const nextRef = normalizeOrganizationReferenceValue(fieldValue);
          const currentRef = org[field] ? String(org[field]) : null;
          const nextRefStr = nextRef ? String(nextRef) : null;
          if (currentRef !== nextRefStr) {
            org[field] = nextRef;
            hasChanges = true;
            updatedKeys.push(field);
          }
        } else {
          // For other fields, allow empty strings (will be stored as empty)
          const newValue = fieldValue !== null ? (fieldValue || '') : '';
          if (org[field] !== newValue) {
            org[field] = newValue;
            hasChanges = true;
            updatedKeys.push(field);
          }
        }
      }
    });
    
    // Validate required field
    if (org.name === undefined || org.name === null || org.name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
        errors: { name: 'Name is required' }
      });
    }
    
    // Only save if there are changes
    if (hasChanges) {
      // Trim name
      org.name = org.name.trim();

      // Generic description versioning: push previous content before saving new description.
      if (updatedKeys.includes('description')) {
        try {
          const prevDesc = String(previousSnapshot?.description ?? previousSnapshot?.customFields?.description ?? '');
          const nextDesc = String(org.customFields?.description ?? org.description ?? '');
          if (prevDesc !== nextDesc) {
            if (!Array.isArray(org.descriptionVersions)) org.descriptionVersions = [];
            org.descriptionVersions.push({
              content: prevDesc,
              createdAt: new Date(),
              createdBy: req.user?._id
            });
          }
        } catch (versionErr) {
          console.warn('Description version push (organization) failed:', versionErr?.message || versionErr);
        }
      }
      
      // Get user name for activity log
      let userName = 'System';
      if (req.user && req.user._id) {
        const user = await User.findById(req.user._id).select('firstName lastName username');
        if (user) {
          userName = (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
        }
      }
      
      // Add activity log
      if (!org.activityLogs) {
        org.activityLogs = [];
      }
      org.activityLogs.push({
        user: userName,
        userId: req.user?._id || null,
        action: 'updated this record',
        details: { type: 'update', fields: updatedKeys },
        timestamp: new Date()
      });

      try {
        const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
        const ModuleDefinition = require('../models/ModuleDefinition');
        const moduleDef = await ModuleDefinition.findOne({ organizationId: tenantOrganizationId, key: 'organizations' });
        await appendFieldChangeLogs({
          organizationId: tenantOrganizationId,
          moduleKey: 'organizations',
          recordId: req.params.id,
          authorId: req.user._id,
          previous: previousSnapshot,
          updated: org.toObject ? org.toObject() : { ...org },
          updateDataKeys: updatedKeys,
          fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
        });
      } catch (logErr) {
        console.warn('Record activity log (organization update) failed:', logErr?.message || logErr);
      }
      
      // Check if lifecycle or type fields changed and compute derived status
      const { hasLifecycleOrTypeChanged, computeAndSetDerivedStatus, hasConfiguration } = require('../services/derivedStatusService');
      const shouldComputeDerivedStatus = hasLifecycleOrTypeChanged('organization', org, updatePayload);
      const appKey = req.appKey || req.query.appKey || 'SALES';
      
      await org.save();

      const portalSyncFields = new Set([
        'types',
        'customerStatus',
        'partnerStatus',
        'vendorStatus'
      ]);
      const shouldSyncPortalAccess = updatedKeys.some((key) => portalSyncFields.has(key));
      if (shouldSyncPortalAccess) {
        try {
          const { syncFromOrganizationChange } = require('../services/portalAccessService');
          await syncFromOrganizationChange(org._id, {
            adminUser: req.user,
            reqMeta: { ip: req.ip, userAgent: req.get('user-agent') }
          });
        } catch (portalSyncErr) {
          console.warn('[organizationV2] portal eligibility sync failed:', portalSyncErr.message);
        }
      }
      
      // Compute derived status if lifecycle/type fields changed
      if (shouldComputeDerivedStatus) {
        const computedDerivedStatus = await computeAndSetDerivedStatus('organization', org, appKey);
        
        // If config exists and derivedStatus was computed, update status field to match
        const configExists = await hasConfiguration('organization', appKey);
        if (configExists && computedDerivedStatus) {
          // Update the appropriate status field based on types
          // For organizations, we need to determine which status field to update
          // based on the types array (customerStatus, partnerStatus, vendorStatus)
          if (org.types && org.types.length > 0) {
            const firstType = org.types[0].toLowerCase();
            if (firstType === 'customer' && org.customerStatus !== computedDerivedStatus) {
              org.customerStatus = computedDerivedStatus;
            } else if (firstType === 'partner' && org.partnerStatus !== computedDerivedStatus) {
              org.partnerStatus = computedDerivedStatus;
            } else if (firstType === 'vendor' && org.vendorStatus !== computedDerivedStatus) {
              org.vendorStatus = computedDerivedStatus;
            }
          }
        }
        
        // Save if derivedStatus or status was updated
        if (org.derivedStatus !== undefined && org.isModified('derivedStatus')) {
          await org.save();
        } else if (org.isModified('customerStatus') || org.isModified('partnerStatus') || org.isModified('vendorStatus')) {
          await org.save();
        }
      }

      try {
        const { emitOrganizationEvents } = require('../services/domainEventHelpers');
        emitOrganizationEvents({
          previous: previousSnapshot,
          current: org.toObject ? org.toObject() : org,
          appKey,
          triggeredBy: req.user?._id ?? null,
          organizationId: req.user?.organizationId ?? null
        });
      } catch (emitErr) {
        console.error('[organizationV2Controller] emitOrganizationEvents on update failed:', emitErr?.message || emitErr);
      }

      try {
        if (tenantOrganizationId) {
          const { enqueueAfterPartySave } = require('../services/connectors/tally/tallyOutboxHooks');
          await enqueueAfterPartySave({
            organizationId: tenantOrganizationId,
            party: org,
          });
        }
      } catch (tallyErr) {
        console.warn('[organizationV2Controller] tally outbox hook failed', tallyErr?.message);
      }
    }

    if (Array.isArray(req.body.vendorCatalog)) {
      try {
        const vendorCatalogService = require('../services/vendorCatalogService');
        await vendorCatalogService.replaceEntries({
          organizationId: tenantOrganizationId,
          vendorId: org._id,
          entries: req.body.vendorCatalog,
          userId: req.user?._id || null
        });
      } catch (catalogErr) {
        console.error(
          '[organizationV2Controller] vendor catalog save failed',
          catalogErr?.message,
          catalogErr?.stack
        );
        // Non-fatal: client follows up with PUT /vendor-catalog
      }
    }
    
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    res.json({
      success: true,
      data: flattenCustomFieldsForResponse(org)
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    
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
      message: 'Error updating organization',
      error: error.message
    });
  }
};

// OrganizationSurface API
// Returns a curated, UI-safe projection.
// Never return the raw Organization model to the UI.
// 
// This endpoint enforces OrganizationSurface discipline:
// - Only business organizations (isTenant: false)
// - Only business context fields
// - No platform/tenant fields
// See docs/architecture/organization-surface-invariants.md
exports.getSurface = async (req, res) => {
  try {
    const People = require('../models/People');
    const RelationshipInstance = require('../models/RelationshipInstance');
    const resolved = await resolveAccessibleCrmOrganizationQuery(req, req.params.id);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }
    const tenantOrganizationId = resolved.tenantOrganizationId;

    const org = await Organization.findOne(resolved.query)
      .populate('primaryContact', 'first_name last_name email')
      .lean();
    
    if (!org) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }
    
    // EXPLICIT REJECTION: If somehow a tenant org got through, reject it
    if (org.isTenant === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tenant organizations cannot be accessed via OrganizationSurface' 
      });
    }
    
    // Fetch related data for surface
    
    // 1. People count and preview from relationship instances (source of truth).
    const peopleRelationshipFilter = {
      organizationId: tenantOrganizationId,
      relationshipKey: 'people_organizations',
      'source.appKey': 'sales',
      'source.moduleKey': 'people',
      'target.appKey': 'sales',
      'target.moduleKey': 'organizations',
      'target.recordId': org._id
    };

    const linkedPeopleIds = await RelationshipInstance.distinct('source.recordId', peopleRelationshipFilter);

    const peopleCount = linkedPeopleIds.length > 0
      ? await People.countDocuments({
          _id: { $in: linkedPeopleIds },
          organizationId: tenantOrganizationId
        })
      : 0;

    const recentPeopleLinks = await RelationshipInstance.find(peopleRelationshipFilter)
      .select('source.recordId createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const previewCandidateIds = [];
    const seenIds = new Set();
    for (const link of recentPeopleLinks) {
      const personId = String(link?.source?.recordId || '');
      if (!personId || seenIds.has(personId)) continue;
      seenIds.add(personId);
      previewCandidateIds.push(personId);
      if (previewCandidateIds.length >= 10) break;
    }

    const previewPeopleDocs = previewCandidateIds.length > 0
      ? await People.find({
          _id: { $in: previewCandidateIds },
          organizationId: tenantOrganizationId
        })
          .select('_id first_name last_name email role')
          .lean()
      : [];

    const previewPeopleById = new Map(
      previewPeopleDocs.map((person) => [String(person._id), person])
    );

    const peoplePreview = previewCandidateIds
      .map((personId) => previewPeopleById.get(String(personId)))
      .filter(Boolean)
      .slice(0, 5)
      .map((person) => ({
        id: person._id.toString(),
        name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Unknown',
        role: person.role || undefined
      }));
    
    // 2. App participation summary
    const apps = [];
    
    // Check SALES app participation (Deals)
    try {
      const Deal = require('../models/Deal');
      const dealCount = await Deal.countDocuments({ 
        accountId: org._id,
        organizationId: tenantOrganizationId 
      });
      
      if (dealCount > 0) {
        apps.push({
          appKey: 'SALES',
          hasWork: true,
          counts: { deals: dealCount }
        });
      }
    } catch (err) {
      // Deal model might not exist - skip
    }
    
    // Check HELPDESK app participation (Cases)
    try {
      const Case = require('../models/Case');
      const caseCount = await Case.countDocuments({
        organizationRefId: org._id,
        organizationId: tenantOrganizationId,
        deletedAt: null
      });

      if (caseCount > 0) {
        apps.push({
          appKey: 'HELPDESK',
          hasWork: true,
          counts: { cases: caseCount }
        });
      }
    } catch (err) {
      // Case model might not exist - skip
    }
    
    // Check AUDIT app participation (Audits)
    try {
      const Audit = require('../models/Audit');
      const auditCount = await Audit.countDocuments({ 
        organizationId: org._id,
        tenantOrganizationId: tenantOrganizationId 
      });
      
      if (auditCount > 0) {
        apps.push({
          appKey: 'AUDIT',
          hasWork: true,
          counts: { audits: auditCount }
        });
      }
    } catch (err) {
      // Audit model might not exist - skip
    }
    
    // 3. Recent activity (limited to last 20 entries)
    // Enhance activity logs with person information when available
    const recentActivityLogs = (org.activityLogs || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20); // Limit to 20 most recent
    
    // Process activity logs and enrich with person information
    const recentActivity = await Promise.all(
      recentActivityLogs.map(async (log) => {
        const activityEntry = {
          timestamp: log.timestamp,
          user: log.user || 'System',
          userId: log.userId ? log.userId.toString() : undefined,
          action: log.action || 'unknown',
          summary: `${log.user || 'System'} ${log.action || 'performed an action'}`,
          personId: undefined,
          personName: undefined
        };
        
        // Extract person ID from action or details if available
        let personId = null;
        
        // Check if details contains person information
        if (log.details) {
          if (log.details.personId) {
            personId = log.details.personId;
          } else if (log.details.person) {
            personId = log.details.person;
          } else if (log.details.peopleId) {
            personId = log.details.peopleId;
          }
        }
        
        // Also try to extract ObjectId from action string (e.g., "created people '695d51f4f9e9e6cc9e10bf47'")
        if (!personId && log.action) {
          const objectIdMatch = log.action.match(/['"]?([0-9a-fA-F]{24})['"]?/);
          if (objectIdMatch && (log.action.includes('people') || log.action.includes('person'))) {
            personId = objectIdMatch[1];
          }
        }
        
        // Fetch person name if we have a person ID
        if (personId) {
          try {
            const person = await People.findOne({ 
              _id: personId,
              organizationId: tenantOrganizationId 
            }).select('first_name last_name email').lean();
            
            if (person) {
              activityEntry.personId = personId.toString();
              activityEntry.personName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Unknown';
            }
          } catch (err) {
            // Person not found or error fetching - continue without person info
            console.warn(`[getSurface] Could not fetch person ${personId}:`, err.message);
          }
        }
        
        return activityEntry;
      })
    );
    
    // Map to OrganizationSurfaceData projection
    const surfaceData = mapOrganizationToSurface(org, {
      peopleCount,
      peoplePreview,
      apps,
      recentActivity
    });
    
    res.json({ 
      success: true, 
      data: surfaceData 
    });
  } catch (error) {
    console.error('Error fetching organization surface:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching organization surface', 
      error: error.message 
    });
  }
};

exports.listMeta = async (req, res) => {
  try {
    const tenantOrganizationId = req.user?.organizationId;
    if (!tenantOrganizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const query = await buildOrganizationListMongoQuery({
      tenantOrganizationId,
      params: req.query,
      user: req.user,
      appKey: req.appKey || 'SALES',
    });
    const meta = await fetchListMeta(Organization, query);
    sendListMetaResponse(res, meta);
  } catch (error) {
    console.error('[organizationV2Controller.listMeta] error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch organization list meta' });
  }
};


