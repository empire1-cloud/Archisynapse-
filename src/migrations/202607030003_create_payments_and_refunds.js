exports.up = async function (knex) {
  const hasPayments = await knex.schema.hasTable('payments');
  if (!hasPayments) {
    await knex.schema.createTable('payments', (t) => {
      t.string('id').primary();
      t.string('organization_id').notNullable();
      t.string('customer_id').nullable();
      t.decimal('amount', 19, 4).notNullable();
      t.string('currency', 3).notNullable().defaultTo('USD');
      t.enu('status', ['PENDING', 'AUTHORIZED', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED']).notNullable().defaultTo('PENDING');
      t.string('payment_method_type', 20).notNullable();
      t.string('payment_method_token', 255).notNullable();
      t.string('payment_method_last4', 4).nullable();
      t.string('payment_method_brand', 50).nullable();
      t.text('description').nullable();
      t.string('idempotency_key', 255).notNullable().unique();
      t.string('ledger_transaction_id').nullable();
      t.string('processor_transaction_id', 255).nullable();
      t.text('failure_reason').nullable();
      t.jsonb('metadata').nullable().defaultTo('{}');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['organization_id']);
      t.index(['customer_id']);
      t.index(['status']);
      t.index(['created_at']);
    });
  }

  const hasRefunds = await knex.schema.hasTable('refunds');
  if (!hasRefunds) {
    await knex.schema.createTable('refunds', (t) => {
      t.string('id').primary();
      t.string('payment_id').notNullable().references('id').inTable('payments').onDelete('cascade');
      t.string('organization_id').notNullable();
      t.decimal('amount', 19, 4).notNullable();
      t.text('reason').notNullable();
      t.enu('status', ['SUCCEEDED', 'FAILED']).notNullable();
      t.string('idempotency_key', 255).notNullable().unique();
      t.string('ledger_transaction_id').nullable();
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['payment_id']);
      t.index(['organization_id']);
    });
  }
};

exports.down = async function () {
  // Intentionally no-op to avoid destructive rollback on payment history.
};
