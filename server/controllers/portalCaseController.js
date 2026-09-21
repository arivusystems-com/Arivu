const mongoose = require('mongoose');
const Case = require('../models/Case');
const mailroomConfigService = require('../services/mailroomConfigService');
const {
  createInitialSlaCycle,
  applyStatusToSlaCycle
} = require('../services/caseLifecycleService');
const { finalizeCaseSlaOnCreate } = require('../services/sla/slaCaseBridgeService');
const caseExecutionService = require('../services/caseExecutionService');
const { applyCaseActivitySideEffects } = require('../services/caseAutoStatusService');
const { assertPortalUserCanAccessCase } = require('../platform/mailroom/connectors/portal/portalSafety');
const { buildCaseTimelineActivities } = require('../platform/mailroom/services/caseTimelineAdapter');
const {
  buildPortalCaseAccessQuery,
  findPortalAccessibleCase,
  shapePortalCaseSummary,
  enrichPortalCaseSummary,
  enrichPortalCaseDetail,
  markPortalCaseRead,
  submitPortalCaseCsat
} = require('../services/portalCaseAccessService');
const { replyToCaseFromPortal } = require('./portalMailroomController');
const { validateCaseRecordId } = require('../utils/caseApiValidators');
const {
  getPortalRulesForUser,
  assertPortalActionAllowed
} = require('../platform/mailroom/connectors/portal/portalRules');

async function listPortalCases(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
    const query = await buildPortalCaseAccessQuery(organizationId, req.user, {
      portalConfig: mailroomConfig?.connectors?.portal
    });
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const [rows, total] = await Promise.all([
      Case.find(query)
        .select('caseId title description status priority channel createdAt updatedAt requesterEmail portalReadReceipts portalCsat')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Case.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: rows.map((row) => enrichPortalCaseSummary(row, req.user._id)),
      meta: { total, limit, skip }
    });
  } catch (error) {
    console.error('[portalCaseController] listPortalCases', error);
    return res.status(500).json({ success: false, message: 'Failed to list cases' });
  }
}

