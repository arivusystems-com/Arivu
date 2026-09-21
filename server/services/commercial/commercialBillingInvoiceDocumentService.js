'use strict';

const mongoose = require('mongoose');
const ContentTemplate = require('../../models/ContentTemplate');
const ContentTemplateVersion = require('../../models/ContentTemplateVersion');
const Instance = require('../../models/Instance');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingInvoiceLine = require('../../models/commercial/BillingInvoiceLine');
const CommercialInvoicePdfSettings = require('../../models/commercial/CommercialInvoicePdfSettings');
const {
  MODULE_DOCUMENT_CONFIG,
  getModuleRenderMode,
  getModuleTemplateOverride,
} = require('../../constants/contentPlatformIntegration');
const {
  buildBillingInvoiceTemplateDefinition,
} = require('../../constants/contentTemplateSeeds');
const { assertValidTemplateDefinition } = require('../contentPlatform/contentTemplateValidationService');
const { renderTemplate } = require('../contentPlatform/contentRenderService');
const {
  isGrapesTemplateDefinition,
  hasRenderableGrapesTemplateContent,
} = require('../../constants/grapesTemplateDefinition');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const {
  resolveCommercialInvoicePdfConfig,
  SETTINGS_KEY,
} = require('./commercialInvoicePdfSettingsService');
const { amountInWordsInr } = require('../../utils/amountInWordsInr');
const {
  COMMERCIAL_TAX_INVOICE_SEED_TAG,
} = require('../../constants/commercialBillingInvoiceTemplateHtml');

const MODULE_KEY = 'billing_invoices';
const CONFIG = MODULE_DOCUMENT_CONFIG[MODULE_KEY];

function minorToMajor(paise) {
  return (Number(paise) || 0) / 100;
}

