'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { COURSE_STATUSES } = require('../../constants/learningConstants');

const ProgramItemSchema = new mongoose.Schema(
  {
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const LearningProgramSchema = new mongoose.Schema(
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
    items: { type: [ProgramItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningProgramSchema.index({ organizationId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningProgram', LearningProgramSchema));
