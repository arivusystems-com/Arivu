'use strict';

const { CONTENT_COMPONENT_TYPES } = require('./contentComponentRegistry');

function buildQuoteTemplateDefinition() {
  return {
    id: 'quote-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Quote',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'quote-title',
        type: CONTENT_COMPONENT_TYPES.HEADING,
        bindings: { level: 1, text: 'Quote {{Quote.quoteNumber}}' },
        style: { typography: { fontSize: 24, fontWeight: 700, color: '#4f46e5' } }
      },
      {
        id: 'quote-meta',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Prepared for {{Quote.customerName}} on {{System.Today}}'
        },
        style: { typography: { color: '#374151' } }
      },
      {
        id: 'quote-total-label',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Grand Total' },
        style: { typography: { fontWeight: 700, marginTop: 12 } }
      },
      {
        id: 'quote-total',
        type: CONTENT_COMPONENT_TYPES.MERGE_TAG,
        bindings: { path: 'Quote.grandTotal', format: 'currency' },
        style: { typography: { fontSize: 18, fontWeight: 700 } }
      },
      {
        id: 'quote-lines-table',
        type: CONTENT_COMPONENT_TYPES.TABLE,
        bindings: {
          collection: 'lines',
          columns: [
            { header: 'Description', path: 'description' },
            { header: 'Qty', path: 'quantity' },
            { header: 'Unit Price', path: 'unitPrice', format: 'currency' },
            { header: 'Line Total', path: 'lineTotal', format: 'currency' }
          ]
        }
      }
    ]
  };
}

function buildInvoiceTemplateDefinition() {
  return {
    id: 'invoice-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Invoice',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'invoice-title',
        type: CONTENT_COMPONENT_TYPES.HEADING,
        bindings: { level: 1, text: 'Invoice {{Invoice.invoiceNumber}}' },
        style: { typography: { fontSize: 24, fontWeight: 700, color: '#111827' } }
      },
      {
        id: 'invoice-meta',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Bill to {{Invoice.customerName}} · Due {{Invoice.dueDate|date}}'
        }
      },
      {
        id: 'invoice-total',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Amount Due: {{Invoice.amountDue|currency}}' },
        style: { typography: { fontWeight: 700, fontSize: 16 } }
      },
      {
        id: 'invoice-lines-table',
        type: CONTENT_COMPONENT_TYPES.TABLE,
        bindings: {
          collection: 'lines',
          columns: [
            { header: 'Description', path: 'description' },
            { header: 'Qty', path: 'quantity' },
            { header: 'Unit Price', path: 'unitPrice', format: 'currency' },
            { header: 'Line Total', path: 'lineTotal', format: 'currency' }
          ]
        }
      }
    ]
  };
}

function buildBillingInvoiceTemplateDefinition() {
  const { htmlToGrapesDefinition } = require('../services/contentPlatform/htmlToGrapesDefinition');
  const {
    buildCommercialTaxInvoiceHtml,
    buildCommercialTaxInvoiceCss,
  } = require('./commercialBillingInvoiceTemplateHtml');

  return htmlToGrapesDefinition({
    html: buildCommercialTaxInvoiceHtml(),
    css: buildCommercialTaxInvoiceCss(),
  });
}

function buildSalesReceiptTemplateDefinition() {
  return {
    id: 'receipt-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Sales Receipt',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'receipt-title',
        type: CONTENT_COMPONENT_TYPES.HEADING,
        bindings: { level: 1, text: 'Payment Receipt' },
        style: { typography: { fontSize: 22, fontWeight: 700, color: '#111827' } }
      },
      {
        id: 'receipt-org',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: '{{Organization.name}}' },
        style: { typography: { color: '#6b7280' } }
      },
      {
        id: 'receipt-meta',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Received from {{Invoice.customerName}} on {{System.Today|date}}'
        }
      },
      {
        id: 'receipt-amount-label',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Amount Paid' },
        style: { typography: { fontWeight: 700, marginTop: 16 } }
      },
      {
        id: 'receipt-amount',
        type: CONTENT_COMPONENT_TYPES.MERGE_TAG,
        bindings: { path: 'Invoice.amountDue', format: 'currency' },
        style: { typography: { fontSize: 20, fontWeight: 700, color: '#059669' } }
      },
      {
        id: 'receipt-thanks',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Thank you for your payment.' },
        style: { typography: { marginTop: 24, color: '#374151' } }
      }
    ]
  };
}

function buildPurchaseOrderTemplateDefinition() {
  return {
    id: 'po-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Purchase Order',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'po-title',
        type: CONTENT_COMPONENT_TYPES.HEADING,
        bindings: { level: 1, text: 'Purchase Order' },
        style: { typography: { fontSize: 24, fontWeight: 700, color: '#111827' } }
      },
      {
        id: 'po-meta',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: '{{Organization.name}} · Date {{System.Today|date}}'
        },
        style: { typography: { color: '#374151' } }
      },
      {
        id: 'po-vendor',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Vendor: {{Organization.name}}' }
      },
      {
        id: 'po-lines-table',
        type: CONTENT_COMPONENT_TYPES.TABLE,
        bindings: {
          collection: 'lines',
          columns: [
            { header: 'Item', path: 'description' },
            { header: 'Qty', path: 'quantity' },
            { header: 'Unit Cost', path: 'unitPrice', format: 'currency' },
            { header: 'Total', path: 'lineTotal', format: 'currency' }
          ]
        }
      },
      {
        id: 'po-total',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Order Total: {{Quote.grandTotal|currency}}' },
        style: { typography: { fontWeight: 700, fontSize: 16, marginTop: 12 } }
      },
      {
        id: 'po-notes',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Please deliver to the address on file. Reference this PO on all invoices.'
        },
        style: { typography: { marginTop: 24, color: '#6b7280', fontSize: 11 } }
      }
    ]
  };
}

