const request = require('supertest');
const app = require('../src/index');
const telemetry = require('../src/utils/telemetry');
const { calculateMonthlySavings } = require('../src/services/recommendationService');
const { anonymizeBlueprint } = require('../scripts/anonymize_blueprints');

const sampleBlueprint = {
  merchant_id: 'm_test_1',
  components: [
    { id: 'acquirer_x', type: 'acquirer', region: 'NG', cost_per_tx: 0.02 },
  ],
  volumes: { tps: 1, daily_tx: 300, avg_value: 2000 },
};

describe('POST /api/v1/blueprints/recommendation', () => {
  beforeEach(() => {
    process.env.AI_BLUEPRINT_BETA_ENABLED = 'true';
    process.env.TELEMETRY_HMAC_KEY = 'test-telemetry-key';
  });

  afterEach(() => {
    delete process.env.AI_BLUEPRINT_BETA_ENABLED;
    delete process.env.TELEMETRY_HMAC_KEY;
    jest.restoreAllMocks();
  });

  it('fails closed when beta access is disabled', async () => {
    delete process.env.AI_BLUEPRINT_BETA_ENABLED;
    const res = await request(app)
      .post('/api/v1/blueprints/recommendation')
      .send(sampleBlueprint);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('feature_not_enabled');
  });

  it('returns 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/blueprints/recommendation')
      .send({ components: [] });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('invalid_blueprint');
  });

  it('returns a human-gated recommendation with defensible fee math', async () => {
    const res = await request(app)
      .post('/api/v1/blueprints/recommendation')
      .send(sampleBlueprint);

    expect(res.statusCode).toBe(200);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].requires_human_approval).toBe(true);
    expect(
      res.body.recommendations[0].simulated_outcome.estimated_monthly_savings_usd
    ).toBe(63);
    expect(res.body.metadata.model_kind).toBe('heuristic_scaffold');
  });

  it('does not emit the raw merchant identifier', async () => {
    const emit = jest.spyOn(telemetry, 'emitEvent').mockImplementation(() => null);

    await request(app)
      .post('/api/v1/blueprints/recommendation')
      .send(sampleBlueprint);

    const payload = emit.mock.calls[0][1];
    expect(payload).not.toHaveProperty('merchant_id');
    expect(payload.merchant_pseudonym).toMatch(/^anon_/);
    expect(payload.merchant_pseudonym).not.toContain(sampleBlueprint.merchant_id);
  });
});

describe('recommendation estimate', () => {
  it('returns null when transaction cost data is unavailable', () => {
    const result = calculateMonthlySavings(
      { components: [{ id: 'x', type: 'acquirer' }], volumes: { daily_tx: 300 } },
      0.35
    );
    expect(result.status).toBe('insufficient_cost_data');
    expect(result.estimated_monthly_savings_usd).toBeNull();
  });
});

describe('blueprint anonymizer', () => {
  it('pseudonymizes merchant IDs and recursively redacts PII', () => {
    const result = anonymizeBlueprint(
      {
        merchant_id: 'merchant-123',
        owner_email: 'owner@example.com',
        metadata: {
          ip_address: '192.168.1.10',
          note: 'Contact https://example.com/private',
        },
      },
      { key: 'test-anonymization-key' }
    );

    expect(result.merchant_id).toMatch(/^anon_/);
    expect(result.merchant_id).not.toContain('merchant-123');
    expect(result.owner_email).toBe('[REDACTED]');
    expect(result.metadata.ip_address).toBe('[REDACTED]');
    expect(result.metadata.note).toBe('[REDACTED]');
  });
});
