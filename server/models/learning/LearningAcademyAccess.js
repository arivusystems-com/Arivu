'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { ACADEMY_ACCESS_STATUSES } = require('../../constants/learningConstants');

/**
 * Learning Academy access lifecycle for EXTERNAL learners.
 * Revoke/suspend without deleting People.
 */
const LearningAcademyAccessSchema = new mongoose.Schema(
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
    peopleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'People',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ACADEMY_ACCESS_STATUSES),
      default: ACADEMY_ACCESS_STATUSES.INVITED,
      index: true,
    },
    invitedAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    restoredAt: { type: Date, default: null },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningAcademyAccessSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true }
);
LearningAcademyAccessSchema.index({ organizationId: 1, status: 1 });

module.exports = wrapTenantModel(
  mongoose.model('LearningAcademyAccess', LearningAcademyAccessSchema)
);
