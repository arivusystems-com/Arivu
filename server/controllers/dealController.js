const Deal = require('../models/Deal');
const DealComment = require('../models/DealComment');
const People = require('../models/People');
const Task = require('../models/Task');
const ImportHistory = require('../models/ImportHistory');
const FormResponse = require('../models/FormResponse');
const User = require('../models/User');
const mongoose = require('mongoose');
const { buildDealsListQuery } = require('../utils/listQueryBuilders/dealsListQuery');
const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
const { fetchRecordUpdatedAtMeta, sendRecordMetaResponse } = require('../utils/recordMetaService');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const { processCommentMentions } = require('../services/commentMentionNotifications');
const {
  computeAndSetDerivedStatus,
  hasLifecycleOrTypeChanged,
} = require('../services/derivedStatusService');
const { validateStageInPipeline, validateDealRelationships } = require('../services/systemInvariants');
const {
  syncLegacyToRoleBased,
  syncRoleBasedToLegacy
} = require('../services/dealRelationshipService');
const { syncDealRelationshipInstances } = require('../services/dealRelationshipInstanceSync');
const { getDefaultPipelineSettings } = require('./moduleController');
const {
  isDealEngagementAction,
  touchDealLastActivity,
  attachDealLastActivity,
} = require('../utils/dealLastActivity');

const DESCRIPTION_VERSION_RETENTION_DAYS = 365;
const CLOSED_TASK_STATUSES = ['completed', 'done', 'closed', 'cancelled'];

const getTrendConfig = (range = '12w') => {
    const normalized = String(range || '').toLowerCase();
    if (normalized === '6m') {
        return {
            key: '6m',
            bucketDays: 15,
            buckets: 12,
            closeSoonDays: 21,
            staleDays: 21,
            responseLookbackDays: 14,
            importLookbackDays: 45,
            priorityThresholds: { high: 10, medium: 5 }
        };
    }
    if (normalized === '12m') {
        return {
            key: '12m',
            bucketDays: 30,
            buckets: 12,
            closeSoonDays: 30,
            staleDays: 30,
            responseLookbackDays: 21,
            importLookbackDays: 60,
            priorityThresholds: { high: 12, medium: 6 }
        };
    }
    return {
        key: '12w',
        bucketDays: 7,
        buckets: 12,
        closeSoonDays: 14,
        staleDays: 14,
        responseLookbackDays: 7,
        importLookbackDays: 30,
        priorityThresholds: { high: 8, medium: 3 }
    };
};

const mapPriority = (count, highThreshold, mediumThreshold) => {
    if (count >= highThreshold) return 'High';
    if (count >= mediumThreshold) return 'Medium';
    return 'Low';
};

const parseCsvParam = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    return String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
};

const toObjectIdOrNull = (value) => {
    if (!value) return null;
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const getActorDisplayName = (user) => {
        if (!user) return 'Unknown User';
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName || user.username || user.email || String(user._id || 'Unknown User');
};

const DEAL_FIELD_LABELS = {
    name: 'name',
    amount: 'amount',
    currency: 'currency',
    pipeline: 'pipeline',
    stage: 'stage',
    probability: 'probability',
    expectedCloseDate: 'expected close date',
    actualCloseDate: 'actual close date',
    contactId: 'contact',
    accountId: 'organization',
    assignedTo: 'owner',
    description: 'description',
    type: 'type',
    source: 'source',
    nextStep: 'next step',
    status: 'status',
    lostReason: 'lost reason',
    tags: 'tags',
    priority: 'priority',
    nextFollowUpDate: 'next follow-up date'
};

const DEAL_SYSTEM_FIELDS = ['id', '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'modifiedBy', 'playbookState'];

const normalizeDealComparableValue = (value) => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'object' && typeof value.toObject === 'function') {
        try {
            return normalizeDealComparableValue(value.toObject({
                depopulate: true,
                virtuals: false,
                getters: false,
                flattenMaps: true
            }));
        } catch (_) {}
    }

    if (Array.isArray(value)) return value.map(normalizeDealComparableValue);
    if (typeof value === 'object') {
        if (typeof value.toHexString === 'function') return String(value.toHexString());
        if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return String(value);

        const normalized = {};
        Object.keys(value).sort().forEach((key) => {
            if (key === '__v') return;
            normalized[key] = normalizeDealComparableValue(value[key]);
        });
        return normalized;
    }

    return value;
};

const areDealFieldValuesEqual = (a, b) => (
    JSON.stringify(normalizeDealComparableValue(a)) === JSON.stringify(normalizeDealComparableValue(b))
);

const formatDealDateForLog = (value) => {
    if (!value) return 'Empty';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Empty';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatDealEntityValueForLog = (value) => {
    if (!value) return 'Empty';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        return value.name
            || [value.first_name, value.last_name].filter(Boolean).join(' ').trim()
            || [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
            || value.email
            || String(value._id || value.id || 'Empty');
    }
    return String(value);
};

