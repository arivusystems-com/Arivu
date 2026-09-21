/**
 * ============================================================================
 * PLATFORM CORE: People (Contacts) Management Controller
 * ============================================================================
 * 
 * This controller handles app-agnostic people/contact management:
 * - People CRUD operations
 * - Notes management
 * - Activity log management
 * 
 * ✅ FIXED: Person creation is now identity-only and app-agnostic.
 *    Participation fields (type, lead_status, contact_status, etc.) are
 *    stripped from creation payloads and must be set via Attach-to-App.
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const People = require('../models/People');
const mongoose = require('mongoose');
const { applyProjectionFilter } = require('../utils/appProjectionQuery');
const { getProjection } = require('../utils/moduleProjectionResolver');
const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
const {
  PEOPLE_SALES_ROLE_PATH,
  PEOPLE_SALES_ROLE_AGG_REF,
  getPeopleFieldQueryPath,
} = require('../utils/peopleFieldRegistry');
const {
  helpdeskTypeAliasViolation,
  peopleLegacyTopLevelTypeViolation,
} = require('../utils/warnDeprecatedPeopleTypeAlias');
const { isOptionalEmailWellFormed } = require('../utils/defaultFieldValidations');
const { performance } = require('perf_hooks');
const { buildPeopleListQuery } = require('../utils/listQueryBuilders/peopleListQuery');
const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');

const DEBUG_PEOPLE_LIST = process.env.DEBUG_PEOPLE_LIST === 'true';

const formatServerTiming = (timings) => {
  return timings
    .filter(({ duration }) => Number.isFinite(duration))
    .map(({ name, duration, description }) => {
      const desc = description ? `;desc="${description.replace(/"/g, "'")}"` : '';
      return `${name};dur=${duration.toFixed(1)}${desc}`;
    })
    .join(', ');
};

/**
 * Flatten People record for API response: expose participations as top-level aliases.
 * Canonical: participations.SALES.role, participations.HELPDESK.role
 */
function resolvePeopleLastActivity(record) {
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

function flattenPeopleForResponse(record) {
  const flat = flattenCustomFieldsForResponse(record);
  if (!flat) return flat;
  // Never expose legacy top-level `type` (SALES role lives in participations + `sales_type` alias)
  const { type: _legacyTopLevelType, ...rest } = flat;
  const { role, lead_status, contact_status } = getSalesParticipationValues(rest);
  const helpdeskRole = rest.participations?.HELPDESK?.role ?? null;
  const sales_type = role ?? null;
  return {
    ...rest,
    sales_type,
    helpdesk_role: helpdeskRole,
    lead_status: lead_status ?? null,
    contact_status: contact_status ?? null,
    lastActivity: resolvePeopleLastActivity(rest),
  };
}

function debugPeopleList(message, payload) {
  if (DEBUG_PEOPLE_LIST) {
    console.log(message, payload);
  }
}

/** Combine list filter with an extra predicate ($and) for facet counts */
function peopleQueryAnd(baseQuery, clause) {
  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return clause;
  }
  return { $and: [baseQuery, clause] };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Matches client registry keys: totalPeople, assignedToMe, unassigned, withOrganization, withoutOrganization.
 */
async function computePeopleListStatistics(query, userId) {
  const uid =
    mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const [assignedToMe, unassigned, withOrganization, withoutOrganization] = await Promise.all([
    People.countDocuments(peopleQueryAnd(query, { assignedTo: uid })),
    People.countDocuments(
      peopleQueryAnd(query, {
        $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }]
      })
    ),
    People.countDocuments(
      peopleQueryAnd(query, { organization: { $exists: true, $ne: null } })
    ),
    People.countDocuments(
      peopleQueryAnd(query, {
        $or: [{ organization: null }, { organization: { $exists: false } }]
      })
    )
  ]);

  return {
    assignedToMe,
    unassigned,
    withOrganization,
    withoutOrganization
  };
}

/**
 * Get list of Sales participation fields that should not be set during Person creation
 * These fields are set via Attach-to-App, not during identity creation
 */
function getSalesParticipationFields() {
  return [
    'type',              // State field - Lead/Contact distinction
    'lead_status',       // State field - Lead workflow status
    'contact_status',    // State field - Contact workflow status
    'lead_owner',        // Detail field - Lead owner
    'lead_score',        // Detail field - Lead scoring
    'interest_products', // Detail field - Products of interest
    'qualification_date', // Detail field - Qualification date
    'qualification_notes', // Detail field - Qualification notes
    'estimated_value',   // Detail field - Estimated deal value
    'role',              // Detail field - Contact role
    'birthday',          // Detail field - Birthday
    'preferred_contact_method', // Detail field - Contact preference
    'sales_type',
    'helpdesk_role'
  ];
}

function normalizeObjectIdLike(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return value._id ? String(value._id) : String(value);
  }
  return String(value);
}

const {
  syncPeopleOrganizationRelationship
} = require('../services/peopleOrganizationRelationshipSync');

// Export for use in other controllers
exports.getSalesParticipationFields = getSalesParticipationFields;
exports.flattenPeopleForResponse = flattenPeopleForResponse;

