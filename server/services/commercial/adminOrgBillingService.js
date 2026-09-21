'use strict';

const mongoose = require('mongoose');
const Organization = require('../../models/Organization');
const Instance = require('../../models/Instance');
const BillingSubscription = require('../../models/commercial/BillingSubscription');
const BillingSubscriptionItem = require('../../models/commercial/BillingSubscriptionItem');
const BillingInvoice = require('../../models/commercial/BillingInvoice');
const BillingInvoiceLine = require('../../models/commercial/BillingInvoiceLine');
const BillingPayment = require('../../models/commercial/BillingPayment');
const BillingProduct = require('../../models/commercial/BillingProduct');
const { runWithOrganizationTenantContext } = require('../../utils/organizationTenantContext');
const {
  ITEM_STATUSES,
  SUBSCRIPTION_STATUSES,
  BILLING_EVENT_TYPES,
  BILLING_EVENT_STATUSES,
} = require('../../constants/commercialBilling');
const {
  suspendInstanceForBilling,
} = require('./instanceBillingLifecycle');
const { recordCommercialInvoicePayment } = require('./paymentService');

function toOrgId(organizationId) {
  return new mongoose.Types.ObjectId(String(organizationId));
}

async function assertCustomerBillingOrg(organizationId) {
  const orgId = toOrgId(organizationId);
  const [instance, subscription] = await Promise.all([
    Instance.findOne({ organizationId: orgId }).select('isInternal').lean(),
    BillingSubscription.findOne({ organizationId: orgId }).select('metadata').lean(),
  ]);
  if (
    instance?.isInternal
    || subscription?.metadata?.sandboxInternal
    || subscription?.metadata?.notBillable
  ) {
    throw new Error(
      'This organization is a commercial sandbox (internal / not billable). Instance suspend, restore, and status overrides are disabled.'
    );
  }
  return orgId;
}

function isSandboxBillingOrg({ instance, subscription }) {
  return Boolean(
    instance?.isInternal
    || subscription?.metadata?.sandboxInternal
    || subscription?.metadata?.notBillable
  );
}

/**
 * Full platform-admin org commercial billing dossier.
 */