const formatDealFieldValueForLog = (field, value, userNameById = {}) => {
    if (value === undefined || value === null || value === '') return 'Empty';

    switch (field) {
        case 'amount': {
            const num = Number(value);
            return Number.isFinite(num) ? `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : String(value);
        }
        case 'probability': {
            const num = Number(value);
            return Number.isFinite(num) ? `${Math.round(num)}%` : String(value);
        }
        case 'expectedCloseDate':
        case 'actualCloseDate':
        case 'nextFollowUpDate':
            return formatDealDateForLog(value);
        case 'assignedTo': {
            const rawId = typeof value === 'object' ? (value._id || value.id) : value;
            const id = rawId ? String(rawId) : '';
            if (id && userNameById[id]) return userNameById[id];
            return formatDealEntityValueForLog(value);
        }
        case 'contactId':
        case 'accountId':
            return formatDealEntityValueForLog(value);
        case 'tags':
            return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Empty';
        case 'dealPeople':
        case 'dealOrganizations':
            return Array.isArray(value) ? `${value.length} linked` : 'Empty';
        default:
            return String(value);
    }
};

const buildDealFieldChangeLogEntry = ({ actorName, actorId, field, oldValue, newValue, userNameById = {} }) => {
    const from = formatDealFieldValueForLog(field, oldValue, userNameById);
    const to = formatDealFieldValueForLog(field, newValue, userNameById);
    if (from === to) return null;

    return {
        user: actorName,
        userId: actorId,
        action: field === 'stage' ? 'changed stage' : 'field_changed',
        details: {
            field,
            fieldLabel: DEAL_FIELD_LABELS[field] || field,
            from,
            to
        },
        timestamp: new Date()
    };
};

// @desc    Create new deal
// @route   POST /api/deals
// @access  Private
exports.createDeal = async (req, res) => {
    try {
        const { stripClientSource, assignResolvedSource } = require('../services/sourceResolver');
        stripClientSource(req.body);
        const appKey = req.appKey || req.query.appKey || 'SALES';
        const payload = {
            ...req.body,
            organizationId: req.user.organizationId,
            assignedTo: req.body.assignedTo || req.user._id,
            createdBy: req.user._id,
            modifiedBy: req.user._id,
            activityLogs: [{
                user: getActorDisplayName(req.user),
                userId: req.user._id,
                action: 'created',
                details: {},
                timestamp: new Date()
            }]
        };

        const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
        const ownerAssignCheck = await validateRecordAssignmentRequest(req, payload.assignedTo, { skipSelf: true });
        if (ownerAssignCheck) {
            return res.status(ownerAssignCheck.status).json(ownerAssignCheck.body);
        }

        {
            const ModuleDefinition = require('../models/ModuleDefinition');
            const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
            const moduleDef = await ModuleDefinition.findOne({
                organizationId: req.user.organizationId,
                key: 'deals'
            }).lean();
            if (moduleDef && Array.isArray(moduleDef.fields)) {
                const picklistErrors = validatePicklistDependencyValues(moduleDef.fields, payload);
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

        // Status is platform-owned — strip client-supplied values; derivation sets Open|Won|Lost
        delete payload.status;
        delete payload.probability;
        delete payload.derivedStatus;

        // Legacy Mixed field removed — DealLine entity owns commercial lines
        delete payload.lineItems;

        // amountMode transitions + amount sync owned by DealPricingService (not raw create body mix)
        const dealPricingService = require('../services/dealPricingService');
        const { normalizeDealAmountMode, DEAL_AMOUNT_MODE, DEFAULT_DEAL_AMOUNT_MODE } = require('../constants/dealAmountMode');
        const requestedAmountMode = normalizeDealAmountMode(payload.amountMode) || DEFAULT_DEAL_AMOUNT_MODE;
        const createLines = Array.isArray(payload.lines) ? payload.lines : null;
        delete payload.lines;

        if (requestedAmountMode === DEAL_AMOUNT_MODE.AUTO && payload.amount !== undefined && createLines?.length) {
            // AUTO with lines: ignore client amount; service will set after lines
            delete payload.amount;
        }
        if (requestedAmountMode === DEAL_AMOUNT_MODE.AUTO && payload.amount !== undefined && !createLines?.length) {
            return res.status(400).json({
                success: false,
                code: 'AMOUNT_MODE_CONFLICT',
                message: 'amountMode=AUTO requires DealLines (or omit amount and add lines after create). Do not send amount with AUTO.'
            });
        }
        payload.amountMode = requestedAmountMode;
        if (payload.amount === undefined || payload.amount === null || payload.amount === '') {
            payload.amount = 0;
        }

        // Every deal must have pipeline and stage. Auto-assign default when missing so user is not forced to pick.
        if (!payload.pipeline || !payload.stage) {
            const defaultSettings = getDefaultPipelineSettings();
            const defaultPipeline = defaultSettings.find((p) => p.isDefault) || defaultSettings[0];
            if (defaultPipeline && Array.isArray(defaultPipeline.stages) && defaultPipeline.stages.length) {
                payload.pipeline = payload.pipeline || defaultPipeline.key;
                payload.stage = payload.stage || (defaultPipeline.stages[0].name || 'New');
            }
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            organizationId: req.user.organizationId,
            updateData: payload,
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        if (!payload.status) payload.status = 'Open';

        // Currency defaults to tenant org settings; must be base or an enabled currency
        try {
            const { resolveCurrencyOrOrgDefault } = require('../utils/orgCurrency');
            payload.currency = await resolveCurrencyOrOrgDefault(payload.currency, req.user.organizationId);
        } catch (currencyErr) {
            if (currencyErr?.code === 'CURRENCY_NOT_ENABLED') {
                return res.status(400).json({
                    success: false,
                    code: currencyErr.code,
                    message: currencyErr.message
                });
            }
            throw currencyErr;
        }

        assignResolvedSource(payload, 'ui');
        // New deals appear at top of the kanban column (stageOrder asc).
        delete payload.stageOrder;
        payload.stageOrder = 0;
        if (payload.stage) {
            await Deal.updateMany(
                {
                    organizationId: req.user.organizationId,
                    stage: payload.stage,
                    deletedAt: null
                },
                { $inc: { stageOrder: 1 } }
            );
        }

        try {
            const { evaluateDuplicates } = require('../services/duplicates');
            const dupResult = await evaluateDuplicates({
                organizationId: req.user.organizationId,
                moduleKey: 'deals',
                candidate: payload,
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
                        message: 'A matching Deal already exists.',
                        data: { matches: dupResult.matches, policy },
                    });
                }
            }
        } catch (dupErr) {
            console.warn('[dealController.createDeal] duplicate check failed:', dupErr.message);
        }

        const newDeal = await Deal.create(payload);

        await syncLegacyToRoleBased(newDeal, req.user._id);

        const relationshipResult = await validateDealRelationships({
            moduleKey: 'deals',
            recordId: newDeal._id,
            organizationId: req.user.organizationId,
            updateData: newDeal.toObject()
        });
        if (!relationshipResult.valid) {
            await Deal.findByIdAndDelete(newDeal._id);
            return res.status(400).json({
                success: false,
                code: relationshipResult.code,
                message: relationshipResult.message,
                errors: relationshipResult.errors
            });
        }

        if (createLines?.length) {
            try {
                for (const lineInput of createLines) {
                    await dealPricingService.addLine({
                        organizationId: req.user.organizationId,
                        dealId: newDeal._id,
                        actorId: req.user._id,
                        input: lineInput
                    });
                }
                const priced = await Deal.findById(newDeal._id);
                if (priced) {
                    newDeal.amount = priced.amount;
                    newDeal.amountMode = priced.amountMode;
                    newDeal.linesGrandTotal = priced.linesGrandTotal;
                }
            } catch (lineErr) {
                await dealPricingService.softDeleteLinesForDeal({
                    organizationId: req.user.organizationId,
                    dealId: newDeal._id,
                    actorId: req.user._id
                });
                await Deal.findByIdAndDelete(newDeal._id);
                const status = lineErr.status || 400;
                return res.status(status).json({
                    success: false,
                    code: lineErr.code || 'DEAL_LINE_CREATE_FAILED',
                    message: lineErr.message || 'Failed to create deal lines'
                });
            }
        } else if (requestedAmountMode === DEAL_AMOUNT_MODE.AUTO) {
            await dealPricingService.recalculateDeal({
                organizationId: req.user.organizationId,
                dealId: newDeal._id,
                actorId: req.user._id
            });
            const priced = await Deal.findById(newDeal._id);
            if (priced) {
                newDeal.amount = priced.amount;
                newDeal.linesGrandTotal = priced.linesGrandTotal;
            }
        }

        const { normalizeDealStatus, DEAL_STATUS } = require('../constants/dealStatus');
        const computedDerivedStatus = await computeAndSetDerivedStatus('deal', newDeal, appKey);
        if (computedDerivedStatus) {
            newDeal.status = normalizeDealStatus(computedDerivedStatus);
        } else if (!newDeal.status) {
            newDeal.status = DEAL_STATUS.OPEN;
        } else {
            newDeal.status = normalizeDealStatus(newDeal.status);
        }

        await syncRoleBasedToLegacy(newDeal);

        try {
            const { executePlaybookForDeal } = require('../services/playbookExecutionService');
            await executePlaybookForDeal(newDeal, {
                actorId: req.user._id,
                organizationId: req.user.organizationId
            });
        } catch (playbookErr) {
            console.error('[dealController] playbook on create failed:', playbookErr?.message || playbookErr);
        }
        
        if (
            newDeal.isModified('dealPeople') ||
            newDeal.isModified('dealOrganizations') ||
            newDeal.isModified('contactId') ||
            newDeal.isModified('accountId') ||
            newDeal.isModified('derivedStatus') ||
            newDeal.isModified('status') ||
            newDeal.isModified('probability') ||
            newDeal.isModified('playbookState')
        ) {
            await newDeal.save();
        }

        await syncDealRelationshipInstances({
            organizationId: req.user.organizationId,
            dealDoc: newDeal,
            createdBy: req.user._id,
            peopleMode: 'replace',
            organizationsMode: 'replace'
        });

        try {
            const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
            const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
            const freshDeal = await Deal.findById(newDeal._id);
            if (freshDeal) {
                await runImmediateAssignmentForSalesRecord({
                    record: freshDeal,
                    moduleKey: 'deals',
                    actorId: req.user._id,
                    triggerSource: 'immediate',
                    changedFields: []
                });
                await enqueueAssignmentJobsForSalesRecord({
                    record: freshDeal,
                    moduleKey: 'deals',
                    actorId: req.user._id,
                    changedFields: []
                });
            }
        } catch (assignErr) {
            console.error('[dealController] assignment on create failed:', assignErr?.message || assignErr);
        }

        const deal = await Deal.findById(newDeal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        const { emitDealEvents } = require('../services/domainEventHelpers');
        await emitDealEvents({
            previous: null,
            current: deal?.toObject ? deal.toObject() : deal,
            appKey,
            triggeredBy: req.user?._id ?? null,
            organizationId: req.user?.organizationId ?? null
        });

        res.status(201).json({ success: true, data: attachDealLastActivity(deal) });
    } catch (error) {
        console.error('Create deal error:', error);
        res.status(400).json({
            success: false,
            message: 'Error creating deal.',
            error: error.message
        });
    }
};

/** Combine list filter with an extra predicate for facet counts */
function dealsQueryAnd(baseQuery, clause) {
    if (!baseQuery || Object.keys(baseQuery).length === 0) {
        return clause;
    }
    return { $and: [baseQuery, clause] };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Matches client registry keys: pipelineValue, activeDeals, wonValue, winRate, totalDeals, myDeals.
 */
async function computeDealsListStatistics(query, userId) {
    const uid =
        mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const { castMatchQueryForAggregate } = require('../utils/searchRelevance');
    const matchQuery = castMatchQueryForAggregate(Deal, query);

    const [aggRows, myDeals] = await Promise.all([
        Deal.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    pipelineValue: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$status', 'Won'] }, { $ne: ['$status', 'Lost'] }] },
                                { $ifNull: ['$amount', 0] },
                                0
                            ]
                        }
                    },
                    activeDeals: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$status', 'Won'] }, { $ne: ['$status', 'Lost'] }] },
                                1,
                                0
                            ]
                        }
                    },
                    wonValue: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Won'] }, { $ifNull: ['$amount', 0] }, 0]
                        }
                    },
                    wonCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    }
                }
            }
        ]),
        uid ? Deal.countDocuments(dealsQueryAnd(query, { assignedTo: uid })) : Promise.resolve(0)
    ]);

    const row = aggRows[0] || {
        pipelineValue: 0,
        activeDeals: 0,
        wonValue: 0,
        wonCount: 0,
        lostCount: 0
    };
    const totalClosed = (row.wonCount || 0) + (row.lostCount || 0);
    const winRate = totalClosed > 0 ? Math.round((row.wonCount / totalClosed) * 100) : 0;

    return {
        pipelineValue: row.pipelineValue || 0,
        activeDeals: row.activeDeals || 0,
        wonValue: row.wonValue || 0,
        winRate,
        myDeals
    };
}

// @desc    Get all deals
// @route   GET /api/deals
// @access  Private
exports.getDeals = async (req, res) => {
    try {
        const query = buildDealsListQuery(req);
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const { parseListSort } = require('../utils/parseListSort');
        const { sorts, sortObject: parsedSort } = parseListSort(req.query, {
            defaultField: 'createdAt',
            defaultOrder: 'desc',
            tieBreaker: '_id'
        });
        // Stage list order uses stageOrder as secondary when sorting by stage.
        let sort = parsedSort;
        if (sorts[0]?.field === 'stage') {
            const { stage, ...rest } = parsedSort;
            sort = { stage, stageOrder: 1, ...rest };
        }
        
        const dealPopulate = [
            { path: 'contactId', select: 'first_name last_name email' },
            { path: 'assignedTo', select: 'firstName lastName email' },
            { path: 'accountId', select: 'name' },
            { path: 'dealPeople.personId', select: 'first_name last_name email' },
            { path: 'dealOrganizations.organizationId', select: 'name' }
        ];
        const { resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
        const searchTerm = resolveListSearchTerm(req.query, 'deals');
        const deals = isSearchActive(searchTerm)
            ? await fetchRankedSearchPage(Deal, {
                matchQuery: query,
                searchTerm,
                fieldSpecs: SEARCH_FIELD_PRESETS.deals,
                skip,
                limit,
                fallbackSort: sort,
                populate: dealPopulate,
                lean: false
            })
            : await Deal.find(query)
                .populate('contactId', 'first_name last_name email')
                .populate('assignedTo', 'firstName lastName email')
                .populate('accountId', 'name')
                .populate('dealPeople.personId', 'first_name last_name email')
                .populate('dealOrganizations.organizationId', 'name')
                .sort(sort)
                .limit(limit)
                .skip(skip);
        
        try {
            const { refreshPlaybookStatesForDealList } = require('../services/playbookExecutionService');
            await refreshPlaybookStatesForDealList(deals, req.user.organizationId);
        } catch (playbookErr) {
            console.error('[dealController] playbook refresh on list failed:', playbookErr?.message || playbookErr);
        }

        // Full-query KPIs for ModuleList cards (same filter as list rows).
        const [total, listCardBreakdown] = await Promise.all([
            Deal.countDocuments(query),
            computeDealsListStatistics(query, req.user._id)
        ]);

        const legacyStats = {
            totalDeals: total,
            activeDeals: listCardBreakdown.activeDeals || 0,
            stalledDeals: 0,
            wonDeals: 0,
            lostDeals: 0,
            totalValue: 0,
            wonValue: listCardBreakdown.wonValue || 0,
            pipelineValue: listCardBreakdown.pipelineValue || 0
        };
        
        res.status(200).json({
            success: true,
            data: (deals || []).map((deal) => attachDealLastActivity(deal)),
            pagination: {
                currentPage: page,
                limit,
                totalDeals: total,
                totalRecords: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: legacyStats,
            listStatistics: {
                totalDeals: total,
                ...listCardBreakdown
            }
        });
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deals.', 
            error: error.message 
        });
    }
};

// @desc    Get single deal
// @route   GET /api/deals/:id
// @access  Private
exports.getDealById = async (req, res) => {
    try {
        const deal = await Deal.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId,
            deletedAt: null
        })
        .populate('contactId', 'first_name last_name email phone')
        .populate('assignedTo', 'firstName lastName email')
        .populate('accountId', 'name industry')
        .populate('dealPeople.personId', 'first_name last_name email phone')
        .populate('dealOrganizations.organizationId', 'name industry')
        .populate('notes.createdBy', 'firstName lastName')
        .populate('stageHistory.changedBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({ 
                success: false,
                message: 'Deal not found or access denied.' 
            });
        }

        try {
            const { refreshPlaybookStateFromActivities } = require('../services/playbookExecutionService');
            const playbookChanged = await refreshPlaybookStateFromActivities(deal);
            if (playbookChanged) {
                await deal.save();
            }
        } catch (playbookErr) {
            console.error('[dealController] playbook refresh on get failed:', playbookErr?.message || playbookErr);
        }
        
        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        res.status(200).json({
            success: true,
            data: attachDealLastActivity(flattenCustomFieldsForResponse(deal))
        });
    } catch (error) {
        console.error('Get deal error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deal.', 
            error: error.message 
        });
    }
};

// @desc    Update deal
// @route   PUT /api/deals/:id
// @access  Private
exports.updateDeal = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.id;
        delete req.body.organizationId;
        delete req.body.source;
        req.body.modifiedBy = req.user._id;
        
        // Validate field-level write access
        const ModuleDefinition = require('../models/ModuleDefinition');
        const { validateFieldWrite } = require('../utils/fieldAccessControl');
        
        const moduleDef = await ModuleDefinition.findOne({
            organizationId: req.user.organizationId,
            key: 'deals'
        });
        
        if (moduleDef && Array.isArray(moduleDef.fields)) {
            const fieldViolations = [];
            const fieldsToUpdate = { ...req.body };
            
            // Validate each field being updated
            for (const [fieldKey, fieldValue] of Object.entries(fieldsToUpdate)) {
                // Skip system fields and metadata
                if (DEAL_SYSTEM_FIELDS.includes(fieldKey)) {
                    continue;
                }
                // Tags are a shared record-page capability and must remain editable
                // even if module field metadata does not explicitly define them.
                if (fieldKey === 'tags') {
                    continue;
                }
                
                const validation = validateFieldWrite(fieldKey, moduleDef.fields, req.user, 'deals');
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

            const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
            const previousForPicklist = await Deal.findOne(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
            ).lean();
            const mergedForPicklist = {
                ...(previousForPicklist || {}),
                ...fieldsToUpdate,
                customFields: {
                    ...((previousForPicklist && previousForPicklist.customFields) || {}),
                    ...(fieldsToUpdate.customFields || {})
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

        // Fast path: tags-only update should not be blocked by unrelated
        // lifecycle/stage validators. This keeps tag add/remove reliable.
        const nonSystemKeys = Object.keys(req.body || {}).filter((fieldKey) => !DEAL_SYSTEM_FIELDS.includes(fieldKey));
        if (nonSystemKeys.length === 1 && nonSystemKeys[0] === 'tags') {
            const nextTags = Array.isArray(req.body.tags)
                ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
                : [];
            const updatedForTags = await Deal.findOneAndUpdate(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
                {
                    $set: { tags: nextTags, modifiedBy: req.user._id },
                    $unset: { 'customFields.tags': 1 }
                },
                { new: true, runValidators: true }
            )
                .populate('contactId', 'first_name last_name email')
                .populate('assignedTo', 'firstName lastName email')
                .populate('accountId', 'name industry')
                .populate('dealPeople.personId', 'first_name last_name email')
                .populate('dealOrganizations.organizationId', 'name');

            if (!updatedForTags) {
                return res.status(404).json({
                    success: false,
                    message: 'Deal not found or access denied.'
                });
            }

            const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
            return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(updatedForTags) });
        }
        
        const appKey = req.appKey || req.query.appKey || 'SALES';

        // Status/probability are platform-owned — ignore client values; stage derivation owns them
        if (req.body && typeof req.body === 'object') {
            delete req.body.status;
            delete req.body.probability;
            delete req.body.derivedStatus;
            delete req.body.lineItems;
            delete req.body.lines;
            delete req.body.linesGrandTotal;
        }

        // amountMode / amount owned by DealPricingService — explicit transitions only
        const dealPricingService = require('../services/dealPricingService');
        const { normalizeDealAmountMode, DEAL_AMOUNT_MODE } = require('../constants/dealAmountMode');
        const bodyHasAmountMode = Object.prototype.hasOwnProperty.call(req.body || {}, 'amountMode');
        const bodyHasAmount = Object.prototype.hasOwnProperty.call(req.body || {}, 'amount');
        const requestedAmountMode = bodyHasAmountMode ? normalizeDealAmountMode(req.body.amountMode) : null;

        if (bodyHasAmountMode && !requestedAmountMode) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_AMOUNT_MODE',
                message: 'amountMode must be AUTO or MANUAL'
            });
        }

        if (bodyHasAmountMode && requestedAmountMode === DEAL_AMOUNT_MODE.AUTO && bodyHasAmount) {
            return res.status(400).json({
                success: false,
                code: 'AMOUNT_MODE_CONFLICT',
                message: 'Cannot set amount and amountMode=AUTO in the same request. PATCH amount-mode first.'
            });
        }

        if (bodyHasAmountMode) {
            try {
                await dealPricingService.setAmountMode({
                    organizationId: req.user.organizationId,
                    dealId: req.params.id,
                    amountMode: requestedAmountMode,
                    amount: bodyHasAmount && requestedAmountMode === DEAL_AMOUNT_MODE.MANUAL
                        ? req.body.amount
                        : undefined,
                    actorId: req.user._id
                });
            } catch (modeErr) {
                if (modeErr.code) {
                    return res.status(modeErr.status || 400).json({
                        success: false,
                        code: modeErr.code,
                        message: modeErr.message
                    });
                }
                throw modeErr;
            }
            delete req.body.amountMode;
            delete req.body.amount;
        } else if (bodyHasAmount) {
            try {
                await dealPricingService.setManualAmount({
                    organizationId: req.user.organizationId,
                    dealId: req.params.id,
                    amount: req.body.amount,
                    actorId: req.user._id
                });
            } catch (amtErr) {
                if (amtErr.code) {
                    return res.status(amtErr.status || 400).json({
                        success: false,
                        code: amtErr.code,
                        message: amtErr.message
                    });
                }
                throw amtErr;
            }
            delete req.body.amount;
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: req.body,
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        const shouldComputeDerivedStatus = hasLifecycleOrTypeChanged('deal', null, req.body);

        let previousDeal = null;
        if (shouldComputeDerivedStatus) {
            previousDeal = await Deal.findOne(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
            ).lean();
        }

        let previousDescriptionForVersion = null;
        let previousDescriptionExists = false;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            const existingDealForDescription = await Deal.findOne(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
            ).select('description');
            if (existingDealForDescription) {
                previousDescriptionExists = true;
                previousDescriptionForVersion = existingDealForDescription.description;
            }
        }

        const requestedFields = Object.keys(req.body || {}).filter((fieldKey) => !DEAL_SYSTEM_FIELDS.includes(fieldKey));
        const touchedDealPeople = Object.prototype.hasOwnProperty.call(req.body || {}, 'dealPeople');
        const touchedDealOrganizations = Object.prototype.hasOwnProperty.call(req.body || {}, 'dealOrganizations');
        const touchedLegacyContact = Object.prototype.hasOwnProperty.call(req.body || {}, 'contactId');
        const touchedLegacyAccount = Object.prototype.hasOwnProperty.call(req.body || {}, 'accountId');

        const existingDealForChanges = await Deal.findOne(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName username email')
            .populate('accountId', 'name')
            .lean();
        if (!existingDealForChanges) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        const oldValuesByField = requestedFields.reduce((acc, field) => {
            acc[field] = existingDealForChanges[field];
            return acc;
        }, {});

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedTo')) {
            const { validateRecordAssignmentRequest } = require('../services/recordAssignmentService');
            const newOwnerRaw = req.body.assignedTo;
            const newOwnerId = typeof newOwnerRaw === 'object'
                ? (newOwnerRaw._id || newOwnerRaw.id)
                : newOwnerRaw;
            const oldOwnerRaw = existingDealForChanges.assignedTo;
            const oldOwnerId = typeof oldOwnerRaw === 'object'
                ? (oldOwnerRaw._id || oldOwnerRaw.id)
                : oldOwnerRaw;
            if (String(newOwnerId || '') !== String(oldOwnerId || '')) {
                const ownerAssignCheck = await validateRecordAssignmentRequest(req, newOwnerId, { skipSelf: true });
                if (ownerAssignCheck) {
                    return res.status(ownerAssignCheck.status).json(ownerAssignCheck.body);
                }
            }
        }

        const { buildUpdateWithCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const $set = buildUpdateWithCustomFields(req.body, Deal);

        const updatedDeal = await Deal.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
            { $set },
            { new: true, runValidators: true }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('accountId', 'name');

        if (!updatedDeal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        await syncLegacyToRoleBased(updatedDeal, req.user._id);

        const relationshipResult = await validateDealRelationships({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: updatedDeal.toObject()
        });
        if (!relationshipResult.valid) {
            return res.status(400).json({
                success: false,
                code: relationshipResult.code,
                message: relationshipResult.message,
                errors: relationshipResult.errors
            });
        }

        if (shouldComputeDerivedStatus) {
            const { normalizeDealStatus, DEAL_STATUS } = require('../constants/dealStatus');
            const computedDerivedStatus = await computeAndSetDerivedStatus('deal', updatedDeal, appKey);
            if (computedDerivedStatus) {
                updatedDeal.status = normalizeDealStatus(computedDerivedStatus);
            } else if (!updatedDeal.status) {
                updatedDeal.status = DEAL_STATUS.OPEN;
            } else {
                updatedDeal.status = normalizeDealStatus(updatedDeal.status);
            }
        }

        const actorName = getActorDisplayName(req.user);
        const userIdsToResolve = new Set();
        if (oldValuesByField.assignedTo) {
            const oldOwnerId = typeof oldValuesByField.assignedTo === 'object'
                ? (oldValuesByField.assignedTo._id || oldValuesByField.assignedTo.id)
                : oldValuesByField.assignedTo;
            if (oldOwnerId) userIdsToResolve.add(String(oldOwnerId));
        }
        if (updatedDeal.assignedTo) {
            const newOwnerId = typeof updatedDeal.assignedTo === 'object'
                ? (updatedDeal.assignedTo._id || updatedDeal.assignedTo.id)
                : updatedDeal.assignedTo;
            if (newOwnerId) userIdsToResolve.add(String(newOwnerId));
        }

        let userNameById = {};
        if (userIdsToResolve.size > 0) {
            const User = require('../models/User');
            const users = await User.find({
                _id: { $in: Array.from(userIdsToResolve) },
                organizationId: req.user.organizationId
            }).select('firstName lastName username email').lean();

            userNameById = users.reduce((acc, user) => {
                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
                    || user.username
                    || user.email
                    || String(user._id);
                acc[String(user._id)] = displayName;
                return acc;
            }, {});
        }

        const fieldChangeLogs = [];
        requestedFields.forEach((field) => {
            const previousValue = oldValuesByField[field];
            const nextValue = updatedDeal[field];
            if (areDealFieldValuesEqual(previousValue, nextValue)) return;

            const entry = buildDealFieldChangeLogEntry({
                actorName,
                actorId: req.user._id,
                field,
                oldValue: previousValue,
                newValue: nextValue,
                userNameById
            });
            if (entry) fieldChangeLogs.push(entry);
        });

        if (fieldChangeLogs.length > 0) {
            if (!Array.isArray(updatedDeal.activityLogs)) updatedDeal.activityLogs = [];
            updatedDeal.activityLogs.push(...fieldChangeLogs);
            if (fieldChangeLogs.some((entry) => isDealEngagementAction(entry?.action))) {
                touchDealLastActivity(updatedDeal);
            }
        }
        // If tags are updated via canonical field, ensure stale customFields.tags
        // cannot resurrect old values on flattened responses.
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags') && updatedDeal.customFields && Object.prototype.hasOwnProperty.call(updatedDeal.customFields, 'tags')) {
            delete updatedDeal.customFields.tags;
            updatedDeal.markModified('customFields');
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description') && previousDescriptionExists) {
            if (!Array.isArray(updatedDeal.descriptionVersions)) updatedDeal.descriptionVersions = [];
            updatedDeal.descriptionVersions.push({
                content: typeof previousDescriptionForVersion === 'string' ? previousDescriptionForVersion : '',
                createdAt: new Date(),
                createdBy: req.user._id
            });
            const retentionCutoff = new Date();
            retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
            updatedDeal.descriptionVersions = updatedDeal.descriptionVersions.filter((entry) => entry?.createdAt >= retentionCutoff);
        }

        await syncRoleBasedToLegacy(updatedDeal);

        const stageChangedViaUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'stage')
            && existingDealForChanges.stage !== updatedDeal.stage;
        if (stageChangedViaUpdate) {
            try {
                const { executePlaybookForDeal } = require('../services/playbookExecutionService');
                await executePlaybookForDeal(updatedDeal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook on update failed:', playbookErr?.message || playbookErr);
            }
            // Legacy Astra Super Agent stage-change trigger removed with Astra v2 cutover.
        } else if (updatedDeal.playbookState?.actions?.length) {
            try {
                const { reconcilePlaybookForDeal } = require('../services/playbookExecutionService');
                await reconcilePlaybookForDeal(updatedDeal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook reconcile on update failed:', playbookErr?.message || playbookErr);
            }
        }

        await updatedDeal.save();

        try {
            const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
            const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
            await runImmediateAssignmentForSalesRecord({
                record: updatedDeal,
                moduleKey: 'deals',
                actorId: req.user._id,
                triggerSource: 'immediate',
                changedFields: requestedFields
            });
            await enqueueAssignmentJobsForSalesRecord({
                record: updatedDeal,
                moduleKey: 'deals',
                actorId: req.user._id,
                changedFields: requestedFields
            });
        } catch (assignErr) {
            console.error('[dealController] assignment on update failed:', assignErr?.message || assignErr);
        }

        if (touchedDealPeople || touchedDealOrganizations || touchedLegacyContact || touchedLegacyAccount) {
            await syncDealRelationshipInstances({
                organizationId: req.user.organizationId,
                dealDoc: updatedDeal,
                createdBy: req.user._id,
                peopleMode: touchedDealPeople ? 'replace' : 'merge',
                organizationsMode: touchedDealOrganizations ? 'replace' : 'merge'
            });
        }

        try {
            const { emitDealEvents } = require('../services/domainEventHelpers');
            await emitDealEvents({
                previous: previousDeal,
                current: updatedDeal.toObject ? updatedDeal.toObject() : updatedDeal,
                appKey,
                triggeredBy: req.user?._id ?? null,
                organizationId: req.user?.organizationId ?? null
            });
        } catch (emitErr) {
            console.error('[dealController] emitDealEvents on update failed:', emitErr?.message || emitErr);
        }

        const populatedDeal = await Deal.findById(updatedDeal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        res.status(200).json({ success: true, data: attachDealLastActivity(flattenCustomFieldsForResponse(populatedDeal)) });
    } catch (error) {
        console.error('Update deal error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating deal.', 
            error: error.message 
        });
    }
};

// @desc    Update deal tags only
// @route   PATCH /api/deals/:id/tags
// @access  Private
exports.updateDealTags = async (req, res) => {
    try {
        const nextTags = Array.isArray(req.body?.tags)
            ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];

        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const updatedDeal = await Deal.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
            {
                $set: { tags: nextTags, modifiedBy: req.user._id },
                $unset: { 'customFields.tags': 1 }
            },
            { new: true, runValidators: true }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        if (!updatedDeal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(updatedDeal) });
    } catch (error) {
        console.error('Update deal tags error:', error);
        return res.status(400).json({
            success: false,
            message: 'Error updating deal tags.',
            error: error.message
        });
    }
};

// @desc    Delete deal (move to trash)
// @route   DELETE /api/deals/:id
// @access  Private
exports.deleteDeal = async (req, res) => {
    try {
        const deletionService = require('../services/deletionService');
        const result = await deletionService.moveToTrash({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            userId: req.user._id,
            appKey: 'SALES',
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
                message: result.message || 'Failed to delete deal.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Deal moved to trash',
            retentionExpiresAt: result.retentionExpiresAt
        });
    } catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting deal.',
            error: error.message
        });
    }
};

// @desc    Add note to deal
// @route   POST /api/deals/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }
        
        const deal = await Deal.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId,
                deletedAt: null
            },
            {
                $push: {
                    notes: {
                        text: text.trim(),
                        createdBy: req.user._id,
                        createdAt: new Date()
                    }
                },
                $set: {
                    lastActivityDate: new Date(),
                    modifiedBy: req.user._id
                }
            },
            { new: true, runValidators: true }
        )
        .populate('contactId', 'first_name last_name email')
        .populate('assignedTo', 'firstName lastName email')
        .populate('notes.createdBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        try {
            await Deal.updateOne(
                {
                    _id: req.params.id,
                    organizationId: req.user.organizationId,
                    deletedAt: null
                },
                {
                    $push: {
                        activityLogs: {
                            user: getActorDisplayName(req.user),
                            userId: req.user?._id || null,
                            action: 'added a note',
                            details: {
                                notePreview: text.trim().slice(0, 120)
                            },
                            timestamp: new Date()
                        }
                    }
                }
            );
        } catch (activityLogError) {
            console.warn('Deal addNote: activity log append failed (note saved):', activityLogError?.message || activityLogError);
        }
        
        res.status(200).json({
            success: true,
            data: deal
        });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding note',
            error: error.message
        });
    }
};

// @desc    Update note on deal
// @route   PUT /api/deals/:id/notes/:noteId
// @access  Private
exports.updateDealNote = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !String(text).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const note = (deal.notes || []).find((entry) => String(entry?._id) === String(req.params.noteId));
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const currentUserId = String(req.user?._id || '');
        const noteAuthorId = String(note.createdBy || '');
        if (!currentUserId || !noteAuthorId || currentUserId !== noteAuthorId) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own notes'
            });
        }

        note.text = String(text).trim();
        note.editedAt = new Date();
        note.editedBy = req.user._id;
        deal.modifiedBy = req.user._id;
        deal.lastActivityDate = new Date();

        if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
        deal.activityLogs.push({
            user: getActorDisplayName(req.user),
            userId: req.user?._id || null,
            action: 'edited a note',
            details: {
                noteId: String(note._id)
            },
            timestamp: new Date()
        });

        await deal.save();

        const populatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: populatedDeal
        });
    } catch (error) {
        console.error('Update deal note error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating note',
            error: error.message
        });
    }
};

// @desc    Get activity logs for a deal
// @route   GET /api/deals/:id/activity-logs
// @access  Private
exports.getActivityLogs = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        }).select('activityLogs');

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const logs = (deal.activityLogs || []).sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

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

        const enrichedLogs = logs.map(log => {
            const enrichedLog = { ...log.toObject ? log.toObject() : log };
            if (log.userId && usersMap[log.userId.toString()]) {
                const user = usersMap[log.userId.toString()];
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

                if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
                    enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
                } else if (!enrichedLog.user || enrichedLog.user === '') {
                    enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
                }
            } else if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
                enrichedLog.user = 'Unknown User';
            }

            return enrichedLog;
        });

        res.status(200).json({
            success: true,
            data: enrichedLogs
        });
    } catch (error) {
        console.error('Get deal activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// @desc    Get deal description version history
// @route   GET /api/deals/:id/description-versions
// @access  Private
exports.getDescriptionVersions = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        }).select('description descriptionVersions').lean();

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const versions = (deal.descriptionVersions || [])
            .map((version) => ({
                content: version.content,
                createdAt: version.createdAt,
                createdBy: version.createdBy
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const User = require('../models/User');
        const createdByIds = [...new Set(versions.map((version) => version.createdBy).filter(Boolean))];
        const createdByMap = {};
        if (createdByIds.length > 0) {
            const users = await User.find({
                _id: { $in: createdByIds },
                organizationId: req.user.organizationId
            })
                .select('firstName lastName')
                .lean();

            users.forEach((user) => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                createdByMap[String(user._id)] = name || 'Unknown';
            });
        }

        const list = versions.map((version) => ({
            content: version.content,
            createdAt: version.createdAt,
            createdBy: version.createdBy ? createdByMap[String(version.createdBy)] || 'Unknown' : 'Unknown',
            createdById: version.createdBy
        }));

        return res.status(200).json({
            success: true,
            data: {
                currentDescription: deal.description || '',
                versions: list
            }
        });
    } catch (error) {
        console.error('Get deal description versions error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching description versions',
            error: error.message
        });
    }
};

// @desc    Restore a deal description version
// @route   POST /api/deals/:id/description-versions/restore
// @body    { versionIndex: number }
// @access  Private
exports.restoreDescriptionVersion = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const { versionIndex } = req.body;
        if (typeof versionIndex !== 'number' || versionIndex < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid versionIndex'
            });
        }

        const versions = (deal.descriptionVersions || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const version = versions[versionIndex];
        if (!version) {
            return res.status(404).json({
                success: false,
                message: 'Version not found'
            });
        }

        const previousDescription = deal.description;
        deal.description = version.content || '';
        if (!Array.isArray(deal.descriptionVersions)) {
            deal.descriptionVersions = [];
        }
        if (previousDescription !== undefined && previousDescription !== null) {
            deal.descriptionVersions.push({
                content: typeof previousDescription === 'string' ? previousDescription : '',
                createdAt: new Date(),
                createdBy: req.user._id
            });
        }

        if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
        deal.activityLogs.push({
            user: getActorDisplayName(req.user),
            userId: req.user?._id || null,
            action: 'restored description version',
            details: {
                field: 'description',
                from: previousDescription ?? '',
                to: deal.description ?? ''
            },
            timestamp: new Date()
        });

        const retentionCutoff = new Date();
        retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
        deal.descriptionVersions = deal.descriptionVersions.filter((entry) => entry?.createdAt >= retentionCutoff);

        await deal.save();

        const populatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        return res.status(200).json({
            success: true,
            data: populatedDeal
        });
    } catch (error) {
        console.error('Restore deal description version error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error restoring description version',
            error: error.message
        });
    }
};

// @desc    Add activity log to a deal
// @route   POST /api/deals/:id/activity-logs
// @access  Private
exports.addActivityLog = async (req, res) => {
    try {
        const { user, action, details } = req.body;

        if (!user || !action) {
            return res.status(400).json({
                success: false,
                message: 'User and action are required'
            });
        }

        const deal = await Deal.findOneAndUpdate(
            {
                _id: req.params.id,
                organizationId: req.user.organizationId,
                deletedAt: null
            },
            {
                $push: {
                    activityLogs: {
                        user,
                        userId: req.user?._id || null,
                        action,
                        details: details || null,
                        timestamp: new Date()
                    }
                },
                $set: {
                    lastActivityDate: new Date(),
                    modifiedBy: req.user._id
                }
            },
            { new: true, runValidators: true }
        );

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const newLog = deal.activityLogs[deal.activityLogs.length - 1];

        res.status(200).json({
            success: true,
            data: newLog
        });
    } catch (error) {
        console.error('Add deal activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding activity log',
            error: error.message
        });
    }
};

// @desc    Get pipeline summary
// @route   GET /api/deals/pipeline/summary
// @access  Private
exports.getPipelineSummary = async (req, res) => {
    try {
        const summary = await Deal.aggregate([
            { 
                $match: { 
                    organizationId: req.user.organizationId,
                    status: 'Open',
                    deletedAt: null
                } 
            },
            {
                $group: {
                    _id: '$stage',
                    count: { $sum: 1 },
                    totalValue: { $sum: '$amount' },
                    avgProbability: { $avg: '$probability' },
                    deals: { 
                        $push: {
                            id: '$_id',
                            name: '$name',
                            amount: '$amount',
                            probability: '$probability',
                            expectedCloseDate: '$expectedCloseDate'
                        }
                    }
                }
            },
            {
                $project: {
                    stage: '$_id',
                    count: 1,
                    totalValue: 1,
                    weightedValue: { 
                        $multiply: ['$totalValue', { $divide: ['$avgProbability', 100] }] 
                    },
                    avgProbability: 1,
                    deals: 1
                }
            },
            { $sort: { stage: 1 } }
        ]);
        
        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get pipeline summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pipeline summary',
            error: error.message
        });
    }
};

// @desc    Get playbook runtime analytics for active deals
// @route   GET /api/deals/playbooks/analytics
// @access  Private
exports.getPlaybookAnalytics = async (req, res) => {
    try {
        const { getPlaybookAnalytics } = require('../services/playbookAnalyticsService');
        const data = await getPlaybookAnalytics(req.user.organizationId, {
            pipelineKey: req.query.pipeline || req.query.pipelineKey
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get playbook analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching playbook analytics',
            error: error.message
        });
    }
};

// @desc    Get sales dashboard metrics
// @route   GET /api/deals/dashboard/metrics
// @access  Private
exports.getDashboardMetrics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const now = new Date();
        const trendConfig = getTrendConfig(req.query.range);
        const bucketMs = trendConfig.bucketDays * 24 * 60 * 60 * 1000;
        const trendStartDate = new Date(now.getTime() - ((trendConfig.buckets - 1) * bucketMs));
        const periodDays = trendConfig.bucketDays * trendConfig.buckets;
        const currentPeriodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
        const previousPeriodStart = new Date(currentPeriodStart.getTime() - (periodDays * 24 * 60 * 60 * 1000));
        const staleCutoff = new Date(now.getTime() - (trendConfig.staleDays * 24 * 60 * 60 * 1000));
        const closeSoonCutoff = new Date(now.getTime() + (trendConfig.closeSoonDays * 24 * 60 * 60 * 1000));
        const responseCutoff = new Date(now.getTime() - (trendConfig.responseLookbackDays * 24 * 60 * 60 * 1000));
        const importCutoff = new Date(now.getTime() - (trendConfig.importLookbackDays * 24 * 60 * 60 * 1000));
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const selectedRepIds = parseCsvParam(req.query.repIds)
            .map(toObjectIdOrNull)
            .filter(Boolean);
        const selectedPipelines = parseCsvParam(req.query.pipeline);
        const selectedDealTypes = parseCsvParam(req.query.dealType);

        const commonDealFilter = {
            organizationId,
            deletedAt: null
        };
        if (selectedRepIds.length > 0) {
            commonDealFilter.assignedTo = { $in: selectedRepIds };
        }
        if (selectedPipelines.length > 0) {
            commonDealFilter.pipeline = { $in: selectedPipelines };
        }
        if (selectedDealTypes.length > 0) {
            commonDealFilter.type = { $in: selectedDealTypes };
        }

        const openDealFilter = {
            ...commonDealFilter,
            status: 'Open'
        };

        const [
            openDeals,
            totalDeals,
            closingSoon,
            staleDeals,
            overdueFollowUps,
            overdueTasks,
            submittedResponses7d,
            imports30d,
            pipelineAggregate,
            trendAggregate,
            stageAggregate,
            stuckByStage,
            forecastByRepRaw,
            forecastByMonthRaw,
            repPipelineRaw,
            repRevenueRaw,
            repActivityRaw,
            activityWeeklyRaw,
            newPipelineWeeklyRaw,
            historicalForecastRaw,
            historicalActualRaw,
            pipelineValues
        ] = await Promise.all([
            Deal.countDocuments(openDealFilter),
            Deal.countDocuments(commonDealFilter),
            Deal.countDocuments({
                ...openDealFilter,
                expectedCloseDate: {
                    $gte: now,
                    $lte: closeSoonCutoff
                }
            }),
            Deal.countDocuments({
                ...openDealFilter,
                updatedAt: { $lt: staleCutoff }
            }),
            Deal.countDocuments({
                ...openDealFilter,
                nextFollowUpDate: { $lt: now }
            }),
            Task.countDocuments({
                organizationId,
                deletedAt: null,
                dueDate: { $lt: now },
                status: { $nin: CLOSED_TASK_STATUSES }
            }),
            FormResponse.countDocuments({
                organizationId,
                submittedAt: { $gte: responseCutoff }
            }),
            ImportHistory.countDocuments({
                organizationId,
                createdAt: { $gte: importCutoff },
                status: { $in: ['completed', 'partial'] }
            }),
            Deal.aggregate([
                { $match: openDealFilter },
                {
                    $group: {
                        _id: null,
                        pipelineValue: { $sum: '$amount' },
                        weightedValue: {
                            $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] }
                        }
                    }
                }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        createdAt: { $gte: trendStartDate }
                    }
                },
                {
                    $project: {
                        bucketIndex: {
                            $floor: {
                                $divide: [
                                    { $subtract: ['$createdAt', trendStartDate] },
                                    bucketMs
                                ]
                            }
                        }
                    }
                },
                {
                    $match: {
                        bucketIndex: { $gte: 0, $lt: trendConfig.buckets }
                    }
                },
                {
                    $group: {
                        _id: '$bucketIndex',
                        value: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: openDealFilter },
                {
                    $group: {
                        _id: '$stage',
                        count: { $sum: 1 },
                        value: { $sum: '$amount' },
                        avgProbability: { $avg: '$probability' }
                    }
                },
                { $sort: { avgProbability: -1 } }
            ]),
            Deal.aggregate([
                { $match: { ...openDealFilter, updatedAt: { $lt: staleCutoff } } },
                { $group: { _id: '$stage', count: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...openDealFilter,
                        expectedCloseDate: { $gte: currentPeriodStart, $lte: closeSoonCutoff }
                    }
                },
                {
                    $group: {
                        _id: '$assignedTo',
                        commit: {
                            $sum: {
                                $cond: [{ $gte: ['$probability', 70] }, '$amount', 0]
                            }
                        },
                        bestCase: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$probability', 40] },
                                            { $lt: ['$probability', 70] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        uncommitted: {
                            $sum: {
                                $cond: [{ $lt: ['$probability', 40] }, '$amount', 0]
                            }
                        }
                    }
                }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...openDealFilter,
                        expectedCloseDate: { $gte: currentPeriodStart, $lte: closeSoonCutoff }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$expectedCloseDate' } },
                        amount: '$amount',
                        probability: '$probability'
                    }
                },
                {
                    $group: {
                        _id: '$month',
                        commit: {
                            $sum: { $cond: [{ $gte: ['$probability', 70] }, '$amount', 0] }
                        },
                        bestCase: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $gte: ['$probability', 40] }, { $lt: ['$probability', 70] }] },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        pipelineUncommitted: {
                            $sum: { $cond: [{ $lt: ['$probability', 40] }, '$amount', 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: { ...commonDealFilter, createdAt: { $gte: weekStart } } },
                { $group: { _id: '$assignedTo', pipelineCreated: { $sum: '$amount' } } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        status: 'Won',
                        actualCloseDate: { $gte: currentPeriodStart, $lte: now }
                    }
                },
                { $group: { _id: '$assignedTo', revenueClosed: { $sum: '$amount' }, wins: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                { $match: commonDealFilter },
                { $unwind: { path: '$activityLogs', preserveNullAndEmptyArrays: false } },
                { $match: { 'activityLogs.timestamp': { $gte: currentPeriodStart, $lte: now } } },
                { $group: { _id: '$assignedTo', activityCount: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                { $match: commonDealFilter },
                { $unwind: { path: '$activityLogs', preserveNullAndEmptyArrays: false } },
                { $match: { 'activityLogs.timestamp': { $gte: trendStartDate, $lte: now } } },
                {
                    $project: {
                        week: { $dateToString: { format: '%Y-%U', date: '$activityLogs.timestamp' } },
                        actionLower: { $toLower: '$activityLogs.action' }
                    }
                },
                {
                    $group: {
                        _id: '$week',
                        calls: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'call' } }, 1, 0] } },
                        meetings: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'meeting|visit|demo' } }, 1, 0] } },
                        tasks: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'task|follow' } }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: { ...commonDealFilter, createdAt: { $gte: trendStartDate, $lte: now } } },
                {
                    $project: {
                        week: { $dateToString: { format: '%Y-%U', date: '$createdAt' } },
                        amount: '$amount'
                    }
                },
                {
                    $group: {
                        _id: '$week',
                        value: { $sum: '$amount' },
                        dealCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        expectedCloseDate: { $gte: previousPeriodStart, $lte: now }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$expectedCloseDate' } },
                        amount: 1
                    }
                },
                { $group: { _id: '$month', forecast: { $sum: '$amount' } } },
                { $sort: { _id: -1 } },
                { $limit: 3 }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        status: 'Won',
                        actualCloseDate: { $gte: previousPeriodStart, $lte: now }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$actualCloseDate' } },
                        amount: 1
                    }
                },
                { $group: { _id: '$month', actual: { $sum: '$amount' } } },
                { $sort: { _id: -1 } },
                { $limit: 3 }
            ]),
            Deal.distinct('pipeline', commonDealFilter)
        ]);

        const pipelineValue = Math.round(pipelineAggregate?.[0]?.pipelineValue || 0);
        const weightedPipelineValue = Math.round(pipelineAggregate?.[0]?.weightedValue || 0);
        const commitForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.commit || 0), 0));
        const bestCaseForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.bestCase || 0), 0));
        const uncommittedForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.uncommitted || 0), 0));

        const trendValues = Array.from({ length: trendConfig.buckets }, (_, idx) => {
            const hit = trendAggregate.find((entry) => Number(entry._id) === idx);
            return Number(hit?.value || 0);
        });

        const maxTrendValue = Math.max(...trendValues, 1);
        const normalizedTrend = trendValues.map((value) => {
            const scaled = Math.round((value / maxTrendValue) * 100);
            return Math.max(18, Math.min(92, scaled));
        });

        const previousBucketTotal = trendValues.slice(0, 6).reduce((a, b) => a + b, 0);
        const currentBucketTotal = trendValues.slice(6).reduce((a, b) => a + b, 0);
        const forecastDropPct = previousBucketTotal > 0
            ? Math.round(((currentBucketTotal - previousBucketTotal) / previousBucketTotal) * 100)
            : 0;

        const stageList = (stageAggregate || []).map((row) => ({
            stageId: row._id || 'unknown',
            label: row._id || 'Unknown',
            count: row.count || 0,
            value: Math.round(row.value || 0),
            conversionToNextPct: null
        }));
        for (let i = 0; i < stageList.length - 1; i += 1) {
            const current = stageList[i];
            const next = stageList[i + 1];
            current.conversionToNextPct = current.count > 0 ? Math.round((next.count / current.count) * 100) : 0;
        }
        const biggestDropoff = stageList.slice(0, -1).reduce((best, stage, idx) => {
            const drop = 100 - Number(stage.conversionToNextPct || 0);
            if (!best || drop > best.dropPct) {
                return {
                    from: stage.stageId,
                    to: stageList[idx + 1]?.stageId || null,
                    dropPct: drop
                };
            }
            return best;
        }, null);
        const stuckMap = new Map((stuckByStage || []).map((row) => [String(row._id || ''), row.count || 0]));
        const stuckStages = stageList
            .filter((stage) => (stuckMap.get(stage.stageId) || 0) > 0)
            .map((stage) => ({
                stageId: stage.stageId,
                count: stuckMap.get(stage.stageId) || 0,
                thresholdDays: trendConfig.staleDays
            }));

        const repIds = new Set();
        [forecastByRepRaw, repPipelineRaw, repRevenueRaw, repActivityRaw].forEach((rows) => {
            (rows || []).forEach((row) => {
                if (row?._id) repIds.add(String(row._id));
            });
        });
        const repUsers = await User.find({
            organizationId,
            _id: { $in: Array.from(repIds).map((id) => new mongoose.Types.ObjectId(id)) }
        }).select('_id firstName lastName username').lean();
        const repNameById = new Map(
            repUsers.map((u) => [
                String(u._id),
                `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Unknown Rep'
            ])
        );

        const repForecastById = new Map((forecastByRepRaw || []).map((r) => [String(r._id), r]));
        const repPipelineById = new Map((repPipelineRaw || []).map((r) => [String(r._id), r.pipelineCreated || 0]));
        const repRevenueById = new Map((repRevenueRaw || []).map((r) => [String(r._id), r]));
        const repActivityById = new Map((repActivityRaw || []).map((r) => [String(r._id), r.activityCount || 0]));
        const repRows = Array.from(repIds).map((repId) => {
            const f = repForecastById.get(repId) || {};
            const r = repRevenueById.get(repId) || {};
            const pipelineOwned = Math.round((f.commit || 0) + (f.bestCase || 0) + (f.uncommitted || 0));
            return {
                repId,
                name: repNameById.get(repId) || 'Unknown Rep',
                commit: Math.round(f.commit || 0),
                bestCase: Math.round(f.bestCase || 0),
                uncommitted: Math.round(f.uncommitted || 0),
                revenueClosed: Math.round(r.revenueClosed || 0),
                wins: Number(r.wins || 0),
                pipelineOwned,
                activityCount: Number(repActivityById.get(repId) || 0),
                pipelineCreatedThisWeek: Math.round(repPipelineById.get(repId) || 0)
            };
        });
        const repCount = Math.max(repRows.length, 1);
        const targetRevenue = Math.max(
            Number(req.query.targetRevenue || 0),
            Math.round(((pipelineValue + weightedPipelineValue) / 3) || 1)
        );
        const repQuota = Math.round(targetRevenue / repCount);
        const repPerformance = repRows
            .map((rep) => {
                const quotaAttainmentPct = repQuota > 0 ? Math.round((rep.revenueClosed / repQuota) * 100) : 0;
                const forecastTotal = rep.commit + rep.bestCase;
                const winRatePct = rep.activityCount > 0
                    ? Math.max(0, Math.min(100, Math.round((rep.wins / Math.max(rep.activityCount / 5, 1)) * 100)))
                    : 0;
                return {
                    ...rep,
                    quotaAttainmentPct,
                    quotaBand: quotaAttainmentPct >= 100 ? 'green' : quotaAttainmentPct >= 70 ? 'yellow' : 'red',
                    winRatePct,
                    forecastTotal
                };
            })
            .sort((a, b) => b.quotaAttainmentPct - a.quotaAttainmentPct)
            .map((rep, idx) => ({ ...rep, rank: idx + 1 }));

        const forecastByRep = repPerformance.map((rep) => ({
            repId: rep.repId,
            name: rep.name,
            commit: rep.commit,
            bestCase: rep.bestCase
        }));
        const forecastByMonth = (forecastByMonthRaw || []).map((row) => ({
            month: row._id,
            commit: Math.round(row.commit || 0),
            bestCase: Math.round(row.bestCase || 0),
            pipelineUncommitted: Math.round(row.pipelineUncommitted || 0)
        }));

        const actualByMonth = new Map((historicalActualRaw || []).map((row) => [row._id, Math.round(row.actual || 0)]));
        const forecastAccuracy = (historicalForecastRaw || []).map((row) => {
            const forecast = Math.round(row.forecast || 0);
            const actual = actualByMonth.get(row._id) || 0;
            const denominator = Math.max(forecast, actual, 1);
            return {
                month: row._id,
                forecast,
                actual,
                accuracyPct: Math.round((Math.min(forecast, actual) / denominator) * 100)
            };
        });

        const priorityQueue = [
            {
                title: 'Unworked opportunities',
                subtitle: `${staleDeals} open deals have no updates in ${trendConfig.staleDays}+ days`,
                priority: mapPriority(
                    staleDeals,
                    trendConfig.priorityThresholds.high,
                    trendConfig.priorityThresholds.medium
                ),
                route: '/deals'
            },
            {
                title: 'Follow-ups due',
                subtitle: `${overdueFollowUps} deals are past follow-up date`,
                priority: mapPriority(
                    overdueFollowUps,
                    trendConfig.priorityThresholds.high + 2,
                    trendConfig.priorityThresholds.medium + 1
                ),
                route: '/deals'
            },
            {
                title: 'Overdue tasks',
                subtitle: `${overdueTasks} sales tasks are overdue`,
                priority: mapPriority(
                    overdueTasks,
                    trendConfig.priorityThresholds.high,
                    trendConfig.priorityThresholds.medium
                ),
                route: '/tasks'
            }
        ];

        const riskSignal = staleDeals + overdueFollowUps + overdueTasks;
        const riskRatio = openDeals > 0 ? Math.min(1, riskSignal / openDeals) : 0;
        const healthScore = Math.max(0, Math.round((1 - riskRatio) * 100));

        const healthStatus = healthScore >= 80
            ? 'strong'
            : healthScore >= 60
                ? 'watch'
                : 'at_risk';

        const totalClosedCurrent = repPerformance.reduce((sum, rep) => sum + rep.revenueClosed, 0);
        const totalClosedPrevious = Math.round(totalClosedCurrent * 0.92);
        const currentWinRate = repPerformance.length > 0
            ? Math.round(repPerformance.reduce((sum, rep) => sum + rep.winRatePct, 0) / repPerformance.length)
            : 0;
        const previousWinRate = Math.max(0, currentWinRate - 2);
        const avgSalesCycleDays = Math.max(12, Math.round(38 + ((100 - healthScore) / 4)));
        const previousAvgSalesCycleDays = avgSalesCycleDays + 3;
        const pipelineCoverage = targetRevenue > 0 ? Number((pipelineValue / targetRevenue).toFixed(2)) : 0;
        const previousPipelineCoverage = Number((pipelineCoverage + 0.15).toFixed(2));
        const forecastTotal = commitForecast + bestCaseForecast;
        const previousForecastTotal = Math.max(0, Math.round(forecastTotal * 0.94));

        const buildSparkline = (base) => (
            Array.from({ length: 7 }, (_, idx) => Math.max(18, Math.min(92, Math.round(base + ((idx - 3) * 4)))))
        );
        const executiveSnapshot = {
            totalRevenue: {
                value: totalClosedCurrent,
                deltaPct: totalClosedPrevious > 0 ? Number((((totalClosedCurrent - totalClosedPrevious) / totalClosedPrevious) * 100).toFixed(1)) : 0,
                trend: buildSparkline(56)
            },
            pipelineValue: {
                value: pipelineValue,
                deltaPct: pipelineValue > 0 ? Number((((pipelineValue - weightedPipelineValue) / pipelineValue) * 100).toFixed(1)) : 0,
                trend: buildSparkline(62)
            },
            forecast: {
                value: forecastTotal,
                deltaPct: previousForecastTotal > 0 ? Number((((forecastTotal - previousForecastTotal) / previousForecastTotal) * 100).toFixed(1)) : 0,
                trend: buildSparkline(58)
            },
            winRate: {
                value: currentWinRate,
                deltaPct: previousWinRate > 0 ? Number((((currentWinRate - previousWinRate) / previousWinRate) * 100).toFixed(1)) : 0,
                trend: buildSparkline(52)
            },
            avgSalesCycle: {
                value: avgSalesCycleDays,
                deltaPct: previousAvgSalesCycleDays > 0 ? Number((((avgSalesCycleDays - previousAvgSalesCycleDays) / previousAvgSalesCycleDays) * 100).toFixed(1)) : 0,
                trend: buildSparkline(47).reverse()
            },
            pipelineCoverage: {
                value: pipelineCoverage,
                deltaPct: previousPipelineCoverage > 0 ? Number((((pipelineCoverage - previousPipelineCoverage) / previousPipelineCoverage) * 100).toFixed(1)) : 0,
                trend: buildSparkline(54)
            }
        };

        const activityOverTime = (activityWeeklyRaw || []).map((row) => ({
            week: row._id,
            calls: Number(row.calls || 0),
            meetings: Number(row.meetings || 0),
            tasks: Number(row.tasks || 0)
        }));
        const newPipelinePerWeek = (newPipelineWeeklyRaw || []).map((row) => ({
            week: row._id,
            value: Math.round(row.value || 0),
            dealCount: Number(row.dealCount || 0)
        }));
        const totalActivities = activityOverTime.reduce((sum, week) => sum + week.calls + week.meetings + week.tasks, 0);
        const activityToDealConversionPct = totalActivities > 0
            ? Number(((totalClosedCurrent / totalActivities) * 100).toFixed(1))
            : 0;
        const efficiencyFlags = repPerformance
            .filter((rep) => rep.activityCount >= 30 && rep.winRatePct < 15)
            .map((rep) => ({
                repId: rep.repId,
                name: rep.name,
                reason: 'High activity but low conversion',
                activityCount: rep.activityCount,
                conversionPct: rep.winRatePct
            }));

        const recommendedActions = [
            {
                title: 'Open deals board',
                subtitle: `${openDeals} active deals in pipeline`,
                route: '/deals'
            },
            {
                title: 'Review responses',
                subtitle: `${submittedResponses7d} responses submitted in last ${trendConfig.responseLookbackDays} days`,
                route: '/responses'
            },
            {
                title: 'Check imports',
                subtitle: `${imports30d} successful imports in last ${trendConfig.importLookbackDays} days`,
                route: '/import'
            }
        ];

        const alerts = [];
        if (pipelineCoverage < 2) {
            alerts.push({
                severity: 'high',
                code: 'PIPELINE_COVERAGE_LOW',
                message: `Pipeline coverage below 2x target (${pipelineCoverage}x)`,
                action: 'Increase qualified pipeline this period'
            });
        }
        const proposalStuck = stuckStages.find((s) => String(s.stageId).toLowerCase().includes('proposal'));
        if (proposalStuck && proposalStuck.count > 0) {
            alerts.push({
                severity: 'high',
                code: 'STUCK_PROPOSAL',
                message: `${proposalStuck.count} deals stuck in Proposal > ${proposalStuck.thresholdDays} days`,
                action: 'Run proposal aging review'
            });
        }
        if (forecastDropPct < -10) {
            alerts.push({
                severity: 'medium',
                code: 'FORECAST_DROP',
                message: `Forecast dropped ${Math.abs(forecastDropPct)}% vs previous window`,
                action: 'Inspect late-stage slippage and commit risk'
            });
        }
        const noPipelineReps = repPerformance.filter((rep) => rep.pipelineCreatedThisWeek <= 0);
        if (noPipelineReps.length > 0) {
            alerts.push({
                severity: 'medium',
                code: 'NO_PIPELINE_CREATED',
                message: `${noPipelineReps[0].name} has 0 pipeline created this week`,
                action: 'Set pipeline-generation activity goals'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                generatedAt: now.toISOString(),
                range: trendConfig.key,
                filtersApplied: {
                    repIds: selectedRepIds.map((id) => String(id)),
                    pipeline: selectedPipelines,
                    dealType: selectedDealTypes
                },
                pipelines: (pipelineValues || []).filter(Boolean),
                kpis: {
                    openDeals,
                    totalDeals,
                    pipelineValue,
                    weightedPipelineValue,
                    closingSoon
                },
                executiveSnapshot,
                pipelineHealth: {
                    stages: stageList,
                    biggestDropoff: biggestDropoff || { from: null, to: null, dropPct: 0 },
                    stuckDeals: stuckStages
                },
                forecasting: {
                    commit: commitForecast,
                    bestCase: bestCaseForecast,
                    pipelineUncommitted: uncommittedForecast,
                    byRep: forecastByRep,
                    byClosingMonth: forecastByMonth,
                    accuracyLast3Months: forecastAccuracy,
                    vsTarget: {
                        target: targetRevenue,
                        forecastTotal,
                        attainmentPct: targetRevenue > 0 ? Number(((forecastTotal / targetRevenue) * 100).toFixed(1)) : 0
                    }
                },
                repPerformance,
                activityPipeline: {
                    activityOverTime,
                    newPipelinePerWeek,
                    activityToDealConversionPct,
                    efficiencyFlags
                },
                trend: {
                    values: normalizedTrend,
                    rawValues: trendValues
                },
                queue: {
                    staleDeals,
                    overdueFollowUps,
                    overdueTasks
                },
                health: {
                    score: healthScore,
                    status: healthStatus,
                    signalCount: riskSignal
                },
                windows: {
                    staleDays: trendConfig.staleDays,
                    closeSoonDays: trendConfig.closeSoonDays,
                    responseLookbackDays: trendConfig.responseLookbackDays,
                    importLookbackDays: trendConfig.importLookbackDays
                },
                priorityQueue,
                recommendedActions,
                alerts,
                aiSummary: {
                    hitTargetLikelihoodPct: Math.max(5, Math.min(95, Math.round((forecastTotal / Math.max(targetRevenue, 1)) * 100))),
                    summary: pipelineCoverage >= 2
                        ? 'Pipeline coverage is healthy. Focus on proposal-stage conversion to improve predictability.'
                        : 'Pipeline coverage is below plan. Increase qualified pipeline and reduce stage slippage.',
                    recommendedActions: alerts.slice(0, 2).map((a) => a.action)
                },
                moduleCounts: {
                    deals: totalDeals,
                    responses: submittedResponses7d,
                    import: imports30d
                }
            }
        });
    } catch (error) {
        console.error('Get dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard metrics',
            error: error.message
        });
    }
};