// Create People
exports.create = async (req, res) => {
  try {
    const User = require('../models/User');
    
    // GUARDRAIL: Strip Sales participation fields from creation payload
    // Person creation is identity-only and app-agnostic
    // Participation fields are set via Attach-to-App, not during creation
    const participationFields = getSalesParticipationFields();
    const strippedBody = { ...req.body };
    const detectedParticipationFields = [];
    
    for (const field of participationFields) {
      if (strippedBody.hasOwnProperty(field)) {
        detectedParticipationFields.push(field);
        delete strippedBody[field];
      }
    }
    
    // Log warning if participation fields were detected (for legacy callers)
    if (detectedParticipationFields.length > 0) {
      console.warn(`[PeopleController] ⚠️ Participation fields detected in Person creation payload and stripped: ${detectedParticipationFields.join(', ')}. Person creation is identity-only. Use Attach-to-App to set participation fields.`);
    }
    
    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';
    
    const { extractCustomFields } = require('../utils/customFieldsExtractor');
    const { assignResolvedSource } = require('../services/sourceResolver');
    const { applyCreateOwnerDefaults } = require('../utils/recordCreateOwnerDefaults');
    const { standardPayload, customFieldsSet } = extractCustomFields(strippedBody, People);
    const payloadWithOwnerDefaults = applyCreateOwnerDefaults(standardPayload, 'people', req.user._id);

    const body = {
      ...payloadWithOwnerDefaults,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      assignedTo: payloadWithOwnerDefaults.assignedTo || req.user._id,
      ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user._id,
        action: 'record_created',
        message: 'Created this person',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };
    assignResolvedSource(body, 'ui');
    if (body.email !== undefined && body.email !== null && !isOptionalEmailWellFormed(body.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    try {
      const { evaluateDuplicates } = require('../services/duplicates');
      const dupResult = await evaluateDuplicates({
        organizationId: req.user.organizationId,
        moduleKey: 'people',
        candidate: body,
        emitEvent: true,
        triggeredBy: req.user._id,
        limit: 5,
      });
      if (dupResult.enabled && dupResult.hasMatch) {
        const policy = dupResult.policy || 'warn';
        if (policy === 'reject' || policy === 'warn') {
          return res.status(409).json({
            success: false,
            code: policy === 'reject' ? 'DUPLICATE_REJECTED' : 'DUPLICATE_WARNING',
            message: 'A matching People record already exists.',
            data: { matches: dupResult.matches, policy },
          });
        }
        // attach policy on plain create: return existing instead of creating
        if (policy === 'attach' && dupResult.matches[0]?.record?._id) {
          const existing = await People.findById(dupResult.matches[0].record._id);
          if (existing) {
            return res.status(200).json({
              success: true,
              data: flattenPeopleForResponse(existing),
              code: 'DUPLICATE_ATTACHED',
              message: 'Existing People record returned (duplicate prevention).',
            });
          }
        }
      }
    } catch (dupErr) {
      console.warn('[PeopleController.create] duplicate check failed:', dupErr.message);
    }

    {
      const ModuleDefinition = require('../models/ModuleDefinition');
      const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
      const moduleDef = await ModuleDefinition.findOne({
        organizationId: req.user.organizationId,
        key: 'people'
      }).lean();
      if (moduleDef && Array.isArray(moduleDef.fields)) {
        const picklistErrors = validatePicklistDependencyValues(moduleDef.fields, {
          ...body,
          ...customFieldsSet
        });
        if (picklistErrors.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed.',
            code: 'PICKLIST_DEPENDENCY_VIOLATION',
            validationErrors: picklistErrors
          });
        }
      }
    }

    const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
    const assignCheck = await validateRecordAssignmentRequest(req, body.assignedTo, { skipSelf: true });
    if (assignCheck) {
      return res.status(assignCheck.status).json(assignCheck.body);
    }
    const record = await People.create(body);

    if (record.organization) {
      try {
        await syncPeopleOrganizationRelationship({
          tenantOrganizationId: req.user.organizationId,
          personId: record._id,
          organizationValue: record.organization,
          userId: req.user._id
        });
      } catch (syncErr) {
        console.warn('[PeopleController] Failed to sync people_organizations relationship on create:', syncErr?.message || syncErr);
      }
    }
    
    // Compute derived status (non-blocking)
    const { computeAndSetDerivedStatus } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    await computeAndSetDerivedStatus('people', record, appKey);
    
    // Save if derivedStatus was computed
    if (record.derivedStatus !== undefined) {
      await record.save();
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const fresh = await People.findById(record._id);
      if (fresh) {
        await runImmediateAssignmentForSalesRecord({
          record: fresh,
          moduleKey: 'people',
          appKey,
          actorId: req.user._id,
          triggerSource: 'immediate',
          changedFields: []
        });
        await enqueueAssignmentJobsForSalesRecord({
          record: fresh,
          moduleKey: 'people',
          actorId: req.user._id,
          changedFields: []
        });
      }
    } catch (assignErr) {
      console.error('[peopleController] assignment on create failed:', assignErr?.message || assignErr);
    }

    try {
      const { emitPeopleEvents } = require('../services/domainEventHelpers');
      const freshForEmit = await People.findById(record._id);
      emitPeopleEvents({
        previous: null,
        current: freshForEmit?.toObject ? freshForEmit.toObject() : freshForEmit || record,
        appKey,
        triggeredBy: req.user?._id ?? null,
        organizationId: req.user?.organizationId ?? null
      });
    } catch (emitErr) {
      console.error('[peopleController] emitPeopleEvents on create failed:', emitErr?.message || emitErr);
    }

    const createdOut = await People.findById(record._id);
    res.status(201).json({ success: true, data: flattenPeopleForResponse(createdOut || record) });
  } catch (error) {
    console.error('Error creating people record:', error);
    console.error('Error name:', error.name);
    console.error('Error errors:', error.errors);
    console.error('Error message:', error.message);
    
    // Handle Mongoose validation errors - check both error.name and error.errors
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      
      console.log('Returning validation errors:', validationErrors);
      
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed. Please check the fields below.',
        errors: validationErrors
      });
    }
    
    // Parse error message for validation errors (format: "People validation failed: type: Path `type` is required.")
    // This happens when Mongoose validation fails but error.name is not 'ValidationError'
    if (error.message && error.message.includes('validation failed')) {
      const validationErrors = {};
      
      // Pattern 1: "field: Path `field` is required."
      const requiredPattern = /(\w+):\s*Path\s+`(\w+)`\s+is\s+required\.?/gi;
      let match;
      while ((match = requiredPattern.exec(error.message)) !== null) {
        const fieldName = match[1] || match[2];
        validationErrors[fieldName] = `${fieldName} is required`;
      }
      
      // Pattern 2: "field: error message" (general format)
      if (Object.keys(validationErrors).length === 0) {
        const parts = error.message.split(/validation failed:\s*/i);
        if (parts.length > 1) {
          const errorPart = parts[1];
          const fieldMatches = errorPart.match(/(\w+):\s*(.+?)(?:,|$)/g);
          if (fieldMatches) {
            fieldMatches.forEach(fieldMatch => {
              const fieldParts = fieldMatch.match(/(\w+):\s*(.+)/);
              if (fieldParts) {
                const fieldName = fieldParts[1];
                let errorMsg = fieldParts[2].trim();
                // Clean up common Mongoose error phrases
                errorMsg = errorMsg.replace(/^Path\s+`\w+`\s+/, '');
                validationErrors[fieldName] = errorMsg;
              }
            });
          }
        }
      }
      
      if (Object.keys(validationErrors).length > 0) {
        console.log('Parsed validation errors from message:', validationErrors);
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed. Please check the fields below.',
          errors: validationErrors
        });
      }
    }
    
    // Handle other errors - return the actual error message
    res.status(400).json({ 
      success: false, 
      message: 'Error creating record',
      error: error.message
    });
  }
};

