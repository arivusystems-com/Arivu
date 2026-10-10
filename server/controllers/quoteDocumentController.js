const crypto = require('node:crypto');

const PDFDocument = require('pdfkit');
const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteDocumentModel = require('../models/QuoteDocument');
const { listQuoteSections } = require('../services/quoteSectionService');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const { getQuoteBranding } = require('../services/quoteBrandingService');
const fileStorage = require('../services/fileStorageService');

function safeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'quote';
}

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

function buildPdfSectionBlocks(sections, lines) {
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
    lines: visible.filter((l) => String(l.quoteSectionId || '') === String(section._id))
  }));

  const orphans = visible.filter(
    (l) => !l.quoteSectionId || !assigned.has(String(l.quoteSectionId))
  );
  if (orphans.length) {
    blocks.push({
      section: { sectionTitle: 'General', sectionType: 'standard', showSectionTotal: false },
      lines: orphans
    });
  }

  return blocks;
}

function renderQuotePdf({ quote, lines, sections = [], watermark = null, branding = null }) {
  const brand = branding && typeof branding === 'object' ? branding : {};
  const brandColor = String(brand.brandColor || '#4f46e5');
  const documentTitle = String(brand.documentTitle || 'Quote');
  const companyName = String(brand.companyName || '').trim();
  const pdfFooterText = String(brand.pdfFooterText || '').trim();
  const logoPath = brand.logoPath || null;

  return new Promise((resolve, reject) => {
    // bufferPages enables "Page X of Y" footers after content renders
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = String(quote.currency || '').trim();
    const orgName = typeof quote.organizationRefId === 'object' ? quote.organizationRefId?.name : null;
    const contactName = typeof quote.contactId === 'object'
      ? [quote.contactId?.first_name, quote.contactId?.last_name].filter(Boolean).join(' ').trim()
      : null;

    const page = () => ({
      left: doc.page.margins.left,
      right: doc.page.width - doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.height - doc.page.margins.bottom,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right
    });

    const money = (n) => `${formatMoney(n)}${currency ? ` ${currency}` : ''}`;

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
      const leftText = `${quote.quoteNumber || 'Quote'} • Rev ${quote.revisionNumber || 1}`;
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
      const quoteDateStr = quote.quoteDate ? new Date(quote.quoteDate).toLocaleDateString() : '—';
      const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—';

      doc.text(`Quote #: ${quote.quoteNumber || quote._id}`, leftColX, top);
      doc.text(`Revision: ${quote.revisionNumber || 1}`, leftColX, top + 14);
      doc.text(`Status: ${quote.status || 'Draft'}`, leftColX, top + 28);

      doc.text(`Quote Date: ${quoteDateStr}`, rightColX, top);
      doc.text(`Valid Until: ${validUntilStr}`, rightColX, top + 14);
      doc.text(`Currency: ${currency || '—'}`, rightColX, top + 28);

      doc.strokeColor('#E5E7EB').moveTo(p.left, top + 46).lineTo(p.right, top + 46).stroke();

      // Customer (best effort)
      doc.fillColor('#111111').fontSize(11);
      const partyTop = top + 58;
      if (orgName) doc.text(`Organization: ${orgName}`, p.left, partyTop, { width: p.width });
      if (contactName) doc.text(`Contact: ${contactName}`, p.left, partyTop + 14, { width: p.width });

      doc.restore();
      doc.y = partyTop + (orgName || contactName ? 36 : 10);
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
      doc.text('Total', c.total.x, y, { width: c.total.w, align: 'right' });
      doc.restore();
      doc.y = y + 18;
    }

    function ensureRoom(minHeight, { withTableHeader = false } = {}) {
      const p = page();
      const footerReserve = 22; // space for footer line + text
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

    function rowStyle(line) {
      const isBundleParent = line.lineType === 'bundle_parent';
      const isComponent = line.lineType === 'bundle_component';
      return { isBundleParent, isComponent };
    }

    function renderLineRow(line, zebraIndex) {
      const p = page();
      const c = cols();
      const { isBundleParent, isComponent } = rowStyle(line);
      const indent = isComponent ? 14 : 0;

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

      // background zebra (subtle)
      if (zebraIndex % 2 === 1) {
        doc.save();
        doc.rect(p.left, rowY - 3, p.width, rowH).fill('#FAFAFB');
        doc.restore();
      }

      doc.fillColor('#111111');
      doc.text(sku, c.sku.x, rowY, { width: c.sku.w });
      doc.text(name, c.name.x + indent, rowY, { width: c.name.w - indent });
      doc.text(String(qty), c.qty.x, rowY, { width: c.qty.w, align: 'right' });
      doc.text(formatMoney(unit), c.unit.x, rowY, { width: c.unit.w, align: 'right' });
      doc.text(formatMoney(total), c.total.x, rowY, { width: c.total.w, align: 'right' });

      // if component, add a small vertical marker
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
      if (section.pageBreakBefore === true) {
        doc.addPage();
        drawHeader();
      }
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
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
        doc.text(value, valueX, y, { width: valueW, align: 'right', lineBreak: false });
        y += lineH;
      };

      if (Number(section.sectionDiscountTotal) > 0) {
        drawRow('Section subtotal', formatMoney(section.sectionSubtotal));
        drawRow('Section discount', `-${formatMoney(section.sectionDiscountTotal)}`);
      }
      drawRow('Section total', formatMoney(section.sectionTotal ?? section.sectionSubtotal ?? 0), { bold: true });

      doc.font('Helvetica').fontSize(10).fillColor('#111111');
      doc.y = y + 8;
    }

    function drawTotalsBox() {
      const rows = [{ label: 'Subtotal', value: quote.subtotal, bold: false }];
      if (Number(quote.lineDiscountTotal) > 0) {
        rows.push({ label: 'Line discounts', value: -Number(quote.lineDiscountTotal), bold: false });
      }
      if (Number(quote.globalDiscountTotal) > 0) {
        rows.push({ label: 'Quote discount', value: -Number(quote.globalDiscountTotal), bold: false });
      }
      rows.push({ label: 'Tax', value: quote.taxTotal, bold: false });
      if (Number(quote.adjustmentTotal) !== 0) {
        rows.push({ label: 'Adjustment', value: quote.adjustmentTotal, bold: false });
      }
      rows.push({ label: 'Grand Total', value: quote.grandTotal, bold: true });

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
        const display =
          row.value < 0 && row.label !== 'Grand Total'
            ? `-${formatMoney(Math.abs(row.value))}`
            : money(row.value);
        doc.text(display, boxX + labelW, y, { width: valueW - 12, align: 'right' });
      });

      doc.font('Helvetica').fillColor('#111111');
      doc.y = Math.min(startY + boxH, p.bottom - 24);
    }

    // --- Render ---
    drawHeader();

    const sectionBlocks = buildPdfSectionBlocks(sections, lines);

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

    // Footers with total page count
    const range = doc.bufferedPageRange(); // { start: 0, count: n }
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      if (watermark) drawDraftWatermark(doc, page, watermark);
      drawFooter(i, range.count);
    }

    doc.end();
  });
}

