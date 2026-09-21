'use strict';

const mongoose = require('mongoose');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingPayment = require('../../models/commercial/BillingPayment');
const BillingCreditNote = require('../../models/commercial/BillingCreditNote');
const BillingEvent = require('../../models/commercial/BillingEvent');
const {
  INVOICE_STATUSES,
  BILLING_EVENT_TYPES,
  BILLING_EVENT_STATUSES,
  PAYMENT_STATUSES,
} = require('../../constants/commercialBilling');

function toOrgId(organizationId) {
  return new mongoose.Types.ObjectId(String(organizationId));
}

function requireReason(reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) {
    throw new Error('A reason of at least 3 characters is required');
  }
  if (text.length > 500) {
    throw new Error('Reason is too long');
  }
  return text;
}

async function nextCreditNoteNumber(organizationId) {
  const year = new Date().getFullYear();
  const count = await BillingCreditNote.countDocuments({
    organizationId: toOrgId(organizationId),
  });
  const seq = String(count + 1).padStart(5, '0');
  return `CN-${year}-${seq}`;
}

async function recordOpsEvent({
  organizationId,
  type,
  idempotencyKey,
  payload,
  initiatedByUserId,
  result,
}) {
  try {
    await BillingEvent.create({
      organizationId: toOrgId(organizationId),
      type,
      idempotencyKey,
      payload: payload || {},
      status: BILLING_EVENT_STATUSES.PROCESSED,
      processedAt: new Date(),
      initiatedByUserId: initiatedByUserId || null,
      result: result || null,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return; // idempotent retry
    }
    throw err;
  }
}

/**
 * Apply goodwill / negotiated credit to subscription balance (next invoice).
 * Never mutates finalized invoices.
 */
async function adminApplySubscriptionCredit({
  organizationId,
  amountMinor,
  reason,
  initiatedByUserId,
  idempotencyKey,
}) {
  const orgId = toOrgId(organizationId);
  const amount = Math.round(Number(amountMinor) || 0);
  if (amount <= 0) throw new Error('Credit amount must be greater than zero');
  if (amount > 50_000_000) throw new Error('Credit amount exceeds ops limit');
  const reasonText = requireReason(reason);

  const subscription = await BillingSubscription.findOne({ organizationId: orgId });
  if (!subscription) throw new Error('Billing subscription missing');

  const key = idempotencyKey
    || `ops_credit:${orgId}:${amount}:${reasonText.slice(0, 40)}:${Date.now()}`;

  subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + amount;
  await subscription.save();

  const creditNote = await BillingCreditNote.create({
    organizationId: orgId,
    subscriptionId: subscription._id,
    invoiceId: null,
    creditNoteNumber: await nextCreditNoteNumber(orgId),
    amountMinor: amount,
    reason: reasonText,
    kind: 'goodwill',
    issuedByUserId: initiatedByUserId || null,
    metadata: { source: 'ops_apply_credit' },
  });

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_CREDIT_APPLIED,
    idempotencyKey: key,
    payload: { amountMinor: amount, reason: reasonText, creditNoteId: creditNote._id },
    initiatedByUserId,
    result: { creditBalanceMinor: subscription.creditBalanceMinor },
  });

  return {
    subscription,
    creditNote,
    creditBalanceMinor: subscription.creditBalanceMinor,
  };
}

/**
 * Void an unpaid finalized/past_due invoice. Optionally regenerate current-period invoice.
 */
async function adminVoidUnpaidInvoice({
  organizationId,
  invoiceId,
  reason,
  regenerate = false,
  initiatedByUserId,
}) {
  const orgId = toOrgId(organizationId);
  const reasonText = requireReason(reason);
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId: orgId,
  });
  if (!invoice) throw new Error('Invoice not found');

  if (invoice.status === INVOICE_STATUSES.VOID) {
    return { invoice, regenerated: null, alreadyVoid: true };
  }
  if (invoice.status === INVOICE_STATUSES.PAID) {
    throw new Error('Paid invoices cannot be voided — issue a credit note instead');
  }
  if (
    invoice.status !== INVOICE_STATUSES.FINALIZED
    && invoice.status !== INVOICE_STATUSES.PAST_DUE
    && invoice.status !== INVOICE_STATUSES.DRAFT
  ) {
    throw new Error(`Cannot void invoice in status ${invoice.status}`);
  }
  if ((invoice.amountPaidMinor || 0) > 0) {
    throw new Error('Invoice has payments — issue a credit note instead of voiding');
  }

  const succeededPay = await BillingPayment.exists({
    invoiceId: invoice._id,
    status: PAYMENT_STATUSES.SUCCEEDED,
  });
  if (succeededPay) {
    throw new Error('Invoice has a succeeded payment — issue a credit note instead');
  }

  invoice.status = INVOICE_STATUSES.VOID;
  invoice.snapshot = {
    ...(invoice.snapshot || {}),
    void: {
      reason: reasonText,
      at: new Date().toISOString(),
      byUserId: initiatedByUserId ? String(initiatedByUserId) : null,
    },
  };
  invoice.markModified('snapshot');
  await invoice.save();

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_INVOICE_VOIDED,
    idempotencyKey: `ops_void:${invoice._id}:${Date.now()}`,
    payload: { invoiceId: invoice._id, reason: reasonText, regenerate: Boolean(regenerate) },
    initiatedByUserId,
    result: { status: invoice.status },
  });

  let regenerated = null;
  if (regenerate) {
    const { ensureFinalizedInvoiceForCurrentPeriod } = require('./invoiceService');
    regenerated = await ensureFinalizedInvoiceForCurrentPeriod(orgId);
  }

  return {
    invoice,
    regenerated: regenerated?.invoice || null,
    alreadyVoid: false,
  };
}

