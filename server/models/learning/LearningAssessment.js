'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { ASSESSMENT_QUESTION_TYPES } = require('../../constants/learningConstants');

const QuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: Object.values(ASSESSMENT_QUESTION_TYPES),
      required: true,
    },
    options: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      correct: { type: Boolean, default: false },
    }],
    points: { type: Number, default: 1, min: 0 },
  },
  { _id: true }
);

const LearningAssessmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningCourse',
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    passScorePercent: { type: Number, default: 70, min: 0, max: 100 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    timeLimitMinutes: { type: Number, default: null },
    questions: { type: [QuestionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningAssessmentSchema.index({ organizationId: 1, courseId: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningAssessment', LearningAssessmentSchema));
