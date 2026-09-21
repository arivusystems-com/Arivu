const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { setTyping, getTypingState } = require('../services/chatTypingService');
const {
  markAllInboundReadForAgent,
  markInboundDeliveredToAgent,
  listReceiptUpdates,
} = require('../services/chatMessageReceiptService');
const { emitMessageReceived, emitSessionEnded } = require('../services/liveChatEventService');
const { notifyLiveChatInboundMessage } = require('../services/liveChatNotificationService');
const {
  createCaseFromLiveChatSession,
  linkExistingCaseToSession,
  syncLinkedCaseMetadataForSession,
} = require('../services/liveChatCaseAdapter');
const {
  createLeadFromLiveChatSession,
  linkExistingPersonToSession,
  syncLinkedPeopleMetadataForSession,
} = require('../services/liveChatCrmAdapter');
const { claimSessionForAgent, transferSessionToAgent, ensureAgentOwnsOrClaimsSession, assertAgentNotBlockedByAssignment } = require('../services/liveChatSessionAssignmentService');
const { recordFirstAgentResponse, listAssignmentEventsForSession } = require('../services/liveChatSessionAssignmentTrackingService');
const { canAdminLiveChat } = require('../utils/liveChatPermissionUtils');
const { computeSessionTimingFields } = require('../utils/liveChatSessionTimingUtils');
const { listJourneyEventsForSession } = require('../services/liveChatVisitorJourneyService');
const { listSessionNotes, createSessionNote } = require('../services/liveChatSessionNoteService');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const {
  listOutcomesForOrganization,
  isValidOutcomeForOrganization,
  normalizeOutcomeKey,
} = require('../services/liveChatOutcomeService');
const {
  buildChatSessionScopeFilter,
  isValidSessionObjectId,
} = require('../utils/liveChatSessionQueryUtils');
const { resolveLinkedRecordsForSessionContext } = require('../services/liveChatContextService');
const {
  buildSessionRelationMaps,
  applySessionRelations,
  loadUsersById,
} = require('../services/liveChatSessionEnrichmentService');
const { buildBotClosePatch } = require('../constants/liveChatBotSession');
const { buildAgentSessionFieldPatch } = require('../constants/liveChatSessionFields');
const { buildSessionCloseFieldPatches } = require('../services/liveChatSessionCloseService');
const {
  archiveSession,
  buildSessionTranscriptExport,
  buildOrganizationTranscriptExport,
} = require('../services/liveChatSessionComplianceService');

