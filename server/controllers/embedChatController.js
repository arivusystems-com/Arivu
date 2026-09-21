const crypto = require('crypto');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { setTyping, getTypingState } = require('../services/chatTypingService');
const {
  markRead,
  markOutboundDeliveredToVisitor,
  listReceiptUpdates
} = require('../services/chatMessageReceiptService');
const { DEFAULT_WELCOME_MESSAGE } = require('../services/liveChatWidgetService');
const {
  emitSessionStarted,
  emitMessageReceived
} = require('../services/liveChatEventService');
const { notifyLiveChatInboundMessage } = require('../services/liveChatNotificationService');
const { emitSessionEnded } = require('../services/liveChatEventService');
const { normalizeOutcomeKey } = require('../services/liveChatOutcomeService');
const { allocateSessionKey } = require('../services/liveChatSessionKeyService');
const {
  bindSessionToDefaultQueue,
  assignWaitingSession,
} = require('../services/liveChatSessionAssignmentService');
const {
  startBotHandlingOnSession,
  handleBotVisitorMessage,
} = require('../services/liveChatBotRuntimeService');
const {
  resolveOrCreateVisitor,
  incrementVisitorSessionCount,
} = require('../services/liveChatVisitorService');
const { buildVisitorFeedbackPatch } = require('../constants/liveChatSessionFields');
const { buildSessionCloseFieldPatches } = require('../services/liveChatSessionCloseService');
const {
  buildSessionVisitorContextFromRequest,
  recordJourneyEvent,
} = require('../services/liveChatVisitorJourneyService');
const { LIVE_CHAT_JOURNEY_ACTIONS } = require('../constants/liveChatVisitorContext');
const { inferVisitorTypeFromVisitor } = require('../constants/liveChatSessionIdentity');
const { buildSessionConsentPatch } = require('../constants/liveChatSessionCompliance');
const { uploadMulterFile } = require('../services/fileStorageService');

function secret() {
  return crypto.randomBytes(24).toString('hex');
}

async function createSession(req, res) {
  try {
    const instancePublicKey =
      String(req.query?.instanceKey || req.body?.instanceKey || req.headers['x-instance-key'] || '').trim();

    const organizationId = req.organization?._id || null;
    const visitorPayload = req.body?.visitor && typeof req.body.visitor === 'object' ? req.body.visitor : {};
    const visitorContext = buildSessionVisitorContextFromRequest(req, req.body || {});
    const pageUrl = visitorContext.pageUrl;

    const visitorId = organizationId
      ? await resolveOrCreateVisitor({
          organizationId,
          visitor: visitorPayload,
          pageUrl,
          userAgent: visitorContext.userAgent,
          ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''),
        })
      : null;

    const sessionKey = organizationId ? await allocateSessionKey(organizationId) : null;
    const widget = req.liveChatWidget || {};
    const consentPatch = buildSessionConsentPatch(req.body || {}, {
      consentRequired: widget.consentRequired !== false,
    });

    const row = await ChatSession.create({
      organizationId,
      sessionKey,
      channel: 'web',
      visitorId,
      instancePublicKey,
      sessionSecret: secret(),
      lifecycleStatus: 'waiting',
      ...consentPatch,
      visitor: {
        name: String(visitorPayload.name || '').trim(),
        email: String(visitorPayload.email || '').trim(),
        phone: String(visitorPayload.phone || '').trim(),
        externalId: String(visitorPayload.externalId || '').trim(),
      },
      visitorType: inferVisitorTypeFromVisitor(visitorPayload),
      pageUrl,
      referrerUrl: visitorContext.referrerUrl,
      entryPage: visitorContext.entryPage,
      browser: visitorContext.browser,
      operatingSystem: visitorContext.operatingSystem,
      deviceType: visitorContext.deviceType,
      country: visitorContext.country,
      language: visitorContext.language,
      userAgent: visitorContext.userAgent,
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''),
    });

    if (visitorId) {
      await incrementVisitorSessionCount(visitorId);
    }

    if (organizationId && pageUrl) {
      await recordJourneyEvent({
        organizationId,
        sessionId: row._id,
        page: pageUrl,
        action: LIVE_CHAT_JOURNEY_ACTIONS.PAGE_VIEW,
      });
    }

    // Do not notify/assign agents until the visitor sends their first message.
    // Bot greeting (if enabled) may still start here without routing to an agent.
    if (organizationId) {
      await bindSessionToDefaultQueue({ organizationId, sessionId: row._id });
      await startBotHandlingOnSession({ organizationId, sessionId: row._id });
      const { tryAutoLinkExistingPersonToSession } = require('../services/liveChatCrmAdapter');
      void tryAutoLinkExistingPersonToSession({ organizationId, sessionId: row._id }).catch((linkErr) => {
        console.warn('[embedChatController] auto-link person skipped:', linkErr?.message || linkErr);
      });
    }

    return res.json({
      success: true,
      data: {
        sessionId: row._id,
        sessionKey: row.sessionKey || null,
        sessionSecret: row.sessionSecret
      }
    });
  } catch (err) {
    console.error('[embedChatController] createSession', err);
    return res.status(500).json({ success: false, message: 'Failed to create chat session' });
  }
}

