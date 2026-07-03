exports.up = async function (knex) {
  // ── transactions ──
  await knex.schema.createTable('transactions', (t) => {
    t.uuid('id').primary();
    t.enu('type', ['stream_royalty', 'stem_license', 'referral_passive', 'split', 'payment', 'refund']).notNullable().defaultTo('payment');
    t.decimal('amount', 10, 6).notNullable();
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.uuid('from_entity_id').nullable();
    t.uuid('to_entity_id').nullable();
    t.uuid('track_id').nullable();
    t.uuid('parent_transaction_id').nullable();
    t.enu('status', ['pending', 'settled', 'failed', 'refunded']).notNullable().defaultTo('pending');
    t.jsonb('metadata').nullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('settled_at', { useTz: true }).nullable();
    t.index(['from_entity_id']);
    t.index(['to_entity_id']);
    t.index(['track_id']);
    t.index(['status']);
    t.index(['created_at']);
  });

  // ── customers ──
  await knex.schema.createTable('customers', (t) => {
    t.uuid('id').primary();
    t.string('creator_id').unique().notNullable();
    t.string('display_name').notNullable();
    t.decimal('wallet_balance', 10, 6).notNullable().defaultTo(0);
    t.uuid('referral_parent_id').nullable().references('id').inTable('customers').onDelete('set null');
    t.string('stripe_customer_id').nullable();
    t.string('email').nullable();
    t.jsonb('metadata').nullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.index(['creator_id']);
    t.index(['referral_parent_id']);
  });

  // ── payouts ──
  await knex.schema.createTable('payouts', (t) => {
    t.uuid('id').primary();
    t.uuid('customer_id').notNullable().references('id').inTable('customers').onDelete('cascade');
    t.decimal('amount', 10, 6).notNullable();
    t.enu('status', ['queued', 'processing', 'sent', 'failed']).notNullable().defaultTo('queued');
    t.string('payout_method', 50).nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('settled_at', { useTz: true }).nullable();
    t.index(['customer_id']);
    t.index(['status']);
  });

  // ── webhook_events ──
  await knex.schema.createTable('webhook_events', (t) => {
    t.uuid('id').primary();
    t.string('event_type', 100).notNullable();
    t.jsonb('payload').notNullable().defaultTo('{}');
    t.enu('status', ['pending', 'delivered', 'failed']).notNullable().defaultTo('pending');
    t.integer('retries').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.index(['event_type']);
    t.index(['status']);
    t.index(['created_at']);
  });

  // ── partial index for unique active referral parent (prevent circular refs in app layer) ──
  await knex.raw('CREATE INDEX idx_customers_referral_tree ON customers (referral_parent_id) WHERE referral_parent_id IS NOT NULL');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('webhook_events');
  await knex.schema.dropTableIfExists('payouts');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('transactions');
};