// List People with org isolation and basic filters
exports.list = async (req, res) => {
  try {
    // CRITICAL: Ensure organizationId is set and log for debugging
    const userOrgId = req.user?.organizationId;
    if (!userOrgId) {
      console.error('[PeopleController] Missing organizationId in req.user:', {
        userId: req.user?._id,
        userEmail: req.user?.email,
        hasUser: !!req.user
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Organization context required' 
      });
    }

    // CRITICAL: Ensure organizationId is a proper ObjectId
    const mongoose = require('mongoose');
    const orgIdObjectId = mongoose.Types.ObjectId.isValid(userOrgId) 
      ? new mongoose.Types.ObjectId(userOrgId) 
      : userOrgId;
    
    let query = { organizationId: orgIdObjectId, deletedAt: null };

    const { applyListSharingToQuery } = require('../utils/sharingQueryUtils');
    applyListSharingToQuery(query, req, 'people');

    const peopleContext = req.query.peopleContext;
    if (peopleContext && peopleContext !== 'ALL') {
      query[`participations.${peopleContext}`] = { $exists: true, $ne: null };
    }
    
    // Debug logging
    debugPeopleList('[PeopleController] Filtering by organizationId:', {
      organizationId: String(userOrgId),
      organizationIdType: typeof userOrgId,
      orgIdObjectId: String(orgIdObjectId),
      userEmail: req.user?.email,
      queryKeys: Object.keys(query),
      query: JSON.stringify(query)
    });
    
    // Determine appKey once at the start - check query param first, then middleware
    const appKey = req.query.appKey || req.appKey || 'SALES';
    const moduleKey = 'people';
    
    // Debug logging
    debugPeopleList('[PeopleController] appKey determination:', {
      queryAppKey: req.query.appKey,
      middlewareAppKey: req.appKey,
      finalAppKey: appKey
    });
    
    // Role filters: sales_type query param → participations.SALES.role via registry
    const salesRoleParam = req.query.sales_type;
    if (salesRoleParam && appKey !== 'PLATFORM') {
      query[getPeopleFieldQueryPath('sales_type')] = salesRoleParam;
    }
    if (req.query.helpdesk_role && appKey !== 'PLATFORM') {
      query[getPeopleFieldQueryPath('helpdesk_role')] = req.query.helpdesk_role;
    }
    if (req.query.email) query.email = req.query.email;
    
    // Search functionality - search across name, email, phone fields
    // Store search condition separately - will be combined after projection filter
    let searchCondition = null;
    let assignedToFilter = null;
    const { buildSearchOrConditions, resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
    const { mergeSearchAndAssignedToFilters, buildAssignedToUserFilter } = require('../utils/organizationsListQuery');
    const directSearchTerm = req.query.search && req.query.search.trim() ? req.query.search.trim() : '';
    if (directSearchTerm) {
      searchCondition = {
        $or: buildSearchOrConditions(directSearchTerm, ['first_name', 'last_name', 'email', 'phone', 'mobile'])
      };
    }

    if (req.query.assignedTo !== undefined) {
      if (
        req.query.assignedTo === 'null'
        || req.query.assignedTo === 'unassigned'
        || req.query.assignedTo === null
        || req.query.assignedTo === ''
      ) {
        assignedToFilter = {
          $or: [
            { assignedTo: null },
            { assignedTo: { $exists: false } }
          ]
        };
      } else {
        assignedToFilter = buildAssignedToUserFilter(req.query.assignedTo, req.user?._id);
      }
      delete query.assignedTo;
    }
    // Note: organization filter can be for specific org, null (without organization), or 'has' (with organization)
    if (req.query.organization !== undefined) {
      if (req.query.organization === 'null' || req.query.organization === null || req.query.organization === '') {
        // Filter for without organization (null or missing)
        query.organization = null;
      } else if (req.query.organization === 'has') {
        // Filter for with organization (non-null, exists)
        query.organization = { $ne: null, $exists: true };
      } else if (mongoose.Types.ObjectId.isValid(req.query.organization)) {
        query.organization = new mongoose.Types.ObjectId(req.query.organization);
      } else {
        // Name/text filter — resolved to org IDs after filterQuery merge
        query.organization = String(req.query.organization).trim();
      }
    }
    
    // Phase 2A.2: Apply projection filter (read-time filtering only)
    // SAFETY: No record ownership or permissions are enforced here.
    // CRITICAL: For PLATFORM appKey, skip projection filtering to show ALL people
    // including those without app participation (identity-only records)
    // Skip projection filtering for PLATFORM appKey to ensure all people are visible
    if (appKey !== 'PLATFORM') {
      const projectionMeta = getProjection(appKey, moduleKey);
      query = applyProjectionFilter({
        appKey,
        moduleKey,
        baseQuery: query,
        projectionMeta
      });
    } else {
      // For PLATFORM appKey, explicitly ensure we're not filtering by role
      if (query[PEOPLE_SALES_ROLE_PATH] && typeof query[PEOPLE_SALES_ROLE_PATH] === 'object' && query[PEOPLE_SALES_ROLE_PATH].$exists === false) {
        // Role filter is checking for non-existence - this is fine
      } else if (query[PEOPLE_SALES_ROLE_PATH] && query[PEOPLE_SALES_ROLE_PATH] !== null) {
        if (!req.query.sales_type) {
          delete query[PEOPLE_SALES_ROLE_PATH];
        }
      }
      debugPeopleList('[PeopleController] PLATFORM appKey detected - skipping projection filter to show all people');
    }
    
    // Apply search + assignedTo after projection filter (must AND together correctly)
    query = mergeSearchAndAssignedToFilters(query, searchCondition, assignedToFilter);

    const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
    query = applyListFilterQueryParam(query, req.query, 'people', { userId: req.user?._id });

    const { resolvePeopleOrganizationFilters } = require('../utils/peopleOrganizationListFilter');
    query = await resolvePeopleOrganizationFilters(query, {
      tenantOrganizationId: orgIdObjectId,
      user: req.user,
    });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Handle sorting - supports multi-sort: sortBy=a,b&sortOrder=asc,desc
    // List UI column "name" is computed (first_name + last_name); expand for Mongo.
    const { parseListSort } = require('../utils/parseListSort');
    const { sorts } = parseListSort(req.query, {
      defaultField: 'createdAt',
      defaultOrder: 'desc',
      tieBreaker: null
    });
    const sortOptions = {};
    for (const { field, order } of sorts) {
      const dir = order === 'asc' ? 1 : -1;
      if (field === 'name') {
        sortOptions.first_name = dir;
        sortOptions.last_name = dir;
      } else {
        sortOptions[field] = dir;
      }
    }
    if (!Object.prototype.hasOwnProperty.call(sortOptions, '_id')) {
      sortOptions._id = sorts[0].order === 'asc' ? 1 : -1;
    }

    const User = require('../models/User');
    
    // CRITICAL: Final safety check for PLATFORM appKey - ensure no role filtering
    if (appKey === 'PLATFORM' && !req.query.sales_type) {
      if (query[PEOPLE_SALES_ROLE_PATH] && typeof query[PEOPLE_SALES_ROLE_PATH] !== 'object') {
        delete query[PEOPLE_SALES_ROLE_PATH];
        debugPeopleList('[PeopleController] Removed role filter for PLATFORM appKey');
      }
    }
    if (appKey === 'PLATFORM' && !req.query.helpdesk_role) {
      const helpdeskPath = getPeopleFieldQueryPath('helpdesk_role');
      if (query[helpdeskPath] && typeof query[helpdeskPath] !== 'object') {
        delete query[helpdeskPath];
      }
    }
    
    // CRITICAL: Double-check the query before executing
    debugPeopleList('[PeopleController] Final query before execution:', {
      appKey: appKey,
      queryAppKey: req.query.appKey,
      middlewareAppKey: req.appKey,
      hasProjectionFilter: appKey !== 'PLATFORM',
      hasSearch: !!searchCondition,
      hasRoleFilter: !!query[PEOPLE_SALES_ROLE_PATH],
      queryString: JSON.stringify(query, null, 2),
      queryKeys: Object.keys(query)
    });
    
    // Execute query with detailed logging
    debugPeopleList('[PeopleController] Executing find query:', {
      query: JSON.stringify(query),
      sortOptions: sortOptions,
      limit: limit,
      skip: skip
    });
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const peoplePopulate = [
      { path: 'assignedTo', select: 'firstName lastName email avatar' },
      { path: 'createdBy', select: 'firstName lastName email avatar username' },
      { path: 'lead_owner', select: 'firstName lastName email avatar username' },
      { path: 'organization', select: 'name' }
    ];

    const searchTerm = resolveListSearchTerm(req.query, 'people');
    const dataQuery = isSearchActive(searchTerm)
      ? fetchRankedSearchPage(People, {
          matchQuery: query,
          searchTerm,
          fieldSpecs: SEARCH_FIELD_PRESETS.people,
          skip,
          limit,
          fallbackSort: sortOptions,
          populate: peoplePopulate,
          lean: true
        })
      : People.find(query)
          .populate('assignedTo', 'firstName lastName email avatar')
          .populate('createdBy', 'firstName lastName email avatar username')
          .populate('lead_owner', 'firstName lastName email avatar username')
          .populate('organization', 'name')
          .sort(sortOptions)
          .limit(limit)
          .skip(skip)
          .lean();

    const { castMatchQueryForAggregate } = require('../utils/searchRelevance');
    const statsMatchQuery = castMatchQueryForAggregate(People, query);
    const statisticsQuery = People.aggregate([
      { $match: statsMatchQuery },
      {
        $group: {
          _id: null,
          totalContacts: { $sum: 1 },
          leadContacts: { $sum: { $cond: [{ $eq: [PEOPLE_SALES_ROLE_AGG_REF, 'Lead'] }, 1, 0] } },
          customerContacts: { $sum: { $cond: [{ $eq: [PEOPLE_SALES_ROLE_AGG_REF, 'Contact'] }, 1, 0] } }
        }
      }
    ]);

    const listStatisticsPromise = computePeopleListStatistics(query, req.user._id);

    const [data, total, statistics, newThisWeek, newCustomers, listCardBreakdown] = await Promise.all([
      dataQuery,
      People.countDocuments(query),
      statisticsQuery,
      People.countDocuments({
        ...query,
        createdAt: { $gte: oneWeekAgo }
      }),
      People.countDocuments({
        ...query,
        [getPeopleFieldQueryPath('sales_type')]: 'Contact',
        createdAt: { $gte: oneWeekAgo }
      }),
      listStatisticsPromise
    ]);

    // Log types distribution (from participations.SALES.role)
    if (DEBUG_PEOPLE_LIST) {
      const typesInResults = {};
      data.forEach(r => {
        const { role } = getSalesParticipationValues(r);
        const type = role ?? 'NO_TYPE';
        typesInResults[type] = (typesInResults[type] || 0) + 1;
      });

      debugPeopleList('[PeopleController] Query results:', {
        returnedCount: data.length,
        page: page,
        limit: limit,
        total: total,
        typesDistribution: typesInResults,
        sampleIds: data.slice(0, 5).map(r => {
          const { role } = getSalesParticipationValues(r);
          return {
            id: r._id,
            name: `${r.first_name} ${r.last_name}`,
            type: role ?? 'NO_TYPE',
            createdAt: r.createdAt
          };
        })
      });

      debugPeopleList('[PeopleController] Total count:', total);
    }
    
    // Calculate conversion rate (customers / total * 100)
    const statsData = statistics[0] || {
      totalContacts: 0,
      leadContacts: 0,
      customerContacts: 0
    };
    const conversionRate = statsData.totalContacts > 0
      ? Math.round((statsData.customerContacts / statsData.totalContacts) * 100)
      : 0;
    
    // Debug: Check if any records have wrong organizationId
    if (data.length > 0) {
      const wrongOrgRecords = data.filter(record => {
        const recordOrgId = record.organizationId?._id || record.organizationId;
        return String(recordOrgId) !== String(userOrgId);
      });
      
      if (wrongOrgRecords.length > 0) {
        console.error('[PeopleController] CRITICAL: Found records with wrong organizationId:', {
          expectedOrgId: String(userOrgId),
          userEmail: req.user?.email,
          wrongRecordsCount: wrongOrgRecords.length,
          wrongRecords: wrongOrgRecords.map(r => ({
            id: r._id,
            name: `${r.first_name} ${r.last_name}`,
            actualOrgId: String(r.organizationId?._id || r.organizationId),
            expectedOrgId: String(userOrgId)
          }))
        });
      } else {
        debugPeopleList('[PeopleController] ✅ All records have correct organizationId:', {
          recordCount: data.length,
          organizationId: String(userOrgId)
        });
      }
      
      // Also log the first few records to verify
      debugPeopleList('[PeopleController] Sample records organizationId:',
        data.slice(0, 3).map(r => ({
          name: `${r.first_name} ${r.last_name}`,
          orgId: String(r.organizationId?._id || r.organizationId)
        }))
      );
    }
    
    // CRITICAL: Filter out any records that somehow have wrong organizationId
    // This is a safety net in case the query didn't work correctly
    const filteredData = data.filter(record => {
      const recordOrgId = record.organizationId?._id || record.organizationId;
      return String(recordOrgId) === String(userOrgId);
    });
    
    if (filteredData.length !== data.length) {
      console.error('[PeopleController] CRITICAL: Filtered out records with wrong organizationId:', {
        before: data.length,
        after: filteredData.length,
        removed: data.length - filteredData.length
      });
    }

    // Backfill participations on read and flatten for API response
    const { syncSalesParticipation } = require('../utils/syncSalesParticipation');
    const responseData = filteredData.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      syncSalesParticipation(obj);
      return flattenPeopleForResponse(obj);
    });
    
    res.json({ 
      success: true, 
      data: responseData, 
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: limit
      },
      meta: { page, limit, total: total },
      statistics: {
        totalContacts: statsData.totalContacts,
        leadContacts: statsData.leadContacts,
        customerContacts: statsData.customerContacts,
        newThisWeek: newThisWeek,
        newCustomers: newCustomers,
        conversionRate: conversionRate
      },
      /** Registry-aligned stats for ModuleList / ListView cards (full query, not current page) */
      listStatistics: {
        ...listCardBreakdown,
        totalPeople: total,
        myPeople: total
      }
    });
  } catch (error) {
    console.error('Error in people list:', error);
    res.status(500).json({ success: false, message: 'Error fetching records', error: error.message });
  }
};

