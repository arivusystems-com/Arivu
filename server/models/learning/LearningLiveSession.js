'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { LIVE_SESSION_STATUSES } = require('../../constants/learningConstants');

const LearningLiveSessionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningCourse',
      default: null,
      index: true,
    },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    meetingUrl: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(LIVE_SESSION_STATUSES),
      default: LIVE_SESSION_STATUSES.SCHEDULED,
      index: true,
    },
    attendeeUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningLiveSessionSchema.index({ organizationId: 1, startsAt: 1 });

module.exports = wrapTenantModel(
  mongoose.model('LearningLiveSession', LearningLiveSessionSchema)
);
