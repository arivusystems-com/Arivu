'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { COURSE_STATUSES } = require('../../constants/learningConstants');

const PathItemSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningCourse', required: true },
    required: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const LearningPathSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(COURSE_STATUSES),
      default: COURSE_STATUSES.DRAFT,
      index: true,
    },
    sequential: { type: Boolean, default: true },
    items: { type: [PathItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningPathSchema.index({ organizationId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningPath', LearningPathSchema));
