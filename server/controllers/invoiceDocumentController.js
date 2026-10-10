const crypto = require('node:crypto');

const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceDocumentModel = require('../models/InvoiceDocument');
const { listInvoiceSections } = require('../services/invoiceSectionService');
const { writeInvoiceActivity } = require('../services/invoiceActivityService');
const { getInvoiceBranding, formatCreditReasonLabel } = require('../services/invoiceBrandingService');
const { safeFilePart } = require('./quoteDocumentController');
const fileStorage = require('../services/fileStorageService');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0.00';
  return x.toFixed(2);
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function drawDraftWatermark(doc, pageFn, label = 'DRAFT') {
  const p = pageFn();
  const cx = p.left + p.width / 2;
  const cy = p.top + p.width * 0.35;
  const text = String(label || 'DRAFT').toUpperCase();
  doc.save();
  doc.fillOpacity(0.14);
  doc.fillColor('#DC2626');
  doc.font('Helvetica-Bold').fontSize(76);
  doc.rotate(-32, { origin: [cx, cy] });
  doc.text(text, p.left, cy - 28, { width: p.width, align: 'center', lineBreak: false });
  doc.fillOpacity(1);
  doc.restore();
}

function sectionTypeSuffix(section) {
  const t = String(section?.sectionType || 'standard');
  if (t === 'optional') return ' (Optional)';
  if (t === 'future') return ' (Future)';
  return '';
}

function buildInvoicePdfSectionBlocks(sections, lines) {
  const visible = (Array.isArray(lines) ? lines : []).filter((l) => l && l.hiddenLine !== true);
  const sorted = (Array.isArray(sections) ? sections : [])
    .filter((s) => s && s.hiddenSection !== true)
    .sort((a, b) => (Number(a.sectionOrder) || 0) - (Number(b.sectionOrder) || 0));

  if (!sorted.length) {
    return [{ section: null, lines: visible }];
  }

  const assigned = new Set(sorted.map((s) => String(s._id)));
  const blocks = sorted.map((section) => ({
    section,
    lines: visible.filter((l) => String(l.invoiceSectionId || '') === String(section._id))
  }));

  const orphans = visible.filter(
    (l) => !l.invoiceSectionId || !assigned.has(String(l.invoiceSectionId))
  );
  if (orphans.length) {
    blocks.push({
      section: { sectionTitle: 'General', sectionType: 'standard', showSectionTotal: false },
      lines: orphans
    });
  }

  return blocks;
}

function resolveInvoiceWatermark(invoice) {
  const status = String(invoice?.status || '').trim();
  if (['Posted', 'Partially Paid', 'Paid', 'Written Off'].includes(status)) return null;
  if (status === 'Void') return 'VOID';
  return 'DRAFT';
}

