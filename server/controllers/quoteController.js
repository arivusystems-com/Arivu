const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteConversionLink = require('../models/QuoteConversionLink');
const mongoose = require('mongoose');
const {
  assertValidStatus,
  assertCanTransitionQuoteStatus,
  assertQuoteRecordEditable,
  isCommerciallyLockedStatus
} = require('../constants/quoteLifecycle');
const quoteTotalsService = require('../services/quoteTotalsService');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const {
  assertQuoteCommerciallyEditableForLineWrite
} = require('./quoteLineController');
const {
  ensureDefaultSection,
  listQuoteSections,
  recomputeQuoteAndSectionTotals,
  cloneSectionsForRevision
} = require('../services/quoteSectionService');
const crypto = require('node:crypto');
const { sendQuoteEmail: sendQuoteEmailService } = require('../services/quoteEmailService');
const { emitQuoteEvents } = require('../services/domainEventHelpers');
const {
  appendQuoteApprovalEvent,
  findPendingProcessApprovalsForQuote
} = require('../services/quoteApprovalProcessService');
const { getQuoteOrgSettings } = require('../services/quoteOrgSettingsService');
const { assertCanShareQuotePublicly, assertCanSendQuoteToCustomer } = require('../constants/quoteLifecycle');
const { buildPublicQuoteUrl } = require('../utils/quotePublicUrl');
const { expireQuoteIfDue } = require('../services/quoteExpiryService');
const {
  getQuoteConversionEligibility,
  userCanOverrideExpiredQuotes
} = require('../services/quoteConversionService');
const { convertQuoteToSalesOrder } = require('../services/salesOrderConversionService');
const {
  getConvertedLineIdsForQuote,
  resolveQuoteConversionCoverage
} = require('../services/quoteConversionCoverageService');
const {
  compareQuoteRevisions,
  extractFilters
} = require('../services/quoteRevisionCompareService');
const {
  getQuoteApprovalWorkspace,
  getQuoteApprovalHistory
} = require('../services/quoteApprovalWorkspaceService');

function normalizeNumber(value, { defaultValue = 0 } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function createQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const assignedTo = req.body?.assignedTo ?? req.user._id;

    const status = req.body?.status ?? undefined;
    if (status !== undefined) assertValidStatus(status);

    const orgQuoteSettings = await getQuoteOrgSettings(organizationId);
    const approvalRequiredDefault =
      req.body?.approvalRequired === true || orgQuoteSettings.requireApprovalBeforeSend === true;

    const { resolveCurrencyOrOrgDefault } = require('../utils/orgCurrency');
    const currency = await resolveCurrencyOrOrgDefault(req.body?.currency, organizationId);

    const payload = {
      organizationId,
      assignedTo,
      quoteTitle: req.body?.quoteTitle ?? null,
      quoteDate: req.body?.quoteDate ? new Date(req.body.quoteDate) : new Date(),
      validUntil: req.body?.validUntil ?? null,
      status: status ?? undefined,
      currency,
      exchangeRateSnapshot: normalizeNumber(req.body?.exchangeRateSnapshot, { defaultValue: 1 }),

      // Optional links + metadata
      customerId: req.body?.customerId ?? null,
      organizationRefId: req.body?.organizationRefId ?? null,
      contactId: req.body?.contactId ?? null,
      dealId: req.body?.dealId ?? null,
      caseId: req.body?.caseId ?? null,
      customRecordId: req.body?.customRecordId ?? null,
      sourceContext: req.body?.sourceContext ?? 'manual',
      sourceRef: req.body?.sourceRef ?? null,

      approvalRequired: approvalRequiredDefault,

      customFields: req.body?.customFields ?? {}
    };

    let quote = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        quote = await Quote.create(payload);
        break;
      } catch (err) {
        lastErr = err;
        const isDup =
          err?.code === 11000 ||
          String(err?.message || '').includes('E11000') ||
          String(err?.message || '').includes('duplicate key');
        if (!isDup || attempt >= 4) throw err;
        // Sequence lag vs soft-deleted quoteNumbers — resync then retry with a fresh number.
        try {
          const { resyncFromExistingRecords } = require('../services/moduleNumberingService');
          await resyncFromExistingRecords(organizationId, 'quotes');
        } catch (resyncErr) {
          console.warn('[quotes] numbering resync failed:', resyncErr?.message || resyncErr);
        }
      }
    }
    if (!quote) throw lastErr || new Error('Failed to create quote');

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_created',
      message: 'Quote created',
      details: { quoteNumber: quote.quoteNumber }
    });

    await ensureDefaultSection({
      organizationId,
      quoteId: quote._id,
      lockedSnapshot: false
    });

    try {
      emitQuoteEvents({
        previous: null,
        current: quote.toObject ? quote.toObject() : quote,
        organizationId,
        triggeredBy: req.user._id
      });
    } catch (emitErr) {
      console.warn('[quotes] emitQuoteEvents on create failed:', emitErr?.message || emitErr);
    }

    return res.status(201).json({ success: true, data: quote });
  } catch (err) {
    console.error('[quotes] createQuote failed:', err?.message || err, err?.stack || '');
    const isDup =
      err?.code === 11000 ||
      String(err?.message || '').includes('E11000') ||
      String(err?.message || '').includes('duplicate key');
    const code = err?.code === 'VALIDATION' ? 'VALIDATION' : isDup ? 'DUPLICATE' : err?.code || 'UNKNOWN';
    const status =
      code === 'VALIDATION' || code === 'CURRENCY_NOT_ENABLED' ? 400 : isDup ? 409 : 500;
    return res.status(status).json({
      success: false,
      message: isDup
        ? 'Quote number conflict — please try again'
        : err.message || 'Failed to create quote',
      code,
      details: err.details || null
    });
  }
}