async function getPortalCase(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const caseId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const caseIdValidation = validateCaseRecordId(caseId);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
    const row = await findPortalAccessibleCase(organizationId, caseId, req.user, {
      portalConfig: mailroomConfig?.connectors?.portal
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const activityLimit = Math.max(0, Math.min(Number(req.query.activityLimit) || 200, 500));
    const embedded = Array.isArray(row.activities) ? row.activities : [];
    const trimmed = activityLimit > 0 ? embedded.slice(-activityLimit) : [];
    let merged = trimmed;
    try {
      merged = await buildCaseTimelineActivities(organizationId, row._id, trimmed);
    } catch (timelineErr) {
      console.error('[portalCaseController] getPortalCase timeline merge failed', timelineErr);
    }

    return res.json({
      success: true,
      data: enrichPortalCaseDetail(row, merged, req.user._id)
    });
  } catch (error) {
    console.error('[portalCaseController] getPortalCase', error);
    return res.status(500).json({ success: false, message: 'Failed to load case' });
  }
}

async function createPortalCase(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const { title, description, priority } = req.body || {};
    const requestedAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'description is required' });
    }

    const config = await mailroomConfigService.getOrCreateConfig(organizationId);
    const portalCapabilities = await getPortalRulesForUser(req.user, config);
    assertPortalActionAllowed(portalCapabilities, 'create_case');
    const portalChannel = portalCapabilities.channel;
    const defaults = config?.policies?.caseLink?.defaults || {};
    const assignedTo = defaults.defaultOwnerId && mongoose.Types.ObjectId.isValid(String(defaults.defaultOwnerId))
      ? defaults.defaultOwnerId
      : req.user._id;

    const now = new Date();
    const { allocateRequired } = require('../services/moduleNumberingService');
    const caseId = await allocateRequired({
      organizationId,
      moduleKey: 'cases',
      at: now,
    });
    const baseCycle = createInitialSlaCycle(1, now);
    const adjustedCycle = applyStatusToSlaCycle(baseCycle, 'New');

    const userEmail = String(req.user?.email || '').trim() || null;
    const displayName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim()
      || req.user?.username
      || userEmail
      || 'Portal User';

    const created = await Case.create({
      organizationId,
      caseId,
      title: String(title).trim(),
      description: String(description).trim(),
      caseType: defaults.defaultCaseType || 'Support Ticket',
      priority: priority || defaults.defaultPriority || 'Medium',
      status: 'New',
      assignedTo: assignedTo,
      channel: portalChannel,
      requesterEmail: userEmail,
      currentSlaCycle: adjustedCycle,
      activities: [
        {
          activityType: 'case_created',
          message: `Case created via ${portalChannel}`,
          internal: true,
          metadata: { source: 'portal' },
          actorId: req.user._id,
          actorName: displayName,
          createdAt: now
        }
      ],
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    created.currentSlaCycle = await finalizeCaseSlaOnCreate({
      organizationId,
      caseRecord: created,
      actorId: req.user._id
    });
    await created.save();

    await caseExecutionService.onCaseCreated({ caseRecord: created, actorId: req.user._id });

    const configPortal = config?.connectors?.portal;
    let mailroomIngest = null;
    const mailroomActive = configPortal?.enabled && config.enabled;
    if (mailroomActive) {
      try {
        const { processNormalizedInboundThroughMailroom } = require('../platform/mailroom/pipeline/genericInboundPipeline');
        const { sanitizePortalIngestResponse } = require('../platform/mailroom/connectors/portal/portalSafety');
        const { buildPortalCaseMailroomMessage } = require('../platform/mailroom/connectors/portal/portalMessageBuilder');

        const normalized = await buildPortalCaseMailroomMessage(
          {
            subject: String(title).trim(),
            body: String(description).trim(),
            attachments: requestedAttachments
          },
          {
            organizationId,
            caseId: created._id,
            user: req.user,
            subjectFallback: String(title).trim(),
            portalAudience: portalCapabilities.audience
          }
        );

        const result = await processNormalizedInboundThroughMailroom({
          organizationId,
          connectorType: 'portal',
          source: 'portal_case_create',
          jsonPayload: { caseId: created._id, message: normalized },
          message: normalized
        });
        mailroomIngest = sanitizePortalIngestResponse(result);
      } catch (mailroomErr) {
        console.warn('[portalCaseController] mailroom ingest after create:', mailroomErr.message);
      }
    } else {
      if (requestedAttachments.length) {
        const err = new Error('Attachments require Mailroom to be enabled for the Portal connector');
        err.statusCode = 400;
        throw err;
      }
      created.activities.push({
        activityType: 'channel_message_received',
        message: String(description).trim(),
        channel: portalChannel,
        internal: false,
        metadata: {
          source: 'portal',
          portalUserId: String(req.user._id || ''),
          portalAudience: portalCapabilities.audience
        },
        actorId: req.user._id,
        actorName: displayName,
        createdAt: now
      });
      const { statusResult } = await applyCaseActivitySideEffects(created, {
        activityType: 'channel_message_received',
        internal: false,
        actorId: req.user._id,
        actorName: displayName,
        channel: portalChannel
      });
      await created.save();
      if (statusResult?.changed) {
        await caseExecutionService.onCaseStatusChanged({
          caseRecord: created,
          actorId: req.user._id,
          fromStatus: statusResult.fromStatus,
          toStatus: statusResult.toStatus
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        ...shapePortalCaseSummary(created.toObject()),
        mailroomIngest
      }
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || undefined
      });
    }
    console.error('[portalCaseController] createPortalCase', error);
    return res.status(500).json({ success: false, message: 'Failed to create case' });
  }
}

