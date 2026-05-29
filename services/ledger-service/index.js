import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8004;

app.use(cors());
app.use(express.json());

// In-Memory Database Fallback Store
const MEMORY_ACCOUNTS = [
  { id: 'bank_holding', name: 'Archisynapse Bank Clearing Account', type: 'asset' },
  { id: 'merchant_settlement', name: 'Merchant Settlement Balance', type: 'liability' },
  { id: 'processing_revenue', name: 'Archisynapse Card Processing Revenue', type: 'revenue' },
  { id: 'cash_reserve', name: 'Archisynapse Cash Reserves', type: 'asset' }
];
const MEMORY_ENTRIES = [];

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
  console.warn('Postgres Ledger DB Error - enabling in-memory fallback');
  useDbFallback = true;
});

// Test connection
try {
  const client = await pool.connect();
  console.log('Ledger Service successfully connected to Postgres database');
  client.release();
} catch (e) {
  console.warn('Postgres database unreachable. Ledger Service falling back to in-memory store.');
  useDbFallback = true;
}

// 1. Record a Double-Entry Ledger Entry
app.post('/entries', async (req, res) => {
  const { transaction_id, debit_account_id, credit_account_id, amount, currency } = req.body;

  if (!debit_account_id || !credit_account_id || !amount || !currency) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'debit_account_id, credit_account_id, amount, and currency are required fields.'
    });
  }

  // Check In-Memory fallback mode
  if (useDbFallback) {
    const debitAcc = MEMORY_ACCOUNTS.find(a => a.id === debit_account_id);
    if (!debitAcc) {
      return res.status(400).json({ error: 'Ledger Error', message: `Debit account '${debit_account_id}' does not exist.` });
    }

    const creditAcc = MEMORY_ACCOUNTS.find(a => a.id === credit_account_id);
    if (!creditAcc) {
      return res.status(400).json({ error: 'Ledger Error', message: `Credit account '${credit_account_id}' does not exist.` });
    }

    const newEntry = {
      id: MEMORY_ENTRIES.length + 1,
      transaction_id: transaction_id || null,
      debit_account_id,
      credit_account_id,
      amount: parseInt(amount),
      currency,
      created_at: new Date().toISOString()
    };
    MEMORY_ENTRIES.push(newEntry);
    console.log(`[Offline Ledger Entry] Recorded Debit: ${debit_account_id}, Credit: ${credit_account_id}, Amount: ${amount}`);
    return res.status(201).json(newEntry);
  }

  // Postgres Database Path
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify debit account exists
    const debitAccRes = await client.query('SELECT id FROM ledger_accounts WHERE id = $1', [debit_account_id]);
    if (debitAccRes.rows.length === 0) {
      throw new Error(`Debit account '${debit_account_id}' does not exist.`);
    }

    // Verify credit account exists
    const creditAccRes = await client.query('SELECT id FROM ledger_accounts WHERE id = $1', [credit_account_id]);
    if (creditAccRes.rows.length === 0) {
      throw new Error(`Credit account '${credit_account_id}' does not exist.`);
    }

    // Insert Entry
    const insertQuery = `
      INSERT INTO ledger_entries (transaction_id, debit_account_id, credit_account_id, amount, currency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, transaction_id, debit_account_id, credit_account_id, amount, currency, created_at
    `;
    const insertRes = await client.query(insertQuery, [transaction_id || null, debit_account_id, credit_account_id, amount, currency]);

    await client.query('COMMIT');
    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.warn('Database write failed, falling back to in-memory ledger recording');
    useDbFallback = true;
    
    // Process in-memory retry
    const newEntry = {
      id: MEMORY_ENTRIES.length + 1,
      transaction_id: transaction_id || null,
      debit_account_id,
      credit_account_id,
      amount: parseInt(amount),
      currency,
      created_at: new Date().toISOString()
    };
    MEMORY_ENTRIES.push(newEntry);
    res.status(201).json(newEntry);
  } finally {
    client.release();
  }
});

