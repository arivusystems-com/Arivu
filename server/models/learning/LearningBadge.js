'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');

const LearningBadgeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningSkill',
      default: null,
      index: true,
    },
    /** When set, auto-award on certificate for this course. */
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningCourse',
      default: null,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningBadgeSchema.index({ organizationId: 1, courseId: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningBadge', LearningBadgeSchema));
