const express = require('express');
const authMiddleware = require('../middleware/auth');
const riskService = require('../services/riskService');
const riskSequenceService = require('../services/riskSequenceService');
const { validateRoyaltyRisk } = require('../validation/risk');

const router = express.Router();

router.post('/royalty', authMiddleware, validateRoyaltyRisk, async (req, res, next) => {
  try {
    const decision = await riskService.createRoyaltyRiskDecision({
      organizationId: req.organizationId,
      event: req.body,
      idempotencyKey: req.get('Idempotency-Key') || null,
    });

    res.json({
      risk_score: decision.riskScore,
      decision: decision.decision,
      reasons: decision.reasons,
      event_id: decision.id,
      created_at: decision.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const summary = await riskService.getRiskSummary(req.organizationId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/sequences', authMiddleware, async (req, res, next) => {
  try {
    const sequences = await riskSequenceService.listCreatorRiskSequences(req.organizationId, {
      limit: req.query.limit,
      eventLimit: req.query.eventLimit,
      recipientId: req.query.recipientId || null,
    });
    res.json(sequences);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
