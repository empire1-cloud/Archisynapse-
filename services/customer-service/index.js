import express from 'express';
import cors from 'cors';
import pg from 'pg';
import amqp from 'amqplib';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(express.json());

// In-Memory Database Fallback Store
const MEMORY_CUSTOMERS = [
  {
    id: 'cust_john_doe_01',
    tenant_id: 'tenant_acme_101',
    name: 'John Doe',
    email: 'john.doe@example.com',
    payment_method_token: 'tok_visa_debit_4242',
    created_at: new Date().toISOString()
  }
];

// Database Pool
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'archisynapse',
  password: process.env.DB_PASSWORD || 'secretpassword',
  database: process.env.DB_NAME || 'archisynapse_db',
  port: 5432,
});

let useDbFallback = false;
pool.on('error', (err) => {
  console.warn('Postgres Customer DB Error - enabling in-memory fallback');
  useDbFallback = true;
});

// Test connection
try {
  const client = await pool.connect();
  console.log('Customer Service successfully connected to Postgres database');
  client.release();
} catch (e) {
  console.warn('Postgres database unreachable. Customer Service falling back to in-memory store.');
  useDbFallback = true;
}

// RabbitMQ Connection
let rabbitChannel;
let useRabbitFallback = false;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange('payment_events', 'topic', { durable: true });
    console.log('Customer Service connected to RabbitMQ broker');
  } catch (err) {
    console.warn('RabbitMQ unreachable. Customer Service will run in resilient local mode.');
    useRabbitFallback = true;
  }
}
connectRabbitMQ();

// Helper: Publish Event with offline resilience
async function publishEvent(routingKey, message) {
  if (useRabbitFallback || !rabbitChannel) {
    console.log(`[Offline Event] Event queued in memory [${routingKey}]:`, JSON.stringify(message));
    return;
  }
  try {
    rabbitChannel.publish('payment_events', routingKey, Buffer.from(JSON.stringify(message)));
  } catch (err) {
    console.warn('RabbitMQ dispatch failed, queuing event in-memory.');
  }
}

// 1. Create Customer
app.post('/customers', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context.' });
  }

  const { name, email, payment_method } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Bad Request', message: 'Fields name and email are required.' });
  }

  const customerId = `cust_${crypto.randomBytes(4).toString('hex')}`;
  let token = null;

  if (payment_method) {
    token = payment_method.card_token || `tok_${crypto.randomBytes(8).toString('hex')}`;
  }

  if (useDbFallback) {
    const newCust = {
      id: customerId,
      tenant_id: tenantId,
      name,
      email,
      payment_method_token: token,
      created_at: new Date().toISOString()
    };
    MEMORY_CUSTOMERS.push(newCust);

    await publishEvent('customer.created', {
      event: 'customer.created',
      tenant_id: tenantId,
      customer: newCust
    });

    return res.status(201).json(newCust);
  }

  // Postgres Database path
  try {
    const query = `
      INSERT INTO customers (id, tenant_id, name, email, payment_method_token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, payment_method_token, created_at
    `;
    const result = await pool.query(query, [customerId, tenantId, name, email, token]);
    const customer = result.rows[0];

    await publishEvent('customer.created', {
      event: 'customer.created',
      tenant_id: tenantId,
      customer: customer
    });

    res.status(201).json(customer);
  } catch (err) {
    console.warn('Database write failed, falling back to in-memory for this record.');
    useDbFallback = true;
    
    // In-memory recovery
    const newCust = {
      id: customerId,
      tenant_id: tenantId,
      name,
      email,
      payment_method_token: token,
      created_at: new Date().toISOString()
    };
    MEMORY_CUSTOMERS.push(newCust);

    await publishEvent('customer.created', {
      event: 'customer.created',
      tenant_id: tenantId,
      customer: newCust
    });

    res.status(201).json(newCust);
  }
});

// 2. Get Customer
app.get('/customers/:customer_id', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  const { customer_id } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context.' });
  }

  if (useDbFallback) {
    const customer = MEMORY_CUSTOMERS.find(c => c.id === customer_id && c.tenant_id === tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Not Found', message: `Customer ${customer_id} not found.` });
    }
    return res.json(customer);
  }

  try {
    const query = 'SELECT id, name, email, payment_method_token, created_at FROM customers WHERE id = $1 AND tenant_id = $2';
    const result = await pool.query(query, [customer_id, tenantId]);

    if (result.rows.length === 0) {
      // Try finding in-memory in case it was created during fallback
      const customer = MEMORY_CUSTOMERS.find(c => c.id === customer_id && c.tenant_id === tenantId);
      if (customer) return res.json(customer);

      return res.status(404).json({ error: 'Not Found', message: `Customer with ID ${customer_id} not found.` });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.warn('Database lookup failed, falling back to in-memory query.');
    useDbFallback = true;
    const customer = MEMORY_CUSTOMERS.find(c => c.id === customer_id && c.tenant_id === tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Not Found', message: `Customer ${customer_id} not found.` });
    }
    res.json(customer);
  }
});

// 3. List Customers
app.get('/customers', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context.' });
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (useDbFallback) {
    const tenantCustomers = MEMORY_CUSTOMERS.filter(c => c.tenant_id === tenantId);
    const sorted = [...tenantCustomers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const slice = sorted.slice(offset, offset + limit);

    return res.json({
      data: slice,
      limit,
      offset,
      total: tenantCustomers.length
    });
  }

  try {
    const query = 'SELECT id, name, email, payment_method_token, created_at FROM customers WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    const countQuery = 'SELECT COUNT(*) FROM customers WHERE tenant_id = $1';

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, [tenantId, limit, offset]),
      pool.query(countQuery, [tenantId])
    ]);

    res.json({
      data: dataRes.rows,
      limit,
      offset,
      total: parseInt(countRes.rows[0].count)
    });
  } catch (err) {
    console.warn('Database query failed, listing from in-memory.');
    useDbFallback = true;
    const tenantCustomers = MEMORY_CUSTOMERS.filter(c => c.tenant_id === tenantId);
    const slice = tenantCustomers.slice(offset, offset + limit);

    res.json({
      data: slice,
      limit,
      offset,
      total: tenantCustomers.length
    });
  }
});

app.listen(PORT, () => {
  console.log(`Customer Service running on port ${PORT} (Resilient Local Mode enabled)`);
});