async function getEmbedChatConfig(req, res) {
  try {
    const widget = req.liveChatWidget || {};
    const captureFields = Array.isArray(widget.captureFields) ? widget.captureFields : ['name', 'email'];
    const welcomeMessage =
      String(widget.welcomeMessage || '').trim() || DEFAULT_WELCOME_MESSAGE;

    return res.json({
      success: true,
      data: {
        captureFields: captureFields.map((v) => String(v || '').trim()).filter(Boolean),
        welcomeMessage,
        consentRequired: widget.consentRequired !== false,
        consentMessage: String(widget.consentMessage || '').trim(),
        privacyPolicyUrl: String(widget.privacyPolicyUrl || '').trim(),
        termsUrl: String(widget.termsUrl || '').trim(),
        brandColor: String(widget.brandColor || '').trim() || '#4f46e5',
      },
    });
  } catch (err) {
    console.error('[embedChatController] getEmbedChatConfig', err);
    return res.status(500).json({ success: false, message: 'Failed to load chat config' });
  }
}

async function assertSessionSecret(req, session) {
  const provided = String(req.headers['x-chat-session-secret'] || req.query?.sessionSecret || '').trim();
  if (!provided || provided !== String(session.sessionSecret)) {
    const err = new Error('Invalid session secret');
    err.statusCode = 403;
    throw err;
  }
}

async function getSession(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);
    return res.json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status || 'open',
        createdAt: session.createdAt,
        lastMessageAt: session.lastMessageAt || null,
        visitor: session.visitor || {},
        ratedByVisitor: Boolean(session.ratedByVisitor),
        csatScore: typeof session.csatScore === 'number' ? session.csatScore : null,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] getSession', err);
    return res.status(500).json({ success: false, message: 'Failed to load session' });
  }
}

async function closeSession(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    const endedAt = new Date();
    const organizationId = req.organization?._id || session.organizationId || null;
    const closeFieldPatches = await buildSessionCloseFieldPatches({
      organizationId,
      sessionId: session._id,
      session,
    });

    await ChatSession.updateOne(
      { _id: session._id },
      {
        $set: {
          status: 'closed',
          lifecycleStatus: 'ended',
          outcome: 'abandoned',
          endedAt,
          updatedAt: endedAt,
          ...closeFieldPatches,
        },
      },
    );

    if (req.organization?._id) {
      emitSessionEnded({
        organizationId: req.organization._id,
        sessionId: session._id,
        outcome: 'abandoned',
        sessionKey: session.sessionKey || null,
        metadata: { closedBy: 'visitor' },
      });
    }

    return res.json({ success: true, data: { sessionId: session._id, status: 'closed' } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] closeSession', err);
    return res.status(500).json({ success: false, message: 'Failed to close session' });
  }
}

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

async function uploadMessageAttachment(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);
    if (String(session.status || '') === 'closed') {
      return res.status(409).json({ success: false, message: 'Session is closed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!req.organization?._id) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const uploadResult = await uploadMulterFile(req.file, {
      organizationId: req.organization._id,
      category: 'live-chat',
    });
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
    console.error('[embedChatController] uploadMessageAttachment', err);
    return res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
}

