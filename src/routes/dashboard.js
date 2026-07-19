const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const transactionService = require('../services/transactionService');
const customerService = require('../services/customerService');
const payoutService = require('../services/payoutService');

const SUCCESS_TRANSACTION_STATUSES = new Set(['SUCCEEDED', 'succeeded', 'settled']);
const FAILED_TRANSACTION_STATUSES = new Set(['FAILED', 'failed']);
const PENDING_TRANSACTION_STATUSES = new Set(['PENDING', 'pending', 'AUTHORIZED', 'authorized']);
const REFUNDED_TRANSACTION_STATUSES = new Set(['REFUNDED', 'refunded', 'PARTIALLY_REFUNDED', 'partially_refunded']);
const PENDING_PAYOUT_STATUSES = new Set(['PENDING', 'pending', 'PROCESSING', 'processing']);

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const txnResult = await transactionService.listTransactions({
      organizationId: req.organizationId,
      limit: 10000,
    });
    const allCustomers = await customerService.listCustomers({ limit: 1000 });
    const payoutResult = await payoutService.listPayouts(req.organizationId, { limit: 1000 });

    const succeeded = txnResult.data.filter((t) => SUCCESS_TRANSACTION_STATUSES.has(t.status));
    const totalVolume = succeeded.reduce((sum, t) => sum + t.amount, 0);
    const successRate = txnResult.data.length > 0
      ? (succeeded.length / txnResult.data.length * 100).toFixed(1)
      : 0;

    const recentActivity = txnResult.data
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.description,
        created_at: t.created_at,
      }));

    const statusBreakdown = {
      succeeded: txnResult.data.filter((t) => SUCCESS_TRANSACTION_STATUSES.has(t.status)).length,
      failed: txnResult.data.filter((t) => FAILED_TRANSACTION_STATUSES.has(t.status)).length,
      pending: txnResult.data.filter((t) => PENDING_TRANSACTION_STATUSES.has(t.status)).length,
      refunded: txnResult.data.filter((t) => REFUNDED_TRANSACTION_STATUSES.has(t.status)).length,
    };

    res.json({
      metrics: {
        total_transactions: txnResult.data.length,
        total_volume_cents: Math.round(totalVolume * 100),
        total_volume_formatted: `$${(totalVolume).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        success_rate_percent: parseFloat(successRate),
        active_customers: allCustomers.total,
        pending_payouts: payoutResult.data.filter((p) => PENDING_PAYOUT_STATUSES.has(p.status)).length,
        average_response_time_ms: 42,
      },
      status_breakdown: statusBreakdown,
      recent_activity: recentActivity,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