const CLOSED_QUOTE_STATUSES = ['Converted', 'Cancelled', 'Rejected', 'Expired'];
const ACCEPTED_QUOTE_STATUSES = ['Accepted', 'Partially Accepted'];

function quotesQueryAnd(baseQuery, clause) {
  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return clause;
  }
  return { $and: [baseQuery, clause] };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Matches client registry keys: totalQuotes, myQuotes, openValue, openQuotes, acceptedValue.
 */
async function computeQuotesListStatistics(query, userId) {
  const uid =
    mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const { castMatchQueryForAggregate } = require('../utils/searchRelevance');
  const matchQuery = castMatchQueryForAggregate(Quote, query);

  const [aggRows, myQuotes] = await Promise.all([
    Quote.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          openQuotes: {
            $sum: {
              $cond: [{ $not: [{ $in: ['$status', CLOSED_QUOTE_STATUSES] }] }, 1, 0]
            }
          },
          openValue: {
            $sum: {
              $cond: [
                { $not: [{ $in: ['$status', CLOSED_QUOTE_STATUSES] }] },
                { $ifNull: ['$grandTotal', 0] },
                0
              ]
            }
          },
          acceptedValue: {
            $sum: {
              $cond: [
                { $in: ['$status', ACCEPTED_QUOTE_STATUSES] },
                { $ifNull: ['$grandTotal', 0] },
                0
              ]
            }
          }
        }
      }
    ]),
    uid ? Quote.countDocuments(quotesQueryAnd(query, { assignedTo: uid })) : Promise.resolve(0)
  ]);

  const row = aggRows[0] || { openQuotes: 0, openValue: 0, acceptedValue: 0 };
  return {
    myQuotes,
    openQuotes: row.openQuotes || 0,
    openValue: row.openValue || 0,
    acceptedValue: row.acceptedValue || 0
  };
}