function formatLongDateIn(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatPeriodLabel(invoice) {
  if (!invoice?.periodStart || !invoice?.periodEnd) return '';
  const a = formatLongDateIn(invoice.periodStart);
  const b = formatLongDateIn(invoice.periodEnd);
  if (!a || !b) return '';
  return `${a} – ${b}`;
}

function resolveTaxLabel(invoice) {
  const details = invoice.taxDetails && typeof invoice.taxDetails === 'object'
    ? invoice.taxDetails
    : null;
  const name = (details?.name && String(details.name).trim()) || 'Tax';
  const ratePercent = details?.ratePercent != null
    ? Number(details.ratePercent)
    : (details?.rateBps != null ? Number(details.rateBps) / 100 : null);
  if (ratePercent != null && !Number.isNaN(ratePercent) && ratePercent > 0) {
    return `${name} (${ratePercent}%)`;
  }
  return name;
}

function resolveGstSplit(invoice) {
  const details = invoice.taxDetails && typeof invoice.taxDetails === 'object'
    ? invoice.taxDetails
    : null;
  const ratePercent = details?.ratePercent != null
    ? Number(details.ratePercent)
    : (details?.rateBps != null ? Number(details.rateBps) / 100 : 18);
  const half = Number.isFinite(ratePercent) && ratePercent > 0 ? ratePercent / 2 : 9;
  const taxMajor = minorToMajor(invoice.taxMinor);
  const halfTax = Math.round((taxMajor / 2) * 100) / 100;
  const otherHalf = Math.round((taxMajor - halfTax) * 100) / 100;
  return {
    cgstLabel: `CGST @ ${half}%`,
    sgstLabel: `SGST @ ${half}%`,
    cgstAmount: halfTax,
    sgstAmount: otherHalf,
  };
}

function formatCustomerAddress(billTo) {
  const addr = billTo?.billingAddress;
  if (addr && typeof addr === 'object') {
    return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function splitLineDescription(description) {
  const raw = String(description || '').trim();
  if (!raw) return { title: 'Item', subtitle: '' };
  const parts = raw.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    return { title: parts[0].trim(), subtitle: parts.slice(1).join(' — ').trim() };
  }
  return { title: raw, subtitle: '' };
}

function formatUnitPriceLabel(unitMajor, metadata = {}) {
  const amount = Number(unitMajor) || 0;
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const cadence = String(metadata.cadenceLabel || metadata.unitLabel || '').trim();
  if (cadence) return `${formatted} ${cadence}`;
  return formatted;
}

/**
 * Map BillingInvoice → Invoice-compatible merge scope (major currency units).
 */
async function buildBillingInvoiceRenderContext({ organizationId, invoiceId }) {
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId,
  }).lean();
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  const rawLines = await BillingInvoiceLine.find({ invoiceId: invoice._id }).lean();
  const billTo = invoice.snapshot?.billTo || {};
  const seller = await resolveCommercialInvoicePdfConfig();
  const gstSplit = resolveGstSplit(invoice);
  const amountDue = minorToMajor(
    Math.max(0, (invoice.totalMinor || 0) - (invoice.amountPaidMinor || 0))
  );

  const record = {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber || '',
    status: invoice.status || '',
    currency: invoice.currency || 'INR',
    customerName: billTo.companyName || '',
    customerGstin: billTo.gstin || '',
    customerEmail: billTo.billingEmail || '',
    customerPhone: billTo.billingPhone || '',
    customerAttn: billTo.contactName
      ? `Attn: ${billTo.contactName}`
      : (billTo.billingEmail ? `Attn: ${billTo.billingEmail}` : ''),
    customerAddress: formatCustomerAddress(billTo),
    dueDate: invoice.dueAt || null,
    finalizedAt: invoice.finalizedAt || null,
    invoiceDateLabel: formatLongDateIn(invoice.finalizedAt || invoice.createdAt),
    dueDateLabel: formatLongDateIn(invoice.dueAt),
    periodStart: invoice.periodStart || null,
    periodEnd: invoice.periodEnd || null,
    periodLabel: formatPeriodLabel(invoice),
    subtotal: minorToMajor(invoice.subtotalMinor),
    discountTotal: minorToMajor(invoice.discountMinor),
    creditApplied: minorToMajor(invoice.creditAppliedMinor),
    taxTotal: minorToMajor(invoice.taxMinor),
    taxLabel: resolveTaxLabel(invoice),
    ...gstSplit,
    grandTotal: minorToMajor(invoice.totalMinor),
    amountDue,
    amountInWords: amountInWordsInr(amountDue),
    billTo,
  };

  const lines = rawLines.map((line, index) => {
    const desc = line.description || line.productCode || 'Item';
    const { title, subtitle } = splitLineDescription(desc);
    const unitMajor = minorToMajor(line.unitAmountMinor);
    return {
      description: desc,
      title,
      subtitle: subtitle || String(line.metadata?.subtitle || '').trim(),
      name: title,
      index: index + 1,
      quantity: line.quantity || 0,
      unitPrice: unitMajor,
      unitPriceLabel: formatUnitPriceLabel(unitMajor, line.metadata || {}),
      lineTotal: minorToMajor(line.amountMinor),
      lineSubtotal: minorToMajor(line.amountMinor),
      discountMinor: line.discountMinor || 0,
      productCode: line.productCode || '',
    };
  });

  return { invoice, record, lines, seller };
}

/**
 * Platform org that owns the SaaS invoice ContentTemplate.
 */
async function resolvePlatformTemplateOrganizationId() {
  const fromEnv = String(process.env.COMMERCIAL_INVOICE_TEMPLATE_ORG_ID || '').trim();
  if (fromEnv && mongoose.Types.ObjectId.isValid(fromEnv)) {
    return fromEnv;
  }
  const internal = await Instance.findOne({ isInternal: true })
    .select('organizationId')
    .lean();
  if (internal?.organizationId) {
    return String(internal.organizationId);
  }
  throw new Error(
    'No platform template organization. Set COMMERCIAL_INVOICE_TEMPLATE_ORG_ID or mark an Instance isInternal.'
  );
}

function notDeletedFilter() {
  return { deletedAt: null };
}

async function findBillingInvoiceTemplate(organizationId) {
  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const overrideId = getModuleTemplateOverride(MODULE_KEY);
  if (overrideId) {
    const explicit = await ContentTemplate.findOne({
      _id: overrideId,
      organizationId: orgObjectId,
      ...notDeletedFilter(),
    }).lean();
    if (explicit) return explicit;
  }

  const bySettings = await CommercialInvoicePdfSettings.findOne({ key: SETTINGS_KEY })
    .select('templateId templateOrganizationId')
    .lean();
  if (
    bySettings?.templateId
    && String(bySettings.templateOrganizationId || '') === String(organizationId)
  ) {
    const linked = await ContentTemplate.findOne({
      _id: bySettings.templateId,
      organizationId: orgObjectId,
      ...notDeletedFilter(),
    }).lean();
    if (linked) return linked;
  }

  const publishedDefault = await ContentTemplate.findOne({
    organizationId: orgObjectId,
    moduleScope: CONFIG.moduleScope,
    purpose: CONFIG.purpose,
    isDefault: true,
    status: 'published',
    ...notDeletedFilter(),
  }).lean();
  if (publishedDefault) return publishedDefault;

  const published = await ContentTemplate.findOne({
    organizationId: orgObjectId,
    moduleScope: CONFIG.moduleScope,
    purpose: CONFIG.purpose,
    status: 'published',
    ...notDeletedFilter(),
  })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();
  if (published) return published;

  return ContentTemplate.findOne({
    organizationId: orgObjectId,
    tags: { $all: ['seed', CONFIG.seedKey] },
    ...notDeletedFilter(),
  }).lean();
}