function renderInvoicePdf({
  invoice,
  lines,
  sections = [],
  sourceInvoice = null,
  watermark = null,
  branding = null
}) {
  const brand = branding && typeof branding === 'object' ? branding : {};
  const brandColor = String(brand.brandColor || '#4f46e5');
  const documentTitle = String(brand.documentTitle || 'Invoice');
  const companyName = String(brand.companyName || '').trim();
  const pdfFooterText = String(brand.pdfFooterText || '').trim();
  const logoPath = brand.logoPath || null;
  const isCreditNote = String(invoice?.invoiceType || 'standard') === 'credit_note';
  const headerCurrency = String(invoice.currency || '').trim();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const orgName = typeof invoice.organizationRefId === 'object' ? invoice.organizationRefId?.name : null;
    const contactName =
      typeof invoice.contactId === 'object'
        ? [invoice.contactId?.first_name, invoice.contactId?.last_name].filter(Boolean).join(' ').trim()
        : null;

    const page = () => ({
      left: doc.page.margins.left,
      right: doc.page.width - doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.height - doc.page.margins.bottom,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right
    });

    const money = (n, currencyOverride = null) => {
      const cur = String(currencyOverride || headerCurrency || '').trim();
      return `${formatMoney(n)}${cur ? ` ${cur}` : ''}`;
    };

    const cols = () => {
      const p = page();
      const skuW = 92;
      const qtyW = 48;
      const unitW = 74;
      const totalW = 86;
      const nameW = Math.max(120, p.width - (skuW + qtyW + unitW + totalW));
      return {
        sku: { x: p.left, w: skuW },
        name: { x: p.left + skuW, w: nameW },
        qty: { x: p.left + skuW + nameW, w: qtyW },
        unit: { x: p.left + skuW + nameW + qtyW, w: unitW },
        total: { x: p.left + skuW + nameW + qtyW + unitW, w: totalW }
      };
    };

    function drawFooter(pageIndex, pageCount) {
      const p = page();
      doc.save();
      const footerY = p.bottom - 18;
      const footerLineY = footerY - 8;
      doc.strokeColor(brandColor).lineWidth(1.5).moveTo(p.left, footerLineY).lineTo(p.right, footerLineY).stroke();
      doc.fillColor('#6B7280').fontSize(9);
      const leftText = `${invoice.invoiceNumber || 'Invoice'} • ${documentTitle}`;
      const rightText = `Page ${pageIndex + 1} of ${pageCount}`;
      doc.text(leftText, p.left, footerY, { width: p.width - 90, lineBreak: false });
      doc.text(rightText, p.right - 90, footerY, { width: 90, align: 'right', lineBreak: false });
      if (pdfFooterText) {
        doc.fontSize(8).fillColor('#9CA3AF');
        doc.text(pdfFooterText, p.left, footerY + 12, { width: p.width, align: 'center', lineBreak: false });
      }
      doc.restore();
    }

    function drawHeader() {
      const p = page();
      doc.save();

      const logoW = 120;
      const logoH = 44;
      const titleWidth = logoPath ? Math.max(200, p.width - logoW - 16) : p.width;
      let headerBlockBottom = p.top;

      if (logoPath) {
        try {
          doc.image(logoPath, p.right - logoW, p.top, { fit: [logoW, logoH], align: 'right', valign: 'top' });
          headerBlockBottom = Math.max(headerBlockBottom, p.top + logoH);
        } catch {
          /* skip broken logo */
        }
      }

      doc.fillColor(brandColor).fontSize(22).text(documentTitle, p.left, p.top, { width: titleWidth });
      let textY = p.top + 26;
      if (companyName) {
        doc.fillColor('#374151').fontSize(11).text(companyName, p.left, textY, { width: titleWidth });
        textY += 16;
      }
      headerBlockBottom = Math.max(headerBlockBottom, textY);

      doc.fillColor('#374151').fontSize(10);
      const top = Math.max(headerBlockBottom + 8, p.top + (companyName ? 44 : 30));
      const leftColX = p.left;
      const rightColX = p.left + Math.min(320, Math.floor(p.width / 2));
      const invoiceDateStr = invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '—';
      const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—';

      doc.text(`${isCreditNote ? 'Credit Note' : 'Invoice'} #: ${invoice.invoiceNumber || invoice._id}`, leftColX, top);
      doc.text(`Status: ${invoice.status || 'Draft'}`, leftColX, top + 14);
      if (isCreditNote && (sourceInvoice?.invoiceNumber || invoice.sourceInvoiceId)) {
        doc.text(
          `Source invoice: ${sourceInvoice?.invoiceNumber || invoice.sourceInvoiceId}`,
          leftColX,
          top + 28
        );
      } else if (!isCreditNote) {
        doc.text(`Due date: ${dueDateStr}`, leftColX, top + 28);
      }

      doc.text(`${isCreditNote ? 'Credit date' : 'Invoice date'}: ${invoiceDateStr}`, rightColX, top);
      doc.text(`Currency: ${headerCurrency || '—'}`, rightColX, top + 14);
      if (isCreditNote && invoice.creditReason) {
        doc.text(`Reason: ${formatCreditReasonLabel(invoice.creditReason)}`, rightColX, top + 28);
      } else if (!isCreditNote) {
        doc.text(`Amount due: ${money(invoice.amountDue ?? invoice.grandTotal)}`, rightColX, top + 28);
      }

      doc.strokeColor('#E5E7EB').moveTo(p.left, top + 46).lineTo(p.right, top + 46).stroke();

      doc.fillColor('#111111').fontSize(11);
      const partyTop = top + 58;
      if (orgName) doc.text(`Organization: ${orgName}`, p.left, partyTop, { width: p.width });
      if (contactName) doc.text(`Contact: ${contactName}`, p.left, partyTop + 14, { width: p.width });
      if (isCreditNote && invoice.creditReasonNote) {
        doc
          .fontSize(10)
          .fillColor('#4B5563')
          .text(`Notes: ${invoice.creditReasonNote}`, p.left, partyTop + 28, { width: p.width });
      }

      doc.restore();
      doc.y = partyTop + (orgName || contactName ? 36 : 10) + (isCreditNote && invoice.creditReasonNote ? 14 : 0);
    }

    function drawTableHeader() {
      const p = page();
      const c = cols();
      const y = doc.y + 8;
      doc.save();
      doc.rect(p.left, y - 6, p.width, 20).fill('#F3F4F6');
      doc.fillColor('#4B5563').fontSize(9);
      doc.text('SKU', c.sku.x, y, { width: c.sku.w });
      doc.text('Name', c.name.x, y, { width: c.name.w });
      doc.text('Qty', c.qty.x, y, { width: c.qty.w, align: 'right' });
      doc.text('Unit', c.unit.x, y, { width: c.unit.w, align: 'right' });
      doc.text(isCreditNote ? 'Credit' : 'Total', c.total.x, y, { width: c.total.w, align: 'right' });
      doc.restore();
      doc.y = y + 18;
    }

    function ensureRoom(minHeight, { withTableHeader = false } = {}) {
      const p = page();
      const footerReserve = 22;
      if (doc.y + minHeight <= p.bottom - footerReserve) return;
      doc.addPage();
      drawHeader();
      if (withTableHeader) drawTableHeader();
    }

    function lineLabel(line) {
      const name = line.itemNameSnapshot || '—';
      if (line.lineType === 'bundle_component') {
        const optional = !!(line.bundleSnapshot && line.bundleSnapshot.optional === true);
        return `${optional ? '[Optional] ' : ''}${name}`;
      }
      return name;
    }

    function renderLineRow(line, zebraIndex) {
      const c = cols();
      const isBundleParent = line.lineType === 'bundle_parent';
      const isComponent = line.lineType === 'bundle_component';
      const indent = isComponent ? 14 : 0;
      const lineCurrency = String(line.currencySnapshot || '').trim();
      const useLineCurrency = lineCurrency && lineCurrency !== headerCurrency;

      doc.fontSize(10);
      doc.fillColor('#111111');
      if (isBundleParent) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');

      const sku = line.skuSnapshot || '—';
      const name = lineLabel(line);
      const qty = Number(line.quantity) || 0;
      const unit = Number(line.unitPriceSnapshot) || 0;
      const total = Number(line.lineTotal) || 0;

      const rowY = doc.y;
      const rowH = 18;

      if (zebraIndex % 2 === 1) {
        doc.save();
        doc.rect(page().left, rowY - 3, page().width, rowH).fill('#FAFAFB');
        doc.restore();
      }

      doc.fillColor('#111111');
      doc.text(sku, c.sku.x, rowY, { width: c.sku.w });
      doc.text(name, c.name.x + indent, rowY, { width: c.name.w - indent });
      doc.text(String(qty), c.qty.x, rowY, { width: c.qty.w, align: 'right' });
      doc.text(formatMoney(unit), c.unit.x, rowY, { width: c.unit.w, align: 'right' });
      const totalDisplay = isCreditNote
        ? `-${formatMoney(Math.abs(total))}`
        : formatMoney(total);
      doc.text(
        useLineCurrency ? `${totalDisplay} ${lineCurrency}` : totalDisplay,
        c.total.x,
        rowY,
        { width: c.total.w, align: 'right' }
      );

      if (isComponent) {
        doc.save();
        doc.strokeColor('#D1D5DB').lineWidth(1);
        doc.moveTo(c.name.x + 6, rowY + 2).lineTo(c.name.x + 6, rowY + rowH - 6).stroke();
        doc.restore();
      }

      doc.font('Helvetica').fillColor('#111111');
      doc.y = rowY + rowH;
    }

    function drawSectionHeader(section) {
      if (!section?.sectionTitle) return;
      ensureRoom(36);
      const p = page();
      const y = doc.y + 4;
      doc.save();
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(12);
      doc.text(`${section.sectionTitle}${sectionTypeSuffix(section)}`, p.left, y, { width: p.width });
      doc.restore();
      doc.y = y + 20;
    }

    function drawSectionSubtotal(section) {
      if (!section || section.showSectionTotal === false) return;

      const lineH = 14;
      const rowCount = Number(section.sectionDiscountTotal) > 0 ? 3 : 1;
      ensureRoom(rowCount * lineH + 12);

      const c = cols();
      let y = doc.y + 4;
      const labelX = c.name.x;
      const labelW = c.name.w + c.qty.w - 4;
      const valueX = c.unit.x;
      const valueW = c.unit.w + c.total.w;

      const drawRow = (label, value, { bold = false } = {}) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
        doc.fillColor(bold ? '#111111' : '#6B7280');
        doc.text(label, labelX, y, { width: labelW, align: 'right', lineBreak: false });
        doc.fillColor('#111111');
        doc.text(value, valueX, y, { width: valueW, align: 'right', lineBreak: false });
        y += lineH;
      };

      const sectionTotal = Number(section.sectionTotal ?? section.sectionSubtotal ?? 0);
      const displayTotal = isCreditNote
        ? `-${formatMoney(Math.abs(sectionTotal))}`
        : formatMoney(sectionTotal);

      if (Number(section.sectionDiscountTotal) > 0) {
        drawRow('Section subtotal', formatMoney(section.sectionSubtotal));
        drawRow('Section discount', `-${formatMoney(section.sectionDiscountTotal)}`);
      }
      drawRow('Section total', displayTotal, { bold: true });

      doc.font('Helvetica').fontSize(10).fillColor('#111111');
      doc.y = y + 8;
    }

    function drawTotalsBox() {
      const rows = [{ label: 'Subtotal', value: invoice.subtotal, bold: false }];
      if (Number(invoice.lineDiscountTotal) > 0) {
        rows.push({ label: 'Line discounts', value: -Number(invoice.lineDiscountTotal), bold: false });
      }
      if (Number(invoice.sectionDiscountTotal) > 0) {
        rows.push({ label: 'Section discounts', value: -Number(invoice.sectionDiscountTotal), bold: false });
      }
      if (Number(invoice.globalDiscountTotal) > 0) {
        rows.push({ label: 'Invoice discount', value: -Number(invoice.globalDiscountTotal), bold: false });
      }
      rows.push({ label: 'Tax', value: invoice.taxTotal, bold: false });
      if (Number(invoice.adjustmentTotal) !== 0) {
        rows.push({ label: 'Adjustment', value: invoice.adjustmentTotal, bold: false });
      }
      rows.push({
        label: isCreditNote ? 'Credit Total' : 'Grand Total',
        value: invoice.grandTotal,
        bold: true
      });
      if (!isCreditNote && Number(invoice.amountDue) !== Number(invoice.grandTotal)) {
        rows.push({ label: 'Amount Due', value: invoice.amountDue, bold: true });
      }

      const lineH = 16;
      const boxH = lineH * rows.length + 18;
      ensureRoom(boxH + 16);

      const p = page();
      const boxW = 240;
      const boxX = p.right - boxW;
      const startY = doc.y + 12;

      doc.save();
      doc.rect(boxX, startY - 8, boxW, boxH).fill('#F6F7FB');
      doc.strokeColor(brandColor).lineWidth(1).rect(boxX, startY - 8, boxW, boxH).stroke();
      doc.restore();

      const labelW = 110;
      const valueW = boxW - labelW;

      rows.forEach((row, i) => {
        const y = startY + lineH * i;
        if (row.bold) doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
        else doc.font('Helvetica').fontSize(11).fillColor('#111111');
        doc.text(row.label, boxX + 12, y, { width: labelW - 12 });
        const absVal = Math.abs(Number(row.value) || 0);
        let display;
        if (isCreditNote && (row.label === 'Credit Total' || Number(row.value) < 0)) {
          display = `-${formatMoney(absVal)}${headerCurrency ? ` ${headerCurrency}` : ''}`;
        } else if (row.value < 0 && row.label !== 'Grand Total' && row.label !== 'Credit Total') {
          display = `-${formatMoney(absVal)}`;
        } else {
          display = money(row.value);
        }
        doc.text(display, boxX + labelW, y, { width: valueW - 12, align: 'right' });
      });

      doc.font('Helvetica').fillColor('#111111');
      doc.y = Math.min(startY + boxH, p.bottom - 24);
    }

    drawHeader();

    const sectionBlocks = buildInvoicePdfSectionBlocks(sections, lines);

    for (const block of sectionBlocks) {
      if (block.section) {
        drawSectionHeader(block.section);
        drawTableHeader();
      } else {
        doc.fillColor('#111111').fontSize(14).text('Lines', { align: 'left' });
        doc.moveDown(0.2);
        drawTableHeader();
      }

      let zebra = 0;
      for (const l of block.lines) {
        ensureRoom(26, { withTableHeader: true });
        renderLineRow(l, zebra);
        zebra += 1;
      }

      if (block.section) {
        drawSectionSubtotal(block.section);
      }
    }

    drawTotalsBox();

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      if (watermark) drawDraftWatermark(doc, page, watermark);
      drawFooter(i, range.count);
    }

    doc.end();
  });
}

