'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const {
  recordCommercialInvoicePayment,
} = require('./paymentService');
const { INVOICE_STATUSES } = require('../../constants/commercialBilling');

function getRazorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID || null;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || null;
  return { keyId, keySecret, webhookSecret };
}

function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayKeys();
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }
  let Razorpay;
  try {
    Razorpay = require('razorpay');
  } catch {
    const err = new Error('razorpay package is not installed');
    err.code = 'RAZORPAY_NOT_INSTALLED';
    throw err;
  }
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId };
}

/**
 * Create a Razorpay Order for an unpaid commercial invoice (amount already in paise).
 */
async function createCommercialInvoiceCheckout({ organizationId, invoiceId }) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId?._id || organizationId));
  const invId = new mongoose.Types.ObjectId(String(invoiceId));

  const invoice = await BillingInvoice.findOne({ _id: invId, organizationId: orgId });
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'INVOICE_NOT_FOUND';
    throw err;
  }
  if (
    invoice.status !== INVOICE_STATUSES.FINALIZED
    && invoice.status !== INVOICE_STATUSES.PAST_DUE
  ) {
    const err = new Error('Only finalized or past_due invoices can be paid');
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  const alreadyPaid = Math.max(0, Number(invoice.amountPaidMinor) || 0);
  const remaining = Math.max(0, invoice.totalMinor - alreadyPaid);
  if (remaining <= 0) {
    const err = new Error('Invoice is already paid');
    err.code = 'INVOICE_ALREADY_PAID';
    throw err;
  }

  const { client, keyId } = getRazorpayClient();
  const order = await client.orders.create({
    amount: remaining,
    currency: String(invoice.currency || 'INR').toUpperCase(),
    receipt: String(invoice.invoiceNumber || invoice._id).slice(0, 40),
    notes: {
      purpose: 'commercial_billing',
      organizationId: String(orgId),
      billingInvoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber || '',
    },
  });

  return {
    provider: 'razorpay',
    keyId,
    orderId: order.id,
    amountMinor: remaining,
    currency: String(invoice.currency || 'INR').toUpperCase(),
    invoiceId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    name: `Arivu ${invoice.invoiceNumber}`,
    description: `Subscription invoice ${invoice.invoiceNumber}`,
  };
}

function verifyRazorpayPaymentSignature({ orderId, paymentId, signature }) {
  const { keySecret } = getRazorpayKeys();
  if (!keySecret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', keySecret).update(payload).digest('hex');
  return expected === signature;
}

function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  const { webhookSecret } = getRazorpayKeys();
  if (!webhookSecret || !signatureHeader) return false;
  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyString)
    .digest('hex');
  return expected === signatureHeader;
}

/**
 * Confirm checkout (client callback) or webhook capture → ledger payment.
 */
async function captureCommercialRazorpayPayment({
  organizationId,
  invoiceId,
  orderId,
  paymentId,
  signature = null,
  requireSignature = true,
  amountMinor = null,
  raw = null,
}) {
  if (requireSignature) {
    if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
      const err = new Error('Invalid Razorpay payment signature');
      err.code = 'RAZORPAY_SIGNATURE_INVALID';
      throw err;
    }
  }

  const orgId = organizationId
    ? new mongoose.Types.ObjectId(String(organizationId._id || organizationId))
    : null;

  const invoice = await BillingInvoice.findById(invoiceId);
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'INVOICE_NOT_FOUND';
    throw err;
  }
  if (orgId && String(invoice.organizationId) !== String(orgId)) {
    const err = new Error('Invoice organization mismatch');
    err.code = 'ORG_MISMATCH';
    throw err;
  }

  if (invoice.status === INVOICE_STATUSES.PAID) {
    return { alreadyPaid: true, invoice };
  }

  const alreadyPaid = Math.max(0, Number(invoice.amountPaidMinor) || 0);
  const remaining = Math.max(0, invoice.totalMinor - alreadyPaid);
  const payAmount = amountMinor != null
    ? Math.round(Number(amountMinor))
    : remaining;

  // After an unpaid revise, old Razorpay orders (wrong amount) must not capture.
  if (amountMinor != null && payAmount !== remaining) {
    const err = new Error('Invoice total changed — create a new checkout');
    err.code = 'INVOICE_AMOUNT_CHANGED';
    throw err;
  }

  return recordCommercialInvoicePayment({
    organizationId: invoice.organizationId,
    invoiceId: invoice._id,
    amountMinor: Math.min(payAmount, remaining),
    method: 'razorpay',
    providerReference: paymentId,
    notes: `Razorpay order ${orderId}`,
    metadata: {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      source: requireSignature ? 'checkout_confirm' : 'webhook',
      raw: raw || undefined,
    },
  });
}

/**
 * Handle Razorpay webhook payload for commercial invoices.
 */
async function handleCommercialRazorpayWebhook(rawBody, headers = {}) {
  const signature = headers['x-razorpay-signature'];
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    const err = new Error('Invalid Razorpay webhook signature');
    err.code = 'RAZORPAY_WEBHOOK_INVALID';
    throw err;
  }

  const body = typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
    ? JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody)
    : rawBody;

  const eventType = body.event;
  const payment = body.payload?.payment?.entity || null;
  if (!payment || !eventType) {
    return { handled: false, reason: 'no_payment_entity' };
  }

  const successEvents = new Set([
    'payment.captured',
    'payment.authorized',
    'order.paid',
  ]);
  if (!successEvents.has(eventType)) {
    return { handled: false, reason: 'ignored_event', eventType };
  }

  const notes = payment.notes || {};
  if (notes.purpose !== 'commercial_billing') {
    return { handled: false, reason: 'not_commercial' };
  }

  const invoiceId = notes.billingInvoiceId;
  const organizationId = notes.organizationId;
  if (!invoiceId) {
    return { handled: false, reason: 'missing_invoice' };
  }

  const result = await captureCommercialRazorpayPayment({
    organizationId,
    invoiceId,
    orderId: payment.order_id,
    paymentId: payment.id,
    requireSignature: false,
    amountMinor: payment.amount,
    raw: { eventType, providerEventId: body.id },
  });

  return { handled: true, eventType, ...result };
}

module.exports = {
  createCommercialInvoiceCheckout,
  captureCommercialRazorpayPayment,
  handleCommercialRazorpayWebhook,
  verifyRazorpayPaymentSignature,
  getRazorpayKeys,
};
