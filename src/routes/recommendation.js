const express = require('express');
const Joi = require('joi');
const recommendationService = require('../services/recommendationService');

const router = express.Router();

const blueprintSchema = Joi.object({
  merchant_id: Joi.string().max(200),
  components: Joi.array()
    .min(1)
    .items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required(),
        region: Joi.string(),
        cost_per_tx: Joi.number().min(0),
      }).unknown(true)
    )
    .required(),
  volumes: Joi.object({
    daily_tx: Joi.number().integer().min(0).required(),
    tps: Joi.number().min(0),
    avg_value: Joi.number().min(0),
  })
    .unknown(true)
    .required(),
}).unknown(true);

function betaEnabled(req) {
  if (process.env.AI_BLUEPRINT_BETA_ENABLED === 'true') return true;
  const features = req.user && Array.isArray(req.user.features) ? req.user.features : [];
  return features.includes('ai_blueprint_beta');
}

router.post('/recommendation', async (req, res) => {
  if (!betaEnabled(req)) {
    return res.status(403).json({
      error: {
        code: 'feature_not_enabled',
        message: 'AI Blueprint recommendations are limited to approved beta users.',
      },
    });
  }

  const { error, value } = blueprintSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    return res.status(400).json({
      error: {
        code: 'invalid_blueprint',
        message: 'Blueprint validation failed.',
        details: error.details.map(detail => detail.message),
      },
    });
  }

  try {
    const result = await recommendationService.recommend(value);
    return res.json(result);
  } catch (err) {
    console.error('Recommendation handler error', err);
    return res.status(500).json({
      error: {
        code: 'recommendation_error',
        message: 'The recommendation could not be generated.',
      },
    });
  }
});

module.exports = router;