async function getQuotes(req, res) {
  try {
    const organizationId = req.user.organizationId;
    let status = req.query?.status;
    let assignedTo = req.query?.assignedTo;

    const q = { organizationId, deletedAt: null };
    const includeAllRevisions =
      req.query?.includeAllRevisions === 'true' || req.query?.includeAllRevisions === true;
    if (!includeAllRevisions) {
      // List view: one row per commercial quote (active revision only).
      q.activeRevision = { $ne: false };
    }
    if (status) {
      assertValidStatus(status);
      q.status = status;
    }
    if (assignedTo === 'me') {
      assignedTo = req.user._id;
    }
    if (assignedTo === 'unassigned') {
      q.$and = [
        ...(q.$and || []),
        { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] }
      ];
    } else if (assignedTo) {
      q.assignedTo = assignedTo;
    }

    const searchTerm = req.query?.search != null ? String(req.query.search).trim() : '';
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [
        { quoteNumber: searchRegex },
        { quoteTitle: searchRegex },
        { status: searchRegex }
      ];
    }

    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const page = Math.max(1, Number(req.query?.page) || 1);
    const skip = (page - 1) * limit;

    const allowedSortFields = new Set([
      'quoteNumber',
      'quoteTitle',
      'status',
      'grandTotal',
      'updatedAt',
      'createdAt',
      'quoteDate',
      'validUntil'
    ]);
    const { parseListSort } = require('../utils/parseListSort');
    const { sortObject } = parseListSort(req.query, {
      allowedFields: allowedSortFields,
      defaultField: 'updatedAt',
      defaultOrder: 'desc',
      tieBreaker: '_id'
    });

    const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
    const listQuery = applyListFilterQueryParam(q, req.query, 'quotes', { userId: req.user?._id });

    const [rows, total, listCardBreakdown] = await Promise.all([
      Quote.find(listQuery)
        .sort(sortObject)
        .skip(skip)
        .limit(limit)
        .populate({ path: 'assignedTo', select: 'firstName lastName email username avatar' })
        .populate({ path: 'organizationRefId', select: 'name' })
        .lean(),
      Quote.countDocuments(listQuery),
      computeQuotesListStatistics(listQuery, req.user._id)
    ]);

    return res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalRecords: total,
        limit
      },
      meta: { page, limit, total },
      listStatistics: {
        ...listCardBreakdown,
        totalQuotes: total,
        myQuotes: total
      }
    });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch quotes',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function getQuoteById(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quoteDoc = await Quote.findOne({ _id: quoteId, organizationId, deletedAt: null })
      .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name industry status email phone website' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
      .populate({ path: 'dealId', select: 'name stage pipeline amount value currency' })
      .populate({ path: 'caseId', select: 'caseId title status priority' });
    if (!quoteDoc) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    await expireQuoteIfDue(quoteDoc, { userId: req.user._id, trigger: 'read' });
    const quote = quoteDoc.toObject();

    const lines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const sections = await listQuoteSections({ organizationId, quoteId: quote._id });

    return res.json({ success: true, data: { ...quote, sections, lines } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch quote',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function transitionQuoteStatus(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const toStatus = req.body?.status;
    assertValidStatus(toStatus);

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_status_changed',
      message: `Status changed: ${fromStatus} → ${toStatus}`,
      details: { fromStatus, toStatus }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to transition quote status',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function updateQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const previousSnapshot = quote.toObject ? quote.toObject() : { ...quote };

    await expireQuoteIfDue(quote, { userId: req.user._id, trigger: 'read' });

    if (quote.approvalLocked === true) {
      return res.status(400).json({
        success: false,
        message: 'Quote is approval-locked. Approve/reject before editing.',
        code: 'APPROVAL_LOCKED'
      });
    }

    const editable = [
      'quoteTitle',
      'quoteDate',
      'validUntil',
      'currency',
      'exchangeRateSnapshot',
      'assignedTo',
      'customerId',
      'organizationRefId',
      'contactId',
      'dealId',
      'caseId',
      'customRecordId',
      'sourceContext',
      'sourceRef',
      'customFields'
    ];
    const hasNonStatusEdits = editable.some((key) =>
      Object.prototype.hasOwnProperty.call(req.body || {}, key)
    );
    if (hasNonStatusEdits) {
      assertQuoteRecordEditable(quote);
    }

    // Status updates from the generic record page currently use PUT /quotes/:id.
    // When status is present, enforce transitions (same as PATCH /:id/status).
    const nextStatus = req.body?.status;
    const fromStatus = quote.status;
    let statusChanged = false;
    if (nextStatus !== undefined && nextStatus !== null && String(nextStatus).trim() !== '') {
      assertValidStatus(nextStatus);
      if (String(nextStatus) !== String(fromStatus)) {
        assertCanTransitionQuoteStatus(fromStatus, nextStatus);
        quote.status = nextStatus;
        statusChanged = true;
      }
    }

    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        quote[key] = req.body[key];
      }
    }

    await quote.save();

    if (statusChanged) {
      await writeQuoteActivity({
        organizationId,
        quoteId: quote._id,
        userId: req.user._id,
        action: 'quote_status_changed',
        message: `Status changed: ${fromStatus} → ${quote.status}`,
        details: { fromStatus, toStatus: quote.status }
      });
    } else {
      await writeQuoteActivity({
        organizationId,
        quoteId: quote._id,
        userId: req.user._id,
        action: 'quote_updated',
        message: 'Quote updated',
        details: { keys: Object.keys(req.body || {}) }
      });
    }

    try {
      emitQuoteEvents({
        previous: previousSnapshot,
        current: quote.toObject ? quote.toObject() : quote,
        organizationId,
        triggeredBy: req.user._id
      });
    } catch (emitErr) {
      console.warn('[quotes] emitQuoteEvents on update failed:', emitErr?.message || emitErr);
    }

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'VALIDATION' ||
      code === 'INVALID_TRANSITION' ||
      code === 'QUOTE_RECORD_LOCKED'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

function userCanActOnApprovals(req) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
}

async function buildQuoteCompareActivityDetails({ organizationId, quote, req, approvalId = null }) {
  const revisionNumber = Number(quote?.revisionNumber) || 1;
  const details = {
    revisionNumber,
    compareLink: `/quotes/${quote?._id}/compare?toRevision=${revisionNumber}`,
    approvalId
  };
  try {
    const compare = await compareQuoteRevisions({
      organizationId,
      quoteId: quote._id
    });
    if (compare?.from?.revisionNumber) {
      details.compareBaselineRevision = compare.from.revisionNumber;
      details.compareLink = `/quotes/${quote._id}/compare?fromRevision=${compare.from.revisionNumber}&toRevision=${revisionNumber}`;
    }
    details.changeCounts = compare?.summary?.changeCounts || null;
    details.riskLevel = compare?.summary?.riskLevel || 'low';
    details.riskIndicators = compare?.summary?.riskIndicators || [];
    details.executiveSummary = compare?.summary?.executiveSummary || [];
  } catch (err) {
    details.compareError = err?.message || 'Compare unavailable';
  }
  return details;
}

/**
 * POST /api/quotes/:id/submit-for-approval
 * Body: { comment? }
 */
async function submitQuoteForApproval(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const previousSnapshot = quote.toObject ? quote.toObject() : { ...quote };
    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only Draft quotes can be submitted for approval.',
        code: 'APPROVAL_SUBMIT_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Pending Approval';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalRequired = true;
    quote.approvalStatus = 'Pending';
    quote.approvalLocked = true;
    await quote.save();
    const compareDetails = await buildQuoteCompareActivityDetails({ organizationId, quote, req });

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'submit',
      fromStatus,
      toStatus,
      comment: req.body?.comment ?? null,
      metadata: compareDetails
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_submitted_for_approval',
      message: 'Submitted for approval',
      details: { fromStatus, toStatus, ...compareDetails }
    });

    try {
      emitQuoteEvents({
        previous: previousSnapshot,
        current: quote.toObject ? quote.toObject() : quote,
        organizationId,
        triggeredBy: req.user._id,
        submittedForApproval: true
      });
    } catch (emitErr) {
      console.warn('[quotes] emitQuoteEvents on submit failed:', emitErr?.message || emitErr);
    }

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to submit for approval',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/approve
 * Body: { comment? }
 */
