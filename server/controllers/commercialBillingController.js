'use strict';

const {
  listActiveProducts,
  estimateQuote,
  previewUserAssignmentCost,
} = require('../services/commercial/pricingCatalogService');
const { getFounderProgramStatus } = require('../services/commercial/founderProgramService');
const {
  getSubscriptionWithItems,
  convertTrialToPaid,
  applyTrialEndIfDue,
  normalizeTrialBillingWindow,
} = require('../services/commercial/subscriptionService');
const { listActiveEntitlements } = require('../services/commercial/entitlementService');
const { recordBillingEvent } = require('../services/commercial/billingService');
const {
  createDraftInvoiceFromSubscription,
  finalizeInvoice,
  getInvoiceWithLines,
} = require('../services/commercial/invoiceService');
const {
  reconcileCommercialSubscriptionFromUsage,
  applyPendingBillingCycleIfDue,
  advanceSubscriptionPeriod,
} = require('../services/commercial/reconcileCommercialSubscription');
const {
  recordCommercialInvoicePayment,
  listPaymentsForInvoice,
} = require('../services/commercial/paymentService');
const {
  createCommercialInvoiceCheckout,
  captureCommercialRazorpayPayment,
  handleCommercialRazorpayWebhook,
} = require('../services/commercial/commercialCheckoutService');
const { getCommercialTaxConfig } = require('../services/commercial/taxService');
const BillingInvoice = require('../models/commercial/BillingInvoice');
const BillingSubscription = require('../models/commercial/BillingSubscription');
const { BILLING_EVENT_TYPES, INVOICE_STATUSES } = require('../constants/commercialBilling');
const {
  isCommercialBillingEnforcementEnabled,
} = require('../services/commercial/commercialAccessGate');

