/**
 * ============================================================================
 * Mailbox API (tenant-scoped)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Mailbox = require('../models/Mailbox');
const CommunicationEvent = require('../models/CommunicationEvent');
const CommunicationThreadMeta = require('../models/CommunicationThreadMeta');
const ThreadView = require('../models/ThreadView');
const EmailThreadRegistry = require('../models/EmailThreadRegistry');
const { uploadsDir } = require('../middleware/uploadMiddleware');
const { isTenantAdmin, canUserAccessMailboxThreads } = require('../services/mailboxAccessService');
const { loadWorkspaceThreadSummaries } = require('../services/workspaceThreadSummariesService');
const {
  buildGmailAuthorizeUrl,
  completeGmailOAuthCallback,
  resolveClientBaseUrlFromState,
  runGmailInboxSyncForMailbox,
  listGmailLabelsForMailbox,
  normalizeGmailSyncLabelIds,
  isGmailMailboxReady
} = require('../services/mailboxGmailInboxSyncService');
const {
  assertGmailSyncManageAccess,
  assertGmailSyncRunAccess
} = require('../services/mailboxAccessService');
const { getGmailOAuthAppCredentialsForServer } = require('../platform/communication/config/communicationConfigService');
const {
  getOrganizationGmailSmtpRelay,
  connectMailboxGmailSmtp,
  disconnectMailboxGmailSmtp,
  isMailboxGmailSmtpReady
} = require('../services/mailboxGmailSmtpService');
const {
  connectMailboxSmtp,
  disconnectMailboxSmtp,
  verifyMailboxSmtpParams,
  isMailboxSmtpReady
} = require('../services/mailboxSmtpService');
const {
  isGmailIntegrationEnabled,
  getEmailIntegrationCapabilities
} = require('../config/emailFeatureFlags');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');
const {
  provisionMailboxWithParser,
  deprovisionMailboxFromParser,
  skippedReasonMessage
} = require('../services/inboundParserProvisioningService');
const Communication = require('../models/Communication');
const { getPublicInboundParserStatus } = require('../services/inboundParserConfigService');
const { resolveParserIdsForMailbox } = require('../utils/parserIdCodec');

function toId(value) {
  if (value == null) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) return new mongoose.Types.ObjectId(String(value));
  return null;
}

/** Assign unique parser tenant/mailbox ids at creation (personal + group). */
async function persistUniqueParserIds(mailboxDoc, organizationId) {
  const { parserTenantId, parserMailboxId } = resolveParserIdsForMailbox({
    organizationId,
    mailbox: mailboxDoc
  });
  await Mailbox.updateOne(
    { _id: mailboxDoc._id, organizationId },
    { $set: { parserTenantId, parserMailboxId } }
  );
  mailboxDoc.parserTenantId = parserTenantId;
  mailboxDoc.parserMailboxId = parserMailboxId;
  return mailboxDoc;
}

