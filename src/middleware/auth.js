const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function parseApiKeyMap() {
  if (process.env.API_KEY_ORG_MAP) {
    try {
      return JSON.parse(process.env.API_KEY_ORG_MAP);
    } catch (error) {
      logger.error('Failed to parse API_KEY_ORG_MAP', { error: error.message });
    }
  }

  return {
    sk_test_123456789: 'org_demo',
  };
}

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
      const apiKeyMap = parseApiKeyMap();
      const organizationId = apiKeyMap[token];
      if (!organizationId) {
        return res.status(401).json({
          error: {
            code: 'invalid_api_key',
            message: 'Unknown API key'
          }
        });
      }

      const requestedOrgId = req.headers['x-organization-id'];
      if (requestedOrgId && requestedOrgId !== organizationId) {
        return res.status(403).json({
          error: {
            code: 'organization_mismatch',
            message: 'API key does not have access to the requested organization'
          }
        });
      }

      req.apiKey = token;
      req.user = { type: 'api_key', organizationId };
      req.organizationId = organizationId;
      return next();
    }

    // For JWT tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const organizationId = decoded.organizationId || decoded.orgId || decoded.organization_id;
    if (!organizationId) {
      return res.status(401).json({
        error: {
          code: 'invalid_token',
          message: 'Token is missing organization context'
        }
      });
    }

    const requestedOrgId = req.headers['x-organization-id'];
    if (requestedOrgId && requestedOrgId !== organizationId) {
      return res.status(403).json({
        error: {
          code: 'organization_mismatch',
          message: 'Token does not have access to the requested organization'
        }
      });
    }

    req.user = decoded;
    req.organizationId = organizationId;
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
