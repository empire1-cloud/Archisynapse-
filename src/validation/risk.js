const Joi = require('joi');

const royaltyRiskSchema = Joi.object({
  eventType: Joi.string().default('royalty_payout_request'),
  amount: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('USD'),
  userId: Joi.string().allow('', null).optional(),
  creatorId: Joi.string().allow('', null).optional(),
  trackId: Joi.string().allow('', null).optional(),
  deviceId: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  sessionId: Joi.string().allow('', null).optional(),
  payoutDestination: Joi.string().allow('', null).optional(),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).allow('', null).optional(),
  country: Joi.string().max(4).allow('', null).optional(),
  dnaVerified: Joi.boolean().default(false),
  soulprintVerified: Joi.boolean().default(false),
  ledgerRecordFound: Joi.boolean().default(false),
  usageCount: Joi.number().integer().min(0).default(0),
  suddenUsageSpike: Joi.boolean().default(false),
  creatorAccountAgeDays: Joi.number().integer().min(0).default(0),
  payoutMethodAgeDays: Joi.number().integer().min(0).default(0),
  duplicatePayoutDestination: Joi.boolean().default(false),
  payoutDestinationChangedRecently: Joi.boolean().default(false),
});

function normalizeRoyaltyRiskPayload(payload) {
  return royaltyRiskSchema.validate(payload);
}

const validateRoyaltyRisk = (req, res, next) => {
  const { error, value } = normalizeRoyaltyRiskPayload(req.body);

  if (error) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: error.details[0].message,
      },
    });
  }

  req.body = value;
  next();
};

module.exports = {
  validateRoyaltyRisk,
  normalizeRoyaltyRiskPayload,
};
