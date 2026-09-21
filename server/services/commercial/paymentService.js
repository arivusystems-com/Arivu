'use strict';

const mongoose = require('mongoose');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingPayment = require('../../models/commercial/BillingPayment');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const {
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  SUBSCRIPTION_STATUSES,
} = require('../../constants/commercialBilling');
const { restoreSubscriptionIfCurrent } = require('./dunningService');
const { restoreInstanceAfterBilling } = require('./instanceBillingLifecycle');

/**
 * Record a succeeded payment against a finalized commercial invoice.
 * Full payment → status paid. Partial → stays finalized/past_due with amountPaidMinor.
 */
async function recordCommercialInvoicePayment({
  organizationId,
  invoiceId,
  amountMinor,
  method = 'manual',
  providerReference = null,
  notes = '',
  recordedByUserId = null,
  paidAt = null,
  metadata = {},
  status = PAYMENT_STATUSES.SUCCEEDED,
}) {
  const orgId = new mongoose.Types.ObjectId(String(organizationId?._id || organizationId));
  const invId = new mongoose.Types.ObjectId(String(invoiceId));

  if (providerReference && status === PAYMENT_STATUSES.SUCCEEDED) {
    const existingPay = await BillingPayment.findOne({
      providerReference: String(providerReference),
      status: PAYMENT_STATUSES.SUCCEEDED,
    });
    if (existingPay) {
      const invoice = await BillingInvoice.findById(existingPay.invoiceId);
      return { payment: existingPay, invoice, duplicate: true };
    }
  }

  const invoice = await BillingInvoice.findOne({ _id: invId, organizationId: orgId });
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  if (invoice.status === INVOICE_STATUSES.DRAFT) {
    throw new Error('Finalize the invoice before recording payment');
  }
  if (invoice.status === INVOICE_STATUSES.VOID) {
    throw new Error('Cannot pay a void invoice');
  }
  if (invoice.status === INVOICE_STATUSES.PAID && status === PAYMENT_STATUSES.SUCCEEDED) {
    throw new Error('Invoice is already paid');
  }

  const amount = Math.round(Number(amountMinor));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amountMinor must be a positive integer');
  }

  const alreadyPaid = Math.max(0, Number(invoice.amountPaidMinor) || 0);
  const remaining = Math.max(0, invoice.totalMinor - alreadyPaid);
  if (status === PAYMENT_STATUSES.SUCCEEDED && amount > remaining) {
    throw new Error(`Payment exceeds remaining balance (${remaining} minor units)`);
  }

  let payment;
  try {
    payment = await BillingPayment.create({
      organizationId: orgId,
      invoiceId: invId,
      amountMinor: amount,
      currency: invoice.currency,
      method,
      status,
      providerReference: providerReference ? String(providerReference) : null,
      notes: notes || '',
      recordedByUserId: recordedByUserId || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      metadata,
    });
  } catch (err) {
    if (err?.code === 11000 && providerReference) {
      const existingPay = await BillingPayment.findOne({
        providerReference: String(providerReference),
        status: PAYMENT_STATUSES.SUCCEEDED,
      });
      if (existingPay) {
        const inv = await BillingInvoice.findById(existingPay.invoiceId);
        return { payment: existingPay, invoice: inv, duplicate: true };
      }
    }
    throw err;
  }

  if (status !== PAYMENT_STATUSES.SUCCEEDED) {
    return { payment, invoice, duplicate: false };
  }

  const nextPaid = alreadyPaid + amount;
  invoice.amountPaidMinor = nextPaid;
  if (nextPaid >= invoice.totalMinor) {
    invoice.status = INVOICE_STATUSES.PAID;
    invoice.paidAt = payment.paidAt;
  } else if (invoice.status !== INVOICE_STATUSES.PAST_DUE) {
    invoice.status = INVOICE_STATUSES.FINALIZED;
  }
  await invoice.save();

  if (invoice.status === INVOICE_STATUSES.PAID && invoice.subscriptionId) {
    await restoreSubscriptionIfCurrent(invoice.subscriptionId);
    const sub = await BillingSubscription.findById(invoice.subscriptionId);
    if (sub && sub.status === SUBSCRIPTION_STATUSES.PAYMENT_PENDING) {
      sub.status = SUBSCRIPTION_STATUSES.ACTIVE;
      await sub.save();
    }
    await restoreInstanceAfterBilling(orgId);
    if (invoice.snapshot?.kind === 'proration') {
      try {
        await restoreProrationHolds(invoice);
      } catch (err) {
        console.warn('[payment] restore proration holds failed', err.message);
      }
    }
  }

  return { payment, invoice, duplicate: false };
}

async function restoreProrationHolds(invoice) {
  const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
  const lines = await require('../../models/commercial/BillingInvoiceLine').find({
    invoiceId: invoice._id,
  }).lean();
  for (const line of lines) {
    if (!line.subscriptionItemId) continue;
    const item = await BillingSubscriptionItem.findById(line.subscriptionItemId);
    if (!item?.metadata?.paymentHold) continue;
    const held = Math.max(0, Number(item.metadata.paymentHold.heldQuantity) || 0);
    if (held > 0) {
      item.quantity = (item.quantity || 0) + held;
    }
    delete item.metadata.paymentHold;
    item.markModified('metadata');
    await item.save();
  }
}

