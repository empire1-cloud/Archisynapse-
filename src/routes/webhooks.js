const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const logger = require('../utils/logger');

const TABLE = 'webhook_events';

router.post('/', async (req, res, next) => {
  try {
    const id = 'evt_' + uuidv4().replace(/-/g, '').slice(0, 12);
    const now = new Date().toISOString();
    const row = {
      id,
      event_type: req.body.type || 'unknown',
      payload: JSON.stringify(req.body),
      status: 'pending',
      retries: 0,
      created_at: now,
    };

    await db(TABLE).insert(row);
    logger.info('Webhook event received', { eventType: row.event_type, eventId: id });
    res.status(200).json({ received: true, id });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;
    let query = db(TABLE).orderBy('created_at', 'desc');
    if (type) query = query.where({ event_type: type });

    const [{ count }] = await query.clone().count('* as count');
    const total = Number(count);

    const rows = await query.clone().limit(Math.min(Number(limit), 100)).offset(Number(offset));

    const data = rows.map((row) => {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
      return {
        id: row.id,
        type: row.event_type,
        data: payload.data || {},
        status: row.status,
        retries: row.retries,
        created_at: row.created_at,
        delivered_at: row.delivered_at,
        raw: payload,
      };
    });

    res.json({
      data,
      total,
      limit: Math.min(Number(limit), 100),
      offset: Number(offset),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
