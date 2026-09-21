'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { COHORT_STATUSES } = require('../../constants/learningConstants');

const LearningCohortSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningProgram',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    memberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: Object.values(COHORT_STATUSES),
      default: COHORT_STATUSES.DRAFT,
      index: true,
    },
    launchedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningCohortSchema.index({ organizationId: 1, programId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningCohort', LearningCohortSchema));
