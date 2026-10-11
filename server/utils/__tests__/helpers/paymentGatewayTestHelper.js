/**
 * PAY3.0 gateway integration test helpers.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Organization = require('../../../models/Organization');
const Invoice = require('../../../models/Invoice');
const OrganizationPaymentGatewaySettings = require('../../../models/OrganizationPaymentGatewaySettings');
const {
  mockStripeGatewayAdapter
} = require('../../../services/gateways/gatewayAdapterRegistry');

async function createTestOrganization(label = 'tenant', { currency } = {}) {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return Organization.create({
    name: `Gateway Test ${label} ${suffix}`,
    slug: `gw-${label}-${suffix}`,
    isTenant: true,
    isActive: true,
    ...(currency ? { settings: { currency } } : {})
  });
}

async function createPostedInvoice({
  organizationId,
  organizationRefId,
  amountDue = 100,
  currency = 'USD',
  status = 'Posted',
  assignedTo = new mongoose.Types.ObjectId()
}) {
  return Invoice.create({
    organizationId,
    organizationRefId,
    assignedTo,
    status,
    invoiceType: 'standard',
    grandTotal: amountDue,
    amountDue,
    amountPaid: 0,
    creditAppliedTotal: 0,
    writeOffTotal: 0,
    currency,
    postedAt: new Date()
  });
}

async function seedGatewayContext({ amountDue = 100, providers = ['stripe'], currency = 'USD' } = {}) {
  mockStripeGatewayAdapter.resetMockStripeStore();
  const { mockRazorpayGatewayAdapter } = require('../../../services/gateways/gatewayAdapterRegistry');
  mockRazorpayGatewayAdapter.resetMockRazorpayStore();

  const tenant = await createTestOrganization('tenant', { currency });
  const account = await createTestOrganization('account');

  const invoice = await createPostedInvoice({
    organizationId: tenant._id,
    organizationRefId: account._id,
    amountDue,
    currency
  });

  const credentialHealth = {};
  if (providers.includes('stripe')) {
    credentialHealth.stripe = { status: 'healthy', lastCheckedAt: new Date() };
  }
  if (providers.includes('razorpay')) {
    credentialHealth.razorpay = { status: 'healthy', lastCheckedAt: new Date() };
  }

  await OrganizationPaymentGatewaySettings.create({
    organizationId: tenant._id,
    enabledProviders: providers,
    credentialHealth,
    manualBankTransfer: providers.includes('manual')
      ? {
          beneficiaryName: 'Test Beneficiary',
          bankName: 'Test Bank',
          accountNumberMasked: '••••1234',
          routingOrIfsc: 'TEST0001234'
        }
      : undefined
  });

  return { tenant, account, invoice };
}

function mockRazorpayWebhookHeaders() {
  const { mockRazorpayGatewayAdapter } = require('../../../services/gateways/gatewayAdapterRegistry');
  return {
    [mockRazorpayGatewayAdapter.MOCK_SIGNATURE_HEADER]: mockRazorpayGatewayAdapter.MOCK_VALID_SIGNATURE
  };
}

function mockWebhookHeaders() {
  return {
    [mockStripeGatewayAdapter.MOCK_SIGNATURE_HEADER]: mockStripeGatewayAdapter.MOCK_VALID_SIGNATURE
  };
}

module.exports = {
  createTestOrganization,
  createPostedInvoice,
  seedGatewayContext,
  mockWebhookHeaders,
  mockRazorpayWebhookHeaders
};