async function postMessage(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);
    if (String(session.status || '') === 'closed') {
      return res.status(409).json({ success: false, message: 'Session is closed' });
    }

    const body = String(req.body?.body || '').trim();
    const attachments = normalizeMessageAttachments(req.body?.attachments);
    if (!body && !attachments.length) {
      return res.status(400).json({ success: false, message: 'body or attachments are required' });
    }

    const inboundBefore = await ChatMessage.countDocuments({
      sessionId: session._id,
      direction: 'inbound',
    });
    const isFirstVisitorMessage = inboundBefore === 0;

    const msg = await ChatMessage.create({
      organizationId: req.organization?._id || null,
      sessionId: session._id,
      direction: 'inbound',
      authorType: 'visitor',
      authorName: String(req.body?.authorName || session.visitor?.name || '').trim(),
      body,
      attachments,
    });

    const now = new Date();

    await ChatSession.updateOne(
      { _id: session._id },
      {
        $set: {
          lastMessageAt: now,
          lifecycleStatus:
            session.lifecycleStatus === 'bot_handling'
              ? 'bot_handling'
              : session.lifecycleStatus === 'waiting'
                ? 'active'
                : session.lifecycleStatus,
        },
      },
    );

    let refreshedSession = await ChatSession.findById(session._id).lean();

    if (req.organization?._id && isFirstVisitorMessage) {
      emitSessionStarted({
        organizationId: req.organization._id,
        sessionId: session._id,
        metadata: {
          pageUrl: session.pageUrl || null,
          instancePublicKey: session.instancePublicKey || null,
          triggeredBy: 'first_visitor_message',
        },
      });
    }

    emitMessageReceived({
      organizationId: req.organization?._id || null,
      sessionId: session._id,
      messageId: msg._id,
      direction: 'inbound',
      metadata: {
        isFirstMessage: isFirstVisitorMessage,
        pageUrl: session.pageUrl || null,
      },
    });

    if (req.organization?._id) {
      let botResult = null;
      if (String(refreshedSession?.lifecycleStatus || '') === 'bot_handling') {
        botResult = await handleBotVisitorMessage({
          organizationId: req.organization._id,
          session: refreshedSession,
          message: msg,
        });
        refreshedSession = await ChatSession.findById(session._id).lean();
      }

      const shouldNotifyAgents = !botResult?.handled || botResult?.escalated === true;
      if (shouldNotifyAgents) {
        await notifyLiveChatInboundMessage({
          organizationId: req.organization._id,
          session: refreshedSession || session,
          message: msg,
        });
      }

      const latestSession = refreshedSession || (await ChatSession.findById(session._id).lean());
      const lifecycle = String(latestSession?.lifecycleStatus || '');
      if (
        lifecycle !== 'bot_handling'
        && (!latestSession?.assignedAgentId || lifecycle === 'waiting')
      ) {
        await assignWaitingSession({
          organizationId: req.organization._id,
          sessionId: session._id,
        });
      }
    }

    return res.json({ success: true, data: msg });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] postMessage', err);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}

async function listMessages(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await ChatMessage.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] listMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to list messages' });
  }
}

async function postMessageReceipts(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    const deliveredIds = Array.isArray(req.body?.deliveredIds) ? req.body.deliveredIds : [];
    const readIds = Array.isArray(req.body?.readIds) ? req.body.readIds : [];

    let delivered = { modified: 0 };
    let read = { modified: 0 };
    if (deliveredIds.length) {
      delivered = await markOutboundDeliveredToVisitor(session._id, deliveredIds);
    }
    if (readIds.length) {
      read = await markRead({
        sessionId: session._id,
        messageIds: readIds,
        direction: 'outbound'
      });
    }

    return res.json({
      success: true,
      data: { delivered, read }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] postMessageReceipts', err);
    return res.status(500).json({ success: false, message: 'Failed to update receipts' });
  }
}

async function setSessionTyping(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    setTyping({
      sessionId: session._id,
      authorType: 'visitor',
      authorName: String(req.body?.authorName || session.visitor?.name || '').trim()
    });
    return res.status(204).end();
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] setSessionTyping', err);
    return res.status(500).json({ success: false, message: 'Failed to set typing' });
  }
}

/**
 * SSE stream (simple polling) to avoid WebSocket infra initially.
 * Client provides ?after=<timestamp-ms> to get only newer messages.
 */
