const { seed } = require('../seed');

exports.seed = async function (knex) {
  await knex('transactions').del();
  await knex('webhook_events').del();
  await knex('payouts').del();
  await knex('customers').del();
  await seed();
};
