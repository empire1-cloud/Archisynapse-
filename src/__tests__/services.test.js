const transactionService = require('../services/transactionService');
const customerService = require('../services/customerService');
const payoutService = require('../services/payoutService');
const riskService = require('../services/riskService');
const riskSequenceService = require('../services/riskSequenceService');
const blueprintService = require('../services/blueprintService');
const db = require('../db');
const { TransactionService, PaymentStatus } = require('../services/transactionService');

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

describe('Transaction Service', () => {
  it('should create a transaction', async () => {
    const txn = await transactionService.createTransaction({
      organizationId: `org_${Date.now()}`,
      amount: 1000,
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      payment_method: { type: 'CARD', token: 'tok_visa' }
    });
    expect(txn.id).toMatch(/^txn_/);
    expect(txn.status).toBe(transactionService.PaymentStatus.SUCCEEDED);
    expect(txn.amount).toBe(1000);
    expect(txn.ledgerTransactionId).toMatch(/^ldg_txn_/);
  });

  it('should get a transaction by id', async () => {
    const txn = await transactionService.createTransaction({
      organizationId: `org_${Date.now()}`,
      amount: 500,
      currency: 'EUR',
      idempotencyKey: `idem_${Date.now()}`,
      payment_method: { type: 'CARD', token: 'tok_visa' }
    });
    const found = await transactionService.getTransaction(txn.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(txn.id);
  });

  it('should return null for non-existent transaction', async () => {
    const found = await transactionService.getTransaction('nonexistent');
    expect(found).toBeNull();
  });

  it('should list transactions with pagination', async () => {
    const organizationId = `org_${Date.now()}`;
    await transactionService.createTransaction({
      organizationId,
      amount: 125,
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      payment_method: { type: 'CARD', token: 'tok_visa' }
    });
    const result = await transactionService.listTransactions({ organizationId, limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(parseInt(result.limit)).toBe(10);
  });

  it('should refund a transaction', async () => {
    const txn = await transactionService.createTransaction({
      organizationId: `org_${Date.now()}`,
      amount: 2000,
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      payment_method: { type: 'CARD', token: 'tok_visa' }
    });
    const refund = await transactionService.refundTransaction({
      transactionId: txn.id,
      reason: 'Customer requested refund',
      idempotencyKey: `refund_${Date.now()}`,
    });
    expect(refund).toHaveProperty('id');
    expect(refund.amount).toBe(2000);
    expect(refund.status).toBe(transactionService.PaymentStatus.SUCCEEDED);
  });

  it('should reject refund of non-existent transaction', async () => {
    await expect(
      transactionService.refundTransaction({ transactionId: 'nonexistent' })
    ).rejects.toThrow('Transaction not found');
  });

  it('should surface succeeded-but-unposted payments for reconciliation', async () => {
    const ledgerClient = {
      ensureCoreAccounts: async () => ({
        cashAccountId: 'acct_cash_stub',
        revenueAccountId: 'acct_revenue_stub',
      }),
      postPaymentSucceeded: async () => {
        throw new Error('ledger unavailable');
      },
      postRefund: async () => {
        throw new Error('not used');
      },
    };

    const service = new TransactionService(db, ledgerClient);
    const organizationId = `org_${Date.now()}`;

    const payment = await service.createPayment({
      organizationId,
      amount: 88,
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      paymentMethod: { type: 'CARD', token: 'tok_visa' },
      description: 'Needs reconciliation',
    });

    expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
    expect(payment.ledgerTransactionId).toBeNull();

    const unposted = await service.findUnpostedPayments(organizationId);
    expect(unposted.length).toBeGreaterThan(0);
    expect(unposted.some((item) => item.id === payment.id)).toBe(true);
  });

  it('should retry an unposted payment into the ledger exactly once', async () => {
    const failingLedgerClient = {
      ensureCoreAccounts: async () => ({
        cashAccountId: 'acct_cash_stub',
        revenueAccountId: 'acct_revenue_stub',
      }),
      postPaymentSucceeded: async () => {
        throw new Error('ledger unavailable');
      },
      postRefund: async () => {
        throw new Error('not used');
      },
    };

    const failingService = new TransactionService(db, failingLedgerClient);
    const organizationId = `org_${Date.now()}`;

    const created = await failingService.createPayment({
      organizationId,
      amount: 91,
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      paymentMethod: { type: 'CARD', token: 'tok_visa' },
      description: 'Retry later',
    });

    expect(created.ledgerTransactionId).toBeNull();

    const successfulLedgerClient = {
      ensureCoreAccounts: async () => ({
        cashAccountId: 'acct_cash_retry',
        revenueAccountId: 'acct_revenue_retry',
      }),
      postPaymentSucceeded: async () => ({
        id: 'ldg_retry_once',
      }),
      postRefund: async () => {
        throw new Error('not used');
      },
    };

    const retryService = new TransactionService(db, successfulLedgerClient);
    const firstRetry = await retryService.retryUnpostedPayment(organizationId, created.id);
    const secondRetry = await retryService.retryUnpostedPayment(organizationId, created.id);

    expect(firstRetry.ledgerTransactionId).toBe('ldg_retry_once');
    expect(secondRetry.ledgerTransactionId).toBe('ldg_retry_once');
  });

  it('should collapse concurrent creates for the same idempotency key', async () => {
    const organizationId = `org_${Date.now()}`;
    const idempotencyKey = `idem_concurrent_${Date.now()}`;

    const [first, second] = await Promise.all([
      transactionService.createTransaction({
        organizationId,
        amount: 33,
        currency: 'USD',
        idempotencyKey,
        payment_method: { type: 'CARD', token: 'tok_visa' }
      }),
      transactionService.createTransaction({
        organizationId,
        amount: 33,
        currency: 'USD',
        idempotencyKey,
        payment_method: { type: 'CARD', token: 'tok_visa' }
      }),
    ]);

    const rows = await db('payments')
      .where({ organization_id: organizationId, idempotency_key: idempotencyKey });

    expect(first.id).toBe(second.id);
    expect(rows).toHaveLength(1);
  });

  it('should allow different idempotency keys to create independent payments', async () => {
    const organizationId = `org_${Date.now()}`;

    const [first, second] = await Promise.all([
      transactionService.createTransaction({
        organizationId,
        amount: 17,
        currency: 'USD',
        idempotencyKey: `idem_a_${Date.now()}`,
        payment_method: { type: 'CARD', token: 'tok_visa' }
      }),
      transactionService.createTransaction({
        organizationId,
        amount: 17,
        currency: 'USD',
        idempotencyKey: `idem_b_${Date.now()}`,
        payment_method: { type: 'CARD', token: 'tok_visa' }
      }),
    ]);

    expect(first.id).not.toBe(second.id);
  });
});

describe('Customer Service', () => {
  it('should create a customer', async () => {
    const email = `test-${Date.now()}@example.com`;
    const customer = await customerService.createCustomer({
      email,
      name: 'John Doe'
    });
    expect(customer.id).toMatch(/^cus_/);
    expect(customer.email).toBe(email);
    expect(customer.name).toBe('John Doe');
  });

  it('should get a customer by id', async () => {
    const email = `jane-${Date.now()}@example.com`;
    const c = await customerService.createCustomer({
      email,
      name: 'Jane Doe'
    });
    const found = await customerService.getCustomer(c.id);
    expect(found).not.toBeNull();
    expect(found.email).toBe(email);
  });

  it('should return null for non-existent customer', async () => {
    const found = await customerService.getCustomer('nonexistent');
    expect(found).toBeNull();
  });

  it('should list customers with pagination', async () => {
    const result = await customerService.listCustomers({ limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(parseInt(result.limit)).toBe(10);
  });
});

describe('Risk Service', () => {
  it('should cache royalty risk decisions by idempotency key', async () => {
    const organizationId = `org_risk_${Date.now()}`;
    const idempotencyKey = `risk_idem_${Date.now()}`;
    const payload = {
      amount: 2500,
      currency: 'USD',
      creatorId: 'creator-risk',
      trackId: 'track-risk',
      deviceId: 'device-risk',
      email: `creator-risk-${Date.now()}@example.com`,
      payoutDestination: 'acct_shared_destination',
      dnaVerified: true,
      soulprintVerified: true,
      ledgerRecordFound: true,
      usageCount: 10,
      creatorAccountAgeDays: 90,
      payoutMethodAgeDays: 90,
      duplicatePayoutDestination: false,
      payoutDestinationChangedRecently: false,
      suddenUsageSpike: false,
      eventType: 'royalty_payout_request',
    };

    const first = await riskService.createRoyaltyRiskDecision({
      organizationId,
      event: payload,
      idempotencyKey,
    });

    const second = await riskService.createRoyaltyRiskDecision({
      organizationId,
      event: payload,
      idempotencyKey,
    });

    expect(first.id).toBe(second.id);
    expect(first.riskScore).toBe(second.riskScore);
  });

  it('should summarize risk outcomes for an organization', async () => {
    const organizationId = `org_risk_summary_${Date.now()}`;

    await riskService.createRoyaltyRiskDecision({
      organizationId,
      idempotencyKey: `risk_summary_a_${Date.now()}`,
      event: {
        amount: 9000,
        currency: 'USD',
        creatorId: 'creator-summary-a',
        payoutDestination: 'acct_summary_a',
        dnaVerified: false,
        soulprintVerified: false,
        ledgerRecordFound: false,
        usageCount: 12000,
        creatorAccountAgeDays: 1,
        payoutMethodAgeDays: 0,
        duplicatePayoutDestination: true,
        payoutDestinationChangedRecently: true,
        suddenUsageSpike: true,
        eventType: 'royalty_payout_request',
      },
    });

    await riskService.createRoyaltyRiskDecision({
      organizationId,
      idempotencyKey: `risk_summary_b_${Date.now()}`,
      event: {
        amount: 100,
        currency: 'USD',
        creatorId: 'creator-summary-b',
        payoutDestination: 'acct_summary_b',
        dnaVerified: true,
        soulprintVerified: true,
        ledgerRecordFound: true,
        usageCount: 5,
        creatorAccountAgeDays: 180,
        payoutMethodAgeDays: 180,
        duplicatePayoutDestination: false,
        payoutDestinationChangedRecently: false,
        suddenUsageSpike: false,
        eventType: 'royalty_payout_request',
      },
    });

    const summary = await riskService.getRiskSummary(organizationId);

    expect(summary.totalEvents).toBe(2);
    expect(summary.blockedPayoutEvents).toBe(1);
    expect(summary.releasedPayoutEvents).toBe(1);
    expect(summary.averageRiskScore).toBeGreaterThan(0);
  });

  it('should export Archisynapse-native creator risk sequences for model sidecars', async () => {
    const organizationId = `org_seq_${Date.now()}`;
    const recipientId = `creator_seq_${Date.now()}`;
    const processorAccountId = `acct_seq_${Date.now()}`;

    const account = await payoutService.registerRecipientAccount({
      organizationId,
      recipientId,
      processorAccountId,
      currency: 'USD',
    });
    await payoutService.verifyRecipientAccount(organizationId, account.id);

    await payoutService.createPayout({
      organizationId,
      recipientAccountId: account.id,
      amount: 41,
      currency: 'USD',
      idempotencyKey: `idem_seq_${Date.now()}`,
      sourceType: 'EARNINGS',
      sourceReferenceId: `royalty_seq_${Date.now()}`,
    });

    await riskService.createRoyaltyRiskDecision({
      organizationId,
      idempotencyKey: `risk_seq_${Date.now()}`,
      event: {
        eventType: 'royalty_payout_request',
        amount: 41,
        currency: 'USD',
        creatorId: recipientId,
        payoutDestination: processorAccountId,
        dnaVerified: true,
        soulprintVerified: true,
        ledgerRecordFound: true,
        usageCount: 1200,
        suddenUsageSpike: false,
        creatorAccountAgeDays: 40,
        payoutMethodAgeDays: 1,
        duplicatePayoutDestination: false,
        payoutDestinationChangedRecently: true,
      },
    });

    const sequences = await riskSequenceService.listCreatorRiskSequences(organizationId, {
      recipientId,
      limit: 5,
      eventLimit: 10,
    });

    expect(sequences.total).toBe(1);
    expect(sequences.items[0].recipientId).toBe(recipientId);
    expect(sequences.items[0].eventCount).toBeGreaterThanOrEqual(2);
    expect(sequences.items[0].corpus).toContain('EVT_PAYOUT_PAID');
    expect(sequences.items[0].corpus).toContain('EVT_RISK_DELAY_PAYOUT_72H');
    expect(sequences.items[0].supervisionTarget).toBe('delayed_release');
  });
});

describe('Payout Service', () => {
  let organizationId;

  beforeAll(async () => {
    organizationId = `org_payout_${Date.now()}`;
    const account = await payoutService.registerRecipientAccount({
      organizationId,
      recipientId: `recipient_${Date.now()}`,
      processorAccountId: 'acct_services_test',
      currency: 'USD',
    });
    await payoutService.verifyRecipientAccount(organizationId, account.id);
    await payoutService.createPayout({
      organizationId,
      recipientAccountId: account.id,
      amount: 45,
      currency: 'USD',
      idempotencyKey: `idem_payout_services_${Date.now()}`,
      sourceType: 'MANUAL',
    });
  });

  it('should list payouts with default params', async () => {
    const result = await payoutService.listPayouts(organizationId);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter payouts by status', async () => {
    const result = await payoutService.listPayouts(organizationId, { status: 'PAID' });
    result.data.forEach(p => {
      expect(p.status).toBe('PAID');
    });
  });

  it('should block high-risk payouts before money movement', async () => {
    const account = await payoutService.registerRecipientAccount({
      organizationId,
      recipientId: `recipient_block_${Date.now()}`,
      processorAccountId: 'acct_services_block',
      currency: 'USD',
    });
    await payoutService.verifyRecipientAccount(organizationId, account.id);

    await expect(
      payoutService.createPayout({
        organizationId,
        recipientAccountId: account.id,
        amount: 120,
        currency: 'USD',
        idempotencyKey: `idem_payout_block_${Date.now()}`,
        sourceType: 'EARNINGS',
        sourceReferenceId: `royalty_${Date.now()}`,
        riskContext: {
          creatorId: 'creator-risk-blocked',
          payoutDestination: 'acct_services_block',
          dnaVerified: false,
          soulprintVerified: false,
          ledgerRecordFound: false,
          creatorAccountAgeDays: 1,
          payoutMethodAgeDays: 0,
          suddenUsageSpike: true,
        },
      })
    ).rejects.toMatchObject({ code: 'risk_blocked', statusCode: 403 });
  });

  it('should hold medium-high risk payouts for manual review until released', async () => {
    const account = await payoutService.registerRecipientAccount({
      organizationId,
      recipientId: `recipient_hold_${Date.now()}`,
      processorAccountId: 'acct_services_hold',
      currency: 'USD',
    });
    await payoutService.verifyRecipientAccount(organizationId, account.id);

    const payout = await payoutService.createPayout({
      organizationId,
      recipientAccountId: account.id,
      amount: 95,
      currency: 'USD',
      idempotencyKey: `idem_payout_hold_${Date.now()}`,
      sourceType: 'EARNINGS',
      sourceReferenceId: `royalty_hold_${Date.now()}`,
      riskContext: {
        creatorId: 'creator-risk-hold',
        payoutDestination: 'acct_services_hold',
        dnaVerified: false,
        soulprintVerified: false,
        ledgerRecordFound: true,
        creatorAccountAgeDays: 90,
        payoutMethodAgeDays: 90,
        suddenUsageSpike: false,
      },
    });

    expect(payout.status).toBe('PENDING');
    expect(payout.manualReviewRequired).toBe(true);
    expect(payout.riskDecision?.decision).toBe('hold_payout_review');

    const scheduled = await payoutService.processScheduledPayouts(organizationId);
    expect(scheduled.processed).toBe(0);
    expect(scheduled.failed).toBe(0);

    const released = await payoutService.releasePayoutManualReview(
      organizationId,
      payout.id,
      'Analyst approved creator payout'
    );

    expect(released.status).toBe('PAID');
    expect(released.manualReviewRequired).toBe(false);
    expect(released.metadata.manualReviewReleasedAt).toBeDefined();
  });

  it('should delay medium-risk payouts by 72 hours', async () => {
    const account = await payoutService.registerRecipientAccount({
      organizationId,
      recipientId: `recipient_delay_${Date.now()}`,
      processorAccountId: 'acct_services_delay',
      currency: 'USD',
    });
    await payoutService.verifyRecipientAccount(organizationId, account.id);

    const before = Date.now();
    const payout = await payoutService.createPayout({
      organizationId,
      recipientAccountId: account.id,
      amount: 77,
      currency: 'USD',
      idempotencyKey: `idem_payout_delay_${Date.now()}`,
      sourceType: 'EARNINGS',
      sourceReferenceId: `royalty_delay_${Date.now()}`,
      riskContext: {
        creatorId: 'creator-risk-delay',
        payoutDestination: 'acct_services_delay',
        dnaVerified: true,
        soulprintVerified: true,
        ledgerRecordFound: true,
        creatorAccountAgeDays: 45,
        payoutMethodAgeDays: 1,
        payoutDestinationChangedRecently: true,
      },
    });

    expect(payout.status).toBe('PENDING');
    expect(payout.manualReviewRequired).toBe(false);
    expect(payout.riskDecision?.decision).toBe('delay_payout_72h');
    expect(new Date(payout.scheduledFor).getTime()).toBeGreaterThanOrEqual(before + (71 * 60 * 60 * 1000));
  });
});

describe('Blueprint Service', () => {
  beforeEach(() => {
    blueprintService.seedBlueprints();
  });

  it('should seed 10 blueprints', () => {
    const all = blueprintService.getAllBlueprints();
    expect(all.length).toBe(10);
  });

  it('should get a blueprint by id', () => {
    const all = blueprintService.getAllBlueprints();
    const first = all[0];
    const found = blueprintService.getBlueprintById(first.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(first.id);
  });

  it('should get a blueprint by slug', () => {
    const found = blueprintService.getBlueprintBySlug('creator-royalty-split');
    expect(found).not.toBeNull();
    expect(found.name).toBe('Creator Royalty Split');
  });

  it('should return null for non-existent id', () => {
    const found = blueprintService.getBlueprintById('nonexistent');
    expect(found).toBeNull();
  });

  it('should list blueprints with pagination', () => {
    const result = blueprintService.listBlueprints({ limit: 3, offset: 0 });
    expect(result.items.length).toBe(3);
    expect(result.total).toBe(10);
  });

  it('should filter blueprints by category', () => {
    const result = blueprintService.listBlueprints({ category: 'creator-economy' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(b => expect(b.category).toBe('creator-economy'));
  });

  it('should filter blueprints by complexity', () => {
    const result = blueprintService.listBlueprints({ complexity: 'low' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Creator Royalty Split');
  });

  it('should match blueprints by tag', () => {
    const result = blueprintService.matchBlueprints({ tags: ['royalties'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Creator Royalty Split');
  });

  it('should match blueprints by query text', () => {
    const result = blueprintService.matchBlueprints({ query: 'royalty' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('should create a new blueprint', () => {
    const bp = blueprintService.createBlueprint({
      name: 'Test Pattern',
      description: 'A test blueprint',
      tags: ['test']
    });
    expect(bp.id).toBeDefined();
    expect(bp.slug).toBe('test-pattern');
    expect(bp.name).toBe('Test Pattern');
  });

  it('should update an existing blueprint', () => {
    const all = blueprintService.getAllBlueprints();
    const first = all[0];
    const updated = blueprintService.updateBlueprint(first.id, { description: 'Updated description' });
    expect(updated.description).toBe('Updated description');
  });

  it('should delete a blueprint', () => {
    const bp = blueprintService.createBlueprint({ name: 'Delete Me', tags: ['test'] });
    const ok = blueprintService.deleteBlueprint(bp.id);
    expect(ok).toBe(true);
    const found = blueprintService.getBlueprintById(bp.id);
    expect(found).toBeNull();
  });

  it('should return null when updating non-existent blueprint', () => {
    const result = blueprintService.updateBlueprint('nonexistent', { name: 'Nope' });
    expect(result).toBeNull();
  });

  it('should return false when deleting non-existent blueprint', () => {
    const result = blueprintService.deleteBlueprint('nonexistent');
    expect(result).toBe(false);
  });

  it('should generate embeddings for all seeded blueprints', () => {
    const all = blueprintService.getAllBlueprints();
    all.forEach(bp => {
      expect(bp.embedding).toBeDefined();
      expect(Array.isArray(bp.embedding)).toBe(true);
      expect(bp.embedding.length).toBeGreaterThan(0);
      expect(bp.embeddingModel).toBe('soulfire-embed-v1');
      expect(bp.embeddingVersion).toBe('2026-06-01');
    });
  });

  it('should auto-embed on create', () => {
    const bp = blueprintService.createBlueprint({ name: 'Embed Test', tags: ['test'] });
    expect(bp.embedding).toBeDefined();
    expect(bp.embedding.length).toBeGreaterThan(0);
  });

  it('should auto-embed on update', () => {
    const all = blueprintService.getAllBlueprints();
    const bp = all[0];
    const updated = blueprintService.updateBlueprint(bp.id, { description: 'Updated description for embedding test' });
    expect(updated.embedding).toBeDefined();
  });

  it('should return embedding engine info', () => {
    const info = blueprintService.getEmbeddingInfo();
    expect(info.model).toBe('soulfire-embed-v1');
    expect(info.indexed).toBeGreaterThan(0);
    expect(info.dimensions).toBeGreaterThan(0);
    expect(info.vocabularyTerms).toBeGreaterThan(0);
  });

  it('should semantic match by query', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'royalty music creator split',
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].embeddingSimilarity).toBeGreaterThan(0);
    expect(results[0].blueprint).toBeDefined();
  });

  it('should semantic match with tags and scores', () => {
    const results = blueprintService.semanticMatchBlueprints({
      tags: ['royalties', 'music'],
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.score).toBeDefined();
      expect(r.embeddingSimilarity).toBeDefined();
    });
  });

  it('should semantic match with category filter', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'subscription',
      category: 'creator-economy',
      limit: 5
    });
    results.forEach(r => {
      expect(r.blueprint.category).toBe('creator-economy');
    });
  });

  it('should hybrid match via matchBlueprints with embedding similarity', () => {
    const results = blueprintService.matchBlueprints({
      query: 'streaming royalties',
      tags: ['royalties'],
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle semantic match with no results gracefully', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'zzzzzzzznonexistent',
      limit: 5
    });
    expect(Array.isArray(results)).toBe(true);
  });
});

const { GraphEngine, EDGE_TYPES, EDGE_TYPE_CONFIG } = require('../services/graphService');
const { EmbeddingEngine, tokenize, cosineSimilarity, buildEmbeddingText } = require('../services/embeddingService');

describe('Embedding Service', () => {
  const testBps = [
    { id: '1', name: 'Music Royalty Split', description: 'Split royalties for music creators', tags: ['music', 'royalty'], exampleUseCases: ['Artist payout'], components: ['Ledger'], bestPractices: ['Audit trail'] },
    { id: '2', name: 'Payment Gateway', description: 'Process payments for ecommerce', tags: ['payment', 'gateway'], exampleUseCases: ['Checkout'], components: ['Processor'], bestPractices: ['PCI compliance'] },
  ];

  it('should build index and generate embeddings', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    expect(eng.vocabulary.length).toBeGreaterThan(0);
    expect(eng.index.size).toBe(2);
  });

  it('should compute cosine similarity between related blueprints', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    const similar = eng.search('music artist royalty payout', 2);
    expect(similar.length).toBe(2);
    expect(similar[0].id).toBe('1');
    expect(similar[0].score).toBeGreaterThan(similar[1].score);
  });

  it('should compute cosine similarity correctly', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    const c = new Float64Array([-1, 0, 0]);
    expect(cosineSimilarity(a, c)).toBeCloseTo(-1.0, 5);
    const d = new Float64Array([0, 1, 0]);
    expect(cosineSimilarity(a, d)).toBeCloseTo(0, 5);
  });

  it('should upsert and remove from index', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    eng.upsert({ id: '3', name: 'Test Pattern', description: 'A test', tags: ['test'], exampleUseCases: [], components: [], bestPractices: [] });
    expect(eng.index.size).toBe(3);
    eng.remove('3');
    expect(eng.index.size).toBe(2);
  });

  it('should generate embedding for arbitrary text', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    const vec = eng.generateEmbedding('custom query text');
    expect(vec.length).toBe(eng.vocabulary.length);
  });

  it('should tokenize correctly with stop word removal', () => {
    const tokens = tokenize('The quick brown fox jumps over the lazy dog');
    expect(tokens.includes('the')).toBe(false);
    expect(tokens.includes('quick')).toBe(true);
    expect(tokens.includes('brown')).toBe(true);
  });

  it('should build embedding text from blueprint fields', () => {
    const text = buildEmbeddingText({ name: 'Test', description: 'Desc', tags: ['a', 'b'], exampleUseCases: ['Case 1'], components: ['Comp 1'], bestPractices: ['Best 1'] });
    expect(text).toContain('Test');
    expect(text).toContain('Desc');
    expect(text).toContain('a');
    expect(text).toContain('Case 1');
    expect(text).toContain('Comp 1');
    expect(text).toContain('Best 1');
  });
});

describe('Graph Service', () => {
  let g;

  beforeEach(() => {
    g = new GraphEngine();
    g.addNode({ id: 'bp_a', slug: 'blueprint-a', name: 'Blueprint A', category: 'cat1', complexity: 'low', tags: ['tag1'] });
    g.addNode({ id: 'bp_b', slug: 'blueprint-b', name: 'Blueprint B', category: 'cat1', complexity: 'medium', tags: ['tag2'] });
    g.addNode({ id: 'bp_c', slug: 'blueprint-c', name: 'Blueprint C', category: 'cat2', complexity: 'high', tags: ['tag3'] });
    g.addNode({ id: 'bp_d', slug: 'blueprint-d', name: 'Blueprint D', category: 'cat2', complexity: 'medium', tags: ['tag1', 'tag2'] });
  });

  it('should register nodes and retrieve them', () => {
    expect(g.getNode('bp_a').name).toBe('Blueprint A');
    expect(g.getNode('bp_b').slug).toBe('blueprint-b');
    expect(g.getNode('nonexistent')).toBeNull();
  });

  it('should add edges between nodes', () => {
    const edge = g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    expect(edge.id).toMatch(/^e_/);
    expect(edge.type).toBe('often-used-with');
    expect(edge.from).toBe('bp_a');
    expect(edge.to).toBe('bp_b');
  });

  it('should create symmetric edges for symmetric types', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const edgesFromA = g.getEdgesFrom('bp_a');
    const edgesFromB = g.getEdgesFrom('bp_b');
    expect(edgesFromA.length).toBe(1);
    expect(edgesFromB.length).toBe(1);
    expect(edgesFromA[0].to).toBe('bp_b');
    expect(edgesFromB[0].to).toBe('bp_a');
  });

  it('should create asymmetric edges for non-symmetric types', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.PREREQUISITE_FOR, confidence: 0.8 });
    const edgesFromA = g.getEdgesFrom('bp_a');
    const edgesFromB = g.getEdgesFrom('bp_b');
    expect(edgesFromA.length).toBe(1);
    expect(edgesFromB.length).toBe(0);
  });

  it('should reject edges between non-existent nodes', () => {
    expect(() => g.addEdge({ from: 'bp_a', to: 'nonexistent', type: EDGE_TYPES.OFTEN_USED_WITH })).toThrow();
  });

  it('should reject unknown edge types', () => {
    expect(() => g.addEdge({ from: 'bp_a', to: 'bp_b', type: 'unknown-type' })).toThrow();
  });

  it('should remove edges', () => {
    const edge = g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const ok = g.removeEdge(edge.id);
    expect(ok).toBe(true);
    expect(g.getEdgesFrom('bp_a').length).toBe(0);
  });

  it('should traverse graph up to max depth', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const results = g.traverse('bp_a', { maxDepth: 2 });
    expect(results.length).toBe(2);
    const nodeIds = results.map(r => r.nodeId).sort();
    expect(nodeIds).toEqual(['bp_b', 'bp_c']);
  });

  it('should compute connectivity scores', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const scores = g.getConnectivityScores(['bp_a'], ['bp_a', 'bp_b', 'bp_c', 'bp_d']);
    expect(scores['bp_a']).toBeGreaterThan(0);
    expect(scores['bp_b']).toBeGreaterThan(0);
    expect(scores['bp_d']).toBe(0);
  });

  it('should return related blueprints ranked by score', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.5 });
    const related = g.getRelated('bp_a');
    expect(related.length).toBe(2);
    expect(related[0].blueprintId).toBe('bp_b');
    expect(related[0].score).toBeGreaterThan(related[1].score);
  });

  it('should filter related by minConfidence', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.2 });
    const related = g.getRelated('bp_a', { minConfidence: 0.5 });
    expect(related.length).toBe(1);
    expect(related[0].blueprintId).toBe('bp_b');
  });

  it('should generate recommendations from seed nodes', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.7 });
    const recs = g.getRecommendations(['bp_a']);
    expect(recs.length).toBe(2);
  });

  it('should exclude seed nodes from recommendations', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const recs = g.getRecommendations(['bp_a', 'bp_b']);
    expect(recs.length).toBe(0);
  });

  it('should create bundles from blueprint sets', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const bundle = g.getBundle(['bp_a', 'bp_b', 'bp_c'], { name: 'Test Bundle' });
    expect(bundle.name).toBe('Test Bundle');
    expect(bundle.blueprints.length).toBe(3);
    expect(bundle.edgeCount).toBeGreaterThan(0);
    expect(bundle.avgConnectivity).toBeGreaterThan(0);
  });

  it('should record usage and return co-occurrences', () => {
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_c', 'bp_d');
    g.recordUsage('bp_c', 'bp_d');
    const coocs = g.getCoOccurrences(2);
    expect(coocs.length).toBe(2);
    expect(coocs[0].count).toBe(3);
  });

  it('should remove nodes and their edges', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.removeNode('bp_a');
    expect(g.getNode('bp_a')).toBeNull();
    expect(g.getEdgesFrom('bp_a').length).toBe(0);
    expect(g.getEdgesTo('bp_a').length).toBe(0);
  });

  it('should return graph info with stats', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const info = g.getInfo();
    expect(info.nodes).toBe(4);
    expect(info.edges).toBeGreaterThan(0);
    expect(info.edgeTypes).toBeGreaterThan(0);
    expect(info.edgeTypeBreakdown).toBeDefined();
  });
});

