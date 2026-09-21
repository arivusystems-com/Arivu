'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const internalChatController = require('../controllers/internalChatController');

router.use(protect);
router.use(organizationIsolation);
router.use(requireAddonEntitlement(ADDON_KEYS.INTERNAL_CHAT));

router.get('/bootstrap', internalChatController.bootstrap);
router.get('/search', internalChatController.search);
router.get('/settings', internalChatController.getSettings);
router.put('/settings', internalChatController.updateSettings);
router.get('/teammates', internalChatController.listTeammates);
router.get('/spaces', internalChatController.listSpaces);
router.post('/spaces/channels', internalChatController.createChannel);
router.post('/spaces/:spaceId/join', internalChatController.joinChannel);
router.get('/spaces/:spaceId/members', internalChatController.listMembers);
router.post('/spaces/:spaceId/members', internalChatController.inviteMembers);
router.delete('/spaces/:spaceId/members/:userId', internalChatController.removeMember);
router.patch('/spaces/:spaceId', internalChatController.updateChannel);
router.post('/spaces/dms', internalChatController.createDm);
router.post('/spaces/group-dms', internalChatController.createGroupDm);
router.post('/spaces/discuss', internalChatController.discussRecord);
router.get('/spaces/:spaceId/messages', internalChatController.listMessages);
router.post('/spaces/:spaceId/messages', internalChatController.postMessage);
router.post(
  '/spaces/:spaceId/attachments',
  uploadSingle('file'),
  internalChatController.uploadAttachment
);
router.post('/spaces/:spaceId/messages/:messageId/reactions', internalChatController.toggleReaction);
router.post('/spaces/:spaceId/pin', internalChatController.pinSpace);
router.post('/spaces/:spaceId/mute', internalChatController.muteSpace);
router.post('/spaces/:spaceId/unread', internalChatController.markUnread);
router.post('/spaces/:spaceId/messages/:messageId/pin', internalChatController.pinMessage);
router.patch('/spaces/:spaceId/messages/:messageId', internalChatController.editMessage);
router.delete('/spaces/:spaceId/messages/:messageId', internalChatController.deleteMessage);
router.get('/spaces/:spaceId/export', internalChatController.exportSpace);
router.post('/spaces/:spaceId/read', internalChatController.markRead);
router.post('/spaces/:spaceId/typing', internalChatController.typing);
router.post('/spaces/:spaceId/presence', internalChatController.presence);
router.get('/stream', internalChatController.streamEvents);

module.exports = router;
