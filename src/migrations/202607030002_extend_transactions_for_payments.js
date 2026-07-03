exports.up = async function (knex) {
  const hasOrganizationId = await knex.schema.hasColumn('transactions', 'organization_id');
  if (!hasOrganizationId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('organization_id').nullable();
    });
  }

  const hasCustomerId = await knex.schema.hasColumn('transactions', 'customer_id');
  if (!hasCustomerId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('customer_id').nullable();
    });
  }

  const hasPaymentMethodType = await knex.schema.hasColumn('transactions', 'payment_method_type');
  if (!hasPaymentMethodType) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('payment_method_type', 50).nullable();
    });
  }

  const hasIdempotencyKey = await knex.schema.hasColumn('transactions', 'idempotency_key');
  if (!hasIdempotencyKey) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('idempotency_key', 255).nullable();
    });
  }

  const hasLedgerTransactionId = await knex.schema.hasColumn('transactions', 'ledger_transaction_id');
  if (!hasLedgerTransactionId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('ledger_transaction_id').nullable();
    });
  }

  const hasProcessorTransactionId = await knex.schema.hasColumn('transactions', 'processor_transaction_id');
  if (!hasProcessorTransactionId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('processor_transaction_id').nullable();
    });
  }

  const hasFailureReason = await knex.schema.hasColumn('transactions', 'failure_reason');
  if (!hasFailureReason) {
    await knex.schema.alterTable('transactions', (t) => {
      t.text('failure_reason').nullable();
    });
  }

  const hasRefundedAmount = await knex.schema.hasColumn('transactions', 'refunded_amount');
  if (!hasRefundedAmount) {
    await knex.schema.alterTable('transactions', (t) => {
      t.decimal('refunded_amount', 19, 4).notNullable().defaultTo(0);
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transactions_org_idempotency ON transactions (organization_id, idempotency_key)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_transactions_organization_id ON transactions (organization_id)');
};

exports.down = async function () {
  // Intentionally no-op to avoid destructive rollback on shared transaction data.
};
