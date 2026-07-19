exports.up = async function (knex) {
  const hasRiskEvents = await knex.schema.hasTable('risk_events');
  if (!hasRiskEvents) {
    await knex.schema.createTable('risk_events', (t) => {
      t.string('id').primary();
      t.string('organization_id').notNullable();
      t.string('event_type').notNullable().defaultTo('royalty_payout_request');
      t.string('idempotency_key', 255).nullable();
      t.integer('risk_score').notNullable();
      t.enu('decision', [
        'release_payout',
        'delay_payout_72h',
        'hold_payout_review',
        'block_payout',
      ]).notNullable();
      t.jsonb('reasons').notNullable().defaultTo('[]');
      t.decimal('amount', 19, 4).notNullable().defaultTo(0);
      t.string('currency', 3).notNullable().defaultTo('USD');
      t.string('user_id_hash').nullable();
      t.string('creator_id_hash').nullable();
      t.string('track_id_hash').nullable();
      t.string('device_id_hash').nullable();
      t.string('email_hash').nullable();
      t.string('session_id_hash').nullable();
      t.string('payout_destination_hash').nullable();
      t.string('ip_address').nullable();
      t.string('country').nullable();
      t.boolean('dna_verified').notNullable().defaultTo(false);
      t.boolean('soulprint_verified').notNullable().defaultTo(false);
      t.boolean('ledger_record_found').notNullable().defaultTo(false);
      t.integer('usage_count').notNullable().defaultTo(0);
      t.boolean('sudden_usage_spike').notNullable().defaultTo(false);
      t.integer('creator_account_age_days').notNullable().defaultTo(0);
      t.integer('payout_method_age_days').notNullable().defaultTo(0);
      t.boolean('duplicate_payout_destination').notNullable().defaultTo(false);
      t.boolean('payout_destination_changed_recently').notNullable().defaultTo(false);
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      t.index(['organization_id']);
      t.index(['event_type']);
      t.index(['decision']);
      t.index(['created_at']);
      t.index(['creator_id_hash']);
      t.index(['payout_destination_hash']);
      t.index(['device_id_hash']);
      t.index(['email_hash']);
      t.unique(['organization_id', 'idempotency_key']);
    });
  }
};

exports.down = async function () {
  // Intentionally no-op — risk event history is part of the audit trail.
};
