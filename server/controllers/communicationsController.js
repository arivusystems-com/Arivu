/**
 * ============================================================================
 * Communications Controller (In-Product Email)
 * ============================================================================
 *
 * Handles send email flow: Insert → Send → Update.
 * See docs/IN_PRODUCT_EMAIL_PLAN.md
 *
 * ============================================================================
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const objectStorage = require('../services/objectStorageService');
const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const Mailbox = require('../models/Mailbox');
const { canUserAccessMailboxThreads } = require('../services/mailboxAccessService');
const {
  computeThreadTriageHints,
  loadWorkspaceThreadSummaries
} = require('../services/workspaceThreadSummariesService');
const CommunicationEvent = require('../models/CommunicationEvent');
const CommunicationThreadMeta = require('../models/CommunicationThreadMeta');
const { uploadsDir } = require('../middleware/uploadMiddleware');
const ThreadView = require('../models/ThreadView');
const People = require('../models/People');
const Task = require('../models/Task');
const Organization = require('../models/Organization');
const Deal = require('../models/Deal');
const Case = require('../models/Case');
const User = require('../models/User');
const { MAX_ATTACHMENT_SIZE_BYTES, MAX_TOTAL_ATTACHMENTS_BYTES } = require('../models/Communication');
const { createInitialSlaCycle } = require('../services/caseLifecycleService');
const { finalizeCaseSlaOnCreate } = require('../services/sla/slaCaseBridgeService');
const caseExecutionService = require('../services/caseExecutionService');
const { applyCaseActivitySideEffects } = require('../services/caseAutoStatusService');
const communicationPlatformService = require('../platform/communication/api/communicationPlatformService');
const outboundEmailSendService = require('../platform/communication/outbound/outboundEmailSendService');
const { mapCommunicationDeliveryFields } = require('../services/amds/deliveryFields');
const { getAmdsClient } = require('../config/amds');
const { enrichCaseActivitiesWithEmailDelivery } = require('../services/helpdesk/caseEmailDeliveryService');
const emailQueueService = require('../services/emailQueueService');
const { appendCommunicationEvent } = require('../services/communicationEventWriter');
const {
  findSuppressedAddresses,
  listSuppressedAddresses,
  unsuppressAddress,
  getSuppressionStats
} = require('../services/emailSuppressionService');
const inboundEmailQueueService = require('../services/inboundEmailQueueService');
const InboundDeadLetter = require('../models/InboundDeadLetter');
const { getCommunicationConfigForOrganization } = require('../platform/communication/config/communicationConfigService');
const { classifyCommunicationFailure } = require('../platform/communication/domain/failureTaxonomy');
const {
  isEmailEligibleModule,
  loadEmailRelatedRecord
} = require('../platform/communication/domain/emailRelatedModulePolicy');

const WEBHOOK_TEST_EVENT_TYPES = ['delivered', 'opened', 'bounced', 'complained'];

async function findAccessibleOrganizationRecord(tenantOrganizationId, recordId) {
  const { findTenantAccessibleCrmOrganization } = require('../utils/crmOrganizationAccess');
  return findTenantAccessibleCrmOrganization(tenantOrganizationId, recordId);
}

async function assertEmailEligibleRelatedModule(orgId, moduleKey) {
  const eligible = await isEmailEligibleModule({
    organizationId: orgId,
    moduleKey
  });
  if (!eligible) {
    return {
      ok: false,
      status: 403,
      message: `Module "${moduleKey}" cannot send email because it has no People relationship.`
    };
  }
  return { ok: true };
}

/**
 * Generate RFC Message-ID for threading.
 */
function generateMessageId() {
  const uuid = crypto.randomUUID();
  const domain = process.env.EMAIL_REPLY_TO_DOMAIN || 'arivu.local';
  return `<${uuid}@${domain}>`;
}

function normalizeIdempotencyKey(value) {
  if (!value) return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  return normalized.slice(0, 200);
}

function hashIdempotencyKey({ organizationId, userId, key }) {
  if (!key) return '';
  return crypto
    .createHash('sha256')
    .update(`${organizationId}:${userId}:${key}`)
    .digest('hex');
}

function resolveSafeReplyToAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(raw)) return undefined;
  return raw;
}

function normalizeThreadTag(value) {
  const tag = String(value || '').trim().toLowerCase();
  if (!tag) return '';
  return tag.replace(/\s+/g, '-').slice(0, 40);
}

async function appendThreadAuditLog({ organizationId, user, action, details }) {
  try {
    const organization = await Organization.findById(organizationId);
    if (!organization) return;
    const entry = {
      user: user?.username || user?.email || 'Unknown',
      userId: user?._id || null,
      action,
      details: details || {},
      timestamp: new Date()
    };
    if (!Array.isArray(organization.activityLogs)) {
      organization.activityLogs = [];
    }
    organization.activityLogs.push(entry);
    organization.markModified('activityLogs');
    await organization.save();
  } catch (err) {
    console.error('[communicationsController] appendThreadAuditLog error:', err.message);
  }
}

/**
 * POST /api/communications/email
 * Send email from record context. Insert → Send → Update flow.
 */