async function approveQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    if (!userCanActOnApprovals(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve', code: 'FORBIDDEN' });
    }

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only Pending Approval quotes can be approved.',
        code: 'APPROVAL_DECISION_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Approved';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalStatus = 'Approved';
    quote.approvalLocked = false;
    await quote.save();
    const compareDetails = await buildQuoteCompareActivityDetails({ organizationId, quote, req });

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'approve',
      fromStatus,
      toStatus,
      comment: req.body?.comment ?? null,
      metadata: compareDetails
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_approved',
      message: 'Quote approved',
      details: { fromStatus, toStatus, comment: req.body?.comment ?? null, ...compareDetails }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to approve quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/reject
 * Body: { comment? }
 */
async function rejectQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    if (!userCanActOnApprovals(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject', code: 'FORBIDDEN' });
    }

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }
    const rejectReason = String(req.body?.reason ?? req.body?.comment ?? '').trim();
    if (!rejectReason) {
      return res.status(400).json({
        success: false,
        message: 'Reject reason is required.',
        code: 'REJECT_REASON_REQUIRED'
      });
    }

    const fromStatus = quote.status;
    if (String(fromStatus) !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only Pending Approval quotes can be rejected.',
        code: 'APPROVAL_DECISION_INVALID_STATUS',
        details: { fromStatus }
      });
    }
    const toStatus = 'Rejected';
    assertCanTransitionQuoteStatus(fromStatus, toStatus);

    quote.status = toStatus;
    quote.approvalStatus = 'Rejected';
    quote.approvalLocked = false;
    await quote.save();
    const compareDetails = await buildQuoteCompareActivityDetails({ organizationId, quote, req });

    await appendQuoteApprovalEvent({
      organizationId,
      quote,
      userId: req.user._id,
      action: 'reject',
      fromStatus,
      toStatus,
      comment: rejectReason,
      metadata: { reason: rejectReason, ...compareDetails }
    });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_rejected',
      message: 'Quote rejected',
      details: { fromStatus, toStatus, reason: rejectReason, ...compareDetails }
    });

    return res.json({ success: true, data: quote });
  } catch (err) {
    const code = err?.code;
    const status = code === 'VALIDATION' || code === 'INVALID_TRANSITION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reject quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

function generatePublicToken() {
  // URL-safe token, 32 bytes -> 43ish chars base64url
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * POST /api/quotes/:id/share
 * Body: { rotateToken?: boolean }
 *
 * Generates/rotates the publicShareToken and marks quote as sent.
 */
async function shareQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const orgQuoteSettings = await getQuoteOrgSettings(organizationId);
    const mode = String(req.body?.mode || 'formal').toLowerCase() === 'draft' ? 'draft' : 'formal';
    const rotate = req.body?.rotateToken === true || !quote.publicShareToken;

    if (mode === 'draft') {
      assertCanSendQuoteToCustomer(quote, orgQuoteSettings);
      if (rotate) {
        quote.publicShareToken = generatePublicToken();
      }
      quote.portalAccessEnabled = true;
      quote.customerShareMode = 'draft';
      quote.draftSharedAt = quote.draftSharedAt || new Date();
    } else {
      assertCanShareQuotePublicly(quote, orgQuoteSettings);

      const fromStatus = quote.status;
      if (String(fromStatus) !== 'Sent') {
        assertCanTransitionQuoteStatus(fromStatus, 'Sent');
        quote.status = 'Sent';
      }

      if (rotate) {
        quote.publicShareToken = generatePublicToken();
      }
      quote.sentToCustomer = true;
      if (!quote.sentAt) quote.sentAt = new Date();
      quote.portalAccessEnabled = true;
      quote.customerShareMode = 'formal';
    }

    await quote.save();

    const publicUrl = buildPublicQuoteUrl(quote.publicShareToken, req);

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: rotate ? 'quote_share_token_rotated' : 'quote_shared',
      message:
        mode === 'draft'
          ? rotate
            ? 'Draft share link generated'
            : 'Draft share link reused'
          : rotate
            ? 'Public share link generated'
            : 'Public share link reused',
      details: { status: quote.status, customerShareMode: quote.customerShareMode }
    });

    return res.json({
      success: true,
      data: {
        quoteId: quote._id,
        status: quote.status,
        publicShareToken: quote.publicShareToken,
        customerShareMode: quote.customerShareMode,
        publicUrl
      }
    });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'VALIDATION' ||
      code === 'INVALID_TRANSITION' ||
      code === 'QUOTE_SHARE_NOT_ALLOWED' ||
      code === 'QUOTE_SEND_NOT_ALLOWED'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to share quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * POST /api/quotes/:id/share/revoke
 *
 * Revokes the public link (rotates token to null).
 */
