import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import amqp from 'amqplib';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import crypto from 'crypto';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Shared Local Memory Event Spine for Zero-Dependency offline fallback
export const localEventSpine = new EventEmitter();

// Load and compile schemas dynamically on startup
const SCHEMAS = {};
const schemaMappings = {
  'transaction.authorized': '../schemas/transaction_authorized.json',
  'ledger.written': '../schemas/ledger_written.json',
  'payout.completed': '../schemas/payout_completed.json',
  'fraud.flagged': '../schemas/fraud_flagged.json',
  'royalty.routed': '../schemas/royalty_routed.json'
};

for (const [evt, relPath] of Object.entries(schemaMappings)) {
  try {
    const absPath = path.resolve(__dirname, relPath);
    if (fs.existsSync(absPath)) {
      const raw = fs.readFileSync(absPath, 'utf8');
      SCHEMAS[evt] = ajv.compile(JSON.parse(raw));
    }
  } catch (err) {
    console.error(`Failed to compile schema for event: ${evt}`, err.message);
  }
}

// RabbitMQ channel helper
let rabbitChannel = null;
let connectionFailed = false;

async function getRabbitChannel() {
  if (rabbitChannel) return rabbitChannel;
  if (connectionFailed) return null;

  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange('payment_events', 'topic', { durable: true });
    return rabbitChannel;
  } catch (e) {
    connectionFailed = true;
    console.warn('[Event Publisher] RabbitMQ broker unreachable. Shifting to local in-memory event spine.');
    return null;
  }
}

/**
 * Validates and Publishes a Payment OS Event
 * @param {string} eventType e.g., 'transaction.authorized'
 * @param {object} payload Payload matching JSON schema
 */
export async function publishOSEvent(eventType, payload) {
  // Inject standard metadata if missing
  if (!payload.event_id) payload.event_id = `evt_${crypto.randomBytes(6).toString('hex')}`;
  if (!payload.event_type) payload.event_type = eventType;
  if (!payload.timestamp) payload.timestamp = new Date().toISOString();

  // 1. Strict Schema Validation using AJV
  const validate = SCHEMAS[eventType];
  if (validate) {
    const isValid = validate(payload);
    if (!isValid) {
      const errs = validate.errors.map(e => `${e.instancePath} ${e.message}`).join(', ');
      throw new Error(`Event Validation Failed for ${eventType}: ${errs}`);
    }
  } else {
    console.warn(`[Event Publisher] No schema found to validate event: ${eventType}`);
  }

  // 2. Publish Event
  const channel = await getRabbitChannel();
  if (channel) {
    try {
      channel.publish('payment_events', eventType, Buffer.from(JSON.stringify(payload)));
      console.log(`[Event Publisher] Dispatched to RabbitMQ [${eventType}]: ${payload.event_id}`);
      return;
    } catch (err) {
      console.warn('[Event Publisher] Failed to write to RabbitMQ, bypassing to in-memory spine.');
    }
  }

  // In-Memory Fallback Publish
  localEventSpine.emit(eventType, payload);
  console.log(`[Event Publisher - Offline Fallback] Emitted in-memory [${eventType}]: ${payload.event_id}`);
}
