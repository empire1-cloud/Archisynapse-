const request = require('supertest');
const app = require('../index');
const db = require('../db');

const VALID_KEY = 'sk_test_123456789';
const ORG_ID = 'org_demo';

describe('Payout Service', () => {
  let recipientAccountId;

  beforeAll(async () => {
    await db.migrate.latest();
    await db('payouts').del();
    await db('recipient_accounts').del();
  });

  describe('Recipient Accounts', () => {
    it('should register a recipient account', async () => {
      const res = await request(app)
        .post('/api/v1/payouts/accounts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ recipientId: `creator_${Date.now()}`, processorAccountId: 'acct_stripe_123' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING_VERIFICATION');
      recipientAccountId = res.body.id;
    });

    it('should list recipient accounts', async () => {
      const res = await request(app)
        .get('/api/v1/payouts/accounts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should get a single recipient account', async () => {
      const res = await request(app)
        .get(`/api/v1/payouts/accounts/${recipientAccountId}`)
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(recipientAccountId);
    });

    it('should verify a recipient account', async () => {
      const res = await request(app)
        .post(`/api/v1/payouts/accounts/${recipientAccountId}/verify`)
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VERIFIED');
    });

    it('should fail to register without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/payouts/accounts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ recipientId: 'creator_bad' });

      expect(res.status).toBe(400);
    });
  });

  describe('Payouts', () => {
    let payoutId;

    it('should create a payout', async () => {
      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({
          recipientAccountId,
          amount: 50.00,
          idempotencyKey: `idem_payout_${Date.now()}`,
          sourceType: 'EARNINGS',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(['PAID', 'PENDING']).toContain(res.body.status);
      payoutId = res.body.id;
    });

    it('should return the same payout on idempotent retry', async () => {
      const key = `idem_payout_dup_${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ recipientAccountId, amount: 25.00, idempotencyKey: key, sourceType: 'MANUAL' });

      const second = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ recipientAccountId, amount: 25.00, idempotencyKey: key, sourceType: 'MANUAL' });

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
    });

    it('should list payouts', async () => {
      const res = await request(app)
        .get('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should get a single payout', async () => {
      const res = await request(app)
        .get(`/api/v1/payouts/${payoutId}`)
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(payoutId);
    });

    it('should fail to create payout to unverified account', async () => {
      const unverified = await request(app)
        .post('/api/v1/payouts/accounts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ recipientId: `creator_unverified_${Date.now()}`, processorAccountId: 'acct_unverified' });

      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({
          recipientAccountId: unverified.body.id,
          amount: 10.00,
          idempotencyKey: `idem_payout_unverified_${Date.now()}`,
          sourceType: 'MANUAL',
        });

      expect(res.status).toBe(500);
    });

    it('should fail without auth', async () => {
      const res = await request(app).get('/api/v1/payouts');
      expect(res.status).toBe(401);
    });
  });
});