// 2. Get Ledger Accounts & Balances
app.get('/accounts', async (req, res) => {
  if (useDbFallback) {
    const data = MEMORY_ACCOUNTS.map(acc => {
      let totalDebit = 0;
      let totalCredit = 0;

      MEMORY_ENTRIES.forEach(entry => {
        if (entry.debit_account_id === acc.id) totalDebit += entry.amount;
        if (entry.credit_account_id === acc.id) totalCredit += entry.amount;
      });

      let balance = 0;
      if (acc.type === 'asset' || acc.type === 'expense') {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        debit: totalDebit,
        credit: totalCredit,
        balance
      };
    });
    return res.json(data);
  }

  try {
    const query = `
      SELECT 
        la.id, 
        la.name, 
        la.type,
        COALESCE(d.total_debit, 0) as total_debit,
        COALESCE(c.total_credit, 0) as total_credit
      FROM ledger_accounts la
      LEFT JOIN (
        SELECT debit_account_id, SUM(amount) as total_debit 
        FROM ledger_entries 
        GROUP BY debit_account_id
      ) d ON la.id = d.debit_account_id
      LEFT JOIN (
        SELECT credit_account_id, SUM(amount) as total_credit 
        FROM ledger_entries 
        GROUP BY credit_account_id
      ) c ON la.id = c.credit_account_id
    `;
    
    const result = await pool.query(query);
    const data = result.rows.map(acc => {
      const debit = parseInt(acc.total_debit);
      const credit = parseInt(acc.total_credit);
      let balance = 0;
      
      if (acc.type === 'asset' || acc.type === 'expense') {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        debit,
        credit,
        balance
      };
    });

    res.json(data);
  } catch (err) {
    console.warn('Database connection failed, reporting from in-memory cache.');
    useDbFallback = true;
    res.redirect('/accounts');
  }
});

// 3. Comprehensive Ledger Audit (Double Entry Assertions)
app.get('/audit', async (req, res) => {
  if (useDbFallback) {
    let totalAssetExpense = 0;
    let totalLiabilityEquityRevenue = 0;
    let sumDebits = 0;
    let sumCredits = 0;

    const accountAudits = MEMORY_ACCOUNTS.map(acc => {
      let debit = 0;
      let credit = 0;

      MEMORY_ENTRIES.forEach(entry => {
        if (entry.debit_account_id === acc.id) debit += entry.amount;
        if (entry.credit_account_id === acc.id) credit += entry.amount;
      });

      sumDebits += debit;
      sumCredits += credit;

      let balance = 0;
      if (acc.type === 'asset' || acc.type === 'expense') {
        balance = debit - credit;
        totalAssetExpense += balance;
      } else {
        balance = credit - debit;
        totalLiabilityEquityRevenue += balance;
      }

      return {
        id: acc.id,
        type: acc.type,
        debit,
        credit,
        balance
      };
    });

    const isBalanced = sumDebits === sumCredits && totalAssetExpense === totalLiabilityEquityRevenue;

    return res.json({
      audit_passed: isBalanced,
      total_debit_journal_sum: sumDebits,
      total_credit_journal_sum: sumCredits,
      accounting_equation: {
        assets_plus_expenses: totalAssetExpense,
        liabilities_plus_equity_plus_revenue: totalLiabilityEquityRevenue,
        difference: Math.abs(totalAssetExpense - totalLiabilityEquityRevenue)
      },
      accounts: accountAudits,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const query = `
      SELECT 
        la.id, 
        la.type,
        COALESCE(d.total_debit, 0) as total_debit,
        COALESCE(c.total_credit, 0) as total_credit
      FROM ledger_accounts la
      LEFT JOIN (
        SELECT debit_account_id, SUM(amount) as total_debit 
        FROM ledger_entries 
        GROUP BY debit_account_id
      ) d ON la.id = d.debit_account_id
      LEFT JOIN (
        SELECT credit_account_id, SUM(amount) as total_credit 
        FROM ledger_entries 
        GROUP BY credit_account_id
      ) c ON la.id = c.credit_account_id
    `;
    
    const result = await pool.query(query);

    let totalAssetExpense = 0;
    let totalLiabilityEquityRevenue = 0;
    let sumDebits = 0;
    let sumCredits = 0;

    const accountAudits = result.rows.map(acc => {
      const debit = parseInt(acc.total_debit);
      const credit = parseInt(acc.total_credit);
      sumDebits += debit;
      sumCredits += credit;

      let balance = 0;
      if (acc.type === 'asset' || acc.type === 'expense') {
        balance = debit - credit;
        totalAssetExpense += balance;
      } else {
        balance = credit - debit;
        totalLiabilityEquityRevenue += balance;
      }

      return {
        id: acc.id,
        type: acc.type,
        debit,
        credit,
        balance
      };
    });

    const isBalanced = sumDebits === sumCredits && totalAssetExpense === totalLiabilityEquityRevenue;

    res.json({
      audit_passed: isBalanced,
      total_debit_journal_sum: sumDebits,
      total_credit_journal_sum: sumCredits,
      accounting_equation: {
        assets_plus_expenses: totalAssetExpense,
        liabilities_plus_equity_plus_revenue: totalLiabilityEquityRevenue,
        difference: Math.abs(totalAssetExpense - totalLiabilityEquityRevenue)
      },
      accounts: accountAudits,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Database connection failed, running in-memory audit.');
    useDbFallback = true;
    res.redirect('/audit');
  }
});

app.listen(PORT, () => {
  console.log(`Ledger Service running on port ${PORT} (Resilient Local Mode enabled)`);
});
