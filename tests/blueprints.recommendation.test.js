const request = require('supertest');
const app = require('../src/index');

describe('POST /api/v1/blueprints/recommendation', () => {
  it('returns 400 for bad input', async () => {
    const res = await request(app).post('/api/v1/blueprints/recommendation').send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns recommendations for valid blueprint', async () => {
    const blueprint = {
      merchant_id: 'm_test_1',
      components: [{ id: 'acquirer_x', type: 'acquirer', region: 'NG', cost_per_tx: 0.02 }],
      volumes: { tps: 1, daily_tx: 300, avg_value: 2000 }
    };
    const res = await request(app).post('/api/v1/blueprints/recommendation').send(blueprint);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('recommendations');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });
});