// @desc    Update deal stage
// @route   PATCH /api/deals/:id/stage
// @access  Private
exports.updateStage = async (req, res) => {
    try {
        const { stage, order } = req.body;
        const appKey = req.appKey || req.query.appKey || 'SALES';

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: { stage, pipeline: deal.pipeline },
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        const previousSnapshot = deal.toObject ? deal.toObject() : { ...deal };
        const stageChanged = deal.stage !== stage;

        deal.stage = stage;
        if (typeof order === 'number' && order >= 0) {
            deal.stageOrder = order;
        }
        if (stageChanged) {
            if (!Array.isArray(deal.stageHistory)) deal.stageHistory = [];
            const historyEntry = { stage, changedAt: new Date() };
            if (req.user && req.user._id) historyEntry.changedBy = req.user._id;
            deal.stageHistory.push(historyEntry);

            if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
            deal.activityLogs.push({
                user: getActorDisplayName(req.user),
                userId: req.user?._id || null,
                action: 'changed stage',
                details: {
                    field: 'stage',
                    from: previousSnapshot?.stage ?? null,
                    to: stage
                },
                timestamp: new Date()
            });
            touchDealLastActivity(deal);
        }
        deal.modifiedBy = req.user?._id ?? null;

        const { normalizeDealStatus, DEAL_STATUS } = require('../constants/dealStatus');
        const computedDerivedStatus = await computeAndSetDerivedStatus('deal', deal, appKey);
        if (computedDerivedStatus) {
            deal.status = normalizeDealStatus(computedDerivedStatus);
        } else if (!deal.status) {
            deal.status = DEAL_STATUS.OPEN;
        } else {
            deal.status = normalizeDealStatus(deal.status);
        }

        if (stageChanged) {
            try {
                const { executePlaybookForDeal } = require('../services/playbookExecutionService');
                await executePlaybookForDeal(deal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook on stage change failed:', playbookErr?.message || playbookErr);
            }
        }

        await deal.save();

        // Renormalize stageOrder so the moved deal is at index `order` and the rest are 0,1,2,...
        const inStage = await Deal.find({
            organizationId: req.user.organizationId,
            stage: deal.stage,
            deletedAt: null
        })
            .sort({ stageOrder: 1, _id: 1 })
            .select('_id')
            .lean();
        const movedId = deal._id.toString();
        if (typeof order === 'number' && order >= 0 && inStage.length > 0) {
            const idx = inStage.findIndex((d) => d._id.toString() === movedId);
            if (idx !== -1) {
                const [moved] = inStage.splice(idx, 1);
                const newIndex = Math.min(order, inStage.length);
                inStage.splice(newIndex, 0, moved);
            }
        }
        for (let i = 0; i < inStage.length; i++) {
            await Deal.updateOne(
                { _id: inStage[i]._id, organizationId: req.user.organizationId },
                { $set: { stageOrder: i } }
            );
        }

        try {
            const { emitDealEvents } = require('../services/domainEventHelpers');
            await emitDealEvents({
                previous: previousSnapshot,
                current: deal.toObject ? deal.toObject() : deal,
                appKey,
                triggeredBy: req.user?._id ?? null,
                organizationId: req.user?.organizationId ?? null
            });
        } catch (emitErr) {
            console.error('Update stage: emitDealEvents failed (stage was saved):', emitErr);
        }

        // Legacy Astra Super Agent stage-change trigger removed with Astra v2 cutover.

        const updatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('assignedTo', 'firstName lastName email')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        res.status(200).json({ success: true, data: attachDealLastActivity(updatedDeal) });
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating stage',
            error: error.message
        });
    }
};

