const Stripe = require('stripe');

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

let cachedStripe = null;

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
  if (!isStripeConfigured()) {
    return null;
  }

  if (!cachedStripe) {
    cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return cachedStripe;
}

async function ensureCustomer({ existingStripeCustomerId, email, name, phone, metadata } = {}) {
  if (!isStripeConfigured()) {
    return { id: existingStripeCustomerId || null, created: false };
  }

  if (existingStripeCustomerId) {
    return { id: existingStripeCustomerId, created: false };
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    phone: phone || undefined,
    metadata: stringifyMetadata(metadata),
  });

  return { id: customer.id, created: true };
}

async function createPayment({ amount, currency, paymentMethodToken, customerId, description, metadata } = {}) {
  if (!isStripeConfigured()) {
    return {
      success: true,
      processorTransactionId: `proc_stub_${Date.now()}`,
      paymentMethodLast4: null,
      paymentMethodBrand: null,
      stripeCustomerId: customerId || null,
    };
  }

  const stripe = getStripeClient();
  const paymentMethodId = await resolvePaymentMethod(stripe, paymentMethodToken);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: toMinorUnit(amount, currency),
    currency: normalizeCurrency(currency),
    customer: customerId || undefined,
    payment_method: paymentMethodId,
    confirm: true,
    error_on_requires_action: true,
    description: description || undefined,
    metadata: stringifyMetadata(metadata),
  });

  return {
    success: paymentIntent.status === 'succeeded',
    processorTransactionId: paymentIntent.id,
    paymentMethodLast4: paymentIntent.payment_method_details?.card?.last4 || null,
    paymentMethodBrand: paymentIntent.payment_method_details?.card?.brand || null,
    stripeCustomerId: paymentIntent.customer || customerId || null,
    rawStatus: paymentIntent.status,
  };
}

async function createRefund({ processorTransactionId, amount, currency, reason, metadata } = {}) {
  if (!isStripeConfigured()) {
    return {
      success: true,
      processorRefundId: `re_stub_${Date.now()}`,
      rawStatus: 'succeeded',
    };
  }

  const stripe = getStripeClient();
  const refund = await stripe.refunds.create({
    payment_intent: processorTransactionId,
    amount: amount != null ? toMinorUnit(amount, currency) : undefined,
    reason: normalizeRefundReason(reason),
    metadata: stringifyMetadata(metadata),
  });

  return {
    success: refund.status === 'succeeded',
    processorRefundId: refund.id,
    rawStatus: refund.status,
  };
}

async function createTransfer({ destinationAccountId, amount, currency, description, metadata } = {}) {
  if (!isStripeConfigured()) {
    return {
      success: true,
      processorPayoutId: `tr_stub_${Date.now()}`,
      rawStatus: 'paid',
    };
  }

  const stripe = getStripeClient();
  const transfer = await stripe.transfers.create({
    amount: toMinorUnit(amount, currency),
    currency: normalizeCurrency(currency),
    destination: destinationAccountId,
    description: description || undefined,
    metadata: stringifyMetadata(metadata),
  });

  return {
    success: Boolean(transfer.id),
    processorPayoutId: transfer.id,
    rawStatus: transfer.object,
  };
}

async function resolvePaymentMethod(stripe, token) {
  if (!token) {
    throw new Error('payment method token is required for Stripe processing');
  }

  if (token.startsWith('pm_') || token.startsWith('card_') || token.startsWith('src_')) {
    return token;
  }

  if (token.startsWith('tok_')) {
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: { token },
    });
    return paymentMethod.id;
  }

  return token;
}

function toMinorUnit(amount, currency = 'USD') {
  const normalizedCurrency = String(currency || 'USD').toUpperCase();
  const factor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;
  return Math.round(Number(amount) * factor);
}

function normalizeCurrency(currency = 'USD') {
  return String(currency || 'USD').toLowerCase();
}

function normalizeRefundReason(reason) {
  const normalized = String(reason || '').toLowerCase();

  if (normalized.includes('fraud')) return 'fraudulent';
  if (normalized.includes('duplicate')) return 'duplicate';
  return 'requested_by_customer';
}

function stringifyMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
  );
}

module.exports = {
  isStripeConfigured,
  ensureCustomer,
  createPayment,
  createRefund,
  createTransfer,
};