/**
 * Issue credit note against a paid (or partially paid) invoice → subscription credit.
 * Does not rewrite the source invoice.
 */
async function adminIssueCreditNote({
  organizationId,
  invoiceId,
  amountMinor,
  reason,
  initiatedByUserId,
  idempotencyKey,
}) {
  const orgId = toOrgId(organizationId);
  const reasonText = requireReason(reason);
  const amount = Math.round(Number(amountMinor) || 0);
  if (amount <= 0) throw new Error('Credit note amount must be greater than zero');

  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId: orgId,
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === INVOICE_STATUSES.VOID) {
    throw new Error('Cannot issue credit note against a void invoice');
  }
  if (invoice.status === INVOICE_STATUSES.DRAFT) {
    throw new Error('Finalize or void the draft — do not credit a draft');
  }

  const paid = Math.max(0, invoice.amountPaidMinor || 0);
  const isPaidStatus = invoice.status === INVOICE_STATUSES.PAID;
  if (!isPaidStatus && paid <= 0) {
    throw new Error('Unpaid invoices should be voided, not credited');
  }

  const maxCredit = isPaidStatus
    ? Math.max(paid, invoice.totalMinor || 0)
    : paid;
  if (amount > maxCredit) {
    throw new Error(`Credit note cannot exceed ${maxCredit} paise for this invoice`);
  }

  const subscription = await BillingSubscription.findOne({ organizationId: orgId });
  if (!subscription) throw new Error('Billing subscription missing');

  const key = idempotencyKey || `ops_cn:${invoice._id}:${amount}:${Date.now()}`;

  const creditNote = await BillingCreditNote.create({
    organizationId: orgId,
    subscriptionId: subscription._id,
    invoiceId: invoice._id,
    creditNoteNumber: await nextCreditNoteNumber(orgId),
    amountMinor: amount,
    reason: reasonText,
    kind: 'invoice_adjustment',
    issuedByUserId: initiatedByUserId || null,
    metadata: {
      sourceInvoiceNumber: invoice.invoiceNumber,
      sourceInvoiceTotalMinor: invoice.totalMinor,
    },
  });

  subscription.creditBalanceMinor = (subscription.creditBalanceMinor || 0) + amount;
  await subscription.save();

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_CREDIT_NOTE_ISSUED,
    idempotencyKey: key,
    payload: {
      invoiceId: invoice._id,
      creditNoteId: creditNote._id,
      amountMinor: amount,
      reason: reasonText,
    },
    initiatedByUserId,
    result: { creditBalanceMinor: subscription.creditBalanceMinor },
  });

  return {
    creditNote,
    subscription,
    creditBalanceMinor: subscription.creditBalanceMinor,
  };
}

/**
 * Schedule a one-shot discount for the next period invoice (sales deals).
 * amountMinor = 0 clears a pending discount.
 */