module.exports.renderQuotePdf = renderQuotePdf;
module.exports.safeFilePart = safeFilePart;

exports.listDocuments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const docs = await QuoteDocumentModel.find({ organizationId, quoteId })
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
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId })
      .populate({ path: 'assignedTo', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
      .lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const lines = await QuoteLine.find({ organizationId, quoteId }).sort({ lineOrder: 1, createdAt: 1 }).lean();
    const sections = await listQuoteSections({ organizationId, quoteId });
    const watermark =
      String(quote.customerShareMode || '').toLowerCase() === 'draft' ||
      ['Draft', 'Pending Approval'].includes(String(quote.status || ''))
        ? 'DRAFT'
        : null;
    const branding = await getQuoteBranding(organizationId);
    const pdf = await renderQuotePdf({ quote, lines, sections, watermark, branding });
    const checksum = computeChecksum(pdf);

    const latest = await QuoteDocumentModel.find({ organizationId, quoteId, revisionNumber: quote.revisionNumber })
      .sort({ versionNumber: -1 })
      .limit(1)
      .select('versionNumber')
      .lean();
    const nextVersion = Math.max(0, Number(latest?.[0]?.versionNumber) || 0) + 1;

    const filename = `${safeFilePart(quote.quoteNumber)}-rev${quote.revisionNumber}-v${nextVersion}.pdf`;
    const uploaded = await fileStorage.uploadBuffer({
      buffer: pdf,
      originalName: filename,
      mimeType: 'application/pdf',
      organizationId,
      category: 'quotes'
    });

    const docRow = await QuoteDocumentModel.create({
      organizationId,
      quoteId,
      quoteNumber: quote.quoteNumber,
      revisionNumber: quote.revisionNumber,
      versionNumber: nextVersion,
      templateId: 'default',
      checksum,
      generatedAt: new Date(),
      generatedBy: req.user._id,
      mimeType: 'application/pdf',
      storageProvider: 'oci',
      filePath: uploaded.url,
      fileSizeBytes: pdf.length,
      currency: quote.currency || 'USD',
      grandTotal: Number(quote.grandTotal) || 0,
      lineCount: (lines || []).filter((l) => l && l.hiddenLine !== true).length
    });

    await writeQuoteActivity({
      organizationId,
      quoteId,
      userId: req.user._id,
      action: 'quote_document_generated',
      message: 'Quote PDF generated',
      details: { revisionNumber: quote.revisionNumber, versionNumber: nextVersion, checksum }
    });

    return res.status(201).json({ success: true, data: docRow });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to generate document', code: 'UNKNOWN' });
  }
};
