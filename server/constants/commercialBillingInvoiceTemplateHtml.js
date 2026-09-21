'use strict';

/**
 * GrapesJS HTML for Arivu commercial tax invoice (platform SaaS BillingInvoice).
 *
 * Line items MUST use default column keys (sku/name/quantity/unitPrice/lineTotal)
 * — Grapes + normalizeLineItemColumns drop unknown keys and rewrite the block,
 * which left orphan {{Line.*}} tags in the canvas.
 */

function encodeLineItemBindings(bindings) {
  return encodeURIComponent(JSON.stringify(bindings));
}

function buildCommercialTaxInvoiceHtml() {
  const lineBindings = encodeLineItemBindings({
    collection: 'lines',
    moduleScope: 'billing_invoices',
    currencyDisplay: 'symbol',
    showSections: false,
    showSectionTotals: false,
    showDocumentTotals: false,
    tableWidthPercent: 100,
    widthUnit: 'percent',
    columnWidthPercents: [0, 44, 12, 22, 22],
    columns: [
      { key: 'sku', header: 'SKU', path: 'skuSnapshot', align: 'left', visible: false },
      { key: 'name', header: 'Description', path: 'name', align: 'left', visible: true },
      { key: 'quantity', header: 'Qty', path: 'quantity', align: 'center', visible: true },
      {
        key: 'unitPrice',
        header: 'Unit Price (₹)',
        path: 'unitPriceLabel',
        align: 'right',
        format: 'text',
        visible: true
      },
      {
        key: 'lineTotal',
        header: 'Amount (₹)',
        path: 'lineTotal',
        align: 'right',
        format: 'currency',
        visible: true
      }
    ]
  });

  // Header/meta use tables (not flex) so Grapes does not reshuffle text nodes.
  return `
<div class="arv-inv" style="font-family:Helvetica,Arial,sans-serif;color:#1e3a5f;font-size:11px;line-height:1.45;max-width:100%;">
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <tr>
      <td style="vertical-align:top;width:42%;">
        <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#1e3a5f;line-height:1;">
          {{Seller.legalName}}<span style="color:#5b9fd4;">.</span>
        </div>
        <div style="margin-top:6px;font-size:10px;color:#8fa3b8;">{{Seller.tagline}}</div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#8fa3b8;margin-bottom:8px;">TAX INVOICE</div>
        <table style="border-collapse:collapse;margin-left:auto;font-size:10px;color:#8fa3b8;text-align:left;">
          <tr>
            <td style="padding:1px 12px 1px 0;white-space:nowrap;">Invoice No.</td>
            <td style="padding:1px 0;color:#1e3a5f;font-weight:600;">{{Invoice.invoiceNumber}}</td>
          </tr>
          <tr>
            <td style="padding:1px 12px 1px 0;white-space:nowrap;">Invoice Date</td>
            <td style="padding:1px 0;color:#1e3a5f;font-weight:600;">{{Invoice.invoiceDateLabel}}</td>
          </tr>
          <tr>
            <td style="padding:1px 12px 1px 0;white-space:nowrap;">Due Date</td>
            <td style="padding:1px 0;color:#1e3a5f;font-weight:600;">{{Invoice.dueDateLabel}}</td>
          </tr>
          <tr>
            <td style="padding:1px 12px 1px 0;white-space:nowrap;">Payment Terms</td>
            <td style="padding:1px 0;color:#1e3a5f;font-weight:600;">{{Seller.paymentTerms}}</td>
          </tr>
          <tr>
            <td style="padding:1px 12px 1px 0;white-space:nowrap;">Subscription Period</td>
            <td style="padding:1px 0;color:#1e3a5f;font-weight:600;">{{Invoice.periodLabel}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <tr>
      <td style="vertical-align:top;width:50%;padding-right:20px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#8fa3b8;margin-bottom:8px;">BILL TO</div>
        <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:4px;">{{Invoice.customerName}}</div>
        <div style="font-size:11px;color:#5a6f86;margin-bottom:2px;">{{Invoice.customerAttn}}</div>
        <div style="font-size:11px;color:#5a6f86;margin-bottom:2px;">{{Invoice.customerAddress}}</div>
        <div style="font-size:11px;color:#5a6f86;">GSTIN: {{Invoice.customerGstin}}</div>
      </td>
      <td style="vertical-align:top;width:50%;padding-left:20px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#8fa3b8;margin-bottom:8px;">FROM</div>
        <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:4px;">{{Seller.legalName}}</div>
        <div style="font-size:11px;color:#5a6f86;margin-bottom:2px;">{{Seller.address}}</div>
        <div style="font-size:11px;color:#5a6f86;margin-bottom:2px;">GSTIN: {{Seller.gstin}}</div>
        <div style="font-size:11px;color:#5a6f86;">PAN: {{Seller.pan}}</div>
      </td>
    </tr>
  </table>

  <div data-gjs-type="arivu-line-item" data-line-item="true" data-line-item-bindings="${lineBindings}" class="arivu-line-item-block" style="width:100%;margin-bottom:20px;"></div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;padding-right:24px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;color:#8fa3b8;margin-bottom:6px;">AMOUNT IN WORDS</div>
        <div style="font-size:11px;color:#5a6f86;font-style:italic;">{{Invoice.amountInWords}}</div>
      </td>
      <td style="vertical-align:top;width:240px;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <tr>
            <td style="padding:4px 0;color:#8fa3b8;">Subtotal</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#1e3a5f;">{{Invoice.subtotal|currency}}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#8fa3b8;">{{Invoice.cgstLabel}}</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#1e3a5f;">{{Invoice.cgstAmount|currency}}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#8fa3b8;">{{Invoice.sgstLabel}}</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#1e3a5f;">{{Invoice.sgstAmount|currency}}</td>
          </tr>
        </table>
        <div style="margin-top:8px;padding:10px 12px;background:#e8f1f8;border-radius:4px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-weight:700;color:#1e3a5f;">Total Due</td>
              <td style="text-align:right;font-size:16px;font-weight:800;color:#1e3a5f;">{{Invoice.amountDue|currency}}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <div style="background:#e8f1f8;border-radius:8px;padding:16px 18px;margin-bottom:28px;">
    <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:10px;">Payment Details</div>
    <table style="border-collapse:collapse;font-size:11px;color:#8fa3b8;">
      <tr>
        <td style="padding:2px 16px 2px 0;min-width:120px;">Bank Name</td>
        <td style="padding:2px 0;color:#1e3a5f;font-weight:600;">{{Seller.bankName}}</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;">Account Name</td>
        <td style="padding:2px 0;color:#1e3a5f;font-weight:600;">{{Seller.accountName}}</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;">Account Number</td>
        <td style="padding:2px 0;color:#1e3a5f;font-weight:600;">{{Seller.accountNumber}}</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;">IFSC Code</td>
        <td style="padding:2px 0;color:#1e3a5f;font-weight:600;">{{Seller.ifsc}}</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;">UPI ID</td>
        <td style="padding:2px 0;color:#1e3a5f;font-weight:600;">{{Seller.upiId}}</td>
      </tr>
    </table>
  </div>

  <table style="width:100%;border-collapse:collapse;border-top:1px solid #d7e0ea;">
    <tr>
      <td style="padding-top:14px;vertical-align:top;">
        <div style="font-size:12px;font-weight:700;color:#1e3a5f;">Thank you for choosing Arivu.</div>
        <div style="font-size:10px;color:#8fa3b8;margin-top:2px;">We look forward to supporting your journey.</div>
      </td>
      <td style="padding-top:14px;text-align:right;vertical-align:bottom;font-size:11px;color:#8fa3b8;">{{Seller.website}}</td>
    </tr>
  </table>
</div>
`.trim();
}

function buildCommercialTaxInvoiceCss() {
  return `
body { margin: 0; background: #fff; }
.arv-inv { box-sizing: border-box; }
`.trim();
}

module.exports = {
  buildCommercialTaxInvoiceHtml,
  buildCommercialTaxInvoiceCss,
  COMMERCIAL_TAX_INVOICE_SEED_TAG: 'tax-invoice-v5',
};
