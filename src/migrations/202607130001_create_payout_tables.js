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
    const cols = await knex.raw("PRAGMA table_info(payouts)");
    const hasLegacySchema = cols.rows
      ? !cols.rows.some((c) => c.name === 'idempotency_key')
      : !cols.some((c) => c.name === 'idempotency_key');
    if (hasLegacySchema) {
      await knex.raw('ALTER TABLE payouts RENAME TO payouts_legacy');
      // Renaming a table does NOT rename its indexes (SQLite and Postgres both
      // keep index names in a global namespace), so the legacy indexes would
      // collide with the new payouts table's indexes. Rename them out of the way.
      const isSqlite = ['sqlite3', 'better-sqlite3'].includes(knex.client.config.client);
      for (const idx of ['payouts_customer_id_index', 'payouts_status_index']) {
        if (isSqlite) {
          await knex.raw(`DROP INDEX IF EXISTS ${idx}`);
        } else {
          await knex.raw(`ALTER INDEX IF EXISTS ${idx} RENAME TO legacy_${idx}`);
        }
      }
      if (isSqlite) {
        // Recreate the dropped indexes on the renamed legacy table.
        await knex.raw('CREATE INDEX IF NOT EXISTS legacy_payouts_customer_id_index ON payouts_legacy (customer_id)');
        await knex.raw('CREATE INDEX IF NOT EXISTS legacy_payouts_status_index ON payouts_legacy (status)');
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