exports.sendEmail = async (req, res) => {
  try {
    const validation = communicationPlatformService.validateOutboundEmailPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0] || 'Invalid email payload',
        errors: validation.errors
      });
    }
    const {
      standalone: standaloneFlag,
      relatedTo: relatedToFromBody,
      to: toList,
      cc,
      bcc,
      subject,
      body,
      attachments,
      parentCommunicationId,
      mailboxId: mailboxIdFromBody,
      fromSource: fromSourceFromBody,
      fromEmail: fromEmailFromBody,
      fromName: fromNameFromBody,
      followUpReminderDays,
      scheduledAt: scheduledAtRaw
    } = validation.value;

    const orgId = req.user.organizationId;
    let relatedTo = relatedToFromBody;
    if (standaloneFlag) {
      relatedTo = { moduleKey: 'workspace', recordId: orgId };
    }
    const moduleKey = relatedTo.moduleKey;
    const recordId = relatedTo.recordId;
    const runtimeConfig = await getCommunicationConfigForOrganization(orgId);
    const outboundPolicy = runtimeConfig.outboundEmail || {};
    const idempotencyKey = normalizeIdempotencyKey(
      req.headers['x-idempotency-key'] || req.body?.idempotencyKey
    );
    const idempotencyKeyHash = hashIdempotencyKey({
      organizationId: String(orgId),
      userId: String(req.user._id),
      key: idempotencyKey
    });

    if (outboundPolicy.enabled === false) {
      return res.status(403).json({
        success: false,
        message: 'Outbound email is disabled by communication policy for this tenant.'
      });
    }

    if (outboundPolicy.requireIdempotencyKey && !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'X-Idempotency-Key header is required by communication policy.'
      });
    }
    if (moduleKey === 'workspace' && outboundPolicy.allowWorkspaceEmail === false) {
      return res.status(403).json({
        success: false,
        message: 'Workspace (inbox) email is disabled by tenant communication policy.'
      });
    }
    {
      const eligibility = await assertEmailEligibleRelatedModule(orgId, moduleKey);
      if (!eligibility.ok) {
        return res.status(eligibility.status).json({
          success: false,
          message: eligibility.message
        });
      }
    }
    const totalRecipients =
      (Array.isArray(toList) ? toList.length : 0) +
      (Array.isArray(cc) ? cc.length : 0) +
      (Array.isArray(bcc) ? bcc.length : 0);
    if (totalRecipients > (Number(outboundPolicy.maxRecipientsPerMessage) || 50)) {
      return res.status(400).json({
        success: false,
        message: `Recipient count exceeds tenant policy limit (${outboundPolicy.maxRecipientsPerMessage}).`
      });
    }
    const suppressed = await findSuppressedAddresses({
      organizationId: orgId,
      addresses: [
        ...(Array.isArray(toList) ? toList : []),
        ...(Array.isArray(cc) ? cc : []),
        ...(Array.isArray(bcc) ? bcc : [])
      ]
    });
    if (suppressed.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'One or more recipients are suppressed due to bounce/complaint history.',
        suppressedRecipients: suppressed.map((s) => ({
          email: s.email,
          reason: s.reason,
          lastEventAt: s.lastEventAt
        }))
      });
    }

    if (idempotencyKeyHash) {
      const existing = await Communication.findOne({
        organizationId: orgId,
        direction: 'outbound',
        kind: 'email',
        idempotencyKeyHash
      }).lean();
      if (existing) {
        await appendCommunicationEvent({
          organizationId: orgId,
          communicationId: existing._id,
          eventType: 'idempotency_replay',
          source: 'communications-api',
          idempotencyKeyHash,
          payload: {
            relatedTo: { moduleKey, recordId },
            reason: 'existing_communication_reused'
          }
        });
        return res.status(200).json({
          success: true,
          data: existing,
          queued: existing.status === 'sending',
          scheduled: existing.status === 'scheduled',
          scheduledAt: existing.scheduledAt || null,
          idempotencyReplay: true
        });
      }
    }
    // Attachment size guardrail
    if (attachments && attachments.length > 0) {
      let totalSize = 0;
      for (const att of attachments) {
        const size = att.fileSize || 0;
        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
          return res.status(400).json({
            success: false,
            message: `Attachment "${att.fileName || 'file'}" exceeds ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB per-file limit`
          });
        }
        totalSize += size;
      }
      if (totalSize > MAX_TOTAL_ATTACHMENTS_BYTES) {
        return res.status(400).json({
          success: false,
          message: `Total attachment size exceeds ${MAX_TOTAL_ATTACHMENTS_BYTES / 1024 / 1024}MB limit`
        });
      }
    }

    let record = null;
    if (moduleKey === 'workspace') {
      if (String(recordId) !== String(orgId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid workspace email context'
        });
      }
      record = await Organization.findById(orgId).select('_id name').lean();
    } else {
      record = await loadEmailRelatedRecord({
        organizationId: orgId,
        moduleKey,
        recordId,
        findAccessibleOrganizationRecord
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found or access denied'
      });
    }

    if (
      !(await communicationPlatformService.canSendEmailNow({
        organizationId: orgId,
        userId: req.user._id,
        user: req.user,
        moduleKey
      }))
    ) {
      return res.status(503).json({
        success: false,
        message:
          'Email is not configured. Connect a Gmail mailbox or configure AWS SES, OCI Email Delivery, or SMTP.',
        code: 'EMAIL_SEND_NOT_CONFIGURED'
      });
    }

    let fromAddr = req.user.email || process.env.EMAIL_FROM;
    const messageId = generateMessageId();
    let threadId = null;
    let inReplyTo = null;
    let references = null;
    let mailboxIdOutbound = null;
    const requestedFromSource = String(fromSourceFromBody || '').trim().toLowerCase();
    const forceOrgFrom = requestedFromSource === 'tenant_config' || requestedFromSource === 'user';

    if (parentCommunicationId) {
      const parent = await Communication.findOne({
        _id: parentCommunicationId,
        organizationId: orgId
      })
        .select('threadId messageId externalMessageId references mailboxId')
        .lean();
      if (parent) {
        threadId = parent.threadId || parent._id;
        inReplyTo = parent.messageId || parent.externalMessageId;
        references = parent.references ? `${parent.references} ${parent.messageId || parent.externalMessageId}` : (parent.messageId || parent.externalMessageId);
        // Do not inherit parent mailbox when sender explicitly chose org/user From
        if (parent.mailboxId && !mailboxIdFromBody && !forceOrgFrom) {
          mailboxIdOutbound = parent.mailboxId;
        }
      }
    }

    const outboundIdentityService = require('../platform/communication/outbound/outboundIdentityService');
    const preferredMailboxId = forceOrgFrom
      ? undefined
      : (mailboxIdFromBody || (mailboxIdOutbound ? String(mailboxIdOutbound) : undefined));

    if (mailboxIdFromBody && !forceOrgFrom && !mongoose.Types.ObjectId.isValid(String(mailboxIdFromBody))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mailboxId'
      });
    }

    const outboundIdentity = await outboundIdentityService.resolveOutboundIdentity({
      organizationId: orgId,
      user: req.user,
      mailboxId: preferredMailboxId,
      fromSource: forceOrgFrom ? requestedFromSource : (mailboxIdFromBody ? 'mailbox' : undefined),
      moduleKey
    });

    if (mailboxIdFromBody && !forceOrgFrom) {
      if (!outboundIdentity.mailboxId || String(outboundIdentity.mailboxId) !== String(mailboxIdFromBody)) {
        const mb = await Mailbox.findOne({
          _id: mailboxIdFromBody,
          organizationId: orgId
        }).lean();
        if (!mb) {
          return res.status(404).json({
            success: false,
            message: 'Mailbox not found'
          });
        }
        if (!canUserAccessMailboxThreads(req.user, mb)) {
          return res.status(403).json({
            success: false,
            message: 'Not allowed to send on behalf of this mailbox'
          });
        }
        return res.status(403).json({
          success: false,
          message:
            'Mailbox is not available for sending. Configure organization email (Resend/SMTP) in Settings, or connect Gmail on this mailbox.',
          code: 'MAILBOX_NOT_SENDABLE'
        });
      }
    }

    if (forceOrgFrom) {
      mailboxIdOutbound = null;
      if (outboundIdentity.fromEmail) {
        fromAddr = outboundIdentity.fromEmail;
      }
      if (fromEmailFromBody) {
        fromAddr = fromEmailFromBody;
      }
    } else {
      if (outboundIdentity.mailboxId) {
        mailboxIdOutbound = outboundIdentity.mailboxId;
      }
      if (outboundIdentity.fromEmail) {
        fromAddr = outboundIdentity.fromEmail;
      }
      if (fromEmailFromBody) {
        fromAddr = fromEmailFromBody;
      }
    }

    let displayName = String(
      fromNameFromBody
      || outboundIdentity.fromName
      || ''
    ).trim().replace(/"/g, '');

    // Org From: always prefer Integrations fromName when client/identity omitted it
    if (!displayName && forceOrgFrom) {
      try {
        const emailService = require('../services/emailService');
        const orgCfg = await emailService.getOrganizationEmailConfig(orgId);
        displayName = String(orgCfg?.fromName || '').trim().replace(/"/g, '');
      } catch {
        /* ignore */
      }
    }

    const bareFromEmail = String(fromAddr || '')
      .replace(/^.*<([^>]+)>.*$/, '$1')
      .trim()
      .toLowerCase();
    if (bareFromEmail && displayName) {
      fromAddr = `"${displayName}" <${bareFromEmail}>`;
    } else if (bareFromEmail) {
      fromAddr = bareFromEmail;
    }

    const sendableMailbox = mailboxIdOutbound
      ? await outboundEmailSendService.findMailboxForOutbound(orgId, mailboxIdOutbound)
      : null;
    const sendableViaGmailApi =
      sendableMailbox && require('../services/mailboxGmailInboxSyncService').isGmailMailboxReady(sendableMailbox);
    const sendableViaGmailSmtp =
      sendableMailbox && require('../services/mailboxGmailSmtpService').isMailboxGmailSmtpReady(sendableMailbox);

    if (moduleKey === 'workspace' && outboundPolicy.disallowPlatformSmtpForWorkspace === true) {
      if (!sendableViaGmailApi && !sendableViaGmailSmtp) {
        return res.status(403).json({
          success: false,
          message:
            'Workspace email requires a connected Gmail mailbox. Connect a mailbox in Inbox settings.',
          code: 'WORKSPACE_SMTP_DISABLED'
        });
      }
    }

    if (outboundPolicy.requireMailboxProviderForAgentSend === true && !sendableViaGmailApi && !sendableViaGmailSmtp) {
      return res.status(403).json({
        success: false,
        message: 'Outbound email requires a connected Gmail mailbox for this tenant.',
        code: 'MAILBOX_PROVIDER_REQUIRED'
      });
    }

    // Step 1: Insert (status: 'sending' | 'scheduled')
    const isScheduled = scheduledAtRaw instanceof Date && Number.isFinite(scheduledAtRaw.getTime());
    const sendBaseMs = isScheduled ? scheduledAtRaw.getTime() : Date.now();
    const followUpReminder =
      followUpReminderDays != null && Number.isInteger(followUpReminderDays) && followUpReminderDays >= 1
        ? {
            days: followUpReminderDays,
            remindAt: new Date(sendBaseMs + followUpReminderDays * 24 * 60 * 60 * 1000),
            status: 'pending'
          }
        : { days: null, remindAt: null, status: 'none' };

    const doc = new Communication({
      organizationId: orgId,
      kind: 'email',
      direction: 'outbound',
      threadId,
      parentCommunicationId: parentCommunicationId || null,
      subject: subject.trim(),
      body: body || '',
      fromAddress: fromAddr,
      toAddresses: toList,
      ccAddresses: Array.isArray(cc) ? cc.filter(Boolean) : [],
      bccAddresses: Array.isArray(bcc) ? bcc.filter(Boolean) : [],
      messageId,
      inReplyTo,
      references,
      status: isScheduled ? 'scheduled' : 'sending',
      scheduledAt: isScheduled ? scheduledAtRaw : null,
      relatedTo: { moduleKey, recordId },
      mailboxId: mailboxIdOutbound || null,
      sentByUserId: req.user._id,
      attachments: attachments || [],
      idempotencyKey: idempotencyKey || undefined,
      idempotencyKeyHash: idempotencyKeyHash || undefined,
      followUpReminder
    });

    try {
      await doc.save();
    } catch (saveErr) {
      if (saveErr?.code === 11000 && idempotencyKeyHash) {
        const existing = await Communication.findOne({
          organizationId: orgId,
          direction: 'outbound',
          kind: 'email',
          idempotencyKeyHash
        }).lean();
        if (existing) {
          return res.status(200).json({
            success: true,
            data: existing,
            queued: existing.status === 'sending',
            scheduled: existing.status === 'scheduled',
            scheduledAt: existing.scheduledAt || null,
            idempotencyReplay: true
          });
        }
      }
      throw saveErr;
    }
    await appendCommunicationEvent({
      organizationId: orgId,
      communicationId: doc._id,
      eventType: 'accepted',
      source: 'communications-api',
      idempotencyKeyHash,
      payload: {
        relatedTo: { moduleKey, recordId },
        toCount: toList.length,
        ccCount: Array.isArray(cc) ? cc.length : 0,
        bccCount: Array.isArray(bcc) ? bcc.length : 0
      }
    });

    // Set threadId for first in thread
    if (!threadId) {
      await Communication.findByIdAndUpdate(doc._id, { threadId: doc._id });
    }

    // Scheduled send: queue for future (or leave for due-poller if Redis down)
    if (isScheduled) {
      const enqueued = communicationPlatformService.enqueueOutboundEmailDelayed(
        doc._id.toString(),
        orgId,
        scheduledAtRaw
      );
      await appendCommunicationEvent({
        organizationId: orgId,
        communicationId: doc._id,
        eventType: 'scheduled',
        source: 'communications-api',
        idempotencyKeyHash,
        payload: {
          scheduledAt: scheduledAtRaw.toISOString(),
          queue: enqueued ? 'email-send' : null
        }
      });
      const updated = await Communication.findById(doc._id).lean();
      return res.status(200).json({
        success: true,
        data: updated,
        scheduled: true,
        scheduledAt: scheduledAtRaw.toISOString(),
        queued: Boolean(enqueued)
      });
    }

    // Step 2: Send — use queue when Redis available, else sync
    if (communicationPlatformService.enqueueOutboundEmail(doc._id.toString(), orgId)) {
      await appendCommunicationEvent({
        organizationId: orgId,
        communicationId: doc._id,
        eventType: 'queued',
        source: 'communications-api',
        idempotencyKeyHash,
        payload: { queue: 'email-send' }
      });
      const updated = await Communication.findById(doc._id).lean();
      return res.status(200).json({ success: true, data: updated, queued: true });
    }

    // Sync send (no Redis)
    const docLean = await Communication.findById(doc._id).lean();
    const result = await outboundEmailSendService.sendOutboundCommunication(docLean);
    const finalStatus = result.success ? 'sent' : 'failed';
    await Communication.findByIdAndUpdate(
      doc._id,
      outboundEmailSendService.buildCommunicationUpdateFromSendResult(result)
    );
  await appendCommunicationEvent({
    organizationId: orgId,
    communicationId: doc._id,
    eventType: finalStatus,
    source: 'communications-api',
    idempotencyKeyHash,
    payload: {
      provider: result.provider || null,
      externalMessageId: result.messageId || null,
      error: result.success ? null : (result.error || 'send_failed'),
      failureCategory: result.success ? null : classifyCommunicationFailure(result.error)
    }
  });

    const user = await User.findById(req.user._id).select('firstName lastName email').lean();
    const userName = String(user?.firstName || user?.lastName || user?.email || 'User');
    const newLog = {
      user: userName,
      userId: req.user._id,
      action: 'email_sent',
      details: {
        communicationId: doc._id,
        subject: subject.trim(),
        to: toList[0],
        status: finalStatus
      },
      timestamp: new Date()
    };

    const pushActivityLog = async (Model, query) => {
      const forUpdate = await Model.findOne(query).select('activityLogs').lean();
      if (!forUpdate) return;
      if (!Array.isArray(forUpdate.activityLogs)) {
        await Model.findOneAndUpdate(query, { $set: { activityLogs: [newLog] } }, { runValidators: false });
      } else {
        await Model.findOneAndUpdate(query, { $push: { activityLogs: newLog } }, { runValidators: false });
      }
    };

    if (moduleKey === 'workspace') {
      await pushActivityLog(Organization, { _id: orgId, deletedAt: null });
    } else if (moduleKey === 'people') {
      await pushActivityLog(People, { _id: recordId, organizationId: orgId, deletedAt: null });
    } else if (moduleKey === 'organizations') {
      const org = await findAccessibleOrganizationRecord(orgId, recordId);
      if (org) {
        await pushActivityLog(Organization, { _id: org._id, isTenant: false, deletedAt: null });
      }
    } else if (moduleKey === 'tasks') {
      await pushActivityLog(Task, { _id: recordId, organizationId: orgId });
    } else if (moduleKey === 'cases') {
      const caseRow = await Case.findOne({ _id: recordId, organizationId: orgId, deletedAt: null });
      if (caseRow) {
        caseRow.activities = Array.isArray(caseRow.activities) ? caseRow.activities : [];
        caseRow.activities.push({
          activityType: 'email_sent',
          message: `Email sent: ${subject.trim()}`,
          internal: true,
          metadata: {
            communicationId: doc._id,
            to: toList[0],
            status: finalStatus,
            deliveryStatus:
              result.success && result.messageId
                ? 'queued'
                : finalStatus === 'failed'
                  ? 'failed'
                  : 'processing',
            amdsMessageId: result.messageId || null,
            deliveryError: result.success ? null : result.error || null
          },
          actorId: req.user._id,
          actorName: userName,
          createdAt: new Date()
        });
        const { slaMarked, statusResult } = await applyCaseActivitySideEffects(caseRow, {
          activityType: 'email_sent',
          internal: true,
          actorId: req.user._id,
          actorName: userName,
          channel: caseRow.channel
        });
        if (slaMarked) {
          caseRow.activities.push({
            activityType: 'sla_response_met',
            message: 'First response SLA met',
            internal: true,
            metadata: { responseMetAt: caseRow.currentSlaCycle.responseMetAt },
            actorId: req.user._id,
            actorName: userName,
            createdAt: new Date()
          });
        }
        caseRow.updatedBy = req.user._id;
        await caseRow.save();
        if (statusResult?.changed) {
          await caseExecutionService.onCaseStatusChanged({
            caseRecord: caseRow,
            actorId: req.user._id,
            fromStatus: statusResult.fromStatus,
            toStatus: statusResult.toStatus
          });
        }
      }
    }

    const updated = await Communication.findById(doc._id).lean();
    if (!result.success) {
      const statusCode =
        result.code === 'AMDS_SUPPRESSED_RECIPIENT'
          ? 422
          : result.code === 'AMDS_DOMAIN_NOT_VERIFIED'
            ? 403
            : 502;
      return res.status(statusCode).json({
        success: false,
        message: result.error || 'Failed to send email',
        code: result.code || 'SEND_FAILED',
        ...(result.suppressed ? { suppressedRecipients: result.suppressed } : {}),
        ...(result.domain ? { domain: result.domain } : {}),
        data: updated
      });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[communicationsController] sendEmail error:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: err.message,
      ...(isDev && { stack: err.stack })
    });
  }
};

