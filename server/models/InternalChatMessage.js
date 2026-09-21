'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const RecordRefSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, trim: true, lowercase: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    url: { type: String, trim: true, default: '' },
    storagePath: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, trim: true, maxlength: 16 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true }
);

/** Snapshot of a quoted message for Google Chat–style inline reply (not a thread). */
const QuoteSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalChatMessage', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, trim: true, maxlength: 120, default: '' },
    bodyPreview: { type: String, trim: true, maxlength: 280, default: '' },
  },
  { _id: false }
);

/** Structured activity notice for group/channel membership and pin events. */
const SystemEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'group_created',
        'channel_created',
        'member_added',
        'member_removed',
        'member_left',
        'chat_pinned',
      ],
      required: true,
    },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, maxlength: 120, default: '' },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetName: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { _id: false }
);

const InternalChatMessageSchema = new mongoose.Schema(
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
    threadRootId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalChatMessage',
      default: null,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** `user` = normal chat; `system` = membership/activity notice (non-interactive). */
    kind: {
      type: String,
      enum: ['user', 'system'],
      default: 'user',
      index: true,
    },
    systemEvent: {
      type: SystemEventSchema,
      default: null,
    },
    body: {
      type: String,
      default: '',
      maxlength: 16000,
    },
    quote: {
      type: QuoteSchema,
      default: null,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    mentionUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    recordRefs: {
      type: [RecordRefSchema],
      default: [],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

InternalChatMessageSchema.index({ organizationId: 1, spaceId: 1, createdAt: -1 });
InternalChatMessageSchema.index({ organizationId: 1, spaceId: 1, threadRootId: 1, createdAt: 1 });
InternalChatMessageSchema.index({ organizationId: 1, body: 'text' });

module.exports = wrapTenantModel(mongoose.model('InternalChatMessage', InternalChatMessageSchema));
