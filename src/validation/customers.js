const Joi = require('joi');

const validateCustomerCreate = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    phone: Joi.string().optional(),
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
  validateCustomerCreate
};
