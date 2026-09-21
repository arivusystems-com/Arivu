'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { canManageBilling, requirePlatformAdmin } = require('../middleware/permissionMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  getPublicCatalog,
  getFounderStatus,
  postEstimate,
  postPreviewUserCost,
  getCommercialSubscription,
  postBootstrapSubscription,
  postReconcileSubscription,
  listInvoices,
  postCreateDraftInvoice,
  postFinalizeInvoice,
  postChangeBillingCycle,
  postEndTrial,
  postSubscribe,
  postLearningPlan,
  patchBillingParty,
  uploadGstCertificate,
  deleteGstCertificate,
  getTaxConfig,
  postInvoicePayment,
  getInvoicePayments,
  postInvoiceCheckout,
  postInvoiceConfirmRazorpay,
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
} = require('../controllers/commercialBillingController');

/** Public pricing surfaces (no auth). */
router.get('/catalog', getPublicCatalog);
router.get('/founder-status', getFounderStatus);
router.get('/tax-config', getTaxConfig);
router.post('/estimate', postEstimate);

/** Authenticated tenant commercial billing. */
router.use(protect);
router.use(organizationIsolation);

router.get('/subscription', getCommercialSubscription);
router.post('/preview-user-cost', postPreviewUserCost);
router.post('/bootstrap', canManageBilling(), postBootstrapSubscription);
router.post('/reconcile', canManageBilling(), postReconcileSubscription);
router.post('/billing-cycle', canManageBilling(), postChangeBillingCycle);
router.post('/end-trial', canManageBilling(), postEndTrial);
router.post('/subscribe', canManageBilling(), postSubscribe);
router.post('/learning-plan', canManageBilling(), postLearningPlan);
router.patch('/billing-party', canManageBilling(), patchBillingParty);
router.post(
  '/gst-certificate',
  canManageBilling(),
  uploadSingle('certificate'),
  uploadGstCertificate
);
router.delete('/gst-certificate', canManageBilling(), deleteGstCertificate);
router.get('/cancel-preview', canManageBilling(), getCancelPreview);
router.post('/cancel', canManageBilling(), postCancelSubscription);
router.get('/invoices', listInvoices);
router.post('/invoices/draft', canManageBilling(), postCreateDraftInvoice);
router.post('/invoices/:invoiceId/finalize', canManageBilling(), postFinalizeInvoice);
router.get('/invoices/:invoiceId/pdf', getInvoicePdf);
router.get('/invoices/:invoiceId/payments', getInvoicePayments);
router.post('/invoices/:invoiceId/payments', canManageBilling(), postInvoicePayment);
router.post('/invoices/:invoiceId/payments/submit', canManageBilling(), postSubmitManualPayment);
router.post('/invoices/:invoiceId/checkout', canManageBilling(), postInvoiceCheckout);
router.post('/invoices/:invoiceId/confirm-razorpay', canManageBilling(), postInvoiceConfirmRazorpay);

/** Platform admin console (Arivu ops). */
router.get('/admin/subscriptions', requirePlatformAdmin(), adminListSubscriptions);
router.get('/admin/payments/pending', requirePlatformAdmin(), adminListPendingPayments);
router.post('/admin/payments/:paymentId/approve', requirePlatformAdmin(), adminApprovePayment);
router.post('/admin/payments/:paymentId/reject', requirePlatformAdmin(), adminRejectPayment);
router.get(
  '/admin/organizations/:organizationId',
  requirePlatformAdmin(),
  adminGetOrganizationBilling
);
router.post(
  '/admin/organizations/:organizationId/suspend',
  requirePlatformAdmin(),
  adminSuspendOrg
);
router.post(
  '/admin/organizations/:organizationId/restore',
  requirePlatformAdmin(),
  adminRestoreOrg
);
router.post(
  '/admin/organizations/:organizationId/subscription-status',
  requirePlatformAdmin(),
  adminSetSubscriptionStatus
);
router.patch(
  '/admin/organizations/:organizationId/billing-party',
  requirePlatformAdmin(),
  adminPatchBillingParty
);
router.get(
  '/admin/invoice-pdf-settings',
  requirePlatformAdmin(),
  adminGetInvoicePdfSettings
);
router.post(
  '/admin/invoice-pdf-settings/ensure-template',
  requirePlatformAdmin(),
  adminEnsureInvoicePdfTemplate
);
router.put(
  '/admin/invoice-pdf-settings',
  requirePlatformAdmin(),
  adminPutInvoicePdfSettings
);
router.post(
  '/admin/organizations/:organizationId/invoices/:invoiceId/mark-paid',
  requirePlatformAdmin(),
  uploadSingle('receipt'),
  adminMarkOrgInvoicePaid
);
router.get(
  '/admin/organizations/:organizationId/invoices/:invoiceId/pdf',
  requirePlatformAdmin(),
  adminGetInvoicePdf
);
router.post(
  '/admin/organizations/:organizationId/credits',
  requirePlatformAdmin(),
  adminApplyCredit
);
router.post(
  '/admin/organizations/:organizationId/invoices/:invoiceId/void',
  requirePlatformAdmin(),
  adminVoidInvoice
);
router.post(
  '/admin/organizations/:organizationId/invoices/:invoiceId/revise',
  requirePlatformAdmin(),
  adminReviseInvoice
);
router.post(
  '/admin/organizations/:organizationId/invoices/:invoiceId/restore-revision',
  requirePlatformAdmin(),
  adminRestoreInvoiceRevision
);
router.post(
  '/admin/organizations/:organizationId/invoices/:invoiceId/credit-notes',
  requirePlatformAdmin(),
  adminIssueCreditNote
);
router.put(
  '/admin/organizations/:organizationId/pending-discount',
  requirePlatformAdmin(),
  adminSetPendingDiscount
);
router.put(
  '/admin/organizations/:organizationId/recurring-discount',
  requirePlatformAdmin(),
  adminSetRecurringDiscount
);

module.exports = router;
