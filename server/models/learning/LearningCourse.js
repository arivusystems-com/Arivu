'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { COURSE_STATUSES } = require('../../constants/learningConstants');

const LearningCourseSchema = new mongoose.Schema(
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
    publishedAt: { type: Date, default: null },
    estimatedMinutes: { type: Number, default: null, min: 0 },
    coverImageUrl: { type: String, default: null },
    /** App keys where this course surfaces (e.g. HELPDESK, SALES). Empty = explore-only. */
    contextAppKeys: {
      type: [{ type: String, trim: true, uppercase: true }],
      default: [],
    },
    /** Academy catalog visibility override (inherit = use tenant Academy config). */
    academyVisibility: {
      type: String,
      enum: ['inherit', 'assigned', 'audience', 'invite_only'],
      default: 'inherit',
    },
    /** When academyVisibility is audience (or effective audience), which audiences may see it. */
    academyAudiences: {
      type: [{ type: String, enum: ['customer', 'partner', 'external'] }],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningCourseSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
LearningCourseSchema.index({ organizationId: 1, status: 1, contextAppKeys: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningCourse', LearningCourseSchema));
