const { v4: uuidv4 } = require('uuid');

const payouts = new Map();

const seedPayouts = () => {
  if (payouts.size > 0) return;
  const amounts = [5000, 12000, 8000, 20000, 3500];
  const statuses = ['completed', 'pending', 'completed', 'processing', 'completed'];
  amounts.forEach((amount, i) => {
    const id = 'po_' + uuidv4().replace(/-/g, '').slice(0, 12);
    payouts.set(id, {
      id,
      amount,
      currency: 'USD',
      status: statuses[i],
      destination: `bank_account_${i + 1}`,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      completed_at: statuses[i] === 'completed' ? new Date(Date.now() - i * 86400000 + 3600000).toISOString() : null
    });
  });
};
seedPayouts();

const listPayouts = async ({ limit = 20, offset = 0, status } = {}) => {
  let all = Array.from(payouts.values())
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (status) {
    all = all.filter(p => p.status === status);
  }

  const paginated = all.slice(offset, offset + limit);
  return {
    data: paginated,
    total: all.length,
    limit: Math.min(parseInt(limit), 100),
    offset: parseInt(offset)
  };
};

module.exports = {
  listPayouts
};
