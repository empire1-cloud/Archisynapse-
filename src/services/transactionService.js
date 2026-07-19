const db = require('../db');
const nodeCrypto = require('crypto');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { LedgerClient } = require('./ledgerClient');
const stripeGateway = require('./stripeGateway');

const PAYMENT_TABLE = 'payments';
const REFUND_TABLE = 'refunds';

const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  DISPUTED: 'DISPUTED',
};

class DuplicatePaymentError extends Error {
  constructor(message = 'Payment with this idempotency key already exists') {
    super(message);
    this.name = 'DuplicatePaymentError';
  }
}

class PaymentNotFoundError extends Error {
  constructor(message = 'Payment not found') {
    super(message);
    this.name = 'PaymentNotFoundError';
  }
}

class InsufficientFundsError extends Error {
  constructor(message = 'Insufficient funds') {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

class TransactionService {
  constructor(database = db, ledgerClient = new LedgerClient(), ledgerAccounts = null) {
    this.db = database;
    this.ledgerClient = ledgerClient;
    this.ledgerAccounts = ledgerAccounts;
  }

  async createPayment(req) {
    const existing = await this.db(PAYMENT_TABLE)
      .where({ idempotency_key: req.idempotencyKey })
      .first();
    if (existing) {
      logger.info({ idempotencyKey: req.idempotencyKey }, 'Returning existing payment (idempotent)');
      return this.rowToPayment(existing);
    }

    const paymentId = createId('txn');
    const now = new Date().toISOString();

    try {
      await this.db(PAYMENT_TABLE).insert({
        id: paymentId,
        organization_id: req.organizationId,
        customer_id: req.customerId || null,
        amount: normalizeAmount(req.amount),
        currency: (req.currency || 'USD').toUpperCase(),
        status: PaymentStatus.PENDING,
        payment_method_type: normalizePaymentMethodType(req.paymentMethod.type),
        payment_method_token: req.paymentMethod.token,
        payment_method_last4: req.paymentMethod.last4 || null,
        payment_method_brand: req.paymentMethod.brand || null,
        description: req.description || null,
        idempotency_key: req.idempotencyKey,
        metadata: JSON.stringify(req.metadata || {}),
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        logger.warn({ idempotencyKey: req.idempotencyKey }, 'Concurrent payment create collapsed to existing row');
        const concurrent = await this.db(PAYMENT_TABLE)
          .where({ idempotency_key: req.idempotencyKey })
          .first();
        if (concurrent) {
          return this.rowToPayment(concurrent);
        }
      }
      throw error;
    }

    const processorResult = await this.callProcessor(req);

    if (!processorResult.success) {
      await this.db(PAYMENT_TABLE)
        .where({ id: paymentId })
        .update({
          status: PaymentStatus.FAILED,
          failure_reason: processorResult.failureMessage || 'Processor declined',
          updated_at: new Date().toISOString(),
        });
      return this.getPayment(req.organizationId, paymentId);
    }

    await this.db(PAYMENT_TABLE)
      .where({ id: paymentId })
      .update({
        status: PaymentStatus.SUCCEEDED,
        processor_transaction_id: processorResult.processorTransactionId || null,
        payment_method_last4: processorResult.paymentMethodLast4 || null,
        payment_method_brand: processorResult.paymentMethodBrand || null,
        updated_at: new Date().toISOString(),
      });

    try {
      const accounts = this.ledgerAccounts || await this.ledgerClient.ensureCoreAccounts({
        organizationId: req.organizationId,
        currency: req.currency,
      });

      const ledgerTxn = await this.ledgerClient.postPaymentSucceeded({
        organizationId: req.organizationId,
        paymentId,
        amount: normalizeAmount(req.amount),
        currency: (req.currency || 'USD').toUpperCase(),
        cashAccountId: accounts.cashAccountId,
        revenueAccountId: accounts.revenueAccountId,
        idempotencyKey: `payment-${paymentId}`,
      });

      await this.db(PAYMENT_TABLE)
        .where({ id: paymentId })
        .update({
          ledger_transaction_id: ledgerTxn.id,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      logger.error({ paymentId, error }, 'CRITICAL: Payment succeeded but ledger post failed');
    }

    return this.getPayment(req.organizationId, paymentId);
  }

  async refundPayment(req) {
    const existing = await this.db(REFUND_TABLE)
      .where({ idempotency_key: req.idempotencyKey })
      .first();
    if (existing) {
      return this.rowToRefund(existing);
    }

    const paymentRow = await this.db(PAYMENT_TABLE)
      .where({ id: req.paymentId })
      .first();
    if (!paymentRow) {
      throw new PaymentNotFoundError();
    }

    const payment = this.rowToPayment(paymentRow);
    if (![PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED].includes(payment.status)) {
      throw new AppError(`Cannot refund payment with status ${payment.status}`, 400, 'invalid_state');
    }

    const alreadyRefunded = await this.db(REFUND_TABLE)
      .where({ payment_id: req.paymentId, status: 'SUCCEEDED' })
      .sum({ total: 'amount' })
      .first();
    const refundedTotal = Number(alreadyRefunded.total || 0);
    const refundAmount = req.amount != null ? Number(req.amount) : payment.amount;

    if (refundedTotal + refundAmount > payment.amount) {
      throw new InsufficientFundsError('Refund amount exceeds remaining payment balance');
    }
    if (!payment.ledgerTransactionId) {
      throw new AppError('Cannot refund: payment has not been posted to the ledger yet', 409, 'missing_ledger_transaction');
    }

    const processorRefund = await this.callProcessorRefund({
      payment,
      amount: refundAmount,
      reason: req.reason,
    });

    if (!processorRefund.success) {
      throw new AppError(
        processorRefund.failureMessage || 'Processor refund failed',
        502,
        'processor_refund_failed'
      );
    }

    const ledgerReversal = await this.ledgerClient.postRefund({
      organizationId: payment.organizationId,
      originalLedgerTransactionId: payment.ledgerTransactionId,
      reason: req.reason,
    });

    const refundId = createId('ref');
    const now = new Date().toISOString();

    await this.db(REFUND_TABLE).insert({
      id: refundId,
      payment_id: req.paymentId,
      organization_id: payment.organizationId,
      amount: normalizeAmount(refundAmount),
      reason: req.reason,
      status: 'SUCCEEDED',
      idempotency_key: req.idempotencyKey,
      processor_refund_id: processorRefund.processorRefundId || null,
      ledger_transaction_id: ledgerReversal.id,
      created_at: now,
    });

    const isFullRefund = refundedTotal + refundAmount === payment.amount;
    await this.db(PAYMENT_TABLE)
      .where({ id: req.paymentId })
      .update({
        status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        updated_at: new Date().toISOString(),
      });

    return this.rowToRefund({
      id: refundId,
      payment_id: req.paymentId,
      organization_id: payment.organizationId,
      amount: normalizeAmount(refundAmount),
      reason: req.reason,
      status: 'SUCCEEDED',
      processor_refund_id: processorRefund.processorRefundId || null,
      ledger_transaction_id: ledgerReversal.id,
      created_at: now,
    });
  }

  async getPayment(organizationId, paymentId) {
    const result = await this.db(PAYMENT_TABLE)
      .where({ id: paymentId, organization_id: organizationId })
      .first();
    if (!result) {
      throw new PaymentNotFoundError();
    }
    return this.rowToPayment(result);
  }

  async listPayments(organizationId, opts = {}) {
    const limit = Math.min(opts.limit || 50, 100);
    let query = this.db(PAYMENT_TABLE)
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc');

    if (opts.status) query = query.andWhere({ status: opts.status });
    if (opts.cursor) query = query.andWhere('id', '<', opts.cursor);

    const rows = await query.limit(limit + 1);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    return {
      payments: slice.map((row) => this.rowToPayment(row)),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  async findUnpostedPayments(organizationId) {
    const rows = await this.db(PAYMENT_TABLE)
      .where({ organization_id: organizationId, status: PaymentStatus.SUCCEEDED })
      .whereNull('ledger_transaction_id')
      .orderBy('created_at', 'asc');
    return rows.map((row) => this.rowToPayment(row));
  }

  async retryUnpostedPayment(organizationId, paymentId) {
    const payment = await this.getPayment(organizationId, paymentId);
    if (payment.ledgerTransactionId) {
      return payment;
    }
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new AppError(`Payment ${paymentId} is not retryable from status ${payment.status}`, 400, 'invalid_state');
    }

    logger.info({ paymentId, organizationId }, 'Retrying unposted payment ledger sync');

    const accounts = this.ledgerAccounts || await this.ledgerClient.ensureCoreAccounts({
      organizationId,
      currency: payment.currency,
    });

    const ledgerTxn = await this.ledgerClient.postPaymentSucceeded({
      organizationId,
      paymentId,
      amount: normalizeAmount(payment.amount),
      currency: payment.currency,
      cashAccountId: accounts.cashAccountId,
      revenueAccountId: accounts.revenueAccountId,
      idempotencyKey: `payment-${paymentId}`,
    });

    await this.db(PAYMENT_TABLE)
      .where({ id: paymentId, organization_id: organizationId })
      .update({
        ledger_transaction_id: ledgerTxn.id,
        updated_at: new Date().toISOString(),
      });

    logger.info({ paymentId, organizationId, ledgerTransactionId: ledgerTxn.id }, 'Recovered unposted payment to ledger');
    return this.getPayment(organizationId, paymentId);
  }

  async retryUnpostedPayments(organizationId, opts = {}) {
    const candidates = await this.findUnpostedPayments(organizationId);
    const limit = Math.min(opts.limit || candidates.length, candidates.length);
    const results = [];

    for (const payment of candidates.slice(0, limit)) {
      try {
        results.push(await this.retryUnpostedPayment(organizationId, payment.id));
      } catch (error) {
        logger.error({ paymentId: payment.id, organizationId, error }, 'Failed reconciliation retry for payment');
      }
    }

    return results;
  }

  async createTransaction(req) {
    return this.createPayment(mapLegacyCreateRequest(req));
  }

  async getTransaction(paymentId) {
    const row = await this.db(PAYMENT_TABLE).where({ id: paymentId }).first();
    if (!row) return null;
    const payment = this.rowToPayment(row);
    const refunds = await this.db(REFUND_TABLE).where({ payment_id: paymentId }).orderBy('created_at', 'asc');
    return {
      ...payment,
      refunds: refunds.map((refund) => this.rowToRefund(refund)),
    };
  }

  async listTransactions({ organizationId = 'org_demo', limit = 20, offset = 0, status } = {}) {
    let query = this.db(PAYMENT_TABLE)
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');
    if (status) query = query.andWhere({ status });

    const [{ count }] = await query.clone().clearOrder().count('* as count');
    const rows = await query.limit(Math.min(Number(limit), 100)).offset(Number(offset));

    return {
      data: rows.map((row) => this.rowToPayment(row)),
      total: Number(count),
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
    };
  }

  async refundTransaction({ transactionId, amount, reason, idempotencyKey }) {
    try {
      return await this.refundPayment({
        paymentId: transactionId,
        amount,
        reason: reason || 'Refund',
        idempotencyKey: idempotencyKey || `refund_${Date.now()}`,
      });
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        throw new Error('Transaction not found');
      }
      throw error;
    }
  }

  async updateTransactionStatus(id, status) {
    await this.db(PAYMENT_TABLE)
      .where({ id })
      .update({
        status,
        updated_at: new Date().toISOString(),
      });
    const row = await this.db(PAYMENT_TABLE).where({ id }).first();
    return row ? this.rowToPayment(row) : null;
  }

  async callProcessor(req) {
    const localCustomer = await this.lookupCustomer(req.customerId);

    const stripeCustomer = await stripeGateway.ensureCustomer({
      existingStripeCustomerId: localCustomer?.stripe_customer_id || null,
      email: localCustomer?.email || null,
      name: localCustomer?.display_name || null,
      metadata: {
        organization_id: req.organizationId,
        local_customer_id: req.customerId || '',
      },
    });

    if (stripeCustomer.id && localCustomer && !localCustomer.stripe_customer_id) {
      await this.db('customers')
        .where({ id: localCustomer.id })
        .update({
          stripe_customer_id: stripeCustomer.id,
          updated_at: new Date().toISOString(),
        });
    }

    return stripeGateway.createPayment({
      amount: req.amount,
      currency: req.currency,
      paymentMethodToken: req.paymentMethod.token,
      customerId: stripeCustomer.id || null,
      description: req.description,
      metadata: {
        organization_id: req.organizationId,
        payment_id: req.idempotencyKey,
        ...(req.metadata || {}),
      },
    });
  }

  async callProcessorRefund({ payment, amount, reason }) {
    if (!payment.processorTransactionId) {
      throw new AppError('Cannot refund: processor transaction id missing', 409, 'missing_processor_transaction');
    }

    return stripeGateway.createRefund({
      processorTransactionId: payment.processorTransactionId,
      amount,
      currency: payment.currency,
      reason,
      metadata: {
        organization_id: payment.organizationId,
        payment_id: payment.id,
      },
    });
  }

  async lookupCustomer(customerId) {
    if (!customerId) {
      return null;
    }

    return this.db('customers').where({ id: customerId }).first();
  }

  rowToPayment(row) {
    return {
      id: row.id,
      organizationId: row.organization_id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paymentMethod: {
        type: row.payment_method_type,
        token: row.payment_method_token,
        last4: row.payment_method_last4,
        brand: row.payment_method_brand,
      },
      payment_method: {
        type: row.payment_method_type,
        token: row.payment_method_token,
        last4: row.payment_method_last4,
        brand: row.payment_method_brand,
      },
      description: row.description,
      idempotencyKey: row.idempotency_key,
      processorTransactionId: row.processor_transaction_id || null,
      ledgerTransactionId: row.ledger_transaction_id,
      failureReason: row.failure_reason,
      metadata: parseJson(row.metadata),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  rowToRefund(row) {
    return {
      id: row.id,
      paymentId: row.payment_id,
      organizationId: row.organization_id,
      amount: Number(row.amount),
      reason: row.reason,
      status: row.status,
      processorRefundId: row.processor_refund_id || null,
      ledgerTransactionId: row.ledger_transaction_id,
      createdAt: row.created_at,
    };
  }
}

function normalizePaymentMethodType(type) {
  return String(type).toUpperCase();
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400, 'validation_error');
  }
  return amount.toFixed(4);
}

function createId(prefix) {
  return `${prefix}_${nodeCrypto.randomBytes(8).toString('hex')}`;
}

function parseJson(value) {
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function mapLegacyCreateRequest(req) {
  return {
    organizationId: req.organizationId || 'org_demo',
    customerId: req.customerId || req.customer?.id,
    amount: req.amount,
    currency: req.currency,
    paymentMethod: req.paymentMethod || req.payment_method,
    description: req.description,
    idempotencyKey: req.idempotencyKey,
    metadata: req.metadata,
  };
}

function isUniqueConstraintError(error) {
  const message = String(error && error.message || '');
  return message.includes('UNIQUE constraint failed') || message.includes('duplicate key value');
}

const service = new TransactionService();

module.exports = {
  TransactionService,
  PaymentStatus,
  DuplicatePaymentError,
  PaymentNotFoundError,
  InsufficientFundsError,
  createPayment: service.createPayment.bind(service),
  refundPayment: service.refundPayment.bind(service),
  getPayment: service.getPayment.bind(service),
  listPayments: service.listPayments.bind(service),
  findUnpostedPayments: service.findUnpostedPayments.bind(service),
  retryUnpostedPayment: service.retryUnpostedPayment.bind(service),
  retryUnpostedPayments: service.retryUnpostedPayments.bind(service),
  createTransaction: service.createTransaction.bind(service),
  getTransaction: service.getTransaction.bind(service),
  listTransactions: service.listTransactions.bind(service),
  refundTransaction: service.refundTransaction.bind(service),
  updateTransactionStatus: service.updateTransactionStatus.bind(service),
};
