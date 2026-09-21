'use strict';

const mongoose = require('mongoose');

/**
 * Platform-wide SaaS invoice PDF seller / payment copy + optional content-template link.
 * Layout: Content Platform template when linked/published; else PDFKit fallback.
 */
const CommercialInvoicePdfSettingsSchema = new mongoose.Schema({
  /** Singleton discriminator — always `default`. */
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default',
    trim: true,
  },
  legalName: { type: String, trim: true, default: '' },
  gstin: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  paymentInstructions: { type: String, trim: true, default: '' },
  bankDetails: { type: String, trim: true, default: '' },
  pan: { type: String, trim: true, default: '' },
  tagline: { type: String, trim: true, default: '' },
  website: { type: String, trim: true, default: '' },
  paymentTerms: { type: String, trim: true, default: '' },
  bankName: { type: String, trim: true, default: '' },
  accountName: { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  ifsc: { type: String, trim: true, default: '' },
  upiId: { type: String, trim: true, default: '' },
  /** Platform ContentTemplate for SaaS invoice layout (tenant = templateOrganizationId). */
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentTemplate',
    default: null,
  },
  templateOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  /** When false, force PDFKit even if a template is linked. */
  useContentTemplate: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updateReason: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'commercial_invoice_pdf_settings',
});

module.exports = mongoose.model('CommercialInvoicePdfSettings', CommercialInvoicePdfSettingsSchema);
