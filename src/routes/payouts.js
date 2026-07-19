const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const payoutService = require('../services/payoutService');
const { normalizeRoyaltyRiskPayload } = require('../validation/risk');

// ---------------------------------------------------------------------------
// Recipient Accounts
// ---------------------------------------------------------------------------

router.post('/accounts', authMiddleware, async (req, res, next) => {
  try {
    const { recipientId, processorAccountId, currency } = req.body;
    if (!recipientId || !processorAccountId) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'recipientId and processorAccountId are required' } });
    }
    const account = await payoutService.registerRecipientAccount({
      organizationId: req.organizationId,
      recipientId,
      processorAccountId,
      currency,
    });
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

router.get('/accounts', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { limit = 50, offset = 0 } = req.query;
    const result = await payoutService.listRecipientAccounts(orgId, { limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/accounts/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const account = await payoutService.getRecipientAccount(orgId, req.params.accountId);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

router.post('/accounts/:accountId/verify', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const account = await payoutService.verifyRecipientAccount(orgId, req.params.accountId);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

router.post('/accounts/:accountId/disable', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const account = await payoutService.disableRecipientAccount(orgId, req.params.accountId);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { recipientAccountId, amount, currency, scheduledFor, idempotencyKey, sourceType, sourceReferenceId, metadata, riskContext } = req.body;
    if (!recipientAccountId || !amount || !idempotencyKey || !sourceType) {
      return res.status(400).json({
        error: { code: 'validation_error', message: 'recipientAccountId, amount, idempotencyKey, and sourceType are required' },
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'amount must be positive' } });
    }

    let normalizedRiskContext;
    if (riskContext) {
      const { error, value } = normalizeRoyaltyRiskPayload({
        ...riskContext,
        amount: Number(amount),
        currency: currency || riskContext.currency,
      });

      if (error) {
        return res.status(400).json({
          error: {
            code: 'validation_error',
            message: `riskContext.${error.details[0].message}`,
          },
        });
      }

      normalizedRiskContext = value;
    }

    const payout = await payoutService.createPayout({
      organizationId: req.organizationId,
      recipientAccountId,
      amount,
      currency,
      scheduledFor,
      idempotencyKey,
      sourceType,
      sourceReferenceId,
      metadata,
      riskContext: normalizedRiskContext,
    });
    res.status(201).json(payout);
  } catch (err) {
    next(err);
  }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { limit = 50, cursor, status, recipientAccountId } = req.query;
    const result = await payoutService.listPayouts(orgId, { limit, cursor, status, recipientAccountId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/unposted', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const payouts = await payoutService.findUnpostedPayouts(orgId);
    res.json({ data: payouts });
  } catch (err) {
    next(err);
  }
});

router.get('/:payoutId', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const payout = await payoutService.getPayout(orgId, req.params.payoutId);
    res.json(payout);
  } catch (err) {
    next(err);
  }
});

router.post('/:payoutId/cancel', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'reason is required' } });
    }
    const payout = await payoutService.cancelPayout(orgId, req.params.payoutId, reason);
    res.json(payout);
  } catch (err) {
    next(err);
  }
});

router.post('/:payoutId/return', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: { code: 'validation_error', message: 'reason is required' } });
    }
    const payout = await payoutService.markPayoutReturned(orgId, req.params.payoutId, reason);
    res.json(payout);
  } catch (err) {
    next(err);
  }
});

router.post('/:payoutId/release', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const payout = await payoutService.releasePayoutManualReview(orgId, req.params.payoutId, req.body?.note);
    res.json(payout);
  } catch (err) {
    next(err);
  }
});

router.post('/process-scheduled', authMiddleware, async (req, res, next) => {
  try {
    const orgId = req.organizationId;
    const result = await payoutService.processScheduledPayouts(orgId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
