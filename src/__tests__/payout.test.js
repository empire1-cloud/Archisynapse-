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

afterAll(async () => {
  await db.destroy();
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

      expect(res.status).toBe(400);
    });

    it('should block a high-risk payout request', async () => {
      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({
          recipientAccountId,
          amount: 65.00,
          idempotencyKey: `idem_payout_risk_block_${Date.now()}`,
          sourceType: 'EARNINGS',
          sourceReferenceId: `royalty_block_${Date.now()}`,
          riskContext: {
            creatorId: 'creator-route-block',
            payoutDestination: 'acct_route_blocked',
            dnaVerified: false,
            soulprintVerified: false,
            ledgerRecordFound: false,
            creatorAccountAgeDays: 0,
            payoutMethodAgeDays: 0,
            suddenUsageSpike: true,
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('risk_blocked');
    });

    it('should hold and then release a manual-review payout', async () => {
      const create = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({
          recipientAccountId,
          amount: 33.00,
          idempotencyKey: `idem_payout_review_${Date.now()}`,
          sourceType: 'EARNINGS',
          sourceReferenceId: `royalty_review_${Date.now()}`,
          riskContext: {
            creatorId: 'creator-route-review',
            payoutDestination: 'acct_route_review',
            dnaVerified: false,
            soulprintVerified: false,
            ledgerRecordFound: true,
            creatorAccountAgeDays: 120,
            payoutMethodAgeDays: 120,
          },
        });

      expect(create.status).toBe(201);
      expect(create.body.status).toBe('PENDING');
      expect(create.body.manualReviewRequired).toBe(true);

      const release = await request(app)
        .post(`/api/v1/payouts/${create.body.id}/release`)
        .set('Authorization', `Bearer ${VALID_KEY}`)
        .set('X-Organization-ID', ORG_ID)
        .send({ note: 'Compliance approved' });

      expect(release.status).toBe(200);
      expect(release.body.status).toBe('PAID');
      expect(release.body.manualReviewRequired).toBe(false);
    });

    it('should fail without auth', async () => {
      const res = await request(app).get('/api/v1/payouts');
      expect(res.status).toBe(401);
    });
  });
});
