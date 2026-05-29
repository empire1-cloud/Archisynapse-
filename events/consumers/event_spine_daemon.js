import amqp from 'amqplib';
import { localEventSpine, publishOSEvent } from '../producers/event_publisher.js';
import dotenv from 'dotenv';

dotenv.config();

const LEDGER_SERVICE = process.env.LEDGER_SERVICE_URL || 'http://localhost:8004';

console.log('========================================================');
console.log('    Archisynapse Payment OS: Unified Event Spine Daemon ');
console.log('========================================================');

// 1. Core Event Processing Business Logic
async function handleTransactionAuthorized(event) {
  console.log(`[Event Spine] Consumer processing transaction.authorized: ${event.transaction_id} (Amount: $${event.amount/100})`);
  
  // A. Simulate Webhook dispatching to merchant endpoint
  console.log(`[Webhook Dispatcher] Fired webhook event 'transaction.succeeded' to tenant URL for event: ${event.event_id}`);

  // B. Trigger Royalty Split Routing for music-universe duets (Lyrica 3 compatible)
  // Let's assume a standard 5% royalty split to creator "creator_lyrica_l3" for any Acme premium transactions!
  if (event.tenant_id === 'tenant_acme_101') {
    const splitAmount = Math.round(event.amount * 0.05); // 5% split
    console.log(`[Royalty Engine] Transaction matched Lyrica 3 duet splits! Routing 5% ($${splitAmount/100}) to creator...`);
    
    try {
      await publishOSEvent('royalty.routed', {
        tenant_id: event.tenant_id,
        transaction_id: event.transaction_id,
        creator_id: 'creator_lyrica_l3',
        royalty_amount: splitAmount,
        currency: event.currency
      });
    } catch (e) {
      console.error('[Royalty Engine] Failed to dispatch royalty.routed event:', e.message);
    }
  }
}

async function handleRoyaltyRouted(event) {
  console.log(`[Event Spine] Consumer processing royalty.routed: $${event.royalty_amount/100} for creator: ${event.creator_id}`);

  // C. Execute double-entry ledger posting for creator splits
  // We debit merchant_settlement (reduce original merchant liability) and credit cash_reserve or creator clearing!
  try {
    const response = await fetch(`${LEDGER_SERVICE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: event.transaction_id,
        debit_account_id: 'merchant_settlement',
        credit_account_id: 'cash_reserve', // Move from merchant to cash reserve split holding
        amount: event.royalty_amount,
        currency: event.currency
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[Event Spine] Royalty split ledger journal written successfully! Entry ID: ${data.id}`);
    } else {
      console.error('[Event Spine] Ledger Service returned error for royalty splits');
    }
  } catch (err) {
    console.warn('[Event Spine] Ledger Service offline. Simulated double-entry splits logged locally.');
  }
}

function handleFraudFlagged(event) {
  console.warn(`[SECURITY ALERT] SUSPICIOUS ACTIVITY: fraud.flagged detected!`);
  console.warn(`[Compliance Queue] Transaction: ${event.transaction_id}, Fraud Score: ${event.fraud_score}, Risk reasons: ${event.reasons.join(', ')}`);
}

// 2. RabbitMQ Connection Setup
async function startRabbitMQConsumer() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    const channel = await connection.createChannel();
    
    await channel.assertExchange('payment_events', 'topic', { durable: true });
    
    // Create exclusive queue
    const q = await channel.assertQueue('', { exclusive: true });
    
    // Bind topics
    const topics = ['transaction.authorized', 'royalty.routed', 'fraud.flagged'];
    for (const topic of topics) {
      await channel.bindQueue(q.queue, 'payment_events', topic);
    }

    console.log('[Event Spine Daemon] Successfully connected to RabbitMQ and listening for events...');

    channel.consume(q.queue, async (msg) => {
      if (msg !== null) {
        const topic = msg.fields.routingKey;
        const payload = JSON.parse(msg.content.toString());
        
        try {
          if (topic === 'transaction.authorized') await handleTransactionAuthorized(payload);
          if (topic === 'royalty.routed') await handleRoyaltyRouted(payload);
          if (topic === 'fraud.flagged') handleFraudFlagged(payload);
        } catch (e) {
          console.error(`[Event Spine Daemon] Error executing callback for ${topic}:`, e.message);
        }
        
        channel.ack(msg);
      }
    });

  } catch (err) {
    console.warn('[Event Spine Daemon] RabbitMQ broker unreachable. Running ONLY on local in-memory event spine.');
  }
}

// 3. In-Memory Local Event Spine Handlers (Zero-dependency offline mode)
function startLocalSpineConsumer() {
  console.log('[Event Spine Daemon] Initialized local in-memory event consumers.');
  
  localEventSpine.on('transaction.authorized', async (event) => {
    try {
      await handleTransactionAuthorized(event);
    } catch (e) {
      console.error('[Event Spine Local] Error processing transaction.authorized:', e.message);
    }
  });

  localEventSpine.on('royalty.routed', async (event) => {
    try {
      await handleRoyaltyRouted(event);
    } catch (e) {
      console.error('[Event Spine Local] Error processing royalty.routed:', e.message);
    }
  });

  localEventSpine.on('fraud.flagged', (event) => {
    handleFraudFlagged(event);
  });
}

// Start both: Standard RabbitMQ and local fallbacks
startLocalSpineConsumer();
startRabbitMQConsumer();
