const transactionService = require('../services/transactionService');
const customerService = require('../services/customerService');
const payoutService = require('../services/payoutService');

describe('Transaction Service', () => {
  it('should create a transaction', async () => {
    const txn = await transactionService.createTransaction({
      amount: 1000,
      currency: 'USD',
      payment_method: { type: 'card' }
    });
    expect(txn.id).toMatch(/^txn_/);
    expect(txn.status).toBe('succeeded');
    expect(txn.amount).toBe(1000);
  });

  it('should get a transaction by id', async () => {
    const txn = await transactionService.createTransaction({
      amount: 500,
      currency: 'EUR',
      payment_method: { type: 'card' }
    });
    const found = await transactionService.getTransaction(txn.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(txn.id);
  });

  it('should return null for non-existent transaction', async () => {
    const found = await transactionService.getTransaction('nonexistent');
    expect(found).toBeNull();
  });

  it('should list transactions with pagination', async () => {
    const result = await transactionService.listTransactions({ limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(parseInt(result.limit)).toBe(10);
  });

  it('should refund a transaction', async () => {
    const txn = await transactionService.createTransaction({
      amount: 2000,
      currency: 'USD',
      payment_method: { type: 'card' }
    });
    const refund = await transactionService.refundTransaction({
      transactionId: txn.id
    });
    expect(refund).toHaveProperty('id');
    expect(refund.amount).toBe(2000);
    expect(refund.status).toBe('succeeded');
  });

  it('should reject refund of non-existent transaction', async () => {
    await expect(
      transactionService.refundTransaction({ transactionId: 'nonexistent' })
    ).rejects.toThrow('Transaction not found');
  });
});

describe('Customer Service', () => {
  it('should create a customer', async () => {
    const customer = await customerService.createCustomer({
      email: 'test@example.com',
      name: 'John Doe'
    });
    expect(customer.id).toMatch(/^cus_/);
    expect(customer.email).toBe('test@example.com');
    expect(customer.name).toBe('John Doe');
  });

  it('should get a customer by id', async () => {
    const c = await customerService.createCustomer({
      email: 'jane@example.com',
      name: 'Jane Doe'
    });
    const found = await customerService.getCustomer(c.id);
    expect(found).not.toBeNull();
    expect(found.email).toBe('jane@example.com');
  });

  it('should return null for non-existent customer', async () => {
    const found = await customerService.getCustomer('nonexistent');
    expect(found).toBeNull();
  });

  it('should list customers with pagination', async () => {
    const result = await customerService.listCustomers({ limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(parseInt(result.limit)).toBe(10);
  });
});

describe('Payout Service', () => {
  it('should list payouts with default params', async () => {
    const result = await payoutService.listPayouts();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter payouts by status', async () => {
    const result = await payoutService.listPayouts({ status: 'completed' });
    result.data.forEach(p => {
      expect(p.status).toBe('completed');
    });
  });
});
