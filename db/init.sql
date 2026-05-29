-- Archisynapse PostgreSQL Database Schema Initialization

-- Drop tables if they exist (clean setup)
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS ledger_accounts CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- 1. Tenants Table
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    payment_method_token VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transactions Table
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    fraud_score REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Payouts Table
CREATE TABLE payouts (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Amount in cents
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Ledger Accounts Table (Double-entry bookkeeping accounts)
CREATE TABLE ledger_accounts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense'))
);

-- 6. Ledger Entries Table (Journal entries recording double-entry debit & credit)
CREATE TABLE ledger_entries (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) REFERENCES transactions(id) ON DELETE SET NULL,
    debit_account_id VARCHAR(50) REFERENCES ledger_accounts(id),
    credit_account_id VARCHAR(50) REFERENCES ledger_accounts(id),
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --- SEED DATA ---

-- Seed default ledger accounts
INSERT INTO ledger_accounts (id, name, type) VALUES
('bank_holding', 'Archisynapse Bank Clearing Account', 'asset'),
('merchant_settlement', 'Merchant Settlement Balance', 'liability'),
('processing_revenue', 'Archisynapse Card Processing Revenue', 'revenue'),
('cash_reserve', 'Archisynapse Cash Reserves', 'asset');

-- Seed a test tenant
INSERT INTO tenants (id, name, api_key, tier) VALUES
('tenant_acme_101', 'Acme E-Commerce', 'sk_test_archisynapse_12345', 'pro'),
('tenant_free_99', 'Free Garage Shop', 'sk_test_free_key_54321', 'free'),
('tenant_enterprise_777', 'MegaCorp Global', 'sk_test_enterprise_99999', 'enterprise');

-- Seed a dummy customer for testing
INSERT INTO customers (id, tenant_id, name, email, payment_method_token) VALUES
('cust_john_doe_01', 'tenant_acme_101', 'John Doe', 'john.doe@example.com', 'tok_visa_debit_4242');