/**
 * GET /api/communications/threads
 * Query: moduleKey, recordId
 * Returns email threads for a record, grouped by threadId.
 */
exports.getThreads = async (req, res) => {
  try {
    const { moduleKey, recordId } = req.query;
    const includeDone = String(req.query.includeDone || '').toLowerCase() === 'true';
    const orgId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({
        success: false,
        message: 'moduleKey and recordId are required'
      });
    }

    {
      const eligibility = await assertEmailEligibleRelatedModule(orgId, moduleKey);
      if (!eligibility.ok) {
        return res.status(eligibility.status).json({
          success: false,
          message: eligibility.message
        });
      }
    }

    let record = null;
    if (moduleKey === 'workspace') {
      if (String(recordId) !== String(orgId)) {
        return res.status(400).json({
          success: false,
          message: 'workspace recordId must match organization context'
        });
      }
      record = await Organization.findById(orgId).select('_id').lean();
    } else {
      record = await loadEmailRelatedRecord({
        organizationId: orgId,
        moduleKey,
        recordId,
        findAccessibleOrganizationRecord
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    const person = moduleKey === 'people' ? record : null;

    const comms = await Communication.find({
      organizationId: orgId,
      'relatedTo.moduleKey': moduleKey,
      'relatedTo.recordId': recordId
    })
      .sort({ sentAt: 1, receivedAt: 1, createdAt: 1 })
      .lean();

    const byThread = new Map();
    for (const c of comms) {
      const tid = c.threadId ? String(c.threadId) : String(c._id);
      if (!byThread.has(tid)) {
        byThread.set(tid, []);
      }
      byThread.get(tid).push(c);
    }

    const personEmail = (person?.email || '').toLowerCase().trim();

    const threadIds = Array.from(byThread.keys());
    const viewMap = new Map();
    const metaMap = new Map();
    const assigneeMap = new Map();
    const senderMap = new Map();
    const senderIds = [...new Set(
      comms
        .map((c) => (c?.sentByUserId ? String(c.sentByUserId) : ''))
        .filter(Boolean)
    )];
    if (threadIds.length > 0 || senderIds.length > 0) {
      const [views, metas, senders] = await Promise.all([
        threadIds.length > 0
          ? ThreadView.find({
              userId: req.user._id,
              organizationId: orgId,
              threadId: { $in: threadIds }
            }).lean()
          : Promise.resolve([]),
        threadIds.length > 0
          ? CommunicationThreadMeta.find({
              organizationId: orgId,
              threadId: { $in: threadIds }
            }).select('threadId assignedToUserId tags').lean()
          : Promise.resolve([]),
        senderIds.length > 0
          ? User.find({
              _id: { $in: senderIds },
              organizationId: orgId
            }).select('_id firstName lastName email avatar').lean()
          : Promise.resolve([])
      ]);
      for (const v of views) {
        viewMap.set(String(v.threadId), {
          lastViewedAt: v.lastViewedAt,
          doneAt: v.doneAt || null
        });
      }
      for (const m of metas) {
        metaMap.set(String(m.threadId), {
          assignedToUserId: m.assignedToUserId || null,
          tags: Array.isArray(m.tags) ? m.tags : []
        });
      }
      for (const user of senders) {
        senderMap.set(String(user._id), {
          _id: user._id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          avatar: user.avatar || null
        });
      }
      const assigneeIds = [...new Set(
        metas
          .map((m) => (m?.assignedToUserId ? String(m.assignedToUserId) : ''))
          .filter(Boolean)
      )];
      if (assigneeIds.length > 0) {
        const assignees = await User.find({
          _id: { $in: assigneeIds },
          organizationId: orgId
        }).select('_id firstName lastName username email').lean();
        for (const user of assignees) {
          const display = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
            || user.username
            || user.email
            || 'Unknown';
          assigneeMap.set(String(user._id), display);
        }
      }
    }

    const threads = Array.from(byThread.entries()).map(([threadId, messages]) => {
      const sorted = [...messages].sort((a, b) => {
        const da = a.sentAt || a.receivedAt || a.createdAt || 0;
        const db = b.sentAt || b.receivedAt || b.createdAt || 0;
        return new Date(da) - new Date(db);
      });
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const subject = first?.subject || '(no subject)';
      const firstActivityAt = first?.sentAt || first?.receivedAt || first?.createdAt;
      const lastActivityAt = last?.sentAt || last?.receivedAt || last?.createdAt;

      const otherAddresses = new Set();
      for (const m of sorted) {
        if (m.direction === 'outbound' && m.toAddresses?.length) {
          m.toAddresses.forEach((a) => a && otherAddresses.add(String(a).toLowerCase().trim()));
        } else if (m.direction === 'inbound' && m.fromAddress) {
          otherAddresses.add(String(m.fromAddress).toLowerCase().trim());
        }
      }
      const others = [...otherAddresses];
      const lastDir = last?.direction;
      const otherLabel =
        others.length === 1 && others[0] === personEmail && person
          ? [(person.first_name || person.firstName), (person.last_name || person.lastName)].filter(Boolean).join(' ').trim() || others[0]
          : others.length === 1
            ? others[0]
            : others.slice(0, 2).join(', ') + (others.length > 2 ? ' +' + (others.length - 2) : '');
      const participantDisplay =
        others.length === 0
          ? 'You'
          : lastDir === 'inbound'
            ? `${otherLabel} ↔ You`
            : `You ↔ ${otherLabel}`;

      const threadState = viewMap.get(threadId) || null;
      const lastViewedAt = threadState?.lastViewedAt ? new Date(threadState.lastViewedAt) : null;
      const doneAt = threadState?.doneAt ? new Date(threadState.doneAt) : null;
      const done = Boolean(doneAt);
      const unread = done
        ? false
        : (lastDir === 'inbound' && lastViewedAt === null
          ? true
          : lastDir === 'inbound' && lastViewedAt && new Date(lastActivityAt) > lastViewedAt);
      const triage = computeThreadTriageHints(sorted, { unread });
      const threadMeta = metaMap.get(threadId) || { assignedToUserId: null, tags: [] };

      return {
        threadId,
        subject,
        messageCount: sorted.length,
        participantDisplay,
        lastMessageDirection: lastDir,
        firstActivityAt,
        lastActivityAt,
        lastViewedAt: lastViewedAt || null,
        done,
        doneAt: doneAt || null,
        unread,
        triage,
        assignedToUserId: threadMeta.assignedToUserId,
        assignedToDisplay: threadMeta.assignedToUserId
          ? assigneeMap.get(String(threadMeta.assignedToUserId)) || null
          : null,
        tags: threadMeta.tags,
        messages: sorted.map((m) => ({
          _id: m._id,
          direction: m.direction,
          fromAddress: m.fromAddress,
          toAddresses: m.toAddresses || [],
          subject: m.subject,
          body: m.body,
          attachments: m.attachments || [],
          sentAt: m.sentAt,
          receivedAt: m.receivedAt,
          status: m.status,
          sentByUserId: m.sentByUserId || null,
          sentByUser: m.sentByUserId
            ? senderMap.get(String(m.sentByUserId)) || null
            : null,
          ...mapCommunicationDeliveryFields(m)
        }))
      };
    });

    const visibleThreads = includeDone ? threads : threads.filter((t) => !t.done);
    visibleThreads.sort((a, b) => new Date(b.lastActivityAt || b.firstActivityAt) - new Date(a.lastActivityAt || a.firstActivityAt));

    return res.json({
      success: true,
      data: { threads: visibleThreads }
    });
  } catch (err) {
    console.error('[communicationsController] getThreads error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load threads',
      error: err.message
    });
  }
};

/**
 * Case-insensitive substring match on aggregated workspace threads (subject, participants, record label, tags).
 * Does not change folder counts (counts stay mailbox/global scope without search).
 */
function filterWorkspaceThreadsBySearch(threads, searchRaw) {
  const q = String(searchRaw || '').trim().toLowerCase();
  if (!q) return threads;
  return threads.filter((t) => {
    const blob = [
      t.subject,
      t.participantDisplay,
      t.recordLabel,
      Array.isArray(t.tags) ? t.tags.join(' ') : '',
      t.searchBlob || ''
    ]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    return blob.includes(q);
  });
}

/** Remove server-only fields before JSON (e.g. body search aggregate). */
function stripWorkspaceThreadInternalFields(row) {
  if (!row || typeof row !== 'object') return row;
  const { searchBlob, ...rest } = row;
  return rest;
}

function computeWorkspaceThreadCounts(threadsRaw, includeDone, userId) {
  const visible = includeDone ? threadsRaw : threadsRaw.filter((t) => !t.done);
  const inboxActive = visible.filter((t) => !t.snoozeActive);
  const snoozed = visible.filter((t) => t.snoozeActive);
  return {
    all: inboxActive.length,
    unread: inboxActive.filter((t) => t.unread).length,
    sent: inboxActive.filter(
      (t) =>
        t.lastMessageDirection === 'outbound' &&
        String(t.lastMessageStatus || '').toLowerCase() !== 'scheduled'
    ).length,
    scheduled: visible.filter((t) => t.hasScheduledPending).length,
    assignedToMe: inboxActive.filter((t) => String(t.assignedToUserId || '') === String(userId)).length,
    snoozed: snoozed.length
  };
}

/**
 * @param {string} filter all|unread|sent|scheduled|assigned_to_me|snoozed
 */
function filterWorkspaceThreadsForFolder({
  threadsRaw,
  includeDone,
  filter,
  searchRaw,
  userId,
  gmailLabelId
}) {
  const searched = filterWorkspaceThreadsBySearch(threadsRaw, searchRaw);
  let base = includeDone ? searched : searched.filter((t) => !t.done);
  if (filter === 'snoozed') {
    base = base.filter((t) => t.snoozeActive);
  } else if (filter === 'scheduled') {
    // Pending schedule send — include even if thread was snoozed
    base = base.filter((t) => t.hasScheduledPending);
  } else {
    base = base.filter((t) => !t.snoozeActive);
    if (filter === 'unread') base = base.filter((t) => t.unread);
    else if (filter === 'sent') {
      base = base.filter(
        (t) =>
          t.lastMessageDirection === 'outbound' &&
          String(t.lastMessageStatus || '').toLowerCase() !== 'scheduled'
      );
    } else if (filter === 'assigned_to_me') {
      base = base.filter((t) => String(t.assignedToUserId || '') === String(userId));
    }
  }
  const lid = String(gmailLabelId || '').trim();
  if (lid) {
    const want = lid.toUpperCase();
    base = base.filter((t) => {
      const ids = t.gmailLabelIds;
      if (!Array.isArray(ids) || !ids.length) return false;
      return ids.some((id) => String(id).toUpperCase() === want);
    });
  }
  return base;
}

function threadActivityMs(row) {
  const d = row.lastActivityAt || row.firstActivityAt;
  return d ? new Date(d).getTime() : 0;
}

function sortWorkspaceThreadsDesc(rows) {
  return [...rows].sort((a, b) => {
    const db = threadActivityMs(b);
    const da = threadActivityMs(a);
    if (db !== da) return db - da;
    return String(b.threadId).localeCompare(String(a.threadId));
  });
}

function encodeWorkspaceCursor(row) {
  const payload = JSON.stringify({
    t: threadActivityMs(row),
    id: String(row.threadId)
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeWorkspaceCursor(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const json = Buffer.from(String(raw).trim(), 'base64url').toString('utf8');
    const o = JSON.parse(json);
    if (typeof o.t !== 'number' || !o.id) return null;
    return { t: o.t, id: String(o.id) };
  } catch {
    return null;
  }
}

function isRowOlderThanCursor(row, cursor) {
  const tr = threadActivityMs(row);
  if (tr < cursor.t) return true;
  if (tr > cursor.t) return false;
  return String(row.threadId) < cursor.id;
}

function findWorkspaceCursorPageStart(sortedDesc, cursorDecoded) {
  if (!cursorDecoded) return 0;
  let i = 0;
  while (i < sortedDesc.length && !isRowOlderThanCursor(sortedDesc[i], cursorDecoded)) {
    i += 1;
  }
  return i;
}

/**
 * GET /api/communications/workspace-threads
 * Phase 5: cross-record email thread summaries for the current workspace (recent window).
 * Query: includeDone, filter=all|unread|sent|scheduled|assigned_to_me|snoozed, limit (1–100, default 50), optional mailboxId, optional gmailLabelId, optional search, optional cursor (opaque).
 * Response data.threads is filtered/sliced; data.counts reflects the same scope before folder filter and before search (for badges).
 */
exports.getWorkspaceThreads = async (req, res) => {
  try {
    const includeDone = String(req.query.includeDone || '').toLowerCase() === 'true';
    const filter = String(req.query.filter || 'all').toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;
    const mailboxIdQuery = req.query.mailboxId ? String(req.query.mailboxId).trim() : '';
    const gmailLabelIdQuery = req.query.gmailLabelId ? String(req.query.gmailLabelId).trim() : '';
    const searchRaw = req.query.search != null ? String(req.query.search) : '';
    const cursorRaw = req.query.cursor != null ? String(req.query.cursor) : '';

    const { error, threads: threadsRaw } = await loadWorkspaceThreadSummaries(req, mailboxIdQuery);
    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    const counts = computeWorkspaceThreadCounts(threadsRaw, includeDone, req.user._id);

    const visible = filterWorkspaceThreadsForFolder({
      threadsRaw,
      includeDone,
      filter,
      searchRaw,
      userId: req.user._id,
      gmailLabelId: gmailLabelIdQuery
    });

    const sortedDesc = sortWorkspaceThreadsDesc(visible);
    const cursorDecoded = decodeWorkspaceCursor(cursorRaw);
    const startIdx = findWorkspaceCursorPageStart(sortedDesc, cursorDecoded);
    const page = sortedDesc
      .slice(startIdx, startIdx + limit)
      .map(stripWorkspaceThreadInternalFields);
    const lastRow = page.length > 0 ? sortedDesc[startIdx + page.length - 1] : null;
    const nextCursor =
      lastRow && startIdx + page.length < sortedDesc.length
        ? encodeWorkspaceCursor(lastRow)
        : null;

    return res.json({
      success: true,
      data: { threads: page, counts, nextCursor }
    });
  } catch (err) {
    console.error('[communicationsController] getWorkspaceThreads error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load workspace email threads',
      error: err.message
    });
  }
};

/**
 * GET /api/communications/workspace-thread-ids
 * Returns thread ids for the current folder/search scope (for "select all in folder"), capped.
 */
exports.getWorkspaceThreadIds = async (req, res) => {
  const CAP = 500;
  try {
    const includeDone = String(req.query.includeDone || '').toLowerCase() === 'true';
    const filter = String(req.query.filter || 'all').toLowerCase();
    const mailboxIdQuery = req.query.mailboxId ? String(req.query.mailboxId).trim() : '';
    const gmailLabelIdQuery = req.query.gmailLabelId ? String(req.query.gmailLabelId).trim() : '';
    const searchRaw = req.query.search != null ? String(req.query.search) : '';

    const { error, threads: threadsRaw } = await loadWorkspaceThreadSummaries(req, mailboxIdQuery);
    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    const visible = filterWorkspaceThreadsForFolder({
      threadsRaw,
      includeDone,
      filter,
      searchRaw,
      userId: req.user._id,
      gmailLabelId: gmailLabelIdQuery
    });

    const sortedDesc = sortWorkspaceThreadsDesc(visible);
    const threadIds = sortedDesc.slice(0, CAP).map((t) => t.threadId);

    return res.json({
      success: true,
      data: {
        threadIds,
        truncated: sortedDesc.length > CAP
      }
    });
  } catch (err) {
    console.error('[communicationsController] getWorkspaceThreadIds error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load workspace thread ids',
      error: err.message
    });
  }
};

/**
 * GET /api/communications/workspace-thread-counts
 * Same scope as workspace-threads (mailboxId, includeDone); returns counts for folder badges.
 */
exports.getWorkspaceThreadCounts = async (req, res) => {
  try {
    const includeDone = String(req.query.includeDone || '').toLowerCase() === 'true';
    const mailboxIdQuery = req.query.mailboxId ? String(req.query.mailboxId).trim() : '';

    const { error, threads } = await loadWorkspaceThreadSummaries(req, mailboxIdQuery);
    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    const payload = computeWorkspaceThreadCounts(threads, includeDone, req.user._id);

    return res.json({
      success: true,
      data: payload
    });
  } catch (err) {
    console.error('[communicationsController] getWorkspaceThreadCounts error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load workspace thread counts',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/:threadId/assign
 * Assign or unassign thread owner.
 */
exports.assignThreadOwner = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;
    const rawAssignee = req.body?.assignedToUserId;
    const assignedToUserId = rawAssignee === null || rawAssignee === ''
      ? null
      : (rawAssignee || req.user._id);

    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    if (assignedToUserId) {
      const exists = await User.findOne({ _id: assignedToUserId, organizationId: orgId }).select('_id').lean();
      if (!exists) {
        return res.status(400).json({ success: false, message: 'Invalid assignee for this workspace' });
      }
    }

    const meta = await CommunicationThreadMeta.findOneAndUpdate(
      { organizationId: orgId, threadId },
      { $set: { assignedToUserId: assignedToUserId || null, updatedBy: req.user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    await appendThreadAuditLog({
      organizationId: orgId,
      user: req.user,
      action: 'communication_thread_assigned',
      details: {
        threadId,
        assignedToUserId: meta?.assignedToUserId || null
      }
    });

    return res.json({
      success: true,
      data: {
        threadId,
        assignedToUserId: meta?.assignedToUserId || null
      }
    });
  } catch (err) {
    console.error('[communicationsController] assignThreadOwner error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign thread owner',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/:threadId/tags
 * Add or remove thread tags.
 */
exports.updateThreadTags = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;
    const action = String(req.body?.action || 'add').toLowerCase();
    const normalizedTag = normalizeThreadTag(req.body?.tag);

    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }
    if (!normalizedTag) {
      return res.status(400).json({ success: false, message: 'Valid tag is required' });
    }
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be add or remove' });
    }

    const update = action === 'remove'
      ? { $pull: { tags: normalizedTag }, $set: { updatedBy: req.user._id } }
      : { $addToSet: { tags: normalizedTag }, $set: { updatedBy: req.user._id } };

    const meta = await CommunicationThreadMeta.findOneAndUpdate(
      { organizationId: orgId, threadId },
      update,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    await appendThreadAuditLog({
      organizationId: orgId,
      user: req.user,
      action: action === 'remove' ? 'communication_thread_tag_removed' : 'communication_thread_tag_added',
      details: {
        threadId,
        tag: normalizedTag
      }
    });

    return res.json({
      success: true,
      data: {
        threadId,
        tags: Array.isArray(meta?.tags) ? meta.tags : []
      }
    });
  } catch (err) {
    console.error('[communicationsController] updateThreadTags error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update thread tags',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/:threadId/done
 * Marks a thread as done/undone for current user.
 */
exports.markThreadDone = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;
    const done = req.body?.done !== false;

    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    const now = new Date();
    const update = done
      ? { $set: { doneAt: now, lastViewedAt: now } }
      : { $set: { doneAt: null } };

    const threadView = await ThreadView.findOneAndUpdate(
      {
        userId: req.user._id,
        organizationId: orgId,
        threadId
      },
      update,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      success: true,
      data: {
        threadId,
        done: Boolean(threadView?.doneAt),
        doneAt: threadView?.doneAt || null
      }
    });
  } catch (err) {
    console.error('[communicationsController] markThreadDone error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update thread status',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/:threadId/snooze
 * Body: { snoozedUntil: ISO string | null } — hide thread from default inbox until that time (per user).
 */
exports.markThreadSnooze = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;

    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    let snoozedUntil = null;
    const raw = req.body?.snoozedUntil;
    if (raw != null && raw !== '') {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid snoozedUntil' });
      }
      snoozedUntil = d;
    }

    const threadView = await ThreadView.findOneAndUpdate(
      {
        userId: req.user._id,
        organizationId: orgId,
        threadId
      },
      {
        $set: { snoozedUntil, snoozeWakeNotifiedAt: null },
        $setOnInsert: { lastViewedAt: new Date() }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    await appendThreadAuditLog({
      organizationId: orgId,
      user: req.user,
      action: 'communication_thread_snoozed',
      details: {
        threadId,
        snoozedUntil: threadView?.snoozedUntil || null
      }
    });

    return res.json({
      success: true,
      data: {
        threadId,
        snoozedUntil: threadView?.snoozedUntil || null
      }
    });
  } catch (err) {
    console.error('[communicationsController] markThreadSnooze error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update snooze',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/bulk
 * Body: { threadIds: string[], action: 'done'|'assign'|'add_tag'|'remove_tag'|'snooze', done?, assignedToUserId?, tag?, snoozedUntil? }
 */
exports.bulkThreadActions = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const threadIds = Array.isArray(req.body?.threadIds)
      ? req.body.threadIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const action = String(req.body?.action || '').toLowerCase();
    if (threadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'threadIds array is required' });
    }
    if (threadIds.length > 50) {
      return res.status(400).json({ success: false, message: 'Maximum 50 threads per bulk action' });
    }

    const results = [];

    if (action === 'done') {
      const done = req.body?.done !== false;
      const now = new Date();
      const update = done ? { $set: { doneAt: now, lastViewedAt: now } } : { $set: { doneAt: null } };
      for (const threadId of threadIds) {
        try {
          await ThreadView.findOneAndUpdate(
            { userId: req.user._id, organizationId: orgId, threadId },
            update,
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          results.push({ threadId, ok: true });
        } catch (err) {
          results.push({ threadId, ok: false, error: err.message });
        }
      }
      await appendThreadAuditLog({
        organizationId: orgId,
        user: req.user,
        action: 'communication_thread_bulk_done',
        details: { count: threadIds.length, done }
      });
      return res.json({ success: true, data: { results } });
    }

    if (action === 'assign') {
      const rawAssignee = req.body?.assignedToUserId;
      const assignedToUserId =
        rawAssignee === null || rawAssignee === ''
          ? null
          : (rawAssignee || req.user._id);
      if (assignedToUserId) {
        const exists = await User.findOne({ _id: assignedToUserId, organizationId: orgId }).select('_id').lean();
        if (!exists) {
          return res.status(400).json({ success: false, message: 'Invalid assignee for this workspace' });
        }
      }
      for (const threadId of threadIds) {
        try {
          await CommunicationThreadMeta.findOneAndUpdate(
            { organizationId: orgId, threadId },
            { $set: { assignedToUserId: assignedToUserId || null, updatedBy: req.user._id } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          results.push({ threadId, ok: true });
        } catch (err) {
          results.push({ threadId, ok: false, error: err.message });
        }
      }
      await appendThreadAuditLog({
        organizationId: orgId,
        user: req.user,
        action: 'communication_thread_bulk_assign',
        details: { count: threadIds.length, assignedToUserId: assignedToUserId || null }
      });
      return res.json({ success: true, data: { results } });
    }

    if (action === 'add_tag' || action === 'remove_tag') {
      const normalizedTag = normalizeThreadTag(req.body?.tag);
      if (!normalizedTag) {
        return res.status(400).json({ success: false, message: 'Valid tag is required' });
      }
      const update =
        action === 'remove_tag'
          ? { $pull: { tags: normalizedTag }, $set: { updatedBy: req.user._id } }
          : { $addToSet: { tags: normalizedTag }, $set: { updatedBy: req.user._id } };
      for (const threadId of threadIds) {
        try {
          await CommunicationThreadMeta.findOneAndUpdate(
            { organizationId: orgId, threadId },
            update,
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          results.push({ threadId, ok: true });
        } catch (err) {
          results.push({ threadId, ok: false, error: err.message });
        }
      }
      await appendThreadAuditLog({
        organizationId: orgId,
        user: req.user,
        action: action === 'remove_tag' ? 'communication_thread_bulk_tag_removed' : 'communication_thread_bulk_tag_added',
        details: { count: threadIds.length, tag: normalizedTag }
      });
      return res.json({ success: true, data: { results } });
    }

    if (action === 'snooze') {
      let snoozedUntil = null;
      const raw = req.body?.snoozedUntil;
      if (raw != null && raw !== '') {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid snoozedUntil' });
        }
        snoozedUntil = d;
      }
      for (const threadId of threadIds) {
        try {
          await ThreadView.findOneAndUpdate(
            { userId: req.user._id, organizationId: orgId, threadId },
            {
              $set: { snoozedUntil, snoozeWakeNotifiedAt: null },
              $setOnInsert: { lastViewedAt: new Date() }
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          results.push({ threadId, ok: true });
        } catch (err) {
          results.push({ threadId, ok: false, error: err.message });
        }
      }
      await appendThreadAuditLog({
        organizationId: orgId,
        user: req.user,
        action: 'communication_thread_bulk_snoozed',
        details: { count: threadIds.length, snoozedUntil }
      });
      return res.json({ success: true, data: { results } });
    }

    return res.status(400).json({
      success: false,
      message: 'action must be one of: done, assign, add_tag, remove_tag, snooze'
    });
  } catch (err) {
    console.error('[communicationsController] bulkThreadActions error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed bulk thread action',
      error: err.message
    });
  }
};

/**
 * PATCH /api/communications/threads/:threadId/view
 * Mark a thread as viewed by the current user.
 */
/**
 * GET /api/communications/threads/:threadId/messages
 *
 * Returns the ordered messages of a single thread for the Gmail-style inbox
 * reader. Output shape matches the `messages` array inside getThreads so the
 * client can reuse the same EmailThreadCard component.
 *
 * Authorization:
 *   1. Org isolation (all queries scoped to req.user.organizationId).
 *   2. If the thread is mailbox-scoped (workspace inbox), the user must have
 *      access to at least one of those mailboxes (same rule as the list view —
 *      see canUserAccessMailboxThreads).
 *   3. If the thread has no mailbox (legacy record-only thread), org isolation
 *      is sufficient — record-level access is enforced at the record page.
 */
/**
 * GET /api/communications/:communicationId/delivery-status
 * Returns AMDS delivery fields; polls AMDS when webhook may have been missed.
 */
exports.getCommunicationDeliveryStatus = async (req, res) => {
  try {
    const { communicationId } = req.params;
    const orgId = req.user.organizationId;

    if (!communicationId || !mongoose.Types.ObjectId.isValid(String(communicationId))) {
      return res.status(400).json({ success: false, message: 'Invalid communicationId' });
    }

    const comm = await Communication.findOne({
      _id: communicationId,
      organizationId: orgId
    }).lean();

    if (!comm) {
      return res.status(404).json({ success: false, message: 'Communication not found' });
    }

    let delivery = mapCommunicationDeliveryFields(comm);
    const amdsMessageId = delivery?.amdsMessageId;
    const shouldPoll =
      amdsMessageId
      && ['sending', 'sent'].includes(String(comm.status || '').toLowerCase())
      && delivery.deliveryStatus !== 'delivered';

    if (shouldPoll) {
      const client = getAmdsClient();
      if (client) {
        try {
          const remote = await client.getMessageStatus(amdsMessageId);
          if (remote?.status === 'delivered' || remote?.status === 'failed') {
            const update = {
              status: remote.status,
              'metadata.amdsMessageId': amdsMessageId,
              'metadata.deliveryUpdatedAt': new Date()
            };
            if (remote.status === 'failed') {
              update['metadata.deliveryError'] = String(remote.error_message || 'Delivery failed').slice(0, 2000);
            } else {
              update['metadata.deliveryError'] = null;
            }
            const updated = await Communication.findOneAndUpdate(
              { _id: communicationId, organizationId: orgId },
              { $set: update },
              { new: true }
            ).lean();
            if (updated) {
              delivery = mapCommunicationDeliveryFields(updated);
            }
          }
        } catch (pollErr) {
          console.warn('[communicationsController] AMDS delivery poll failed:', pollErr.message);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        communicationId: String(comm._id),
        ...delivery
      }
    });
  } catch (err) {
    console.error('[communicationsController] getCommunicationDeliveryStatus error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load delivery status',
      error: err.message
    });
  }
};

exports.getThreadMessages = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;

    if (!threadId || !mongoose.Types.ObjectId.isValid(String(threadId))) {
      return res.status(400).json({ success: false, message: 'Invalid threadId' });
    }

    // Include messages whose threadId === :threadId AND the seed message
    // (whose threadId may still be unset, with _id === :threadId).
    const messages = await Communication.find({
      organizationId: orgId,
      $or: [{ threadId }, { _id: threadId }]
    })
      .sort({ sentAt: 1, receivedAt: 1, createdAt: 1 })
      .lean();

    if (messages.length === 0) {
      return res.status(404).json({ success: false, message: 'Thread not found' });
    }

    const senderIds = [...new Set(
      messages
        .map((m) => (m?.sentByUserId ? String(m.sentByUserId) : ''))
        .filter(Boolean)
    )];
    const senderMap = new Map();
    if (senderIds.length > 0) {
      const senders = await User.find({
        _id: { $in: senderIds },
        organizationId: orgId
      }).select('_id firstName lastName email avatar').lean();
      for (const user of senders) {
        senderMap.set(String(user._id), {
          _id: user._id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          avatar: user.avatar || null
        });
      }
    }

    const mailboxIds = [
      ...new Set(messages.map((m) => m.mailboxId).filter(Boolean).map(String))
    ];
    if (mailboxIds.length > 0) {
      const mailboxes = await Mailbox.find({
        _id: { $in: mailboxIds },
        organizationId: orgId
      }).lean();
      const mailboxById = new Map(mailboxes.map((mb) => [String(mb._id), mb]));
      const allAccessible = mailboxIds.every((id) => {
        const mb = mailboxById.get(id);
        return mb && canUserAccessMailboxThreads(req.user, mb);
      });
      if (!allAccessible) {
        return res.status(403).json({
          success: false,
          message: 'Not allowed to view this thread'
        });
      }
    }

    const last = messages[messages.length - 1];
    const first = messages[0];
    const subject = String(last.subject || first.subject || '(no subject)');
    const relatedTo = first.relatedTo || null;

    return res.json({
      success: true,
      data: {
        threadId: String(first.threadId || first._id),
        subject,
        messageCount: messages.length,
        relatedTo: relatedTo
          ? {
              moduleKey: relatedTo.moduleKey,
              recordId: relatedTo.recordId ? String(relatedTo.recordId) : null
            }
          : null,
        messages: messages.map((m) => ({
          _id: m._id,
          direction: m.direction,
          fromAddress: m.fromAddress,
          toAddresses: m.toAddresses || [],
          ccAddresses: m.ccAddresses || [],
          subject: m.subject,
          body: m.body,
          attachments: m.attachments || [],
          sentAt: m.sentAt,
          receivedAt: m.receivedAt,
          scheduledAt: m.scheduledAt || null,
          status: m.status,
          sentByUserId: m.sentByUserId || null,
          sentByUser: m.sentByUserId
            ? senderMap.get(String(m.sentByUserId)) || null
            : null,
          ...mapCommunicationDeliveryFields(m)
        }))
      }
    });
  } catch (err) {
    console.error('[communicationsController] getThreadMessages error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load thread messages',
      error: err.message
    });
  }
};

/**
 * POST /api/communications/:communicationId/cancel-schedule
 * Cancels a not-yet-sent scheduled outbound email.
 */
exports.cancelScheduledEmail = async (req, res) => {
  try {
    const communicationId = String(req.params.communicationId || '').trim();
    if (!communicationId || !mongoose.Types.ObjectId.isValid(communicationId)) {
      return res.status(400).json({ success: false, message: 'Invalid communicationId' });
    }
    const orgId = req.user.organizationId;
    const doc = await Communication.findOne({
      _id: communicationId,
      organizationId: orgId,
      direction: 'outbound',
      kind: 'email',
      status: 'scheduled'
    });
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled email not found or already sent'
      });
    }
    doc.status = 'cancelled';
    await doc.save();
    try {
      await emailQueueService.removeSendJob(String(doc._id));
    } catch {
      /* queue optional */
    }
    await appendCommunicationEvent({
      organizationId: orgId,
      communicationId: doc._id,
      eventType: 'schedule_cancelled',
      source: 'communications-api',
      payload: { cancelledBy: String(req.user._id) }
    });
    return res.json({ success: true, data: doc.toObject ? doc.toObject() : doc });
  } catch (err) {
    console.error('[communicationsController] cancelScheduledEmail error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel scheduled email',
      error: err.message
    });
  }
};

exports.markThreadViewed = async (req, res) => {
  try {
    const { threadId } = req.params;
    const orgId = req.user.organizationId;

    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    const now = new Date();
    await ThreadView.findOneAndUpdate(
      {
        userId: req.user._id,
        organizationId: orgId,
        threadId
      },
      { $set: { lastViewedAt: now } },
      { upsert: true, runValidators: true }
    );

    return res.json({ success: true, lastViewedAt: now });
  } catch (err) {
    console.error('[communicationsController] markThreadViewed error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark thread as viewed',
      error: err.message
    });
  }
};

const EMAIL_TEMPLATES = [
  {
    id: 'intro',
    name: 'Introduction',
    subject: 'Nice to meet you',
    body: '<p>Hi,</p><p>I wanted to introduce myself. I\'m excited to connect and discuss how we can work together.</p><p>Best regards</p>'
  },
  {
    id: 'follow-up',
    name: 'Follow-up',
    subject: 'Following up',
    body: '<p>Hi,</p><p>I wanted to follow up on our previous conversation. Do you have a few minutes this week to discuss?</p><p>Thanks</p>'
  },
  {
    id: 'meeting-request',
    name: 'Meeting request',
    subject: 'Meeting request',
    body: '<p>Hi,</p><p>Would you be available for a meeting sometime this week? I\'d love to connect and discuss next steps.</p><p>Best</p>'
  },
  {
    id: 'thank-you',
    name: 'Thank you',
    subject: 'Thank you',
    body: '<p>Hi,</p><p>Thank you for your time today. I appreciate the conversation and look forward to moving forward.</p><p>Best regards</p>'
  }
];

/**
 * GET /api/communications/email/compose-preview
 * GET /api/communications/email/reply-to-preview (alias)
 * Query: moduleKey & recordId, or standalone=true; optional mailboxId.
 */
exports.previewComposeEmail = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const standalone = String(req.query.standalone || '').toLowerCase() === 'true';
    let moduleKey = String(req.query.moduleKey || '').trim().toLowerCase();
    let recordId = String(req.query.recordId || '').trim();
    const mailboxId = String(req.query.mailboxId || '').trim();

    if (standalone) {
      moduleKey = 'workspace';
      recordId = String(orgId);
    }

    if (!moduleKey || !recordId) {
      return res.status(400).json({
        success: false,
        message: 'Provide moduleKey and recordId, or standalone=true'
      });
    }

    const outboundIdentityService = require('../platform/communication/outbound/outboundIdentityService');
    const identity = await outboundIdentityService.resolveOutboundIdentity({
      organizationId: orgId,
      user: req.user,
      mailboxId: mailboxId || undefined,
      moduleKey
    });

    // Reply-To matches From so replies return to the selected sender identity
    const replyTo = String(identity.fromEmail || '').trim().toLowerCase();
    const replyToSource = identity.fromSource || 'from';
    const replyToNote = '';

    return res.json({
      success: true,
      data: {
        fromEmail: identity.fromEmail,
        fromName: identity.fromName,
        fromSource: identity.fromSource,
        mailboxId: identity.mailboxId,
        deliveryMode: identity.deliveryMode || null,
        identities: identity.identities,
        defaultOutboundMailboxId: identity.defaultOutboundMailboxId,
        replyTo,
        replyToSource,
        ...(replyToNote ? { replyToNote } : {})
      }
    });
  } catch (err) {
    console.error('[communicationsController] previewComposeEmail:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve compose addresses'
    });
  }
};

