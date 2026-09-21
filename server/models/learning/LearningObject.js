'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../../utils/tenantModelProxy');
const {
  LEARNING_OBJECT_TYPES,
  V1_LEARNING_OBJECT_TYPES,
} = require('../../constants/learningConstants');

const LearningObjectSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LearningModule',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(LEARNING_OBJECT_TYPES),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    /** VIDEO/DOCUMENT/SCORM entry URL; LTI tool URL */
    mediaUrl: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: null, min: 0 },
    /** LTI: ltiConsumerKey, ltiSharedSecret; SCORM: scormEntryUrl */
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

LearningObjectSchema.pre('validate', function validateV1Type(next) {
  if (this.type && !V1_LEARNING_OBJECT_TYPES.includes(this.type)) {
    // Allow stored future types but V1 create APIs restrict to V1 set.
  }
  next();
});

LearningObjectSchema.index({ organizationId: 1, moduleId: 1, sortOrder: 1 });

module.exports = wrapTenantModel(mongoose.model('LearningObject', LearningObjectSchema));
