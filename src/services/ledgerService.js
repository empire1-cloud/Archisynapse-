const db = require('../db');
const nodeCrypto = require('crypto');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

  const TABLES = {
    accounts: 'ledger_accounts',
    transactions: 'ledger_transactions',
  entries: 'ledger_journal_entries',
  idempotency: 'ledger_idempotency_store',
  audit: 'ledger_audit_logs',
};

const ACCOUNT_TYPES = new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
const TRANSACTION_TYPES = new Set(['PAYMENT', 'PAYOUT', 'REFUND', 'CHARGEBACK', 'FEE', 'REVERSAL', 'ADJUSTMENT']);

function createId(prefix) {
  return `${prefix}_${nodeCrypto.randomBytes(8).toString('hex')}`;
}

function parseAmountToUnits(value) {
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d{1,4})?$/.test(raw)) {
    throw new AppError(`Invalid amount: ${value}`, 400, 'invalid_amount');
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  const units = (BigInt(whole) * 10000n) + BigInt((fraction + '0000').slice(0, 4));
  return negative ? -units : units;
}

function formatUnits(units) {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / 10000n;
  const fraction = String(absolute % 10000n).padStart(4, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

function normalizeAmount(value) {
  return formatUnits(parseAmountToUnits(value));
}

function amountToNumber(value) {
  return Number(normalizeAmount(value));
}

function parseJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function hashRequest(payload) {
  return nodeCrypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new AppError('Transactions require at least two entries', 400, 'invalid_entries');
  }

  let debits = 0n;
  let credits = 0n;

  for (const entry of entries) {
    const amount = parseAmountToUnits(entry.amount);
    if (amount <= 0n) {
      throw new AppError('Entry amounts must be positive', 400, 'invalid_amount');
    }
    if (entry.debitCredit === 'DEBIT') debits += amount;
    else if (entry.debitCredit === 'CREDIT') credits += amount;
    else throw new AppError(`Invalid entry side: ${entry.debitCredit}`, 400, 'invalid_entries');
  }

  if (debits === 0n || credits === 0n || debits !== credits) {
    throw new AppError('Transaction does not balance. Debits must equal credits.', 400, 'unbalanced_transaction');
  }
}

async function createAccount({ organizationId, code, name, type, currency = 'USD', metadata = {} }) {
  if (!ACCOUNT_TYPES.has(type)) {
    throw new AppError(`Invalid account type: ${type}`, 400, 'invalid_account_type');
  }

  const id = createId('acct');
  const now = new Date().toISOString();
  const row = {
    id,
    organization_id: organizationId,
    code,
    name,
    type,
    balance: '0.0000',
    currency,
    is_active: true,
    metadata: JSON.stringify(metadata),
    created_at: now,
    updated_at: now,
  };

  try {
    await db(TABLES.accounts).insert(row);
  } catch (error) {
    if (String(error.message).includes('UNIQUE') || String(error.message).includes('duplicate')) {
      throw new AppError(`Account code ${code} already exists`, 409, 'duplicate_account');
    }
    throw error;
  }

  await auditLog({
    organizationId,
    action: 'CREATE',
    entityType: 'ACCOUNT',
    entityId: id,
    previousState: null,
    newState: { code, name, type, currency },
  });

  return formatAccount(row);
}

async function postTransaction(request) {
  return db.transaction(async (trx) => postTransactionInTrx(trx, request));
}

async function reverseTransaction({ organizationId, transactionId, reason }) {
  return db.transaction(async (trx) => {
    const original = await trx(TABLES.transactions)
      .where({ id: transactionId, organization_id: organizationId })
      .first();

    if (!original) {
      throw new AppError('Transaction not found', 404, 'not_found');
    }

    if (original.status === 'REVERSED') {
      throw new AppError('Transaction already reversed', 400, 'invalid_state');
    }

    const originalEntries = await trx(TABLES.entries)
      .where({ transaction_id: transactionId, organization_id: organizationId })
      .orderBy('created_at', 'asc');

    if (originalEntries.length === 0) {
      throw new AppError('Transaction has no entries', 500, 'corrupt_transaction');
    }

    const reversal = await postTransactionInTrx(trx, {
      organizationId,
      type: 'REVERSAL',
      referenceId: transactionId,
      description: `Reversal of ${original.type}: ${reason}`,
      amount: original.amount,
      currency: original.currency,
      metadata: { originalTransactionId: transactionId, reason },
      entries: originalEntries.map((entry) => ({
        accountId: entry.account_id,
        debitCredit: entry.debit_credit === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: entry.amount,
        description: `Reversal: ${entry.description}`,
        metadata: parseJson(entry.metadata),
      })),
    });

    await trx(TABLES.transactions)
      .where({ id: transactionId })
      .update({
        status: 'REVERSED',
        reversed_transaction_id: reversal.id,
        updated_at: new Date().toISOString(),
      });

    await auditLog({
      trx,
      organizationId,
      action: 'REVERSE',
      entityType: 'TRANSACTION',
      entityId: transactionId,
      previousState: { status: original.status },
      newState: { status: 'REVERSED', reversalTransactionId: reversal.id },
    });

    return reversal;
  });
}

async function getTransaction({ organizationId, transactionId }) {
  const txn = await db(TABLES.transactions)
    .where({ id: transactionId, organization_id: organizationId })
    .first();

  if (!txn) return null;
  return hydrateTransaction(db, txn);
}

async function getTrialBalance(organizationId) {
  const accounts = await db(TABLES.accounts)
    .where({ organization_id: organizationId })
    .orderBy('code', 'asc');

  const entries = await db(TABLES.entries)
    .where({ organization_id: organizationId });

  const totals = new Map();
  for (const entry of entries) {
    const current = totals.get(entry.account_id) || { debit: 0n, credit: 0n };
    const amount = parseAmountToUnits(entry.amount);
    if (entry.debit_credit === 'DEBIT') current.debit += amount;
    else current.credit += amount;
    totals.set(entry.account_id, current);
  }

  return accounts.map((account) => {
    const current = totals.get(account.id) || { debit: 0n, credit: 0n };
    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      debitSum: formatUnits(current.debit),
      creditSum: formatUnits(current.credit),
      balance: formatUnits(current.debit - current.credit),
      asOf: new Date().toISOString(),
    };
  });
}

