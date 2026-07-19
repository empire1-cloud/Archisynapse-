const crypto = require('crypto');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const BLOCKED_KEYS = /^(merchant_id|merchantId|email|ip|ip_address|phone|token|secret|password)$/i;

function pseudonymizeIdentifier(value, key = process.env.TELEMETRY_HMAC_KEY) {
  if (value === undefined || value === null || value === '' || !key) return null;
  const digest = crypto
    .createHmac('sha256', key)
    .update(String(value))
    .digest('hex')
    .slice(0, 24);
  return `anon_${digest}`;
}

function sanitizePayload(value) {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((clean, [key, item]) => {
    if (!BLOCKED_KEYS.test(key)) clean[key] = sanitizePayload(item);
    return clean;
  }, {});
}

function emitEvent(name, payload = {}) {
  const event = {
    event: name,
    timestamp: new Date().toISOString(),
    payload: sanitizePayload(payload),
  };
  logger.info(event);
  return event;
}

module.exports = { emitEvent, pseudonymizeIdentifier, sanitizePayload };
