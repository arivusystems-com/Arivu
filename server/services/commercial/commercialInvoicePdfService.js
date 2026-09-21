'use strict';

const PDFDocument = require('pdfkit');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingInvoiceLine = require('../../models/commercial/BillingInvoiceLine');
const { INVOICE_STATUSES } = require('../../constants/commercialBilling');

const DEFAULT_PAYMENT_INSTRUCTIONS =
  'Pay online via Arivu Billing, or transfer and submit UTR + proof for verification.';
const DEFAULT_TAGLINE = 'The platform your company runs on';
const DEFAULT_PAYMENT_TERMS = 'Net 30';
const DEFAULT_WEBSITE = 'arivu.com';

/**
 * Seller identity + payment copy for SaaS BillingInvoice PDFs (env — not CRM templates).
 *
 * Env:
 * - COMMERCIAL_SELLER_LEGAL_NAME
 * - COMMERCIAL_SELLER_GSTIN
 * - COMMERCIAL_SELLER_PAN
 * - COMMERCIAL_SELLER_ADDRESS
 * - COMMERCIAL_SELLER_EMAIL
 * - COMMERCIAL_SELLER_PHONE
 * - COMMERCIAL_SELLER_TAGLINE
 * - COMMERCIAL_SELLER_WEBSITE
 * - COMMERCIAL_SELLER_PAYMENT_TERMS
 * - COMMERCIAL_INVOICE_PAYMENT_INSTRUCTIONS
 * - COMMERCIAL_SELLER_BANK_DETAILS
 * - COMMERCIAL_SELLER_BANK_NAME
 * - COMMERCIAL_SELLER_ACCOUNT_NAME
 * - COMMERCIAL_SELLER_ACCOUNT_NUMBER
 * - COMMERCIAL_SELLER_IFSC
 * - COMMERCIAL_SELLER_UPI_ID
 */
function getCommercialInvoicePdfConfig() {
  const legalName = String(process.env.COMMERCIAL_SELLER_LEGAL_NAME || 'Arivu').trim() || 'Arivu';
  const gstin = String(process.env.COMMERCIAL_SELLER_GSTIN || '').trim();
  const pan = String(process.env.COMMERCIAL_SELLER_PAN || '').trim();
  const address = String(process.env.COMMERCIAL_SELLER_ADDRESS || '').trim();
  const email = String(process.env.COMMERCIAL_SELLER_EMAIL || '').trim();
  const phone = String(process.env.COMMERCIAL_SELLER_PHONE || '').trim();
  const tagline = String(process.env.COMMERCIAL_SELLER_TAGLINE || DEFAULT_TAGLINE).trim()
    || DEFAULT_TAGLINE;
  const website = String(process.env.COMMERCIAL_SELLER_WEBSITE || DEFAULT_WEBSITE).trim()
    || DEFAULT_WEBSITE;
  const paymentTerms = String(process.env.COMMERCIAL_SELLER_PAYMENT_TERMS || DEFAULT_PAYMENT_TERMS)
    .trim() || DEFAULT_PAYMENT_TERMS;
  const paymentInstructions = String(
    process.env.COMMERCIAL_INVOICE_PAYMENT_INSTRUCTIONS || DEFAULT_PAYMENT_INSTRUCTIONS
  ).trim() || DEFAULT_PAYMENT_INSTRUCTIONS;
  const bankDetails = String(process.env.COMMERCIAL_SELLER_BANK_DETAILS || '').trim();
  const bankName = String(process.env.COMMERCIAL_SELLER_BANK_NAME || '').trim();
  const accountName = String(process.env.COMMERCIAL_SELLER_ACCOUNT_NAME || '').trim();
  const accountNumber = String(process.env.COMMERCIAL_SELLER_ACCOUNT_NUMBER || '').trim();
  const ifsc = String(process.env.COMMERCIAL_SELLER_IFSC || '').trim();
  const upiId = String(process.env.COMMERCIAL_SELLER_UPI_ID || '').trim();
  return {
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
  };
}