function requireObjectId(id) {
  if (!isValidSessionObjectId(id)) {
    const err = new Error('Invalid session id');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function agentDisplayName(user) {
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    user?.email ||
    'Agent'
  );
}

function filterSessionRowForViewer(row, user) {
  if (canAdminLiveChat(user)) return row;
  return {
    ...row,
    internalNotes: '',
    sessionArchived: false,
    archiveDate: null,
    exported: false,
  };
}

function mapSessionRow(row, extras = {}) {
  return {
    _id: row._id,
    sessionKey: row.sessionKey || null,
    status: row.status || 'open',
    lifecycleStatus: row.lifecycleStatus || 'waiting',
    channel: row.channel || 'web',
    visitorId: row.visitorId || null,
    assignedAgentId: row.assignedAgentId || null,
    endedByAgentId: row.endedByAgentId || null,
    queueId: row.queueId || null,
    botId: row.botId || null,
    botInvolved: Boolean(row.botInvolved),
    botEscalated: Boolean(row.botEscalated),
    botResolution: row.botResolution || null,
    botMessageCount: Number(row.botMessageCount) || 0,
    visitorMessageCount: extras.visitorMessageCount ?? (Number(row.visitorMessageCount) || 0),
    agentMessageCount: extras.agentMessageCount ?? (Number(row.agentMessageCount) || 0),
    attachmentCount: extras.attachmentCount ?? (Number(row.attachmentCount) || 0),
    agentCount: extras.agentCount ?? (Number(row.agentCount) || 0),
    intent: row.intent || null,
    sentiment: row.sentiment || null,
    aiSummary: String(row.aiSummary || '').trim(),
    aiIntent: row.aiIntent || null,
    aiSentimentScore: typeof row.aiSentimentScore === 'number' ? row.aiSentimentScore : null,
    consentGiven: Boolean(row.consentGiven),
    consentTimestamp: row.consentTimestamp || null,
    sessionArchived: Boolean(row.sessionArchived),
    archiveDate: row.archiveDate || null,
    exported: Boolean(row.exported),
    visitor: row.visitor || {},
    pageUrl: row.pageUrl || '',
    referrerUrl: row.referrerUrl || '',
    entryPage: row.entryPage || row.pageUrl || '',
    browser: String(row.browser || '').trim(),
    operatingSystem: String(row.operatingSystem || '').trim(),
    deviceType: row.deviceType || 'desktop',
    country: String(row.country || '').trim(),
    language: String(row.language || '').trim(),
    visitorType: row.visitorType || null,
    priority: row.priority || null,
    internalNotes: String(row.internalNotes || '').trim(),
    linkedContactId: row.linkedContactId || null,
    linkedOrganizationId: row.linkedOrganizationId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt || null,
    linkedRecords: Array.isArray(row.linkedRecords) ? row.linkedRecords : [],
    outcome: row.outcome || null,
    endedAt: row.endedAt || null,
    subject: String(row.subject || '').trim(),
    tags: Array.isArray(row.tags) ? row.tags : [],
    summary: String(row.summary || '').trim(),
    csatScore: typeof row.csatScore === 'number' ? row.csatScore : null,
    feedbackComment: String(row.feedbackComment || '').trim(),
    ratedByVisitor: Boolean(row.ratedByVisitor),
    resolutionRating: row.resolutionRating || null,
    assignedAt: row.assignedAt || null,
    firstResponseAt: row.firstResponseAt || null,
    assignedBy: row.assignedBy || null,
    transferCount: Number(row.transferCount) || 0,
    agentsInvolved: Array.isArray(row.agentsInvolved) ? row.agentsInvolved : [],
    agentsInvolvedAgents: extras.agentsInvolvedAgents || [],
    timing: extras.timing || computeSessionTimingFields(row),
    queue: extras.queue || null,
    assignedAgent: extras.assignedAgent || null,
    handledBy: extras.handledBy || null,
    messageCount: extras.messageCount ?? 0,
    lastMessage: extras.lastMessage || null,
    unreadCount: extras.unreadCount || 0,
  };
}

async function enrichSessionRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return [];
  }

  const sessionIds = rows.map((row) => row._id);

  const [lastMessages, unreadCounts] = await Promise.all([
    ChatMessage.aggregate([
      { $match: { sessionId: { $in: sessionIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$sessionId',
          body: { $first: '$body' },
          direction: { $first: '$direction' },
          authorType: { $first: '$authorType' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]),
    ChatMessage.aggregate([
      {
        $match: {
          sessionId: { $in: sessionIds },
          direction: 'inbound',
          readAt: null,
        },
      },
      { $group: { _id: '$sessionId', count: { $sum: 1 } } },
    ]),
  ]);

  const lastBySession = new Map(lastMessages.map((row) => [String(row._id), row]));
  const unreadBySession = new Map(unreadCounts.map((row) => [String(row._id), row.count]));
  const relationMaps = await buildSessionRelationMaps(rows);

  return rows.map((row) => {
    const last = lastBySession.get(String(row._id));
    const lastMessage = last
      ? {
          body: String(last.body || '').slice(0, 160),
          direction: last.direction,
          authorType: last.authorType,
          createdAt: last.createdAt,
        }
      : null;
    const unreadCount = unreadBySession.get(String(row._id)) || 0;
    const relations = applySessionRelations(row, relationMaps);
    return mapSessionRow(row, { lastMessage, unreadCount, ...relations });
  });
}

async function loadSessionForOrg(sessionId, organizationId) {
  const scope = buildChatSessionScopeFilter(organizationId);
  return ChatSession.findOne({ _id: sessionId, ...scope }).lean();
}

exports.listSessions = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const status = String(req.query.status || 'open').toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const scope = buildChatSessionScopeFilter(organizationId);
    const filter = { ...scope };
    if (status === 'open' || status === 'closed') {
      filter.status = status;
    }
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    if (!includeArchived || !canAdminLiveChat(req.user)) {
      filter.sessionArchived = { $ne: true };
    }

    const [rows, total] = await Promise.all([
      ChatSession.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChatSession.countDocuments(filter),
    ]);

    const data = (await enrichSessionRows(rows)).map((row) => filterSessionRowForViewer(row, req.user));

    return res.json({
      success: true,
      data,
      meta: { total, limit, skip },
    });
  } catch (err) {
    console.error('[liveChatSessionController] listSessions', err);
    return res.status(500).json({ success: false, message: 'Failed to list chat sessions' });
  }
};

exports.getSession = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const [data] = (await enrichSessionRows([session])).map((row) => filterSessionRowForViewer(row, req.user));
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] getSession', err);
    return res.status(500).json({ success: false, message: 'Failed to load session' });
  }
};

