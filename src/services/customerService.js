const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const stripeGateway = require('./stripeGateway');

const TABLE = 'customers';

const createCustomer = async ({ email, name, phone, metadata } = {}) => {
  const id = 'cus_' + uuidv4().replace(/-/g, '').slice(0, 12);
  const now = new Date().toISOString();
  let stripeCustomerId = null;

  try {
    const stripeCustomer = await stripeGateway.ensureCustomer({
      email,
      name,
      phone,
      metadata: { customer_id: id, ...(metadata || {}) },
    });
    stripeCustomerId = stripeCustomer.id;
  } catch (error) {
    logger.warn({ customerId: id, error: error.message }, 'Stripe customer sync failed; continuing with local customer');
  }

  const row = {
    id,
    creator_id: email || id,
    display_name: name || email || 'Unknown',
    wallet_balance: 0,
    referral_parent_id: null,
    stripe_customer_id: stripeCustomerId,
    email: email || null,
    metadata: JSON.stringify({ phone: phone || null, ...(metadata || {}) }),
    created_at: now,
    updated_at: now,
  };

  await db(TABLE).insert(row);
  logger.info('Customer created', { customerId: id, email });
  return formatCustomer(row);
};

const getCustomer = async (id) => {
  const row = await db(TABLE).where({ id }).first();
  return row ? formatCustomer(row) : null;
};

const listCustomers = async ({ limit = 20, offset = 0 } = {}) => {
  const [{ count }] = await db(TABLE).count('* as count');
  const total = Number(count);
  const rows = await db(TABLE)
    .orderBy('created_at', 'desc')
    .limit(Math.min(Number(limit), 100))
    .offset(Number(offset));

  return {
    data: rows.map(formatCustomer),
    total,
    limit: Math.min(Number(limit), 100),
    offset: Number(offset),
  };
};

function formatCustomer(row) {
  if (!row) return null;
  const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    creator_id: row.creator_id,
    phone: meta.phone || null,
    wallet_balance: Number(row.wallet_balance),
    referral_parent_id: row.referral_parent_id,
    stripe_customer_id: row.stripe_customer_id,
    metadata: meta,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = {
  createCustomer,
  getCustomer,
  listCustomers,
};
