'use strict';

const CommercialInvoicePdfSettings = require('../../models/commercial/CommercialInvoicePdfSettings');
const {
  getCommercialInvoicePdfConfig,
  DEFAULT_PAYMENT_INSTRUCTIONS,
} = require('./commercialInvoicePdfService');

const SETTINGS_KEY = 'default';

const FIELD_KEYS = [
  'legalName',
  'gstin',
  'pan',
  'address',
  'email',
  'phone',
  'tagline',
  'website',
  'paymentTerms',
  'paymentInstructions',
  'bankDetails',
  'bankName',
  'accountName',
  'accountNumber',
  'ifsc',
  'upiId',
];

function trimField(value) {
  return String(value ?? '').trim();
}

/**
 * Merge DB overrides over env defaults. Non-empty DB fields win.
 */
function mergePdfConfig(stored, envCfg) {
  const base = envCfg || getCommercialInvoicePdfConfig();
  const out = { ...base };
  if (!stored) return out;
  for (const key of FIELD_KEYS) {
    const v = trimField(stored[key]);
    if (v) out[key] = v;
  }
  if (!out.legalName) out.legalName = 'Arivu';
  if (!out.paymentInstructions) out.paymentInstructions = DEFAULT_PAYMENT_INSTRUCTIONS;
  return out;
}

async function getStoredInvoicePdfSettings() {
  return CommercialInvoicePdfSettings.findOne({ key: SETTINGS_KEY }).lean();
}

/**
 * Effective seller/payment config for PDF render (DB → env → defaults).
 */
async function resolveCommercialInvoicePdfConfig() {
  const envCfg = getCommercialInvoicePdfConfig();
  const stored = await getStoredInvoicePdfSettings();
  return mergePdfConfig(stored, envCfg);
}

/**
 * Admin read: stored row + effective merged config + env baseline.
 */
async function getInvoicePdfSettingsForAdmin() {
  const envBaseline = getCommercialInvoicePdfConfig();
  const stored = await getStoredInvoicePdfSettings();
  const effective = mergePdfConfig(stored, envBaseline);
  return {
    stored: stored
      ? {
        legalName: stored.legalName || '',
        gstin: stored.gstin || '',
        pan: stored.pan || '',
        address: stored.address || '',
        email: stored.email || '',
        phone: stored.phone || '',
        tagline: stored.tagline || '',
        website: stored.website || '',
        paymentTerms: stored.paymentTerms || '',
        paymentInstructions: stored.paymentInstructions || '',
        bankDetails: stored.bankDetails || '',
        bankName: stored.bankName || '',
        accountName: stored.accountName || '',
        accountNumber: stored.accountNumber || '',
        ifsc: stored.ifsc || '',
        upiId: stored.upiId || '',
        templateId: stored.templateId ? String(stored.templateId) : null,
        templateOrganizationId: stored.templateOrganizationId
          ? String(stored.templateOrganizationId)
          : null,
        useContentTemplate: stored.useContentTemplate !== false,
        updatedAt: stored.updatedAt || null,
        updatedBy: stored.updatedBy || null,
        updateReason: stored.updateReason || '',
      }
      : null,
    envBaseline,
    effective,
  };
}

/**
 * Upsert platform PDF copy. Empty string clears DB override for that field (falls back to env).
 */
async function updateInvoicePdfSettings({
  legalName,
  gstin,
  pan,
  address,
  email,
  phone,
  tagline,
  website,
  paymentTerms,
  paymentInstructions,
  bankDetails,
  bankName,
  accountName,
  accountNumber,
  ifsc,
  upiId,
  reason,
  userId,
}) {
  const patch = {
    legalName: trimField(legalName),
    gstin: trimField(gstin),
    pan: trimField(pan),
    address: trimField(address),
    email: trimField(email),
    phone: trimField(phone),
    tagline: trimField(tagline),
    website: trimField(website),
    paymentTerms: trimField(paymentTerms),
    paymentInstructions: trimField(paymentInstructions),
    bankDetails: trimField(bankDetails),
    bankName: trimField(bankName),
    accountName: trimField(accountName),
    accountNumber: trimField(accountNumber),
    ifsc: trimField(ifsc),
    upiId: trimField(upiId),
    updateReason: trimField(reason),
    updatedBy: userId || null,
  };

  const doc = await CommercialInvoicePdfSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: patch, $setOnInsert: { key: SETTINGS_KEY } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const envBaseline = getCommercialInvoicePdfConfig();
  return {
    stored: {
      legalName: doc.legalName || '',
      gstin: doc.gstin || '',
      pan: doc.pan || '',
      address: doc.address || '',
      email: doc.email || '',
      phone: doc.phone || '',
      tagline: doc.tagline || '',
      website: doc.website || '',
      paymentTerms: doc.paymentTerms || '',
      paymentInstructions: doc.paymentInstructions || '',
      bankDetails: doc.bankDetails || '',
      bankName: doc.bankName || '',
      accountName: doc.accountName || '',
      accountNumber: doc.accountNumber || '',
      ifsc: doc.ifsc || '',
      upiId: doc.upiId || '',
      updatedAt: doc.updatedAt || null,
      updatedBy: doc.updatedBy || null,
      updateReason: doc.updateReason || '',
    },
    envBaseline,
    effective: mergePdfConfig(doc, envBaseline),
  };
}

module.exports = {
  SETTINGS_KEY,
  FIELD_KEYS,
  mergePdfConfig,
  resolveCommercialInvoicePdfConfig,
  getInvoicePdfSettingsForAdmin,
  updateInvoicePdfSettings,
};