// @desc    Update playbook action completion status
// @route   PATCH /api/deals/:id/playbook-state/actions/:actionKey
// @access  Private
exports.updatePlaybookActionStatus = async (req, res) => {
    try {
        const { actionKey } = req.params;
        const status = req.body?.status === 'completed' ? 'completed' : 'pending';

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const { updatePlaybookActionStatus } = require('../services/playbookExecutionService');
        const updatedAction = await updatePlaybookActionStatus(
            deal,
            actionKey,
            status,
            req.user.organizationId
        );

        if (!updatedAction) {
            return res.status(404).json({
                success: false,
                message: 'Playbook action not found on this deal'
            });
        }

        deal.modifiedBy = req.user._id;
        await deal.save();

        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        return res.status(200).json({
            success: true,
            data: flattenCustomFieldsForResponse(deal)
        });
    } catch (error) {
        if (error?.code === 'PLAYBOOK_ACTION_BLOCKED') {
            return res.status(409).json({
                success: false,
                code: error.code,
                message: 'This playbook action is blocked until prior steps are completed.'
            });
        }
        console.error('Update playbook action status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating playbook action status',
            error: error.message
        });
    }
};

// =====================
// Deal Comment Methods
// =====================

const normalizeReactionEmoji = (value) => String(value || '').trim();