// Get by ID
exports.getById = async (req, res) => {
  const requestStartedAt = performance.now();
  const timings = [];
  try {
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.user.organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid record id' });
    }

    const dbStartedAt = performance.now();
    const [record] = await People.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
          organizationId: new mongoose.Types.ObjectId(req.user.organizationId),
          deletedAt: null
        }
      },
      { $project: { activityLogs: 0 } },
      {
        $lookup: {
          from: 'organizations',
          localField: 'organization',
          foreignField: '_id',
          as: 'organizationDoc',
          pipeline: [{ $project: { name: 1, industry: 1, status: 1, email: 1, phone: 1, website: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assignedToDoc',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, avatar: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByDoc',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, avatar: 1, username: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lead_owner',
          foreignField: '_id',
          as: 'leadOwnerDoc',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1, avatar: 1, username: 1 } }]
        }
      },
      {
        $set: {
          organization: { $ifNull: [{ $first: '$organizationDoc' }, null] },
          assignedTo: { $ifNull: [{ $first: '$assignedToDoc' }, null] },
          createdBy: { $ifNull: [{ $first: '$createdByDoc' }, null] },
          lead_owner: { $ifNull: [{ $first: '$leadOwnerDoc' }, null] }
        }
      },
      { $project: { organizationDoc: 0, assignedToDoc: 0, createdByDoc: 0, leadOwnerDoc: 0 } }
    ]);
    timings.push({ name: 'db', duration: performance.now() - dbStartedAt, description: 'People detail lookup' });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    // Backfill participations on read and flatten for API response
    const shapeStartedAt = performance.now();
    const { syncSalesParticipation } = require('../utils/syncSalesParticipation');
    const data = { ...record };
    syncSalesParticipation(data);
    timings.push({ name: 'shape', duration: performance.now() - shapeStartedAt, description: 'People detail response shaping' });
    timings.push({ name: 'total', duration: performance.now() - requestStartedAt, description: 'People detail request' });
    res.set('Server-Timing', formatServerTiming(timings));
    res.json({ success: true, data: flattenPeopleForResponse(data) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching record', error: error.message });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    // Remove createdBy and system-managed source from body
    const { createdBy, source: _clientSource, ...updateData } = req.body;

    const appKeyForHelpdeskGuard = req.appKey || req.query.appKey || 'SALES';
    const helpdeskViol = helpdeskTypeAliasViolation(appKeyForHelpdeskGuard, updateData);
    if (helpdeskViol) {
      return res.status(helpdeskViol.status).json(helpdeskViol.body);
    }
    const legacyTypeViol = peopleLegacyTopLevelTypeViolation(updateData);
    if (legacyTypeViol) {
      return res.status(legacyTypeViol.status).json(legacyTypeViol.body);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'email') && !isOptionalEmailWellFormed(updateData.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    {
      const dupFields = ['email', 'phone', 'mobile', 'first_name', 'last_name'];
      if (dupFields.some((f) => Object.prototype.hasOwnProperty.call(updateData, f))) {
        try {
          const existing = await People.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
          }).lean();
          if (existing) {
            const { evaluateDuplicates } = require('../services/duplicates');
            const candidate = { ...existing, ...updateData };
            const dupResult = await evaluateDuplicates({
              organizationId: req.user.organizationId,
              moduleKey: 'people',
              candidate,
              excludeRecordId: req.params.id,
              emitEvent: true,
              triggeredBy: req.user._id,
              limit: 5,
            });
            if (dupResult.enabled && dupResult.hasMatch) {
              return res.status(409).json({
                success: false,
                code: 'DUPLICATE_WARNING',
                message: 'This update matches another People record.',
                data: { matches: dupResult.matches, policy: dupResult.policy },
              });
            }
          }
        } catch (dupErr) {
          console.warn('[PeopleController.update] duplicate check failed:', dupErr.message);
        }
      }
    }
    
    // If someone tried to change createdBy, log a warning (but don't fail the request)
    if (createdBy !== undefined) {
      console.warn(`Attempt to modify createdBy field blocked for People record ${req.params.id}`);
    }
    
    // Validate unlink invariants if organization is being unlinked
    if (updateData.organization === null || updateData.organization === '') {
      const { validateUnlink } = require('../services/systemInvariants');
      const invariantResult = await validateUnlink({
        moduleKey: 'people',
        recordId: req.params.id,
        organizationId: req.user.organizationId,
        updateData: { organization: null }
      });
      
      if (!invariantResult.valid) {
        return res.status(400).json({
          success: false,
          code: invariantResult.code,
          message: invariantResult.message,
          errors: invariantResult.errors
        });
      }
    }
    
    // Validate status write protection (if config exists, block direct status writes)
    const { validateStatusWriteProtection } = require('../services/derivedStatusService');
    const appKey = req.appKey || req.query.appKey || 'SALES';
    const statusWriteProtectionResult = await validateStatusWriteProtection('people', updateData, appKey);
    
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
      moduleKey: 'people',
      recordId: req.params.id,
      organizationId: req.user.organizationId,
      updateData,
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

    // Validate SALES role when sent as sales_type; canonical write is participations.SALES.role only (via extractSalesFromUpdate)
    const rawSalesRole = updateData.sales_type;
    if (rawSalesRole !== undefined && rawSalesRole !== null && String(rawSalesRole).trim()) {
      const { validatePeopleType } = require('../utils/tenantMetadata');
      const typeValidation = await validatePeopleType(req.user.organizationId, appKey, rawSalesRole);
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          message: typeValidation.message,
          code: 'TYPE_NOT_ALLOWED',
          allowedTypes: typeValidation.allowedTypes
        });
      }
      updateData.sales_type = typeValidation.canonicalValue;
    }
    
    // Validate field-level write access
    const ModuleDefinition = require('../models/ModuleDefinition');
    const { validateFieldWrite } = require('../utils/fieldAccessControl');
    
    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.user.organizationId,
      key: 'people'
    });
    
    if (moduleDef && Array.isArray(moduleDef.fields)) {
      const fieldViolations = [];
      
      // Validate each field being updated
      for (const [fieldKey, fieldValue] of Object.entries(updateData)) {
        // Skip system fields and metadata
        if (['_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy'].includes(fieldKey)) {
          continue;
        }
        
        const validation = validateFieldWrite(fieldKey, moduleDef.fields, req.user, 'people');
        if (!validation.allowed) {
          fieldViolations.push({
            field: fieldKey,
            reason: validation.reason
          });
        }
      }
      
      // If any field violations, reject the entire update
      if (fieldViolations.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Field access denied',
          code: 'FIELD_ACCESS_DENIED',
          violations: fieldViolations
        });
      }
    }
    
    // Ensure organization field is properly formatted (ObjectId string or null)
    if (updateData.organization !== undefined) {
      if (updateData.organization === null || updateData.organization === '') {
        updateData.organization = null;
      } else if (typeof updateData.organization === 'object' && updateData.organization._id) {
        // If it's an object with _id, extract the _id
        updateData.organization = updateData.organization._id;
      }
      // Otherwise keep it as is (should be an ObjectId string)
    }

    // Normalize assignedTo to a valid ObjectId string or null.
    // This prevents accidental sentinel values (e.g. "selected") from being persisted.
    if (Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')) {
      const rawAssignedTo = updateData.assignedTo;
      if (rawAssignedTo === null || rawAssignedTo === '') {
        updateData.assignedTo = null;
      } else {
        const candidate = (typeof rawAssignedTo === 'object' && rawAssignedTo?._id)
          ? String(rawAssignedTo._id)
          : String(rawAssignedTo);
        updateData.assignedTo = mongoose.Types.ObjectId.isValid(candidate) ? candidate : null;
      }
    }
    
    console.log('📝 Updating People record:', {
      id: req.params.id,
      organization: updateData.organization,
      organizationType: typeof updateData.organization,
      updateKeys: Object.keys(updateData)
    });
    
    // Check if lifecycle or type fields changed
    const { hasLifecycleOrTypeChanged, computeAndSetDerivedStatus, hasConfiguration } = require('../services/derivedStatusService');
    const shouldComputeDerivedStatus = hasLifecycleOrTypeChanged('people', null, updateData);

    // Load previous for derived-status logic and for activity log (field-level changes)
    const previous = await People.findOne(
      { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
    ).lean();

    if (moduleDef && Array.isArray(moduleDef.fields)) {
      const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
      const mergedForPicklist = {
        ...(previous || {}),
        ...updateData,
        customFields: {
          ...((previous && previous.customFields) || {}),
          ...(updateData.customFields || {})
        }
      };
      const picklistErrors = validatePicklistDependencyValues(moduleDef.fields, mergedForPicklist);
      if (picklistErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          code: 'PICKLIST_DEPENDENCY_VIOLATION',
          validationErrors: picklistErrors
        });
      }
    }

    if (
      previous
      && Object.prototype.hasOwnProperty.call(updateData, 'assignedTo')
      && String(updateData.assignedTo || '') !== String(previous.assignedTo || '')
      && updateData.assignedTo
    ) {
      const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
      const assignCheck = await validateRecordAssignmentRequest(req, updateData.assignedTo, { skipSelf: true });
      if (assignCheck) {
        return res.status(assignCheck.status).json(assignCheck.body);
      }
    }

    // Redirect type / sales_type / lead_status / contact_status / helpdesk_role → participations (source of truth)
    const {
      setSalesParticipationIn,
      extractSalesFromUpdate,
      extractHelpdeskRoleFromUpdate,
      mergeHelpdeskRoleIntoParticipations
    } = require('../utils/syncSalesParticipation');
    const { helpdeskRole, cleaned: afterHelpdesk, touched: helpdeskTouched } = extractHelpdeskRoleFromUpdate(updateData);
    const { sales, cleaned: updateDataWithoutSales } = extractSalesFromUpdate(afterHelpdesk);
    const hasSalesWrite =
      sales != null &&
      (sales.role != null || sales.lead_status != null || sales.contact_status != null);

    // Push previous description to native descriptionVersions before updating.
    if (Object.prototype.hasOwnProperty.call(updateData, 'description')) {
      try {
        const prevDesc = String(previous?.description ?? previous?.customFields?.description ?? '');
        const nextDesc = String(updateData.description ?? '');
        if (prevDesc !== nextDesc) {
          await People.updateOne(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
            {
              $push: {
                descriptionVersions: {
                  content: prevDesc,
                  createdAt: new Date(),
                  createdBy: req.user._id
                }
              }
            }
          );
        }
      } catch (versionErr) {
        console.warn('Description version push (people) failed:', versionErr?.message || versionErr);
      }
    }

    const { buildUpdateWithCustomFields } = require('../utils/customFieldsExtractor');
    let $set = buildUpdateWithCustomFields(updateDataWithoutSales, People);

    // Cross-field last_name validation reads first_name via Query#get during findOneAndUpdate.
    // If the client omits first_name, merge the stored value so validators see both name parts.
    if (
      previous &&
      Object.prototype.hasOwnProperty.call($set, 'last_name') &&
      !Object.prototype.hasOwnProperty.call($set, 'first_name')
    ) {
      $set.first_name = previous.first_name;
    }

    // Write SALES / HELPDESK to participations only (do not set type/lead_status/contact_status on document root)
    if (hasSalesWrite || helpdeskTouched) {
      let nextParticipations = { ...(previous?.participations || {}) };
      if (hasSalesWrite) {
        const prevSales = previous ? getSalesParticipationValues(previous) : {};
        const mergedSales = {
          role: sales.role ?? prevSales.role ?? null,
          lead_status: sales.lead_status ?? prevSales.lead_status ?? null,
          contact_status: sales.contact_status ?? prevSales.contact_status ?? null
        };
        nextParticipations = setSalesParticipationIn(nextParticipations, mergedSales);
      }
      if (helpdeskTouched) {
        nextParticipations = mergeHelpdeskRoleIntoParticipations(nextParticipations, helpdeskRole);
      }
      $set.participations = nextParticipations;
    }

    const updated = await People.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
      { $set },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });

    // Keep relationship instances aligned when People.organization is edited directly.
    if (Object.prototype.hasOwnProperty.call(updateData, 'organization')) {
      try {
        await syncPeopleOrganizationRelationship({
          tenantOrganizationId: req.user.organizationId,
          personId: req.params.id,
          organizationValue: updated.organization,
          userId: req.user._id
        });
      } catch (syncErr) {
        console.warn('[PeopleController] Failed to sync people_organizations relationship:', syncErr?.message || syncErr);
      }
    }
    
    try {
      const { emitPeopleEvents } = require('../services/domainEventHelpers');
      emitPeopleEvents({
        previous,
        current: updated.toObject ? updated.toObject() : updated,
        appKey,
        triggeredBy: req.user?._id ?? null,
        organizationId: req.user?.organizationId ?? null
      });
    } catch (emitErr) {
      console.error('[peopleController] emitPeopleEvents on update failed:', emitErr?.message || emitErr);
    }
    
    // Compute derived status if lifecycle/type fields changed
    if (shouldComputeDerivedStatus) {
      const computedDerivedStatus = await computeAndSetDerivedStatus('people', updated, appKey);
      
      // If config exists and derivedStatus was computed, write to participations (not top-level)
      const configExists = await hasConfiguration('people', appKey);
      if (configExists && computedDerivedStatus) {
        const { role, lead_status, contact_status } = getSalesParticipationValues(updated);
        const resolvedType = role;
        const resolvedLeadStatus = lead_status;
        const resolvedContactStatus = contact_status;
        let participationsChanged = false;
        if (resolvedType === 'Lead' && resolvedLeadStatus !== computedDerivedStatus) {
          updated.participations = setSalesParticipationIn(updated.participations || {}, {
            role,
            lead_status: computedDerivedStatus,
            contact_status
          });
          participationsChanged = true;
        } else if (resolvedType === 'Contact' && resolvedContactStatus !== computedDerivedStatus) {
          updated.participations = setSalesParticipationIn(updated.participations || {}, {
            role,
            lead_status,
            contact_status: computedDerivedStatus
          });
          participationsChanged = true;
        }
        if (participationsChanged) updated.markModified('participations');
      }

      // Save if derivedStatus or participations was updated
      if (updated.derivedStatus !== undefined && updated.isModified('derivedStatus')) {
        await updated.save();
      } else if (updated.isModified('participations')) {
        await updated.save();
      }
    }
    
    // Log field-level changes to RecordActivity for ModuleRecordPage Activity panel (Updates tab)
    try {
      const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
      const updatedObj = updated.toObject ? updated.toObject() : updated;
      const prevObj = previous || {};
      await appendFieldChangeLogs({
        organizationId: req.user.organizationId,
        moduleKey: 'people',
        recordId: req.params.id,
        authorId: req.user._id,
        previous: prevObj,
        updated: updatedObj,
        updateDataKeys: [
          ...Object.keys(updateDataWithoutSales),
          ...((hasSalesWrite || helpdeskTouched) ? ['participations'] : [])
        ],
        fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
      });
    } catch (logErr) {
      console.warn('Record activity log (people update) failed:', logErr?.message || logErr);
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const changedFieldKeys = [
        ...Object.keys(updateDataWithoutSales),
        ...(hasSalesWrite || helpdeskTouched ? ['participations'] : [])
      ];
      const assignDoc = await People.findById(updated._id);
      if (assignDoc) {
        await runImmediateAssignmentForSalesRecord({
          record: assignDoc,
          moduleKey: 'people',
          appKey: req.appKey || req.query.appKey || 'SALES',
          actorId: req.user._id,
          triggerSource: 'immediate',
          changedFields: changedFieldKeys
        });
        await enqueueAssignmentJobsForSalesRecord({
          record: assignDoc,
          moduleKey: 'people',
          actorId: req.user._id,
          changedFields: changedFieldKeys
        });
      }
    } catch (assignErr) {
      console.error('[peopleController] assignment on update failed:', assignErr?.message || assignErr);
    }

    // Re-fetch with populated fields to ensure populate works correctly
    const populatedRecord = await People.findById(updated._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('lead_owner', 'firstName lastName email avatar username')
      .populate('organization', 'name');
    
    // Debug: Check if assignedTo is populated
    console.log('✅ Updated People record:', {
      id: populatedRecord._id,
      organization: populatedRecord.organization,
      organizationType: typeof populatedRecord.organization,
      assignedTo: populatedRecord.assignedTo,
      assignedToType: typeof populatedRecord.assignedTo,
      assignedToIsObject: populatedRecord.assignedTo && typeof populatedRecord.assignedTo === 'object' && !Array.isArray(populatedRecord.assignedTo),
      assignedToKeys: populatedRecord.assignedTo && typeof populatedRecord.assignedTo === 'object' ? Object.keys(populatedRecord.assignedTo) : null
    });
    
    res.json({ success: true, data: flattenPeopleForResponse(populatedRecord) });
  } catch (error) {
    console.error('❌ Error updating People record:', error);
    res.status(400).json({ success: false, message: 'Error updating record', error: error.message });
  }
};

