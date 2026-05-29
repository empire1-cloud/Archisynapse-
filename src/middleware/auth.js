const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: {
        code: 'invalid_api_key',
        message: 'Missing authorization header'
      }
    });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // For API keys (sk_xxx format)
    if (token.startsWith('sk_')) {
      req.apiKey = token;
      req.user = { type: 'api_key' };
      return next();
    }

    // For JWT tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Auth error:', err.message);
    res.status(401).json({
      error: {
        code: 'invalid_token',
        message: 'Invalid or expired token'
      }
    });
  }
};

module.exports = authMiddleware;