async function adminSetPendingDiscount({
  organizationId,
  amountMinor,
  reason,
  initiatedByUserId,
}) {
  const orgId = toOrgId(organizationId);
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (amount > 50_000_000) throw new Error('Discount amount exceeds ops limit');

  const subscription = await BillingSubscription.findOne({ organizationId: orgId });
  if (!subscription) throw new Error('Billing subscription missing');

  if (amount > 0) {
    const reasonText = requireReason(reason);
    subscription.pendingDiscountMinor = amount;
    subscription.pendingDiscountReason = reasonText;
  } else {
    subscription.pendingDiscountMinor = 0;
    subscription.pendingDiscountReason = null;
  }
  await subscription.save();

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_PENDING_DISCOUNT_SET,
    idempotencyKey: `ops_pending_discount:${orgId}:${amount}:${Date.now()}`,
    payload: {
      pendingDiscountMinor: subscription.pendingDiscountMinor,
      pendingDiscountReason: subscription.pendingDiscountReason,
    },
    initiatedByUserId,
    result: {
      pendingDiscountMinor: subscription.pendingDiscountMinor,
    },
  });

  return {
    subscription,
    pendingDiscountMinor: subscription.pendingDiscountMinor,
    pendingDiscountReason: subscription.pendingDiscountReason,
  };
}

/**
 * Schedule a repeating per-period discount (sales multi-month deals).
 * amountMinor = 0 or periods = 0 clears. periods counted in billing cycles.
 */
async function adminSetRecurringDiscount({
  organizationId,
  amountMinor,
  periods,
  reason,
  initiatedByUserId,
}) {
  const orgId = toOrgId(organizationId);
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const periodCount = Math.max(0, Math.round(Number(periods) || 0));
  if (amount > 50_000_000) throw new Error('Discount amount exceeds ops limit');
  if (periodCount > 60) throw new Error('Recurring discount periods exceed ops limit (max 60)');

  const subscription = await BillingSubscription.findOne({ organizationId: orgId });
  if (!subscription) throw new Error('Billing subscription missing');

  if (amount > 0 && periodCount > 0) {
    const reasonText = requireReason(reason);
    subscription.recurringDiscountMinor = amount;
    subscription.recurringDiscountPeriodsRemaining = periodCount;
    subscription.recurringDiscountPeriodsTotal = periodCount;
    subscription.recurringDiscountReason = reasonText;
  } else {
    subscription.recurringDiscountMinor = 0;
    subscription.recurringDiscountPeriodsRemaining = 0;
    subscription.recurringDiscountPeriodsTotal = 0;
    subscription.recurringDiscountReason = null;
  }
  await subscription.save();

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_RECURRING_DISCOUNT_SET,
    idempotencyKey: `ops_recurring_discount:${orgId}:${amount}:${periodCount}:${Date.now()}`,
    payload: {
      recurringDiscountMinor: subscription.recurringDiscountMinor,
      recurringDiscountPeriodsRemaining: subscription.recurringDiscountPeriodsRemaining,
      recurringDiscountPeriodsTotal: subscription.recurringDiscountPeriodsTotal,
      recurringDiscountReason: subscription.recurringDiscountReason,
    },
    initiatedByUserId,
    result: {
      recurringDiscountMinor: subscription.recurringDiscountMinor,
      recurringDiscountPeriodsRemaining: subscription.recurringDiscountPeriodsRemaining,
    },
  });

  return {
    subscription,
    recurringDiscountMinor: subscription.recurringDiscountMinor,
    recurringDiscountPeriodsRemaining: subscription.recurringDiscountPeriodsRemaining,
    recurringDiscountPeriodsTotal: subscription.recurringDiscountPeriodsTotal,
    recurringDiscountReason: subscription.recurringDiscountReason,
  };
}

/**
 * Pure math for unpaid invoice revise (line + header discounts).
 * Line net = qty×unit − lineDiscount; subtotal = Σ line net;
 * then header discount → credit (capped) → tax → total.
 */
function computeRevisedInvoiceTotals({
  lines,
  invoiceDiscountMinor,
  creditAppliedMinor,
  taxEnabled = true,
  taxOverride = null,
}) {
  const { calculateCommercialTax } = require('./taxService');
  const revisedLines = (lines || []).map((line) => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const unit = Math.max(0, Math.round(Number(line.unitAmountMinor) || 0));
    const gross = qty * unit;
    const lineDiscount = Math.min(
      gross,
      Math.max(0, Math.round(Number(line.discountMinor) || 0))
    );
    return {
      ...line,
      discountMinor: lineDiscount,
      amountMinor: gross - lineDiscount,
    };
  });

  const subtotalMinor = revisedLines.reduce((sum, l) => sum + l.amountMinor, 0);
  const headerDiscount = Math.min(
    subtotalMinor,
    Math.max(0, Math.round(Number(invoiceDiscountMinor) || 0))
  );
  const credit = Math.min(
    Math.max(0, Math.round(Number(creditAppliedMinor) || 0)),
    Math.max(0, subtotalMinor - headerDiscount)
  );
  const taxableMinor = Math.max(0, subtotalMinor - headerDiscount - credit);
  const tax = taxEnabled === false
    ? calculateCommercialTax(taxableMinor, { enabled: false })
    : calculateCommercialTax(taxableMinor, taxOverride);
  const totalMinor = Math.max(0, taxableMinor + tax.taxMinor);

  return {
    lines: revisedLines,
    subtotalMinor,
    discountMinor: headerDiscount,
    creditAppliedMinor: credit,
    taxMinor: tax.taxMinor,
    taxDetails: tax.taxDetails,
    totalMinor,
  };
}

