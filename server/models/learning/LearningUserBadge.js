'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');

const LearningUserBadgeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    badgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningBadge',
      required: true,
      index: true,
    },
    awardedAt: { type: Date, default: Date.now },
    awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: {
      type: String,
      enum: ['manual', 'course_complete'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

LearningUserBadgeSchema.index(
  { organizationId: 1, userId: 1, badgeId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('LearningUserBadge', LearningUserBadgeSchema));