const toReactionUserPayload = (user) => {
  if (!user) return null;
  const rawId = typeof user === 'object' ? (user._id || user.id) : user;
  if (!rawId) return null;
  const id = String(rawId);
  if (typeof user !== 'object') {
    return { id, name: 'Unknown', avatar: '' };
  }
  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || user.username || user.email || 'Unknown';
  return {
    id,
    name,
    avatar: user.avatar || ''
  };
};

const buildDealCommentResponse = (comment, currentUserId = null) => {
  const currentUserIdString = currentUserId ? String(currentUserId) : null;
  const reactions = Array.isArray(comment?.reactions) ? comment.reactions : [];

  const summarizedReactions = reactions
    .map((reaction) => {
      const emoji = normalizeReactionEmoji(reaction?.emoji);
      if (!emoji) return null;

      const users = Array.isArray(reaction?.users) ? reaction.users : [];
      const dedupedUsers = [];
      const seenUserIds = new Set();
      users.forEach((user) => {
        const payload = toReactionUserPayload(user);
        if (!payload || seenUserIds.has(payload.id)) return;
        seenUserIds.add(payload.id);
        dedupedUsers.push(payload);
      });

      return {
        emoji,
        count: dedupedUsers.length,
        userIds: dedupedUsers.map((user) => user.id),
        reactors: dedupedUsers
      };
    })
    .filter((reaction) => reaction && reaction.count > 0);

  const myReactions = currentUserIdString
    ? summarizedReactions
      .filter((reaction) => reaction.userIds.includes(currentUserIdString))
      .map((reaction) => reaction.emoji)
    : [];

  const reactionSummary = summarizedReactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = reaction.count;
    return acc;
  }, {});

  return {
    _id: comment._id,
    content: comment.content,
    author: comment.author,
    parentCommentId: comment.parentCommentId || null,
    attachments: comment.attachments || [],
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    editedAt: comment.editedAt,
    reactions: summarizedReactions.map(({ emoji, count, reactors }) => ({ emoji, count, reactors })),
    reactionSummary,
    myReactions,
    likesCount: reactionSummary['👍'] || 0
  };
};
exports.buildDealCommentResponse = buildDealCommentResponse;

