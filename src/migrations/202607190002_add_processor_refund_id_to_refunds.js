exports.up = async function (knex) {
  const hasRefunds = await knex.schema.hasTable('refunds');
  if (!hasRefunds) {
    return;
  }

  const hasProcessorRefundId = await knex.schema.hasColumn('refunds', 'processor_refund_id');
  if (!hasProcessorRefundId) {
    await knex.schema.alterTable('refunds', (t) => {
      t.string('processor_refund_id', 255).nullable();
    });
  }
};

exports.down = async function () {
  // Intentionally no-op to preserve immutable financial history.
};