describe('Blueprint Service — Graph Integration', () => {
  beforeEach(() => {
    blueprintService.seedBlueprints();
  });

  it('should seed graph nodes for all blueprints', () => {
    const info = blueprintService.getGraphInfo();
    expect(info.nodes).toBeGreaterThanOrEqual(10);
    expect(info.edges).toBeGreaterThan(0);
  });

  it('should get graph node with edges', () => {
    const node = blueprintService.getGraphNode(
      blueprintService.getBlueprintBySlug('creator-royalty-split').id
    );
    expect(node).not.toBeNull();
    expect(node.blueprint).toBeDefined();
    expect(node.edges.length).toBeGreaterThan(0);
  });

  it('should return null for non-existent graph node', () => {
    const node = blueprintService.getGraphNode('nonexistent');
    expect(node).toBeNull();
  });

  it('should get related blueprints ranked by score', () => {
    const bp = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const related = blueprintService.getGraphRelated(bp.id, { limit: 3 });
    expect(related.length).toBeGreaterThan(0);
    expect(related[0].score).toBeGreaterThan(0);
    expect(related[0].blueprint).toBeDefined();
  });

  it('should get graph recommendations from seeds', () => {
    const bp = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const recs = blueprintService.getGraphRecommendations([bp.id], { limit: 3 });
    expect(recs.length).toBeGreaterThan(0);
    recs.forEach(r => {
      expect(r.blueprint).toBeDefined();
      expect(r.sourceBlueprint).toBeDefined();
    });
  });

  it('should create a blueprint bundle', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const bp3 = blueprintService.getBlueprintBySlug('event-driven-settlement');
    const bundle = blueprintService.getGraphBundle([bp1.id, bp2.id, bp3.id], { name: 'Royalty Stack Bundle' });
    expect(bundle.name).toBe('Royalty Stack Bundle');
    expect(bundle.blueprints.length).toBe(3);
    expect(bundle.edgeCount).toBeGreaterThan(0);
  });

  it('should include graph scores in semantic match results', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'real-time event driven payout',
      limit: 5
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.graphScore).toBeDefined();
      expect(typeof r.graphScore).toBe('number');
    });
    const topResult = results[0];
    expect(topResult.score).toBeGreaterThan(0);
    expect(topResult.embeddingSimilarity).toBeGreaterThan(0);
  });

  it('should boost graph-connected blueprints in semantic scoring', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'music generation ai',
      limit: 10
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should add graph edge manually and verify', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('ai-music-generation-pipeline');
    const edge = blueprintService.addGraphEdge({
      fromId: bp1.id,
      toId: bp2.id,
      type: EDGE_TYPES.RECOMMENDED_PAIRING,
      confidence: 0.5,
    });
    expect(edge).not.toBeNull();
    expect(edge.type).toBe('recommended-pairing');
    const edges = blueprintService.getGraphEdges(bp1.id);
    expect(edges.from.some(e => e.to === bp2.id)).toBe(true);
  });

  it('should remove graph edge', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const existingFrom = blueprintService.getGraphEdges(bp1.id).from;
    const edgeToRemove = existingFrom.find(e => e.to === bp2.id);
    if (edgeToRemove) {
      const ok = blueprintService.removeGraphEdge(edgeToRemove.id);
      expect(ok).toBe(true);
      const updated = blueprintService.getGraphEdges(bp1.id);
      expect(updated.from.some(e => e.id === edgeToRemove.id)).toBe(false);
    }
  });

  it('should sync graph on blueprint create', () => {
    const bp = blueprintService.createBlueprint({
      name: 'Graph Test Pattern',
      description: 'Testing graph sync',
      tags: ['test']
    });
    const node = blueprintService.getGraphNode(bp.id);
    expect(node).not.toBeNull();
    expect(node.node.name).toBe('Graph Test Pattern');
  });

  it('should sync graph on blueprint delete', () => {
    const bp = blueprintService.createBlueprint({ name: 'Delete From Graph', tags: ['test'] });
    blueprintService.deleteBlueprint(bp.id);
    const node = blueprintService.getGraphNode(bp.id);
    expect(node).toBeNull();
  });

  it('should return graph info with correct stats', () => {
    const info = blueprintService.getGraphInfo();
    expect(info.nodes).toBeGreaterThan(0);
    expect(info.edges).toBeGreaterThan(0);
    expect(info.edgeTypes).toBeGreaterThan(0);
  });
});