async function replyPortalCaseDirect(req, res, { portalCapabilities, caseId, organizationId }) {
  const input = req.body?.message || {};
  const body = String(input.body || '').trim();
  if (!body) {
    return res.status(400).json({ success: false, message: 'message body is required' });
  }

  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (attachments.length) {
    return res.status(400).json({
      success: false,
      message: 'Attachments require Mailroom to be enabled for the Portal connector'
    });
  }

  const row = await Case.findOne({ _id: caseId, organizationId, deletedAt: null });
  if (!row) {
    return res.status(404).json({ success: false, message: 'Case not found' });
  }

  const now = new Date();
  const displayName = [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim()
    || req.user?.username
    || req.user?.email
    || 'Portal User';
  const portalChannel = portalCapabilities.channel;

  row.activities.push({
    activityType: 'channel_message_received',
    message: body,
    channel: portalChannel,
    internal: false,
    metadata: {
      source: 'portal',
      portalUserId: String(req.user._id || ''),
      portalAudience: portalCapabilities.audience
    },
    actorId: req.user._id,
    actorName: displayName,
    createdAt: now
  });

  const { statusResult } = await applyCaseActivitySideEffects(row, {
    activityType: 'channel_message_received',
    internal: false,
    actorId: req.user._id,
    actorName: displayName,
    channel: portalChannel
  });

  row.updatedBy = req.user._id;
  await row.save();

  if (statusResult?.changed) {
    await caseExecutionService.onCaseStatusChanged({
      caseRecord: row,
      actorId: req.user._id,
      fromStatus: statusResult.fromStatus,
      toStatus: statusResult.toStatus
    });
  }

  await caseExecutionService.onCaseActivityLogged({
    caseRecord: row,
    actorId: req.user._id,
    activityType: 'channel_message_received'
  });

  return res.json({
    success: true,
    data: {
      caseId: String(row._id),
      status: row.status
    }
  });
}

async function replyPortalCase(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const caseId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }
    const config = await mailroomConfigService.getOrCreateConfig(organizationId);
    const portalCapabilities = await getPortalRulesForUser(req.user, config);
    assertPortalActionAllowed(portalCapabilities, 'reply');
    await assertPortalUserCanAccessCase({ organizationId, caseId, user: req.user });
    const mailroomActive = config?.enabled && config?.connectors?.portal?.enabled;
    if (mailroomActive) {
      req.portalCapabilities = portalCapabilities;
      req.params.caseId = caseId;
      return replyToCaseFromPortal(req, res);
    }
    return replyPortalCaseDirect(req, res, { portalCapabilities, caseId, organizationId });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[portalCaseController] replyPortalCase', error);
    return res.status(500).json({ success: false, message: 'Failed to reply to case' });
  }
}

async function markPortalCaseReadHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const caseId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const caseIdValidation = validateCaseRecordId(caseId);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
    const readAt = await markPortalCaseRead(organizationId, caseId, req.user._id, {
      user: req.user,
      portalConfig: mailroomConfig?.connectors?.portal
    });
    if (!readAt) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    return res.json({ success: true, data: { readAt } });
  } catch (error) {
    console.error('[portalCaseController] markPortalCaseRead', error);
    return res.status(500).json({ success: false, message: 'Failed to mark case read' });
  }
}

async function submitPortalCaseCsatHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const caseId = req.params.id;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const caseIdValidation = validateCaseRecordId(caseId);
    if (!caseIdValidation.valid) {
      return res.status(400).json({ success: false, message: caseIdValidation.error });
    }

    const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
    const result = await submitPortalCaseCsat(
      organizationId,
      caseId,
      req.user._id,
      req.body || {},
      {
        user: req.user,
        portalConfig: mailroomConfig?.connectors?.portal
      }
    );

    if (!result.ok) {
      const statusMap = {
        NOT_FOUND: 404,
        NOT_CLOSED: 400,
        ALREADY_SUBMITTED: 409,
        INVALID_SCORE: 400
      };
      const messageMap = {
        NOT_FOUND: 'Case not found',
        NOT_CLOSED: 'Feedback is only available for closed cases',
        ALREADY_SUBMITTED: 'Feedback already submitted for this case',
        INVALID_SCORE: 'Score must be an integer from 1 to 5'
      };
      return res.status(statusMap[result.code] || 400).json({
        success: false,
        message: messageMap[result.code] || 'Unable to submit feedback',
        code: result.code
      });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[portalCaseController] submitPortalCaseCsat', error);
    return res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
}

module.exports = {
  listPortalCases,
  getPortalCase,
  createPortalCase,
  replyPortalCase,
  markPortalCaseReadHandler,
  submitPortalCaseCsatHandler
};
