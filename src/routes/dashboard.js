const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const transactionService = require('../services/transactionService');
const customerService = require('../services/customerService');
const payoutService = require('../services/payoutService');

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const allTxns = Array.from(transactionService.transactions.values());
    const allCustomers = await customerService.listCustomers({ limit: 1000 });
    const payoutResult = await payoutService.listPayouts({ limit: 1000 });

    const succeeded = allTxns.filter(t => t.status === 'succeeded');
    const totalVolume = succeeded.reduce((sum, t) => sum + t.amount, 0);
    const successRate = allTxns.length > 0 ? (succeeded.length / allTxns.length * 100).toFixed(1) : 0;

    const recentActivity = allTxns
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.description,
        created_at: t.created_at
      }));

    const statusBreakdown = {
      succeeded: allTxns.filter(t => t.status === 'succeeded').length,
      failed: allTxns.filter(t => t.status === 'failed').length,
      pending: allTxns.filter(t => t.status === 'pending').length,
      refunded: allTxns.filter(t => t.status === 'refunded').length
    };

    res.json({
      metrics: {
        total_transactions: allTxns.length,
        total_volume_cents: totalVolume,
        total_volume_formatted: `$${(totalVolume / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        success_rate_percent: parseFloat(successRate),
        active_customers: allCustomers.total,
        pending_payouts: payoutResult.data.filter(p => p.status === 'pending' || p.status === 'processing').length,
        average_response_time_ms: 42
      },
      status_breakdown: statusBreakdown,
      recent_activity: recentActivity,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
