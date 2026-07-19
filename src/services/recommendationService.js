const blueprintService = require('./blueprintService');
const telemetry = require('../utils/telemetry');

async function structuredModelPredict(features) {
  const confidence = features.components_count > 0 ? 0.75 : 0.5;
  return [{
    id: 'rec-sim-1',
    type: 'routing',
    action: 'route_local_acquirer',
    impact_est: { fee_reduction_pct: 0.35 },
    confidence,
  }];
}

async function llmGenerateRationale(recommendation, context) {
  const precedentCount = Array.isArray(context.precedents) ? context.precedents.length : 0;
  const reductionPct = Math.round(recommendation.impact_est.fee_reduction_pct * 100);
  return `Recommendation: ${recommendation.action}. Estimated fee reduction is ${reductionPct}% using ${precedentCount} precedent blueprint(s). Human approval is required before any live change.`;
}

function calculateMonthlySavings(blueprint, feeReductionFraction) {
  const dailyTransactions = Number(blueprint.volumes && blueprint.volumes.daily_tx);
  const perTransactionCost = (blueprint.components || []).reduce((sum, component) => {
    const cost = Number(component.cost_per_tx);
    return Number.isFinite(cost) && cost >= 0 ? sum + cost : sum;
  }, 0);

  if (
    !Number.isFinite(dailyTransactions) ||
    dailyTransactions < 0 ||
    !Number.isFinite(feeReductionFraction) ||
    feeReductionFraction < 0 ||
    feeReductionFraction > 1 ||
    perTransactionCost <= 0
  ) {
    return {
      estimated_monthly_savings_usd: null,
      baseline_monthly_fees_usd: null,
      status: 'insufficient_cost_data',
      assumptions: {
        days_per_month: 30,
        daily_transactions: Number.isFinite(dailyTransactions) ? dailyTransactions : null,
        cost_per_transaction_usd: perTransactionCost || null,
        fee_reduction_fraction: feeReductionFraction,
      },
    };
  }

  const baselineMonthlyFees = dailyTransactions * 30 * perTransactionCost;
  const estimatedSavings = baselineMonthlyFees * feeReductionFraction;

  return {
    estimated_monthly_savings_usd: Number(estimatedSavings.toFixed(2)),
    baseline_monthly_fees_usd: Number(baselineMonthlyFees.toFixed(2)),
    status: 'estimate',
    assumptions: {
      days_per_month: 30,
      daily_transactions: dailyTransactions,
      cost_per_transaction_usd: Number(perTransactionCost.toFixed(6)),
      fee_reduction_fraction: feeReductionFraction,
    },
  };
}

async function recommend(blueprint) {
  const modelVersion = process.env.AI_BLUEPRINT_MODEL || 'ai-blueprint-v0.1-heuristic';
  const start = Date.now();

  const features = {
    components_count: blueprint.components.length,
    tps: (blueprint.volumes && blueprint.volumes.tps) || 0,
    daily_tx: blueprint.volumes.daily_tx,
    avg_value: (blueprint.volumes && blueprint.volumes.avg_value) || 0,
  };

  const precedents = await blueprintService.semanticMatchBlueprints({
    query: JSON.stringify(blueprint),
    limit: 3,
  });
  const predictions = await structuredModelPredict(features);

  const recommendations = [];
  for (const prediction of predictions) {
    const explanation = await llmGenerateRationale(prediction, { precedents });
    recommendations.push({
      id: prediction.id,
      type: prediction.type,
      action: prediction.action,
      impact_est: prediction.impact_est,
      confidence: prediction.confidence,
      explanation,
      simulated_outcome: calculateMonthlySavings(
        blueprint,
        prediction.impact_est.fee_reduction_pct
      ),
      requires_human_approval: true,
    });
  }

  const result = {
    recommendations,
    metadata: {
      model_version: modelVersion,
      model_kind: 'heuristic_scaffold',
      generated_at: new Date().toISOString(),
      latency_ms: Date.now() - start,
    },
  };

  try {
    telemetry.emitEvent('recommendation_generated', {
      model_version: modelVersion,
      merchant_pseudonym: telemetry.pseudonymizeIdentifier(blueprint.merchant_id),
      rec_count: recommendations.length,
    });
  } catch (err) {
    console.error('Telemetry error', err);
  }

  return result;
}

module.exports = { recommend, calculateMonthlySavings };
