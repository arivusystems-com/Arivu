'use strict';

/**
 * Active auth sessions — platform/master only.
 *
 * JWT jti maps to sessionId. Must NOT be tenant-proxied: login/accept issue
 * sessions outside organizationIsolation, while protect validates before
 * tenant context is entered. wrapTenantModel would split create/read across
 * master vs tenant DBs for dedicated instances and surface as random 401s.
 *
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §11
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserSessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    authSessionVersion: {
      type: Number,
      default: 0
    },
    userType: {
      type: String,
      enum: ['STANDARD', 'ADMIN', 'EXTERNAL', 'INTERNAL', 'SYSTEM'],
      default: 'STANDARD'
    },
    deviceClass: {
      type: String,
      enum: ['desktop', 'mobile'],
      default: 'desktop',
      index: true
    },
    browser: { type: String, trim: true, default: null },
    os: { type: String, trim: true, default: null },
    uaHash: { type: String, trim: true, default: null, index: true },
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
    issuedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null, index: true }
  },
  { timestamps: false }
);

UserSessionSchema.index({ organizationId: 1, userId: 1, revokedAt: 1, issuedAt: -1 });
UserSessionSchema.index({ organizationId: 1, userId: 1, revokedAt: 1, deviceClass: 1 });

// Always the master mongoose connection (not wrapTenantModel).
module.exports = mongoose.model('UserSession', UserSessionSchema);
