const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const payoutService = require('../services/payoutService');

// List payouts
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const payouts = await payoutService.listPayouts({
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      status,
      apiKey: req.apiKey
    });
    res.json(payouts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