// Delete (move to trash)
exports.remove = async (req, res) => {
  try {
    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'people',
      recordId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      appKey: req.body?.appKey || 'SALES',
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed
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
        message: result.message || 'Failed to delete record'
      });
    }
    res.json({ success: true, data: req.params.id, message: 'Moved to trash', retentionExpiresAt: result.retentionExpiresAt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting record', error: error.message });
  }
};

// Get activity logs for a person
exports.getActivityLogs = async (req, res) => {
  try {
    const person = await People.findOne({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId,
      deletedAt: null
    }).select('activityLogs');
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found or access denied'
      });
    }
    
    // Sort by timestamp (newest first)
    const logs = (person.activityLogs || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Enrich logs with user information from userId
    const User = require('../models/User');
    const userIds = [...new Set(logs.map(log => log.userId).filter(id => id))];
    
    let usersMap = {};
    if (userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } })
        .select('firstName lastName username email')
        .lean();
      
      usersMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});
    }
    
    // Enrich logs with user information
    const enrichedLogs = logs.map(log => {
      const enrichedLog = { ...log.toObject ? log.toObject() : log };
      
      // If user field is an ObjectId string, try to resolve it from userId
      if (log.userId && usersMap[log.userId.toString()]) {
        const user = usersMap[log.userId.toString()];
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        // If user field looks like an ObjectId (24 hex chars), replace it with username
        if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
          enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
        } else if (!enrichedLog.user || enrichedLog.user === '') {
          // If user field is empty, use the resolved user info
          enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
        }
      } else if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
        // If user field is an ObjectId but we couldn't resolve it, use a fallback
        enrichedLog.user = 'Unknown User';
      }
      
      return enrichedLog;
    });
    
    res.status(200).json({
      success: true,
      data: enrichedLogs
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

// Add activity log to a person
exports.addActivityLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    
    if (!user || !action) {
      return res.status(400).json({
        success: false,
        message: 'User and action are required'
      });
    }
    
    const person = await People.findOneAndUpdate(
      { 
        _id: req.params.id, 
        organizationId: req.user.organizationId,
        deletedAt: null
      },
      {
        $push: {
          activityLogs: {
            user: user,
            userId: req.user._id,
            action: action,
            details: details || null,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found or access denied'
      });
    }
    
    // Return the newly added log
    const newLog = person.activityLogs[person.activityLogs.length - 1];
    
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

exports.getPersonLiveChatSession = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid person id' });
    }

    const row = await People.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null,
    }).lean();

    if (!row) {
      return res.status(404).json({ success: false, message: 'Person not found' });
    }

    const { getLiveChatSummaryForPerson } = require('../services/liveChatCrmAdapter');
    const summary = await getLiveChatSummaryForPerson({
      organizationId: req.user.organizationId,
      personRecord: row,
    });

    return res.json({ success: true, data: summary ?? null });
  } catch (error) {
    console.error('[peopleController] getPersonLiveChatSession error', error);
    return res.status(500).json({ success: false, message: 'Failed to load live chat session summary' });
  }
};

exports.listMeta = async (req, res) => {
  try {
    const query = await buildPeopleListQuery(req);
    const meta = await fetchListMeta(People, query);
    sendListMetaResponse(res, meta);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('[peopleController.listMeta] error', error);
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch people list meta',
    });
  }
};
