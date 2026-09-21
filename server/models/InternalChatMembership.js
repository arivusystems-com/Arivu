'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { INTERNAL_CHAT_MEMBERSHIP_ROLES } = require('../constants/internalChatConstants');

const InternalChatMembershipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalChatSpace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: INTERNAL_CHAT_MEMBERSHIP_ROLES,
      default: 'member',
    },
    muted: {
      type: Boolean,
      default: false,
    },
    /** When set with muted=true, mute expires at this time. null = muted until unmuted. */
    mutedUntil: {
      type: Date,
      default: null,
    },
    /** Per-user: force unread badge until the space is opened/read. */
    forceUnread: {
      type: Boolean,
      default: false,
    },
    /** Per-user: when set, space is pinned to top of that user's chat list. */
    pinnedAt: {
      type: Date,
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalChatMessage',
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

InternalChatMembershipSchema.index(
  { organizationId: 1, spaceId: 1, userId: 1 },
  { unique: true }
);
InternalChatMembershipSchema.index({ organizationId: 1, userId: 1, spaceId: 1 });

module.exports = wrapTenantModel(
  mongoose.model('InternalChatMembership', InternalChatMembershipSchema)
);