async function revokeQuoteShare(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    quote.publicShareToken = null;
    quote.portalAccessEnabled = false;
    await quote.save();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_share_revoked',
      message: 'Public share link revoked',
      details: {}
    });

    return res.json({ success: true, data: { quoteId: quote._id, publicShareToken: null } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to revoke share',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * POST /api/quotes/:id/convert
 *
 * Delegates to salesOrderConversionService (SO1).
 */
async function convertQuote(req, res) {
  try {
    const overrideExpired = userCanOverrideExpiredQuotes(req);
    const result = await convertQuoteToSalesOrder({
      organizationId: req.user.organizationId,
      quoteId: req.params.id,
      userId: req.user._id,
      body: req.body,
      overrideExpired
    });

    return res.status(201).json({
      success: true,
      data: {
        quoteId: result.quote._id,
        status: result.quote.status,
        converted: result.quote.converted === true,
        conversionStatus: result.quote.conversionStatus,
        conversionLinkId: result.link._id,
        salesOrderId: result.salesOrder.salesOrderId,
        salesOrderMongoId: result.salesOrder._id,
        salesOrderNumber: result.salesOrder.salesOrderNumber,
        coverage: result.resolution.coverage,
        unmappedLineIds: result.resolution.unmappedLineIds
      }
    });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'VALIDATION' ||
      code === 'INVALID_TRANSITION' ||
      code === 'ALREADY_CONVERTED' ||
      code === 'CONVERSION_NOT_ALLOWED' ||
      code === 'QUOTE_EXPIRED' ||
      code === 'NOTHING_TO_CONVERT' ||
      code === 'INVALID_LINE_SELECTION' ||
      code === 'LINES_ALREADY_CONVERTED'
        ? 400
        : code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to convert quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * GET /api/quotes/:id/conversion
 *
 * Q8 stub: fetch conversion link (if any) for this quote revision.
 */
async function getQuoteConversion(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId, deletedAt: null })
      .select(
        '_id quoteNumber revisionNumber status converted conversionStatus validUntil customerResponse grandTotal currency'
      )
      .lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const revisionNumber = Number(quote.revisionNumber) || 1;
    const links = await QuoteConversionLink.find({ organizationId, quoteId: quote._id, revisionNumber })
      .sort({ createdAt: -1 })
      .lean();

    const convertedLineIds = await getConvertedLineIdsForQuote({ organizationId, quoteId: quote._id });
    const coverageResolution = resolveQuoteConversionCoverage({ quote, convertedLineIds });

    const canOverrideExpired = userCanOverrideExpiredQuotes(req);
    const eligibility = {
      ...getQuoteConversionEligibility(quote, { overrideExpired: canOverrideExpired }),
      canOverrideExpired,
      coverage: coverageResolution.coverage,
      unmappedLineIds: coverageResolution.unmappedLineIds,
      eligibleForMoreConversion: coverageResolution.unmappedLineIds.length > 0 && quote.status !== 'Converted'
    };

    return res.json({
      success: true,
      data: {
        quote: {
          quoteId: quote._id,
          quoteNumber: quote.quoteNumber,
          revisionNumber,
          status: quote.status,
          converted: quote.converted === true,
          conversionStatus: quote.conversionStatus,
          validUntil: quote.validUntil ?? null
        },
        conversion: links[0] || null,
        conversions: links,
        coverage: coverageResolution,
        eligibility
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch conversion',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * DELETE /api/quotes/:id
 *
 * Soft delete (move to trash) via deletionService.
 */
async function deleteQuote(req, res) {
  try {
    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'quotes',
      recordId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      appKey: 'platform',
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
        message: result.message || 'Failed to delete quote'
      });
    }

    await writeQuoteActivity({
      organizationId: req.user.organizationId,
      quoteId: req.params.id,
      userId: req.user._id,
      action: 'quote_deleted',
      message: 'Quote moved to trash',
      details: { retentionExpiresAt: result.retentionExpiresAt }
    });

    return res.status(200).json({
      success: true,
      message: 'Quote moved to trash',
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (error) {
    console.error('Delete quote error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting quote.',
      error: error.message
    });
  }
}

/**
 * POST /api/quotes/:id/recalculate
 *
 * Recomputes line totals + quote totals deterministically from snapshots.
 * Does NOT re-resolve catalog pricing.
 */
/**
 * PATCH /api/quotes/:id/discounts
 * Body: { globalDiscountType?, globalDiscountValue?, globalDiscountAmount?, overridePricing? }
 */
async function patchQuoteDiscounts(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'globalDiscountType')) {
      const raw = req.body.globalDiscountType;
      quote.globalDiscountType = raw === null || raw === '' ? null : String(raw).trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'globalDiscountValue')) {
      const v = normalizeNumber(req.body.globalDiscountValue, { defaultValue: NaN });
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'globalDiscountValue must be >= 0' });
      }
      quote.globalDiscountValue = v;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'globalDiscountAmount')) {
      const a = normalizeNumber(req.body.globalDiscountAmount, { defaultValue: NaN });
      if (!Number.isFinite(a) || a < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'globalDiscountAmount must be >= 0' });
      }
      quote.globalDiscountAmount = a;
    } else if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'globalDiscountType') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'globalDiscountValue')
    ) {
      quote.globalDiscountAmount = 0;
    }

    await quote.save();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });
    const lines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_discounts_updated',
      message: 'Quote discounts updated',
      details: { totals }
    });

    const refreshed = await Quote.findOne({ _id: quoteId, organizationId }).lean();

    return res.json({
      success: true,
      data: {
        quote: refreshed,
        sections,
        lines,
        totals
      }
    });
  } catch (err) {
    const status = err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update quote discounts',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

async function recalculateQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const lines = await QuoteLine.find({ organizationId, quoteId }).lean();
    if (!lines.length) {
      const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId });
      return res.json({
        success: true,
        data: { quoteId, totals, sections, lines: [], updatedLines: 0 }
      });
    }

    const bulkOps = [];
    for (const l of lines) {
      const computed = quoteTotalsService.computeLineTotals(l);
      bulkOps.push({
        updateOne: {
          filter: { _id: l._id, organizationId },
          update: {
            $set: {
              lineSubtotal: computed.lineSubtotal,
              lineTaxTotal: computed.lineTaxTotal,
              lineTotal: computed.lineTotal
            }
          }
        }
      });
    }

    const bulk = await QuoteLine.bulkWrite(bulkOps, { ordered: false });

    const refreshedLines = await QuoteLine.find({ organizationId, quoteId }).lean();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId });

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_recalculated',
      message: 'Totals recalculated',
      details: { totals, updatedLines: bulk.modifiedCount ?? refreshedLines.length }
    });

    return res.json({
      success: true,
      data: {
        quoteId,
        totals,
        sections,
        lines: refreshedLines,
        updatedLines: bulk.modifiedCount ?? refreshedLines.length
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to recalculate quote',
      code: err?.code || 'UNKNOWN'
    });
  }
}

