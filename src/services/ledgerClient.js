const db = require('../db');
const ledgerService = require('./ledgerService');

class LedgerClient {
  constructor(baseUrl = process.env.LEDGER_SERVICE_URL || 'internal://ledger') {
    this.baseUrl = baseUrl;
  }

  async ensureCoreAccounts({ organizationId, currency = 'USD' }) {
    if (this.baseUrl === 'internal://ledger') {
      const existing = await db('ledger_accounts')
        .where({ organization_id: organizationId })
        .whereIn('code', ['1000', '4000']);

      let cashAccount = existing.find((row) => row.code === '1000');
      let revenueAccount = existing.find((row) => row.code === '4000');

      if (!cashAccount) {
        cashAccount = await ledgerService.createAccount({
          organizationId,
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          currency,
          metadata: { system: true, role: 'cash' },
        });
      }

      if (!revenueAccount) {
        revenueAccount = await ledgerService.createAccount({
          organizationId,
          code: '4000',
          name: 'Revenue',
          type: 'REVENUE',
          currency,
          metadata: { system: true, role: 'revenue' },
        });
      }

      return {
        cashAccountId: cashAccount.id,
        revenueAccountId: revenueAccount.id,
      };
    }

    throw new Error('Remote ledger account bootstrap is not implemented yet');
  }

  async postPaymentSucceeded(params) {
    if (this.baseUrl === 'internal://ledger') {
      const result = await ledgerService.postTransaction({
        organizationId: params.organizationId,
        type: 'PAYMENT',
        referenceId: params.paymentId,
        description: `Payment ${params.paymentId}`,
        amount: params.amount,
        currency: params.currency,
        idempotencyKey: params.idempotencyKey,
        entries: [
          {
            accountId: params.cashAccountId,
            debitCredit: 'DEBIT',
            amount: params.amount,
            description: 'Cash received',
          },
          {
            accountId: params.revenueAccountId,
            debitCredit: 'CREDIT',
            amount: params.amount,
            description: 'Revenue recognized',
          },
        ],
      });
      return { id: result.id };
    }

    const res = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-ID': params.organizationId,
      },
      body: JSON.stringify({
        type: 'PAYMENT',
        referenceId: params.paymentId,
        description: `Payment ${params.paymentId}`,
        amount: String(params.amount),
        currency: params.currency,
        idempotencyKey: params.idempotencyKey,
        entries: [
          {
            accountId: params.cashAccountId,
            debitCredit: 'DEBIT',
            amount: String(params.amount),
            description: 'Cash received',
          },
          {
            accountId: params.revenueAccountId,
            debitCredit: 'CREDIT',
            amount: String(params.amount),
            description: 'Revenue recognized',
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ledger Service rejected transaction: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }

  async postRefund(params) {
    if (this.baseUrl === 'internal://ledger') {
      const result = await ledgerService.reverseTransaction({
        organizationId: params.organizationId,
        transactionId: params.originalLedgerTransactionId,
        reason: params.reason,
      });
      return { id: result.id };
    }

    const res = await fetch(`${this.baseUrl}/transactions/${params.originalLedgerTransactionId}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-ID': params.organizationId,
      },
      body: JSON.stringify({ reason: params.reason }),
    });

    if (!res.ok) {
      throw new Error(`Ledger Service rejected reversal: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }
}

module.exports = { LedgerClient };