function formatInr(paise) {
  const n = Number(paise) || 0;
  return `₹${(n / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateIn(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN');
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === INVOICE_STATUSES.PAID) return 'PAID';
  if (s === INVOICE_STATUSES.VOID) return 'VOID';
  if (s === INVOICE_STATUSES.PAST_DUE) return 'PAST DUE';
  if (s === INVOICE_STATUSES.DRAFT) return 'DRAFT';
  if (s === INVOICE_STATUSES.FINALIZED) return 'FINALIZED';
  return String(status || '').toUpperCase();
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

/**
 * Render a commercial BillingInvoice as PDF.
 * Prefers platform ContentTemplate when linked; falls back to PDFKit.
 */
async function renderCommercialInvoicePdf({ organizationId, invoiceId }) {
  try {
    const {
      tryRenderCommercialInvoiceViaContentPlatform,
    } = require('./commercialBillingInvoiceDocumentService');
    const viaTemplate = await tryRenderCommercialInvoiceViaContentPlatform({
      organizationId,
      invoiceId,
    });
    if (viaTemplate?.buffer) {
      return {
        buffer: viaTemplate.buffer,
        invoiceNumber: viaTemplate.invoiceNumber,
      };
    }
  } catch (err) {
    console.warn(
      '[CommercialBilling] content-template PDF failed; using PDFKit fallback',
      err?.message || err
    );
  }

  return renderCommercialInvoicePdfKit({ organizationId, invoiceId });
}

/**
 * Hardcoded PDFKit layout (fallback / when no published platform template).
 */
async function renderCommercialInvoicePdfKit({ organizationId, invoiceId }) {
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId,
  }).lean();
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  const lines = await BillingInvoiceLine.find({ invoiceId: invoice._id }).lean();
  const billTo = invoice.snapshot?.billTo || {};
  const {
    resolveCommercialInvoicePdfConfig,
  } = require('./commercialInvoicePdfSettingsService');
  const seller = await resolveCommercialInvoicePdfConfig();
  const label = statusLabel(invoice.status);
  const showPayment = invoice.status !== INVOICE_STATUSES.PAID
    && invoice.status !== INVOICE_STATUSES.VOID;

  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftX = doc.page.margins.left;
    const rightEdge = leftX + pageWidth;

    // Status badge (top-right)
    doc.fontSize(11).fillColor('#111').font('Helvetica-Bold');
    doc.text(label, leftX, 50, { width: pageWidth, align: 'right' });
    doc.font('Helvetica');

    // Header
    doc.fontSize(18).fillColor('#000').text('Arivu Invoice', leftX, 50, { continued: false });
    doc.moveDown(0.4);

    // Seller (from)
    doc.fontSize(12).fillColor('#000').text('From');
    doc.fontSize(10).fillColor('#333');
    doc.text(seller.legalName);
    if (seller.gstin) doc.text(`GSTIN: ${seller.gstin}`);
    if (seller.address) doc.text(seller.address);
    if (seller.email) doc.text(seller.email);
    if (seller.phone) doc.text(seller.phone);
    doc.moveDown(0.6);

    // Meta
    doc.fontSize(10).fillColor('#444');
    doc.text(`Invoice: ${invoice.invoiceNumber || ''}`);
    doc.text(`Status: ${label}`);
    const issued = formatDateIn(invoice.finalizedAt || invoice.createdAt);
    if (issued) doc.text(`Invoice date: ${issued}`);
    const due = formatDateIn(invoice.dueAt);
    if (due) doc.text(`Due date: ${due}`);
    if (invoice.periodStart && invoice.periodEnd) {
      const ps = formatDateIn(invoice.periodStart);
      const pe = formatDateIn(invoice.periodEnd);
      if (ps && pe) doc.text(`Period: ${ps} – ${pe}`);
    }
    doc.moveDown();

    // Bill to
    doc.fontSize(12).fillColor('#000').text('Bill to');
    doc.fontSize(10).fillColor('#333');
    if (billTo.companyName) doc.text(billTo.companyName);
    if (billTo.gstin) doc.text(`GSTIN: ${billTo.gstin}`);
    if (billTo.billingEmail) doc.text(billTo.billingEmail);
    if (billTo.billingPhone) doc.text(billTo.billingPhone);
    const addr = billTo.billingAddress;
    if (addr && typeof addr === 'object') {
      const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
        .filter(Boolean);
      if (parts.length) doc.text(parts.join(', '));
    }
    doc.moveDown();

    // Line table
    doc.fontSize(12).fillColor('#000').text('Line items');
    doc.moveDown(0.35);

    const colDesc = leftX;
    const colQty = leftX + pageWidth * 0.52;
    const colUnit = leftX + pageWidth * 0.64;
    const colAmt = leftX + pageWidth * 0.78;
    const qtyW = colUnit - colQty - 4;
    const unitW = colAmt - colUnit - 4;
    const amtW = rightEdge - colAmt;

    const drawRow = (y, desc, qty, unit, amt, opts = {}) => {
      const fontSize = opts.header ? 9 : 10;
      const color = opts.header ? '#666' : '#222';
      const font = opts.header ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font).fontSize(fontSize).fillColor(color);
      doc.text(desc, colDesc, y, { width: colQty - colDesc - 8, ellipsis: true });
      doc.text(qty, colQty, y, { width: qtyW, align: 'right' });
      doc.text(unit, colUnit, y, { width: unitW, align: 'right' });
      doc.text(amt, colAmt, y, { width: amtW, align: 'right' });
      return Math.max(doc.y, y + fontSize + 4);
    };

    let y = doc.y;
    y = drawRow(y, 'Description', 'Qty', 'Unit', 'Amount', { header: true });
    doc.moveTo(leftX, y).lineTo(rightEdge, y).strokeColor('#ddd').lineWidth(0.5).stroke();
    y += 6;
    doc.font('Helvetica');

    for (const line of lines) {
      const desc = line.description || line.productCode || 'Item';
      const qty = String(line.quantity ?? 0);
      const unit = formatInr(line.unitAmountMinor);
      const amount = formatInr(line.amountMinor);
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      y = drawRow(y, desc, qty, unit, amount);
      if (line.discountMinor) {
        doc.fontSize(9).fillColor('#166534').text(
          `Line discount: −${formatInr(line.discountMinor)}`,
          colDesc,
          y,
          { width: pageWidth }
        );
        y = doc.y + 2;
        doc.fillColor('#222');
      }
      y += 4;
    }

    doc.y = y + 8;
    doc.fontSize(10).fillColor('#000').font('Helvetica');
    doc.text(`Subtotal: ${formatInr(invoice.subtotalMinor)}`, { align: 'right' });
    if (invoice.discountMinor) {
      doc.text(`Invoice discount: −${formatInr(invoice.discountMinor)}`, { align: 'right' });
    }
    if (invoice.creditAppliedMinor) {
      doc.text(`Credit: −${formatInr(invoice.creditAppliedMinor)}`, { align: 'right' });
    }
    doc.text(`${resolveTaxLabel(invoice)}: ${formatInr(invoice.taxMinor)}`, { align: 'right' });
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`Total: ${formatInr(invoice.totalMinor)}`, { align: 'right' });
    doc.font('Helvetica');

    if (invoice.snapshot?.kind === 'proration') {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666').text('Proration invoice for mid-cycle changes.', {
        align: 'left',
      });
    }

    if (showPayment) {
      doc.moveDown();
      doc.fontSize(9).fillColor('#444').text(seller.paymentInstructions, { align: 'left' });
      if (seller.bankDetails) {
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#333').text(seller.bankDetails, { align: 'left' });
      }
    }

    // Large status mark for paid / void
    if (
      invoice.status === INVOICE_STATUSES.PAID
      || invoice.status === INVOICE_STATUSES.VOID
    ) {
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;
      doc.save();
      doc.fillOpacity(0.14);
      doc.fillColor(invoice.status === INVOICE_STATUSES.VOID ? '#DC2626' : '#166534');
      doc.font('Helvetica-Bold').fontSize(72);
      doc.rotate(-32, { origin: [cx, cy] });
      doc.text(label, 80, cy - 28, {
        width: doc.page.width - 160,
        align: 'center',
        lineBreak: false,
      });
      doc.fillOpacity(1);
      doc.restore();
    }

    doc.end();
  });

  return { buffer, invoiceNumber: invoice.invoiceNumber };
}

module.exports = {
  renderCommercialInvoicePdf,
  renderCommercialInvoicePdfKit,
  getCommercialInvoicePdfConfig,
  formatInr,
  formatDateIn,
  statusLabel,
  resolveTaxLabel,
  DEFAULT_PAYMENT_INSTRUCTIONS,
  DEFAULT_TAGLINE,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_WEBSITE,
};