function assertCanReviseQuote(quote) {
  const status = String(quote?.status || '');
  if (isCommerciallyLockedStatus(status)) return;
  if (['Expired', 'Rejected', 'Cancelled'].includes(status)) return;
  const err = new Error('Revisions are intended for Sent/Accepted/Converted or terminal quotes.');
  err.code = 'REVISION_NOT_ALLOWED';
  err.details = { status };
  throw err;
}

/**
 * POST /api/quotes/:id/revise
 *
 * Clones the quote + its lines into a new Draft revision.
 * - Keeps `quoteNumber` the same
 * - Increments `revisionNumber`
 * - Deactivates the current active revision
 */
/**
 * POST /api/quotes/:id/send-email
 * Body: { to?, subject?, message?, attachPdf?: boolean, includeLink?: boolean }
 */
async function sendQuoteEmail(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const data = await sendQuoteEmailService({
      organizationId,
      quoteId,
      userId: req.user._id,
      body: req.body || {},
      req
    });

    const isDraftSend = data.sendMode === 'draft';
    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: isDraftSend ? 'quote_draft_shared' : 'quote_email_sent',
      message: isDraftSend
        ? `Draft quote shared with ${data.email.to}`
        : `Quote emailed to ${data.email.to}`,
      details: {
        to: data.email.to,
        subject: data.email.subject,
        sendMode: data.sendMode,
        includeLink: Boolean(data.email.publicUrl),
        messageId: data.email.messageId
      }
    });

    return res.json({ success: true, data });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'EMAIL_NOT_CONFIGURED' ||
            code === 'MISSING_RECIPIENT' ||
            code === 'QUOTE_SEND_NOT_ALLOWED' ||
            code === 'INVALID_TRANSITION'
          ? 400
          : code === 'EMAIL_SEND_FAILED'
            ? 502
            : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to send quote email',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

/**
 * GET /api/quotes/:id/process-approvals
 * Pending Process Designer approval gates for this quote.
 */
async function getQuoteProcessApprovals(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).select('_id').lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const pending = await findPendingProcessApprovalsForQuote({ organizationId, quoteId });

    return res.json({
      success: true,
      data: pending,
      count: pending.length
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load process approvals',
      code: 'UNKNOWN'
    });
  }
}

/**
 * GET /api/quotes/:id/revisions
 * Lists all revisions sharing the same quoteNumber (newest first).
 */
async function getQuoteRevisions(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId })
      .select('_id quoteNumber revisionNumber activeRevision status quoteDate validUntil grandTotal currency createdAt updatedAt')
      .lean();

    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    if (!quote.quoteNumber) {
      return res.json({
        success: true,
        data: {
          quoteNumber: null,
          currentQuoteId: String(quoteId),
          revisions: [quote]
        }
      });
    }

    const revisions = await Quote.find({
      organizationId,
      quoteNumber: quote.quoteNumber
    })
      .sort({ revisionNumber: -1, createdAt: -1 })
      .select(
        '_id quoteNumber revisionNumber activeRevision status quoteDate validUntil grandTotal currency sentAt converted conversionStatus createdAt updatedAt'
      )
      .lean();

    return res.json({
      success: true,
      data: {
        quoteNumber: quote.quoteNumber,
        currentQuoteId: String(quoteId),
        revisions
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch quote revisions',
      code: err?.code || 'UNKNOWN'
    });
  }
}

