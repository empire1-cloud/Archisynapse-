const express = require('express');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const ledgerService = require('../services/ledgerService');
const {
  validateLedgerAccountCreate,
  validateLedgerTransactionCreate,
  validateLedgerReversal,
} = require('../validation/ledger');

const router = express.Router();

function requireOrganization(req, res, next) {
  const organizationId = req.organizationId;
  if (!organizationId) {
    return next(new AppError('Missing organization context', 401, 'missing_organization'));
  }
  req.organizationId = String(organizationId);
  next();
}

router.post('/accounts', authMiddleware, requireOrganization, validateLedgerAccountCreate, async (req, res, next) => {
  try {
    const account = await ledgerService.createAccount({
      organizationId: req.organizationId,
      ...req.body,
    });
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', authMiddleware, requireOrganization, validateLedgerTransactionCreate, async (req, res, next) => {
  try {
    const transaction = await ledgerService.postTransaction({
      organizationId: req.organizationId,
      ...req.body,
    });
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions/:id', authMiddleware, requireOrganization, async (req, res, next) => {
  try {
    const transaction = await ledgerService.getTransaction({
      organizationId: req.organizationId,
      transactionId: req.params.id,
    });
    if (!transaction) {
      throw new AppError('Transaction not found', 404, 'not_found');
    }
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.post('/transactions/:id/reverse', authMiddleware, requireOrganization, validateLedgerReversal, async (req, res, next) => {
  try {
    const reversal = await ledgerService.reverseTransaction({
      organizationId: req.organizationId,
      transactionId: req.params.id,
      reason: req.body.reason,
    });
    res.status(201).json(reversal);
  } catch (error) {
    next(error);
  }
});

router.get('/trial-balance', authMiddleware, requireOrganization, async (req, res, next) => {
  try {
    const accounts = await ledgerService.getTrialBalance(req.organizationId);
    const totals = accounts.reduce(
      (sum, account) => ({
        debit: sum.debit + Number(account.debitSum),
        credit: sum.credit + Number(account.creditSum),
      }),
      { debit: 0, credit: 0 }
    );

    res.json({
      asOf: new Date().toISOString(),
      accounts,
      totals: {
        debit: totals.debit.toFixed(4),
        credit: totals.credit.toFixed(4),
      },
      isBalanced: totals.debit.toFixed(4) === totals.credit.toFixed(4),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reconciliation', authMiddleware, requireOrganization, async (req, res, next) => {
  try {
    const result = await ledgerService.reconcile(req.organizationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