/**
 * Ensure seeded platform SaaS invoice template exists; link on PDF settings.
 * Pass force=true to replace the published definition with the current seed (clears corrupted canvas).
 */
async function ensureCommercialBillingInvoiceTemplate({ userId = null, force = false } = {}) {
  const organizationId = await resolvePlatformTemplateOrganizationId();

  return runWithOrganizationTenantContext(organizationId, async () => {
    const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
    let template = await findBillingInvoiceTemplate(organizationId);
    const jsonDefinition = buildBillingInvoiceTemplateDefinition();
    assertValidTemplateDefinition(jsonDefinition);
    let reset = false;

    if (!template) {
      template = await ContentTemplate.create({
        organizationId: orgObjectId,
        name: 'Arivu SaaS Invoice — Default',
        description: 'Platform commercial BillingInvoice PDF (Arivu ops).',
        purpose: CONFIG.purpose,
        category: 'platform',
        moduleScope: CONFIG.moduleScope,
        outputFormat: 'pdf',
        paperSize: 'A4',
        orientation: 'portrait',
        status: 'published',
        latestVersion: 1,
        latestPublishedVersion: 1,
        isDefault: true,
        tags: ['seed', CONFIG.seedKey, 'platform', 'commercial-billing', COMMERCIAL_TAX_INVOICE_SEED_TAG],
      });

      await ContentTemplateVersion.create({
        organizationId: orgObjectId,
        templateId: template._id,
        version: 1,
        jsonDefinition,
        published: true,
        validationStatus: 'passed',
        releaseNotes: 'Initial platform SaaS invoice template',
        publishedAt: new Date(),
      });

      template.draftVersionId = null;
      await template.save();
      template = template.toObject ? template.toObject() : template;
      reset = true;
    } else {
      const published = template.latestPublishedVersion
        ? await ContentTemplateVersion.findOne({
          organizationId: orgObjectId,
          templateId: template._id,
          version: Number(template.latestPublishedVersion),
          published: true,
        }).lean()
        : null;
      const draft = template.draftVersionId
        ? await ContentTemplateVersion.findOne({
          _id: template.draftVersionId,
          organizationId: orgObjectId,
          templateId: template._id,
        }).lean()
        : null;
      const activeDefinition = draft?.jsonDefinition || published?.jsonDefinition;
      const tags = Array.isArray(template.tags) ? template.tags : [];
      const needsGrapesHeal = Boolean(force)
        || !isGrapesTemplateDefinition(activeDefinition)
        || !hasRenderableGrapesTemplateContent(activeDefinition)
        || !tags.includes(COMMERCIAL_TAX_INVOICE_SEED_TAG);

      if (needsGrapesHeal) {
        const nextVersion = Math.max(1, Number(template.latestVersion) || 1) + 1;
        await ContentTemplateVersion.create({
          organizationId: orgObjectId,
          templateId: template._id,
          version: nextVersion,
          jsonDefinition,
          published: true,
          validationStatus: 'passed',
          releaseNotes: force
            ? 'Force reset to Arivu commercial tax invoice seed'
            : 'Heal / upgrade Arivu commercial tax invoice seed',
          publishedAt: new Date(),
        });
        const nextTags = [...new Set([
          ...tags.filter((t) => !String(t).startsWith('tax-invoice-')),
          'seed',
          CONFIG.seedKey,
          'platform',
          'commercial-billing',
          COMMERCIAL_TAX_INVOICE_SEED_TAG,
        ])];
        await ContentTemplate.updateOne(
          { _id: template._id, organizationId: orgObjectId },
          {
            $set: {
              moduleScope: CONFIG.moduleScope,
              purpose: CONFIG.purpose,
              latestVersion: nextVersion,
              latestPublishedVersion: nextVersion,
              status: 'published',
              draftVersionId: null,
              tags: nextTags,
              name: 'Arivu SaaS Invoice — Default',
              description: 'Platform commercial BillingInvoice PDF (Arivu ops).',
            },
          }
        );
        template = await ContentTemplate.findById(template._id).lean();
        reset = true;
      } else if (template.moduleScope !== CONFIG.moduleScope) {
        await ContentTemplate.updateOne(
          { _id: template._id, organizationId: orgObjectId },
          { $set: { moduleScope: CONFIG.moduleScope, purpose: CONFIG.purpose } }
        );
        template = { ...template, moduleScope: CONFIG.moduleScope };
      }
    }

    await CommercialInvoicePdfSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      {
        $set: {
          templateId: template._id,
          templateOrganizationId: orgObjectId,
          updatedBy: userId || null,
        },
        $setOnInsert: { key: SETTINGS_KEY },
      },
      { upsert: true, new: true }
    );

    return {
      templateId: String(template._id),
      templateOrganizationId: String(organizationId),
      status: template.status,
      latestPublishedVersion: template.latestPublishedVersion || null,
      builderPath: `/templates/${template._id}/builder`,
      name: template.name || 'Arivu SaaS Invoice',
      reset,
    };
  });
}

