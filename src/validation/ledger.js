const Joi = require('joi');
const { AppError } = require('../middleware/errorHandler');

const amountPattern = /^\d+(\.\d{1,4})?$/;

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
    if (error) {
      return next(new AppError(error.details[0].message, 400, 'validation_error'));
    }
    req.body = value;
    next();
  };
}

const validateLedgerAccountCreate = validate(
  Joi.object({
    code: Joi.string().max(20).required(),
    name: Joi.string().max(255).required(),
    type: Joi.string().valid('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE').required(),
    currency: Joi.string().length(3).default('USD'),
    metadata: Joi.object().optional(),
  })
);

const validateLedgerTransactionCreate = validate(
  Joi.object({
    type: Joi.string().valid('PAYMENT', 'PAYOUT', 'REFUND', 'CHARGEBACK', 'FEE', 'REVERSAL', 'ADJUSTMENT').required(),
    referenceId: Joi.string().max(100).optional(),
    description: Joi.string().required(),
    amount: Joi.alternatives().try(Joi.number().positive(), Joi.string().pattern(amountPattern)).required(),
    currency: Joi.string().length(3).default('USD'),
    idempotencyKey: Joi.string().max(255).optional(),
    metadata: Joi.object().optional(),
    entries: Joi.array().min(2).items(
      Joi.object({
        accountId: Joi.string().required(),
        debitCredit: Joi.string().valid('DEBIT', 'CREDIT').required(),
        amount: Joi.alternatives().try(Joi.number().positive(), Joi.string().pattern(amountPattern)).required(),
        description: Joi.string().required(),
        metadata: Joi.object().optional(),
      })
    ).required(),
  })
);

const validateLedgerReversal = validate(
  Joi.object({
    reason: Joi.string().required(),
  })
);

module.exports = {
  validateLedgerAccountCreate,
  validateLedgerTransactionCreate,
  validateLedgerReversal,
};
