/**
 * PAY3 — Payment link create/revoke/resolve.
 */

const PaymentLink = require('../models/PaymentLink');
const Invoice = require('../models/Invoice');
const Organization = require('../models/Organization');
const { roundMoney } = require('../constants/paymentLifecycle');
const { isPaymentLinkActive } = require('../constants/paymentGatewayLifecycle');

async function buildBrandingSnapshot(organizationId) {
  const org = await Organization.findById(organizationId).select('name settings').lean();
  const branding = org?.settings?.branding || {};

  return {
    displayName: branding.displayName || org?.name || 'Arivu',
    logoUrl: branding.logoUrl || null,
    accentColor: branding.accentColor || null,
    supportEmail: branding.supportEmail || null,
    footerText: branding.footerText || null
  };
}

async function resolveInvoiceTargets({ organizationId, organizationRefId, invoiceIds = [] }) {
  const ids = [...new Set(invoiceIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) {
    const err = new Error('At least one invoiceId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const query = {
    organizationId,
    deletedAt: null,
    invoiceType: 'standard',
    invoiceId: { $in: ids },
    status: { $in: ['Posted', 'Partially Paid'] },
    amountDue: { $gt: 0 }
  };
  if (organizationRefId) {
    query.organizationRefId = organizationRefId;
  }

  const invoices = await Invoice.find(query).lean();

  if (invoices.length !== ids.length) {
    const err = new Error('One or more invoices are not payable');
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  const orgRefIds = [
    ...new Set(
      invoices
        .map((inv) => inv.organizationRefId)
        .filter(Boolean)
        .map((id) => String(id))
    )
  ];
  if (orgRefIds.length !== 1) {
    const err = new Error(
      orgRefIds.length === 0
        ? 'Invoice must have a customer organization before creating a payment link'
        : 'All invoices must belong to the same customer organization'
    );
    err.code = 'VALIDATION';
    throw err;
  }
  const resolvedOrganizationRefId = invoices[0].organizationRefId;
  if (organizationRefId && String(organizationRefId) !== String(resolvedOrganizationRefId)) {
    const err = new Error('One or more invoices are not payable');
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  const currency = invoices[0].currency || 'USD';
  if (invoices.some((inv) => (inv.currency || 'USD') !== currency)) {
    const err = new Error('All invoices must share the same currency');
    err.code = 'CURRENCY_MISMATCH';
    throw err;
  }

  const totalDue = roundMoney(invoices.reduce((sum, inv) => sum + roundMoney(inv.amountDue), 0));

  return {
    currency,
    amount: totalDue,
    payTargetType: ids.length === 1 ? 'single_invoice' : 'multi_invoice',
    invoiceIds: ids,
    organizationRefId: resolvedOrganizationRefId,
    contactId: invoices[0].contactId || null,
    invoiceTargets: invoices.map((inv) => ({
      invoiceId: inv.invoiceId,
      invoiceMongoId: inv._id,
      amountRequested: roundMoney(inv.amountDue)
    }))
  };
}

async function createPaymentLink({
  organizationId,
  userId,
  organizationRefId,
  contactId = null,
  invoiceIds = [],
  expiresAt = null,
  maxUses = 1,
  preferredProvider = 'stripe',
  allowedMethods = ['card', 'bank_transfer'],
  sourceContext = 'crm',
  sourceRef = null,
  notes = null,
  publicBaseUrl = null
}) {
  const resolved = await resolveInvoiceTargets({ organizationId, organizationRefId, invoiceIds });
  const brandingSnapshot = await buildBrandingSnapshot(organizationId);
  const effectiveOrganizationRefId = organizationRefId || resolved.organizationRefId;
  const effectiveContactId = contactId || resolved.contactId || null;

  const link = await PaymentLink.create({
    organizationId,
    organizationRefId: effectiveOrganizationRefId,
    contactId: effectiveContactId,
    payTargetType: resolved.payTargetType,
    invoiceIds: resolved.invoiceIds,
    fixedAmount: resolved.amount,
    currency: resolved.currency,
    allowedMethods,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    maxUses,
    preferredProvider,
    brandingSnapshot,
    sourceContext,
    sourceRef,
    notes,
    createdBy: userId || null
  });

  const { resolveClientUrl } = require('../utils/clientUrl');
  const base = resolveClientUrl([publicBaseUrl, process.env.PUBLIC_APP_URL, process.env.CLIENT_URL]);
  link.publicUrl = `${String(base).replace(/\/$/, '')}/pay/${link.publicToken}`;
  await link.save();

  return link.toObject();
}

async function listPaymentLinksForInvoice({ organizationId, invoiceMongoId, status = 'active' }) {
  const invoice = await Invoice.findOne({
    _id: invoiceMongoId,
    organizationId,
    deletedAt: null
  }).select('invoiceId').lean();

  if (!invoice) return [];

  return PaymentLink.find({
    organizationId,
    deletedAt: null,
    invoiceIds: invoice.invoiceId,
    ...(status ? { status } : {})
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
}

async function getPaymentLinkById({ organizationId, paymentLinkId }) {
  return PaymentLink.findOne({
    organizationId,
    paymentLinkId,
    deletedAt: null
  }).lean();
}

async function getPaymentLinkByPublicToken(publicToken) {
  return PaymentLink.findOne({
    publicToken: String(publicToken || '').trim(),
    deletedAt: null
  }).lean();
}

function assertPaymentLinkUsable(link) {
  if (!link) {
    const err = new Error('Payment link not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (link.status === 'revoked') {
    const err = new Error('Payment link has been revoked');
    err.code = 'PAYMENT_LINK_REVOKED';
    throw err;
  }

  if (!isPaymentLinkActive(link)) {
    const err = new Error('Payment link is expired or consumed');
    err.code = 'PAYMENT_LINK_EXPIRED';
    throw err;
  }
}

async function revokePaymentLink({ organizationId, paymentLinkId, userId }) {
  const link = await PaymentLink.findOne({ organizationId, paymentLinkId, deletedAt: null });
  if (!link) {
    const err = new Error('Payment link not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  link.status = 'revoked';
  link.revokedAt = new Date();
  link.revokedBy = userId || null;
  await link.save();
  return link.toObject();
}

async function incrementLinkUseCount({ organizationId, paymentLinkId }) {
  await PaymentLink.updateOne(
    { organizationId, paymentLinkId },
    { $inc: { useCount: 1 } }
  );

  const link = await PaymentLink.findOne({ organizationId, paymentLinkId });
  if (link && link.maxUses != null && link.useCount >= link.maxUses) {
    link.status = 'consumed';
    await link.save();
  }
}

module.exports = {
  buildBrandingSnapshot,
  resolveInvoiceTargets,
  createPaymentLink,
  listPaymentLinksForInvoice,
  getPaymentLinkById,
  getPaymentLinkByPublicToken,
  assertPaymentLinkUsable,
  revokePaymentLink,
  incrementLinkUseCount
};