exports.listSessionNotes = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const data = await listSessionNotes({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      limit: req.query.limit,
    });

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] listSessionNotes', err);
    return res.status(500).json({ success: false, message: 'Failed to load session notes' });
  }
};

exports.createSessionNote = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      agentId: req.user._id,
    });

    const data = await createSessionNote({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      authorId: req.user._id,
      body: req.body?.body,
    });

    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] createSessionNote', err);
    return res.status(500).json({ success: false, message: 'Failed to create session note' });
  }
};

exports.listSessionJourney = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const rows = await listJourneyEventsForSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      limit: req.query.limit,
    });

    const data = rows.map((row) => ({
      _id: row._id,
      page: String(row.page || '').trim(),
      action: row.action || 'page_view',
      createdAt: row.createdAt,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] listSessionJourney', err);
    return res.status(500).json({ success: false, message: 'Failed to load visitor journey' });
  }
};

exports.getSessionLinkedRecords = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const data = await resolveLinkedRecordsForSessionContext({
      organizationId: req.user.organizationId,
      sessionId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] getSessionLinkedRecords', err);
    return res.status(500).json({ success: false, message: 'Failed to load linked records' });
  }
};

exports.listMessages = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const rows = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, data: rows, meta: { sessionId: session._id } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] listMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to list messages' });
  }
};

function normalizeMessageAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      fileName: String(row?.fileName || row?.originalname || '').trim(),
      mimeType: String(row?.mimeType || row?.mimetype || '').trim(),
      size: Number(row?.size) || 0,
      url: String(row?.url || '').trim(),
      storagePath: String(row?.storagePath || '').trim(),
    }))
    .filter((row) => row.fileName && (row.url || row.storagePath));
}

exports.uploadMessageAttachment = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status === 'closed') {
      return res.status(409).json({ success: false, message: 'Session is closed' });
    }
    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      agentId: req.user._id,
    });
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const uploadResult = await persistMulterUpload(req, 'live-chat');
    return res.status(201).json({
      success: true,
      data: {
        fileName: req.file.originalname || uploadResult.storedFileName || 'attachment',
        mimeType: req.file.mimetype || '',
        size: Number(req.file.size) || 0,
        url: uploadResult.url || '',
        storagePath: uploadResult.storagePath || '',
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] uploadMessageAttachment', err);
    return res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status === 'closed') {
      return res.status(409).json({ success: false, message: 'Session is closed' });
    }

    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      agentId: req.user._id,
    });

    const body = String(req.body?.body || '').trim();
    const attachments = normalizeMessageAttachments(req.body?.attachments);
    if (!body && !attachments.length) {
      return res.status(400).json({ success: false, message: 'body or attachments are required' });
    }

    const authorName = agentDisplayName(req.user);
    const msg = await ChatMessage.create({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      direction: 'outbound',
      authorType: 'agent',
      authorName,
      body,
      attachments,
    });

    const now = new Date();
    await ChatSession.updateOne(
      { _id: session._id },
      {
        $set: {
          lastMessageAt: now,
          lifecycleStatus: ['waiting', 'assigned'].includes(String(session.lifecycleStatus || ''))
            ? 'active'
            : session.lifecycleStatus,
          updatedAt: now,
        },
      },
    );

    await recordFirstAgentResponse({ sessionId: session._id });

    emitMessageReceived({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      messageId: msg._id,
      direction: 'outbound',
      metadata: { authorName },
    });

    const data = typeof msg.toObject === 'function'
      ? msg.toObject({ virtuals: false })
      : msg;
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] sendMessage', err);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const result = await markAllInboundReadForAgent(session._id);
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] markRead', err);
    return res.status(500).json({ success: false, message: 'Failed to mark messages read' });
  }
};

exports.setTyping = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    assertAgentNotBlockedByAssignment(session, req.user._id);

    setTyping({
      sessionId: session._id,
      authorType: 'agent',
      authorName: agentDisplayName(req.user),
    });
    return res.status(204).end();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] setTyping', err);
    return res.status(500).json({ success: false, message: 'Failed to set typing' });
  }
};