function serializeMailbox(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const hasGmailToken = Boolean(
    o.inboxProvider === 'google' && String(o.inboxSyncEncryptedRefreshToken || '').length > 0
  );
  const gmailReady = hasGmailToken && isGmailMailboxReady(o);
  const gmailSmtpReady = isMailboxGmailSmtpReady(o);
  return {
    id: String(o._id),
    organizationId: o.organizationId ? String(o.organizationId) : undefined,
    kind: o.kind,
    label: o.label,
    emailAddress: o.emailAddress || '',
    ownerUserId: o.ownerUserId ? String(o.ownerUserId) : null,
    memberUserIds: Array.isArray(o.memberUserIds) ? o.memberUserIds.map((id) => String(id)) : [],
    createdByUserId: o.createdByUserId ? String(o.createdByUserId) : undefined,
    status: o.status,
    syncStatus: o.syncStatus,
    inboxProvider: o.inboxProvider || 'none',
    outboundChannel: o.outboundChannel || 'none',
    gmailInboxSync: {
      connected: gmailReady,
      hasStoredToken: hasGmailToken,
      accountEmail: o.inboxSyncAccountEmail || '',
      lastSyncAt: o.lastInboxSyncAt || null,
      lastError: o.lastInboxSyncError ? String(o.lastInboxSyncError).slice(0, 500) : '',
      syncLabelIds: Array.isArray(o.gmailSyncLabelIds)
        ? o.gmailSyncLabelIds.map((x) => String(x).trim()).filter(Boolean)
        : []
    },
    gmailSmtpOutbound: {
      connected: gmailSmtpReady,
      verifiedAt: o.smtpOutboundVerifiedAt || null
    },
    smtpOutbound: {
      connected: isMailboxSmtpReady(o),
      provider: o.smtpOutboundProvider || '',
      host: o.smtpOutboundHost || '',
      port: o.smtpOutboundPort || null,
      secure: o.smtpOutboundSecure === true,
      fromName: o.smtpOutboundFromName || '',
      verifiedAt: o.smtpOutboundVerifiedAt || null,
      hasCredentials: Boolean(String(o.smtpOutboundEncryptedAppPassword || '').trim())
    },
    inboundParser: {
      routingAddress: o.routingAddress || '',
      forwardingHint: o.parserForwardingHint || '',
      provisionStatus: o.parserProvisionStatus || 'pending',
      provisionedAt: o.parserProvisionedAt || null,
      provisioningError: o.parserProvisioningError
        ? String(o.parserProvisioningError).slice(0, 300)
        : ''
    },
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

/**
 * GET /api/mailboxes
 * Lists group mailboxes for the org + the current user's personal + smtp_sender mailboxes.
 */
async function listMailboxes(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;

    const personal = await Mailbox.find({ organizationId: orgId, kind: 'personal', ownerUserId: userId })
      .sort({ updatedAt: -1 })
      .lean();

    const smtpSenders = await Mailbox.find({
      organizationId: orgId,
      kind: 'smtp_sender',
      ownerUserId: userId
    })
      .sort({ updatedAt: -1 })
      .lean();

    const groups = await Mailbox.find({ organizationId: orgId, kind: 'group' }).sort({ updatedAt: -1 }).lean();
    const groupsVisible = groups.filter((g) => canUserAccessMailboxThreads(req.user, g));

    const mailboxes = [
      ...personal.map((m) => serializeMailbox(m)),
      ...smtpSenders.map((m) => serializeMailbox(m)),
      ...groupsVisible.map((m) => serializeMailbox(m))
    ];

    const canCreateGroup = isTenantAdmin(req.user);
    const canCreatePersonal = personal.length === 0;
    const ownedPersonal = personal[0] || null;
    const canDeletePersonal = ownedPersonal ? canDeleteMailbox(req.user, ownedPersonal) : false;
    const parserStatus = await getPublicInboundParserStatus();

    const gmailOAuthCheck = isGmailIntegrationEnabled()
      ? await getGmailOAuthAppCredentialsForServer(orgId)
      : { error: 'disabled' };
    const gmailSmtpRelay = isGmailIntegrationEnabled()
      ? await getOrganizationGmailSmtpRelay(orgId)
      : null;

    const includeThreadCounts = String(req.query.includeThreadCounts || '').toLowerCase() === 'true';
    const includeDoneForCounts = String(req.query.includeDone || '').toLowerCase() === 'true';
    let allMailThreadUnread = null;
    if (includeThreadCounts) {
      const summary = await loadWorkspaceThreadSummaries(req, '');
      if (summary.error) {
        allMailThreadUnread = 0;
        mailboxes.forEach((mb) => {
          mb.threadUnreadCount = 0;
        });
      } else {
        const threads = summary.threads;
        const base = includeDoneForCounts ? threads : threads.filter((t) => !t.done);
        const unreadList = base.filter((t) => t.unread);
        allMailThreadUnread = unreadList.length;
        const countByMb = new Map(mailboxes.map((m) => [m.id, 0]));
        for (const t of unreadList) {
          const mid = t.mailboxId ? String(t.mailboxId) : '';
          if (mid && countByMb.has(mid)) {
            countByMb.set(mid, countByMb.get(mid) + 1);
          }
        }
        mailboxes.forEach((mb) => {
          mb.threadUnreadCount = countByMb.get(mb.id) || 0;
        });
      }
    }

    return res.json({
      success: true,
      data: {
        mailboxes,
        flags: {
          canCreatePersonal,
          canDeletePersonal,
          canCreateGroup,
          canCreateSmtpSender: true,
          ...getEmailIntegrationCapabilities(),
          ...parserStatus,
          gmailOAuthAppConfigured:
            isGmailIntegrationEnabled() && !gmailOAuthCheck.error,
          gmailSmtpOrgConfigured: isGmailIntegrationEnabled() && Boolean(gmailSmtpRelay)
        },
        ...(includeThreadCounts && allMailThreadUnread != null ? { allMailThreadUnread } : {})
      }
    });
  } catch (err) {
    console.error('[mailboxController] listMailboxes:', err);
    return res.status(500).json({ success: false, message: 'Failed to list mailboxes' });
  }
}

/**
 * POST /api/mailboxes
 * Body: { kind, label, emailAddress?, memberUserIds? }
 * kind: personal | group | smtp_sender
 */
async function createMailbox(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const { kind, label, emailAddress, memberUserIds } = req.body || {};

    if (kind !== 'personal' && kind !== 'group' && kind !== 'smtp_sender') {
      return res.status(400).json({
        success: false,
        message: 'kind must be personal, group, or smtp_sender'
      });
    }
    if (!label || typeof label !== 'string' || !String(label).trim()) {
      return res.status(400).json({ success: false, message: 'label is required' });
    }

    if (kind === 'group' && !isTenantAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can create group mailboxes' });
    }

    if (kind === 'smtp_sender') {
      const email = emailAddress ? String(emailAddress).trim().toLowerCase() : '';
      const doc = await Mailbox.create({
        organizationId: orgId,
        kind: 'smtp_sender',
        label: String(label).trim(),
        emailAddress: email,
        ownerUserId: userId,
        memberUserIds: [],
        createdByUserId: userId,
        status: 'draft',
        syncStatus: 'not_configured',
        inboxProvider: 'none',
        outboundChannel: 'none',
        parserProvisionStatus: 'skipped'
      });
      const refreshed = await Mailbox.findById(doc._id).lean();
      return res.status(201).json({
        success: true,
        data: {
          mailbox: serializeMailbox(refreshed || doc)
        }
      });
    }

    if (kind === 'personal') {
      const existing = await Mailbox.findOne({ organizationId: orgId, kind: 'personal', ownerUserId: userId });
      if (existing) {
        return res.status(409).json({ success: false, message: 'You already have a personal mailbox' });
      }
      const doc = await Mailbox.create({
        organizationId: orgId,
        kind: 'personal',
        label: String(label).trim(),
        emailAddress: emailAddress ? String(emailAddress).trim().toLowerCase() : '',
        ownerUserId: userId,
        memberUserIds: [],
        createdByUserId: userId,
        status: 'draft',
        syncStatus: 'not_configured',
        parserProvisionStatus: 'pending'
      });
      await persistUniqueParserIds(doc, orgId);
      const provision = await provisionMailboxWithParser({
        organizationId: orgId,
        mailbox: doc
      });
      const refreshed = await Mailbox.findById(doc._id).lean();
      return res.status(201).json({
        success: true,
        data: {
          mailbox: serializeMailbox(refreshed || doc),
          parserProvision: provision
        }
      });
    }

    let members = [];
    if (Array.isArray(memberUserIds) && memberUserIds.length) {
      members = memberUserIds.map((id) => toId(id)).filter(Boolean);
    }

    const doc = await Mailbox.create({
      organizationId: orgId,
      kind: 'group',
      label: String(label).trim(),
      emailAddress: emailAddress ? String(emailAddress).trim().toLowerCase() : '',
      ownerUserId: null,
      memberUserIds: members,
      createdByUserId: userId,
      status: 'draft',
      syncStatus: 'not_configured',
      parserProvisionStatus: 'pending'
    });
    await persistUniqueParserIds(doc, orgId);
    const provision = await provisionMailboxWithParser({
      organizationId: orgId,
      mailbox: doc
    });
    const refreshed = await Mailbox.findById(doc._id).lean();
    return res.status(201).json({
      success: true,
      data: {
        mailbox: serializeMailbox(refreshed || doc),
        parserProvision: provision
      }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mailbox already exists' });
    }
    console.error('[mailboxController] createMailbox:', err);
    return res.status(500).json({ success: false, message: 'Failed to create mailbox' });
  }
}

function canEditMailbox(user, mailboxLean) {
  if (!mailboxLean) return false;
  if (mailboxLean.kind === 'group') return isTenantAdmin(user);
  if (mailboxLean.kind === 'personal' || mailboxLean.kind === 'smtp_sender') {
    const owner = mailboxLean.ownerUserId && String(mailboxLean.ownerUserId);
    return owner === String(user._id) || isTenantAdmin(user);
  }
  return false;
}

function canDeleteMailbox(user, mailboxLean) {
  if (!mailboxLean) return false;
  return canEditMailbox(user, mailboxLean);
}

function collectCommunicationThreadIds(communications) {
  const set = new Set();
  for (const c of communications) {
    const tid = c.threadId != null ? String(c.threadId) : String(c._id);
    if (tid) set.add(tid);
  }
  return [...set];
}

function buildThreadPresenceOr(threadIds) {
  const oidStrings = new Set();
  const oids = [];
  for (const k of threadIds) {
    if (mongoose.Types.ObjectId.isValid(k) && String(new mongoose.Types.ObjectId(k)) === k) {
      oidStrings.add(k);
      oids.push(new mongoose.Types.ObjectId(k));
    }
  }
  const orPart = [];
  if (oids.length > 0) {
    orPart.push({ threadId: { $in: oids } });
    orPart.push({
      _id: { $in: oids },
      $or: [{ threadId: null }, { threadId: { $exists: false } }]
    });
  }
  for (const k of threadIds) {
    if (!oidStrings.has(k)) {
      orPart.push({ threadId: k });
    }
  }
  return orPart;
}

async function deleteCommunicationsForMailbox(orgId, mailboxId) {
  const communications = await Communication.find({
    organizationId: orgId,
    mailboxId,
    kind: 'email'
  })
    .select('_id threadId attachments')
    .lean();

  if (!communications.length) {
    return { deleted: 0 };
  }

  const commIds = communications.map((c) => c._id);
  const threadIds = collectCommunicationThreadIds(communications);

  for (const c of communications) {
    for (const att of c.attachments || []) {
      const rel = att?.storagePath;
      if (!rel) continue;
      const full = path.join(uploadsDir, rel);
      try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch {
        /* ignore attachment cleanup failures */
      }
    }
  }

  await CommunicationEvent.deleteMany({
    organizationId: orgId,
    communicationId: { $in: commIds }
  });
  await Communication.deleteMany({ _id: { $in: commIds } });

  const threadIdsToClean = [];
  for (const threadId of threadIds) {
    const orPart = buildThreadPresenceOr([threadId]);
    if (!orPart.length) continue;
    const remaining = await Communication.countDocuments({
      organizationId: orgId,
      kind: 'email',
      $or: orPart
    });
    if (remaining === 0) {
      threadIdsToClean.push(threadId);
    }
  }

  if (threadIdsToClean.length) {
    const threadOidStrings = new Set();
    const threadOids = [];
    for (const k of threadIdsToClean) {
      if (mongoose.Types.ObjectId.isValid(k) && String(new mongoose.Types.ObjectId(k)) === k) {
        threadOidStrings.add(k);
        threadOids.push(new mongoose.Types.ObjectId(k));
      }
    }
    const threadOr = [];
    if (threadOids.length) threadOr.push({ threadId: { $in: threadOids } });
    for (const k of threadIdsToClean) {
      if (!threadOidStrings.has(k)) threadOr.push({ threadId: k });
    }
    if (threadOr.length) {
      await ThreadView.deleteMany({ organizationId: orgId, $or: threadOr });
      await CommunicationThreadMeta.deleteMany({ organizationId: orgId, $or: threadOr });
    }

    const conversationIds = threadIdsToClean.map((k) =>
      mongoose.Types.ObjectId.isValid(k) ? new mongoose.Types.ObjectId(k) : k
    );
    await EmailThreadRegistry.deleteMany({
      tenantId: orgId,
      conversationId: { $in: conversationIds }
    });
  }

  await EmailThreadRegistry.updateMany(
    { tenantId: orgId, mailboxId },
    { $set: { mailboxId: null, mailboxType: 'none' } }
  );

  return { deleted: commIds.length };
}

function parseDeleteEmailsFlag(req) {
  const q = req.query?.deleteEmails;
  if (q === 'true' || q === '1') return true;
  if (q === 'false' || q === '0') return false;
  return req.body?.deleteEmails === true;
}

/**
 * DELETE /api/mailboxes/:id — personal (owner or tenant admin) or group (tenant admin).
 */
async function deleteMailbox(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }

    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId });
    if (!mailbox) {
      return res.status(404).json({ success: false, message: 'Mailbox not found' });
    }

    if (!canDeleteMailbox(req.user, mailbox)) {
      return res.status(403).json({
        success: false,
        message: 'Not allowed to delete this mailbox'
      });
    }

    if (isGmailIntegrationEnabled() && mailbox.inboxProvider === 'google') {
      const { stopGmailWatchForMailbox } = require('../services/gmailWatchService');
      await stopGmailWatchForMailbox(mailbox).catch(() => {});
    }
    if (isGmailIntegrationEnabled() && mailbox.outboundChannel === 'gmail_smtp') {
      const { disconnectMailboxGmailSmtp } = require('../services/mailboxGmailSmtpService');
      await disconnectMailboxGmailSmtp(id, orgId).catch(() => {});
    } else if (mailbox.outboundChannel === 'smtp' || mailbox.kind === 'smtp_sender') {
      await disconnectMailboxSmtp(id, orgId).catch(() => {});
    }

    const parserDeprovision =
      mailbox.kind === 'smtp_sender'
        ? { ok: true, skipped: true }
        : await deprovisionMailboxFromParser({
            organizationId: orgId,
            mailbox
          });

    const deleteEmails = mailbox.kind === 'personal' && parseDeleteEmailsFlag(req);
    let emailsDeleted = 0;
    if (deleteEmails) {
      const emailResult = await deleteCommunicationsForMailbox(orgId, id);
      emailsDeleted = emailResult.deleted;
    } else {
      await Communication.updateMany(
        { organizationId: orgId, mailboxId: id },
        { $set: { mailboxId: null } }
      );
    }

    const parserTenantId = String(mailbox.parserTenantId || '').trim();
    const parserMailboxId = String(mailbox.parserMailboxId || '').trim();
    if (parserTenantId && parserMailboxId) {
      await ParserMailboxRegistry.deleteOne({ parserTenantId, parserMailboxId }).catch(() => {});
    }

    await Mailbox.deleteOne({ _id: id, organizationId: orgId });

    const warnings = [];
    if (parserDeprovision.messagesExist) {
      warnings.push(
        'Mailbox removed from CRM. The inbound parser still has mail history for this address — disable forwarding in your email provider.'
      );
    } else if (parserDeprovision.ok === false && !parserDeprovision.skipped) {
      warnings.push(
        parserDeprovision.error
          ? `Mailbox removed from CRM. Parser cleanup: ${parserDeprovision.error}`
          : 'Mailbox removed from CRM. Parser cleanup did not complete.'
      );
    }

    return res.json({
      success: true,
      data: {
        deleted: true,
        mailboxId: String(id),
        emailsDeleted,
        parserDeprovision
      },
      ...(warnings.length ? { warnings } : {})
    });
  } catch (err) {
    console.error('[mailboxController] deleteMailbox:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete mailbox' });
  }
}