function shouldUseContentTemplate(stored) {
  const mode = getModuleRenderMode(MODULE_KEY);
  if (mode === 'legacy') {
    // Unset env defaults to legacy — still allow auto when a published template is linked
    // unless explicitly forced: CONTENT_PLATFORM_BILLING_INVOICES_MODE=legacy with FORCE
    const raw = String(process.env.CONTENT_PLATFORM_BILLING_INVOICES_MODE || '').trim().toLowerCase();
    if (raw === 'legacy') return { use: false, mode: 'legacy' };
  }
  if (!stored?.templateId || !stored?.templateOrganizationId) {
    return { use: false, mode };
  }
  if (stored.useContentTemplate === false) {
    return { use: false, mode };
  }
  return { use: true, mode: mode === 'legacy' ? 'platform' : mode };
}

/**
 * Render via Content Platform when a published platform template is linked; else null.
 */
async function tryRenderCommercialInvoiceViaContentPlatform({
  organizationId,
  invoiceId,
}) {
  const stored = await CommercialInvoicePdfSettings.findOne({ key: SETTINGS_KEY }).lean();
  const decision = shouldUseContentTemplate(stored);
  if (!decision.use) return null;

  const templateOrgId = String(stored.templateOrganizationId);
  const templateId = String(stored.templateId);

  const { invoice, record, lines, seller } = await buildBillingInvoiceRenderContext({
    organizationId,
    invoiceId,
  });

  const sellerForMerge = {
    ...seller,
  };

  const result = await runWithOrganizationTenantContext(templateOrgId, async () => {
    const template = await ContentTemplate.findOne({
      _id: templateId,
      organizationId: templateOrgId,
      ...notDeletedFilter(),
    }).lean();
    if (!template) {
      throw new Error('Commercial invoice content template not found');
    }
    if (template.status !== 'published' && !template.latestPublishedVersion) {
      throw new Error('Commercial invoice content template is not published');
    }

    return renderTemplate({
      organizationId: templateOrgId,
      templateId: template._id,
      outputFormat: 'pdf',
      preview: false,
      persistOutput: false,
      runtimeContext: {
        recordModuleKey: MODULE_KEY,
        recordId: String(invoiceId),
        record,
        lines,
        sections: [],
        Seller: sellerForMerge,
        parameters: {
          currencyDisplay: 'symbol',
        },
      },
    });
  });

  if (!result?.buffer || !Buffer.isBuffer(result.buffer)) {
    throw new Error('Content platform render did not return a PDF buffer');
  }

  return {
    buffer: result.buffer,
    invoiceNumber: invoice.invoiceNumber,
    mode: decision.mode,
  };
}

module.exports = {
  MODULE_KEY,
  minorToMajor,
  buildBillingInvoiceRenderContext,
  resolvePlatformTemplateOrganizationId,
  ensureCommercialBillingInvoiceTemplate,
  tryRenderCommercialInvoiceViaContentPlatform,
  shouldUseContentTemplate,
  findBillingInvoiceTemplate,
};