exports.patchSession = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      agentId: req.user._id,
    });

    const fieldPatch = buildAgentSessionFieldPatch(req.body || {});
    if (!Object.keys(fieldPatch).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const scope = buildChatSessionScopeFilter(req.user.organizationId);
    const updatedAt = new Date();
    const updateResult = await ChatSession.updateOne(
      { _id: session._id, ...scope },
      { $set: { ...fieldPatch, updatedAt } },
    );
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const updated = await loadSessionForOrg(sessionId, req.user.organizationId);
    const [data] = await enrichSessionRows([updated]);
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] patchSession', err);
    return res.status(500).json({ success: false, message: 'Failed to update session' });
  }
};

exports.endSession = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (String(session.status || '') === 'closed') {
      return res.json({
        success: true,
        data: {
          sessionId: session._id,
          status: 'closed',
          lifecycleStatus: 'ended',
          outcome: session.outcome || null,
        },
      });
    }

    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      agentId: req.user._id,
    });

    const outcome = normalizeOutcomeKey(req.body?.outcome);
    if (!outcome) {
      return res.status(400).json({ success: false, message: 'outcome is required', code: 'OUTCOME_REQUIRED' });
    }

    const valid = await isValidOutcomeForOrganization(req.user.organizationId, outcome);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid outcome', code: 'INVALID_OUTCOME' });
    }

    const endedAt = new Date();
    const scope = buildChatSessionScopeFilter(req.user.organizationId);
    const fieldPatch = buildAgentSessionFieldPatch(req.body || {});
    const botClosePatch = buildBotClosePatch(session);
    const closeFieldPatches = await buildSessionCloseFieldPatches({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      session,
    });
    const updateResult = await ChatSession.updateOne(
      { _id: session._id, ...scope },
      {
        $set: {
          status: 'closed',
          lifecycleStatus: 'ended',
          outcome,
          endedAt,
          endedByAgentId: req.user._id,
          updatedAt: endedAt,
          ...fieldPatch,
          ...botClosePatch,
          ...closeFieldPatches,
        },
      },
    );
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    emitSessionEnded({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      outcome,
      sessionKey: session.sessionKey || null,
      triggeredBy: req.user._id,
      metadata: {
        visitorEmail: String(session.visitor?.email || '').trim() || null,
        pageUrl: session.pageUrl || null,
      },
    });

    try {
      await syncLinkedCaseMetadataForSession({
        organizationId: req.user.organizationId,
        sessionId: session._id,
      });
    } catch (syncErr) {
      console.error('[liveChatSessionController] endSession sync case metadata', syncErr);
    }
    try {
      await syncLinkedPeopleMetadataForSession({
        organizationId: req.user.organizationId,
        sessionId: session._id,
      });
    } catch (syncErr) {
      console.error('[liveChatSessionController] endSession sync people metadata', syncErr);
    }

    return res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: 'closed',
        lifecycleStatus: 'ended',
        outcome,
        endedAt,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] endSession', err);
    return res.status(500).json({ success: false, message: 'Failed to end session' });
  }
};

exports.listOutcomes = async (req, res) => {
  try {
    const outcomes = await listOutcomesForOrganization(req.user.organizationId);
    return res.json({ success: true, data: outcomes });
  } catch (err) {
    console.error('[liveChatSessionController] listOutcomes', err);
    return res.status(500).json({ success: false, message: 'Failed to load outcomes' });
  }
};