/**
 * Customer submits offline payment proof (awaiting admin verification).
 */
async function submitManualPaymentProof(params) {
  const orgId = new mongoose.Types.ObjectId(String(params.organizationId?._id || params.organizationId));
  const invoice = await BillingInvoice.findOne({
    _id: params.invoiceId,
    organizationId: orgId,
  });
  if (!invoice) throw new Error('Invoice not found');
  if (![INVOICE_STATUSES.FINALIZED, INVOICE_STATUSES.PAST_DUE].includes(invoice.status)) {
    throw new Error('Invoice is not payable');
  }

  const existing = await BillingPayment.findOne({
    invoiceId: invoice._id,
    status: PAYMENT_STATUSES.SUBMITTED,
  });
  if (existing) {
    throw new Error('A payment proof is already pending verification');
  }

  const amount = params.payInFull
    ? Math.max(0, invoice.totalMinor - (invoice.amountPaidMinor || 0))
    : Math.round(Number(params.amountMinor));

  return recordCommercialInvoicePayment({
    organizationId: orgId,
    invoiceId: invoice._id,
    amountMinor: amount,
    method: params.method || 'bank_transfer',
    providerReference: params.utr || params.providerReference || null,
    notes: params.notes || '',
    recordedByUserId: params.recordedByUserId || null,
    paidAt: params.paidAt || new Date(),
    status: PAYMENT_STATUSES.SUBMITTED,
    metadata: {
      proofUrl: params.proofUrl || null,
      bankDetails: params.bankDetails || null,
      submittedAt: new Date().toISOString(),
      ...(params.metadata || {}),
    },
  });
}

/**
 * Platform admin approves a submitted payment proof.
 */
async function approveManualPayment(params) {
  const payment = await BillingPayment.findById(params.paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== PAYMENT_STATUSES.SUBMITTED) {
    throw new Error('Payment is not awaiting verification');
  }

  payment.status = PAYMENT_STATUSES.SUCCEEDED;
  payment.metadata = {
    ...(payment.metadata || {}),
    approvedByUserId: params.approvedByUserId
      ? String(params.approvedByUserId)
      : null,
    approvedAt: new Date().toISOString(),
    reviewNotes: params.notes || '',
  };
  await payment.save();

  const invoice = await BillingInvoice.findById(payment.invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const alreadyPaid = Math.max(0, Number(invoice.amountPaidMinor) || 0);
  const nextPaid = alreadyPaid + payment.amountMinor;
  invoice.amountPaidMinor = nextPaid;
  if (nextPaid >= invoice.totalMinor) {
    invoice.status = INVOICE_STATUSES.PAID;
    invoice.paidAt = payment.paidAt || new Date();
  }
  await invoice.save();

  if (invoice.status === INVOICE_STATUSES.PAID && invoice.subscriptionId) {
    await restoreSubscriptionIfCurrent(invoice.subscriptionId);
    const sub = await BillingSubscription.findById(invoice.subscriptionId);
    if (sub && sub.status === SUBSCRIPTION_STATUSES.PAYMENT_PENDING) {
      sub.status = SUBSCRIPTION_STATUSES.ACTIVE;
      await sub.save();
    }
    await restoreInstanceAfterBilling(invoice.organizationId);
    if (invoice.snapshot?.kind === 'proration') {
      try {
        await restoreProrationHolds(invoice);
      } catch (err) {
        console.warn('[approve] restore proration holds failed', err.message);
      }
    }
  }

  return { payment, invoice };
}

/**
 * Platform admin rejects a submitted payment proof.
 */
async function rejectManualPayment(params) {
  const payment = await BillingPayment.findById(params.paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== PAYMENT_STATUSES.SUBMITTED) {
    throw new Error('Payment is not awaiting verification');
  }
  payment.status = PAYMENT_STATUSES.REJECTED;
  payment.metadata = {
    ...(payment.metadata || {}),
    rejectedByUserId: params.rejectedByUserId
      ? String(params.rejectedByUserId)
      : null,
    rejectedAt: new Date().toISOString(),
    reviewNotes: params.notes || '',
  };
  await payment.save();
  return { payment };
}

async function listPaymentsForInvoice(invoiceId, organizationId) {
  return BillingPayment.find({
    invoiceId: new mongoose.Types.ObjectId(String(invoiceId)),
    organizationId: new mongoose.Types.ObjectId(String(organizationId?._id || organizationId)),
  })
    .sort({ paidAt: -1 })
    .lean();
}

module.exports = {
  recordCommercialInvoicePayment,
  listPaymentsForInvoice,
  submitManualPaymentProof,
  approveManualPayment,
  rejectManualPayment,
};
