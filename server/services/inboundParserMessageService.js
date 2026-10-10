'use strict';

const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const Mailbox = require('../models/Mailbox');
const ParserInboundEvent = require('../models/ParserInboundEvent');
const { resolveParserEventIds } = require('../utils/parserIdCodec');
const { getEffectiveInboundParserConfig } = require('./inboundParserConfigService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { handleInboundEmailForHelpdesk } = require('./helpdeskChannelIngestionService');
const Case = require('../models/Case');

function parserAddressToString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value.address) return String(value.address).trim();
  return '';
}

function normalizeAddressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => parserAddressToString(x) || String(x).trim()).filter(Boolean);
  }
  const one = parserAddressToString(value) || String(value).trim();
  return one ? [one] : [];
}

/** Prefer HTML for inbox/case display (matches Gmail); fall back to plain text. */
function pickBody(msg) {
  return (
    String(msg.htmlBody || '').trim()
    || String(msg.textBody || '').trim()
    || String(msg.body || '').trim()
    || ''
  );
}

function bodyLooksLikeHtml(body) {
  return /<[a-z][\s\S]*>/i.test(String(body || ''));
}

function buildParserMessageFetchUrls(parserApiBaseUrl, parserMessageId) {
  const base = String(parserApiBaseUrl || '').trim().replace(/\/+$/, '');
  const enc = encodeURIComponent(parserMessageId);
  const candidates = [
    `${base}/integrations/v1/messages/${enc}`,
    `${base}/admin/messages/${enc}`
  ];
  if (!base.endsWith('/api')) {
    candidates.unshift(
      `${base}/api/integrations/v1/messages/${enc}`,
      `${base}/api/admin/messages/${enc}`
    );
  }
  return [...new Set(candidates)];
}

async function fetchParserMessage(parserMessageId) {
  const cfg = await getEffectiveInboundParserConfig();
  if (!cfg.parserApiBaseUrl) {
    throw new Error('Parser API base URL not configured');
  }
  const headers = { Accept: 'application/json' };
  if (cfg.parserApiKey) {
    headers.Authorization = `Bearer ${cfg.parserApiKey}`;
    headers['X-Arivu-Api-Key'] = cfg.parserApiKey;
  }

  const urls = buildParserMessageFetchUrls(cfg.parserApiBaseUrl, parserMessageId);
  let lastError = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
      res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      continue;
    }
    clearTimeout(timeout);

    if (res.status === 404) {
      lastError = new Error(`Parser message fetch failed (404) at ${url}`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Parser message fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const raw = await res.json();
    const msg = raw?.message && typeof raw.message === 'object' ? raw.message : raw;
    return msg;
  }

  throw lastError || new Error('Parser message fetch failed: no URL candidates');
}

/**
 * Parser inbound routes to Helpdesk by default (same intent as raw MIME → cases).
 * Set PARSER_INBOUND_WORKSPACE_ONLY=true to keep personal mailboxes workspace-only.
 */
function shouldRouteParserInboundToHelpdesk(mailbox) {
  const workspaceOnly = String(process.env.PARSER_INBOUND_WORKSPACE_ONLY || '').trim().toLowerCase() === 'true';
  if (workspaceOnly && String(mailbox?.kind || '').toLowerCase() === 'personal') {
    return false;
  }
  return true;
}

async function linkCommunicationIdToCaseEmailActivity(caseId, organizationId, communicationId) {
  if (!caseId || !communicationId) return;
  const caseRecord = await Case.findOne({ _id: caseId, organizationId }).select('activities');
  if (!caseRecord?.activities?.length) return;

  for (let i = caseRecord.activities.length - 1; i >= 0; i -= 1) {
    const act = caseRecord.activities[i];
    if (act.activityType === 'email_received' && !act.metadata?.communicationId) {
      act.metadata = { ...(act.metadata || {}), communicationId: String(communicationId) };
      await caseRecord.save();
      return;
    }
  }
}

