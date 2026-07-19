const db = require('../db');
const { hashRiskValue } = require('./riskService');

const ACCOUNT_TABLE = 'recipient_accounts';
const PAYOUT_TABLE = 'payouts';
const RISK_EVENT_TABLE = 'risk_events';

async function listCreatorRiskSequences(
  organizationId,
  { limit = 25, eventLimit = 24, recipientId = null } = {}
) {
  let accountQuery = db(ACCOUNT_TABLE)
    .where({ organization_id: organizationId })
    .orderBy('created_at', 'desc')
    .limit(Math.min(Number(limit), 100));

  if (recipientId) {
    accountQuery = accountQuery.andWhere({ recipient_id: recipientId });
  }

  const accounts = await accountQuery;
  if (accounts.length === 0) {
    return { items: [], total: 0, generatedAt: new Date().toISOString() };
  }

  const payoutRows = await db(PAYOUT_TABLE)
    .where({ organization_id: organizationId })
    .whereIn('recipient_account_id', accounts.map((account) => account.id))
    .orderBy('created_at', 'desc');

  const payoutDestinationHashes = new Set();
  const creatorHashes = new Set();

  for (const account of accounts) {
    if (account.processor_account_id) {
      payoutDestinationHashes.add(hashRiskValue(account.processor_account_id));
    }
    if (account.recipient_id) {
      creatorHashes.add(hashRiskValue(account.recipient_id));
    }
  }

  let riskRows = [];
  if (payoutDestinationHashes.size > 0 || creatorHashes.size > 0) {
    riskRows = await db(RISK_EVENT_TABLE)
      .where({ organization_id: organizationId })
      .where((builder) => {
        if (payoutDestinationHashes.size > 0) {
          builder.whereIn('payout_destination_hash', Array.from(payoutDestinationHashes));
        }
        if (creatorHashes.size > 0) {
          builder.orWhereIn('creator_id_hash', Array.from(creatorHashes));
        }
      })
      .orderBy('created_at', 'desc');
  }

  const payoutsByAccountId = groupBy(payoutRows, 'recipient_account_id');
  const riskRowsByAccountId = new Map();

  for (const account of accounts) {
    const destinationHash = account.processor_account_id ? hashRiskValue(account.processor_account_id) : null;
    const creatorHash = account.recipient_id ? hashRiskValue(account.recipient_id) : null;
    const linkedRiskRows = riskRows.filter((row) =>
      (destinationHash && row.payout_destination_hash === destinationHash) ||
      (creatorHash && row.creator_id_hash === creatorHash)
    );
    riskRowsByAccountId.set(account.id, linkedRiskRows);
  }

  const items = accounts.map((account) => {
    const payoutEvents = (payoutsByAccountId.get(account.id) || []).map(normalizePayoutEvent);
    const riskEvents = (riskRowsByAccountId.get(account.id) || []).map(normalizeRiskEvent);
    const events = [...payoutEvents, ...riskEvents]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-Math.min(Number(eventLimit), 128));

    const corpusTokens = buildSequenceTokens(events);
    const latestRiskEvent = [...riskEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
    const latestPayoutEvent = [...payoutEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;

    return {
      sequenceId: `seq_${account.id}`,
      organizationId,
      recipientAccountId: account.id,
      recipientId: account.recipient_id,
      currency: account.currency,
      accountStatus: account.status,
      eventCount: events.length,
      latestTimestamp: events[events.length - 1]?.timestamp || account.updated_at || account.created_at,
      latestDecision: latestRiskEvent?.decision || null,
      latestRiskScore: latestRiskEvent?.riskScore ?? null,
      latestPayoutStatus: latestPayoutEvent?.status || null,
      requiresReview: latestRiskEvent ? ['hold_payout_review', 'block_payout'].includes(latestRiskEvent.decision) : false,
      supervisionTarget: deriveSupervisionTarget(latestRiskEvent),
      corpus: corpusTokens.length > 0 ? `<bos> ${corpusTokens.join(' ')} <eos>` : '<bos> <eos>',
      events,
    };
  });

  return {
    items,
    total: items.length,
    generatedAt: new Date().toISOString(),
  };
}

function normalizePayoutEvent(row) {
  return {
    type: 'payout',
    timestamp: row.processed_at || row.updated_at || row.created_at,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    sourceType: row.source_type || 'UNKNOWN',
    metadata: parseJson(row.metadata),
    tokens: [
      `EVT_PAYOUT_${sanitizeToken(row.status)}`,
      `AMT_${amountBucket(row.amount)}`,
      `SRC_${sanitizeToken(row.source_type || 'UNKNOWN')}`,
      `CUR_${sanitizeToken(row.currency || 'USD')}`,
    ],
  };
}

function normalizeRiskEvent(row) {
  const reasons = parseJson(row.reasons);
  return {
    type: 'risk',
    timestamp: row.created_at,
    decision: row.decision,
    riskScore: Number(row.risk_score),
    amount: Number(row.amount),
    currency: row.currency,
    reasons,
    tokens: [
      `EVT_RISK_${sanitizeToken(row.decision)}`,
      `RISK_${riskBucket(row.risk_score)}`,
      `AMT_${amountBucket(row.amount)}`,
      `CUR_${sanitizeToken(row.currency || 'USD')}`,
      ...reasons.slice(0, 3).map((reason) => `RSN_${sanitizeToken(reason)}`),
    ],
  };
}

function buildSequenceTokens(events) {
  const tokens = [];
  let previousTimestamp = null;

  for (const event of events) {
    if (previousTimestamp) {
      tokens.push(timeGapToken(previousTimestamp, event.timestamp));
    }

    tokens.push(...event.tokens, '<sep>');
    previousTimestamp = event.timestamp;
  }

  if (tokens[tokens.length - 1] === '<sep>') {
    tokens.pop();
  }

  return tokens;
}

function deriveSupervisionTarget(riskEvent) {
  if (!riskEvent) return 'no_risk_signal';
  if (riskEvent.decision === 'block_payout') return 'escalated_block';
  if (riskEvent.decision === 'hold_payout_review') return 'escalated_review';
  if (riskEvent.decision === 'delay_payout_72h') return 'delayed_release';
  return 'released';
}

function amountBucket(amount) {
  const value = Number(amount);
  if (value < 10) return '0';
  if (value < 50) return '1';
  if (value < 100) return '2';
  if (value < 500) return '3';
  if (value < 1000) return '4';
  if (value < 5000) return '5';
  return '6';
}

function riskBucket(score) {
  const value = Number(score);
  if (value >= 85) return 'CRITICAL';
  if (value >= 65) return 'HIGH';
  if (value >= 40) return 'MEDIUM';
  return 'LOW';
}

function timeGapToken(previousTimestamp, currentTimestamp) {
  const previous = new Date(previousTimestamp).getTime();
  const current = new Date(currentTimestamp).getTime();
  const deltaMinutes = Math.max(0, Math.round((current - previous) / (60 * 1000)));

  if (deltaMinutes <= 5) return 'GAP_MINS_05';
  if (deltaMinutes <= 60) return 'GAP_HOUR_01';
  if (deltaMinutes <= 6 * 60) return 'GAP_HOUR_06';
  if (deltaMinutes <= 24 * 60) return 'GAP_DAY_01';
  if (deltaMinutes <= 7 * 24 * 60) return 'GAP_DAY_07';
  return 'GAP_LONG';
}

function sanitizeToken(value) {
  return String(value || 'UNKNOWN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'UNKNOWN';
}

function parseJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function groupBy(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const key = row[field];
    const existing = map.get(key) || [];
    existing.push(row);
    map.set(key, existing);
  }
  return map;
}

module.exports = {
  listCreatorRiskSequences,
};
