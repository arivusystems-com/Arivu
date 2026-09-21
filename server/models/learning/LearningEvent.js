'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { LEARNING_EVENT_TYPES } = require('../../constants/learningConstants');

/**
 * Append-only learning activity events — source of truth for progress history.
 */
const LearningEventSchema = new mongoose.Schema(
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
    eventType: {
      type: String,
      enum: Object.values(LEARNING_EVENT_TYPES),
      required: true,
      index: true,
    },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningCourse', default: null },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule', default: null },
    learningObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningObject',
      default: null,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningAssessment',
      default: null,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningEnrollment',
      default: null,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

LearningEventSchema.index({ organizationId: 1, userId: 1, occurredAt: -1 });
LearningEventSchema.index({ organizationId: 1, eventType: 1, occurredAt: -1 });

module.exports = wrapTenantModel(mongoose.model('LearningEvent', LearningEventSchema));