/**
 * In-place revise of an unpaid invoice (same invoiceNumber / _id).
 * Discounts only — qty, unit price, and products are not editable.
 */
async function adminReviseUnpaidInvoice({
  organizationId,
  invoiceId,
  lineDiscounts = [],
  invoiceDiscountMinor = 0,
  reason,
  initiatedByUserId,
  restoreMeta = null,
}) {
  const BillingInvoiceLine = require('../../models/commercial/BillingInvoiceLine');
  const orgId = toOrgId(organizationId);
  const reasonText = requireReason(reason);

  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId: orgId,
  });
  if (!invoice) throw new Error('Invoice not found');

  if (invoice.status === INVOICE_STATUSES.VOID) {
    throw new Error('Cannot revise a void invoice');
  }
  if (invoice.status === INVOICE_STATUSES.PAID) {
    throw new Error('Paid invoices cannot be revised — issue a credit note instead');
  }
  if (
    invoice.status !== INVOICE_STATUSES.FINALIZED
    && invoice.status !== INVOICE_STATUSES.PAST_DUE
    && invoice.status !== INVOICE_STATUSES.DRAFT
  ) {
    throw new Error(`Cannot revise invoice in status ${invoice.status}`);
  }
  if ((invoice.amountPaidMinor || 0) > 0) {
    throw new Error('Invoice has payments — issue a credit note instead of revising');
  }

  const succeededPay = await BillingPayment.exists({
    invoiceId: invoice._id,
    status: PAYMENT_STATUSES.SUCCEEDED,
  });
  if (succeededPay) {
    throw new Error('Invoice has a succeeded payment — issue a credit note instead');
  }

  const lines = await BillingInvoiceLine.find({
    invoiceId: invoice._id,
    organizationId: orgId,
  });
  if (!lines.length) throw new Error('Invoice has no lines');

  const discountByLineId = new Map();
  for (const entry of lineDiscounts || []) {
    const id = String(entry.lineId || entry._id || '');
    if (!id) continue;
    discountByLineId.set(id, Math.max(0, Math.round(Number(entry.discountMinor) || 0)));
  }

  const before = {
    subtotalMinor: invoice.subtotalMinor,
    discountMinor: invoice.discountMinor,
    creditAppliedMinor: invoice.creditAppliedMinor,
    taxMinor: invoice.taxMinor,
    totalMinor: invoice.totalMinor,
    lines: lines.map((l) => ({
      lineId: String(l._id),
      productCode: l.productCode,
      quantity: l.quantity,
      unitAmountMinor: l.unitAmountMinor,
      discountMinor: l.discountMinor || 0,
      amountMinor: l.amountMinor,
    })),
  };

  const lineInputs = lines.map((l) => ({
    _id: l._id,
    quantity: l.quantity,
    unitAmountMinor: l.unitAmountMinor,
    discountMinor: discountByLineId.has(String(l._id))
      ? discountByLineId.get(String(l._id))
      : (l.discountMinor || 0),
  }));

  const notBillable = Boolean(invoice.snapshot?.sandboxInternal || invoice.snapshot?.notBillable);
  const computed = computeRevisedInvoiceTotals({
    lines: lineInputs,
    invoiceDiscountMinor,
    creditAppliedMinor: invoice.creditAppliedMinor || 0,
    taxEnabled: !notBillable,
  });

  if (computed.discountMinor > 50_000_000) {
    throw new Error('Invoice discount exceeds ops limit');
  }

  const {
    getInvoiceRevisionMeta,
  } = require('./invoiceRevisionMeta');
  const fromMeta = getInvoiceRevisionMeta(invoice);

  const revision = {
    at: new Date().toISOString(),
    byUserId: initiatedByUserId ? String(initiatedByUserId) : null,
    reason: reasonText,
    before,
  };
  if (restoreMeta && restoreMeta.targetVersion != null) {
    revision.restore = {
      fromVersion: Number(restoreMeta.fromVersion) || fromMeta.currentVersion,
      targetVersion: Number(restoreMeta.targetVersion),
    };
  }

  const snapshot = { ...(invoice.snapshot || {}) };
  const revisions = Array.isArray(snapshot.revisions) ? [...snapshot.revisions] : [];
  revisions.push(revision);
  snapshot.revisions = revisions;
  snapshot.checkoutInvalidatedAt = revision.at;
  snapshot.lastRevisedAt = revision.at;
  snapshot.lastRevisedReason = reasonText;

  const previousTotal = invoice.totalMinor;
  invoice.subtotalMinor = computed.subtotalMinor;
  invoice.discountMinor = computed.discountMinor;
  invoice.creditAppliedMinor = computed.creditAppliedMinor;
  invoice.taxMinor = computed.taxMinor;
  invoice.taxDetails = computed.taxDetails;
  invoice.totalMinor = computed.totalMinor;
  invoice.snapshot = snapshot;
  invoice.markModified('snapshot');
  await invoice.save();

  const lineById = new Map(computed.lines.map((l) => [String(l._id), l]));
  for (const line of lines) {
    const next = lineById.get(String(line._id));
    if (!next) continue;
    line.discountMinor = next.discountMinor;
    line.amountMinor = next.amountMinor;
    await line.save();
  }

  // Invalidate open (non-succeeded) payment attempts so checkout must be recreated.
  if (previousTotal !== computed.totalMinor) {
    await BillingPayment.updateMany(
      {
        invoiceId: invoice._id,
        status: { $in: [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.SUBMITTED] },
      },
      {
        $set: {
          status: PAYMENT_STATUSES.FAILED,
          notes: `Invalidated: invoice revised (${reasonText})`,
        },
      }
    );
  }

  await recordOpsEvent({
    organizationId: orgId,
    type: BILLING_EVENT_TYPES.OPS_INVOICE_REVISED,
    idempotencyKey: `ops_revise:${invoice._id}:${revision.at}`,
    payload: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      reason: reasonText,
      invoiceDiscountMinor: computed.discountMinor,
      lineDiscounts: computed.lines.map((l) => ({
        lineId: String(l._id),
        discountMinor: l.discountMinor,
      })),
      beforeTotalMinor: before.totalMinor,
      afterTotalMinor: computed.totalMinor,
      revisionIndex: revisions.length - 1,
      restore: revision.restore || null,
    },
    initiatedByUserId,
    result: {
      totalMinor: invoice.totalMinor,
      revisionCount: revisions.length,
      currentVersion: revisions.length + 1,
    },
  });

  const refreshedLines = await BillingInvoiceLine.find({
    invoiceId: invoice._id,
    organizationId: orgId,
  }).lean();

  return {
    invoice,
    lines: refreshedLines,
    revision,
    revisionCount: revisions.length,
    currentVersion: revisions.length + 1,
  };
}

