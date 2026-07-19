const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const riskService = require('./riskService');
const stripeGateway = require('./stripeGateway');

const PAYOUT_TABLE = 'payouts';
const ACCOUNT_TABLE = 'recipient_accounts';
const MANUAL_REVIEW_FLAG = 'manualReviewRequired';
const DELAY_PAYOUT_HOURS = 72;

// ---------------------------------------------------------------------------
// Recipient Accounts
// ---------------------------------------------------------------------------

async function registerRecipientAccount({ organizationId, recipientId, processorAccountId, currency = 'USD' }) {
  const id = uuidv4();
  const existing = await db(ACCOUNT_TABLE)
    .where({ organization_id: organizationId, recipient_id: recipientId, currency })
    .first();

  if (existing) {
    await db(ACCOUNT_TABLE).where({ id: existing.id }).update({ processor_account_id: processorAccountId });
    return formatRecipientAccount({ ...existing, processor_account_id: processorAccountId });
  }

  const [row] = await db(ACCOUNT_TABLE)
    .insert({ id, organization_id: organizationId, recipient_id: recipientId, processor_account_id: processorAccountId, currency })
    .returning('*');
  return formatRecipientAccount(row);
}

async function verifyRecipientAccount(organizationId, accountId) {
  const [row] = await db(ACCOUNT_TABLE)
    .where({ id: accountId, organization_id: organizationId })
    .update({ status: 'VERIFIED' })
    .returning('*');
  if (!row) throw new Error('Recipient account not found');
  return formatRecipientAccount(row);
}

async function disableRecipientAccount(organizationId, accountId) {
  const [row] = await db(ACCOUNT_TABLE)
    .where({ id: accountId, organization_id: organizationId })
    .update({ status: 'DISABLED' })
    .returning('*');
  if (!row) throw new Error('Recipient account not found');
  return formatRecipientAccount(row);
}

async function getRecipientAccount(organizationId, accountId) {
  const row = await db(ACCOUNT_TABLE).where({ id: accountId, organization_id: organizationId }).first();
  if (!row) throw new Error('Recipient account not found');
  return formatRecipientAccount(row);
}

