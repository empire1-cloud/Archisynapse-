# AI Blueprint PRD

## Summary
The AI Blueprint is a core product module that ingests a customer’s payment architecture (component graph + metadata + historical transaction signals) and returns actionable monetization and architecture recommendations. The primary goal is to drive measurable merchant ROI (fee reduction, settlement speed, revenue uplift) and to generate defensible training data and telemetry for continuous model improvements.

## Goals
- Deliver a beta that can be used by 20 power users within 6 weeks.
- Provide explainable recommendations that a human can review and accept with minimal friction.
- Measure Recommendation Acceptance Rate (RAR) and Measured Merchant ROI to validate product-market fit.

## Non-goals
- Not an automated autopilot for changing live rails/config without human approval in beta.
- Not a full legal/compliance decision engine (compliance suggestions are advisory until validated by counsel).

## Users
- Merchant technical leads (integration & ops)
- Platform product managers (pricing optimization)
- Enterprise sales (ROI reports for outbound)
- Developers building components and templates for the marketplace

## Core Capabilities (Beta)
1. Upload or create blueprint: JSON upload or registry selection (component graph)
2. Feature extraction: normalize volumes, fee structures, latency, failure rates
3. Recommendation engine: returns ranked actions with impact estimates and confidence
4. Rationale: short textual explanation + supporting metrics (historical comparators)
5. Simulation: estimated outcome if merchant accepts top recommendation
6. Audit log: immutable record of recommendation, decision, and outcome

## Input schema (example)
```json
{
  "merchant_id": "string",
  "components": [
    { "id": "payments-acquirer-xyz", "type": "acquirer", "region": "NG", "cost_per_tx": 0.012, "latency_ms": 200, "currency_support": ["NGN","USD"] },
    { "id": "fraud-v1", "type": "fraud", "params": { "model": "v1" }, "latency_ms": 40 }
  ],
  "connectors": [ { "from": "payments-acquirer-xyz", "to": "fraud-v1" } ],
  "volumes": { "tps": 5, "daily_tx": 10000, "avg_value": 1200 },
  "regions": ["NG"],
  "current_fee_structure": { "merchant_fee_pct": 0.02, "fixed_fee": 0.3 },
  "historical_tx_outcomes": { "chargeback_rate": 0.02, "fraud_score_mean": 0.12 }
}
```

## Output schema (example)
```json
{
  "recommendations": [
    {
      "id": "rec-01",
      "type": "routing",
      "action": "route_ngn_local_acquirer",
      "impact_est": { "fee_reduction_pct": 0.45, "settlement_speed_gain": "same-day" },
      "confidence": 0.82,
      "explanation": "Local acquiring reduces cross-border FX and intermediary fees. Expected 45% fee reduction based on similar merchants in NG.",
      "simulated_outcome": { "estimated_monthly_savings_usd": 3200 }
    }
  ],
  "metadata": { "model_version": "ai-blueprint-v0.1", "generated_at": "2026-07-19T00:00:00Z" }
}
```

## Model architecture (beta)
- Two-stage approach:
  1. Structured numeric model (LightGBM) for impact estimates (fee reduction %, refund rate change, settlement delta) trained on historical merchant/component outcome datasets.
  2. LLM prompt chain for human-readable rationale and steps (local or hosted LLM depending on deployment/privacy needs).
- Embedding service + semantic search for matching blueprints and retrieving precedent examples.

## Training data
- Required: anonymized merchant blueprint + outcome pairs (component set → realized cost or settlement improvements)
- Minimum seed: 50 real-world architectures + simulated data augmentation
- Privacy: anonymize merchant ids, aggregate where required, opt-in consent flow for production training

## Safety & Governance
- Human-in-loop gating for all live configuration changes
- Log every recommendation, user action, and outcome to the ledger for audit and training
- PII removal pipeline and data retention policy

## Telemetry & Metrics
- Recommendation Acceptance Rate (RAR)
- Measured Merchant ROI (post-change realized savings)
- Time saved (self-reported survey metric)
- Model drift indicators (change in prediction distributions)

## Acceptance criteria (beta)
- Feature parity: upload blueprint + recommendations + explanation UI available
- Performance: recommendation latency < 1s (interactive path) for cached or precomputed features
- Telemetry: instrument RAR and outcome recording
- Security: no raw PAN stored; PII removed before training exports

## Rollout plan
1. Internal alpha with seeded dataset (week 1–2)
2. 20 power user beta (week 3–6)
3. Expand to marketplace integration once stable (week 7–12)

## Ownership & Roles
- Product: define UX & acceptance
- ML: model training & evaluation
- Backend: services + ledger integration
- DevRel: beta recruiting & feedback loop
- Legal: data use consents & patent preparation

## Next steps (immediate)
- Build /api/v1/blueprints/match and /api/v1/blueprints/semantic-match hooks (already present; wire to model)
- Add endpoint /api/v1/blueprints/recommendation (POST) to accept blueprint input and return recommendations
- Instrument telemetry for recommendation events
- Prepare a small labeled dataset (50 blueprints) and create anonymizer script