// @desc    Get comments for a deal
// @route   GET /api/deals/:id/comments
// @access  Private
exports.getDealComments = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const comments = await DealComment.find({ dealId: req.params.id })
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: comments.map((comment) => buildDealCommentResponse(comment, req.user?._id))
    });
  } catch (error) {
    console.error('Get deal comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

// @desc    Upload a file for a deal comment attachment
// @route   POST /api/deals/:id/comment-attachments
// @access  Private
exports.uploadDealCommentAttachment = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const uploadResult = await persistMulterUpload(req, 'comments');
    let documentId = null;
    try {
      const documentService = require('../services/documentService');
      const registration = await documentService.registerCommentAttachmentAsDocument({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        moduleKey: 'deals',
        recordId: req.params.id,
        appKey: req.appKey || 'SALES',
        uploadResult,
        file: req.file
      });
      documentId = registration?.document?._id ? String(registration.document._id) : null;
    } catch (registerError) {
      console.error('Deal comment attachment document registration failed:', registerError.message);
    }
    res.json({
      success: true,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      filename: uploadResult.storedFileName,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      documentId
    });
  } catch (error) {
    console.error('Upload deal comment attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading attachment',
      error: error.message
    });
  }
};

// @desc    Create a comment on a deal
// @route   POST /api/deals/:id/comments
// @access  Private
exports.createDealComment = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const { content, attachments, parentCommentId } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const validAttachments = Array.isArray(attachments)
      ? attachments
        .filter((a) => a && typeof a.url === 'string' && typeof a.filename === 'string')
        .slice(0, 10)
        .map((a) => {
          const row = {
            url: a.url,
            filename: a.filename,
            size: a.size || 0,
            mimetype: a.mimetype || ''
          };
          if (a.documentId && mongoose.Types.ObjectId.isValid(a.documentId)) {
            row.documentId = a.documentId;
          }
          return row;
        })
      : [];

    let validatedParentCommentId = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent comment id' });
      }
      const parentComment = await DealComment.findOne({
        _id: parentCommentId,
        dealId: req.params.id,
        organizationId: req.user.organizationId
      }).select('_id');
      if (!parentComment) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
      validatedParentCommentId = parentComment._id;
    }

    const comment = await DealComment.create({
      dealId: req.params.id,
      organizationId: req.user.organizationId,
      content: content.trim(),
      author: req.user._id,
      parentCommentId: validatedParentCommentId,
      attachments: validAttachments
    });

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    // Notify @mentioned users (fire-and-forget)
    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'deals',
      entityId: String(req.params.id),
      entityType: 'Deal',
      recordTitle: deal.name || 'Deal',
      commentId: String(comment._id),
      commentContent: content.trim(),
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Deal comment mention notifications error:', err));

    // Legacy Astra Super Agent comment-mention trigger removed with Astra v2 cutover.

    const engagedAt = new Date();
    if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
    deal.activityLogs.push({
      user: getActorDisplayName(req.user),
      userId: req.user._id,
      action: 'added a comment',
      details: { commentId: String(comment._id) },
      timestamp: engagedAt
    });
    touchDealLastActivity(deal, engagedAt);
    deal.modifiedBy = req.user._id;
    await deal.save();

    res.status(201).json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Create deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment',
      error: error.message
    });
  }
};

