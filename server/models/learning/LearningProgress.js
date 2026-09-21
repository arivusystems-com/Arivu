'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');

/**
 * Cached progress projection derived from LearningEvent stream.
 */
const LearningProgressSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningEnrollment',
      default: null,
    },
    percentComplete: { type: Number, default: 0, min: 0, max: 100 },
    completedObjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LearningObject' }],
    lastLearningObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningObject',
      default: null,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastEventAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LearningProgressSchema.index(
  { organizationId: 1, userId: 1, courseId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('LearningProgress', LearningProgressSchema));
