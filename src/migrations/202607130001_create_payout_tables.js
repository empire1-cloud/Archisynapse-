exports.up = async function (knex) {
  const hasRecipientAccounts = await knex.schema.hasTable('recipient_accounts');
  if (!hasRecipientAccounts) {
    await knex.schema.createTable('recipient_accounts', (t) => {
      t.string('id').primary();
      t.string('organization_id').notNullable();
      t.string('recipient_id').notNullable();
      t.string('processor_account_id', 255).notNullable();
      t.enu('status', ['PENDING_VERIFICATION', 'VERIFIED', 'DISABLED']).notNullable().defaultTo('PENDING_VERIFICATION');
      t.string('currency', 3).notNullable().defaultTo('USD');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      t.unique(['organization_id', 'recipient_id', 'currency']);
      t.index(['organization_id']);
      t.index(['recipient_id']);
    });
  }

  const hasPayouts = await knex.schema.hasTable('payouts');
  if (hasPayouts) {
    const hasIdempotencyKey = await knex.schema.hasColumn('payouts', 'idempotency_key');
    if (!hasIdempotencyKey) {
      const hasLegacyTable = await knex.schema.hasTable('payouts_legacy');
      if (!hasLegacyTable) {
        await knex.schema.renameTable('payouts', 'payouts_legacy');

        const client = knex.client.config.client;
        if (client === 'pg' || client === 'postgresql') {
          await knex.raw('ALTER INDEX IF EXISTS payouts_pkey RENAME TO payouts_legacy_pkey');
          await knex.raw('ALTER INDEX IF EXISTS payouts_customer_id_index RENAME TO payouts_legacy_customer_id_index');
          await knex.raw('ALTER INDEX IF EXISTS payouts_status_index RENAME TO payouts_legacy_status_index');
        }
      }
    }
  }

  const payoutsExists = await knex.schema.hasTable('payouts');
  if (!payoutsExists) {
    await knex.schema.createTable('payouts', (t) => {
      t.string('id').primary();
      t.string('organization_id').notNullable();
      t.string('recipient_account_id').notNullable().references('id').inTable('recipient_accounts').onDelete('cascade');
      t.decimal('amount', 19, 4).notNullable();
      t.string('currency', 3).notNullable().defaultTo('USD');
      t.enu('status', ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED', 'RETURNED']).notNullable().defaultTo('PENDING');
      t.timestamp('scheduled_for', { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp('processed_at', { useTz: true }).nullable();
      t.text('failure_reason').nullable();
      t.string('ledger_transaction_id').nullable();
      t.string('processor_payout_id', 255).nullable();
      t.string('idempotency_key', 255).notNullable().unique();
      t.enu('source_type', ['EARNINGS', 'REFERRAL', 'MANUAL']).notNullable();
      t.string('source_reference_id', 100).nullable();
      t.jsonb('metadata').nullable().defaultTo('{}');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['organization_id']);
      t.index(['recipient_account_id']);
      t.index(['status']);
      t.index(['organization_id', 'scheduled_for']);
    });

    await knex.raw(
      "CREATE INDEX idx_payouts_unposted ON payouts(organization_id) WHERE ledger_transaction_id IS NULL AND status = 'PAID'"
    );
  }
};

exports.down = async function () {
  // Intentionally no-op — payout history is immutable.
};
