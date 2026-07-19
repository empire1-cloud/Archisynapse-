const request = require('supertest');
const app = require('../index');
const db = require('../db');

const VALID_API_KEY = 'sk_test_123456789';
const ORG_ID = 'org_demo';

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.destroy();
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should return ready status', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(true);
  });
});

describe('Transactions', () => {
  it('should create a transaction', async () => {
    const response = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${VALID_API_KEY}`)
      .set('X-Organization-ID', ORG_ID)
      .send({
        amount: 1000,
        currency: 'USD',
        idempotencyKey: 'idem_api_test_payment',
        payment_method: {
          type: 'CARD',
          token: 'tok_visa'
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toMatch(/^txn_/);
  });

  it('should fail without API key', async () => {
    const response = await request(app)
      .post('/api/v1/transactions')
      .send({
        amount: 1000,
        currency: 'USD',
        idempotencyKey: 'idem_api_test_missing_key',
        payment_method: {
          type: 'CARD',
          token: 'tok_visa'
        }
      });

    expect(response.status).toBe(401);
  });
});

describe('Customers', () => {
  it('should create a customer', async () => {
    const response = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${VALID_API_KEY}`)
      .set('X-Organization-ID', ORG_ID)
      .send({
        email: 'customer@example.com',
        name: 'John Doe'
      });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('customer@example.com');
  });
});

describe('Risk', () => {
  it('should evaluate royalty payout risk', async () => {
    const response = await request(app)
      .post('/api/v1/risk/royalty')
      .set('Authorization', `Bearer ${VALID_API_KEY}`)
      .set('X-Organization-ID', ORG_ID)
      .set('Idempotency-Key', `risk_api_${Date.now()}`)
      .send({
        amount: 4999,
        currency: 'USD',
        creatorId: 'creator-alpha',
        trackId: 'track-001',
        payoutDestination: 'acct_royalty_001',
        dnaVerified: false,
        soulprintVerified: false,
        ledgerRecordFound: false,
        creatorAccountAgeDays: 1,
        payoutMethodAgeDays: 0,
        suddenUsageSpike: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.risk_score).toBeGreaterThanOrEqual(85);
    expect(response.body.decision).toBe('block_payout');
    expect(response.body.reasons).toContain('dna_not_verified');
  });
});
