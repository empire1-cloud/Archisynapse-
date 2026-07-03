const db = require('../db');
const ledgerService = require('../services/ledgerService');

describe('Ledger Integration', () => {
  const organizationId = `org_${Date.now()}`;
  let cashAccount;
  let revenueAccount;

  beforeAll(async () => {
    await db.migrate.latest();

    cashAccount = await ledgerService.createAccount({
      organizationId,
      code: `1000-${Date.now()}`,
      name: 'Cash',
      type: 'ASSET',
      currency: 'USD',
    });

    revenueAccount = await ledgerService.createAccount({
      organizationId,
      code: `4000-${Date.now()}`,
      name: 'Revenue',
      type: 'REVENUE',
      currency: 'USD',
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('posts an idempotent balanced ledger transaction', async () => {
    const payload = {
      type: 'PAYMENT',
      description: 'Design partner payment',
      amount: '1250.2500',
      currency: 'USD',
      idempotencyKey: `idem_${Date.now()}`,
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '1250.2500',
          description: 'Cash received',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '1250.2500',
          description: 'Revenue recognized',
        },
      ],
    };

    const first = await ledgerService.postTransaction({
      organizationId,
      ...payload,
    });

    const second = await ledgerService.postTransaction({
      organizationId,
      ...payload,
    });

    expect(first.id).toBe(second.id);
    expect(first.entries).toHaveLength(2);
  });

  it('rejects idempotency key reuse with a different payload', async () => {
    const idempotencyKey = `idem_conflict_${Date.now()}`;
    const basePayload = {
      type: 'PAYMENT',
      description: 'Base payload',
      amount: '10.0000',
      currency: 'USD',
      idempotencyKey,
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '10.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '10.0000',
          description: 'Revenue',
        },
      ],
    };

    await ledgerService.postTransaction({
      organizationId,
      ...basePayload,
    });

    await expect(
      ledgerService.postTransaction({
        organizationId,
        ...basePayload,
        amount: '11.0000',
        entries: [
          { ...basePayload.entries[0], amount: '11.0000' },
          { ...basePayload.entries[1], amount: '11.0000' },
        ],
      })
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('reverses a transaction atomically and marks the original reversed', async () => {
    const created = await ledgerService.postTransaction({
      organizationId,
      type: 'PAYMENT',
      description: 'Refundable payment',
      amount: '300.0000',
      currency: 'USD',
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '300.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '300.0000',
          description: 'Revenue',
        },
      ],
    });

    const reversal = await ledgerService.reverseTransaction({
      organizationId,
      transactionId: created.id,
      reason: 'Customer refund',
    });

    const originalAfter = await ledgerService.getTransaction({
      organizationId,
      transactionId: created.id,
    });

    expect(reversal.type).toBe('REVERSAL');
    expect(originalAfter.status).toBe('REVERSED');
    expect(originalAfter.reversedTransactionId).toBe(reversal.id);
  });

  it('returns a balanced trial balance summary', async () => {
    const accounts = await ledgerService.getTrialBalance(organizationId);
    const reconciliation = await ledgerService.reconcile(organizationId);

    expect(accounts.length).toBeGreaterThanOrEqual(2);
    expect(reconciliation.isBalanced).toBe(true);
    expect(reconciliation.totals.debit).toBe(reconciliation.totals.credit);
  });

  it('rejects account currency mismatch during posting', async () => {
    const eurCash = await ledgerService.createAccount({
      organizationId,
      code: `1001-${Date.now()}`,
      name: 'EUR Cash',
      type: 'ASSET',
      currency: 'EUR',
    });

    await expect(
      ledgerService.postTransaction({
        organizationId,
        type: 'PAYMENT',
        description: 'Mismatched currency',
        amount: '50.0000',
        currency: 'USD',
        entries: [
          {
            accountId: eurCash.id,
            debitCredit: 'DEBIT',
            amount: '50.0000',
            description: 'EUR cash in USD txn',
          },
          {
            accountId: revenueAccount.id,
            debitCredit: 'CREDIT',
            amount: '50.0000',
            description: 'Revenue',
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'currency_mismatch' });
  });

  it('rejects a duplicate reversal attempt', async () => {
    const original = await ledgerService.postTransaction({
      organizationId,
      type: 'PAYMENT',
      description: 'Duplicate reversal candidate',
      amount: '90.0000',
      currency: 'USD',
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '90.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '90.0000',
          description: 'Revenue',
        },
      ],
    });

    await ledgerService.reverseTransaction({
      organizationId,
      transactionId: original.id,
      reason: 'First reversal',
    });

    await expect(
      ledgerService.reverseTransaction({
        organizationId,
        transactionId: original.id,
        reason: 'Second reversal',
      })
    ).rejects.toMatchObject({ code: 'invalid_state' });
  });

  it('does not double reverse under a reversal race', async () => {
    const original = await ledgerService.postTransaction({
      organizationId,
      type: 'PAYMENT',
      description: 'Reversal race candidate',
      amount: '61.0000',
      currency: 'USD',
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '61.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '61.0000',
          description: 'Revenue',
        },
      ],
    });

    const results = await Promise.allSettled([
      ledgerService.reverseTransaction({
        organizationId,
        transactionId: original.id,
        reason: 'Race A',
      }),
      ledgerService.reverseTransaction({
        organizationId,
        transactionId: original.id,
        reason: 'Race B',
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const reversalRows = await db(ledgerService.TABLES.transactions)
      .where({ organization_id: organizationId, reference_id: original.id, type: 'REVERSAL' });

    expect(fulfilled).toHaveLength(1);
    expect(reversalRows).toHaveLength(1);
  });

  it('rolls back reversal posting if original status update fails', async () => {
    const original = await ledgerService.postTransaction({
      organizationId,
      type: 'PAYMENT',
      description: 'Rollback reversal candidate',
      amount: '77.0000',
      currency: 'USD',
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '77.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '77.0000',
          description: 'Revenue',
        },
      ],
    });

    await db.raw(`
      CREATE TRIGGER trg_test_block_reverse_status
      BEFORE UPDATE ON ledger_transactions
      WHEN OLD.id = '${original.id}' AND NEW.status = 'REVERSED'
      BEGIN
        SELECT RAISE(ABORT, 'blocked reverse update');
      END;
    `);

    await expect(
      ledgerService.reverseTransaction({
        organizationId,
        transactionId: original.id,
        reason: 'Should rollback',
      })
    ).rejects.toThrow(/blocked reverse update/i);

    const reversalRows = await db(ledgerService.TABLES.transactions)
      .where({ organization_id: organizationId, reference_id: original.id, type: 'REVERSAL' });
    expect(reversalRows).toHaveLength(0);

    const originalAfter = await ledgerService.getTransaction({
      organizationId,
      transactionId: original.id,
    });
    expect(originalAfter.status).toBe('POSTED');

    await db.raw('DROP TRIGGER IF EXISTS trg_test_block_reverse_status');
  });

  it('keeps idempotency stable even after stored expiry passes', async () => {
    const idempotencyKey = `idem_expired_${Date.now()}`;
    const payload = {
      organizationId,
      type: 'PAYMENT',
      description: 'Expired idempotency semantics',
      amount: '42.0000',
      currency: 'USD',
      idempotencyKey,
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '42.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '42.0000',
          description: 'Revenue',
        },
      ],
    };

    const first = await ledgerService.postTransaction(payload);
    await db(ledgerService.TABLES.idempotency)
      .where({ organization_id: organizationId, idempotency_key: idempotencyKey })
      .update({ expires_at: '2000-01-01T00:00:00.000Z' });

    const second = await ledgerService.postTransaction(payload);
    expect(second.id).toBe(first.id);
  });

  it('rejects account ownership mismatch during posting', async () => {
    const otherOrgAccount = await ledgerService.createAccount({
      organizationId: `other_${Date.now()}`,
      code: `1000-${Date.now()}`,
      name: 'Other Org Cash',
      type: 'ASSET',
      currency: 'USD',
    });

    await expect(
      ledgerService.postTransaction({
        organizationId,
        type: 'PAYMENT',
        description: 'Cross-org account misuse',
        amount: '25.0000',
        currency: 'USD',
        entries: [
          {
            accountId: otherOrgAccount.id,
            debitCredit: 'DEBIT',
            amount: '25.0000',
            description: 'Wrong org cash',
          },
          {
            accountId: revenueAccount.id,
            debitCredit: 'CREDIT',
            amount: '25.0000',
            description: 'Revenue',
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'account_not_found' });
  });

  it('rejects updates and deletes on journal entries', async () => {
    const created = await ledgerService.postTransaction({
      organizationId,
      type: 'PAYMENT',
      description: 'Immutability check',
      amount: '55.0000',
      currency: 'USD',
      entries: [
        {
          accountId: cashAccount.id,
          debitCredit: 'DEBIT',
          amount: '55.0000',
          description: 'Cash in',
        },
        {
          accountId: revenueAccount.id,
          debitCredit: 'CREDIT',
          amount: '55.0000',
          description: 'Revenue',
        },
      ],
    });

    const entryId = created.entries[0].id;

    await expect(
      db(ledgerService.TABLES.entries).where({ id: entryId }).update({ description: 'Mutated' })
    ).rejects.toThrow(/immutable/i);

    await expect(
      db(ledgerService.TABLES.entries).where({ id: entryId }).del()
    ).rejects.toThrow(/immutable/i);
  });
});