async function getQuoteRevisionCompare(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const data = await compareQuoteRevisions({
      organizationId,
      quoteId,
      fromRevision: req.query?.fromRevision || null,
      toRevision: req.query?.toRevision || null,
      filters: extractFilters(req.query || {})
    });
    return res.json({ success: true, data });
  } catch (err) {
    const code = err?.code;
    const status = code === 'NOT_FOUND' ? 404 : code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to compare quote revisions',
      code: code || 'UNKNOWN'
    });
  }
}

async function getQuoteApprovalWorkspaceHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const data = await getQuoteApprovalWorkspace({
      organizationId,
      quoteId,
      approvalId: req.query?.approvalId || null,
      filters: extractFilters(req.query || {})
    });
    return res.json({ success: true, data });
  } catch (err) {
    const code = err?.code;
    const status = code === 'NOT_FOUND' ? 404 : code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to load quote approval workspace',
      code: code || 'UNKNOWN'
    });
  }
}

async function getQuoteApprovalHistoryHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const revisionNumber = req.query?.revisionNumber || null;
    const quote = await Quote.findOne({ _id: quoteId, organizationId }).select('_id').lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }
    const data = await getQuoteApprovalHistory({ organizationId, quoteId, revisionNumber });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load quote approval history',
      code: 'UNKNOWN'
    });
  }
}

async function reviseQuote(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    assertCanReviseQuote(quote);

    const rootId = quote.sourceQuoteId ?? quote._id;

    const max = await Quote.find({ organizationId, quoteNumber: quote.quoteNumber })
      .sort({ revisionNumber: -1 })
      .limit(1)
      .select('revisionNumber')
      .lean();
    const nextRevisionNumber = Math.max(1, Number(max?.[0]?.revisionNumber) || 1) + 1;

    // Deactivate current revision (and any other active revisions defensively).
    await Quote.updateMany(
      { organizationId, quoteNumber: quote.quoteNumber, activeRevision: true },
      { $set: { activeRevision: false } }
    );

    const next = await Quote.create({
      organizationId,
      quoteNumber: quote.quoteNumber,
      revisionNumber: nextRevisionNumber,
      activeRevision: true,
      sourceQuoteId: rootId,

      quoteTitle: quote.quoteTitle,
      quoteDate: new Date(),
      validUntil: quote.validUntil ?? null,
      status: 'Draft',
      currency: quote.currency || 'USD',
      exchangeRateSnapshot: Number(quote.exchangeRateSnapshot) || 1,
      assignedTo: quote.assignedTo ?? req.user._id,

      customerId: quote.customerId ?? null,
      organizationRefId: quote.organizationRefId ?? null,
      contactId: quote.contactId ?? null,
      dealId: quote.dealId ?? null,
      caseId: quote.caseId ?? null,
      customRecordId: quote.customRecordId ?? null,
      sourceContext: quote.sourceContext ?? 'manual',
      sourceRef: quote.sourceRef ?? null,

      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,

      approvalRequired: false,
      approvalStatus: 'Not Required',
      approvalLocked: false,

      sentToCustomer: false,
      sentAt: null,
      publicShareToken: null,
      portalAccessEnabled: false,

      converted: false,
      conversionStatus: 'Not Converted',

      customFields: quote.customFields ?? {}
    });

    const { oldToNewSectionId } = await cloneSectionsForRevision({
      organizationId,
      sourceQuoteId: quote._id,
      targetQuoteId: next._id
    });

    const prevLines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const parents = prevLines.filter((l) => String(l.lineType) === 'bundle_parent');
    const others = prevLines.filter((l) => String(l.lineType) !== 'bundle_parent');

    const oldToNewParentId = new Map();
    const inserted = [];

    for (const parent of parents) {
      const payload = { ...parent };
      delete payload._id;
      delete payload.quoteLineId;
      delete payload.createdAt;
      delete payload.updatedAt;
      payload.quoteId = next._id;
      payload.parentBundleLineId = null;
      payload.lockedSnapshot = false;
      if (payload.quoteSectionId) {
        const mappedSection = oldToNewSectionId.get(String(payload.quoteSectionId));
        payload.quoteSectionId = mappedSection || null;
      }
      inserted.push(payload);
    }

    const createdParents = inserted.length ? await QuoteLine.insertMany(inserted, { ordered: true }) : [];
    for (let i = 0; i < parents.length; i++) {
      oldToNewParentId.set(String(parents[i]._id), createdParents[i]._id);
    }

    const insertedChildren = [];
    for (const line of others) {
      const payload = { ...line };
      delete payload._id;
      delete payload.quoteLineId;
      delete payload.createdAt;
      delete payload.updatedAt;
      payload.quoteId = next._id;
      payload.lockedSnapshot = false;

      if (payload.quoteSectionId) {
        const mappedSection = oldToNewSectionId.get(String(payload.quoteSectionId));
        payload.quoteSectionId = mappedSection || null;
      }

      if (payload.parentBundleLineId) {
        const mapped = oldToNewParentId.get(String(payload.parentBundleLineId));
        payload.parentBundleLineId = mapped || null;
      }
      // Keep bundleSnapshot but rewrite embedded parentBundleLineId if present.
      if (payload.bundleSnapshot && typeof payload.bundleSnapshot === 'object') {
        const b = { ...payload.bundleSnapshot };
        if (b.parentBundleLineId) {
          const mapped = oldToNewParentId.get(String(b.parentBundleLineId));
          if (mapped) b.parentBundleLineId = String(mapped);
        }
        payload.bundleSnapshot = b;
      }

      insertedChildren.push(payload);
    }
    if (insertedChildren.length) {
      await QuoteLine.insertMany(insertedChildren, { ordered: true });
    }

    await recomputeQuoteAndSectionTotals({ organizationId, quoteId: next._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: next._id,
      userId: req.user._id,
      action: 'quote_revision_created',
      message: `Revision created: Rev ${nextRevisionNumber}`,
      details: {
        sourceQuoteId: String(quote._id),
        fromQuoteId: String(quote._id),
        toQuoteId: String(next._id),
        quoteNumber: quote.quoteNumber,
        fromRevision: Number(quote.revisionNumber) || Math.max(1, nextRevisionNumber - 1),
        toRevision: nextRevisionNumber,
        revisionNumber: nextRevisionNumber,
        compareLink: `/quotes/${next._id}/compare?fromRevision=${Number(quote.revisionNumber) || Math.max(1, nextRevisionNumber - 1)}&toRevision=${nextRevisionNumber}`
      }
    });

    return res.status(201).json({ success: true, data: next });
  } catch (err) {
    const code = err?.code;
    const status =
      code === 'REVISION_NOT_ALLOWED' || code === 'VALIDATION'
        ? 400
        : code === 'NOT_FOUND'
          ? 404
          : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to revise quote',
      code: code || 'UNKNOWN',
      details: err.details || null
    });
  }
}

