import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Services mapping
const SERVICES = {
  transactions: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:8001',
  customers: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:8002',
  payouts: process.env.PAYOUT_SERVICE_URL || 'http://localhost:8003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8007'
};

// Rate Limits by Tenant Tier (Requests per minute)
const TIER_LIMITS = {
  free: 100,
  pro: 1000,
  enterprise: 10000
};

// Seed Tenants for In-Memory Fallback
const MEMORY_TENANTS = [
  { id: 'tenant_acme_101', name: 'Acme E-Commerce', api_key: 'sk_test_archisynapse_12345', tier: 'pro' },
  { id: 'tenant_free_99', name: 'Free Garage Shop', api_key: 'sk_test_free_key_54321', tier: 'free' },
  { id: 'tenant_enterprise_777', name: 'MegaCorp Global', api_key: 'sk_test_enterprise_99999', tier: 'enterprise' }
];

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
  console.warn('Postgres Pool Error - enabling in-memory db fallback:', err.message);
  useDbFallback = true;
});

// Test connection on startup
try {
  const client = await pool.connect();
  console.log('Gateway successfully connected to Postgres database');
  client.release();
} catch (e) {
  console.warn('Postgres database unreachable. Falling back to in-memory Tenant registry.');
  useDbFallback = true;
}

// Redis Client Connection
let redisClient;
let useRedisFallback = false;
async function connectRedis() {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    console.warn('Redis Client Error - enabling in-memory cache fallback');
    useRedisFallback = true;
  });

  try {
    await redisClient.connect();
    console.log('Gateway successfully connected to Redis');
  } catch (err) {
    console.warn('Redis cache unreachable. Falling back to in-memory rate limiting.');
    useRedisFallback = true;
  }
}
connectRedis();

// In-Memory Fallback Stores
const memoryRateLimits = new Map(); // key -> { count, expires }
const memoryAuthCache = new Map(); // apiKey -> tenant details

// Helper: Get Tenant Details with Fallback
async function getTenantDetails(apiKey) {
  if (useDbFallback) {
    const tenant = MEMORY_TENANTS.find(t => t.api_key === apiKey);
    return tenant || null;
  }

  const cacheKey = `auth:key:${apiKey}`;
  
  // Try Redis Cache
  if (redisClient && redisClient.isOpen && !useRedisFallback) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn('Redis cache read failed');
    }
  } else {
    // In-memory cache fallback
    if (memoryAuthCache.has(apiKey)) {
      return memoryAuthCache.get(apiKey);
    }
  }

  // Query PostgreSQL Database
  try {
    const res = await pool.query('SELECT id, name, tier FROM tenants WHERE api_key = $1', [apiKey]);
    if (res.rows.length === 0) return null;
    const tenant = res.rows[0];

    // Cache results
    if (redisClient && redisClient.isOpen && !useRedisFallback) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(tenant), { EX: 600 });
      } catch (e) {}
    } else {
      memoryAuthCache.set(apiKey, tenant);
    }
    return tenant;
  } catch (err) {
    console.warn('Database query failed. Falling back to in-memory tenants.');
    useDbFallback = true;
    const tenant = MEMORY_TENANTS.find(t => t.api_key === apiKey);
    return tenant || null;
  }
}

// Middleware: Authentication
async function authenticateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected Bearer Token.'
    });
  }

  const apiKey = authHeader.split(' ')[1];
  try {
    const tenant = await getTenantDetails(apiKey);
    if (!tenant) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API Key provided.'
      });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate request.'
    });
  }
}

// Middleware: Rate Limiter with Fallback
async function rateLimiter(req, res, next) {
  const tenant = req.tenant;
  const limit = TIER_LIMITS[tenant.tier] || TIER_LIMITS.free;
  const currentMinute = new Date().toISOString().substring(0, 16);
  const rateKey = `${tenant.id}:${currentMinute}`;

  if (useRedisFallback || !redisClient || !redisClient.isOpen) {
    // In-memory sliding window rate limiter fallback
    const now = Date.now();
    const entry = memoryRateLimits.get(rateKey) || { count: 0, expires: now + 60000 };

    if (now > entry.expires) {
      entry.count = 1;
      entry.expires = now + 60000;
    } else {
      entry.count += 1;
    }
    memoryRateLimits.set(rateKey, entry);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - entry.count));

    if (entry.count > limit) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for tier '${tenant.tier}'. Limit is ${limit} req/min. In-memory mode active.`
      });
    }
    return next();
  }

  // Standard Redis Rate Limiter
  try {
    const key = `rate:${rateKey}`;
    const requests = await redisClient.incr(key);
    if (requests === 1) {
      await redisClient.expire(key, 59);
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - requests));

    if (requests > limit) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for tier '${tenant.tier}'. Limit is ${limit} req/min.`
      });
    }
    next();
  } catch (err) {
    console.warn('Redis rate limiter error, bypassing to in-memory');
    useRedisFallback = true;
    return rateLimiter(req, res, next);
  }
}

// Gateway Public Health Check
app.get('/health', async (req, res) => {
  let dbStatus = useDbFallback ? 'fallback-mode' : 'healthy';
  let redisStatus = useRedisFallback ? 'fallback-mode' : 'healthy';

  if (!useDbFallback) {
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      dbStatus = 'fallback-mode';
    }
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gateway: 'healthy',
      database: dbStatus,
      cache: redisStatus
    }
  });
});

// Proxy Router
app.all('/v1/:service*', authenticateApiKey, rateLimiter, async (req, res) => {
  const serviceKey = req.params.service;
  const serviceUrl = SERVICES[serviceKey];

  if (!serviceUrl) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Endpoint '/v1/${serviceKey}' does not exist.`
    });
  }

  const downstreamPath = req.originalUrl.replace(/^\/v1/, '');
  const url = `${serviceUrl}${downstreamPath}`;

  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (key !== 'host' && key !== 'authorization') {
        headers.append(key, value);
      }
    }
    headers.append('X-Tenant-ID', req.tenant.id);
    headers.append('X-Tenant-Tier', req.tenant.tier);
    headers.append('Content-Type', 'application/json');

    const options = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');

    response.headers.forEach((value, name) => {
      if (name !== 'transfer-encoding' && name !== 'connection') {
        res.setHeader(name, value);
      }
    });

    res.status(response.status);

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (err) {
    console.error(`Gateway proxy failed routing to ${url}`);
    return res.status(503).json({
      error: 'Service Unavailable',
      message: `The downstream service '${serviceKey}' is offline or unreachable.`
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Valid routes must start with /v1/ followed by the microservice name.'
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT} (Resilient Local Mode enabled)`);
});
