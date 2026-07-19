require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const db = require('./db');
const { errorHandler } = require('./middleware/errorHandler');

const authMiddleware = require('./middleware/auth');
const transactionRoutes = require('./routes/transactions');
const customerRoutes = require('./routes/customers');
const payoutRoutes = require('./routes/payouts');
const webhookRoutes = require('./routes/webhooks');
const dashboardRoutes = require('./routes/dashboard');
const blueprintRoutes = require('./routes/blueprints');
const ledgerRoutes = require('./routes/ledger');
const riskRoutes = require('./routes/risk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT) || 100,
    message: {
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use(limiter);
}

app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

app.get('/', (req, res) => {
  res.json({
    service: 'ArchiSynapse API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.json({ ready: true, uptime: process.uptime() });
});

app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/payouts', payoutRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/blueprints', blueprintRoutes);
app.use('/api/v1/ledger', ledgerRoutes);
app.use('/api/v1/risk', riskRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

app.use(errorHandler);

async function startup() {
  try {
    logger.info('Running migrations...');
    await db.migrate.latest();
    logger.info('Migrations complete');

    const customerCount = await db('customers').count('* as count').first();
    if (Number(customerCount.count) === 0) {
      const { seed } = require('./seed');
      await seed();
    }

    app.listen(PORT, () => {
      logger.info(`Archisynapse API server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startup();
}

module.exports = app;