exports.previewReplyTo = exports.previewComposeEmail;

/**
 * PUT /api/communications/email/default-outbound-mailbox
 * Body: { mailboxId: string | null }
 * Persists the caller's default send-as mailbox identity.
 */
exports.setDefaultOutboundMailbox = async (req, res) => {
  try {
    const outboundIdentityService = require('../platform/communication/outbound/outboundIdentityService');
    const result = await outboundIdentityService.setDefaultOutboundMailbox({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      mailboxId: req.body?.mailboxId
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message || 'Failed to update default outbound mailbox'
      });
    }
    return res.json({
      success: true,
      data: { defaultOutboundMailboxId: result.defaultOutboundMailboxId }
    });
  } catch (err) {
    console.error('[communicationsController] setDefaultOutboundMailbox:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update default outbound mailbox'
    });
  }
};

exports.getTemplates = (req, res) => {
  return res.json({ success: true, data: { templates: EMAIL_TEMPLATES } });
};

/**
 * POST /api/communications/:communicationId/create-task
 * Create a task from an email (Phase 4: Email-to-Task).
 */
exports.createTaskFromEmail = async (req, res) => {
  try {
    const { communicationId } = req.params;
    const orgId = req.user.organizationId;

    const comm = await Communication.findOne({
      _id: communicationId,
      organizationId: orgId
    }).lean();

    if (!comm) {
      return res.status(404).json({ success: false, message: 'Communication not found' });
    }

    const title = (comm.subject || 'Email').trim().slice(0, 200);
    const body = (comm.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const description = body
      ? `Created from email:\n\nFrom: ${comm.fromAddress || ''}\nTo: ${(comm.toAddresses || []).join(', ')}\n\n${body}`
      : `Created from email: ${comm.subject || ''}`;

    let relatedTo = { type: 'none' };
    if (comm.relatedTo?.moduleKey === 'people') {
      relatedTo = { type: 'contact', id: comm.relatedTo.recordId };
    } else if (comm.relatedTo?.moduleKey === 'organizations') {
      relatedTo = { type: 'organization', id: comm.relatedTo.recordId };
    }

    const { assignResolvedSource } = require('../services/sourceResolver');
    const taskPayload = {
      organizationId: orgId,
      title: title ? `Email: ${title}` : 'Task from email',
      description,
      relatedTo,
      assignedTo: req.user._id,
      assignedBy: req.user._id,
      status: 'todo',
      priority: 'medium',
      createdBy: req.user._id,
      activityLogs: [{
        user: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        userId: req.user._id,
        action: 'created',
        details: { sourceCommunicationId: comm._id },
        timestamp: new Date()
      }]
    };
    assignResolvedSource(taskPayload, 'email');
    const task = await Task.create(taskPayload);

    return res.status(201).json({
      success: true,
      data: { taskId: task._id, task }
    });
  } catch (err) {
    console.error('[communicationsController] createTaskFromEmail error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: err.message
    });
  }
};