async function reconcile(organizationId) {
  const trialBalance = await getTrialBalance(organizationId);
  const totalDebits = trialBalance.reduce((sum, account) => sum + parseAmountToUnits(account.debitSum), 0n);
  const totalCredits = trialBalance.reduce((sum, account) => sum + parseAmountToUnits(account.creditSum), 0n);

  const transactions = await db(TABLES.transactions)
    .where({ organization_id: organizationId, status: 'POSTED' });
  const entries = await db(TABLES.entries)
    .where({ organization_id: organizationId });

  const entryGroups = new Map();
  for (const entry of entries) {
    const bucket = entryGroups.get(entry.transaction_id) || [];
    bucket.push(entry);
    entryGroups.set(entry.transaction_id, bucket);
  }

  const discrepancies = [];
  for (const txn of transactions) {
    const group = entryGroups.get(txn.id) || [];
    let net = 0n;
    for (const entry of group) {
      const amount = parseAmountToUnits(entry.amount);
      net += entry.debit_credit === 'DEBIT' ? amount : -amount;
    }
    if (net !== 0n) {
      discrepancies.push({
        transactionId: txn.id,
        description: txn.description,
        expectedBalance: '0.0000',
        actualBalance: formatUnits(net),
        difference: formatUnits(net),
      });
    }
  }

  return {
    asOf: new Date().toISOString(),
    totalTransactions: transactions.length,
    balancedTransactions: transactions.length - discrepancies.length,
    unbalancedTransactions: discrepancies.map((item) => item.transactionId),
    trialBalance,
    isBalanced: totalDebits === totalCredits && discrepancies.length === 0,
    totals: {
      debit: formatUnits(totalDebits),
      credit: formatUnits(totalCredits),
    },
    discrepancies,
  };
}

  async function postTransactionInTrx(trx, request) {
  const { organizationId, type, referenceId, description, amount, currency = 'USD', entries, idempotencyKey, metadata = {} } = request;

  if (!TRANSACTION_TYPES.has(type)) {
    throw new AppError(`Invalid transaction type: ${type}`, 400, 'invalid_transaction_type');
  }

  validateEntries(entries);
  const normalizedAmount = normalizeAmount(amount);
  if (parseAmountToUnits(normalizedAmount) <= 0n) {
    throw new AppError('Transaction amount must be positive', 400, 'invalid_amount');
  }

  const requestFingerprint = {
    organizationId,
    type,
    referenceId: referenceId || null,
    description,
    amount: normalizedAmount,
    currency,
    entries: entries.map((entry) => ({
      accountId: entry.accountId,
      debitCredit: entry.debitCredit,
      amount: normalizeAmount(entry.amount),
      description: entry.description,
      metadata: entry.metadata || {},
    })),
    metadata,
  };

    if (idempotencyKey) {
      const existing = await trx(TABLES.idempotency)
        .where({
          organization_id: organizationId,
          idempotency_key: idempotencyKey,
        })
        .first();

      if (existing) {
        const incomingHash = hashRequest(requestFingerprint);
        if (existing.request_hash !== incomingHash) {
        throw new AppError('Idempotency key reuse with different payload', 409, 'idempotency_conflict');
      }
      return parseJson(existing.response, null);
    }
  }

  const accountIds = [...new Set(entries.map((entry) => entry.accountId))];
  const accounts = await trx(TABLES.accounts)
    .where({ organization_id: organizationId, is_active: 1 })
    .whereIn('id', accountIds);

  if (accounts.length !== accountIds.length) {
    throw new AppError('One or more accounts were not found for this organization', 400, 'account_not_found');
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  for (const entry of entries) {
    const account = accountsById.get(entry.accountId);
    if (account.currency !== currency) {
      throw new AppError(`Account ${account.code} currency does not match transaction currency`, 400, 'currency_mismatch');
    }
  }

  const transactionId = createId('ldg_txn');
  const now = new Date().toISOString();
  const transactionRow = {
    id: transactionId,
    organization_id: organizationId,
    type,
    reference_id: referenceId || null,
    description,
    amount: normalizedAmount,
    currency,
    status: 'POSTED',
    idempotency_key: idempotencyKey || null,
    reversed_transaction_id: null,
    metadata: JSON.stringify(metadata),
    posted_at: now,
    created_at: now,
    updated_at: now,
  };

  await trx(TABLES.transactions).insert(transactionRow);

  const entryRows = [];
  const balanceUpdates = new Map();
  for (const entry of entries) {
    const normalizedEntryAmount = normalizeAmount(entry.amount);
    const row = {
      id: createId('entry'),
      transaction_id: transactionId,
      organization_id: organizationId,
      account_id: entry.accountId,
      debit_credit: entry.debitCredit,
      amount: normalizedEntryAmount,
      description: entry.description,
      metadata: JSON.stringify(entry.metadata || {}),
      created_at: now,
    };
    entryRows.push(row);

    const delta = parseAmountToUnits(normalizedEntryAmount) * (entry.debitCredit === 'DEBIT' ? 1n : -1n);
    balanceUpdates.set(entry.accountId, (balanceUpdates.get(entry.accountId) || 0n) + delta);
  }

  await trx(TABLES.entries).insert(entryRows);

  for (const [accountId, delta] of balanceUpdates.entries()) {
    const account = accountsById.get(accountId);
    const nextBalance = parseAmountToUnits(account.balance) + delta;
    account.balance = formatUnits(nextBalance);
    await trx(TABLES.accounts)
      .where({ id: accountId })
      .update({ balance: account.balance, updated_at: now });
  }

  const transaction = await hydrateTransaction(trx, transactionRow);

  if (idempotencyKey) {
    await trx(TABLES.idempotency).insert({
      organization_id: organizationId,
      idempotency_key: idempotencyKey,
      request_hash: hashRequest(requestFingerprint),
      response: JSON.stringify(transaction),
      created_at: now,
      expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
    });
  }

  await auditLog({
    trx,
    organizationId,
    action: 'POST',
    entityType: 'TRANSACTION',
    entityId: transactionId,
    previousState: null,
    newState: { type, amount: normalizedAmount, currency, entryCount: entryRows.length },
  });

  logger.info('Ledger transaction posted', {
    transactionId,
    organizationId,
    type,
    amount: normalizedAmount,
  });

  return transaction;
}

async function hydrateTransaction(executor, txnRow) {
  const rows = await executor(TABLES.entries)
    .where({ transaction_id: txnRow.id })
    .orderBy('created_at', 'asc');

  return {
    id: txnRow.id,
    organizationId: txnRow.organization_id,
    type: txnRow.type,
    referenceId: txnRow.reference_id,
    description: txnRow.description,
    amount: normalizeAmount(txnRow.amount),
    currency: txnRow.currency,
    status: txnRow.status,
    idempotencyKey: txnRow.idempotency_key,
    reversedTransactionId: txnRow.reversed_transaction_id,
    metadata: parseJson(txnRow.metadata),
    postedAt: txnRow.posted_at,
    createdAt: txnRow.created_at,
    updatedAt: txnRow.updated_at,
    entries: rows.map((row) => ({
      id: row.id,
      transactionId: row.transaction_id,
      organizationId: row.organization_id,
      accountId: row.account_id,
      debitCredit: row.debit_credit,
      amount: normalizeAmount(row.amount),
      description: row.description,
      metadata: parseJson(row.metadata),
      createdAt: row.created_at,
    })),
  };
}

async function auditLog({ trx = db, organizationId, action, entityType, entityId, previousState, newState }) {
  await trx(TABLES.audit).insert({
    id: createId('audit'),
    organization_id: organizationId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_state: previousState == null ? null : JSON.stringify(previousState),
    new_state: JSON.stringify(newState),
    created_at: new Date().toISOString(),
  });
}

function formatAccount(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    type: row.type,
    balance: normalizeAmount(row.balance),
    currency: row.currency,
    isActive: Boolean(row.is_active),
    metadata: parseJson(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  createAccount,
  postTransaction,
  reverseTransaction,
  getTransaction,
  getTrialBalance,
  reconcile,
  normalizeAmount,
  amountToNumber,
  TABLES,
};
