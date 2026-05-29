import express from 'express';
import cors from 'cors';
import pg from 'pg';
import amqp from 'amqplib';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());

// Downstream internal API mappings
const CUSTOMER_SERVICE = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:8002';
const FRAUD_SERVICE = process.env.FRAUD_SERVICE_URL || 'http://localhost:8005';
const LEDGER_SERVICE = process.env.LEDGER_SERVICE_URL || 'http://localhost:8004';

// In-Memory Database Fallback Store
const MEMORY_TRANSACTIONS = [];

// Fee rates by Tenant Tier
const TIER_FEES = {
  free: 0.020,        // 2.0%
  pro: 0.015,         // 1.5%
  enterprise: 0.005   // 0.5%
};

// Database Pool Configuration
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'archisynapse',
  password: process.env.DB_PASSWORD || 'secretpassword',
  database: process.env.DB_NAME || 'archisynapse_db',
  port: 5432,
});

let useDbFallback = false;
pool.on('error', (err) => {
  console.warn('Postgres Transaction DB Error - enabling in-memory fallback');
  useDbFallback = true;
});

// Test connection
try {
  const client = await pool.connect();
  console.log('Transaction Service successfully connected to Postgres database');
  client.release();
} catch (e) {
  console.warn('Postgres database unreachable. Transaction Service falling back to in-memory store.');
  useDbFallback = true;
}

// RabbitMQ Connection Configuration
let rabbitChannel;
let useRabbitFallback = false;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange('payment_events', 'topic', { durable: true });
    console.log('Transaction Service connected to RabbitMQ broker');
  } catch (err) {
    console.warn('RabbitMQ unreachable. Transaction Service will run in resilient local mode.');
    useRabbitFallback = true;
  }
}
connectRabbitMQ();

// Helper: Publish Event
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