/**
 * POST /api/communications/:communicationId/create-case
 * Create a helpdesk case from an email.
 */
exports.createCaseFromEmail = async (req, res) => {
  try {
    const { communicationId } = req.params;
    const orgId = req.user.organizationId;

    const comm = await Communication.findOne({
      _id: communicationId,
      organizationId: orgId
    }).lean();

    if (!comm) {
      return res.status(404).json({ success: false, message: 'Communication not found' });
    }

    const title = (comm.subject || 'Email support case').trim().slice(0, 240);
    const body = (comm.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const notes = body
      ? `Created from email:\n\nFrom: ${comm.fromAddress || ''}\nTo: ${(comm.toAddresses || []).join(', ')}\n\n${body}`
      : `Created from email: ${comm.subject || ''}`;
    const now = new Date();
    const actorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'System';

    const cycle = createInitialSlaCycle(1, now);

    const { allocateRequired } = require('../services/moduleNumberingService');
    const caseId = await allocateRequired({
      organizationId: orgId,
      moduleKey: 'cases',
      at: now,
    });
    const payload = {
      organizationId: orgId,
      caseId,
      title: title ? `Email: ${title}` : 'Email support case',
      caseType: 'Support Ticket',
      priority: 'Medium',
      status: 'New',
      channel: 'Email',
      caseNotes: notes,
      assignedTo: req.user._id,
      currentSlaCycle: cycle,
      activities: [
        {
          activityType: 'case_created',
          message: 'Case created from email',
          internal: true,
          metadata: { sourceCommunicationId: comm._id },
          actorId: req.user._id,
          actorName,
          createdAt: now
        }
      ],
      createdBy: req.user._id,
      updatedBy: req.user._id
    };
    if (comm.relatedTo?.moduleKey === 'people') {
      payload.contactId = comm.relatedTo.recordId;
    } else if (comm.relatedTo?.moduleKey === 'organizations') {
      payload.organizationRefId = comm.relatedTo.recordId;
    }

    const { assignResolvedSource } = require('../services/sourceResolver');
    assignResolvedSource(payload, 'email');
    const createdCase = await Case.create(payload);
    createdCase.currentSlaCycle = await finalizeCaseSlaOnCreate({
      organizationId: orgId,
      caseRecord: createdCase,
      actorId: req.user._id
    });
    await createdCase.save();
    await caseExecutionService.onCaseCreated({
      caseRecord: createdCase,
      actorId: req.user._id
    });

    return res.status(201).json({
      success: true,
      data: {
        caseId: createdCase.caseId,
        caseRecordId: createdCase._id,
        case: createdCase
      }
    });
  } catch (err) {
    console.error('[communicationsController] createCaseFromEmail error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create case',
      error: err.message
    });
  }
};

