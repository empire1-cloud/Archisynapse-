const crypto = require('../utils/crypto');
const nodeCrypto = require('crypto');
const logger = require('../utils/logger');

const transactions = new Map();
const refunds = new Map();

const createTransaction = async ({ amount, currency, description, customer, payment_method, metadata }) => {
  const id = crypto.generateTransactionId();
  const transaction = {
    id,
    status: 'succeeded',
    amount,
    currency: currency || 'USD',
    description: description || null,
    customer: customer || null,
    payment_method: payment_method || null,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  transactions.set(id, transaction);
  logger.info('Transaction created', { transactionId: id, amount, currency });
  return transaction;
};

const getTransaction = async (id) => {
  const transaction = transactions.get(id);
  if (!transaction) return null;
  return {
    ...transaction,
    refunds: Array.from(refunds.values()).filter(r => r.transactionId === id)
  };
};

const listTransactions = async ({ limit = 20, offset = 0, status } = {}) => {
  let all = Array.from(transactions.values());

  if (status) {
    all = all.filter(t => t.status === status);
  }

  all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const paginated = all.slice(offset, offset + limit);
  return {
    data: paginated,
    total: all.length,
    limit: Math.min(parseInt(limit), 100),
    offset: parseInt(offset)
  };
};

const refundTransaction = async ({ transactionId, amount, reason } = {}) => {
  const transaction = transactions.get(transactionId);
  if (!transaction) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    err.code = 'not_found';
    throw err;
  }

  if (transaction.status !== 'succeeded') {
    const err = new Error('Transaction cannot be refunded in its current state');
    err.statusCode = 400;
    err.code = 'invalid_state';
    throw err;
  }

  const refundAmount = amount || transaction.amount;
  const refundId = 'ref_' + nodeCrypto.randomBytes(8).toString('hex');

  const refund = {
    id: refundId,
    transactionId,
    amount: refundAmount,
    currency: transaction.currency,
    reason: reason || null,
    status: 'succeeded',
    created_at: new Date().toISOString()
  };

  refunds.set(refundId, refund);
  transaction.status = 'refunded';
  transaction.updated_at = new Date().toISOString();

  logger.info('Transaction refunded', { refundId, transactionId, amount: refundAmount });
  return refund;
};

module.exports = {
  createTransaction,
  getTransaction,
  listTransactions,
  refundTransaction
};
