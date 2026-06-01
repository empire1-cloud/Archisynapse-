const transactionService = require('./services/transactionService');
const customerService = require('./services/customerService');
const blueprintService = require('./services/blueprintService');
const logger = require('./utils/logger');

const CUSTOMERS = [
  { name: 'Acme Corp', email: 'billing@acmecorp.com', phone: '+1-555-0101', metadata: { industry: 'ecommerce', tier: 'professional' } },
  { name: 'GlobalTech Solutions', email: 'payments@globaltech.io', phone: '+1-555-0102', metadata: { industry: 'saas', tier: 'enterprise' } },
  { name: 'PixelPerfect Studio', email: 'finance@pixelperfect.design', phone: '+1-555-0103', metadata: { industry: 'design', tier: 'starter' } },
  { name: 'Quantum Logistics', email: 'accounts@quantumlogistics.com', phone: '+1-555-0104', metadata: { industry: 'logistics', tier: 'professional' } },
  { name: 'NexGen Health', email: 'billing@nexgenhealth.org', phone: '+1-555-0105', metadata: { industry: 'healthcare', tier: 'enterprise' } },
  { name: 'DataFlow Analytics', email: 'finance@dataflow.com', phone: '+1-555-0106', metadata: { industry: 'analytics', tier: 'starter' } },
  { name: 'Skyline Retail', email: 'payments@skylineretail.com', phone: '+1-555-0107', metadata: { industry: 'retail', tier: 'professional' } },
  { name: 'BlueOcean SaaS', email: 'billing@blueocean.dev', phone: '+1-555-0108', metadata: { industry: 'saas', tier: 'enterprise' } }
];

const TRANSACTIONS = [
  { amount: 29900, currency: 'USD', description: 'Annual subscription - Pro plan', status: 'succeeded', customerIdx: 0 },
  { amount: 5000, currency: 'USD', description: 'Top-up - Wallet credit', status: 'succeeded', customerIdx: 1 },
  { amount: 150000, currency: 'USD', description: 'Enterprise license renewal', status: 'succeeded', customerIdx: 1 },
  { amount: 4200, currency: 'EUR', description: 'Design assets package', status: 'succeeded', customerIdx: 2 },
  { amount: 89000, currency: 'USD', description: 'Monthly logistics partnership', status: 'succeeded', customerIdx: 3 },
  { amount: 1200, currency: 'GBP', description: 'API usage overage', status: 'failed', customerIdx: 0 },
  { amount: 45000, currency: 'USD', description: 'Healthcare compliance package', status: 'succeeded', customerIdx: 4 },
  { amount: 9900, currency: 'USD', description: 'Starter plan - Monthly', status: 'succeeded', customerIdx: 5 },
  { amount: 75000, currency: 'USD', description: 'Q2 bulk processing fee', status: 'succeeded', customerIdx: 6 },
  { amount: 120000, currency: 'EUR', description: 'Enterprise infrastructure fee', status: 'pending', customerIdx: 7 },
  { amount: 3200, currency: 'USD', description: 'Additional API calls', status: 'succeeded', customerIdx: 2 },
  { amount: 28000, currency: 'USD', description: 'Data export service', status: 'refunded', customerIdx: 5 },
  { amount: 9500, currency: 'GBP', description: 'UK compliance processing', status: 'succeeded', customerIdx: 4 },
  { amount: 67000, currency: 'USD', description: 'Monthly retainer', status: 'succeeded', customerIdx: 3 },
  { amount: 1800, currency: 'USD', description: 'Test transaction - voided', status: 'failed', customerIdx: 0 }
];

const seed = async () => {
  const customers = [];
  for (const c of CUSTOMERS) {
    const customer = await customerService.createCustomer(c);
    customers.push(customer);
  }

  for (const t of TRANSACTIONS) {
    const txn = await transactionService.createTransaction({
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      customer: { id: customers[t.customerIdx].id, email: CUSTOMERS[t.customerIdx].email },
      payment_method: { type: 'card' }
    });

    if (t.status === 'refunded') {
      await transactionService.refundTransaction({ transactionId: txn.id });
    } else if (t.status !== 'succeeded') {
      transactionService.updateTransactionStatus(txn.id, t.status);
    }
  }

  await blueprintService.seedBlueprints();

  logger.info(`Seed complete: ${customers.length} customers, ${TRANSACTIONS.length} transactions`);
};

module.exports = { seed };