/**
 * PATCH /api/mailboxes/:id
 */
async function updateMailbox(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }

    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    if (!mailbox) {
      return res.status(404).json({ success: false, message: 'Mailbox not found' });
    }

    if (!canEditMailbox(req.user, mailbox)) {
      return res.status(403).json({ success: false, message: 'Not allowed to update this mailbox' });
    }

    const { label, emailAddress, memberUserIds, status, syncStatus } = req.body || {};
    const updates = {};

    if (label !== undefined) {
      if (typeof label !== 'string' || !String(label).trim()) {
        return res.status(400).json({ success: false, message: 'label must be a non-empty string' });
      }
      updates.label = String(label).trim();
    }
    if (emailAddress !== undefined) {
      updates.emailAddress = emailAddress ? String(emailAddress).trim().toLowerCase() : '';
    }
    if (mailbox.kind === 'group' && memberUserIds !== undefined) {
      if (!Array.isArray(memberUserIds)) {
        return res.status(400).json({ success: false, message: 'memberUserIds must be an array' });
      }
      updates.memberUserIds = memberUserIds.map((x) => toId(x)).filter(Boolean);
    }
    if (status !== undefined) {
      if (status !== 'draft' && status !== 'active') {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      updates.status = status;
    }
    if (syncStatus !== undefined) {
      if (!['not_configured', 'pending', 'connected'].includes(syncStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid syncStatus' });
      }
      updates.syncStatus = syncStatus;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const doc = await Mailbox.findOneAndUpdate({ _id: id, organizationId: orgId }, { $set: updates }, { new: true });
    return res.json({ success: true, data: { mailbox: serializeMailbox(doc) } });
  } catch (err) {
    console.error('[mailboxController] updateMailbox:', err);
    return res.status(500).json({ success: false, message: 'Failed to update mailbox' });
  }
}

/**
 * GET /api/mailboxes/:id
 */
function canProvisionInboundParser(user, mailboxLean) {
  if (!mailboxLean || !user) return false;
  if (mailboxLean.kind === 'group') return isTenantAdmin(user);
  const owner = mailboxLean.ownerUserId && String(mailboxLean.ownerUserId);
  return isTenantAdmin(user) || owner === String(user._id);
}

/**
 * POST /api/mailboxes/:id/inbound-parser/provision
 * Create or refresh parser routing address for this mailbox.
 */
async function provisionMailboxParserHandler(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }

    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId });
    if (!mailbox) {
      return res.status(404).json({ success: false, message: 'Mailbox not found' });
    }

    if (!canProvisionInboundParser(req.user, mailbox)) {
      return res.status(403).json({
        success: false,
        message:
          mailbox.kind === 'group'
            ? 'Only admins can provision shared mailbox forwarding addresses'
            : 'Not allowed to provision this mailbox'
      });
    }

    const result = await provisionMailboxWithParser({
      organizationId: orgId,
      mailbox
    });

    const refreshed = await Mailbox.findById(mailbox._id).lean();
    const skippedMessage = result.skipped ? skippedReasonMessage(result.reason) : null;
    const failureMessage = result.skipped
      ? skippedMessage || 'Inbound parser is not configured on this server'
      : result.error || 'Provisioning failed';

    return res.json({
      success: Boolean(result.ok || result.routingAddress),
      data: {
        mailbox: serializeMailbox(refreshed || mailbox),
        parserProvision: result
      },
      message: result.ok ? undefined : failureMessage
    });
  } catch (err) {
    console.error('[mailboxController] provisionMailboxParserHandler:', err);
    return res.status(500).json({ success: false, message: 'Failed to provision inbound address' });
  }
}