async function streamMessages(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

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
    const timer = setInterval(async () => {
      try {
        const currentSession = await ChatSession.findById(session._id).select('status lifecycleStatus').lean();
        if (currentSession && String(currentSession.status || '') === 'closed' && !sessionClosedEmitted) {
          sessionClosedEmitted = true;
          res.write('event: session\n');
          res.write(`data: ${JSON.stringify({ status: 'closed' })}\n\n`);
        }

        const rows = await ChatMessage.find({
          sessionId: session._id,
          createdAt: { $gt: new Date(after) }
        })
          .sort({ createdAt: 1 })
          .limit(100)
          .lean();

        if (rows.length) {
          after = rows[rows.length - 1].createdAt.getTime();
          const outboundIds = rows
            .filter((r) => r.direction === 'outbound')
            .map((r) => String(r._id));
          if (outboundIds.length) {
            await markOutboundDeliveredToVisitor(session._id, outboundIds);
          }
          res.write(`event: messages\n`);
          res.write(`data: ${JSON.stringify(rows)}\n\n`);
        }

        const receiptRows = await listReceiptUpdates(session._id, receiptAfter);
        if (receiptRows.length) {
          const lastAt = Math.max(
            ...receiptRows.flatMap((r) => [
              r.deliveredAt ? new Date(r.deliveredAt).getTime() : 0,
              r.readAt ? new Date(r.readAt).getTime() : 0
            ])
          );
          if (lastAt > receiptAfter) receiptAfter = lastAt;
          res.write(`event: receipts\n`);
          res.write(`data: ${JSON.stringify(receiptRows)}\n\n`);
        }

        const typing = getTypingState(session._id);
        const typingHash = typing ? JSON.stringify(typing) : '';
        if (typing) {
          lastTypingHash = typingHash;
          res.write(`event: typing\n`);
          res.write(`data: ${JSON.stringify(typing)}\n\n`);
        } else if (typingHash !== lastTypingHash) {
          lastTypingHash = typingHash;
          res.write(`event: typing\n`);
          res.write(`data: {}\n\n`);
        }

        if (!rows.length) {
          res.write(`event: ping\n`);
          res.write(`data: {}\n\n`);
        }
      } catch (e) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: 'stream error' })}\n\n`);
      }
    }, 1500);

    req.on('close', () => {
      clearInterval(timer);
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] streamMessages', err);
    return res.status(500).json({ success: false, message: 'Failed to open stream' });
  }
}

async function submitSessionFeedback(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    if (String(session.status || '') !== 'closed') {
      return res.status(409).json({ success: false, message: 'Session is not closed' });
    }

    if (session.ratedByVisitor && typeof session.csatScore === 'number') {
      return res.json({
        success: true,
        data: {
          sessionId: session._id,
          csatScore: session.csatScore,
          ratedByVisitor: true,
        },
      });
    }

    const feedbackPatch = buildVisitorFeedbackPatch(req.body || {});
    const updatedAt = new Date();
    await ChatSession.updateOne(
      { _id: session._id },
      { $set: { ...feedbackPatch, updatedAt } },
    );

    return res.json({
      success: true,
      data: {
        sessionId: session._id,
        csatScore: feedbackPatch.csatScore,
        ratedByVisitor: true,
        resolutionRating: feedbackPatch.resolutionRating || null,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] submitSessionFeedback', err);
    return res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
}

async function recordSessionJourney(req, res) {
  try {
    const sessionId = req.params.sessionId;
    const session = await ChatSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await assertSessionSecret(req, session);

    if (String(session.status || '') === 'closed') {
      return res.status(409).json({ success: false, message: 'Session is closed' });
    }

    const organizationId = session.organizationId || req.organization?._id || null;
    const page = String(req.body?.pageUrl || req.body?.page || '').trim();
    const action = String(req.body?.action || LIVE_CHAT_JOURNEY_ACTIONS.PAGE_CHANGE).trim();

    const result = await recordJourneyEvent({
      organizationId,
      sessionId: session._id,
      page,
      action,
    });

    if (!result.recorded) {
      return res.status(400).json({ success: false, message: 'pageUrl is required' });
    }

    await ChatSession.updateOne(
      { _id: session._id },
      { $set: { pageUrl: page, updatedAt: new Date() } },
    );

    return res.status(201).json({ success: true, data: { eventId: result.eventId } });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[embedChatController] recordSessionJourney', err);
    return res.status(500).json({ success: false, message: 'Failed to record journey event' });
  }
}

module.exports = {
  getEmbedChatConfig,
  getSession,
  closeSession,
  submitSessionFeedback,
  createSession,
  recordSessionJourney,
  uploadMessageAttachment,
  postMessage,
  postMessageReceipts,
  listMessages,
  setSessionTyping,
  streamMessages
};
