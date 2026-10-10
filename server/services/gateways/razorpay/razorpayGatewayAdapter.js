/**
 * PAY3.2 — Razorpay gateway adapter (Orders API + Checkout).
 */

const crypto = require('crypto');
const {
  RAZORPAY_CAPTURE_SUCCESS_EVENTS,
  RAZORPAY_CAPTURE_FAILURE_EVENTS,
  RAZORPAY_REFUND_EVENTS
} = require('../../../constants/paymentGatewayLifecycle');

function getRazorpayClient(settings = {}) {
  const keyId = resolveKeyId(settings);
  const keySecret = resolveKeySecret(settings);

  if (!keyId || !keySecret) {
    const err = new Error('Razorpay credentials are not configured');
    err.code = 'GATEWAY_CREDENTIALS_INVALID';
    throw err;
  }

  let Razorpay;
  try {
    Razorpay = require('razorpay');
  } catch {
    const err = new Error('razorpay package is not installed');
    err.code = 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function resolveKeyId(settings = {}) {
  return process.env.RAZORPAY_KEY_ID || settings?.razorpay?.keyId || null;
}

function resolveKeySecret(settings = {}) {
  return process.env.RAZORPAY_KEY_SECRET || settings?.razorpay?.keySecret || null;
}

function resolveWebhookSecret(settings = {}) {
  return settings?.razorpay?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || null;
}

function resolvePublicAppUrl() {
  const { resolveClientUrl } = require('../../../utils/clientUrl');
  return resolveClientUrl([process.env.PUBLIC_APP_URL, process.env.CLIENT_URL]);
}

async function verifyCredentials({ settings = {} }) {
  const keyId = resolveKeyId(settings);
  const keySecret = resolveKeySecret(settings);
  if (!keyId || !keySecret) {
    return { status: 'invalid', errorMessage: 'Razorpay key id/secret missing' };
  }

  try {
    const razorpay = getRazorpayClient(settings);
    await razorpay.orders.all({ count: 1 });
    return { status: 'healthy' };
  } catch (err) {
    return { status: 'invalid', errorMessage: err.message };
  }
}

async function createCheckoutSession({
  organizationId,
  settings = {},
  amount,
  currency,
  successUrl,
  cancelUrl,
  metadata = {}
}) {
  const razorpay = getRazorpayClient(settings);
  const normalizedCurrency = String(currency || 'INR').toUpperCase();
  const amountMinor = Math.round(Number(amount) * 100);

  const order = await razorpay.orders.create({
    amount: amountMinor,
    currency: normalizedCurrency,
    notes: {
      organizationId: String(organizationId),
      paymentGatewaySessionId: metadata.paymentGatewaySessionId || '',
      paymentLinkId: metadata.paymentLinkId || '',
      organizationRefId: metadata.organizationRefId || '',
      productName: metadata.productName || 'Invoice payment'
    }
  });

  const baseUrl = resolvePublicAppUrl().replace(/\/$/, '');
  const checkoutUrl =
    metadata.checkoutUrl ||
    `${baseUrl}/pay/checkout/razorpay?orderId=${encodeURIComponent(order.id)}&sessionId=${encodeURIComponent(metadata.paymentGatewaySessionId || '')}&successUrl=${encodeURIComponent(successUrl || '')}&cancelUrl=${encodeURIComponent(cancelUrl || '')}&keyId=${encodeURIComponent(resolveKeyId(settings))}`;

  return {
    providerSessionId: order.id,
    checkoutUrl,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    razorpayKeyId: resolveKeyId(settings),
    razorpayOrderId: order.id,
    amountMinor,
    currency: normalizedCurrency
  };
}

function verifyWebhookSignature(rawBody, headers = {}, settings = {}) {
  const webhookSecret = resolveWebhookSecret(settings);
  if (!webhookSecret) return false;

  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const signature = headers['x-razorpay-signature'];
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', webhookSecret).update(bodyString).digest('hex');
  return expected === signature;
}

function extractPaymentEntity(body = {}) {
  return body.payload?.payment?.entity || body.payload?.order?.entity?.payments?.[0] || null;
}

function parseWebhookEvent(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const eventType = body.event;
  const paymentEntity = extractPaymentEntity(body);
  const orderEntity = body.payload?.order?.entity || null;
  const entity = paymentEntity || orderEntity || {};

  const providerEventId = body.id || `${eventType}_${entity.id || Date.now()}`;
  const notes = entity.notes || orderEntity?.notes || {};
  const amountMinor = entity.amount != null ? Number(entity.amount) : orderEntity?.amount != null ? Number(orderEntity.amount) : null;

  return {
    providerEventId,
    eventType,
    providerSessionId: entity.order_id || orderEntity?.id || null,
    providerPaymentId: entity.id?.startsWith('pay_') ? entity.id : paymentEntity?.id || null,
    amount: amountMinor != null ? amountMinor / 100 : null,
    currency: entity.currency ? String(entity.currency).toUpperCase() : orderEntity?.currency
      ? String(orderEntity.currency).toUpperCase()
      : null,
    status: eventType && RAZORPAY_CAPTURE_FAILURE_EVENTS.includes(eventType) ? 'failed' : 'succeeded',
    organizationId: notes.organizationId || null,
    paymentGatewaySessionId: notes.paymentGatewaySessionId || null,
    paymentLinkId: notes.paymentLinkId || null,
    raw: body
  };
}

function buildInstrumentSnapshot(parsedEvent, rawEvent = {}) {
  const payment = rawEvent?.payload?.payment?.entity || {};
  const method = payment.method === 'card' ? 'card' : 'other';
  return {
    method,
    referenceNumber: parsedEvent.providerPaymentId,
    bankName: payment.bank || null,
    maskedAccount: payment.vpa || payment.card?.last4 ? `••••${payment.card.last4}` : null,
    provider: 'razorpay'
  };
}

function isCaptureSuccessEvent(eventType) {
  return RAZORPAY_CAPTURE_SUCCESS_EVENTS.includes(eventType);
}

function isCaptureFailureEvent(eventType) {
  return RAZORPAY_CAPTURE_FAILURE_EVENTS.includes(eventType);
}

function isRefundEvent(eventType) {
  return RAZORPAY_REFUND_EVENTS.includes(eventType);
}

module.exports = {
  providerKey: 'razorpay',
  verifyCredentials,
  createCheckoutSession,
  verifyWebhookSignature,
  parseWebhookEvent,
  buildInstrumentSnapshot,
  isCaptureSuccessEvent,
  isCaptureFailureEvent,
  isRefundEvent,
  resolveKeyId
};
