const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const receivedEvents = [];

// Receive webhook event
router.post('/', async (req, res, next) => {
  try {
    const event = {
      id: `evt_${Date.now()}`,
      type: req.body.type || 'unknown',
      data: req.body.data || {},
      created_at: new Date().toISOString(),
      raw: req.body
    };

    receivedEvents.unshift(event);
    if (receivedEvents.length > 100) receivedEvents.pop();

    logger.info('Webhook event received', { eventType: event.type, eventId: event.id });
    res.status(200).json({ received: true, id: event.id });
  } catch (err) {
    next(err);
  }
});

// List recent webhook events
router.get('/', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;
    let events = receivedEvents;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    const paginated = events.slice(parseInt(offset), parseInt(offset) + Math.min(parseInt(limit), 100));
    res.json({
      data: paginated,
      total: events.length,
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
