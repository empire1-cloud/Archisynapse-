const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { validateTransactionCreate } = require('../validation/transactions');
const transactionService = require('../services/transactionService');

// Create transaction
router.post('/', authMiddleware, validateTransactionCreate, async (req, res, next) => {
  try {
    const transaction = await transactionService.createTransaction({
      ...req.body,
      organizationId: req.organizationId,
      apiKey: req.apiKey
    });
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

// Get transaction
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const transaction = await transactionService.getTransaction(req.params.id);
    if (!transaction) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Transaction not found'
        }
      });
    }
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

// List transactions
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const transactions = await transactionService.listTransactions({
      organizationId: req.organizationId,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      status,
      apiKey: req.apiKey
    });
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

// Refund transaction
router.post('/:id/refunds', authMiddleware, async (req, res, next) => {
  try {
    const refund = await transactionService.refundTransaction({
      transactionId: req.params.id,
      amount: req.body.amount,
      reason: req.body.reason,
      idempotencyKey: req.body.idempotencyKey,
      apiKey: req.apiKey
    });
    res.status(201).json(refund);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
