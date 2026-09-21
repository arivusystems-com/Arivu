'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const { CERTIFICATE_STATUSES } = require('../../constants/learningConstants');

const LearningCertificateSchema = new mongoose.Schema(
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
    },
    pathId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningPath',
      default: null,
    },
    credentialId: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(CERTIFICATE_STATUSES),
      default: CERTIFICATE_STATUSES.ISSUED,
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

LearningCertificateSchema.index({ organizationId: 1, credentialId: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('LearningCertificate', LearningCertificateSchema));
