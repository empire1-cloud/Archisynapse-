const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const customers = new Map();

const createCustomer = async ({ email, name, phone, metadata } = {}) => {
  const id = 'cus_' + uuidv4().replace(/-/g, '').slice(0, 12);
  const customer = {
    id,
    email,
    name,
    phone: phone || null,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  customers.set(id, customer);
  logger.info('Customer created', { customerId: id, email });
  return customer;
};

const getCustomer = async (id) => {
  return customers.get(id) || null;
};

const listCustomers = async ({ limit = 20, offset = 0 } = {}) => {
  const all = Array.from(customers.values())
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const paginated = all.slice(offset, offset + limit);
  return {
    data: paginated,
    total: all.length,
    limit: Math.min(parseInt(limit), 100),
    offset: parseInt(offset)
  };
};

module.exports = {
  createCustomer,
  getCustomer,
  listCustomers
};