function buildPurchaseReturnTemplateDefinition() {
  return {
    id: 'pr-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Purchase Return',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'pr-title',
        type: CONTENT_COMPONENT_TYPES.HEADING,
        bindings: { level: 1, text: 'Purchase Return' },
        style: { typography: { fontSize: 24, fontWeight: 700, color: '#111827' } }
      },
      {
        id: 'pr-meta',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: '{{CurrentOrganization.name}} · {{System.Today|date}}'
        },
        style: { typography: { color: '#374151' } }
      },
      {
        id: 'pr-number',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Return #: {{PurchaseReturns.purchaseReturnNumber}} · {{PurchaseReturns.subject}}'
        }
      },
      {
        id: 'pr-vendor',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Vendor: {{Organization.name}}' }
      },
      {
        id: 'pr-reason',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Reason: {{PurchaseReturns.returnReason}}'
        }
      },
      {
        id: 'pr-lines-table',
        type: CONTENT_COMPONENT_TYPES.TABLE,
        bindings: {
          collection: 'lines',
          columns: [
            { header: 'Item', path: 'description' },
            { header: 'Return qty', path: 'quantity' },
            { header: 'Unit price', path: 'unitPrice', format: 'currency' },
            { header: 'Line total', path: 'lineTotal', format: 'currency' },
            { header: 'Reason', path: 'returnReason' }
          ]
        }
      },
      {
        id: 'pr-total',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Return total: {{PurchaseReturns.grandTotal|currency}}' },
        style: { typography: { fontWeight: 700, fontSize: 16, marginTop: 12 } }
      },
      {
        id: 'pr-notes',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'Please process this return against the referenced purchase documents.'
        },
        style: { typography: { marginTop: 24, color: '#6b7280', fontSize: 11 } }
      }
    ]
  };
}

function buildSimpleLetterTemplateDefinition() {
  return {
    id: 'letter-root',
    type: CONTENT_COMPONENT_TYPES.PAGE,
    name: 'Simple Letter',
    layout: {},
    style: {},
    bindings: {},
    visibility: {},
    children: [
      {
        id: 'letter-date',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: '{{System.Today|date}}' },
        style: { typography: { textAlign: 'right' } }
      },
      {
        id: 'letter-greeting',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Dear {{CurrentUser.firstName}},' }
      },
      {
        id: 'letter-body',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: {
          text: 'This letter confirms activity for {{Organization.name}}. Please contact us if you have any questions.'
        }
      },
      {
        id: 'letter-signoff',
        type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
        bindings: { text: 'Sincerely,\n{{Organization.name}}' },
        style: { typography: { marginTop: 24 } }
      }
    ]
  };
}

const SEED_TEMPLATES = [
  {
    key: 'quote-default',
    name: 'Quote — Default',
    description: 'Professional quote with line items and grand total.',
    purpose: 'quote',
    category: 'sales',
    moduleScope: 'quotes',
    outputFormat: 'pdf',
    jsonDefinition: buildQuoteTemplateDefinition()
  },
  {
    key: 'invoice-default',
    name: 'Invoice — Default',
    description: 'Invoice with due date, line items, and amount due.',
    purpose: 'invoice',
    category: 'finance',
    moduleScope: 'invoices',
    outputFormat: 'pdf',
    jsonDefinition: buildInvoiceTemplateDefinition()
  },
  {
    key: 'billing-invoice-default',
    name: 'Arivu SaaS Invoice — Default',
    description: 'Platform commercial BillingInvoice PDF (Arivu ops).',
    purpose: 'billing_invoice',
    category: 'platform',
    moduleScope: 'billing_invoices',
    outputFormat: 'pdf',
    jsonDefinition: buildBillingInvoiceTemplateDefinition()
  },
  {
    key: 'sales-receipt',
    name: 'Sales Receipt',
    description: 'Payment confirmation receipt for customers.',
    purpose: 'receipt',
    category: 'finance',
    moduleScope: 'invoices',
    outputFormat: 'pdf',
    jsonDefinition: buildSalesReceiptTemplateDefinition()
  },
  {
    key: 'purchase-order',
    name: 'Purchase Order',
    description: 'Purchase order with vendor details and line items.',
    purpose: 'purchase_order',
    category: 'operations',
    moduleScope: 'purchase_orders',
    outputFormat: 'pdf',
    jsonDefinition: buildPurchaseOrderTemplateDefinition()
  },
  {
    key: 'purchase-return',
    name: 'Purchase Return',
    description: 'Purchase return with vendor details and return line items.',
    purpose: 'purchase_return',
    category: 'operations',
    moduleScope: 'purchase_returns',
    outputFormat: 'pdf',
    jsonDefinition: buildPurchaseReturnTemplateDefinition()
  },
  {
    key: 'simple-letter',
    name: 'Simple Letter',
    description: 'General correspondence letter with org branding.',
    purpose: 'letter',
    category: 'general',
    moduleScope: '',
    outputFormat: 'pdf',
    jsonDefinition: buildSimpleLetterTemplateDefinition()
  }
];

module.exports = {
  SEED_TEMPLATES,
  buildQuoteTemplateDefinition,
  buildInvoiceTemplateDefinition,
  buildBillingInvoiceTemplateDefinition,
  buildSalesReceiptTemplateDefinition,
  buildPurchaseOrderTemplateDefinition,
  buildPurchaseReturnTemplateDefinition,
  buildSimpleLetterTemplateDefinition
};
