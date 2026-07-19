const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

function emitEvent(name, payload = {}) {
  // Format and output event; in prod hook to Kafka / event bus / analytics
  const ev = { event: name, timestamp: new Date().toISOString(), payload };
  logger.info(ev);
}

module.exports = { emitEvent };
