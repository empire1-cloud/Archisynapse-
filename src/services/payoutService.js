const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const PAYOUT_TABLE = 'payouts';
const ACCOUNT_TABLE = 'recipient_accounts';

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
  const [{ count }] = await query.clone().count('* as count');
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
}) {
  const existing = await db(PAYOUT_TABLE).where({ idempotency_key: idempotencyKey }).first();
  if (existing) {
    logger.info({ idempotencyKey }, 'Returning existing payout (idempotent)');
    return formatPayout(existing);
  }

  const account = await db(ACCOUNT_TABLE).where({ id: recipientAccountId, organization_id: organizationId }).first();
  if (!account) throw new Error('Recipient account not found');
  if (account.status !== 'VERIFIED') {
    throw new Error(`Recipient account is ${account.status}, not VERIFIED`);
  }

  const id = uuidv4();
  const scheduled = scheduledFor ? new Date(scheduledFor) : new Date();
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
      metadata: JSON.stringify(metadata || {}),
    })
    .returning('*');

  if (scheduled.getTime() > Date.now() + 1000) {
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
  let query = db(PAYOUT_TABLE).where({ organization_id: organizationId });
  if (status) query = query.where({ status });
  if (recipientAccountId) query = query.where({ recipient_account_id: recipientAccountId });
  if (cursor) query = query.where('id', '<', cursor);

  const [{ count }] = await query.clone().count('* as count');
  const take = Math.min(Number(limit), 100);
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

async function processScheduledPayouts(organizationId) {
  const due = await db(PAYOUT_TABLE)
    .where({ organization_id: organizationId, status: 'PENDING' })
    .where('scheduled_for', '<=', new Date())
    .orderBy('scheduled_for', 'asc')
    .select('id');

  let processed = 0;
  let failed = 0;
  for (const row of due) {
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
  // TODO: integrate real processor (Stripe Connect / bank rail).
  // Stub always succeeds so the pipeline can be exercised end-to-end.
  return { success: true, processorPayoutId: `po_${uuidv4()}` };
}

// ---------------------------------------------------------------------------
// Ledger stub — will be replaced by HTTP call when Ledger Service is wired
// ---------------------------------------------------------------------------

async function postToLedger({ organizationId, payoutId, amount, currency }) {
  // TODO: POST to Ledger Service when deployed. For now return a synthetic ref.
  logger.info({ organizationId, payoutId, amount, currency }, 'Ledger post (stub)');
  return { id: `ledger_${uuidv4()}`, status: 'POSTED' };
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
    metadata: row.metadata,
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
  processScheduledPayouts,
  findUnpostedPayouts,
};
