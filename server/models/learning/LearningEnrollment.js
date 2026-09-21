'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { ENROLLMENT_STATUSES } = require('../../constants/learningConstants');

const LearningEnrollmentSchema = new mongoose.Schema(
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
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningCourse',
      default: null,
      index: true,
    },
    pathId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningPath',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ENROLLMENT_STATUSES),
      default: ENROLLMENT_STATUSES.ACTIVE,
      index: true,
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LearningEnrollmentSchema.index(
  { organizationId: 1, userId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { courseId: { $type: 'objectId' } } }
);

module.exports = wrapTenantModel(mongoose.model('LearningEnrollment', LearningEnrollmentSchema));