async function patchQuoteTaxesCharges(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }
    if (quote.approvalLocked === true) {
      return res.status(400).json({ success: false, message: 'Quote is approval-locked', code: 'APPROVAL_LOCKED' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: quote.status,
      overridePricing: override,
      req
    });

    const { hydrateTaxIds } = require('../services/commercialTaxApplicationService');
    const { getActiveChargesByIds } = require('../services/chargeService');
    const { calculateDocumentCharges } = require('../services/chargeCalculationService');
    const { CHARGE_SCOPES, isTransactionScope } = require('../constants/chargeConstants');

    if (Array.isArray(req.body?.transactionTaxIds)) {
      const taxes = await hydrateTaxIds(organizationId, req.body.transactionTaxIds);
      quote.transactionTaxSnapshot = {
        taxes: taxes.map((t) => ({
          taxId: t.taxId,
          name: t.name,
          code: t.code,
          taxType: t.taxType,
          taxValue: t.taxValue,
          scope: t.scope
        }))
      };
      quote.markModified('transactionTaxSnapshot');
    }

    if (Array.isArray(req.body?.transactionChargeIds)) {
      const charges = await getActiveChargesByIds(req.body.transactionChargeIds, organizationId);
      const txnCharges = charges
        .filter((c) => isTransactionScope(c.scope || CHARGE_SCOPES.TRANSACTION))
        .map((c) => ({
          chargeId: String(c._id),
          name: c.name,
          code: c.code,
          chargeType: c.chargeType,
          chargeValue: c.chargeValue,
          scope: c.scope
        }));
      const lines = await QuoteLine.find({ organizationId, quoteId: quote._id }).lean();
      const calc = calculateDocumentCharges({
        lines: lines.map((l) => ({
          quantity: 1,
          unitPrice: Number(l.lineSubtotal) || 0,
          charges: []
        })),
        transactionCharges: txnCharges
      });
      quote.chargeDocumentSnapshot = { charges: calc.transactionCharges };
      quote.chargesTotal = calc.transactionChargeTotal;
      quote.markModified('chargeDocumentSnapshot');
    }

    await quote.save();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });
    const lines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();
    const refreshed = await Quote.findOne({ _id: quoteId, organizationId }).lean();

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_taxes_charges_updated',
      message: 'Quote taxes/charges updated',
      details: { totals }
    });

    return res.json({
      success: true,
      data: { quote: refreshed, sections, lines, totals }
    });
  } catch (err) {
    const status = err?.code === 'VALIDATION' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update taxes/charges',
      code: err?.code || 'UNKNOWN'
    });
  }
}

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteRevisions,
  getQuoteRevisionCompare,
  getQuoteApprovalWorkspaceHandler,
  getQuoteApprovalHistoryHandler,
  getQuoteProcessApprovals,
  updateQuote,
  transitionQuoteStatus,
  submitQuoteForApproval,
  approveQuote,
  rejectQuote,
  shareQuote,
  revokeQuoteShare,
  convertQuote,
  getQuoteConversion,
  deleteQuote,
  recalculateQuote,
  reviseQuote,
  sendQuoteEmail,
  patchQuoteDiscounts,
  patchQuoteTaxesCharges
};