async function listRecipientAccounts(organizationId, { limit = 50, offset = 0 } = {}) {
  const query = db(ACCOUNT_TABLE).where({ organization_id: organizationId }).orderBy('created_at', 'desc');
  const [{ count }] = await query.clone().clearOrder().count('* as count');
  const rows = await query.clone().limit(Math.min(Number(limit), 100)).offset(Number(offset));
  return { data: rows.map(formatRecipientAccount), total: Number(count) };
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

async function createPayout({
  organizationId,
  recipientAccountId,
  amount,
  currency = 'USD',
  scheduledFor,
  idempotencyKey,
  sourceType,
  sourceReferenceId,
  metadata,
  riskContext,
}) {
  const existing = await db(PAYOUT_TABLE).where({ idempotency_key: idempotencyKey }).first();
  if (existing) {
    logger.info({ idempotencyKey }, 'Returning existing payout (idempotent)');
    return formatPayout(existing);
  }

  const account = await db(ACCOUNT_TABLE).where({ id: recipientAccountId, organization_id: organizationId }).first();
  if (!account) {
    throw new AppError('Recipient account not found', 404, 'not_found');
  }
  if (account.status !== 'VERIFIED') {
    throw new AppError(`Recipient account is ${account.status}, not VERIFIED`, 400, 'invalid_state');
  }

  const riskDecision = await evaluatePayoutRisk({
    organizationId,
    account,
    amount,
    currency,
    sourceType,
    sourceReferenceId,
    idempotencyKey,
    riskContext,
  });

  if (riskDecision?.decision === 'block_payout') {
    throw new AppError(
      `Payout blocked by risk policy: ${riskDecision.reasons.join(', ') || 'high_risk_signal'}`,
      403,
      'risk_blocked'
    );
  }

  const id = uuidv4();
  const payoutMetadata = buildPayoutMetadata({ metadata, riskDecision });
  const scheduled = determineScheduledFor({ scheduledFor, riskDecision });
  const [row] = await db(PAYOUT_TABLE)
    .insert({
      id,
      organization_id: organizationId,
      recipient_account_id: recipientAccountId,
      amount: String(amount),
      currency,
      status: 'PENDING',
      scheduled_for: scheduled,
      idempotency_key: idempotencyKey,
      source_type: sourceType,
      source_reference_id: sourceReferenceId || null,
      metadata: JSON.stringify(payoutMetadata),
    })
    .returning('*');

  if (scheduled.getTime() > Date.now() + 1000 || payoutMetadata[MANUAL_REVIEW_FLAG]) {
    return formatPayout(row);
  }

  return executePayout(organizationId, id);
}

async function executePayout(organizationId, payoutId) {
  const row = await db(PAYOUT_TABLE)
    .join(ACCOUNT_TABLE, `${ACCOUNT_TABLE}.id`, `${PAYOUT_TABLE}.recipient_account_id`)
    .where(`${PAYOUT_TABLE}.id`, payoutId)
    .where(`${PAYOUT_TABLE}.organization_id`, organizationId)
    .select(`${PAYOUT_TABLE}.*`, `${ACCOUNT_TABLE}.processor_account_id`)
    .first();

  if (!row) throw new Error('Payout not found');
  if (row.status !== 'PENDING') {
    logger.info({ payoutId, status: row.status }, 'Payout already processed, skipping');
    return formatPayout(row);
  }
  if (isManualReviewRequired(row.metadata)) {
    throw new AppError('Payout requires manual review before release', 409, 'manual_review_required');
  }

  await db(PAYOUT_TABLE).where({ id: payoutId }).update({ status: 'PROCESSING' });

  const processorResult = await callProcessor({
    processorAccountId: row.processor_account_id,
    amount: row.amount,
    currency: row.currency,
  });

  if (!processorResult.success) {
    await db(PAYOUT_TABLE).where({ id: payoutId }).update({
      status: 'FAILED',
      failure_reason: processorResult.failureMessage || 'Processor declined',
    });
    logger.warn({ payoutId, reason: processorResult.failureMessage }, 'Payout failed at processor');
    return getPayout(organizationId, payoutId);
  }

  await db(PAYOUT_TABLE).where({ id: payoutId }).update({
    status: 'PAID',
    processed_at: new Date(),
    processor_payout_id: processorResult.processorPayoutId || null,
  });

  // Best-effort ledger post — a successful payout is never "undone" because
  // our bookkeeping call failed. Needs manual reconciliation if this errors.
  try {
    const ledgerTxn = await postToLedger({
      organizationId,
      payoutId,
      amount: row.amount,
      currency: row.currency,
    });
    if (ledgerTxn && ledgerTxn.id) {
      await db(PAYOUT_TABLE).where({ id: payoutId }).update({ ledger_transaction_id: ledgerTxn.id });
    }
  } catch (ledgerError) {
    logger.error({ payoutId, error: ledgerError.message }, 'CRITICAL: Payout succeeded but ledger post failed');
  }

  return getPayout(organizationId, payoutId);
}

async function getPayout(organizationId, payoutId) {
  const row = await db(PAYOUT_TABLE).where({ id: payoutId, organization_id: organizationId }).first();
  if (!row) throw new Error('Payout not found');
  return formatPayout(row);
}

async function listPayouts(organizationId, { limit = 50, cursor, status, recipientAccountId } = {}) {
  const normalized = normalizeListPayoutArgs(organizationId, { limit, cursor, status, recipientAccountId });
  let query = db(PAYOUT_TABLE).where({ organization_id: normalized.organizationId });
  if (normalized.status) query = query.where({ status: normalized.status });
  if (normalized.recipientAccountId) query = query.where({ recipient_account_id: normalized.recipientAccountId });
  if (normalized.cursor) query = query.where('id', '<', normalized.cursor);

  const [{ count }] = await query.clone().count('* as count');
  const take = Math.min(Number(normalized.limit), 100);
  const rows = await query.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(take + 1);
  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;

  return {
    data: data.map(formatPayout),
    total: Number(count),
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
}

async function cancelPayout(organizationId, payoutId, reason) {
  const [row] = await db(PAYOUT_TABLE)
    .where({ id: payoutId, organization_id: organizationId, status: 'PENDING' })
    .update({ status: 'CANCELED', failure_reason: reason })
    .returning('*');
  if (!row) throw new Error('Payout not found or not in a cancelable state (must be PENDING)');
  return formatPayout(row);
}

async function markPayoutReturned(organizationId, payoutId, reason) {
  const [row] = await db(PAYOUT_TABLE)
    .where({ id: payoutId, organization_id: organizationId, status: 'PAID' })
    .update({ status: 'RETURNED', failure_reason: reason })
    .returning('*');
  if (!row) throw new Error('Payout not found or was not in PAID state');
  logger.error({ payoutId, organizationId, reason }, 'Payout returned by bank — needs manual ledger reconciliation');
  return formatPayout(row);
}

async function releasePayoutManualReview(organizationId, payoutId, note) {
  const row = await db(PAYOUT_TABLE)
    .where({ id: payoutId, organization_id: organizationId })
    .first();

  if (!row) {
    throw new AppError('Payout not found', 404, 'not_found');
  }
  if (row.status !== 'PENDING') {
    throw new AppError('Only pending payouts can be released from manual review', 409, 'invalid_state');
  }

  const currentMetadata = parseMetadata(row.metadata);
  if (!currentMetadata[MANUAL_REVIEW_FLAG]) {
    throw new AppError('Payout is not currently held for manual review', 409, 'invalid_state');
  }

  const nextMetadata = {
    ...currentMetadata,
    [MANUAL_REVIEW_FLAG]: false,
    manualReviewReleasedAt: new Date().toISOString(),
    manualReviewReleaseNote: note || null,
  };

  await db(PAYOUT_TABLE)
    .where({ id: payoutId, organization_id: organizationId })
    .update({
      metadata: JSON.stringify(nextMetadata),
      scheduled_for: new Date(),
      updated_at: new Date(),
    });

  return executePayout(organizationId, payoutId);
}

async function processScheduledPayouts(organizationId) {
  const due = await db(PAYOUT_TABLE)
    .where({ organization_id: organizationId, status: 'PENDING' })
    .where('scheduled_for', '<=', new Date())
    .orderBy('scheduled_for', 'asc')
    .select('id', 'metadata');

  let processed = 0;
  let failed = 0;
  for (const row of due) {
    if (isManualReviewRequired(row.metadata)) {
      logger.warn({ payoutId: row.id }, 'Skipping payout held for manual review');
      continue;
    }

    try {
      const result = await executePayout(organizationId, row.id);
      if (result.status === 'PAID') processed++;
      else failed++;
    } catch (err) {
      logger.error({ payoutId: row.id, err: err.message }, 'Failed to execute scheduled payout');
      failed++;
    }
  }
  return { processed, failed };
}

async function findUnpostedPayouts(organizationId) {
  const rows = await db(PAYOUT_TABLE)
    .where({ organization_id: organizationId, status: 'PAID' })
    .whereNull('ledger_transaction_id')
    .orderBy('processed_at', 'asc');
  return rows.map(formatPayout);
}

// ---------------------------------------------------------------------------
// Processor stub
// ---------------------------------------------------------------------------

async function callProcessor({ processorAccountId, amount, currency }) {
  try {
    return await stripeGateway.createTransfer({
      destinationAccountId: processorAccountId,
      amount: Number(amount),
      currency,
      description: 'Archisynapse payout transfer',
      metadata: {
        processor_account_id: processorAccountId,
      },
    });
  } catch (error) {
    return {
      success: false,
      failureMessage: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Ledger stub — will be replaced by HTTP call when Ledger Service is wired
// ---------------------------------------------------------------------------

async function postToLedger({ organizationId, payoutId, amount, currency }) {
  // TODO: POST to Ledger Service when deployed. For now return a synthetic ref.
  logger.info({ organizationId, payoutId, amount, currency }, 'Ledger post (stub)');
  return { id: `ledger_${uuidv4()}`, status: 'POSTED' };
}

function buildPayoutMetadata({ metadata, riskDecision }) {
  const nextMetadata = {
    ...normalizeMetadataInput(metadata),
  };

  if (!riskDecision) {
    return nextMetadata;
  }

  nextMetadata.riskDecision = {
    id: riskDecision.id,
    decision: riskDecision.decision,
    riskScore: riskDecision.riskScore,
    reasons: riskDecision.reasons,
    createdAt: riskDecision.createdAt,
  };

  if (riskDecision.decision === 'hold_payout_review') {
    nextMetadata[MANUAL_REVIEW_FLAG] = true;
  }

  if (riskDecision.decision === 'delay_payout_72h') {
    nextMetadata.riskHoldWindowHours = DELAY_PAYOUT_HOURS;
  }

  return nextMetadata;
}

function determineScheduledFor({ scheduledFor, riskDecision }) {
  const scheduled = scheduledFor ? new Date(scheduledFor) : new Date();

  if (riskDecision?.decision !== 'delay_payout_72h') {
    return scheduled;
  }

  const holdUntil = new Date(Date.now() + DELAY_PAYOUT_HOURS * 60 * 60 * 1000);
  return scheduled > holdUntil ? scheduled : holdUntil;
}

async function evaluatePayoutRisk({
  organizationId,
  account,
  amount,
  currency,
  sourceType,
  sourceReferenceId,
  idempotencyKey,
  riskContext,
}) {
  if (!riskContext) {
    return null;
  }

  const accountAgeDays = calculateAgeDays(account.created_at);
  const normalizedRiskContext = stripUndefined({
    userId: riskContext.userId,
    creatorId: riskContext.creatorId || account.recipient_id,
    trackId: riskContext.trackId,
    deviceId: riskContext.deviceId,
    email: riskContext.email,
    sessionId: riskContext.sessionId,
    payoutDestination: riskContext.payoutDestination || account.processor_account_id,
    ipAddress: riskContext.ipAddress,
    country: riskContext.country,
    dnaVerified: riskContext.dnaVerified ?? false,
    soulprintVerified: riskContext.soulprintVerified ?? false,
    ledgerRecordFound: riskContext.ledgerRecordFound ?? Boolean(sourceReferenceId),
    usageCount: riskContext.usageCount ?? 0,
    suddenUsageSpike: riskContext.suddenUsageSpike ?? false,
    creatorAccountAgeDays: riskContext.creatorAccountAgeDays ?? accountAgeDays,
    payoutMethodAgeDays: riskContext.payoutMethodAgeDays ?? accountAgeDays,
    duplicatePayoutDestination: riskContext.duplicatePayoutDestination ?? false,
    payoutDestinationChangedRecently: riskContext.payoutDestinationChangedRecently ?? false,
  });

  const event = {
    eventType: 'royalty_payout_request',
    amount: Number(amount),
    currency,
    ...normalizedRiskContext,
  };

  return riskService.createRoyaltyRiskDecision({
    organizationId,
    event,
    idempotencyKey: `payout-risk:${idempotencyKey}`,
  });
}

function calculateAgeDays(value) {
  if (!value) return 0;
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));
}

function normalizeMetadataInput(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'string') return parseMetadata(metadata);
  return metadata;
}

function stripUndefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isManualReviewRequired(metadata) {
  return Boolean(parseMetadata(metadata)[MANUAL_REVIEW_FLAG]);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatPayout(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    recipientAccountId: row.recipient_account_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    scheduledFor: row.scheduled_for,
    processedAt: row.processed_at || null,
    failureReason: row.failure_reason || null,
    ledgerTransactionId: row.ledger_transaction_id || null,
    processorPayoutId: row.processor_payout_id || null,
    idempotencyKey: row.idempotency_key,
    sourceType: row.source_type,
    sourceReferenceId: row.source_reference_id || null,
    metadata: parseMetadata(row.metadata),
    manualReviewRequired: isManualReviewRequired(row.metadata),
    riskDecision: parseMetadata(row.metadata).riskDecision || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatRecipientAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    recipientId: row.recipient_id,
    processorAccountId: row.processor_account_id,
    status: row.status,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeListPayoutArgs(organizationIdOrOptions, options = {}) {
  if (typeof organizationIdOrOptions === 'string') {
    return {
      organizationId: organizationIdOrOptions,
      ...options,
      status: normalizePayoutStatus(options.status),
    };
  }

  const legacyOptions = organizationIdOrOptions || {};
  return {
    organizationId: legacyOptions.organizationId || 'org_demo',
    limit: legacyOptions.limit,
    cursor: legacyOptions.cursor,
    status: normalizePayoutStatus(legacyOptions.status),
    recipientAccountId: legacyOptions.recipientAccountId,
  };
}

function normalizePayoutStatus(status) {
  if (!status) return status;

  const aliases = {
    completed: 'PAID',
    paid: 'PAID',
    sent: 'PAID',
    queued: 'PENDING',
    pending: 'PENDING',
    processing: 'PROCESSING',
    failed: 'FAILED',
    canceled: 'CANCELED',
    cancelled: 'CANCELED',
    returned: 'RETURNED',
  };

  return aliases[String(status).toLowerCase()] || String(status).toUpperCase();
}

module.exports = {
  registerRecipientAccount,
  verifyRecipientAccount,
  disableRecipientAccount,
  getRecipientAccount,
  listRecipientAccounts,
  createPayout,
  executePayout,
  getPayout,
  listPayouts,
  cancelPayout,
  markPayoutReturned,
  releasePayoutManualReview,
  processScheduledPayouts,
  findUnpostedPayouts,
};
