'use strict';

const internalChatSSEHub = require('../services/internalChatSSEHub');
const chat = require('../services/internalChatService');

function handleServiceError(res, err, fallbackMessage) {
  if (err?.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code || 'INTERNAL_CHAT_ERROR',
    });
  }
  console.error('[internalChatController]', fallbackMessage, err);
  return res.status(500).json({ success: false, message: fallbackMessage });
}

function requireView(req, res) {
  if (!chat.canViewInternalChat(req.user)) {
    res.status(403).json({
      success: false,
      message: 'Internal chat permission required',
      code: 'INTERNAL_CHAT_FORBIDDEN',
    });
    return false;
  }
  return true;
}

exports.bootstrap = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    return res.json({
      success: true,
      data: {
        streamPath: '/api/internal-chat/stream',
        sseEvent: 'internal_chat',
        health: internalChatSSEHub.getHealthStats(),
      },
    });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to bootstrap internal chat');
  }
};

exports.listSpaces = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const spaces = await chat.listSpacesForUser(req.user.organizationId, req.user._id);
    return res.json({ success: true, data: { spaces } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to list chat spaces');
  }
};

exports.listTeammates = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const users = await chat.listTeammatesForChat({
      organizationId: req.user.organizationId,
      user: req.user,
      limit: req.query?.limit,
    });
    return res.json({ success: true, data: { users } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to list chat teammates');
  }
};

exports.createChannel = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const space = await chat.createChannel({
      organizationId: req.user.organizationId,
      user: req.user,
      name: req.body?.name,
      topic: req.body?.topic,
      isPrivate: req.body?.isPrivate,
      memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : [],
    });
    return res.status(201).json({ success: true, data: { space } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to create channel');
  }
};

exports.joinChannel = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const space = await chat.joinPublicChannel({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
    });
    return res.json({ success: true, data: { space } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to join channel');
  }
};

exports.listMembers = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.listSpaceMembers({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to list members');
  }
};

exports.inviteMembers = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.inviteMembersToChannel({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : [],
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to invite members');
  }
};

exports.removeMember = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.removeSpaceMember({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      targetUserId: req.params.userId,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to remove member');
  }
};

exports.updateChannel = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const space = await chat.updateChannel({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      name: req.body?.name,
      topic: req.body?.topic,
    });
    return res.json({ success: true, data: { space } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to update channel');
  }
};

exports.createDm = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const space = await chat.createOrGetDm({
      organizationId: req.user.organizationId,
      user: req.user,
      otherUserId: req.body?.userId,
    });
    return res.status(201).json({ success: true, data: { space } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to create DM');
  }
};

exports.createGroupDm = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const space = await chat.createOrGetGroupDm({
      organizationId: req.user.organizationId,
      user: req.user,
      memberIds: Array.isArray(req.body?.memberIds) ? req.body.memberIds : [],
    });
    return res.status(201).json({ success: true, data: { space } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to create group DM');
  }
};

exports.discussRecord = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.discussRecord({
      organizationId: req.user.organizationId,
      user: req.user,
      moduleKey: req.body?.moduleKey || req.params?.moduleKey,
      recordId: req.body?.recordId || req.params?.recordId,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to open record discussion');
  }
};

exports.listMessages = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.listMessages({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      threadRootId: req.query.threadRootId || null,
      before: req.query.before || null,
      aroundMessageId: req.query.aroundMessageId || req.query.messageId || null,
      limit: req.query.limit,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to list messages');
  }
};

exports.postMessage = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const message = await chat.postMessage({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      body: req.body?.body,
      threadRootId: req.body?.threadRootId || null,
      quoteMessageId: req.body?.quoteMessageId || null,
      mentionUserIds: Array.isArray(req.body?.mentionUserIds) ? req.body.mentionUserIds : [],
      recordRefs: Array.isArray(req.body?.recordRefs) ? req.body.recordRefs : [],
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
    });
    return res.status(201).json({ success: true, data: { message } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to send message');
  }
};

exports.markRead = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const cursor = await chat.markRead({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.body?.messageId || null,
    });
    return res.json({ success: true, data: cursor });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to mark read');
  }
};

exports.toggleReaction = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.toggleReaction({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.params.messageId,
      emoji: req.body?.emoji,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to toggle reaction');
  }
};

exports.search = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.searchMessages({
      organizationId: req.user.organizationId,
      user: req.user,
      q: req.query.q,
      spaceId: req.query.spaceId || null,
      limit: req.query.limit,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to search messages');
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const spaceId = req.params.spaceId;
    await chat.setSpacePresence({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId,
    });
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { persistMulterUpload } = require('../middleware/uploadMiddleware');
    const uploadResult = await persistMulterUpload(req, 'internal-chat');
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
    return handleServiceError(res, err, 'Failed to upload attachment');
  }
};

exports.typing = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    await chat.publishTyping({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
    });
    return res.json({ success: true });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to publish typing');
  }
};

exports.presence = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.setSpacePresence({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.body?.spaceId || req.params.spaceId || null,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to update presence');
  }
};

exports.pinSpace = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.setSpacePinned({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      pin: req.body?.pin !== false,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to update chat pin');
  }
};

exports.muteSpace = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.setSpaceMuted({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      muted: req.body?.muted !== false,
      durationKey: req.body?.durationKey || 'forever',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to update mute');
  }
};

exports.markUnread = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.markSpaceUnread({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.body?.messageId || null,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to mark unread');
  }
};

exports.pinMessage = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const result = await chat.pinMessage({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.params.messageId,
      pin: req.body?.pin !== false,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to pin message');
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    await chat.softDeleteMessage({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.params.messageId,
    });
    return res.json({ success: true });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to delete message');
  }
};

exports.editMessage = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const message = await chat.editMessage({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
      messageId: req.params.messageId,
      body: req.body?.body,
      mentionUserIds: Array.isArray(req.body?.mentionUserIds) ? req.body.mentionUserIds : [],
    });
    return res.json({ success: true, data: { message } });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to edit message');
  }
};

exports.exportSpace = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    const transcript = await chat.exportSpaceTranscript({
      organizationId: req.user.organizationId,
      user: req.user,
      spaceId: req.params.spaceId,
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="internal-chat-${req.params.spaceId}.json"`
    );
    return res.json(transcript);
  } catch (err) {
    return handleServiceError(res, err, 'Failed to export transcript');
  }
};

exports.getSettings = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    if (!chat.canManageInternalChat(req.user) && !req.user?.isOwner) {
      // Allow view of settings for all entitled users; edits restricted below
    }
    const settings = await chat.getAddonSettings(req.user.organizationId);
    return res.json({ success: true, data: settings });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to load settings');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    if (!chat.canManageInternalChat(req.user) && !req.user?.isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Manage permission required',
        code: 'INTERNAL_CHAT_FORBIDDEN',
      });
    }
    const settings = await chat.updateAddonSettings(req.user.organizationId, req.body || {});
    return res.json({ success: true, data: settings });
  } catch (err) {
    return handleServiceError(res, err, 'Failed to update settings');
  }
};

exports.streamEvents = async (req, res) => {
  try {
    if (!requireView(req, res)) return;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('event: connected\ndata: {}\n\n');
    if (typeof res.flush === 'function') res.flush();
    internalChatSSEHub.subscribe(res, req.user._id, req.user.organizationId);
  } catch (err) {
    console.error('[internalChatController] streamEvents', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to open stream' });
    }
  }
};
