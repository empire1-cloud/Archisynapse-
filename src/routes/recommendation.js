const express = require('express');
const router = express.Router();
const blueprintService = require('../services/blueprintService');
const recommendationService = require('../services/recommendationService');

// existing routes omitted (file is updated in place) - keep other handlers above

router.post('/recommendation', async (req, res) => {
  try {
    const blueprint = req.body;
    if (!blueprint || !blueprint.components) return res.status(400).json({ error: 'blueprint with components required' });

    // simple rate limiting / beta gating could be inserted here
    const result = await recommendationService.recommend(blueprint, { user: req.user || null });
    res.json(result);
  } catch (err) {
    console.error('Recommendation handler error', err);
    res.status(500).json({ error: 'recommendation_error', message: err.message });
  }
});

module.exports = router;