async function getPublicCatalog(req, res) {
  try {
    const [products, founder] = await Promise.all([
      listActiveProducts(),
      getFounderProgramStatus(),
    ]);
    return res.json({
      success: true,
      data: {
        products,
        founder,
        enforcementEnabled: isCommercialBillingEnforcementEnabled(),
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] getPublicCatalog', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getFounderStatus(req, res) {
  try {
    const founder = await getFounderProgramStatus();
    return res.json({ success: true, data: founder });
  } catch (err) {
    console.error('[CommercialBilling] getFounderStatus', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function postEstimate(req, res) {
  try {
    const estimate = await estimateQuote(req.body || {});
    return res.json({ success: true, data: estimate });
  } catch (err) {
    console.error('[CommercialBilling] postEstimate', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function postPreviewUserCost(req, res) {
  try {
    const preview = await previewUserAssignmentCost(req.body || {});
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error('[CommercialBilling] postPreviewUserCost', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getCommercialSubscription(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const existing = await BillingSubscription.findOne({
      organizationId: organizationId?._id || organizationId,
    });
    if (existing) {
      await applyPendingBillingCycleIfDue(existing);
      await applyTrialEndIfDue(existing);
      await normalizeTrialBillingWindow(existing);
      // Do not reconcile on GET — that mutates seats/credits on every page refresh.
    }

    const bundle = await getSubscriptionWithItems(organizationId);
    const entitlements = bundle
      ? await listActiveEntitlements(organizationId)
      : [];

    let recurringTotalMinor = 0;
    const itemSummaries = (bundle?.items || []).map((item) => {
      const lineTotal = (item.unitAmountMinor || 0) * (item.quantity || 0);
      recurringTotalMinor += lineTotal;
      return {
        ...item,
        lineTotalMinor: lineTotal,
      };
    });

    const adminItem = itemSummaries.find((i) => i.productCode === 'admin_user');
    const standardItem = itemSummaries.find((i) => i.productCode === 'standard_user');
    const internalItem = itemSummaries.find((i) => i.productCode === 'internal_user');
    const portalItem = itemSummaries.find((i) => i.productCode === 'portal_user');
    const appItems = itemSummaries.filter((i) => String(i.productCode || '').endsWith('_app'));

    const { isInternalOrganization } = require('../utils/internalOrganization');
    const isInternal = await isInternalOrganization(organizationId);
    const { calculateCommercialTax } = require('../services/commercial/taxService');
    const seatComposition = await loadBillableSeatComposition(organizationId);

    const adminQty = adminItem?.quantity || 0;
    const standardQty = standardItem?.quantity || 0;
    // Legacy internal_user only if new seat products absent
    const legacyInternalQty =
      !adminItem && !standardItem ? (internalItem?.quantity || 0) : 0;

    const breakdown = itemSummaries
      .filter((i) => {
        const qty = i.quantity || 0;
        if (qty <= 0) return false;
        if (i.productCode === 'arivu_platform') return false;
        if (i.productCode === 'internal_user' && (adminItem || standardItem)) return false;
        return true;
      })
      .map((i) => {
        const code = i.productCode;
        let composition = null;
        if (code === 'admin_user') composition = seatComposition.admin;
        else if (code === 'standard_user' || code === 'internal_user') composition = seatComposition.standard;
        else if (code === 'portal_user') composition = seatComposition.portal;
        return {
          productCode: code,
          quantity: i.quantity || 0,
          unitAmountMinor: i.unitAmountMinor || 0,
          lineTotalMinor: i.lineTotalMinor || 0,
          currency: i.currency,
          activeCount: composition?.active ?? null,
          invitedCount: composition?.invited ?? null,
        };
      });

    const taxableMinor = Math.max(0, recurringTotalMinor - (bundle?.subscription?.creditBalanceMinor || 0));
    const applyTax = !bundle?.subscription?.metadata?.notBillable && !bundle?.subscription?.metadata?.sandboxInternal;
    const tax = calculateCommercialTax(taxableMinor, { enabled: applyTax });
    const periodEnd = bundle?.subscription?.currentPeriodEnd || null;
    const status = bundle?.subscription?.status || null;
    const isTrialing = status === 'trialing';
    const isTrialExpired = status === 'trial_expired';
    const isPaymentPending = status === 'payment_pending';
    const isCanceled = status === 'canceled' || status === 'expired';
    const isCanceling = status === 'canceling';
    const trialEnd = bundle?.subscription?.trialEnd || null;
    const firstBillAt = isTrialing ? (trialEnd || periodEnd) : periodEnd;
    const showNextInvoice = !isCanceled && !isTrialExpired;

    const Organization = require('../models/Organization');
    const {
      defaultBillingCountryFromOrg,
    } = require('../services/commercial/billingPartyValidation');
    const orgDoc = await Organization.findById(organizationId?._id || organizationId)
      .select('name companyName gstin gstRegistered gstCertificateUrl gstCertificateFileName billingEmail billingPhone billingAddressStructured settings')
      .lean();
    const addr = orgDoc?.billingAddressStructured || {};
    const billingParty = {
      companyName: orgDoc?.companyName || orgDoc?.name || '',
      gstin: orgDoc?.gstin || '',
      gstRegistered: Boolean(orgDoc?.gstRegistered),
      gstCertificateUrl: orgDoc?.gstCertificateUrl || null,
      gstCertificateFileName: orgDoc?.gstCertificateFileName || null,
      billingEmail: orgDoc?.billingEmail || '',
      billingPhone: orgDoc?.billingPhone || '',
      line1: addr.line1 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      country: addr.country || defaultBillingCountryFromOrg(orgDoc),
    };

    return res.json({
      success: true,
      data: {
        subscription: bundle?.subscription || null,
        items: itemSummaries,
        entitlements,
        isInternalOrganization: isInternal,
        billingParty,
        overview: {
          recurringTotalMinor,
          currency: bundle?.subscription?.currency || 'INR',
          billingCycle: bundle?.subscription?.billingCycle || null,
          pendingBillingCycle: bundle?.subscription?.pendingBillingCycle || null,
          pricingProgramCode: bundle?.subscription?.pricingProgramCode || null,
          priceProtectionExpiresAt: bundle?.subscription?.priceProtectionExpiresAt || null,
          creditBalanceMinor: bundle?.subscription?.creditBalanceMinor || 0,
          sandboxInternal: Boolean(bundle?.subscription?.metadata?.sandboxInternal),
          isTrialing,
          isTrialExpired,
          isPaymentPending,
          isCanceled,
          isCanceling,
          cancelAtPeriodEnd: Boolean(bundle?.subscription?.cancelAtPeriodEnd),
          canceledAt: bundle?.subscription?.canceledAt || null,
          needsSubscribe: Boolean(isTrialing || isTrialExpired),
          needsPayment: Boolean(isPaymentPending),
          trialEnd,
          billingStartsAt: isTrialing ? trialEnd : null,
          adminUsers: adminQty,
          standardUsers: standardQty,
          internalUsersBillable: adminQty + standardQty + legacyInternalQty,
          portalUsers: portalItem?.quantity || 0,
          platformQuantity: 0,
          seatComposition,
          applications: appItems.map((i) => ({
            productCode: i.productCode,
            quantity: i.quantity,
            unitAmountMinor: i.unitAmountMinor,
            lineTotalMinor: i.lineTotalMinor,
          })),
          breakdown,
          nextInvoice: showNextInvoice
            ? {
              dueAt: firstBillAt,
              periodEnd: firstBillAt,
              isFirstInvoice: Boolean(isTrialing),
              subtotalMinor: recurringTotalMinor,
              creditMinor: bundle?.subscription?.creditBalanceMinor || 0,
              taxableMinor,
              taxMinor: tax.taxMinor,
              totalMinor: taxableMinor + tax.taxMinor,
              taxName: tax.name,
              taxRatePercent: tax.taxDetails?.ratePercent || 0,
              currency: bundle?.subscription?.currency || 'INR',
            }
            : null,
          accessUntil: isCanceling ? periodEnd : null,
        },
        enforcementEnabled: isCommercialBillingEnforcementEnabled(),
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] getCommercialSubscription', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Billable seat split (active vs invited) — same status filter as reconcile.
 */
async function loadBillableSeatComposition(organizationId) {
  const User = require('../models/User');
  const {
    normalizePlatformUserType,
    PLATFORM_USER_TYPES,
    isExternalUserType,
  } = require('../constants/platformUserTypes');
  const { isPrivilegedSystemRoleName } = require('../utils/tenantPrivilegedAccess');

  const empty = () => ({ active: 0, invited: 0 });
  const buckets = {
    admin: empty(),
    standard: empty(),
    portal: empty(),
  };

  const users = await User.find({
    organizationId,
    status: { $in: ['active', 'invited'] },
  })
    .select('userType isOwner role status')
    .lean();

  for (const u of users) {
    const statusKey = String(u.status || 'active').toLowerCase() === 'invited' ? 'invited' : 'active';
    let bucket = 'standard';
    if (isExternalUserType(u.userType)) {
      bucket = 'portal';
    } else {
      const type = normalizePlatformUserType(u.userType, {
        isOwner: u.isOwner,
        roleName: u.role,
      });
      if (
        type === PLATFORM_USER_TYPES.ADMIN
        || u.isOwner === true
        || isPrivilegedSystemRoleName(u.role)
      ) {
        bucket = 'admin';
      }
    }
    buckets[bucket][statusKey] += 1;
  }

  return buckets;
}

/**
 * Bootstrap commercial subscription for the current org (idempotent).
 */
async function postBootstrapSubscription(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { isInternalOrganization } = require('../utils/internalOrganization');
    const isInternal = await isInternalOrganization(organizationId);

    const result = await recordBillingEvent({
      organizationId,
      type: BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED,
      idempotencyKey: `subscription_created:${String(
        organizationId?._id || organizationId
      )}`,
      payload: {
        billingCycle: req.body?.billingCycle || 'monthly',
        // Internal/master: sandbox prices, never consume Founder slot
        claimFounder: isInternal ? false : req.body?.claimFounder !== false,
        trialDays: isInternal ? 0 : req.body?.trialDays,
      },
      initiatedByUserId: req.user._id,
    });

    const subscriptionId = result?.result?.subscriptionId || result?.event?.result?.subscriptionId;
    if (result?.event?.status === 'failed' || (!result?.duplicate && !subscriptionId && !result?.result?.subscriptionId)) {
      // processBillingEvent throws on failure — defensive check for duplicate-failed edge cases
    }
    if (result?.event?.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: result.event.errorMessage || 'Commercial subscription activation failed',
      });
    }

    const { getSubscriptionWithItems } = require('../services/commercial/subscriptionService');
    let bundle = await getSubscriptionWithItems(organizationId);
    if (!bundle?.subscription) {
      return res.status(500).json({
        success: false,
        message: 'Activation reported success but no commercial subscription was found. Retry Activate.',
      });
    }

    const reconcile = await reconcileCommercialSubscriptionFromUsage({
      organizationId,
      ensureSubscription: false,
      claimFounder: false,
    });
    bundle = await getSubscriptionWithItems(organizationId);

    return res.json({
      success: true,
      data: {
        ...result,
        subscription: bundle.subscription,
        reconcile,
        isInternalOrganization: isInternal,
        note: isInternal
          ? 'Internal organization: commercial sandbox activated without consuming a Founder slot.'
          : null,
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] postBootstrapSubscription', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function postReconcileSubscription(req, res) {
  try {
    const reconcile = await reconcileCommercialSubscriptionFromUsage({
      organizationId: req.user.organizationId,
      ensureSubscription: false,
    });
    if (!reconcile.reconciled) {
      return res.status(400).json({
        success: false,
        message: 'No commercial subscription to reconcile. Activate Founder Launch first.',
        data: reconcile,
      });
    }
    const bundle = await getSubscriptionWithItems(req.user.organizationId);
    return res.json({ success: true, data: { reconcile, subscription: bundle?.subscription || null } });
  } catch (err) {
    console.error('[CommercialBilling] postReconcileSubscription', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function postChangeBillingCycle(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const billingCycle = req.body?.billingCycle;
    const immediate = req.body?.immediate === true;
    const result = await recordBillingEvent({
      organizationId,
      type: BILLING_EVENT_TYPES.BILLING_CYCLE_CHANGED,
      idempotencyKey: `billing_cycle_changed:${organizationId}:${billingCycle}:${immediate ? 'now' : 'renewal'}:${Date.now()}`,
      payload: { billingCycle, immediate },
      initiatedByUserId: req.user._id,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CommercialBilling] postChangeBillingCycle', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function listInvoices(req, res) {
  try {
    const {
      getInvoiceRevisionMeta,
    } = require('../services/commercial/invoiceRevisionMeta');
    const invoices = await BillingInvoice.find({
      organizationId: req.user.organizationId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const enriched = invoices.map((inv) => {
      const meta = getInvoiceRevisionMeta(inv);
      const snapshot = inv.snapshot ? { ...inv.snapshot } : null;
      // Tenant: keep revision timestamps/reasons, drop bulky before snapshots.
      if (snapshot && Array.isArray(snapshot.revisions)) {
        snapshot.revisions = snapshot.revisions.map((r) => ({
          at: r.at,
          reason: r.reason || null,
          restore: r.restore || null,
        }));
      }
      return {
        ...inv,
        snapshot,
        isRevised: meta.isRevised,
        revisionCount: meta.revisionCount,
        currentVersion: meta.currentVersion,
      };
    });

    return res.json({ success: true, data: { invoices: enriched } });
  } catch (err) {
    console.error('[CommercialBilling] listInvoices', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function postCreateDraftInvoice(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const sub = await BillingSubscription.findOne({
      organizationId: organizationId?._id || organizationId,
    });
    if (sub) {
      await applyPendingBillingCycleIfDue(sub);
      await applyTrialEndIfDue(sub);
    }

    const refreshed = await BillingSubscription.findOne({
      organizationId: organizationId?._id || organizationId,
    });
    if (refreshed?.status === 'trialing') {
      return res.status(400).json({
        success: false,
        code: 'TRIAL_NO_INVOICE',
        message:
          'Billing starts when your trial ends. Use Start paid plan to bill now, or wait until the trial completes.',
      });
    }

    const invoice = await createDraftInvoiceFromSubscription({
      organizationId,
      taxMinor: req.body?.taxMinor,
      taxDetails: req.body?.taxDetails || null,
    });
    const finalize = req.body?.finalize === true;
    let result = invoice;
    if (finalize) {
      result = await finalizeInvoice(invoice._id);
      if (refreshed) {
        await advanceSubscriptionPeriod(refreshed);
      }
    }
    const withLines = await getInvoiceWithLines(result._id);
    return res.status(201).json({ success: true, data: withLines });
  } catch (err) {
    console.error('[CommercialBilling] postCreateDraftInvoice', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * End trial early (or no-op if already due) and open first paid period + invoice.
 */
async function postEndTrial(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const createInvoice = req.body?.createInvoice !== false;
    const result = await convertTrialToPaid({
      organizationId,
      createInvoice,
      early: true,
    });
    if (!result.converted && result.reason === 'not_trialing') {
      return res.status(400).json({
        success: false,
        code: 'NOT_TRIALING',
        message: 'Subscription is not in trial.',
        data: result,
      });
    }
    if (!result.converted && result.reason === 'not_billable') {
      return res.status(400).json({
        success: false,
        code: 'NOT_BILLABLE',
        message: 'This organization is not billable.',
        data: result,
      });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CommercialBilling] postEndTrial', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function postFinalizeInvoice(req, res) {
  try {
    const invoice = await finalizeInvoice(req.params.invoiceId);
    if (invoice?.subscriptionId) {
      const sub = await BillingSubscription.findById(invoice.subscriptionId);
      if (sub) {
        await advanceSubscriptionPeriod(sub);
      }
    }
    const withLines = await getInvoiceWithLines(invoice._id);
    return res.json({ success: true, data: withLines });
  } catch (err) {
    console.error('[CommercialBilling] postFinalizeInvoice', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getTaxConfig(req, res) {
  try {
    return res.json({ success: true, data: getCommercialTaxConfig() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function postInvoicePayment(req, res) {
  try {
    const email = String(req.user?.email || '').toLowerCase();
    const isOps =
      req.user?.isPlatformAdmin === true
      || email.endsWith('@arivusystems.com');
    if (!isOps) {
      return res.status(403).json({
        success: false,
        code: 'OPS_ONLY',
        message: 'Use payment submit for offline payments, or Razorpay checkout.',
      });
    }

    const invoiceId = req.params.invoiceId;
    const organizationId = req.user.organizationId;
    const invoice = await BillingInvoice.findOne({
      _id: invoiceId,
      organizationId: organizationId?._id || organizationId,
    });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const payInFull = req.body?.payInFull === true;
    const alreadyPaid = Math.max(0, Number(invoice.amountPaidMinor) || 0);
    const remaining = Math.max(0, invoice.totalMinor - alreadyPaid);
    const amountMinor = payInFull
      ? remaining
      : Math.round(Number(req.body?.amountMinor));

    const result = await recordCommercialInvoicePayment({
      organizationId,
      invoiceId,
      amountMinor,
      method: req.body?.method || 'manual',
      providerReference: req.body?.providerReference || null,
      notes: req.body?.notes || '',
      recordedByUserId: req.user._id,
      paidAt: req.body?.paidAt || null,
      metadata: { ...(req.body?.metadata || {}), opsMarkPaid: true },
    });

    return res.status(201).json({
      success: true,
      data: {
        payment: result.payment,
        invoice: result.invoice,
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] postInvoicePayment', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getInvoicePayments(req, res) {
  try {
    const payments = await listPaymentsForInvoice(
      req.params.invoiceId,
      req.user.organizationId
    );
    return res.json({ success: true, data: { payments } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function postInvoiceCheckout(req, res) {
  try {
    const checkout = await createCommercialInvoiceCheckout({
      organizationId: req.user.organizationId,
      invoiceId: req.params.invoiceId,
    });
    return res.status(201).json({ success: true, data: checkout });
  } catch (err) {
    const status = err.code === 'RAZORPAY_NOT_CONFIGURED' ? 503 : 400;
    console.error('[CommercialBilling] postInvoiceCheckout', err);
    return res.status(status).json({
      success: false,
      code: err.code || 'CHECKOUT_FAILED',
      message: err.message,
    });
  }
}

async function postInvoiceConfirmRazorpay(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    const result = await captureCommercialRazorpayPayment({
      organizationId: req.user.organizationId,
      invoiceId: req.params.invoiceId,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      requireSignature: true,
    });

    return res.json({
      success: true,
      data: {
        payment: result.payment || null,
        invoice: result.invoice,
        duplicate: Boolean(result.duplicate || result.alreadyPaid),
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] postInvoiceConfirmRazorpay', err);
    return res.status(400).json({
      success: false,
      code: err.code || 'CONFIRM_FAILED',
      message: err.message,
    });
  }
}

async function postCommercialRazorpayWebhook(req, res) {
  try {
    const result = await handleCommercialRazorpayWebhook(req.body, req.headers);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CommercialBilling] razorpay webhook', err);
    const status = err.code === 'RAZORPAY_WEBHOOK_INVALID' ? 401 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

/**
 * Subscribe: update bill-to, set cycle, open first invoice (payment_pending).
 */
async function postSubscribe(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const orgId = organizationId?._id || organizationId;
    const { adminUpdateBillingParty } = require('../services/commercial/adminOrgBillingService');
    const billing = req.body?.billing || {};

    try {
      await adminUpdateBillingParty({
        organizationId: orgId,
        requireComplete: true,
        billing: {
          companyName: billing.companyName,
          gstin: billing.gstin,
          gstRegistered: billing.gstRegistered,
          billingEmail: billing.billingEmail,
          billingPhone: billing.billingPhone,
          billingAddressStructured: billing.billingAddressStructured || {
            line1: billing.line1,
            city: billing.city,
            state: billing.state,
            pincode: billing.pincode,
            country: billing.country,
          },
        },
      });
    } catch (billErr) {
      return res.status(400).json({
        success: false,
        code: billErr.code || 'BILLING_DETAILS_REQUIRED',
        message: billErr.message,
      });
    }

    const {
      subscribeAndInvoice,
      getSubscriptionWithItems: getBundle,
      setOrgLearningPlan,
    } = require('../services/commercial/subscriptionService');
    const result = await subscribeAndInvoice({
      organizationId,
      billingCycle: req.body?.billingCycle || 'monthly',
    });
    if (!result.converted) {
      return res.status(400).json({
        success: false,
        code: result.reason || 'SUBSCRIBE_FAILED',
        message: result.reason === 'not_eligible' || result.reason === 'not_trialing'
          ? 'Subscription is not eligible for subscribe.'
          : 'Unable to subscribe.',
        data: result,
      });
    }

    // If LMS is enabled, ensure learning_app line + capacity entitlement (plan from body or Growth).
    try {
      const Organization = require('../models/Organization');
      const org = await Organization.findById(orgId).select('enabledApps').lean();
      const apps = Array.isArray(org?.enabledApps) ? org.enabledApps : [];
      const lmsOn = apps.some((e) => {
        const key = typeof e === 'object' && e !== null ? e.appKey : e;
        const status = typeof e === 'object' && e !== null ? e.status : 'ACTIVE';
        return String(key || '').toUpperCase() === 'LMS'
          && String(status || 'ACTIVE').toUpperCase() === 'ACTIVE';
      });
      if (lmsOn) {
        await setOrgLearningPlan({
          organizationId: orgId,
          planKey: req.body?.learningPlanKey || undefined,
          billingCycle: req.body?.billingCycle || 'monthly',
        });
      }
    } catch (learningErr) {
      console.warn('[CommercialBilling] Learning plan attach on subscribe failed:', learningErr.message);
    }

    const withLines = result.invoice
      ? await getInvoiceWithLines(result.invoice._id)
      : null;
    const bundle = await getBundle(organizationId);
    return res.json({
      success: true,
      data: {
        subscription: bundle?.subscription || result.subscription,
        invoice: withLines?.invoice || result.invoice,
        lines: withLines?.lines || [],
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] postSubscribe', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Set / change Learning (learning_app) capacity plan for the tenant.
 * Body: { planKey: 'starter' | 'growth' | 'business' }
 */
async function postLearningPlan(req, res) {
  try {
    const { setOrgLearningPlan } = require('../services/commercial/subscriptionService');
    const LearningSeatService = require('../services/learning/learningSeatService');
    const data = await setOrgLearningPlan({
      organizationId: req.user.organizationId,
      planKey: req.body?.planKey,
      billingCycle: req.body?.billingCycle,
    });
    const usage = await LearningSeatService.getUsage(req.user.organizationId);
    return res.json({
      success: true,
      data: {
        planKey: data.planKey,
        capacity: data.capacity,
        monthlyPaise: data.monthlyPaise,
        usage,
      },
    });
  } catch (err) {
    console.error('[CommercialBilling] postLearningPlan', err);
    const status = err.code === 'INVALID_LEARNING_PLAN' ? 400 : 400;
    return res.status(status).json({
      success: false,
      code: err.code || 'LEARNING_PLAN_FAILED',
      message: err.message,
    });
  }
}

async function postSubmitManualPayment(req, res) {
  try {
    const { submitManualPaymentProof } = require('../services/commercial/paymentService');
    const result = await submitManualPaymentProof({
      organizationId: req.user.organizationId,
      invoiceId: req.params.invoiceId,
      amountMinor: req.body?.amountMinor,
      payInFull: req.body?.payInFull !== false,
      method: req.body?.method || 'bank_transfer',
      utr: req.body?.utr || req.body?.providerReference,
      notes: req.body?.notes || '',
      proofUrl: req.body?.proofUrl || null,
      bankDetails: req.body?.bankDetails || null,
      paidAt: req.body?.paidAt || null,
      recordedByUserId: req.user._id,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('[CommercialBilling] postSubmitManualPayment', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getCancelPreview(req, res) {
  try {
    const { previewCancellation } = require('../services/commercial/cancelRefundService');
    const preview = await previewCancellation(req.user.organizationId);
    return res.json({ success: true, data: preview });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function postCancelSubscription(req, res) {
  try {
    const { cancelSubscription } = require('../services/commercial/cancelRefundService');
    const result = await cancelSubscription({
      organizationId: req.user.organizationId,
      immediate: req.body?.immediate === true,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getInvoicePdf(req, res) {
  try {
    const { renderCommercialInvoicePdf } = require('../services/commercial/commercialInvoicePdfService');
    const { buffer, invoiceNumber } = await renderCommercialInvoicePdf({
      organizationId: req.user.organizationId,
      invoiceId: req.params.invoiceId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoiceNumber || 'invoice'}.pdf"`
    );
    return res.send(buffer);
  } catch (err) {
    console.error('[CommercialBilling] getInvoicePdf', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

/** Platform admin: list commercial subscriptions across orgs. */
async function adminListSubscriptions(req, res) {
  try {
    const BillingSubscription = require('../models/commercial/BillingSubscription');
    const BillingSubscriptionItem = require('../models/commercial/BillingSubscriptionItem');
    const Organization = require('../models/Organization');
    const Instance = require('../models/Instance');
    const { ITEM_STATUSES } = require('../constants/commercialBilling');

    const includeSandbox = req.query.includeSandbox === 'true'
      || req.query.includeSandbox === '1';

    const filter = {};
    if (!includeSandbox) {
      const internalInstances = await Instance.find({ isInternal: true })
        .select('organizationId')
        .lean();
      const internalOrgIds = internalInstances.map((i) => i.organizationId).filter(Boolean);
      filter.$and = [
        { 'metadata.notBillable': { $ne: true } },
        { 'metadata.sandboxInternal': { $ne: true } },
      ];
      if (internalOrgIds.length) {
        filter.$and.push({ organizationId: { $nin: internalOrgIds } });
      }
    }

    const subs = await BillingSubscription.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Math.min(200, Number(req.query.limit) || 100))
      .lean();
    const orgIds = subs.map((s) => s.organizationId);
    const [orgs, instances, items] = await Promise.all([
      Organization.find({ _id: { $in: orgIds } })
        .select('name companyName gstin')
        .lean(),
      Instance.find({ organizationId: { $in: orgIds } })
        .select('organizationId status suspendedAt isInternal')
        .lean(),
      BillingSubscriptionItem.find({
        organizationId: { $in: orgIds },
        status: ITEM_STATUSES.ACTIVE,
        quantity: { $gt: 0 },
      })
        .select('organizationId unitAmountMinor quantity')
        .lean(),
    ]);
    const byId = Object.fromEntries(orgs.map((o) => [String(o._id), o]));
    const instanceByOrg = Object.fromEntries(
      instances.map((i) => [String(i.organizationId), i])
    );
    const mrrByOrg = {};
    for (const item of items) {
      const key = String(item.organizationId);
      mrrByOrg[key] = (mrrByOrg[key] || 0)
        + (item.unitAmountMinor || 0) * (item.quantity || 0);
    }

    return res.json({
      success: true,
      data: {
        includeSandbox,
        subscriptions: subs.map((s) => {
          const orgKey = String(s.organizationId);
          const instance = instanceByOrg[orgKey] || null;
          return {
            ...s,
            organization: byId[orgKey] || null,
            instance,
            isSandbox: Boolean(
              s.metadata?.notBillable
              || s.metadata?.sandboxInternal
              || instance?.isInternal
            ),
            recurringTotalMinor: mrrByOrg[orgKey] || 0,
          };
        }),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function adminListPendingPayments(req, res) {
  try {
    const BillingPayment = require('../models/commercial/BillingPayment');
    const BillingInvoice = require('../models/commercial/BillingInvoice');
    const Organization = require('../models/Organization');
    const Instance = require('../models/Instance');
    const includeSandbox = req.query.includeSandbox === 'true'
      || req.query.includeSandbox === '1';

    let sandboxOrgIds = [];
    if (!includeSandbox) {
      const internalInstances = await Instance.find({ isInternal: true })
        .select('organizationId')
        .lean();
      sandboxOrgIds = internalInstances.map((i) => i.organizationId).filter(Boolean);
    }

    const paymentFilter = { status: 'submitted' };
    if (!includeSandbox && sandboxOrgIds.length) {
      paymentFilter.organizationId = { $nin: sandboxOrgIds };
    }

    const payments = await BillingPayment.find(paymentFilter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const orgIds = payments.map((p) => p.organizationId);
    const invoiceIds = payments.map((p) => p.invoiceId);
    const [orgs, invoices] = await Promise.all([
      Organization.find({ _id: { $in: orgIds } })
        .select('name companyName')
        .lean(),
      BillingInvoice.find({ _id: { $in: invoiceIds } })
        .select('invoiceNumber totalMinor status')
        .lean(),
    ]);
    const byId = Object.fromEntries(orgs.map((o) => [String(o._id), o]));
    const invById = Object.fromEntries(invoices.map((i) => [String(i._id), i]));
    return res.json({
      success: true,
      data: {
        includeSandbox,
        payments: payments.map((p) => ({
          ...p,
          organization: byId[String(p.organizationId)] || null,
          invoice: invById[String(p.invoiceId)] || null,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function adminApprovePayment(req, res) {
  try {
    const { approveManualPayment } = require('../services/commercial/paymentService');
    const result = await approveManualPayment({
      paymentId: req.params.paymentId,
      approvedByUserId: req.user._id,
      notes: req.body?.notes || '',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminRejectPayment(req, res) {
  try {
    const { rejectManualPayment } = require('../services/commercial/paymentService');
    const result = await rejectManualPayment({
      paymentId: req.params.paymentId,
      rejectedByUserId: req.user._id,
      notes: req.body?.notes || '',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetOrganizationBilling(req, res) {
  try {
    const {
      getAdminOrganizationBilling,
    } = require('../services/commercial/adminOrgBillingService');
    const data = await getAdminOrganizationBilling(req.params.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[CommercialBilling] adminGetOrganizationBilling', err);
    const status = err.message === 'Organization not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

async function adminSuspendOrg(req, res) {
  try {
    const { adminSuspendOrganization } = require('../services/commercial/adminOrgBillingService');
    const data = await adminSuspendOrganization(
      req.params.organizationId,
      req.body?.reason || 'commercial_admin_suspend'
    );
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminRestoreOrg(req, res) {
  try {
    const { adminRestoreOrganization } = require('../services/commercial/adminOrgBillingService');
    const data = await adminRestoreOrganization(req.params.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminMarkOrgInvoicePaid(req, res) {
  try {
    let proofUrl = req.body?.proofUrl || null;
    let proofFileName = req.body?.proofFileName || null;
    if (req.file) {
      const { persistMulterUpload } = require('../middleware/uploadMiddleware');
      const uploadResult = await persistMulterUpload(req, 'billing-payment-proofs');
      proofUrl = uploadResult.url;
      proofFileName = req.file.originalname || uploadResult.storedFileName || null;
    }
    const { adminMarkInvoicePaid } = require('../services/commercial/adminOrgBillingService');
    const data = await adminMarkInvoicePaid({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
      recordedByUserId: req.user._id,
      notes: req.body?.notes || '',
      providerReference: req.body?.providerReference || req.body?.utr || null,
      proofUrl,
      proofFileName,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminSetSubscriptionStatus(req, res) {
  try {
    const { adminUpdateSubscriptionStatus } = require('../services/commercial/adminOrgBillingService');
    const subscription = await adminUpdateSubscriptionStatus({
      organizationId: req.params.organizationId,
      status: req.body?.status,
    });
    return res.json({ success: true, data: { subscription } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Tenant: update org bill-to (company / GSTIN / address) for future invoices.
 */
async function patchBillingParty(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { adminUpdateBillingParty } = require('../services/commercial/adminOrgBillingService');
    const body = req.body || {};
    const organization = await adminUpdateBillingParty({
      organizationId,
      billing: {
        companyName: body.companyName,
        gstin: body.gstin,
        gstRegistered: body.gstRegistered,
        billingEmail: body.billingEmail,
        billingPhone: body.billingPhone,
        billingAddressStructured: body.billingAddressStructured || {
          line1: body.line1,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          country: body.country,
        },
      },
    });
    return res.json({ success: true, data: { organization } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

const GST_CERTIFICATE_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Tenant: upload GST registration certificate.
 * POST /api/billing/gst-certificate  (multipart field: certificate)
 */
async function uploadGstCertificate(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!GST_CERTIFICATE_ALLOWED_MIMES.has(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload a PDF or image (PNG, JPG, WEBP).',
      });
    }

    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const { persistMulterUpload } = require('../middleware/uploadMiddleware');
    const uploadResult = await persistMulterUpload(req, 'gst-certificates');

    organization.gstCertificateUrl = uploadResult.url;
    organization.gstCertificateFileName = req.file.originalname || uploadResult.storedFileName || null;
    await organization.save();

    return res.json({
      success: true,
      message: 'GST certificate uploaded',
      data: {
        gstCertificateUrl: organization.gstCertificateUrl,
        gstCertificateFileName: organization.gstCertificateFileName,
      },
    });
  } catch (err) {
    console.error('Upload GST certificate error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload GST certificate',
      error: err.message,
    });
  }
}

/**
 * Tenant: remove GST registration certificate.
 * DELETE /api/billing/gst-certificate
 */
async function deleteGstCertificate(req, res) {
  try {
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(req.user.organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    organization.gstCertificateUrl = null;
    organization.gstCertificateFileName = null;
    await organization.save();

    return res.json({
      success: true,
      message: 'GST certificate removed',
      data: { gstCertificateUrl: null, gstCertificateFileName: null },
    });
  } catch (err) {
    console.error('Delete GST certificate error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove GST certificate',
      error: err.message,
    });
  }
}

async function adminPatchBillingParty(req, res) {
  try {
    const { adminUpdateBillingParty } = require('../services/commercial/adminOrgBillingService');
    const body = req.body || {};
    const organization = await adminUpdateBillingParty({
      organizationId: req.params.organizationId,
      billing: {
        companyName: body.companyName,
        gstin: body.gstin,
        gstRegistered: body.gstRegistered,
        billingEmail: body.billingEmail,
        billingPhone: body.billingPhone,
        billingAddressStructured: body.billingAddressStructured || {
          line1: body.line1,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          country: body.country,
        },
      },
      reason: body.reason,
      initiatedByUserId: req.user?._id,
      auditAsOps: true,
    });
    return res.json({ success: true, data: { organization } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetInvoicePdfSettings(req, res) {
  try {
    const {
      getInvoicePdfSettingsForAdmin,
    } = require('../services/commercial/commercialInvoicePdfSettingsService');
    const data = await getInvoicePdfSettingsForAdmin();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function adminEnsureInvoicePdfTemplate(req, res) {
  try {
    const {
      ensureCommercialBillingInvoiceTemplate,
    } = require('../services/commercial/commercialBillingInvoiceDocumentService');
    const data = await ensureCommercialBillingInvoiceTemplate({
      userId: req.user?._id,
      force: req.body?.force === true || req.query?.force === 'true',
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminPutInvoicePdfSettings(req, res) {
  try {
    const {
      updateInvoicePdfSettings,
    } = require('../services/commercial/commercialInvoicePdfSettingsService');
    const body = req.body || {};
    const data = await updateInvoicePdfSettings({
      legalName: body.legalName,
      gstin: body.gstin,
      pan: body.pan,
      address: body.address,
      email: body.email,
      phone: body.phone,
      tagline: body.tagline,
      website: body.website,
      paymentTerms: body.paymentTerms,
      paymentInstructions: body.paymentInstructions,
      bankDetails: body.bankDetails,
      bankName: body.bankName,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      upiId: body.upiId,
      reason: body.reason,
      userId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetInvoicePdf(req, res) {
  try {
    const { renderCommercialInvoicePdf } = require('../services/commercial/commercialInvoicePdfService');
    const { buffer, invoiceNumber } = await renderCommercialInvoicePdf({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoiceNumber || 'invoice'}.pdf"`
    );
    return res.send(buffer);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminApplyCredit(req, res) {
  try {
    const { adminApplySubscriptionCredit } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminApplySubscriptionCredit({
      organizationId: req.params.organizationId,
      amountMinor: req.body?.amountMinor,
      reason: req.body?.reason,
      initiatedByUserId: req.user?._id,
      idempotencyKey: req.body?.idempotencyKey,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminVoidInvoice(req, res) {
  try {
    const { adminVoidUnpaidInvoice } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminVoidUnpaidInvoice({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
      reason: req.body?.reason,
      regenerate: Boolean(req.body?.regenerate),
      initiatedByUserId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminReviseInvoice(req, res) {
  try {
    const { adminReviseUnpaidInvoice } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminReviseUnpaidInvoice({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
      reason: req.body?.reason,
      invoiceDiscountMinor: req.body?.invoiceDiscountMinor,
      lineDiscounts: Array.isArray(req.body?.lines) ? req.body.lines : [],
      initiatedByUserId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminRestoreInvoiceRevision(req, res) {
  try {
    const { adminRestoreInvoiceRevision } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminRestoreInvoiceRevision({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
      targetVersion: req.body?.targetVersion,
      reason: req.body?.reason,
      initiatedByUserId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminIssueCreditNote(req, res) {
  try {
    const { adminIssueCreditNote } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminIssueCreditNote({
      organizationId: req.params.organizationId,
      invoiceId: req.params.invoiceId,
      amountMinor: req.body?.amountMinor,
      reason: req.body?.reason,
      initiatedByUserId: req.user?._id,
      idempotencyKey: req.body?.idempotencyKey,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminSetPendingDiscount(req, res) {
  try {
    const { adminSetPendingDiscount } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminSetPendingDiscount({
      organizationId: req.params.organizationId,
      amountMinor: req.body?.amountMinor,
      reason: req.body?.reason,
      initiatedByUserId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function adminSetRecurringDiscount(req, res) {
  try {
    const { adminSetRecurringDiscount } = require('../services/commercial/adminInvoiceAdjustmentService');
    const data = await adminSetRecurringDiscount({
      organizationId: req.params.organizationId,
      amountMinor: req.body?.amountMinor,
      periods: req.body?.periods,
      reason: req.body?.reason,
      initiatedByUserId: req.user?._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  getPublicCatalog,
  getFounderStatus,
  postEstimate,
  postPreviewUserCost,
  getCommercialSubscription,
  postBootstrapSubscription,
  postReconcileSubscription,
  postChangeBillingCycle,
  postEndTrial,
  postSubscribe,
  postLearningPlan,
  patchBillingParty,
  uploadGstCertificate,
  deleteGstCertificate,
  listInvoices,
  postCreateDraftInvoice,
  postFinalizeInvoice,
  getTaxConfig,
  postInvoicePayment,
  getInvoicePayments,
  postInvoiceCheckout,
  postInvoiceConfirmRazorpay,
  postCommercialRazorpayWebhook,
  postSubmitManualPayment,
  getCancelPreview,
  postCancelSubscription,
  getInvoicePdf,
  adminListSubscriptions,
  adminListPendingPayments,
  adminApprovePayment,
  adminRejectPayment,
  adminGetOrganizationBilling,
  adminSuspendOrg,
  adminRestoreOrg,
  adminMarkOrgInvoicePaid,
  adminSetSubscriptionStatus,
  adminPatchBillingParty,
  adminGetInvoicePdfSettings,
  adminEnsureInvoicePdfTemplate,
  adminPutInvoicePdfSettings,
  adminGetInvoicePdf,
  adminApplyCredit,
  adminVoidInvoice,
  adminReviseInvoice,
  adminRestoreInvoiceRevision,
  adminIssueCreditNote,
  adminSetPendingDiscount,
  adminSetRecurringDiscount,
};
