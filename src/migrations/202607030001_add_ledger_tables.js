exports.up = async function (knex) {
  await knex.schema.createTable('ledger_accounts', (t) => {
    t.string('id').primary();
    t.string('organization_id').notNullable();
    t.string('code', 20).notNullable();
    t.string('name', 255).notNullable();
    t.enu('type', ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).notNullable();
    t.decimal('balance', 19, 4).notNullable().defaultTo(0);
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.jsonb('metadata').nullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['organization_id', 'code']);
    t.index(['organization_id']);
    t.index(['type']);
  });

  await knex.schema.createTable('ledger_transactions', (t) => {
    t.string('id').primary();
    t.string('organization_id').notNullable();
    t.enu('type', ['PAYMENT', 'PAYOUT', 'REFUND', 'CHARGEBACK', 'FEE', 'REVERSAL', 'ADJUSTMENT']).notNullable();
    t.string('reference_id', 100).nullable();
    t.text('description').notNullable();
    t.decimal('amount', 19, 4).notNullable();
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.enu('status', ['PENDING', 'POSTED', 'FAILED', 'REVERSED']).notNullable().defaultTo('POSTED');
    t.string('idempotency_key', 255).nullable();
    t.string('reversed_transaction_id').nullable();
    t.jsonb('metadata').nullable().defaultTo('{}');
    t.timestamp('posted_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['organization_id', 'idempotency_key']);
    t.index(['organization_id']);
    t.index(['status']);
    t.index(['reference_id']);
  });

  await knex.schema.createTable('ledger_journal_entries', (t) => {
    t.string('id').primary();
    t.string('transaction_id').notNullable().references('id').inTable('ledger_transactions').onDelete('cascade');
    t.string('organization_id').notNullable();
    t.string('account_id').notNullable().references('id').inTable('ledger_accounts').onDelete('restrict');
    t.enu('debit_credit', ['DEBIT', 'CREDIT']).notNullable();
    t.decimal('amount', 19, 4).notNullable();
    t.text('description').notNullable();
    t.jsonb('metadata').nullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.index(['transaction_id']);
    t.index(['organization_id']);
    t.index(['account_id']);
  });

  await knex.schema.createTable('ledger_idempotency_store', (t) => {
    t.increments('id').primary();
    t.string('organization_id').notNullable();
    t.string('idempotency_key', 255).notNullable();
    t.string('request_hash', 64).notNullable();
    t.jsonb('response').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.unique(['organization_id', 'idempotency_key']);
    t.index(['expires_at']);
  });

  await knex.schema.createTable('ledger_audit_logs', (t) => {
    t.string('id').primary();
    t.string('organization_id').notNullable();
    t.enu('action', ['CREATE', 'POST', 'REVERSE']).notNullable();
    t.enu('entity_type', ['ACCOUNT', 'TRANSACTION', 'ENTRY']).notNullable();
    t.string('entity_id').notNullable();
    t.jsonb('previous_state').nullable();
    t.jsonb('new_state').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.index(['organization_id']);
    t.index(['entity_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ledger_audit_logs');
  await knex.schema.dropTableIfExists('ledger_idempotency_store');
  await knex.schema.dropTableIfExists('ledger_journal_entries');
  await knex.schema.dropTableIfExists('ledger_transactions');
  await knex.schema.dropTableIfExists('ledger_accounts');
};