async function getAdminOrganizationBilling(organizationId) {
  const orgId = toOrgId(organizationId);
  const organization = await Organization.findById(orgId)
    .select('name companyName gstin billingAddressStructured enabledApps database')
    .lean();
  if (!organization) {
    throw new Error('Organization not found');
  }

  const BillingCreditNote = require('../../models/commercial/BillingCreditNote');
  const [instance, subscription, items, invoices, payments, creditNotes] = await Promise.all([
    Instance.findOne({ organizationId: orgId }).lean(),
    BillingSubscription.findOne({ organizationId: orgId }).lean(),
    BillingSubscriptionItem.find({
      organizationId: orgId,
      status: ITEM_STATUSES.ACTIVE,
      quantity: { $gt: 0 },
    }).lean(),
    BillingInvoice.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    BillingPayment.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    BillingCreditNote.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  const invoiceIds = invoices.map((i) => i._id);
  const lines = invoiceIds.length
    ? await BillingInvoiceLine.find({ invoiceId: { $in: invoiceIds } }).lean()
    : [];
  const linesByInvoice = {};
  for (const line of lines) {
    const key = String(line.invoiceId);
    if (!linesByInvoice[key]) linesByInvoice[key] = [];
    linesByInvoice[key].push(line);
  }

  const products = await BillingProduct.find({
    code: { $in: items.map((i) => i.productCode) },
  }).lean();
  const nameByCode = Object.fromEntries(products.map((p) => [p.code, p.name]));

  const itemSummaries = items.map((item) => ({
    ...item,
    name: nameByCode[item.productCode] || item.productCode,
    lineTotalMinor: (item.unitAmountMinor || 0) * (item.quantity || 0),
  }));

  const recurringTotalMinor = itemSummaries.reduce(
    (sum, i) => sum + (i.lineTotalMinor || 0),
    0
  );

  const isSandbox = isSandboxBillingOrg({ instance, subscription });
  const creditBalanceMinor = subscription?.creditBalanceMinor || 0;
  const taxableMinor = Math.max(0, recurringTotalMinor - creditBalanceMinor);
  const { calculateCommercialTax } = require('./taxService');
  const tax = calculateCommercialTax(taxableMinor, { enabled: !isSandbox });
  const taxEstimate = {
    subtotalMinor: recurringTotalMinor,
    creditMinor: creditBalanceMinor,
    taxableMinor,
    taxMinor: tax.taxMinor,
    totalMinor: taxableMinor + tax.taxMinor,
    taxName: tax.name,
    taxRatePercent: tax.taxDetails?.ratePercent || 0,
  };

  let users = [];
  let addons = [];
  try {
    await runWithOrganizationTenantContext(orgId, async () => {
      const User = require('../../models/User');
      const OrganizationSubscription = require('../../models/OrganizationSubscription');
      users = await User.find({
        organizationId: orgId,
        status: { $in: ['active', 'invited', 'inactive', 'suspended'] },
      })
        .select('firstName lastName email status userType role appAccess isOwner')
        .limit(500)
        .lean();
      const orgSub = await OrganizationSubscription.findOne({ organizationId: orgId }).lean();
      addons = Array.isArray(orgSub?.addons) ? orgSub.addons : [];
    });
  } catch (err) {
    console.warn('[adminOrgBilling] tenant load failed', err.message);
  }

  const userRows = users.map((u) => {
    const access = Array.isArray(u.appAccess) ? u.appAccess : [];
    const apps = access
      .filter((a) => String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((a) => String(a.appKey || '').toUpperCase())
      .filter(Boolean);
    return {
      _id: u._id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      email: u.email,
      status: u.status,
      userType: u.userType,
      role: u.role,
      isOwner: Boolean(u.isOwner),
      apps,
    };
  });

  return {
    organization: {
      _id: organization._id,
      name: organization.name,
      companyName: organization.companyName || organization.name,
      gstin: organization.gstin || null,
      billingAddressStructured: organization.billingAddressStructured || null,
      enabledApps: organization.enabledApps || [],
    },
    instance: instance
      ? {
        _id: instance._id,
        status: instance.status,
        suspendedAt: instance.suspendedAt || null,
        activatedAt: instance.activatedAt || null,
        isInternal: Boolean(instance.isInternal),
      }
      : null,
    subscription: subscription || null,
    items: itemSummaries,
    recurringTotalMinor,
    taxEstimate,
    invoices: invoices.map((inv) => ({
      ...inv,
      lines: linesByInvoice[String(inv._id)] || [],
    })),
    payments,
    creditNotes,
    creditBalanceMinor,
    pendingDiscountMinor: subscription?.pendingDiscountMinor || 0,
    pendingDiscountReason: subscription?.pendingDiscountReason || null,
    recurringDiscountMinor: subscription?.recurringDiscountMinor || 0,
    recurringDiscountPeriodsRemaining: subscription?.recurringDiscountPeriodsRemaining || 0,
    recurringDiscountPeriodsTotal: subscription?.recurringDiscountPeriodsTotal || 0,
    recurringDiscountReason: subscription?.recurringDiscountReason || null,
    users: userRows,
    addons,
    isSandbox,
  };
}

async function adminSuspendOrganization(organizationId, reason = 'commercial_admin_suspend') {
  const orgId = await assertCustomerBillingOrg(organizationId);
  const sub = await BillingSubscription.findOne({ organizationId: orgId });
  if (sub && sub.status === SUBSCRIPTION_STATUSES.ACTIVE) {
    sub.status = SUBSCRIPTION_STATUSES.PAST_DUE;
    await sub.save();
  }
  const instance = await suspendInstanceForBilling(orgId, reason);
  return { subscription: sub, instance };
}

async function adminRestoreOrganization(organizationId) {
  await assertCustomerBillingOrg(organizationId);
  const orgId = toOrgId(organizationId);
  const sub = await BillingSubscription.findOne({ organizationId: orgId });
  if (
    sub
    && (sub.status === SUBSCRIPTION_STATUSES.PAST_DUE
      || sub.status === SUBSCRIPTION_STATUSES.PAYMENT_PENDING)
  ) {
    const unpaid = await BillingInvoice.countDocuments({
      organizationId: orgId,
      status: 'past_due',
      'snapshot.kind': { $ne: 'proration' },
    });
    if (unpaid === 0) {
      sub.status = SUBSCRIPTION_STATUSES.ACTIVE;
      await sub.save();
    }
  }

  if (sub?.metadata) {
    delete sub.metadata.commercialSuspendReason;
    delete sub.metadata.instanceSuspendedAt;
    sub.markModified('metadata');
    await sub.save();
  }

  const InstanceModel = require('../../models/Instance');
  const { INSTANCE_STATUS } = require('../../constants/instanceLifecycle');
  const doc = await InstanceModel.findOne({ organizationId: orgId });
  if (doc && doc.status === INSTANCE_STATUS.SUSPENDED) {
    doc.status = INSTANCE_STATUS.ACTIVE;
    doc.suspendedAt = undefined;
    await doc.save();
    return { subscription: sub, instance: doc, forced: true };
  }

  return { subscription: sub, instance: doc };
}

async function adminMarkInvoicePaid({
  organizationId,
  invoiceId,
  recordedByUserId,
  notes = '',
  providerReference = null,
  proofUrl = null,
  proofFileName = null,
}) {
  const invoice = await BillingInvoice.findOne({
    _id: invoiceId,
    organizationId: toOrgId(organizationId),
  });
  if (!invoice) throw new Error('Invoice not found');
  const remaining = Math.max(
    0,
    invoice.totalMinor - (invoice.amountPaidMinor || 0)
  );
  if (remaining <= 0) {
    throw new Error('Invoice already paid');
  }
  const ref = String(providerReference || '').trim() || null;
  const noteText = String(notes || '').trim()
    || (ref ? `Marked paid by platform admin (ref: ${ref})` : 'Marked paid by platform admin');
  return recordCommercialInvoicePayment({
    organizationId,
    invoiceId,
    amountMinor: remaining,
    method: 'manual',
    providerReference: ref,
    notes: noteText,
    recordedByUserId,
    metadata: {
      opsMarkPaid: true,
      adminConsole: true,
      proofUrl: proofUrl || null,
      proofFileName: proofFileName || null,
    },
  });
}

async function adminUpdateSubscriptionStatus({ organizationId, status }) {
  await assertCustomerBillingOrg(organizationId);
  const allowed = new Set(Object.values(SUBSCRIPTION_STATUSES));
  if (!allowed.has(status)) {
    throw new Error('Invalid subscription status');
  }
  const sub = await BillingSubscription.findOne({ organizationId: toOrgId(organizationId) });
  if (!sub) throw new Error('Billing subscription missing');
  sub.status = status;
  if (status === SUBSCRIPTION_STATUSES.CANCELED) {
    sub.canceledAt = new Date();
    sub.cancelAtPeriodEnd = false;
  }
  if (status === SUBSCRIPTION_STATUSES.ACTIVE) {
    sub.canceledAt = null;
    sub.cancelAtPeriodEnd = false;
  }
  await sub.save();
  return sub;
}

async function adminUpdateBillingParty({
  organizationId,
  billing,
  reason,
  initiatedByUserId,
  auditAsOps = false,
  requireComplete = false,
}) {
  const orgId = toOrgId(organizationId);
  const {
    validateCommercialBillingParty,
    defaultBillingCountryFromOrg,
  } = require('./billingPartyValidation');

  const existing = await Organization.findById(orgId)
    .select('name companyName gstin gstRegistered billingEmail billingPhone billingAddressStructured settings')
    .lean();
  if (!existing) throw new Error('Organization not found');

  const mergedAddr = {
    ...(existing.billingAddressStructured || {}),
    ...(billing?.billingAddressStructured || {}),
  };
  if (!mergedAddr.country) {
    mergedAddr.country = defaultBillingCountryFromOrg(existing);
  }

  const candidate = {
    companyName: billing?.companyName != null ? billing.companyName : existing.companyName,
    gstin: billing?.gstin != null ? billing.gstin : existing.gstin,
    gstRegistered: billing?.gstRegistered != null ? billing.gstRegistered : existing.gstRegistered,
    billingEmail: billing?.billingEmail != null ? billing.billingEmail : existing.billingEmail,
    billingPhone: billing?.billingPhone != null ? billing.billingPhone : existing.billingPhone,
    billingAddressStructured: mergedAddr,
  };

  if (requireComplete) {
    const validated = validateCommercialBillingParty(candidate);
    if (!validated.ok) {
      const err = new Error(validated.message);
      err.code = validated.code;
      throw err;
    }
    Object.assign(candidate, validated.normalized);
  } else if (billing?.gstin != null || billing?.gstRegistered != null) {
    const { validateGstin } = require('../../utils/gstinValidator');
    const registered = Boolean(candidate.gstRegistered);
    const rawGstin = String(candidate.gstin || '').trim();
    if (registered || rawGstin) {
      const gst = validateGstin(rawGstin);
      if (!gst.ok) {
        const err = new Error(
          registered && !rawGstin
            ? 'GSTIN is required when the business is GST-registered.'
            : (gst.error || 'Enter a valid 15-character GSTIN.')
        );
        err.code = registered && !rawGstin ? 'GSTIN_REQUIRED' : 'GSTIN_INVALID';
        throw err;
      }
      candidate.gstin = gst.normalized;
    }
  }

  const updates = {};
  if (billing?.companyName != null || requireComplete) {
    updates.companyName = String(candidate.companyName || '').trim();
  }
  if (billing?.gstin != null || requireComplete) {
    updates.gstin = candidate.gstin ? String(candidate.gstin).trim().toUpperCase() : '';
  }
  if (billing?.gstRegistered != null || requireComplete) {
    updates.gstRegistered = Boolean(candidate.gstRegistered);
  }
  if (billing?.billingEmail != null || requireComplete) {
    updates.billingEmail = String(candidate.billingEmail || '').trim().toLowerCase();
  }
  if (billing?.billingPhone != null || requireComplete) {
    updates.billingPhone = String(candidate.billingPhone || '').trim();
  }
  if (billing?.billingAddressStructured != null || requireComplete) {
    updates.billingAddressStructured = candidate.billingAddressStructured;
  }
  if (!Object.keys(updates).length) {
    throw new Error('No billing fields to update');
  }

  let reasonText = null;
  if (auditAsOps) {
    reasonText = String(reason || '').trim();
    if (reasonText.length < 3) {
      throw new Error('A reason of at least 3 characters is required');
    }
    if (reasonText.length > 500) {
      throw new Error('Reason is too long');
    }
  }

  const before = existing;

  const organization = await Organization.findByIdAndUpdate(orgId, { $set: updates }, { new: true })
    .select('name companyName gstin gstRegistered billingEmail billingPhone billingAddressStructured')
    .lean();

  if (auditAsOps) {
    const BillingEvent = require('../../models/commercial/BillingEvent');
    const snapshotParty = (doc) => ({
      companyName: doc?.companyName || null,
      gstin: doc?.gstin || null,
      gstRegistered: Boolean(doc?.gstRegistered),
      billingEmail: doc?.billingEmail || null,
      billingPhone: doc?.billingPhone || null,
      billingAddressStructured: doc?.billingAddressStructured || null,
    });
    try {
      await BillingEvent.create({
        organizationId: orgId,
        type: BILLING_EVENT_TYPES.OPS_BILLING_PARTY_CORRECTED,
        idempotencyKey: `ops_billing_party:${orgId}:${Date.now()}`,
        payload: {
          reason: reasonText,
          before: snapshotParty(before),
          after: snapshotParty(organization),
        },
        status: BILLING_EVENT_STATUSES.PROCESSED,
        processedAt: new Date(),
        initiatedByUserId: initiatedByUserId || null,
        result: { companyName: organization?.companyName || null },
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  return organization;
}

module.exports = {
  getAdminOrganizationBilling,
  adminSuspendOrganization,
  adminRestoreOrganization,
  adminMarkInvoicePaid,
  adminUpdateSubscriptionStatus,
  adminUpdateBillingParty,
};
