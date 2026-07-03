const Joi = require('joi');

const validateTransactionCreate = (req, res, next) => {
  const schema = Joi.object({
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).default('USD'),
    type: Joi.string().valid('payment', 'stream_royalty', 'stem_license', 'referral_passive', 'split', 'refund').optional(),
    description: Joi.string().optional(),
    customerId: Joi.string().optional(),
    idempotencyKey: Joi.string().required(),
    customer: Joi.object({
      id: Joi.string().required(),
      email: Joi.string().email().required()
    }).optional(),
    payment_method: Joi.object({
      type: Joi.string().valid('CARD', 'BANK_TRANSFER', 'WALLET', 'card', 'bank_transfer', 'wallet').required(),
      token: Joi.string().required(),
      last4: Joi.string().optional(),
      brand: Joi.string().optional(),
    }).required(),
    metadata: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: error.details[0].message
      }
    });
  }

  req.body = value;
  next();
};

module.exports = {
  validateTransactionCreate
};