// @desc    Update a comment
// @route   PUT /api/deals/:id/comments/:commentId
// @access  Private
exports.updateDealComment = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const hasAttachmentsPayload = Array.isArray(req.body?.attachments);
    const validAttachments = hasAttachmentsPayload
      ? req.body.attachments
        .filter((a) => a && typeof a.url === 'string' && typeof a.filename === 'string')
        .slice(0, 10)
      : comment.attachments;

    if (!rawContent && (!Array.isArray(validAttachments) || validAttachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    comment.content = rawContent || 'Attached file(s)';
    if (hasAttachmentsPayload) {
      comment.attachments = validAttachments;
    }
    comment.editedAt = new Date();
    await comment.save();

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'deals',
      entityId: String(dealId),
      entityType: 'Deal',
      recordTitle: deal.name || 'Deal',
      commentId: String(comment._id),
      commentContent: comment.content,
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Deal comment mention notifications error:', err));

    const engagedAt = new Date();
    if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
    deal.activityLogs.push({
      user: getActorDisplayName(req.user),
      userId: req.user._id,
      action: 'edited a comment',
      details: { commentId: String(comment._id) },
      timestamp: engagedAt
    });
    touchDealLastActivity(deal, engagedAt);
    deal.modifiedBy = req.user._id;
    await deal.save();

    res.json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Update deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment',
      error: error.message
    });
  }
};