exports.streamMessages = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const startedAt = Date.now();
    let after = Number(req.query.after) || startedAt;
    let receiptAfter = startedAt;
    let lastTypingHash = '';
    let sessionClosedEmitted = String(session.status || '') === 'closed';
    let lastAssignedAgentId = session.assignedAgentId ? String(session.assignedAgentId) : '';

    const timer = setInterval(async () => {
      try {
        const currentSession = await ChatSession.findById(session._id)
          .select('status lifecycleStatus outcome endedAt assignedAgentId transferCount')
          .lean();
        if (currentSession) {
          const nextAssignedAgentId = currentSession.assignedAgentId
            ? String(currentSession.assignedAgentId)
            : '';
          const closedNow = String(currentSession.status || '') === 'closed';
          const shouldEmitClosed = closedNow && !sessionClosedEmitted;
          const assignmentChanged = nextAssignedAgentId !== lastAssignedAgentId;

          if (shouldEmitClosed || assignmentChanged) {
            if (shouldEmitClosed) sessionClosedEmitted = true;
            lastAssignedAgentId = nextAssignedAgentId;

            let assignedAgent = null;
            if (nextAssignedAgentId) {
              const usersById = await loadUsersById([nextAssignedAgentId]);
              assignedAgent = usersById.get(nextAssignedAgentId) || null;
            }

            res.write('event: session\n');
            res.write(
              `data: ${JSON.stringify({
                status: closedNow ? 'closed' : currentSession.status || null,
                lifecycleStatus: currentSession.lifecycleStatus || (closedNow ? 'ended' : null),
                outcome: currentSession.outcome || null,
                endedAt: currentSession.endedAt || null,
                assignedAgentId: currentSession.assignedAgentId || null,
                assignedAgent,
                transferCount: currentSession.transferCount ?? null,
              })}\n\n`,
            );
          }
        }

        const rows = await ChatMessage.find({
          sessionId: session._id,
          createdAt: { $gt: new Date(after) },
        })
          .sort({ createdAt: 1 })
          .limit(200)
          .lean();

        if (rows.length) {
          after = rows[rows.length - 1].createdAt.getTime();
          const inboundIds = rows
            .filter((r) => r.direction === 'inbound')
            .map((r) => String(r._id));
          if (inboundIds.length) {
            await markInboundDeliveredToAgent(session._id, inboundIds);
          }
          res.write('event: messages\n');
          res.write(`data: ${JSON.stringify(rows)}\n\n`);
        }

        const receiptRows = await listReceiptUpdates(session._id, receiptAfter);
        if (receiptRows.length) {
          const lastAt = Math.max(
            ...receiptRows.flatMap((r) => [
              r.deliveredAt ? new Date(r.deliveredAt).getTime() : 0,
              r.readAt ? new Date(r.readAt).getTime() : 0,
            ]),
          );
          if (lastAt > receiptAfter) receiptAfter = lastAt;
          res.write('event: receipts\n');
          res.write(`data: ${JSON.stringify(receiptRows)}\n\n`);
        }

        const typing = getTypingState(session._id);
        const typingHash = typing ? JSON.stringify(typing) : '';
        if (typing) {
          lastTypingHash = typingHash;
          res.write('event: typing\n');
          res.write(`data: ${JSON.stringify(typing)}\n\n`);
        } else if (typingHash !== lastTypingHash) {
          lastTypingHash = typingHash;
          res.write('event: typing\n');
          res.write('data: {}\n\n');
        }

        if (!rows.length) {
          res.write('event: ping\n');
          res.write('data: {}\n\n');
        }
      } catch (e) {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ message: 'stream error' })}\n\n`);
      }
    }, 1500);

    req.on('close', () => clearInterval(timer));
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] streamMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to open stream' });
  }
};

exports.listAssignmentEvents = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const rows = await listAssignmentEventsForSession({
      organizationId: req.user.organizationId,
      sessionId: session._id,
      limit: req.query.limit,
    });

    const userIds = new Set();
    for (const row of rows) {
      if (row.agentId) userIds.add(String(row.agentId));
      if (row.previousAgentId) userIds.add(String(row.previousAgentId));
      if (row.performedByUserId) userIds.add(String(row.performedByUserId));
    }

    const { loadUsersById } = require('../services/liveChatSessionEnrichmentService');
    const usersById = await loadUsersById(userIds);
    const data = rows.map((row) => ({
      _id: row._id,
      action: row.action,
      assignedBy: row.assignedBy || null,
      createdAt: row.createdAt,
      agent: row.agentId ? usersById.get(String(row.agentId)) || null : null,
      previousAgent: row.previousAgentId ? usersById.get(String(row.previousAgentId)) || null : null,
      performedBy: row.performedByUserId ? usersById.get(String(row.performedByUserId)) || null : null,
      metadata: row.metadata || {},
    }));

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] listAssignmentEvents', err);
    return res.status(500).json({ success: false, message: 'Failed to load assignment history' });
  }
};

exports.transferSession = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const toAgentId = req.body?.agentId;
    if (!toAgentId || !mongoose.Types.ObjectId.isValid(toAgentId)) {
      return res.status(400).json({ success: false, message: 'agentId is required' });
    }

    const session = await loadSessionForOrg(sessionId, req.user.organizationId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const result = await transferSessionToAgent({
      organizationId: req.user.organizationId,
      sessionId,
      toAgentId,
      performedByUserId: req.user._id,
      isSupervisor: canAdminLiveChat(req.user),
    });

    const updated = await loadSessionForOrg(sessionId, req.user.organizationId);
    const [data] = await enrichSessionRows([updated]);
    return res.json({ success: true, data: { ...result, session: data } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] transferSession', err);
    return res.status(500).json({ success: false, message: 'Failed to transfer session' });
  }
};

exports.claimSession = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    const result = await claimSessionForAgent({
      organizationId: req.user.organizationId,
      sessionId,
      agentId: req.user._id,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] claimSession', err);
    return res.status(500).json({ success: false, message: 'Failed to claim session' });
  }
};

exports.createLinkedCase = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId,
      agentId: req.user._id,
    });
    const title = req.body?.title != null ? String(req.body.title) : null;

    const result = await createCaseFromLiveChatSession({
      organizationId: req.user.organizationId,
      sessionId,
      actorId: req.user._id,
      title,
    });

    return res.status(201).json({
      success: true,
      data: {
        caseId: result.caseId,
        sessionId: result.sessionId,
        caseRecordId: result.caseRecord?.caseId || null,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code || 'CREATE_CASE_FAILED',
      });
    }
    console.error('[liveChatSessionController] createLinkedCase', err);
    return res.status(500).json({ success: false, message: 'Failed to create case from session' });
  }
};

exports.linkExistingCase = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId,
      agentId: req.user._id,
    });
    const caseId = req.body?.caseId;
    if (!caseId) {
      return res.status(400).json({ success: false, message: 'caseId is required' });
    }

    const result = await linkExistingCaseToSession({
      organizationId: req.user.organizationId,
      sessionId,
      caseId,
      actorId: req.user._id,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code || 'LINK_CASE_FAILED',
      });
    }
    console.error('[liveChatSessionController] linkExistingCase', err);
    return res.status(500).json({ success: false, message: 'Failed to link case' });
  }
};

exports.createLinkedLead = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId,
      agentId: req.user._id,
    });

    const result = await createLeadFromLiveChatSession({
      organizationId: req.user.organizationId,
      sessionId,
      actorId: req.user._id,
    });

    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        personId: result.personId,
        sessionId: result.sessionId,
        created: result.created,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code || 'CREATE_LEAD_FAILED',
      });
    }
    console.error('[liveChatSessionController] createLinkedLead', err);
    return res.status(500).json({ success: false, message: 'Failed to create lead from session' });
  }
};

exports.linkExistingPerson = async (req, res) => {
  try {
    const sessionId = requireObjectId(req.params.sessionId);
    await ensureAgentOwnsOrClaimsSession({
      organizationId: req.user.organizationId,
      sessionId,
      agentId: req.user._id,
    });
    const personId = req.body?.personId;
    if (!personId) {
      return res.status(400).json({ success: false, message: 'personId is required' });
    }

    const result = await linkExistingPersonToSession({
      organizationId: req.user.organizationId,
      sessionId,
      personId,
      actorId: req.user._id,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code || 'LINK_PERSON_FAILED',
      });
    }
    console.error('[liveChatSessionController] linkExistingPerson', err);
    return res.status(500).json({ success: false, message: 'Failed to link person' });
  }
};

exports.archiveSession = async (req, res) => {
  try {
    if (!canAdminLiveChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const sessionId = requireObjectId(req.params.sessionId);
    const archived = req.body?.archived !== false;
    const data = await archiveSession({
      organizationId: req.user.organizationId,
      sessionId,
      archived,
    });

    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] archiveSession', err);
    return res.status(500).json({ success: false, message: 'Failed to archive session' });
  }
};

exports.exportSessionTranscript = async (req, res) => {
  try {
    if (!canAdminLiveChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const sessionId = requireObjectId(req.params.sessionId);
    const payload = await buildSessionTranscriptExport({
      organizationId: req.user.organizationId,
      sessionId,
      markExported: true,
    });

    const fileKey = String(payload.session?.sessionKey || sessionId).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="live-chat-${fileKey}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] exportSessionTranscript', err);
    return res.status(500).json({ success: false, message: 'Failed to export session transcript' });
  }
};

exports.exportOrganizationTranscripts = async (req, res) => {
  try {
    if (!canAdminLiveChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const status = String(req.query.status || 'closed').toLowerCase();
    const limit = req.query.limit;
    const markExported = String(req.query.markExported || 'false').toLowerCase() === 'true';
    const payload = await buildOrganizationTranscriptExport({
      organizationId: req.user.organizationId,
      status,
      limit,
      markExported,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="live-chat-transcripts.json"');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatSessionController] exportOrganizationTranscripts', err);
    return res.status(500).json({ success: false, message: 'Failed to export transcripts' });
  }
};