// 1. Create Transaction (Charge a customer card)
app.post('/transactions', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  const tenantTier = req.headers['x-tenant-tier'] || 'free';

  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context headers.' });
  }

  const { customer_id, amount, currency = 'USD' } = req.body;
  if (!customer_id || !amount) {
    return res.status(400).json({ error: 'Bad Request', message: 'customer_id and amount are required.' });
  }

  const txnId = `txn_${crypto.randomBytes(4).toString('hex')}`;

  try {
    // A. Fetch Customer details from Customer Service
    let customer;
    try {
      const custResponse = await fetch(`${CUSTOMER_SERVICE}/customers/${customer_id}`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      if (!custResponse.ok) {
        return res.status(400).json({ error: 'Bad Request', message: `Customer ${customer_id} does not exist.` });
      }
      customer = await custResponse.json();
    } catch (err) {
      console.warn('Unable to query Customer Service. Utilizing local seed mock fallback customer.');
      customer = {
        id: customer_id,
        name: 'Fallback Acme Account',
        payment_method_token: 'tok_visa_debit_4242'
      };
    }

    const token = customer.payment_method_token || 'tok_visa_debit_4242';

    // B. Perform ML Fraud Check
    let fraudResult = { fraud_score: 0.0, decision: 'APPROVE' };
    try {
      const fraudResponse = await fetch(`${FRAUD_SERVICE}/fraud/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txnId,
          customer_id,
          amount: parseInt(amount),
          currency,
          payment_method_token: token
        })
      });
      if (fraudResponse.ok) {
        fraudResult = await fraudResponse.json();
      }
    } catch (err) {
      // Offline fallback: simulate fraud checks directly
      if (token && (token.includes('fraud_trigger') || token.includes('bad_card'))) {
        fraudResult = { fraud_score: 0.99, decision: 'BLOCK' };
      } else if (amount === 99999) {
        fraudResult = { fraud_score: 0.95, decision: 'BLOCK' };
      }
    }

    // Check if fraud score indicates blocking
    if (fraudResult.decision === 'BLOCK') {
      const failedTxn = {
        id: txnId,
        tenant_id: tenantId,
        customer_id,
        amount: parseInt(amount),
        currency,
        status: 'failed',
        fraud_score: fraudResult.fraud_score,
        created_at: new Date().toISOString()
      };

      if (useDbFallback) {
        MEMORY_TRANSACTIONS.push(failedTxn);
      } else {
        try {
          const insertQuery = `
            INSERT INTO transactions (id, tenant_id, customer_id, amount, currency, status, fraud_score)
            VALUES ($1, $2, $3, $4, $5, 'failed', $6)
          `;
          await pool.query(insertQuery, [txnId, tenantId, customer_id, amount, currency, fraudResult.fraud_score]);
        } catch (e) {
          MEMORY_TRANSACTIONS.push(failedTxn);
        }
      }

      await publishEvent('transaction.failed', {
        event: 'transaction.failed',
        reason: 'blocked_by_fraud_engine',
        transaction: failedTxn
      });

      return res.status(403).json({
        error: 'Declined',
        message: 'Transaction declined due to suspicious activity.',
        transaction: failedTxn
      });
    }

    // C. Simulate Bank Gateway Settlement (98% success, fail-control options)
    let gatewaySuccess = true;
    if (token === 'tok_fail_card' || customer.name === 'Fail Account' || customer_id === 'cust_failed') {
      gatewaySuccess = false;
    } else {
      gatewaySuccess = Math.random() > 0.02;
    }

    if (!gatewaySuccess) {
      const failedTxn = {
        id: txnId,
        tenant_id: tenantId,
        customer_id,
        amount: parseInt(amount),
        currency,
        status: 'failed',
        fraud_score: fraudResult.fraud_score,
        created_at: new Date().toISOString()
      };

      if (useDbFallback) {
        MEMORY_TRANSACTIONS.push(failedTxn);
      } else {
        try {
          const insertQuery = `
            INSERT INTO transactions (id, tenant_id, customer_id, amount, currency, status, fraud_score)
            VALUES ($1, $2, $3, $4, $5, 'failed', $6)
          `;
          await pool.query(insertQuery, [txnId, tenantId, customer_id, amount, currency, fraudResult.fraud_score]);
        } catch (e) {
          MEMORY_TRANSACTIONS.push(failedTxn);
        }
      }

      await publishEvent('transaction.failed', {
        event: 'transaction.failed',
        reason: 'processor_decline',
        transaction: failedTxn
      });

      return res.status(402).json({
        error: 'Payment Required',
        message: 'The card was declined by the bank gateway.',
        transaction: failedTxn
      });
    }

    // D. Transaction Succeeded
    const successfulTxn = {
      id: txnId,
      tenant_id: tenantId,
      customer_id,
      amount: parseInt(amount),
      currency,
      status: 'succeeded',
      fraud_score: fraudResult.fraud_score,
      created_at: new Date().toISOString()
    };

    if (useDbFallback) {
      MEMORY_TRANSACTIONS.push(successfulTxn);
    } else {
      try {
        const insertQuery = `
          INSERT INTO transactions (id, tenant_id, customer_id, amount, currency, status, fraud_score)
          VALUES ($1, $2, $3, $4, $5, 'succeeded', $6)
        `;
        await pool.query(insertQuery, [txnId, tenantId, customer_id, amount, currency, fraudResult.fraud_score]);
      } catch (e) {
        MEMORY_TRANSACTIONS.push(successfulTxn);
      }
    }

    // Compute Fees
    const feeRate = TIER_FEES[tenantTier] || TIER_FEES.free;
    const feeAmount = Math.round(amount * feeRate);
    const netAmount = amount - feeAmount;

    // Record in Ledger Service
    try {
      await fetch(`${LEDGER_SERVICE}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txnId,
          debit_account_id: 'bank_holding',
          credit_account_id: 'merchant_settlement',
          amount: netAmount,
          currency
        })
      });

      if (feeAmount > 0) {
        await fetch(`${LEDGER_SERVICE}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: txnId,
            debit_account_id: 'bank_holding',
            credit_account_id: 'processing_revenue',
            amount: feeAmount,
            currency
          })
        });
      }
    } catch (err) {
      console.warn('Unable to log to Ledger Service directly. Running offline simulation.');
    }

    // Publish Success Event
    await publishEvent('transaction.succeeded', {
      event: 'transaction.succeeded',
      transaction: successfulTxn,
      fee_charged: feeAmount,
      net_amount: netAmount
    });

    res.status(201).json(successfulTxn);
  } catch (err) {
    console.error('Error handling transaction', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process transaction.' });
  }
});

// 2. Get Transaction
app.get('/transactions/:transaction_id', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  const { transaction_id } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context headers.' });
  }

  if (useDbFallback) {
    const txn = MEMORY_TRANSACTIONS.find(t => t.id === transaction_id && t.tenant_id === tenantId);
    if (!txn) {
      return res.status(404).json({ error: 'Not Found', message: `Transaction ${transaction_id} not found.` });
    }
    return res.json(txn);
  }

  try {
    const query = 'SELECT * FROM transactions WHERE id = $1 AND tenant_id = $2';
    const result = await pool.query(query, [transaction_id, tenantId]);

    if (result.rows.length === 0) {
      const txn = MEMORY_TRANSACTIONS.find(t => t.id === transaction_id && t.tenant_id === tenantId);
      if (txn) return res.json(txn);

      return res.status(404).json({ error: 'Not Found', message: `Transaction with ID ${transaction_id} not found.` });
    }

    res.json(result.rows[0]);
  } catch (err) {
    useDbFallback = true;
    const txn = MEMORY_TRANSACTIONS.find(t => t.id === transaction_id && t.tenant_id === tenantId);
    if (!txn) {
      return res.status(404).json({ error: 'Not Found', message: `Transaction ${transaction_id} not found.` });
    }
    res.json(txn);
  }
});

// 3. List Transactions
app.get('/transactions', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context headers.' });
  }

  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  if (useDbFallback) {
    const tenantTxns = MEMORY_TRANSACTIONS.filter(t => t.tenant_id === tenantId && (!status || t.status === status));
    const sorted = [...tenantTxns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const slice = sorted.slice(offset, offset + limit);

    return res.json({
      data: slice,
      limit,
      offset,
      total: tenantTxns.length
    });
  }

  try {
    let query = 'SELECT * FROM transactions WHERE tenant_id = $1';
    const params = [tenantId];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    const countParams = [...params];
    const countQuery = `SELECT COUNT(*) FROM (${query}) as sub`;

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      data: dataRes.rows,
      limit,
      offset,
      total: parseInt(countRes.rows[0].count)
    });
  } catch (err) {
    useDbFallback = true;
    const tenantTxns = MEMORY_TRANSACTIONS.filter(t => t.tenant_id === tenantId && (!status || t.status === status));
    const slice = tenantTxns.slice(offset, offset + limit);

    res.json({
      data: slice,
      limit,
      offset,
      total: tenantTxns.length
    });
  }
});

// 4. Refund Transaction
app.post('/transactions/:transaction_id/refunds', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'];
  const tenantTier = req.headers['x-tenant-tier'] || 'free';
  const { transaction_id } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing tenant context headers.' });
  }

  if (useDbFallback) {
    const txn = MEMORY_TRANSACTIONS.find(t => t.id === transaction_id && t.tenant_id === tenantId);
    if (!txn) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found.' });
    }
    if (txn.status !== 'succeeded') {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot refund transaction with status '${txn.status}'.` });
    }

    txn.status = 'refunded';

    const feeRate = TIER_FEES[tenantTier] || TIER_FEES.free;
    const feeAmount = Math.round(txn.amount * feeRate);
    const netAmount = txn.amount - feeAmount;

    // Log Ledger Reversals
    try {
      await fetch(`${LEDGER_SERVICE}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id,
          debit_account_id: 'merchant_settlement',
          credit_account_id: 'bank_holding',
          amount: netAmount,
          currency: txn.currency
        })
      });

      if (feeAmount > 0) {
        await fetch(`${LEDGER_SERVICE}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id,
            debit_account_id: 'processing_revenue',
            credit_account_id: 'bank_holding',
            amount: feeAmount,
            currency: txn.currency
          })
        });
      }
    } catch (e) {}

    await publishEvent('transaction.refunded', {
      event: 'transaction.refunded',
      original_transaction: { ...txn, status: 'succeeded' },
      refunded_transaction: txn
    });

    return res.json(txn);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const originalRes = await client.query('SELECT * FROM transactions WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [transaction_id, tenantId]);
    if (originalRes.rows.length === 0) {
      client.release();
      useDbFallback = true;
      return res.redirect(307, `/transactions/${transaction_id}/refunds`);
    }

    const originalTx = originalRes.rows[0];
    if (originalTx.status !== 'succeeded') {
      return res.status(400).json({ error: 'Bad Request', message: `Cannot refund transaction with status '${originalTx.status}'.` });
    }

    const updateRes = await client.query("UPDATE transactions SET status = 'refunded' WHERE id = $1 RETURNING *", [transaction_id]);
    const updatedTx = updateRes.rows[0];

    const feeRate = TIER_FEES[tenantTier] || TIER_FEES.free;
    const feeAmount = Math.round(originalTx.amount * feeRate);
    const netAmount = originalTx.amount - feeAmount;

    try {
      await fetch(`${LEDGER_SERVICE}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id,
          debit_account_id: 'merchant_settlement',
          credit_account_id: 'bank_holding',
          amount: netAmount,
          currency: originalTx.currency
        })
      });

      if (feeAmount > 0) {
        await fetch(`${LEDGER_SERVICE}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id,
            debit_account_id: 'processing_revenue',
            credit_account_id: 'bank_holding',
            amount: feeAmount,
            currency: originalTx.currency
          })
        });
      }
    } catch (err) {}

    await client.query('COMMIT');

    await publishEvent('transaction.refunded', {
      event: 'transaction.refunded',
      original_transaction: originalTx,
      refunded_transaction: updatedTx
    });

    res.json(updatedTx);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refund transaction failed', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process refund.' });
  } finally {
    client.release();
  }
});

// Direct internal list-by-in-memory accessor for other services (Ledger/Analytics fallbacks)
app.get('/internal/transactions', (req, res) => {
  res.json(MEMORY_TRANSACTIONS);
});

app.listen(PORT, () => {
  console.log(`Transaction Service running on port ${PORT} (Resilient Local Mode enabled)`);
});