// @desc    Toggle an emoji reaction for a deal comment
// @route   POST /api/deals/:id/comments/:commentId/reactions
// @access  Private
exports.toggleDealCommentReaction = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const emoji = normalizeReactionEmoji(req.body?.emoji);

    if (!emoji || emoji.length > 16) {
      return res.status(400).json({
        success: false,
        message: 'A valid emoji is required'
      });
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (!Array.isArray(comment.reactions)) {
      comment.reactions = [];
    }

    const currentUserId = String(req.user._id);
    let reaction = comment.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);

    if (!reaction) {
      comment.reactions.push({
        emoji,
        users: [req.user._id]
      });
    } else {
      const userIndex = reaction.users.findIndex((userId) => String(userId) === currentUserId);
      if (userIndex >= 0) {
        reaction.users.splice(userIndex, 1);
      } else {
        reaction.users.push(req.user._id);
      }

      if (!reaction.users.length) {
        comment.reactions = comment.reactions.filter((entry) => String(entry._id) !== String(reaction._id));
      }
    }

    comment.markModified('reactions');
    await comment.save();

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    res.json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Toggle deal comment reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling reaction',
      error: error.message
    });
  }
};

// @desc    Delete a deal comment
// @route   DELETE /api/deals/:id/comments/:commentId
// @access  Private
exports.deleteDealComment = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }

    await DealComment.findByIdAndDelete(commentId);

    res.json({
      success: true,
      data: { _id: commentId }
    });
  } catch (error) {
    console.error('Delete deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message
    });
  }
};

exports.getDealsListMeta = async (req, res) => {
  try {
    const query = buildDealsListQuery(req);
    const meta = await fetchListMeta(Deal, query);
    sendListMetaResponse(res, meta);
  } catch (error) {
    console.error('[getDealsListMeta] error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deal list meta' });
  }
};

exports.getDealRecordMeta = async (req, res) => {
  try {
    const meta = await fetchRecordUpdatedAtMeta(Deal, {
      organizationId: req.user.organizationId,
      recordId: req.params.id,
    });
    sendRecordMetaResponse(res, meta);
  } catch (error) {
    console.error('[getDealRecordMeta] error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deal record meta' });
  }
};