/**
 * Restore an unpaid invoice to a prior version by applying that version's
 * discounts as a new revise (append-only audit).
 */
async function adminRestoreInvoiceRevision({
  organizationId,
  invoiceId,
  targetVersion,
  reason,
  initiatedByUserId,
}) {
  const {
    getInvoiceRevisionMeta,
    getInvoiceVersionSnapshot,
  } = require('./invoiceRevisionMeta');

  const orgId = toOrgId(organizationId);
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId: orgId,
  }).lean();
  if (!invoice) throw new Error('Invoice not found');

  const meta = getInvoiceRevisionMeta(invoice);
  const target = Math.round(Number(targetVersion) || 0);
  if (target < 1 || target >= meta.currentVersion) {
    throw new Error(
      `Restore target must be between v1 and v${Math.max(1, meta.currentVersion - 1)}`
    );
  }

  const snapshot = getInvoiceVersionSnapshot(invoice, target);
  if (!snapshot) throw new Error('Revision snapshot not found for that version');

  const reasonText = requireReason(reason);
  const restoreReason = reasonText.toLowerCase().includes('restore')
    ? reasonText
    : `Restored to v${target}: ${reasonText}`;

  return adminReviseUnpaidInvoice({
    organizationId: orgId,
    invoiceId,
    lineDiscounts: (snapshot.lines || []).map((l) => ({
      lineId: l.lineId,
      discountMinor: l.discountMinor || 0,
    })),
    invoiceDiscountMinor: snapshot.discountMinor || 0,
    reason: restoreReason,
    initiatedByUserId,
    restoreMeta: {
      fromVersion: meta.currentVersion,
      targetVersion: target,
    },
  });
}

module.exports = {
  adminApplySubscriptionCredit,
  adminVoidUnpaidInvoice,
  adminIssueCreditNote,
  adminSetPendingDiscount,
  adminSetRecurringDiscount,
  adminReviseUnpaidInvoice,
  adminRestoreInvoiceRevision,
  computeRevisedInvoiceTotals,
};