/**
 * GET /api/communications/pipeline-metrics
 * Minimal Phase 1 observability for sending pipeline.
 */
exports.getPipelineMetrics = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [successCount, failedCount, avgLatencyResult, queueStats] = await Promise.all([
      Communication.countDocuments({
        organizationId,
        kind: 'email',
        direction: 'outbound',
        status: 'sent',
        createdAt: { $gte: since }
      }),
      Communication.countDocuments({
        organizationId,
        kind: 'email',
        direction: 'outbound',
        status: 'failed',
        createdAt: { $gte: since }
      }),
      Communication.aggregate([
        {
          $match: {
            organizationId,
            kind: 'email',
            direction: 'outbound',
            status: 'sent',
            createdAt: { $gte: since },
            sentAt: { $type: 'date' }
          }
        },
        {
          $project: {
            latencyMs: { $subtract: ['$sentAt', '$createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgLatencyMs: { $avg: '$latencyMs' }
          }
        }
      ]),
      emailQueueService.getQueueStats()
    ]);

    const total = successCount + failedCount;
    const successRate = total > 0 ? Number(((successCount / total) * 100).toFixed(2)) : 0;
    const avgLatencyMs = avgLatencyResult?.[0]?.avgLatencyMs
      ? Math.round(avgLatencyResult[0].avgLatencyMs)
      : 0;

    return res.json({
      success: true,
      data: {
        window: '24h',
        outbound: {
          total,
          successCount,
          failedCount,
          successRate,
          avgLatencyMs
        },
        queue: {
          ...queueStats,
          retryProfile: emailQueueService.COMMUNICATION_RETRY_PROFILES.EMAIL_SEND
        }
      }
    });
  } catch (error) {
    console.error('[communicationsController] getPipelineMetrics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pipeline metrics',
      error: error.message
    });
  }
};

