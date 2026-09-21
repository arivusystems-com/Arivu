'use strict';

const mongoose = require('mongoose');
const Organization = require('../../../models/Organization');
const User = require('../../../models/User');
const People = require('../../../models/People');
const Quote = require('../../../models/Quote');
const QuoteLine = require('../../../models/QuoteLine');
const QuoteSection = require('../../../models/QuoteSection');
const Invoice = require('../../../models/Invoice');
const InvoiceLine = require('../../../models/InvoiceLine');
const InvoiceSection = require('../../../models/InvoiceSection');
const Item = require('../../../models/Item');
const ItemVariant = require('../../../models/ItemVariant');
const { normalizeRecordForMergeTags } = require('../../../utils/mergeTagRecordNormalizer');
const { ORGANIZATION_MERGE_SELECT, loadCrmOrganizationById } = require('../../../utils/crmOrganizationLoader');
const { resolveMergeTagModuleAlias } = require('../../../utils/mergeTagModuleAliases');
const { loadMergeTagRelatedRecords } = require('./mergeTagRelatedRecords');
const relationshipResolver = require('../../relationshipResolver');

const COMMERCIAL_PREVIEW_MODULES = new Set(['quotes', 'invoices', 'billing_invoices', 'sales_orders']);

const COMMERCIAL_MODULE_KEYS = new Set(['quotes', 'invoices', 'billing_invoices', 'sales_orders']);

const RECORD_LOADERS = {
  quotes: loadQuoteContext,
  invoices: loadInvoiceContext,
  billing_invoices: loadBillingInvoiceContext,
  people: loadPeopleContext,
  purchase_returns: loadPurchaseReturnContext
};

function capitalizeModuleKey(moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!key) return 'Record';
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isTenantOrganization(org) {
  return Boolean(org && typeof org === 'object' && org.isTenant === true);
}

function pickCustomerOrganization(record) {
  const ref = record?.organizationRefId;
  if (ref && typeof ref === 'object' && ref.name && !isTenantOrganization(ref)) {
    return ref;
  }
  return null;
}

/**
 * Resolve populated or ID-only CRM organization refs on commercial / people records.
 * @param {unknown} orgRef
 * @param {string} tenantOrganizationId
 */
async function resolveCrmOrganizationRef(orgRef, tenantOrganizationId) {
  if (!orgRef) return null;
  if (typeof orgRef === 'object' && orgRef._id && orgRef.name && !isTenantOrganization(orgRef)) {
    return orgRef;
  }
  const id = typeof orgRef === 'object' && orgRef._id ? orgRef._id : orgRef;

  const accessible = await loadCrmOrganizationById(tenantOrganizationId, id);
  if (accessible) return accessible;

  // Document-linked CRM org: allow merge resolution when the commercial record already references it.
  const objectId = toObjectId(id);
  if (!objectId) return null;

  return Organization.findOne({
    _id: objectId,
    isTenant: { $ne: true },
    deletedAt: null
  })
    .select(ORGANIZATION_MERGE_SELECT)
    .lean();
}

