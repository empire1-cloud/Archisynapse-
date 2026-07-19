const blueprintService = require('./blueprintService');
const embeddingService = require('./embeddingService');
const telemetry = require('../utils/telemetry');

// Placeholder structured model / LLM stubs
async function structuredModelPredict(features) {
  // In beta this is a heuristic/simulated predictor. Replace with LightGBM/XGBoost integration.
  return [{ id: 'rec-sim-1', type: 'routing', action: 'route_local_acquirer', impact_est: { fee_reduction_pct: 0.35 }, confidence: 0.75 }];
}

async function llmGenerateRationale(recommendation, context) {
  // Replace with actual LLM call or local model in production. Returns text explanation.
  return `Recommendation: ${recommendation.action}. Expected to reduce fees by ${Math.round(recommendation.impact_est.fee_reduction_pct*100)}% based on precedent blueprints.`;
}

async function recommend(blueprint, options = {}) {
  const model_version = process.env.AI_BLUEPRINT_MODEL || 'ai-blueprint-v0.1';
  const start = Date.now();

  // feature extraction (lightweight in stub)
  const features = {
    components_count: blueprint.components ? blueprint.components.length : 0,
    tps: (blueprint.volumes && blueprint.volumes.tps) || 0,
    avg_value: (blueprint.volumes && blueprint.volumes.avg_value) || 0,
  };

  // semantic precedent lookup
  const precedents = await blueprintService.semanticMatchBlueprints({ query: JSON.stringify(blueprint), limit: 3 });

  // structured prediction
  const preds = await structuredModelPredict(features);

  // generate rationales
  const items = [];
  for (const p of preds) {
    const explanation = await llmGenerateRationale(p, { blueprint, precedents });
    items.push({
      id: p.id,
      type: p.type,
      action: p.action,
      impact_est: p.impact_est,
      confidence: p.confidence,
      explanation,
      simulated_outcome: { estimated_monthly_savings_usd: Math.round(((blueprint.volumes && blueprint.volumes.daily_tx) || 0) * ((p.impact_est && p.impact_est.fee_reduction_pct) || 0) * ((blueprint.volumes && blueprint.volumes.avg_value) || 0) / 30) }
    });
  }

  const result = {
    recommendations: items,
    metadata: { model_version, generated_at: new Date().toISOString(), latency_ms: Date.now() - start }
  };

  // telemetry
  try {
    telemetry.emitEvent('recommendation_generated', { model_version, merchant_id: blueprint.merchant_id || null, rec_count: items.length, sample_rec: items[0] || null });
  } catch (err) {
    // telemetry failure should not break API
    console.error('Telemetry error', err);
  }

  return result;
}

module.exports = { recommend };