async function processParserInboundEventLegacy(
  eventDoc,
  {
    injectedMessage = null,
    mailroomCaseResult = null,
    forceWorkspaceOnly = false,
    markManualReview = false
  } = {}
) {
  const resolved = await resolveParserEventIds(
    eventDoc.parserTenantId,
    eventDoc.parserMailboxId
  );
  if (!resolved) {
    throw new Error(
      `Unknown parser mailbox: ${eventDoc.parserTenantId} / ${eventDoc.parserMailboxId}`
    );
  }
  const orgIdStr = resolved.organizationId;
  const mailboxIdStr = resolved.mailboxId;

  const organizationId = new mongoose.Types.ObjectId(orgIdStr);
  const mailboxObjectId = new mongoose.Types.ObjectId(mailboxIdStr);

  await ParserInboundEvent.updateOne(
    { _id: eventDoc._id },
    { $set: { status: 'processing', organizationId, mailboxObjectId } }
  );

  const msg = injectedMessage || (await fetchParserMessage(eventDoc.parserMessageId));
  if (msg.tenantId && String(msg.tenantId) !== String(eventDoc.parserTenantId)) {
    throw new Error('Parser message tenantId mismatch');
  }

  const providerMessageKey = `arivu-parser:${eventDoc.parserMessageId}`;
  const body = pickBody(msg);
  const fromAddress =
    parserAddressToString(msg.from)
    || String(msg.fromAddress || '').trim();
  const subject = String(msg.subject || '').trim();
  const receivedAt = eventDoc.receivedAt || (msg.receivedAt ? new Date(msg.receivedAt) : new Date());

  let communicationId = null;
  let helpdeskCaseResult = null;

  await runWithOrganizationTenantContext(organizationId, async () => {
    const mailbox = await Mailbox.findOne({
      _id: mailboxObjectId,
      organizationId
    }).lean();
    if (!mailbox) {
      throw new Error('Mailbox not found for parser event');
    }

    const existing = await Communication.findOne({
      organizationId,
      providerMessageKey
    })
      .select('_id relatedTo body')
      .lean();
    if (existing) {
      communicationId = existing._id;
      // Repair plain-text-only bodies when HTML is available (older ingest preferred textBody).
      if (body && bodyLooksLikeHtml(body) && !bodyLooksLikeHtml(existing.body)) {
        await Communication.updateOne(
          { _id: existing._id, organizationId },
          { $set: { body } }
        );
      }
      return;
    }

    let relatedTo = { moduleKey: 'workspace', recordId: organizationId };

    if (mailroomCaseResult?.caseId) {
      relatedTo = {
        moduleKey: 'cases',
        recordId: mailroomCaseResult.caseId
      };
      helpdeskCaseResult = {
        caseRecord: mailroomCaseResult.caseRecord || { _id: mailroomCaseResult.caseId },
        action: mailroomCaseResult.action
      };
    } else if (!forceWorkspaceOnly && shouldRouteParserInboundToHelpdesk(mailbox)) {
      helpdeskCaseResult = await handleInboundEmailForHelpdesk({
        organizationId,
        parsedEmail: {
          fromAddress,
          subject,
          body
        },
        communicationDraft: {}
      });
      relatedTo = {
        moduleKey: 'cases',
        recordId: helpdeskCaseResult.caseRecord._id
      };
    }
    if (markManualReview) {
      relatedTo = { moduleKey: 'workspace', recordId: organizationId };
    }

    const doc = await Communication.create({
      organizationId,
      kind: 'email',
      direction: 'inbound',
      subject,
      body,
      fromAddress,
      toAddresses: normalizeAddressList(msg.to || msg.toAddresses),
      ccAddresses: normalizeAddressList(msg.cc || msg.ccAddresses),
      messageId: msg.messageId ? String(msg.messageId).trim() : undefined,
      inReplyTo: msg.inReplyTo ? String(msg.inReplyTo).trim() : undefined,
      references: msg.references ? String(msg.references).trim() : undefined,
      receivedAt,
      status: 'delivered',
      relatedTo,
      mailboxId: mailboxObjectId,
      providerMessageKey,
      providerThreadId: eventDoc.parserThreadId
        ? String(eventDoc.parserThreadId).slice(0, 128)
        : msg.threadId
          ? String(msg.threadId).slice(0, 128)
          : null,
      metadata: {
        provider: 'arivu-inbound-parser',
        ...(helpdeskCaseResult && {
          helpdesk: {
            caseId: String(helpdeskCaseResult.caseRecord._id),
            action: helpdeskCaseResult.action
          }
        })
      }
    });
    communicationId = doc._id;

    if (helpdeskCaseResult?.caseRecord?._id) {
      await linkCommunicationIdToCaseEmailActivity(
        helpdeskCaseResult.caseRecord._id,
        organizationId,
        communicationId
      );
    }
  });

  await ParserInboundEvent.updateOne(
    { _id: eventDoc._id },
    {
      $set: {
        status: 'processed',
        communicationId,
        processedAt: new Date(),
        lastError: ''
      }
    }
  );

  const { emitInboxUpdated } = require('./inboxRealtimeService');
  void emitInboxUpdated({
    organizationId,
    mailboxId: mailboxObjectId,
    reason: 'inbound',
    meta: { provider: 'arivu-inbound-parser', parserMessageId: eventDoc.parserMessageId }
  });

  return {
    communicationId,
    helpdesk: helpdeskCaseResult
      ? {
        caseId: helpdeskCaseResult.caseRecord._id,
        action: helpdeskCaseResult.action
      }
      : null
  };
}

async function processParserInboundEvent(eventDoc, options = {}) {
  const resolved = await resolveParserEventIds(
    eventDoc.parserTenantId,
    eventDoc.parserMailboxId
  );
  if (!resolved) {
    throw new Error(
      `Unknown parser mailbox: ${eventDoc.parserTenantId} / ${eventDoc.parserMailboxId}`
    );
  }

  const {
    shouldUseMailroomForOrganization,
    processParserEventThroughMailroom
  } = require('../platform/mailroom/pipeline/emailInboundPipeline');

  const runLegacy = (mailroomCaseResult, executionHints = {}) =>
    processParserInboundEventLegacy(eventDoc, {
      injectedMessage: options.injectedMessage || null,
      mailroomCaseResult: mailroomCaseResult || null,
      forceWorkspaceOnly: executionHints.forceWorkspaceOnly === true,
      markManualReview: executionHints.markManualReview === true
    });

  if (await shouldUseMailroomForOrganization(resolved.organizationId)) {
    return processParserEventThroughMailroom(eventDoc, {
      processLegacy: runLegacy,
      injectedMessage: options.injectedMessage || null
    });
  }

  return runLegacy(eventDoc);
}

/**
 * Local/dev simulation: skip parser API fetch and inject message body directly.
 */
async function processParserInboundEventWithMessage(eventDoc, messagePayload) {
  return processParserInboundEvent(eventDoc, { injectedMessage: messagePayload });
}

module.exports = {
  fetchParserMessage,
  processParserInboundEvent,
  processParserInboundEventLegacy,
  processParserInboundEventWithMessage,
  shouldRouteParserInboundToHelpdesk
};