async function loadInvoiceForDocument({ organizationId, invoiceRef }) {
  return (
    (await Invoice.findOne({ organizationId, invoiceId: invoiceRef, deletedAt: null })
      .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })) ||
    (await Invoice.findOne({ organizationId, _id: invoiceRef, deletedAt: null })
      .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' }))
  );
}

exports.renderInvoicePdf = renderInvoicePdf;
exports.resolveInvoiceWatermark = resolveInvoiceWatermark;

exports.listDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const invoiceMongoId = req.params.id;
    const invoice = await loadInvoiceForDocument({ organizationId, invoiceRef: invoiceMongoId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found', code: 'NOT_FOUND' });
    }

    const docs = await InvoiceDocumentModel.find({ organizationId, invoiceId: invoice._id })
      .sort({ versionNumber: -1, generatedAt: -1 })
      .lean();
    return res.json({ success: true, data: docs });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to list documents', code: 'UNKNOWN' });
  }
};

exports.generateDocument = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const invoiceRef = req.params.id;

    const invoiceDoc = await loadInvoiceForDocument({ organizationId, invoiceRef });
    if (!invoiceDoc) {
      return res.status(404).json({ success: false, message: 'Invoice not found', code: 'NOT_FOUND' });
    }

    const invoice = invoiceDoc.toObject ? invoiceDoc.toObject() : invoiceDoc;
    const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';

    const [lines, sections, sourceInvoice] = await Promise.all([
      InvoiceLine.find({ organizationId, invoiceId: invoice._id }).sort({ lineOrder: 1, createdAt: 1 }).lean(),
      listInvoiceSections({ organizationId, invoiceId: invoice._id }),
      isCreditNote && invoice.sourceInvoiceId
        ? Invoice.findOne({ organizationId, invoiceId: invoice.sourceInvoiceId, deletedAt: null })
            .select('invoiceId invoiceNumber status grandTotal postedAt')
            .lean()
        : Promise.resolve(null)
    ]);

    const watermark = resolveInvoiceWatermark(invoice);
    const branding = await getInvoiceBranding(organizationId, { invoiceType: invoice.invoiceType });
    const pdf = await renderInvoicePdf({
      invoice,
      lines,
      sections,
      sourceInvoice,
      watermark,
      branding
    });
    const checksum = computeChecksum(pdf);

    const latest = await InvoiceDocumentModel.find({ organizationId, invoiceId: invoice._id })
      .sort({ versionNumber: -1 })
      .limit(1)
      .select('versionNumber')
      .lean();
    const nextVersion = Math.max(0, Number(latest?.[0]?.versionNumber) || 0) + 1;

    const filename = `${safeFilePart(invoice.invoiceNumber)}-v${nextVersion}.pdf`;
    const uploaded = await fileStorage.uploadBuffer({
      buffer: pdf,
      originalName: filename,
      mimeType: 'application/pdf',
      organizationId,
      category: 'invoices'
    });

    const docRow = await InvoiceDocumentModel.create({
      organizationId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType || 'standard',
      sourceInvoiceId: invoice.sourceInvoiceId || null,
      creditReason: invoice.creditReason || null,
      versionNumber: nextVersion,
      checksum,
      generatedAt: new Date(),
      generatedBy: req.user._id,
      mimeType: 'application/pdf',
      storageProvider: 'oci',
      filePath: uploaded.url,
      fileSizeBytes: pdf.length,
      currency: invoice.currency || 'USD',
      grandTotal: Number(invoice.grandTotal) || 0,
      amountDue: Number(invoice.amountDue) || 0,
      lineCount: (lines || []).filter((l) => l && l.hiddenLine !== true).length
    });

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId: req.user._id,
      action: isCreditNote ? 'credit_note_pdf_generated' : 'invoice_pdf_generated',
      message: isCreditNote
        ? `Credit note PDF generated (v${nextVersion})`
        : `Invoice PDF generated (v${nextVersion})`,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        versionNumber: nextVersion,
        checksum,
        watermark: watermark || null
      }
    });

    return res.status(201).json({ success: true, data: docRow });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to generate document', code: 'UNKNOWN' });
  }
};