function normalizeObjectIdString(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function toObjectId(value) {
  const id = normalizeObjectIdString(value);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

/**
 * Convert catalog rich-text description HTML into plain text for PDF merge tags.
 * @param {unknown} value
 */
function plainTextFromRichDescription(value) {
  const raw = String(value ?? '');
  if (!raw.trim()) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {object | null | undefined} item
 */
function resolveCatalogItemDescription(item) {
  if (!item || typeof item !== 'object') return '';

  const direct = plainTextFromRichDescription(item.description);
  if (direct) return direct;

  const custom = plainTextFromRichDescription(item.customFields?.description);
  if (custom) return custom;

  const versions = Array.isArray(item.descriptionVersions) ? item.descriptionVersions : [];
  const sorted = versions
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  for (const version of sorted) {
    const text = plainTextFromRichDescription(version?.content);
    if (text) return text;
  }

  return '';
}

function normalizeLine(line) {
  const doc = line && typeof line.toObject === 'function' ? line.toObject() : line;
  const unitPrice = doc.unitPrice ?? doc.unitPriceSnapshot ?? doc.listPriceSnapshot ?? 0;
  const liveDescription = plainTextFromRichDescription(doc.liveItemDescription || '');
  const snapshotDescription = plainTextFromRichDescription(doc.descriptionSnapshot || doc.description || '');
  const itemName = doc.itemNameSnapshot || doc.nameSnapshot || doc.name || '';
  const qty = doc.quantity ?? doc.quantityReturned ?? doc.quantityOrdered ?? 0;

  return {
    ...doc,
    description: liveDescription || snapshotDescription || itemName || '',
    name: itemName,
    skuSnapshot: doc.skuSnapshot || doc.sku || '',
    unitPrice,
    quantity: qty,
    quantityReturned: doc.quantityReturned ?? qty,
    returnReason: doc.returnReason || '',
    lineTotal: doc.lineTotal ?? doc.lineSubtotal ?? 0,
    lineSubtotal: doc.lineSubtotal ?? doc.lineTotal ?? 0
  };
}

/**
 * Resolve current catalog Item.description for document lines at render time.
 * @param {string} organizationId
 * @param {Array<object>} lines
 */
async function enrichLinesWithLiveItemCatalog(organizationId, lines) {
  if (!organizationId || !Array.isArray(lines) || lines.length === 0) {
    return Array.isArray(lines) ? lines : [];
  }

  const variantObjectIds = [
    ...new Set(
      lines
        .map((line) => toObjectId(line?.variantId))
        .filter(Boolean)
        .map((id) => String(id))
    )
  ].map((id) => toObjectId(id)).filter(Boolean);

  if (!variantObjectIds.length) return lines;

  const orgObjectId = toObjectId(organizationId) || organizationId;

  const variants = await ItemVariant.find({
    _id: { $in: variantObjectIds },
    organizationId: orgObjectId
  })
    .select('_id itemId')
    .lean();

  if (!variants.length) return lines;

  const variantToItemId = new Map(
    variants.map((variant) => [String(variant._id), normalizeObjectIdString(variant.itemId)])
  );

  const itemObjectIds = [...new Set([...variantToItemId.values()].filter(Boolean))]
    .map((id) => toObjectId(id))
    .filter(Boolean);
  if (!itemObjectIds.length) return lines;

  const items = await Item.find({
    _id: { $in: itemObjectIds },
    organizationId: orgObjectId,
    deletedAt: null
  })
    .select('description customFields.description descriptionVersions')
    .lean();

  const itemById = new Map(items.map((item) => [String(item._id), item]));

  return lines.map((line) => {
    const variantId = normalizeObjectIdString(line?.variantId);
    const itemId = variantToItemId.get(variantId);
    const item = itemId ? itemById.get(itemId) : null;
    if (!item) return line;

    const liveDescription = resolveCatalogItemDescription(item);
    if (!liveDescription) return line;

    return {
      ...line,
      liveItemDescription: liveDescription
    };
  });
}

async function normalizeLinesForRender(organizationId, lines) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const enriched = await enrichLinesWithLiveItemCatalog(organizationId, lines);
  return enriched.map(normalizeLine);
}

function normalizeQuoteRecord(quote) {
  if (!quote) return null;
  const customerOrganization = pickCustomerOrganization(quote);

  return {
    ...quote,
    quoteNumber: quote.quoteNumber ?? '',
    grandTotal: quote.grandTotal ?? 0,
    subtotal: quote.subtotal ?? 0,
    taxTotal: quote.taxTotal ?? 0,
    currency: quote.currency ?? 'USD',
    customerName: customerOrganization?.name ?? quote.customerName ?? '',
    customerOrganization
  };
}

function normalizeInvoiceRecord(invoice) {
  if (!invoice) return null;
  const customerOrganization = pickCustomerOrganization(invoice);

  return {
    ...invoice,
    invoiceNumber: invoice.invoiceNumber ?? '',
    amountDue: invoice.amountDue ?? invoice.grandTotal ?? 0,
    grandTotal: invoice.grandTotal ?? 0,
    dueDate: invoice.dueDate ?? null,
    currency: invoice.currency ?? 'USD',
    customerName: customerOrganization?.name ?? invoice.customerName ?? '',
    customerOrganization
  };
}

async function loadQuoteContext({ organizationId, recordId }) {
  const quote = await Quote.findOne({ _id: recordId, organizationId })
    .populate({ path: 'organizationRefId', select: ORGANIZATION_MERGE_SELECT })
    .populate({
      path: 'contactId',
      select: 'first_name last_name email phone mobile title organization',
      populate: { path: 'organization', select: ORGANIZATION_MERGE_SELECT }
    })
    .populate({
      path: 'dealId',
      select: 'name accountId',
      populate: { path: 'accountId', select: ORGANIZATION_MERGE_SELECT }
    })
    .populate({ path: 'caseId', select: 'subject case_number status priority' })
    .lean();
  if (!quote) return null;

  const lines = await QuoteLine.find({ organizationId, quoteId: recordId })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  const sections = await QuoteSection.find({ organizationId, quoteId: recordId, hiddenSection: { $ne: true } })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  return {
    record: normalizeQuoteRecord(quote),
    lines,
    sections,
    moduleKey: 'quotes'
  };
}

async function loadInvoiceContext({ organizationId, recordId }) {
  const invoice = await Invoice.findOne({ _id: recordId, organizationId, deletedAt: null })
    .populate({ path: 'organizationRefId', select: ORGANIZATION_MERGE_SELECT })
    .populate({
      path: 'contactId',
      select: 'first_name last_name email phone mobile title organization',
      populate: { path: 'organization', select: ORGANIZATION_MERGE_SELECT }
    })
    .lean();
  if (!invoice) return null;

  const lines = await InvoiceLine.find({ organizationId, invoiceId: recordId })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  const sections = await InvoiceSection.find({ organizationId, invoiceId: recordId, hiddenSection: { $ne: true } })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  return {
    record: normalizeInvoiceRecord(invoice),
    lines,
    sections,
    moduleKey: 'invoices'
  };
}

/**
 * Platform SaaS BillingInvoice — lookup by id (template org ≠ customer org).
 */
async function loadBillingInvoiceContext({ recordId }) {
  const {
    buildBillingInvoiceRenderContext,
  } = require('../../commercial/commercialBillingInvoiceDocumentService');
  const BillingInvoice = require('../../../models/commercial/BillingInvoice');
  const invoice = await BillingInvoice.findById(recordId).lean();
  if (!invoice) return null;
  const ctx = await buildBillingInvoiceRenderContext({
    organizationId: invoice.organizationId,
    invoiceId: invoice._id,
  });
  return {
    record: ctx.record,
    lines: ctx.lines,
    sections: [],
    moduleKey: 'billing_invoices',
    seller: ctx.seller,
  };
}

async function loadPeopleContext({ organizationId, recordId }) {
  const person = await People.findOne({ _id: recordId, organizationId, deletedAt: null })
    .populate({ path: 'organization', select: ORGANIZATION_MERGE_SELECT })
    .select('first_name last_name email phone mobile title organization')
    .lean();
  if (!person) return null;

  return {
    record: person,
    lines: [],
    moduleKey: 'people'
  };
}

async function loadPurchaseReturnContext({ organizationId, recordId }) {
  const { PurchaseReturn, PurchaseReturnLine } = require('../../../models/PurchaseReturn');
  const purchaseReturn = await PurchaseReturn.findOne({
    _id: recordId,
    organizationId,
    deletedAt: null
  })
    .populate({ path: 'vendorId', select: ORGANIZATION_MERGE_SELECT })
    .populate({
      path: 'vendorContactId',
      select: 'first_name last_name firstName lastName email phone mobile'
    })
    .lean();
  if (!purchaseReturn) return null;

  const lines = await PurchaseReturnLine.find({ organizationId, purchaseReturnId: recordId })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  const vendor =
    purchaseReturn.vendorId && typeof purchaseReturn.vendorId === 'object'
      ? purchaseReturn.vendorId
      : null;

  return {
    record: {
      ...purchaseReturn,
      purchaseReturnNumber: purchaseReturn.purchaseReturnNumber ?? '',
      subject: purchaseReturn.subject ?? '',
      grandTotal: purchaseReturn.grandTotal ?? 0,
      subtotal: purchaseReturn.subtotal ?? 0,
      currency: purchaseReturn.currency ?? 'USD',
      returnReason: purchaseReturn.returnReason ?? '',
      // Prefer vendor on Organization alias for return docs
      customerOrganization: vendor
    },
    lines,
    sections: [],
    moduleKey: 'purchase_returns'
  };
}

const PREVIEW_LINE_COLLECTION_MODULES = new Set([
  'quotes',
  'invoices',
  'billing_invoices',
  'sales_orders',
  'purchase_returns'
]);

const PREVIEW_SAMPLE_LINES = [
  {
    description: 'Professional services',
    title: 'Professional services',
    subtitle: 'Platform administration and account management',
    index: 1,
    quantity: 10,
    unitPrice: 100,
    unitPriceLabel: '100 / month',
    lineTotal: 1000,
    lineSubtotal: 1000,
    name: 'Professional services',
    skuSnapshot: 'SKU-001',
    quoteSectionId: 'preview-s1'
  },
  {
    description: 'Support package',
    title: 'Support package',
    subtitle: 'Access to applications',
    index: 2,
    quantity: 1,
    unitPrice: 250,
    unitPriceLabel: '250 / month',
    lineTotal: 250,
    lineSubtotal: 250,
    name: 'Support package',
    skuSnapshot: 'SKU-002',
    quoteSectionId: 'preview-s2'
  }
];

const PREVIEW_SAMPLE_SECTIONS = [
  {
    _id: 'preview-s1',
    sectionTitle: 'Products',
    sectionType: 'standard',
    sectionOrder: 0,
    showSectionTotal: true,
    sectionSubtotal: 1000,
    sectionTotal: 1000,
    sectionDiscountTotal: 0
  },
  {
    _id: 'preview-s2',
    sectionTitle: 'Services',
    sectionType: 'standard',
    sectionOrder: 1,
    showSectionTotal: true,
    sectionSubtotal: 250,
    sectionTotal: 250,
    sectionDiscountTotal: 0
  }
];

function buildPreviewSampleRecord(moduleKey, tenantOrganization) {
  const key = String(moduleKey || '').trim().toLowerCase();
  const orgName = tenantOrganization?.name || 'Sample Organization';

  const byModule = {
    quotes: {
      quoteNumber: 'QT-PREVIEW-001',
      grandTotal: 1250,
      subtotal: 1000,
      taxTotal: 250,
      currency: 'USD',
      customerName: orgName,
      status: 'Draft'
    },
    invoices: {
      invoiceNumber: 'INV-PREVIEW-001',
      amountDue: 1250,
      grandTotal: 1250,
      subtotal: 1000,
      taxTotal: 250,
      currency: 'USD',
      customerName: orgName,
      dueDate: new Date().toISOString(),
      status: 'Sent'
    },
    billing_invoices: {
      invoiceNumber: 'ARV-PREVIEW-00001',
      amountDue: 4004.92,
      grandTotal: 4004.92,
      subtotal: 3394,
      taxTotal: 610.92,
      taxLabel: 'GST (18%)',
      cgstLabel: 'CGST @ 9%',
      sgstLabel: 'SGST @ 9%',
      cgstAmount: 305.46,
      sgstAmount: 305.46,
      currency: 'INR',
      customerName: orgName,
      customerAttn: 'Attn: Billing Contact',
      customerAddress: 'Bengaluru, Karnataka, India',
      customerGstin: '29AAAAA0000A1Z5',
      invoiceDateLabel: '18 September 2026',
      dueDateLabel: '18 October 2026',
      periodLabel: '18 September 2026 – 17 October 2026',
      amountInWords: 'Indian Rupees Four Thousand Four and Ninety Two Paise Only.',
      dueDate: new Date().toISOString(),
      status: 'finalized'
    },
    sales_orders: {
      orderNumber: 'SO-PREVIEW-001',
      grandTotal: 850,
      subtotal: 750,
      taxTotal: 100,
      currency: 'USD',
      customerName: orgName,
      status: 'Draft'
    },
    deals: {
      name: 'Sample Deal',
      amount: 50000,
      stage: 'Proposal',
      status: 'Open'
    },
    cases: {
      subject: 'Sample case',
      status: 'Open',
      case_number: 'CASE-PREVIEW-001'
    },
    people: {
      first_name: 'Sample',
      last_name: 'Contact',
      email: 'contact@example.com',
      full_name: 'Sample Contact'
    },
    organizations: {
      name: orgName,
      industry: tenantOrganization?.industry || 'Technology',
      email: 'billing@example.com'
    },
    cases: {
      subject: 'Sample case',
      status: 'Open',
      case_number: 'CASE-PREVIEW-001'
    },
    tasks: {
      title: 'Sample task',
      status: 'Open',
      priority: 'Normal'
    }
  };

  return byModule[key] || {
    name: 'Sample Record',
    title: 'Sample Record',
    status: 'Draft'
  };
}

/**
 * Resolve related contact (People) from a commercial document record.
 * @param {object} params
 * @param {string} params.organizationId
 * @param {object | null} params.record
 */
async function resolveRelatedPeople({ organizationId, record }) {
  if (!record) return null;

  const tenantOrgObjectId = toObjectId(organizationId) || organizationId;

  const contactRef = record.contactId;
  if (contactRef && typeof contactRef === 'object' && contactRef._id) {
    if (Object.prototype.hasOwnProperty.call(contactRef, 'organization')) {
      return contactRef;
    }
    if (!toObjectId(organizationId)) {
      return contactRef;
    }
    return People.findOne({ _id: contactRef._id, organizationId: tenantOrgObjectId, deletedAt: null })
      .populate({ path: 'organization', select: ORGANIZATION_MERGE_SELECT })
      .select('first_name last_name email phone mobile title organization')
      .lean();
  }

  const contactId = contactRef || record.contact?._id;
  if (!contactId) return null;
  if (!toObjectId(organizationId)) {
    return null;
  }

  return People.findOne({ _id: contactId, organizationId: tenantOrgObjectId, deletedAt: null })
    .populate({ path: 'organization', select: ORGANIZATION_MERGE_SELECT })
    .select('first_name last_name email phone mobile title organization')
    .lean();
}

/**
 * Resolve customer CRM organization linked via module relationships.
 * @param {object} params
 */
async function resolveOrganizationViaRelationships({ organizationId, recordModuleKey, record }) {
  if (!record?._id) return null;

  const moduleKey = String(recordModuleKey || '').trim().toLowerCase();
  const appKey = moduleKey === 'people' ? 'sales' : 'platform';

  let groups = [];
  try {
    groups = await relationshipResolver.getRelatedRecords(
      organizationId,
      appKey,
      moduleKey,
      record._id
    );
  } catch {
    return null;
  }

  for (const group of groups) {
    for (const related of group.records || []) {
      const relatedModuleKey = String(related?.moduleKey || '').trim().toLowerCase();
      if (relatedModuleKey !== 'organizations' && relatedModuleKey !== 'organization') continue;
      // eslint-disable-next-line no-await-in-loop
      const loaded = await resolveCrmOrganizationRef(related.recordId, organizationId);
      if (loaded) return loaded;
    }
  }

  return null;
}

function buildPreviewCustomerOrganizationFallback(record) {
  const name = String(record?.customerName || '').trim();
  if (!name) return null;
  return { name };
}

/**
 * Resolve the customer / related CRM organization for merge tags.
 * Priority: document organizationRefId → customerId → deal.accountId → contact.organization → relationships → customerName.
 * @param {object} params
 */
async function resolveRelatedOrganization({ organizationId, record, relatedPeople = null, recordModuleKey = '' }) {
  if (!record) return null;

  const fromCustomer = pickCustomerOrganization(record);
  if (fromCustomer) return fromCustomer;

  const fromDocumentRef = await resolveCrmOrganizationRef(record.organizationRefId, organizationId);
  if (fromDocumentRef) return fromDocumentRef;

  const fromVendorId = await resolveCrmOrganizationRef(record.vendorId, organizationId);
  if (fromVendorId) return fromVendorId;

  const fromCustomerId = await resolveCrmOrganizationRef(record.customerId, organizationId);
  if (fromCustomerId) return fromCustomerId;

  const dealAccountRef = record.dealId?.accountId ?? record.deal?.accountId ?? null;
  const fromDealAccount = await resolveCrmOrganizationRef(dealAccountRef, organizationId);
  if (fromDealAccount) return fromDealAccount;

  const personOrgRef = record.organization ?? relatedPeople?.organization ?? null;
  const fromPerson = await resolveCrmOrganizationRef(personOrgRef, organizationId);
  if (fromPerson) return fromPerson;

  const fromRelationships = await resolveOrganizationViaRelationships({
    organizationId,
    recordModuleKey,
    record
  });
  if (fromRelationships) return fromRelationships;

  return buildPreviewCustomerOrganizationFallback(record);
}

/**
 * @param {object} params
 */
async function assembleRuntimeContext(params) {
  const {
    organizationId,
    userId = null,
    moduleScope = '',
    preview = false,
    runtimeContext = {}
  } = params;

  const parameters = runtimeContext.parameters && typeof runtimeContext.parameters === 'object'
    ? { ...runtimeContext.parameters }
    : {};

  let record = runtimeContext.record || null;
  let lines = Array.isArray(runtimeContext.lines) ? runtimeContext.lines : [];
  let sections = Array.isArray(runtimeContext.sections) ? runtimeContext.sections : [];
  let recordLoadAttempted = false;
  const recordModuleKey = String(
    runtimeContext.recordModuleKey || moduleScope || ''
  ).toLowerCase();

  if (!record && runtimeContext.recordId && RECORD_LOADERS[recordModuleKey]) {
    recordLoadAttempted = true;
    const recordObjectId = toObjectId(runtimeContext.recordId);
    if (recordObjectId) {
      const loaded = await RECORD_LOADERS[recordModuleKey]({
        organizationId,
        recordId: recordObjectId,
        runtimeContext
      });
      if (loaded) {
        record = loaded.record;
        lines = loaded.lines;
        sections = loaded.sections || [];
        if (loaded.seller && !runtimeContext.Seller) {
          runtimeContext.Seller = loaded.seller;
        }
      }
    }
  }

  if (Array.isArray(lines) && lines.length) {
    lines = await normalizeLinesForRender(organizationId, lines);
  }

  if (
    preview
    && !sections.length
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && (runtimeContext.usePreviewSample === true || !runtimeContext.recordId)
  ) {
    sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
  }

  const [tenantOrganization, currentUser] = await Promise.all([
    runtimeContext.organization
      ? Promise.resolve(runtimeContext.organization)
      : Organization.findById(organizationId).select(`${ORGANIZATION_MERGE_SELECT} settings.logoUrl`).lean(),
    userId && !runtimeContext.currentUser
      ? User.findById(userId).select('firstName lastName email username').lean()
      : Promise.resolve(runtimeContext.currentUser || null)
  ]);

  if (
    !record
    && recordModuleKey
    && (runtimeContext.usePreviewSample === true || (preview && !runtimeContext.recordId))
  ) {
    record = buildPreviewSampleRecord(recordModuleKey, tenantOrganization);
    if (!lines.length && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)) {
      lines = PREVIEW_SAMPLE_LINES.map(normalizeLine);
    }
    if (!sections.length && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)) {
      sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
    }
  }

  if (
    preview
    && recordModuleKey
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && !lines.length
    && (runtimeContext.usePreviewSample === true || !runtimeContext.recordId)
  ) {
    lines = PREVIEW_SAMPLE_LINES.map(normalizeLine);
  }

  if (
    preview
    && recordModuleKey
    && PREVIEW_LINE_COLLECTION_MODULES.has(recordModuleKey)
    && !sections.length
    && (runtimeContext.usePreviewSample === true || !runtimeContext.recordId)
  ) {
    sections = PREVIEW_SAMPLE_SECTIONS.map((section) => ({ ...section }));
  }

  if (
    preview
    && runtimeContext.recordId
    && !record
    && recordModuleKey
    && !RECORD_LOADERS[recordModuleKey]
  ) {
    record = buildPreviewSampleRecord(recordModuleKey, tenantOrganization);
  }

  if (recordModuleKey === 'quotes' && record) {
    record = normalizeQuoteRecord(record);
  } else if (recordModuleKey === 'invoices' && record) {
    record = normalizeInvoiceRecord(record);
  }

  const relatedPeople = await resolveRelatedPeople({ organizationId, record });

  let relatedOrganization = await resolveRelatedOrganization({
    organizationId,
    record,
    relatedPeople,
    recordModuleKey
  });

  if (
    !relatedOrganization
    && preview
    && recordModuleKey === 'people'
    && (runtimeContext.usePreviewSample === true || !runtimeContext.recordId)
  ) {
    relatedOrganization = buildPreviewSampleRecord('organizations', tenantOrganization);
  }

  if (relatedOrganization && record && (recordModuleKey === 'quotes' || recordModuleKey === 'invoices')) {
    if (recordModuleKey === 'quotes') {
      record = normalizeQuoteRecord({ ...record, organizationRefId: relatedOrganization });
    } else {
      record = normalizeInvoiceRecord({ ...record, organizationRefId: relatedOrganization });
    }
  }

  const customerOrganization = relatedOrganization || record?.customerOrganization || null;
  const documentOrganization =
    recordModuleKey === 'people'
      ? (relatedOrganization || {})
      : COMMERCIAL_MODULE_KEYS.has(recordModuleKey)
        ? (customerOrganization || {})
        : (customerOrganization || tenantOrganization || {});

  if (record?.currency && !parameters.currency) {
    parameters.currency = record.currency;
  }

  const moduleAlias = capitalizeModuleKey(recordModuleKey || moduleScope);
  const now = new Date();

  const scope = {
    Record: record || {},
    Organization: documentOrganization,
    CustomerOrganization: customerOrganization || {},
    CurrentUser: currentUser || {},
    CurrentOrganization: tenantOrganization || {},
    CurrentTenant: tenantOrganization || {},
    System: {
      Today: now.toISOString().slice(0, 10),
      Now: now.toISOString(),
      PageCount: 1
    },
    lines,
    sections,
    parameters,
    recordModuleKey,
    record: record || {},
    organization: documentOrganization,
    currentUser: currentUser || {},
    recordLoadAttempted,
    recordLoadSucceeded: Boolean(record && record._id)
  };

  if (moduleAlias && record) {
    scope[moduleAlias] = record;
  }

  if (recordModuleKey === 'quotes' && record) scope.Quote = record;
  if (recordModuleKey === 'invoices' && record) scope.Invoice = record;
  if (recordModuleKey === 'billing_invoices' && record) {
    scope.Invoice = record;
    scope.BillingInvoice = record;
  }
  if (recordModuleKey === 'people' && record) scope.People = record;

  if (runtimeContext.Seller && typeof runtimeContext.Seller === 'object') {
    scope.Seller = normalizeRecordForMergeTags(runtimeContext.Seller);
  } else if (recordModuleKey === 'billing_invoices') {
    // Always prefer Control → PDF settings (DB → env), never invent seller identity here.
    try {
      const {
        resolveCommercialInvoicePdfConfig,
      } = require('../../commercial/commercialInvoicePdfSettingsService');
      const seller = await resolveCommercialInvoicePdfConfig();
      scope.Seller = normalizeRecordForMergeTags(seller);
    } catch {
      scope.Seller = normalizeRecordForMergeTags({});
    }
  }

  if (relatedPeople) {
    scope.People = relatedPeople;
  } else if (runtimeContext.usePreviewSample === true && recordModuleKey && recordModuleKey !== 'people') {
    scope.People = buildPreviewSampleRecord('people', tenantOrganization);
  }

  const relatedModuleScope = await loadMergeTagRelatedRecords({
    organizationId,
    moduleKey: recordModuleKey,
    record,
    preview
  });

  for (const [alias, data] of Object.entries(relatedModuleScope)) {
    if (scope[alias] && Object.keys(scope[alias]).length > 0) continue;
    scope[alias] = data;
  }

  scope.Organization = normalizeRecordForMergeTags(scope.Organization);
  scope.CustomerOrganization = normalizeRecordForMergeTags(scope.CustomerOrganization);
  scope.CurrentOrganization = normalizeRecordForMergeTags(scope.CurrentOrganization);
  if (tenantOrganization?.settings?.logoUrl) {
    scope.CurrentOrganization.logoUrl = tenantOrganization.settings.logoUrl;
    scope.CurrentOrganization.settings = {
      ...(scope.CurrentOrganization.settings && typeof scope.CurrentOrganization.settings === 'object'
        ? scope.CurrentOrganization.settings
        : {}),
      logoUrl: tenantOrganization.settings.logoUrl
    };
  }
  scope.CurrentUser = normalizeRecordForMergeTags(scope.CurrentUser);
  scope.CurrentTenant = scope.CurrentOrganization;

  if (scope.Quote) scope.Quote = normalizeRecordForMergeTags(scope.Quote);
  if (scope.Invoice) scope.Invoice = normalizeRecordForMergeTags(scope.Invoice);
  if (scope.BillingInvoice) {
    scope.BillingInvoice = normalizeRecordForMergeTags(scope.BillingInvoice);
  }
  if (scope.Seller) scope.Seller = normalizeRecordForMergeTags(scope.Seller);
  if (scope.PurchaseReturns) scope.PurchaseReturns = normalizeRecordForMergeTags(scope.PurchaseReturns);
  if (scope.People) scope.People = normalizeRecordForMergeTags(scope.People);
  if (scope.Record) scope.Record = normalizeRecordForMergeTags(scope.Record);
  if (moduleAlias && scope[moduleAlias]) {
    scope[moduleAlias] = normalizeRecordForMergeTags(scope[moduleAlias]);
  }

  if (
    (preview || runtimeContext.usePreviewSample === true)
    && COMMERCIAL_PREVIEW_MODULES.has(recordModuleKey)
  ) {
    if (!scope.Deal) {
      scope.Deal = normalizeRecordForMergeTags(buildPreviewSampleRecord('deals', tenantOrganization));
    }
    if (!scope.Case) {
      scope.Case = normalizeRecordForMergeTags(buildPreviewSampleRecord('cases', tenantOrganization));
    }
  }

  return scope;
}

module.exports = {
  assembleRuntimeContext,
  capitalizeModuleKey,
  normalizeLine,
  normalizeQuoteRecord,
  normalizeInvoiceRecord,
  buildPreviewSampleRecord,
  enrichLinesWithLiveItemCatalog,
  normalizeLinesForRender,
  plainTextFromRichDescription,
  resolveCatalogItemDescription,
  resolveRelatedOrganization,
  resolveCrmOrganizationRef,
  loadCrmOrganizationById,
  ORGANIZATION_MERGE_SELECT,
  RECORD_LOADERS
};
