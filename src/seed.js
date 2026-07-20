const db = require('./db');
const transactionService = require('./services/transactionService');
const customerService = require('./services/customerService');
const payoutService = require('./services/payoutService');
const blueprintService = require('./services/blueprintService');
const logger = require('./utils/logger');

const SEED_ORGANIZATION_ID = 'org_demo';

const CUSTOMERS = [
  { name: 'Acme Corp', email: 'billing@acmecorp.com', phone: '+1-555-0101', metadata: { industry: 'ecommerce', tier: 'professional' } },
  { name: 'GlobalTech Solutions', email: 'payments@globaltech.io', phone: '+1-555-0102', metadata: { industry: 'saas', tier: 'enterprise' } },
  { name: 'PixelPerfect Studio', email: 'finance@pixelperfect.design', phone: '+1-555-0103', metadata: { industry: 'design', tier: 'starter' } },
  { name: 'Quantum Logistics', email: 'accounts@quantumlogistics.com', phone: '+1-555-0104', metadata: { industry: 'logistics', tier: 'professional' } },
  { name: 'NexGen Health', email: 'billing@nexgenhealth.org', phone: '+1-555-0105', metadata: { industry: 'healthcare', tier: 'enterprise' } },
  { name: 'DataFlow Analytics', email: 'finance@dataflow.com', phone: '+1-555-0106', metadata: { industry: 'analytics', tier: 'starter' } },
  { name: 'Skyline Retail', email: 'payments@skylineretail.com', phone: '+1-555-0107', metadata: { industry: 'retail', tier: 'professional' } },
  { name: 'BlueOcean SaaS', email: 'billing@blueocean.dev', phone: '+1-555-0108', metadata: { industry: 'saas', tier: 'enterprise' } },
];

const TRANSACTIONS = [
  { amount: 299.00, currency: 'USD', description: 'Annual subscription - Pro plan', status: 'SUCCEEDED', customerIdx: 0 },
  { amount: 50.00, currency: 'USD', description: 'Top-up - Wallet credit', status: 'SUCCEEDED', customerIdx: 1 },
  { amount: 1500.00, currency: 'USD', description: 'Enterprise license renewal', status: 'SUCCEEDED', customerIdx: 1 },
  { amount: 42.00, currency: 'EUR', description: 'Design assets package', status: 'SUCCEEDED', customerIdx: 2 },
  { amount: 890.00, currency: 'USD', description: 'Monthly logistics partnership', status: 'SUCCEEDED', customerIdx: 3 },
  { amount: 12.00, currency: 'GBP', description: 'API usage overage', status: 'FAILED', customerIdx: 0 },
  { amount: 450.00, currency: 'USD', description: 'Healthcare compliance package', status: 'SUCCEEDED', customerIdx: 4 },
  { amount: 99.00, currency: 'USD', description: 'Starter plan - Monthly', status: 'SUCCEEDED', customerIdx: 5 },
  { amount: 750.00, currency: 'USD', description: 'Q2 bulk processing fee', status: 'SUCCEEDED', customerIdx: 6 },
  { amount: 1200.00, currency: 'EUR', description: 'Enterprise infrastructure fee', status: 'PENDING', customerIdx: 7 },
  { amount: 32.00, currency: 'USD', description: 'Additional API calls', status: 'SUCCEEDED', customerIdx: 2 },
  { amount: 280.00, currency: 'USD', description: 'Data export service', status: 'REFUNDED', customerIdx: 5 },
  { amount: 95.00, currency: 'GBP', description: 'UK compliance processing', status: 'SUCCEEDED', customerIdx: 4 },
  { amount: 670.00, currency: 'USD', description: 'Monthly retainer', status: 'SUCCEEDED', customerIdx: 3 },
  { amount: 18.00, currency: 'USD', description: 'Test transaction - voided', status: 'FAILED', customerIdx: 0 },
];

const PAYOUTS = [
  { amount: 5000.00, status: 'PAID', currency: 'USD', customerIdx: 0 },
  { amount: 12000.00, status: 'PENDING', currency: 'USD', customerIdx: 1 },
  { amount: 8000.00, status: 'PAID', currency: 'USD', customerIdx: 2 },
  { amount: 20000.00, status: 'PROCESSING', currency: 'USD', customerIdx: 3 },
  { amount: 3500.00, status: 'PAID', currency: 'USD', customerIdx: 4 },
];

const seed = async () => {
  const customers = [];
  for (const c of CUSTOMERS) {
    // Idempotent: reuse an existing customer with the same email so the
    // seed (and demo) can be run more than once against the same database.
    const existing = await db('customers').where({ email: c.email }).first();
    if (existing) {
      customers.push(existing);
      continue;
    }
    const customer = await customerService.createCustomer(c);
    customers.push(customer);
  }

  for (const t of TRANSACTIONS) {
    const txn = await transactionService.createTransaction({
      organizationId: SEED_ORGANIZATION_ID,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      customer: { id: customers[t.customerIdx].id, email: CUSTOMERS[t.customerIdx].email },
      idempotencyKey: `seed_txn_${t.customerIdx}_${Math.round(t.amount * 100)}_${t.status.toLowerCase()}`,
      payment_method: { type: 'CARD', token: `tok_seed_${t.customerIdx}` },
    });

    if (t.status === 'REFUNDED') {
      await transactionService.refundTransaction({
        transactionId: txn.id,
        idempotencyKey: `seed_refund_${t.customerIdx}_${Math.round(t.amount * 100)}`,
      });
    } else if (t.status !== 'SUCCEEDED') {
      await transactionService.updateTransactionStatus(txn.id, t.status);
    }
  }

  for (const [index, p] of PAYOUTS.entries()) {
    const recipientAccount = await payoutService.registerRecipientAccount({
      organizationId: SEED_ORGANIZATION_ID,
      recipientId: customers[p.customerIdx].id,
      processorAccountId: `acct_seed_${p.customerIdx}`,
      currency: p.currency,
    });
    await payoutService.verifyRecipientAccount(SEED_ORGANIZATION_ID, recipientAccount.id);

    const payout = await payoutService.createPayout({
      organizationId: SEED_ORGANIZATION_ID,
      recipientAccountId: recipientAccount.id,
      amount: p.amount,
      currency: p.currency,
      scheduledFor: p.status === 'PENDING' || p.status === 'PROCESSING'
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      idempotencyKey: `seed_payout_${index}_${Math.round(p.amount * 100)}`,
      sourceType: 'MANUAL',
      sourceReferenceId: `seed_payout_${index}`,
      metadata: { seed: true },
    });

    if (p.status !== payout.status) {
      const updatePayload = {
        status: p.status,
        processed_at: p.status === 'PAID' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (p.status === 'PROCESSING') {
        updatePayload.ledger_transaction_id = null;
      }

      await db('payouts')
        .where({ id: payout.id })
        .update(updatePayload);
    }
  }

  await blueprintService.seedBlueprints();

  logger.info(`Seed complete: ${customers.length} customers, ${TRANSACTIONS.length} transactions, ${PAYOUTS.length} payouts`);
};

module.exports = { seed };