async function getMailbox(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }

    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    if (!mailbox) {
      return res.status(404).json({ success: false, message: 'Mailbox not found' });
    }

    if (!canUserAccessMailboxThreads(req.user, mailbox)) {
      return res.status(403).json({ success: false, message: 'Not allowed to view this mailbox' });
    }

    return res.json({ success: true, data: { mailbox: serializeMailbox(mailbox) } });
  } catch (err) {
    console.error('[mailboxController] getMailbox:', err);
    return res.status(500).json({ success: false, message: 'Failed to load mailbox' });
  }
}

/**
 * GET /api/mailboxes/inbox-sync/google/callback — Google redirects here (no JWT).
 *
 * Frontend base URL for the post-callback redirect is resolved up front so
 * every exit path (success, structured error, thrown error) lands on the same
 * host. Resolution order:
 *   1. process.env.CLIENT_URL — explicit operator override
 *   2. origin of the per-org Gmail redirect URI (Settings → Integrations →
 *      Email → Advanced, or GOOGLE_GMAIL_REDIRECT_URI env). Works for single-
 *      host deployments where the API and SPA share a hostname.
 *   3. CLIENT_URL, or the dev frontend at http://localhost:5173. Production never uses that fallback.
 */
async function gmailOAuthCallback(req, res) {
  let base = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (!base) {
    const fromState = await resolveClientBaseUrlFromState(req.query.state).catch(() => '');
    const { resolveClientUrl, isLocalhostClientUrl } = require('../utils/clientUrl');
    const stateBase = fromState ? String(fromState).replace(/\/$/, '') : '';
    const stateIsDevOnly = process.env.NODE_ENV === 'production' && isLocalhostClientUrl(stateBase);
    base = stateBase && !stateIsDevOnly ? stateBase : resolveClientUrl();
  }

  try {
    const result = await completeGmailOAuthCallback({
      code: req.query.code,
      state: req.query.state
    });
    if (result.ok) {
      return res.redirect(`${base}/inbox?gmail=connected`);
    }
    const msg = encodeURIComponent(String(result.error || 'oauth_failed').slice(0, 800));
    return res.redirect(`${base}/inbox?gmail=error&message=${msg}`);
  } catch (err) {
    console.error('[mailboxController] gmailOAuthCallback:', err);
    return res.redirect(`${base}/inbox?gmail=error&message=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
}

/**
 * GET /api/mailboxes/:id/inbox-sync/google/start — returns Google OAuth URL (personal or shared mailbox).
 */
async function gmailInboxSyncGoogleStart(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    const loginHintRaw =
      req.query?.login_hint != null
        ? req.query.login_hint
        : req.query?.loginHint != null
          ? req.query.loginHint
          : '';
    const loginHintSingle = Array.isArray(loginHintRaw) ? loginHintRaw[0] : loginHintRaw;
    const built = await buildGmailAuthorizeUrl({
      mailboxId: String(id),
      userId: String(userId),
      organizationId: String(orgId),
      loginHint: loginHintSingle
    });
    if (built.error) {
      return res.status(503).json({ success: false, message: built.error });
    }
    return res.json({ success: true, data: { url: built.url } });
  } catch (err) {
    console.error('[mailboxController] gmailInboxSyncGoogleStart:', err);
    return res.status(500).json({ success: false, message: 'Failed to start Gmail OAuth' });
  }
}

/**
 * POST /api/mailboxes/:id/inbox-sync/run — pull recent INBOX messages from Gmail into workspace threads.
 */
async function gmailInboxSyncRun(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncRunAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    if (!mailbox || mailbox.inboxProvider !== 'google' || !mailbox.inboxSyncEncryptedRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail inbox is not connected for this mailbox. Complete OAuth first.'
      });
    }
    const result = await runGmailInboxSyncForMailbox(mailbox);
    if (result.error) {
      await Mailbox.updateOne(
        { _id: id, organizationId: orgId },
        {
          $set: {
            lastInboxSyncError: String(result.error).slice(0, 2000),
            lastInboxSyncAt: new Date()
          }
        }
      );
      return res.status(502).json({
        success: false,
        message: result.error,
        code: result.code || undefined,
        data: { imported: result.imported, skipped: result.skipped }
      });
    }
    return res.json({
      success: true,
      data: { imported: result.imported, skipped: result.skipped }
    });
  } catch (err) {
    const apiMsg = err?.response?.data?.error?.message;
    const displayMsg = apiMsg || err.message || 'Gmail sync failed';
    console.error('[mailboxController] gmailInboxSyncRun:', displayMsg, err.stack || err);
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (id) {
      await Mailbox.updateOne(
        { _id: id, organizationId: orgId },
        {
          $set: {
            lastInboxSyncError: String(displayMsg).slice(0, 2000),
            lastInboxSyncAt: new Date()
          }
        }
      );
    }
    return res.status(500).json({
      success: false,
      message: displayMsg
    });
  }
}

/**
 * GET /api/mailboxes/:id/inbox-sync/google/labels — list Gmail labels + current sync selection (owner).
 */
async function listGmailInboxSyncLabels(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncRunAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    if (!mailbox || mailbox.inboxProvider !== 'google' || !mailbox.inboxSyncEncryptedRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail inbox is not connected for this mailbox.'
      });
    }
    const result = await listGmailLabelsForMailbox(mailbox);
    if (result.error) {
      return res.status(502).json({ success: false, message: result.error });
    }
    const selected =
      Array.isArray(mailbox.gmailSyncLabelIds) && mailbox.gmailSyncLabelIds.length > 0
        ? normalizeGmailSyncLabelIds(mailbox.gmailSyncLabelIds)
        : normalizeGmailSyncLabelIds([]);
    return res.json({
      success: true,
      data: {
        labels: result.labels,
        selectedLabelIds: selected
      }
    });
  } catch (err) {
    console.error('[mailboxController] listGmailInboxSyncLabels:', err);
    return res.status(500).json({ success: false, message: 'Failed to list Gmail labels' });
  }
}

/**
 * PATCH /api/mailboxes/:id/inbox-sync/google/sync-labels
 * Body: { labelIds: string[] } — which Gmail labels/folders to import on sync.
 */
async function patchGmailInboxSyncSyncLabels(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    if (!mailbox || mailbox.inboxProvider !== 'google' || !mailbox.inboxSyncEncryptedRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Gmail inbox is not connected for this mailbox.'
      });
    }
    const raw = req.body?.labelIds;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ success: false, message: 'labelIds must be a non-empty array' });
    }
    if (raw.length > 40) {
      return res.status(400).json({ success: false, message: 'Too many labels selected' });
    }

    const listResult = await listGmailLabelsForMailbox(mailbox);
    if (listResult.error) {
      return res.status(502).json({ success: false, message: listResult.error });
    }
    const allowed = new Set((listResult.labels || []).map((l) => l.id));
    const requested = normalizeGmailSyncLabelIds(raw).filter((lid) => allowed.has(lid));
    const finalIds = requested.length ? requested : ['INBOX'];

    await Mailbox.updateOne(
      { _id: id, organizationId: orgId },
      { $set: { gmailSyncLabelIds: finalIds } }
    );
    const updated = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    return res.json({
      success: true,
      data: { mailbox: serializeMailbox(updated), selectedLabelIds: finalIds }
    });
  } catch (err) {
    console.error('[mailboxController] patchGmailInboxSyncSyncLabels:', err);
    return res.status(500).json({ success: false, message: 'Failed to save sync folders' });
  }
}

/**
 * POST /api/mailboxes/:id/inbox-sync/google/disconnect
 */
/**
 * POST /api/mailboxes/outbound/smtp/verify
 * Body: { emailAddress, password, provider?, smtpHost?, smtpPort?, smtpSecure? }
 */
async function verifyMailboxSmtpHandler(req, res) {
  try {
    const { emailAddress, password, provider, smtpHost, smtpPort, smtpSecure } = req.body || {};
    const result = await verifyMailboxSmtpParams({
      emailAddress,
      password,
      provider,
      smtpHost,
      smtpPort,
      smtpSecure
    });
    return res.status(result.ok ? 200 : 400).json({
      success: result.ok,
      status: result.status,
      message: result.ok ? 'Connected' : result.error,
      code: result.code || result.status,
      data: result.ok
        ? {
            provider: result.provider,
            host: result.host,
            port: result.port,
            secure: result.secure
          }
        : undefined
    });
  } catch (err) {
    console.error('[mailboxController] verifyMailboxSmtp:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify SMTP', status: 'UNKNOWN' });
  }
}

/**
 * POST /api/mailboxes/:id/outbound/smtp/connect
 */
async function connectMailboxSmtpHandler(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    const {
      emailAddress,
      password,
      appPassword,
      provider,
      smtpHost,
      smtpPort,
      smtpSecure,
      displayName
    } = req.body || {};
    const result = await connectMailboxSmtp({
      organizationId: orgId,
      mailboxId: id,
      emailAddress,
      password: password || appPassword,
      provider,
      smtpHost,
      smtpPort,
      smtpSecure,
      displayName
    });
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code,
        status: result.status
      });
    }
    const updated = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    return res.json({
      success: true,
      status: result.status,
      data: { mailbox: serializeMailbox(updated) }
    });
  } catch (err) {
    console.error('[mailboxController] connectMailboxSmtp:', err);
    return res.status(500).json({ success: false, message: 'Failed to connect SMTP' });
  }
}

async function disconnectMailboxSmtpHandler(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    await disconnectMailboxSmtp(id, orgId);
    const updated = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    return res.json({ success: true, data: { mailbox: serializeMailbox(updated) } });
  } catch (err) {
    console.error('[mailboxController] disconnectMailboxSmtp:', err);
    return res.status(500).json({ success: false, message: 'Failed to disconnect SMTP' });
  }
}

/**
 * POST /api/mailboxes/:id/outbound/gmail-smtp/connect
 * Body: { emailAddress, appPassword } — thin wrapper over generic SMTP connect.
 */
async function connectMailboxGmailSmtpHandler(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    const { emailAddress, appPassword } = req.body || {};
    const result = await connectMailboxGmailSmtp({
      organizationId: orgId,
      mailboxId: id,
      emailAddress,
      appPassword
    });
    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code,
        status: result.status
      });
    }
    const updated = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    return res.json({
      success: true,
      data: { mailbox: serializeMailbox(updated) }
    });
  } catch (err) {
    console.error('[mailboxController] connectMailboxGmailSmtp:', err);
    return res.status(500).json({ success: false, message: 'Failed to connect Gmail SMTP' });
  }
}

async function disconnectMailboxGmailSmtpHandler(req, res) {
  try {
    const orgId = req.user.organizationId;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    await disconnectMailboxGmailSmtp(id, orgId);
    const updated = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    return res.json({ success: true, data: { mailbox: serializeMailbox(updated) } });
  } catch (err) {
    console.error('[mailboxController] disconnectMailboxGmailSmtp:', err);
    return res.status(500).json({ success: false, message: 'Failed to disconnect Gmail SMTP' });
  }
}

async function gmailInboxSyncDisconnect(req, res) {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user._id;
    const id = toId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid mailbox id' });
    }
    const mailbox = await Mailbox.findOne({ _id: id, organizationId: orgId }).lean();
    const accessErr = assertGmailSyncManageAccess(mailbox, req.user);
    if (accessErr) {
      return res.status(403).json({ success: false, message: accessErr });
    }
    if (mailbox?.inboxProvider === 'google') {
      const { stopGmailWatchForMailbox } = require('../services/gmailWatchService');
      await stopGmailWatchForMailbox(mailbox).catch(() => {});
    }
    await Mailbox.updateOne(
      { _id: id, organizationId: orgId },
      {
        $set: {
          inboxProvider: 'none',
          inboxSyncEncryptedRefreshToken: '',
          inboxSyncAccountEmail: '',
          gmailHistoryId: '',
          gmailSyncLabelIds: [],
          gmailWatchExpiration: null,
          gmailWatchTopic: '',
          lastInboxSyncError: '',
          syncStatus: 'not_configured'
        }
      }
    );
    return res.json({ success: true, data: { disconnected: true } });
  } catch (err) {
    console.error('[mailboxController] gmailInboxSyncDisconnect:', err);
    return res.status(500).json({ success: false, message: 'Failed to disconnect Gmail' });
  }
}

module.exports = {
  listMailboxes,
  createMailbox,
  updateMailbox,
  deleteMailbox,
  getMailbox,
  provisionMailboxParserHandler,
  gmailOAuthCallback,
  gmailInboxSyncGoogleStart,
  gmailInboxSyncRun,
  listGmailInboxSyncLabels,
  patchGmailInboxSyncSyncLabels,
  gmailInboxSyncDisconnect,
  connectMailboxGmailSmtpHandler,
  disconnectMailboxGmailSmtpHandler,
  verifyMailboxSmtpHandler,
  connectMailboxSmtpHandler,
  disconnectMailboxSmtpHandler
};