/**
 * GET /api/communications/pipeline-diagnostics
 * Recent communication events + failure category breakdown.
 */
exports.getPipelineDiagnostics = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(10, Math.floor(limitRaw))) : 30;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentEvents, failureBreakdown] = await Promise.all([
      CommunicationEvent.find({
        organizationId,
        createdAt: { $gte: since }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('communicationId eventType source payload createdAt')
        .lean(),
      CommunicationEvent.aggregate([
        {
          $match: {
            organizationId,
            eventType: 'failed',
            createdAt: { $gte: since }
          }
        },
        {
          $project: {
            failureCategory: {
              $ifNull: ['$payload.failureCategory', 'unknown_error']
            }
          }
        },
        {
          $group: {
            _id: '$failureCategory',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    return res.json({
      success: true,
      data: {
        window: '24h',
        recentEvents,
        failureBreakdown: failureBreakdown.map((row) => ({
          category: row._id,
          count: row.count
        }))
      }
    });
  } catch (error) {
    console.error('[communicationsController] getPipelineDiagnostics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pipeline diagnostics',
      error: error.message
    });
  }
};

/**
 * GET /api/communications/webhook-test/templates
 * Returns sample payloads for webhook simulation/testing.
 */
exports.getWebhookTestTemplates = async (req, res) => {
  try {
    const communication = await Communication.findOne({
      organizationId: req.user.organizationId,
      direction: 'outbound',
      kind: 'email',
      externalMessageId: { $exists: true, $ne: null }
    })
      .sort({ createdAt: -1 })
      .select('_id externalMessageId')
      .lean();

    const messageId = communication?.externalMessageId || 'provider-message-id';
    const communicationId = communication?._id || null;

    return res.json({
      success: true,
      data: {
        supportedEventTypes: WEBHOOK_TEST_EVENT_TYPES,
        latestCommunicationId: communicationId,
        latestExternalMessageId: messageId,
        genericTemplate: {
          provider: 'generic',
          eventType: 'delivered',
          messageId,
          eventId: `evt_${Date.now()}`
        },
        sesTemplate: {
          Type: 'Notification',
          MessageId: `sns-${Date.now()}`,
          Message: JSON.stringify({
            notificationType: 'Delivery',
            mail: { messageId }
          })
        }
      }
    });
  } catch (error) {
    console.error('[communicationsController] getWebhookTestTemplates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get webhook templates',
      error: error.message
    });
  }
};

/**
 * POST /api/communications/webhook-test/simulate
 * Simulates a provider event against an outbound communication.
 */
exports.simulateWebhookEvent = async (req, res) => {
  try {
    const isOwnerLike = req.user?.isOwner === true || String(req.user?.role || '').toLowerCase() === 'owner';
    if (!isOwnerLike) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owner can run webhook simulation'
      });
    }

    const {
      communicationId,
      externalMessageId,
      eventType = 'delivered',
      provider = 'simulator'
    } = req.body || {};
    const normalizedEventType = String(eventType || '').toLowerCase();
    if (!WEBHOOK_TEST_EVENT_TYPES.includes(normalizedEventType)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported eventType. Allowed: ${WEBHOOK_TEST_EVENT_TYPES.join(', ')}`
      });
    }

    const query = { organizationId: req.user.organizationId, direction: 'outbound', kind: 'email' };
    if (communicationId) query._id = communicationId;
    if (externalMessageId) query.externalMessageId = externalMessageId;
    if (!communicationId && !externalMessageId) {
      return res.status(400).json({
        success: false,
        message: 'communicationId or externalMessageId is required'
      });
    }

    const updated = await Communication.findOneAndUpdate(
      query,
      {
        $set: {
          status: normalizedEventType,
          'metadata.webhook': {
            provider: String(provider || 'simulator').toLowerCase(),
            eventType: normalizedEventType,
            receivedAt: new Date().toISOString(),
            simulated: true
          }
        }
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found for simulation'
      });
    }

    await appendCommunicationEvent({
      organizationId: updated.organizationId,
      communicationId: updated._id,
      eventType: normalizedEventType,
      source: `webhook:${String(provider || 'simulator').toLowerCase()}`,
      webhookEventId: `sim-${updated._id}-${normalizedEventType}-${Date.now()}`,
      payload: {
        simulated: true,
        mappedStatus: normalizedEventType,
        externalMessageId: updated.externalMessageId || null
      }
    });

    return res.json({
      success: true,
      data: {
        communicationId: updated._id,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('[communicationsController] simulateWebhookEvent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to simulate webhook event',
      error: error.message
    });
  }
};

/**
 * GET /api/communications/suppressions
 * List active suppressed recipients for current tenant.
 */
exports.getSuppressions = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const suppressions = await listSuppressedAddresses({
      organizationId: req.user.organizationId,
      limit
    });
    return res.json({
      success: true,
      data: {
        suppressions
      }
    });
  } catch (error) {
    console.error('[communicationsController] getSuppressions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suppression list',
      error: error.message
    });
  }
};

/**
 * GET /api/communications/suppressions/stats
 * Returns suppression counters for dashboard/quick cards.
 */
exports.getSuppressionStats = async (req, res) => {
  try {
    const stats = await getSuppressionStats({
      organizationId: req.user.organizationId
    });
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[communicationsController] getSuppressionStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suppression stats',
      error: error.message
    });
  }
};

/**
 * DELETE /api/communications/suppressions/:email
 * Remove an address from suppression list (owner-only).
 */
exports.removeSuppression = async (req, res) => {
  try {
    const isOwnerLike = req.user?.isOwner === true || String(req.user?.role || '').toLowerCase() === 'owner';
    if (!isOwnerLike) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owner can remove suppressed recipients'
      });
    }

    const email = decodeURIComponent(String(req.params.email || '')).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    const { updated } = await unsuppressAddress({
      organizationId: req.user.organizationId,
      email
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Suppressed recipient not found'
      });
    }

    try {
      const organization = await Organization.findById(req.user.organizationId);
      if (organization) {
        const userLabel = req.user?.username || req.user?.email || 'Unknown';
        const auditEntry = {
          user: userLabel,
          userId: req.user?._id || null,
          action: 'communication_suppression_removed',
          details: { email },
          timestamp: new Date()
        };
        if (!Array.isArray(organization.activityLogs)) {
          organization.activityLogs = [];
        }
        organization.activityLogs.push(auditEntry);
        organization.markModified('activityLogs');
        await organization.save();
      }
    } catch (auditErr) {
      console.error('[communicationsController] removeSuppression audit error:', auditErr.message);
    }

    return res.json({
      success: true,
      message: 'Recipient removed from suppression list'
    });
  } catch (error) {
    console.error('[communicationsController] removeSuppression error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove suppression',
      error: error.message
    });
  }
};

const INBOUND_LIFECYCLE_EVENTS = [
  'inbound_received',
  'inbound_queued',
  'inbound_parsed',
  'inbound_threaded',
  'inbound_routed',
  'inbound_failed',
  'inbound_replayed'
];

/**
 * GET /api/communications/inbound/diagnostics
 * Phase 3 inbound observability: queue stats, recent lifecycle events,
 * thread-strategy breakdown, dead-letter counts.
 */
exports.getInboundDiagnostics = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(10, Math.floor(limitRaw))) : 30;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [queueStats, recentEvents, strategyBreakdown, deadLetterCount, recentDeadLetters] = await Promise.all([
      inboundEmailQueueService.getQueueStats(),
      CommunicationEvent.find({
        organizationId,
        eventType: { $in: INBOUND_LIFECYCLE_EVENTS },
        createdAt: { $gte: since }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('communicationId eventType source payload createdAt')
        .lean(),
      CommunicationEvent.aggregate([
        {
          $match: {
            organizationId,
            eventType: 'inbound_threaded',
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: { $ifNull: ['$payload.strategy', 'unknown'] },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      InboundDeadLetter.countDocuments({
        organizationId,
        resolvedAt: null
      }),
      InboundDeadLetter.find({ organizationId, resolvedAt: null })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('stage reason error parsedSummary replayCount lastReplayAt createdAt')
        .lean()
    ]);

    return res.json({
      success: true,
      data: {
        window: '24h',
        queue: {
          ...queueStats,
          retryProfile: inboundEmailQueueService.COMMUNICATION_INBOUND_RETRY_PROFILES.EMAIL_INBOUND
        },
        recentEvents,
        threadStrategyBreakdown: strategyBreakdown.map((row) => ({
          strategy: row._id,
          count: row.count
        })),
        deadLetter: {
          openCount: deadLetterCount,
          recent: recentDeadLetters
        }
      }
    });
  } catch (error) {
    console.error('[communicationsController] getInboundDiagnostics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inbound diagnostics',
      error: error.message
    });
  }
};

/**
 * GET /api/communications/inbound/dead-letter
 * List dead-letter inbound jobs (open by default).
 */
exports.listInboundDeadLetters = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;
    const includeResolved = String(req.query.includeResolved || 'false').toLowerCase() === 'true';

    const filter = { organizationId };
    if (!includeResolved) filter.resolvedAt = null;

    const items = await InboundDeadLetter.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('stage reason error parsedSummary replayCount lastReplayAt resolvedAt createdAt rawSizeBytes')
      .lean();

    return res.json({
      success: true,
      data: { items, count: items.length }
    });
  } catch (error) {
    console.error('[communicationsController] listInboundDeadLetters error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list inbound dead-letters',
      error: error.message
    });
  }
};

/**
 * POST /api/communications/inbound/dead-letter/:id/replay
 * Owner-only: replays a dead-letter inbound message through the dispatcher.
 * Marks the dead-letter as resolved on success and bumps the replay counter
 * on failure (keeping it open for inspection).
 */
exports.replayInboundDeadLetter = async (req, res) => {
  try {
    const isOwnerLike = req.user?.isOwner === true || String(req.user?.role || '').toLowerCase() === 'owner';
    if (!isOwnerLike) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owner can replay inbound dead-letters'
      });
    }

    const organizationId = req.user.organizationId;
    const deadLetter = await InboundDeadLetter.findOne({
      _id: req.params.id,
      organizationId
    });
    if (!deadLetter) {
      return res.status(404).json({
        success: false,
        message: 'Dead-letter not found'
      });
    }

    if (!deadLetter.rawMimeBase64) {
      return res.status(400).json({
        success: false,
        message: 'Dead-letter has no stored raw MIME (too large at capture time); cannot replay automatically.'
      });
    }

    deadLetter.replayCount = (deadLetter.replayCount || 0) + 1;
    deadLetter.lastReplayAt = new Date();
    await deadLetter.save();

    try {
      const result = await inboundEmailQueueService.processInboundJob({
        rawMimeBase64: deadLetter.rawMimeBase64,
        headerOrganizationId: organizationId,
        source: 'inbound-replay'
      });
      deadLetter.resolvedAt = new Date();
      await deadLetter.save();

      await appendCommunicationEvent({
        organizationId,
        communicationId: result.communicationId || null,
        eventType: 'inbound_replayed',
        source: 'inbound-replay',
        payload: {
          deadLetterId: deadLetter._id,
          threadStrategy: result.threadStrategy
        }
      });

      return res.json({
        success: true,
        data: {
          replayed: true,
          communicationId: result.communicationId,
          threadStrategy: result.threadStrategy
        }
      });
    } catch (replayErr) {
      return res.status(422).json({
        success: false,
        message: 'Replay failed; dead-letter remains open',
        error: replayErr.message,
        replayCount: deadLetter.replayCount
      });
    }
  } catch (error) {
    console.error('[communicationsController] replayInboundDeadLetter error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to replay inbound dead-letter',
      error: error.message
    });
  }
};

function resolveAttachmentContentDisposition(req, safeName) {
  const mode = String(req.query.disposition || '').trim().toLowerCase();
  const inline = mode === 'inline' || mode === '1' || mode === 'true';
  if (inline) {
    return `inline; filename="${safeName}"`;
  }
  return `attachment; filename="${safeName}"`;
}

exports.downloadCommunicationAttachment = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const storagePath = String(req.query.storagePath || '').trim();
    if (!storagePath.startsWith('oci:')) {
      return res.status(400).json({ success: false, message: 'Invalid storage path' });
    }

    const key = storagePath.slice(4);
    const safeOrgId = String(organizationId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const expectedPrefix = `attachments/${safeOrgId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const fileName = String(req.query.fileName || path.basename(key) || 'attachment').replace(/[\r\n"]/g, '_');
    const { stream } = await objectStorage.getObjectStream({ key });
    const disposition = resolveAttachmentContentDisposition(req, fileName);

    res.setHeader('Content-Type', req.query.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    if (disposition.startsWith('inline')) {
      res.setHeader('Cache-Control', 'private, max-age=300');
    }
    return stream.pipe(res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[communicationsController] downloadCommunicationAttachment', error);
    return res.status(500).json({ success: false, message: 'Failed to download attachment' });
  }
};
