const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const RISK_EVENT_TABLE = 'risk_events';
const APP_PEPPER = process.env.ARCHISYNAPSE_PEPPER || 'dev-only-insecure-pepper';

function hashValue(value) {
  if (!value) return null;
  return crypto
    .createHash('sha256')
    .update(`${APP_PEPPER}:${String(value).trim().toLowerCase()}`)
    .digest('hex');
}

async function createRoyaltyRiskDecision({ organizationId, event, idempotencyKey = null }) {
  if (idempotencyKey) {
    const existing = await db(RISK_EVENT_TABLE)
      .where({ organization_id: organizationId, idempotency_key: idempotencyKey })
      .first();

    if (existing) {
      return formatRiskEvent(existing);
    }
  }

  const now = new Date();
  const mediumWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const hashes = buildHashes(event);

  let score = 0;
  const reasons = [];

  if (!event.dnaVerified) {
    score += 35;
    reasons.push('dna_not_verified');
  }

  if (!event.soulprintVerified) {
    score += 30;
    reasons.push('soulprint_not_verified');
  }

  if (!event.ledgerRecordFound) {
    score += 25;
    reasons.push('ledger_record_missing');
  }

  if (event.creatorAccountAgeDays < 7) {
    score += 20;
    reasons.push('new_creator_account');
  }

  if (event.payoutMethodAgeDays < 3) {
    score += 25;
    reasons.push('new_payout_method');
  }

  if (event.payoutDestinationChangedRecently) {
    score += 25;
    reasons.push('payout_destination_changed_recently');
  }

  if (event.duplicatePayoutDestination) {
    score += 25;
    reasons.push('duplicate_payout_destination');
  }

  if (event.suddenUsageSpike) {
    score += 25;
    reasons.push('sudden_usage_spike');
  }

  if (event.usageCount >= 10000 && event.creatorAccountAgeDays < 14) {
    score += 20;
    reasons.push('large_usage_on_new_creator_account');
  }

  if (hashes.creatorIdHash) {
    const [{ count }] = await db(RISK_EVENT_TABLE)
      .where({
        organization_id: organizationId,
        creator_id_hash: hashes.creatorIdHash,
        event_type: 'royalty_payout_request',
      })
      .where('created_at', '>=', mediumWindow)
      .count('* as count');

    if (Number(count) >= 5) {
      score += 15;
      reasons.push('high_creator_payout_request_velocity');
    }
  }

  if (hashes.payoutDestinationHash) {
    const [{ count }] = await db(RISK_EVENT_TABLE)
      .where({
        organization_id: organizationId,
        payout_destination_hash: hashes.payoutDestinationHash,
        event_type: 'royalty_payout_request',
      })
      .where('created_at', '>=', mediumWindow)
      .count('* as count');

    if (Number(count) >= 5) {
      score += 15;
      reasons.push('payout_destination_velocity');
    }
  }

  if (hashes.deviceIdHash) {
    const [{ count }] = await db(RISK_EVENT_TABLE)
      .where({
        organization_id: organizationId,
        device_id_hash: hashes.deviceIdHash,
      })
      .where('risk_score', '>=', 60)
      .where('created_at', '>=', mediumWindow)
      .count('* as count');

    if (Number(count) >= 3) {
      score += 20;
      reasons.push('device_linked_to_prior_risky_events');
    }
  }

  if (hashes.emailHash) {
    const [{ count }] = await db(RISK_EVENT_TABLE)
      .where({
        organization_id: organizationId,
        email_hash: hashes.emailHash,
      })
      .where('risk_score', '>=', 60)
      .where('created_at', '>=', mediumWindow)
      .count('* as count');

    if (Number(count) >= 3) {
      score += 20;
      reasons.push('email_linked_to_prior_risky_events');
    }
  }

  score = Math.min(score, 100);
  const decision = pickDecision(score);

  const [row] = await db(RISK_EVENT_TABLE)
    .insert({
      id: `risk_${uuidv4()}`,
      organization_id: organizationId,
      event_type: event.eventType,
      idempotency_key: idempotencyKey,
      risk_score: score,
      decision,
      reasons: JSON.stringify(reasons),
      amount: String(event.amount),
      currency: event.currency,
      user_id_hash: hashes.userIdHash,
      creator_id_hash: hashes.creatorIdHash,
      track_id_hash: hashes.trackIdHash,
      device_id_hash: hashes.deviceIdHash,
      email_hash: hashes.emailHash,
      session_id_hash: hashes.sessionIdHash,
      payout_destination_hash: hashes.payoutDestinationHash,
      ip_address: event.ipAddress || null,
      country: event.country || null,
      dna_verified: event.dnaVerified,
      soulprint_verified: event.soulprintVerified,
      ledger_record_found: event.ledgerRecordFound,
      usage_count: event.usageCount,
      sudden_usage_spike: event.suddenUsageSpike,
      creator_account_age_days: event.creatorAccountAgeDays,
      payout_method_age_days: event.payoutMethodAgeDays,
      duplicate_payout_destination: event.duplicatePayoutDestination,
      payout_destination_changed_recently: event.payoutDestinationChangedRecently,
    })
    .returning('*');

  return formatRiskEvent(row);
}

async function getRiskSummary(organizationId) {
  const totalResult = await db(RISK_EVENT_TABLE)
    .where({ organization_id: organizationId })
    .count('* as count')
    .first();

  const totalEvents = Number(totalResult?.count || 0);
  const scoreResult = await db(RISK_EVENT_TABLE)
    .where({ organization_id: organizationId })
    .avg({ avgScore: 'risk_score' })
    .first();

  const grouped = await db(RISK_EVENT_TABLE)
    .where({ organization_id: organizationId })
    .select('decision')
    .count('* as count')
    .groupBy('decision');

  const counts = grouped.reduce((acc, row) => {
    acc[row.decision] = Number(row.count);
    return acc;
  }, {});

  return {
    totalEvents,
    averageRiskScore: totalEvents > 0 ? Number(Number(scoreResult?.avgScore || 0).toFixed(1)) : 0,
    blockedPayoutEvents: counts.block_payout || 0,
    manualReviewEvents: counts.hold_payout_review || 0,
    delayedPayoutEvents: counts.delay_payout_72h || 0,
    releasedPayoutEvents: counts.release_payout || 0,
  };
}

function buildHashes(event) {
  return {
    userIdHash: hashValue(event.userId),
    creatorIdHash: hashValue(event.creatorId),
    trackIdHash: hashValue(event.trackId),
    deviceIdHash: hashValue(event.deviceId),
    emailHash: hashValue(event.email),
    sessionIdHash: hashValue(event.sessionId),
    payoutDestinationHash: hashValue(event.payoutDestination),
  };
}

function pickDecision(score) {
  if (score >= 85) return 'block_payout';
  if (score >= 65) return 'hold_payout_review';
  if (score >= 40) return 'delay_payout_72h';
  return 'release_payout';
}

function parseReasons(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function formatRiskEvent(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    riskScore: Number(row.risk_score),
    decision: row.decision,
    reasons: parseReasons(row.reasons),
    amount: Number(row.amount),
    currency: row.currency,
    createdAt: row.created_at,
  };
}

module.exports = {
  createRoyaltyRiskDecision,
  getRiskSummary,
  hashRiskValue: hashValue,
};
